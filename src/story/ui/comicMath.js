// Camada de HQ do Modo História: a parte pura (sem DOM e sem three), testada em test/historia-comic.test.mjs.
// O DOM, os eventos e o canvas ficam em comic.js; aqui só contas:
//  - layouts → polígonos dos quadros na tela (calhas inclinadas, margens, área segura) e a inclinação de cada quadro;
//  - o viewOffset da câmera para o plano ficar centrado no quadro (o recorte "cover" do que ela mostraria na tela cheia);
//  - as entradas do quadro ao vivo (pop, slide, wipe, zoom, shrink) e a saída (o quadro cresce até a tela inteira);
//  - o encaixe do balão dentro do quadro (bordas, outros balões, rabicho para quem fala), os contornos de nanquim;
//  - o tempo de digitar (~45 caracteres/s, pausas na pontuação), de ler e de sumir; a fila de onomatopeias;
//  - o "motorista" do canvas: só escreve clip-path e viewOffset quando há quadro (sem evento, nada muda).

/** @typedef {[number, number]} Pt */
/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */
/** @typedef {{ t?: number, r?: number, b?: number, l?: number }} Insets */
/** @typedef {{ W: number, H: number, insets?: Insets }} Geom */

const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------------ easing
export const ease = {
  outCubic: (k) => 1 - (1 - k) ** 3,
  outQuart: (k) => 1 - (1 - k) ** 4,
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  inOutQuad: (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  outBack: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; },
};

/** Gerador pseudoaleatório com semente (mulberry32): o tremido do nanquim e os efeitos ficam iguais a cada quadro. */
export function seeded(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ polígonos
/** Área com sinal (y para baixo: positiva no sentido horário da tela). */
export function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s / 2;
}
export function centroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  const n = Math.max(1, poly.length);
  return /** @type {Pt} */ ([x / n, y / n]);
}
/** @returns {Rect} */
export function bboxOf(poly) {
  if (!poly || !poly.length) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
export const rectPoly = (r) => /** @type {Pt[]} */ ([[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]);

function dedupe(poly) {
  const out = [];
  for (const p of poly) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > 1e-6 || Math.abs(q[1] - p[1]) > 1e-6) out.push(p);
  }
  while (out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) > 1e-6 || Math.abs(a[1] - b[1]) > 1e-6) break;
    out.pop();
  }
  return out;
}
/** Recorta um polígono convexo, ficando com os pontos onde f(p) >= 0 (Sutherland–Hodgman com um semiplano). */
export function clipBy(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const fp = f(p), fq = f(q);
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return dedupe(out);
}
/** Lado s (+1/-1) da reta a→b: com y para baixo, +1 fica abaixo de uma reta "deitada" e à esquerda de uma "em pé". */
export function clipHalf(poly, a, b, s) {
  return clipBy(poly, (p) => s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])));
}
/** Ponto dentro do polígono convexo (eps em px: positivo aceita um pouco fora, negativo exige folga). */
export function inside(poly, x, y, eps = 0.5) {
  if (!poly || poly.length < 3) return false;
  const sg = area(poly) >= 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    if ((sg * (dx * (y - p[1]) - dy * (x - p[0]))) / len < -eps) return false;
  }
  return true;
}
/** Encolhe um polígono convexo d px para dentro (cada lado anda d pela normal). */
export function insetPoly(poly, d) {
  const n = poly.length;
  if (n < 3 || !d) return poly.slice();
  const sg = area(poly) >= 0 ? 1 : -1;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = (sg * -dy) / len, ny = (sg * dx) / len;
    lines.push([p[0] + nx * d, p[1] + ny * d, dx, dy]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const A = lines[(i - 1 + n) % n], B = lines[i];
    const cr = A[2] * B[3] - A[3] * B[2];
    if (Math.abs(cr) < 1e-9) { out.push([B[0], B[1]]); continue; }
    const t = ((B[0] - A[0]) * B[3] - (B[1] - A[1]) * B[2]) / cr;
    out.push([A[0] + A[2] * t, A[1] + A[3] * t]);
  }
  return /** @type {Pt[]} */ (out);
}
const xform = (poly, c, sx, sy, rot, tx, ty) => {
  const cs = Math.cos(rot), sn = Math.sin(rot);
  return poly.map((p) => {
    const x = (p[0] - c[0]) * sx, y = (p[1] - c[1]) * sy;
    return /** @type {Pt} */ ([c[0] + x * cs - y * sn + tx, c[1] + x * sn + y * cs + ty]);
  });
};

