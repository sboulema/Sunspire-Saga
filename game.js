'use strict';
// =================================================================
//  SUNSPIRE SAGA v2 - a GBA-style JRPG homage. Original content.
// =================================================================
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = 240, H = 160, T = 16;
const GAME_VERSION = 'V42';
// pages that only need the game data (pack guide, art tools) set window.SUNSPIRE_HEADLESS before loading:
// no input handlers and no main loop
const HEADLESS = !!window.SUNSPIRE_HEADLESS;

// ---------------- tiny 5x5 bitmap font ----------------
const GLYPHS = {};
(function(){
  const raw = {
    A:"01110 10001 11111 10001 10001", B:"11110 10001 11110 10001 11110",
    C:"01111 10000 10000 10000 01111", D:"11110 10001 10001 10001 11110",
    E:"11111 10000 11110 10000 11111", F:"11111 10000 11110 10000 10000",
    G:"01111 10000 10011 10001 01111", H:"10001 10001 11111 10001 10001",
    I:"11111 00100 00100 00100 11111", J:"00111 00010 00010 10010 01100",
    K:"10001 10010 11100 10010 10001", L:"10000 10000 10000 10000 11111",
    M:"10001 11011 10101 10001 10001", N:"10001 11001 10101 10011 10001",
    O:"01110 10001 10001 10001 01110", P:"11110 10001 11110 10000 10000",
    Q:"01110 10001 10101 10010 01101", R:"11110 10001 11110 10010 10001",
    S:"01111 10000 01110 00001 11110", T:"11111 00100 00100 00100 00100",
    U:"10001 10001 10001 10001 01110", V:"10001 10001 10001 01010 00100",
    W:"10001 10001 10101 11011 10001", X:"10001 01010 00100 01010 10001",
    Y:"10001 01010 00100 00100 00100", Z:"11111 00010 00100 01000 11111",
    "0":"01110 10011 10101 11001 01110","1":"00100 01100 00100 00100 01110",
    "2":"01110 10001 00110 01000 11111","3":"11110 00001 00110 00001 11110",
    "4":"00010 00110 01010 11111 00010","5":"11111 10000 11110 00001 11110",
    "6":"01110 10000 11110 10001 01110","7":"11111 00001 00010 00100 00100",
    "8":"01110 10001 01110 10001 01110","9":"01110 10001 01111 00001 01110",
    ".":"00000 00000 00000 00000 00100",",":"00000 00000 00000 00100 01000",
    "!":"00100 00100 00100 00000 00100","?":"01110 10001 00110 00000 00100",
    "'":"00100 00100 00000 00000 00000","-":"00000 00000 01110 00000 00000",
    ":":"00000 00100 00000 00100 00000","/":"00001 00010 00100 01000 10000",
    "+":"00000 00100 01110 00100 00000","(":"00010 00100 00100 00100 00010",
    ")":"01000 00100 00100 00100 01000","%":"11001 11010 00100 01011 10011",
    "*":"00100 10101 01110 10101 00100",">":"01000 00100 00010 00100 01000",
    "<":"00010 00100 01000 00100 00010","=":"00000 01110 00000 01110 00000"
  };
  for (const k in raw) GLYPHS[k] = raw[k].split(' ');
})();
// ---- pack glyph font: one image per character (uppercase 6x8, lowercase 6x6) on a shared baseline ----
const GLYPH_FILES = {}; // pack file base name (case-sensitive) -> character
for (let i = 0; i < 10; i++) GLYPH_FILES[String(i)] = String(i);
for (let i = 0; i < 26; i++){ const U = String.fromCharCode(65 + i); GLYPH_FILES[U] = U; GLYPH_FILES['lowercase-' + U.toLowerCase()] = U.toLowerCase(); }
Object.assign(GLYPH_FILES, {
  and:'&', apostrophe:"'", arrow:'\u25BC', 'arrow-left':'<', 'arrow-right':'>', at:'@', 'bracket-left':'[',
  'bracket-right':']', colin:':', colon:':', comma:',', dash:'-', dollar:'$', equals:'=', exclaimationpoint:'!',
  exclamationpoint:'!', line:'|', number:'#', parentheses1:'(', parentheses2:')', percent:'%', period:'.', plus:'+',
  questionmark:'?', quote:'"', semicolin:';', semicolon:';', slash:'/', tilde:'~', underline:'_', space:' '
});
const GLYPH_NAME_ORDER = Object.keys(GLYPH_FILES);
let USER_GLYPHS = {}, USER_GLYPH_FILES = {};
const GLYPH_TINT = new Map();
function glyphFontOn(){ for (const k in USER_GLYPHS) return true; return false; }
function setUserGlyph(base, dec){
  const ch = GLYPH_FILES[base];
  if (ch === undefined || !dec || !dec.frames.length) return false;
  const src = dec.frames[0];
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  let adv = c.width + 1; // one pixel of air after the glyph unless the image already ends in an empty column
  try { const d = x.getImageData(c.width - 1, 0, 1, c.height).data; let clear = true; for (let i = 3; i < d.length; i += 4) if (d[i] > 0){ clear = false; break; } if (clear) adv = c.width; } catch(e){}
  USER_GLYPHS[ch] = { img: c, w: c.width, h: c.height, adv, id: base };
  USER_GLYPH_FILES[base] = true;
  GLYPH_TINT.clear(); PACK_REV++;
  return true;
}
function clearGlyphs(){ USER_GLYPHS = {}; USER_GLYPH_FILES = {}; GLYPH_TINT.clear(); }
function glyphFor(ch){ return USER_GLYPHS[ch] || USER_GLYPHS[ch.toUpperCase()] || USER_GLYPHS[ch.toLowerCase()] || null; }
function glyphTinted(g, col){ // coloured UI text recolours only the light ink pixels; a glyph's dark shadow stays dark
  if (col === '#e9e0c8' || col === '#ffffff' || col === '#fff') return g.img;
  const key = g.id + '|' + col;
  let c = GLYPH_TINT.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = g.w; c.height = g.h;
  const x = c.getContext('2d'); x.drawImage(g.img, 0, 0);
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(col);
  if (m){
    try {
      const id = x.getImageData(0, 0, g.w, g.h), d = id.data, r = parseInt(m[1], 16), gr = parseInt(m[2], 16), b = parseInt(m[3], 16);
      for (let i = 0; i < d.length; i += 4){
        if (d[i+3] === 0) continue;
        const lum = (d[i] * 299 + d[i+1] * 587 + d[i+2] * 114) / 1000;
        if (lum >= 112){ d[i] = r; d[i+1] = gr; d[i+2] = b; }
      }
      x.putImageData(id, 0, 0);
    } catch(e){}
  } else { x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, g.w, g.h); }
  GLYPH_TINT.set(key, c);
  return c;
}
function text(s, x, y, col, sc){
  sc = sc || 1;
  if (glyphFontOn()){
    let cx = x; const base = y + 7 * sc; // every cell is bottom-aligned here: the last row of an 8-tall capital (its shadow row)
    for (const ch of String(s)){
      if (ch === ' '){ const sp = USER_GLYPHS[' ']; cx += (sp ? sp.adv : 4) * sc; continue; }
      const g = glyphFor(ch);
      if (g){
        ctx.drawImage(glyphTinted(g, col), cx, base + (1 - g.h) * sc, g.w * sc, g.h * sc);
        cx += g.adv * sc;
      } else { // missing glyph: the built-in 5x5 letter, sitting on the same baseline
        const bg = GLYPHS[ch.toUpperCase()];
        if (bg){ ctx.fillStyle = col; for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (bg[r][c] === '1') ctx.fillRect(cx + c*sc, base - 4*sc + r*sc, sc, sc); }
        cx += 6 * sc;
      }
    }
    return;
  }
  ctx.fillStyle = col;
  let cx = x;
  s = String(s).toUpperCase();
  for (let i = 0; i < s.length; i++){
    const g = GLYPHS[s[i]];
    if (g){
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 5; c++)
          if (g[r][c] === '1') ctx.fillRect(cx + c*sc, y + r*sc, sc, sc);
    }
    cx += 6*sc;
  }
}
function textW(s, sc){
  sc = sc || 1;
  if (glyphFontOn()){
    let w = 0;
    for (const ch of String(s)){
      if (ch === ' '){ const sp = USER_GLYPHS[' ']; w += (sp ? sp.adv : 4) * sc; continue; }
      const g = glyphFor(ch); w += (g ? g.adv : 6) * sc;
    }
    return w;
  }
  return String(s).length * 6 * sc;
}
function textC(s, cx, y, col, sc){ text(s, Math.round(cx - textW(s,sc)/2), y, col, sc); }
function textO(s, x, y, col, out, sc){
  if (!glyphFontOn()){ text(s,x-1,y,out,sc); text(s,x+1,y,out,sc); text(s,x,y-1,out,sc); text(s,x,y+1,out,sc); } // pack glyphs carry their own shadow
  text(s,x,y,col,sc);
}
function textCO(s, cx, y, col, out, sc){ textO(s, Math.round(cx - textW(s,sc)/2), y, col, out, sc); }
function wrap(s, n){
  const words = String(s).split(' '), lines = []; let cur = '';
  for (const w of words){
    if (cur && textW(cur + ' ' + w) > n * 6){ lines.push(cur); cur = w; } // n = characters of the bitmap font
    else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------- input ----------------
const held = {}, pressed = {};
const KEYMAP = {
  ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
  w:'up', s:'down', a:'left', d:'right',
  z:'a', ' ':'a', x:'b', Enter:'start', Escape:'b'
};
if (!HEADLESS) addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]')) return;
  audioInit();
  if (e.key === 'm' || e.key === 'M'){ SFX_ON = !SFX_ON; return; }
  const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase && e.key.toLowerCase()];
  if (!k) return;
  e.preventDefault();
  if (!e.repeat){ pressed[k] = true; }
  held[k] = true;
});
if (!HEADLESS) addEventListener('keyup', e => {
  const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase && e.key.toLowerCase()];
  if (k){ held[k] = false; }
});
if (!HEADLESS) addEventListener('blur', () => { for (const k in held) held[k] = false; });
if (!HEADLESS) for (const b of document.querySelectorAll('[data-k]')){
  const k = b.dataset.k;
  const dn = e => { e.preventDefault(); audioInit(); pressed[k] = true; held[k] = true; };
  const up = e => { e.preventDefault(); held[k] = false; };
  b.addEventListener('pointerdown', dn);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
}

// ---------------- audio ----------------
let AC = null, SFX_ON = true;
function audioInit(){ if (!AC){ try { AC = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){} } }
function tone(freq, dur, type, vol, slide){
  if (!AC || !SFX_ON) return;
  const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime;
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol || 0.08, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(AC.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function arp(notes, step, type, vol){
  if (!AC || !SFX_ON) return;
  notes.forEach((f, i) => setTimeout(() => tone(f, step*0.9/1000, type||'square', vol||0.07), i*step));
}
const sfx = {
  blip(){ tone(880, .05, 'square', .05); },
  ok(){ arp([660, 990], 60); },
  no(){ tone(180, .12, 'square', .07); },
  hit(){ tone(300, .15, 'sawtooth', .1, -220); },
  hurt(){ tone(140, .2, 'sawtooth', .11, -90); },
  spell(){ arp([520, 780, 1040, 1300], 45, 'triangle', .09); },
  heal(){ arp([780, 980, 1240], 70, 'sine', .09); },
  spirit(){ arp([523, 659, 784, 1046, 1318], 80, 'triangle', .09); },
  win(){ arp([523, 659, 784, 659, 1046], 95); },
  lose(){ arp([300, 240, 180, 120], 160, 'sawtooth', .08); },
  boom(){ tone(90, .5, 'sawtooth', .13, -55); },
  coin(){ arp([1180, 1560], 55, 'square', .06); },
  chest(){ arp([440, 660, 880, 1320], 70); },
  summon(){ tone(60, 1.2, 'sawtooth', .12, -20); arp([392, 523, 659, 784, 1046, 1318], 140, 'triangle', .08); }
};

// ---------------- helpers ----------------
function h32(x, y, s){
  let n = (x*374761393 + y*668265263 + (s||0)*1440662683) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}
function rnd(a, b){ return a + Math.floor(Math.random() * (b - a + 1)); }
function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
const DIRV = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
function box(x, y, w, h){
  // navy window, light frame with rounded corners, soft inner line - the classic handheld text box
  ctx.fillStyle = '#0c1248'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = '#eef0ff';
  ctx.fillRect(x + 2, y, w - 4, 1); ctx.fillRect(x + 2, y + h - 1, w - 4, 1);
  ctx.fillRect(x, y + 2, 1, h - 4); ctx.fillRect(x + w - 1, y + 2, 1, h - 4);
  ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x + w - 2, y + 1, 1, 1);
  ctx.fillRect(x + 1, y + h - 2, 1, 1); ctx.fillRect(x + w - 2, y + h - 2, 1, 1);
  ctx.fillStyle = '#4858b8';
  ctx.fillRect(x + 2, y + 2, w - 4, 1); ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
  ctx.fillRect(x + 2, y + 2, 1, h - 4); ctx.fillRect(x + w - 3, y + 2, 1, h - 4);
}
function bar(x, y, w, h, val, max, col){
  ctx.fillStyle = '#0c0a16'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x+1, y+1, Math.round((w-2) * clamp(val/max, 0, 1)), h-2);
}

// ---------------- data: elements, party, arts ----------------
const ELCOL = { earth:'#cf8c2a', fire:'#e2543a', wind:'#9b6ee0', water:'#4fa8e8', sol:'#ffd94e' };
const CHAR_DEFS = {
  ari:  { name:'ARI',  el:'earth', base:{hp:34,pp:12,atk:10,def:5,agi:8},  grow:{hp:7,pp:3,atk:3,def:1,agi:1},
          pal:{hair:'#e8b84b',skin:'#f0c090',tunic:'#3f6cd8',scarf:'#e8c84b',leg:'#6b4a2c',boot:'#4a3018'},
          arts:[['QUAKE',1],['SPIRE',4],['GAIA BLADE',8]] },
  lyn:  { name:'LYN',  el:'water', base:{hp:24,pp:16,atk:8,def:4,agi:11}, grow:{hp:5,pp:4,atk:2,def:1,agi:2},
          pal:{hair:'#c0574a',skin:'#f0c090',tunic:'#2f6a8f',scarf:'#4fa8e8',leg:'#3a4a5a',boot:'#243040'},
          arts:[['CURE',1],['ICE HORN',4],['PURE PLY',7]] },
  bram: { name:'BRAM', el:'fire',  base:{hp:36,pp:14,atk:12,def:7,agi:6}, grow:{hp:8,pp:3,atk:3,def:1,agi:1},
          pal:{hair:'#4a3524',skin:'#d9a878',tunic:'#8a3f5c',scarf:'#e2543a',leg:'#4a4438',boot:'#2c2820'},
          arts:[['FLARE',1],['FIRE BOMB',4],['INFERNO',8]] },
  sera: { name:'SERA', el:'wind',  base:{hp:26,pp:15,atk:9,def:4,agi:13}, grow:{hp:5,pp:4,atk:2,def:1,agi:2},
          pal:{hair:'#b9a8e8',skin:'#f0c090',tunic:'#5c4a8f',scarf:'#9b6ee0',leg:'#4a4460',boot:'#302c44'},
          arts:[['GUST',1],['PLASMA',5],['BOLT',8]] }
};
const ART_DEFS = {
  'QUAKE':     {cost:4,  pow:18, el:'earth', col:ELCOL.earth},
  'SPIRE':     {cost:7,  pow:36, el:'earth', col:ELCOL.earth},
  'GAIA BLADE':{cost:14, pow:64, el:'earth', col:ELCOL.earth},
  'FLARE':     {cost:4,  pow:20, el:'fire',  col:ELCOL.fire},
  'FIRE BOMB': {cost:8,  pow:22, aoe:true, el:'fire', col:ELCOL.fire},
  'INFERNO':   {cost:15, pow:40, aoe:true, el:'fire', col:ELCOL.fire},
  'CURE':      {cost:4,  heal:70, el:'heal', col:'#7cd88a'},
  'ICE HORN':  {cost:6,  pow:34, el:'water', col:ELCOL.water},
  'PURE PLY':  {cost:10, heal:999, el:'heal', col:'#7cd88a'},
  'GUST':      {cost:3,  pow:16, el:'wind',  col:ELCOL.wind},
  'PLASMA':    {cost:9,  pow:28, aoe:true, el:'wind', col:ELCOL.wind},
  'BOLT':      {cost:12, pow:58, el:'wind',  col:ELCOL.wind}
};

// ---------------- data: gear, items, shops, chests ----------------
const GEAR_DEFS = {
  wood:   {kind:'wpn', name:'WOOD BLADE',   atk:3,  price:20},
  bronze: {kind:'wpn', name:'BRONZE SWORD', atk:7,  price:80},
  iron:   {kind:'wpn', name:'IRON AXE',     atk:12, price:180},
  steel:  {kind:'wpn', name:'STEEL RAPIER', atk:16, price:480},
  sol:    {kind:'wpn', name:'SOL BLADE',    atk:24, price:999},
  vest:   {kind:'arm', name:'TRAVEL VEST',  def:2,  price:18},
  leather:{kind:'arm', name:'LEATHER MAIL', def:4,  price:70},
  chain:  {kind:'arm', name:'CHAIN MAIL',   def:6,  price:160},
  aegis:  {kind:'arm', name:'AEGIS PLATE',  def:9,  price:380}
};
const ITEM_DEFS = {
  herb:  {name:'HERB',     price:12, heal:60},
  potion:{name:'POTION',   price:70, heal:220},
  pdrop: {name:'PSY DROP', price:40, pp:30},
  elixir:{name:'ELIXIR',   price:90, revive:true}
};
const SHOPS = {
  thera:   { keeper:'MARA',  stock:[['item','herb'],['item','pdrop'],['gear','wood'],['gear','bronze'],['gear','vest'],['gear','leather']] },
  brindle: { keeper:'DOV',   stock:[['item','herb'],['item','potion'],['item','pdrop'],['item','elixir'],['gear','iron'],['gear','chain'],['gear','aegis']] }
};
const CHEST_DEFS = {
  'fields:32,11': {gold:25},
  'fields:50,36': {item:'potion'},
  'fields:3,3':   {flag:'compass', name:"LYN'S COMPASS"},
  'mine:4,3':     {gear:'bronze'},
  'mine:24,18':   {gold:60},
  'mine:13,12':   {item:'pdrop'},
  'trail:12,4':   {gear:'chain'},
  'trail:25,16':  {item:'potion'},
  'shrine:2,2':   {gear:'steel'},
  'shrine:23,2':  {item:'elixir'},
  'shrine:13,8':  {gear:'sol'}
};

// ---------------- data: spirits and summons ----------------
const SPIRIT_DEFS = {
  flint:  {el:'earth', name:'FLINT',   pow:32},
  granite:{el:'earth', name:'GRANITE', pow:48},
  forge:  {el:'fire',  name:'FORGE',   pow:40},
  ember:  {el:'fire',  name:'EMBER',   pow:56},
  dew:    {el:'water', name:'DEW',     heal:.55},
  mist:   {el:'water', name:'MIST',    healAll:.35},
  breeze: {el:'wind',  name:'BREEZE',  pow:24, stun:true},
  squall: {el:'wind',  name:'SQUALL',  pow:22, aoe:true}
};
const SPIRIT_ORDER = ['flint','granite','forge','ember','dew','mist','breeze','squall'];
const SUMMON_DEFS = [
  {name:'GNOME',     el:'earth', need:1, pow:50},
  {name:'TITAN',     el:'earth', need:2, pow:110},
  {name:'SALAMAND',  el:'fire',  need:1, pow:56},
  {name:'PHOENIX',   el:'fire',  need:2, pow:120},
  {name:'NIXIE',     el:'water', need:1, pow:40, healAll:.3},
  {name:'LEVIATH',   el:'water', need:2, pow:104},
  {name:'SYLPH',     el:'wind',  need:1, pow:46, stun:true},
  {name:'TEMPEST',   el:'wind',  need:2, pow:112},
  {name:'SOL AVATAR',el:'sol',   need:'all', pow:200}
];

// ---------------- data: enemies and encounters ----------------
const ENEMY_DEFS = {
  ooze:    {name:'MIRE OOZE',  hp:22, atk:9,  def:2,  agi:5,  xp:8,  gold:7,  drop:['item','herb',.2]},
  bat:     {name:'DUSK BAT',   hp:18, atk:10, def:2,  agi:13, xp:10, gold:8,  drain:true},
  wolf:    {name:'FANG WOLF',  hp:24, atk:11, def:3,  agi:10, xp:14, gold:12, drop:['item','herb',.18]},
  spider:  {name:'PIT SPIDER', hp:28, atk:11, def:4,  agi:9,  xp:13, gold:11},
  beetle:  {name:'ORE BEETLE', hp:80, atk:26, def:10, agi:4,  xp:24, gold:17, drop:['gear','vest',.08]},
  golem:   {name:'RUIN GOLEM', hp:108,atk:30, def:11, agi:3,  xp:33, gold:24, drop:['item','pdrop',.15]},
  harpy:   {name:'CRAG HARPY', hp:100,atk:30, def:9,  agi:14, xp:30, gold:20, drop:['item','herb',.15]},
  boar:    {name:'IRON BOAR',  hp:130,atk:34, def:12, agi:7,  xp:36, gold:24, drop:['gear','leather',.07]},
  shade:   {name:'PALE SHADE', hp:120,atk:38, def:11, agi:11, xp:44, gold:28, drain:true},
  gargoyle:{name:'GARGOYLE',   hp:160,atk:42, def:16, agi:8,  xp:54, gold:34, drop:['item','potion',.15]},
  ogre:    {name:'MAW OGRE',   hp:650,atk:42, def:10, agi:6,  xp:150, gold:200, boss:true, phys:.5},
  wyrm:    {name:'SHADOW WYRM',hp:1200,atk:56,def:13, agi:9,  xp:0,  gold:0,  boss:true, phys:.45},
  djinn_battle_flint:  {name:'FLINT',   hp:70,  atk:14, def:5,  agi:10, xp:24, gold:12, noflee:true, phys:.3},
  djinn_battle_dew:    {name:'DEW',     hp:120, atk:20, def:6,  agi:12, xp:30, gold:14, noflee:true, phys:.3},
  djinn_battle_granite:{name:'GRANITE', hp:220, atk:34, def:11, agi:8,  xp:40, gold:24, noflee:true, phys:.3},
  djinn_battle_forge:  {name:'FORGE',   hp:200, atk:35, def:10, agi:11, xp:40, gold:24, noflee:true, phys:.3},
  djinn_battle_breeze: {name:'BREEZE',  hp:380, atk:46, def:9,  agi:16, xp:55, gold:30, noflee:true, phys:.3, double:true},
  djinn_battle_ember:  {name:'EMBER',   hp:420, atk:50, def:11, agi:12, xp:60, gold:30, noflee:true, phys:.3, double:true},
  djinn_battle_mist:   {name:'MIST',    hp:520, atk:56, def:11, agi:13, xp:70, gold:36, noflee:true, phys:.3, double:true},
  djinn_battle_squall: {name:'SQUALL',  hp:480, atk:54, def:10, agi:17, xp:70, gold:36, noflee:true, phys:.3, double:true}
};
const ENC = {
  field: [['ooze'],['ooze'],['wolf'],['bat'],['spider'],['ooze','ooze'],['ooze','bat'],['wolf','ooze'],['spider','bat']],
  paddock:[['wolf','ooze'],['wolf','wolf'],['spider','bat'],['wolf','spider'],['spider','spider'],['ooze','ooze','bat']], // Thera Fields behind the boulder
  mine:  [['beetle'],['golem'],['beetle','beetle'],['bat','bat','bat'],['golem','beetle'],['spider','spider'],['golem','bat','bat']],
  trail: [['harpy'],['boar'],['harpy','harpy'],['boar','wolf'],['harpy','boar'],['harpy','bat','bat']],
  shrine:[['shade'],['gargoyle'],['shade','shade'],['gargoyle','shade'],['shade','bat','bat'],['gargoyle','gargoyle']]
};

// ---------------- map palettes ----------------
const PALS = {
  field: {grs:'#4f9b3f', grsD:'#468f38', grsL:'#57a746', pth:'#d3b26a', pthD:'#c2a057', scr:'#3d8531', scrL:'#5cb14a',
          clifT:'#a89a6e', clifF:'#6e6248', clifD:'#544a34'},
  town:  {grs:'#4f9b3f', grsD:'#468f38', grsL:'#57a746', pth:'#b8a98e', pthD:'#a3947a', scr:'#3d8531', scrL:'#5cb14a',
          clifT:'#a89a6e', clifF:'#6e6248', clifD:'#544a34'},
  trail: {grs:'#8f9a4a', grsD:'#7f8a3e', grsL:'#a0ab58', pth:'#c9a05f', pthD:'#b58f4e', scr:'#6e7a35', scrL:'#8a9848',
          clifT:'#b0a074', clifF:'#75664a', clifD:'#5a4e36'},
  mine:  {flr:'#4a3b32', flrD:'#40332b', wal:'#2e241c', walT:'#463830', mos:'#4a5a3a', mosL:'#5e7048'},
  shrine:{flr:'#3b3752', flrD:'#332f49', wal:'#241f38', walT:'#332c4e', mos:'#37504a', mosL:'#4a6e5e'}
};

// ---------------- map builders ----------------
const SOLID = new Set(['t','w','r','v','B','R','Q','W','D','#','s','G','k','F']);
function makeGrid(w, h, fill){
  const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill(fill)); return g;
}
function house(g, x, y, doorOff){ // 3 rows: roof, eave, wall
  for (let i = 0; i < 3; i++){ g[y][x+i] = 'R'; g[y+1][x+i] = 'Q'; g[y+2][x+i] = 'W'; }
  g[y+2][x+doorOff] = 'D';
}
function buildFields(){
  const w = 58, h = 40, g = makeGrid(w, h, '.');
  for (let y = 0; y < h; y++){ g[y][0] = 't'; g[y][w-1] = 't'; }
  for (let x = 0; x < w; x++) g[h-1][x] = 't';
  for (let y = 1; y <= 24; y++) g[y][18] = 'p';               // sunspire trail
  for (let x = 0; x < w; x++){ g[0][x] = 't'; g[1][x] = 'F'; } // north fence
  g[0][18] = 'p'; g[1][18] = 'p';
  for (let x = 1; x <= 34; x++) g[8][x] = 'F';                 // the paddock fence
  for (let y = 2; y <= 7; y++){ g[y][1] = 'F'; g[y][34] = 'F'; }
  g[7][18] = 'p'; g[8][18] = 'B';                              // boulder chokepoint
  for (let y = 10; y <= 14; y++) for (let x = 2; x <= 7; x++) g[y][x] = 'w'; // Lake Mira
  g[11][8] = 'w'; g[13][8] = 'w';
  for (let y = 2; y < h-1; y++) for (let x = 1; x < w-1; x++){
    if (g[y][x] !== '.') continue;
    const hh = h32(x, y, 7);
    if (y <= 6 && x <= 34){ if (hh % 8 === 0) g[y][x] = 't'; else if (hh % 3 === 0) g[y][x] = 'g'; }
    else if (y <= 16 && x <= 34){ if (hh % 9 === 0) g[y][x] = 't'; else if (hh % 5 === 0) g[y][x] = 'g'; }
    else if (y >= 23 || x >= 36){ if (hh % 11 === 0) g[y][x] = 't'; else if (hh % 6 === 0) g[y][x] = 'g'; } // open meadow
    else { if (hh % 12 === 0) g[y][x] = 't'; }
  }
  house(g, 6, 17, 1); house(g, 12, 17, 1); house(g, 20, 17, 1);
  for (let x = 2; x <= 33; x++) if (g[21][x] !== 'p') g[21][x] = '.';  // village lane
  for (let y = 20; y <= 22; y++) for (let x = 9; x <= 24; x++) if (g[y][x] !== 'p') g[y][x] = '.';
  for (let y = 19; y <= 21; y++) for (let x = 2; x <= 4; x++) if (g[y][x] !== 'p') g[y][x] = '.';
  for (let x = 8; x <= 33; x++) g[12][x] = '.';                        // lakeside clearing
  for (let y = 2; y <= 6; y++) g[y][18] = 'p';
  g[22][15] = '+';   // well, set back from the trail path
  g[20][20] = 's';   // signpost
  g[11][32] = 'k';   // chest
  g[3][3] = 'k';     // Lyn's compass, in the paddock behind the boulder
  g[4][3] = '.';
  for (let x = 3; x <= 17; x++) if (g[4][x] === 't') g[4][x] = '.';
  // the road east to Mira Farmstead: two homes, the inn, and a yard to wander
  for (let x = 34; x <= 44; x++) g[21][x] = 'p';
  for (let y = 22; y <= 30; y++) g[y][44] = 'p';
  for (let y = 30; y <= 37; y++) for (let x = 37; x <= 51; x++) if (g[y][x] !== 'p') g[y][x] = '.';
  for (let y = 26; y <= 29; y++) for (let x = 39; x <= 49; x++) if (g[y][x] !== 'p') g[y][x] = '.';
  house(g, 40, 27, 1); house(g, 46, 27, 1); house(g, 43, 32, 1);
  g[35][40] = 's';   // farmstead signpost
  g[36][50] = 'k';   // a chest by the east hedge
  const houses = [
    {x:6,  y:17, id:'thera_1',     use:'home'},
    {x:12, y:17, id:'thera_2',     use:'home'},
    {x:20, y:17, id:'thera_shop',  use:'shop', shop:'thera'},
    {x:40, y:27, id:'thera_far_1', use:'home'},
    {x:46, y:27, id:'thera_far_2', use:'home'},
    {x:43, y:32, id:'thera_far_inn', use:'inn'}
  ];
  return { w, h, g, kind:'field', name:'THERA FIELDS', houses };
}
function buildBrindle(){
  const w = 30, h = 20, g = makeGrid(w, h, '.');
  for (let y = 0; y < h; y++){ g[y][0] = 't'; g[y][w-1] = 't'; }
  for (let x = 0; x < w; x++) g[h-1][x] = 't';
  g[h-1][15] = 'p';
  for (let x = 0; x < w; x++){ g[0][x] = 'r'; g[1][x] = 'v'; }
  g[1][24] = 'C';                                            // mine mouth
  for (let y = 2; y < h-1; y++) for (let x = 1; x < w-1; x++){
    if (g[y][x] !== '.') continue;
    if (h32(x, y, 5) % 10 === 0) g[y][x] = 't';
  }
  house(g, 5, 5, 1); house(g, 11, 5, 1); house(g, 18, 5, 1);
  const houses = [
    {x:5,  y:5, id:'brindle_1',   use:'home'},
    {x:11, y:5, id:'brindle_2',   use:'home'},
    {x:18, y:5, id:'brindle_3',   use:'home'},
    {x:21, y:9, id:'brindle_inn', use:'inn'}
  ];
  for (let y = 8; y <= 12; y++) for (let x = 3; x <= 26; x++) g[y][x] = '.';
  for (let y = 8; y <= 18; y++) g[y][15] = 'p';
  for (let y = 2; y <= 8; y++) g[y][24] = 'p';
  for (let x = 15; x <= 24; x++) g[8][x] = 'p';
  g[10][12] = 's';   // sign
  house(g, 21, 9, 1);     // the inn, stamped after the plaza clears
  return { w, h, g, kind:'town', name:'BRINDLE', houses };
}
function buildMine(){
  const w = 28, h = 22, g = makeGrid(w, h, 'f');
  for (let x = 0; x < w; x++){ g[0][x] = '#'; g[h-1][x] = '#'; }
  for (let y = 0; y < h; y++){ g[y][0] = '#'; g[y][w-1] = '#'; }
  for (let y = 4; y <= 17; y++){ if (y !== 10 && y !== 11){ g[y][7] = '#'; g[y][21] = '#'; } }
  for (let y = 1; y <= 8; y++){ if (y !== 9){ g[y][14] = '#'; } }
  for (let y = 13; y <= 20; y++) g[y][14] = '#';
  for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++){
    if (g[y][x] === 'f' && h32(x, y, 3) % 3 === 0) g[y][x] = 'e';
  }
  for (let x = 1; x <= 26; x++){ g[10][x] = 'f'; g[11][x] = 'f'; }
  g[9][25] = '#'; g[11][25] = '#'; g[9][26] = '#'; g[11][26] = '#';
  g[10][26] = 'C';                    // east exit to the trail
  g[3][4] = 'k'; g[18][24] = 'k'; g[12][13] = 'k';
  g[20][2] = 'E';                     // way back to Brindle
  return { w, h, g, kind:'mine', name:'BRINDLE MINE' };
}
function buildTrail(){
  const w = 32, h = 20, g = makeGrid(w, h, '.');
  for (let y = 0; y < h; y++){ g[y][0] = 't'; g[y][w-1] = 't'; }
  for (let x = 0; x < w; x++) g[h-1][x] = 't';
  for (let x = 0; x < w; x++){ g[0][x] = 'r'; g[1][x] = 'v'; }
  g[0][16] = 'p'; g[1][16] = 'G';                              // the spire gate
  for (let x = 1; x <= 30; x++){ g[6][x] = 'r'; g[7][x] = 'v'; }  // band A
  g[6][24] = 'p'; g[7][24] = 'p';
  for (let x = 1; x <= 30; x++){ g[12][x] = 'r'; g[13][x] = 'v'; } // band B
  g[12][8] = 'p'; g[13][8] = 'p';
  for (let y = 2; y < h-1; y++) for (let x = 1; x < w-1; x++){
    if (g[y][x] !== '.') continue;
    const hh = h32(x, y, 11);
    if (hh % 10 === 0) g[y][x] = 't'; else if (hh % 4 === 0) g[y][x] = 'g';
  }
  for (let x = 2; x <= 29; x++){ g[3][x] = (g[3][x]==='p')?'p':'.'; g[4][x] = '.'; }
  for (let x = 2; x <= 29; x++){ g[9][x] = '.'; g[10][x] = '.'; }
  for (let x = 2; x <= 29; x++){ g[15][x] = '.'; g[16][x] = '.'; }
  g[2][16] = '.'; g[5][24] = '.'; g[8][24] = '.'; g[11][8] = '.'; g[14][8] = '.';
  g[4][12] = 'k'; g[16][25] = 'k';
  g[10][1] = 'E';                                               // back into the mine
  return { w, h, g, kind:'trail', name:'SUNSPIRE TRAIL' };
}
function buildShrine(){
  const w = 26, h = 22, g = makeGrid(w, h, 'f');
  for (let x = 0; x < w; x++){ g[0][x] = '#'; g[h-1][x] = '#'; }
  for (let y = 0; y < h; y++){ g[y][0] = '#'; g[y][w-1] = '#'; }
  for (let x = 1; x <= 24; x++){ if (x !== 12 && x !== 13) g[5][x] = '#'; }
  for (let y = 7; y <= 16; y++){ g[y][6] = '#'; g[y][19] = '#'; }
  for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++){
    if (g[y][x] === 'f' && h32(x, y, 13) % 3 === 0) g[y][x] = 'e';
  }
  for (let y = 19; y <= 20; y++) for (let x = 2; x <= 23; x++) g[y][x] = 'f';
  for (let y = 6; y <= 20; y++){ g[y][12] = 'f'; g[y][13] = 'f'; }
  for (let x = 7; x <= 18; x++){ g[8][x] = 'f'; g[9][x] = 'f'; }
  for (let y = 1; y <= 4; y++) for (let x = 1; x <= 24; x++) if (g[y][x] === '#' && y !== 0) g[y][x] = 'f';
  for (let y = 6; y <= 18; y++){ g[y][2] = 'f'; g[y][3] = 'f'; g[y][22] = 'f'; g[y][23] = 'f'; }
  g[17][3] = '+';                       // spirit spring
  g[2][2] = 'k'; g[2][23] = 'k'; g[8][13] = 'k';
  g[21][12] = 'E';                      // way out
  return { w, h, g, kind:'shrine', name:'THE SUNSPIRE' };
}
const BUILDERS = { fields:buildFields, brindle:buildBrindle, mine:buildMine, trail:buildTrail, shrine:buildShrine };
const TRANS = {
  fields: [{x:18,y:0,  to:'brindle', tx:15, ty:17, dir:'up'}],
  brindle:[{x:15,y:19, to:'fields',  tx:18, ty:2,  dir:'down'},
           {x:24,y:1,  to:'mine',    tx:2,  ty:19, dir:'up'}],
  mine:   [{x:2, y:20, to:'brindle', tx:24, ty:3,  dir:'down'},
           {x:26,y:10, to:'trail',   tx:2,  ty:10, dir:'right'}],
  trail:  [{x:1, y:10, to:'mine',    tx:24, ty:10, dir:'left'},
           {x:16,y:0,  to:'shrine',  tx:12, ty:19, dir:'up'}],
  shrine: [{x:12,y:21, to:'trail',   tx:16, ty:2,  dir:'down'}]
};

