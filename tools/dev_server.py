# Local development server for the game.
#   python tools/dev_server.py        -> http://localhost:8080
# Serves the project folder like `python -m http.server`, plus ONE extra endpoint used by
# review.html:  POST /api/questions  which saves the posted JSON into data/questions.json.
# It only accepts requests from this computer (127.0.0.1), and keeps a backup of the old file.
import json, os, shutil, socket, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "questions.json")
BACKUPS = os.path.join(ROOT, ".work", "backups")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")  # always serve the latest files while developing
        super().end_headers()

    def do_POST(self):
        if self.path != "/api/questions" or self.client_address[0] not in ("127.0.0.1", "::1"):
            return self.send_error(403, "Not allowed")
        try:
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            data = json.loads(body)
            assert isinstance(data.get("questions"), list) and isinstance(data.get("categories"), list)
            assert all("id" in q and "question" in q for q in data["questions"])
        except Exception as e:
            return self.send_error(400, f"Bad data: {e}")
        os.makedirs(BACKUPS, exist_ok=True)
        shutil.copy(DATA, os.path.join(BACKUPS, time.strftime("questions-%Y%m%d-%H%M%S.json")))
        with open(DATA, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"Serving {ROOT} at http://localhost:{port}  (Ctrl+C to stop)")

    class V6Server(ThreadingHTTPServer):
        address_family = socket.AF_INET6

    # Listen on this computer only, on both IPv6 (::1) and IPv4 (127.0.0.1) — browsers may use either for "localhost"
    servers = [ThreadingHTTPServer(("127.0.0.1", port), Handler)]
    try:
        servers.append(V6Server(("::1", port), Handler))
    except OSError:
        pass
    for srv in servers[1:]:
        threading.Thread(target=srv.serve_forever, daemon=True).start()
    servers[0].serve_forever()
