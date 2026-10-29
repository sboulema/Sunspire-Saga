// Builds a sprite pack for the engine build out of the sprites of the upstream engine repository
// (the `upstream` git remote, goldensun_html5), re-cut into Sunspire's own sheet layout.
//
//   node tools/make-upstream-pack.js [--ref upstream/master] [--out pack-upstream] [--extra pack-upstream-extra] [--fit] [--smooth]
//
// then zip the folder:  node tools/make-pack-zip.js pack-upstream sunspire-upstream-pack.zip
//
// The sprites are read straight out of git (nothing is checked out). For every slot with an
// upstream counterpart the tool lays the upstream frames out in a new sheet at their own size,
// under Sunspire's frame names, and writes the matching `<slot>.json` atlas next to it, which the
// pack loader accepts in place of the built-in layout. Frames without a counterpart keep the
// built-in art, so every sheet stays complete. With --fit the built-in sheets and layout are kept
// instead and each upstream frame is shrunk into its Sunspire cell (upstream frames are 32x32 or
// 64x64 where Sunspire's are 16x22 or smaller), nearest-neighbour or averaged with --smooth.
// Sprites upstream lacks are cut out of the ripped enemies sheets in the --extra folder when
// present (the bat, the ooze and the spider). The heroes' upstream weapons fill the weapon sheets
// the engine draws over them, for the weapon types the gear uses. The four bitmap fonts come over
// as they are, each with its .fnt.
//
// The upstream sprites are not free to redistribute: this pack is for your own browser. Keep the
// output folder and the zip out of the repository (both are git-ignored).
const fs = require("fs"),
    path = require("path"),
    {execFileSync} = require("child_process");
const png = require("../scripts/png.js");
const gif = require("./gif2png.js");

const root = path.join(__dirname, "..");
const args = process.argv.slice(2);
const opt = (name, dflt) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : dflt;
};
const REF = opt("--ref", "upstream/master");
const OUT = path.resolve(opt("--out", "pack-upstream"));
const SMOOTH = args.includes("--smooth");
const FIT = args.includes("--fit");
const EXTRA = path.resolve(opt("--extra", "pack-upstream-extra"));

// ---------------------------------------------------------------- git + images

