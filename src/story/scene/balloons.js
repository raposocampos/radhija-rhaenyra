// Balões de ícone das cenas (kit de cenas do Modo História, sem palavras): fala (balão com a pontinha), pensamento
// (nuvem de gomos com três bolinhas) e ícone solto (sem balão, com um halo claro, colado no objeto que ele representa),
// com os ícones do roteiro (docs/HISTORIA.md, "Ícones dos balões").
//  - Arte: um atlas só (canvas 2048 × 2048, casas de 256), desenhado uma vez: os ícones nas seis primeiras fileiras e
//    os fundos (fala e pensamento, para 1, 2 e 3 ícones) nas duas últimas. Contorno grosso de chocolate, cores chapadas.
//  - "Frases": show(['cenoura', 'q']) põe até três ícones lado a lado num balão mais largo (fundo próprio no atlas).
//  - Cada balão são sprites do mesmo atlas (o fundo e até três ícones), sempre de frente para a câmera e por cima de
//    tudo. Todos ficam na mesma posição do mundo (a ponta do balão) e se deslocam na tela pelo Sprite.center: vale em
//    qualquer ângulo, e a rotação do material balança o balão inteiro em volta da ponta.
//  - Tamanho na tela: com a câmera (update(dt, camera) ou createBalloons({ camera })), a escala acompanha a distância
//    para o balão nunca ficar minúsculo nem gigante; sem a câmera, o size vale em metros, como sempre.
// API: createBalloons({ root, camera? }) → { show(icon | icons[], opts) → id, hide(id), clear(), update(dt, camera?),
//   setCamera(camera), dispose(), icons, active, list() }.
import * as THREE from 'three';

// =====================================================================================================================
// ARTE: só canvas 2D, sem Three (uma prévia fora do jogo pode copiar este trecho inteiro e desenhar o mesmo atlas)
// =====================================================================================================================

/** Ícones do atlas, em ordem de casa. */
export const BALLOON_ICONS = [
  'cenoura', 'cone', 'osso', 'coracao', 'q', 'ex', 'raiva', 'medo', 'zzz', 'lampada', 'lupa', 'mapa', 'seta',
  'migalha', 'ovo', 'gota', 'relogio', 'sino', 'nota', 'espiral', 'focinho', 'meia', 'pena',
  'pombo', 'cheiro', 'latido', 'x', 'ok', 'janela', 'porta', 'cesto', 'pata', 'chuva', 'pote', 'botao', 'lixeira',
  'barco', 'corda', 'bola', 'ganso', 'grade', 'saco', 'empurrar', 'olho', 'casa', 'torre',
];

const SIZE = 2048;
const GRID = 8;
const CELL = SIZE / GRID;
/** Fileiras dos ícones (as duas de baixo são dos fundos). */
const ICON_ROWS = 6;
/** Largura de cada fundo no atlas, para 1, 2 e 3 ícones (a altura é a de uma casa). */
const BG_W = [256, 396, 536];
/** Lado do quadro de um ícone dentro do balão e a distância entre dois ícones vizinhos (na escala do fundo, em px). */
const ICON_PX = 160;
const SLOT_PX = 140;

/** Medidas do atlas (para testes e ferramentas): os ícones cabem em iconCells casas; uma frase tem até maxIcons. */
export const BALLOON_ATLAS = Object.freeze({
  size: SIZE, cell: CELL, grid: GRID, iconCells: ICON_ROWS * GRID, maxIcons: BG_W.length, iconPx: ICON_PX, slotPx: SLOT_PX,
});

/**
 * Um fundo no atlas. x, y, w, h: o retângulo; ax, ay: a ponta (onde o balão encosta em quem fala); bx, by: o meio do
 * corpo (onde ficam os ícones); ax, ay, bx e by em px dentro do retângulo.
 * @typedef {{ kind: string, n: number, x: number, y: number, w: number, h: number, ax: number, ay: number, bx: number, by: number }} BalloonBg
 */
/** @returns {BalloonBg} */
function bgSpec(kind, n) {
  let x = 0;
  for (let i = 0; i < n - 1; i++) x += BG_W[i];
  const w = BG_W[n - 1];
  const cloud = kind === 'pensamento';
  // a ponta sai da esquerda do corpo; nos balões largos, um pouco mais para dentro
  return { kind, n, x, y: (ICON_ROWS + (cloud ? 1 : 0)) * CELL, w, h: CELL, ax: 44 + (n - 1) * 32, ay: cloud ? 251 : 240, bx: w / 2, by: cloud ? 99 : 98 };
}
/** Os fundos: BALLOON_BG.fala[n - 1] e BALLOON_BG.pensamento[n - 1], para n ícones. */
export const BALLOON_BG = {
  fala: BG_W.map((_, i) => bgSpec('fala', i + 1)),
  pensamento: BG_W.map((_, i) => bgSpec('pensamento', i + 1)),
};

const INK = '#3a2a1e';
const CREAM = '#FFF8E7';
const CREAM_SHADE = '#EFDBB6';
/** Contorno dos ícones, no espaço ±12, e o dos fundos, em px. */
const LW = 1.5;
const BW = 8;
/** Halo claro em volta de cada ícone (px da casa): some dentro do balão (é da cor dele) e destaca o ícone solto. */
const HALO = 10;
const HALO_STEPS = 16;

const hasPath = () => typeof Path2D !== 'undefined';
const f2 = (v) => Math.round(v * 100) / 100;
/** Elipse (círculo, sem ry) como caminho SVG, no sentido horário. */
const ring = (x, y, rx, ry = rx) => `M${f2(x - rx)},${f2(y)}a${rx},${ry} 0 1 1 ${f2(2 * rx)},0a${rx},${ry} 0 1 1 ${f2(-2 * rx)},0Z`;
/** Retângulo de cantos redondos, no sentido horário. */
const rr = (x, y, w, h, r = 0.6) => `M${f2(x + r)},${f2(y)}h${f2(w - 2 * r)}a${r},${r} 0 0 1 ${r},${r}v${f2(h - 2 * r)}a${r},${r} 0 0 1 ${-r},${r}h${f2(2 * r - w)}a${r},${r} 0 0 1 ${-r},${-r}v${f2(2 * r - h)}a${r},${r} 0 0 1 ${r},${-r}Z`;
/** Gota de ponta para cima, com o bojo de raio r centrado em (x, y). */
const drop = (x, y, r) => `M${f2(x)},${f2(y - 2.3 * r)}C${f2(x - 0.45 * r)},${f2(y - 1.4 * r)} ${f2(x - r)},${f2(y - 0.7 * r)} ${f2(x - r)},${f2(y)}a${r},${r} 0 1 0 ${f2(2 * r)},0C${f2(x + r)},${f2(y - 0.7 * r)} ${f2(x + 0.45 * r)},${f2(y - 1.4 * r)} ${f2(x)},${f2(y - 2.3 * r)}Z`;
/** Espiral de dentro para fora (voltas, raio inicial e final). */
function spiral(turns, r0, r1, a0 = 0) {
  const n = Math.ceil(turns * 20);
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    d += `${i ? 'L' : 'M'}${f2(Math.cos(a) * r)},${f2(Math.sin(a) * r)}`;
  }
  return d;
}
/** O osso (deitado, ±11 × ±6,4): as quatro bolas e a haste, para unir. */
const BONE = [ring(-7.4, -2.9, 3.5), ring(-7.4, 2.9, 3.5), ring(7.4, -2.9, 3.5), ring(7.4, 2.9, 3.5), 'M-7.4,-2.8H7.4V2.8H-7.4Z'];

/** Forma cheia com o contorno por cima (centrado no caminho). fill ou stroke nulos pulam essa parte. */
function P(c, d, fill, stroke = INK, w = LW) {
  if (!hasPath()) return;
  const p = new Path2D(d);
  if (fill) {
    c.fillStyle = fill;
    c.fill(p);
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = w;
    c.stroke(p);
  }
}
/** Só o traço. */
function L(c, d, stroke = INK, w = 1.1) {
  P(c, d, null, stroke, w);
}
/**
 * União de formas (e de traços grossos, lines: [caminho, largura]): tudo contornado primeiro, tudo preenchido depois,
 * e o contorno fica só por fora, sem riscos nas emendas.
 */
function U(c, shapes, fill, w = LW, lines = null) {
  if (!hasPath()) return;
  const ps = shapes.map((d) => new Path2D(d));
  const ls = (lines || []).map((l) => ({ p: new Path2D(l[0]), w: l[1] }));
  c.strokeStyle = INK;
  c.lineWidth = w * 2;
  for (const p of ps) c.stroke(p);
  for (const l of ls) {
    c.lineWidth = l.w + w * 2;
    c.stroke(l.p);
  }
  c.fillStyle = fill;
  for (const p of ps) c.fill(p);
  c.strokeStyle = fill;
  for (const l of ls) {
    c.lineWidth = l.w;
    c.stroke(l.p);
  }
}
/** Traço grosso colorido com contorno (o "?", as ondas, o X). */
function T(c, d, color, w, edge = LW) {
  if (!hasPath()) return;
  const p = new Path2D(d);
  c.strokeStyle = INK;
  c.lineWidth = w + edge * 2;
  c.stroke(p);
  c.strokeStyle = color;
  c.lineWidth = w;
  c.stroke(p);
}
/** Desenha recortado dentro de uma forma (sombras e faixas que não podem vazar). */
function inside(c, d, fn) {
  if (!hasPath() || typeof c.clip !== 'function') return;
  c.save();
  try {
    c.clip(new Path2D(d));
    fn();
  } finally {
    c.restore();
  }
}
/** Brilho: um traço branco translúcido. */
function shine(c, d, w = 1.3, a = 0.8) {
  P(c, d, null, `rgba(255,255,255,${a})`, w);
}
/** Traço tracejado (a rota do mapa, as voltas da corda). */
function dashed(c, d, stroke, w, dash) {
  if (typeof c.setLineDash !== 'function') return;
  c.save();
  c.lineCap = 'butt';
  c.setLineDash(dash);
  L(c, d, stroke, w);
  c.restore();
}

