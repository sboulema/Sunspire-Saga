// Builds the engine's images, atlases, tileset + map, bitmap font and placeholder audio from the
// Sunspire source art in assets/sunspire/ (the sprites exported from the legacy game.js, the
// Brindle tile grid and the 5x5 glyph bitmaps). The databases under assets/dbs/ are hand-written
// and must agree with the frame names produced here; se_db.json and bgm_db.json are written by
// this script because their markers come from the generated audio.
//
//   node scripts/build_sunspire_assets.js
//
// Atlases are TexturePacker "JSON hash" files; character frames are named <action>/<animation>/NN
// as base/SpriteBase.ts expects. Art that Sunspire never had (menu widgets, status icons, cursors)
// is drawn here as labelled placeholder boxes until it gets real pixel art.
const fs = require("fs");
const path = require("path");
const png = require("./png.js");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "assets/sunspire");
const IMG = path.join(ROOT, "assets/images");
const glyphs = JSON.parse(fs.readFileSync(path.join(SRC, "glyphs.json")));
const grid = JSON.parse(fs.readFileSync(path.join(SRC, "brindle_grid.json")));

const COL = {
    earth: [207, 140, 42], fire: [226, 84, 58], wind: [155, 110, 224], water: [79, 168, 232], sol: [255, 217, 78],
    white: [255, 255, 255], ink: [30, 24, 40], gold: [242, 193, 78], grey: [120, 120, 136], green: [124, 216, 138],
    red: [226, 84, 58], blue: [79, 168, 232], sand: [214, 190, 120], shadow: [0, 0, 0, 90],
};
const ELEMENT = { venus: "earth", mercury: "water", mars: "fire", jupiter: "wind" };

const sprites = {};
function spr(name) {
    if (!sprites[name]) sprites[name] = png.decode(fs.readFileSync(path.join(SRC, "sprites", name + ".png")));
    return sprites[name];
}
function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
function writePng(file, img) { mkdir(path.dirname(file)); fs.writeFileSync(file, png.encode(img)); }
function writeJson(file, obj) { mkdir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(obj, null, 4) + "\n"); }

// ---------------- drawing helpers ----------------
function text5(img, s, x, y, rgba) {
    for (const ch of String(s).toUpperCase()) {
        const g = glyphs[ch];
        if (g) for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (g[r][c] === "1") png.fill(img, x + c, y + r, 1, 1, rgba);
        x += 6;
    }
}
// a bordered box with a short centred label, for art the engine needs but Sunspire never drew
function placeholder(w, h, label, border = COL.gold, bg = COL.ink) {
    const img = png.create(w, h);
    png.fill(img, 0, 0, w, h, border);
    if (w > 2 && h > 2) png.fill(img, 1, 1, w - 2, h - 2, bg);
    if (label && h >= 7) {
        let s = String(label);
        while (s.length && s.length * 6 - 1 > w - 2) s = s.slice(0, -1);
        if (s.length) text5(img, s, Math.floor((w - (s.length * 6 - 1)) / 2), Math.floor((h - 5) / 2), COL.white);
    }
    return img;
}
function ellipse(w, h, rgba) {
    const img = png.create(w, h), cx = (w - 1) / 2, cy = (h - 1) / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (x - cx) / (w / 2), dy = (y - cy) / (h / 2);
        if (dx * dx + dy * dy <= 1) png.fill(img, x, y, 1, 1, rgba);
    }
    return img;
}
function triangle(w, h, dir, rgba) {
    const img = png.create(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let inside;
        if (dir === "right") inside = y >= (h / 2) * (x / w) * -1 + h / 2 - (h / 2) * (1 - x / w) && y <= h / 2 + (h / 2) * (1 - x / w);
        else if (dir === "left") inside = y >= h / 2 - (h / 2) * (x / w) && y <= h / 2 + (h / 2) * (x / w);
        else if (dir === "up") inside = x >= w / 2 - (w / 2) * (y / h) && x <= w / 2 + (w / 2) * (y / h);
        else inside = x >= w / 2 - (w / 2) * (1 - y / h) && x <= w / 2 + (w / 2) * (1 - y / h);
        if (inside) png.fill(img, x, y, 1, 1, rgba);
    }
    return img;
}
function star(size, rgba) {
    const img = png.create(size, size), c = Math.floor(size / 2);
    png.fill(img, c, 0, 1, size, rgba); png.fill(img, 0, c, size, 1, rgba);
    for (let i = 1; i < c; i++) { png.fill(img, c - i, c - i, 1, 1, rgba); png.fill(img, c + i, c + i, 1, 1, rgba); png.fill(img, c - i, c + i, 1, 1, rgba); png.fill(img, c + i, c - i, 1, 1, rgba); }
    return img;
}
// pads an image into a w x h cell, bottom-centred (feet on the last row)
function cell(src, w, h) {
    const img = png.create(w, h);
    png.blit(img, src, Math.floor((w - src.width) / 2), h - src.height);
    return img;
}
function shift(src, dx, dy) { const img = png.create(src.width, src.height); png.blit(img, src, dx, dy); return img; }
function scale(src, f) {
    const img = png.create(src.width * f, src.height * f);
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
        const si = (Math.floor(y / f) * src.width + Math.floor(x / f)) * 4;
        src.data.copy(img.data, (y * img.width + x) * 4, si, si + 4);
    }
    return img;
}

