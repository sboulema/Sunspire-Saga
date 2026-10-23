// Zips pack-out/*.png plus a README into sunspire-starter-pack.zip (store-only zip, no dependencies).
const fs = require('fs'), path = require('path');
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return buf => { let c = -1; for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }; })();
const files = [];
const readme = `Sunspire Saga - starter sprite pack
====================================

Every slot the game's sprite-pack loader accepts, exported from the built-in art, one PNG per slot,
named exactly as the loader expects. Load this folder (or the zip) through "Sprite packs" under the
game and the pack guide will show every slot as covered.

Use it as a template: open any PNG in a pixel editor, redraw it, keep the file name and size, and load
the folder again. Remove the files you do not want to change - anything missing falls back to the
built-in art - or keep them so the coverage list stays complete.

Notes
- Characters are 16x22 with the feet on the bottom row; the game mirrors "right" to "left" itself.
- bg_* battle backgrounds and bg_summon_* backdrops are 240x160. A summon backdrop replaces the whole
  cutscene background (full screen) and plays animated GIFs once from the start.
- fx_* cast effects are enlarged in battle (longest side ~128 px) and treat pure black as transparent;
  animated GIFs play once at native speed.
- house* files are the same 48x48 building drawn under every house slot; the exact-id files
  (house_thera_1 ...) win over the kind (house_inn, house_shop) and the generic pool.
- grass_2 and grass_trail_2 are extra variants; any suffixed name is a variant for slots marked so in the guide.
- The font is replaced per character with glyph images (A-Z 6x8, lowercase-a..z 6x6, digits, named punctuation such as comma, questionmark, colin); see the in-game pack guide, Font section. None are included here.
- Animated GIFs may replace any PNG here (same file name, .gif extension).

Only load and share art you made yourself or have the rights to use.
`;
files.push({ name: 'README.md', data: Buffer.from(readme, 'utf8') });
for (const f of fs.readdirSync('pack-out').sort()) if (f.endsWith('.png')) files.push({ name: f, data: fs.readFileSync(path.join('pack-out', f)) });
const locals = [], centrals = []; let off = 0;
const dosTime = 0x7000, dosDate = ((2026 - 1980) << 9) | (10 << 5) | 22;
for (const f of files){
  const name = Buffer.from(f.name, 'utf8'), crc = CRC(f.data);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8);
  lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(f.data.length, 18); lh.writeUInt32LE(f.data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0, 10);
  ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(f.data.length, 20); ch.writeUInt32LE(f.data.length, 24); ch.writeUInt16LE(name.length, 28);
  ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(off, 42);
  locals.push(lh, name, f.data); centrals.push(ch, name);
  off += lh.length + name.length + f.data.length;
}
const cd = Buffer.concat(centrals);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16); eocd.writeUInt16LE(0, 20);
fs.writeFileSync('sunspire-starter-pack.zip', Buffer.concat([...locals, cd, eocd]));
console.log('zip:', files.length, 'entries,', fs.statSync('sunspire-starter-pack.zip').size, 'bytes');
