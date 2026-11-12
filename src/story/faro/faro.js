// O Faro (as duas farejam), sistema novo do Modo História (docs/HISTORIA.md). Dois jeitos de acender:
//  - o modo Faro (pedido do usuário em 2026-11-11, src/story/faro/faroMode.js): o botão liga e desliga, com fôlego.
//    O faroMode manda a cada quadro `hold(k, from)` (o quanto está aceso e onde está o focinho), `wave(from)` ao ligar,
//    `scan(from)` para achar as pistas ao alcance, `sniff()` a cada fungada e `tired(from)` quando acaba o fôlego;
//  - o pulso antigo (`pulse(from)`): FARO.dur segundos acesos (continua para quem ainda chama).
// Aceso, as trilhas de cheiro aparecem na cor de cada cheiro (cenoura laranja, pombos cinza, gansa branca) com fiapos
// andando ao longo delas, as pistas brilham (aura quente pulsando, anéis saindo e faíscas subindo; no modo, as ao
// alcance mais fortes) e, no focinho de quem fareja, fiapinhos de ar entram a cada fungada. Uma pista revelada fica
// "presa" (pin): continua brilhando fraco depois, até a jogadora examinar. A nuvem de cheiro que leva à próxima pista
// é outro módulo (scentCloud.js).
// A visão de cheiro: um véu violeta com vinheta cobre a tela por baixo dos brilhos (um quadrado em espaço de tela,
// depois do cenário) e, com o compositor (perfis com pós), a correção de cor do motor perde cor, esfria e fecha a
// vinheta (FARO_GRADE). Ela parte do valor que estiver lá e volta a ele ao apagar; se o clima de cena (mood.js) mudar
// a cor no meio, o valor novo dele vira a base (e fica, ao apagar).
// Sem programa novo no meio do jogo: tudo nasce escondido junto com a área (o aquecimento da GPU, engine.prepare,
// compila e desenha o que está escondido). Materiais que não dependem de luz, sem neblina; brilhos aditivos.
// API: createFaro({ root, engine, world }) → addTrail, addSpot, hold(k, from), wave(from), scan(from), sniff(),
//   tired(from), pulse(from), update(dt, time), reach(from, spot), stop(), k, active…
import * as THREE from 'three';

export const FARO = { dur: 8, waveR: 10, waveT: 1.0, fadeIn: 0.4, fadeOut: 0.6, veil: 0.36, pinned: 0.55, far: 0.4 };
/**
 * A visão de cheiro na correção de cor (k = 1): a saturação cai 40%, esfria um pouco, uma névoa violeta nos escuros e a
 * vinheta fecha. O passe de cor vem depois de tudo (também tinge os brilhos do Faro): moderado, para as cores dos
 * cheiros continuarem legíveis.
 */
export const FARO_GRADE = Object.freeze({ sat: 0.6, warm: Object.freeze([0.94, 0.98, 1.06]), lift: Object.freeze([0.003, 0.002, 0.012]), vignette: 0.28 });
/** Cores dos cheiros (o roteiro): cenoura laranja, pombos cinza, gansa branca, gato laranja-escuro. */
export const SCENT = { cenoura: '#FF8A2A', pombos: '#A9B7D0', gansa: '#F3F6FF', gato: '#D2691E', pista: '#FFD27A', escondida: '#FFC53D', reconstrucao: '#BFE3FF' };

const ORDER = { veil: 900, glow: 905, fx: 907 };
/** Faíscas, fiapos e bufos: uma malha só (instâncias), no máximo FX_MAX por quadro. */
const FX_MAX = 180;
const SPARKS = 5; // faíscas subindo de cada pista acesa
const WISP_SPEED = 0.75; // m/s dos fiapos andando pelas trilhas
const SNIFF_T = 0.62; // s dos fiapinhos entrando no focinho
const TIRED_T = 1.05; // s do bufo cansado

const VEIL_VS = /* glsl */ 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }';
// mais fechado nas bordas (vinheta) e leve no meio, onde está a dog
const VEIL_FS = /* glsl */ 'uniform float uK; varying vec2 vP; void main(){ float v = smoothstep(0.2, 1.5, length(vP * vec2(1.0, 0.82))); gl_FragColor = vec4(0.05, 0.035, 0.11, uK * (0.55 + 0.8 * v)); }';