// ---------------- atlas packing ----------------
// frames: [{name, img}] -> one png + TexturePacker JSON hash, written as <dir>/<base>.png/.json
function writeAtlas(dir, base, frames, maxW = 512) {
    const sorted = frames.slice().sort((a, b) => b.img.height - a.img.height);
    let x = 0, y = 0, rowH = 0, W = 0;
    for (const f of sorted) {
        if (x + f.img.width > maxW) { x = 0; y += rowH + 1; rowH = 0; }
        f.x = x; f.y = y; x += f.img.width + 1; rowH = Math.max(rowH, f.img.height); W = Math.max(W, x);
    }
    const H = y + rowH;
    const sheet = png.create(Math.max(W, 1), Math.max(H, 1));
    const json = { frames: {}, meta: { app: "scripts/build_sunspire_assets.js", version: "1.0", image: base + ".png", format: "RGBA8888", size: { w: sheet.width, h: sheet.height }, scale: "1" } };
    for (const f of frames) {
        png.blit(sheet, f.img, f.x, f.y);
        json.frames[f.name] = { frame: { x: f.x, y: f.y, w: f.img.width, h: f.img.height }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: f.img.width, h: f.img.height }, sourceSize: { w: f.img.width, h: f.img.height } };
    }
    writePng(path.join(dir, base + ".png"), sheet);
    writeJson(path.join(dir, base + ".json"), json);
}
const F = (name, img) => ({ name, img });

// ---------------- characters ----------------
const HEROES = ["ari", "lyn", "bram", "sera"];
const NPCS = ["dov", "ina", "miner", "elder", "mara", "polly", "hob"];
const DIRS8 = ["down", "up", "left", "right", "down_left", "down_right", "up_left", "up_right"];
const DIRS4 = ["down", "up", "left", "right"];
// Sunspire drew down / up / right; left is right mirrored and the diagonals borrow the side views
function walkFrames(id, dir) {
    const side = dir.endsWith("left") ? "left" : dir.endsWith("right") ? "right" : dir;
    const src = side === "left" ? "right" : side;
    const a = spr(id + "_" + src), b = spr(id + "_" + src + "2");
    return side === "left" ? [png.flipX(a), png.flipX(b)] : [a, b];
}
function fieldSheet(id) {
    const frames = [], CW = 18, CH = 24;
    for (const dir of DIRS8) {
        const [stand, step] = walkFrames(id, dir);
        frames.push(F(`idle/${dir}/00`, cell(stand, CW, CH)));
        for (const action of ["walk", "dash"]) {
            frames.push(F(`${action}/${dir}/00`, cell(step, CW, CH)));
            frames.push(F(`${action}/${dir}/01`, cell(stand, CW, CH)));
        }
    }
    writeAtlas(path.join(IMG, "spritesheets/field"), id + "_field", frames);
}
// battle poses: Sunspire's attack / cast / hit / downed frames are the party's view (back), the
// facing-down sprite stands in for the front view
function heroBattleSheet(id) {
    const CW = 20, CH = 26, s = n => spr(id + "_" + n);
    const poses = {
        idle_back: [s("back")], idle_front: [s("down")],
        attack_init_back: [s("attack")], attack_back: [s("attack2")], attack_init_front: [s("attack")], attack_front: [s("attack2")],
        cast_init_back: [s("cast")], cast_back: [s("cast2")], cast_init_front: [s("cast")], cast_front: [s("cast2")],
        damage_back: [s("hit")], damage_front: [s("hit")], downed_back: [s("downed")], downed_front: [s("downed")],
    };
    const frames = [];
    for (const [anim, list] of Object.entries(poses)) list.forEach((img, i) => frames.push(F(`battle/${anim}/${String(i).padStart(2, "0")}`, cell(img, CW, CH))));
    writeAtlas(path.join(IMG, "spritesheets/battle"), id + "_battle", frames);
}
const ENEMIES = ["ooze", "bat", "wolf", "spider", "beetle", "golem", "harpy", "boar", "shade", "gargoyle", "ogre", "wyrm",
    "djinn_battle_flint", "djinn_battle_granite", "djinn_battle_forge", "djinn_battle_ember", "djinn_battle_dew", "djinn_battle_mist", "djinn_battle_breeze", "djinn_battle_squall"];