/**
 * Os ícones, desenhados no espaço ±12 (o centro da casa é a origem; a casa vai a ±15, e a sobra é do halo).
 * @type {Record<string, (c: CanvasRenderingContext2D) => void>}
 */
const ICON_DRAW = {
  // ------------------------------------------------------------------------------------------ os do roteiro
  cenoura(c) {
    // a estrela: laranja vivo, de ponta para baixo e para a esquerda, com as folhas, os gomos e um brilho
    c.save();
    c.translate(-0.6, 0.9);
    c.rotate(0.6);
    c.scale(0.92, 0.92);
    P(c, 'M-0.9,-5.2 C-5,-5.6 -8,-8.4 -7.6,-12 C-4,-12.2 -1.2,-9.4 -0.9,-5.2Z', '#35A543');
    P(c, 'M0.9,-5.2 C5,-5.6 8,-8.4 7.6,-12 C4,-12.2 1.2,-9.4 0.9,-5.2Z', '#35A543');
    P(c, 'M0,-4.8 C-3,-7.6 -2.6,-12.2 0,-14 C2.6,-12.2 3,-7.6 0,-4.8Z', '#5CCB52');
    const body = 'M-6,-3.4 C-6.2,-7.6 6.2,-7.6 6,-3.4 C5.6,2.6 2.8,8.8 0.9,11.2 C0.4,11.9 -0.4,11.9 -0.9,11.2 C-2.8,8.8 -5.6,2.6 -6,-3.4Z';
    P(c, body, '#FF8A1F', null);
    inside(c, body, () => P(c, 'M2.2,-8 C5,-2 3,6 -0.4,12.4 L9,12 L9,-8Z', '#F06A0A', null));
    L(c, 'M-5.4,-1.2 q2.3,1.2 4.2,0.5 M0.8,1.9 q2.2,0.8 3.9,-0.3 M-3.7,4.9 q1.6,0.9 3,0.3 M-0.2,7.9 q1,0.4 1.9,0', '#B8480A', 1.15);
    shine(c, 'M-3.5,-4.6 C-3.9,-2.4 -3.5,0 -2.9,1.7', 1.6, 0.75);
    P(c, body, null);
    c.restore();
  },
  cone(c) {
    // a forma da cenoura: um cone de ponta para baixo, com a boca em elipse
    const body = 'M-8.8,-6.2 L-1,10.4 C-0.5,11.5 0.5,11.5 1,10.4 L8.8,-6.2Z';
    P(c, body, '#FFB347', null);
    inside(c, body, () => P(c, 'M1.4,-7 H10 V12 H-1Z', '#F2922A', null));
    P(c, body, null);
    P(c, ring(0, -6.2, 8.8, 3.2), '#FFE4AE');
    shine(c, 'M-4.6,-1.6 L-1.8,4.6', 1.4, 0.7);
  },
  osso(c) {
    c.save();
    c.rotate(-0.5);
    U(c, BONE, '#FFF9EC');
    L(c, 'M-5.4,2.2 H5.4 M-8.6,5 q1.4,0.8 2.6,0 M6.2,5 q1.4,0.8 2.6,0', '#E2CDA4', 1.2);
    c.restore();
  },
  coracao(c) {
    const d = 'M0,10.2 C-3.6,7.2 -11.4,2.4 -11.4,-3.8 C-11.4,-8 -8.4,-10.4 -5.4,-10.4 C-2.8,-10.4 -0.9,-8.8 0,-6.8 C0.9,-8.8 2.8,-10.4 5.4,-10.4 C8.4,-10.4 11.4,-8 11.4,-3.8 C11.4,2.4 3.6,7.2 0,10.2Z';
    P(c, d, '#EE3B55', null);
    inside(c, d, () => P(c, 'M12,-6 C10,3 4,8 -2,11 L12,12Z', '#CC2444', null));
    shine(c, 'M-8,-4.2 C-8,-6.4 -6.6,-7.8 -4.8,-7.8', 1.8);
    P(c, d, null);
  },
  q(c) {
    T(c, 'M-4.6,-4.8 C-4.6,-7.6 -2.4,-8.7 0.4,-8.7 C3.2,-8.7 5.2,-7 5.2,-4.6 C5.2,-2.4 3.6,-1.4 2.2,-0.4 C1,0.5 0.4,1.2 0.4,2.8', '#3F8FE8', 3.6);
    P(c, ring(0.4, 8.7, 2.4), '#3F8FE8');
  },
  ex(c) {
    P(c, 'M-3.4,-9.4 C-3.4,-11.8 3.4,-11.8 3.4,-9.4 L1.8,2.2 C1.6,3.8 -1.6,3.8 -1.8,2.2Z', '#EE3B55');
    P(c, ring(0, 8.6, 2.7), '#EE3B55');
    shine(c, 'M-1.3,-8.6 L-0.8,-3', 1.1, 0.6);
  },
  raiva(c) {
    // a veia saltada do bravo (vermelha, grossa): não é nuvem, para não confundir com a tempestade da história
    T(c, 'M-8.8,-3.2 C-5.4,-3.4 -3.4,-5.4 -3.2,-8.8 M8.8,-3.2 C5.4,-3.4 3.4,-5.4 3.2,-8.8 M-8.8,3.2 C-5.4,3.4 -3.4,5.4 -3.2,8.8 M8.8,3.2 C5.4,3.4 3.4,5.4 3.2,8.8', '#EE3B55', 3.2);
  },
  medo(c) {
    // gotas de suor frio, claras, espirrando (a gota de chuva é uma só, de azul forte)
    c.save();
    c.translate(-2.6, 1.4);
    c.rotate(0.3);
    P(c, drop(0, 3, 6.2), '#C4EAFF');
    shine(c, 'M-3.4,3 C-3.4,5.4 -2.2,6.8 -0.6,7.2', 1.5, 0.95);
    c.restore();
    P(c, drop(7.6, -4.4, 2.9), '#C4EAFF', INK, 1.2);
    P(c, drop(8.6, 6.6, 2), '#C4EAFF', INK, 1.1);
  },
  zzz(c) {
    T(c, 'M-10,4.4 h4.2 l-4.2,4.8 h4.2 M-3.6,-2.8 h5.6 l-5.6,6.2 h5.6 M2.6,-9.4 h6.8 l-6.8,7.4 h6.8', '#6C7BE0', 2.1, 1.25);
  },
  lampada(c) {
    L(c, 'M0,-12.2 v2.3 M-8.6,-9 l1.7,1.7 M8.6,-9 l-1.7,1.7 M-11.8,-1.4 h2.4 M11.8,-1.4 h-2.4', '#F29A1F', 1.8);
    P(c, 'M0,-8 C3.9,-8 6.6,-5.2 6.6,-1.6 C6.6,1 5,2.6 4,4 C3.4,4.8 3.2,5.6 3.2,6.4 H-3.2 C-3.2,5.6 -3.4,4.8 -4,4 C-5,2.6 -6.6,1 -6.6,-1.6 C-6.6,-5.2 -3.9,-8 0,-8Z', '#FFD93B');
    L(c, 'M-1.6,3.4 V0.6 C-1.6,-1.5 1.6,-1.5 1.6,0.6 V3.4', '#D97F06', 1.1);
    P(c, 'M-3.2,6.4 H3.2 V9.4 C3.2,10.8 1.8,11.6 0,11.6 C-1.8,11.6 -3.2,10.8 -3.2,9.4Z', '#B9C0CC');
    L(c, 'M-3.2,8.7 H3.2', INK, 1);
    shine(c, 'M-4.1,-2.8 C-3.9,-4.6 -2.9,-5.6 -1.7,-6', 1.4, 0.9);
  },
  lupa(c) {
    T(c, 'M3.9,3.9 L8.5,8.5', '#B5743C', 3.2);
    P(c, ring(-2.4, -2.4, 8.2), '#F5B83D');
    P(c, ring(-2.4, -2.4, 5.7), '#CFEFFF', INK, 1.1);
    shine(c, 'M-5.8,-3.2 A3.6,3.6 0 0 1 -3.2,-5.8', 1.5, 0.95);
  },
  mapa(c) {
    const d = 'M-11,-6.4 L-3.8,-8.8 L3.8,-6.4 L11,-8.8 V6.8 L3.8,9.2 L-3.8,6.8 L-11,9.2Z';
    P(c, d, '#F9E8B4', null);
    inside(c, d, () => {
      P(c, 'M-3.8,-10 H3.8 V10 H-3.8Z', '#ECD592', null);
      P(c, 'M-11,3.4 C-8.6,1.6 -6.4,4.4 -3.8,3 V10 H-11Z', '#8FD46B', null);
    });
    L(c, 'M-3.8,-8.8 V6.8 M3.8,-6.4 V9.2', '#C2A153', 1);
    dashed(c, 'M-8.2,1 C-5.6,-3.6 -1.8,3.4 0.8,0 C2.2,-1.8 3.8,-2.4 5.4,-2.6', '#E0304A', 1.5, [1.7, 1.5]);
    L(c, 'M5.6,-4.9 l3.2,3.2 M8.8,-4.9 l-3.2,3.2', '#E0304A', 1.7);
    P(c, d, null);
  },
  seta(c) {
    const d = 'M-10.6,-3.3 H1.2 V-7.4 C1.2,-8.6 2.4,-9.1 3.3,-8.3 L11,-1 C11.6,-0.4 11.6,0.4 11,1 L3.3,8.3 C2.4,9.1 1.2,8.6 1.2,7.4 V3.3 H-10.6 C-11.2,3.3 -11.6,2.9 -11.6,2.3 V-2.3 C-11.6,-2.9 -11.2,-3.3 -10.6,-3.3Z';
    P(c, d, '#FFC629', null);
    inside(c, d, () => P(c, 'M-12,1 H12 V10 H-12Z', '#F2A517', null));
    shine(c, 'M-9.4,-1.4 H0.4', 1.2, 0.75);
    P(c, d, null);
  },
  migalha(c) {
    const big = 'M-9,1.2 L-5.8,-5.2 L0.8,-6.4 L4.6,-1.6 L2.6,4.6 L-4.4,5.8Z';
    P(c, big, '#E3A655', null);
    inside(c, big, () => P(c, 'M-9,1.2 L-5.8,-5.2 L0.8,-6.4 L4.6,-1.6 L-2.4,-0.4Z', '#F7D494', null));
    P(c, big, null);
    P(c, ring(-3.4, 2.4, 0.55) + ring(0.2, 1.2, 0.55) + ring(-1.4, -3.2, 0.5), '#A9683A', null);
    P(c, 'M6.4,3.6 l2.7,-1.7 l2.3,1.9 l-1,2.9 l-3.1,0.2Z', '#E3A655', INK, 1.3);
    P(c, 'M5.6,-8.6 l2.5,-1 l1.7,1.9 l-1.5,2.1 l-2.5,-0.6Z', '#F7D494', INK, 1.3);
    P(c, ring(-0.6, 9.4, 1.6), '#E3A655', INK, 1.2);
    P(c, ring(-9.2, 8.6, 1.2), '#F7D494', INK, 1.1);
  },
  ovo(c) {
    const d = 'M0,-11.2 C4.6,-11.2 8.4,-3.6 8.4,2.2 C8.4,7.6 4.6,11 0,11 C-4.6,11 -8.4,7.6 -8.4,2.2 C-8.4,-3.6 -4.6,-11.2 0,-11.2Z';
    P(c, d, '#FFFDF6', null);
    inside(c, d, () => P(c, 'M9,-2 C8.4,6 3,10 -4.6,10.4 C2,14 11,10 11,2Z', '#E9D8BA', null));
    P(c, ring(-3.4, -3.4, 0.7) + ring(-1, 3, 0.6) + ring(2.6, -6, 0.55) + ring(-4.8, 4.6, 0.5), '#D8BC8E', null);
    P(c, d, null);
  },
  gota(c) {
    const d = drop(0, 3.2, 7.4);
    P(c, d, '#3F9CF0', null);
    inside(c, d, () => P(c, 'M8,2 C7,8 2,11 -3,10.6 C2,14 10,10 10,2Z', '#1F77D4', null));
    shine(c, 'M-4.1,3.2 C-4.1,5.8 -2.7,7.6 -0.8,8.1', 1.7, 0.9);
    P(c, d, null);
  },
  relogio(c) {
    // o relógio da torre, parado a um minuto da uma
    P(c, ring(0, 0, 10.6), '#F5B83D');
    P(c, ring(0, 0, 7.9), '#FFFDF6', INK, 1.1);
    L(c, 'M0,-6.7 v1.5 M0,6.7 v-1.5 M-6.7,0 h1.5 M6.7,0 h-1.5', INK, 1.1);
    L(c, 'M0,0 L2.1,-3.5', INK, 1.9);
    L(c, 'M0,0 L-0.6,-5.7', INK, 1.4);
    P(c, ring(0, 0, 1.15), '#EE3B55', INK, 0.8);
  },
  sino(c) {
    P(c, ring(0, 8.6, 2.3), '#E08A0A');
    const d = 'M-8.8,5.2 C-6.6,3.2 -6.8,-1 -6.2,-4 C-5.4,-8 -2.8,-9.8 0,-9.8 C2.8,-9.8 5.4,-8 6.2,-4 C6.8,-1 6.6,3.2 8.8,5.2 C9.6,6 9.2,7.2 8.2,7.2 H-8.2 C-9.2,7.2 -9.6,6 -8.8,5.2Z';
    P(c, d, '#FFC629', null);
    inside(c, d, () => P(c, 'M-10,3.6 H10 V8 H-10Z', '#F0A318', null));
    shine(c, 'M-3.8,-3.6 C-3.4,-5.8 -2.4,-7 -1,-7.4', 1.5, 0.85);
    P(c, d, null);
    P(c, ring(0, -10.4, 1.5), '#FFC629', INK, 1.2);
  },
  nota(c) {
    U(c, ['M-3.8,-7.6 L7.8,-10.2 V-6.6 L-3.8,-4Z', 'M-3.8,-7 H-2 V6.6 H-3.8Z', 'M6,-9.6 H7.8 V4.2 H6Z', ring(-5.6, 7.2, 3.3, 2.6), ring(4.2, 4.8, 3.3, 2.6)], '#E8479C', 1.3);
    shine(c, 'M-7.2,6.4 q0.8,-1 2,-1.1 M2.6,4 q0.8,-1 2,-1.1', 1, 0.7);
  },
  espiral(c) {
    T(c, spiral(1.95, 0.8, 9.2, 0.6), '#8A63E0', 2, 1.15);
  },
  focinho(c) {
    // o focinho farejando: trufa grande, as bochechas e os risquinhos do cheiro
    U(c, [ring(-4.3, 3.6, 5.5), ring(4.3, 3.6, 5.5), ring(0, -1.6, 5.6, 5.2)], '#F0C587');
    L(c, 'M0,0.6 V3.4 M0,3.4 C-0.4,5.8 -3.6,6.2 -4.8,4.2 M0,3.4 C0.4,5.8 3.6,6.2 4.8,4.2', INK, 1.25);
    P(c, 'M-4.7,-4.6 C-4.7,-7.4 4.7,-7.4 4.7,-4.6 C4.7,-1.8 1.6,0.6 0,0.6 C-1.6,0.6 -4.7,-1.8 -4.7,-4.6Z', INK, INK, 1);
    P(c, ring(-1.6, -5, 1.5, 0.8), 'rgba(255,255,255,0.85)', null);
    P(c, ring(-6.4, 2.6, 0.5) + ring(-5, 4.8, 0.5) + ring(6.4, 2.6, 0.5) + ring(5, 4.8, 0.5), INK, null);
    L(c, 'M-8.4,-6.4 q-1.9,-2.2 -0.6,-4.8 M-11,-3.6 q-1.6,-1.6 -0.8,-3.6 M8.4,-6.4 q1.9,-2.2 0.6,-4.8 M11,-3.6 q1.6,-1.6 0.8,-3.6', '#FF8A2A', 1.6);
  },
  meia(c) {
    c.save();
    c.rotate(-0.12);
    const d = 'M-5.6,-10.6 H2.4 V-0.8 C2.4,0.4 3,1.3 4,1.9 L8.4,4.5 C11.2,6.2 10.6,10.6 7,10.6 H1.6 C-0.9,10.6 -2.8,9.6 -3.9,7.5 L-5.2,4.9 C-5.5,4.2 -5.6,3.4 -5.6,2.6Z';
    P(c, d, '#FFFFFF', null);
    inside(c, d, () => {
      P(c, 'M-6,-11 H3 V-6.6 H-6Z', '#EE3B55', null);
      P(c, 'M6.4,2 L12,5 V11 H5.6 C7.4,8.6 7.6,4.8 6.4,2Z', '#EE3B55', null);
      P(c, ring(-3.6, 6.4, 3.2), '#EE3B55', null);
      L(c, 'M-6,-4 H3 M-6,-1.6 H3', '#3F9CF0', 1.2);
    });
    P(c, d, null);
    c.restore();
  },
  pena(c) {
    c.save();
    c.rotate(0.62);
    L(c, 'M0,6 V12', INK, 1.5);
    const d = 'M0,-11.6 C4.6,-8.6 5.8,-2.6 4.6,2 L2.6,1.4 L3.8,4.6 C3,6.6 1.8,7.8 0,8.6 C-1.8,7.8 -3,6.6 -3.8,4.6 L-2.4,3.2 L-4.8,1.4 C-5.8,-3.2 -4.6,-8.6 0,-11.6Z';
    P(c, d, '#D9E0EE', null);
    inside(c, d, () => {
      P(c, 'M0,-12 H7 V9 H0Z', '#B4BED3', null);
      P(c, 'M-6,-12 H6 V-7.4 H-6Z', '#FFFFFF', null);
    });
    L(c, 'M0,-8.6 V8.4', INK, 1.1);
    L(c, 'M0,-3.4 L-2.6,-5 M0,0.2 L-3,-1.4 M0,-3.4 L2.6,-5 M0,0.2 L3,-1.4', '#7C879E', 0.9);
    P(c, d, null);
    c.restore();
  },

  // ------------------------------------------------------------------------------------------ os novos
  pombo(c) {
    // de perfil, olhando para a direita: cinza, com o pescoço furta-cor (verde que vira roxo)
    c.save();
    c.translate(-0.4, 0.9);
    T(c, 'M-1.6,6.6 V10 M-3.4,10.2 H0.4 M2.2,6.6 V10 M0.6,10.2 H4.4', '#FF8FA3', 1.2, 0.8);
    P(c, 'M-12,6.4 L-5,0.2 L-2.2,5.2Z', '#6E7A93');
    U(c, ['M-7.8,2.4 C-7.4,-2.2 -2.4,-4.6 2.4,-3.6 C6.6,-2.8 8.6,0.6 7.6,4 C6.6,7 2.4,8.2 -1.6,7.8 C-5.4,7.4 -8,5.6 -7.8,2.4Z', 'M2,-8.4 L9.2,-6.6 L7.8,1 L0.2,-2.6Z', ring(5.6, -7.6, 3.9)], '#A9B4C8');
    /** @type {string | CanvasGradient} */
    let sheen = '#35C29A';
    if (typeof c.createLinearGradient === 'function') {
      const g = c.createLinearGradient(2, -5, 8, 1);
      g.addColorStop(0, '#2FC79B');
      g.addColorStop(0.55, '#5B8FE0');
      g.addColorStop(1, '#A85FE0');
      sheen = g;
    }
    P(c, 'M2.3,-4.9 C4.4,-3.8 6.6,-3.5 8.7,-3.8 L7.8,0.9 C5.4,1 2.8,0.1 0.7,-2.1Z', sheen, null);
    P(c, 'M-6.6,1.6 C-3.4,-1.8 2.2,-1.2 3.8,2.4 C1.2,5.8 -3.6,6.4 -9.8,5.6 C-9,4 -7.8,2.8 -6.6,1.6Z', '#8793AB');
    L(c, 'M-3.4,5.5 L-1.2,1.3 M-0.4,5.1 L1.6,1.7', '#566079', 1.3);
    P(c, 'M9,-8.7 L12.4,-7.2 L9.1,-6Z', '#6B6470', INK, 1.1);
    P(c, ring(9.2, -8.5, 0.9), '#FFFFFF', INK, 0.7);
    P(c, ring(6.1, -8.2, 1.4), '#FF8A1F', INK, 0.8);
    P(c, ring(6.1, -8.2, 0.55), INK, null);
    c.restore();
  },
  cheiro(c) {
    // três ondinhas subindo, da cor da trilha do Faro
    T(c, 'M-7,8.8 C-10.2,5.8 -3.8,3.6 -7,0.6 C-9,-1.3 -7.8,-3.4 -6.4,-4.8 M0,9 C-3.4,5.8 3.4,3.2 0,0 C-3.4,-3.2 3.4,-5.8 0,-9 M7,8.8 C3.8,5.8 10.2,3.6 7,0.6 C5,-1.3 6.2,-4.2 7.6,-6.4', '#FF8A2A', 2.1, 1.2);
  },
  latido(c) {
    // a cabeça de perfil, de boca aberta, e as ondas do som
    c.save();
    c.translate(0.3, 0.2);
    U(c, [ring(-4.8, -1.6, 6.3), 'M-3.2,-6.6 C0,-7 3.4,-6 4.6,-4.2 C5.3,-3.1 4.7,-1.8 3.4,-1.6 L-3.6,-0.4Z', 'M-5,1.2 L1.2,3.4 C2.5,3.9 2.5,5.7 1.2,6.1 C-1.6,7.1 -6,6.7 -7.8,4.6Z'], '#E8C07A');
    P(c, 'M-3.6,-0.4 L3.2,-1.5 L1.3,3.4 L-5,1.2Z', '#8E1F2F', INK, 1);
    P(c, 'M-3.4,1.5 C-1.6,0.5 0.4,1.3 1.1,3 L-3.8,1.8Z', '#FF8FA3', null);
    P(c, ring(4.3, -4.5, 1.5), INK, null);
    P(c, ring(-2.6, -4.4, 1), INK, null);
    P(c, 'M-7.8,-7.6 C-11.8,-7.6 -12.6,0.4 -10.2,2.8 C-8.2,2 -6.6,-2.2 -6.2,-6.4Z', '#B8893F');
    T(c, 'M7,-4.2 C8.5,-1.8 8.5,1.8 7,4.2 M9.9,-6.8 C12.3,-3 12.3,3 9.9,6.8', '#FF6B3D', 1.6, 1);
    c.restore();
  },
  x(c) {
    T(c, 'M-7.4,-7.4 L7.4,7.4 M7.4,-7.4 L-7.4,7.4', '#EE3B55', 4.6);
    shine(c, 'M-7.6,-8.2 L-4.4,-5 M7,-8.4 L5.2,-6.6', 1.1, 0.55);
  },
  ok(c) {
    T(c, 'M-7.8,0.8 L-2.8,6.4 L8,-6.6', '#3DBB4A', 4.6);
    shine(c, 'M-2.2,3.6 L6.6,-7', 1.1, 0.5);
  },
  janela(c) {
    P(c, rr(-9.6, -10.6, 19.2, 18.2, 1.2), '#C98A4B');
    const glass = rr(-7, -8, 14, 13, 0.5);
    P(c, glass, '#A8DCFF', null);
    inside(c, glass, () => P(c, 'M-7,0.6 L1.6,-8 H5 L-7,4Z M2,5 L7,0 V3 L5,5Z', 'rgba(255,255,255,0.7)', null));
    P(c, glass, null, INK, 1.1);
    T(c, 'M0,-7.4 V4.4 M-6.4,-1.5 H6.4', '#C98A4B', 1.3, 0.8);
    P(c, rr(-11.2, 7.4, 22.4, 3.4, 1), '#E8B777');
  },
  porta(c) {
    L(c, 'M-11.4,11 H11.4', INK, 1.5);
    P(c, 'M-8.2,11 V-9.2 C-8.2,-10.4 -7.4,-11.2 -6.2,-11.2 H6.2 C7.4,-11.2 8.2,-10.4 8.2,-9.2 V11Z', '#8A5A2B');
    P(c, 'M-5.8,11 V-8.8 H5.8 V11Z', '#D9964A', INK, 1.1);
    P(c, rr(-3.8, -6.8, 7.6, 6, 0.5), '#B5743C', INK, 0.9);
    P(c, rr(-3.8, 2, 7.6, 6.6, 0.5), '#B5743C', INK, 0.9);
    P(c, ring(4.2, 0.6, 1.15), '#FFD23F', INK, 0.8);
  },
  cesto(c) {
    // o cesto de roupa, com a roupa aparecendo por cima
    P(c, 'M-7,-3.6 C-8,-8.6 -3.2,-11 -0.6,-7.8 C1,-11.4 6.6,-10.8 7,-6.6 C8,-6 7.8,-4.4 7.2,-3.4Z', '#FFFFFF');
    P(c, 'M1.6,-3.4 C1.8,-7.4 5.4,-9 8,-6.4 L7.4,-3.2Z', '#5BA8F0');
    L(c, 'M-4.6,-6.8 q1.4,1.4 0.6,3', '#C9D2E0', 1);
    const body = 'M-9.6,-3.6 H9.6 L7.6,9.4 C7.4,10.5 6.6,11.2 5.4,11.2 H-5.4 C-6.6,11.2 -7.4,10.5 -7.6,9.4Z';
    P(c, body, '#E3B26B', null);
    inside(c, body, () => {
      L(c, 'M-10,1.6 H10 M-10,6 H10', '#B07C3A', 1.1);
      L(c, 'M-5.2,-3 L-4.4,11 M0,-3 V11 M5.2,-3 L4.4,11', '#B07C3A', 1.1);
    });
    P(c, body, null);
    P(c, rr(-11, -5.4, 22, 3.4, 1.5), '#F2CC8E');
  },
  pata(c) {
    const col = '#B0703F';
    P(c, 'M0,-1.6 C3.3,-1.6 7.6,2.6 7.6,6.4 C7.6,9.3 5.3,10.7 3,10.2 C1.8,9.9 1,9.5 0,9.5 C-1,9.5 -1.8,9.9 -3,10.2 C-5.3,10.7 -7.6,9.3 -7.6,6.4 C-7.6,2.6 -3.3,-1.6 0,-1.6Z', col);
    P(c, ring(-8.5, -2.2, 2.4, 3.1), col);
    P(c, ring(-3.3, -7.6, 2.5, 3.3), col);
    P(c, ring(3.3, -7.6, 2.5, 3.3), col);
    P(c, ring(8.5, -2.2, 2.4, 3.1), col);
    shine(c, 'M-4.2,5.2 C-4,3.4 -2.8,2 -1.4,1.4', 1.3, 0.45);
  },
  chuva(c) {
    U(c, [ring(-5.2, -3.6, 4.6), ring(0.4, -5.8, 5.2), ring(5.8, -3.4, 4.2), rr(-10, -3.8, 20, 6.4, 3.2)], '#E6EEF8');
    L(c, 'M-7.2,0.9 H6.4', '#B9C6DA', 1.3);
    P(c, drop(-6, 9.4, 1.7), '#3F9CF0', INK, 1.1);
    P(c, drop(0, 10.2, 1.7), '#3F9CF0', INK, 1.1);
    P(c, drop(6, 9.4, 1.7), '#3F9CF0', INK, 1.1);
  },
  pote(c) {
    // o pote d'água virado: a água escorre para uma poça
    P(c, 'M-5,8.8 C-2,6.6 9.4,6.4 11.6,8.6 C12.4,10.4 8,11.4 3.4,11.4 C-1,11.4 -6,10.6 -5,8.8Z', '#5BB8F5');
    P(c, 'M2.6,-3.4 C6.4,-2.6 8.6,1.6 8.8,8 L4.4,8.4 C4.6,4.4 3.2,1.6 0.8,0.4Z', '#5BB8F5');
    c.save();
    c.translate(-2.8, -0.6);
    c.rotate(1.22);
    const body = 'M-8.6,5.2 L-6.2,-4.2 C-6,-5.1 -5.3,-5.6 -4.4,-5.6 H4.4 C5.3,-5.6 6,-5.1 6.2,-4.2 L8.6,5.2 C8.8,6.2 8.2,6.8 7.2,6.8 H-7.2 C-8.2,6.8 -8.8,6.2 -8.6,5.2Z';
    P(c, body, '#E8483F', null);
    inside(c, body, () => P(c, 'M-10,2.4 H10 V8 H-10Z', '#C2302F', null));
    P(c, body, null);
    P(c, ring(0, -5.4, 5.3, 1.7), '#8E1F22');
    c.restore();
  },
  botao(c) {
    P(c, 'M-10.6,4 C-10.6,0.8 10.6,0.8 10.6,4 V7 C10.6,10 5.8,11.4 0,11.4 C-5.8,11.4 -10.6,10 -10.6,7Z', '#8E97A8');
    P(c, ring(0, 4, 10.6, 3.6), '#C9D0DB');
    const dome = 'M-7.2,2.8 V-2.6 C-7.2,-7.2 -4,-10.2 0,-10.2 C4,-10.2 7.2,-7.2 7.2,-2.6 V2.8 C7.2,4.8 4,5.9 0,5.9 C-4,5.9 -7.2,4.8 -7.2,2.8Z';
    P(c, dome, '#EE3B55', null);
    inside(c, dome, () => P(c, 'M-8,0.6 C-4,2.6 4,2.6 8,0.6 V7 H-8Z', '#C4203C', null));
    shine(c, 'M-4.4,-3.4 C-4.2,-5.8 -2.8,-7.4 -0.8,-7.8', 1.7, 0.85);
    P(c, dome, null);
  },
  lixeira(c) {
    // a lixeira de rodinhas
    const body = 'M-7.4,-5.4 H7.4 L6,9.2 C5.9,10.2 5.2,10.8 4.2,10.8 H-4.2 C-5.2,10.8 -5.9,10.2 -6,9.2Z';
    P(c, body, '#3DAA5C', null);
    inside(c, body, () => P(c, 'M2.6,-6 H8 V11 H1.6Z', '#2A8B48', null));
    L(c, 'M-3,-2.4 L-2.5,8 M0,-2.4 V8 M3,-2.4 L2.5,8', '#1F6E38', 1.1);
    P(c, body, null);
    P(c, 'M-9.4,-8.4 C-9.4,-9.6 -8.6,-10.2 -7.6,-10.2 H7.6 C8.6,-10.2 9.4,-9.6 9.4,-8.4 V-5.4 H-9.4Z', '#56C878');
    P(c, rr(-2.4, -11.8, 4.8, 1.8, 0.6), '#56C878', INK, 1.1);
    P(c, ring(-6.4, 9, 2.7), '#4A4038');
    P(c, ring(-6.4, 9, 0.9), '#C9D0DB', null);
  },
  barco(c) {
    // o barquinho de pedal em forma de pato, na água
    P(c, rr(-6, -4.4, 4.6, 6.4, 1), '#EE3B55');
    const hull = 'M-10.6,-1 C-8.6,-0.8 -7.4,0.8 -5.8,1.2 H6.6 C8.6,1.2 9.8,2.8 9.2,4.8 C8.4,7.6 5.4,9.2 2,9.2 H-4 C-8,9.2 -10.8,6 -11,2.2 C-11,1 -11,0 -10.6,-1Z';
    U(c, [hull, 'M2.4,-3.6 L8.6,-2.6 V2.4 H2Z', ring(5.6, -5.8, 4.1)], '#FFD23F');
    inside(c, hull, () => P(c, 'M-12,3.6 H12 V5.4 H-12Z', '#FFFFFF', null));
    P(c, 'M9.2,-6.8 L12.4,-5.4 L9.4,-3.8Z', '#FF8A1F');
    P(c, ring(6.6, -6.8, 0.95), INK, null);
    P(c, 'M-12.4,7.6 C-10.4,5.8 -8.4,5.8 -6.2,7.6 C-4.2,9.4 -2,9.4 0,7.6 C2,5.8 4.2,5.8 6.2,7.6 C8.4,9.4 10.4,9.4 12.4,7.6 V11.6 H-12.4Z', '#5BB8F5');
  },
  corda(c) {
    // a corda enrolada, com as voltas torcidas e a ponta solta
    const rope = (d) => {
      T(c, d, '#E6B56A', 2.5, 1.2);
      dashed(c, d, '#A8733A', 2.5, [0.7, 1.9]);
    };
    rope(ring(0, -4, 7, 3.8));
    rope('M6.2,1.6 C10.2,3.4 10.4,7.6 7,9 C4.8,9.9 2.4,9.4 1.4,7.8');
    rope(ring(0, 0.4, 7, 3.8));
  },
  bola(c) {
    const d = ring(0, 0, 10.4);
    P(c, d, '#D8EA3E', null);
    inside(c, d, () => {
      P(c, 'M11,-2 C9,6 3,10.6 -4,10.8 C2,14 12,11 12,2Z', '#B5CC22', null);
      L(c, 'M-10.6,-3.4 C-4.6,-3 -2,3.4 -4.4,10.6 M10.6,3.4 C4.6,3 2,-3.4 4.4,-10.6', '#FFFFFF', 1.7);
    });
    shine(c, 'M-6.8,-4.2 C-6.2,-5.8 -5,-7 -3.6,-7.6', 1.5, 0.85);
    P(c, d, null);
  },
  ganso(c) {
    // branco, de pescoço comprido e bico laranja, olhando para a direita
    c.save();
    c.translate(-0.4, 0.9);
    c.scale(0.96, 0.96);
    T(c, 'M-2.4,7.4 V10.2 M-4,10.4 H-0.4 M1.8,7.4 V10.2 M0.2,10.4 H3.8', '#FF8A1F', 1.2, 0.8);
    U(c, ['M-11,1 C-9.2,0.8 -7.2,2.2 -4.2,0.4 C-1,-1.6 4.2,-1 6.2,2.2 C8.2,5.6 5,8.4 0,8.4 C-5.2,8.4 -9.2,6.4 -11,1Z', ring(5.4, -8.8, 2.9)], '#FFFFFF', LW, [['M4.4,2 C7.4,-1.4 3.6,-4.4 5.2,-8', 3.4]]);
    P(c, 'M-5.6,2.8 C-2.4,0.8 2,1.6 3,4.2 C0.6,6.4 -3.2,6.6 -6.8,5.4Z', '#DDE4EE', INK, 1.1);
    P(c, 'M7.8,-10 L12.2,-8.6 L8,-7.2Z', '#FF8A1F');
    P(c, ring(6.2, -9.5, 0.75), INK, null);
    c.restore();
  },
  grade(c) {
    // a grade de proteção: as travessas, os balaústres e os dois montantes
    for (const x of [-4.6, 0, 4.6]) P(c, rr(x - 1.2, -7.6, 2.4, 15.6, 0.5), '#F6DDAE', INK, 1.1);
    P(c, rr(-10.4, -9.2, 20.8, 3, 1), '#D9964A');
    P(c, rr(-10.4, 5.6, 20.8, 3, 1), '#D9964A');
    P(c, rr(-11.6, -11, 3, 21.6, 1), '#B5743C');
    P(c, rr(8.6, -11, 3, 21.6, 1), '#B5743C');
    L(c, 'M-12.2,11.2 H-7.6 M7.6,11.2 H12.2', INK, 1.6);
  },
  saco(c) {
    // o saco de ração, com o osso no rótulo
    const body = 'M-7.4,-7.4 C-8.6,-2 -9.2,6 -8.2,10 C-8,10.9 -7.4,11.3 -6.6,11.3 H6.6 C7.4,11.3 8,10.9 8.2,10 C9.2,6 8.6,-2 7.4,-7.4Z';
    P(c, body, '#F0642F', null);
    inside(c, body, () => {
      P(c, 'M3,-8 H10 V12 H2Z', '#D24A1C', null);
      P(c, 'M-10,7.6 H10 V12 H-10Z', '#FFC629', null);
    });
    P(c, body, null);
    P(c, 'M-7.8,-7.2 V-10.4 L-5.6,-9.2 L-3.4,-10.8 L-1.2,-9.2 L1,-10.8 L3.2,-9.2 L5.4,-10.8 L7.8,-9.6 V-7.2Z', '#F98A56');
    P(c, ring(0, 1, 4.9), '#FFF8E7', INK, 1.1);
    c.save();
    c.translate(0, 1);
    c.rotate(-0.5);
    c.scale(0.36, 0.36);
    U(c, BONE, '#B0703F', 1.2);
    c.restore();
  },
  empurrar(c) {
    // duas setas empurrando uma caixa
    L(c, 'M-12,10.6 H12', INK, 1.4);
    const box = rr(1.4, -6.4, 10.2, 16.4, 1);
    P(c, box, '#E3B26B', null);
    inside(c, box, () => L(c, 'M1,-1 H12 M1,4.6 H12', '#B07C3A', 1.1));
    P(c, box, null);
    for (const y of [-3.4, 4.6]) P(c, `M-11.2,${y - 1.5} H-5.4 V${y - 3.7} L-0.4,${y} L-5.4,${y + 3.7} V${y + 1.5} H-11.2Z`, '#3F9CF0', INK, 1.3);
  },
  olho(c) {
    const d = 'M-11.4,0.4 C-7.4,-7.4 7.4,-7.4 11.4,0.4 C7.4,8 -7.4,8 -11.4,0.4Z';
    P(c, d, '#FFFFFF', null);
    inside(c, d, () => {
      P(c, ring(0, 0.2, 5.3), '#3F9CF0', INK, 1.1);
      P(c, ring(0, 0.2, 2.6), INK, null);
      P(c, ring(-1.8, -1.8, 1.25), '#FFFFFF', null);
    });
    P(c, d, null);
    L(c, 'M-11.4,0.4 C-7.4,-7.4 7.4,-7.4 11.4,0.4', INK, 2.3);
    L(c, 'M-6.4,-5.6 L-7.8,-8.6 M0,-6.6 V-10 M6.4,-5.6 L7.8,-8.6', INK, 1.6);
  },
  casa(c) {
    P(c, rr(4.6, -10.2, 3.2, 6.4, 0.4), '#B5743C');
    P(c, 'M-8,-1 H8 V10.2 C8,10.8 7.6,11.2 7,11.2 H-7 C-7.6,11.2 -8,10.8 -8,10.2Z', '#FFE9B8');
    P(c, 'M-0.9,-10.8 C-0.4,-11.3 0.4,-11.3 0.9,-10.8 L11.6,-1 C12.3,-0.3 11.9,0.8 10.9,0.8 H-10.9 C-11.9,0.8 -12.3,-0.3 -11.6,-1Z', '#E8483F');
    P(c, 'M-5.6,11.2 V5.4 C-5.6,3.2 -1.6,3.2 -1.6,5.4 V11.2Z', '#B5743C', INK, 1.1);
    P(c, rr(1.8, 3.6, 4.4, 4.2, 0.4), '#A8DCFF', INK, 1.1);
    L(c, 'M4,3.6 V7.8 M1.8,5.7 H6.2', INK, 0.9);
  },
  torre(c) {
    // a torre do relógio
    const body = 'M-4.8,-3.8 H4.8 L5.8,10 H-5.8Z';
    P(c, body, '#EAD9B5', null);
    inside(c, body, () => P(c, 'M2.2,-4 H6 V10 H2.6Z', '#D3BE92', null));
    P(c, body, null);
    P(c, rr(-7.2, 9.4, 14.4, 2.2, 0.6), '#C9B58A');
    P(c, rr(-6.4, -5.8, 12.8, 2.4, 0.6), '#C9B58A');
    P(c, 'M-0.7,-11.3 C-0.3,-11.8 0.3,-11.8 0.7,-11.3 L5.6,-5.8 H-5.6Z', '#2FA8A0');
    P(c, ring(0, 0.2, 3.5), '#FFFDF6', INK, 1.1);
    L(c, 'M0,0.2 V-2 M0,0.2 L1.6,0.8', INK, 1);
    P(c, 'M-1.7,9.4 V7 C-1.7,5.4 1.7,5.4 1.7,7 V9.4Z', '#8A5A2B', INK, 1);
  },
};

