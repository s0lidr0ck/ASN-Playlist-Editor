const http = require('http');

const port = process.env.PORT || 3000;

console.log(`Starting test server on port ${port}`);

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <h1>🎉 SUCCESS!</h1>
        <p>Node.js server is working on easyPanel!</p>
        <p>Port: ${port}</p>
        <p>Time: ${new Date().toISOString()}</p>
        <p>Platform: ${process.platform}</p>
        <p>Node: ${process.version}</p>
    `);
});

server.listen(port, '0.0.0.0', () => {
    console.log(`✅ Test server running on http://0.0.0.0:${port}`);
});

server.on('error', (err) => {
    console.error('❌ Server error:', err);
    process.exit(1);
});