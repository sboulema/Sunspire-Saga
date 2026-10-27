# Tools

These regenerate the branding and the promotional art; the game itself needs no build step.

## logo-gen.html

Open it through any local web server (it saves its output with `fetch` POSTs, so a plain
`file://` open will draw but not save), then run `generate()` in the browser console. It writes:

- `sunspire-logo-512.png` – app-icon style logo
- `sunspire-mark-512.png` – text-free mark used for the small favicon sizes
- `sunspire-maskable-512.png` – the mark with full-bleed sky and the art inside the safe circle, for
  the PWA's maskable icon (`manifest.webmanifest`)
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

The site pages link `assets/favicon.ico` and `assets/sunspire-mark-512.png` (apple-touch-icon)
directly, so redrawing the mark and rebuilding the .ico is all it takes.

## promo-gen.html

Draws the box art (`assets/art/box-front.png`, `box-back.png`, `box-spine.png`), the four concept
sheets (`concept-adepts.png`, `concept-bestiary.png`, `concept-spirits.png`, `concept-places.png`)
and the hero portraits (`hero-ari.png` …) from the game's own sprites, so they never drift from the
art in `game.js`. Serve the **repository root** (the page loads `../game.js` and the screenshots in
`assets/screens/`), open `/tools/promo-gen.html`, and run `generate()` in the console; `preview()`
only draws the images on the page. It POSTs to `/save/assets/art/<name>.png`, so the save server
must map that path under the repo root rather than the current folder.

The box back uses three of the in-game screenshots. Those live in `assets/screens/` as 720×480
(3×) PNGs captured from `play.html`: run the game with `requestAnimationFrame` stubbed, set up the
scene through the globals (`G`, `startBattle`, `say`, `pressed` …), draw a few frames with `frame()`
and POST the scaled canvas. The scenes used are the title, Thera intro, Brindle, a field battle, a
spirit duel, the Maw Ogre, the Phoenix and Sol Avatar cutscenes, the Shadow Wyrm and the party menu.

## export-pack.js

Runs inside the play page and POSTs every built-in sprite as `pack-out/<slot>.png`, a starting
point for a full custom pack.
