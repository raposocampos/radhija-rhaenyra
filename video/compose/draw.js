// Primitivas de desenho do trailer (Canvas 2D): identidade visual do jogo (Fredoka + Nunito, creme, marrom e
// laranja do menu), texto com contorno, pílulas, ícones vetoriais e partículas determinísticas.
import { clamp, ease, lerp, prog, rng, spring } from './motion.js';

export const C = {
  cream: '#FFF6E9',
  creamDim: '#F3E3CC',
  ink: '#4A2C1A',
  inkSoft: '#6B4430',
  orange: '#F28C38',
  orangeDeep: '#DD6A1E',
  honey: '#F0A646', // Radhija
  honeyDeep: '#C9781E',
  teal: '#4FB3A9', // Rhaenyra
  tealDeep: '#2F8A80',
  night: '#1C1F3A',
  pink: '#F7A7B8',
  white: '#FFFFFF',
};

export const FONT_TITLE = '"Fredoka", "Nunito", sans-serif';
export const FONT_BODY = '"Nunito", "Fredoka", sans-serif';

/** Retângulo arredondado (caminho). */
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function font(weight, size, family = FONT_TITLE) {
  return `${weight} ${size}px ${family}`;
}

/** Largura do texto com espaçamento entre letras (px). */
export function measure(ctx, text, tracking = 0) {
  return ctx.measureText(text).width + Math.max(0, text.length - 1) * tracking;
}

/**
 * Texto do título no estilo do menu: preenchimento creme, contorno marrom grosso e sombra. Cada letra pode animar
 * (letterFx(i, n) → { y, s, r, a }). align: 'center' | 'left' | 'right'.
 */
export function titleText(ctx, text, x, y, {
  size = 140, weight = 700, fill = C.cream, stroke = C.ink, strokeW = size * 0.12, shadow = 'rgba(40,20,8,0.55)',
  shadowY = size * 0.07, align = 'center', tracking = 0, letterFx = null, colors = null, family = FONT_TITLE, alpha = 1,
} = {}) {
  ctx.save();
  const baseAlpha = ctx.globalAlpha;
  ctx.font = font(weight, size, family);
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  // posições pelas larguras dos prefixos: respeita o kerning da fonte (o "FA" de FASES não fica separado)
  const chars = [...text];
  const prefix = (i) => ctx.measureText(chars.slice(0, i).join('')).width + tracking * i;
  const total = prefix(chars.length) - tracking;
  const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const placed = chars.map((ch, i) => {
    const a = prefix(i);
    const b = prefix(i + 1) - tracking;
    return { ch, x: x0 + (a + b) / 2, w: ctx.measureText(ch).width, i };
  });
  // três passadas (sombra, contorno, preenchimento) para o contorno de uma letra não cobrir a vizinha
  for (const pass of ['shadow', 'stroke', 'fill']) {
    for (const p of placed) {
      if (p.ch === ' ') continue;
      const fx = letterFx ? letterFx(p.i, placed.length) : null;
      const a = alpha * (fx?.a ?? 1);
      if (a <= 0.002) continue;
      const s = fx?.s ?? 1;
      if (s <= 0.001) continue;
      ctx.save();
      ctx.globalAlpha = baseAlpha * clamp(a);
      ctx.translate(p.x + (fx?.x ?? 0), y + (fx?.y ?? 0));
      if (fx?.r) ctx.rotate(fx.r);
      ctx.scale(s, s);
      if (pass === 'shadow' && shadow) {
        ctx.fillStyle = shadow;
        ctx.strokeStyle = shadow;
        ctx.lineWidth = strokeW;
        ctx.translate(0, shadowY);
        ctx.strokeText(p.ch, -p.w / 2, 0);
        ctx.fillText(p.ch, -p.w / 2, 0);
      } else if (pass === 'stroke' && stroke && strokeW > 0) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeW;
        ctx.strokeText(p.ch, -p.w / 2, 0);
      } else if (pass === 'fill') {
        ctx.fillStyle = colors?.[p.i] ?? fill;
        ctx.fillText(p.ch, -p.w / 2, 0);
      }
      ctx.restore();
    }
  }
  ctx.restore();
  return { width: total, placed };
}