const gitCache = new Map();
/** A file of the upstream tree, or null when it has none. */
function gitShow(file) {
    try {
        return execFileSync("git", ["show", `${REF}:${file}`], {cwd: root, maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"]});
    } catch {
        return null;
    }
}
function gitRead(file) {
    if (!gitCache.has(file)) {
        gitCache.set(file, gitShow(`assets/images/${file}`));
    }
    return gitCache.get(file);
}

/**
 * Normalised atlas: frame name -> rect, plus frames grouped by animation (name without /NN). A
 * trimmed frame keeps its place in the untrimmed canvas as `src` (offset) and `size`.
 */
function normalise(json) {
    const f = json.frames;
    const list = Array.isArray(f) ? f.map(x => [x.filename, x]) : Object.entries(f);
    const frames = {},
        groups = {};
    for (const [name, r] of list) {
        if (r.rotated) throw new Error("rotated frames are not supported: " + name);
        frames[name] = {x: r.frame.x, y: r.frame.y, w: r.frame.w, h: r.frame.h};
        if (r.trimmed && r.spriteSourceSize && r.sourceSize) {
            frames[name].src = {x: r.spriteSourceSize.x, y: r.spriteSourceSize.y};
            frames[name].size = {w: r.sourceSize.w, h: r.sourceSize.h};
        }
        const m = name.match(/^(.*)\/(\d+)$/);
        const group = m ? m[1] : name,
            index = m ? +m[2] : 0;
        (groups[group] = groups[group] || []).push({name, index});
    }
    for (const g in groups) groups[g].sort((a, b) => a.index - b.index);
    return {frames, groups};
}

const sheetCache = new Map();
/** An upstream sheet (image + atlas) by its path under assets/images, without extension; null when absent. */
function sheet(file) {
    if (!sheetCache.has(file)) {
        const data = gitRead(file + ".png");
        let s = null;
        if (data) {
            const img = png.decode(data);
            const json = gitRead(file + ".json");
            s = json ? {img, ...normalise(JSON.parse(json.toString("utf8")))} : {img, frames: {"*": {x: 0, y: 0, w: img.width, h: img.height}}, groups: {"*": [{name: "*", index: 0}]}};
        }
        sheetCache.set(file, s);
    }
    return sheetCache.get(file);
}

/** A frame back on its untrimmed canvas, so frames of one sheet (or of two layered sheets) line up. */
function untrim(img, r) {
    if (!r.size) return cut(img, r);
    const out = png.create(r.size.w, r.size.h);
    png.blit(out, img, r.src.x, r.src.y, r.x, r.y, r.w, r.h);
    return out;
}

function cut(img, r) {
    const out = png.create(r.w, r.h);
    png.blit(out, img, 0, 0, r.x, r.y, r.w, r.h);
    return out;
}

/** Scales img down to fit dw x dh (never up), keeping its aspect ratio. */
function fit(img, dw, dh) {
    const s = Math.min(dw / img.width, dh / img.height, 1);
    if (s === 1) return img;
    return resample(img, Math.max(1, Math.round(img.width * s)), Math.max(1, Math.round(img.height * s)), SMOOTH);
}

/** Resamples img to ow x oh: nearest-neighbour, or a box filter with colours weighted by alpha. */
function resample(img, ow, oh, smooth) {
    const out = png.create(ow, oh);
    const sx = img.width / ow,
        sy = img.height / oh;
    for (let y = 0; y < oh; y++) {
        for (let x = 0; x < ow; x++) {
            const o = (y * ow + x) * 4;
            if (!smooth) {
                const ix = Math.min(img.width - 1, Math.floor((x + 0.5) * sx)),
                    iy = Math.min(img.height - 1, Math.floor((y + 0.5) * sy));
                img.data.copy(out.data, o, (iy * img.width + ix) * 4, (iy * img.width + ix) * 4 + 4);
            } else {
                // box filter, colours weighted by alpha
                const x0 = Math.floor(x * sx),
                    x1 = Math.max(x0 + 1, Math.ceil((x + 1) * sx)),
                    y0 = Math.floor(y * sy),
                    y1 = Math.max(y0 + 1, Math.ceil((y + 1) * sy));
                let r = 0,
                    g = 0,
                    b = 0,
                    a = 0,
                    n = 0;
                for (let iy = y0; iy < y1 && iy < img.height; iy++) {
                    for (let ix = x0; ix < x1 && ix < img.width; ix++) {
                        const i = (iy * img.width + ix) * 4,
                            al = img.data[i + 3];
                        r += img.data[i] * al;
                        g += img.data[i + 1] * al;
                        b += img.data[i + 2] * al;
                        a += al;
                        n++;
                    }
                }
                if (a) {
                    out.data[o] = Math.round(r / a);
                    out.data[o + 1] = Math.round(g / a);
                    out.data[o + 2] = Math.round(b / a);
                    out.data[o + 3] = Math.round(a / n);
                }
            }
        }
    }
    return out;
}

/** Clears a cell of the sheet and draws img into it, feet on the bottom row or centred. */
function place(dst, cell, img, anchor) {
    png.fill(dst, cell.x, cell.y, cell.w, cell.h, [0, 0, 0, 0]);
    const ox = cell.x + Math.floor((cell.w - img.width) / 2);
    const oy = anchor === "bottom" ? cell.y + cell.h - img.height : cell.y + Math.floor((cell.h - img.height) / 2);
    png.blit(dst, img, ox, oy);
}

const parse = name => {
    const m = name.match(/^(.*)\/(\d+)$/);
    return m ? {group: m[1], index: +m[2]} : {group: name, index: 0};
};
/** Picks the source frame for dest frame `index` of `count`, spread evenly over the source frames. */
const sample = (frames, index, count) => frames[Math.min(frames.length - 1, Math.floor((index * frames.length) / Math.max(count, 1)))];

// ---------------------------------------------------------------- rules

const DIR_FALLBACK = {down_left: "left", down_right: "right", up_left: "left", up_right: "right", up: "down", left: "down", right: "down"};
const FIELD_ACTIONS = {idle: ["idle"], walk: ["walk", "idle"], dash: ["dash", "walk", "idle"], yes: ["yes", "idle"], no: ["no", "idle"], cast: ["cast", "idle"], grant: ["grant", "cast", "idle"]};

/** A field character: `<base>_<action>` sheets with `<action>/<dir>/NN` frames (8 or 4 directions). */
function fieldChar(base) {
    return (name, count) => {
        const [action, dir] = name.split("/");
        const {index} = parse(name);
        for (const a of FIELD_ACTIONS[action] || [action, "idle"]) {
            const s = sheet(`${base}_${a}`);
            if (!s) continue;
            let d = dir;
            while (d) {
                const g = s.groups[`${a}/${d}`];
                if (g) return {img: cut(s.img, s.frames[sample(g, index, count).name]), anchor: "bottom"};
                d = DIR_FALLBACK[d];
            }
        }
        return null;
    };
}

const BATTLE_FALLBACK = {
    idle: ["idle"],
    attack_init: ["attack_init", "attack", "idle"],
    attack: ["attack", "attack_init", "idle"],
    cast_init: ["cast_init", "attack_init", "cast", "attack", "idle"],
    cast: ["cast", "attack", "idle"],
    damage: ["damage", "idle"],
    downed: ["downed", "damage", "idle"],
};
/** The source frame a battle sheet gives `<anim>_<side>`: init poses take the first frame, actions the last. */
function battlePick(s, anim, side) {
    for (const kind of BATTLE_FALLBACK[anim] || [anim, "idle"]) {
        const g = s.groups[`battle/${kind}_${side}`];
        if (g) return (kind === "attack" || kind === "cast" ? g[g.length - 1] : g[0]).name;
    }
    return null;
}

/**
 * A battle sheet: `battle/<anim>_<side>/NN`. With `whole` the frames keep their untrimmed canvas,
 * which the heroes need so that their weapon sheets (drawn over them as sprites of their own) line up.
 */
function battle(file, whole) {
    return name => {
        const s = sheet(file);
        const m = s && name.match(/^battle\/(.*)_(back|front)\/\d+$/);
        const pick = m && battlePick(s, m[1], m[2]);
        return pick ? {img: (whole ? untrim : cut)(s.img, s.frames[pick]), anchor: "bottom"} : null;
    };
}

/**
 * A hero's weapon sheet: `<type>/<anim>_<side>/NN`, the upstream weapon's frame for the very hero
 * frame `battle()` picks, on its untrimmed canvas and `shift` px lower (upstream's
 * weapon_sprite_shift; Sunspire's is 0, and the few rows that pushes off the bottom are lost).
 */
function weaponOf(heroFile, file, type, shift) {
    return name => {
        const s = sheet(heroFile),
            w = sheet(file);
        const m = s && w && name.match(/^[a-z_]+\/(.*)_(back|front)\/\d+$/);
        const pick = m && battlePick(s, m[1], m[2]);
        const wf = pick && w.frames[pick.replace(/^battle\//, `${type}/`)];
        if (!wf) return null;
        const src = untrim(w.img, wf),
            img = png.create(src.width, src.height);
        png.blit(img, src, 0, shift);
        return {img, anchor: "bottom"};
    };
}

const extraCache = new Map();
/** A PNG or GIF (first frame) read from disk. */
const readImage = file => (/.gif$/i.test(file) ? gif.decode(fs.readFileSync(file)) : png.decode(fs.readFileSync(file)));
const isImage = f => /.(png|gif)$/i.test(f);
/**
 * A sheet in the --extra folder by its file name (`<key>.png` or `<key>.gif` first, else any file
 * whose name contains the key), with its background colour; null when absent.
 */
function extraSheet(key) {
    if (!extraCache.has(key)) {
        const files = fs.existsSync(EXTRA) ? fs.readdirSync(EXTRA).filter(isImage) : [];
        const file = files.find(f => f.replace(/.[^.]*$/, "") === key) || files.find(f => f.includes(key));
        let s = null;
        if (file) {
            const img = readImage(path.join(EXTRA, file));
            const counts = new Map();
            for (let i = 0; i < img.data.length; i += 4) {
                const c = img.data.readUInt32BE(i);
                counts.set(c, (counts.get(c) || 0) + 1);
            }
            s = {img, bg: [...counts].reduce((a, b) => (b[1] > a[1] ? b : a))[0]};
        }
        extraCache.set(key, s);
    }
    return extraCache.get(key);
}

/** The sprite inside loose rect [x, y, w, h] of an --extra sheet, background keyed out and trimmed. */
function extraTrim(s, [x, y, w, h]) {
    const part = cut(s.img, {x, y, w, h});
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
            const o = (j * w + i) * 4;
            if (part.data.readUInt32BE(o) === s.bg) part.data.writeUInt32BE(0, o);
            else (x0 = Math.min(x0, i)), (y0 = Math.min(y0, j)), (x1 = Math.max(x1, i)), (y1 = Math.max(y1, j));
        }
    }
    return cut(part, {x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1});
}

/**
 * Clears an icon's frame: every pixel connected to the edge in a colour of the outermost ring (a
 * ripped icon's border and backdrop), leaving the same colours inside the drawing alone. An icon
 * without a frame has a transparent ring and comes back as it is.
 */
function unframe(img) {
    const {width: w, height: h} = img,
        at = (x, y) => img.data.readUInt32BE((y * w + x) * 4);
    const ring = new Set();
    for (let x = 0; x < w; x++) ring.add(at(x, 0)).add(at(x, h - 1));
    for (let y = 0; y < h; y++) ring.add(at(0, y)).add(at(w - 1, y));
    const out = png.create(w, h);
    png.blit(out, img, 0, 0);
    const seen = new Uint8Array(w * h),
        todo = [];
    for (let x = 0; x < w; x++) todo.push([x, 0], [x, h - 1]);
    for (let y = 0; y < h; y++) todo.push([0, y], [w - 1, y]);
    while (todo.length) {
        const [x, y] = todo.pop();
        if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x]) continue;
        seen[y * w + x] = 1;
        if (!(img.data[(y * w + x) * 4 + 3] === 0 || ring.has(at(x, y)))) continue;
        out.data.writeUInt32BE(0, (y * w + x) * 4);
        todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return out;
}

/**
 * Icons of your own over an atlas rule: `<folder>/<frame>.png` or `.gif` in the --extra folder (`items/potion.png`,
 * any case) stands in for that frame, its frame cleared; every other frame keeps `rule`.
 */
function ownIcons(folder, rule) {
    const dir = path.join(EXTRA, folder);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    return (name, count) => {
        const file = files.find(f => f.toLowerCase() === name + ".png" || f.toLowerCase() === name + ".gif");
        return file ? {img: unframe(readImage(path.join(dir, file))), anchor: "center"} : rule(name, count);
    };
}

/**
 * The three variants of a Sunspire tree sheet (`down`, `alt1`, `alt2`), each a loose rect on an
 * --extra sheet, at native size and standing on their bottom row. Falls back to `orElse`.
 */
function extraTrees(key, rects, orElse) {
    const s = extraSheet(key);
    if (!s) return orElse;
    return name => {
        const i = ["down", "alt1", "alt2"].indexOf(name.split("/")[1]);
        return {img: extraTrim(s, rects[i < 0 ? 0 : i]), anchor: "bottom"};
    };
}

/**
 * A battle sheet cut out of a sheet in the --extra folder (found by `key`, part of its file name)
 * for sprites upstream lacks. The sheet has no alpha channel: its most common colour is the
 * background. `poses` gives each battle pose a [front, back] pair of loose rects [x, y, w, h]; the
 * sprite inside is trimmed and stood centred with its lowest pixel on row `foot` of a `size` x
 * `size` frame, so every pose stands (or hovers) at the same height. Falls back to `orElse` when
 * the sheet is absent.
 */
function sheetCut(key, poses, size, foot, orElse) {
    const s = extraSheet(key);
    if (!s) return orElse;
    const cache = new Map();
    const frame = rect => {
        const key = rect.join();
        if (!cache.has(key)) {
            const part = extraTrim(s, rect);
            const out = png.create(size, size);
            png.blit(out, part, Math.floor((size - part.width) / 2), foot + 1 - part.height);
            cache.set(key, out);
        }
        return cache.get(key);
    };
    return name => {
        const m = name.match(/^battle\/(.*)_(back|front)\/\d+$/);
        const pair = m && (poses[m[1]] || poses.idle);
        return pair ? {img: frame(pair[m[2] === "front" ? 0 : 1]), anchor: "bottom"} : null;
    };
}

/** Frame-name mapping between two atlases, with aliases from Sunspire names to upstream ones. */
function atlasMap(file, aliases = {}, anchor = "center") {
    return (name, count) => {
        const s = sheet(file);
        if (!s) return null;
        const {group, index} = parse(name);
        const g = s.groups[aliases[group] !== undefined ? aliases[group] : group];
        if (!g) return null;
        return {img: cut(s.img, s.frames[sample(g, index, count).name]), anchor};
    };
}

/** A plain image, fitted whole into the destination. */
function image(file, anchor = "center") {
    return () => {
        const s = sheet(file);
        return s ? {img: s.img, anchor} : null;
    };
}

/**
 * A whole image from the --extra folder (`<key>.png` or `.gif`) as a single-frame sprite, its
 * background keyed out and trimmed: the signpost stands on its tile's bottom row, the wells are
 * centred on theirs (the hero walks onto them).
 */
function extraImage(key, anchor = "bottom") {
    return () => {
        const s = extraSheet(key);
        return s ? {img: extraTrim(s, [0, 0, s.img.width, s.img.height]), anchor} : null;
    };
}
/** A fixed cut of the upstream town tileset, standing on its bottom row. */
function tileCut(file, x, y, w, h, ow, oh) {
    return () => {
        const s = sheet(file);
        if (!s) return null;
        const img = cut(s.img, {x, y, w, h});
        return {img: ow ? resample(img, ow, oh, true) : img, anchor: "bottom"};
    };
}
const madraCut = (...a) => tileCut("tilesets/madra", ...a);
/** The image mirrored left to right. */
function flipH(img) {
    const out = png.create(img.width, img.height);
    for (let y = 0; y < img.height; y++)
        for (let x = 0; x < img.width; x++) img.data.copy(out.data, (y * img.width + img.width - 1 - x) * 4, (y * img.width + x) * 4, (y * img.width + x) * 4 + 4);
    return out;
}
/** A cut mirrored left to right. */
const mirrored = cutter => () => {
    const c = cutter();
    return c && {img: flipH(c.img), anchor: c.anchor};
};
/** The three tree variants of a Sunspire tree sheet: two town trees and the forest's round one. */
function trees(order) {
    const cuts = {orange: madraCut(80, 288, 48, 64, 32, 43), purple: madraCut(32, 288, 48, 64, 32, 43), round: tileCut("tilesets/forest", 16, 128, 48, 48, 32, 32)};
    return name => cuts[order[["down", "alt1", "alt2"].indexOf(name.split("/")[1])] || order[0]]();
}

/**
 * A town map's tileset with its ground redrawn from the upstream town tileset (madra): every tile
 * the map's grid (assets/sunspire/maps/<id>_grid.json) draws as grass (plain, tufted, or under an
 * object) becomes one of madra's flat grass tiles, every path tile one of its flat sand tiles and
 * every water tile one of its sea tiles, picked by tile index so the ground keeps some variation.
 * A built-in water tile whose top rows are lighter than its middle is the pond's far bank: it gets
 * madra's wave crest, turned upside down, lapping along its top. Houses, signs and the well stay
 * built-in; trees, fences and houses are sprites of their own. Returns the number of tiles redrawn.
 */
const GROUND = {
    grass: {chars: ".gkBf", tiles: [[16, 48], [32, 48], [48, 48], [64, 48]]},
    path: {chars: "p", tiles: [[16, 144], [32, 144], [16, 160], [32, 160], [48, 160]]},
    water: {chars: "w", tiles: [[0, 432], [16, 432], [32, 432], [0, 448], [16, 448], [32, 448]], shore: [[48, 432], [64, 432], [48, 448], [64, 448]]},
};
/**
 * Madra's sand block, by the sides of a path tile that meet the grass (N E S W as "p" where the
 * path goes on, "." where it does not): the block has the four edges and the four outer corners;
 * any other pattern (a strip, a dead end, a lone tile) is the flat sand with the grass fringe of
 * every side it needs laid over it, taken from those pieces.
 */
const SAND = {
    "pppp": null, // flat: GROUND.path.tiles
    ".ppp": [[16, 128], [32, 128]],
    "p.pp": [[48, 144]],
    "pp.p": [[16, 176], [32, 176]],
    "ppp.": [[0, 144], [0, 160]],
    "..pp": [[48, 128]],
    ".pp.": [[0, 128]],
    "p..p": [[48, 176]],
    "pp..": [[0, 176]],
};
/** A path tile's neighbours N E S W: "p" where the path goes on (off the map counts as going on). */
function pathPattern(chars, x, y) {
    const at = (nx, ny) => (ny < 0 || ny >= chars.length || nx < 0 || nx >= chars[0].length ? "p" : chars[ny][nx]);
    return [at(x, y - 1), at(x + 1, y), at(x, y + 1), at(x - 1, y)].map(c => (c === "p" ? "p" : ".")).join("");
}
const isGrassPixel = (img, o) => img.data[o + 3] > 0 && img.data[o + 1] > img.data[o] + 20 && img.data[o + 1] > img.data[o + 2] + 20;
function sandTile(madra, pattern, index) {
    const pick = list => list[index % list.length];
    if (SAND[pattern]) return cut(madra, {x: pick(SAND[pattern])[0], y: pick(SAND[pattern])[1], w: 16, h: 16});
    const [fx, fy] = pick(GROUND.path.tiles);
    const img = cut(madra, {x: fx, y: fy, w: 16, h: 16});
    if (pattern === "pppp") return img;
    // the fringe of every side (and of every corner between two fringed sides) the pattern asks for
    const pieces = [];
    const sides = ["N", "E", "S", "W"].filter((_, i) => pattern[i] === ".");
    for (const side of sides) pieces.push(pick(SAND[{N: ".ppp", E: "p.pp", S: "pp.p", W: "ppp."}[side]]));
    for (const [a, b, corner] of [["N", "E", "..pp"], ["N", "W", ".pp."], ["S", "E", "p..p"], ["S", "W", "pp.."]]) if (sides.includes(a) && sides.includes(b)) pieces.push(pick(SAND[corner]));
    for (const [sx, sy] of pieces) {
        const piece = cut(madra, {x: sx, y: sy, w: 16, h: 16});
        for (let o = 0; o < piece.data.length; o += 4) if (isGrassPixel(piece, o)) piece.data.copy(img.data, o, o, o + 4);
    }
    return img;
}
/** The image upside down. */
function flipV(img) {
    const out = png.create(img.width, img.height);
    for (let y = 0; y < img.height; y++) img.data.copy(out.data, (img.height - 1 - y) * img.width * 4, y * img.width * 4, (y + 1) * img.width * 4);
    return out;
}
function townGround(id) {
    return base => {
        const s = sheet("tilesets/madra");
        if (!s) return 0;
        const grid = JSON.parse(fs.readFileSync(path.join(root, "assets", "sunspire", "maps", id + "_grid.json"), "utf8"));
        const kind = {}, pattern = {};
        grid.chars.forEach((row, y) =>
            [...row].forEach((c, x) => {
                for (const k in GROUND) if (GROUND[k].chars.includes(c)) kind[grid.grid[y][x]] = k;
                if (c === "p") pattern[grid.grid[y][x]] = pathPattern(grid.chars, x, y);
            })
        );
        for (const [i, k] of Object.entries(kind)) {
            const index = +i,
                dx = (index % grid.cols) * 16,
                dy = Math.floor(index / grid.cols) * 16;
            const pixel = (x, y) => base.data.readUInt32LE((y * base.width + x) * 4);
            const shore = GROUND[k].shore && pixel(dx, dy) !== pixel(dx, dy + 8);
            if (k === "path") {
                png.blit(base, sandTile(s.img, pattern[index], index), dx, dy);
                continue;
            }
            const [sx, sy] = GROUND[k].tiles[index % GROUND[k].tiles.length];
            png.blit(base, s.img, dx, dy, sx, sy, 16, 16);
            if (shore) {
                const [fx, fy] = GROUND[k].shore[index % GROUND[k].shore.length];
                png.blit(base, flipV(cut(s.img, {x: fx, y: fy, w: 16, h: 16})), dx, dy);
            }
        }
        return Object.keys(kind).length;
    };
}
/**
 * Thera Heights' tileset redrawn from upstream: the grass, path and water as in the fields (madra),
 * the cliffs from the forest tileset's rock (its layered strata for the brow and the ridge, the
 * streaked face, the pebbled foot), the pillar tops from the top of the push pillar sprite, and
 * the ladder as the built-in rails over the upstream cliff. The chasm stays built-in. A chest on
 * a pillar keeps its pillar. Returns the number of tiles redrawn.
 */
const FOREST = {
    brow: [[192, 0], [208, 0]],
    face: [[160, 0], [176, 0], [224, 0], [240, 0], [160, 16], [176, 16]],
    foot: [[176, 48]],
};
const RAIL_COLOURS = new Set([0xff3c6ea8, 0xff20426b]); // the built-in ladder's two wood colours, ABGR
function heightsGround(id) {
    return base => {
        const madra = sheet("tilesets/madra"), forest = sheet("tilesets/forest"), pillars = sheet("interactable_objects/push_pillars");
        if (!madra || !forest || !pillars) return 0;
        const grid = JSON.parse(fs.readFileSync(path.join(root, "assets", "sunspire", "maps", id + "_grid.json"), "utf8"));
        const at = (x, y) => (grid.chars[y] || "")[x] || "t";
        const pixel = (x, y) => base.data.readUInt32LE((y * base.width + x) * 4);
        const chasmColour = (() => { for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (at(x, y) === "c") { const i = grid.grid[y][x]; return pixel((i % grid.cols) * 16, Math.floor(i / grid.cols) * 16); } return null; })();
        // one class per tile index, from the letter and its neighbours
        const kind = {}, cellOf = {};
        grid.chars.forEach((row, y) =>
            [...row].forEach((c, x) => {
                const i = grid.grid[y][x];
                if (i in kind) return;
                cellOf[i] = [x, y];
                const dx = (i % grid.cols) * 16, dy = Math.floor(i / grid.cols) * 16;
                if (c === "v") kind[i] = at(x, y + 1) === "v" ? "face" : at(x, y - 1) === "v" ? "foot" : "face";
                else if (c === "L") kind[i] = at(x, y - 1) !== "L" ? "ladder_brow" : at(x, y + 1) === "L" ? "ladder_face" : "ladder_foot";
                else if (c === "k") kind[i] = pixel(dx, dy) === chasmColour ? "pillar" : "grass";
                else kind[i] = {".": "grass", g: "grass", t: "grass", s: "grass", E: "grass", p: "path", w: "water", r: "brow", n: "brow", o: "pillar"}[c] || null;
            })
        );
        let redrawn = 0;
        for (const [i, k] of Object.entries(kind)) {
            if (!k) continue;
            const index = +i, dx = (index % grid.cols) * 16, dy = Math.floor(index / grid.cols) * 16;
            const builtIn = cut(base, {x: dx, y: dy, w: 16, h: 16});
            const forestTile = list => { const [sx, sy] = list[index % list.length]; png.blit(base, forest.img, dx, dy, sx, sy, 16, 16); };
            if (k === "path") {
                png.blit(base, sandTile(madra.img, pathPattern(grid.chars, ...cellOf[index]), index), dx, dy);
            } else if (k === "grass" || k === "water") {
                const g = GROUND[k];
                const shore = g.shore && pixel(dx, dy) !== pixel(dx, dy + 8);
                const [sx, sy] = g.tiles[index % g.tiles.length];
                png.blit(base, madra.img, dx, dy, sx, sy, 16, 16);
                if (shore) { const [fx, fy] = g.shore[index % g.shore.length]; png.blit(base, flipV(cut(madra.img, {x: fx, y: fy, w: 16, h: 16})), dx, dy); }
            } else if (k === "brow") forestTile(FOREST.brow);
            else if (k === "face") forestTile(FOREST.face);
            else if (k === "foot") forestTile(FOREST.foot);
            else if (k.startsWith("ladder_")) {
                forestTile(FOREST[k.slice(7)]);
                // the built-in rails and rungs back over the upstream rock
                for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                    const p = builtIn.data.readUInt32LE((y * 16 + x) * 4);
                    if (RAIL_COLOURS.has(p)) base.data.writeUInt32LE(p, ((dy + y) * base.width + dx + x) * 4);
                }
            } else if (k === "pillar") {
                // the chasm under it, then the top of the pillar sprite (its cap and the start of its shaft)
                png.fill(base, dx, dy, 16, 16, [chasmColour & 0xff, (chasmColour >> 8) & 0xff, (chasmColour >> 16) & 0xff, 255]);
                const r = pillars.frames["push_pillar/pillar/00"];
                png.blit(base, pillars.img, dx, dy, r.x, r.y, 16, 16);
            }
            redrawn++;
        }
        return redrawn;
    };
}
/** The map tilesets whose ground comes from upstream: Thera's fields, and the heights. */
const TILESETS = {fields: townGround("fields"), heights: heightsGround("heights")};

