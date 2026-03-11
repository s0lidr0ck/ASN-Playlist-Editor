#!/usr/bin/env python3
"""
ASN Playlist Generator Web App

Flask web application that converts log files to playlist format.
"""

import os
import re
from datetime import datetime
from typing import List, Dict, Optional
from flask import Flask, render_template, request, send_file, flash, redirect, url_for, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import tempfile
import io

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

class PlaylistItem:
    def __init__(self, time: str, length: str, item_type: str, status: str, 
                 cart: str, description: str, isci: str, flag: str):
        self.time = time
        self.length = length
        self.item_type = item_type
        self.status = status
        self.cart = cart
        self.description = description
        self.isci = isci
        self.flag = flag
        
    def is_show_segment(self) -> bool:
        """Check if this is a show segment (ends with A,B,C,D,E,F,G,H)"""
        return bool(re.search(r'[ABCDEFGH]$', self.cart))
    
    def is_media_content(self) -> bool:
        """Check if this is actual media content (not tone, stop, etc.)"""
        return self.item_type in ['2', '4', '5'] and self.cart not in ['TONE ON 200', 'STOP', 'B']


class PlaylistGenerator:
    def __init__(self):
        # LOCKED PLAYLIST LOGIC - DO NOT MODIFY THESE VALUES
        self.scte35_marker = "!Set Config SCTE35 from file=C:\\Masterplay\\Masterplay OnAir PE2\\System\\SCTE35\\OutOfNetworkIndicator1WithPtsTime.xml"
        self.bug_graphic = "!ShowLogo\tf=D:\\Media\\Animations\\Bug.png\tshow=1\tshowvalue=00:00:12\thide=1\thidevalue=00:01:25\tcfg=g:\\FullScreen.osd\tName=Bug (Before Animation)\tLayer=1\tPlayMode=2\tfadetime=2000"
        self.media_path_prefix = "D:\\MEDIA\\"
        
    def parse_log_file(self, file_content: str) -> List[PlaylistItem]:
        """Parse log file content and extract playlist items"""
        items = []
        lines = file_content.split('\n')
        
        # Skip header lines
        data_lines = [line for line in lines if '|' in line and not line.startswith('Record|')]
        
        for line in data_lines:
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 10:
                time = parts[1] if parts[1] else ""
                length = parts[2] if parts[2] else ""
                item_type = parts[3] if parts[3] else ""
                status = parts[4] if parts[4] else ""
                cart = parts[5] if parts[5] else ""
                description = parts[6] if parts[6] else ""
                isci = parts[7] if parts[7] else ""
                flag = parts[9] if len(parts) > 9 else ""
                
                if cart and cart not in ['B']:
                    items.append(PlaylistItem(time, length, item_type, status, 
                                            cart, description, isci, flag))
        
        return items
    
    def get_date_from_filename(self, filename: str) -> str:
        """Extract date from filename like '0818ASN.log' and convert to ISO format"""
        match = re.search(r'(\d{4})ASN\.log', filename)
        if match:
            month_day = match.group(1)
            month = month_day[:2]
            day = month_day[2:]
            current_year = datetime.now().year
            return f"{current_year}-{month}-{day}"
        return datetime.now().strftime("%Y-%m-%d")
    
    def generate_playlist(self, file_content: str, filename: str) -> str:
        """
        LOCKED PLAYLIST GENERATION LOGIC - DO NOT MODIFY
        
        Generates playlist following exact rules:
        1. Block headers only when flag="S" 
        2. Bug → Show Segment → SCTE35 Marker → Supporting Content
        3. All items inside blocks
        4. Supports item types 2,4,5
        """
        items = self.parse_log_file(file_content)
        playlist_lines = []
        
        base_date = self.get_date_from_filename(filename)
        current_block_items = []
        
        i = 0
        while i < len(items):
            item = items[i]
            
            if not item.is_media_content():
                i += 1
                continue
                
            if item.is_show_segment():
                # If this is a new block (flag = "S"), add block header first
                if item.flag == "S" and item.time:
                    block_time = f"{base_date}T{item.time}"
                    block_header = f"{block_time}\tEventType=2\tName={item.description}, {item.cart}"
                    current_block_items.append(block_header)
                
                # Add Bug graphic before every show segment (after block header if it's an "S")
                current_block_items.append(self.bug_graphic)
                
                # Add the show segment media
                media_line = f"{self.media_path_prefix}{item.cart}.mxf\tsyn=1\tt1={item.description}, {item.cart}\tExpectedLengthStr=\tCartNo={item.cart}\tISCICode={item.isci}"
                current_block_items.append(media_line)
                
                # Add SCTE35 marker immediately after the segment
                current_block_items.append(self.scte35_marker)
                
                # Add supporting content that follows this segment
                i += 1
                while i < len(items):
                    next_item = items[i]
                    if not next_item.is_media_content():
                        i += 1
                        continue
                    if next_item.is_show_segment():
                        # Next show segment found, don't consume it
                        break
                    else:
                        # Supporting content - add it
                        supporting_line = f"{self.media_path_prefix}{next_item.cart}.mxf\tsyn=1\tt1={next_item.description}, {next_item.cart}\tExpectedLengthStr=\tCartNo={next_item.cart}\tISCICode={next_item.isci}"
                        current_block_items.append(supporting_line)
                        i += 1
            else:
                # This shouldn't happen if our logic is correct, but just in case
                i += 1
        
        # Add all items to final playlist
        if current_block_items:
            playlist_lines.extend(current_block_items)
        
        return '\n'.join(playlist_lines)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'log'}


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/favicon.ico')
def favicon():
    return '', 204  # No content response for favicon

