// Faro em pulso (as duas farejam), sistema novo do Modo História (docs/HISTORIA.md, "Faro, em pulso").
// Um toque solta uma onda a partir de quem fareja; por FARO.dur segundos as trilhas de cheiro acendem com a cor de cada
// cheiro (cenoura laranja, pombos cinza, gansa branca) e as pistas e coisas fora do lugar brilham. Uma pista revelada
// fica "presa" (pin): continua brilhando fraco depois do pulso, até a jogadora examinar. A nuvem de cheiro que leva à
// próxima pista é outro módulo (scentCloud.js).
// Sem pós-processamento (perfil mínima): trilhas e brilhos são materiais que não dependem de luz (MeshBasic, mistura
// aditiva, sem neblina), e um véu escuro e leve cobre a tela por baixo deles (um quadrado em espaço de tela, desenhado
// depois do cenário e antes dos brilhos). Com o compositor (perfis com pós), o mundo também perde um pouco da cor.
// Tudo nasce escondido junto com a área: o aquecimento da GPU (engine.prepare) já compila os programas na carga.
// API: createFaro({ root, engine, world }) → addTrail, addSpot, pulse(from), update(dt), reach(from, spot), active…
import * as THREE from 'three';

export const FARO = { dur: 8, waveR: 10, waveT: 0.85, fadeIn: 0.4, fadeOut: 0.6, veil: 0.36, pinned: 0.55 };
/** Cores dos cheiros (o roteiro): cenoura laranja, pombos cinza, gansa branca, gato laranja-escuro. */
export const SCENT = { cenoura: '#FF8A2A', pombos: '#A9B7D0', gansa: '#F3F6FF', gato: '#D2691E', pista: '#FFD27A', escondida: '#FFC53D', reconstrucao: '#BFE3FF' };