/** Desenha um ícone numa casa com o canto em (x, y). */
function drawIconCell(ctx, name, x, y) {
  ctx.save();
  try {
    ctx.translate(x + CELL / 2, y + CELL / 2);
    ctx.scale(CELL / 30, CELL / 30); // o ±12 do ícone ocupa 80% da casa
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    (ICON_DRAW[name] || ICON_DRAW.q)(ctx);
  } finally {
    ctx.restore();
  }
}

/** Volume de um fundo: sombra clara por dentro (embaixo, à direita) e um brilho (em cima, à esquerda). */
function shadeBody(ctx, path) {
  if (typeof ctx.clip !== 'function') return;
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = CREAM_SHADE;
  ctx.fill(path);
  ctx.translate(-3, -9);
  ctx.clip(path);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(path);
  ctx.translate(7, 16);
  ctx.fillStyle = CREAM;
  ctx.fill(path);
  ctx.restore();
}

/** O corpo e a pontinha do balão de fala (px dentro do retângulo do fundo). */
function speechPaths(s) {
  const x0 = 26;
  const x1 = s.w - 26;
  const y0 = 16;
  const y1 = 180;
  const cx = (x0 + x1) / 2;
  const r = (y1 - y0) / 2;
  const k = 0.5523;
  // cantos desiguais e as bordas de cima e de baixo um pouco abauladas: desenhado à mão, não um círculo
  const rTL = r * 0.96;
  const rTR = r * 0.86;
  const rBR = r * 0.96;
  const rBL = r * 0.84;
  const body = `M${f2(x0 + rTL)},${y0}`
    + `Q${f2(cx + 10)},${y0 - 7} ${f2(x1 - rTR)},${y0 + 1}`
    + `C${f2(x1 - rTR + k * rTR)},${y0 + 1} ${x1},${f2(y0 + 1 + rTR - k * rTR)} ${x1},${f2(y0 + 1 + rTR)}`
    + `L${x1},${f2(y1 - rBR)}`
    + `C${x1},${f2(y1 - rBR + k * rBR)} ${f2(x1 - rBR + k * rBR)},${y1} ${f2(x1 - rBR)},${y1}`
    + `Q${f2(cx - 8)},${y1 + 6} ${f2(x0 + rBL)},${y1 - 1}`
    + `C${f2(x0 + rBL - k * rBL)},${y1 - 1} ${x0},${f2(y1 - 1 - rBL + k * rBL)} ${x0},${f2(y1 - 1 - rBL)}`
    + `L${x0},${f2(y0 + rTL)}`
    + `C${x0},${f2(y0 + rTL - k * rTL)} ${f2(x0 + rTL - k * rTL)},${y0} ${f2(x0 + rTL)},${y0}Z`;
  // a pontinha: uma garra curva que sai de baixo e aponta para quem fala (a ponta é a âncora do balão)
  const tx = s.ax;
  const ty = s.ay - 5;
  const tail = `M${tx + 22},${y1 - 28}Q${tx + 16},${y1 + 22} ${tx},${ty}Q${tx + 50},${y1 + 34} ${tx + 80},${y1 - 14}Z`;
  return { body, tail, x0, y0, rTL };
}

