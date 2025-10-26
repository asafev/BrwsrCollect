#!/usr/bin/env python3
"""
AI Agent Detection Framework Server
Simple HTTP server for local development and deployment
"""

import os
import sys
import http.server
import socketserver
import webbrowser
import threading
import time

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Add CORS headers for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()
    
    def log_message(self, format, *args):
        # Custom logging format
        print(f"[{self.address_string()}] {format % args}")

def open_browser():
    """Open browser after server starts"""
    time.sleep(1)  # Wait for server to start
    url = f"http://localhost:{PORT}"
    print(f"\n🌐 Opening browser to: {url}")
    webbrowser.open(url)

def main():
    print("🤖 AI Agent Detection Framework Server")
    print("=" * 50)
    print(f"📁 Serving directory: {DIRECTORY}")
    print(f"🌐 Server address: http://localhost:{PORT}")
    print("📝 Files available:")
    
    # List available HTML files
    html_files = []
    for root, dirs, files in os.walk(DIRECTORY):
        for file in files:
            if file.endswith('.html'):
                rel_path = os.path.relpath(os.path.join(root, file), DIRECTORY)
                html_files.append(rel_path.replace('\\', '/'))
    
    for file in sorted(html_files):
        print(f"   • http://localhost:{PORT}/{file}")
    
    print("\n🚀 Starting server...")
    print("   Press Ctrl+C to stop the server")
    
    try:
        # Start server
        with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
            print(f"✅ Server running on port {PORT}")
            
            # Open browser in background thread
            browser_thread = threading.Thread(target=open_browser)
            browser_thread.daemon = True
            browser_thread.start()
            
            # Serve forever
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped by user")
        sys.exit(0)
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"\n❌ Error: Port {PORT} is already in use")
            print("   Try a different port or stop the existing server")
        else:
            print(f"\n❌ Error starting server: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
