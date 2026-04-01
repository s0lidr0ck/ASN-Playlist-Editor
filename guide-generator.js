const fs = require('fs');
const path = require('path');

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQPrMS5AafeTGXbXB4ZB-g8w-2WYCuc0jsj0mBiJ-A5mzlVJSaHlsaVvqV6tsxQeTuirv-1A-bJI-4W/pub?output=csv';
const DEFAULT_ASN_PATH = path.join(__dirname, 'ASN Guide', 'ASN.in');

function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                value += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(value);
            value = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            row.push(value);
            rows.push(row);
            row = [];
            value = '';
        } else {
            value += char;
        }
    }

    if (value.length > 0 || row.length > 0) {
        row.push(value);
        rows.push(row);
    }

    return rows.filter((cells) => cells.some((cell) => cell !== ''));
}

function normalizeHeader(header) {
    return String(header || '')
        .replace(/^\uFEFF/, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ');
}

function findColumn(headers, candidates) {
    const normalizedHeaders = headers.map((header) => normalizeHeader(header));
    for (const candidate of candidates) {
        const index = normalizedHeaders.indexOf(normalizeHeader(candidate));
        if (index !== -1) {
            return index;
        }
    }
    return -1;
}

function cleanEpisodeTitle(title) {
    return String(title || '').replace(/^S\d+\s*E\d+\s*/i, '').trim();
}

function pad(value) {
    return String(value).padStart(2, '0');
}

function parseDateTime(value) {
    const [datePart, timePart] = String(value).split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, second);
}

function formatDateTime(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatCsvValue(value) {
    const stringValue = String(value ?? '');
    if (/[",\n\r]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

async function loadShowMap(sheetUrl = DEFAULT_SHEET_URL) {
    const response = await fetch(sheetUrl);
    if (!response.ok) {
        throw new Error(`Unable to load show information (${response.status} ${response.statusText})`);
    }

    const csvText = await response.text();
    const rows = parseCsv(csvText);

    if (rows.length < 2) {
        throw new Error('Show information sheet is empty');
    }

    const headers = rows[0];
    const asnIndex = findColumn(headers, ['ASN', 'PUR', 'ASN Number']);
    const showNameIndex = findColumn(headers, ['Show Name', 'Program Title']);
    const episodeTitleIndex = findColumn(headers, ['Episode Title', 'Title']);
    const episodeDescriptionIndex = findColumn(headers, ['Episode Description', 'Description', 'Synopsis']);

    if ([asnIndex, showNameIndex, episodeTitleIndex, episodeDescriptionIndex].some((index) => index === -1)) {
        throw new Error('Show information sheet is missing one or more required columns');
    }

    const showMap = new Map();

    for (const cells of rows.slice(1)) {
        const rawAsn = String(cells[asnIndex] || '').trim();
        const digits = rawAsn.replace(/\D/g, '');
        if (!digits) {
            continue;
        }

        showMap.set(digits.padStart(5, '0'), {
            showName: String(cells[showNameIndex] || '').trim(),
            episodeTitle: cleanEpisodeTitle(cells[episodeTitleIndex]),
            episodeDescription: String(cells[episodeDescriptionIndex] || '').trim()
        });
    }

    return showMap;
}

function parseScheduleEntries(fileContent) {
    const scheduleEntries = [];

    for (const line of fileContent.split(/\r?\n/)) {
        if (!line.trim() || !line.includes('EventType=2')) {
            continue;
        }

        const parts = line.trim().split('\t');
        if (parts.length < 3) {
            continue;
        }

        const dateTimeString = parts[0];
        const namePart = parts[2];
        const asnMatch = namePart.match(/ASN(\d{5})/);

        if (!asnMatch) {
            continue;
        }

        const [date, time] = dateTimeString.split('T');
        if (!date || !time) {
            continue;
        }

        scheduleEntries.push({
            date,
            time,
            asn: asnMatch[1]
        });
    }

    return scheduleEntries;
}

function loadScheduleEntries(asnFilePath = DEFAULT_ASN_PATH) {
    const fileContent = fs.readFileSync(asnFilePath, 'utf8');
    return parseScheduleEntries(fileContent);
}

function buildGuideRows(scheduleEntries, showMap) {
    return scheduleEntries.map((entry) => {
        const showInfo = showMap.get(entry.asn);
        if (!showInfo) {
            return {
                Date: entry.date,
                Time: entry.time,
                ASN: `ASN${entry.asn}`,
                'Show Name': 'Missing',
                'Episode Title': 'Missing',
                'Episode Description': 'Missing'
            };
        }

        return {
            Date: entry.date,
            Time: entry.time,
            ASN: `ASN${entry.asn}`,
            'Show Name': showInfo.showName || 'Missing',
            'Episode Title': showInfo.episodeTitle || 'Missing',
            'Episode Description': showInfo.episodeDescription || 'Missing'
        };
    });
}

function buildGuideCsvRows(guideRows) {
    const sortedRows = [...guideRows].sort((a, b) => {
        const left = `${a.Date} ${a.Time}`;
        const right = `${b.Date} ${b.Time}`;
        return left.localeCompare(right);
    });

    return sortedRows.map((row, index) => {
        const currentDateTime = parseDateTime(`${row.Date} ${row.Time}`);
        const nextRow = sortedRows[index + 1];
        let endDateTime;

        if (!nextRow || nextRow.Date !== row.Date) {
            endDateTime = new Date(currentDateTime);
            endDateTime.setHours(23, 59, 59, 0);
        } else {
            endDateTime = parseDateTime(`${nextRow.Date} ${nextRow.Time}`);
        }

        const durationSeconds = Math.max(0, Math.floor((endDateTime.getTime() - currentDateTime.getTime()) / 1000));
        const asnId = String(row.ASN || '').replace(/^ASN/, '');

        return {
            start_time: formatDateTime(currentDateTime),
            end_time: formatDateTime(endDateTime),
            duration: String(durationSeconds),
            type_of_program: 'VOD_PROGRAM',
            title: `${row['Show Name']} | ${row['Episode Title']}`,
            description: row['Episode Description'],
            status: '',
            season: '',
            episode: '',
            id: asnId,
            genres: 'sports/outdoors',
            rating: 'TV-G',
            umid: '',
            EvnTyp: ''
        };
    });
}

function serializeCsv(rows) {
    if (!rows.length) {
        return '';
    }

    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];

    for (const row of rows) {
        lines.push(headers.map((header) => formatCsvValue(row[header])).join(','));
    }

    return lines.join('\n');
}

async function generateGuide(options = {}) {
    const asnFilePath = options.asnFilePath || DEFAULT_ASN_PATH;
    const sheetUrl = options.sheetUrl || DEFAULT_SHEET_URL;
    const uploadedContent = options.asnContent;

    if (!uploadedContent && !fs.existsSync(asnFilePath)) {
        throw new Error(`ASN input file not found at ${asnFilePath}`);
    }

    const [showMap, scheduleEntries] = await Promise.all([
        loadShowMap(sheetUrl),
        Promise.resolve(
            uploadedContent
                ? parseScheduleEntries(uploadedContent)
                : loadScheduleEntries(asnFilePath)
        )
    ]);

    const guideRows = buildGuideRows(scheduleEntries, showMap);
    const csvRows = buildGuideCsvRows(guideRows);
    const csvContent = serializeCsv(csvRows);

    return {
        sourceFile: options.sourceLabel || asnFilePath,
        rowCount: guideRows.length,
        rows: guideRows,
        csvRows,
        csvContent
    };
}

module.exports = {
    DEFAULT_ASN_PATH,
    DEFAULT_SHEET_URL,
    generateGuide
};