/** Fundo de fala: forma orgânica creme, contorno grosso, sombra projetada embaixo e brilho em cima. */
function paintSpeech(ctx, s) {
  if (!hasPath()) return;
  const g = speechPaths(s);
  const body = new Path2D(g.body);
  const tail = new Path2D(g.tail);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // o contorno num traço só (corpo e ponta), para a sombra projetada não dobrar na emenda
  ctx.save();
  ctx.shadowColor = 'rgba(46,28,12,0.36)';
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 7;
  ctx.strokeStyle = INK;
  ctx.lineWidth = BW * 2;
  ctx.stroke(new Path2D(g.body + g.tail));
  ctx.restore();
  ctx.fillStyle = CREAM;
  ctx.fill(body);
  ctx.fill(tail);
  shadeBody(ctx, body);
  // o brilho de gibi no canto de cima
  const ri = g.rTL - 19;
  const ccx = g.x0 + g.rTL;
  const ccy = g.y0 + g.rTL;
  const pt = (deg) => `${f2(ccx + Math.cos((deg * Math.PI) / 180) * ri)},${f2(ccy + Math.sin((deg * Math.PI) / 180) * ri)}`;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 7;
  ctx.stroke(new Path2D(`M${pt(196)}A${ri},${ri} 0 0 1 ${pt(238)}`));
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(new Path2D(ring(f2(ccx + Math.cos((252 * Math.PI) / 180) * ri), f2(ccy + Math.sin((252 * Math.PI) / 180) * ri), 3.6)));
  ctx.restore();
}