function enemyBattleSheet(id) {
    const img = spr(id), CW = img.width + 4, CH = img.height + 2, frames = [];
    const anims = ["idle_back", "idle_front", "attack_init_back", "attack_init_front", "attack_back", "attack_front", "cast_init_back", "cast_init_front", "cast_back", "cast_front", "damage_back", "damage_front"];
    for (const anim of anims) {
        const pose = anim.startsWith("attack_") && !anim.startsWith("attack_init") ? shift(cell(img, CW, CH), -2, 0) : anim.startsWith("damage") ? shift(cell(img, CW, CH), 2, 0) : cell(img, CW, CH);
        frames.push(F(`battle/${anim}/00`, pose));
    }
    writeAtlas(path.join(IMG, "spritesheets/battle"), id + "_battle", frames);
}
const SPIRITS = { flint: "earth", granite: "earth", forge: "fire", ember: "fire", dew: "water", mist: "water", breeze: "wind", squall: "wind" };
function spiritSheet(id) {
    const img = spr("djinn_" + id), frames = [];
    for (const action of ["set", "standby"]) for (const dir of DIRS8) {
        const face = dir.endsWith("left") ? png.flipX(img) : img;
        frames.push(F(`${action}/${dir}/00`, cell(action === "standby" ? face : shift(face, 0, 0), img.width, img.height + 1)));
    }
    writeAtlas(path.join(IMG, "spritesheets/spirit"), id, frames);
}

