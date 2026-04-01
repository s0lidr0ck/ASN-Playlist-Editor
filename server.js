const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { generateGuide } = require('./guide-generator');

// S3 configuration — uses standard AWS env vars (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const S3_BUCKET = process.env.S3_GUIDE_BUCKET || 'asn.assets';
const S3_KEY = process.env.S3_GUIDE_KEY || 'Guide/ASN_Guide.csv';

console.log('🚀 =================================');
console.log('🚀 ASN Playlist Generator (Node.js)');
console.log('🚀 =================================');
console.log(`📋 Node.js Version: ${process.version}`);
console.log(`📋 Platform: ${process.platform}`);
console.log(`📋 Architecture: ${process.arch}`);
console.log(`📋 Process ID: ${process.pid}`);
console.log(`📋 Working Directory: ${process.cwd()}`);
console.log(`📋 NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`📋 PORT: ${process.env.PORT || 'undefined'}`);

const app = express();
const port = process.env.PORT || 8080;

console.log(`🔧 Configured Port: ${port}`);

// Enhanced request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 📥 ${req.method} ${req.url} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')?.substring(0, 50) || 'unknown'}`);
    next();
});

// Middleware
console.log('🔧 Setting up middleware...');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
console.log('✅ Middleware configured');

// Set up multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 16 * 1024 * 1024 // 16MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.originalname.endsWith('.log')) {
            cb(null, true);
        } else {
            cb(new Error('Only .log files are allowed'));
        }
    }
});

const guideUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 16 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.originalname.toLowerCase().endsWith('.in')) {
            cb(null, true);
        } else {
            cb(new Error('Only .in files are allowed for guide generation'));
        }
    }
});

// Create directories if they don't exist
const dirs = ['uploads', 'temp', 'public'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Playlist Generator Class
class PlaylistGenerator {
    constructor() {
        // LOCKED PLAYLIST LOGIC - DO NOT MODIFY THESE VALUES
        this.scte35Marker = "!Set Config SCTE35 from file=C:\\Masterplay\\Masterplay OnAir PE2\\System\\SCTE35\\OutOfNetworkIndicator1WithPtsTime.xml";
        this.bugGraphic = "!ShowLogo\tf=D:\\Media\\Animations\\Bug.png\tshow=1\tshowvalue=00:00:12\thide=1\thidevalue=00:01:25\tcfg=g:\\FullScreen.osd\tName=Bug (Before Animation)\tLayer=1\tPlayMode=2\tfadetime=2000";
        this.mediaPathPrefix = "D:\\MEDIA\\";
    }

    parseLogFile(fileContent) {
        const items = [];
        const lines = fileContent.split('\n');
        
        // Skip header lines
        const dataLines = lines.filter(line => line.includes('|') && !line.startsWith('Record|'));
        
        for (const line of dataLines) {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 10) {
                const time = parts[1] || "";
                const length = parts[2] || "";
                const itemType = parts[3] || "";
                const status = parts[4] || "";
                const cart = parts[5] || "";
                const description = parts[6] || "";
                const isci = parts[7] || "";
                const flag = parts[9] || "";
                
                if (cart && cart !== 'B') {
                    items.push({
                        time, length, itemType, status, cart, description, isci, flag
                    });
                }
            }
        }
        
        return items;
    }

    getDateFromFilename(filename) {
        const match = filename.match(/(\d{4})ASN\.log/);
        if (match) {
            const monthDay = match[1];
            const month = monthDay.substring(0, 2);
            const day = monthDay.substring(2);
            const currentYear = new Date().getFullYear();
            return `${currentYear}-${month}-${day}`;
        }
        return new Date().toISOString().split('T')[0];
    }

    isShowSegment(cart) {
        return /[ABCDEFGH]$/.test(cart);
    }

    isMediaContent(item) {
        return ['2', '4', '5'].includes(item.itemType) && 
               !['TONE ON 200', 'STOP', 'B'].includes(item.cart);
    }

    generatePlaylist(fileContent, filename) {
        const items = this.parseLogFile(fileContent);
        const playlistLines = [];
        const baseDate = this.getDateFromFilename(filename);
        const currentBlockItems = [];

        let i = 0;
        while (i < items.length) {
            const item = items[i];

            if (!this.isMediaContent(item)) {
                i++;
                continue;
            }

            if (this.isShowSegment(item.cart)) {
                // If this is a new block (flag = "S"), add block header first
                if (item.flag === "S" && item.time) {
                    const blockTime = `${baseDate}T${item.time}`;
                    const blockHeader = `${blockTime}\tEventType=2\tName=${item.description}, ${item.cart}`;
                    currentBlockItems.push(blockHeader);
                }

                // Add Bug graphic before every show segment
                currentBlockItems.push(this.bugGraphic);

                // Add the show segment media
                const mediaLine = `${this.mediaPathPrefix}${item.cart}.mxf\tsyn=1\tt1=${item.description}, ${item.cart}\tExpectedLengthStr=\tCartNo=${item.cart}\tISCICode=${item.isci}`;
                currentBlockItems.push(mediaLine);

                // Add SCTE35 marker immediately after the segment
                currentBlockItems.push(this.scte35Marker);

                // Add supporting content that follows this segment
                i++;
                while (i < items.length) {
                    const nextItem = items[i];
                    if (!this.isMediaContent(nextItem)) {
                        i++;
                        continue;
                    }
                    if (this.isShowSegment(nextItem.cart)) {
                        // Next show segment found, don't consume it
                        break;
                    } else {
                        // Supporting content - add it
                        const supportingLine = `${this.mediaPathPrefix}${nextItem.cart}.mxf\tsyn=1\tt1=${nextItem.description}, ${nextItem.cart}\tExpectedLengthStr=\tCartNo=${nextItem.cart}\tISCICode=${nextItem.isci}`;
                        currentBlockItems.push(supportingLine);
                        i++;
                    }
                }
            } else {
                i++;
            }
        }

        // Add all items to final playlist
        if (currentBlockItems.length > 0) {
            playlistLines.push(...currentBlockItems);
        }

        return playlistLines.join('\n');
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No content
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        port: port,
        timestamp: new Date().toISOString()
    });
});