// ---------------- game state ----------------
const MAPS = {};
let G = null;
function makeMember(id, lv){
  const d = CHAR_DEFS[id], b = d.base, gr = d.grow, n = lv - 1;
  return {
    id, name: d.name, el: d.el, pal: d.pal,
    maxhp: b.hp + gr.hp*n, hp: b.hp + gr.hp*n,
    maxpp: b.pp + gr.pp*n, pp: b.pp + gr.pp*n,
    atk: b.atk + gr.atk*n, def: b.def + gr.def*n, agi: b.agi + gr.agi*n,
    wpn: null, arm: null, ko: false, defending: false
  };
}
function newGame(){
  for (const k in BUILDERS) MAPS[k] = BUILDERS[k]();
  G = {
    mode:'title', t:0, mapId:'fields', map: MAPS.fields,
    player:{ tx:18, ty:22, px:18*T, py:22*T, dir:'up', moving:false },
    lv:1, xp:0, party:[ makeMember('ari', 1) ], gold:30,
    inv:{ herb:3 }, gear:[],
    spirits:{}, flags:{}, chests:{},
    wins:0, steps:0, sinceFight:0,
    dialog:null, menu:null, shop:null, battle:null, shake:0, fade:0, toast:null
  };
  G.party[0].wpn = 'wood';
  applyFlagsToMaps();
  initNpcs();
}
function xpNext(lv){ return 18 + lv*12; }
function spiritsFound(){ return SPIRIT_ORDER.filter(k => G.spirits[k]); }
function setCount(){
  if (G.battle) return SPIRIT_ORDER.filter(k => G.battle.sstate[k] === 'set').length;
  return spiritsFound().length;
}
function eAtk(m){ return m.atk + (m.wpn ? GEAR_DEFS[m.wpn].atk : 0) + setCount(); }
function eDef(m){ return m.def + (m.arm ? GEAR_DEFS[m.arm].def : 0) + setCount(); }
function aliveMembers(){ return G.party.filter(m => !m.ko); }
function applyFlagsToMaps(){
  if (G.flags.boulder) MAPS.fields.g[8][18] = 'p';
  if (G.flags.gateOpen) MAPS.trail.g[1][16] = 'p';
}
function saveGame(){
  try {
    const s = {
      lv:G.lv, xp:G.xp, gold:G.gold, inv:G.inv, gear:G.gear,
      spirits:G.spirits, flags:G.flags, chests:G.chests,
      wins:G.wins, steps:G.steps, mapId:G.mapId,
      px:G.player.tx, py:G.player.ty,
      party:G.party.map(m => ({id:m.id, hp:m.hp, pp:m.pp, wpn:m.wpn, arm:m.arm}))
    };
    localStorage.setItem('sunspire2', JSON.stringify(s));
    return true;
  } catch(e){ return false; }
}
function hasSave(){ try { return !!localStorage.getItem('sunspire2'); } catch(e){ return false; } }
function loadGame(){
  try {
    const s = JSON.parse(localStorage.getItem('sunspire2'));
    newGame();
    G.lv = s.lv; G.xp = s.xp; G.gold = s.gold; G.inv = s.inv; G.gear = s.gear;
    G.spirits = s.spirits; G.flags = s.flags; G.chests = s.chests;
    G.wins = s.wins; G.steps = s.steps;
    G.party = s.party.map(p => {
      const m = makeMember(p.id, G.lv);
      m.hp = Math.min(p.hp, m.maxhp); m.pp = Math.min(p.pp, m.maxpp);
      m.wpn = p.wpn; m.arm = p.arm;
      return m;
    });
    G.mapId = s.mapId; G.map = MAPS[s.mapId];
    const P = G.player;
    P.tx = s.px; P.ty = s.py; P.px = s.px*T; P.py = s.py*T; P.dir = 'down'; P.moving = false;
    applyFlagsToMaps();
    G.mode = 'world'; G.fade = 16; G.flags.intro = true;
    return true;
  } catch(e){ return false; }
}
function toast(msg){ G.toast = { msg, t: 90 }; }

// ---------------- entities ----------------
const NPC_DEFS = {
  elder: { map:'fields',  x:11, y:21, wander:false },
  mara:  { map:'fields',  x:16, y:20, wander:true, r:3 },
  polly: { map:'fields',  x:24, y:21, wander:true, r:2 },
  dov:   { map:'brindle', x:8,  y:9,  wander:false },
  miner: { map:'brindle', x:20, y:11, wander:true, r:2 },
  ina:   { map:'brindle', x:24, y:13, wander:true, r:2 },
  lyn:   { map:'brindle', x:13, y:10, wander:true, r:3 },
  hob:   { map:'fields',  x:48, y:35, wander:true, r:3 }
};
function initNpcs(){
  G.npcs = {};
  for (const id in NPC_DEFS){
    const d = NPC_DEFS[id];
    G.npcs[id] = { tx:d.x, ty:d.y, px:d.x*T, py:d.y*T, dir:'down', moving:false, next:rnd(60, 240) };
  }
}
function npcWalkable(x, y){
  const ch = tileAt(x, y);
  if (SOLID.has(ch) || ch === 'C' || ch === 'E' || ch === '+') return false;
  if (G.player.tx === x && G.player.ty === y) return false;
  if (entityAt(x, y)) return false;
  return true;
}
function npcUpdate(){
  for (const id in G.npcs){
    const n = G.npcs[id], d = NPC_DEFS[id];
    if (G.map !== MAPS[d.map]) continue;
    if (n.moving){
      const gx = n.tx*T, gy = n.ty*T, sp = 1;
      if (n.px < gx) n.px = Math.min(gx, n.px + sp);
      if (n.px > gx) n.px = Math.max(gx, n.px - sp);
      if (n.py < gy) n.py = Math.min(gy, n.py + sp);
      if (n.py > gy) n.py = Math.max(gy, n.py - sp);
      if (n.px === gx && n.py === gy){ n.moving = false; n.next = rnd(90, 300); }
      continue;
    }
    if (!d.wander) continue;
    if (--n.next > 0) continue;
    n.next = rnd(90, 300);
    const dir = ['up','down','left','right'][rnd(0, 3)];
    n.dir = dir;
    const nx = n.tx + DIRV[dir][0], ny = n.ty + DIRV[dir][1];
    if (Math.abs(nx - d.x) > (d.r || 2) || Math.abs(ny - d.y) > (d.r || 2)) continue;
    if (!npcWalkable(nx, ny)) continue;
    n.tx = nx; n.ty = ny; n.moving = true;
  }
}
function entitiesFor(map){
  const es = [];
  if (G.npcs)
    for (const id in G.npcs){
      if (MAPS[NPC_DEFS[id].map] !== map) continue;
      if (id === 'lyn' && G.flags.lyn) continue;
      es.push({ type:'npc', id, x: G.npcs[id].tx, y: G.npcs[id].ty });
    }
  if (map === MAPS.fields){
    if (!G.spirits.flint) es.push({ type:'spirit', id:'flint', x:3, y:20 });
    if (!G.spirits.dew)   es.push({ type:'spirit', id:'dew',   x:8, y:12 });
  } else if (map === MAPS.brindle){
  } else if (map === MAPS.mine){
    if (!G.spirits.granite) es.push({ type:'spirit', id:'granite', x:3,  y:18 });
    if (!G.spirits.forge)   es.push({ type:'spirit', id:'forge',   x:12, y:3 });
    if (!G.flags.ogre) es.push({ type:'boss', id:'ogre', x:25, y:10 });
  } else if (map === MAPS.trail){
    if (!G.spirits.breeze) es.push({ type:'spirit', id:'breeze', x:29, y:3 });
    if (!G.spirits.ember)  es.push({ type:'spirit', id:'ember',  x:28, y:16 });
  } else if (map === MAPS.shrine){
    if (!G.spirits.mist)   es.push({ type:'spirit', id:'mist',   x:4,  y:10 });
    if (!G.spirits.squall) es.push({ type:'spirit', id:'squall', x:22, y:12 });
    if (!G.flags.bossDown){ es.push({ type:'boss', id:'wyrm', x:12, y:2 }); es.push({ type:'boss', id:'wyrm', x:13, y:2, ghost:true }); }
  }
  return es;
}
function entityAt(x, y){
  for (const e of entitiesFor(G.map)) if (e.x === x && e.y === y) return e;
  return null;
}

// ---------------- dialog ----------------
function say(lines, cb){
  let all = [];
  for (const l of lines) all = all.concat(wrap(l, 35));
  const pages = [];
  for (let i = 0; i < all.length; i += 3) pages.push(all.slice(i, i+3));
  G.dialog = { pages, page:0, chars:0, cb: cb || null };
}
function ask(lines, onYes, onNo){
  say(lines);
  G.dialog.choice = { sel: 0, onYes, onNo };
}
function dialogUpdate(){
  const d = G.dialog;
  const full = d.pages[d.page].join('\n').length;
  if (d.chars < full) d.chars += 2;
  if (d.choice && d.page === d.pages.length - 1 && d.chars >= full){
    if (pressed.up || pressed.down){ d.choice.sel = 1 - d.choice.sel; sfx.blip(); }
    if (pressed.a || pressed.start){
      sfx.ok(); G.dialog = null;
      const fn = d.choice.sel === 0 ? d.choice.onYes : d.choice.onNo;
      if (fn) fn();
    }
    return;
  }
  if (pressed.a || pressed.start){
    sfx.blip();
    if (d.chars < full) d.chars = full;
    else if (d.page < d.pages.length - 1){ d.page++; d.chars = 0; }
    else { G.dialog = null; if (d.cb) d.cb(); }
  }
}
function dialogDraw(){
  const d = G.dialog;
  box(6, 110, 228, 46);
  const lines = d.pages[d.page];
  let left = d.chars;
  for (let i = 0; i < lines.length; i++){
    const seg = lines[i].slice(0, Math.max(0, left));
    left -= lines[i].length + 1;
    text(seg, 14, 118 + i*11, '#e9e0c8');
  }
  const full = lines.join('\n').length;
  if (d.choice && d.page === d.pages.length - 1 && d.chars >= full){
    const opts = ['YES', 'NO'], slots = ['choice_yes', 'choice_no'];
    const cell = iconCell(slots, 24), rowH = Math.max(11, cell.h + 1); // grows for big pack icons
    const bw = 14 + cell.w + 4 + textW('YES') + 8, bh = 2*rowH + 5, bx = 232 - bw, by = 109 - bh;
    box(bx, by, bw, bh);
    for (let i = 0; i < 2; i++){
      const cy = by + 3 + i*rowH + (rowH >> 1);
      if (i === d.choice.sel) drawCursor(bx + 13, cy);
      drawIconFit(slots[i], bx + 14 + cell.w/2, cy, cell.w, cell.h);
      text(opts[i], bx + 14 + cell.w + 4, cy - cursorRowY(0), i === d.choice.sel ? '#f2c14e' : '#e9e0c8');
    }
  } else if (d.chars >= full && (G.t >> 4) % 2 === 0){
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(222, 148, 4, 2); ctx.fillRect(223, 150, 2, 2);
  }
}

// ---------------- tiles (semi-3D) ----------------
function tileAt(x, y){
  if (x < 0 || y < 0 || x >= G.map.w || y >= G.map.h) return '#';
  return G.map.g[y][x];
}
function pal(){ return PALS[G.map.kind] || PALS.field; }
function drawGroundBase(px, py, x, y){
  const P = pal(), hh = h32(x, y, 1);
  if (P.flr){ // dungeon floor
    ctx.fillStyle = P.flr; ctx.fillRect(px, py, T, T);
    ctx.fillStyle = P.flrD;
    ctx.fillRect(px, py + 15, T, 1); ctx.fillRect(px + (x%2?0:8), py, 1, T);
  } else {
    const trail = G.map.kind === 'trail';
    const gv = grassVariants(trail);
    if (gv.length){
      const f = sprFrame(userSpr(gv[h32(x, y, 17) % gv.length])).img;
      ctx.drawImage(f, px, py, T, T);
      return;
    }
    const c = owCanvas(hh % 3 === 0 ? 'grass_b' : 'grass_a', trail ? GRASS_COLS.trail : GRASS_COLS.field);
    ctx.drawImage(c, px, py);
  }
}
let GRASS_MEMO = { rev: -1, trail: [], other: [] };
function grassVariants(trail){
  if (GRASS_MEMO.rev !== PACK_REV){
    const t = [], g = [];
    for (const k in USER_SPR){
      if (!userSpr(k)) continue;
      const parts = k.split('_');
      if (parts[0] !== 'grass') continue;
      if (parts.length > 1 && parts[1] === 'trail') t.push(k); else g.push(k);
    }
    t.sort(); g.sort();
    GRASS_MEMO = { rev: PACK_REV, trail: t, other: g };
  }
  if (trail && GRASS_MEMO.trail.length) return GRASS_MEMO.trail;
  return GRASS_MEMO.other;
}
function drawTile(ch, x, y){
  const px = x*T, py = y*T, hh = h32(x, y, 1), P = pal();
  if ('.gs+BkfeE'.indexOf(ch) >= 0) drawGroundBase(px, py, x, y);
  switch(ch){
    case 'g': {
      ctx.fillStyle = P.scr;
      ctx.fillRect(px+2, py+6, 2, 8); ctx.fillRect(px+6, py+3, 2, 11);
      ctx.fillRect(px+10, py+7, 2, 7); ctx.fillRect(px+13, py+4, 2, 10);
      ctx.fillStyle = P.scrL;
      ctx.fillRect(px+4, py+9, 1, 5); ctx.fillRect(px+8, py+6, 1, 8); ctx.fillRect(px+12, py+10, 1, 4);
      break;
    }
    case 'p': {
      ctx.fillStyle = P.pth; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = P.pthD;
      ctx.fillRect(px + (hh % 10), py + ((hh>>3) % 12), 3, 2);
      ctx.fillRect(px + ((hh>>6) % 12), py + ((hh>>1) % 10), 2, 2);
      break;
    }
    case 'w': {
      ctx.fillStyle = '#2e5fa8'; ctx.fillRect(px, py, T, T);
      const ph = (G.t >> 4) % 2;
      ctx.fillStyle = '#4a7fc9';
      ctx.fillRect(px + 2 + ph*2 + (hh % 4), py + 4, 5, 1);
      ctx.fillRect(px + 8 - ph*2, py + 11, 5, 1);
      if (tileAt(x, y-1) !== 'w'){ ctx.fillStyle = '#8fc4e8'; ctx.fillRect(px, py, T, 2); }
      break;
    }
    case 'r': { // cliff top
      ctx.fillStyle = P.clifT || '#a89a6e'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = P.clifD || '#544a34';
      ctx.fillRect(px + (hh % 9), py + 3 + (hh % 7), 3, 1);
      ctx.fillRect(px + ((hh>>5) % 11), py + 10, 2, 1);
      if (tileAt(x, y-1) !== 'r'){ ctx.fillStyle = '#cabf95'; ctx.fillRect(px, py, T, 2); }
      break;
    }
    case 'v': { // cliff face
      ctx.fillStyle = P.clifF || '#6e6248'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = P.clifD || '#544a34';
      ctx.fillRect(px + 3 + (hh % 6), py + 2, 1, 12);
      ctx.fillRect(px + 10 + (hh % 4), py + 5, 1, 9);
      ctx.fillStyle = '#cabf95'; ctx.fillRect(px, py, T, 1);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(px, py + 13, T, 3);
      break;
    }
    case 'C': { // cave / mine mouth set into a cliff face
      ctx.fillStyle = P.clifF || '#6e6248'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#0c0a14'; ctx.fillRect(px+3, py+4, 10, 12);
      ctx.fillStyle = '#3a3020'; ctx.fillRect(px+2, py+3, 12, 2);
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(px+7, py+1, 2, 1);
      break;
    }
    case 'B': {
      ctx.fillStyle = '#7a7884'; ctx.fillRect(px+2, py+3, 12, 12);
      ctx.fillRect(px+4, py+1, 8, 2); ctx.fillRect(px+1, py+6, 14, 7);
      ctx.fillStyle = '#9b99a6'; ctx.fillRect(px+4, py+3, 5, 4);
      ctx.fillStyle = '#55535f'; ctx.fillRect(px+4, py+12, 9, 3);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(px+2, py+14, 12, 2);
      break;
    }
    case 'R': {
      ctx.fillStyle = '#b0523a'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#93412c'; ctx.fillRect(px, py+6, T, 2);
      ctx.fillStyle = '#c96a4e'; ctx.fillRect(px, py, T, 2);
      break;
    }
    case 'Q': {
      ctx.fillStyle = '#9c4531'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#833623';
      ctx.fillRect(px, py+4, T, 2);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(px, py+14, T, 2);
      break;
    }
    case 'W': {
      ctx.fillStyle = '#cbb089'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(px, py, T, 3);
      ctx.fillStyle = '#b39a74'; ctx.fillRect(px, py+9, T, 1);
      if (hh % 2 === 0){ ctx.fillStyle = '#5a4a6e'; ctx.fillRect(px+6, py+5, 4, 4);
        ctx.fillStyle = '#8fc4e8'; ctx.fillRect(px+7, py+6, 2, 2); }
      break;
    }
    case 'D': {
      ctx.fillStyle = '#cbb089'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(px, py, T, 3);
      ctx.fillStyle = '#6a4526'; ctx.fillRect(px+3, py+4, 10, 12);
      ctx.fillStyle = '#8a5c33'; ctx.fillRect(px+4, py+5, 8, 11);
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(px+10, py+10, 1, 2);
      break;
    }
    case 's': {
      ctx.fillStyle = '#7a5a33'; ctx.fillRect(px+7, py+7, 2, 9);
      ctx.fillStyle = '#a8804d'; ctx.fillRect(px+2, py+2, 12, 6);
      ctx.fillStyle = '#5b4022'; ctx.fillRect(px+4, py+4, 8, 1); ctx.fillRect(px+4, py+6, 6, 1);
      break;
    }
    case '+': {
      const wv = wellSpringVariants(P.flr ? 'spring' : 'well');
      if (wv.length){
        const wf = sprFrame(userSpr(wv[h32(x, y, 13) % wv.length])).img;
        ctx.drawImage(wf, Math.round(px + 8 - wf.width/2), py + 16 - wf.height);
        break;
      }
      if (P.flr){
        ctx.fillStyle = '#2e6fa8'; ctx.fillRect(px+2, py+3, 12, 11);
        ctx.fillStyle = '#57c8e8'; ctx.fillRect(px+4, py+5, 8, 7);
        ctx.fillStyle = '#c8f4ff'; ctx.fillRect(px + 5 + ((G.t>>3)%4), py + 6 + ((G.t>>4)%3), 2, 1);
      } else {
        ctx.fillStyle = '#8d8c96'; ctx.fillRect(px+2, py+3, 12, 11);
        ctx.fillStyle = '#2e5fa8'; ctx.fillRect(px+4, py+5, 8, 7);
        ctx.fillStyle = '#7fd0ff'; ctx.fillRect(px + 5 + ((G.t>>4)%3), py+7, 3, 1);
        ctx.fillStyle = '#5b4a33'; ctx.fillRect(px+7, py, 2, 3);
      }
      break;
    }
    case 'e': {
      ctx.fillStyle = P.mos || '#37504a';
      ctx.fillRect(px+3, py+4, 4, 3); ctx.fillRect(px+9, py+9, 5, 3); ctx.fillRect(px+5, py+11, 3, 2);
      ctx.fillStyle = P.mosL || '#4a6e5e'; ctx.fillRect(px+4, py+5, 2, 1); ctx.fillRect(px+10, py+10, 2, 1);
      break;
    }
    case '#': {
      ctx.fillStyle = P.wal || '#241f38'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = P.walT || '#332c4e'; ctx.fillRect(px, py, T, 5);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(px, py+10, T, 1); ctx.fillRect(px + (y%2?4:11), py+5, 1, 5);
      if (G.map.kind === 'mine' && hh % 5 === 0){
        ctx.fillStyle = '#e8c84b'; ctx.fillRect(px + (hh%10), py + 6 + (hh%6), 2, 2);
      }
      break;
    }
    case 'E': {
      ctx.fillStyle = '#0c0a14'; ctx.fillRect(px+2, py, 12, T);
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(px+7, py+13, 2, 1);
      break;
    }
    case 'G': { // sealed spire gate
      ctx.fillStyle = P.clifF || '#6e6248'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#8d8c96'; ctx.fillRect(px+2, py+1, 12, 15);
      ctx.fillStyle = '#55535f'; ctx.fillRect(px+4, py+3, 8, 13);
      ctx.fillStyle = ((G.t>>4)%2===0) ? '#ffd94e' : '#c9a02a';
      ctx.fillRect(px+7, py+7, 2, 2); ctx.fillRect(px+6, py+9, 4, 1);
      break;
    }
    case 'k': {
      const open = chestLidOpen(G.mapId + ':' + x + ',' + y, 1500);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(px+2, py+13, 12, 2);
      ctx.fillStyle = '#7a4a22'; ctx.fillRect(px+2, py+5, 12, 9);
      ctx.fillStyle = open ? '#3a2410' : '#9c6430';
      ctx.fillRect(px+2, py+3, 12, 4);
      ctx.fillStyle = '#f2c14e';
      if (!open){ ctx.fillRect(px+7, py+6, 2, 3); ctx.fillRect(px+2, py+7, 12, 1); }
      else { ctx.fillRect(px+2, py+2, 12, 1); }
      break;
    }
  }
}

