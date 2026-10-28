// Serves the built site (site/) the way a static host would, to try the service worker and the
// installed app locally: npm run site && node scripts/serve_site.js [port]
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "site");
const PORT = Number(process.argv[2] || 9100);
const TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json",
    ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".wav": "audio/wav", ".ogg": "audio/ogg", ".fnt": "application/xml", ".txt": "text/plain"};

http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split("?")[0]);
    if (url.endsWith("/")) url += "index.html";
    const file = path.normalize(path.join(ROOT, url));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.statusCode = 404;
        return res.end("not found");
    }
    res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`site/ on http://localhost:${PORT}`));