/** Texto simples com sombra suave. */
export function softText(ctx, text, x, y, { size = 44, weight = 800, color = C.cream, family = FONT_BODY, align = 'center',
  alpha = 1, shadow = 'rgba(20,10,4,0.55)', blur = 14, tracking = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = font(weight, size, family);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const w = measure(ctx, text, tracking);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.shadowColor = shadow;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = color;
  if (!tracking) ctx.fillText(text, cx, y);
  else for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + tracking; }
  ctx.restore();
  return w;
}

/** Pílula com texto (estilo dos selos do menu). */
export function pill(ctx, text, x, y, { size = 40, weight = 800, family = FONT_BODY, bg = C.orange, fg = C.cream,
  padX = size * 0.75, h = size * 1.75, border = null, borderW = 5, align = 'center', alpha = 1, scale = 1, tracking = 0,
  shadow = true, icon = null, iconColor = null } = {}) {
  ctx.save();
  ctx.font = font(weight, size, family);
  const tw = measure(ctx, text, tracking);
  const iconW = icon ? h * 0.62 + size * 0.35 : 0;
  const w = tw + padX * 2 + iconW;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.globalAlpha *= alpha;
  ctx.translate(x0 + w / 2, y);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  if (shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(30,14,4,0.38)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, 0, 0, w, h, h / 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();
  }
  roundRect(ctx, 0, 0, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  // brilho de cima (como os botões do menu)
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, w, h, h / 2);
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = borderW;
    roundRect(ctx, borderW / 2, borderW / 2, w - borderW, h - borderW, (h - borderW) / 2);
    ctx.stroke();
  }
  if (icon) icon(ctx, padX + h * 0.31, h / 2, h * 0.31, iconColor || fg);
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  let cx = padX + iconW;
  const ty = h / 2 + size * 0.06;
  if (!tracking) ctx.fillText(text, cx, ty);
  else for (const ch of text) { ctx.fillText(ch, cx, ty); cx += ctx.measureText(ch).width + tracking; }
  ctx.restore();
  return { w: w * scale, h: h * scale };
}