// ------------------------------------------------------------------ layouts
const H_ = (yl, yr) => [[0, yl], [1, yr]];
const V_ = (xt, xb) => [[xt, 0], [xb, 1]];
const UP = -1, DOWN = 1, LEFT = 1, RIGHT = -1;
const D2H = H_(0.535, 0.465), D2V = V_(0.53, 0.47);
const D3A_V = V_(0.6, 0.55), D3A_H = H_(0.46, 0.53);
const D3B_H = H_(0.52, 0.45), D3B_V = V_(0.44, 0.5);
const D4_V = V_(0.515, 0.485), D4_H = H_(0.53, 0.47);
/**
 * Cada quadro = a área útil recortada por semiplanos (divisórias levemente inclinadas, no espaço 0..1). Ordem de leitura.
 * @type {Record<string, [number[][], number][][]>}
 */
const CELLS = {
  full: [[]],
  '2h': [[[D2H, UP]], [[D2H, DOWN]]],
  '2v': [[[D2V, LEFT]], [[D2V, RIGHT]]],
  '3a': [[[D3A_V, LEFT]], [[D3A_V, RIGHT], [D3A_H, UP]], [[D3A_V, RIGHT], [D3A_H, DOWN]]],
  '3b': [[[D3B_H, UP]], [[D3B_H, DOWN], [D3B_V, LEFT]], [[D3B_H, DOWN], [D3B_V, RIGHT]]],
  '4': [[[D4_V, LEFT], [D4_H, UP]], [[D4_V, RIGHT], [D4_H, UP]], [[D4_V, LEFT], [D4_H, DOWN]], [[D4_V, RIGHT], [D4_H, DOWN]]],
};
/** Quantos quadros cada layout tem. */
export const SLOTS = /** @type {Record<string, number>} */ (Object.fromEntries(Object.entries(CELLS).map(([k, v]) => [k, v.length])));
/** Os layouts, na ordem de complexidade. */
export const LAYOUTS = ['full', '2h', '2v', '3a', '3b', '4'];

/** Margem da página, calha entre quadros e espessura do nanquim, em px, pelo tamanho da tela. */
export function frameMetrics(W, H) {
  const m = Math.min(W, H);
  return { margin: clamp(m * 0.03, 8, 22), gutter: clamp(m * 0.03, 7, 18), ink: clamp(m * 0.009, 2.6, 6) };
}
/** A área útil da página: a tela menos a margem e a área segura (entalhe do iPhone). */
export function contentBox(geom) {
  const { W, H } = geom;
  const ins = geom.insets || {};
  const { margin } = frameMetrics(W, H);
  const l = margin + (ins.l || 0), r = margin + (ins.r || 0), t = margin + (ins.t || 0), b = margin + (ins.b || 0);
  return { x: l, y: t, w: Math.max(10, W - l - r), h: Math.max(10, H - t - b) };
}
export const normLayout = (layout) => (CELLS[layout] ? layout : 'full');
export const normSlot = (layout, slot) => clamp(Math.round(Number(slot) || 0), 0, SLOTS[normLayout(layout)] - 1);

/** O quadro sem inclinação: a célula do layout, já com meia calha para dentro. */
export function cellPoly(layout, slot, geom) {
  const L = normLayout(layout);
  const box = contentBox(geom);
  const map = (p) => /** @type {Pt} */ ([box.x + p[0] * box.w, box.y + p[1] * box.h]);
  let poly = rectPoly(box);
  for (const [[a, b], s] of CELLS[L][normSlot(L, slot)]) poly = clipHalf(poly, map(a), map(b), s);
  return insetPoly(poly, frameMetrics(geom.W, geom.H).gutter / 2);
}

/** Gira o quadro `deg` graus no centro e encolhe (x e y separados, maior área) até caber na célula. */
export function tiltPoly(cell, deg) {
  if (!deg || cell.length < 3) return cell.slice();
  const c = centroid(cell);
  const rot = (deg * Math.PI) / 180;
  const fits = (sx, sy) => xform(cell, c, sx, sy, rot, 0, 0).every((p) => inside(cell, p[0], p[1], 0.01));
  let best = null, bestA = -1;
  for (let sx = 1; sx >= 0.5 - 1e-9; sx -= 0.05) {
    let lo = 0, hi = 1;
    if (fits(sx, 1)) lo = 1;
    else {
      if (!fits(sx, 0.02)) continue;
      lo = 0.02;
      for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (fits(sx, m)) lo = m; else hi = m; }
    }
    if (sx * lo > bestA) { bestA = sx * lo; best = [sx, lo]; }
  }
  if (!best) return cell.slice();
  return xform(cell, c, best[0], best[1], rot, 0, 0);
}