/** The title screen: the built-in night sky with the sun-ring logo (assets/sunspire/sprites/title_sun.png). */
function sunTitle() {
    return () => {
        const logo = png.decode(fs.readFileSync(path.join(root, "assets", "sunspire", "sprites", "title_sun.png")));
        const title = png.create(240, 160);
        for (let y = 0; y < 160; y++) png.fill(title, 0, y, 240, 1, [12 + (y >> 4), 10 + (y >> 3), 22 + (y >> 2)]);
        png.blit(title, logo, Math.floor((240 - logo.width) / 2), 10); // clear of the PRESS START line
        return {img: title, anchor: "center"};
    };
}

const MC = "spritesheets/main_chars/",
    NPC = "spritesheets/npc/",
    BT = "spritesheets/battle/";
const HEROES = {ari: "isaac", lyn: "sheba", bram: "garet", sera: "piers"};
// each upstream hero's battle weapon and its weapon_sprite_shift from upstream's main_chars_db, and
// the Sunspire weapon types (content.json gear `type`) it stands in for on that hero
const WEAPONS = {isaac: ["sword", 4, ["sword", "light_blade"]], sheba: ["staff", 4, ["staff"]], garet: ["axe", 0, ["axe"]], piers: ["mace", 0, ["mace"]]};
const NPCS = {dov: "alex", ina: "village_1", miner: "briggs", elder: "healer", mara: "village_1", polly: "village_1", hob: "briggs"};
const ENEMIES = {
    wolf: "wild_wolf", boar: "wild_wolf", bat: "momonga", spider: "momonga", ooze: "mini_goblin", beetle: "mini_goblin",
    shade: "sea_fighter", harpy: "sea_fighter", golem: "avimander", gargoyle: "avimander", wyrm: "avimander", ogre: "briggs",
};
const ELEMENT = {flint: "venus", granite: "venus", forge: "mars", ember: "mars", dew: "mercury", mist: "mercury", breeze: "jupiter", squall: "jupiter"};
const DJINN_BATTLE = {venus: "venus", mars: "venus", mercury: "jupiter", jupiter: "jupiter"}; // upstream has only two