const ORDER = { veil: 900, glow: 905 };
const VEIL_VS = /* glsl */ 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';
const VEIL_FS = /* glsl */ 'uniform float uK; void main(){ gl_FragColor = vec4(0.05, 0.035, 0.11, uK); }';

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

  // a onda: um anel no chão que cresce a partir da Radhija
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 72).rotateX(-Math.PI / 2), mat('#FFB15C').clone());
  wave.name = 'faro:onda';
  wave.renderOrder = ORDER.glow;
  wave.visible = false;
  group.add(wave);

  // contas de luz (esferinhas) um pouco acima do chão: legíveis de lado, com a câmera em 3ª pessoa
  const dotGeo = new THREE.IcosahedronGeometry(0.05, 0);
  const ringGeo = new THREE.RingGeometry(0.2, 0.26, 40).rotateX(-Math.PI / 2);
  /** @type {Map<string, { mesh: THREE.InstancedMesh, mat: THREE.MeshBasicMaterial, base: THREE.Matrix4[], n: number, enabled: boolean }>} */
  const trails = new Map();
  /** @type {Map<string, { id: string, x: number, y: number, z: number, r: number, kind: string, group: THREE.Group, ring: THREE.Mesh, glow: THREE.Sprite, enabled: boolean, los?: { x: number, z: number } | null, pulse: number }>} */
  const spots = new Map();

  const S = { t: -1, from: { x: 0, z: 0 }, k: 0, sat0: null };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();

  /**
   * Uma trilha de cheiro: pontinhos ao longo dos pontos (no chão, ou a `y`), um a cada `spacing` m; some no fim se
   * `fadeEnd` (a garoa lavou o cheiro lá fora).
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
    const base = [];
    pts.forEach((p, i) => {
      const fade = fadeEnd ? 1 - 0.75 * (i / Math.max(1, pts.length - 1)) : 1;
      const s = size * (0.75 + 0.5 * ((i * 37) % 7) / 6) * fade;
      m4.compose(v.set(p.x + Math.sin(i * 2.3) * 0.03, p.y + 0.02 * Math.sin(i * 1.3), p.z + Math.cos(i * 1.7) * 0.03), q.identity(), sc.set(s, s, s));
      base.push(m4.clone());
      mesh.setMatrixAt(i, m4);
    });
    mesh.count = pts.length;
    group.add(mesh);
    trails.set(id, { mesh, mat: m, base, n: pts.length, enabled });
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
   * Uma pista que brilha no pulso: um anel e um brilho no lugar dela. kind: 'pista' (obrigatória), 'escondida',
   * 'reconstrucao'. r: até onde (m) da Radhija o pulso a encontra; los: um ponto de onde conferir a linha de visão.
   * @param {string} id @param {{ x: number, z: number, y?: number, r?: number, kind?: string, size?: number, los?: { x: number, z: number } | null, enabled?: boolean }} o
   */
  function addSpot(id, { x, z, y = 0.02, r = 4, kind = 'pista', size = 1, los = null, enabled = true }) {
    removeSpot(id);
    const color = SCENT[kind] || SCENT.pista;
    const g = new THREE.Group();
    g.name = `faro:pista:${id}`;
    g.position.set(x, y, z);
    const ring = new THREE.Mesh(ringGeo, mat(color).clone());
    ring.renderOrder = ORDER.glow;
    ring.scale.setScalar(size * (kind === 'reconstrucao' ? 3 : 1));
    const glow = new THREE.Sprite(glowMat(color));
    glow.renderOrder = ORDER.glow + 1;
    glow.scale.setScalar(0.5 * size * (kind === 'reconstrucao' ? 2 : 1));
    glow.position.y = 0.12 * size;
    g.add(ring, glow);
    g.visible = false;
    group.add(g);
    const s = { id, x, y, z, r, kind, group: g, ring, glow, enabled, los, pulse: Math.random() * 6, pinned: false };
    spots.set(id, s);
    return s;
  }
  function removeSpot(id) {
    const s = spots.get(id);
    if (!s) return;
    s.group.removeFromParent();
    /** @type {any} */ (s.ring.material).dispose();
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

  /** Solta o pulso a partir de `from`. → os ids das pistas ao alcance (o puzzle decide o que vira cartão). */
  function pulse(from) {
    S.t = 0;
    S.from = { x: from.x, z: from.z };
    const found = [];
    for (const s of spots.values()) if (reach(from, s)) found.push(s.id);
    return found;
  }

  function setVisible(on) {
    veil.visible = on;
    for (const t of trails.values()) t.mesh.visible = on && t.enabled;
    for (const s of spots.values()) s.group.visible = (on || s.pinned) && s.enabled;
  }
  /** As pistas presas brilham fraco fora do pulso (no pulso, o update normal cuida delas). */
  function showPinned(dt) {
    for (const s of spots.values()) {
      if (!s.pinned || !s.enabled) continue;
      s.pulse += dt;
      const p = 0.7 + 0.3 * Math.sin(s.pulse * 3.2);
      s.group.visible = true;
      /** @type {THREE.MeshBasicMaterial} */ (s.ring.material).opacity = 0.9 * FARO.pinned * p;
      s.glow.material.opacity = 0.75 * FARO.pinned * p;
    }
  }

  function update(dt, time = 0) {
    if (S.t < 0) { showPinned(dt); return; }
    S.t += dt;
    const t = S.t;
    const total = FARO.dur + FARO.fadeOut;
    if (t >= total) {
      S.t = -1;
      S.k = 0;
      setVisible(false);
      wave.visible = false;
      setSat(0);
      showPinned(0);
      return;
    }
    const k = t < FARO.fadeIn ? t / FARO.fadeIn : t > FARO.dur ? 1 - (t - FARO.dur) / FARO.fadeOut : 1;
    S.k = k;
    setVisible(true);
    veil.material.uniforms.uK.value = FARO.veil * k;
    setSat(k);
    // a onda cresce até FARO.waveR e some
    wave.visible = t < FARO.waveT + 0.25;
    if (wave.visible) {
      const w = Math.min(1, t / FARO.waveT);
      const R = 0.3 + (FARO.waveR - 0.3) * (1 - (1 - w) * (1 - w));
      wave.position.set(S.from.x, 0.04, S.from.z);
      wave.scale.set(R, 1, R);
      /** @type {THREE.MeshBasicMaterial} */ (wave.material).opacity = 0.9 * (1 - w * 0.85) * Math.min(1, (FARO.waveT + 0.25 - t) / 0.25);
    }
    // as trilhas: aparecem atrás da onda e "respiram" ao longo do caminho
    for (const tr of trails.values()) {
      if (!tr.enabled) continue;
      tr.mat.opacity = 0.95 * k;
      for (let i = 0; i < tr.n; i++) {
        const b = tr.base[i];
        b.decompose(v, q, sc);
        const breathe = 1 + 0.35 * Math.max(0, Math.sin(time * 4 - i * 0.45));
        m4.compose(v, q, sc.multiplyScalar(breathe));
        tr.mesh.setMatrixAt(i, m4);
      }
      tr.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const s of spots.values()) {
      if (!s.enabled) continue;
      s.pulse += dt;
      const p = 0.75 + 0.25 * Math.sin(s.pulse * 4.2);
      const kk = s.pinned ? Math.max(k, FARO.pinned) : k;
      /** @type {THREE.MeshBasicMaterial} */ (s.ring.material).opacity = 0.9 * kk * p;
      s.glow.material.opacity = 0.75 * kk * p;
    }
  }

  /** Com o compositor (perfis com pós), o mundo perde um pouco da cor durante o pulso. */
  function setSat(k) {
    const G = engine?.grade?.uniforms;
    if (!G?.uSat) return;
    if (S.sat0 === null) S.sat0 = G.uSat.value;
    G.uSat.value = S.sat0 * (1 - 0.45 * k);
    if (k <= 0) S.sat0 = null;
  }

  function stop() {
    if (S.t < 0) return;
    S.t = FARO.dur + FARO.fadeOut;
    update(0);
  }

  return {
    addTrail, removeTrail, addSpot, removeSpot, pulse, update, stop, reach,
    /** Liga ou desliga uma trilha (uma trilha nova que aparece depois de um acontecimento). */
    setTrail(id, on) { const t = trails.get(id); if (t) t.enabled = on; },
    setSpot(id, on) { const s = spots.get(id); if (s) s.enabled = on; },
    /** Prende a pista: ela continua brilhando fraco depois do pulso (até examinar). */
    pin(id, on) {
      const s = spots.get(id);
      if (!s) return;
      s.pinned = !!on;
      if (!on && S.t < 0) s.group.visible = false;
    },
    spot: (id) => spots.get(id) || null,
    get active() { return S.t >= 0; },
    /** 0..1: o quanto o pulso está aceso agora. */
    get k() { return S.k; },
    /** Segundos desde o pulso (−1 apagado). */
    get t() { return S.t; },
    info() { return { active: S.t >= 0, t: +S.t.toFixed(2), trails: [...trails.keys()], spots: [...spots.values()].filter((s) => s.enabled).map((s) => s.id), pinned: [...spots.values()].filter((s) => s.pinned).map((s) => s.id) }; },
    group,
    dispose() {
      stop();
      for (const id of [...trails.keys()]) removeTrail(id);
      for (const id of [...spots.keys()]) removeSpot(id);
      veil.geometry.dispose();
      /** @type {THREE.ShaderMaterial} */ (veil.material).dispose();
      wave.geometry.dispose();
      /** @type {THREE.MeshBasicMaterial} */ (wave.material).dispose();
      dotGeo.dispose();
      ringGeo.dispose();
      for (const m of mats.values()) m.dispose();
      glowTex.dispose();
      group.removeFromParent();
    },
  };
}
