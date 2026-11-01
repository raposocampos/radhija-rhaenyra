// Balões de ícone das cenas (kit de cenas): fala (com a pontinha) e pensamento (com as bolinhas), com os ícones do
// roteiro (docs/HISTORIA.md, "Ícones dos balões"), tudo num atlas só (uma textura de canvas 1024 × 1024, 5 × 5 casas).
// Cada balão são dois sprites do mesmo atlas, o fundo e o ícone, sempre de frente para a câmera, grandes e de contorno
// grosso; o fundo fica ancorado embaixo e o ícone, deslocado na tela (Sprite.center), cai no meio do círculo em
// qualquer ângulo de câmera. Sem palavras: só desenho. Um ícone também pode aparecer sem balão, colado no objeto que
// ele representa (kind 'solto': o cone ao lado da cenoura, na abertura).
// API: createBalloons({ root }) → { show(icon, opts) → id, hide(id), clear(), update(dt), dispose(), icons }.
import * as THREE from 'three';

/** Ícones do atlas, em ordem de casa (o fundo de fala e o de pensamento são as duas últimas). */
export const BALLOON_ICONS = [
  'cenoura', 'cone', 'osso', 'coracao', 'q', 'ex', 'raiva', 'medo', 'zzz', 'lampada', 'lupa', 'mapa', 'seta',
  'migalha', 'ovo', 'gota', 'relogio', 'sino', 'nota', 'espiral', 'focinho', 'meia', 'pena',
];
const BG = { fala: BALLOON_ICONS.length, pensamento: BALLOON_ICONS.length + 1 };
const GRID = 5;
const SIZE = 1024;
const CELL = SIZE / GRID;
const INK = '#2a2420';

const hasPath = () => typeof Path2D !== 'undefined';
/** Desenha uma forma de caminho SVG (no espaço ±12 do ícone), se o navegador tiver Path2D. */
function shape(ctx, d, fill, stroke = INK, width = 1.7) {
  if (!hasPath()) return;
  const p = new Path2D(d);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(p);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke(p);
  }
}