/** Os gomos da nuvem de pensamento (círculos ao longo de uma pílula) e o miolo, todos no sentido horário. */
function cloudShapes(s) {
  const cx = s.w / 2;
  const cy = s.by;
  const rB = 31;
  const B = 49;
  const A = s.w / 2 - 24 - rB;
  const straight = Math.max(0, A - B);
  const arc = Math.PI * B;
  const per = 4 * straight + 2 * arc;
  const count = Math.max(6, Math.round(per / 52));
  const jitter = [4, -3, 2, -4, 5, -2, 3, -5, 1];
  const shapes = [];
  for (let i = 0; i < count; i++) {
    let d = ((i + 0.5) / count) * per;
    let x;
    let y;
    if (d < straight) {
      x = cx + d;
      y = cy - B;
    } else if ((d -= straight) < arc) {
      x = cx + straight + Math.cos(-Math.PI / 2 + d / B) * B;
      y = cy + Math.sin(-Math.PI / 2 + d / B) * B;
    } else if ((d -= arc) < 2 * straight) {
      x = cx + straight - d;
      y = cy + B;
    } else if ((d -= 2 * straight) < arc) {
      x = cx - straight + Math.cos(Math.PI / 2 + d / B) * B;
      y = cy + Math.sin(Math.PI / 2 + d / B) * B;
    } else {
      x = cx - straight + (d - arc);
      y = cy - B;
    }
    shapes.push(ring(f2(x), f2(y), rB + jitter[i % jitter.length]));
  }
  shapes.push(rr(f2(cx - A), cy - B, f2(2 * A), 2 * B, B));
  return shapes;
}

