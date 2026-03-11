const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting ASN Playlist Generator (Debug Mode)...');
console.log('📋 Environment Variables:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`   PORT: ${process.env.PORT || 'undefined'}`);
console.log(`   Platform: ${process.platform}`);
console.log(`   Node Version: ${process.version}`);

const app = express();
const port = parseInt(process.env.PORT) || 8080;

console.log(`🔧 Configured port: ${port}`);

// Enhanced logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
    next();
});

// Basic middleware
app.use(express.static('public'));
app.use(express.json({ limit: '16mb' }));
app.use(express.urlencoded({ extended: true, limit: '16mb' }));

// Multer setup
const upload = multer({ 
    dest: 'uploads/',
    limits: {
        fileSize: 16 * 1024 * 1024 // 16MB limit
    }
});

console.log('📁 Creating directories...');
try {
    if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads');
        console.log('✅ Created uploads directory');
    }
    if (!fs.existsSync('public')) {
        fs.mkdirSync('public');
        console.log('✅ Created public directory');
    }
} catch (error) {
    console.error('❌ Error creating directories:', error);
}

// Test routes for debugging
app.get('/test', (req, res) => {
    console.log('🧪 Test endpoint hit');
    res.json({ 
        message: 'Server is working!',
        timestamp: new Date().toISOString(),
        port: port,
        nodeVersion: process.version,
        platform: process.platform
    });
});

app.get('/debug', (req, res) => {
    console.log('🔍 Debug endpoint hit');
    res.json({
        server: 'ASN Playlist Generator',
        version: '1.0.0-debug',
        status: 'running',
        port: port,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: {
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    console.log('❤️ Health check endpoint hit');
    res.json({ 
        status: 'healthy', 
        port: port,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Favicon
app.get('/favicon.ico', (req, res) => {
    console.log('🎨 Favicon requested');
    res.status(204).end();
});

// Root route
app.get('/', (req, res) => {
    console.log('🏠 Root route hit');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch all other routes
app.get('*', (req, res) => {
    console.log(`❓ Unknown route requested: ${req.url}`);
    res.status(404).json({ 
        error: 'Not found',
        path: req.url,
        timestamp: new Date().toISOString()
    });
});

// Error handling
app.use((error, req, res, next) => {
    console.error('❌ Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

// Start server with enhanced logging
const server = app.listen(port, '0.0.0.0', () => {
    console.log('🎉 SUCCESS! Server started successfully');
    console.log(`🌐 Server running on http://0.0.0.0:${port}`);
    console.log(`🏠 Access at: http://localhost:${port}`);
    console.log(`❤️ Health check: http://localhost:${port}/health`);
    console.log(`🧪 Test endpoint: http://localhost:${port}/test`);
    console.log(`🔍 Debug info: http://localhost:${port}/debug`);
    console.log(`📊 Process ID: ${process.pid}`);
    console.log('✅ Ready to accept connections!');
});

server.on('error', (error) => {
    console.error('💥 Server failed to start:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
    } else if (error.code === 'EACCES') {
        console.error(`❌ Permission denied to bind to port ${port}`);
    }
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

console.log('📋 Server setup complete, waiting for connections...');