const RULES = {};
for (const [id, src] of Object.entries(HEROES)) {
    RULES[`${id}_field`] = fieldChar(MC + src);
    RULES[`${id}_battle`] = battle(`${BT}${src}_battle`, true);
    const [type, shift, ours] = WEAPONS[src];
    for (const t of ours) RULES[`${id}_${t}`] = weaponOf(`${BT}${src}_battle`, `${BT}weapons/${src}_${type}`, type, shift);
}
for (const [id, src] of Object.entries(NPCS)) RULES[`${id}_field`] = fieldChar(NPC + src);
for (const [id, src] of Object.entries(ENEMIES)) RULES[`${id}_battle`] = battle(`${BT}${src}_battle`);
// enemies upstream has no sprite for, cut out of the ripped enemies sheets in the --extra folder
// the Bat block: front idle beats, back idle beats, then wrapped / dive / swipe, front and back
const BAT_IDLE = [[1, 651, 28, 23], [29, 651, 34, 23], [63, 651, 30, 23], [93, 651, 30, 23], [123, 651, 31, 23], [154, 651, 29, 23]],
    BAT_ACT = [[1, 674, 20, 26], [21, 674, 23, 26], [44, 674, 20, 26], [64, 674, 23, 26], [87, 674, 25, 26], [112, 674, 24, 26]];