/** Fundo de pensamento: nuvem de gomos e três bolinhas que diminuem até quem pensa. */
function paintThought(ctx, s) {
  if (!hasPath()) return;
  const shapes = cloudShapes(s);
  const all = new Path2D(shapes.join(''));
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // as três bolinhas, da nuvem até a âncora (cada uma com o contorno proporcional)
  const dots = [[s.ax + 46, 209.5, 9, 5.5], [s.ax + 22, 226.5, 6.5, 5], [s.ax + 5, 241.5, 4, 4.5]];
  ctx.save();
  ctx.shadowColor = 'rgba(46,28,12,0.36)';
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 7;
  ctx.strokeStyle = INK;
  ctx.lineWidth = BW * 2;
  ctx.stroke(all);
  for (const d of dots) {
    ctx.lineWidth = d[3] * 2;
    ctx.stroke(new Path2D(ring(d[0], d[1], d[2])));
  }
  ctx.restore();
  ctx.fillStyle = CREAM;
  for (const d of shapes) ctx.fill(new Path2D(d));
  shadeBody(ctx, all);
  for (const d of dots) {
    const p = new Path2D(ring(d[0], d[1], d[2]));
    ctx.fillStyle = CREAM;
    ctx.fill(p);
    shadeBody(ctx, p);
  }
  ctx.restore();
}