// ---------------- fixed engine atlases ----------------
function miscSheets() {
    const misc = path.join(IMG, "misc");
    const ring = (size, rgba) => { const i = ellipse(size, size, rgba); png.blit(i, ellipse(size - 4, size - 4, [0, 0, 0, 0]), 2, 2); for (let y = 2; y < size - 2; y++) for (let x = 2; x < size - 2; x++) { const dx = x - (size - 1) / 2, dy = y - (size - 1) / 2; if (dx * dx + dy * dy <= ((size - 4) / 2) ** 2) png.fill(i, x, y, 1, 1, [0, 0, 0, 0]); } return i; };
    const hand = dir => { const i = ring(12, COL.gold); png.blit(i, triangle(6, 6, dir, COL.white), 3, 3); return i; };
    writeAtlas(misc, "move_hand", DIRS4.map(d => F(`move_hand/${d}/00`, hand(d))));
    writeAtlas(misc, "pound_hand", DIRS4.map(d => F(`pound_hand/${d}/00`, hand(d))));
    const sand = png.create(16, 16); for (let i = 0; i < 12; i++) png.fill(sand, (i * 7) % 16, (i * 5) % 16, 1, 1, COL.sand);
    writeAtlas(misc, "sand", [F("sand/trail/00", sand)]);
    writeAtlas(misc, "dialog_crystal", [0, 1, 2, 3, 4, 5, 6].map(i => { const w = 2 + Math.abs(3 - i) * 2; const img = png.create(10, 10); png.blit(img, triangle(w, 5, "up", COL.sol), Math.floor((10 - w) / 2), 0); png.blit(img, triangle(w, 5, "down", COL.gold), Math.floor((10 - w) / 2), 5); return F(`dialog_crystal/rotate/${String(i).padStart(2, "0")}`, img); }));
    const statuses = ["death_curse_0", "death_curse_1", "death_curse_2", "death_curse_3", "death_curse_4", "death_curse_5", "death_curse_6", "delusion", "haunt", "poison", "seal", "sleep", "stun", "venom"];
    writeAtlas(misc, "battle_status_sprites", statuses.map(s => F(`battle_status_sprites/${s}/00`, placeholder(14, 9, s.startsWith("death_curse") ? s.slice(-1) : s.slice(0, 2), COL.red))));
    writeAtlas(misc, "psynergy_particle", [
        ...[6, 5, 4, 2].map((d, i) => F(`psynergy_particle/vanish/${String(i).padStart(2, "0")}`, cell(ellipse(d, d, COL.sol), 8, 8))),
        F("psynergy_particle/hidden_item/00", star(7, COL.white)),
    ]);
    writeAtlas(misc, "dust", [0, 1, 2, 3].map(i => F(`dust/spread/${String(i).padStart(2, "0")}`, cell(ellipse(4 + i * 3, 3 + i, [200, 190, 160, 200 - i * 45]), 16, 8))));
    writeAtlas(misc, "sweat_drops", [0, 1, 2].map(i => F(`sweat_drops/splash/${String(i).padStart(2, "0")}`, shift(cell(ellipse(3, 5, COL.blue), 12, 12), i * 2 - 2, -i * 3))));
    const print = ellipse(4, 6, [0, 0, 0, 70]);
    writeAtlas(misc, "footprints", [F("footprints/single/00", cell(print, 8, 8)), F("footprints/double/00", (() => { const i = png.create(12, 8); png.blit(i, print, 1, 1); png.blit(i, print, 7, 1); return i; })())]);
    writePng(path.join(misc, "shadow.png"), ellipse(16, 10, COL.shadow));
    writePng(path.join(IMG, "psynergies/psynergy_aura.png"), ring(32, [255, 240, 160, 180]));
    writePng(path.join(misc, "djinn_ball.png"), ellipse(10, 10, COL.sol));
    writePng(path.join(misc, "water_drop.png"), ellipse(4, 6, COL.blue));
    const tri = (w, h, d, c = COL.white) => triangle(w, h, d, c);
    writeAtlas(misc, "menu", [
        F("cursor", tri(8, 8, "right")), F("arrow_change", tri(6, 6, "right", COL.gold)), F("down_arrow", tri(8, 5, "down")), F("up_arrow", tri(8, 5, "up")),
        F("page_arrow", tri(5, 7, "right", COL.gold)), F("green_arrow", tri(6, 6, "right", COL.green)), F("stat_up", tri(6, 4, "up", COL.green)), F("stat_down", tri(6, 4, "down", COL.red)),
        F("equipped", placeholder(7, 7, "E", COL.green)), F("broken", placeholder(7, 7, "X", COL.red)), F("item_border", (() => { const i = png.create(18, 18); png.fill(i, 0, 0, 18, 18, COL.gold); png.fill(i, 1, 1, 16, 16, [0, 0, 0, 0]); return i; })()),
        F("price_tag", placeholder(16, 9, "$", COL.gold)),
    ]);
    const effects = ["agility_down", "agility_up", "attack_down", "attack_up", "death_curse", "defense_down", "defense_up", "delusion", "downed", "equip_curse", "haunt", "poison", "power_down", "power_up", "power_up_down", "resist_down", "resist_up", "resist_up_down", "seal", "sleep", "stun", "venom"];
    writeAtlas(path.join(IMG, "icons/battle_effects"), "battle_effect_icons", effects.map(e => F(e, placeholder(14, 9, e.slice(0, 2), e.endsWith("_up") ? COL.green : e.endsWith("_down") ? COL.red : COL.gold))));
    writeAtlas(misc, "battle_cursor", Array.from({ length: 30 }, (_, i) => F(String(i).padStart(2, "0"), shift(cell(tri(8, 8, "down", COL.gold), 10, 12), 0, -((i >> 2) % 3)))));
    writeAtlas(misc, "ranges", ["1", "3", "5", "7", "9", "11", "all"].map(r => F(r, placeholder(20, 9, r))));
    writeAtlas(misc, "stars", Object.entries(ELEMENT).map(([k, el]) => F(k, star(7, COL[el]))));
    const emoticons = { angry: ">:(", annoyed: "...", doubt: "?", ellipsis: "...", exclamation: "!", happy: ":)", idea: "*", love: "<3", nervous: "::", unhappy: ":(" };
    writeAtlas(misc, "emoticons", Object.entries(emoticons).map(([k, t]) => F(k, placeholder(14, 9, t, COL.white))));
    writeAtlas(path.join(IMG, "interactable_objects"), "psynergy_ball", [0, 1, 2, 3].map(i => F(`ball/${String(i).padStart(2, "0")}`, cell(ellipse(8 - (i % 2), 8 - (i % 2), COL.sol), 8, 8))));
    writePng(path.join(IMG, "interactable_objects/snowflake.png"), star(7, COL.white));
    writePng(path.join(IMG, "interactable_objects/star.png"), star(5, COL.sol));
    writePng(path.join(IMG, "psynergies/mind_read_arrow.png"), tri(6, 8, "down", COL.white));
    writePng(path.join(IMG, "debug/keyboard_arrow.png"), tri(8, 8, "up", COL.white));
    const leaves = spr("grass_2");
    writeAtlas(misc, "bush", [...[0, 1, 2, 3, 4, 5].map(i => F(`leaves/blowing/${String(i).padStart(2, "0")}`, shift(leaves, (i % 3) - 1, 0))), F("leaves/bush/00", leaves)]);
    // crate: the one interactable object the loader insists on; never placed on a map
    writeAtlas(path.join(IMG, "interactable_objects"), "crate", [F("crate/idle/00", spr("chest"))]);
}

