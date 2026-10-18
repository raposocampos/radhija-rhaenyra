// Gera os ícones de "Adicionar à tela inicial" (public/icon-192.png, icon-512.png, apple-touch-icon.png):
// patinha creme com contorno chocolate sobre o degradê da tela de carregamento. Sem dependências: desenha por
// distância com superamostragem 4×4 e grava o PNG com zlib. A patinha ocupa o centro (zona segura dos ícones
// "maskable" do Android). Rode só se quiser redesenhar:  node tools/scripts/gen-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Patinha no espaço 24×24 do pawIcon (src/ui/icons.js): almofada + quatro dedos (elipses: cx, cy, rx, ry, graus)
const PAW = [
  [12, 15.3, 5.7, 4.2, 0],
  [5.6, 10.2, 1.95, 2.45, -18],
  [9.4, 6.4, 1.95, 2.55, -6],
  [14.6, 6.4, 1.95, 2.55, 6],
  [18.4, 10.2, 1.95, 2.45, 18],
];
const TOP = [246, 200, 148];
const BOTTOM = [214, 128, 78];
const CREAM = [255, 246, 230];
const INK = [74, 52, 38];

/** Distância aproximada (negativa dentro) de p até a união das elipses, em unidades do espaço 24×24. */
function pawDist(x, y) {
  let d = Infinity;
  for (const [cx, cy, rx, ry, deg] of PAW) {
    const a = (deg * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * Math.cos(a) + dy * Math.sin(a);
    const v = -dx * Math.sin(a) + dy * Math.cos(a);
    d = Math.min(d, (Math.hypot(u / rx, v / ry) - 1) * Math.min(rx, ry));
  }
  return d;
}

function render(size) {
  const px = new Uint8Array(size * size * 4);
  const span = 0.6 * size; // largura da patinha
  const k = 16.8 / span; // pixel → unidade 24×24
  const cx = 12;
  const cy = 11.7;
  const SS = 4;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const fx = i + (si + 0.5) / SS;
          const fy = j + (sj + 0.5) / SS;
          const t = fy / size;
          let c = TOP.map((v, n) => v + (BOTTOM[n] - v) * t);
          const x = cx + (fx - size / 2) * k;
          const y = cy + (fy - size / 2) * k;
          const shadow = pawDist(x, y - 0.75);
          if (shadow < 0.55) c = c.map((v, n) => v * 0.72 + INK[n] * 0.28);
          const d = pawDist(x, y);
          if (d < 0.55) c = INK;
          if (d < 0) c = CREAM;
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const o = (j * size + i) * 4;
      px[o] = Math.round(r / (SS * SS));
      px[o + 1] = Math.round(g / (SS * SS));
      px[o + 2] = Math.round(b / (SS * SS));
      px[o + 3] = 255;
    }
  }
  return px;
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}
function png(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // 8 bits
  ihdr.writeUInt8(6, 9); // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let j = 0; j < size; j++) {
    raw[j * (size * 4 + 1)] = 0; // sem filtro
    Buffer.from(px.buffer, j * size * 4, size * 4).copy(raw, j * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(resolve(ROOT, 'public', name), png(size, render(size)));
  console.log(`public/${name} (${size}×${size})`);
}
