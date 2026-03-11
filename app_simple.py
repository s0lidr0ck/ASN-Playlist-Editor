#!/usr/bin/env python3
"""
Ultra-simple version of ASN Playlist Generator for debugging
"""

from flask import Flask
import os

app = Flask(__name__)

@app.route('/')
def hello():
    return '''
    <html>
    <head><title>ASN Playlist Generator - Test</title></head>
    <body>
        <h1>✅ App is Working!</h1>
        <p>Port: {}</p>
        <p>If you see this, the Flask app is running correctly.</p>
        <a href="/test">Test Route</a>
    </body>
    </html>
    '''.format(os.environ.get('PORT', '8080'))

@app.route('/test')
def test():
    return {'status': 'success', 'message': 'Flask app is working!'}

@app.route('/favicon.ico')
def favicon():
    return '', 204

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    print(f"🚀 Simple test app starting on port {port}")
    print(f"🌐 Access at: http://localhost:{port}")
    
    try:
        app.run(host='0.0.0.0', port=port, debug=False)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()