/**
 * Um quadro do layout na tela: polígono (px), caixa e a caixa em frações da tela (para compor o plano dentro dele).
 * @param {string} layout @param {number} slot @param {Geom} geom @param {number} [tilt] graus
 */
export function slotPoly(layout, slot, geom, tilt = 0) {
  const poly = tiltPoly(cellPoly(layout, slot, geom), clamp(Number(tilt) || 0, -12, 12));
  const bbox = bboxOf(poly);
  return { poly, bbox, frac: { x: bbox.x / geom.W, y: bbox.y / geom.H, w: bbox.w / geom.W, h: bbox.h / geom.H } };
}

/** Página nova? Layout diferente, ou um quadro já usado nesta página (hold: reabre esse quadro na mesma página). */
export function needsNewPage(page, ev) {
  if (!page) return true;
  if (page.layout !== ev.layout) return true;
  return page.used.has(ev.slot) && !ev.hold;
}

// ------------------------------------------------------------------ câmera
/**
 * O viewOffset que centra o plano no retângulo do quadro: o quadro mostra o recorte central ("cover") do que a câmera
 * mostraria na tela cheia — num quadro largo e baixo, a mesma largura de visão; num estreito, a mesma altura.
 * O canvas continua desenhando a tela inteira (só o quadro aparece, pelo clip-path).
 * @param {Rect} rect @param {number} W @param {number} H @param {number} [aspect] o camera.aspect (W/H)
 */
export function viewOffsetFor(rect, W, H, aspect = W / H) {
  const fh = Math.max(rect.h, rect.w / aspect, 1e-3);
  const fw = fh * aspect;
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  return { fullWidth: fw, fullHeight: fh, x: fw / 2 - cx, y: fh / 2 - cy, width: W, height: H };
}

// ------------------------------------------------------------------ entradas do quadro ao vivo
/** Duração (s) de cada entrada. */
export const ENTER = { pop: 0.42, slide: 0.44, wipe: 0.4, zoom: 0.5, shrink: 0.6, none: 0 };
export const EXIT_DUR = 0.5;
const scaleRect = (r, c, s) => ({ x: c[0] + (r.x - c[0]) * s, y: c[1] + (r.y - c[1]) * s, w: r.w * s, h: r.h * s });
const lerpRect = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });

/**
 * O quadro ao vivo no instante k (0..1) da entrada: o polígono do recorte e o retângulo do conteúdo (para o viewOffset).
 *  pop: cresce com mola e gira um tiquinho; zoom: nasce de um ponto; slide: entra pelo lado (from: -1 esquerda, 1
 *  direita); wipe: uma varredura diagonal revela o quadro (o conteúdo fica parado); shrink: a tela inteira encolhe até
 *  o quadro (o primeiro quadro da cena; ao contrário, a saída).
 * @param {Pt[]} poly @param {string} kind @param {number} k @param {Geom} geom @param {number} [from]
 */
export function animatePanel(poly, kind, k, geom, from = 1) {
  const b = bboxOf(poly);
  k = clamp01(k);
  if (k >= 1 || !ENTER[kind] || poly.length < 3) return { poly, content: b };
  const c = centroid(poly);
  const { W, H } = geom;
  switch (kind) {
    case 'shrink': {
      const e = ease.inOutCubic(k);
      const S = { x: 0, y: 0, w: W, h: H };
      const map = (p) => [S.x + ((p[0] - b.x) / (b.w || 1)) * S.w, S.y + ((p[1] - b.y) / (b.h || 1)) * S.h];
      const out = poly.map((p) => { const m = map(p); return /** @type {Pt} */ ([lerp(m[0], p[0], e), lerp(m[1], p[1], e)]); });
      return { poly: out, content: lerpRect(S, b, e) };
    }
    case 'pop': {
      const s = 0.5 + 0.5 * ease.outBack(k);
      const rot = (1 - ease.outCubic(k)) * (-6 * Math.PI / 180);
      return { poly: xform(poly, c, s, s, rot, 0, 0), content: scaleRect(b, c, s) };
    }
    case 'zoom': {
      const s = 0.06 + 0.94 * ease.outQuart(k);
      return { poly: xform(poly, c, s, s, 0, 0, 0), content: scaleRect(b, c, s) };
    }
    case 'slide': {
      const dx = (from < 0 ? -1 : 1) * (1 - ease.outCubic(k)) * W * 0.75;
      return { poly: xform(poly, c, 1, 1, 0, dx, 0), content: { ...b, x: b.x + dx } };
    }
    case 'wipe': {
      const ux = 0.95, uy = 0.31;
      let lo = Infinity, hi = -Infinity;
      for (const p of poly) { const d = p[0] * ux + p[1] * uy; lo = Math.min(lo, d); hi = Math.max(hi, d); }
      const t = lo + (hi - lo) * ease.inOutQuad(k);
      return { poly: clipBy(poly, (p) => t - (p[0] * ux + p[1] * uy)), content: b };
    }
    default: return { poly, content: b };
  }
}
/** De que lado o slide entra: do lado do quadro em relação ao meio da tela (no meio: ímpar pela direita). */
export function slideFrom(poly, geom, slot = 0) {
  const c = centroid(poly);
  const d = c[0] - geom.W / 2;
  if (Math.abs(d) > geom.W * 0.04) return d < 0 ? -1 : 1;
  return slot % 2 ? 1 : -1;
}

