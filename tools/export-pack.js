// Runs inside the game page: renders every built-in slot and POSTs it as pack-out/<slot>.png
(async () => {
  window.requestAnimationFrame = () => 0;
  const cvs = document.querySelector('canvas');
  const names = [], missing = [];
  function crop(){
    const d = ctx.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y*W + x)*4 + 3] > 0){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const c = document.createElement('canvas'); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
    c.getContext('2d').drawImage(cvs, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    return c;
  }
  async function save(name, c){ await fetch('/pack-out/' + name + '.png', { method: 'POST', body: c.toDataURL('image/png') }); names.push(name); }
  async function cap(name, fn){ ctx.save(); ctx.clearRect(0, 0, W, H); try { fn(); } catch(e){ missing.push(name + ': ' + e.message); ctx.restore(); return; } ctx.restore(); const c = crop(); if (c) await save(name, c); else missing.push(name); }
  async function capFull(name, fn){ ctx.save(); ctx.clearRect(0, 0, W, H); fn(); ctx.restore(); const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(cvs, 0, 0); await save(name, c); }
  const canvasOf = c => c;
  newGame(); G.mode = 'world'; G.fade = 0; G.map = MAPS.fields; G.mapId = 'fields';

  // battle enemies, duel spirits, summons, effects
  for (const k of Object.keys(ENEMY_DEFS)) await cap(k, () => ctx.drawImage(sprCanvas(k, ''), 4, 4));
  for (const el of ['earth','fire','water','wind','sol']){
    if (SPRITES['sum_' + el]) await cap('sum_' + el, () => ctx.drawImage(sprCanvas('sum_' + el, ''), 4, 4));
    else await cap('sum_' + el, () => drawSummonFig(el, 120, 80, 0, 1, false));
  }
  for (const el of ['earth','fire','water','wind','heal']) await cap('fx_' + el, () => ctx.drawImage(sprCanvas('fx_' + el, ''), 4, 4));
  for (const a in ART_DEFS) await cap('fx_' + slugName(a), () => ctx.drawImage(sprCanvas('fx_' + ART_DEFS[a].el, ''), 4, 4));

  // characters
  const FR = { down:['down',0], down2:['down',1], up:['up',0], up2:['up',1], right:['right',0], right2:['right',1],
               back:['back',0], attack:['attack',0], attack2:['attack',1], cast:['cast',0], cast2:['cast',1], hit:['hit',0], downed:['downed',0] };
  const WALK = ['down','down2','up','up2','right','right2'];
  const heroes = { hero: CHAR_DEFS.ari.pal };
  for (const k in CHAR_DEFS) heroes[k] = CHAR_DEFS[k].pal;
  for (const id in heroes) for (const f of HERO_FRAMES) await cap(id + '_' + f, () => drawHero(8, 8, FR[f][0], FR[f][1], heroes[id]));
  for (const id in NPC_PALS) for (const f of WALK) await cap(id + '_' + f, () => drawHero(8, 8, FR[f][0], FR[f][1], NPC_PALS[id]));

  // map objects
  await cap('djinn', () => ctx.drawImage(owCanvas('dj_flint', DJ_PALS.flint), 4, 4));
  for (const id of SPIRIT_ORDER) await cap('djinn_' + id, () => ctx.drawImage(owCanvas('dj_' + id, DJ_PALS[id]), 4, 4));
  const TREE_FIELD = { o:'#14280f', g:'#2e6e2c', G:'#245c24', L:'#3f8a38', k:'#5b3d22', K:'#3a2612' };
  const TREE_TRAIL = { o:'#2c3012', g:'#6e7a35', G:'#55682c', L:'#8a9848', k:'#5b3d22', K:'#3a2612' };
  await cap('tree', () => ctx.drawImage(owCanvas('tree', TREE_FIELD), 4, 4));
  await cap('tree_trail', () => ctx.drawImage(owCanvas('tree', TREE_TRAIL), 4, 4));
  const noGround = fn => { const keep = drawGroundBase; drawGroundBase = () => {}; try { fn(); } finally { drawGroundBase = keep; } };
  const tileAt0 = (ch, mapId) => { G.map = MAPS[mapId]; G.mapId = mapId; ctx.translate(8 - 0, 8 - 0); drawTile(ch, 0, 0); };
  // houses: the Thera home tiles, exported under every house slot so the whole pool is covered
  const houseCap = () => { const hx = 6, hy = 17; ctx.translate(8 - hx*T, 8 - hy*T); for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) drawTile(MAPS.fields.g[hy+dy][hx+dx], hx+dx, hy+dy); };
  for (const h of ['house','house_inn','house_shop'].concat(HOUSE_IDS.map(i => 'house_' + i))) await cap(h, houseCap);
  for (const [name, ch] of [['boulder','B'],['sign','s'],['chest','k']]) await cap(name, () => noGround(() => tileAt0(ch, 'fields')));
  await cap('chest_open', () => noGround(() => { G.chests['fields:0,0'] = true; G.chestT = { 'fields:0,0': G.t }; tileAt0('k', 'fields'); delete G.chests['fields:0,0']; }));
  await cap('well', () => noGround(() => tileAt0('+', 'fields')));
  await cap('spring', () => noGround(() => tileAt0('+', 'shrine')));
  G.map = MAPS.fields; G.mapId = 'fields';
  await cap('grass', () => ctx.drawImage(owCanvas('grass_a', GRASS_COLS.field), 4, 4));
  await cap('grass_2', () => ctx.drawImage(owCanvas('grass_b', GRASS_COLS.field), 4, 4));
  await cap('grass_trail', () => ctx.drawImage(owCanvas('grass_a', GRASS_COLS.trail), 4, 4));
  await cap('grass_trail_2', () => ctx.drawImage(owCanvas('grass_b', GRASS_COLS.trail), 4, 4));
  for (const f of ['fence_h','fence_post','fence_v','fence_v2']) await cap(f, () => ctx.drawImage(owCanvas(f, FENCE_MAP), 4, 4));
  const mapOf = fn => eval('(' + fn.toString().match(/const map = (\{[^}]+\})/)[1] + ')');
  await cap('wyrm_s', () => ctx.drawImage(owCanvas('wyrm_s', mapOf(drawWyrmSmall)), 4, 4));
  await cap('ogre_s', () => ctx.drawImage(owCanvas('ogre_s', mapOf(drawOgreSmall)), 4, 4));

  // backgrounds
  for (const [name, mapId] of [['bg_field','fields'],['bg_mine','mine'],['bg_trail','trail'],['bg_tower','shrine']]){
    await capFull(name, () => { G.map = MAPS[mapId]; G.mapId = mapId; G.battle = G.battle || { t: 0 }; battleBG(); });
  }
  G.battle = null; G.map = MAPS.fields; G.mapId = 'fields';
  await capFull('bg', () => { G.map = MAPS.fields; G.battle = { t: 0 }; battleBG(); G.battle = null; });
  const glow = col => { ctx.fillStyle = '#0c0a16'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = col; for (let i = 0; i < 8; i++){ ctx.globalAlpha = .04 + i * .022; ctx.fillRect(0, H - (i+1)*20, W, 20); } ctx.globalAlpha = 1; };
  await capFull('bg_summon', () => glow('#f2c14e'));
  for (const el of ['earth','fire','water','wind','sol']) await capFull('bg_summon_' + el, () => glow(ELCOL[el]));

  // battle interface
  for (const id of ['fight','arts','spirit','summon','item','defend','flee']) await cap('icon_' + id, () => drawCmdIcon(id, 16, 16, false));
  for (const a in ART_DEFS) await cap('art_' + slugName(a), () => drawListIcon('arts', { key: a, el: ART_DEFS[a].el, col: ART_DEFS[a].col }, 8, 8));
  for (const el of ['earth','fire','water','wind','heal']) await cap('art_' + el, () => drawListIcon('arts', { key: el, el, col: ELCOL[el] || '#7cd88a' }, 8, 8));
  for (const id of SPIRIT_ORDER) await cap('spirit_' + id, () => drawListIcon('spirit', { key: id, el: SPIRIT_DEFS[id].el }, 8, 8));
  for (const el of ['earth','fire','water','wind']) await cap('spirit_' + el, () => drawListIcon('spirit', { key: el, el }, 8, 8));
  SUMMON_DEFS.forEach((s, i) => { names.push(null); });
  names.length = names.length - SUMMON_DEFS.length;
  for (let i = 0; i < SUMMON_DEFS.length; i++) await cap('summon_' + slugName(SUMMON_DEFS[i].name), () => drawListIcon('summon', { key: i, el: SUMMON_DEFS[i].el }, 8, 8));
  for (const el of ['earth','fire','water','wind','sol']) await cap('summon_' + el, () => drawListIcon('summon', { key: SUMMON_DEFS.findIndex(s => s.el === el), el }, 8, 8));
  for (const k in ITEM_DEFS) await cap('item_' + k, () => drawListIcon('item', { key: k }, 8, 8));

  // title logo block
  await cap('title', () => { titleRing(50, 44, 0); ctx.drawImage(titleLogo(), 0, 10); ctx.fillStyle = '#2a1608'; ctx.fillRect(134, 80, 94, 15); ctx.fillStyle = '#f2c14e'; ctx.fillRect(134, 80, 94, 1); ctx.fillRect(134, 94, 94, 1); ctx.fillRect(134, 80, 1, 15); ctx.fillRect(227, 80, 1, 15); textCO('SAGA', 181, 83, '#ffe9a0', '#2a1608', 2); });

  const all = allSlotNames();
  const have = new Set(names);
  window.EXPORT_RESULT = { exported: names.length, missing, notCovered: all.filter(n => !have.has(n)), extra: names.filter(n => !all.includes(n)) };
})();