RULES.bat_battle = sheetCut(
    "Vale to Goma Cave",
    {
        idle: [BAT_IDLE[1], BAT_IDLE[4]],
        attack_init: [BAT_ACT[4], BAT_ACT[5]],
        attack: [BAT_ACT[1], BAT_ACT[3]],
        cast_init: [BAT_IDLE[2], BAT_IDLE[5]],
        cast: [BAT_ACT[4], BAT_ACT[5]],
        damage: [BAT_ACT[0], BAT_ACT[2]],
        downed: [BAT_ACT[0], BAT_ACT[2]],
    },
    32,
    24,
    RULES.bat_battle
);
// the blue Ooze block: front and back idle sways, then front coil / rolling ball front and back,
// then the splash when hit, front and back; it stands on the ground
const OOZE_IDLE = [[317, 228, 21, 34], [338, 228, 22, 34], [360, 228, 22, 34], [382, 228, 22, 34], [404, 228, 22, 34], [426, 228, 22, 34]],
    OOZE_ACT = [[316, 263, 21, 29], [337, 263, 22, 29], [359, 263, 22, 29], [316, 293, 30, 27], [346, 293, 29, 27]];
RULES.ooze_battle = sheetCut(
    "Kojima Forest to Mercury Lighthouse",
    {
        idle: [OOZE_IDLE[1], OOZE_IDLE[4]],
        attack_init: [OOZE_ACT[0], OOZE_IDLE[5]],
        attack: [OOZE_ACT[1], OOZE_ACT[2]],
        cast_init: [OOZE_ACT[0], OOZE_IDLE[5]],
        cast: [OOZE_IDLE[0], OOZE_IDLE[3]],
        damage: [OOZE_ACT[3], OOZE_ACT[4]],
        downed: [OOZE_ACT[3], OOZE_ACT[4]],
    },
    32,
    31,
    RULES.ooze_battle
);
// the Tarantula block: front and back idle, then rear-up / lunge front, rear-up / lunge back, then
// the flinch when hit, front and back; it stands on the ground
const SPIDER_IDLE = [[1, 721, 34, 21], [35, 721, 35, 21], [70, 721, 35, 21], [105, 721, 34, 21], [139, 721, 35, 21], [174, 721, 31, 21]],
    SPIDER_ACT = [[1, 742, 31, 26], [32, 742, 34, 26], [66, 742, 31, 26], [97, 742, 34, 26], [1, 768, 35, 23], [36, 768, 36, 23]];