/**
 * O estado do quadro ao vivo (sem DOM): abrir um quadro, fechar a HQ e, a cada desenho, o recorte e o conteúdo.
 * Sem quadro aberto e sem saída em andamento, frame() devolve null (o canvas fica como está).
 */
export function createStage({ reduced = false } = {}) {
  /** @type {null | { id: number, layout: string, slot: number, tilt: number, enter: string, from: number, t0: number, dur: number, poly: Pt[], auto: boolean }} */
  let live = null;
  /** @type {null | { poly: Pt[], t0: number, dur: number }} */
  let exit = null;
  /** @type {Geom} */
  let geom = { W: 1, H: 1 };
  let seq = 0;
  const dur = (kind) => (ENTER[kind] ?? ENTER.pop) * (reduced ? 0.4 : 1);
  return {
    get live() { return live; },
    get busy() { return !!(live || exit); },
    get geom() { return geom; },
    /** Tamanho da tela mudou: refaz os polígonos. */
    setGeom(g) {
      geom = g;
      if (live) live.poly = slotPoly(live.layout, live.slot, g, live.tilt).poly;
    },
    /** Abre um quadro ao vivo (devolve o anterior, para a camada congelar). */
    open(now, { layout = 'full', slot = 0, tilt = 0, enter = 'pop', auto = false, t0 = now } = {}) {
      const prev = live;
      const L = normLayout(layout), s = normSlot(L, slot);
      const poly = slotPoly(L, s, geom, tilt).poly;
      const kind = ENTER[enter] !== undefined ? enter : 'pop';
      exit = null;
      live = { id: ++seq, layout: L, slot: s, tilt: Number(tilt) || 0, enter: kind, from: slideFrom(poly, geom, s), t0, dur: dur(kind), poly, auto };
      return prev;
    },
    /** Fecha a HQ: o quadro ao vivo cresce até a tela inteira (instant: some na hora). */
    close(now, instant = false) {
      const poly = live?.poly;
      live = null;
      exit = poly && !instant ? { poly, t0: now, dur: EXIT_DUR * (reduced ? 0.4 : 1) } : null;
    },
    clear() { live = null; exit = null; },
    /** O recorte (clip) e o retângulo do conteúdo agora; final = o polígono do quadro parado. */
    frame(now) {
      if (live) {
        const k = live.dur > 0 ? (now - live.t0) / live.dur : 1;
        const a = animatePanel(live.poly, live.enter, k, geom, live.from);
        return { clip: a.poly, content: a.content, final: live.poly, k: clamp01(k), live: true };
      }
      if (exit) {
        const k = (now - exit.t0) / exit.dur;
        if (k >= 1) { exit = null; return null; }
        const a = animatePanel(exit.poly, 'shrink', 1 - clamp01(k), geom);
        return { clip: a.poly, content: a.content, final: null, k: clamp01(k), live: false };
      }
      return null;
    },
  };
}

/** clip-path de CSS para o polígono (vazio: nada aparece). */
export function clipCss(poly) {
  if (!poly || poly.length < 3) return 'polygon(0px 0px, 0px 0px, 0px 0px)';
  return `polygon(${poly.map((p) => `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`).join(', ')})`;
}

/**
 * O motorista do canvas WebGL: prime() na hora do evento (o desenho deste quadro já sai com o plano novo) e step()
 * logo depois de cada desenho (aplica o recorte que acompanha o desenho feito e prepara o plano do próximo).
 * Só escreve no canvas e na câmera quando há quadro; ao acabar, desfaz clip-path, transform, filter e viewOffset.
 * @param {ReturnType<typeof createStage>} stage
 */
