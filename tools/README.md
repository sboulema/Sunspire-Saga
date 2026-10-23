# Tools

Both tools regenerate the branding; the game itself needs no build step.

## logo-gen.html

Open it through any local web server (it saves its output with `fetch` POSTs, so a plain
`file://` open will draw but not save), then run `generate()` in the browser console. It writes:

- `sunspire-logo-512.png` – app-icon style logo
- `sunspire-mark-512.png` – text-free mark used for the small favicon sizes
- `sunspire-card.png` – 1200×630 social card
- `favicon-16/32/48/180/256.png` – frames for the favicon

A one-line server that accepts those POSTs:

```js
// save-server.js — serves the current folder and writes POSTed PNG data URLs to disk
const http = require('http'), fs = require('fs'), path = require('path');
http.createServer((q, s) => {
  if (q.method === 'POST'){ let b = []; q.on('data', c => b.push(c)); q.on('end', () => {
    const m = Buffer.concat(b).toString().match(/^data:image\/png;base64,(.*)$/);
    fs.writeFileSync(q.url.replace(/[^a-z0-9_.-]/gi, ''), Buffer.from(m[1], 'base64')); s.end('ok'); }); return; }
  fs.readFile(path.join(process.cwd(), q.url.split('?')[0]), (e, d) => { if (e){ s.statusCode = 404; return s.end(); }
    s.setHeader('Content-Type', q.url.endsWith('.html') ? 'text/html' : 'application/octet-stream'); s.end(d); });
}).listen(8138);
```

## build-ico.js

Assembles `favicon.ico` (16, 32, 48 and 256 px frames) from the PNGs above.

The favicon shown in the browser tab is embedded in `index.html` as data URLs (32, 16 and a
180 px apple-touch-icon); if you redraw the mark, re-embed those by replacing the base64 in the
`<link rel="icon">` tags in the head.