/**
 * Desenha o atlas inteiro num canvas (os ícones, cada um com o seu halo, e os fundos). Num ambiente sem canvas de
 * verdade (testes no Node) as chamadas são vazias e o atlas fica em branco, sem erro.
 * @param {HTMLCanvasElement} canvas
 * @returns {HTMLCanvasElement}
 */
export function paintBalloonAtlas(canvas) {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, SIZE, SIZE);
  // dois rascunhos do tamanho de uma casa: o ícone e a silhueta dele na cor do halo
  /** @type {HTMLCanvasElement | null} */
  let tmp = null;
  /** @type {HTMLCanvasElement | null} */
  let sil = null;
  /** @type {CanvasRenderingContext2D | null} */
  let tctx = null;
  /** @type {CanvasRenderingContext2D | null} */
  let sctx = null;
  try {
    tmp = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
    sil = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
    tmp.width = tmp.height = sil.width = sil.height = CELL;
    tctx = tmp.getContext('2d');
    sctx = sil.getContext('2d');
  } catch {
    tctx = sctx = null;
  }
  BALLOON_ICONS.forEach((name, i) => {
    const x = (i % GRID) * CELL;
    const y = Math.floor(i / GRID) * CELL;
    try {
      if (tmp && sil && tctx && sctx && typeof ctx.drawImage === 'function') {
        tctx.clearRect(0, 0, CELL, CELL);
        drawIconCell(tctx, name, 0, 0);
        sctx.globalCompositeOperation = 'source-over';
        sctx.clearRect(0, 0, CELL, CELL);
        sctx.drawImage(tmp, 0, 0);
        sctx.globalCompositeOperation = 'source-in';
        sctx.fillStyle = CREAM;
        sctx.fillRect(0, 0, CELL, CELL);
        for (let k = 0; k < HALO_STEPS; k++) {
          const a = (k / HALO_STEPS) * Math.PI * 2;
          ctx.drawImage(sil, x + Math.cos(a) * HALO, y + Math.sin(a) * HALO);
        }
        ctx.drawImage(sil, x, y);
        ctx.drawImage(tmp, x, y);
      } else {
        drawIconCell(ctx, name, x, y);
      }
    } catch {
      // um ícone que falha não derruba o atlas
    }
  });
  for (const s of [...BALLOON_BG.fala, ...BALLOON_BG.pensamento]) {
    try {
      if (s.kind === 'pensamento') paintThought(ctx, s);
      else paintSpeech(ctx, s);
    } catch {
      // idem para um fundo
    }
  }
  return canvas;
}

// =====================================================================================================================
// FIM DA ARTE
// =====================================================================================================================

/** A casa de um ícone; um nome desconhecido vira o "?" (nunca lança erro). */
const iconCell = (name) => {
  const i = BALLOON_ICONS.indexOf(name);
  return i >= 0 ? i : BALLOON_ICONS.indexOf('q');
};

/** Entrada (o "pop"), saída e seguimento. */
const POP = 0.22;
const OUT = 0.18;
const FOLLOW_RATE = 18; // 1/s: o balão alcança a cabeça em ~0,06 s (filtra o tremor do passo)
const FOLLOW_SNAP = 1.5; // m: além disso é corte de cena ou teleporte, e o balão pula junto
/**
 * Faixa da altura do balão na tela (fração da altura da tela, medida no quadro inteiro do fundo, com a ponta; a parte
 * visível é ~88% disso: de ~9% a ~20%). `small`: numa tela baixa (celular deitado, ~390 px) a faixa sobe, para o ícone
 * não passar de pequeno demais em pixels. Os soltos (só o ícone) podem ficar menores.
 */