export function createLiveDriver(stage) {
  let pending = null;
  let applied = false;
  let clip = '';
  /** @param {{ style: any, camera: any }} target @param {Geom} geom */
  function view(target, f, geom) {
    const v = viewOffsetFor(f.content, geom.W, geom.H, target.camera.aspect || geom.W / geom.H);
    target.camera.setViewOffset(v.fullWidth, v.fullHeight, v.x, v.y, v.width, v.height);
    applied = true;
  }
  /** Desfaz tudo o que a camada pôs no canvas e na câmera (só se pôs). */
  function restore(target) {
    if (!applied) return;
    target.style.clipPath = '';
    target.style.transform = '';
    target.style.filter = '';
    target.camera.clearViewOffset();
    applied = false;
    clip = '';
  }
  return {
    get applied() { return applied; },
    get pending() { return pending; },
    /** Na hora do evento: o desenho deste quadro já sai com o plano do quadro novo. */
    prime(now, target, geom) {
      const f = stage.frame(now);
      if (f) view(target, f, geom);
      pending = f;
      return f;
    },
    /** Depois do desenho: aplica o recorte do quadro que acabou de aparecer (devolvido, ou null) e prepara o próximo. */
    step(now, target, geom) {
      const shown = pending;
      if (shown) {
        const c = clipCss(shown.clip);
        if (c !== clip) { target.style.clipPath = c; clip = c; }
      }
      const f = stage.frame(now);
      if (f) view(target, f, geom);
      else if (!shown) restore(target);
      pending = f;
      return shown;
    },
    restore,
    /** Corta na hora (pular a cena, trocar de fase). */
    reset(target) { pending = null; restore(target); },
  };
}

// ------------------------------------------------------------------ nanquim
/** Contorno de nanquim: os lados com um tremido leve e estável (semente), cantos exatos. */
export function inkPath(poly, seed = 1, jitter = 0.8, step = 26) {
  if (!poly || poly.length < 3) return '';
  const rnd = seeded(seed);
  let d = '';
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const n = Math.max(1, Math.round(len / step));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const jit = j ? (rnd() - 0.5) * 2 * jitter : 0;
      d += `${d ? 'L' : 'M'}${(p[0] + dx * t + nx * jit).toFixed(1)} ${(p[1] + dy * t + ny * jit).toFixed(1)}`;
    }
  }
  return `${d}Z`;
}
export const offsetPoly = (poly, dx, dy) => poly.map((p) => /** @type {Pt} */ ([p[0] + dx, p[1] + dy]));

// ------------------------------------------------------------------ balões
export const MOODS = ['normal', 'grito', 'sussurro', 'sono', 'pensa'];

/**
 * Tamanho do balão para um texto de tw × th px: raios da forma e a caixa (com espinhos/bolhas) em volta.
 * @param {number} tw @param {number} th @param {string} mood @param {number} [u] escala (1 = 1 px)
 */