// ---------------- sprites ----------------
let TINT = null;
function P4(c, x, y, w, h){ ctx.fillStyle = TINT || c; ctx.fillRect(x, y, w, h); }
function drawShadow(x, y){
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x+4, y+14, 8, 2);
}
const NPC_PALS = {
  elder: { hair:'#e8e4da', skin:'#e6b98e', tunic:'#7a6fa8', scarf:'#b9b0d8', leg:'#5a5470', boot:'#3a3550' },
  mara:  { hair:'#7a4a22', skin:'#f0c090', tunic:'#c0574a', scarf:'#e8c84b', leg:'#8a4438', boot:'#4a3018' },
  dov:   { hair:'#4a4a52', skin:'#d9a878', tunic:'#5a6a3a', scarf:'#c9a02a', leg:'#4a4438', boot:'#2c2820' },
  miner: { hair:'#2c2820', skin:'#d9a878', tunic:'#8a6a3a', scarf:'#b0a074', leg:'#5a4a33', boot:'#3a3020' },
  polly: { hair:'#6a3a1c', skin:'#f0c090', tunic:'#4a8a4a', scarf:'#e8c84b', leg:'#5a4a33', boot:'#3a3020' },
  ina:   { hair:'#1c1c28', skin:'#e8b890', tunic:'#2f8a8f', scarf:'#c8f4ff', leg:'#4a4460', boot:'#302c44' },
  hob:   { hair:'#8a6a3a', skin:'#e6b98e', tunic:'#6a7a3a', scarf:'#c9a05a', leg:'#5a4a33', boot:'#3a3020' }
};
// ---------------- overworld pixel sprites ----------------
// Character grids use symbolic keys resolved against a palette:
// o outline, e eyes, h hair, H hair shade, s skin, S skin shade,
// t tunic, T tunic shade, c scarf, l legs, b boots/belt.
const OW_GRIDS = {
hero_down: [
".....oooooo.....",
"...oohhhhhhoo...",
"..ohhhhhhhhhho..",
"..ohhhhhhhhhHo..",
".ohhhhhhhhhhHHo.",
".ohhhhhhhhhhHHo.",
".ohHssssssssHho.",
".ohsseesseessho.",
"..ohssssssssho..",
"..oSssssssssSo..",
"....osssso......",
"...occccccco....",
"..otttttttttTo..",
".osotttttttToso.",
".osotttttttToso.",
".osoTttttttToso.",
"..oobbbbbbbboo..",
"...otttttttTo...",
"...ollo..ollo...",
"...ollo..ollo...",
"...ollo..ollo...",
"...obbo..obbo...",
],
hero_down2: [
".....oooooo.....",
"...oohhhhhhoo...",
"..ohhhhhhhhhho..",
"..ohhhhhhhhhHo..",
".ohhhhhhhhhhHHo.",
".ohhhhhhhhhhHHo.",
".ohHssssssssHho.",
".ohsseesseessho.",
"..ohssssssssho..",
"..oSssssssssSo..",
"....osssso......",
"...occccccco....",
"..otttttttttTo..",
".osotttttttToso.",
".osotttttttToso.",
".osoTttttttToso.",
"..oobbbbbbbboo..",
"...otttttttTo...",
"..ollo...ollo...",
"..ollo...ollo...",
"..obbo...ollo...",
".........obbo...",
],
hero_up: [
".....oooooo.....",
"...oohhhhhhoo...",
"..ohhhhhhhhhho..",
"..ohhhhhhhhhho..",
".ohhhhhhhhhhhho.",
".ohhhhhhhhhhhho.",
".ohhhhhhhhhhhho.",
".ohhhhhhhhhhhho.",
"..ohhHHHHHHhho..",
"..oHHHHHHHHHHo..",
"....osssso......",
"...occccccco....",
"..oTttttttttto..",
".osoTtttttttoso.",
".osoTtttttttoso.",
".osoTtttttttoso.",
"..oobbbbbbbboo..",
"...oTttttttto...",
"...ollo..ollo...",
"...ollo..ollo...",
"...ollo..ollo...",
"...obbo..obbo...",
],
hero_up2: [
".....oooooo.....",
"...oohhhhhhoo...",
"..ohhhhhhhhhho..",
"..ohhhhhhhhhho..",
".ohhhhhhhhhhhho.",
".ohhhhhhhhhhhho.",
".ohhhhhhhhhhhho.",
".ohhhhhhhhhhhho.",
"..ohhHHHHHHhho..",
"..oHHHHHHHHHHo..",
"....osssso......",
"...occccccco....",
"..oTttttttttto..",
".osoTtttttttoso.",
".osoTtttttttoso.",
".osoTtttttttoso.",
"..oobbbbbbbboo..",
"...oTttttttto...",
"..ollo...ollo...",
"..ollo...ollo...",
"..obbo...ollo...",
".........obbo...",
],
hero_right: [
".....oooooo.....",
"...oohhhhhhoo...",
"..ohhhhhhhhhho..",
"..ohhhhhhhhhHo..",
".ohhhhhhhhhhhHo.",
".ohhhhhhhhhhhHo.",
".ohhhhssssssso..",
".ohhhssssseeso..",
".oHhhssssssso...",
"..oHHsssssSo....",
".....ossso......",
"...occccccco....",
"..ottttttttTo...",
"..otttttostTo...",
"..otttttostTo...",
"..oTttttostTo...",
"...obbbbbbbo....",
"...ottttttto....",
"....ollollo.....",
"....ollollo.....",
"....ollollo.....",
"....obbobbo.....",
],
hero_right2: [
".....oooooo.....",
"...oohhhhhhoo...",
"..ohhhhhhhhhho..",
"..ohhhhhhhhhHo..",
".ohhhhhhhhhhhHo.",
".ohhhhhhhhhhhHo.",
".ohhhhssssssso..",
".ohhhssssseeso..",
".oHhhssssssso...",
"..oHHsssssSo....",
".....ossso......",
"...occccccco....",
"..ottttttttTo...",
"..otttttostTo...",
"..otttttostTo...",
"..oTttttostTo...",
"...obbbbbbbo....",
"...ottttttto....",
"...ollo.ollo....",
"...ollo..ollo...",
"...obbo..ollo...",
".........obbo...",
],
djinn: [
".....ooo......",
"....occco.....",
"...occccco.oo.",
"..ocwwcccooco.",
"..ocwkccccoco.",
"..occccccccco.",
"..occcccccco..",
"...occcccco...",
"....oczzco....",
".....oooo.....",
],
tree: [
".....oooooo.....",
"...oogggggoo....",
"..oggLLgggggo...",
".ogLLLgggggggo..",
".ogLLgggggggggo.",
"ogLggggggggGggo.",
"oggggggggggGGgo.",
"ogggggggggGGggo.",
"oggggGGgggggggo.",
".oggGGGGgggggo..",
".ogggggggggggo..",
"..oGGgggggGGo...",
"...ooGGGGGoo....",
".....okkko......",
".....okkko......",
".....oKkko......",
".....oKkko......",
"....ooKkkoo.....",
],
wyrm_s: [
"...oo........oo.......",
"..ohho......ohho......",
"..ohoooooooooho.......",
"...oaaaaaaaaao........",
"..oaeeaaaaaeeao.......",
"..oaeeaaaaaeeao.......",
"...oarrrrrrrao........",
"....oaaaaaaao.........",
"...oabbbbbbaao........",
"..oabbllllbbaao.......",
".oabbllllllbbao.......",
".oablloooollbao.......",
".oablo....olbao.......",
".oabo......obao.......",
"oaabooooooooobaao.....",
"oaaabbbbbbbbbaao......",
".oaaaaaaaaaaaao.......",
"..oooooooooooo........",
],
ogre_s: [
"....ooooo....okko.",
"...oghhhgo...okko.",
"..oghhhhhgo..okko.",
"..ogrhhhrgo..okko.",
"..oghhhhhgo..okko.",
"..ogwhhhwgo..okko.",
"...ogggggo...okko.",
".ooogggggooo.okko.",
"oggggggggggggokko.",
"oghhhhhhhhhggokko.",
"oghhhhhhhhhggkko..",
"odghhhhhhhggoko...",
"odggggggggggo.....",
".odggbbbbggdo.....",
"..oggbkkbggo......",
"..odggggggdo......",
"..oddo..oddo......",
"..oooo..oooo......",
],
};
// ---- unique overworld spirit sprites (original designs) ----
const DJ_GRIDS = {
dj_flint: [
"......oo......",
".....ohho.....",
"....obbbbo....",
"..oobbbbbboo..",
".obbwwbbwwbbo.",
".obbwkbbwkbbo.",
".obbbbbbbbbbo.",
".obdbbbbbbdbo.",
"..obbddddbbo..",
"...oobbbboo...",
".....oooo.....",
],
dj_granite: [
"..oooooooooo..",
".oddddddddddo.",
".obbwkbbwkbbo.",
".obbbbbbbbbbo.",
".obbbddddbbbo.",
".obbbbbbbbbbo.",
".odbbbbbbbbdo.",
"..oobbbbbboo..",
"...odo..odo...",
"...ooo..ooo...",
],
dj_forge: [
"......oo......",
".....offo.....",
"....offffo....",
"...offaaffo...",
"..offaaaaffo..",
".offaayyaaffo.",
".ofaykwwkyafo.",
".offayyyyaffo.",
"..offaaaaffo..",
"...offffffo...",
"....oofoo.....",
],
dj_ember: [
"..ooooo.......",
".odddddoo..oo.",
".odwkwkdo.ofo.",
".oddddddooafo.",
".odrrrrdoaafo.",
"..odddddofao..",
"...oooooofo...",
"........oo....",
],
dj_dew: [
"......oo......",
".....obbo.....",
"....obbllo....",
"...obbbbllo...",
"..obbbbbbllo..",
".obbwkbbwkbbo.",
".obbbbbbbbbbo.",
".olbbbbbbbblo.",
"..olbbbbbblo..",
"...oolbbloo...",
".....oooo.....",
],
dj_mist: [
"....oooo......",
"..oobbbboo....",
".obbbbbbbboo..",
"obbwkbbwkbbbo.",
"obbbbbbbbbbbbo",
"..oobbbboo.oo.",
"....oooo..obo.",
"...........o..",
],
dj_breeze: [
"..oo......oo..",
".ovvo....ovvo.",
".ovvvo..ovvvo.",
"..ovvvoovvvo..",
"...ovdddvvo...",
"...odwkdddo...",
"...odddddo....",
"....oddo......",
".....obo......",
"......o.......",
],
dj_squall: [
"..ooooooooo...",
".ovvvvvvvvvo..",
".ovwkvvwkvvo..",
"..ovvvvvvvo...",
"...odddddo....",
"...ovvvvvo....",
"....odddo.....",
".....ovvo.....",
"......oo......",
],
};
const DJ_PALS = {
flint:  { o:'#241a08', b:'#cf8c2a', d:'#9a6420', h:'#ffe9a0', w:'#ffffff', k:'#241a08' },
granite:{ o:'#1a1a14', b:'#a89a6e', d:'#6e6248', w:'#ffffff', k:'#14140e' },
forge:  { o:'#2b0c04', f:'#e2543a', a:'#ff9a4e', y:'#ffd94e', w:'#ffffff', k:'#2b1408' },
ember:  { o:'#1c0f08', d:'#4a3a33', r:'#ff6a3a', f:'#e2543a', a:'#ffd94e', w:'#ffffff', k:'#140a06' },
dew:    { o:'#0a2238', b:'#4fa8e8', l:'#c8f4ff', w:'#ffffff', k:'#0a2238' },
mist:   { o:'#223044', b:'#8fb8d0', w:'#ffffff', k:'#1a2a3c' },
breeze: { o:'#241a38', v:'#9b6ee0', d:'#d0c0f0', b:'#b99ae8', w:'#ffffff', k:'#241a38' },
squall: { o:'#241a38', v:'#9b6ee0', d:'#b99ae8', w:'#ffffff', k:'#241a38' },
};
Object.assign(OW_GRIDS, DJ_GRIDS);
const OW_CACHE = {};
function shade(hex, f){
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
function owCanvas(gridName, map){
  const key = gridName + '|' + Object.values(map).join(',');
  if (OW_CACHE[key]) return OW_CACHE[key];
  const rows = OW_GRIDS[gridName];
  let w = 0;
  for (const row of rows) w = Math.max(w, row.length);
  const c = document.createElement('canvas');
  c.width = w; c.height = rows.length;
  const x = c.getContext('2d');
  for (let ry = 0; ry < rows.length; ry++){
    for (let rx = 0; rx < rows[ry].length; rx++){
      const ch = rows[ry][rx];
      if (ch === '.') continue;
      const col = map[ch];
      if (!col) continue;
      x.fillStyle = col;
      x.fillRect(rx, ry, 1, 1);
    }
  }
  OW_CACHE[key] = c;
  return c;
}
function drawHero(x, y, dir, step, pal){
  pal = pal || CHAR_DEFS.ari.pal;
  const flip = dir === 'left';
  const base = (flip ? 'right' : dir);
  const grid = 'hero_' + base + (step ? '2' : '');
  const map = {
    o:'#1c1428', e:'#2b2b40',
    h:pal.hair, H:shade(pal.hair, .72),
    s:pal.skin, S:shade(pal.skin, .8),
    t:pal.tunic, T:shade(pal.tunic, .72),
    c:pal.scarf, l:pal.leg, b:pal.boot,
    m:'#c9ced8', y:'#ffd94e'
  };
  const frame = base + (step ? '2' : '');
  const u = (pal.id && userSpr(pal.id + '_' + frame)) || userSpr('hero_' + frame);
  if (u){
    const ui = sprFrame(u).img;
    const dy = y + 16 - ui.height;
    if (flip){
      ctx.save(); ctx.scale(-1, 1);
      ctx.drawImage(ui, -Math.round(x + 8 + ui.width/2), dy);
      ctx.restore();
    } else ctx.drawImage(ui, Math.round(x + 8 - ui.width/2), dy);
    return;
  }
  const c = owCanvas(grid, map);
  const oy = y + 16 - c.height;
  if (flip){
    ctx.save(); ctx.translate(x + 16, oy); ctx.scale(-1, 1);
    ctx.drawImage(c, 0, 0);
    ctx.restore();
  } else ctx.drawImage(c, x, oy);
}
function drawSpiritSprite(id, x, y, t){
  const bob = Math.round(Math.sin(t/14) * 2);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x+5, y+13, 6, 2);
  const u = userSpr('djinn_' + id) || userSpr('djinn');
  if (u){
    const f = sprFrame(u).img;
    ctx.drawImage(f, Math.round(x + 8 - f.width/2), y + 13 - f.height + bob);
  } else {
    const c = owCanvas('dj_' + id, DJ_PALS[id]);
    ctx.drawImage(c, Math.round(x + 8 - c.width/2), y + 13 - c.height + bob);
  }
  const sp = (t >> 3) % 4;
  ctx.fillStyle = '#fff8d0';
  if (sp === 0) ctx.fillRect(x+2, y+2+bob, 1, 1);
  if (sp === 2) ctx.fillRect(x+13, y+4+bob, 1, 1);
}
const HOUSE_IDS = ['thera_1','thera_2','thera_shop','thera_far_1','thera_far_2','thera_far_inn','brindle_1','brindle_2','brindle_3','brindle_inn'];
const HOUSE_KINDS = ['inn','shop'];
let HOUSE_MEMO = { rev: -1 };
function houseMemo(){
  if (HOUSE_MEMO.rev !== PACK_REV){
    const m = { rev: PACK_REV, byId: {}, kind: { inn: [], shop: [] }, generic: [], any: false };
    for (const k in USER_SPR){
      if (!userSpr(k)) continue;
      if (k === 'house'){ m.generic.push(k); m.any = true; continue; }
      if (k.indexOf('house_') !== 0) continue;
      m.any = true;
      const rest = k.slice(6);
      if (HOUSE_IDS.indexOf(rest) >= 0){ m.byId[rest] = k; continue; }
      const first = rest.split('_')[0];
      if (HOUSE_KINDS.indexOf(first) >= 0){ m.kind[first].push(k); continue; }
      m.generic.push(k);
    }
    m.generic.sort(); m.kind.inn.sort(); m.kind.shop.sort();
    HOUSE_MEMO = m;
  }
  return HOUSE_MEMO;
}
function drawHousePlaque(h){
  if (h.use !== 'inn' && h.use !== 'shop') return;
  const px = h.x*T + 3, py = h.y*T + 35;
  ctx.fillStyle = '#5b4022'; ctx.fillRect(px + 4, py - 2, 2, 2);
  ctx.fillStyle = h.use === 'inn' ? '#2f6a8f' : '#7a4a22';
  ctx.fillRect(px, py, 10, 8);
  ctx.fillStyle = '#f2c14e';
  if (h.use === 'inn'){ ctx.fillRect(px+2, py+4, 6, 2); ctx.fillRect(px+2, py+2, 2, 2); }
  else { ctx.fillRect(px+3, py+2, 4, 4); ctx.fillRect(px+4, py+1, 2, 1); }
}
function drawHouse(h){
  const m = houseMemo();
  let key = m.byId[h.id];
  if (!key){
    const pool = (h.use !== 'home' && m.kind[h.use] && m.kind[h.use].length) ? m.kind[h.use]
               : m.generic;
    if (pool.length) key = pool[h32(h.x, h.y, 7) % pool.length];
  }
  if (key){
    const f = sprFrame(userSpr(key)).img;
    ctx.drawImage(f, Math.round(h.x*T + 24 - f.width/2), h.y*T + 48 - f.height);
    return;
  }
  for (let dy = 0; dy < 3; dy++)
    for (let dx = 0; dx < 3; dx++)
      drawTile(tileAt(h.x + dx, h.y + dy), h.x + dx, h.y + dy);
  drawHousePlaque(h);
}
let BOULDER_MEMO = { rev: -1, list: [] };
function boulderVariants(){
  if (BOULDER_MEMO.rev !== PACK_REV){
    const l = [];
    for (const k in USER_SPR){
      if (!userSpr(k)) continue;
      if (k === 'boulder' || k.indexOf('boulder_') === 0) l.push(k);
    }
    l.sort();
    BOULDER_MEMO = { rev: PACK_REV, list: l };
  }
  return BOULDER_MEMO.list;
}
function drawBoulderSpr(px, py){
  const vars = boulderVariants();
  if (!vars.length) return;
  const key = vars[h32(px >> 4, py >> 4, 9) % vars.length];
  const f = sprFrame(userSpr(key)).img;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(px + 2, py + 14, 12, 2);
  ctx.drawImage(f, Math.round(px + 8 - f.width/2), py + 16 - f.height);
}
let WELL_MEMO = { rev: -1, well: [], spring: [] };
function wellSpringVariants(kind){
  if (WELL_MEMO.rev !== PACK_REV){
    const w = [], s = [];
    for (const k in USER_SPR){
      if (!userSpr(k)) continue;
      if (k === 'well' || k.indexOf('well_') === 0) w.push(k);
      else if (k === 'spring' || k.indexOf('spring_') === 0) s.push(k);
    }
    w.sort(); s.sort();
    WELL_MEMO = { rev: PACK_REV, well: w, spring: s };
  }
  return WELL_MEMO[kind];
}
function drawWellSpr(px, py){ // pack well / spring, bottom-anchored and free to be wider or taller than its tile
  const wv = wellSpringVariants(pal().flr ? 'spring' : 'well');
  if (!wv.length) return;
  const wf = sprFrame(userSpr(wv[h32(px >> 4, py >> 4, 13) % wv.length])).img;
  ctx.drawImage(wf, Math.round(px + 8 - wf.width/2), py + 16 - wf.height);
}
let CHEST_MEMO = { rev: -1, closed: [], open: [] };
function chestVariants(open){
  if (CHEST_MEMO.rev !== PACK_REV){
    const c = [], op = [];
    for (const k in USER_SPR){
      if (!userSpr(k)) continue;
      if (k !== 'chest' && k.indexOf('chest_') !== 0) continue;
      const parts = k.split('_');
      if (parts[1] === 'open') op.push(k); else c.push(k);
    }
    c.sort(); op.sort();
    CHEST_MEMO = { rev: PACK_REV, closed: c, open: op };
  }
  return open ? CHEST_MEMO.open : CHEST_MEMO.closed;
}
function chestOpenMs(key){ // ms since this chest was looted in this session, or -1
  if (!G.chests[key] || !G.chestT || G.chestT[key] === undefined) return -1;
  return (G.t - G.chestT[key]) * 1000 / 60;
}
function chestLidOpen(key, ms){ const t = chestOpenMs(key); return t >= 0 && t < ms; }
function drawChestSpr(px, py){
  const tx = px >> 4, ty = py >> 4, key = G.mapId + ':' + tx + ',' + ty;
  let f = null;
  const ms = chestOpenMs(key), op = chestVariants(true);
  if (ms >= 0 && op.length){
    const u = userSpr(op[h32(tx, ty, 15) % op.length]);
    const dur = u.frames.length > 1 ? u.total : 1500;
    if (ms < dur) f = sprFrameAt(u, ms).img;
  }
  if (!f){
    const pool = chestVariants(false);
    if (!pool.length){ drawTile('k', tx, ty); return; }
    f = sprFrame(userSpr(pool[h32(tx, ty, 15) % pool.length])).img;
  }
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(px + 2, py + 13, 12, 2);
  ctx.drawImage(f, Math.round(px + 8 - f.width/2), py + 16 - f.height);
}
let SIGN_MEMO = { rev: -1, list: [] };
function signVariants(){
  if (SIGN_MEMO.rev !== PACK_REV){
    const l = [];
    for (const k in USER_SPR){
      if (!userSpr(k)) continue;
      if (k === 'sign' || k.indexOf('sign_') === 0) l.push(k);
    }
    l.sort();
    SIGN_MEMO = { rev: PACK_REV, list: l };
  }
  return SIGN_MEMO.list;
}
function drawSignSpr(px, py){
  const vars = signVariants();
  if (!vars.length) return;
  const key = vars[h32(px >> 4, py >> 4, 11) % vars.length];
  const f = sprFrame(userSpr(key)).img;
  ctx.drawImage(f, Math.round(px + 8 - f.width/2), py + 16 - f.height);
}
let TREE_MEMO = { rev: -1, trail: [], other: [] };
function treeVariants(trail){
  if (TREE_MEMO.rev !== PACK_REV){
    const t = [], g = [];
    for (const k in USER_SPR){
      if (!userSpr(k)) continue;
      const parts = k.split('_');
      if (parts[0] !== 'tree') continue;
      if (parts.length > 1 && parts[1] === 'trail') t.push(k); else g.push(k);
    }
    t.sort(); g.sort();
    TREE_MEMO = { rev: PACK_REV, trail: t, other: g };
  }
  if (trail && TREE_MEMO.trail.length) return TREE_MEMO.trail;
  return TREE_MEMO.other;
}
const FENCE_MAP = { o:'#2a1a0c', W:'#c9955a', w:'#a0703c', d:'#6e4a24' };
function fenceKind(x, y){
  const L = tileAt(x-1, y) === 'F', R = tileAt(x+1, y) === 'F';
  const U = tileAt(x, y-1) === 'F', D = tileAt(x, y+1) === 'F';
  const hc = (L ? 1 : 0) + (R ? 1 : 0), vc = (U ? 1 : 0) + (D ? 1 : 0);
  if (hc === 2) return { k: 'h' };
  if (hc === 1 && vc) return { k: 'h', clip: L ? 'left' : 'right', U, D };
  if (hc === 1) return { k: 'post', flip: R };
  if (vc) return { k: h32(x, y, 19) % 3 === 0 ? 'v2' : 'v' };
  return { k: 'post' };
}
function drawFence(x, y){
  const px = x*T, py = y*T, f = fenceKind(x, y);
  const u = userSpr('fence_' + f.k);
  ctx.save();
  if (f.clip){
    ctx.beginPath();
    if (f.clip === 'left') ctx.rect(px, py - 32, 9, 48); else ctx.rect(px + 2, py - 32, 14, 48);
    ctx.clip();
  }
  let dx = px;
  if (f.flip){ ctx.translate(px + 16, 0); ctx.scale(-1, 1); dx = 0; }
  if (u){
    const img = sprFrame(u).img;
    ctx.drawImage(img, Math.round(dx + 8 - img.width/2), py + 16 - img.height);
  } else {
    const c = owCanvas('fence_' + f.k, FENCE_MAP);
    ctx.drawImage(c, dx, py + 16 - c.height);
    if (f.clip){ // plank stubs joining the vertical run above / below the corner
      const stub = (y0, h) => {
        ctx.fillStyle = FENCE_MAP.W; ctx.fillRect(dx + 6, y0, 1, h);
        ctx.fillStyle = FENCE_MAP.w; ctx.fillRect(dx + 7, y0, 1, h);
        ctx.fillStyle = FENCE_MAP.o; ctx.fillRect(dx + 8, y0, 1, h);
      };
      if (f.U) stub(py, 4);
      if (f.D) stub(py + 13, 3);
    }
  }
  ctx.restore();
}
function drawTree(px, py){
  const trail = G.map.kind === 'trail';
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(px+3, py+13, 10, 2);
  const vars = treeVariants(trail);
  if (vars.length){
    const key = vars[h32(px >> 4, py >> 4, 5) % vars.length];
    const f = sprFrame(userSpr(key)).img;
    ctx.drawImage(f, Math.round(px + 8 - f.width/2), py + 16 - f.height);
    return;
  }
  const map = trail
    ? { o:'#2c3012', g:'#6e7a35', G:'#55682c', L:'#8a9848', k:'#5b3d22', K:'#3a2612' }
    : { o:'#14280f', g:'#2e6e2c', G:'#245c24', L:'#3f8a38', k:'#5b3d22', K:'#3a2612' };
  const c = owCanvas('tree', map);
  ctx.drawImage(c, px, py + 16 - c.height);
}
function drawWyrmSmall(x, y, t){
  const bob = (t >> 5) % 2;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x+4, y+13, 24, 3);
  const u = userSpr('wyrm_s');
  if (u){
    const f = sprFrame(u).img;
    ctx.drawImage(f, Math.round(x + 16 - f.width/2), y + 15 - f.height - bob);
    return;
  }
  const map = { o:'#0c0818', h:'#1a1528', a:'#2c2440', b:'#453a66', l:'#574a78', e:'#ffd94e', r:'#c94a3a' };
  const c = owCanvas('wyrm_s', map);
  ctx.drawImage(c, x + 5, y - 3 - bob);
}
function drawOgreSmall(x, y, t){
  const bob = (t >> 5) % 2;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x+2, y+13, 13, 3);
  const u = userSpr('ogre_s');
  if (u){
    const f = sprFrame(u).img;
    ctx.drawImage(f, Math.round(x + 8 - f.width/2), y + 15 - f.height - bob);
    return;
  }
  const map = { o:'#101408', g:'#5a7a3a', h:'#6e9048', d:'#4a6430', r:'#c94a3a', w:'#e8e4da', k:'#7a5a33', b:'#8a6a3a' };
  const c = owCanvas('ogre_s', map);
  ctx.drawImage(c, x - 1, y - 2 - bob);
}