function buttonSheets() {
    // GS had an icon per menu button; Sunspire's battle toolbar icons cover the battle ones, the
    // rest are labelled boxes until they get art
    const icon = { fight: "icon_fight", attack: "icon_fight", battle: "icon_fight", psynergy: "icon_arts", djinni: "icon_spirit", summon: "icon_summon", item: "icon_item", defend: "icon_defend", flee: "icon_flee", run: "icon_flee" };
    const names = ["artifacts", "attack", "battle", "bronze_password", "buy", "coins", "continue", "copy_file", "cure_poison", "defend", "djinni", "erase_file", "fight", "flee", "gold_password", "item", "link_cable", "lucky_medals", "new_quest", "no", "options", "options2", "password", "psynergy", "remove_curse", "repair", "repel_evil", "revive", "run", "save_game", "save_game2", "sell", "send", "silver_password", "sleep", "sleep2", "sleep_mode_off", "sleep_mode_off2", "sleep_mode_on", "sleep_mode_on2", "speech_off", "speech_off2", "speech_on", "speech_on2", "status", "summon", "switch", "text_speed_fast", "text_speed_fast2", "text_speed_medium", "text_speed_medium2", "text_speed_slow", "text_speed_slow2", "transfer_file", "yes"];
    const labels = { new_quest: "NEW GAME", continue: "CONTINUE" };
    writeAtlas(path.join(IMG, "buttons"), "buttons", names.map(n => F(n, icon[n] ? spr(icon[n]) : placeholder(labels[n] ? 56 : 18, 18, labels[n] || n.replace(/_/g, "").slice(0, 2)))));
    writeAtlas(path.join(IMG, "keyboard"), "keyboard_buttons", ["a_button", "b_button", "l_button", "r_button", "select_button", "shift", "spacebar", "tab"].map(n => F(n, placeholder(n.length > 8 ? 32 : 12, 12, n.replace("_button", "").slice(0, 5)))));
}