RULES.spider_battle = sheetCut(
    "Fuchin Falls to Atlin Peak",
    {
        idle: [SPIDER_IDLE[1], SPIDER_IDLE[4]],
        attack_init: [SPIDER_ACT[0], SPIDER_ACT[2]],
        attack: [SPIDER_ACT[1], SPIDER_ACT[3]],
        cast_init: [SPIDER_ACT[0], SPIDER_ACT[2]],
        cast: [SPIDER_IDLE[0], SPIDER_IDLE[3]],
        damage: [SPIDER_ACT[4], SPIDER_ACT[5]],
        downed: [SPIDER_ACT[4], SPIDER_ACT[5]],
    },
    32,
    31,
    RULES.spider_battle
);
for (const [id, el] of Object.entries(ELEMENT)) {
    RULES[id] = atlasMap(`spritesheets/djinn/${el}_djinn`);
    RULES[`djinn_battle_${id}_battle`] = battle(`${BT}${DJINN_BATTLE[el]}_djinn_battle`);
}
// the signpost and the two wells, drawn by the project's author, from the --extra folder
RULES.sign = extraImage("sign");
RULES.well = extraImage("well", "center");
RULES.spring = extraImage("well2", "center");
Object.assign(RULES, {
    avatars: atlasMap("avatars/avatars", {
        ari: "isaac", lyn: "sheba", bram: "garet", sera: "piers", dov: "alex", ina: "innkeeper_wife", miner: "weapon_shopkeeper",
        elder: "elder_healer", mara: "potion_shopkeeper", polly: "jenna", hob: "innkeeper",
        spirit_flint: "venus_djinn", spirit_granite: "venus_djinn", spirit_forge: "mars_djinn", spirit_ember: "mars_djinn",
        spirit_dew: "mercury_djinn", spirit_mist: "mercury_djinn", spirit_breeze: "jupiter_djinn", spirit_squall: "jupiter_djinn",
    }),
    battle_backgrounds: atlasMap("battle_backgrounds/battle_backgrounds", {bg_field: "bg_world_map", bg_mine: "bg_cave", bg_trail: "bg_forest", bg_tower: "bg_cliffs"}),
    start_screen: sunTitle(), // the sun-ring logo on the night sky, not the upstream title
    buttons: atlasMap("buttons/buttons"),
    abilities_icons: atlasMap("icons/abilities/abilities_icons", {
        gaia_blade: "gaia", fire_bomb: "fireball", inferno: "eruption", ice_horn: "ice", pure_ply: "ply", gust: "whirlwind",
        gnome: "venus", titan: "cybele", salamand: "mars", phoenix: "tiamat", nixie: "mercury", leviath: "neptune",
        sylph: "jupiter", tempest: "thor", sol_avatar: "judgment",
    }),
    battle_effect_icons: atlasMap("icons/battle_effects/battle_effect_icons"),
    // your own icons in pack-upstream-extra/items/<item>.png go first; the potion is the blue bottle
    items_icons: ownIcons(
        "items",
        atlasMap("icons/items/items_icons", {
            potion: "hermes_water", pdrop: "psy_crystal", wood: "elven_rapier", bronze: "great_sword", iron: "great_axe", steel: "master_rapier",
            sol: "sol_blade", vest: "cotton_shirt", leather: "adepts_clothes", chain: "steel_armor", aegis: "asuras_armor",
        })
    ),
    emoticons: atlasMap("misc/emoticons"),
    menu: atlasMap("misc/menu"),
    ranges: atlasMap("misc/ranges"),
    stars: atlasMap("misc/stars"),
    sweat_drops: atlasMap("misc/sweat_drops"),
    battle_cursor: atlasMap("misc/battle_cursor"),
    dialog_crystal: atlasMap("misc/dialog_crystal"),
    bush: atlasMap("misc/bush", {}, "bottom"),
    chest: atlasMap("misc/chest", {}, "bottom"),
    footprints: atlasMap("misc/footprints"),
    dust: atlasMap("misc/dust"),
    battle_status_sprites: atlasMap(BT + "battle_status_sprites"),
    battle_shadows: atlasMap(BT + "battle_shadows"),
    keyboard_buttons: atlasMap("keyboard/keyboard_buttons"),
    psynergy_ball: atlasMap("interactable_objects/psynergy_ball"),
    psynergy_particle: atlasMap("interactable_objects/psynergy_particle"),
    move_hand: atlasMap("psynergies/move_psynergy_hand"),
    pound_hand: atlasMap("psynergies/pound_psynergy_hand"),
    sand: atlasMap("psynergies/sand_trail"),
    boulder: atlasMap("interactable_objects/lift_rock", {"idle/down": "lift_rock/rock"}, "bottom"),
    ogre_s: atlasMap(NPC + "briggs_idle", {}, "bottom"),
    wyrm_s: atlasMap(NPC + "avimander_idle", {}, "bottom"),
    quake: atlasMap("abilities_animations/quake"), // the Quake recipe's column of earth
    psynergy_aura: image("psynergies/psynergy_aura"),
    djinn_ball: image("misc/djinn_ball"),
    snowflake: image("interactable_objects/snowflake"),
    star: image("interactable_objects/star"),
    keyboard_arrow: image("debug/keyboard_arrow"),
    mind_read_arrow: image("psynergies/mind_read_arrow"),
    water_drop: image("misc/water_drop"),
    // decorations are sprites with their own sheets: the upstream trees and fence pieces at native size
    // the upstream trees are 48x64; at two tiles wide they hide less of a map whose trees stand on single tiles
    // ...or the trees of the ripped tree sheet in the --extra folder, at native size, when it is there:
    // the calmest ones (fewest sharp light / dark neighbours), as fine-leaved trees overlapping at
    // 2x make some screens shimmer; big blue-green, lower green fruit tree, autumn yellow / red
    tree: extraTrees("Miscellaneous - Trees", [[209, 176, 43, 48], [6, 117, 38, 48], [138, 3, 43, 48]], trees(["orange", "purple", "round"])),
    tree_trail: extraTrees("Miscellaneous - Trees", [[6, 117, 38, 48], [209, 176, 43, 48], [186, 2, 43, 48]], trees(["round", "purple", "orange"])),
    // the fence is madra's, the three tiles at (112,384): the horizontal section (two posts and
    // their rail), the vertical one (a post with its rail running down) and the end post, drawn
    // with its rail running right, so it is the left end as it is and the right end mirrored
    fence_h: madraCut(112, 384, 16, 16),
    fence_v: madraCut(128, 384, 16, 16),
    fence_v2: madraCut(128, 384, 16, 16),
    fence_post: name => (name.startsWith("idle/left") ? madraCut(112, 400, 16, 16) : mirrored(madraCut(112, 400, 16, 16)))(),
});

