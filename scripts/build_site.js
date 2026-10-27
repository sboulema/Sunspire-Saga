// Assembles the static site in site/: the page, the production bundle, the game assets and the
// static files, ready for any web root (GitHub Pages, a Docker image, a zip).
//
//   npm run site      (runs build_prod first)
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "site");

fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(OUT, {recursive: true});
for (const entry of ["index.html", "pack-guide.html", "dist/bundle.js", "assets", "static", "LICENSE.txt"]) {
    const src = path.join(ROOT, entry);
    if (!fs.existsSync(src)) throw new Error(`missing ${entry}; run npm run build_prod first`);
    fs.cpSync(src, path.join(OUT, entry), {recursive: true});
}
// the source art and tile grid are inputs of scripts/build_sunspire_assets.js, not game files
fs.rmSync(path.join(OUT, "assets/sunspire"), {recursive: true, force: true});
// production mode: no debug overlay redraw per frame, no debug hotkeys
const init_path = path.join(OUT, "assets/init.json");
const init = JSON.parse(fs.readFileSync(init_path, "utf8"));
init.production_mode = true;
fs.writeFileSync(init_path, JSON.stringify(init, null, 4) + "\n");
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
console.log("site/ ready");