// ---------------- hand-authored pixel sprites ----------------
// Each sprite: p = palette (char -> color), r = rows ('.' = transparent).
// Rows are right-padded to the widest row at load time.
const SPRITES = {
ooze: { p:{o:'#14301a',d:'#2f7a2c',b:'#3f8f3a',l:'#74c75e',w:'#ffffff',k:'#0c2410'}, r:[
".......oooooooo.......",
".....oobbbbbbbboo.....",
"....obllbbbbbbbbbo....",
"...obllbbbbbbbbbbbo...",
"..ollbbbbbbbbbbbbbdo..",
"..olbbbbbbbbbbbbbddo..",
".obbwwwbbbbbbwwwbbbdo.",
".obbwkwbbbbbbwkwbbbdo.",
".obbwwwbbbbbbwwwbbddo.",
".obbbbbbbbbbbbbbbbddo.",
".obbbkkkkkkkkbbbbdddo.",
"..obbbbbbbbbbbbbdddo..",
"..odbbbbbbbbbbbddddo..",
"....oooddddddddooo....",
]},
bat: { p:{o:'#1a1030',m:'#3a2a5e',n:'#4a3878',b:'#5b3f8f',e:'#ffd94e',w:'#ffffff'}, r:[
"..........oo..oo..........",
".........obo..obo.........",
".........obbbbbbo.........",
"..oo....oobbbbbboo....oo..",
".ommmo.obeebbbbeebo.ommmo.",
"ommmmmoobbbbbbbbbboommmmmo",
"ommnnmoobbwbbbbwbboommnnmo",
"omnnnmo.obbbbbbbbo.omnnnmo",
"omnnmo...obbbbbbo...omnnmo",
".omno.....oobboo.....omno.",
"..oo........oo........oo..",
]},
wolf: { p:{o:'#141820',f:'#7d8290',h:'#98a0ae',d:'#565b66',r:'#c94a3a',w:'#e8e4da'}, r:[
"....oo..oo..................",
"...ohfoofho.................",
"..ohffffffho..........oo....",
".ohfffffffffoooooooo.offo...",
"ohfrfffffffffffffffooffffo..",
"ohffffffffffffffffffofffo...",
"owoffffhhhhhhhhhhfffoffo....",
"oowfffhhhhhhhhhhhhffoo......",
".ooffffffffffffffffffo......",
"..offfffffffffffffffo.......",
"..odffddffffffffddffo.......",
"..odf.odffo..odffo.dfo......",
"..odo..odfo..odfo..odo......",
"..oo....odo..odo....oo......",
".........oo..oo.............",
]},
spider: { p:{o:'#120e1c',a:'#2c2436',b:'#3c3048',l:'#5a4a6e',r:'#e84a3a'}, r:[
"oo......................oo",
".oo..oo..........oo....oo.",
"..oo..oo........oo....oo..",
"...oo..oo..oooo..oo..oo...",
"....oo..oobbbbbboo..oo....",
".....oooobrbbbbrboooo.....",
"..ooooo.obrbbbbrbo.ooooo..",
".oo......obbbbbbo......oo.",
"oo......oaabbbbaao......oo",
"........oaaaaaaaao........",
".......oaalaaaaaaao.......",
".......oaaaaaaaaaao.......",
"........oaaaaaaaao........",
".........oooooooo.........",
]},
beetle: { p:{o:'#101624',s:'#4a5a8a',t:'#6a7ab0',l:'#8fa0d0',d:'#2c3450',g:'#ffd94e',k:'#3a3020'}, r:[
"......ooooooooo.....oo....",
"....ootttttttttoo..oddo...",
"...otttlltttttttto.odddo..",
"..ottlllltttttttttooddo...",
".otttllttttttttttttoddgo..",
".ottttttttdtttttttttoddo..",
"ottttttttoddottttttttoo...",
"osssssssodddossssssso.....",
"ossssssssoddosssssssso....",
".ossssssssddssssssssso....",
".oossssssssssssssssoo.....",
"..okko..okko...okko.......",
"..oko....oko....oko.......",
"...o......o......o........",
]},
golem: { p:{o:'#14140e',s:'#6d6f64',t:'#7d7f74',l:'#9a9c90',e:'#e88a2a',m:'#48644a',k:'#4c4e45'}, r:[
".......oooooooooo.......",
"......ostttttttsso......",
"......ostlltttttso......",
"......osteetseetso......",
"......ossteossetso......",
".......ossssssss.o......",
"...oooosssssssssoooo....",
"..osttssttttttttsstto...",
".osttsstlltttttttssttso.",
".osmmsstttttttkktssmmso.",
".ossssotttkkttttto.ssso.",
".osssotttttttttttossss..",
".oss.otttkkkttttto.sss..",
".oo..osttttttkktso..oo..",
".....ostttttttttso......",
".....osstttttttso.......",
"....osssoooooosss.o.....",
"....osso......osso......",
"...osso........osso.....",
"...oooo........oooo.....",
]},
harpy: { p:{o:'#201428',v:'#8a5a8f',u:'#a874ac',s:'#e8c8a0',h:'#6a4a8f',e:'#ffd94e',c:'#e8c84b'}, r:[
"oo......................oo",
"ouo.......oooo.......oou.o",
"ouuo.....ohhhho.....ouuo..",
"ouuvo...ohhhhhho...ovuuo..",
"ouuvvo..ohsessho..ovvuuo..",
"ouuvvvo.ohssssho.ovvvuuo..",
".ouvvvooossssoooovvvuo....",
".ouvvvvoosccsoovvvvuo.....",
"..ovvvvossssssovvvvo......",
"..ovvvosvvvvvvsovvvo......",
"...ovvosvvvvvvsovvo.......",
"...ooocvvvvvvvvcoo........",
".....ovvvvvvvvvvo.........",
".....ovvovvvvovvo.........",
"......oo.ovvo.oo..........",
".........occo.............",
".........occo.............",
"........oc..co............",
]},
boar: { p:{o:'#160f08',b:'#6a4a33',h:'#7d5a40',d:'#3a2c20',w:'#e8e4da',r:'#c94a3a'}, r:[
"......oo..oo................",
".....obboobbo...............",
"..ooobbbbbbbboooooooooo.....",
".obbbbbbbbbbbbbbbbbbbbbo....",
"obrbbbbhhhhhhhhhhhhhhbbbo...",
"obbbbbhhhhhhhhhhhhhhhhbbo...",
"oobdbbhhhhhhhhhhhhhhhbbbo...",
"ow.obbbbbbbbbbbbbbbbbbbbo...",
"oww.obbbbbbbbbbbbbbbbbbo....",
".o...odbbddbbbbbbddbbdo.....",
"......odb.odbo.odbo.dbo.....",
"......odo..odo..odo..oo.....",
"......oo....oo...oo.........",
]},
shade: { p:{o:'#0e0a1c',a:'#2a2440',b:'#3a3258',l:'#4a4270',e:'#8fd0e8'}, r:[
".......oooooo.......",
".....oobbbbbboo.....",
"....obbblbbbbbbo....",
"...obbllbbbbbbbbo...",
"...obbbbbbbbbbbbo...",
"..obbaeebaaeebaabo..",
"..obbaeebaaeebaabo..",
"..obaaaaaaaaaaaabo..",
".obaaaaaaaaaaaaaabo.",
".obaaaaaaaaaaaaaabo.",
".oaaaaaaaaaaaaaaao..",
".oaaalaaaaaaaaaao...",
"..oaaaaaaaaaaaaao...",
"..oaaaaaoooaaaao....",
"...oaaao...oaao.....",
"...oaao.....oao.....",
"....oo.......o......",
"....o...............",
]},
gargoyle: { p:{o:'#101018',g:'#8a8a96',d:'#5c5c68',l:'#a8a8b4',t:'#74747f',r:'#e8543a'}, r:[
"oo........oo..oo........oo",
"odo......odgoogdo......odo",
"oddo.....ogggggg.o....oddo",
"odddo....oglggggo....oddo.",
"odtddo...ogrggrgo...oddtdo",
"odtttdo..oggggggo..odtttdo",
".odtttdooogggggoooodtttdo.",
".odttttdoogggg.oodttttdo..",
"..odttttoggggggottttdo....",
"...oddddgggggggg.dddo.....",
".....ooggglgggggoo........",
".......ogggggggo..........",
".......oggdddggo..........",
".......ogggggggo..........",
"......oggo...oggo.........",
"......oggo...oggo.........",
".....oddgo...ogddo........",
".....ooooo...ooooo........",
]},
ogre: { p:{o:'#101408',g:'#5a7a3a',h:'#6e9048',d:'#4a6430',r:'#c94a3a',w:'#e8e4da',k:'#7a5a33',b:'#8a6a3a'}, r:[
"..........oooooooo....okko..",
".........oggggggggo...okko..",
".........oghhhhhggo...okko..",
".........oghrggrhgo...okko..",
".........ogghggh.ggo..okko..",
".........oggwggwggo...okko..",
"..........ogggggg.o...okko..",
".....ooooogggggggoooo.okko..",
"...oogggggggggggggggookkko..",
"..oggghhhhhhhhhhhggggokko...",
".oggghhhhhhhhhhhhhgggokko...",
".odgghhhhhhhhhhhhhgggkkko...",
".odgghhhhhhhhhhhhhggokko....",
".odggghhhhhhhhhhhgggoko.....",
".odddggggggggggggggggo......",
"..oddgggggggggggggggo.......",
"..odddgggbbbbbbgggddo.......",
"...oddggobbbbbboggdo........",
"....oogggbbkkbbgggoo........",
".....odgggggggggggo.........",
".....odddgggggdddo..........",
".....odddo...odddo..........",
".....oddo.....oddo..........",
"....odddo.....odddo.........",
"....ooooo.....ooooo.........",
]},
wyrm: { p:{o:'#0c0818',a:'#2c2440',b:'#453a66',l:'#574a78',e:'#ffd94e',r:'#c94a3a',w:'#ffffff',h:'#1a1528'}, r:[
"......ohho........ohho........",
".....ohhho........ohhho.......",
".....ohhoooooooooooohho.......",
"......ooaaaaaaaaaaaoo.........",
".....oaaaaaaaaaaaaaaao........",
"....oaabbaaaaaaaaabbaao.......",
"....oaaeeaaaaaaaaaeeaao.......",
"....oaaeeaaaaaaaaaeeaao.......",
".....oaaaaaaaaaaaaaaao........",
".....oaarrrrrrrrrrraao........",
"......oawrwwrwwrwwrao.........",
".......oaaaaaaaaaaao..........",
"......oaabbbbbbbbaaao.........",
".....oaabbllllllbbaaao........",
"....oaabblllllllllbaaao.......",
"...oaabbllllllllllllbaao......",
"...oaabllllllllllllllaao......",
"...oabllllooooooollllbao......",
"...oabllloo.....oolllbao......",
"...oabllo.........ollbao......",
"...oablo...........olbao......",
"...oabo.............obao......",
"..oaabo.............obaao.....",
".oaaabbooooooooooooobbaaao....",
".oaaaabbbbbbbbbbbbbbbaaaao....",
"..oaaaaaaaaaaaaaaaaaaaaao.....",
"...ooooooooooooooooooooo......",
]},
sum_earth: { p:{o:'#141008',s:'#8a7a54',t:'#a89a6e',l:'#cabf95',d:'#6e6248',e:'#ffd94e',m:'#48644a'}, r:[
"..........oooooooo..........",
".........osttttttso.........",
".........ostlltttso.........",
".........osteetseetso.......",
".........ostteosettso.......",
"..........osttttttso........",
"....ooooooosttttttsoooooo...",
"..oostttsssssssssssssttsoo..",
".ostttsstttttttttttsstttso..",
".osttssttllttttttttssttsso..",
"osttsstttttteetttttssstttso.",
"osttsottttteeeettttto.sttso.",
"ostso.ottttteettttto..ostso.",
"osts..otttttttttttto...stso.",
"oso...otttmmttttttto....oso.",
"oo....ottttttmmttto......oo.",
"......osttttttttttso........",
"......osstttttttsso.........",
".....osssooooooosss.........",
".....osso.......oss.o.......",
"....ossso.......ossso.......",
"....ostso.......ostso.......",
"...oosssoo.....oosssoo......",
"...oooooo.......oooooo......",
]},
sum_fire: { p:{o:'#200a04',r:'#a83a28',c:'#c94a30',f:'#e2543a',a:'#ff9a4e',y:'#ffd94e',w:'#fff3c4',k:'#2b1408'}, r:[
"oo..........................oo",
"oro..........oooo..........oro",
"orco........oyyyyo........ocro",
"orcfo.......oywwyo.......ofcro",
"orcffo......oywwyyo.....offcro",
".orcffao...oayyyyaao...oaffcro",
".orcffaao..oaykkyaao..oaaffcr.",
"..orcfaaao.oaayyaaao.oaaafcro.",
"..oorcfaaaooaaaaaaooaaafcroo..",
"....orcffaaoaaffaaoaaffcro....",
".....oorcffaffffffaffcroo.....",
".......oocfffffffffcoo........",
".........offffffffo...........",
".........offyyyyffo...........",
".........ofyywwyyfo...........",
".........ofyywwyyfo...........",
".........offyyyyffo...........",
"..........offyyffo............",
"..........oayyyao.............",
".........oayyyyya.o...........",
".........oaywyyao.............",
"........oayyoyyao.............",
"........oayo.oyao.............",
".......oayo...oyao............",
".......oyo.....oyo............",
"......oyo.......oyo...........",
"......oo.........oo...........",
]},
sum_water: { p:{o:'#081428',b:'#2e5fa8',c:'#4fa8e8',l:'#8fd0e8',w:'#c8f4ff',e:'#ffd94e'}, r:[
"...................oooo......",
"..................occcco.....",
".................occllcco....",
"................occlwwlco....",
"...............occclwwclo....",
"......w........occcceecclo...",
".....w.w......occccccccco....",
"...........oooccccccccco.....",
"..........occccccccccco......",
".........occccllccccco.......",
"....w....occcllllccco........",
"........occcllwwllcco........",
"........occllwwwwllco...w....",
"........occllwwwwllco........",
"........occcllwwllcco........",
".........occcllllccco........",
".........obcccllcccbo....w...",
"..w......obbccccccbbo........",
".........obbbccccbbbo........",
"..........obbbbbbbbo.........",
"...oooooooobbbbbbbboooooo....",
"..obbbbbbbbbbbbbbbbbbbbbbo...",
".obbcccbbbbbbbbbbbbbcccbbo...",
".obbbbbbbbbbbbbbbbbbbbbbbo...",
"..oobbbbbbbbbbbbbbbbbboo.....",
"....oooooooooooooooooo.......",
]},
sum_wind: { p:{o:'#1c1430',v:'#9b6ee0',u:'#b99ae8',d:'#d0c0f0',w:'#ffffff',e:'#ffd94e',s:'#e8e0ff'}, r:[
"oo..........................",
"ovo.........oooo......oo....",
"ovvo.......oddddo....ovo....",
"ovvuo......odwwdo...ovvo....",
"ovvuuo.....odwwddo.ovvuo....",
".ovvuuo...oudddduoovvuuo....",
".ovvuuuo..oudddduoovvuuo....",
"..ovvuuuooouuuuuooovvuo.....",
"...ovvuuuoouuuuoouuvvo......",
"....ovvuuuuuuuuuuuuvo.......",
".....oovvuuveeuuuvvoo.......",
".......ovvuueeuuvvo.........",
".......ovvuuuuuuvvo.........",
".......ovvuuuuuuvvo.........",
"......ovvuuuuuuuuvvo........",
"......ovuuosso.uuvo.........",
"......ovuosssso.uvo.........",
".....ovuossooss.ovo.........",
".....ovoss....ss.oo.........",
"....ovoss......ss...........",
"....oss..........ss.........",
"...oss............s.........",
"...os.......................",
"..os........................",
]},
sum_sol: { p:{o:'#201404',y:'#ffd94e',w:'#fff3c4',g:'#e8b84b',d:'#c9a02a',k:'#3b2c07'}, r:[
".....o......oooo......o.....",
"....oyo....oyyyyo....oyo....",
"...oyyo...oywwwwyo...oyyo...",
".....oo..oywwwwwwyo..oo.....",
"........oywwkwwkwwyo........",
"o.......oywwwwwwwwyo......o.",
"oyo......oywwwwwwyo......oyo",
".oo.......oyyyyyyo........o.",
"....ooooogggggggggooooo.....",
"...ogggggggggggggggggggo....",
"..oggdggggwwwwwwggggdgggo...",
".oggddgggwwwwwwwwgggddggo...",
".ogddogggwwwkkwwwgggoddgo...",
".ogdo.gggwwwwwwwwggg.odgo...",
".ogo..oggwwwwwwwwggo..ogo...",
".oo...oggggwwwwggggo...oo...",
"o.....oggggwwwwggggo......o.",
"......ogggggggggggg.o.......",
".......ogggokkoggggo........",
".......oggo....oggo.........",
".......oggo....oggo.........",
"......oddgo....ogddo........",
"......odddo....odddo........",
".....ooooo......ooooo.......",
]},
// the tier-one summons get figures of their own; the element figures above serve Titan, Phoenix,
// Leviath, Sylph and the Sol Avatar
sum_gnome: { p:{o:'#141008',h:'#cf8c2a',d:'#9a6420',s:'#f0c090',b:'#e9e0c8',t:'#48644a',g:'#2f4a32',k:'#8a7a54',m:'#c9ced8',e:'#141008'}, r:[
"............o...............",
"...........oho..............",
"...........ohho.............",
"..........ohhho.............",
"..........ohhhho............",
".........ohhhhdo............",
".........ohhhhhdo...........",
"........ohhhhhhddo..........",
"........ohhhhhhhdo..........",
".......ohhhhhhhhddo.........",
".......odddddddddddo........",
"........ossssssssso....oo...",
".......osseessseeso...ommo..",
".......osssssssssso...ommmo.",
"......obbsssssssbbo....oko..",
"......obbbbbbbbbbbbo...oko..",
".....obbbbbbbbbbbbbbo..oko..",
".....obbbbbbbbbbbbbbo..oko..",
".....otbbbbbbbbbbbbto..oko..",
"......otttttttttttto...oko..",
"......ottggtttggtttoooooko..",
"......otttttttttttttttttoo..",
".......oggoooooggoooooooo...",
".......oggo...oggo..........",
".......oggo...oggo..........",
".......oooo...oooo..........",
]},
sum_salamand: { p:{o:'#200a04',f:'#e2543a',c:'#c94a30',a:'#ff9a4e',y:'#ffd94e',e:'#ffd94e',k:'#2b1408'}, r:[
"............a....a....a.....",
"...........aya..aya..aya....",
"..........oayyaoayyaoayya...",
".........oaaaaaaaaaaaaaaao..",
"........ofaaffffffffffaafo..",
".oooo..offfffffffffffffffo..",
"offfffooffcccccccccccccffo..",
"ofeffffffcccccccccccccccfoo.",
"offkfffffccccccccccccccccfo.",
"offfffffcccccccccccccccccfo.",
".offfffffcccccccccccccccfo..",
"..ofofffffcccccccccccccffo..",
"....ooffffffcccccccccfffo...",
"......offffffffffffffffo....",
".......offoooffffoooffo.....",
".......offo..offo..offo.....",
"......offfo..offfo.offfo....",
"......oooo...oooo..oooo.....",
]},
sum_nixie: { p:{o:'#081428',b:'#2e5fa8',c:'#4fa8e8',l:'#8fd0e8',w:'#c8f4ff',s:'#f0e4d0',e:'#081428'}, r:[
"........ooooo...........",
".......occcccoo.........",
"......occcccccco........",
"......occlssslcco.......",
".....occlsssssscco......",
".....ocolseslesoco......",
".....oco.sssss.oco......",
"......o.osssso..o.......",
"........olllo...........",
".......ollllllo.........",
"......ollwwlllo..w......",
"......olllllllo.........",
"......ollllllllo........",
".w....obblllllbo........",
"......obbbllbbbo........",
".......obbbbbbo...w.....",
"........obbbbo..........",
"........obbbbbo.........",
".......obbbbbbbo........",
"......obbcbbbbcbo.......",
".....obbcc.bbb.ccbo.....",
"....occc....o....cco....",
"...occo...........oco...",
"..ooo..............oo...",
]},
sum_tempest: { p:{o:'#1c1430',v:'#9b6ee0',u:'#b99ae8',d:'#d0c0f0',w:'#ffffff',e:'#ffd94e',y:'#ffd94e'}, r:[
"..........oooo....oooo......",
".........ouuuuo..ouuuuo.....",
"......oooouuuuuoouuuuuoooo..",
".....ouuuuuddduuuudddduuuuo.",
"....ouuuddddddddddddddddduuo",
"...ouudddddddddddddddddddduo",
"...ouddddeedddddddeedddddduo",
"..ouudddeeeeddddddeeeeddddvo",
"..ouddddeeeeddddddeeeeddddvo",
"..ouddddddddddddddddddddddvo",
"..ovudddddddwwwwwwddddddvvo.",
"...ovvudddddddddddddddvvvo..",
"....ovvvuuuuuuuuuuuuvvvvo...",
".....ooovvvvvvvvvvvvvooo....",
"........oooyooooooyooo......",
"..........oyyo...oyo........",
"..........oyyyo..oyyo.......",
"...........oyyo...oyyo......",
"...........oyo.....oyo......",
"..........oyo.....oyo.......",
"..........oo.......oo.......",
]},
};
// battle forms of the eight spirits (original designs)
const DJB_SPRITES = {
djinn_battle_flint: { p:{o:'#241a08',b:'#cf8c2a',d:'#9a6420',h:'#ffe9a0',w:'#ffffff',k:'#241a08',t:'#ffffff'}, r:[
"........oo..........",
".......ohho.........",
"......ohhho.........",
"....oobbbboo........",
"..oobbbbbbbboo......",
".obbwwbbbbwwbbo.....",
".obbwkbbbbwkbbo.....",
"obbbbbbbbbbbbbbo....",
"obdbbkkkkkkbbdbo....",
"obbbktbtbtbkbbbo....",
".obbbkkkkkkbbbo.....",
".obdbbbbbbbbdbo.....",
"..obbddddddbbo......",
"...oobbbbbboo.......",
".....oooooo.........",
]},
djinn_battle_granite: { p:{o:'#1a1a14',b:'#a89a6e',d:'#6e6248',w:'#ffffff',k:'#14140e'}, r:[
"..oooooooooooooo....",
".oddddddddddddddo...",
".obbwwkbbbbwwkbbo...",
".obbbbbbbbbbbbbbo...",
".obbkkbbbbbbkkbbo...",
".obbbbkkkkkkbbbbo...",
".odbbbbbbbbbbbbdo...",
".odbbkbbbbbbkbbdo...",
"..oobbbbbbbbbboo....",
"...odddo..odddo.....",
"...oooo....oooo.....",
]},
djinn_battle_forge: { p:{o:'#2b0c04',f:'#e2543a',a:'#ff9a4e',y:'#ffd94e',w:'#ffffff',k:'#2b1408'}, r:[
".........oo.........",
"........offo........",
".......offffo.......",
"....oo.offaffo.oo...",
"...offooffaffooffo..",
"...offfffaaafffffo..",
"....offaaayaaaffo...",
"...offaykwwkyaffo...",
"...offaayyyyaaffo...",
"..offaaayyyyaaaffo..",
"...offaaayyaaaffo...",
"....offaaaaaaffo....",
".....offffffffo.....",
"......offooffo......",
".......oo..oo.......",
]},
djinn_battle_ember: { p:{o:'#1c0f08',d:'#4a3a33',r:'#ff6a3a',f:'#e2543a',a:'#ffd94e',w:'#ffffff',k:'#140a06',t:'#ffffff'}, r:[
"...ooooo.....oo.....",
"..odddddoo..ofao....",
".odwkdwkddo.ofao....",
".odddddddooofaao....",
".odrrrrrdoaafao.....",
".oddddddddoaafo.....",
".odkttkdddoofo......",
"..odddddddoo........",
"...odo..odo.........",
"...oo....oo.........",
]},
djinn_battle_dew: { p:{o:'#0a2238',b:'#4fa8e8',l:'#c8f4ff',w:'#ffffff',k:'#0a2238'}, r:[
".........oo.........",
"........obbo........",
".......obbllo.......",
"......obbbbllo......",
".....obbbbbbllo.....",
"....obbbbbbbbllo....",
"...obkkbbbbkkbblo...",
"...obwkbbbbwkbbbo...",
"..obbbbbbbbbbbbbo...",
"..obbbkkkkkkbbbbo...",
"..olbbbbbbbbbbblo...",
"...olbbbbbbbbblo....",
"....olbbbbbblo......",
".....oolbbloo.......",
".......oooo.........",
]},
djinn_battle_mist: { p:{o:'#223044',b:'#8fb8d0',w:'#ffffff',k:'#1a2a3c',y:'#ffd94e'}, r:[
".....oooooo.........",
"...oobbbbbboo..oo...",
"..obbbbbbbbbbooboo..",
".obbwkbbbbwkbbbbbo..",
".obbbbbbbbbbbbbbbo..",
"obbbkkkkkkkkbbbbbbo.",
".oobbbbbbbbbbbboo...",
"...oyo..............",
"....oyo.............",
"...oyo..............",
]},
djinn_battle_breeze: { p:{o:'#241a38',v:'#9b6ee0',d:'#d0c0f0',b:'#b99ae8',w:'#ffffff',k:'#241a38'}, r:[
"oo................oo",
"ovvoo..........oovvo",
".ovvvvo......ovvvvo.",
"..ovvvvvoooovvvvvo..",
"...ovvvdddddvvvo....",
"....ovdwkdddddo.....",
"....odddddddddo.....",
"...oddddddddddo.....",
"....odddoodddo......",
".....oddo.odo.......",
"......obbo..........",
"......oo............",
]},
djinn_battle_squall: { p:{o:'#241a38',v:'#9b6ee0',d:'#b99ae8',w:'#ffffff',k:'#241a38'}, r:[
"..ooooooooooo.....",
".ovvvvvvvvvvvo....",
".ovwkvvvvwkvvo....",
"..ovvvvvvvvvo.....",
"...oddddddddo.....",
"..ovvvvvvvvvvo....",
"...odddddddo......",
"....ovvvvvo.......",
"....oddddo........",
".....ovvo.........",
"......odo.........",
".....ovo..........",
"......oo..........",
]},
};
Object.assign(SPRITES, DJB_SPRITES);
// original grass tiles (symbolic keys, recolored per map kind)
const GRASS_GRIDS = {
grass_a: [
"gggggggggggggggg",
"ggdgggggglgggggg",
"gggggdgggggggdgg",
"glggggggggglgggg",
"gggggggdgggggggg",
"ggggglgggggggggg",
"gdgggggggdgggggg",
"ggggggggggggglgg",
"gglggggdgggggggg",
"ggggggggggglgggg",
"gggdgggggggggdgg",
"ggggggglggdggggg",
"glgggggggggggggg",
"gggggdgggggglggg",
"ggggggggdggggggg",
"ggglgggggggggggg",
],
grass_b: [
"gggggggggggggggg",
"ggdggggtgggggggg",
"gggggggtgglggdgg",
"glggtggggggggggg",
"ggggtggdggggtggg",
"ggggggggggggtggg",
"gdggggggggggtggg",
"gggggtgggggggggg",
"gglggtggdggggggg",
"gggggggggggllggg",
"gggdggggtggggggg",
"ggggggggtgdggggg",
"glggggggtggggggg",
"ggggdggggggggggg",
"ggggggggggtggggg",
"ggglggggggtggggg",
],
};
const GRASS_COLS = {
  field: { g:'#4f9b3f', d:'#43933a', l:'#5cab48', t:'#79c45f' },
  trail: { g:'#8f9a4a', d:'#7f8a3e', l:'#a0ab58', t:'#b3bd68' }
};
// original battle effect overlays
const FX_SPRITES = {
fx_earth: { p:{o:'#3a2410',a:'#cf8c2a',d:'#9a6420',y:'#ffe9a0'}, r:[
"..a....y....a..",
".oao..oao..oao.",
".oao..oao..oao.",
"oaaao.oao.oaaao",
"oadaooaaaooadao",
".oooooadaoooo..",
".....ooooo.....",
]},
fx_fire: { p:{f:'#e2543a',a:'#ff9a4e',y:'#ffd94e',w:'#fff3c4'}, r:[
"......ff.......",
".f...ffff...f..",
"..f.ffaaff.f...",
"...ffaayaff....",
"..ffaaywyaff...",
"...faayyaaf....",
"....fayyaf.....",
".....faaf......",
"......ff.......",
]},
fx_water: { p:{o:'#0a2238',b:'#4fa8e8',l:'#8fd0e8',w:'#c8f4ff'}, r:[
".b....w.....b..",
"obo..obo..obo..",
"obo..obo..obo..",
".o....o....o...",
"..l.w...l...w..",
".w....l....l...",
]},
fx_wind: { p:{v:'#9b6ee0',d:'#d0c0f0',w:'#ffffff'}, r:[
".vvv......dd...",
"v...v...dd.....",
".....v.d....vv.",
"..dd..v...v....",
".d.....vv......",
"......w....w...",
]},
fx_heal: { p:{g:'#7cd88a',w:'#ffffff',y:'#fff8d0'}, r:[
"y....gg....y...",
".....gg........",
"..gggggggg.....",
"..ggwwwwgg.....",
"..gggggggg.....",
".....gg......y.",
"y....gg........",
]},
};
// battle action poses (back view, palette-swapped; m = blade metal, y = spell glow)
const HERO_ACTION_GRIDS = {
hero_attack: [
"............omo.",
".....ooooo..omo.",
"...oohhhhho.omo.",
"..ohhhhhhhhoobo.",
"..ohhhhhhhhosso.",
".ohhhhhhhhhhsso.",
".ohhhhhhhhhhho..",
".ohhhhhhhhhhho..",
"..ohhHHHHHHho...",
"..oHHHHHHHHHo...",
"....osssso......",
"...occccccco....",
"..oTtttttttto...",
".osoTtttttto....",
".osoTtttttto....",
".osoTtttttto....",
"..oobbbbbboo....",
"...oTtttttto....",
"...ollo..ollo...",
"...ollo..ollo...",
"...ollo..ollo...",
"...obbo..obbo...",
],
hero_attack2: [
".omo............",
".omo..ooooo.....",
".omo.oohhhhoo...",
".obooohhhhhhho..",
".ossohhhhhhhhho.",
"..ssohhhhhhhhho.",
"..ohhhhhhhhhhho.",
"..ohhhhhhhhhhho.",
"...ohhHHHHHHho..",
"...oHHHHHHHHHo..",
".....osssso.....",
"....occccccco...",
"...oTtttttttto..",
"....oTttttttoso.",
"....oTttttttoso.",
"....oTttttttoso.",
"...oobbbbbbboo..",
"....oTtttttto...",
"..ollo...ollo...",
"..ollo...ollo...",
"..obbo...ollo...",
".........obbo...",
],
hero_cast: [
"..y..........y..",
".....oooooo.....",
"...oohhhhhhoo...",
"..ohhhhhhhhhho..",
".ssohhhhhhhhoss.",
".osohhhhhhhhoso.",
".oohhhhhhhhhhoo.",
".ohhhhhhhhhhhho.",
"..ohhHHHHHHhho..",
"..oHHHHHHHHHHo..",
"....osssso......",
"...occccccco....",
"..oTtttttttto...",
"..ooTtttttttoo..",
"...oTtttttttto..",
"...oTtttttttto..",
"..oobbbbbbbboo..",
"...oTttttttto...",
"...ollo..ollo...",
"...ollo..ollo...",
"...ollo..ollo...",
"...obbo..obbo...",
],
hero_cast2: [
"......yyyy......",
".....yooooy.....",
"...oohhhhhhoo...",
"s.ohhhhhhhhhho.s",
"ssohhhhhhhhhhoss",
"ooohhhhhhhhhhooo",
".ohhhhhhhhhhhho.",
".ohhhhhhhhhhhho.",
"..ohhHHHHHHhho..",
"..oHHHHHHHHHHo..",
"....osssso......",
"...occccccco....",
"..oTtttttttto...",
"..oTtttttttto...",
"...oTtttttttto..",
"...oTtttttttto..",
"..oobbbbbbbboo..",
"...oTttttttto...",
"...ollo..ollo...",
"...ollo..ollo...",
"...ollo..ollo...",
"...obbo..obbo...",
],
};
// fence tiles, 16x16, bottom-anchored (o outline, W light wood, w wood, d dark wood)
const FENCE_GRIDS = {
fence_h: [ // run tile: post at x 2-5, rails to both edges
"................",
"..oooo..........",
"..oWwo..........",
"..oWwo..........",
"oooooooooooooooo",
"WWoWwoWWWWWWWWWW",
"wwoWwowwwwwwwwww",
"oooooooooooooooo",
"..oWwo..........",
"oooooooooooooooo",
"WWoWwoWWWWWWWWWW",
"wwoWwowwwwwwwwww",
"oooooooooooooooo",
"..oWwo..........",
"..oddo..........",
"..oooo..........",
],
fence_post: [ // end of a run: sturdy post at the right, rails arriving from the left (mirrored for left ends)
"..........ooooo.",
"..........oWWwo.",
"..........oWWwo.",
"..........oWWwo.",
"oooooooooooWWwo.",
"WWWWWWWWWWoWWwo.",
"wwwwwwwwwwoWWwo.",
"oooooooooooWWwo.",
"..........oWWwo.",
"oooooooooooWWwo.",
"WWWWWWWWWWoWWwo.",
"wwwwwwwwwwoWWwo.",
"oooooooooooWWwo.",
"..........oWWwo.",
"..........odddo.",
"..........ooooo.",
],
fence_v: [ // vertical run: post at x 2-5, plank running top to bottom at x 6-7
"......Wwo.......",
"..ooooWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oddoWwo.......",
"..ooooWwo.......",
"......Wwo.......",
],
fence_v2: [ // vertical variant: shorter post with a knot and a weathered plank section
"......Wwo.......",
"......Wwo.......",
"..ooooWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..odwoWwo.......",
"..oWwodwo.......",
"..oWwodwo.......",
"..oWwoWwo.......",
"..oWwoWwo.......",
"..oddoWwo.......",
"..ooooWwo.......",
"......Wwo.......",
],
};
// battle back stance (idle): wide footing, fists at the hips, blade sheathed across the back
const HERO_BACK_GRIDS = {
hero_back: [
".....oooooo.....",
"...oohhhhhhoo...",
"..ohhhhhhhhhho..",
"..ohhhhhhhhhho..",
".ohhhhhhhhhhhho.",
".ohhhhhhhhhhhho.",
".ohhhhhhhhhhhho.",
".ohhhhhhhhhhhho.",
"..ohhHHHHHHhho..",
"..oHHHHHHHHHHo..",
"....osssso.m....",
"..occccccccco...",
".oTtttttttttto..",
"oToTttttmtttoTo.",
"osoTtttmttttoso.",
"osoTttmtttttoso.",
".ooobbbbbbbbooo.",
"...oTttttttto...",
"..ollo....ollo..",
"..ollo....ollo..",
"..ollo....ollo..",
"..obbo....obbo..",
],
};
// taking a hit (back view): recoil with the arms thrown up
const HERO_HIT_GRIDS = {
hero_hit: [
"................",
".....oooooo.....",
"...oohhhhhhoo...",
"..ohhhhhhhhhho..",
"..ohhhhhhhhhho..",
".ohhhhhhhhhhhho.",
".ohhhhhhhhhhhho.",
"ssohhhhhhhhhhoss",
"osohhhhhhhhhhoso",
".oohhHHHHHHhhoo.",
"..oToHHHHHHoTo..",
"..oToossssooTo..",
"..oTccccccccTo..",
"..oTtttttttttTo.",
"...oTttttmtttto.",
"...oTtttmttttto.",
"...oobbbbbbbboo.",
"....oTtttttto...",
"...ollo...ollo..",
"...ollo...ollo..",
"..ollo....ollo..",
"..obbo....obbo..",
],
};
// knocked out (lying on the ground, head to the left)
const HERO_DOWN_GRIDS = {
hero_downed: [
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"..oooo..........",
".ohhhhooooooooo.",
".ohhHhocTtttllbo",
".ohHHhosTtttllbo",
"..ooooossoooooo.",
],
};
Object.assign(OW_GRIDS, HERO_DOWN_GRIDS);
Object.assign(OW_GRIDS, HERO_HIT_GRIDS);
Object.assign(OW_GRIDS, HERO_BACK_GRIDS);
Object.assign(OW_GRIDS, FENCE_GRIDS);
Object.assign(OW_GRIDS, HERO_ACTION_GRIDS);
Object.assign(OW_GRIDS, GRASS_GRIDS);
Object.assign(SPRITES, FX_SPRITES);
// arts-window glyphs: one element badge per element (plus heal and sol) and one range badge per target kind
const UI_SPRITES = {
// element badges: shaded discs in the game's element colours (dark rim, white glint top-left, light tint bottom-right)
el_earth: { p:{o:'#5a3a10',b:'#cf8c2a',l:'#ffd060',w:'#ffffff'}, r:[
"..ooo..",
".owwbo.",
"owbbbbo",
"obbbblo",
"obbbllo",
".obllo.",
"..ooo..",
]},
el_fire: { p:{o:'#601a10',b:'#e2543a',l:'#ff9a4e',w:'#ffffff'}, r:[
"..ooo..",
".owwbo.",
"owbbbbo",
"obbbblo",
"obbbllo",
".obllo.",
"..ooo..",
]},
el_water: { p:{o:'#143a66',b:'#4fa8e8',l:'#a8e4ff',w:'#ffffff'}, r:[
"..ooo..",
".owwbo.",
"owbbbbo",
"obbbblo",
"obbbllo",
".obllo.",
"..ooo..",
]},
el_wind: { p:{o:'#3a2470',b:'#9b6ee0',l:'#d0b8ff',w:'#ffffff'}, r:[
"..ooo..",
".owwbo.",
"owbbbbo",
"obbbblo",
"obbbllo",
".obllo.",
"..ooo..",
]},
el_sol: { p:{o:'#7a5010',b:'#ffd94e',l:'#fff6c4',w:'#ffffff'}, r:[
"..ooo..",
".owwbo.",
"owbbbbo",
"obbbblo",
"obbbllo",
".obllo.",
"..ooo..",
]},
el_heal: { p:{o:'#245a30',b:'#7cd88a',l:'#c8ffd0',w:'#ffffff'}, r:[
"..ooo..",
".owwbo.",
"owbbbbo",
"obbbblo",
"obbbllo",
".obllo.",
"..ooo..",
]},
// the menu cursor: a white glove pointing right, its fingertip on the right edge
cursor: { p:{o:'#241c40',w:'#ffffff',s:'#c9c4dc'}, r:[
".ooooo......",
"owwwwwo.....",
"owwwwwwooooo",
"owwwwwwwwwwo",
"owwwwwwwwwso",
"owwwwwsooooo",
"owwwwwso....",
"osssssso....",
".oooooo.....",
]},
range_one: { p:{w:'#e9e0c8'}, r:[
".......",
".......",
".......",
"..www..",
"..www..",
"..www..",
"..www..",
]},
range_all: { p:{w:'#e9e0c8'}, r:[
"......ww",
"......ww",
"...ww.ww",
"...ww.ww",
"ww.ww.ww",
"ww.ww.ww",
"ww.ww.ww",
]},
range_ally: { p:{w:'#e9e0c8'}, r:[
"...w...",
"...w...",
"...w...",
"wwwwwww",
"...w...",
"...w...",
"...w...",
]},
range_party: { p:{w:'#e9e0c8'}, r:[
".w......",
"www..w..",
".w..www.",
".....w..",
"...w....",
"..www..w",
"...w..ww",
]},
// item icons: the shop rows and the battle ITEM window
item_herb: { p:{o:'#1e4a1a',g:'#5cb14a',l:'#a6e070',s:'#8a5a20'}, r:[
"....oo.",
"...olgo",
"..olggo",
".olggo.",
".oggo..",
".soo...",
"s......",
]},
item_potion: { p:{o:'#3a1020',r:'#e2543a',d:'#a02838',w:'#ffffff',c:'#a07040',g:'#c8d8e8'}, r:[
"..ccc..",
"..ogo..",
".orrro.",
"orwrrro",
"orrrrro",
"orrrddo",
".ooooo.",
]},
item_pdrop: { p:{o:'#2a1a5a',b:'#7a6ee8',l:'#b8b0ff',w:'#ffffff'}, r:[
"...o...",
"..obo..",
".obbbo.",
"obwbbbo",
"obbbblo",
".obllo.",
"..ooo..",
]},
item_elixir: { p:{o:'#5a3a10',y:'#ffd94e',d:'#cf8c2a',w:'#ffffff',c:'#a07040',g:'#c8d8e8'}, r:[
"..ccc.w",
"..ogo..",
".oyyyo.",
"oywyyyo",
"oyyyyyo",
"oyyyddo",
".ooooo.",
]},
// the yes/no box: a green tick and a red cross
choice_yes: { p:{o:'#245a30',g:'#7cd88a'}, r:[
"......g",
".....go",
"g...gg.",
"gg.ggo.",
".gggo..",
"..go...",
]},
choice_no: { p:{o:'#601a10',r:'#e2543a'}, r:[
"rr...rr",
"orr.rro",
".orrro.",
".rrorr.",
"rro.orr",
"o.....o",
]},
// the equip grid's mark on gear a member is wearing: a small green E
mark_equipped: { p:{o:'#0c3a14',g:'#5fe07a'}, r:[
"oooooo",
"oggggo",
"ogoooo",
"ogggo.",
"ogoooo",
"oggggo",
"oooooo",
]},
};
Object.assign(SPRITES, UI_SPRITES);
// gear icons for the shop rows (gear_wood ...): a sword, an axe or a breastplate in the piece's own colours
const GEAR_SHAPES = {
  sword: ["......l", ".....lb", "....lb.", ".g.lb..", "..gb...", ".hgg...", "h......"],
  axe:   [".bb.h..", "lbbbh..", "lbbbh..", ".bb.h..", "....h..", "....h..", "....h.."],
  armor: [".a...a.", "aaa.aaa", "alaaaaa", ".laaaa.", ".aaaaa.", ".aaaad.", ".ddddd."]
};
const GEAR_ICONS = {
  wood:    ['sword', {l:'#e0b878', b:'#a0703a', g:'#6a4a20', h:'#5a3a10'}],
  bronze:  ['sword', {l:'#ffd090', b:'#c8843a', g:'#8a5a20', h:'#5a3a10'}],
  iron:    ['axe',   {l:'#e0e8f0', b:'#8a94a8', h:'#8a5a20'}],
  steel:   ['sword', {l:'#ffffff', b:'#a8b8d0', g:'#f2c14e', h:'#5a3a10'}],
  sol:     ['sword', {l:'#fff6c4', b:'#ffd94e', g:'#e2543a', h:'#7a5010'}],
  vest:    ['armor', {a:'#6aa050', l:'#9ad070', d:'#3a6a2a'}],
  leather: ['armor', {a:'#8a5a2a', l:'#b07a40', d:'#5a3a10'}],
  chain:   ['armor', {a:'#9aa4b8', l:'#e0e8f0', d:'#5a6478'}],
  aegis:   ['armor', {a:'#ffd94e', l:'#fff6c4', d:'#cf8c2a'}]
};
for (const k in GEAR_ICONS) SPRITES['gear_' + k] = { p: GEAR_ICONS[k][1], r: GEAR_SHAPES[GEAR_ICONS[k][0]] };
const SPR_CACHE = {};
function sprCanvas(name, variant){
  const key = name + '|' + (variant || '');
  if (SPR_CACHE[key]) return SPR_CACHE[key];
  const def = SPRITES[name];
  let w = 0;
  for (const row of def.r) w = Math.max(w, row.length);
  const h = def.r.length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  for (let ry = 0; ry < h; ry++){
    const row = def.r[ry];
    for (let rx = 0; rx < row.length; rx++){
      const ch = row[rx];
      if (ch === '.' || ch === ' ') continue;
      const col = def.p[ch];
      if (!col) continue;
      x.fillStyle = variant === 'w' ? '#ffffff' : variant === 'k' ? '#0c0a16' : col;
      x.fillRect(rx, ry, 1, 1);
    }
  }
  if (variant === 'k'){ x.globalCompositeOperation = 'source-in'; }
  SPR_CACHE[key] = c;
  return c;
}
function drawSpr(name, cx, cy, s, variant){
  const u = userSpr(name);
  if (u){
    const m = sprMetrics(name, s);
    const f = sprFrame(u);
    const src = variant === 'w' ? f.w : variant === 'k' ? f.k : f.img;
    ctx.drawImage(src, Math.round(cx - m.hw), Math.round(cy - m.hh), m.wpx, m.hpx);
    return;
  }
  const c = sprCanvas(name, variant);
  ctx.drawImage(c, Math.round(cx - c.width*s/2), Math.round(cy - c.height*s/2), c.width*s, c.height*s);
}

function sprMetrics(name, s){
  const u = userSpr(name);
  if (u){
    const hpx = Math.max(1, Math.round(s * u.height)); // pack art is shown at its own size
    const wpx = Math.max(1, Math.round(hpx * u.width / u.height));
    return { eff: s, user: true, wpx, hpx, hw: wpx >> 1, hh: hpx >> 1 };
  }
  const c = sprCanvas(name, '');
  let eff = clamp(Math.round(s * 20 / c.height), s, s + 1);
  while (eff > s && c.width * eff > 60) eff--;
  return { eff, hw: Math.round(c.width*eff/2), hh: Math.round(c.height*eff/2) };
}
function drawEnemyArt(kind, cx, cy, t, s, flash){
  const m = sprMetrics(kind, s);
  const bob = (t >> 4) % 2;
  drawSpr(kind, cx, cy + bob, m.user ? s : m.eff, flash ? 'w' : '');
}
// which figure a summon shows: the pack's own (sum_gnome ...), the pack's element figure (sum_earth ...),
// the built-in figure of its own, else the built-in element figure
function summonFigSlot(def){
  const own = 'sum_' + slugName(def.name), el = 'sum_' + def.el;
  if (userSpr(own)) return own;
  if (userSpr(el)) return el;
  return SPRITES[own] ? own : el;
}
function drawSummonFig(def, cx, cy, t, s, shadowPass){
  const bob = (t >> 3) % 2, name = summonFigSlot(def);
  if (shadowPass) drawSpr(name, cx + 2, cy + bob + 2, s, 'k');
  else drawSpr(name, cx, cy + bob, s, '');
}

