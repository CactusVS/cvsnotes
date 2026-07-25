// Генератор PNG-иконок из фирменного знака (два кольца).
// Без зависимостей: рисуем в буфер RGBA и кодируем PNG через встроенный zlib.
// Запуск:  node gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const BG_TOP = [10, 26, 20];
const BG_BOT = [4, 16, 11];
const R1A = [95, 240, 182],
  R1B = [16, 185, 129];
const R2A = [45, 212, 191],
  R2B = [52, 211, 153];

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function render(size, pad = 0) {
  const buf = Buffer.alloc(size * size * 4);
  const s = 1 - pad;
  const r = size * 0.219 * s;
  const off = size * 0.0996 * s;
  const sw = size * 0.0586 * s;
  const cx = size / 2,
    cy = size / 2;
  const c1 = { x: cx - off, y: cy };
  const c2 = { x: cx + off, y: cy };
  const aa = size * 0.004 + 0.75;
  const glowW = size * 0.05;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * size);
      let col = mix(BG_TOP, BG_BOT, t);

      // кольцо = |расстояние до центра - r|
      const paint = (c, ca, cb) => {
        const d = Math.hypot(x - c.x, y - c.y);
        const sd = Math.abs(d - r);
        const cov = clamp((sw / 2 - sd) / aa + 0.5, 0, 1);
        const glow = Math.exp(-Math.max(sd - sw / 2, 0) / glowW) * 0.45;
        const a = Math.max(cov, glow);
        if (a <= 0) return;
        const tt = clamp((x + y) / (2 * size), 0, 1);
        const rc = mix(ca, cb, tt);
        col = [lerp(col[0], rc[0], a), lerp(col[1], rc[1], a), lerp(col[2], rc[2], a)];
      };
      paint(c1, R1A, R1B);
      paint(c2, R2A, R2B);

      const i = (y * size + x) * 4;
      buf[i] = Math.round(clamp(col[0], 0, 255));
      buf[i + 1] = Math.round(clamp(col[1], 0, 255));
      buf[i + 2] = Math.round(clamp(col[2], 0, 255));
      buf[i + 3] = 255;
    }
  }
  return encodePNG(size, size, buf);
}

// --- минимальный PNG-энкодер (RGBA, 8 бит) ---
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const out = "public/icons/";
writeFileSync(out + "icon-192.png", render(192));
writeFileSync(out + "icon-512.png", render(512));
writeFileSync(out + "icon-180.png", render(180));
writeFileSync(out + "icon-maskable-512.png", render(512, 0.2));
console.log("Иконки готовы:", out);