function battleAndPortraits() {
    // battle backgrounds: the bottom 120 rows of Sunspire's 240x160 backdrop, widened to 256 by
    // repeating the edge columns
    const bgs = ["bg_field", "bg_mine", "bg_trail", "bg_tower", "bg_summon", "bg_summon_earth", "bg_summon_fire", "bg_summon_water", "bg_summon_wind", "bg_summon_sol"];
    writeAtlas(path.join(IMG, "battle_backgrounds"), "battle_backgrounds", bgs.map(k => {
        const s = spr(k), img = png.create(256, 120);
        for (let x = 0; x < 256; x++) { const sx = Math.min(239, Math.max(0, x - 8)); png.blit(img, s, x, 0, sx, 40, 1, 120); }
        return F(k, img);
    }), 1024);
    writeAtlas(path.join(IMG, "spritesheets/battle"), "battle_shadows", [F("00", ellipse(20, 7, COL.shadow)), F("01", ellipse(28, 9, COL.shadow))]);
    // 32x32 portraits: the standing sprite, enlarged
    const portrait = img => { const big = scale(img, 1), p = png.create(32, 32); png.blit(p, big, Math.floor((32 - big.width) / 2), 32 - big.height - 2); return p; };
    const avatars = [...HEROES, ...NPCS].map(id => F(id, portrait(spr(id + "_down"))));
    for (const [k, el] of Object.entries(ELEMENT)) avatars.push(F(k + "_djinn", portrait(scale(spr("djinn_" + { earth: "flint", water: "dew", fire: "forge", wind: "breeze" }[el]), 2))));
    for (const id of Object.keys(SPIRITS)) avatars.push(F("spirit_" + id, portrait(scale(spr("djinn_" + id), 2))));
    writeAtlas(path.join(IMG, "avatars"), "avatars", avatars);
    // ability and item icons are keyed by the database key names
    const arts = ["quake", "spire", "gaia_blade", "flare", "fire_bomb", "inferno", "cure", "ice_horn", "pure_ply", "gust", "plasma", "bolt"];
    const summons = ["gnome", "titan", "salamand", "phoenix", "nixie", "leviath", "sylph", "tempest", "sol_avatar"];
    const abilityIcons = [
        ...arts.map(a => F(a, spr("art_" + a))),
        ...Object.keys(SPIRITS).map(s => F(s, spr("spirit_" + s))),
        ...summons.map(s => F(s, spr("summon_" + s))),
        F("attack", spr("icon_fight")), F("defend", spr("icon_defend")), F("flee", spr("icon_flee")), F("set_djinn", spr("icon_spirit")),
        F("herb", spr("item_herb")), F("potion", spr("item_potion")), F("pdrop", spr("item_pdrop")), F("elixir", spr("item_elixir")),
    ];
    writeAtlas(path.join(IMG, "icons/abilities"), "abilities_icons", abilityIcons);
    const gear = { wood: "W", bronze: "W", iron: "W", steel: "W", sol: "W", vest: "A", leather: "A", chain: "A", aegis: "A" };
    writeAtlas(path.join(IMG, "icons/items"), "items_icons", [
        ...["herb", "potion", "pdrop", "elixir"].map(k => F(k, spr("item_" + k))),
        ...Object.entries(gear).map(([k, l]) => F(k, placeholder(8, 8, l, l === "W" ? COL.grey : COL.earth))),
    ]);
    // title screen: night sky with the Sunspire logo block
    const title = png.create(240, 160);
    for (let y = 0; y < 160; y++) png.fill(title, 0, y, 240, 1, [12 + (y >> 4), 10 + (y >> 3), 22 + (y >> 2)]);
    png.blit(title, spr("title"), 6, 22);
    writePng(path.join(IMG, "misc/start_screen.png"), title);
}

// ---------------- tileset and map ----------------
const SOLID = new Set(["t", "r", "v", "C", "R", "Q", "W", "D", "s"]);
function brindleMap() {
    const tiles = png.decode(fs.readFileSync(path.join(SRC, "brindle_tiles.png")));
    writePng(path.join(IMG, "tilesets/brindle.png"), tiles);
    const { w, h, chars } = grid, T = 16;
    const data = []; for (const row of grid.grid) for (const t of row) data.push(t + 1);
    // collision: every solid tile, horizontal runs merged into one rectangle; the two exits lead
    // to maps that are not ported yet, so they stay blocked
    const objects = []; let id = 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const solid = c => SOLID.has(c) || (y === h - 1) || (y === 1);
        if (!solid(chars[y][x])) continue;
        let x1 = x; while (x1 + 1 < w && solid(chars[y][x1 + 1])) x1++;
        objects.push({ id: id++, name: "", type: "", x: x * T, y: y * T, width: (x1 - x + 1) * T, height: T, rotation: 0, visible: true });
        x = x1;
    }
    const say = lines => lines.join("${BREAK}");
    const npcs = {
        "npc/01": { key_name: "dov", x: 8, y: 9, npc_type: "shop", shop_key: "brindle", movement_type: "idle", avatar: "dov", base_collision_layer: 0, initial_action: "idle", animation: "down" },
        "npc/02": { key_name: "ina", x: 24, y: 13, npc_type: "inn", inn_key: "brindle_inn", movement_type: "idle", avatar: "ina", base_collision_layer: 0 },
        "npc/03": { key_name: "miner", x: 20, y: 11, npc_type: "normal", movement_type: "random", avatar: "miner", base_collision_layer: 0,
            message: say(["MINER: 'A FANG WOLF followed me out of the seams!'", "'It's right behind me, isn't it. Ari, do something!'"]),
            events: [{ type: "battle", background_key: "bg_field", bgm: "battle", enemy_party_key: "wolf_pair" }] },
        "npc/04": { key_name: "lyn", x: 13, y: 10, npc_type: "normal", movement_type: "random", avatar: "lyn", base_collision_layer: 0,
            message: say(["LYN: 'Ari! Took you long enough to crack that boulder.'", "'I'd come along, but I lost my COMPASS scouting the paddock north of the fence.'"]) },
    };
    const properties = {}, propertytypes = {};
    for (const [k, v] of Object.entries(npcs)) { properties[k] = JSON.stringify(v); propertytypes[k] = "string"; }
    const map = {
        version: 1.1, tiledversion: "1.1.0", type: "map", orientation: "orthogonal", renderorder: "right-down", infinite: false,
        width: w, height: h, tilewidth: T, tileheight: T, nextobjectid: id,
        properties, propertytypes,
        layers: [
            { name: "ground", type: "tilelayer", x: 0, y: 0, width: w, height: h, opacity: 1, visible: true, data },
            { name: "0", type: "objectgroup", x: 0, y: 0, opacity: 1, visible: true, draworder: "topdown", objects },
        ],
        tilesets: [{ name: "brindle", firstgid: 1, image: "../../images/tilesets/brindle.png", imagewidth: tiles.width, imageheight: tiles.height, tilewidth: T, tileheight: T, columns: tiles.width / T, tilecount: (tiles.width / T) * (tiles.height / T), margin: 0, spacing: 0 }],
    };
    writeJson(path.join(ROOT, "assets/maps/brindle/brindle.json"), map);
}

