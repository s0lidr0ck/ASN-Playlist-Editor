# ASN Playlist Generator - Node.js Deployment

## Overview
This is the Node.js version of the ASN Playlist Generator, converted from Python/Flask for better easyPanel compatibility.

## Features
- Professional broadcast playlist generation from ASN log files
- Beautiful side-by-side preview with Playlist Structure and Block Details
- Color-coded item types (Media: Black, SCTE35: Red, Bug Graphics: Yellow)
- Interactive block selection and content viewing
- Playlist management tools (Copy Day, Search & Replace)
- Multiple file upload support
- Drag & drop interface
- Eastern Time conversion from UTC-4

## Quick Start with Docker

### Option 1: Using Docker Compose (Recommended)
```bash
docker-compose up -d
```

### Option 2: Using Docker directly
```bash
# Build the image
docker build -t asn-playlist-generator .

# Run the container
docker run -d -p 8080:8080 --name asn-playlist asn-playlist-generator
```

## Manual Installation

### Prerequisites
- Node.js 18 or higher
- npm

### Installation Steps
```bash
# Install dependencies
npm install

# Start the application
npm start
```

## Configuration
- Default port: 8080
- Environment: Set NODE_ENV=production for production deployment
- Health check endpoint: /health

## File Structure
```
/
├── server.js           # Main Node.js/Express server
├── package.json        # Dependencies and scripts
├── public/
│   └── index.html     # Frontend with complete UI and JavaScript
├── uploads/           # Directory for uploaded files
├── Dockerfile         # Docker configuration
├── docker-compose.yml # Docker Compose configuration
└── .dockerignore      # Docker ignore patterns
```

## easyPanel Deployment

### Option A: Deploy from GitHub (recommended)
1. Push this repo to GitHub (see below).
2. In easyPanel: **Create** → **App** → choose **GitHub** as source.
3. Select your repo and branch (e.g. `main` or `master`).
4. Set **Port** to `8080`. Use the root **Dockerfile** (default).
5. Deploy; easyPanel will build from the Dockerfile and run the app.

### Option B: Upload ZIP
1. Zip the project (excluding `node_modules`, `.git`) and upload to easyPanel.
2. Use the included Dockerfile for container deployment.
3. Set port to **8080**.

## API Endpoints
- `GET /` - Main application interface
- `POST /preview` - Generate playlist preview
- `POST /upload` - Process and download playlist
- `GET /health` - Health check endpoint
- `GET /favicon.ico` - Favicon (returns 204)

## Technology Stack
- **Backend**: Node.js + Express.js
- **Frontend**: Vanilla JavaScript + HTML5 + CSS3
- **File Handling**: Multer for uploads
- **UI Framework**: Custom CSS with Inter font and Font Awesome icons

## Production Notes
- The application automatically creates required directories
- Uploaded files are temporarily stored and cleaned up
- Health checks are configured for container monitoring
- All dependencies are production-ready

## Support
This Node.js version provides the same functionality as the original Python version with improved deployment compatibility.