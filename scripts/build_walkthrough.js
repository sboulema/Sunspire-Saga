// Generates walkthrough.html, the plain-text FAQ / walkthrough, from the same data the game is
// built from: assets/sunspire/content.json and the map grids, so the guide cannot drift from the
// game. Section codes ([WLK07] etc.) are stable anchors; the text inside the <pre> stays at 79
// columns and plain ASCII.
//
//   node scripts/build_walkthrough.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "assets/sunspire");
const C = JSON.parse(fs.readFileSync(path.join(SRC, "content.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const WIDTH = 79;
const TODAY = new Date().toISOString().slice(0, 10);
const GUIDE_VERSION = "2.0";
const EL_NAME = {earth: "Earth", fire: "Fire", water: "Water", wind: "Wind", sol: "Sol"};

const out = [];
const line = (s = "") => out.push(s);
const rule = () => line("=".repeat(WIDTH));
const sub = title => { line(title); line("-".repeat(title.length)); };
const anchors = [];
function section(code, number, title) {
    const head = `  ${number}. ${title}`;
    anchors.push({code, head: `${number}. ${title}`});
    rule();
    line(`<b id="${code}">${head.padEnd(WIDTH - code.length - 2)}[${code}]</b>`);
    rule();
    line();
}
function wrap(text, indent = 0) {
    const words = text.split(/\s+/);
    let cur = " ".repeat(indent);
    for (const w of words) {
        if ((cur + " " + w).trim().length > WIDTH) { line(cur.trimEnd()); cur = " ".repeat(indent) + w; }
        else cur = cur.trim() ? cur + " " + w : cur + w;
    }
    if (cur.trim()) line(cur.trimEnd());
}
const para = (text, indent = 0) => { wrap(text, indent); line(); };
// rows of padded columns; a last column that runs past the margin wraps onto indented lines
function table(rows, widths) {
    for (const r of rows) {
        const head = "   " + r.slice(0, -1).map((c, i) => String(c).padEnd(widths[i])).join(" ") + (r.length > 1 ? " " : "");
        const words = String(r[r.length - 1]).split(" ");
        let cur = head;
        for (const w of words) {
            if (cur.length + 1 + w.length > WIDTH && cur.trim() !== head.trim()) { line(cur.trimEnd()); cur = " ".repeat(head.length) + w; }
            else cur += (cur === head || cur.endsWith(" ") ? "" : " ") + w;
        }
        line(cur.trimEnd());
    }
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const grid = id => JSON.parse(fs.readFileSync(path.join(SRC, "maps", `${id}_grid.json`), "utf8"));
const xpNext = lv => 18 + 12 * lv;

// ---------------- ASCII maps ----------------
const LEGEND = {".": ".", "p": ".", "f": ".", "g": ":", "e": ":", "t": "T", "w": "~", "r": "-", "v": "|", "R": "H", "Q": "H", "W": "H", "D": "D", "#": "#", "s": "S", "+": "+", "F": "F", "B": "O", "G": "=", "E": ">", "C": "^", "k": "k"};
function asciiMap(id) {
    const g = grid(id), M = C.maps[id];
    const rows = g.chars.map(r => r.split("").map(ch => LEGEND[ch] || ch));
    const put = (x, y, ch) => { if (rows[y] && rows[y][x] !== undefined) rows[y][x] = ch; };
    (C.chests[id] || []).forEach((c, i) => put(c.x, c.y, String(i + 1)));
    for (const sid of C.spirit_order) if (C.spirits[sid].map === id) put(C.spirits[sid].x, C.spirits[sid].y, "*");
    if (M.boss) put(M.boss.x, M.boss.y, "X");
    for (const n of Object.values(C.npcs)) if (n.map === id) put(n.x, n.y, "@");
    const tens = "    " + Array.from({length: g.w}, (_, x) => (x % 10 === 0 ? String(Math.floor(x / 10)) : " ")).join("");
    const units = "    " + Array.from({length: g.w}, (_, x) => String(x % 10)).join("");
    line(tens.trimEnd());
    line(units);
    rows.forEach((r, y) => line(`${String(y).padStart(2)}  ${r.join("")}`));
    line();
}

// ---------------- the logo ----------------
// the sun ring and the name, as the title screen shows them
const LOGO = [
    '      \\   |   /       ____                        _',
    '    .-"""""""-.      / ___| _   _ _ __  ___ _ __ (_)_ __ ___',
    '   /   .---.   \\     \\___ \\| | | | \'_ \\/ __| \'_ \\| | \'__/ _ \\',
    ' - |  ( (*) )  | -    ___) | |_| | | | \\__ \\ |_) | | | |  __/',
    '   \\   \'---\'   /    |____/ \\__,_|_| |_|___/ .__/|_|_|  \\___|',
    '    \'-.......-\'                           |_|',
    '      /   |   \\                         +-----------------+',
    '                                        |    S  A  G  A   |',
    '                                        +-----------------+',
];
// ---------------- 1-5 ----------------
section("INT01", 1, "INTRODUCTION");
para("Sunspire Saga is an original homage to the handheld JRPGs of the early 2000s: a party of four elemental adepts, eight collectible spirits that boost your stats when set and power great summons when unleashed, turn-based battles, towns, shops, inns, treasure chests and a dark tower at the end of the road.");
para(`This is the engine build of the game (${pkg.name} ${pkg.version}, game data ${C.version}): the same story, maps, numbers and art as the single-script game, running on the goldensun_html5 engine. It plays in the browser, saves there, and the handheld shell around the screen works with touch.`);
para("How to use this guide: section 7 is the walkthrough in the order the game expects, with a map, the chests and the enemies of every area. Sections 8 to 13 are reference lists. Map coordinates are (x,y): x counts tiles from the left edge and y from the top, both from 0; the rulers on the maps show them.");
para("This file is generated from the game's own data by scripts/build_walkthrough.js, so every number and position in it is the one the game uses.");

section("VER02", 2, "VERSION HISTORY");
table([["Guide", "Date", "Game", "Notes"], ["-----", "----", "----", "-----"], [GUIDE_VERSION, TODAY, C.version + " engine", "generated from the game data"], ["1.x", "2025-2026", "V31-V48", "hand-written, for the single-script game"]], [6, 11, 12, 46]);
line();

section("STO03", 3, "STORY");
para("The Sunspire, the great tower north of the village of Thera, has gone dark. With its light gone, monsters prowl every road and the folk of Thera and the mining town of Brindle have bolted their doors. The eight elemental spirits that once lived in the spire scattered across the land when the SHADOW WYRM took the top of the tower.");
para("Ari, a young earth adept from Thera, is sent out by the elder Sorin to gather the spirits and bring the dawn back. Along the way Ari is joined by Lyn, a water adept scouting ahead in Brindle; Bram, a fire adept and miner who knows every shaft of Brindle Mine; and Sera, a wind adept pinned down by harpies on the Sunspire Trail.");

section("CTL04", 4, "CONTROLS AND THE MENU");
sub("Keyboard");
table([["Arrow keys", "Move; move the cursor in menus"], ["Z", "A button: confirm, talk, open chests, read signs, open the menu"], ["X", "B button: cancel, back, close"], ["A / S", "L / R shoulder buttons: switch character or target"], ["Enter", "Start: the save prompt; also confirms on the title screen"], ["Backspace", "Select"], ["M", "Toggle sound"], ["F", "Immersive (full screen) mode"]], [12, 60]);
line();
sub("Touch");
para("The handheld shell around the screen has a D-pad, A, B, Select, Start and the L / R shoulders; the sound button beside the shell is the only way to unmute on a phone. The shell colour and the light / dark theme are remembered by the browser.");
sub("Interacting");
para("Face a thing and press A: villagers, signs, doors, chests, the boulder and the spire gate all respond. Spirits also respond to A: talk to one and the duel starts. Bosses start their fight the moment you talk to them. With nothing in front of you, A opens the main menu (items, psynergy, spirits, status).");
sub("Saving");
para("Press Start (Enter) and confirm to save; the save lives in this browser. The inns also save. If the party falls, you wake up in the last town you visited with everyone alive.");

section("BAS05", 5, "GAME BASICS");
sub("5.1 Levels");
para("Each character levels on their own, with the experience from every battle they survive. A new member joins at the level the story expects by then: Lyn at 3, Bram at 5, Sera at 8. Experience needed for the next level is 18 + 12 x (current level):");
const levels = [];
let total = 0;
for (let lv = 1; lv <= 12; lv++) { levels.push([lv, xpNext(lv), total]); total += xpNext(lv); }
table([["Level", "XP for next", "Total XP from level 1"], ["-----", "-----------", "---------------------"], ...levels], [6, 12, 22]);
line();
sub("5.2 Battle");
para("Turns go by agility. A plain attack does (attack - the target's defence) / 2, so steel does little to anything with a hard hide: the bosses and the spirits shrug it off, and arts (psynergy) are the answer. An art does its listed power as damage whatever the defence; area arts hit every foe. Defend halves the damage taken that turn. Fleeing from a normal battle usually works; spirits and bosses block every path.");
sub("5.3 Spirits");
para("A spirit joins you after you beat it in a duel. SET, a spirit adds to the stats of the character who holds it (" + ["hp +4", "pp +2", "attack +1", "defence +1"].join(", ") + "). In battle you can UNLEASH a set spirit for its own effect (see section 8); it then stands by, and standby spirits are what the great summons spend (section 9). After a summon the spirits set themselves again over the next turns.");
sub("5.4 Items and gear");
para("Herbs, potions, psy drops and elixirs are used from the item menu or in battle. Weapons add attack and armour adds defence; equip them from the main menu. Every character can wear everything.");
sub("5.5 Encounters");
para("Random battles happen while you walk in the fields, the mine, the trail and the spire; towns are safe. Each area has its own set of enemy groups (section 13 lists who lives where); the paddock behind the boulder in Thera Fields sends packs at any level.");
sub("5.6 Field arts");
para("Ari knows SHOVE from the start: press Q (the first psynergy shortcut) facing a loose boulder to push it one tile for 2 PP, or pick it from the psynergy menu. Walking into a loose boulder pushes it too. Boulders only move onto the tiles the ground allows.");
sub("5.7 Sprite packs");
para("Every sheet the game draws can be replaced with your own art from the play page (Load sprite pack); the pack guide page lists every slot with its size and frames.");

// ---------------- 6 characters ----------------
section("CHR06", 6, "CHARACTERS");
for (const id of C.party_order) {
    const ch = C.chars[id];
    sub(`${ch.name.toUpperCase()} - ${EL_NAME[ch.el]} adept`);
    table([["Level 1", "HP " + ch.base.hp, "PP " + ch.base.pp, "ATK " + ch.base.atk, "DEF " + ch.base.def, "AGI " + ch.base.agi], ["Per level", "+" + ch.grow.hp, "+" + ch.grow.pp, "+" + ch.grow.atk, "+" + ch.grow.def, "+" + ch.grow.agi]], [10, 8, 8, 8, 8, 8]);
    line("   Arts: " + ch.arts.map(([a, lv]) => `${C.arts[a].name} (level ${lv})`).join(", "));
    line();
}
sub("Arts");
table([["Art", "Element", "PP", "Power", "Effect"], ["---", "-------", "--", "-----", "------"], ...Object.values(C.arts).map(a => [a.name, EL_NAME[a.el], a.cost, a.heal ? "-" : a.pow, a.heal ? `heals ${a.heal >= 999 ? "fully" : a.heal + " HP"}` : a.aoe ? "all foes" : "one foe"])], [12, 8, 3, 6, 20]);
line();

// ---------------- 7 walkthrough ----------------
section("WLK07", 7, "WALKTHROUGH");
para("Map legend: . ground  : tall grass or rubble (encounters)  T tree  ~ water  - | cliff  H house  D door  F fence  # wall  S sign  + well or spring  O boulder  = gate  > exit  ^ cave mouth  @ villager  * spirit  X boss  1-9 chests (listed under each map).");
const steps = {
    fields: ["Thera is the row of houses in the middle of the fields; you start by the well (18,22). Talk to SORIN (11,21): he points you west. The shop is the house at (20,17): its door at (21,19) opens Mara's counter. The well at (15,22) restores the party.",
        "FLINT waits at (3,20), left of the houses. Talk to it to duel it: it shrugs off steel, so cast QUAKE every turn (3 casts at level 1, so an herb or a level helps). With Flint set, the boulder at (18,8) on the trail north crumbles when you talk to it.",
        "Behind the boulder is the paddock: packs roam here at any level. LYN'S COMPASS is in chest 3 at (3,3). DEW, the water spirit, skims the lake at (8,12) west of the fence. The road north at (18,0) leads to Brindle.",
        "East along the lane is Mira Farmstead: two homes, the inn (door at (44,34), 12 coins, saves the game), HOB by the hedge and a chest at (50,36)."],
    brindle: ["Brindle is the mining town north of the fields. DOV (8,9) sells iron gear and potions; the inn door is at (22,11). LYN wanders the plaza: with her compass found she asks to join - say yes. The MINER tells you about the ogre. The mine mouth is at the top of the north path, (24,1)."],
    mine: ["BRAM joins the moment you enter. The mine is a grid of galleries: GRANITE waits at (3,18) and FORGE at (12,3). Three chests sit in the galleries (see the list). The MAW OGRE squats on the SPIRE KEY in the east gallery at (25,10); beat it and the way east to the trail at (26,10) opens."],
    trail: ["SERA joins at the foot of the trail. Three terraces climb north; the gap in the lower terrace is at (8,12-13) and the gap in the upper one at (24,6-7). " + C.maps.trail.puzzle.text + " BREEZE is at (29,3) and EMBER at (28,16). The spire gate at (16,1) opens with the SPIRE KEY; the spire is through (16,0)."],
    shrine: ["The Sunspire. MIST is at (4,10), SQUALL at (22,12); the spirit spring at (3,17) restores the party, so use it before the end. The SOL BLADE is in chest 3 at (13,8). The SHADOW WYRM waits at the top, (12,2)."],
};
const bossPlan = {
    ogre: "The ogre takes half damage from steel and sweeps the whole party with SMASH about a third of its turns. Bring Lyn for CURE and let Ari and Bram cast every turn; keep everyone above 30 HP.",
    wyrm: "The wyrm shrugs off steel, breathes SHADOW FLAME on the whole party and knits its wounds twice when it is low. Rest at the spring first, set every spirit, open with the strongest summons, then arts every turn; Lyn and the potions keep the party standing.",
};
let n = 0;
for (const id of C.map_order) {
    const M = C.maps[id];
    n++;
    const code = `WLK7${String.fromCharCode(64 + n)}`;
    section(code, `7.${n}`, M.name.toUpperCase());
    asciiMap(id);
    (steps[id] || []).forEach(p => para(p));
    const chests = C.chests[id] || [];
    if (chests.length) {
        line("   Chests:");
        chests.forEach((c, i) => line(`     ${i + 1}  (${c.x},${c.y})  ${c.gold ? c.gold + " coins" : c.item ? C.items[c.item].name : c.gear ? C.gear[c.gear].name : c.name}`));
        line();
    }
    const spirits = C.spirit_order.filter(s => C.spirits[s].map === id);
    if (spirits.length) { line("   Spirits: " + spirits.map(s => `${C.spirits[s].name} (${C.spirits[s].x},${C.spirits[s].y})`).join(", ")); line(); }
    const enc = Object.entries(C.encounters).filter(([, e]) => e.maps.includes(id));
    if (enc.length) { for (const [zone, e] of enc) { wrap(`   Enemies (${zone}): ` + [...new Set(e.groups.flat())].map(k => C.enemies[k].name).join(", "), 0); } line(); }
    if (M.boss) {
        n++;
        section(`BOS7${String.fromCharCode(64 + n)}`, `7.${n}`, `BOSS: ${C.enemies[M.boss.id].name.toUpperCase()}`);
        const e = C.enemies[M.boss.id];
        table([["HP", e.hp], ["Attack", e.atk], ["Defence", "high: steel does little"], ["XP / coins", `${e.xp} / ${e.gold}`]], [12, 30]);
        line();
        para(bossPlan[M.boss.id]);
    }
}
n++;
section(`END7${String.fromCharCode(64 + n)}`, `7.${n}`, "THE ENDING");
para("With the wyrm gone, warm light floods the Sunspire and the party returns to Thera. Sorin has a last word for you, and the game can be played on from the save.");

// ---------------- 8-13 ----------------
section("SPR08", 8, "SPIRIT (DJINN) GUIDE");
table([["Spirit", "Element", "Where", "Unleash"], ["------", "-------", "-----", "-------"], ...C.spirit_order.map(s => { const d = C.spirits[s]; return [d.name, EL_NAME[d.el], `${C.maps[d.map].name} (${d.x},${d.y})`, d.desc]; })], [8, 8, 24, 36]);
line();
para("Duel stats (the spirit as an enemy):");
table([["Spirit", "HP", "ATK", "AGI", "XP", "Coins", "Note"], ["------", "--", "---", "---", "--", "-----", "----"], ...C.spirit_order.map(s => { const d = C.spirit_duels[s]; return [C.spirits[s].name, d.hp, d.atk, d.agi, d.xp, d.gold, d.double ? "acts twice a turn" : ""]; })], [8, 4, 4, 4, 4, 6, 18]);
line();

section("SUM09", 9, "SUMMON LIST");
table([["Summon", "Element", "Standby needed", "Power"], ["------", "-------", "--------------", "-----"], ...C.summons.map(s => [s.name, EL_NAME[s.el], s.need === "all" ? "one of each element" : `${s.need} ${EL_NAME[s.el].toLowerCase()}`, s.pow])], [12, 8, 20, 6]);
line();
para("A summon hits every foe for its power plus a share of each foe's maximum HP for every spirit spent, and boosts the caster afterwards.");

section("CHS10", 10, "TREASURE CHEST LIST");
for (const id of C.map_order) {
    const chests = C.chests[id] || [];
    if (!chests.length) continue;
    line(`   ${C.maps[id].name}`);
    chests.forEach((c, i) => line(`     ${i + 1}  (${String(c.x).padStart(2)},${String(c.y).padStart(2)})  ${c.gold ? c.gold + " coins" : c.item ? C.items[c.item].name : c.gear ? C.gear[c.gear].name : c.name}`));
}
line();

section("ITM11", 11, "ITEMS AND EQUIPMENT");
table([["Item", "Price", "Effect"], ["----", "-----", "------"], ...Object.values(C.items).map(it => [it.name, it.price, it.desc])], [10, 6, 40]);
line();
table([["Weapon", "ATK", "Price"], ["------", "---", "-----"], ...Object.values(C.gear).filter(g => g.kind === "wpn").map(g => [g.name, g.atk, g.price])], [14, 4, 6]);
line();
table([["Armour", "DEF", "Price"], ["------", "---", "-----"], ...Object.values(C.gear).filter(g => g.kind === "arm").map(g => [g.name, g.def, g.price])], [14, 4, 6]);
line();

section("SHP12", 12, "SHOP LISTS");
for (const [key, s] of Object.entries(C.shops)) {
    line(`   ${s.name} (${cap(key)}, keeper ${C.npcs[s.keeper].name})`);
    s.stock.forEach(([kind, k]) => { const d = kind === "item" ? C.items[k] : C.gear[k]; line(`     ${d.name.padEnd(14)} ${String(d.price).padStart(4)} coins`); });
    line();
}
para("Inns cost 12 coins at Mira Farmstead and in Brindle; both restore HP and PP and save the game.");

section("BST13", 13, "BESTIARY");
table([["Enemy", "HP", "ATK", "DEF", "AGI", "XP", "Coins", "Drop", "Where"], ["-----", "--", "---", "---", "---", "--", "-----", "----", "-----"],
    ...Object.entries(C.enemies).map(([k, e]) => { const where = Object.entries(C.encounters).filter(([, z]) => z.groups.flat().includes(k)).map(([z]) => z).join(", ") || (e.boss ? "boss" : ""); return [e.name, e.hp, e.atk, e.def, e.agi, e.xp, e.gold, e.drop ? `${(e.drop[0] === "item" ? C.items : C.gear)[e.drop[1]].name} ${Math.round(e.drop[2] * 100)}%` : e.drain ? "drains HP" : "", where]; })], [12, 4, 4, 4, 4, 4, 5, 14, 14]);
line();

section("FAQ14", 14, "FREQUENTLY ASKED QUESTIONS");
sub("Q: Steel does nothing to the spirits and bosses. Is that a bug?");
para("A: No. Their defence is far above your attack; cast arts and unleash spirits instead.");
sub("Q: Where is Lyn's compass?");
para("A: In the paddock north of the fence in Thera Fields, chest 3 at (3,3). You need Flint to break the boulder first.");
sub("Q: The gate on the trail will not open.");
para("A: The SPIRE KEY is what the Maw Ogre in Brindle Mine sits on.");
sub("Q: Is this the same game as the single-script version?");
para("A: Same story, maps, numbers and art. The engine build levels characters one by one and counts damage a little differently; this guide describes the engine build.");

section("LGL15", 15, "CREDITS AND LEGAL");
para("Sunspire Saga is original work: code, art, names, data and text, MIT licence. The engine is a fork of goldensun_html5 (MIT) on Phaser CE. It is an independent homage; it contains no assets from Nintendo or Camelot and is not affiliated with any console maker.");
para("This guide may be copied with the game.");

// ---------------- page ----------------
const toc = anchors.map(a => `   <a href="#${a.code}">${a.head.padEnd(WIDTH - 13 - a.code.length, ".")}</a> [${a.code}]`).join("\n");
const pre = out.join("\n");
for (const l of out) {
    const plain = l.replace(/<[^>]+>/g, "");
    if (plain.length > WIDTH) throw new Error(`line over ${WIDTH} columns: ${plain}`);
}
const html = `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Sunspire Saga walkthrough</title>
        <meta name="description" content="The complete walkthrough and FAQ for Sunspire Saga: every area, chest, spirit and boss, with maps and the full bestiary." />
        <meta name="theme-color" content="#100d1d" />
        <link rel="shortcut icon" type="image/x-icon" href="static/favicon.ico" />
        <script>try{var t=localStorage.getItem('sunspire_theme'),h=localStorage.getItem('sunspire_handheld'),r=document.documentElement;if(t)r.dataset.theme=t;r.dataset.themeEff=t||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(h&&/^#[0-9a-f]{6}$/i.test(h))r.style.setProperty('--hh',h)}catch(e){}</script>
        <link rel="stylesheet" href="static/site.css">
        <style>
            .guide{width:100%; max-width:960px; margin:0 auto; padding:40px 20px 0;}
            .guide h1{font-family:var(--display); font-size:clamp(32px, 4.5vw, 44px); margin:0 0 .4em;}
            .guide p{max-width:72ch; color:var(--ink-2);}
            .well{background:#fffdf7; color:#1f1a33; border:1px solid var(--line); border-radius:12px; padding:18px 20px; overflow-x:auto; box-shadow:var(--shadow);}
            .well pre{margin:0; font:13px/1.45 var(--mono); white-space:pre; tab-size:4;}
            .well a{color:#8f5f06;}
            .well b{color:#2a1a02;}
        </style>
    </head>
    <body>
        <header class="nav"><div class="wrap">
            <a class="brand" href="index.html"><img src="static/icons/sunspire-mark-512.png" alt=""><span>Sunspire Saga</span></a>
            <nav class="nav-links" aria-label="Site">
                <a href="index.html">Home</a>
                <a href="play.html">Play online</a>
                <a href="pack-guide.html">Pack guide</a>
                <a href="changelog.html">Changelog</a>
                <a href="walkthrough.html" aria-current="page">Walkthrough</a>
            </nav>
            <button class="icon-btn theme-toggle" type="button" aria-label="Toggle colour theme">
                <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
                <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>
            </button>
        </div></header>
        <main class="guide">
            <h1>Walkthrough</h1>
            <p>A classic plain-text FAQ for the whole game, generated from the game's own data. Jump to a section from the contents; the codes in brackets are stable anchors.</p>
            <div class="well"><pre>${LOGO.map(esc).join("\n")}

${esc("SUNSPIRE SAGA - FAQ / WALKTHROUGH").padStart(55)}
${esc(`Game version: ${C.version} (engine build ${pkg.version})`.padStart(55))}
${esc(`Guide version: ${GUIDE_VERSION}   Last updated: ${TODAY}`.padStart(55))}

${"=".repeat(WIDTH)}
  TABLE OF CONTENTS
${"=".repeat(WIDTH)}

${toc}

${pre}
</pre></div>
        </main>
        <footer class="foot"><div class="wrap">
            <span>Sunspire Saga &middot; original code and art, MIT licence</span>
            <span>An independent homage; no assets from Nintendo or Camelot.</span>
        </div></footer>
        <script src="static/site.js"></script>
    </body>
</html>
`;
fs.writeFileSync(path.join(ROOT, "walkthrough.html"), html);
console.log(`walkthrough.html: ${out.length} lines, ${anchors.length} sections`);