// ---------------- font ----------------
// Sunspire's 5x5 uppercase font as an AngelCode BMFont (XML) for Phaser's bitmap text. Lower case
// shares the capitals; characters the font never had get an empty, normal-width glyph.
function font() {
    const keys = Object.keys(glyphs), pitch = 6;
    const img = png.create(keys.length * pitch, 8);
    keys.forEach((k, i) => text5(img, k, i * pitch, 1, COL.white));
    const rect = {}; keys.forEach((k, i) => (rect[k] = { x: i * pitch, y: 1 }));
    const chars = [];
    const add = (id, k) => chars.push(k in rect ? `    <char id="${id}" x="${rect[k].x}" y="${rect[k].y}" width="5" height="5" xoffset="0" yoffset="1" xadvance="6" page="0" chnl="15"/>` : `    <char id="${id}" x="0" y="0" width="0" height="0" xoffset="0" yoffset="0" xadvance="${id === 32 ? 4 : 6}" page="0" chnl="15"/>`);
    for (let id = 32; id < 127; id++) add(id, String.fromCharCode(id).toUpperCase());
    add(8217, "'"); add(8220, "'"); add(8221, "'");
    const fnt = `<?xml version="1.0"?>\n<font>\n  <info face="sunspire" size="8" bold="0" italic="0" charset="" unicode="1" stretchH="100" smooth="0" aa="1" padding="0,0,0,0" spacing="1,1" outline="0"/>\n  <common lineHeight="8" base="6" scaleW="${img.width}" scaleH="${img.height}" pages="1" packed="0" alphaChnl="0" redChnl="4" greenChnl="4" blueChnl="4"/>\n  <pages>\n    <page id="0" file="sunspire.png"/>\n  </pages>\n  <chars count="${chars.length}">\n${chars.join("\n")}\n  </chars>\n</font>\n`;
    writePng(path.join(ROOT, "assets/font/sunspire.png"), img);
    fs.writeFileSync(path.join(ROOT, "assets/font/sunspire.fnt"), fnt);
}

