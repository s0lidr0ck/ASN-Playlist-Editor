#!/bin/bash
# Run ASN Playlist Generator without Docker

echo "🚀 Starting ASN Playlist Generator (No Docker)"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python 3.x"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pip3 install Flask==2.3.3 Werkzeug==2.3.7

# Set environment variables
export FLASK_ENV=production
export PORT=8080

# Start the application
echo "🌐 Starting on port 8080..."
python3 app.py