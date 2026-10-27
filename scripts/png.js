// Minimal PNG read/write for 8-bit RGBA, non-interlaced images (what canvas.toDataURL makes).
const zlib = require('zlib');

const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf){ let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }

function decode(buf){
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let pos = 8, w, h, bitDepth, colorType, idat = [];
  while (pos < buf.length){
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR'){ w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; if (data[12]) throw new Error('interlaced png'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('bit depth ' + bitDepth);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, out = Buffer.alloc(w * h * ch);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++){
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++){
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4){ const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 0xff;
    }
    cur.copy(out, y * stride); prev = cur;
  }
  // expand to RGBA
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += 4){
    if (ch === 4){ out.copy(rgba, j, i * 4, i * 4 + 4); }
    else if (ch === 3){ rgba[j] = out[i*3]; rgba[j+1] = out[i*3+1]; rgba[j+2] = out[i*3+2]; rgba[j+3] = 255; }
    else if (ch === 2){ rgba[j] = rgba[j+1] = rgba[j+2] = out[i*2]; rgba[j+3] = out[i*2+1]; }
    else { rgba[j] = rgba[j+1] = rgba[j+2] = out[i]; rgba[j+3] = 255; }
  }
  return { width: w, height: h, data: rgba };
}

function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encode(img){
  const { width: w, height: h, data } = img, stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++){ raw[y * (stride + 1)] = 0; data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function create(w, h){ return { width: w, height: h, data: Buffer.alloc(w * h * 4) }; }
// copies src (whole, or sx,sy,sw,sh) onto dst at dx,dy; transparent pixels of src are skipped
function blit(dst, src, dx, dy, sx = 0, sy = 0, sw = src.width, sh = src.height){
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++){
    const si = ((sy + y) * src.width + sx + x) * 4; if (src.data[si + 3] === 0) continue;
    const tx = dx + x, ty = dy + y; if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue;
    src.data.copy(dst.data, (ty * dst.width + tx) * 4, si, si + 4);
  }
}
function fill(dst, x, y, w, h, [r, g, b, a = 255]){
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++){ const i = (yy * dst.width + xx) * 4; dst.data[i] = r; dst.data[i+1] = g; dst.data[i+2] = b; dst.data[i+3] = a; }
}
function flipX(src){ const out = create(src.width, src.height); for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) src.data.copy(out.data, (y * src.width + (src.width - 1 - x)) * 4, (y * src.width + x) * 4, (y * src.width + x) * 4 + 4); return out; }

module.exports = { decode, encode, create, blit, fill, flipX };
