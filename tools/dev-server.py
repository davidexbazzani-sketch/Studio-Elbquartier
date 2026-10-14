# Lokaler Entwicklungs-Server: liefert die Seite ohne Cache aus und kann gerenderte
# Bilder speichern (POST /__save, nur für tools/bake-*.html). Nicht auf den Webserver laden.
# Start im Projektordner:  python3 tools/dev-server.py .

import http.server, functools, sys, os, re, base64, urllib.parse
ROOT = sys.argv[1]
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()
    def send_head(self):
        # Byte-Ranges wie bei Apache, damit Videos im Browser springen und neu starten können
        path = self.translate_path(self.path)
        m = re.fullmatch(r'bytes=(\d*)-(\d*)', (self.headers.get('Range') or '').strip())
        if not m or not os.path.isfile(path) or not (m.group(1) or m.group(2)):
            return super().send_head()
        size = os.path.getsize(path)
        if m.group(1):
            start = int(m.group(1)); end = min(int(m.group(2)) if m.group(2) else size - 1, size - 1)
        else:
            start = max(0, size - int(m.group(2))); end = size - 1
        if start >= size or start > end:
            self.send_response(416); self.send_header('Content-Range', f'bytes */{size}'); self.end_headers(); return None
        f = open(path, 'rb'); f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        self.range_left = end - start + 1
        return f
    def copyfile(self, source, outputfile):
        left = getattr(self, 'range_left', None)
        if left is None: return super().copyfile(source, outputfile)
        while left > 0:
            chunk = source.read(min(65536, left))
            if not chunk: break
            outputfile.write(chunk); left -= len(chunk)
        self.range_left = None
    def log_message(self, *a): pass
    def do_OPTIONS(self):
        # nur für /__savemodel: Browser fragt vorher nach (CORS, Zugriff auf localhost)
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()
    def do_POST(self):
        # nur lokal: vorgerenderte Bilder speichern  /__save?dir=juwelier&name=elbe-hero.webp
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        if u.path == '/__log':  # Fortschritt der Render-Werkzeuge im Terminal ausgeben
            text = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode(errors='replace')
            print(text[:2000], flush=True)
            self.send_response(200); self.end_headers(); return
        if u.path == '/__savemodel':  # heruntergeladene 3D-Modelle (Quelldateien) nach tools/models/quelle/
            name = q.get('name', [''])[0]
            if not re.fullmatch(r'[a-z0-9-]+\.(glb|gltf|bin|png|jpg|webp|zip)', name):
                self.send_response(400); self.end_headers(); return
            data = self.rfile.read(int(self.headers.get('Content-Length', 0)))
            out = os.path.join(ROOT, 'tools', 'models', 'quelle')
            os.makedirs(out, exist_ok=True)
            with open(os.path.join(out, name), 'wb') as f: f.write(data)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers(); self.wfile.write(str(len(data)).encode()); return
        name, folder = q.get('name', [''])[0], q.get('dir', [''])[0]
        if u.path != '/__save' or not re.fullmatch(r'[a-z0-9-]+\.(webp|png|jpg)', name) or not re.fullmatch(r'[a-z0-9-]+(/[a-z0-9-]+)?', folder):
            self.send_response(400); self.end_headers(); return
        body = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode()
        data = base64.b64decode(body.split(',', 1)[1])
        out = os.path.join(ROOT, 'assets', 'img', folder)
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, name), 'wb') as f: f.write(data)
        self.send_response(200); self.end_headers(); self.wfile.write(str(len(data)).encode())
http.server.ThreadingHTTPServer(('', 8765), functools.partial(H, directory=ROOT)).serve_forever()
