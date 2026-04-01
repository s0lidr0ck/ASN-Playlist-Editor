const fs = require('fs');
const path = require('path');
const { generateGuide } = require('../guide-generator');

async function main() {
    const outputArg = process.argv[2];
    const outputPath = path.resolve(process.cwd(), outputArg || 'ASN_Guide.csv');

    const result = await generateGuide();
    fs.writeFileSync(outputPath, result.csvContent, 'utf8');

    console.log(`Guide created at ${outputPath}`);
    console.log(`Rows: ${result.rowCount}`);
}

main().catch((error) => {
    console.error(`Failed to create guide: ${error.message}`);
    process.exit(1);
});