export function balloonShape(tw, th, mood, u = 1) {
  let rx, ry, mx = 1, my = 1;
  if (mood === 'grito') { rx = (tw / 2) * 1.3 + 18 * u; ry = (th / 2) * 1.45 + 15 * u; mx = 1.17; my = 1.2; }
  else if (mood === 'pensa') { rx = (tw / 2) * 1.2 + 15 * u; ry = (th / 2) * 1.3 + 12 * u; mx = 1.12; my = 1.18; }
  else { rx = (tw / 2) * 1.16 + 12 * u; ry = (th / 2) * 1.22 + 9 * u; }
  return { rx, ry, w: Math.ceil(2 * rx * mx), h: Math.ceil(2 * ry * my) };
}
const fmt = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;
/** Oval de HQ (superelipse, quase um retângulo arredondado) com um tremido de pincel. */
export function ovalPath(cx, cy, rx, ry, seed = 1, n = 2.6, wob = 0.012) {
  const rnd = seeded(seed);
  const N = 44;
  let d = '';
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const c = Math.cos(a), s = Math.sin(a);
    const k = 1 + (rnd() - 0.5) * 2 * wob;
    const x = cx + rx * k * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = cy + ry * k * Math.sign(s) * Math.abs(s) ** (2 / n);
    d += `${i ? 'L' : 'M'}${fmt(x, y)}`;
  }
  return `${d}Z`;
}
/** Explosão do grito: espinhos alternando raio de fora e de dentro. */
export function burstPath(cx, cy, rx, ry, seed = 1) {
  const rnd = seeded(seed);
  const spikes = clamp(Math.round((rx + ry) / 9), 12, 22);
  let d = '';
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * TAU + (rnd() - 0.5) * 0.05;
    const r = i % 2 ? 0.86 + rnd() * 0.04 : 1.06 + rnd() * 0.1;
    d += `${i ? 'L' : 'M'}${fmt(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r)}`;
  }
  return `${d}Z`;
}
/** Nuvem do pensamento: arcos estufados em volta de uma elipse. */
export function cloudPath(cx, cy, rx, ry) {
  const bumps = clamp(Math.round((rx + ry) / 16), 8, 16);
  const pts = [];
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * TAU;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  let d = `M${fmt(pts[0][0], pts[0][1])}`;
  for (let i = 0; i < bumps; i++) {
    const p = pts[i], q = pts[(i + 1) % bumps];
    const r = Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.62;
    d += `A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${fmt(q[0], q[1])}`;
  }
  return `${d}Z`;
}
/** Rabicho curvo do centro (cx, cy) do balão até a ponta (tx, ty); base de `base` px. */
export function tailPath(cx, cy, tx, ty, base, rIn) {
  const dx = tx - cx, dy = ty - cy;
  const len = Math.hypot(dx, dy);
  if (len < 1) return '';
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const bx = cx + ux * rIn, by = cy + uy * rIn;
  const b1x = bx + nx * base / 2, b1y = by + ny * base / 2, b2x = bx - nx * base / 2, b2y = by - ny * base / 2;
  const bend = Math.min(len * 0.14, 16) * (ux >= 0 ? 1 : -1);
  const m1x = (b1x + tx) / 2 + nx * bend, m1y = (b1y + ty) / 2 + ny * bend;
  const m2x = (b2x + tx) / 2 + nx * bend * 0.6, m2y = (b2y + ty) / 2 + ny * bend * 0.6;
  return `M${fmt(b1x, b1y)}Q${fmt(m1x, m1y)} ${fmt(tx, ty)}Q${fmt(m2x, m2y)} ${fmt(b2x, b2y)}Z`;
}
/** As bolinhas do pensamento, do balão até a ponta. */
export function bubblesPath(cx, cy, tx, ty, rEdge, r) {
  const dx = tx - cx, dy = ty - cy;
  const len = Math.hypot(dx, dy);
  if (len < rEdge + 2) return '';
  const ux = dx / len, uy = dy / len;
  let d = '';
  const span = len - rEdge;
  [[0.22, 1], [0.58, 0.68], [0.9, 0.42]].forEach(([t, k]) => {
    const x = cx + ux * (rEdge + span * t), y = cy + uy * (rEdge + span * t), rr = r * k;
    d += `M${fmt(x - rr, y)}A${rr.toFixed(1)} ${rr.toFixed(1)} 0 1 0 ${fmt(x + rr, y)}A${rr.toFixed(1)} ${rr.toFixed(1)} 0 1 0 ${fmt(x - rr, y)}Z`;
  });
  return d;
}

