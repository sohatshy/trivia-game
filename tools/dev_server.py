# Local development server for the game and the admin panel.
#   python tools/dev_server.py        -> http://localhost:8080   (admin: /admin.html)
#
# Serves the project folder like `python -m http.server`, plus a small API used ONLY by admin.html:
#   GET  /api/status                    -> {"ok": true, "ffmpeg": true}
#   POST /api/questions   (JSON)        -> saves data/questions.json   (backup of the old file in .work/backups/)
#   POST /api/trash       (JSON)        -> saves data/trash.json        (deleted questions you can restore)
#   POST /api/media?for=question|category&id=ID&name=FILENAME   (raw file body)
#                                       -> compresses with ffmpeg and saves media/ID.webp|mp4|mp3
#                                          (categories: media/categories/ID.webp|svg)
#   POST /api/media-delete  (JSON {"path": "media/..."}) -> deletes one file inside media/
#
# Safety: listens on this computer only, and only accepts API calls that carry the header
# "X-Admin: 1" from a localhost page. Browsers won't let other websites send that header,
# so a random site you visit can't write to your files.
import json, os, re, shutil, socket, subprocess, tempfile, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "questions.json")
TRASH = os.path.join(ROOT, "data", "trash.json")
MEDIA = os.path.join(ROOT, "media")
BACKUPS = os.path.join(ROOT, ".work", "backups")
UPLOADS = os.path.join(ROOT, ".work", "uploads")

MAX_UPLOAD = 1024 * 1024 * 1024        # 1 GB: refuse bigger raw uploads outright
MAX_SAVED = 15 * 1024 * 1024           # 15 MB: limit AFTER compression
MAX_VIDEO_SECONDS = 60
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def mb(n):
    return f"{n / 1024 / 1024:.1f}"


def write_json(path, data, backup_name=None):
    """Atomic write (temp file + rename), with an optional timestamped backup of the old file."""
    if backup_name and os.path.exists(path):
        os.makedirs(BACKUPS, exist_ok=True)
        shutil.copy(path, os.path.join(BACKUPS, time.strftime(f"{backup_name}-%Y%m%d-%H%M%S.json")))
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def run_ffmpeg(args):
    if not FFMPEG:
        raise ApiError(500, "برنامج ffmpeg غير موجود على هذا الجهاز، فلا يمكن ضغط الملفات.")
    p = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *args], capture_output=True, text=True)
    if p.returncode != 0:
        raise ApiError(400, "تعذّر قراءة الملف أو تحويله. تأكّد أنه صورة أو فيديو أو صوت سليم.\n" + p.stderr[-300:])


def probe(path):
    """Width, height, duration (seconds) and whether there is a video stream."""
    if not FFPROBE:
        return {}
    p = subprocess.run([FFPROBE, "-v", "error", "-print_format", "json", "-show_streams", "-show_format", path],
                       capture_output=True, text=True)
    try:
        info = json.loads(p.stdout)
    except json.JSONDecodeError:
        return {}
    v = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), None)
    return {
        "width": int(v["width"]) if v and v.get("width") else 0,
        "height": int(v["height"]) if v and v.get("height") else 0,
        "duration": float(info.get("format", {}).get("duration") or 0),
    }