@app.route('/health')
def health():
    return {'status': 'healthy', 'port': request.environ.get('SERVER_PORT', 'unknown')}


@app.route('/upload', methods=['POST'])
def upload_file():
    files = request.files.getlist('file')
    
    if not files or all(file.filename == '' for file in files):
        flash('No files selected')
        return redirect(request.url)
    
    try:
        generator = PlaylistGenerator()
        all_playlists = []
        output_filenames = []
        
        for file in files:
            if file and file.filename != '' and allowed_file(file.filename):
                # Read file content
                file_content = file.read().decode('utf-8', errors='ignore')
                filename = secure_filename(file.filename)
                
                # Generate playlist
                playlist_content = generator.generate_playlist(file_content, filename)
                all_playlists.append(playlist_content)
                output_filenames.append(filename.replace('.log', '.in'))
        
        if not all_playlists:
            flash('No valid log files found')
            return redirect(url_for('index'))
        
        # If single file, return as single file
        if len(all_playlists) == 1:
            output = io.BytesIO()
            output.write(all_playlists[0].encode('utf-8'))
            output.seek(0)
            
            return send_file(
                output,
                as_attachment=True,
                download_name=output_filenames[0],
                mimetype='text/plain'
            )
        
        # Multiple files - combine into one playlist named ASN.in
        combined_playlist = '\n'.join(all_playlists)
        
        output = io.BytesIO()
        output.write(combined_playlist.encode('utf-8'))
        output.seek(0)
        
        return send_file(
            output,
            as_attachment=True,
            download_name='ASN.in',
            mimetype='text/plain'
        )
        
    except Exception as e:
        flash(f'Error processing files: {str(e)}')
        return redirect(url_for('index'))


@app.route('/preview', methods=['POST'])
def preview_file():
    files = request.files.getlist('file')
    
    if not files or all(file.filename == '' for file in files):
        return jsonify({'error': 'No files selected'}), 400
    
    try:
        generator = PlaylistGenerator()
        previews = []
        
        for file in files:
            if file and file.filename != '' and allowed_file(file.filename):
                file_content = file.read().decode('utf-8', errors='ignore')
                filename = secure_filename(file.filename)
                
                playlist_content = generator.generate_playlist(file_content, filename)
                
                previews.append({
                    'filename': filename.replace('.log', '.in'),
                    'content': playlist_content
                })
        
        if not previews:
            return jsonify({'error': 'No valid log files found'}), 400
        
        return jsonify({
            'success': True,
            'previews': previews,
            'count': len(previews)
        })
        
    except Exception as e:
        return jsonify({'error': f'Error processing files: {str(e)}'}), 500


if __name__ == '__main__':
    import os
    
    # Force production settings for deployment
    port = int(os.environ.get('PORT', 8080))
    
    # Explicitly check for production environment
    flask_env = os.environ.get('FLASK_ENV', 'production').lower()
    flask_debug = os.environ.get('FLASK_DEBUG', '0').lower()
    
    # Force debug=False in production or when FLASK_DEBUG=0
    debug = False if (flask_env == 'production' or flask_debug in ['0', 'false', 'off']) else True
    
    print(f"🚀 Starting ASN Playlist Generator on port {port}")
    print(f"🔧 Debug mode: {debug}")
    print(f"🌐 Flask ENV: {flask_env}")
    print(f"🌐 Flask DEBUG: {flask_debug}")
    print(f"🌐 Access at: http://localhost:{port}")
    
    try:
        app.run(host='0.0.0.0', port=port, debug=debug)
    except Exception as e:
        print(f"❌ Failed to start server: {e}")
        import traceback
        traceback.print_exc()