// Zips a sprite pack for the engine build (store-only zip, no dependencies).
//
//   node tools/make-pack-zip.js                      every built-in sheet -> sunspire-engine-pack.zip
//   node tools/make-pack-zip.js my-pack/ my-pack.zip  the PNG / GIF / WebP files of a folder
//
// Without a folder, the zip holds every slot of static/pack-slots.json (the sheets the loader
// accepts, exported straight from assets/images), so it is both a complete reference pack and a
// template: redraw any sheet, keep its name and size, and load the zip or the folder again.
const fs = require("fs"),
    path = require("path");

const root = path.join(__dirname, "..");
const src = process.argv[2];
const out = process.argv[3] || (src ? path.basename(path.resolve(src)) + ".zip" : "sunspire-engine-pack.zip");

const readme = `Sunspire Saga (engine build) - sprite pack
===========================================

One image per slot, named after the slot it replaces, exactly the size of the built-in sheet.
Load the zip (or the folder) with "Load sprite pack" on the play page; the pack guide page lists
every slot with its size, a preview and its frame names, and marks the ones a loaded pack covers.

${
    src
        ? ""
        : "This zip holds every slot, exported from the built-in art, so the guide shows all of them as\ncovered. The sheets are identical to the built-in ones, so loading the zip as it is changes nothing\non screen: the game looks different only once you redraw a sheet.\n"
}Use it as a template: open any sheet in a pixel editor, redraw it, keep the file name and size,
and load it again. Leave out the sheets you do not change; anything missing keeps the built-in
art. Files that match no slot or have the wrong size are reported and skipped.

Notes
- Slots are whole sheets: the game cuts them into the same frames at the same positions, so keep
  the layout of the original (open it from the pack guide to see where each frame sits).
- Field characters (*_field) hold the walk, idle and cast frames per direction; the game mirrors
  right to left itself. Battle sheets (*_battle) hold the battle set.
- .gif (first frame) and .webp files may replace any .png here, same file name.
- A sheet may be another size if a <slot>.json TexturePacker atlas with the same frame names
  comes with it in the pack; the game then cuts the sheet by that atlas instead.
- Folder names inside the zip are ignored; only the file name counts.

Only load and share art you made yourself or have the rights to use.
`;

const files = [{name: "README.md", data: Buffer.from(readme, "utf8")}];
if (src) {
    for (const f of fs.readdirSync(src).sort()) {
        if (/\.(png|gif|webp|json)$/i.test(f)) files.push({name: f, data: fs.readFileSync(path.join(src, f))});
    }
} else {
    const slots = JSON.parse(fs.readFileSync(path.join(root, "static", "pack-slots.json"), "utf8"));
    for (const s of slots) files.push({name: s.slot + ".png", data: fs.readFileSync(path.join(root, s.file))});
}
if (files.length === 1) {
    console.error("no images found");
    process.exit(1);
}

const CRC = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return buf => {
        let c = -1;
        for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8);
        return (c ^ -1) >>> 0;
    };
})();

const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
const locals = [],
    centrals = [];
let off = 0;
for (const f of files) {
    const name = Buffer.from(f.name, "utf8"),
        crc = CRC(f.data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(dosTime, 10);
    lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(f.data.length, 18);
    lh.writeUInt32LE(f.data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(dosTime, 12);
    ch.writeUInt16LE(dosDate, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(f.data.length, 20);
    ch.writeUInt32LE(f.data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(off, 42);
    locals.push(lh, name, f.data);
    centrals.push(ch, name);
    off += lh.length + name.length + f.data.length;
}
const cd = Buffer.concat(centrals);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(cd.length, 12);
eocd.writeUInt32LE(off, 16);
eocd.writeUInt16LE(0, 20);
fs.writeFileSync(out, Buffer.concat([...locals, cd, eocd]));
console.log(`${out}: ${files.length - 1} images + README, ${fs.statSync(out).size} bytes`);