// ---------------- custom sprite packs ----------------
const USER_SPR = {};
for (const k in CHAR_DEFS) CHAR_DEFS[k].pal.id = k;
for (const k in NPC_PALS) NPC_PALS[k].id = k;
function packVariant(img, kind){
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = kind === 'w' ? '#ffffff' : '#0c0a16';
  x.fillRect(0, 0, c.width, c.height);
  return c;
}
// Decode a data URL into one or more frames. Animated GIFs use the
// ImageDecoder API where available; elsewhere the first frame is used.
async function decodeFrames(url){
  const type = url.slice(5, url.indexOf(';'));
  if (type === 'image/gif' && window.ImageDecoder){
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      const dec = new ImageDecoder({ data: buf, type });
      await dec.tracks.ready;
      const count = dec.tracks.selectedTrack.frameCount;
      const frames = [], durs = [];
      for (let i = 0; i < count; i++){
        const { image } = await dec.decode({ frameIndex: i });
        const dur = Math.max(20, (image.duration || 100000) / 1000);
        const c = document.createElement('canvas');
        c.width = image.displayWidth; c.height = image.displayHeight;
        c.getContext('2d').drawImage(image, 0, 0);
        image.close();
        frames.push(c); durs.push(dur);
      }
      if (frames.length) return { frames, durs };
    } catch(e){}
  }
  const img = new Image();
  await new Promise(res => { img.onload = res; img.onerror = res; img.src = url; });
  if (!img.width) return null;
  return { frames: [img], durs: [1000] };
}
function keyBlack(img){ // pure/near-black pixels become transparent
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  try {
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) if (d[i] <= 10 && d[i+1] <= 10 && d[i+2] <= 10) d[i+3] = 0;
    x.putImageData(id, 0, 0);
  } catch(e){}
  return c;
}
let PACK_REV = 0;
function setUserSprite(name, dec){
  PACK_REV++;
  const keyed = name.indexOf('fx_') === 0;
  const frames = dec.frames.map(f0 => { const f = keyed ? keyBlack(f0) : f0; return { img: f, w: packVariant(f, 'w'), k: packVariant(f, 'k') }; });
  let total = 0;
  for (const d of dec.durs) total += d;
  USER_SPR[name] = {
    frames, durs: dec.durs, total: Math.max(total, 1),
    width: frames[0].img.width, height: frames[0].img.height
  };
}
function userSpr(name){
  const u = USER_SPR[name];
  return (u && u.width) ? u : null;
}
function sprFrameAt(u, ms){
  if (u.frames.length === 1) return u.frames[0];
  let t = Math.min(ms, u.total - 1);
  for (let i = 0; i < u.frames.length; i++){
    t -= u.durs[i];
    if (t < 0) return u.frames[i];
  }
  return u.frames[u.frames.length - 1];
}
function sprFrame(u){
  if (u.frames.length === 1) return u.frames[0];
  let t = performance.now() % u.total;
  for (let i = 0; i < u.frames.length; i++){
    t -= u.durs[i];
    if (t < 0) return u.frames[i];
  }
  return u.frames[0];
}
const PACK_DB = 'sunspire2_packdb';
function packDb(){
  return new Promise(res => {
    if (!window.indexedDB) return res(null);
    try {
      const rq = indexedDB.open(PACK_DB, 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore('sprites'); };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
      rq.onblocked = () => res(null);
    } catch(e){ res(null); }
  });
}
function packTx(db, mode, fn){
  return new Promise((res, rej) => {
    const tx = db.transaction('sprites', mode);
    try { fn(tx.objectStore('sprites')); } catch(e){ rej(e); return; }
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error || new Error('aborted'));
  });
}
async function packStoreAll(){ // { name: Blob } or null when IndexedDB is unavailable
  const db = await packDb();
  if (!db) return null;
  const out = {};
  await new Promise(res => {
    const rq = db.transaction('sprites', 'readonly').objectStore('sprites').openCursor();
    rq.onsuccess = () => { const c = rq.result; if (c){ out[c.key] = c.value; c.continue(); } else res(); };
    rq.onerror = () => res();
  });
  return out;
}
async function packStorePut(name, blob){
  const db = await packDb();
  if (!db) throw new Error('no IndexedDB');
  await packTx(db, 'readwrite', st => st.put(blob, name));
}
async function packStoreClear(){
  const db = await packDb();
  if (db) await packTx(db, 'readwrite', st => st.clear());
}
function blobToDataUrl(blob){
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => res(null);
    r.readAsDataURL(blob);
  });
}
async function loadPackFromStore(){
  let blobs = null;
  try { blobs = await packStoreAll(); } catch(e){ blobs = null; }
  // packs saved by older versions (or without IndexedDB) live as data URLs in localStorage
  let legacy = {};
  try { legacy = JSON.parse(localStorage.getItem('sunspire2_pack') || '{}'); } catch(e){}
  for (const name in legacy){
    const dec = await decodeFrames(legacy[name]);
    if (dec && name.indexOf('glyph:') === 0) setUserGlyph(name.slice(6), dec);
    else if (dec) setUserSprite(name, dec);
    if (blobs){ try { await packStorePut(name, await (await fetch(legacy[name])).blob()); } catch(e){} }
  }
  if (blobs && Object.keys(legacy).length){ try { localStorage.removeItem('sunspire2_pack'); } catch(e){} }
  if (blobs) for (const name in blobs){
    if (USER_SPR[name] || name === 'font') continue; // 'font' is the retired TTF slot
    const url = await blobToDataUrl(blobs[name]);
    const dec = url ? await decodeFrames(url) : null;
    if (!dec) continue;
    if (name.indexOf('glyph:') === 0) setUserGlyph(name.slice(6), dec); else setUserSprite(name, dec);
  }
}
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function isKnownSlot(n){
  if (ENEMY_DEFS[n]) return true;
  if (/^sum_(earth|fire|water|wind|sol)$/.test(n)) return true;
  if (n.indexOf('sum_') === 0){ const rest = n.slice(4); for (const s of SUMMON_DEFS) if (slugName(s.name) === rest) return true; }
  const m = n.match(/^([a-z]+)_(downed|down2?|up2?|right2?|back|attack2?|cast2?|hit)$/);
  if (m){
    if (m[1] === 'hero' || CHAR_DEFS[m[1]]) return true;
    if (NPC_PALS[m[1]] && /^(down2?|up2?|right2?)$/.test(m[2])) return true; // townsfolk never fight
  }
  if (n === 'djinn') return true;
  if (n.indexOf('djinn_') === 0 && SPIRIT_DEFS[n.slice(6)]) return true;
  if (n === 'tree' || n.indexOf('tree_') === 0 || n === 'wyrm_s' || n === 'ogre_s') return true;
  if (n === 'house' || n.indexOf('house_') === 0) return true;
  if (n === 'boulder' || n.indexOf('boulder_') === 0) return true;
  if (n === 'sign' || n.indexOf('sign_') === 0) return true;
  if (n === 'chest' || n.indexOf('chest_') === 0) return true;
  if (n === 'grass' || n.indexOf('grass_') === 0) return true;
  if (/^fence_(post|v|v2|h)$/.test(n)) return true;
  if (n === 'title') return true;
  if (/^fx_(earth|fire|water|wind|heal)$/.test(n)) return true;
  if (n.indexOf('fx_') === 0){
    const rest = n.slice(3);
    for (const k in ART_DEFS) if (slugName(k) === rest) return true;
  }
  if (n.indexOf('art_') === 0){
    const rest = n.slice(4);
    if (['earth','fire','water','wind','heal'].indexOf(rest) >= 0) return true;
    for (const k in ART_DEFS) if (slugName(k) === rest) return true;
  }
  if (n.indexOf('spirit_') === 0){
    const rest = n.slice(7);
    if (SPIRIT_DEFS[rest] || ['earth','fire','water','wind'].indexOf(rest) >= 0) return true;
  }
  if (n.indexOf('summon_') === 0){
    const rest = n.slice(7);
    if (['earth','fire','water','wind','sol'].indexOf(rest) >= 0) return true;
    for (const s of SUMMON_DEFS) if (slugName(s.name) === rest) return true;
  }
  if (n.indexOf('item_') === 0 && ITEM_DEFS[n.slice(5)]) return true;
  if (n.indexOf('gear_') === 0 && GEAR_DEFS[n.slice(5)]) return true;
  if (n === 'choice_yes' || n === 'choice_no' || n === 'mark_equipped') return true;
  if (n.indexOf('portrait_') === 0 && CHAR_DEFS[n.slice(9)]) return true;
  if (n === 'well' || n.indexOf('well_') === 0) return true;
  if (n === 'spring' || n.indexOf('spring_') === 0) return true;
  if (/^icon_(fight|arts|spirit|summon|item|defend|flee)$/.test(n)) return true;
  if (/^el_(earth|fire|water|wind|sol|heal)$/.test(n) || /^range_(one|all|ally|party)$/.test(n) || n === 'cursor') return true;
  if (n.indexOf('djinn_battle_') === 0 && SPIRIT_DEFS[n.slice(13)]) return true;
  if (n === 'bg' || n.indexOf('bg_') === 0) return true;
  return false;
}
const ELS4 = ['earth','fire','water','wind'];
const ELS5 = ELS4.concat(['sol']);
const WALK_FRAMES = ['down','down2','up','up2','right','right2'];
const HERO_FRAMES = WALK_FRAMES.concat(['back','attack','attack2','cast','cast2','hit','downed']);
function buildSlotList(){
  const groups = [];
  const g = (title, rows) => groups.push({ title, rows });
  const cap = s => String(s).toLowerCase().replace(/(^|[ _])([a-z])/g, (m, p, c) => p + c.toUpperCase());

  g('Battle enemies', Object.keys(ENEMY_DEFS).filter(k => k.indexOf('djinn_battle_') < 0)
    .map(k => ({ slot: k, desc: cap(ENEMY_DEFS[k].name) + (ENEMY_DEFS[k].boss ? ' (boss)' : '') })));
  g('Spirit duels', SPIRIT_ORDER.map(k => ({ slot: 'djinn_battle_' + k, desc: cap(SPIRIT_DEFS[k].name) + ' in its duel form' })));
  g('Summons', SUMMON_DEFS.map(s => ({ slot: 'sum_' + slugName(s.name), desc: cap(s.name) + ' in its cutscene' }))
    .concat(ELS5.map(el => ({ slot: 'sum_' + el,
      desc: 'fallback for ' + SUMMON_DEFS.filter(s => s.el === el).map(s => cap(s.name)).join(' / ') }))));

  const NPC_ROLES = {
    elder: 'Elder Sorin, Thera village elder, standing on the lane by the west houses',
    mara: 'Mara, Thera shopkeeper, picking mint outside her shop',
    dov: 'Dov, Brindle shopkeeper, west side of the plaza',
    miner: 'Brindle miner, wandering by the inn',
    polly: 'Polly, Thera village kid, east end of the lane (gender not set by the story)',
    ina: "Ina, the innkeeper's daughter, wandering by the Brindle inn",
    hob: 'Hob, the farmer at Mira Farmstead east of Thera, wandering the yard by the inn'
  };
  const chars = [{ id: 'hero', desc: 'generic set, used by every character without a personal skin (13 frames)', fr: HERO_FRAMES }]
    .concat(Object.keys(CHAR_DEFS).map(k => ({ id: k, desc: cap(CHAR_DEFS[k].name) + ' (' + CHAR_DEFS[k].el + ' adept, 13 frames)', fr: HERO_FRAMES })))
    .concat(Object.keys(NPC_PALS).map(k => ({ id: k, desc: (NPC_ROLES[k] || cap(k)) + ' (townsfolk: 6 walk frames)', fr: WALK_FRAMES })));
  g('Characters', chars.map(c => ({ slot: c.id, desc: c.desc,
    many: c.fr.map(f => c.id + '_' + f) })));

  const map = [
    { slot: 'djinn', desc: 'fallback for every collectible spirit on the map' }
  ].concat(SPIRIT_ORDER.map(k => ({ slot: 'djinn_' + k, desc: cap(SPIRIT_DEFS[k].name) + ' on the map' })))
  .concat([
    { slot: 'tree', desc: 'trees on every map', v: true },
    { slot: 'tree_trail', desc: 'trees on the Sunspire Trail only', v: true },
    { slot: 'house', desc: 'generic building pool', v: true },
    { slot: 'house_inn', desc: 'any inn', v: true },
    { slot: 'house_shop', desc: 'any shop', v: true }
  ]).concat(HOUSE_IDS.map(h => ({ slot: 'house_' + h, desc: cap(h.split('_')[0]) + ' ' +
      (h.indexOf('inn') >= 0 ? 'inn' : h.indexOf('shop') >= 0 ? 'shop' : 'house ' + h.split('_')[1]) })))
  .concat([
    { slot: 'fence_h', desc: 'fence run tile (post left, rails to both edges)' },
    { slot: 'fence_post', desc: 'fence end post (rails from the left; mirrored for left ends)' },
    { slot: 'fence_v', desc: 'vertical fence tile' },
    { slot: 'fence_v2', desc: 'vertical fence tile, second variant' },
    { slot: 'boulder', desc: 'the boulder sealing the fence gap', v: true },
    { slot: 'sign', desc: 'signposts', v: true },
    { slot: 'chest', desc: 'treasure chest, closed', v: true },
    { slot: 'chest_open', desc: 'treasure chest, just looted (shown briefly, a GIF plays once)', v: true },
    { slot: 'well', desc: 'the healing well in Thera', v: true },
    { slot: 'spring', desc: 'the spirit spring in the Sunspire', v: true },
    { slot: 'grass', desc: 'ground tile on grassy maps', v: true },
    { slot: 'grass_trail', desc: 'ground tile on the Sunspire Trail only', v: true },
    { slot: 'ogre_s', desc: 'Maw Ogre standing in the mine' },
    { slot: 'wyrm_s', desc: 'Shadow Wyrm on the shrine map' }
  ]);
  g('Map objects', map);

  g('Battle backgrounds', [
    { slot: 'bg', desc: 'fallback for every battle', v: true },
    { slot: 'bg_field', desc: 'Thera Fields and around Brindle', v: true },
    { slot: 'bg_mine', desc: 'Brindle Mine', v: true },
    { slot: 'bg_trail', desc: 'Sunspire Trail', v: true },
    { slot: 'bg_tower', desc: 'inside the Sunspire', v: true },
    { slot: 'bg_summon', desc: 'summon cutscene backdrop, generic' }
  ].concat(ELS5.map(el => ({ slot: 'bg_summon_' + el, desc: 'summon cutscene backdrop, ' + (el === 'sol' ? 'the Sol Avatar (all-element summon)' : el + ' summons') }))));

  const arts = Object.keys(ART_DEFS);
  const ui = ['fight','arts','spirit','summon','item','defend','flee'].map(c => ({ slot: 'icon_' + c, desc: 'toolbar: ' + cap(c) }))
    .concat(arts.map(a => ({ slot: 'fx_' + slugName(a), desc: 'cast effect: ' + cap(a) })))
    .concat(ELS4.concat(['heal']).map(el => ({ slot: 'fx_' + el, desc: 'cast effect fallback: ' + el })))
    .concat(arts.map(a => ({ slot: 'art_' + slugName(a), desc: 'menu icon: ' + cap(a) })))
    .concat(ELS4.concat(['heal']).map(el => ({ slot: 'art_' + el, desc: 'menu icon fallback: ' + el + ' arts' })))
    .concat(SPIRIT_ORDER.map(k => ({ slot: 'spirit_' + k, desc: 'menu icon: ' + cap(SPIRIT_DEFS[k].name) })))
    .concat(ELS4.map(el => ({ slot: 'spirit_' + el, desc: 'menu icon fallback: ' + el + ' spirits' })))
    .concat(SUMMON_DEFS.map(s => ({ slot: 'summon_' + slugName(s.name), desc: 'menu icon: ' + cap(s.name) })))
    .concat(ELS5.map(el => ({ slot: 'summon_' + el, desc: 'menu icon fallback: ' + el + ' summons' })))
    .concat(Object.keys(ITEM_DEFS).map(k => ({ slot: 'item_' + k, desc: 'menu and shop icon: ' + cap(ITEM_DEFS[k].name) })))
    .concat(Object.keys(GEAR_DEFS).map(k => ({ slot: 'gear_' + k, desc: 'shop and equip icon: ' + cap(GEAR_DEFS[k].name) })))
    .concat([{ slot: 'mark_equipped', desc: 'equip screen: the E on gear a member is wearing (drawn over the icon\'s bottom-right corner)' }])
    .concat(Object.keys(CHAR_DEFS).map(k => ({ slot: 'portrait_' + k, desc: 'equip screen portrait: ' + cap(CHAR_DEFS[k].name) + ' (32x32; without it the walking sprite is shown at 2x)' })))
    .concat([['yes','tick'],['no','cross']].map(c => ({ slot: 'choice_' + c[0], desc: 'yes/no box icon: ' + c[1] + ' beside ' + c[0].toUpperCase() })))
    .concat(ELS5.concat(['heal']).map(el => ({ slot: 'el_' + el, desc: 'arts window element badge: ' + el })))
    .concat([['one','one enemy'],['all','every enemy'],['ally','one ally'],['party','the whole party']].map(r => ({ slot: 'range_' + r[0], desc: 'arts window range badge: ' + r[1] })))
    .concat([{ slot: 'cursor', desc: 'menu cursor: the hand pointing at the selected row (fingertip on its right edge)' }]);
  g('Battle interface', ui);
  g('Title screen', [{ slot: 'title', desc: 'the logo on the title screen (up to 240 px wide, drawn over the sky; GIFs animate)' }]);
  g('Font glyphs (one image per character)', GLYPH_NAME_ORDER.filter(n => ['colon','exclamationpoint','semicolon'].indexOf(n) < 0).map(n => {
    const ch = GLYPH_FILES[n];
    const what = n === 'space' ? 'width of a space (optional, any transparent image)' : n === 'arrow' ? 'the cursor arrow' : 'the character ' + ch;
    const size = (n.length === 1 && ch >= 'A' && ch <= 'Z') ? ' (uppercase, 6x8)' : n.indexOf('lowercase-') === 0 ? ' (6x6)' : '';
    return { slot: n, desc: what + size };
  }));
  return groups;
}
function allSlotNames(){
  const out = [];
  for (const grp of buildSlotList()) for (const r of grp.rows){
    if (r.many) out.push.apply(out, r.many); else out.push(r.slot);
  }
  return out;
}
let SLOT_LIST_REV = -1, SLOT_COPY_BOUND = false;
function packCoverage(groups){
  // every loaded sprite goes to the slot it serves: an exact name, else the longest variant prefix
  const slots = [];
  for (const g of groups) for (const r of g.rows){
    if (r.many) r.many.forEach(n => slots.push({ n, v: false })); else slots.push({ n: r.slot, v: !!r.v });
  }
  slots.sort((a, b) => b.n.length - a.n.length);
  const cov = {}, extra = {}, unmatched = [];
  for (const k in USER_SPR){
    if (!userSpr(k)) continue;
    let hit = null;
    for (const s of slots){
      if (k === s.n || (s.v && k.indexOf(s.n + '_') === 0)){ hit = s; break; }
    }
    if (!hit){ unmatched.push(k); continue; }
    if (k === hit.n) cov[k] = true; else (extra[hit.n] = extra[hit.n] || []).push(k);
  }
  for (const k in USER_GLYPH_FILES) cov[k] = true;
  unmatched.sort();
  return { cov, extra, unmatched };
}
function renderSlotList(){
  const el = document.getElementById('slotList');
  if (!el || SLOT_LIST_REV === PACK_REV) return;
  SLOT_LIST_REV = PACK_REV;
  const groups = buildSlotList(), cv = packCoverage(groups);
  const code = n => '<code class="' + (cv.cov[n] ? 'on' : 'off') + '">' + esc(n) + (cv.cov[n] ? ' &#10003;' : '') + '</code>';
  let h = '';
  for (const grp of groups){
    h += '<table><tr><th colspan="2">' + esc(grp.title) + '</th></tr>';
    for (const r of grp.rows){
      const codes = r.many ? r.many.map(code).join(' ') : code(r.slot);
      const ex = (!r.many && cv.extra[r.slot]) ? ' <span class="cov">+ ' + cv.extra[r.slot].map(esc).join(', ') + '</span>' : '';
      h += r.many
        ? '<tr><td colspan="2" class="wrap"><i>' + esc(r.desc) + '</i><br>' + codes + '</td></tr>'
        : '<tr><td>' + codes + (r.v ? ' <i>variants</i>' : '') + ex + '</td><td>' + esc(r.desc) + '</td></tr>';
    }
    h += '</table>';
  }
  el.innerHTML = h;
  const names = allSlotNames();
  const cnt = document.getElementById('slotCount');
  const nCov = Object.keys(cv.cov).length, nEx = Object.values(cv.extra).reduce((a, l) => a + l.length, 0);
  if (cnt){
    if (!nCov && !nEx && !cv.unmatched.length) cnt.innerHTML = names.length + ' named slots, plus open-ended variants. No pack loaded.';
    else cnt.innerHTML = 'Your pack covers <b>' + nCov + '</b> of ' + names.length + ' slots'
      + (nEx ? ' (+' + nEx + ' variant' + (nEx > 1 ? 's' : '') + ')' : '')
      + (cv.unmatched.length
          ? '. <span class="warn">' + cv.unmatched.length + (cv.unmatched.length > 1 ? ' files match' : ' file matches')
            + ' no slot: ' + cv.unmatched.map(esc).join(', ') + '</span>'
          : '.');
  }
  const cp = document.getElementById('slotCopy');
  if (cp && !SLOT_COPY_BOUND){ SLOT_COPY_BOUND = true; cp.addEventListener('click', async () => {
    const text = names.join('\n');
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e){}
    if (!ok){
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (e){}
      ta.remove();
    }
    if (ok) cp.textContent = 'Copied ' + names.length + ' names';
    else {
      const sel = window.getSelection(), rg = document.createRange();
      rg.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(rg);
      cp.textContent = 'List selected - press Ctrl+C';
    }
    setTimeout(() => { cp.textContent = 'Copy all names'; }, 2500);
  }); }
}
function renderPackStatus(report){
  const el = document.getElementById('packStatus');
  if (!el) return;
  if (!report){ el.innerHTML = ''; return; }
  if (report.cleared){ el.innerHTML = '<span class="ok">Built-in art restored.</span>'; return; }
  const bits = [];
  if (report.loaded.length){
    const names = report.loaded.slice(0, 12).join(', ')
      + (report.loaded.length > 12 ? ' +' + (report.loaded.length - 12) + ' more' : '');
    bits.push('<span class="ok">&#10003; Loaded ' + report.loaded.length + ': ' + names + '</span>');
  } else {
    bits.push('<span class="err">&#10007; Nothing loaded.</span>');
  }
  if (report.stored) bits.push('<span class="ok">Saved in this browser &mdash; the pack guide now marks every slot your pack covers.</span>');
  for (const i of report.issues.slice(0, 8)) bits.push('<span class="warn">&#9888; ' + i + '</span>');
  if (report.issues.length > 8) bits.push('<span class="warn">&#9888; +' + (report.issues.length - 8) + ' more issues</span>');
  el.innerHTML = bits.join('<br>');
}
async function importPackFiles(files, report){
  report = report || { loaded: [], issues: [] };
  let idbOk = true, legacy = null;
  for (const f of files){
    const name = f.name.replace(/\.[^.]*$/, '').toLowerCase();
    const gbase = f.name.replace(/\.[^.]*$/, ''); // glyph names are case-sensitive: "A" is uppercase, "lowercase-a" the small one
    if (GLYPH_FILES[gbase] !== undefined){
      const gurl = await blobToDataUrl(f);
      const gdec = gurl ? await decodeFrames(gurl) : null;
      if (!gdec || !setUserGlyph(gbase, gdec)){ report.issues.push(esc(f.name) + ': could not be read as a glyph image'); continue; }
      report.loaded.push(esc(gbase));
      if (idbOk){ try { await packStorePut('glyph:' + gbase, f); continue; } catch(e){ idbOk = false; } }
      if (!legacy){ try { legacy = JSON.parse(localStorage.getItem('sunspire2_pack') || '{}'); } catch(e){ legacy = {}; } }
      legacy['glyph:' + gbase] = gurl;
      continue;
    }
    const url = await blobToDataUrl(f);
    const dec = url ? await decodeFrames(url) : null;
    if (!dec){ report.issues.push(esc(f.name) + ': could not be read as an image'); continue; }
    setUserSprite(name, dec);
    report.loaded.push(esc(name));
    if (!isKnownSlot(name)) report.issues.push(esc(name) + ': no slot with this name (see the pack guide) &mdash; loaded but unused');
    if (idbOk){
      try { await packStorePut(name, f); continue; } catch(e){ idbOk = false; }
    }
    if (!legacy){ try { legacy = JSON.parse(localStorage.getItem('sunspire2_pack') || '{}'); } catch(e){ legacy = {}; } }
    legacy[name] = url;
  }
  if (legacy){ // no IndexedDB: the small localStorage fallback
    try { localStorage.setItem('sunspire2_pack', JSON.stringify(legacy)); report.issues.push('saved with the small fallback store (this browser has no IndexedDB)'); }
    catch(e){ report.issues.push('pack too large for this browser\'s storage &mdash; active this session only'); }
  } else if (report.loaded.length) report.stored = true;
  return report;
}
function clearPack(){
  PACK_REV++;
  clearGlyphs();
  for (const k in USER_SPR) delete USER_SPR[k];
  try { localStorage.removeItem('sunspire2_pack'); } catch(e){}
  packStoreClear().catch(() => {});
}
async function extractZip(file){
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--){
    if (dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const MIME = { png:'image/png', gif:'image/gif', webp:'image/webp' };
  const out = [];
  for (let i = 0; i < count; i++){
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    const base = name.split('/').pop().split('\\').pop();
    const ext = (base.indexOf('.') >= 0 ? base.split('.').pop() : '').toLowerCase();
    if (!MIME[ext]) continue;
    const lnlen = dv.getUint16(lho + 26, true);
    const lxlen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnlen + lxlen;
    let bytes = buf.subarray(start, start + csize);
    if (method === 8){
      if (!window.DecompressionStream) continue;
      const ds = new DecompressionStream('deflate-raw');
      const ab = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
      bytes = new Uint8Array(ab);
    } else if (method !== 0) continue;
    out.push(new File([bytes], base, { type: MIME[ext] }));
  }
  return out;
}
(function(){
  const inp = document.getElementById('packIn');
  const clr = document.getElementById('packClear');
  if (inp) inp.addEventListener('change', async e => {
    const report = { loaded: [], issues: [] };
    let files = [];
    for (const f of Array.from(e.target.files)){
      if (/\.zip$/i.test(f.name)){
        try {
          const got = await extractZip(f);
          if (!got.length) report.issues.push(esc(f.name) + ': zip contained no usable images');
          files = files.concat(got);
        } catch(err){ report.issues.push(esc(f.name) + ': not a readable zip'); }
      } else files.push(f);
    }
    await importPackFiles(files, report);
    renderPackStatus(report);
    renderSlotList();
    const n = report.loaded.length;
    if (G) toast(n ? 'LOADED ' + n + ' SPRITE' + (n > 1 ? 'S' : '') : 'NO SPRITES LOADED');
    inp.value = '';
  });
  if (clr) clr.addEventListener('click', () => { clearPack(); renderPackStatus({cleared:true}); renderSlotList(); if (G) toast('BUILT-IN ART RESTORED'); });
  const hlp = document.getElementById('packHelp');
  const dlg = document.getElementById('packGuide');
  const cls = document.getElementById('packGuideClose');
  if (hlp && dlg) hlp.addEventListener('click', () => { renderSlotList(); dlg.showModal(); });
  if (cls && dlg) cls.addEventListener('click', () => dlg.close());
  if (dlg) dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  const vb = document.getElementById('verBtn');
  const cd = document.getElementById('changelog');
  const cdc = document.getElementById('changelogClose');
  if (vb && cd) vb.addEventListener('click', () => cd.showModal());
  if (cdc && cd) cdc.addEventListener('click', () => cd.close());
  if (cd) cd.addEventListener('click', e => { if (e.target === cd) cd.close(); });
})();
loadPackFromStore().then(() => renderSlotList());

// ---------------- world logic ----------------
function walkable(x, y){
  if (SOLID.has(tileAt(x, y))) return false;
  const e = entityAt(x, y);
  if (e && e.type !== 'spirit') return false;
  return true;
}
function worldUpdate(){
  const P = G.player;
  if (G.dialog){ dialogUpdate(); return; }
  if (G.shop){ shopUpdate(); return; }
  if (G.menu){ menuUpdate(); return; }
  npcUpdate();
  if (pressed.start){ sfx.blip(); G.menu = { view:'main', sel:0, mem:0, slot:0, sub:null, subSel:0 }; return; }
  if (pressed.a){ interact(); if (G.dialog || G.shop) return; }
  if (!P.moving){
    let d = null;
    if (held.up) d = 'up'; else if (held.down) d = 'down';
    else if (held.left) d = 'left'; else if (held.right) d = 'right';
    if (d){
      P.dir = d;
      const [dx, dy] = DIRV[d], nx = P.tx + dx, ny = P.ty + dy;
      const e = entityAt(nx, ny);
      if (e && e.type === 'boss'){ confrontBoss(e.id); return; }
      if (walkable(nx, ny)){ P.moving = true; P.tx = nx; P.ty = ny; }
      else if (tileAt(nx, ny) === 'B'){ bumpBoulder(nx, ny); }
      else if (tileAt(nx, ny) === 'G'){ tryGate(nx, ny); }
    }
  }
  if (P.moving){
    const gx = P.tx*T, gy = P.ty*T, sp = 2;
    if (P.px < gx) P.px = Math.min(gx, P.px + sp);
    if (P.px > gx) P.px = Math.max(gx, P.px - sp);
    if (P.py < gy) P.py = Math.min(gy, P.py + sp);
    if (P.py > gy) P.py = Math.max(gy, P.py - sp);
    if (P.px === gx && P.py === gy){ P.moving = false; onArrive(); }
  }
}
let boulderHinted = false, gateHinted = false;
function bumpBoulder(x, y){
  if (G.player.moving || G.dialog) return;
  if (G.spirits.flint){
    sfx.boom(); G.shake = 14;
    G.map.g[y][x] = 'p'; G.flags.boulder = true;
    say(["FLINT rumbles with joy - the boulder cracks and crumbles to dust!",
         "The way north lies open."]);
    return;
  }
  if (!pressed.a && boulderHinted) return;
  boulderHinted = true;
  say(["A massive boulder seals the only gap in the fence. It will not budge.",
       "Perhaps an EARTH spirit could shatter it..."]);
}
function tryGate(x, y){
  if (G.player.moving || G.dialog) return;
  if (G.flags.spireKey){
    sfx.chest(); G.shake = 6;
    G.map.g[y][x] = 'p'; G.flags.gateOpen = true;
    say(["The SPIRE KEY turns. Ancient bolts grind open!",
         "The Sunspire awaits."]);
    return;
  }
  if (!pressed.a && gateHinted) return;
  gateHinted = true;
  say(["A sealed gate bars the spire steps.", "A heavy keyhole glints. Something in the mine may fit it."]);
}
function onArrive(){
  const P = G.player, ch = tileAt(P.tx, P.ty);
  G.steps++; G.sinceFight++;
  if (G.steps % 8 === 0) for (const m of G.party) if (!m.ko) m.pp = Math.min(m.maxpp, m.pp + 1);
  const e = entityAt(P.tx, P.ty);
  if (e && e.type === 'spirit'){ collectSpirit(e.id); return; }
  const tr = (TRANS[G.mapId]||[]).find(t => t.x === P.tx && t.y === P.ty);
  if (tr){ transition(tr); return; }
  if (ch === '+'){
    let need = false;
    for (const m of G.party) if (m.hp < m.maxhp || m.pp < m.maxpp || m.ko) need = true;
    if (need){
      for (const m of G.party){ m.ko = false; m.hp = m.maxhp; m.pp = m.maxpp; }
      sfx.heal();
      say([G.map.kind === 'shrine' ? "The spirit spring glows. The party is fully restored!"
                                   : "Cool well water. The party is fully restored!"]);
    }
    return;
  }
  if ((ch === 'g' || ch === 'e') && G.sinceFight >= 5 && Math.random() < 0.15){
    G.sinceFight = 0;
    const groups = encounterPool();
    if (groups.length) startBattle(groups[rnd(0, groups.length-1)], null);
  }
}
function encounterPool(){ // the open fields send only lone monsters (and the odd ooze pair) until the party has grown
  if (G.mapId === 'fields' && G.player.ty <= 7 && G.player.tx < 34) return ENC.paddock; // behind the boulder: packs, at any level
  const groups = ENC[G.map.kind] || [];
  if (G.map.kind === 'field' && G.lv < 3) return groups.filter(g => g.length === 1 || (g[0] === 'ooze' && g[1] === 'ooze'));
  return groups;
}
function transition(tr){
  G.mapId = tr.to; G.map = MAPS[tr.to];
  const P = G.player;
  P.tx = tr.tx; P.ty = tr.ty; P.px = tr.tx*T; P.py = tr.ty*T; P.dir = tr.dir; P.moving = false;
  G.fade = 16;
  if (tr.to === 'mine' && !G.flags.bram){
    G.flags.bram = true;
    G.party.push(makeMember('bram', G.lv));
    say(["A broad miner blocks the tunnel... then grins.",
         "BRAM: 'You're the kids hunting spirits? These tunnels eat travelers.'",
         "'I know every shaft. I'm coming - my pick and my fire both.'",
         "BRAM joined the party!"]);
  } else if (tr.to === 'trail' && !G.flags.sera){
    G.flags.sera = true;
    G.party.push(makeMember('sera', G.lv));
    say(["A scout drops from a ledge, bow drawn... then lowers it.",
         "SERA: 'Climbers! Finally. The harpies have me pinned down for days.'",
         "'Heading for the spire gate? Then we share a road.'",
         "SERA joined the party!"]);
  }
  saveGame();
}
function collectSpirit(id){
  const s = SPIRIT_DEFS[id];
  say(["The " + s.el.toUpperCase() + " spirit " + s.name + " bristles and darts into a fighting stance!",
       "It will only follow the strong - prove yourselves!", "Steel barely touches a spirit. Strike with your ARTS!"]
        .concat(ENEMY_DEFS['djinn_battle_' + id].double ? ["It is quick - it will strike twice each turn!"] : []),
      () => startBattle(['djinn_battle_' + id], null, id));
}
function awardSpirit(id){
  const s = SPIRIT_DEFS[id];
  G.spirits[id] = true;
  sfx.spirit();
  saveGame();
  const n = spiritsFound().length;
  const extra = id === 'flint' ? "Its power can shatter boulders."
    : "Each SET spirit strengthens the whole party. Unleash spirits in battle, then SUMMON with the ones on standby!";
  say(["Humbled, the " + s.el.toUpperCase() + " spirit " + s.name + " joins you! (" + n + "/8)", extra,
       n === 8 ? "All eight spirits gathered! The great summons are yours." : ""].filter(x => x));
}
function facingTile(){
  const P = G.player, [dx, dy] = DIRV[P.dir];
  return { x: P.tx + dx, y: P.ty + dy };
}
function interact(){
  const f = facingTile(), ch = tileAt(f.x, f.y), e = entityAt(f.x, f.y);
  if (e && e.type === 'npc'){ npcTalk(e.id); return; }
  if (e && e.type === 'boss'){ confrontBoss(e.id); return; }
  if (ch === 'B'){ bumpBoulder(f.x, f.y); return; }
  if (ch === 'G'){ tryGate(f.x, f.y); return; }
  if (ch === 'k'){ openChest(f.x, f.y); return; }
  if (ch === 's'){
    sfx.blip();
    if (G.mapId === 'fields' && f.x > 36) say(["MIRA FARMSTEAD.", "BEDS AT THE INN - TWELVE COINS. WEST: THERA."]);
    else if (G.mapId === 'fields') say(["NORTH: FENCE GATE AND BRINDLE.", "WEST: LAKE MIRA. BEWARE TALL GRASS.", "EAST ROAD: MIRA FARMSTEAD AND INN."]);
    else say(["BRINDLE MINING TOWN.", "MINE MOUTH UP THE NORTH PATH. KEEP OUT... PLEASE?"]);
    return;
  }
  if (ch === 'D'){
    sfx.blip();
    const hb = (G.map.houses || []).find(h => f.x === h.x + 1 && f.y === h.y + 2);
    if (hb && hb.use === 'shop'){
      say(["MARA: 'Blades, mail and herbs - dawn prices, dear.'"], () => openShop(hb.shop));
    } else if (hb && hb.use === 'inn'){
      innRest();
    } else {
      say(["The door is bolted. Folk hide while the Sunspire is dark."]);
    }
  }
}
function openChest(x, y){
  const key = G.mapId + ':' + x + ',' + y;
  if (G.chests[key]){ say(["The chest is empty."]); return; }
  const c = CHEST_DEFS[key];
  if (!c){ G.chests[key] = true; say(["The chest is empty."]); return; }
  G.chests[key] = true;
  (G.chestT = G.chestT || {})[key] = G.t;
  sfx.chest();
  if (c.gold){ G.gold += c.gold; say(["Found " + c.gold + " coins!"]); }
  else if (c.item){ G.inv[c.item] = (G.inv[c.item]||0) + 1; say(["Found a " + ITEM_DEFS[c.item].name + "!"]); }
  else if (c.gear){ G.gear.push(c.gear); say(["Found a " + GEAR_DEFS[c.gear].name + "!", "Equip it from the menu."]); }
  else if (c.flag){ G.flags[c.flag] = true; say(["Found " + c.name + "!", "Someone must be missing this..."]); }
}
function npcTalk(id){
  sfx.blip();
  if (id === 'elder'){
    if (!G.flags.bossDown && spiritsFound().length < 8)
      say(["SORIN: 'The spirits scattered when the SHADOW WYRM darkened the spire.'",
           "'FLINT hides west of the houses. Another skims the lake.'",
           "'The rest fled north - to Brindle's mine, the high trail, the spire itself.'",
           "'MARA keeps the shop by the lane. The inn up in Brindle rests weary bones.'"]);
    else if (!G.flags.bossDown)
      say(["SORIN: 'All eight walk with you! Unleash them in battle and call the great summons.'",
           "'Now climb, Ari. Bring back the dawn.'"]);
    else
      say(["SORIN: 'The dawn is yours. Thera will sing of this day.'"]);
  } else if (id === 'mara'){
    say(["MARA: 'Just picking mint for the shop counter. Smell that? Lovely.'",
         "'Door's open if you need blades or herbs - let yourself in!'"]);
  } else if (id === 'polly'){
    if (!G.spirits.flint)
      say(["POLLY: 'I saw a little stone critter wink at me behind the west house!'",
           "'Grown-ups never believe me. YOU believe me, right?'"]);
    else
      say(["POLLY: 'You FOUND the stone critter! I knew it was real!'",
           "'When I grow up I'm going to collect ALL the spirits.'"]);
  } else if (id === 'ina'){
    say(["INA: 'Papa runs the inn. Twelve coins and you sleep like a golem!'",
         "'He snores louder than the mine carts, though. You did not hear that from me.'"]);
  } else if (id === 'dov'){
    say(["DOV: 'Iron from our own seams. Best gear north of Thera.'"], () => openShop('brindle'));
  } else if (id === 'hob'){
    say(["HOB: 'Fields run clear to the east woods these days. Mind the tall grass - things bite.'",
         "'The inn is my sister's. Tell her Hob sent you. She will still charge you twelve.'"]);
  } else if (id === 'lyn'){
    if (!G.flags.compass)
      say(["LYN: 'Ari! Took you long enough to crack that boulder.'",
           "'I'd come along, but I lost my COMPASS scouting the paddock north of the fence.'",
           "'I am not walking into a dark spire without it. Find it and we talk.'"]);
    else
      ask(["LYN: 'My compass! You found it in the paddock? You are more useful than you look.'",
           "Ask LYN to join the party?"], () => {
        G.flags.lyn = true;
        G.party.push(makeMember('lyn', G.lv));
        say(["LYN: 'Fine - someone has to patch you up. Try to keep up.'", "LYN joined the party!"]);
      }, () => say(["LYN: 'Suit yourself. I will be around the plaza when you change your mind.'"]));
  } else if (id === 'miner'){
    if (!G.flags.ogre)
      say(["MINER: 'A MAW OGRE nests in the east gallery, squatting on the old SPIRE KEY.'",
           "'It flattened three carts. Mind your skulls.'"]);
    else
      say(["MINER: 'You flattened the ogre?! Drinks on me. Well. One drink.'"]);
  }
}
function confrontBoss(id){
  if (G.battle || G.dialog) return;
  if (id === 'ogre')
    say(["The tunnel shakes. A mountain of muscle rises from a nest of splintered carts.",
         "MAW OGRE: 'GRRAAH! MY tunnel! MY shiny key!'"], () => startBattle(['ogre'], 'ogre'));
  else
    say(["SHADOW WYRM: 'Ssso... children of the dawn come to reclaim the light.'",
         "'Four little flames. I will sssnuff you one by one.'"], () => startBattle(['wyrm'], 'wyrm'));
}

// ---------------- shop ----------------
function openShop(id){
  sfx.ok();
  G.shop = { id, sel:0 };
}
function innRest(){
  if (G.gold < 12){
    say(["INNKEEPER: 'A warm bed is 12 coins. Come back when your purse agrees.'"]);
    return;
  }
  say(["INNKEEPER: 'Twelve coins for warm beds and a hot meal. Sleep well.'"], () => {
    G.gold -= 12;
    for (const m of G.party){ m.ko = false; m.hp = m.maxhp; m.pp = m.maxpp; }
    G.fade = 16;
    sfx.heal();
    saveGame();
    say(["The party sleeps deep and dreamless.", "HP and PP restored. Game saved."]);
  });
}
function shopUpdate(){
  const s = G.shop, stock = SHOPS[s.id].stock;
  if (pressed.up){ s.sel = (s.sel + stock.length - 1) % stock.length; sfx.blip(); }
  if (pressed.down){ s.sel = (s.sel + 1) % stock.length; sfx.blip(); }
  if (pressed.b || pressed.start){ sfx.blip(); G.shop = null; return; }
  if (pressed.a){
    const [kind, key] = stock[s.sel];
    const def = kind === 'item' ? ITEM_DEFS[key] : GEAR_DEFS[key];
    if (G.gold >= def.price){
      G.gold -= def.price;
      if (kind === 'item') G.inv[key] = (G.inv[key]||0) + 1;
      else G.gear.push(key);
      sfx.coin(); toast('BOUGHT ' + def.name);
    } else { sfx.no(); toast('NOT ENOUGH COINS'); }
  }
}
function shopDraw(){
  const s = G.shop, stock = SHOPS[s.id].stock, n = stock.length;
  const rows = stock.map(([kind, key]) => {
    const def = kind === 'item' ? ITEM_DEFS[key] : GEAR_DEFS[key];
    let tag = '';
    if (kind === 'gear') tag = def.kind === 'wpn' ? 'ATK+' + def.atk : 'DEF+' + def.def;
    else if (def.heal) tag = def.heal >= 999 ? 'FULL HP' : 'HP+' + def.heal;
    else if (def.pp) tag = 'PP+' + def.pp;
    else if (def.revive) tag = 'REVIVE';
    return { def, tag, slot: (kind === 'item' ? 'item_' : 'gear_') + key };
  });
  // rows grow to fit the icons (pack icons are often 16px) as far as the list still fits the window
  const fitH = Math.floor(120 / n) - 1;
  const cell = iconCell(rows.map(r => r.slot), fitH);
  const rowH = Math.max(12, cell.h + 1), off = cursorRowY(0);
  const R = 224; // right edge of the price column
  const priceW = Math.max(...rows.map(r => textW(r.def.price + '')));
  const tagX = R - priceW - 8 - Math.max(...rows.map(r => textW(r.tag)));
  box(6, 4, 228, 152);
  text(SHOPS[s.id].keeper + "'S GOODS", 16, 9, '#f2c14e');
  text(G.gold + ' COINS', R - textW(G.gold + ' COINS'), 9, '#e8c84b');
  for (let i = 0; i < n; i++){
    const r = rows[i], cy = 21 + i*rowH + (rowH >> 1), y = cy - off;
    if (i === s.sel) drawCursor(17, cy);
    drawIconFit(r.slot, 19 + cell.w/2, cy, cell.w, cell.h);
    text(r.def.name, 19 + cell.w + 4, y, i === s.sel ? '#f2c14e' : '#e9e0c8');
    text(r.tag, tagX, y, '#9a91b8');
    text(r.def.price + '', R - textW(r.def.price + ''), y, '#e8c84b');
  }
  text('A: BUY   B: LEAVE', 16, 143, '#9a91b8');
}

// ---------------- pause menu ----------------
function menuUpdate(){
  const M = G.menu;
  if (M.view === 'main'){
    const items = ['STATUS','ITEMS','EQUIP','SPIRITS','SAVE'];
    if (pressed.up){ M.sel = (M.sel + items.length - 1) % items.length; sfx.blip(); }
    if (pressed.down){ M.sel = (M.sel + 1) % items.length; sfx.blip(); }
    if (pressed.b || pressed.start){ sfx.blip(); G.menu = null; return; }
    if (pressed.a){
      sfx.blip();
      const v = items[M.sel];
      if (v === 'SAVE'){ toast(saveGame() ? 'GAME SAVED' : 'SAVE FAILED'); }
      else { M.view = v.toLowerCase(); M.mem = 0; M.slot = 0; M.sub = null; M.subSel = 0; M.sel2 = 0; }
    }
    return;
  }
  if (pressed.b){ sfx.blip(); if (M.sub) M.sub = null; else M.view = 'main'; return; }
  if (M.view === 'status'){
    if (pressed.left){ M.mem = (M.mem + G.party.length - 1) % G.party.length; sfx.blip(); }
    if (pressed.right){ M.mem = (M.mem + 1) % G.party.length; sfx.blip(); }
    return;
  }
  if (M.view === 'spirits') return;
  if (M.view === 'items'){
    const keys = Object.keys(G.inv).filter(k => G.inv[k] > 0);
    if (!M.sub){
      if (keys.length === 0) return;
      M.sel2 = clamp(M.sel2, 0, keys.length-1);
      if (pressed.up){ M.sel2 = (M.sel2 + keys.length - 1) % keys.length; sfx.blip(); }
      if (pressed.down){ M.sel2 = (M.sel2 + 1) % keys.length; sfx.blip(); }
      if (pressed.a){ M.sub = keys[M.sel2]; M.subSel = 0; sfx.blip(); }
    } else {
      if (pressed.left){ M.subSel = (M.subSel + G.party.length - 1) % G.party.length; sfx.blip(); }
      if (pressed.right){ M.subSel = (M.subSel + 1) % G.party.length; sfx.blip(); }
      if (pressed.a){
        const m = G.party[M.subSel];
        if (useItemOn(M.sub, m, false)) M.sub = null;
      }
    }
    return;
  }
  if (M.view === 'equip'){ // first pick a member (M.sub null), then a piece of gear in the grid (M.sub 'grid')
    const m = G.party[M.mem];
    if (!M.sub){
      if (pressed.left){ M.mem = (M.mem + G.party.length - 1) % G.party.length; sfx.blip(); }
      if (pressed.right){ M.mem = (M.mem + 1) % G.party.length; sfx.blip(); }
      if (pressed.a){ M.sub = 'grid'; M.subSel = 0; M.scroll = 0; sfx.blip(); }
      return;
    }
    const cells = equipCells(m), n = cells.length, cols = equipGrid(cells).cols;
    if (!n) return;
    M.subSel = clamp(M.subSel, 0, n - 1);
    if (pressed.left){ M.subSel = (M.subSel + n - 1) % n; sfx.blip(); }
    if (pressed.right){ M.subSel = (M.subSel + 1) % n; sfx.blip(); }
    if (pressed.up && M.subSel - cols >= 0){ M.subSel -= cols; sfx.blip(); }
    if (pressed.down && M.subSel + cols < n){ M.subSel += cols; sfx.blip(); }
    if (pressed.a){
      const c = cells[M.subSel], slot = GEAR_DEFS[c.key].kind;
      if (c.eq){ G.gear.push(c.key); m[slot] = null; sfx.blip(); } // take it off: back to the shared pool
      else {
        G.gear.splice(G.gear.indexOf(c.key), 1);
        if (m[slot]) G.gear.push(m[slot]);
        m[slot] = c.key; sfx.ok();
      }
      const now = equipCells(m); // keep the cursor on the piece that moved
      M.subSel = Math.max(0, now.findIndex(x => x.key === c.key && x.eq === !c.eq));
    }
  }
}
// the equip grid: the member's own gear first (marked E), then the shared pool, weapons before armour, best first
function equipCells(m){
  const val = k => GEAR_DEFS[k].atk || GEAR_DEFS[k].def || 0;
  const pool = G.gear.slice().sort((a, b) => (GEAR_DEFS[a].kind === GEAR_DEFS[b].kind ? val(b) - val(a) : GEAR_DEFS[a].kind === 'wpn' ? -1 : 1));
  return [m.wpn, m.arm].filter(Boolean).map(key => ({ key, eq: true })).concat(pool.map(key => ({ key, eq: false })));
}
function equipGrid(cells){ // cells grow with the icons (16px pack icons get 20px cells) inside the 122x76 grid window
  const ic = iconCell(cells.map(c => 'gear_' + c.key), 16);
  const cs = Math.max(16, Math.max(ic.w, ic.h) + 4);
  return { ic, cs, cols: Math.floor(122 / cs), rows: Math.floor(76 / cs) };
}
function useItemOn(key, m, inBattle){
  const it = ITEM_DEFS[key];
  if (it.revive){
    if (!m.ko){ sfx.no(); toast('NOT DOWNED'); return false; }
    m.ko = false; m.hp = Math.floor(m.maxhp * .5);
  } else if (m.ko){ sfx.no(); toast(m.name + ' IS DOWN'); return false; }
  else if (it.heal){
    if (m.hp >= m.maxhp){ sfx.no(); toast('HP ALREADY FULL'); return false; }
    m.hp = Math.min(m.maxhp, m.hp + it.heal);
  } else if (it.pp){
    if (m.pp >= m.maxpp){ sfx.no(); toast('PP ALREADY FULL'); return false; }
    m.pp = Math.min(m.maxpp, m.pp + it.pp);
  }
  G.inv[key]--;
  sfx.heal();
  if (!inBattle) toast(it.name + ' USED ON ' + m.name);
  return true;
}
function questHint(){
  if (!G.spirits.flint) return 'FIND FLINT WEST OF THE HOUSES.';
  if (!G.flags.boulder) return 'SHATTER THE BOULDER IN THE FENCE GAP.';
  if (!G.flags.compass) return "FIND LYN'S COMPASS IN THE NORTH PADDOCK.";
  if (!G.flags.lyn) return 'ASK LYN IN BRINDLE TO JOIN YOU.';
  if (!G.flags.ogre) return 'CLEAR THE OGRE FROM BRINDLE MINE.';
  if (!G.flags.gateOpen) return 'UNLOCK THE SPIRE GATE ON THE TRAIL.';
  if (!G.flags.bossDown) return 'FACE THE WYRM ATOP THE SUNSPIRE.';
  return 'THE DAWN IS YOURS.';
}
function menuDraw(){
  const M = G.menu;
  if (M.view === 'equip'){ equipDraw(M); return; }
  box(6, 6, 228, 148);
  if (M.view === 'main'){
    const items = ['STATUS','ITEMS','EQUIP','SPIRITS','SAVE'];
    for (let i = 0; i < items.length; i++){
      const y = 18 + i*13;
      if (i === M.sel) drawCursor(19, cursorRowY(y));
      text(items[i], 22, y, i === M.sel ? '#f2c14e' : '#e9e0c8');
    }
    text(G.gold + ' COINS', 22, 92, '#e8c84b');
    text('SPIRITS ' + spiritsFound().length + '/8', 22, 103, '#9a91b8');
    text('PARTY LV ' + G.lv, 22, 114, '#9a91b8');
    // party mini-plates
    for (let i = 0; i < G.party.length; i++){
      const m = G.party[i], x = 108, y = 16 + i*26, R = 224; // numbers hug the right edge, bars fill the gap, so wider fonts fit
      text(m.name, x, y, ELCOL[m.el]);
      const lx = x + Math.max(textW(m.name) + 4, 34), hpTxt = m.hp + '/' + m.maxhp;
      const bx = lx + textW('HP') + 3, bw = Math.max(8, R - textW(hpTxt) - 3 - bx), by = glyphFontOn() ? 2 : 0;
      text('HP', lx, y, '#9a91b8'); bar(bx, y + by, bw, 5, m.hp, m.maxhp, m.ko ? '#c94a6a' : '#5fb86a');
      text(hpTxt, R - textW(hpTxt), y, '#e9e0c8');
      text('PP', lx, y+9, '#9a91b8'); bar(bx, y + 9 + by, bw, 5, m.pp, m.maxpp, '#4fa8e8');
    }
    const hl = wrap('QUEST: ' + questHint(), 35);
    text(hl[0], 14, 130, '#e9e0c8');
    if (hl[1]) text(hl[1], 14, 140, '#e9e0c8');
    return;
  }
  if (M.view === 'status'){
    const m = G.party[M.mem];
    text('< ' + m.name + ' >', 14, 14, ELCOL[m.el], 2);
    text('LV ' + G.lv + '   XP TO NEXT: ' + (xpNext(G.lv) - G.xp), 14, 32, '#9a91b8');
    { const lbl = 'HP ' + m.hp + '/' + m.maxhp, bx = 14 + textW(lbl) + 6; text(lbl, 14, 46, '#e9e0c8'); bar(bx, 46 + (glyphFontOn() ? 2 : 0), Math.max(20, 226 - bx), 5, m.hp, m.maxhp, '#5fb86a'); }
    { const lbl = 'PP ' + m.pp + '/' + m.maxpp, bx = 14 + textW(lbl) + 6; text(lbl, 14, 57, '#e9e0c8'); bar(bx, 57 + (glyphFontOn() ? 2 : 0), Math.max(20, 226 - bx), 5, m.pp, m.maxpp, '#4fa8e8'); }
    text('ATK ' + eAtk(m) + ' (' + m.atk + '+)', 14, 71, '#e9e0c8');
    text('DEF ' + eDef(m) + ' (' + m.def + '+)', 110, 71, '#e9e0c8');
    text('AGI ' + m.agi, 14, 82, '#e9e0c8');
    text('WPN: ' + (m.wpn ? GEAR_DEFS[m.wpn].name : '----'), 14, 98, '#e9e0c8');
    text('ARM: ' + (m.arm ? GEAR_DEFS[m.arm].name : '----'), 14, 109, '#e9e0c8');
    text('ARTS:', 14, 123, '#f2c14e');
    const arts = CHAR_DEFS[m.id].arts.filter(a => a[1] <= G.lv).map(a => a[0]);
    text(arts.join(' / ') || '----', 50, 123, '#e9e0c8');
    text('LEFT/RIGHT: MEMBER  B: BACK', 14, 141, '#9a91b8');
    return;
  }
  if (M.view === 'spirits'){
    text('SPIRITS', 14, 14, '#f2c14e', 2);
    for (let i = 0; i < SPIRIT_ORDER.length; i++){
      const k = SPIRIT_ORDER[i], s = SPIRIT_DEFS[k];
      const x = 14 + (i%2)*112, y = 34 + Math.floor(i/2)*14;
      const got = G.spirits[k];
      ctx.fillStyle = got ? ELCOL[s.el] : 'rgba(255,255,255,.12)';
      ctx.fillRect(x, y, 5, 5);
      text(got ? s.name : '?????', x+10, y, got ? '#e9e0c8' : '#4a4266');
      if (got) text(s.el.toUpperCase(), x+58, y, ELCOL[s.el]);
    }
    text('EACH SET SPIRIT: +1 ATK +1 DEF', 14, 100, '#9a91b8');
    text('UNLEASH IN BATTLE, THEN SUMMON', 14, 111, '#9a91b8');
    text('WITH THE STANDBY SPIRITS.', 14, 122, '#9a91b8');
    text('B: BACK', 14, 141, '#9a91b8');
    return;
  }
  if (M.view === 'items'){
    text('ITEMS', 14, 14, '#f2c14e', 2);
    const keys = Object.keys(G.inv).filter(k => G.inv[k] > 0);
    if (keys.length === 0 && !(G.flags.compass && !G.flags.lyn)) text('NOTHING CARRIED.', 14, 36, '#9a91b8');
    for (let i = 0; i < keys.length; i++){
      const y = 34 + i*12;
      if (i === M.sel2 && !M.sub) drawCursor(19, cursorRowY(y));
      text(ITEM_DEFS[keys[i]].name, 22, y, '#e9e0c8');
      text('X' + G.inv[keys[i]], 110, y, '#9a91b8');
    }
    if (G.flags.compass && !G.flags.lyn){
      const y = 34 + keys.length*12;
      text("LYN'S COMPASS", 22, y, '#e8c84b'); text('KEY', 110, y, '#9a91b8');
    }
    if (M.sub){
      box(30, 90, 180, 40);
      text('USE ' + ITEM_DEFS[M.sub].name + ' ON:', 38, 97, '#f2c14e');
      for (let i = 0; i < G.party.length; i++){
        const m = G.party[i];
        text(m.name, 38 + i*48, 112, i === M.subSel ? '#f2c14e' : (m.ko ? '#c94a6a' : '#e9e0c8'));
      }
    } else text('A: USE  B: BACK', 14, 141, '#9a91b8');
    return;
  }
}
// the equip screen, in panels: party sprites (top left), the member's card (left), a prompt (top right),
// the gear grid (right), help (bottom right) and the purse (bottom)
function equipDraw(M){
  const m = G.party[M.mem], picking = !M.sub, off = cursorRowY(0);
  const cells = equipCells(m);
  if (!picking) M.subSel = clamp(M.subSel, 0, Math.max(0, cells.length - 1));
  const sel = picking ? null : cells[M.subSel];
  // party: everyone standing in a row, the chosen one walking with the hand beside them
  box(2, 2, 104, 36);
  const n = G.party.length, sp = Math.min(24, Math.floor(84 / Math.max(1, n - 1)));
  const x0 = Math.round(54 - ((n - 1) * sp + 16) / 2);
  for (let i = 0; i < n; i++){
    const x = x0 + i*sp, me = i === M.mem;
    drawHero(x, 16, 'down', me && picking ? (G.t >> 3) & 1 : 0, G.party[i].pal);
    if (me) drawCursor(x + 6, 30); // the hand rests on their feet, pointing in
  }
  // the member's card: portrait, name, level, HP / PP, and ATK / DEF with a preview of the selected piece
  box(2, 40, 104, 96);
  drawPortrait(m, 7, 45);
  text(m.name, 43, 47, ELCOL[m.el]);
  text('LV', 43, 59, '#9a91b8'); text(G.lv + '', 100 - textW(G.lv + ''), 59, '#e9e0c8');
  const row = (lbl, y, cur, nxt) => {
    text(lbl, 8, y, '#9a91b8');
    if (nxt === undefined || nxt === cur){ text(cur + '', 100 - textW(cur + ''), y, '#e9e0c8'); return; }
    text(cur + '', 66 - textW(cur + ''), y, '#e9e0c8');
    text('>', 71, y, '#9a91b8');
    text(nxt + '', 100 - textW(nxt + ''), y, nxt > cur ? '#7cd88a' : '#e2543a');
  };
  row('HP', 82, m.hp + '/' + m.maxhp);
  row('PP', 92, m.pp + '/' + m.maxpp);
  let alt;
  if (sel){ const slot = GEAR_DEFS[sel.key].kind; alt = Object.assign({}, m, { [slot]: sel.eq ? null : sel.key }); }
  row('ATK', 106, eAtk(m), alt && eAtk(alt));
  row('DEF', 116, eDef(m), alt && eDef(alt));
  row('NEXT', 126, xpNext(G.lv) - G.xp);
  // prompt: the question, or the name of the piece under the cursor
  box(108, 2, 130, 18);
  text(picking ? 'WHOSE GEAR?' : sel ? GEAR_DEFS[sel.key].name : 'NO GEAR', 114, 11 - off + 1, picking ? '#e9e0c8' : '#f2c14e');
  // the grid
  box(108, 22, 130, 84);
  const g = equipGrid(cells), gx = 108 + ((130 - g.cols * g.cs) >> 1), gy = 26 + ((76 - g.rows * g.cs) >> 1);
  if (!cells.length) text('NO GEAR YET.', 116, 30, '#9a91b8');
  const selRow = picking ? 0 : Math.floor(M.subSel / g.cols);
  M.scroll = clamp(M.scroll || 0, Math.max(0, selRow - g.rows + 1), selRow);
  for (let i = M.scroll * g.cols; i < cells.length && i < (M.scroll + g.rows) * g.cols; i++){
    const c = cells[i], r = Math.floor(i / g.cols) - M.scroll, cx = gx + (i % g.cols) * g.cs, cy = gy + r * g.cs;
    if (sel && i === M.subSel){ ctx.fillStyle = '#2f4cc4'; ctx.fillRect(cx, cy, g.cs, g.cs); }
    drawIconFit('gear_' + c.key, cx + g.cs/2, cy + g.cs/2, g.ic.w, g.ic.h);
    if (c.eq) drawBadge('mark_equipped', cx + g.cs - 4, cy + g.cs - 4, false);
  }
  if (sel) drawCursor(gx + (M.subSel % g.cols) * g.cs + (g.cs >> 1), gy + (selRow - M.scroll + 1) * g.cs - 3); // over the cell's lower left
  ctx.fillStyle = '#eef0ff'; // scroll nubs
  if (M.scroll > 0){ ctx.fillRect(229, 23, 5, 1); ctx.fillRect(230, 22, 3, 1); }
  if ((M.scroll + g.rows) * g.cols < cells.length){ ctx.fillRect(229, 104, 5, 1); ctx.fillRect(230, 105, 3, 1); }
  // help
  box(108, 108, 130, 28);
  let h1, h2;
  if (picking){ h1 = 'LEFT/RIGHT: WHO'; h2 = 'A:CHOOSE  B:BACK'; }
  else if (sel){
    const d = GEAR_DEFS[sel.key];
    h1 = (d.kind === 'wpn' ? 'WEAPON  ATK+' + d.atk : 'ARMOUR  DEF+' + d.def);
    h2 = (sel.eq ? 'A:REMOVE' : 'A:EQUIP') + '  B:BACK';
  } else { h1 = 'NOTHING TO EQUIP'; h2 = 'B:BACK'; }
  text(h1, 114, 113, '#e9e0c8'); text(h2, 114, 124, '#9a91b8');
  // purse
  box(2, 138, 236, 20);
  text(G.gold + ' COINS', 14, 148 - off, '#e8c84b');
  text('SPIRITS ' + spiritsFound().length + '/8', 226 - textW('SPIRITS ' + spiritsFound().length + '/8'), 148 - off, '#9a91b8');
}
// a member's portrait in a 32x32 frame: the pack's portrait_<id>, else their own sprite at 2x, head and shoulders
function drawPortrait(m, x, y){
  ctx.fillStyle = shade(ELCOL[m.el], .45); ctx.fillRect(x, y, 32, 32);
  if (userSpr('portrait_' + m.id)) drawIconFit('portrait_' + m.id, x + 16, y + 16, 32, 32);
  else {
    const u = userSpr(m.id + '_down') || userSpr('hero_down'), h = u ? u.height : 16;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, 32, 32); ctx.clip();
    ctx.translate(x, y + Math.max(0, h - 16) * 2 + 2); ctx.scale(2, 2);
    drawHero(0, 0, 'down', 0, m.pal);
    ctx.restore();
  }
  ctx.fillStyle = '#eef0ff';
  ctx.fillRect(x - 1, y - 1, 34, 1); ctx.fillRect(x - 1, y + 32, 34, 1); ctx.fillRect(x - 1, y, 1, 32); ctx.fillRect(x + 32, y, 1, 32);
}