// ------------------------------------------------------------------------------------------------ ícones
/** Patinha (almofada + 4 dedos), centrada em (x, y), raio ~r. */
export function paw(ctx, x, y, r, color, rot = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.28, r * 0.55, r * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  const toes = [[-0.62, -0.18, 0.21], [-0.24, -0.58, 0.23], [0.24, -0.58, 0.23], [0.62, -0.18, 0.21]];
  for (const [tx, ty, tr] of toes) {
    ctx.beginPath();
    ctx.ellipse(tx * r, ty * r, tr * r, tr * r * 1.22, tx * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Ossinho. */
export function bone(ctx, x, y, r, color, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  const L = r * 0.95;
  const k = r * 0.36;
  roundRect(ctx, -L, -k * 0.62, L * 2, k * 1.24, k * 0.6);
  ctx.fill();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * L, sy * k * 0.6, k * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function heart(ctx, x, y, r, color, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.9);
  ctx.bezierCurveTo(-r * 1.25, r * 0.05, -r * 0.9, -r * 0.95, 0, -r * 0.38);
  ctx.bezierCurveTo(r * 0.9, -r * 0.95, r * 1.25, r * 0.05, 0, r * 0.9);
  ctx.fill();
  ctx.restore();
}

/** Brilho de 4 pontas. */
export function sparkle(ctx, x, y, r, color, rot = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  const tips = [[r, 0], [0, r], [-r, 0], [0, -r]];
  let prev = [0, -r];
  for (const tip of tips) {
    // ponto de controle perto do centro, no meio das duas pontas: lados côncavos
    const cx = (prev[0] + tip[0]) * 0.14;
    const cy = (prev[1] + tip[1]) * 0.14;
    ctx.quadraticCurveTo(cx, cy, tip[0], tip[1]);
    prev = tip;
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function star(ctx, x, y, r, color, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Redemoinho de vento (superbafo). */
export function wind(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = r * 0.2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, -r * 0.35);
  ctx.lineTo(r * 0.35, -r * 0.35);
  ctx.arc(r * 0.35, -r * 0.62, r * 0.27, Math.PI / 2, -Math.PI * 0.9, true);
  ctx.moveTo(-r * 0.9, r * 0.05);
  ctx.lineTo(r * 0.55, r * 0.05);
  ctx.moveTo(-r * 0.6, r * 0.45);
  ctx.lineTo(r * 0.15, r * 0.45);
  ctx.arc(r * 0.15, r * 0.7, r * 0.25, -Math.PI / 2, Math.PI * 0.8, false);
  ctx.stroke();
  ctx.restore();
}

/** Raio (arrancada). */
export function bolt(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  const p = [[0.15, -1], [-0.55, 0.12], [-0.05, 0.12], [-0.2, 1], [0.55, -0.15], [0.05, -0.15], [0.3, -1]];
  p.forEach(([a, b], i) => (i ? ctx.lineTo(a * r, b * r) : ctx.moveTo(a * r, b * r)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Seta para cima (pulo). */
export function arrowUp(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.28;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.85);
  ctx.lineTo(0, -r * 0.7);
  ctx.moveTo(-r * 0.6, -r * 0.1);
  ctx.lineTo(0, -r * 0.75);
  ctx.lineTo(r * 0.6, -r * 0.1);
  ctx.stroke();
  ctx.restore();
}

/** Mãozinha empurrando (empurrão): uma patinha com tracinhos de força. */
export function pushIcon(ctx, x, y, r, color) {
  paw(ctx, x + r * 0.15, y, r * 0.75, color, Math.PI / 2);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = 'round';
  for (const k of [-0.45, 0, 0.45]) {
    ctx.beginPath();
    ctx.moveTo(x - r * 1.0, y + k * r);
    ctx.lineTo(x - r * 0.6, y + k * r);
    ctx.stroke();
  }
  ctx.restore();
}

/** Teclado, controle e celular (cartão final). */
export function keyboardIcon(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = r * 0.12;
  roundRect(ctx, -r, -r * 0.55, r * 2, r * 1.1, r * 0.18);
  ctx.stroke();
  for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
    roundRect(ctx, -r * 0.78 + col * r * 0.33, -r * 0.33 + row * r * 0.3, r * 0.22, r * 0.2, r * 0.05);
    ctx.fill();
  }
  roundRect(ctx, -r * 0.5, r * 0.25, r, r * 0.16, r * 0.06);
  ctx.fill();
  ctx.restore();
}
export function gamepadIcon(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, -r * 0.45);
  ctx.lineTo(r * 0.55, -r * 0.45);
  ctx.bezierCurveTo(r * 1.05, -r * 0.45, r * 1.15, r * 0.6, r * 0.85, r * 0.62);
  ctx.bezierCurveTo(r * 0.6, r * 0.66, r * 0.45, r * 0.25, r * 0.3, r * 0.2);
  ctx.lineTo(-r * 0.3, r * 0.2);
  ctx.bezierCurveTo(-r * 0.45, r * 0.25, -r * 0.6, r * 0.66, -r * 0.85, r * 0.62);
  ctx.bezierCurveTo(-r * 1.15, r * 0.6, -r * 1.05, -r * 0.45, -r * 0.55, -r * 0.45);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(-r * 0.62, -r * 0.13, r * 0.36, r * 0.1);
  ctx.fillRect(-r * 0.49, -r * 0.26, r * 0.1, r * 0.36);
  for (const [bx, by] of [[0.45, -0.2], [0.62, -0.05], [0.45, 0.1], [0.28, -0.05]]) {
    ctx.beginPath();
    ctx.arc(bx * r, by * r, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
export function phoneIcon(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = r * 0.12;
  roundRect(ctx, -r * 0.95, -r * 0.5, r * 1.9, r * 1.0, r * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-r * 0.55, r * 0.05, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.55, r * 0.05, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ partículas
/**
 * Confete/patinhas/corações caindo ou explodindo, determinísticos por semente. kind: 'confetti' | 'paws' | 'hearts' |
 * 'sparkles'. mode: 'burst' (de um ponto) ou 'rain' (caindo do alto). t: s desde o começo.
 */
export function particles(ctx, t, { kind = 'confetti', mode = 'burst', seed = 7, n = 60, x = 960, y = 540, w = 1920, h = 1080,
  life = 2.2, speed = 900, gravity = 1400, size = 16, colors = [C.orange, C.honey, C.teal, C.pink, C.cream], alpha = 1 } = {}) {
  if (t < 0) return;
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const delay = mode === 'rain' ? R() * life * 0.9 : R() * 0.08;
    const tt = t - delay;
    const lifeI = life * (0.7 + R() * 0.5);
    const col = colors[Math.floor(R() * colors.length)];
    const sz = size * (0.6 + R() * 0.8);
    const spin = (R() - 0.5) * 10;
    const r0 = R() * Math.PI * 2;
    let px;
    let py;
    if (mode === 'burst') {
      const a = -Math.PI / 2 + (R() - 0.5) * Math.PI * 1.5;
      const v = speed * (0.45 + R() * 0.75);
      px = x + Math.cos(a) * v * tt;
      py = y + Math.sin(a) * v * tt + 0.5 * gravity * tt * tt;
      // arrasto do ar: desacelera no fim
      const drag = 1 / (1 + tt * 0.9);
      px = x + (px - x) * drag;
    } else {
      const sx = R() * w;
      const vy = speed * (0.25 + R() * 0.25);
      px = sx + Math.sin(tt * (1.5 + R() * 2) + r0) * 40;
      py = y - 60 + vy * tt;
    }
    if (tt < 0 || tt > lifeI) continue;
    const fade = 1 - ease.inQuad(prog(tt, lifeI * 0.6, lifeI));
    const pop = ease.outBack(prog(tt, 0, 0.18));
    ctx.save();
    ctx.globalAlpha *= alpha * fade;
    const rot = r0 + spin * tt;
    if (kind === 'confetti') {
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.scale(1, Math.cos(tt * 7 + r0) * 0.8 + 0.2);
      ctx.fillStyle = col;
      ctx.fillRect(-sz * 0.5 * pop, -sz * 0.28 * pop, sz * pop, sz * 0.56 * pop);
    } else if (kind === 'paws') paw(ctx, px, py, sz * pop, col, rot * 0.2);
    else if (kind === 'hearts') heart(ctx, px, py, sz * pop, col, Math.sin(tt * 3 + r0) * 0.3);
    else if (kind === 'sparkles') sparkle(ctx, px, py, sz * pop * (0.7 + 0.3 * Math.sin(tt * 12 + r0)), col, rot * 0.3);
    ctx.restore();
  }
}

/** Vinheta suave. */
export function vignette(ctx, w, h, k = 0.35) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(12,6,2,${k})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Granulado de filme (ladrilho de ruído pré-gerado, deslocado por quadro). */
let grainTile = null;
export function grain(ctx, w, h, frame, amount = 0.05) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 256;
    grainTile.height = 256;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(256, 256);
    const R = rng(99);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(R() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  const R = rng(frame * 13 + 1);
  const ox = -Math.floor(R() * 256);
  const oy = -Math.floor(R() * 256);
  for (let y = oy; y < h; y += 256) for (let x = ox; x < w; x += 256) ctx.drawImage(grainTile, x, y);
  ctx.restore();
}

/** Escurece um lado (legibilidade de texto sobre a cena). side: 'left' | 'right' | 'bottom' | 'top'. */
export function shade(ctx, w, h, side, k = 0.55, size = 0.55) {
  let g;
  if (side === 'left') g = ctx.createLinearGradient(0, 0, w * size, 0);
  else if (side === 'right') g = ctx.createLinearGradient(w, 0, w * (1 - size), 0);
  else if (side === 'bottom') g = ctx.createLinearGradient(0, h, 0, h * (1 - size));
  else g = ctx.createLinearGradient(0, 0, 0, h * size);
  g.addColorStop(0, `rgba(18,9,3,${k})`);
  g.addColorStop(1, 'rgba(18,9,3,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export { clamp, ease, lerp, prog, spring };