// ---------------- audio ----------------
// Placeholder chiptune WAVs (Sunspire's real sound is synthesised at run time in the legacy game):
// a seeded pentatonic loop per BGM, and one short blip per sound-effect marker.
const RATE = 11025;
function wav(samples) {
    const buf = Buffer.alloc(44 + samples.length * 2);
    buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
    buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
    samples.forEach((s, i) => buf.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, 44 + i * 2));
    return buf;
}
function tone(samples, start, dur, freq, vol, wave = "square") {
    const n0 = Math.floor(start * RATE), n1 = Math.min(samples.length, Math.floor((start + dur) * RATE));
    for (let n = n0; n < n1; n++) {
        const t = (n - n0) / RATE, ph = (t * freq) % 1, env = Math.exp(-3 * t / dur);
        samples[n] += vol * env * (wave === "square" ? (ph < 0.5 ? 1 : -1) : wave === "tri" ? 1 - 4 * Math.abs(ph - 0.5) : Math.sin(ph * 2 * Math.PI));
    }
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function bgm(key, seed, secs, tempo, scale) {
    const samples = new Float64Array(Math.floor(secs * RATE)), r = rng(seed), step = 60 / tempo;
    for (let t = 0, i = 0; t < secs; t += step, i++) {
        tone(samples, t, step * 0.9, scale[Math.floor(r() * scale.length)], 0.18, "square");
        if (i % 2 === 0) tone(samples, t, step * 1.8, scale[Math.floor(r() * 3)] / 2, 0.12, "tri");
    }
    mkdir(path.join(ROOT, "assets/sounds/bgm"));
    fs.writeFileSync(path.join(ROOT, "assets/sounds/bgm", key + ".wav"), wav(samples));
    return { key, path: "assets/sounds/bgm/" + key + ".wav" };
}
function seSheet(name, markers) {
    const gap = 0.2, len = 0.14, samples = new Float64Array(Math.ceil(markers.length * gap * RATE) + RATE / 10), spritemap = {};
    markers.forEach((m, i) => {
        const start = i * gap, f = 330 + ((m.length * 37 + i * 53) % 12) * 55;
        tone(samples, start, len, f, 0.3, "square"); tone(samples, start + 0.04, len - 0.04, f * 1.5, 0.15, "tri");
        spritemap[m] = { start: Math.round(start * 1000) / 1000, end: Math.round((start + len) * 1000) / 1000 };
    });
    mkdir(path.join(ROOT, "assets/sounds/se"));
    fs.writeFileSync(path.join(ROOT, "assets/sounds/se", name + ".wav"), wav(samples));
    return { audio: "assets/sounds/se/" + name + ".wav", json: { spritemap } };
}
function audio() {
    const major = [262, 294, 330, 392, 440, 523, 587, 659], minor = [220, 262, 294, 330, 392, 440, 523, 587];
    const bgms = [
        bgm("page_one", 1, 8, 100, major), bgm("town", 2, 8, 120, major), bgm("battle", 3, 6, 180, minor),
        bgm("battle_boss", 4, 6, 200, minor), bgm("victory", 5, 2.4, 150, major), bgm("fallen_heroes", 6, 3, 60, minor),
    ];
    writeJson(path.join(ROOT, "assets/dbs/bgm_db.json"), bgms);
    const se = {
        menu: seSheet("menu", ["move", "negative", "positive", "positive_2", "positive_3", "positive_4", "positive_5", "item_equip", "item_unequip", "djinn_set", "djinn_unset", "shop_buy", "shop_sell"]),
        battle: seSheet("battle", ["heal_1", "hit_1", "hit_2", "poison_hit"]),
        monster_defeat: seSheet("monster_defeat", ["monster_1", "monster_2", "monster_3"]),
        misc: seSheet("misc", ["level_up", "item_get", "party_join", "inn", "chest_open", "djinn_excite", "fall", "fall_into_water", "ice_hitting", "item_repair", "on_equip_curse", "remove_curse", "repel_evil", "power", "rock_drop", "rolling", "on_rolling_fall", "psynergy_stone_shatter", "stat_boost", "whirlwind_emit", "wind_blowing", "venus_djinn_get", "mars_djinn_get", "jupiter_djinn_get", "mercury_djinn_get"]),
        actions: seSheet("actions", ["push", "jump", "jump_2", "slide", "first_break", "full_break", "ground_hit"]),
        door: seSheet("door", ["default", "open_door", "stair_up", "stair_down"]),
        psynergy: seSheet("psynergy", ["1", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "ply", "revive", "sand_in_1", "sand_in_2", "sand_out", "sand_trail"]),
        summon_tablet: seSheet("summon_tablet", ["disassemble", "piece", "finish", "absorb"]),
        voices: seSheet("voices", ["adult_male_1", "adult_female_1", "child_1", "elder_1", "hero_1"]),
    };
    writeJson(path.join(ROOT, "assets/dbs/se_db.json"), se);
}

// ---------------- run ----------------
for (const id of HEROES) { fieldSheet(id); heroBattleSheet(id); }
for (const id of NPCS) fieldSheet(id);
for (const id of ENEMIES) enemyBattleSheet(id);
for (const id of Object.keys(SPIRITS)) spiritSheet(id);
miscSheets();
buttonSheets();
battleAndPortraits();
brindleMap();
font();
audio();
console.log("built assets/images, assets/maps, assets/font, assets/sounds, bgm_db and se_db");