// ---------------- world drawing (y-sorted, semi-3D) ----------------
function worldDraw(){
  const P = G.player;
  const camx = clamp(Math.round(P.px) + 8 - W/2, 0, G.map.w*T - W);
  const camy = clamp(Math.round(P.py) + 8 - H/2, 0, G.map.h*T - H);
  ctx.save();
  ctx.translate(-camx, -camy);
  const x0 = Math.floor(camx/T), y0 = Math.floor(camy/T);
  const spriteHouses = !!(G.map.houses && houseMemo().any);
  const spriteBoulder = boulderVariants().length > 0;
  const spriteSign = signVariants().length > 0;
  const spriteChest = chestVariants(false).length > 0 || chestVariants(true).length > 0;
  const spriteWell = wellSpringVariants(pal().flr ? 'spring' : 'well').length > 0;
  for (let y = y0; y <= y0 + H/T; y++)
    for (let x = x0; x <= x0 + W/T; x++)
      if (x < G.map.w && y < G.map.h){
        const ch = tileAt(x, y);
        if (ch === 't' || ch === 'F' || (spriteBoulder && ch === 'B') || (spriteSign && ch === 's') || (spriteChest && ch === 'k') || (spriteWell && ch === '+') || (spriteHouses && 'RQWD'.indexOf(ch) >= 0)) drawGroundBase(x*T, y*T, x, y);
        else drawTile(ch, x, y);
      }
  if (!spriteHouses && G.map.houses)
    for (const hb of G.map.houses) drawHousePlaque(hb);
  // y-sorted tall things and characters
  const draws = [];
  // scan past the screen edges so tall or wide sprites (trees, pack art) are drawn before their tile scrolls in
  for (let y = Math.max(0,y0-1); y <= Math.min(G.map.h-1, y0 + H/T + 3); y++)
    for (let x = Math.max(0, x0 - 2); x <= Math.min(G.map.w-1, x0 + W/T + 2); x++)
      if (tileAt(x, y) === 't'){
        const tx = x*T, ty = y*T;
        draws.push({ fy: ty + 16, fn: () => drawTree(tx, ty) });
      } else if (spriteBoulder && tileAt(x, y) === 'B'){
        const tx = x*T, ty = y*T;
        draws.push({ fy: ty + 16, fn: () => drawBoulderSpr(tx, ty) });
      } else if (spriteSign && tileAt(x, y) === 's'){
        const tx = x*T, ty = y*T;
        draws.push({ fy: ty + 16, fn: () => drawSignSpr(tx, ty) });
      } else if (spriteChest && tileAt(x, y) === 'k'){
        const tx = x*T, ty = y*T;
        draws.push({ fy: ty + 16, fn: () => drawChestSpr(tx, ty) });
      } else if (spriteWell && tileAt(x, y) === '+'){
        const tx = x*T, ty = y*T;
        draws.push({ fy: ty + 16, fn: () => drawWellSpr(tx, ty) });
      } else if (tileAt(x, y) === 'F'){
        const cx = x, cy = y;
        draws.push({ fy: cy*T + 16, fn: () => drawFence(cx, cy) });
      }
  if (spriteHouses)
    for (const hb of G.map.houses)
      draws.push({ fy: hb.y*T + 48, fn: () => drawHouse(hb) });
  for (const e of entitiesFor(G.map)){
    const ex = e.x*T, ey = e.y*T;
    if (e.type === 'npc'){
      const n = G.npcs[e.id];
      const nx = n ? Math.round(n.px) : ex, ny = n ? Math.round(n.py) : ey;
      let face, step = 0;
      if (n && n.moving){
        face = n.dir;
        step = (Math.floor((nx + ny) / 8)) % 2;
      } else {
        face = (Math.abs(P.tx - e.x) + Math.abs(P.ty - e.y) === 1)
          ? (P.tx < e.x ? 'left' : P.tx > e.x ? 'right' : P.ty < e.y ? 'up' : 'down')
          : (n ? n.dir : 'down');
      }
      draws.push({ fy: ny + 16, fn: () => { drawShadow(nx, ny); drawHero(nx, ny, face, step, NPC_PALS[e.id] || CHAR_DEFS[e.id].pal); } });
    } else if (e.type === 'spirit'){
      draws.push({ fy: ey + 16, fn: () => drawSpiritSprite(e.id, ex, ey, G.t + e.x*13) });
    } else if (e.type === 'boss' && !e.ghost){
      draws.push({ fy: ey + 16, fn: () => e.id === 'wyrm' ? drawWyrmSmall(ex, ey - 4, G.t) : drawOgreSmall(ex, ey, G.t) });
    }
  }
  const step = P.moving ? ((Math.floor((P.px + P.py) / 8)) % 2) : 0;
  const ppx = Math.round(P.px), ppy = Math.round(P.py);
  draws.push({ fy: ppy + 16, fn: () => { drawShadow(ppx, ppy); drawHero(ppx, ppy, P.dir, step, G.party[0].pal); } });
  draws.sort((a, b) => a.fy - b.fy);
  for (const d of draws) d.fn();
  ctx.restore();
  // HUD: spirit pips
  for (let i = 0; i < 8; i++){
    const k = SPIRIT_ORDER[i];
    ctx.fillStyle = G.spirits[k] ? ELCOL[SPIRIT_DEFS[k].el] : 'rgba(255,255,255,.15)';
    ctx.fillRect(5 + i*7, 5, 5, 5);
  }
  textO(G.map.name, 66, 5, '#e9e0c8', '#16122b');
  if (G.dialog) dialogDraw();
  if (G.shop) shopDraw();
  if (G.menu) menuDraw();
  if (G.toast){
    G.toast.t--;
    if (G.toast.t <= 0) G.toast = null;
    else { const tw = textW(G.toast.msg) + 12;
      box(Math.round((W-tw)/2), 96, tw, 13); textC(G.toast.msg, W/2, 100, '#f2c14e'); }
  }
}