/** Área da interseção de dois retângulos. */
export function overlap(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
/** @type {[string, (ax: number, ay: number, w: number, h: number, g: number) => number[], number][]} */
const CANDIDATES = [
  // lado, centro em função da âncora (ax, ay), caixa (w, h) e espaço do rabicho (g); preferência (menor = melhor)
  ['ul', (ax, ay, w, h, g) => [ax - w * 0.3, ay - g - h / 2], 0],
  ['ur', (ax, ay, w, h, g) => [ax + w * 0.3, ay - g - h / 2], 5],
  ['u', (ax, ay, w, h, g) => [ax, ay - g - h / 2], 9],
  ['ull', (ax, ay, w, h, g) => [ax - w * 0.72, ay - g * 0.7 - h / 2], 13],
  ['urr', (ax, ay, w, h, g) => [ax + w * 0.72, ay - g * 0.7 - h / 2], 15],
  ['l', (ax, ay, w, h, g) => [ax - g - w / 2, ay - h * 0.35], 26],
  ['r', (ax, ay, w, h, g) => [ax + g + w / 2, ay - h * 0.35], 28],
  ['dl', (ax, ay, w, h, g) => [ax - w * 0.3, ay + g + h / 2], 60],
  ['dr', (ax, ay, w, h, g) => [ax + w * 0.3, ay + g + h / 2], 64],
];
/**
 * Onde o balão fica: dentro do quadro (com folga das bordas, inclusive as inclinadas), sem cobrir outros balões nem
 * quem fala, de preferência acima e à esquerda da cabeça. Fora do quadro ou atrás da câmera: na borda mais perto, com o
 * rabicho apontando para fora (out: true, a etiqueta com o nome aparece).
 * @param {{ anchor: { x: number, y: number, front: boolean } | null, w: number, h: number, poly: Pt[],
 *   others?: Rect[], prev?: string | null, pad?: number, gap?: number }} o
 * @returns {{ x: number, y: number, side: string, tip: { x: number, y: number } | null, out: boolean }}
 */
export function placeBalloon({ anchor, w, h, poly, others = [], prev = null, pad = 8, gap = 22 }) {
  const b = bboxOf(poly);
  const c = centroid(poly);
  const R = { x: b.x + pad, y: b.y + pad, w: Math.max(0, b.w - 2 * pad), h: Math.max(0, b.h - 2 * pad) };
  const clampBox = (x, y) => [
    w >= R.w ? R.x + (R.w - w) / 2 : clamp(x, R.x, R.x + R.w - w),
    h >= R.h ? R.y + (R.h - h) / 2 : clamp(y, R.y, R.y + R.h - h),
  ];
  const corners = (x, y) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  // as bordas inclinadas: puxa para o meio do quadro até os quatro cantos caberem
  /** @param {number[]} p */
  const fit = ([x, y]) => {
    for (let i = 0; i < 14; i++) {
      if (corners(x, y).every((p) => inside(poly, p[0], p[1], -pad * 0.5))) break;
      x += (c[0] - (x + w / 2)) * 0.2;
      y += (c[1] - (y + h / 2)) * 0.2;
    }
    return [x, y];
  };
  const crowd = (x, y) => others.reduce((s, o) => s + overlap({ x, y, w, h }, o), 0);
  if (!anchor) {
    const [x, y] = fit(clampBox(b.x + b.w / 2 - w / 2, R.y));
    return { x, y, side: 'top', tip: null, out: true };
  }
  const front = anchor.front !== false;
  if (!front || !inside(poly, anchor.x, anchor.y, 0)) {
    // fora do quadro: encosta na borda mais perto da direção de quem fala
    let ax = anchor.x, ay = anchor.y;
    if (!front) { ax = c[0] + (anchor.x >= c[0] ? 1 : -1) * b.w; ay = b.y + b.h * 2; }
    let best = null, bestS = Infinity;
    for (const dy of [0, -1, 1, -2, 2]) {
      const [x0, y0] = clampBox(ax - w / 2, ay - h / 2 + dy * (h + 6));
      const [x, y] = fit([x0, y0]);
      const s = crowd(x, y) * 0.08 + Math.abs(dy) * 30;
      if (s < bestS) { bestS = s; best = [x, y]; }
    }
    const [x, y] = best;
    const bx = x + w / 2, by = y + h / 2;
    const dx = ax - bx, dy = ay - by;
    const len = Math.hypot(dx, dy) || 1;
    const reach = Math.abs(dx / len) * w / 2 + Math.abs(dy / len) * h / 2 + gap;
    const t = Math.min(len, reach);
    return { x, y, side: 'out', tip: { x: bx + (dx / len) * t, y: by + (dy / len) * t }, out: true };
  }
  let best = null, bestS = Infinity;
  for (const [side, at, pref] of CANDIDATES) {
    const [cx, cy] = at(anchor.x, anchor.y, w, h, gap);
    const [x, y] = fit(clampBox(cx - w / 2, cy - h / 2));
    let s = pref + Math.hypot(x + w / 2 - cx, y + h / 2 - cy) * 0.6 + crowd(x, y) * 0.08;
    if (anchor.x > x - 4 && anchor.x < x + w + 4 && anchor.y > y - 4 && anchor.y < y + h + 4) s += 300;
    if (prev && prev !== side) s += 18;
    if (s < bestS) { bestS = s; best = { x, y, side }; }
  }
  // o rabicho para na cabeça; longe demais, fica num tamanho de HQ
  const bx = best.x + w / 2, by = best.y + h / 2;
  const dx = anchor.x - bx, dy = anchor.y - by;
  const len = Math.hypot(dx, dy) || 1;
  const max = Math.max(w, h) / 2 + gap * 1.6 + 26;
  const t = Math.min(len - 3, max);
  return { ...best, tip: { x: bx + (dx / len) * t, y: by + (dy / len) * t }, out: false };
}

/** O canto do quadro para uma caixa (narração, legenda): tl, tr, bl, br ou center, encaixada no polígono. */
export function placeCorner(poly, w, h, pos = 'tl', pad = 10) {
  const b = bboxOf(poly);
  const c = centroid(poly);
  let x = pos === 'tr' || pos === 'br' ? b.x + b.w - pad - w : pos === 'center' ? b.x + (b.w - w) / 2 : b.x + pad;
  let y = pos === 'bl' || pos === 'br' ? b.y + b.h - pad - h : pos === 'center' ? b.y + (b.h - h) / 2 : b.y + pad;
  for (let i = 0; i < 14; i++) {
    const ok = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].every((p) => inside(poly, p[0], p[1], -pad * 0.4));
    if (ok) break;
    x += (c[0] - (x + w / 2)) * 0.12;
    y += (c[1] - (y + h / 2)) * 0.12;
  }
  return { x, y };
}

