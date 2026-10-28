// Converts the first frame of a GIF to a PNG (no dependencies): node tools/gif2png.js in.gif [out.png]
// Handles global and local palettes, the transparent index and interlacing; animation is ignored.
const fs = require("fs"),
    path = require("path");
const png = require("../scripts/png.js");

function decode(buf) {
    if (buf.toString("ascii", 0, 3) !== "GIF") throw new Error("not a gif");
    const width = buf.readUInt16LE(6),
        height = buf.readUInt16LE(8);
    const packed = buf[10];
    let pos = 13;
    let palette = null;
    if (packed & 0x80) {
        const n = 1 << ((packed & 7) + 1);
        palette = buf.subarray(pos, pos + n * 3);
        pos += n * 3;
    }
    let transparent = -1;
    while (pos < buf.length) {
        const b = buf[pos++];
        if (b === 0x3b) break; // trailer
        if (b === 0x21) {
            // extension: graphic control holds the transparent index
            const label = buf[pos++];
            if (label === 0xf9) {
                const size = buf[pos];
                const flags = buf[pos + 1];
                if (flags & 1) transparent = buf[pos + 4];
                pos += size + 1;
            }
            while (buf[pos] !== 0) pos += buf[pos] + 1; // skip sub-blocks
            pos++;
            continue;
        }
        if (b !== 0x2c) throw new Error("unexpected block 0x" + b.toString(16));
        const left = buf.readUInt16LE(pos),
            top = buf.readUInt16LE(pos + 2),
            w = buf.readUInt16LE(pos + 4),
            h = buf.readUInt16LE(pos + 6),
            flags = buf[pos + 8];
        pos += 9;
        let pal = palette;
        if (flags & 0x80) {
            const n = 1 << ((flags & 7) + 1);
            pal = buf.subarray(pos, pos + n * 3);
            pos += n * 3;
        }
        const interlaced = !!(flags & 0x40);
        const minCode = buf[pos++];
        const data = [];
        while (buf[pos] !== 0) {
            data.push(buf.subarray(pos + 1, pos + 1 + buf[pos]));
            pos += buf[pos] + 1;
        }
        pos++;
        const indices = lzw(Buffer.concat(data), minCode, w * h);
        const out = png.create(width, height);
        // row order for interlaced images
        const rows = [];
        if (interlaced) {
            for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let y = start; y < h; y += step) rows.push(y);
        } else {
            for (let y = 0; y < h; y++) rows.push(y);
        }
        rows.forEach((y, i) => {
            for (let x = 0; x < w; x++) {
                const idx = indices[i * w + x];
                if (idx === transparent || idx === undefined) continue;
                const o = ((top + y) * width + left + x) * 4;
                out.data[o] = pal[idx * 3];
                out.data[o + 1] = pal[idx * 3 + 1];
                out.data[o + 2] = pal[idx * 3 + 2];
                out.data[o + 3] = 255;
            }
        });
        return out; // first frame only
    }
    throw new Error("no image in gif");
}

function lzw(data, minCode, count) {
    const clear = 1 << minCode,
        end = clear + 1;
    let codeSize = minCode + 1,
        next = end + 1;
    let dict = [];
    const reset = () => {
        dict = [];
        for (let i = 0; i < clear; i++) dict[i] = [i];
        dict[clear] = [];
        dict[end] = null;
        next = end + 1;
        codeSize = minCode + 1;
    };
    reset();
    const out = [];
    let bitBuf = 0,
        bitCount = 0,
        pos = 0,
        prev = null;
    while (out.length < count) {
        while (bitCount < codeSize && pos < data.length) {
            bitBuf |= data[pos++] << bitCount;
            bitCount += 8;
        }
        if (bitCount < codeSize) break;
        const code = bitBuf & ((1 << codeSize) - 1);
        bitBuf >>>= codeSize;
        bitCount -= codeSize;
        if (code === clear) {
            reset();
            prev = null;
            continue;
        }
        if (code === end) break;
        let entry;
        if (code < next && dict[code]) {
            entry = dict[code];
        } else if (prev) {
            entry = prev.concat(prev[0]);
        } else {
            throw new Error("bad lzw code");
        }
        for (const v of entry) out.push(v);
        if (prev && next < 4096) {
            dict[next++] = prev.concat(entry[0]);
            if (next === 1 << codeSize && codeSize < 12) codeSize++;
        }
        prev = entry;
    }
    return out;
}

if (require.main === module) {
    const [input, output] = process.argv.slice(2);
    if (!input) {
        console.error("usage: node tools/gif2png.js in.gif [out.png]");
        process.exit(1);
    }
    const img = decode(fs.readFileSync(input));
    const out = output || input.replace(/\.gif$/i, "") + ".png";
    fs.writeFileSync(out, png.encode(img));
    console.log(`${out}: ${img.width}x${img.height}`);
}

module.exports = {decode};