// ---------------- battle: setup ----------------
function enemySlots(n, boss){ // enemies stand at native size (1x), like the party
  if (boss) return [{x:78, y:96, s:1}];
  if (n === 1) return [{x:80, y:96, s:1}];
  if (n === 2) return [{x:54, y:92, s:1}, {x:116, y:100, s:1}];
  return [{x:42, y:94, s:1}, {x:88, y:86, s:1}, {x:134, y:102, s:1}];
}
function partyPos(i){ // top-left of the battle sprite (native 16x22); the last member stands nearest the corner
  const k = G.party.length - 1 - i;
  return { x: 218 - k*14, y: 138 - k*5 };
}
function partySlot(i){ const p = partyPos(i); return { x: p.x + 8, y: p.y + 6 }; }
function startBattle(groupKeys, bossId, spiritAward){
  const noflee = groupKeys.some(k => ENEMY_DEFS[k] && ENEMY_DEFS[k].noflee);
  const enemies = groupKeys.map(k => {
    const d = ENEMY_DEFS[k];
    return { kind:k, name:d.name, hp:d.hp, max:d.hp, atk:d.atk, def:d.def, agi:d.agi,
             xp:d.xp, gold:d.gold, drop:d.drop || null, drain:!!d.drain, boss:!!d.boss, phys:d.phys || 1, double:!!d.double,
             stun:false, flash:0, slot:null };
  });
  const tot = {}, seen = {};
  enemies.forEach(e => { tot[e.kind] = (tot[e.kind]||0) + 1; });
  enemies.forEach(e => {
    if (tot[e.kind] > 1){ seen[e.kind] = (seen[e.kind]||0) + 1; e.name += ' ' + 'ABC'[seen[e.kind]-1]; }
  });
  const sl = enemySlots(enemies.length, !!bossId);
  enemies.forEach((e, i) => e.slot = sl[i] || sl[0]);
  const sstate = {};
  spiritsFound().forEach(k => sstate[k] = 'set');
  G.battle = {
    enemies, boss:bossId, sstate, noflee, spiritAward: spiritAward || null,
    phase:'input', inputIdx:0, cmds:[], menuList:[], menuSel:0,
    sub:null, subSel:0, pendCmd:null, targetSel:0,
    msgs:[], msgT:0, after:null, queue:[],
    cine:null, fx:0, fxCol:null, fxSlot:null, pflash:-1, pflashT:0, hurt:null,
    t:0, wyrmHealed:false, zoom:0, subScroll:0
  };
  sfx.hit(); G.shake = 8;
  nextInput(0);
}
function learnedArtNames(m){ return CHAR_DEFS[m.id].arts.filter(a => a[1] <= G.lv).map(a => a[0]); }
function standbyByEl(el){ return SPIRIT_ORDER.filter(k => G.battle.sstate[k] === 'standby' && SPIRIT_DEFS[k].el === el); }
function availSummons(){
  return SUMMON_DEFS.filter(s => {
    if (s.need === 'all') return ['earth','fire','water','wind'].every(el => standbyByEl(el).length >= 1);
    return standbyByEl(s.el).length >= s.need;
  });
}
function buildMenu(m){
  const b = G.battle, L = [{id:'fight', label:'FIGHT'}];
  if (learnedArtNames(m).length) L.push({id:'arts', label:'ARTS'});
  if (SPIRIT_ORDER.some(k => b.sstate[k] === 'set')) L.push({id:'spirit', label:'SPIRIT'});
  if (availSummons().length) L.push({id:'summon', label:'SUMMON'});
  if (Object.keys(G.inv).some(k => G.inv[k] > 0)) L.push({id:'item', label:'ITEM'});
  L.push({id:'defend', label:'DEFEND'});
  L.push({id:'flee', label:'FLEE'});
  return L;
}
function nextInput(from){
  const b = G.battle;
  let i = from;
  while (i < G.party.length && G.party[i].ko) i++;
  if (i >= G.party.length){ beginExec(); return; }
  b.inputIdx = i; b.phase = 'input'; b.menuSel = 0; b.sub = null; b.pendCmd = null;
  b.menuList = buildMenu(G.party[i]);
}
function setCmd(cmd){
  const b = G.battle;
  b.cmds[b.inputIdx] = cmd;
  sfx.blip();
  nextInput(b.inputIdx + 1);
}
function firstAliveEnemy(){ const b = G.battle; for (let i = 0; i < b.enemies.length; i++) if (b.enemies[i].hp > 0) return i; return 0; }
function aliveEnemy(idx){
  const b = G.battle;
  if (b.enemies[idx] && b.enemies[idx].hp > 0) return b.enemies[idx];
  return b.enemies[firstAliveEnemy()];
}
function bmsg(lines, after){
  const b = G.battle;
  b.msgs = b.msgs.concat(lines);
  b.after = after || null;
  b.phase = 'msg'; b.msgT = 0;
}

// ---------------- battle: update ----------------
function battleUpdate(){
  const b = G.battle;
  b.t++;
  if (b.fx > 0){
    if (!b.fxTotal){ b.fxTotal = b.fx; b.fxStart = performance.now(); } // first tick of a new effect
    b.fx--;
    // an animated pack overlay is held until it has played once through by the wall clock, so it runs at
    // its native speed whatever the display's refresh rate
    const u = fxSprite(b);
    if (b.fx <= 0 && u && u.frames.length > 1 && performance.now() - b.fxStart < u.total * FX_SLOW) b.fx = 1;
    if (b.fx <= 0) b.fxTotal = 0;
  }
  if (b.pflashT > 0) b.pflashT--;
  if (b.anim && --b.anim.t <= 0) b.anim = null;
  if (b.hurt && --b.hurt.t <= 0) b.hurt = null;
  b.enemies.forEach(e => { if (e.flash > 0) e.flash--; });
  // the camera eases in over the party's shoulder while an enemy is being targeted
  const wantZoom = b.phase === 'target' ? 1 : 0;
  b.zoom += (wantZoom - b.zoom) * .22;
  if (Math.abs(wantZoom - b.zoom) < .02) b.zoom = wantZoom;
  if (b.phase === 'cine'){ cineUpdate(); return; }
  if (b.phase === 'msg'){
    b.msgT++;
    if (pressed.a || pressed.start || b.msgT > 55){
      b.msgs.shift(); b.msgT = 0;
      if (b.msgs.length === 0){
        const fn = b.after; b.after = null;
        if (fn) fn(); else if (G.battle) nextInput(0);
      }
    }
    return;
  }
  if (b.phase === 'input'){
    const L = b.menuList;
    if (pressed.up || pressed.left){ b.menuSel = (b.menuSel + L.length - 1) % L.length; sfx.blip(); }
    if (pressed.down || pressed.right){ b.menuSel = (b.menuSel + 1) % L.length; sfx.blip(); }
    if (pressed.b){
      let p = b.inputIdx - 1;
      while (p >= 0 && G.party[p].ko) p--;
      if (p >= 0){ b.cmds[p] = null; b.inputIdx = p; b.menuList = buildMenu(G.party[p]); b.menuSel = 0; sfx.blip(); }
      return;
    }
    if (pressed.a){
      const id = L[b.menuSel].id;
      sfx.blip();
      if (id === 'fight'){ b.pendCmd = {type:'fight'}; b.phase = 'target'; b.targetSel = firstAliveEnemy(); }
      else if (id === 'defend') setCmd({type:'defend'});
      else if (id === 'flee') setCmd({type:'flee'});
      else { b.sub = id; b.subSel = 0; b.subScroll = 0; b.phase = 'sub'; }
    }
    return;
  }
  if (b.phase === 'sub'){
    const list = subList();
    if (list.length === 0){ b.phase = 'input'; return; }
    b.subSel = clamp(b.subSel, 0, list.length - 1);
    if (pressed.up){ b.subSel = (b.subSel + list.length - 1) % list.length; sfx.blip(); }
    if (pressed.down){ b.subSel = (b.subSel + 1) % list.length; sfx.blip(); }
    if (pressed.b){ b.phase = 'input'; b.sub = null; sfx.blip(); return; }
    if (pressed.a){
      const m = G.party[b.inputIdx], sel = list[b.subSel];
      if (sel.dim){ sfx.no(); return; }
      if (b.sub === 'arts'){
        const a = ART_DEFS[sel.key];
        if (a.heal){ b.pendCmd = {type:'art', art:sel.key}; b.phase = 'targetAlly'; b.targetSel = b.inputIdx; }
        else { b.pendCmd = {type:'art', art:sel.key, aoe:!!a.aoe}; b.phase = 'target'; b.targetSel = firstAliveEnemy(); } // area arts pick a focus too
      } else if (b.sub === 'spirit'){
        const sd = SPIRIT_DEFS[sel.key];
        if (sd.heal){ b.pendCmd = {type:'spirit', spirit:sel.key}; b.phase = 'targetAlly'; b.targetSel = b.inputIdx; }
        else if (sd.healAll) setCmd({type:'spirit', spirit:sel.key});
        else { b.pendCmd = {type:'spirit', spirit:sel.key, aoe:!!sd.aoe}; b.phase = 'target'; b.targetSel = firstAliveEnemy(); }
      } else if (b.sub === 'summon'){
        setCmd({type:'summon', summon:sel.key});
      } else if (b.sub === 'item'){
        b.pendCmd = {type:'item', item:sel.key}; b.phase = 'targetAlly'; b.targetSel = b.inputIdx;
      }
    }
    return;
  }
  if (b.phase === 'target'){
    const alive = b.enemies.map((e,i) => e.hp > 0 ? i : -1).filter(i => i >= 0);
    let cur = alive.indexOf(b.targetSel); if (cur < 0) cur = 0;
    if (pressed.left){ cur = (cur + alive.length - 1) % alive.length; sfx.blip(); }
    if (pressed.right){ cur = (cur + 1) % alive.length; sfx.blip(); }
    b.targetSel = alive[cur];
    if (pressed.b){ b.phase = b.sub ? 'sub' : 'input'; sfx.blip(); return; }
    if (pressed.a){ const c = b.pendCmd; c.target = b.targetSel; setCmd(c); }
    return;
  }
  if (b.phase === 'targetAlly'){
    if (pressed.left){ b.targetSel = (b.targetSel + G.party.length - 1) % G.party.length; sfx.blip(); }
    if (pressed.right){ b.targetSel = (b.targetSel + 1) % G.party.length; sfx.blip(); }
    if (pressed.b){ b.phase = b.sub ? 'sub' : 'input'; sfx.blip(); return; }
    if (pressed.a){ const c = b.pendCmd; c.mtarget = b.targetSel; setCmd(c); }
    return;
  }
}
function subList(){
  const b = G.battle, m = G.party[b.inputIdx];
  if (b.sub === 'arts')
    return learnedArtNames(m).map(n => { const a = ART_DEFS[n];
      return {key:n, label:n, tag:'PP ' + a.cost, dim:m.pp < a.cost, col:a.col, el:a.el, range:a.heal ? 'ally' : a.aoe ? 'all' : 'one', desc:ART_DESC[n] || ''}; });
  if (b.sub === 'spirit')
    return SPIRIT_ORDER.filter(k => b.sstate[k] === 'set')
      .map(k => { const d = SPIRIT_DEFS[k];
        return {key:k, label:d.name, tag:'', dim:false, col:ELCOL[d.el], el:d.el, range:d.heal ? 'ally' : d.healAll ? 'party' : d.aoe ? 'all' : 'one', desc:spiritDesc(d)}; });
  if (b.sub === 'summon')
    return availSummons().map(s => ({key:SUMMON_DEFS.indexOf(s), label:s.name, dim:false, col:ELCOL[s.el], el:s.el, range:'all', desc:summonDesc(s),
      tag: s.need === 'all' ? '1' : '' + s.need, els: s.need === 'all' ? ELS4.slice() : [s.el] })); // the spirits it needs: a count and one badge per element
  if (b.sub === 'item')
    return Object.keys(G.inv).filter(k => G.inv[k] > 0)
      .map(k => ({key:k, label:ITEM_DEFS[k].name, tag:'X' + G.inv[k], dim:false, col:'#e9e0c8', range:'ally', desc:itemDesc(ITEM_DEFS[k])}));
  return [];
}
// one-line descriptions for the arts window (the art list is the game's own; keep each under 32 characters)
const ART_DESC = {
  'QUAKE':'Attack with a tremor.', 'SPIRE':'Attack with a spire of stone.', 'GAIA BLADE':'Cleave with the earth itself.',
  'FLARE':'Attack with flaring flames.', 'FIRE BOMB':'Blast every foe with fire.', 'INFERNO':'Engulf every foe in flame.',
  'CURE':'Restore 70 HP to one ally.', 'ICE HORN':'Attack with a horn of ice.', 'PURE PLY':'Fully heal one ally.',
  'GUST':'Attack with a cutting gust.', 'PLASMA':'Strike every foe with lightning.', 'BOLT':'Attack with a thunderbolt.'
};
function spiritDesc(d){
  if (d.heal) return 'Heal one ally ' + Math.round(d.heal*100) + '% of max HP.';
  if (d.healAll) return 'Heal the party ' + Math.round(d.healAll*100) + '% of max HP.';
  if (d.aoe) return d.pow + ' ' + d.el + ' damage to every foe.';
  return d.pow + ' ' + d.el + ' damage to one foe' + (d.stun ? ', staggers it.' : '.');
}
function summonDesc(s){
  const need = s.need === 'all' ? 'one spirit of each element' : s.need + ' ' + s.el + ' on standby';
  const extra = s.healAll ? ' Heals ' + Math.round(s.healAll*100) + '%.' : s.stun ? ' Staggers.' : '';
  return 'Needs ' + need + '. Power ' + s.pow + ', all foes.' + extra;
}
function itemDesc(it){
  if (it.revive) return 'Revive a fallen ally at half HP.';
  if (it.heal) return 'Restore ' + it.heal + ' HP to one ally.';
  return 'Restore ' + it.pp + ' PP to one ally.';
}

// ---------------- battle: execution ----------------
function beginExec(){
  const b = G.battle, acts = [];
  G.party.forEach((m, i) => { if (!m.ko && b.cmds[i]) acts.push({side:'p', i, agi:m.agi + rnd(0, 2)}); });
  b.enemies.forEach((e, i) => {
    if (e.hp <= 0) return;
    acts.push({side:'e', i, agi:e.agi + rnd(0, 2)});
    if (e.double) acts.push({side:'e', i, agi:e.agi - 4 + rnd(0, 2)}); // quick spirits strike twice
  });
  acts.sort((x, y) => y.agi - x.agi);
  b.queue = acts; b.phase = 'exec';
  stepQueue();
}
function stepQueue(){
  const b = G.battle;
  if (!b) return;
  if (checkEnd()) return;
  const a = b.queue.shift();
  if (!a){
    G.party.forEach(m => m.defending = false);
    b.cmds = [];
    nextInput(0);
    return;
  }
  if (a.side === 'p'){
    const m = G.party[a.i];
    if (m.ko){ stepQueue(); return; }
    doCmd(m, b.cmds[a.i], a.i);
  } else {
    const e = b.enemies[a.i];
    if (e.hp <= 0){ stepQueue(); return; }
    if (e.stun){ e.stun = false; bmsg([e.name + ' is staggered and cannot move!'], stepQueue); return; }
    doEnemy(e);
  }
}
function checkEnd(){
  const b = G.battle;
  if (b.enemies.every(e => e.hp <= 0)) return victory();
  if (G.party.every(m => m.ko)) return defeat();
  return false;
}
// area attacks have a focus: the enemy under the big droplet takes full damage, the rest 70%
function splash(dmg, e, focus){ return e === focus ? dmg : Math.max(1, Math.floor(dmg * .7)); }
function hitEnemy(e, dmg, col, slotFx){
  e.hp = Math.max(0, e.hp - dmg);
  e.flash = 12;
  if (slotFx){ const b = G.battle; b.fx = 18; b.fxTotal = 0; b.fxCol = col || '#fff'; b.fxSlot = e.slot; }
  G.shake = 5;
}
function doCmd(m, cmd, mi){
  const b = G.battle;
  if (!cmd){ stepQueue(); return; }
  if (cmd.type === 'fight') b.anim = { i: mi, kind: 'attack', t: 26 };
  else if (cmd.type === 'art' || cmd.type === 'spirit' || cmd.type === 'summon') b.anim = { i: mi, kind: 'cast', t: 26 };
  if (cmd.type === 'fight'){
    const e = aliveEnemy(cmd.target);
    let dmg = Math.max(1, eAtk(m) + rnd(0, 4) - e.def), note = '';
    if (e.phys < 1){ dmg = Math.max(1, Math.floor(dmg * e.phys)); note = e.boss ? ' Its hide shrugs off steel!' : ' Its ward dulls the blow!'; }
    hitEnemy(e, dmg, null, false);
    sfx.hit();
    bmsg([m.name + ' attacks ' + e.name + '! ' + dmg + ' damage!' + note], stepQueue);
  } else if (cmd.type === 'art'){
    const a = ART_DEFS[cmd.art];
    if (m.pp < a.cost){ bmsg([m.name + ' lacks the PP for ' + cmd.art + '!'], stepQueue); return; }
    m.pp -= a.cost;
    if (a.heal){
      const t = G.party[cmd.mtarget !== undefined ? cmd.mtarget : 0];
      if (t.ko){ bmsg([t.name + ' is down - the light finds no hold!'], stepQueue); return; }
      const amt = Math.min(a.heal, t.maxhp - t.hp);
      t.hp += amt;
      sfx.heal(); b.fx = 18; b.fxTotal = 0; b.fxCol = a.col; b.fxKind = 'heal'; b.fxArt = slugName(cmd.art);
      b.fxSlot = partySlot(cmd.mtarget !== undefined ? cmd.mtarget : 0);
      bmsg([cmd.art + '! ' + t.name + ' recovers ' + amt + ' HP!'], stepQueue);
    } else if (a.aoe){
      sfx.spell();
      const parts = [], focus = aliveEnemy(cmd.target);
      for (const e of b.enemies) if (e.hp > 0){
        const dmg = splash(Math.max(1, a.pow + (eAtk(m) >> 1) + G.lv + rnd(0, 3) - e.def), e, focus);
        hitEnemy(e, dmg, a.col, false);
        parts.push(dmg);
      }
      b.fx = 18; b.fxTotal = 0; b.fxCol = a.col; b.fxKind = a.el; b.fxArt = slugName(cmd.art); b.fxSlot = focus.slot;
      bmsg([cmd.art + '! ' + parts.join(' + ') + ' damage!'], stepQueue);
    } else {
      const e = aliveEnemy(cmd.target);
      const dmg = Math.max(1, a.pow + (eAtk(m) >> 1) + G.lv + rnd(0, 3) - e.def);
      hitEnemy(e, dmg, a.col, true);
      b.fxKind = a.el; b.fxArt = slugName(cmd.art);
      sfx.spell();
      bmsg([cmd.art + '! ' + dmg + ' damage to ' + e.name + '!'], stepQueue);
    }
  } else if (cmd.type === 'spirit'){
    const k = cmd.spirit, sd = SPIRIT_DEFS[k];
    if (b.sstate[k] !== 'set'){ bmsg([sd.name + ' is not set!'], stepQueue); return; }
    b.sstate[k] = 'standby';
    const nm = sd.name + ' unleashes!';
    if (sd.heal){
      const t = G.party[cmd.mtarget !== undefined ? cmd.mtarget : 0];
      const amt = t.ko ? 0 : Math.min(Math.floor(t.maxhp * sd.heal), t.maxhp - t.hp);
      if (!t.ko) t.hp += amt;
      sfx.heal(); b.fx = 20; b.fxTotal = 0; b.fxCol = ELCOL[sd.el]; b.fxKind = 'heal'; b.fxArt = null;
      b.fxSlot = partySlot(cmd.mtarget !== undefined ? cmd.mtarget : 0);
      bmsg([nm, t.ko ? 'But ' + t.name + ' is down!' : t.name + ' recovers ' + amt + ' HP!'], stepQueue);
    } else if (sd.healAll){
      let tot = 0;
      for (const t of G.party) if (!t.ko){ const amt = Math.min(Math.floor(t.maxhp * sd.healAll), t.maxhp - t.hp); t.hp += amt; tot += amt; }
      sfx.heal(); b.fx = 20; b.fxTotal = 0; b.fxCol = ELCOL[sd.el]; b.fxSlot = null;
      bmsg([nm, 'The party recovers ' + tot + ' HP!'], stepQueue);
    } else if (sd.aoe){
      sfx.spell();
      const parts = [], focus = aliveEnemy(cmd.target);
      for (const e of b.enemies) if (e.hp > 0){
        const dmg = splash(Math.max(1, sd.pow + G.lv*4 + rnd(0, 3) - (e.def >> 1)), e, focus);
        hitEnemy(e, dmg, ELCOL[sd.el], false);
        parts.push(dmg);
      }
      b.fx = 18; b.fxTotal = 0; b.fxCol = ELCOL[sd.el]; b.fxKind = sd.el; b.fxArt = null; b.fxSlot = focus.slot;
      bmsg([nm, parts.join(' + ') + ' damage!'], stepQueue);
    } else {
      const e = aliveEnemy(cmd.target);
      const dmg = Math.max(1, sd.pow + G.lv*4 + rnd(0, 3) - (e.def >> 1));
      hitEnemy(e, dmg, ELCOL[sd.el], true);
      b.fxKind = sd.el; b.fxArt = null;
      sfx.spell();
      const extra = sd.stun ? ' ' + e.name + ' staggers!' : '';
      if (sd.stun) e.stun = true;
      bmsg([nm, dmg + ' damage!' + extra], stepQueue);
    }
  } else if (cmd.type === 'item'){
    const k = cmd.item, it = ITEM_DEFS[k];
    if (!G.inv[k]){ bmsg(['No ' + it.name + ' left!'], stepQueue); return; }
    const t = G.party[cmd.mtarget !== undefined ? cmd.mtarget : 0];
    if (it.revive){
      if (!t.ko){ bmsg([t.name + ' is still standing!'], stepQueue); return; }
      G.inv[k]--; t.ko = false; t.hp = Math.floor(t.maxhp * .5);
      sfx.heal();
      bmsg([m.name + ' uses an ELIXIR! ' + t.name + ' rises again!'], stepQueue);
    } else if (t.ko){
      bmsg([t.name + ' is down - use an ELIXIR!'], stepQueue);
    } else {
      G.inv[k]--;
      let msg;
      if (it.heal){ const amt = Math.min(it.heal, t.maxhp - t.hp); t.hp += amt; msg = t.name + ' recovers ' + amt + ' HP!'; }
      else { const amt = Math.min(it.pp, t.maxpp - t.pp); t.pp += amt; msg = t.name + ' recovers ' + amt + ' PP!'; }
      sfx.heal();
      bmsg([m.name + ' uses a ' + it.name + '! ' + msg], stepQueue);
    }
  } else if (cmd.type === 'summon'){
    const def = SUMMON_DEFS[cmd.summon];
    const ok = def.need === 'all'
      ? ['earth','fire','water','wind'].every(el => standbyByEl(el).length >= 1)
      : standbyByEl(def.el).length >= def.need;
    if (!ok){ bmsg(['The spirits for ' + def.name + ' are spent!'], stepQueue); return; }
    if (def.need === 'all'){
      for (const el of ['earth','fire','water','wind']) b.sstate[standbyByEl(el)[0]] = 'spent';
    } else {
      for (let i = 0; i < def.need; i++) b.sstate[standbyByEl(def.el)[0]] = 'spent';
    }
    b.cine = { def, t:0, caster:m, len: cineLen(def) };
    b.phase = 'cine';
    sfx.summon();
  } else if (cmd.type === 'defend'){
    m.defending = true;
    bmsg([m.name + ' guards!'], stepQueue);
  } else if (cmd.type === 'flee'){
    if (b.boss || b.noflee){ sfx.no(); bmsg(['No escape - the foe blocks every path!'], stepQueue); return; }
    if (Math.random() < .6){ sfx.ok(); bmsg([m.name + ' leads the escape!'], () => { G.battle = null; }); }
    else { sfx.no(); bmsg(["Couldn't get away!"], stepQueue); }
  } else stepQueue();
}
function doEnemy(e){
  const b = G.battle;
  const targets = G.party.map((m, i) => m.ko ? -1 : i).filter(i => i >= 0);
  if (targets.length === 0){ stepQueue(); return; }
  if (e.kind === 'wyrm' && (b.wyrmHealed|0) < 2 && e.hp < e.max * .55 && Math.random() < .5){
    b.wyrmHealed = (b.wyrmHealed|0) + 1;
    e.hp = Math.min(e.max, e.hp + 220);
    sfx.spell();
    bmsg([e.name + ' gnaws the darkness and knits its wounds!'], stepQueue);
    return;
  }
  let aoe = false, mult = 1, label = e.name + ' attacks!';
  if (e.kind === 'ogre' && Math.random() < .35){ aoe = true; mult = .7; label = e.name + ' sweeps a great SMASH!'; }
  if (e.kind === 'wyrm' && Math.random() < .4){ aoe = true; mult = .75; label = e.name + ' breathes SHADOW FLAME!'; }
  sfx.hurt(); G.shake = 7;
  const lines = [label];
  if (aoe){
    const parts = [];
    for (const i of targets){
      const m = G.party[i];
      let dmg = Math.max(1, Math.floor((e.atk * mult)) + rnd(0, 3) - eDef(m));
      if (m.defending) dmg = Math.max(1, dmg >> 1);
      m.hp = Math.max(0, m.hp - dmg);
      parts.push(m.name + ' ' + dmg);
      if (m.hp === 0){ m.ko = true; }
    }
    b.pflash = -2; b.pflashT = 10; b.hurt = { i: -2, t: 24 };
    lines.push(parts.join('  '));
  } else {
    const i = targets[rnd(0, targets.length - 1)];
    const m = G.party[i];
    let dmg = Math.max(1, e.atk + rnd(0, 4) - eDef(m));
    if (m.defending) dmg = Math.max(1, dmg >> 1);
    m.hp = Math.max(0, m.hp - dmg);
    b.pflash = i; b.pflashT = 10; b.hurt = { i, t: 24 };
    lines[0] = e.name + ' strikes ' + m.name + '! ' + dmg + ' damage!';
    if (e.drain && m.hp > 0){
      const dr = Math.floor(dmg / 3);
      e.hp = Math.min(e.max, e.hp + dr);
      lines.push('It drains ' + dr + ' HP!');
    }
    if (m.hp === 0){ m.ko = true; lines.push(m.name + ' falls!'); }
  }
  for (const m of G.party) if (m.hp === 0 && !m.ko) m.ko = true;
  if (aoe){
    const downNames = G.party.filter((m, i) => m.ko && targets.indexOf(i) >= 0 && m.hp === 0).map(m => m.name);
    if (downNames.length) lines.push(downNames.join(', ') + (downNames.length > 1 ? ' fall!' : ' falls!'));
  }
  bmsg(lines, stepQueue);
}
function victory(){
  const b = G.battle;
  G.wins++;
  sfx.win();
  if (b.boss === 'wyrm'){
    bmsg([b.enemies[0].name + ' lets out a final shriek...',
          'The Wyrm dissolves into mist!',
          'Warm light floods the Sunspire!'], () => {
      G.battle = null; G.flags.bossDown = true; G.mode = 'ending'; G.t = 0; saveGame();
    });
    return true;
  }
  let xp = 0, gold = 0;
  const lines = ['VICTORY!'];
  for (const e of b.enemies){ xp += e.xp; gold += e.gold; }
  G.gold += gold;
  lines.push('GOT ' + xp + ' XP AND ' + gold + ' COINS!');
  for (const e of b.enemies){
    if (e.drop && Math.random() < e.drop[2]){
      const [kind, key] = e.drop;
      if (kind === 'item'){ G.inv[key] = (G.inv[key]||0) + 1; lines.push('IT DROPPED A ' + ITEM_DEFS[key].name + '!'); }
      else { G.gear.push(key); lines.push('IT DROPPED A ' + GEAR_DEFS[key].name + '!'); }
    }
  }
  if (b.boss === 'ogre'){
    G.flags.ogre = true; G.flags.spireKey = true;
    lines.push('OBTAINED THE SPIRE KEY!');
  }
  G.xp += xp;
  while (G.xp >= xpNext(G.lv)){
    G.xp -= xpNext(G.lv);
    G.lv++;
    lines.push('PARTY LEVEL ' + G.lv + '!');
    for (const m of G.party){
      const gr = CHAR_DEFS[m.id].grow;
      m.maxhp += gr.hp; m.maxpp += gr.pp; m.atk += gr.atk; m.def += gr.def; m.agi += gr.agi;
      m.hp = m.maxhp; m.pp = m.maxpp;
      for (const a of CHAR_DEFS[m.id].arts) if (a[1] === G.lv) lines.push(m.name + ' LEARNED ' + a[0] + '!');
    }
  }
  bmsg(lines, () => {
    for (const m of G.party) if (m.ko){ m.ko = false; m.hp = 1; }
    const award = b.spiritAward;
    G.battle = null;
    saveGame();
    if (award) awardSpirit(award);
  });
  return true;
}
function defeat(){
  sfx.lose();
  bmsg(['The party collapses...', 'Everything fades to grey...'], () => {
    G.battle = null;
    for (const m of G.party){ m.ko = false; m.hp = m.maxhp; m.pp = m.maxpp; }
    G.mapId = 'fields'; G.map = MAPS.fields;
    const P = G.player;
    P.tx = 18; P.ty = 22; P.px = 18*T; P.py = 22*T; P.dir = 'down'; P.moving = false;
    G.fade = 20;
    say(['You awaken in Thera, aching but alive.', "Sorin's poultice smells terrible. It works."]);
  });
  return true;
}