app.post('/guide/preview', guideUpload.single('guideFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Please upload an ASN.in file' });
        }

        const result = await generateGuide({
            asnContent: req.file.buffer.toString('utf8'),
            sourceLabel: req.file.originalname
        });

        res.json({
            success: true,
            sourceFile: result.sourceFile,
            rowCount: result.rowCount,
            rows: result.rows
        });
    } catch (error) {
        console.error('Guide preview error:', error);
        res.status(500).json({ error: `Error generating guide: ${error.message}` });
    }
});

app.post('/guide/download', guideUpload.single('guideFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Please upload an ASN.in file' });
        }

        const result = await generateGuide({
            asnContent: req.file.buffer.toString('utf8'),
            sourceLabel: req.file.originalname
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="ASN_Guide.csv"');
        res.send(result.csvContent);
    } catch (error) {
        console.error('Guide download error:', error);
        res.status(500).json({ error: `Error generating guide CSV: ${error.message}` });
    }
});

app.post('/guide/save', guideUpload.single('guideFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Please upload an ASN.in file' });
        }

        const result = await generateGuide({
            asnContent: req.file.buffer.toString('utf8'),
            sourceLabel: req.file.originalname
        });

        await s3.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: S3_KEY,
            Body: result.csvContent,
            ContentType: 'text/csv; charset=utf-8'
        }));

        console.log(`✅ Guide saved to s3://${S3_BUCKET}/${S3_KEY} (${result.rowCount} rows)`);
        res.json({
            success: true,
            message: `Guide saved to S3 (${result.rowCount} rows)`,
            bucket: S3_BUCKET,
            key: S3_KEY
        });
    } catch (error) {
        console.error('Guide save error:', error);
        res.status(500).json({ error: `Error saving guide to S3: ${error.message}` });
    }
});

// Preview endpoint
app.post('/preview', upload.array('file'), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const generator = new PlaylistGenerator();
        const previews = [];

        for (const file of req.files) {
            const fileContent = fs.readFileSync(file.path, 'utf-8');
            const playlistContent = generator.generatePlaylist(fileContent, file.originalname);
            
            previews.push({
                filename: file.originalname.replace('.log', '.in'),
                content: playlistContent
            });

            // Clean up uploaded file
            fs.unlinkSync(file.path);
        }

        res.json({
            success: true,
            previews: previews,
            count: previews.length
        });

    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ error: `Error processing files: ${error.message}` });
    }
});

// Upload and download endpoint
app.post('/upload', upload.array('file'), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const generator = new PlaylistGenerator();
        const allPlaylists = [];
        const outputFilenames = [];

        for (const file of req.files) {
            const fileContent = fs.readFileSync(file.path, 'utf-8');
            const playlistContent = generator.generatePlaylist(fileContent, file.originalname);
            
            allPlaylists.push(playlistContent);
            outputFilenames.push(file.originalname.replace('.log', '.in'));

            // Clean up uploaded file
            fs.unlinkSync(file.path);
        }

        // If single file, return as single file
        if (allPlaylists.length === 1) {
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="${outputFilenames[0]}"`);
            return res.send(allPlaylists[0]);
        }

        // Multiple files - combine into one playlist named ASN.in
        const combinedPlaylist = allPlaylists.join('\n');
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename="ASN.in"');
        res.send(combinedPlaylist);

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: `Error processing files: ${error.message}` });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 16MB.' });
        }
    }
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
// Create directories
console.log('📁 Creating required directories...');
try {
    if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads', { recursive: true });
        console.log('✅ Created uploads directory');
    }
    if (!fs.existsSync('public')) {
        fs.mkdirSync('public', { recursive: true });
        console.log('✅ Created public directory');
    }
} catch (error) {
    console.error('❌ Error creating directories:', error);
}

// Start server with comprehensive logging
console.log('🚀 Starting server...');
const server = app.listen(port, '0.0.0.0', () => {
    console.log('🎉 ================================');
    console.log('🎉 SERVER STARTED SUCCESSFULLY!');
    console.log('🎉 ================================');
    console.log(`🚀 ASN Playlist Generator (Node.js) running on port ${port}`);
    console.log(`🌐 Local access: http://localhost:${port}`);
    console.log(`🌐 Container access: http://0.0.0.0:${port}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Memory usage: ${JSON.stringify(process.memoryUsage(), null, 2)}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log('✅ Ready to accept connections!');
    console.log('🎉 ================================');
});

server.on('error', (error) => {
    console.error('💥 ================================');
    console.error('💥 SERVER FAILED TO START!');
    console.error('💥 ================================');
    console.error('❌ Error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
    } else if (error.code === 'EACCES') {
        console.error(`❌ Permission denied to bind to port ${port}`);
    }
    console.error('💥 ================================');
    process.exit(1);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed gracefully');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed gracefully');
        process.exit(0);
    });
});