const BAND = { lo: 0.105, hi: 0.23, loSmall: 0.175, hiSmall: 0.27 };
const BAND_SOLO = { lo: 0.065, hi: 0.17, loSmall: 0.105, hiSmall: 0.2 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** De 0 a 1,12 e assenta em 1, em POP segundos. */
function popScale(t) {
  if (t <= 0) return 0;
  if (t >= POP) return 1;
  const u = t / POP - 1;
  return 1 + 2.9 * u * u * u + 1.9 * u * u;
}
/** 0 numa tela alta (PC), 1 numa tela baixa (celular deitado). Sem janela (testes), 0. */
function smallScreen() {
  const h = typeof innerHeight === 'number' ? innerHeight : 0;
  return h > 0 ? clamp((560 - h) / 170, 0, 1) : 0;
}
/** Fração da altura da tela que um metro ocupa a essa profundidade (0: atrás da câmera ou câmera desconhecida). */
function screenPerMeter(cam, depth) {
  const pc = /** @type {THREE.PerspectiveCamera} */ (cam);
  if (pc.isPerspectiveCamera) {
    if (!(depth > 1e-3)) return 0;
    const span = 2 * depth * Math.tan(THREE.MathUtils.degToRad(pc.fov) / 2);
    return span > 0 ? (pc.zoom || 1) / span : 0;
  }
  const oc = /** @type {THREE.OrthographicCamera} */ (cam);
  if (oc.isOrthographicCamera) {
    const span = (oc.top - oc.bottom) / (oc.zoom || 1);
    return span > 0 ? 1 / span : 0;
  }
  return 0;
}

/** Textura do atlas com a mesma imagem na GPU; cada sprite recorta a sua casa só com offset e repeat (sem reenvio). */
function buildAtlas() {
  const canvas = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
  try {
    paintBalloonAtlas(canvas);
  } catch {
    // sem canvas 2D de verdade: o atlas fica em branco
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * @param {{ root: THREE.Object3D, camera?: THREE.Camera | null, poolSize?: number }} opts
 *   camera: opcional, para o tamanho certo na tela (também pode ir a cada quadro, no update).
 */
export function createBalloons({ root, camera = null, poolSize = 8 }) {
  const atlas = buildAtlas();
  const group = new THREE.Group();
  group.name = 'cena:baloes';
  root.add(group);
  /** @type {THREE.Texture[]} */
  const maps = [];
  const mk = (order) => {
    const map = atlas.clone();
    maps.push(map);
    const m = new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    const s = new THREE.Sprite(m);
    s.renderOrder = order;
    s.visible = false;
    s.frustumCulled = false;
    group.add(s);
    return s;
  };
  const maxIcons = BALLOON_ATLAS.maxIcons;
  const pool = Array.from({ length: poolSize }, (_, i) => ({
    id: 0,
    bg: mk(60 + i * 4),
    icons: Array.from({ length: maxIcons }, (_u, j) => mk(61 + i * 4 + j)),
    /** @type {string[]} */
    names: [],
    n: 1,
    /** @type {BalloonBg} */
    spec: BALLOON_BG.fala[0],
    t: 0,
    life: 0,
    size: 0.42,
    kind: 'fala',
    /** @type {string | null} */
    who: null,
    flip: false,
    /** @type {(() => { x: number, y: number, z: number }) | null} */
    follow: null,
    target: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    fresh: true,
    phase: i * 1.7,
    // do quadro: o tamanho em metros, a fração da tela por metro, o lugar na tela e o desvio para não cobrir outro
    now: 0.42,
    perM: 0,
    sx: 0,
    sy: 0,
    cx: 0,
    cy: 0,
    hw: 0,
    hh: 0,
    lift: 0,
  }));
  let nextId = 1;
  let rr2 = 0;
  /** @type {typeof pool} */
  const live = [];
  const camPos = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const tmpV = new THREE.Vector3();

  const setIcon = (/** @type {THREE.Texture} */ tex, index) => {
    tex.repeat.set(1 / GRID, 1 / GRID);
    tex.offset.set((index % GRID) / GRID, 1 - (Math.floor(index / GRID) + 1) / GRID);
  };
  /** O fundo no atlas; virado, a mesma casa espelhada (a ponta para o outro lado). */
  const setBg = (/** @type {THREE.Texture} */ tex, /** @type {BalloonBg} */ g, flip) => {
    tex.repeat.set((flip ? -g.w : g.w) / SIZE, g.h / SIZE);
    tex.offset.set((flip ? g.x + g.w : g.x) / SIZE, 1 - (g.y + g.h) / SIZE);
  };
  const release = (s) => {
    s.id = 0;
    s.follow = null;
    s.bg.visible = false;
    for (const ic of s.icons) ic.visible = false;
  };

  /**
   * Mostra um balão. icon: um ícone ou uma "frase" de até três, lado a lado (['cenoura', 'q'] = cadê a cenoura?); um
   * nome desconhecido vira o "?". kind: 'fala' | 'pensamento' | 'solto' (os ícones sem balão). follow(): posição no
   * mundo a cada quadro (a cabeça da dog); at: posição fixa. life: segundos (Infinity até hide). size: altura do
   * balão em metros (com a câmera, ajustada para a faixa certa na tela). flip: a ponta para o outro lado.
   * → id para esconder antes (0 se não havia o que mostrar).
   * @param {string | string[]} icon
   * @param {{ kind?: 'fala' | 'pensamento' | 'solto', who?: string | null,
   *   follow?: (() => { x: number, y: number, z: number }) | null, at?: { x: number, y: number, z: number } | null,
   *   life?: number, size?: number, flip?: boolean }} [o]
   * @returns {number}
   */
  function show(icon, { kind = 'fala', who = null, follow = null, at = null, life = 2, size = 0.42, flip = false } = {}) {
    const names = (Array.isArray(icon) ? icon : [icon]).filter((n) => n != null && n !== '').slice(0, maxIcons).map(String);
    if (!names.length) return 0;
    let slot = pool.find((p) => !p.id);
    if (!slot) {
      slot = pool[rr2];
      rr2 = (rr2 + 1) % pool.length;
    }
    slot.id = nextId++;
    slot.t = 0;
    slot.life = life > 0 ? life : 0;
    slot.size = size > 0 ? size : 0.42;
    slot.kind = kind === 'pensamento' || kind === 'solto' ? kind : 'fala';
    slot.who = who;
    slot.flip = !!flip;
    slot.follow = typeof follow === 'function' ? follow : null;
    slot.names = names;
    slot.n = names.length;
    slot.spec = (slot.kind === 'pensamento' ? BALLOON_BG.pensamento : BALLOON_BG.fala)[slot.n - 1];
    const p = at || (slot.follow ? slot.follow() : null);
    if (p) slot.target.set(p.x, p.y, p.z);
    slot.pos.copy(slot.target);
    slot.fresh = true;
    slot.lift = 0;
    slot.now = slot.size;
    names.forEach((name, i) => setIcon(slot.icons[i].material.map, iconCell(name)));
    if (slot.kind !== 'solto') setBg(slot.bg.material.map, slot.spec, slot.flip);
    // some até o primeiro update (que põe no lugar e no tamanho)
    slot.bg.visible = false;
    for (const ic of slot.icons) ic.visible = false;
    return slot.id;
  }

  /** O alto da parte visível da tela (fração da altura a partir do meio), dado a cada update. */
  let safeTop = 0.45;

  function hide(id) {
    const s = pool.find((p) => p.id === id);
    if (s) s.life = Math.min(s.life, s.t + OUT);
  }

  /**
   * Os balões (não os soltos) que cairiam um em cima do outro na tela: o mais novo sobe até livrar o mais velho. E
   * nenhum balão passa do alto da parte visível da tela (`safeTop`, em fração da altura a partir do meio: as faixas de
   * cinema das cenas cobrem o alto): ele desce até caber.
   */
  function settle(dt) {
    live.sort((a, b) => a.id - b.id);
    for (let i = 0; i < live.length; i++) {
      const s = live[i];
      let want = 0;
      s.hw = 0;
      if (s.kind === 'solto' && s.perM > 0) {
        const over = s.sy + (s.now * s.perM) / 2 - safeTop;
        if (over > 0) want = -over / s.perM;
      }
      if (s.kind !== 'solto' && s.perM > 0) {
        const g = s.spec;
        const u = (s.now * s.perM) / CELL; // px do fundo → fração da altura da tela
        s.hw = (g.w / 2 - 22) * u;
        s.hh = 86 * u;
        s.cx = s.sx + (s.flip ? -1 : 1) * (g.bx - g.ax) * u;
        const cy0 = s.sy + (g.ay - g.by) * u;
        for (let pass = 0; pass < 3; pass++) {
          let moved = false;
          for (let j = 0; j < i; j++) {
            const o = live[j];
            if (!(o.hw > 0)) continue;
            if (Math.abs(s.cx - o.cx) < (s.hw + o.hw) * 0.7 && Math.abs(cy0 + want - o.cy) < (s.hh + o.hh) * 0.88) {
              want = o.cy + (s.hh + o.hh) * 0.94 - cy0;
              moved = true;
            }
          }
          if (!moved) break;
        }
        // o alto do balão dentro da parte visível
        const over = cy0 + want + s.hh - safeTop;
        if (over > 0) want -= over;
        s.cy = cy0 + want;
        want /= s.perM; // de volta a metros
      }
      s.lift = s.fresh ? want : s.lift + (want - s.lift) * (1 - Math.exp(-dt * 9));
    }
  }

  /**
   * Avança os balões. cam: a câmera do quadro (opcional; vale a do createBalloons/setCamera se faltar). Com ela, o
   * balão fica na faixa certa da tela e os balões vizinhos não se cobrem; sem ela, o size vale em metros.
   * @param {number} dt
   * @param {THREE.Camera | null} [cam]
   * @param {number} [top] o alto da parte visível da tela (fração da altura a partir do meio; 0,5 = a borda)
   */
  function update(dt, cam = camera, top = 0.45) {
    const step = dt > 0 ? dt : 0;
    safeTop = top;
    const useCam = !!cam && cam.isCamera === true && typeof cam.updateWorldMatrix === 'function';
    live.length = 0;
    for (const s of pool) {
      if (!s.id) continue;
      s.t += step;
      if (s.t >= s.life) {
        release(s);
        continue;
      }
      live.push(s);
    }
    if (!live.length) return;
    if (useCam) {
      cam.updateWorldMatrix(true, false);
      group.updateWorldMatrix(true, false);
      camPos.setFromMatrixPosition(cam.matrixWorld);
      camRight.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
      camUp.setFromMatrixColumn(cam.matrixWorld, 1).normalize();
      camDir.setFromMatrixColumn(cam.matrixWorld, 2).normalize().negate();
    }
    const small = useCam ? smallScreen() : 0;
    for (const s of live) {
      // acompanha a cabeça com um atraso mínimo, sem tremer
      if (s.follow) {
        const p = s.follow();
        if (p) s.target.set(p.x, p.y, p.z);
      }
      if (s.fresh || s.pos.distanceToSquared(s.target) > FOLLOW_SNAP * FOLLOW_SNAP) s.pos.copy(s.target);
      else s.pos.lerp(s.target, 1 - Math.exp(-step * FOLLOW_RATE));
      // o tamanho: metros → fração da tela, presa na faixa → metros de novo
      s.now = s.size;
      s.perM = 0;
      if (useCam) {
        tmpV.copy(s.pos).applyMatrix4(group.matrixWorld).sub(camPos);
        const perM = screenPerMeter(cam, tmpV.dot(camDir));
        if (perM > 0) {
          const band = s.kind === 'solto' ? BAND_SOLO : BAND;
          const lo = band.lo + (band.loSmall - band.lo) * small;
          const hi = band.hi + (band.hiSmall - band.hi) * small;
          s.now = clamp(s.size * perM, lo, hi) / perM;
          s.perM = perM;
          s.sx = tmpV.dot(camRight) * perM;
          s.sy = tmpV.dot(camUp) * perM;
        }
      }
    }
    if (useCam) settle(step);
    for (const s of live) {
      const solo = s.kind === 'solto';
      const g = s.spec;
      // entra com um "pop", balança de leve e sai encolhendo e sumindo
      const o = Number.isFinite(s.life) ? clamp((s.life - s.t) / OUT, 0, 1) : 1;
      const out = o * o * (3 - 2 * o);
      const shrink = 0.4 + 0.6 * out;
      const kb = Math.max(1e-4, popScale(s.t) * shrink);
      const calm = Math.min(1, s.t / 0.35);
      const sway = Math.sin(s.t * 2.3 + s.phase) * (solo ? 0.05 : 0.032) * calm;
      const up = (useCam ? s.lift : 0) + Math.sin(s.t * 2.9 + s.phase * 1.3) * 0.018 * s.now * calm;
      tmpV.copy(s.pos);
      if (useCam) tmpV.addScaledVector(camUp, up);
      else tmpV.y += up;
      const S = s.now * kb;
      if (solo) {
        s.bg.visible = false;
      } else {
        s.bg.visible = true;
        s.bg.position.copy(tmpV);
        s.bg.scale.set((S * g.w) / CELL, (S * g.h) / CELL, 1);
        s.bg.center.set(s.flip ? 1 - g.ax / g.w : g.ax / g.w, 1 - g.ay / g.h);
        s.bg.material.rotation = sway;
        s.bg.material.opacity = out;
      }
      // os ícones, em quadros do próprio ícone a partir da ponta: o meio do corpo e a fila da frase
      const quad = solo ? 1 : ICON_PX / CELL;
      const pitch = solo ? 0.84 : SLOT_PX / ICON_PX;
      const midX = solo ? 0 : ((s.flip ? -1 : 1) * (g.bx - g.ax)) / ICON_PX;
      const midY = solo ? 0 : (g.ay - g.by) / ICON_PX;
      for (let i = 0; i < s.icons.length; i++) {
        const sp = s.icons[i];
        // dentro do balão, cada ícone estoura um instante depois do anterior (a frase se lê na ordem)
        const ki = solo && s.n === 1 ? kb : popScale(s.t - (solo ? 0 : 0.04) - i * 0.1) * shrink;
        if (i >= s.n || ki < 0.02) {
          sp.visible = false;
          continue;
        }
        const rel = kb / ki;
        sp.visible = true;
        sp.position.copy(tmpV);
        sp.scale.set(s.now * quad * ki, s.now * quad * ki, 1);
        sp.center.set(0.5 - (midX + (i - (s.n - 1) / 2) * pitch) * rel, 0.5 - midY * rel);
        sp.material.rotation = sway;
        sp.material.opacity = out;
      }
      s.fresh = false;
    }
  }

  function clear() {
    for (const s of pool) release(s);
  }

  return {
    show, hide, clear, update,
    /** Troca a câmera usada quando o update não recebe uma. */
    setCamera(/** @type {THREE.Camera | null} */ cam) { camera = cam || null; },
    get active() { return pool.filter((p) => p.id).length; },
    /** Os balões visíveis agora (testes e depuração): size é o tamanho pedido; shown, o do quadro, em metros. */
    list() {
      return pool.filter((p) => p.id).map((p) => ({ id: p.id, kind: p.kind, t: p.t, icons: [...p.names], who: p.who, size: p.size, shown: p.now, lift: p.lift }));
    },
    dispose() {
      clear();
      for (const s of pool) {
        s.bg.material.dispose();
        for (const ic of s.icons) ic.material.dispose();
      }
      for (const t of maps) t.dispose();
      atlas.dispose();
      group.removeFromParent();
    },
    icons: BALLOON_ICONS,
    group,
  };
}