// ---------------- summon cutscene ----------------
function summonBackdrop(def){ return userSpr('bg_summon_' + def.el) || userSpr('bg_summon'); }
function cineLen(def){ // at least 126 frames; longer when an animated backdrop needs the time to play once
  const u = summonBackdrop(def);
  if (!u || u.frames.length < 2) return 126;
  return Math.max(126, Math.ceil(u.total / 1000 * 60) + 20);
}
function cineUpdate(){
  const b = G.battle, c = b.cine, L = c.len || 126;
  c.t++;
  if (c.t === L - 34){ sfx.boom(); G.shake = 12; }
  if (c.t >= L){
    const def = c.def;
    b.cine = null;
    const lines = [def.name + ' answers the call!'];
    const parts = [];
    for (const e of b.enemies) if (e.hp > 0){
      const dmg = Math.max(1, def.pow + G.lv*5 + rnd(0, 5) - (e.def >> 1));
      hitEnemy(e, dmg, ELCOL[def.el], false);
      if (def.stun) e.stun = true;
      parts.push(dmg);
    }
    if (parts.length) lines.push(parts.join(' + ') + ' damage!' + (def.stun ? ' Foes stagger!' : ''));
    if (def.healAll){
      let tot = 0;
      for (const t of G.party) if (!t.ko){ const amt = Math.min(Math.floor(t.maxhp * def.healAll), t.maxhp - t.hp); t.hp += amt; tot += amt; }
      lines.push('The party recovers ' + tot + ' HP!');
    }
    bmsg(lines, stepQueue);
  }
}
function cineDraw(){
  const b = G.battle, c = b.cine, t = c.t, def = c.def, col = ELCOL[def.el], L = c.len || 126;
  const bgu = summonBackdrop(def);
  const fx = 120;
  if (bgu){ // a pack backdrop replaces the whole scene: full screen, played once from the cutscene start
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(sprFrameAt(bgu, t * 1000 / 60).img, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#0c0a16'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = col;
    for (let i = 0; i < 8; i++){
      ctx.globalAlpha = .04 + i * .022;
      ctx.fillRect(0, H - (i+1)*20, W, 20);
    }
    ctx.globalAlpha = .25;
    for (let i = 0; i < 10; i++){
      const a = i * Math.PI/5 + t * .01;
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(fx, 46);
      ctx.lineTo(fx + Math.cos(a)*140, 46 + Math.sin(a)*140); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // descending figure, landing 46 frames before the end
  const land = L - 46;
  if (t > 20){
    const p = clamp((t - 20) / (land - 20), 0, 1);
    const ease = 1 - (1 - p) * (1 - p);
    const fy = Math.round(-50 + ease * 106);
    const sc = def.el === 'sol' ? 4 : 3;
    drawSummonFig(def, fx, fy, t, sc, true);
    drawSummonFig(def, fx, fy, t, sc, false);
  }
  if (t > L - 54) textCO(def.name + '!', 120, 124, '#ffffff', '#241c40', 2);
  // letterbox
  const lb = Math.min(16, t*2);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, lb); ctx.fillRect(0, H - lb, W, lb);
  if (t >= L - 34 && t < L - 18){
    ctx.globalAlpha = (L - 18 - t) / 16;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

// ---------------- battle: drawing ----------------
const BG_TYPE = { field:'field', town:'field', mine:'mine', trail:'trail', shrine:'tower' };
const BG_NAMES = ['field', 'mine', 'trail', 'tower'];
function bgVariants(type){
  const out = [];
  for (const k in USER_SPR){
    if (!userSpr(k)) continue;
    const parts = k.split('_');
    if (parts[0] !== 'bg') continue;
    const isTyped = parts.length > 1 && BG_NAMES.indexOf(parts[1]) >= 0;
    if (type ? (isTyped && parts[1] === type) : !isTyped) out.push(k);
  }
  return out;
}
function pickBgKey(type){
  let c = bgVariants(type);
  if (!c.length) c = bgVariants(null);
  return c.length ? c[rnd(0, c.length - 1)] : null;
}
function battleBG(){
  const kind = G.map.kind, sway = Math.round(Math.sin(G.t / 90) * 7);
  const b = G.battle;
  if (b && b.bgPick === undefined) b.bgPick = pickBgKey(BG_TYPE[kind] || 'field');
  const bgu = b && b.bgPick ? userSpr(b.bgPick) : null;
  if (bgu){
    ctx.drawImage(sprFrame(bgu).img, 0, 0, W, H);
    return;
  }
  let sky, gtop, gbot, line;
  if (kind === 'mine'){ sky = ['#241c14','#2e241c','#3a2c20']; gtop = '#4a3b32'; gbot = '#3a2c22'; line = 'rgba(0,0,0,.25)'; }
  else if (kind === 'shrine'){ sky = ['#191430','#241f42','#332c56']; gtop = '#3b3752'; gbot = '#2c283e'; line = 'rgba(0,0,0,.3)'; }
  else if (kind === 'trail'){ sky = ['#2c3a78','#6a4a8f','#c9756a']; gtop = '#8f9a4a'; gbot = '#6e7a35'; line = 'rgba(0,0,0,.18)'; }
  else { sky = ['#2c3a78','#8a5a8f','#e8a05a']; gtop = '#4f9b3f'; gbot = '#3d6e33'; line = 'rgba(0,0,0,.18)'; }
  for (let i = 0; i < 3; i++){ ctx.fillStyle = sky[i]; ctx.fillRect(0, i*14, W, 14); }
  ctx.fillStyle = sky[2]; ctx.fillRect(0, 28, W, 16);
  // ground plane with perspective
  ctx.fillStyle = gtop; ctx.fillRect(0, 44, W, H - 44);
  ctx.fillStyle = gbot; ctx.fillRect(0, 96, W, H - 96);
  const vx = 120 + sway;
  ctx.strokeStyle = line; ctx.lineWidth = 1;
  for (let i = -5; i <= 5; i++){
    ctx.beginPath();
    ctx.moveTo(vx + i*10, 44);
    ctx.lineTo(vx + i*52, H);
    ctx.stroke();
  }
  for (let k = 1; k <= 5; k++){
    const y = 44 + k*k*4.4;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // distant rim
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  for (let x = 0; x < W; x += 10){
    const hh = 4 + (h32(x, 7, 3) % 8);
    ctx.fillRect(x, 44 - hh, 10, hh);
  }
}
function drawCmdIcon(id, cx, cy, sel){
  const u = userSpr('icon_' + id);
  if (u){
    const f = sprFrame(u).img;
    const yy = cy - (sel ? 2 : 0); // the chosen icon simply sits a little higher
    ctx.drawImage(f, Math.round(cx - f.width/2), Math.round(yy - f.height/2));
    return;
  }
  const r = sel ? 9 : 8, x = cx, y = cy - (sel ? 2 : 0);
  ctx.fillStyle = '#0c0a16';
  ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = sel ? '#3a2f6e' : '#241d49';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = sel ? '#ffd94e' : '#b9aed8';
  if (id === 'fight'){
    for (let i = 0; i < 5; i++) ctx.fillRect(x - 4 + i, y + 2 - i, 2, 2);
    ctx.fillRect(x - 3, y + 1, 4, 2);
    ctx.fillRect(x - 5, y + 3, 2, 3);
  } else if (id === 'arts'){
    ctx.fillRect(x - 1, y - 5, 2, 10); ctx.fillRect(x - 5, y - 1, 10, 2);
    ctx.fillRect(x - 3, y - 3, 2, 2); ctx.fillRect(x + 1, y + 1, 2, 2);
    ctx.fillRect(x + 1, y - 3, 2, 2); ctx.fillRect(x - 3, y + 1, 2, 2);
  } else if (id === 'spirit'){
    ctx.fillRect(x - 3, y - 2, 7, 5); ctx.fillRect(x - 2, y - 4, 2, 2);
    ctx.fillRect(x + 3, y + 1, 2, 2);
    ctx.fillStyle = sel ? '#241d49' : '#0c0a16'; ctx.fillRect(x - 1, y - 1, 1, 2);
  } else if (id === 'summon'){
    ctx.fillRect(x, y - 3, 3, 3);
    ctx.fillRect(x - 2, y - 1, 2, 2); ctx.fillRect(x - 4, y + 1, 2, 2); ctx.fillRect(x - 6, y + 3, 2, 2);
    ctx.fillRect(x + 2, y - 5, 2, 2);
  } else if (id === 'item'){
    ctx.fillRect(x - 1, y - 5, 2, 2); ctx.fillRect(x - 2, y - 3, 4, 2);
    ctx.fillRect(x - 3, y - 1, 6, 6);
  } else if (id === 'defend'){
    ctx.fillRect(x - 4, y - 4, 8, 6);
    ctx.fillRect(x - 3, y + 2, 6, 2); ctx.fillRect(x - 1, y + 4, 2, 2);
  } else if (id === 'flee'){
    ctx.fillRect(x - 5, y - 1, 7, 2);
    ctx.fillRect(x + 1, y - 3, 2, 2); ctx.fillRect(x + 3, y - 1, 2, 2); ctx.fillRect(x + 1, y + 1, 2, 2);
    ctx.fillRect(x - 7, y - 3, 2, 1); ctx.fillRect(x - 7, y + 2, 2, 1);
  }
}
function slugName(s){ return String(s).toLowerCase().replace(/ /g, '_'); }
function listIconSlots(sub, entry){
  if (sub === 'arts') return ['art_' + slugName(entry.key), 'art_' + entry.el];
  if (sub === 'spirit') return ['spirit_' + entry.key, 'spirit_' + entry.el];
  if (sub === 'summon'){
    const d = SUMMON_DEFS[entry.key];
    return ['summon_' + slugName(d.name), 'summon_' + d.el];
  }
  return ['item_' + entry.key];
}
function listIconSlot(sub, entry){ // the pack icon for a row, else a built-in one (the items have them)
  const slots = listIconSlots(sub, entry);
  return slots.find(s => userSpr(s)) || slots.find(s => SPRITES[s]) || null;
}
function drawListIcon(sub, entry, cx, cy, maxW, maxH){
  const slot = listIconSlot(sub, entry);
  if (slot){
    if (entry.dim) ctx.globalAlpha = .45;
    drawIconFit(slot, cx, cy + 1, maxW || 99, maxH || 99);
    ctx.globalAlpha = 1;
    return;
  }
  const col = entry.dim ? '#5c5478' : (entry.el ? ELCOL[entry.el] || entry.col : entry.col);
  ctx.fillStyle = col;
  if (sub === 'arts'){           // spark
    ctx.fillRect(cx - 1, cy - 3, 2, 7); ctx.fillRect(cx - 3, cy - 1, 6, 3);
  } else if (sub === 'spirit'){  // little critter
    ctx.fillRect(cx - 3, cy - 1, 6, 4); ctx.fillRect(cx - 2, cy - 3, 2, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 1, cy, 1, 1);
  } else if (sub === 'summon'){  // star
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
    ctx.fillRect(cx - 3, cy - 3, 1, 1); ctx.fillRect(cx + 2, cy - 3, 1, 1);
    ctx.fillRect(cx - 3, cy + 2, 1, 1); ctx.fillRect(cx + 2, cy + 2, 1, 1);
  } else {                       // flask
    ctx.fillStyle = '#e8c84b';
    ctx.fillRect(cx - 1, cy - 3, 2, 2); ctx.fillRect(cx - 2, cy - 1, 4, 4);
  }
}
const FX_SLOW = 1; // pack effect GIFs play at native speed (raise to slow them down)
function fxSlotName(b){ return (b.fxArt && userSpr('fx_' + b.fxArt)) ? 'fx_' + b.fxArt : 'fx_' + b.fxKind; }
function fxSprite(b){ return b.fxKind ? userSpr(fxSlotName(b)) : null; }
function stripLH(){ return glyphFontOn() ? 9 : 6; } // row height of the status strip
function stripH(){ return 6 + stripLH() * 3; }
// a status bar with a filled and an empty colour, so its state reads at a glance
function bar2(x, y, w, h, val, max, fill, empty){
  ctx.fillStyle = '#0c0a16'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = empty; ctx.fillRect(x+1, y+1, w-2, h-2);
  ctx.fillStyle = fill; ctx.fillRect(x+1, y+1, Math.round((w-2) * clamp(val/max, 0, 1)), h-2);
}
// the pink droplet that marks a target: fat round top, point down (or up when it sits under a party card)
const DROP_BIG = ["..ppp..",".plppp.","plppppp","ppppppp",".ppppp.",".ppppp.","..ppp..","..ppp..","...p...","...p..."];
const DROP_SMALL = [".pp.","lppp","pppp",".pp.",".pp.","..p."];
function drawDrop(cx, cy, big, up, t){
  const rows = big ? DROP_BIG : DROP_SMALL, w = rows[0].length, h = rows.length;
  const bob = (t >> 3) % 2 ? 1 : 0;
  const x0 = Math.round(cx - w/2), y0 = Math.round(up ? cy + bob : cy - h - bob);
  const px = (c, r, col) => { ctx.fillStyle = col; ctx.fillRect(x0 + c, y0 + (up ? h - 1 - r : r), 1, 1); };
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++){
    const ch = rows[r][c];
    if (ch === 'p') px(c, r, '#f06ab8'); else if (ch === 'l') px(c, r, '#ffd0ec');
  }
  ctx.fillStyle = '#5a1040'; // outline
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++){
    if (rows[r][c] !== '.') continue;
    const near = (rows[r][c-1] && rows[r][c-1] !== '.') || (rows[r][c+1] && rows[r][c+1] !== '.') ||
                 (rows[r-1] && rows[r-1][c] !== '.') || (rows[r+1] && rows[r+1][c] !== '.');
    if (near) ctx.fillRect(x0 + c, y0 + (up ? h - 1 - r : r), 1, 1);
  }
}
function battleStatusPanel(){
  const b = G.battle, n = G.party.length;
  const cw = Math.min(76, Math.floor(232 / n)), LH = stripLH(), SH = stripH(), r1 = 5 + LH, r2 = 5 + 2*LH;
  const px0 = W - 2 - (4 + n*cw); // the panel hangs from the top-right corner
  box(px0, 2, 4 + n*cw, SH);
  const choosing = b.phase === 'input' || b.phase === 'sub' || b.phase === 'target' || b.phase === 'targetAlly';
  for (let i = 0; i < n; i++){
    const m = G.party[i], x0 = px0 + 2 + i*cw, bw = cw - 4;
    const active = choosing && b.inputIdx === i;
    if (active){ // the member choosing a command sits on a lit card with a gold frame
      ctx.fillStyle = '#2f4cc4'; ctx.fillRect(x0, 4, cw, SH - 4);
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(x0, 4, cw, 1); ctx.fillRect(x0, SH - 1, cw, 1); ctx.fillRect(x0, 4, 1, SH - 4); ctx.fillRect(x0 + cw - 1, 4, 1, SH - 4);
    } else if (i > 0){ ctx.fillStyle = '#3448a0'; ctx.fillRect(x0, 5, 1, SH - 6); }
    if (b.pflashT > 0 && (b.pflash === i || b.pflash === -2) && (b.pflashT >> 1) % 2 === 0) continue;
    const lx = x0 + 2;
    text(m.name.slice(0, 4), lx, 5, m.ko ? '#c94a6a' : (active ? '#f2c14e' : '#ffffff'));
    const low = !m.ko && m.hp <= m.maxhp * .25;
    const hp = '' + m.hp, pp = '' + m.pp, by = LH - 4; // the bar sits under the lower half of the text row
    // HP: blue fills, red shows what is missing; the label and number are drawn over the bar
    bar2(lx, r1 + by, bw, 4, m.hp, m.maxhp, m.ko ? '#5a2030' : '#4c84f4', m.ko ? '#5a2030' : '#d44040');
    const hpCol = m.ko ? '#c94a6a' : (low && (G.t >> 3) % 2 === 0 ? '#ffb0a0' : '#ffffff');
    text('HP', lx, r1, hpCol);
    text(hp, lx + bw - textW(hp), r1, hpCol);
    // PP: blue fills, dusk purple shows what is spent
    bar2(lx, r2 + by, bw, 4, m.pp, m.maxpp, '#4c84f4', '#7a3a9a');
    text('PP', lx, r2, '#ffffff');
    text(pp, lx + bw - textW(pp), r2, '#ffffff');
    if (b.phase === 'targetAlly' && b.targetSel === i) drawDrop(x0 + (cw >> 1), SH + 4, true, true, G.t);
  }
}
function battleToolbar(){
  const b = G.battle, L = b.menuList, m = G.party[b.inputIdx];
  if (!m || !L.length) return;
  textO(m.name + ' - ' + L[b.menuSel].label, 8, 114, '#ffffff', '#241c40');
  for (let i = 0; i < L.length; i++)
    drawCmdIcon(L[i].id, 16 + i*19, 141, i === b.menuSel);
}
// the badges at the right of an arts row: element (el_earth ...) and range (range_one: one foe,
// range_all: every foe, range_ally: one ally, range_party: the whole party), pack-replaceable sprites
// the menu cursor (pack slot `cursor`): drawn with its fingertip at (tipX, cy), nudging right and left as it waits
function drawCursor(tipX, cy){
  const u = userSpr('cursor'), bob = (G.t >> 3) % 2;
  if (u){ const f = sprFrame(u).img; ctx.drawImage(f, Math.round(tipX - f.width + bob), Math.round(cy - f.height/2)); return; }
  const c = sprCanvas('cursor', '');
  ctx.drawImage(c, Math.round(tipX - c.width + bob), Math.round(cy - c.height/2));
}
function cursorRowY(y){ return y + (glyphFontOn() ? 4 : 3); } // vertical centre of a text row that starts at y
function drawBadge(slot, cx, cy, dim){
  if (!SPRITES[slot] && !userSpr(slot)) return;
  if (dim) ctx.globalAlpha = .45;
  drawSpr(slot, cx, cy, 1, '');
  ctx.globalAlpha = 1;
}
// a menu icon (pack sprite, else built-in): the cell its rows need, and drawing it centred and shrunk to fit
function iconImg(slot){ const u = userSpr(slot); return u ? sprFrame(u).img : SPRITES[slot] ? sprCanvas(slot, '') : null; }
function iconCell(slots, maxH){ // the cell that holds the biggest of these icons, at most maxH tall
  let w = 0, h = 0;
  for (const s of slots){ const im = iconImg(s); if (im){ w = Math.max(w, im.width); h = Math.max(h, im.height); } }
  const k = h > maxH ? maxH / h : 1;
  return { w: Math.round(w * k), h: Math.round(h * k) };
}
function drawIconFit(slot, cx, cy, maxW, maxH){
  const im = iconImg(slot);
  if (!im) return;
  const k = Math.min(1, maxW / im.width, maxH / im.height);
  const w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k));
  ctx.drawImage(im, Math.round(cx - w/2), Math.round(cy - h/2), w, h);
}
// the arts / spirit / summon / item window: a description strip under the status panel, the caster
// at the bottom-left and the list on the right, with a lit row for the selection
function battleSubMenu(){
  const b = G.battle, list = subList(), m = G.party[b.inputIdx];
  if (!list.length) return;
  const LH = stripLH(), SH = stripH(), sel = list[b.subSel];
  // rows grow to fit big pack icons (up to 16px); the text sits centred in the taller row
  const cell = iconCell(list.map(it => listIconSlot(b.sub, it)).filter(Boolean), 16);
  const iw = Math.max(8, cell.w), rowH = Math.max(LH + 4, cell.h + 2), pad = (rowH - LH - 4) >> 1;
  const dy = SH + 2, dh = LH*2 + 8;
  box(2, dy, W - 4, dh);
  const dl = wrap(sel ? sel.desc : '', glyphFontOn() ? 31 : 36);
  text(dl[0] || '', 8, dy + 4, '#e9e0c8');
  if (dl[1]) text(dl[1], 8, dy + 4 + LH, '#e9e0c8');
  // the caster, facing us, large in the bottom-left corner
  ctx.save(); ctx.translate(8, H - 50); ctx.scale(2, 2);
  drawHero(0, 0, 'down', 0, m.pal);
  ctx.restore();
  const lx = 72, ly = dy + dh + 2, lw = W - 2 - lx, lh = H - 2 - ly;
  box(lx, ly, lw, lh);
  const vis = Math.max(1, Math.floor((lh - 8) / rowH));
  b.subScroll = clamp(b.subScroll, Math.max(0, b.subSel - vis + 1), Math.min(b.subSel, Math.max(0, list.length - vis)));
  for (let r = 0; r < vis && r + b.subScroll < list.length; r++){
    const i = r + b.subScroll, it = list[i], top = ly + 4 + r*rowH, y = top + pad;
    if (i === b.subSel){ ctx.fillStyle = '#2f4cc4'; ctx.fillRect(lx + 3, top - 1, lw - 6, rowH); }
    drawListIcon(b.sub, it, lx + 7 + iw/2, y + (LH >> 1), iw, rowH - 2);
    if (i === b.subSel) drawCursor(lx + 5, y + (LH >> 1)); // the glove straddles the window's left edge
    const col = it.dim ? '#7c7498' : (i === b.subSel ? '#f2c14e' : '#ffffff');
    text(it.label, lx + 11 + iw, y, col);
    const rx = lx + lw - 6, cy = y + (LH >> 1); // right edge: range badge, element badge(s), then the cost
    drawBadge('range_' + it.range, rx - 4, cy, it.dim);
    const els = it.els || (it.el ? [it.el] : []);
    els.forEach((el, j) => drawBadge('el_' + el, rx - 14 - j*8, cy, it.dim));
    if (it.tag) text(it.tag, rx - 22 - Math.max(0, els.length - 1)*8 - textW(it.tag), y, col);
  }
  ctx.fillStyle = '#eef0ff'; // scroll nubs
  if (b.subScroll > 0){ ctx.fillRect(lx + lw - 9, ly + 1, 5, 1); ctx.fillRect(lx + lw - 8, ly, 3, 1); }
  if (b.subScroll + vis < list.length){ ctx.fillRect(lx + lw - 9, ly + lh - 2, 5, 1); ctx.fillRect(lx + lw - 8, ly + lh - 1, 3, 1); }
}
// camera for the over-the-shoulder target view: zoom 0..1 blends from the wide shot to a close one
function battleCam(){
  const b = G.battle, z = b.zoom || 0;
  if (z <= 0.01) return null;
  const e = b.enemies[b.targetSel] || b.enemies[firstAliveEnemy()], s = e.slot;
  // a single target is framed left of centre; an area attack frames the whole group
  let fx = s.x, fy = s.y, sx = 92;
  if (b.pendCmd && b.pendCmd.aoe){
    const alive = b.enemies.filter(x => x.hp > 0);
    fx = alive.reduce((a, x) => a + x.slot.x, 0) / alive.length; fy = alive.reduce((a, x) => a + x.slot.y, 0) / alive.length; sx = 120;
  }
  const k = 1 + z * .6, tx = fx + (sx - fx) * z, ty = fy + (86 - fy) * z;
  return { k, ox: clamp(tx - fx * k, W - W*k, 0), oy: clamp(ty - fy * k, H - H*k, 0) };
}
function battleDraw(){
  const b = G.battle;
  if (b.cine){ cineDraw(); return; }
  const cam = battleCam(), z = b.zoom || 0, targeting = b.phase === 'target';
  // background and enemies, seen through the camera (zoomed in over the party's shoulder while targeting)
  ctx.save();
  if (cam){ ctx.translate(cam.ox, cam.oy); ctx.scale(cam.k, cam.k); }
  battleBG();
  for (let i = 0; i < b.enemies.length; i++){
    const e = b.enemies[i];
    if (e.hp <= 0) continue;
    const s = e.slot;
    const mm = sprMetrics(e.kind, s.s);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.fillRect(s.x - mm.hw + 2, s.y + mm.hh - 1, mm.hw*2 - 4, 4);
    drawEnemyArt(e.kind, s.x, s.y, b.t + i*7, s.s, e.flash > 0 && (e.flash >> 1) % 2 === 0);
    if (targeting && i === b.targetSel){ // a soft white sheen over the chosen enemy
      ctx.globalAlpha = .22 + .12 * Math.sin(b.t / 5);
      drawEnemyArt(e.kind, s.x, s.y, b.t + i*7, s.s, true);
      ctx.globalAlpha = 1;
    }
  }
  if (targeting){ // droplets: the big one over the target, small ones over the rest of an area attack's victims
    const aoe = b.pendCmd && b.pendCmd.aoe;
    for (let i = 0; i < b.enemies.length; i++){
      const e = b.enemies[i];
      if (e.hp <= 0 || (i !== b.targetSel && !aoe)) continue;
      const s = e.slot, mm = sprMetrics(e.kind, s.s);
      drawDrop(s.x, s.y - mm.hh - 3, i === b.targetSel, false, b.t);
    }
  }
  ctx.restore();
  // spell fx: the element overlay scaled over the whole screen, under the party
  if (b.fx > 0 && b.fxSlot){
    const ph = b.fxTotal ? b.fxTotal - b.fx : 22 - b.fx, s = b.fxSlot;
    if (b.fxKind){
      const fxName = fxSlotName(b), u = userSpr(fxName);
      if (u){ // pack overlay: scaled to the screen width and pinned to the top-left corner, played once from the cast
        const img = (u.frames.length > 1 ? sprFrameAt(u, (performance.now() - (b.fxStart || 0)) / FX_SLOW) : u.frames[0]).img;
        const sc = W / u.width;
        ctx.drawImage(img, 0, 0, W, Math.round(u.height * sc));
      } else drawSpr(fxName, s.x, s.y - 4, ph < 5 ? 3 : ph < 15 ? 5 : 3, '');
    }
  } else if (b.fx > 0 && !b.fxSlot){
    ctx.globalAlpha = b.fx / 40;
    ctx.fillStyle = b.fxCol || '#7cd88a'; ctx.fillRect(0, 90, W, 40);
    ctx.globalAlpha = 1;
  }
  // party in the bottom-right corner, over the effects, with attack/cast poses; as the camera closes in,
  // the member whose turn it is grows into the corner and the others fade back out of view
  for (let i = 0; i < G.party.length; i++){
    const m = G.party[i], me = i === b.inputIdx, zz = me ? z : 0;
    if (!me && z >= .67) continue;
    const hurt = b.hurt && (b.hurt.i === i || b.hurt.i === -2);
    const p = partyPos(i), x = Math.round(p.x + (196 - p.x) * zz), y = Math.round(p.y + (132 - p.y) * zz);
    ctx.save(); ctx.translate(x, y); ctx.scale(1 + zz, 1 + zz);
    if (!me && z > 0) ctx.globalAlpha = 1 - z * 1.5;
    if (m.ko && !hurt){ // lying where they fell
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(1, 14, 14, 2);
      drawHero(0, 0, 'downed', 0, m.pal);
      ctx.restore();
      continue;
    }
    if (b.pflashT > 0 && (b.pflash === i || b.pflash === -2) && (b.pflashT >> 1) % 2 === 0){ ctx.restore(); continue; }
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(3, 14, 10, 3);
    const an = (b.anim && b.anim.i === i) ? b.anim : null;
    if (hurt) drawHero(0, 0, 'hit', 0, m.pal);
    else if (an) drawHero(0, 0, an.kind, an.t <= 13 ? 1 : 0, m.pal);
    else drawHero(0, 0, 'back', 0, m.pal);
    ctx.restore();
  }
  // status cards along the top, icon toolbar bottom left
  battleStatusPanel();
  if (b.phase === 'input' || b.phase === 'targetAlly') battleToolbar();
  if (b.phase === 'sub') battleSubMenu();
  else if (targeting){ // the target's name in a small window at the bottom-left
    const e = b.enemies[b.targetSel];
    if (e){
      const tw = textW(e.name) + 12, bh = stripLH() + 8;
      box(6, H - 6 - bh, tw, bh);
      text(e.name, 12, H - 2 - bh, '#ffffff');
    }
  }
  // message box
  if (b.phase === 'msg' && b.msgs.length){
    const y0 = stripH() + 4;
    box(6, y0, 228, 26);
    const ml = wrap(b.msgs[0], 36);
    text(ml[0], 14, y0 + 5, '#e9e0c8');
    if (ml[1]) text(ml[1], 14, y0 + 15, '#e9e0c8');
  }
  if (G.toast){
    G.toast.t--;
    if (G.toast.t <= 0) G.toast = null;
    else { const tw = textW(G.toast.msg) + 12;
      box(Math.round((W-tw)/2), stripH() + 34, tw, 13); textC(G.toast.msg, W/2, stripH() + 38, '#f2c14e'); }
  }
}

// ---------------- title and ending ----------------
let titleSel = 0;
// ---- title logo: gold-bevelled lettering built once from a crisp text mask ----
let TITLE_LOGO = null;
function tintMask(mask, col){
  const c = document.createElement('canvas'); c.width = mask.width; c.height = mask.height;
  const x = c.getContext('2d');
  x.drawImage(mask, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  return c;
}
function titleLogo(){
  if (TITLE_LOGO) return TITLE_LOGO;
  const w = W, h = 72;
  const mask = document.createElement('canvas'); mask.width = w; mask.height = h;
  const mx = mask.getContext('2d');
  mx.font = 'italic bold 46px "Times New Roman", Georgia, serif';
  mx.textAlign = 'center'; mx.textBaseline = 'alphabetic';
  mx.fillStyle = '#fff'; mx.fillText('Sunspire', 124, 50);
  try { // snap the antialiased glyphs to hard pixels
    const id = mx.getImageData(0, 0, w, h), d = id.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
    mx.putImageData(id, 0, 0);
  } catch(e){}
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.globalAlpha = .55; x.drawImage(tintMask(mask, '#1a0c04'), 3, 3); x.globalAlpha = 1;
  const edge = tintMask(mask, '#3a1e08');
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) x.drawImage(edge, dx, dy);
  x.drawImage(tintMask(mask, '#7a4a12'), 0, 1);           // lower bevel
  const gold = document.createElement('canvas'); gold.width = w; gold.height = h;
  const gx = gold.getContext('2d');
  gx.drawImage(mask, 0, 0);
  gx.globalCompositeOperation = 'source-in';
  const grd = gx.createLinearGradient(0, 14, 0, 62);
  grd.addColorStop(0, '#fff6c4'); grd.addColorStop(.35, '#f2c14e'); grd.addColorStop(.62, '#b9771c');
  grd.addColorStop(.72, '#e8a83a'); grd.addColorStop(1, '#ffe27a');
  gx.fillStyle = grd; gx.fillRect(0, 0, w, h);
  x.drawImage(gold, 0, 0);
  TITLE_LOGO = c;
  return c;
}
function titleCloud(cx, cy, r){
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.arc(cx + r, cy + 3, r * .8, 0, Math.PI*2);
  ctx.arc(cx - r, cy + 4, r * .7, 0, Math.PI*2); ctx.fill();
  ctx.fillRect(cx - r*1.6, cy + 2, r*3.2, r*.6);
}
function titleSpire(bx, by, t){
  // the Sunspire: a pale tower on a crag, crystal beacon pulsing at the top
  ctx.fillStyle = '#4b5a8a'; ctx.fillRect(bx - 24, by - 14, 48, 14); ctx.fillRect(bx - 16, by - 20, 32, 6);
  ctx.fillStyle = '#9aa6c9'; ctx.fillRect(bx - 7, by - 72, 14, 58);
  ctx.fillStyle = '#c9d2e8'; ctx.fillRect(bx - 7, by - 72, 4, 58);
  ctx.fillStyle = '#6a7598'; ctx.fillRect(bx + 4, by - 72, 3, 58);
  ctx.fillStyle = '#f2c14e'; ctx.fillRect(bx - 9, by - 74, 18, 2); ctx.fillRect(bx - 9, by - 44, 18, 2);
  ctx.fillStyle = '#2a2f55';
  for (let i = 0; i < 4; i++) ctx.fillRect(bx - 1, by - 66 + i*12, 3, 5);
  ctx.fillStyle = '#c9d2e8'; ctx.fillRect(bx - 4, by - 84, 8, 12);
  ctx.fillStyle = ((t >> 4) % 2) ? '#ffd94e' : '#fff6c4';
  ctx.fillRect(bx - 2, by - 90, 4, 8); ctx.fillRect(bx - 4, by - 86, 8, 2);
  ctx.globalAlpha = .25 + .1 * Math.sin(t / 9);
  ctx.beginPath(); ctx.arc(bx, by - 86, 9, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
}
function titleRing(cx, cy, t){
  // ornamental sun ring sitting behind the lettering
  ctx.lineWidth = 7; ctx.strokeStyle = '#3a1e08';
  ctx.beginPath(); ctx.arc(cx, cy, 36, 0, Math.PI*2); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = '#f2c14e';
  ctx.beginPath(); ctx.arc(cx, cy, 36, 0, Math.PI*2); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = '#fff6c4';
  ctx.beginPath(); ctx.arc(cx, cy, 34, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
  ctx.strokeStyle = '#b9771c';
  ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI*2); ctx.stroke();
  for (let i = 0; i < 16; i++){ // rays
    const a = i * Math.PI / 8 + t * .003, long = i % 2 === 0;
    const r0 = 39, r1 = long ? 50 : 45;
    ctx.fillStyle = long ? '#f2c14e' : '#e8a83a';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - .06) * r0, cy + Math.sin(a - .06) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a + .06) * r0, cy + Math.sin(a + .06) * r0);
    ctx.fill();
  }
  ctx.fillStyle = '#fff6c4';
  for (let i = 0; i < 3; i++){
    const a = t * .02 + i * 2.1, r = 36;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 2, 2);
  }
}
function titleDraw(){
  const grd = ctx.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#1b3a86'); grd.addColorStop(.55, '#5fa8e4'); grd.addColorStop(1, '#f3dfae');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, 128);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 6; i++){
    const cx = ((i * 53 + G.t * (.08 + i * .02)) % (W + 60)) - 30, cy = 26 + (i % 3) * 28 + (i >> 1) * 5;
    titleCloud(Math.round(cx), cy, 9 + (i % 3) * 4);
  }
  ctx.fillStyle = '#6d7bb0';
  for (let x = 0; x < W; x += 6){ const hh = 8 + (h32(x, 7, 9) % 16); ctx.fillRect(x, 128 - hh, 6, hh); }
  titleSpire(120, 128, G.t);
  ctx.fillStyle = '#17203a'; ctx.fillRect(0, 128, W, 32);
  ctx.fillStyle = '#243358'; ctx.fillRect(0, 128, W, 2);
  const tu = userSpr('title');
  if (tu){
    const f = sprFrame(tu).img, sc = Math.min(1, W / f.width);
    ctx.drawImage(f, Math.round(120 - f.width*sc/2), 8, Math.round(f.width*sc), Math.round(f.height*sc));
  } else {
    titleRing(50, 44, G.t);
    ctx.drawImage(titleLogo(), 0, 10);
    const ssc = glyphFontOn() ? 1 : 2, sw = textW('SAGA', ssc), rw = Math.max(60, sw + 24), rx = 228 - rw, rh = glyphFontOn() ? 14 : 15; // ribbon sized to the lettering
    ctx.fillStyle = '#2a1608'; ctx.fillRect(rx, 80, rw, rh);
    ctx.fillStyle = '#f2c14e'; ctx.fillRect(rx, 80, rw, 1); ctx.fillRect(rx, 80 + rh - 1, rw, 1);
    ctx.fillRect(rx, 80, 1, rh); ctx.fillRect(rx + rw - 1, 80, 1, rh);
    textCO('SAGA', rx + rw / 2, 83, '#ffe9a0', '#2a1608', ssc);
  }
  textO(GAME_VERSION, W - 4 - textW(GAME_VERSION), 5, '#e9e0c8', '#1b3a86');
  const opts = hasSave() ? ['NEW GAME','CONTINUE'] : ['NEW GAME'];
  if (opts.length > 1){
    if (pressed.up || pressed.down){ titleSel = 1 - titleSel; sfx.blip(); }
  } else titleSel = 0;
  for (let i = 0; i < opts.length; i++){
    const x = opts.length > 1 ? 62 + i*76 : 120;
    textCO(opts[i], x, 146, i === titleSel ? '#ffffff' : '#9a91b8', '#241c40');
    if (i === titleSel) drawCursor(x - textW(opts[i])/2 - 3, cursorRowY(146));
  }
  if (pressed.start || pressed.a){
    sfx.ok();
    const keep = G.t;
    if (titleSel === 1 && hasSave() && loadGame()){ G.t = keep; return; }
    newGame();
    G.mode = 'world'; G.t = keep; G.fade = 16; G.flags.intro = true;
    say(["SORIN: 'Ari... the Sunspire has gone dark. Monsters prowl every road.'",
         "'Eight elemental spirits fled the spire. SET, they strengthen you. Unleashed, they fuel the great SUMMONS.'",
         "'FLINT hides west of the houses. Start there. And take coin for MARA's shop.'",
         "'LYN went scouting north and is holed up in Brindle. Crack that boulder and go ask her along.'"]);
  }
}
function endingDraw(){
  const sky = ['#f2c14e','#e8a05a','#c9756a','#8a5a8f','#463a78'];
  for (let i = 0; i < 5; i++){ ctx.fillStyle = sky[i]; ctx.fillRect(0, i*20, W, 20); }
  ctx.fillStyle = '#ffd94e';
  ctx.beginPath(); ctx.arc(120, 40, 26, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath(); ctx.arc(114, 34, 10, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a1430'; ctx.fillRect(0, 100, W, 60);
  ctx.fillStyle = '#241c40'; ctx.fillRect(112, 60, 16, 40); ctx.fillRect(116, 52, 8, 10);
  ctx.fillStyle = '#ffe9a0'; ctx.fillRect(118, 48, 4, 4);
  textCO('THE SUNSPIRE SHINES ANEW', W/2, 106, '#f2c14e', '#241c40');
  textCO('PARTY LV ' + G.lv + ' * SPIRITS ' + spiritsFound().length + '/8', W/2, 120, '#e9e0c8', '#241c40');
  textCO('BATTLES WON: ' + G.wins + ' * ' + G.gold + ' COINS', W/2, 130, '#e9e0c8', '#241c40');
  if (G.t > 90 && (G.t >> 5) % 2 === 0) textCO('THANKS FOR PLAYING - PRESS ENTER', W/2, 146, '#ffffff', '#241c40');
  if (G.t > 90 && (pressed.start || pressed.a)){
    sfx.ok();
    newGame();
  }
}

// ---------------- main loop ----------------
newGame();
function frame(){
  G.t++;
  if (G.mode === 'world'){
    if (G.battle) battleUpdate(); else worldUpdate();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (G.shake > 0){
    G.shake--;
    ctx.setTransform(1, 0, 0, 1, rnd(-2, 2), rnd(-2, 2));
  }
  if (G.mode === 'title') titleDraw();
  else if (G.mode === 'ending') endingDraw();
  else if (G.battle) battleDraw();
  else worldDraw();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (G.fade > 0){
    G.fade--;
    ctx.fillStyle = 'rgba(8,6,16,' + (G.fade / 16) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  for (const k in pressed) pressed[k] = false;
  requestAnimationFrame(frame);
}
if (!HEADLESS) requestAnimationFrame(frame);
