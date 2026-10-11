"""Local dev server with caching turned off, so edits show up on a normal refresh."""
import http.server, socketserver, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.join(os.path.dirname(__file__), '..'))

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), NoCache) as httpd:
    print(f'Stride Quest on http://localhost:{PORT}  (Ctrl+C to stop)')
    httpd.serve_forever()