/** Os ícones, desenhados no espaço ±12 (o centro da casa é a origem). */
const ICON_DRAW = {
  cenoura(c) {
    shape(c, 'M2,10 L-4.5,-6 Q1,-9.5 6.5,-4.5 Z', '#F07A1A');
    shape(c, 'M-1,3 l3.2,-.6 M-2.6,-1.6 l3.4,-.8', null, '#C2560B', 1.3);
    shape(c, 'M3.4,-6.6 q-1,-6 2.6,-8.4 M3.4,-6.6 q3,-5 6.6,-5.6 M3.4,-6.6 q4.6,-1.4 7,1', null, '#4FA444', 2.4);
  },
  cone(c) { shape(c, 'M-8,-8 H8 L0,9 Z', null, '#F07A1A', 2.6); },
  osso(c) { shape(c, 'M-7,-2.4 h14 a3.2,3.2 0 1 1 3,3.4 a3.2,3.2 0 1 1 -3,3.4 h-14 a3.2,3.2 0 1 1 -3,-3.4 a3.2,3.2 0 1 1 3,-3.4z', '#FFF6E3'); },
  coracao(c) { shape(c, 'M0,8 C-12,-1 -9,-11 -3,-9 C-1,-8 0,-6 0,-5 C0,-6 1,-8 3,-9 C9,-11 12,-1 0,8z', '#E8475F'); },
  q(c) {
    shape(c, 'M-4.5,-4.5 q0,-6.5 5.5,-6.5 q5.5,0 5.5,5 q0,4 -5.5,5.5 v3.4', null, INK, 3.4);
    shape(c, 'M1,7.2 a2.1,2.1 0 1 1 0.01,0z', INK, null);
  },
  ex(c) {
    shape(c, 'M0,-10.5 v12.5', null, '#E8475F', 4.4);
    shape(c, 'M0,6.6 a2.4,2.4 0 1 1 0.01,0z', '#E8475F', null);
  },
  raiva(c) { shape(c, 'M-9,-2 q4.5,-2 4.5,-7.5 M9,-2 q-4.5,-2 -4.5,-7.5 M-9,2 q4.5,2 4.5,7.5 M9,2 q-4.5,2 -4.5,7.5', null, '#E23B3B', 3.4); },
  medo(c) { shape(c, 'M0,-10 q-7.5,10.5 0,16 q7.5,-5.5 0,-16z', '#8FD0F5'); },
  zzz(c) { shape(c, 'M-10,-6 h6.5 l-6.5,6.5 h6.5 M-1.5,-11 h5.5 l-5.5,5.5 h5.5 M5,0 h6.5 l-6.5,6.5 h6.5', null, '#5B6B9A', 2.3); },
  lampada(c) {
    shape(c, 'M0,-11.5 a7.5,7.5 0 0 1 5.4,12.7 v3.3 h-10.8 v-3.3 a7.5,7.5 0 0 1 5.4,-12.7z', '#FFD84A');
    shape(c, 'M-4.2,7.6 h8.4 M-3.2,10.2 h6.4', null, INK, 1.8);
  },
  lupa(c) {
    shape(c, 'M-2,-9 a7,7 0 1 1 -0.01,0z', '#DFF2FF');
    shape(c, 'M3.2,3.2 l6.4,6.4', null, INK, 3.6);
  },
  mapa(c) {
    shape(c, 'M-10.5,-7.5 l6.5,2 l7.5,-2 l7.5,2 v14 l-7.5,-2 l-7.5,2 l-6.5,-2z', '#F4E3B5');
    shape(c, 'M-7.5,1 q4.5,-4.5 8.5,0 q3,3 6.5,-1', null, '#E8475F', 1.6);
  },
  seta(c) { shape(c, 'M-10,0 h13 M1,-6.5 l7.5,6.5 l-7.5,6.5', null, INK, 3.4); },
  migalha(c) {
    shape(c, 'M-6.5,2 l3.2,-4.4 l4.4,1.1 l1,4.4 l-4.4,2.2z', '#D9A25B');
    shape(c, 'M5.5,-3.2 a2.4,2.4 0 1 1 -0.01,0z M4.4,5.4 a1.8,1.8 0 1 1 -0.01,0z', '#D9A25B');
  },
  ovo(c) { shape(c, 'M0,-9 C5.5,-9 7,-1 7,2.5 C7,7 3.8,9.5 0,9.5 C-3.8,9.5 -7,7 -7,2.5 C-7,-1 -5.5,-9 0,-9z', '#FFF4DC'); },
  gota(c) { shape(c, 'M0,-10 q-7.5,10.5 0,16 q7.5,-5.5 0,-16z', '#3D8FD1'); },
  relogio(c) {
    shape(c, 'M0,-9.5 a9.5,9.5 0 1 1 -0.01,0z', '#FFFFFF');
    shape(c, 'M0,0 v-7 M0,0 l3.6,-5.2', null, INK, 2);
  },
  sino(c) {
    shape(c, 'M-7.5,5.5 q1,-13 7.5,-13 q6.5,0 7.5,13z', '#E8B93A');
    shape(c, 'M0,7.6 a2.2,2.2 0 1 1 -0.01,0z', INK, null);
  },
  nota(c) {
    shape(c, 'M-2,6 v-15 l8.5,-2 v13', null, INK, 2.2);
    shape(c, 'M-4.2,6.4 a3.2,2.4 0 1 1 -0.01,0z M4.3,4.4 a3.2,2.4 0 1 1 -0.01,0z', INK, null);
  },
  espiral(c) { shape(c, 'M0,0 a2,2 0 0 1 4,0 a4,4 0 0 1 -8,0 a6,6 0 0 1 12,0 a8,8 0 0 1 -16,0', null, '#7A5FD1', 2.2); },
  focinho(c) {
    shape(c, 'M1,-6.5 a9,6.5 0 1 1 -0.01,0z', '#E8C07A');
    shape(c, 'M4,-2.4 a3.8,2.8 0 1 1 -0.01,0z', INK, null);
    shape(c, 'M-11.5,-6 q-3.2,6 0,12 M-14.6,-9.5 q-5,9.5 0,19', null, '#E8762B', 1.9);
  },
  meia(c) {
    shape(c, 'M-4,-10 h7 v8 l5,6 v4 h-6 l-6,-6z', '#FFFFFF');
    shape(c, 'M-4,-10 h7 v3 h-7z', '#E8762B', null);
  },
  pena(c) { shape(c, 'M-2,9 q9,-9 4,-20 q-9,9 -4,20z M-2,9 q1.6,-10 4,-20', '#CFD5E2', INK, 1.4); },
};

