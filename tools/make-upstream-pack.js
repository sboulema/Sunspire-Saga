// Builds a sprite pack for the engine build out of the sprites of the upstream engine repository
// (the `upstream` git remote, goldensun_html5), re-cut into Sunspire's own sheet layout.
//
//   node tools/make-upstream-pack.js [--ref upstream/master] [--out pack-upstream] [--fit] [--smooth]
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
//
// The upstream sprites are not free to redistribute: this pack is for your own browser. Keep the
// output folder and the zip out of the repository (both are git-ignored).
const fs = require("fs"),
    path = require("path"),
    {execFileSync} = require("child_process");
const png = require("../scripts/png.js");

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

// ---------------------------------------------------------------- git + images

const gitCache = new Map();
function gitRead(file) {
    if (!gitCache.has(file)) {
        let data = null;
        try {
            data = execFileSync("git", ["show", `${REF}:assets/images/${file}`], {cwd: root, maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"]});
        } catch {
            data = null;
        }
        gitCache.set(file, data);
    }
    return gitCache.get(file);
}

/** Normalised atlas: frame name -> rect, plus frames grouped by animation (name without /NN). */
function normalise(json) {
    const f = json.frames;
    const list = Array.isArray(f) ? f.map(x => [x.filename, x]) : Object.entries(f);
    const frames = {},
        groups = {};
    for (const [name, r] of list) {
        if (r.rotated) throw new Error("rotated frames are not supported: " + name);
        frames[name] = {x: r.frame.x, y: r.frame.y, w: r.frame.w, h: r.frame.h};
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
const FIELD_ACTIONS = {idle: ["idle"], walk: ["walk", "idle"], dash: ["dash", "walk", "idle"], yes: ["yes", "idle"], no: ["no", "idle"], cast: ["cast", "idle"]};

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
/** A battle sheet: `battle/<anim>_<side>/NN`; init poses take the first source frame, actions the last. */
function battle(file) {
    return name => {
        const s = sheet(file);
        if (!s) return null;
        const m = name.match(/^battle\/(.*)_(back|front)\/\d+$/);
        if (!m) return null;
        for (const kind of BATTLE_FALLBACK[m[1]] || [m[1], "idle"]) {
            const g = s.groups[`battle/${kind}_${m[2]}`];
            if (g) {
                const pick = kind === "attack" || kind === "cast" ? g[g.length - 1] : g[0];
                return {img: cut(s.img, s.frames[pick.name]), anchor: "bottom"};
            }
        }
        return null;
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

/** A fixed cut of the upstream town tileset, standing on its bottom row. */
function madraCut(x, y, w, h, ow, oh) {
    return () => {
        const s = sheet("tilesets/madra");
        if (!s) return null;
        const img = cut(s.img, {x, y, w, h});
        return {img: ow ? resample(img, ow, oh, true) : img, anchor: "bottom"};
    };
}

const MC = "spritesheets/main_chars/",
    NPC = "spritesheets/npc/",
    BT = "spritesheets/battle/";
const HEROES = {ari: "isaac", lyn: "sheba", bram: "garet", sera: "piers"};
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
    RULES[`${id}_battle`] = battle(`${BT}${src}_battle`);
}
for (const [id, src] of Object.entries(NPCS)) RULES[`${id}_field`] = fieldChar(NPC + src);
for (const [id, src] of Object.entries(ENEMIES)) RULES[`${id}_battle`] = battle(`${BT}${src}_battle`);
for (const [id, el] of Object.entries(ELEMENT)) {
    RULES[id] = atlasMap(`spritesheets/djinn/${el}_djinn`);
    RULES[`djinn_battle_${id}_battle`] = battle(`${BT}${DJINN_BATTLE[el]}_djinn_battle`);
}
Object.assign(RULES, {
    avatars: atlasMap("avatars/avatars", {
        ari: "isaac", lyn: "sheba", bram: "garet", sera: "piers", dov: "alex", ina: "innkeeper_wife", miner: "weapon_shopkeeper",
        elder: "elder_healer", mara: "potion_shopkeeper", polly: "jenna", hob: "innkeeper",
        spirit_flint: "venus_djinn", spirit_granite: "venus_djinn", spirit_forge: "mars_djinn", spirit_ember: "mars_djinn",
        spirit_dew: "mercury_djinn", spirit_mist: "mercury_djinn", spirit_breeze: "jupiter_djinn", spirit_squall: "jupiter_djinn",
    }),
    battle_backgrounds: atlasMap("battle_backgrounds/battle_backgrounds", {bg_field: "bg_world_map", bg_mine: "bg_cave", bg_trail: "bg_forest", bg_tower: "bg_cliffs"}),
    start_screen: image("misc/start_screen"),
    buttons: atlasMap("buttons/buttons"),
    abilities_icons: atlasMap("icons/abilities/abilities_icons", {
        gaia_blade: "gaia", fire_bomb: "fireball", inferno: "eruption", ice_horn: "ice", pure_ply: "ply", gust: "whirlwind",
        gnome: "venus", titan: "cybele", salamand: "mars", phoenix: "tiamat", nixie: "mercury", leviath: "neptune",
        sylph: "jupiter", tempest: "thor", sol_avatar: "judgment",
    }),
    battle_effect_icons: atlasMap("icons/battle_effects/battle_effect_icons"),
    items_icons: atlasMap("icons/items/items_icons", {
        potion: "antidote", pdrop: "psy_crystal", wood: "wooden_stick", bronze: "rusty_mace", iron: "great_sword", steel: "master_rapier",
        sol: "sol_blade", vest: "cotton_shirt", leather: "adepts_clothes", chain: "steel_armor", aegis: "knights_shield",
    }),
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
    psynergy_aura: image("psynergies/psynergy_aura"),
    djinn_ball: image("misc/djinn_ball"),
    snowflake: image("interactable_objects/snowflake"),
    star: image("interactable_objects/star"),
    keyboard_arrow: image("debug/keyboard_arrow"),
    mind_read_arrow: image("psynergies/mind_read_arrow"),
    water_drop: image("misc/water_drop"),
    // decorations are sprites with their own sheets: the upstream trees and fence pieces at native size
    // the upstream trees are 48x64; at two tiles wide they hide less of a map whose trees stand on single tiles
    tree: madraCut(80, 288, 48, 64, 32, 43),
    tree_trail: madraCut(32, 288, 48, 64, 32, 43),
    fence_h: madraCut(112, 400, 16, 16),
    fence_v: madraCut(144, 416, 16, 16),
    fence_v2: madraCut(144, 432, 16, 16),
    fence_post: name => madraCut(name.startsWith('idle/left') ? 112 : 128, 384, 16, 16)(),
});

// ---------------------------------------------------------------- build

const slots = JSON.parse(fs.readFileSync(path.join(root, "static", "pack-slots.json"), "utf8"));
fs.mkdirSync(OUT, {recursive: true});
const report = [];
let written = 0;
for (const slot of slots) {
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
    const cols = Math.max(1, Math.min(items.length, Math.floor(1024 / (cw + 1))));
    const rows = Math.ceil(items.length / cols);
    const out = png.create(cols * (cw + 1) - 1, rows * (ch + 1) - 1);
    const frames = {};
    items.forEach((it, i) => {
        const cell = {x: (i % cols) * (cw + 1), y: Math.floor(i / cols) * (ch + 1), w: cw, h: ch};
        place(out, cell, it.img, it.anchor);
        frames[it.name] = {frame: cell, rotated: false, trimmed: false, spriteSourceSize: {x: 0, y: 0, w: cw, h: ch}, sourceSize: {w: cw, h: ch}};
    });
    fs.writeFileSync(path.join(OUT, slot.slot + ".png"), png.encode(out));
    fs.writeFileSync(
        path.join(OUT, slot.slot + ".json"),
        JSON.stringify({frames, meta: {app: "tools/make-upstream-pack.js", image: slot.slot + ".png", size: {w: out.width, h: out.height}, scale: "1"}})
    );
    written++;
    report.push(`${slot.slot}: ${replaced} of ${cells.length} frames from upstream at native size (${cw}x${ch} cells, own atlas)`);
}
fs.writeFileSync(path.join(OUT, "REPORT.txt"), report.join("\n") + "\n");
console.log(report.join("\n"));
console.log(`\n${written} sheets written to ${OUT} (${FIT ? (SMOOTH ? "shrunk, smooth" : "shrunk, nearest") : "native size with atlases"}); zip them with: node tools/make-pack-zip.js ${path.relative(root, OUT)} sunspire-upstream-pack.zip`);