// ---------------------------------------------------------------- build

const slots = JSON.parse(fs.readFileSync(path.join(root, "static", "pack-slots.json"), "utf8"));
/** Sheets whose frames keep their own size in the native-size layout (see below). */
const OWN_SIZE_SLOTS = new Set(["keyboard_buttons", "menu"]);
/** The font slots and the upstream font (sheet + .fnt under assets/font) each comes from. */
const FONTS = {font: "golden-sun", font_italic: "golden-sun-italic", font_item: "gs-item-font", font_shop: "gs-shop-font"};
fs.mkdirSync(OUT, {recursive: true});
const report = [];
let written = 0;
for (const slot of slots) {
    if (slot.font) {
        // the fonts come over as they are: the sheet, and its .fnt pointed at the slot's sheet name
        const src = FONTS[slot.slot];
        const image = src && gitShow(`assets/font/${src}.png`),
            fnt = src && gitShow(`assets/font/${src}.fnt`);
        if (!image || !fnt) {
            report.push(`${slot.slot}: built-in (no upstream font)`);
            continue;
        }
        fs.writeFileSync(path.join(OUT, slot.slot + ".png"), image);
        fs.writeFileSync(path.join(OUT, slot.slot + ".fnt"), fnt.toString("utf8").replace(/file="[^"]*"/, `file="${slot.slot}.png"`));
        written++;
        report.push(`${slot.slot}: upstream's ${src} font with its .fnt`);
        continue;
    }
    const ground = TILESETS[slot.slot];
    if (ground) {
        // a map tileset: the built-in sheet with its ground tiles redrawn from the upstream town
        const base = png.decode(fs.readFileSync(path.join(root, slot.file)));
        const redrawn = ground(base);
        if (!redrawn) {
            report.push(`${slot.slot}: built-in (no upstream town tileset)`);
            continue;
        }
        fs.writeFileSync(path.join(OUT, slot.slot + ".png"), png.encode(base));
        written++;
        report.push(slot.slot === "heights" ? `${slot.slot}: ${redrawn} tiles from upstream (madra ground and water, forest cliffs, push pillar tops), the chasm built-in` : `${slot.slot}: ${redrawn} ground tiles (grass, path and water) from upstream's madra tileset, the rest built-in`);
        continue;
    }
    const rule = RULES[slot.slot];
    if (!rule) {
        report.push(`${slot.slot}: built-in (no upstream counterpart)`);
        continue;
    }
    const base = png.decode(fs.readFileSync(path.join(root, slot.file)));
    const jsonFile = path.join(root, slot.file.replace(/\.png$/, ".json"));
    const atlas = fs.existsSync(jsonFile) ? normalise(JSON.parse(fs.readFileSync(jsonFile, "utf8"))) : null;
    const cells = atlas ? Object.entries(atlas.frames) : [["*", {x: 0, y: 0, w: base.width, h: base.height}]];
    const counts = {};
    for (const [name] of cells) counts[parse(name).group] = (counts[parse(name).group] || 0) + 1;
    if (FIT || !atlas) {
        // the built-in layout: every upstream frame shrunk into its Sunspire cell
        let replaced = 0;
        for (const [name, cell] of cells) {
            const got = rule(name, counts[parse(name).group]);
            if (!got) continue;
            place(base, cell, fit(got.img, cell.w, cell.h), got.anchor);
            replaced++;
        }
        if (!replaced) {
            report.push(`${slot.slot}: built-in (nothing matched)`);
            continue;
        }
        fs.writeFileSync(path.join(OUT, slot.slot + ".png"), png.encode(base));
        written++;
        report.push(`${slot.slot}: ${replaced} of ${cells.length} frames from upstream, shrunk to the built-in cells`);
        continue;
    }
    // native size: a new sheet whose cells hold the upstream frames as they are, with its own atlas
    const items = cells.map(([name, cell]) => {
        const got = rule(name, counts[parse(name).group]);
        return got ? {name, img: got.img, anchor: got.anchor, replaced: true} : {name, img: cut(base, cell), anchor: "center", replaced: false};
    });
    const replaced = items.filter(it => it.replaced).length;
    if (!replaced) {
        report.push(`${slot.slot}: built-in (nothing matched)`);
        continue;
    }
    const cw = Math.max(...items.map(it => it.img.width)),
        ch = Math.max(...items.map(it => it.img.height));
    // frames share one cell size so animations line up, except on the menu widget sheets: the menus
    // place those by their top-left corner, and a button or marker centred in a cell sized for the
    // sheet's biggest frame lands off its spot
    const own = OWN_SIZE_SLOTS.has(slot.slot);
    const cells_out = [];
    let x = 0,
        y = 0,
        row_h = 0;
    items.forEach(it => {
        const w = own ? it.img.width : cw,
            h = own ? it.img.height : ch;
        if (x && x + w > 1024) {
            x = 0;
            y += row_h + 1;
            row_h = 0;
        }
        cells_out.push({x, y, w, h});
        x += w + 1;
        row_h = Math.max(row_h, h);
    });
    const out = png.create(Math.max(...cells_out.map(c => c.x + c.w)), y + row_h);
    const frames = {};
    items.forEach((it, i) => {
        const cell = cells_out[i];
        place(out, cell, it.img, it.anchor);
        frames[it.name] = {frame: cell, rotated: false, trimmed: false, spriteSourceSize: {x: 0, y: 0, w: cell.w, h: cell.h}, sourceSize: {w: cell.w, h: cell.h}};
    });
    fs.writeFileSync(path.join(OUT, slot.slot + ".png"), png.encode(out));
    fs.writeFileSync(
        path.join(OUT, slot.slot + ".json"),
        JSON.stringify({frames, meta: {app: "tools/make-upstream-pack.js", image: slot.slot + ".png", size: {w: out.width, h: out.height}, scale: "1"}})
    );
    written++;
    report.push(`${slot.slot}: ${replaced} of ${cells.length} frames from upstream at native size (${own ? "own-size" : `${cw}x${ch}`} cells, own atlas)`);
}
fs.writeFileSync(path.join(OUT, "REPORT.txt"), report.join("\n") + "\n");
console.log(report.join("\n"));
console.log(`\n${written} sheets written to ${OUT} (${FIT ? (SMOOTH ? "shrunk, smooth" : "shrunk, nearest") : "native size with atlases"}); zip them with: node tools/make-pack-zip.js ${path.relative(root, OUT)} sunspire-upstream-pack.zip`);