/** O atlas: cada ícone numa casa; o fundo de fala e o de pensamento nas duas seguintes. */
function buildAtlas() {
  const canvas = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect?.(0, 0, SIZE, SIZE);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    BALLOON_ICONS.forEach((name, i) => {
      ctx.save();
      ctx.translate((i % GRID) * CELL + CELL / 2, Math.floor(i / GRID) * CELL + CELL / 2);
      ctx.scale(CELL / 30, CELL / 30); // ±12 do ícone ocupa ~80 % da casa
      ICON_DRAW[name]?.(ctx);
      ctx.restore();
    });
    // fundo de fala: círculo com a pontinha para baixo e para a esquerda; o de pensamento, com duas bolinhas
    for (const [kind, i] of Object.entries(BG)) {
      ctx.save();
      ctx.translate((i % GRID) * CELL + CELL / 2, Math.floor(i / GRID) * CELL + CELL / 2);
      ctx.scale(CELL / 30, CELL / 30);
      if (kind === 'fala') shape(ctx, 'M-2.6,8.4 L-7,14.2 L3.6,9.8 A10.6,10.6 0 1 0 -2.6,8.4 Z', '#FFFFFF', INK, 1.9);
      else {
        shape(ctx, 'M0,-12.4 a10.4,10.4 0 1 1 -0.01,0z', '#FFFFFF', INK, 1.9);
        shape(ctx, 'M-7.2,10.6 a2.3,2.3 0 1 1 -0.01,0z M-10.6,13.6 a1.4,1.4 0 1 1 -0.01,0z', '#FFFFFF', INK, 1.5);
      }
      ctx.restore();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

/** Textura do atlas recortada numa casa (compartilha a mesma imagem na GPU). */
function cellTexture(atlas, index) {
  const t = atlas.clone();
  t.repeat.set(1 / GRID, 1 / GRID);
  t.offset.set((index % GRID) / GRID, 1 - (Math.floor(index / GRID) + 1) / GRID);
  t.needsUpdate = true;
  return t;
}

/**
 * @param {{ root: THREE.Object3D, poolSize?: number }} opts
 */
export function createBalloons({ root, poolSize = 8 }) {
  const atlas = buildAtlas();
  const group = new THREE.Group();
  group.name = 'cena:baloes';
  root.add(group);
  /** Texturas por casa (uma vez cada). */
  const cells = new Map();
  const cell = (i) => {
    if (!cells.has(i)) cells.set(i, cellTexture(atlas, i));
    return cells.get(i);
  };
  const mk = (order) => {
    const m = new THREE.SpriteMaterial({ map: cell(0), transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    const s = new THREE.Sprite(m);
    s.renderOrder = order;
    s.visible = false;
    s.frustumCulled = false;
    group.add(s);
    return s;
  };
  const pool = Array.from({ length: poolSize }, (_, i) => ({ id: 0, bg: mk(60 + i * 2), icon: mk(61 + i * 2), t: 0, life: 0, size: 0.4, kind: 'fala', at: new THREE.Vector3(), follow: null, bob: i * 1.7 }));
  let nextId = 1;
  let rr = 0;

  /**
   * Mostra um balão. kind: 'fala' | 'pensamento' | 'solto' (o ícone sem balão). follow(): posição no mundo a cada
   * quadro (a cabeça da dog); at: posição fixa. life: segundos (Infinity até hide). → id para esconder antes.
   * @param {string} icon
   * @param {{ kind?: 'fala' | 'pensamento' | 'solto', follow?: (() => { x: number, y: number, z: number }) | null,
   *   at?: { x: number, y: number, z: number }, life?: number, size?: number, flip?: boolean }} [o]
   */
  function show(icon, { kind = 'fala', follow = null, at = null, life = 2, size = 0.42, flip = false } = {}) {
    const idx = BALLOON_ICONS.indexOf(icon);
    if (idx < 0) return 0;
    let slot = pool.find((p) => !p.id);
    if (!slot) {
      slot = pool[rr];
      rr = (rr + 1) % pool.length;
    }
    slot.id = nextId++;
    slot.t = 0;
    slot.life = life;
    slot.size = size;
    slot.kind = kind;
    slot.follow = follow;
    if (at) slot.at.set(at.x, at.y, at.z);
    else if (follow) { const p = follow(); slot.at.set(p.x, p.y, p.z); }
    slot.icon.material.map = cell(idx);
    slot.icon.material.needsUpdate = true;
    if (kind !== 'solto') {
      slot.bg.material.map = cell(BG[kind] ?? BG.fala);
      slot.bg.material.needsUpdate = true;
      slot.bg.center.set(0.4, 0);
    }
    slot.flip = flip;
    return slot.id;
  }

  function hide(id) {
    const s = pool.find((p) => p.id === id);
    if (s) s.life = Math.min(s.life, s.t + 0.2);
  }

  function update(dt) {
    for (const s of pool) {
      if (!s.id) {
        s.bg.visible = s.icon.visible = false;
        continue;
      }
      s.t += dt;
      if (s.t >= s.life) {
        s.id = 0;
        s.bg.visible = s.icon.visible = false;
        continue;
      }
      if (s.follow) {
        const p = s.follow();
        s.at.set(p.x, p.y, p.z);
      }
      // entra crescendo com um pulinho, balança devagar e some nos últimos 0,25 s
      const pop = s.t < 0.18 ? (s.t / 0.18) * 1.12 : s.t < 0.3 ? 1.12 - ((s.t - 0.18) / 0.12) * 0.12 : 1;
      const out = Number.isFinite(s.life) ? Math.min(1, Math.max(0, (s.life - s.t) / 0.25)) : 1;
      const k = pop * (0.55 + 0.45 * out);
      const bob = Math.sin(s.t * 2.2 + s.bob) * 0.015;
      const solo = s.kind === 'solto';
      s.bg.visible = !solo;
      s.icon.visible = true;
      s.bg.position.set(s.at.x, s.at.y + bob, s.at.z);
      s.icon.position.copy(s.bg.position);
      const size = s.size * k;
      // virado: o fundo espelha (a pontinha para a direita); o ícone não
      s.bg.scale.set(s.flip ? -size : size, size, 1);
      const si = solo ? size : size * 0.6;
      s.icon.scale.set(si, si, 1);
      // o ícone no meio do círculo do fundo: a âncora fica a 40 % da largura do fundo (o círculo, no meio) e o círculo,
      // a ~0,56 da altura acima dela (deslocamentos na tela: valem em qualquer ângulo de câmera)
      const dx = (0.5 - 0.4) * size * (s.flip ? -1 : 1);
      s.icon.center.set(solo ? 0.5 : 0.5 - dx / si, solo ? 0.5 : 0.5 - (0.56 * size) / si);
      s.bg.material.opacity = out;
      s.icon.material.opacity = out;
    }
  }

  function clear() {
    for (const s of pool) {
      s.id = 0;
      s.bg.visible = s.icon.visible = false;
    }
  }

  return {
    show, hide, clear, update,
    get active() { return pool.filter((p) => p.id).length; },
    /** Os balões visíveis agora (testes e depuração). */
    list() { return pool.filter((p) => p.id).map((p) => ({ id: p.id, kind: p.kind, t: p.t })); },
    dispose() {
      clear();
      for (const s of pool) {
        s.bg.material.dispose();
        s.icon.material.dispose();
      }
      for (const t of cells.values()) t.dispose();
      atlas.dispose();
      group.removeFromParent();
    },
    icons: BALLOON_ICONS,
    group,
  };
}