def kind_of(name, content_type):
    ext = os.path.splitext(name.lower())[1]
    ct = (content_type or "").lower()
    if ext == ".svg" or ct == "image/svg+xml":
        return "svg"
    if ct.startswith("image/") or ext in (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif", ".heic"):
        return "image"
    if ct.startswith("video/") or ext in (".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".3gp"):
        return "video"
    if ct.startswith("audio/") or ext in (".mp3", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".flac", ".opus"):
        return "audio"
    raise ApiError(400, "نوع الملف غير مدعوم. المسموح: صورة أو فيديو أو ملف صوت.")


def compress(src, kind, out_base):
    """Converts src into the game's formats. Returns (output path, media type, notes)."""
    notes = []
    if kind == "svg":
        out = out_base + ".svg"
        shutil.copy(src, out)
        return out, "image", notes
    if kind == "image":
        out = out_base + ".webp"
        info = probe(src)
        if info.get("width", 0) > 1600:
            notes.append(f"صُغّرت الصورة من عرض {info['width']} إلى 1600 بكسل.")
        run_ffmpeg(["-i", src, "-frames:v", "1", "-vf", "scale='min(1600,iw)':-2", "-c:v", "libwebp", "-quality", "80", out])
        return out, "image", notes
    if kind == "video":
        out = out_base + ".mp4"
        info = probe(src)
        w, h = info.get("width", 0), info.get("height", 0)
        if not w or not h:
            raise ApiError(400, "هذا الملف لا يحتوي على صورة فيديو. إن كان صوتاً فقط فاختره كملف صوت.")
        # Fit inside 1280x720 (landscape) or 720x1280 (portrait), never upscale, keep even sizes
        box_w, box_h = (1280, 720) if w >= h else (720, 1280)
        scale = min(1.0, box_w / w, box_h / h)
        tw, th = max(2, int(w * scale) // 2 * 2), max(2, int(h * scale) // 2 * 2)
        if scale < 1:
            notes.append(f"صُغّر الفيديو من {w}×{h} إلى {tw}×{th}.")
        if info.get("duration", 0) > MAX_VIDEO_SECONDS + 0.5:
            notes.append(f"قُصّ الفيديو من {int(info['duration'])} ثانية إلى أول {MAX_VIDEO_SECONDS} ثانية.")
        run_ffmpeg(["-i", src, "-t", str(MAX_VIDEO_SECONDS), "-vf", f"scale={tw}:{th}",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out])
        return out, "video", notes
    out = out_base + ".mp3"
    run_ffmpeg(["-i", src, "-vn", "-c:a", "libmp3lame", "-b:a", "128k", out])
    return out, "audio", notes


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")  # always serve the latest files while developing
        super().end_headers()

    def log_message(self, fmt, *args):
        if "/api/" in (self.path or ""):
            super().log_message(fmt, *args)

    # ---------- helpers ----------
    def send_json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def check_allowed(self):
        if self.client_address[0] not in ("127.0.0.1", "::1"):
            raise ApiError(403, "Not allowed")
        if self.headers.get("X-Admin") != "1":
            raise ApiError(403, "Missing X-Admin header")
        origin = self.headers.get("Origin")
        if origin and urlparse(origin).hostname not in ("localhost", "127.0.0.1", "::1", "[::1]"):
            raise ApiError(403, "Wrong origin")

    def read_json(self):
        n = int(self.headers.get("Content-Length", 0))
        if n > 50 * 1024 * 1024:
            raise ApiError(413, "Too large")
        try:
            return json.loads(self.rfile.read(n))
        except json.JSONDecodeError as e:
            raise ApiError(400, f"Bad JSON: {e}")

    # ---------- routes ----------
    def do_GET(self):
        if self.path.startswith("/api/"):
            try:
                self.check_allowed()
                if urlparse(self.path).path == "/api/status":
                    return self.send_json(200, {"ok": True, "ffmpeg": bool(FFMPEG)})
                raise ApiError(404, "Unknown API")
            except ApiError as e:
                return self.send_json(e.status, {"error": e.message})
        return super().do_GET()

    def do_POST(self):
        try:
            self.check_allowed()
            route = urlparse(self.path).path
            if route == "/api/questions":
                data = self.read_json()
                if not (isinstance(data.get("questions"), list) and isinstance(data.get("categories"), list)):
                    raise ApiError(400, "questions/categories missing")
                ids = [q.get("id") for q in data["questions"]]
                if not all(isinstance(i, str) and SAFE_ID.match(i) for i in ids) or len(set(ids)) != len(ids):
                    raise ApiError(400, "Every question needs a unique, simple id")
                write_json(DATA, data, "questions")
                return self.send_json(200, {"ok": True})
            if route == "/api/trash":
                data = self.read_json()
                if not isinstance(data.get("items"), list):
                    raise ApiError(400, "items missing")
                write_json(TRASH, data, "trash")
                return self.send_json(200, {"ok": True})
            if route == "/api/media":
                return self.upload_media()
            if route == "/api/media-delete":
                rel = str(self.read_json().get("path", "")).split("?")[0]
                full = os.path.normpath(os.path.join(ROOT, rel))
                if not full.startswith(MEDIA + os.sep):
                    raise ApiError(400, "Only files inside media/ can be deleted")
                if os.path.isfile(full):
                    os.remove(full)
                return self.send_json(200, {"ok": True})
            raise ApiError(404, "Unknown API")
        except ApiError as e:
            return self.send_json(e.status, {"error": e.message})

    def upload_media(self):
        qs = parse_qs(urlparse(self.path).query)
        target = (qs.get("for") or ["question"])[0]
        item_id = (qs.get("id") or [""])[0]
        name = (qs.get("name") or ["file"])[0]
        if target not in ("question", "category") or not SAFE_ID.match(item_id):
            raise ApiError(400, "Bad id")
        size = int(self.headers.get("Content-Length", 0))
        if size <= 0:
            raise ApiError(400, "الملف فارغ.")
        if size > MAX_UPLOAD:
            raise ApiError(413, f"الملف كبير جداً ({mb(size)} ميغابايت). الحد الأقصى للرفع 1024 ميغابايت.")
        kind = kind_of(name, self.headers.get("Content-Type"))
        if target == "category" and kind not in ("image", "svg"):
            raise ApiError(400, "صورة الفئة يجب أن تكون صورة (PNG أو JPG أو WebP أو SVG).")

        os.makedirs(UPLOADS, exist_ok=True)
        folder = MEDIA if target == "question" else os.path.join(MEDIA, "categories")
        os.makedirs(folder, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=UPLOADS) as tmp:
            src = os.path.join(tmp, "upload" + os.path.splitext(name)[1].lower())
            with open(src, "wb") as f:
                left = size
                while left > 0:
                    chunk = self.rfile.read(min(1024 * 1024, left))
                    if not chunk:
                        break
                    f.write(chunk)
                    left -= len(chunk)
            if kind == "svg":
                head = open(src, "rb").read(4096).lower()
                if b"<svg" not in head:
                    raise ApiError(400, "ملف SVG غير صالح.")
            out, media_type, notes = compress(src, kind, os.path.join(tmp, "out"))
            saved = os.path.getsize(out)
            if saved > MAX_SAVED:
                why = "قصّر المقطع أو اختر ملفاً بجودة أقل" if media_type != "image" else "استخدم صورة أبسط"
                raise ApiError(413, f"حتى بعد الضغط حجم الملف {mb(saved)} ميغابايت، والحد الأقصى 15 ميغابايت. {why} ثم حاول مرة أخرى.")
            ext = os.path.splitext(out)[1]
            for old in os.listdir(folder):  # replace any older file for the same id (other extension)
                if os.path.splitext(old)[0] == item_id:
                    os.remove(os.path.join(folder, old))
            final = os.path.join(folder, item_id + ext)
            shutil.move(out, final)
        rel = os.path.relpath(final, ROOT).replace(os.sep, "/")
        return self.send_json(200, {"ok": True, "src": rel, "type": media_type, "bytes": saved,
                                    "original": size, "notes": notes})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"Serving {ROOT} at http://localhost:{port}  (admin: http://localhost:{port}/admin.html)  Ctrl+C to stop")
    if not FFMPEG:
        print("WARNING: ffmpeg not found - media uploads will not work")

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
