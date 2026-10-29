import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('..', import.meta.url)));
const publicDir = `${root}/public`;
mkdirSync(`${publicDir}/icons`, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function png(size) {
  const raw = Buffer.alloc((size + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - size / 2;
      const dy = y + 0.5 - size / 2;
      const r = Math.hypot(dx, dy);
      const leaf = Math.hypot(dx, dy + size * 0.08);
      let rgb = [91, 127, 106];
      if (r > size * 0.46) rgb = [247, 244, 239];
      else if (leaf < size * 0.2) rgb = [247, 244, 239];
      const i = y * (size + 1) + 1 + x * 1;
      // grayscale no - use rgb png
    }
  }
  const rgb = Buffer.alloc((1 + size * 3) * size);
  for (let y = 0; y < size; y++) {
    rgb[y * (1 + size * 3)] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - size / 2;
      const dy = y + 0.5 - size / 2;
      const r = Math.hypot(dx, dy);
      const leaf = Math.hypot(dx, dy + size * 0.06);
      let color = [91, 127, 106];
      if (r > size * 0.47) color = [247, 244, 239];
      else if (leaf < size * 0.2) color = [247, 244, 239];
      const i = y * (1 + size * 3) + 1 + x * 3;
      rgb[i] = color[0];
      rgb[i + 1] = color[1];
      rgb[i + 2] = color[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rgb)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(`${publicDir}/icons/icon-192.png`, png(192));
writeFileSync(`${publicDir}/icons/icon-512.png`, png(512));
writeFileSync(`${publicDir}/apple-touch-icon.png`, png(180));
void createWriteStream;
console.log('icons written');
