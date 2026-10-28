// Assemble assets/favicon.ico from the favicon-*.png frames written by tools/logo-gen.html.
// Run from the folder that holds the PNGs:  node ../tools/build-ico.js
const fs = require('fs');
const sizes = [16, 32, 48, 256];
const pngs = sizes.map(s => fs.readFileSync('favicon-' + s + '.png'));
const head = Buffer.alloc(6);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
const dir = Buffer.alloc(16 * sizes.length);
let off = 6 + dir.length;
sizes.forEach((s, i) => {
  const e = i * 16;
  dir.writeUInt8(s >= 256 ? 0 : s, e); dir.writeUInt8(s >= 256 ? 0 : s, e + 1);
  dir.writeUInt8(0, e + 2); dir.writeUInt8(0, e + 3);
  dir.writeUInt16LE(1, e + 4); dir.writeUInt16LE(32, e + 6);
  dir.writeUInt32LE(pngs[i].length, e + 8); dir.writeUInt32LE(off, e + 12);
  off += pngs[i].length;
});
fs.writeFileSync('favicon.ico', Buffer.concat([head, dir, ...pngs]));
console.log('favicon.ico', fs.statSync('favicon.ico').size, 'bytes');