// A onda no chão: a crista na beirada (r = 1), um eco atrás e um rastro fraco, com faísca correndo na crista.
const WAVE_VS = /* glsl */ 'varying vec2 vXZ; void main(){ vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const WAVE_FS = /* glsl */ `
uniform float uK;
uniform float uT;
uniform vec3 uColor;
varying vec2 vXZ;
void main() {
  float r = length(vXZ);
  float a = atan(vXZ.y, vXZ.x);
  float c1 = (r - 0.975) / 0.028;
  float c2 = (r - 0.8) / 0.045;
  float crest = exp(-c1 * c1);
  float echo = 0.4 * exp(-c2 * c2);
  float wake = 0.16 * smoothstep(0.42, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
  float spark = 0.72 + 0.28 * sin(a * 36.0 + uT * 10.0) * sin(a * 11.0 - uT * 6.0);
  float i = (crest * spark + echo + wake) * uK;
  gl_FragColor = vec4(mix(uColor, vec3(1.0), crest * 0.5) * i, 1.0);
  #include <colorspace_fragment>
}`;

// Faíscas e fiapos: quadrados virados para a câmera (o centro e o tamanho vêm da instância), bolinha macia com miolo.
const FX_VS = /* glsl */ `
varying vec2 vUv;
varying vec3 vCol;
void main() {
  vUv = uv;
  vCol = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vCol = instanceColor;
  #endif
  vec4 c = vec4(0.0, 0.0, 0.0, 1.0);
  float s = 1.0;
  #ifdef USE_INSTANCING
    c = instanceMatrix * c;
    s = length(instanceMatrix[0].xyz);
  #endif
  vec4 mv = modelViewMatrix * c;
  mv.xy += position.xy * s;
  gl_Position = projectionMatrix * mv;
}`;
const FX_FS = /* glsl */ `
varying vec2 vUv;
varying vec3 vCol;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float a = max(0.0, 1.0 - dot(p, p));
  float soft = a * a;
  float core = soft * soft;
  gl_FragColor = vec4(vCol * (soft * 0.85 + core * 0.9), 1.0);
  #include <colorspace_fragment>
}`;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fract = (v) => v - Math.floor(v);
const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);

/** Brilho redondo (textura pequena de canvas, uma só). */
function glowTexture() {
  const c = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx?.createRadialGradient) {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {{ root: THREE.Object3D, engine?: any, world?: import('../../types').CollisionWorld | null }} opts
 */
export function createFaro({ root, engine = null, world = null }) {
  const group = new THREE.Group();
  group.name = 'faro';
  root.add(group);
  const glowTex = glowTexture();
  /** @type {Map<string, THREE.MeshBasicMaterial>} */
  const mats = new Map();
  const mat = (color) => {
    if (!mats.has(color)) {
      mats.set(color, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
      }));
    }
    return mats.get(color);
  };
  const glowMat = (color) => new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });

  // o véu: um quadrado em espaço de tela (sem câmera, sem recorte), depois do cenário e antes dos brilhos
  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: VEIL_VS, fragmentShader: VEIL_FS, uniforms: { uK: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false }),
  );
  veil.name = 'faro:veu';
  veil.frustumCulled = false;
  veil.renderOrder = ORDER.veil;
  veil.visible = false;
  group.add(veil);

  // a onda: um anel largo no chão que cresce a partir de quem fareja (crista, eco e rastro no shader)
  const waveMat = new THREE.ShaderMaterial({
    vertexShader: WAVE_VS, fragmentShader: WAVE_FS,
    uniforms: { uK: { value: 0 }, uT: { value: 0 }, uColor: { value: new THREE.Color('#FFB15C') } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide,
  });
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.4, 1, 96, 1).rotateX(-Math.PI / 2), waveMat);
  wave.name = 'faro:onda';
  wave.renderOrder = ORDER.glow;
  wave.visible = false;
  group.add(wave);

  // faíscas das pistas, fiapos das trilhas, fiapinhos do focinho e o bufo cansado: uma malha só
  const fxGeo = new THREE.PlaneGeometry(1, 1);
  const fxMat = new THREE.ShaderMaterial({
    vertexShader: FX_VS, fragmentShader: FX_FS,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
  });
  const fx = new THREE.InstancedMesh(fxGeo, fxMat, FX_MAX);
  fx.name = 'faro:fiapos';
  fx.frustumCulled = false;
  fx.renderOrder = ORDER.fx;
  fx.count = 0;
  fx.visible = false;
  fx.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fx.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FX_MAX * 3), 3);
  fx.instanceColor.setUsage(THREE.DynamicDrawUsage);
  group.add(fx);
  const sniffColor = new THREE.Color('#FFE6B8');
  const tiredColor = new THREE.Color('#9AA3B5');

  // contas de luz (esferinhas) um pouco acima do chão: legíveis de lado, com a câmera em 3ª pessoa
  const dotGeo = new THREE.IcosahedronGeometry(0.05, 0);
  const ringGeo = new THREE.RingGeometry(0.2, 0.26, 40).rotateX(-Math.PI / 2);
  /**
   * @type {Map<string, { mesh: THREE.InstancedMesh, mat: THREE.MeshBasicMaterial, pos: Float32Array, scl: Float32Array, n: number,
   *   enabled: boolean, path: { x: number, y: number, z: number, d: number }[], len: number, wisps: number, color: THREE.Color,
   *   size: number, fadeEnd: boolean }>}
   */
  const trails = new Map();
  /**
   * @type {Map<string, { id: string, x: number, y: number, z: number, r: number, kind: string, size: number, group: THREE.Group,
   *   ring: THREE.Mesh, ripple: THREE.Mesh, glow: THREE.Sprite, ringS: number, glowS: number, color: THREE.Color, seed: number,
   *   enabled: boolean, los?: { x: number, z: number } | null, pulse: number, pinned: boolean, near: boolean, lit: number, kk: number }>}
   */
  const spots = new Map();

  /** O pulso antigo (t: s desde o pulso, −1 apagado), o k de agora (o maior entre o pulso e o modo) e o véu à mostra. */
  const S = { t: -1, from: { x: 0, z: 0 }, k: 0, pk: 0, vis: false };
  /** O modo Faro (faroMode.js): o quanto está aceso e onde está o focinho. */
  const H = { k: 0, /** @type {any} */ from: null };
  /** A onda (t: s desde que saiu), a fungada e o bufo cansado. */
  const W = { t: -1, x: 0, z: 0 };
  const N = { t: -1 };
  const T = { t: -1, /** @type {any} */ p: null };
  const m4 = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const tmpC = new THREE.Color();

  /**
   * Uma trilha de cheiro: pontinhos ao longo dos pontos (no chão, ou a `y`), um a cada `spacing` m; some no fim se
   * `fadeEnd` (a garoa lavou o cheiro lá fora). Com o Faro aceso, fiapos andam ao longo dela.
   * @param {string} id @param {{ x: number, z: number, y?: number }[]} points
   * @param {{ color?: string, y?: number, spacing?: number, size?: number, fadeEnd?: boolean, enabled?: boolean }} [o]
   */
  function addTrail(id, points, { color = SCENT.cenoura, y = 0.09, spacing = 0.13, size = 1, fadeEnd = false, enabled = true } = {}) {
    removeTrail(id);
    const pts = [];
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i], b = points[i + 1];
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(1, Math.round(L / spacing));
      for (let j = 0; j < n; j++) {
        const u = j / n;
        pts.push({ x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, y: (a.y ?? y) + ((b.y ?? y) - (a.y ?? y)) * u });
      }
    }
    const last = points[points.length - 1];
    if (last) pts.push({ x: last.x, z: last.z, y: last.y ?? y });
    const m = mat(color).clone();
    const mesh = new THREE.InstancedMesh(dotGeo, m, Math.max(1, pts.length));
    mesh.name = `faro:trilha:${id}`;
    mesh.renderOrder = ORDER.glow;
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const pos = new Float32Array(pts.length * 3);
    const scl = new Float32Array(pts.length);
    pts.forEach((p, i) => {
      const fade = fadeEnd ? 1 - 0.75 * (i / Math.max(1, pts.length - 1)) : 1;
      const s = size * (0.75 + 0.5 * ((i * 37) % 7) / 6) * fade;
      pos[i * 3] = p.x + Math.sin(i * 2.3) * 0.03;
      pos[i * 3 + 1] = p.y + 0.02 * Math.sin(i * 1.3);
      pos[i * 3 + 2] = p.z + Math.cos(i * 1.7) * 0.03;
      scl[i] = s;
      m4.makeScale(s, s, s).setPosition(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      mesh.setMatrixAt(i, m4);
    });
    mesh.count = pts.length;
    group.add(mesh);
    // o caminho (os pontos dados) com a distância acumulada, para os fiapos andarem
    const path = [];
    let acc = 0;
    points.forEach((p, i) => {
      if (i) acc += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
      path.push({ x: p.x, y: p.y ?? y, z: p.z, d: acc });
    });
    const wisps = Math.max(2, Math.min(8, Math.round(acc / 1.1)));
    trails.set(id, { mesh, mat: m, pos, scl, n: pts.length, enabled, path, len: acc, wisps, color: new THREE.Color(color), size, fadeEnd });
    return mesh;
  }
  function removeTrail(id) {
    const t = trails.get(id);
    if (!t) return;
    t.mesh.removeFromParent();
    t.mesh.dispose?.();
    t.mat.dispose();
    trails.delete(id);
  }

  /**
   * Uma pista que brilha com o Faro aceso: um anel, um anel que sai (a onda da aura), um brilho e faíscas subindo.
   * kind: 'pista' (obrigatória), 'escondida', 'reconstrucao'. r: até onde (m) de quem fareja ela é achada; los: um ponto
   * de onde conferir a linha de visão.
   * @param {string} id @param {{ x: number, z: number, y?: number, r?: number, kind?: string, size?: number, los?: { x: number, z: number } | null, enabled?: boolean }} o
   */
  function addSpot(id, { x, z, y = 0.02, r = 4, kind = 'pista', size = 1, los = null, enabled = true }) {
    removeSpot(id);
    const color = SCENT[kind] || SCENT.pista;
    const g = new THREE.Group();
    g.name = `faro:pista:${id}`;
    g.position.set(x, y, z);
    const big = kind === 'reconstrucao';
    const ring = new THREE.Mesh(ringGeo, mat(color).clone());
    ring.renderOrder = ORDER.glow;
    const ringS = size * (big ? 3 : 1);
    ring.scale.setScalar(ringS);
    const ripple = new THREE.Mesh(ringGeo, mat(color).clone());
    ripple.renderOrder = ORDER.glow;
    ripple.scale.setScalar(ringS);
    const glow = new THREE.Sprite(glowMat(color));
    glow.renderOrder = ORDER.glow + 1;
    const glowS = 0.5 * size * (big ? 2 : 1);
    glow.scale.setScalar(glowS);
    glow.position.y = 0.12 * size;
    g.add(ring, ripple, glow);
    g.visible = false;
    group.add(g);
    const s = {
      id, x, y, z, r, kind, size, group: g, ring, ripple, glow, ringS, glowS, color: new THREE.Color(color), seed: fract(Math.sin((x * 12.9898 + z * 78.233)) * 43758.5453),
      enabled, los, pulse: Math.random() * 6, pinned: false, near: false, lit: FARO.far, kk: 0,
    };
    spots.set(id, s);
    return s;
  }
  function removeSpot(id) {
    const s = spots.get(id);
    if (!s) return;
    s.group.removeFromParent();
    /** @type {any} */ (s.ring.material).dispose();
    /** @type {any} */ (s.ripple.material).dispose();
    s.glow.material.dispose();
    spots.delete(id);
  }

  /** A pista está ao alcance de quem fareja em `from` (distância e, se pedido, linha de visão)? */
  function reach(from, s) {
    if (!s.enabled) return false;
    const d = Math.hypot(s.x - from.x, s.z - from.z);
    if (d > s.r) return false;
    if (s.los && world?.segmentClear) return world.segmentClear(from.x, from.z, s.los.x, s.los.z, 0.04, 'small');
    return true;
  }

  /** As pistas ao alcance de `from` agora (o modo chama a cada ~0,25 s; as achadas brilham mais forte). */
  function scan(from) {
    const found = [];
    if (!from || !Number.isFinite(from.x) || !Number.isFinite(from.z)) return found;
    for (const s of spots.values()) {
      s.near = reach(from, s);
      if (s.near) found.push(s.id);
    }
    return found;
  }

  /** A onda saindo de `from` (ao ligar o modo, ou no pulso). */
  function launchWave(from) {
    if (!from) return;
    W.t = 0;
    W.x = fin(from.x);
    W.z = fin(from.z);
  }

  /** Solta o pulso a partir de `from`. → os ids das pistas ao alcance (o puzzle decide o que vira cartão). */
  function pulse(from) {
    S.t = 0;
    S.from = { x: from.x, z: from.z };
    launchWave(from);
    return scan(from);
  }

  function setVisible(on) {
    veil.visible = on;
    for (const t of trails.values()) t.mesh.visible = on && t.enabled;
  }
  /** Com o compositor desenhando (perfis com pós), a correção de cor faz parte da visão de cheiro (o véu fica leve). */
  const post = () => !!engine?.grade?.uniforms?.uSat && engine?.quality?.profile?.post !== false;

  // ---------------------------------------------------------------- a correção de cor (visão de cheiro)
  /** A base (o valor de antes) e o que o Faro escreveu por último em cada uniforme. */
  const GS = {
    on: false, sat: 0, vig: 0, warm: new THREE.Vector3(), lift: new THREE.Vector3(),
    w: { sat: 0, vig: 0, warm: new THREE.Vector3(), lift: new THREE.Vector3() },
  };
  const same = (a, b) => Math.abs(a - b) < 1e-5;
  const sameV = (a, b) => same(a.x, b.x) && same(a.y, b.y) && same(a.z, b.z);
  function grade(k) {
    const G = engine?.grade?.uniforms;
    if (!G?.uSat || typeof G.uSat.value !== 'number') return;
    const hv = typeof G.uVignette?.value === 'number';
    const hw = !!G.uWarm?.value?.isVector3;
    const hl = !!G.uLift?.value?.isVector3;
    if (!(k > 0)) {
      if (!GS.on) return;
      GS.on = false;
      // de volta ao valor de antes, se ninguém mexeu no meio (o clima de cena: aí o valor novo dele fica)
      if (same(G.uSat.value, GS.w.sat)) G.uSat.value = GS.sat;
      if (hv && same(G.uVignette.value, GS.w.vig)) G.uVignette.value = GS.vig;
      if (hw && sameV(G.uWarm.value, GS.w.warm)) G.uWarm.value.copy(GS.warm);
      if (hl && sameV(G.uLift.value, GS.w.lift)) G.uLift.value.copy(GS.lift);
      return;
    }
    if (!GS.on) {
      GS.on = true;
      GS.sat = G.uSat.value;
      if (hv) GS.vig = G.uVignette.value;
      if (hw) GS.warm.copy(G.uWarm.value);
      if (hl) GS.lift.copy(G.uLift.value);
    } else {
      // alguém mudou no meio (mood.js, applyLighting): o valor dele vira a base
      if (!same(G.uSat.value, GS.w.sat)) GS.sat = G.uSat.value;
      if (hv && !same(G.uVignette.value, GS.w.vig)) GS.vig = G.uVignette.value;
      if (hw && !sameV(G.uWarm.value, GS.w.warm)) GS.warm.copy(G.uWarm.value);
      if (hl && !sameV(G.uLift.value, GS.w.lift)) GS.lift.copy(G.uLift.value);
    }
    const F = FARO_GRADE;
    G.uSat.value = GS.w.sat = GS.sat * (1 - (1 - F.sat) * k);
    if (hv) G.uVignette.value = GS.w.vig = GS.vig + F.vignette * k;
    if (hw) {
      G.uWarm.value.set(GS.warm.x * (1 + (F.warm[0] - 1) * k), GS.warm.y * (1 + (F.warm[1] - 1) * k), GS.warm.z * (1 + (F.warm[2] - 1) * k));
      GS.w.warm.copy(G.uWarm.value);
    }
    if (hl) {
      G.uLift.value.set(GS.lift.x + F.lift[0] * k, GS.lift.y + F.lift[1] * k, GS.lift.z + F.lift[2] * k);
      GS.w.lift.copy(G.uLift.value);
    }
  }

  // ---------------------------------------------------------------- o desenho de cada quadro
  /** As trilhas "respiram" ao longo do caminho (a onda de brilho anda de um ponto ao outro). */
  function stepTrails(k, time) {
    for (const tr of trails.values()) {
      if (!tr.enabled) continue;
      tr.mat.opacity = 0.95 * k;
      for (let i = 0; i < tr.n; i++) {
        const s = tr.scl[i] * (1 + 0.35 * Math.max(0, Math.sin(time * 4 - i * 0.45)));
        m4.makeScale(s, s, s).setPosition(tr.pos[i * 3], tr.pos[i * 3 + 1], tr.pos[i * 3 + 2]);
        tr.mesh.setMatrixAt(i, m4);
      }
      tr.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * As pistas: aura quente pulsando, um anel saindo de tempo em tempo e o brilho; no modo, as fora do alcance ficam
   * fracas (FARO.far). As presas brilham fraco mesmo com o Faro apagado.
   */
  function stepSpots(dt, k, full) {
    for (const s of spots.values()) {
      const target = full || s.near ? 1 : FARO.far;
      s.lit += (target - s.lit) * Math.min(1, dt * 5);
      const kk = s.enabled ? Math.max(k * s.lit, s.pinned ? FARO.pinned : 0) : 0;
      s.kk = kk;
      s.group.visible = kk > 0.002;
      if (!s.group.visible) continue;
      s.pulse += dt;
      const breathe = 0.78 + 0.22 * Math.sin(s.pulse * 4.2);
      /** @type {THREE.MeshBasicMaterial} */ (s.ring.material).opacity = 0.9 * kk * breathe;
      s.ring.scale.setScalar(s.ringS * (1 + 0.06 * Math.sin(s.pulse * 4.2)));
      const ph = fract(s.pulse * 0.7 + s.seed);
      /** @type {THREE.MeshBasicMaterial} */ (s.ripple.material).opacity = 0.75 * kk * Math.pow(1 - ph, 1.5);
      s.ripple.scale.setScalar(s.ringS * (1 + 1.2 * ph));
      s.glow.material.opacity = 0.75 * kk * breathe;
      s.glow.scale.setScalar(s.glowS * (1 + 0.12 * Math.sin(s.pulse * 2.1 + 1)));
    }
  }

  /** A onda: cresce depressa e vai sumindo; apaga junto com o Faro. */
  function stepWave(k, time) {
    if (W.t < 0) { if (wave.visible) wave.visible = false; return; }
    const w = Math.min(1, W.t / FARO.waveT);
    const R = 0.3 + (FARO.waveR - 0.3) * (1 - (1 - w) * (1 - w) * (1 - w));
    wave.visible = true;
    wave.position.set(W.x, 0.04, W.z);
    wave.scale.set(R, 1, R);
    const u = waveMat.uniforms;
    u.uK.value = 0.95 * (1 - 0.7 * w) * Math.min(1, (FARO.waveT + 0.3 - W.t) / 0.3) * Math.min(1, k / 0.35);
    u.uT.value = time;
  }

  /** Faíscas das pistas, fiapos das trilhas, fiapinhos entrando no focinho e o bufo cansado (uma malha só). */
  function stepFx(time, k) {
    let n = 0;
    const put = (x, y, z, size, col, inten) => {
      if (n >= FX_MAX || !(inten > 0.004) || !(size > 0)) return;
      m4.makeScale(size, size, size).setPosition(x, y, z);
      fx.setMatrixAt(n, m4);
      fx.setColorAt(n, tmpC.copy(col).multiplyScalar(inten));
      n++;
    };
    // as pistas acesas (e as presas): faíscas subindo em volta, cada uma no seu compasso
    for (const s of spots.values()) {
      if (!s.group.visible) continue;
      const sz = Math.max(0.7, s.size);
      for (let j = 0; j < SPARKS; j++) {
        const ph = fract(time * 0.42 + j / SPARKS + s.seed);
        const ang = s.seed * 6.283 + j * 2.4 + time * 0.9;
        const rad = (0.1 + 0.06 * (j % 3)) * sz * (1 - 0.5 * ph);
        put(s.x + Math.cos(ang) * rad, s.y + 0.04 + ph * 0.7 * sz, s.z + Math.sin(ang) * rad, 0.09 * (1 - 0.55 * ph) * sz, s.color, Math.sin(Math.PI * ph) * s.kk * 0.9);
      }
    }
    if (k > 0) {
      // fiapos andando pelas trilhas (do começo para o fim de cada uma)
      for (const tr of trails.values()) {
        if (!tr.enabled || tr.len < 0.2) continue;
        for (let j = 0; j < tr.wisps; j++) {
          const u = fract((time * WISP_SPEED) / tr.len + j / tr.wisps);
          samplePath(tr, u * tr.len, v);
          const sway = Math.sin(time * 2.3 + j * 1.9) * 0.05;
          put(v.x + sway, v.y + 0.06 + 0.03 * Math.sin(time * 3.1 + j), v.z - sway * 0.6, 0.2 * tr.size * (tr.fadeEnd ? 1 - 0.5 * u : 1), tr.color, Math.sin(Math.PI * u) * k * 0.75);
        }
      }
      // a fungada: fiapinhos de ar entrando no focinho de quem fareja
      const nose = H.from?.nose;
      if (N.t >= 0 && nose) {
        const yaw = fin(H.from.yaw);
        for (let j = 0; j < 6; j++) {
          const tj = clamp01((N.t - j * 0.035) / 0.42);
          if (tj <= 0 || tj >= 1) continue;
          const a = yaw + (j - 2.5) * 0.32;
          const r0 = 0.42 + 0.07 * (j % 2);
          const e = tj * tj;
          const sx = nose.x + Math.sin(a) * r0;
          const sy = nose.y + ((j % 3) - 1) * 0.06 - 0.03;
          const sz = nose.z + Math.cos(a) * r0;
          put(sx + (nose.x - sx) * e, sy + (nose.y - sy) * e, sz + (nose.z - sz) * e, 0.065 * (1 - 0.5 * e), sniffColor, Math.sin(Math.PI * tj) * k * 0.85);
        }
      }
    }
    // o bufo cansado: o ar saindo cinza do focinho e abrindo
    const tn = T.p?.nose;
    if (T.t >= 0 && tn) {
      const yaw = fin(T.p.yaw);
      for (let j = 0; j < 5; j++) {
        const tj = clamp01((T.t - j * 0.06) / 0.8);
        if (tj <= 0 || tj >= 1) continue;
        const a = yaw + (j - 2) * 0.28;
        const d = 0.08 + 0.32 * Math.sqrt(tj);
        put(tn.x + Math.sin(a) * d, tn.y - 0.04 + 0.12 * tj * tj, tn.z + Math.cos(a) * d, 0.07 + 0.11 * tj, tiredColor, (1 - tj) * 0.5);
      }
    }
    fx.count = n;
    fx.visible = n > 0;
    if (n) {
      fx.instanceMatrix.needsUpdate = true;
      if (fx.instanceColor) fx.instanceColor.needsUpdate = true;
    }
  }
  /** O ponto a `d` m do começo da trilha. */
  function samplePath(tr, d, out) {
    const P = tr.path;
    let i = 1;
    while (i < P.length - 1 && P[i].d < d) i++;
    const a = P[i - 1], b = P[i];
    const seg = b.d - a.d;
    const u = seg > 1e-6 ? clamp01((d - a.d) / seg) : 0;
    return out.set(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u);
  }

  function update(dt, time = 0) {
    dt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    time = fin(time);
    // o pulso antigo: FARO.dur segundos acesos
    let pk = 0;
    if (S.t >= 0) {
      S.t += dt;
      const t = S.t;
      if (t >= FARO.dur + FARO.fadeOut) S.t = -1;
      else pk = t < FARO.fadeIn ? t / FARO.fadeIn : t > FARO.dur ? 1 - (t - FARO.dur) / FARO.fadeOut : 1;
    }
    S.pk = pk;
    const k = Math.max(pk, H.k);
    S.k = k;
    if (W.t >= 0) { W.t += dt; if (W.t > FARO.waveT + 0.3) W.t = -1; }
    if (N.t >= 0) { N.t += dt; if (N.t > SNIFF_T) N.t = -1; }
    if (T.t >= 0) { T.t += dt; if (T.t > TIRED_T) T.t = -1; }
    if (k > 0) {
      S.vis = true;
      setVisible(true);
      veil.material.uniforms.uK.value = FARO.veil * k * (post() ? 0.55 : 1);
      stepTrails(k, time);
    } else if (S.vis) {
      S.vis = false;
      setVisible(false);
    }
    grade(k);
    stepSpots(dt, k, pk > 0 && pk >= H.k);
    stepWave(k, time);
    stepFx(time, k);
  }

  /** Apaga tudo na hora (o pulso, o modo, a onda, os fiapos) e devolve a cor de antes. */
  function stop() {
    S.t = -1;
    H.k = 0;
    H.from = null;
    W.t = -1;
    N.t = -1;
    T.t = -1;
    for (const s of spots.values()) { s.near = false; s.lit = FARO.far; }
    update(0, 0);
  }

  return {
    addTrail, removeTrail, addSpot, removeSpot, pulse, update, stop, reach, scan,
    /**
     * O modo Faro a cada quadro: k (0..1) o quanto está aceso; from { x, z, y?, yaw?, nose?: { x, y, z } } quem fareja
     * (null com ele apagado). O desenho sai no update.
     */
    hold(k, from = null) {
      H.k = clamp01(fin(k));
      if (from) H.from = from;
      if (H.k <= 0) { for (const s of spots.values()) s.near = false; }
    },
    /** A onda no chão a partir de `from` (o modo chama ao ligar). */
    wave: launchWave,
    /** Uma fungada: fiapinhos de ar entrando no focinho (com o modo aceso). */
    sniff() { N.t = 0; },
    /** Sem fôlego: o bufo cinza saindo do focinho de `from` ({ x, z, yaw, nose }). */
    tired(from) {
      if (!from) return;
      T.t = 0;
      T.p = { yaw: fin(from.yaw), nose: from.nose ?? { x: fin(from.x), y: 0.3, z: fin(from.z) } };
    },
    /** Liga ou desliga uma trilha (uma trilha nova que aparece depois de um acontecimento). */
    setTrail(id, on) { const t = trails.get(id); if (t) t.enabled = on; },
    setSpot(id, on) { const s = spots.get(id); if (s) s.enabled = on; },
    /** Prende a pista: ela continua brilhando fraco depois (até examinar). */
    pin(id, on) {
      const s = spots.get(id);
      if (!s) return;
      s.pinned = !!on;
      if (!on && S.k <= 0) s.group.visible = false;
    },
    spot: (id) => spots.get(id) || null,
    /** Aceso (o pulso ou o modo, inclusive apagando)? */
    get active() { return S.t >= 0 || S.k > 0 || H.k > 0; },
    /** 0..1: o quanto está aceso agora (o maior entre o pulso e o modo). */
    get k() { return S.k; },
    /** Segundos desde o pulso (−1 apagado). */
    get t() { return S.t; },
    info() {
      return {
        active: S.t >= 0 || S.k > 0 || H.k > 0, t: +S.t.toFixed(2), k: +S.k.toFixed(3), hold: +H.k.toFixed(3), trails: [...trails.keys()],
        spots: [...spots.values()].filter((s) => s.enabled).map((s) => s.id), pinned: [...spots.values()].filter((s) => s.pinned).map((s) => s.id),
        near: [...spots.values()].filter((s) => s.near).map((s) => s.id), fx: fx.count, wave: W.t >= 0,
      };
    },
    group,
    dispose() {
      stop();
      for (const id of [...trails.keys()]) removeTrail(id);
      for (const id of [...spots.keys()]) removeSpot(id);
      veil.geometry.dispose();
      /** @type {THREE.ShaderMaterial} */ (veil.material).dispose();
      wave.geometry.dispose();
      waveMat.dispose();
      fx.removeFromParent();
      fxGeo.dispose();
      fxMat.dispose();
      fx.dispose?.();
      dotGeo.dispose();
      ringGeo.dispose();
      for (const m of mats.values()) m.dispose();
      glowTex.dispose();
      group.removeFromParent();
    },
  };
}