// ------------------------------------------------------------------ tempos do texto
export const CPS = 45;
export const READ_MIN = 0.7;
export const OUT_DUR = 0.22;
const PAUSE_LONG = 0.12, PAUSE_SHORT = 0.05;
const LONG = /[.!?…]/, SHORT = /[,;:—–]/;
/**
 * Quando cada caractere aparece (s): ~45 por segundo, com respiro depois da pontuação. A MESMA conta de charTimes em
 * src/story/ui/subtitles.js (a voz de sílabas do storyHud toca em cada story:say por ela): texto e voz andam juntos.
 */
export function typeTimes(text, cps = CPS) {
  const step = 1 / Math.max(1, cps);
  const out = [];
  let t = 0;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    out.push(t);
    t += step;
    const c = s[i], next = s[i + 1];
    if (next !== undefined && !LONG.test(next) && LONG.test(c)) t += PAUSE_LONG;
    else if (next !== undefined && SHORT.test(c)) t += PAUSE_SHORT;
  }
  return out;
}
/** Quantos caracteres já apareceram no instante t. */
export function typedCount(times, t) {
  let lo = 0, hi = times.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (times[m] <= t) lo = m + 1; else hi = m; }
  return lo;
}
/**
 * Fim da digitação, quando começa a sumir e quando some de vez. O `dur` do evento manda, mas nunca some antes de
 * terminar de digitar e dar um tempinho de ler.
 */
export function sayTiming(text, dur, cps = CPS) {
  const times = typeTimes(text, cps);
  const typeEnd = times.length ? times[times.length - 1] + 1 / cps : 0;
  const want = Number.isFinite(dur) && dur > 0 ? dur : typeEnd + 2.2;
  const hideAt = Math.max(want, typeEnd + READ_MIN);
  return { times, typeEnd, hideAt, goneAt: hideAt + OUT_DUR };
}
/** De duas em duas letras (para quem quiser marcar as sílabas da digitação; a voz de hoje sai do próprio story:say). */
export function voiceMarks(text) {
  const out = [];
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (/[\p{L}\p{N}]/u.test(text[i])) { if (n % 2 === 0) out.push(i); n++; }
  }
  return out;
}

// ------------------------------------------------------------------ onomatopeias
export const SFX_COLORS = ['#FFD23F', '#FF7A3D', '#FF5D8F', '#41C7E6', '#8BD346', '#B57CFF'];
const SFX_ROTS = [-9, 7, -5, 10, -7, 4];
/**
 * A fila das onomatopeias na tela: no máximo `max` juntas (a mais antiga sai), cada uma com sua vida; uma nova no
 * mesmo lugar de outra viva entra deslocada (escadinha), para não ficarem uma em cima da outra.
 */
export function createOnomatoQueue({ max = 3, life = 1.25 } = {}) {
  let seq = 0;
  /** @type {any[]} */
  let items = [];
  const prune = (now) => { items = items.filter((it) => now < it.t1); };
  const key = (o) => (o.anchor ? [o.anchor.x, o.anchor.z ?? o.anchor.y, 'w'] : [o.sx ?? 0.5, o.sy ?? 0.4, 's']);
  return {
    /** @param {number} now @param {any} [o] @returns {{ item: any, evicted: any[] }} */
    push(now, o = {}) {
      prune(now);
      const n = seq++;
      const [kx, ky, kind] = key(o);
      const near = items.filter((it) => {
        const [x, y, k2] = key(it);
        return k2 === kind && Math.hypot(x - kx, y - ky) < (kind === 'w' ? 0.6 : 0.12);
      }).length;
      const item = {
        id: n + 1, t0: now, t1: now + (Number(o.dur) > 0 ? Number(o.dur) : life),
        text: String(o.text ?? ''), anchor: o.anchor ?? null, sx: o.sx ?? 0.5, sy: o.sy ?? 0.4,
        size: Number(o.size) > 0 ? Number(o.size) : 1, style: ['pop', 'shake', 'stretch'].includes(o.style) ? o.style : 'pop',
        color: o.color || SFX_COLORS[n % SFX_COLORS.length], rot: Number.isFinite(o.rot) ? o.rot : SFX_ROTS[n % SFX_ROTS.length],
        // escadinha: em frações do lado menor da tela
        dx: near * 0.07, dy: near * -0.06,
      };
      items.push(item);
      const evicted = [];
      while (items.length > max) evicted.push(items.shift());
      return { item, evicted };
    },
    active(now) { prune(now); return items.slice(); },
    clear() { items = []; },
  };
}
