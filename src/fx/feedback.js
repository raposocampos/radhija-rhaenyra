// Feedback: liga eventos do jogo a som + partículas, e desenha o marcador de objetivo, o anel da dog
// ativa, o anel tracejado da companheira esperando e ícones flutuantes (patinha, "!", "?").
// Independente de fase: props/layout são lidos na hora (opts.props / opts.layout são getters) e as
// posições vêm sempre dos payloads.
// API: createFeedback({ engine, audio, particles, dogs, game, props, layout }) → { update(dt, t), marker, dogRings }
// Ambiente por fase (no level:loaded): áudio 'day' | 'dusk' | 'night' | 'city' | 'rain' (def.ambience, ou pelo número da fase)
// e vagalumes automáticos em 'dusk'/'night' (desligue com props.fireflies === false, ou chame
// particles.fireflies({...}) depois do build para trocar a área).
import * as THREE from 'three';
import { events } from '../core/events.js';
import { createRingMaterial } from './particles.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const AMBIENCE_BY_NUMBER = { 1: 'day', 2: 'dusk', 3: 'night' };
const WATER_RING = '#CFEFFF';

// Gota (ponta para baixo) via torno.
function makeDropGeometry(h = 0.3, R = 0.11) {
  const pts = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI;
    const x = R * Math.sin(t) * Math.pow(Math.sin(t / 2), 1.1) * 1.18;
    const y = (h / 2) * (1 - Math.cos(t));
    pts.push(new THREE.Vector2(Math.max(0.0001, x), y));
  }
  pts[0].x = 0;
  pts[n].x = 0;
  const g = new THREE.LatheGeometry(pts, 36);
  g.computeVertexNormals();
  return g;
}

// Ícone flutuante em canvas: 'paw' (patinha creme), 'alert' ("!" laranja) e 'curious' ("?").
function makeIconTexture(kind) {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const bubble = (fill, stroke) => {
    g.beginPath();
    g.arc(64, 58, 44, 0, Math.PI * 2);
    g.moveTo(52, 98);
    g.lineTo(64, 120);
    g.lineTo(76, 98);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = stroke;
    g.lineJoin = 'round';
    g.stroke();
    g.beginPath();
    g.arc(64, 58, 44, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  };
  if (kind === 'paw') {
    bubble('#FFF6E6', '#4A3426');
    g.fillStyle = '#F08A3C';
    g.save();
    g.translate(64, 62);
    g.scale(2.4, 2.4);
    g.beginPath();
    g.moveTo(0, -1);
    g.bezierCurveTo(-7, -1, -11, 6, -9, 9);
    g.bezierCurveTo(-7, 12, -3, 10, 0, 10);
    g.bezierCurveTo(3, 10, 7, 12, 9, 9);
    g.bezierCurveTo(11, 6, 7, -1, 0, -1);
    g.fill();
    for (const [x, y, r] of [[-10, -6, 3.2], [-4, -12, 3.4], [4, -12, 3.4], [10, -6, 3.2]]) {
      g.beginPath();
      g.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  } else {
    const alert = kind === 'alert';
    bubble(alert ? '#F08A3C' : '#FFF6E6', '#4A3426');
    g.fillStyle = alert ? '#FFF9EF' : '#4A3426';
    g.font = '700 68px Fredoka, "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(alert ? '!' : '?', 64, 62);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFeedback(opts) {
  const { engine, audio, particles, dogs } = opts;
  const { scene, camera } = engine;
  const L = () => opts.layout || {};
  const P = () => opts.props || {};

  let state = 'title';
  let active = 'radhija';
  let time = 0;
  let playingSince = -10;
  const queue = []; // ações adiadas [{at, fn}]
  const later = (sec, fn) => queue.push({ at: time + sec, fn });

  const v3 = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  // ---------- mixagem espacial ----------
  function pan(x, z) {
    v3.set(x, 0.3, z).project(camera);
    return Number.isFinite(v3.x) ? clamp(v3.x * 0.55, -0.7, 0.7) : 0;
  }
  function near(x, z) {
    const d = dogs[active]?.object.position;
    if (!d) return 1;
    const dist = Math.hypot(d.x - x, d.z - z);
    return clamp(1.15 - dist * 0.09, 0.45, 1);
  }
  const sfx = (name, x, z, o = {}) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return audio.play(name, o);
    audio.play(name, { pan: pan(x, z), ...o, volume: (o.volume ?? 1) * near(x, z) });
  };
  const dogPos = (name) => dogs[name]?.object.position;
  /** Topo da cabeça da dog (markerAnchor) ou estimativa. */
  function headPos(name, out) {
    const d = dogs[name];
    if (!d) return null;
    if (d.markerAnchor?.getWorldPosition) return d.markerAnchor.getWorldPosition(out);
    return out.set(d.object.position.x, name === 'rhaenyra' ? 0.75 : 0.55, d.object.position.z);
  }

  // ---------- marcador de objetivo ----------
  const marker = new THREE.Group();
  marker.name = 'fx-objective-marker';
  marker.visible = false;
  const dropMat = new THREE.MeshStandardMaterial({
    color: '#F28A3A', emissive: '#F06A1C', emissiveIntensity: 0.55, roughness: 0.38, metalness: 0, transparent: true,
  });
  const drop = new THREE.Mesh(makeDropGeometry(0.25, 0.088), dropMat);
  drop.renderOrder = 12;
  const gloss = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#FFF3DE', transparent: true, opacity: 0.85 }),
  );
  gloss.position.set(-0.026, 0.18, 0.063);
  gloss.scale.setScalar(1.15);
  const dropPivot = new THREE.Group();
  dropPivot.add(drop, gloss);
  const planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const groundMat = createRingMaterial({ color: '#F6A35A', opacity: 0.4, width: 0.13, fill: 0.08 });
  const groundRing = new THREE.Mesh(planeGeo, groundMat);
  groundRing.position.y = 0.022;
  groundRing.renderOrder = 11;
  const pingMat = createRingMaterial({ color: '#FFD9A8', opacity: 0, width: 0.08 });
  const pingRing = new THREE.Mesh(planeGeo, pingMat);
  pingRing.position.y = 0.024;
  pingRing.renderOrder = 11;
  marker.add(dropPivot, groundRing, pingRing);
  scene.add(marker);

  // altura da gota = target.y do evento 'objective' (fallback 0,85)
  const mk = { target: null, vis: 0, pop: 0, height: 0.85 };
  function setTarget(target) {
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.z)) {
      mk.target = null;
      return;
    }
    const changed = !mk.target || Math.hypot(mk.target.x - target.x, mk.target.z - target.z) > 0.05;
    mk.target = { x: target.x, z: target.z };
    if (changed) {
      marker.position.set(target.x, 0, target.z);
      mk.pop = 0;
      mk.vis = 0;
    }
  }

  // ---------- anéis das dogs (ativa) e da companheira esperando ----------
  const dogRings = {};
  const stayRings = {};
  for (const name of Object.keys(dogs)) {
    const mat = createRingMaterial({ color: '#FFF6E6', opacity: 0, width: 0.2, fill: 0.14 });
    const m = new THREE.Mesh(planeGeo, mat);
    m.renderOrder = 11;
    m.frustumCulled = false;
    const r = (L().DOGS?.[name]?.radius ?? 0.2) * 1.75;
    scene.add(m);
    dogRings[name] = { mesh: m, mat, r, a: 0, s: 0.7, pop: 0 };
    const smat = createRingMaterial({ color: '#FFC98A', opacity: 0, width: 0.16, fill: 0.05, dash: 9 });
    const sm = new THREE.Mesh(planeGeo, smat);
    sm.renderOrder = 11;
    sm.frustumCulled = false;
    scene.add(sm);
    stayRings[name] = { mesh: sm, mat: smat, r: r * 1.12, a: 0, pop: 0 };
  }
  const stay = { radhija: false, rhaenyra: false };

  // ---------- ícones flutuantes ----------
  const iconTex = { paw: makeIconTexture('paw'), alert: makeIconTexture('alert'), curious: makeIconTexture('curious') };
  const icons = [];
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.SpriteMaterial({ map: iconTex.paw, transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
    const sp = new THREE.Sprite(mat);
    sp.renderOrder = 30;
    sp.visible = false;
    sp.center.set(0.5, 0.05);
    scene.add(sp);
    icons.push({ sp, mat, age: 0, life: 0, follow: null, x: 0, y: 0, z: 0, size: 0.24 });
  }
  let iconCursor = 0;
  /** kind: 'paw' | 'alert' | 'curious'; at: {x,y,z} fixo ou follow: nome da dog. */
  /** @param {string} kind @param {{ at?: { x: number, y: number, z: number }, follow?: string, life?: number, size?: number }} [opts] */
  function popIcon(kind, { at, follow, life = 1.3, size = 0.24 } = {}) {
    let ic = icons.find((c) => c.follow && c.follow === follow && c.age < c.life) || null;
    if (!ic) {
      ic = icons[iconCursor];
      iconCursor = (iconCursor + 1) % icons.length;
    }
    ic.mat.map = iconTex[kind] || iconTex.paw;
    ic.mat.needsUpdate = true;
    ic.age = 0;
    ic.life = life;
    ic.follow = follow || null;
    ic.size = size;
    if (at) { ic.x = at.x; ic.y = at.y ?? 0.7; ic.z = at.z; }
    ic.sp.visible = true;
  }

  // ---------- estado transitório ----------
  const trails = [];
  let glowItem = null; // item revelado com brilho contínuo
  let glowT = 0;
  let cartDustT = 0;
  let crateDustT = 0;
  let lastCrate = null;
  let lastSwitchSound = -10;
  let lastPickupFx = -10;
  let lastRevealFx = -10;

  function resetFx() {
    queue.length = 0;
    trails.length = 0;
    glowItem = null;
    lastCrate = null;
    particles.clear?.();
    audio.stop?.('cartRoll');
    audio.stop?.('crateDrag');
    for (const ic of icons) { ic.age = ic.life = 0; ic.sp.visible = false; }
  }

  // ---------- utilidades de cena ----------
  /** Linha do portão da fase: FENCE.gate (fase 1) → GATE (fases novas) → payload. */
  function gateLine(x, z) {
    const lay = L();
    const fg = lay.FENCE?.gate;
    if (fg?.hinge && fg?.latchPost) {
      const gx = lay.FENCE.x ?? fg.hinge.x;
      return { a: { x: gx, z: fg.latchPost.z }, b: { x: gx, z: fg.hinge.z } };
    }
    const G = lay.GATE;
    if (G?.hinge && G?.latchPost) return { a: { ...G.latchPost }, b: { ...G.hinge } };
    return { a: { x, z: (z ?? 0) - 0.6 }, b: { x, z: (z ?? 0) + 0.6 } };
  }
  function itemObject(item) {
    const p = P();
    return p[item]?.object || p.item?.object || (item === 'carrot' ? p.carrot?.object : null) || null;
  }
  function gateSparkles(line, n = 6) {
    for (let i = 0; i < n; i++) {
      const k = i / Math.max(1, n - 1);
      particles.sparkle({ x: line.a.x + (line.b.x - line.a.x) * k + 0.05, y: 0.35 + Math.random() * 0.45, z: line.a.z + (line.b.z - line.a.z) * k }, { count: 2, radius: 0.08, size: 0.9 });
    }
  }

  function revealFx(x, z, item) {
    if (time - lastRevealFx < 0.2) return;
    lastRevealFx = time;
    sfx('reveal', x, z, { volume: 1.1 });
    particles.sparkle({ x, y: 0.25, z }, { count: 22, radius: 0.4, size: 1.1, rise: 1.3 });
    particles.ring({ x, y: 0, z }, { radius: 0.95, from: 0.15, life: 1.0, color: '#FFD98E', opacity: 0.75, width: 0.09 });
    later(0.35, () => particles.ring({ x, y: 0, z }, { radius: 0.65, from: 0.1, life: 0.8, color: '#FFF1D6', opacity: 0.45, width: 0.07 }));
    glowItem = { item, x, z };
    glowT = time + 0.6;
  }
  function pickupFx(x, z, item) {
    if (time - lastPickupFx < 0.2) return;
    lastPickupFx = time;
    glowItem = null;
    const snd = { ball: 'pickupBall', slipper: 'pickupSlipper', duck: 'pickupDuck', bear: 'pickupBear' }[item] || 'pickupCarrot';
    sfx(snd, x, z);
    const col = { ball: '#E6F27A', slipper: '#F9B8C9', duck: '#FFE066', bear: '#E8B98A' }[item] || '#FFB46E';
    particles.burst({ x, y: 0.35, z }, { kind: 'stars', count: 10, size: 0.85, speed: 0.8 });
    particles.ring({ x, y: 0, z }, { radius: 0.7, from: 0.1, life: 0.6, color: col, opacity: 0.55, width: 0.09 });
  }

  // ---------- assinaturas: estado e fase ----------
  events.on('game:state', ({ state: s }) => {
    const before = state;
    state = s;
    if (s === 'playing' && before !== 'paused') playingSince = time;
    if (s === 'paused') {
      audio.setMuffled?.(true);
      audio.play('pause');
    } else if (before === 'paused') {
      audio.setMuffled?.(false);
      if (s === 'playing') audio.play('resume');
    }
    if (s === 'title' || s === 'loading') resetFx();
  });
  events.on('game:reset', () => {
    resetFx();
    setTarget(null);
    stay.radhija = stay.rhaenyra = false;
  });
  events.on('level:loading', () => {
    resetFx();
    setTarget(null);
  });
  events.on('level:loaded', (info = {}) => {
    stay.radhija = stay.rhaenyra = false;
    // o ambiente vem no próprio evento (na carga inicial window.__game ainda não existe)
    const kind = info.ambience || window.__game?.game?.levelDef?.ambience || AMBIENCE_BY_NUMBER[info.number] || 'day';
    audio.setAmbience?.(kind);
    // vagalumes automáticos ao entardecer/noite (o cenário pode trocar ou desligar)
    const B = L().WORLD?.bounds;
    if (P().fireflies === false || !B || (kind !== 'dusk' && kind !== 'night')) particles.fireflies?.(null);
    else {
      particles.fireflies?.({
        x: (B.minX + B.maxX) / 2, z: (B.minZ + B.maxZ) / 2,
        radius: Math.min(B.maxX - B.minX, B.maxZ - B.minZ) * 0.55,
        count: kind === 'night' ? 16 : 7, y0: 0.3, y1: 1.6,
      });
    }
  });
  events.on('objective', ({ target }) => {
    mk.height = Number.isFinite(target?.y) ? target.y : 0.85;
    setTarget(target);
  });

  // ---------- dogs ----------
  events.on('dog:switch', ({ name }) => {
    if (!dogs[name]) return;
    const changed = name !== active;
    active = name;
    stay[name] = false; // quem vira ativa perde o "fica"
    if (changed) dogRings[name].pop = 1;
    if (state === 'playing' && time - playingSince > 0.4 && time - lastSwitchSound > 0.1) {
      lastSwitchSound = time;
      audio.play('switch', { name });
      const p = dogPos(name);
      if (p) particles.ring({ x: p.x, y: 0, z: p.z }, { radius: dogRings[name].r * 1.6, from: dogRings[name].r * 0.6, life: 0.5, color: '#FFF1D6', opacity: 0.6, width: 0.12 });
    }
  });
  events.on('dog:step', ({ name, x, z, speed = 0 }) => {
    if (speed < 0.4) return;
    sfx('step', x, z, { speed, volume: name === active ? 1 : 0.55 });
    if (speed > 1.5 && Math.random() < (speed > 3 ? 0.9 : 0.55)) {
      particles.dust({ x, y: 0.03, z }, { count: speed > 3 ? 2 : 1, size: name === 'rhaenyra' ? 0.85 : 0.7, alpha: 0.32, strength: 0.4 });
    }
  });
  events.on('dog:dash', ({ name, x, z, dirX = 0, dirZ = 0 }) => {
    sfx('dash', x, z);
    particles.dust({ x, y: 0.03, z }, { count: 5, size: 0.95, alpha: 0.45, dir: { x: -dirX, z: -dirZ }, strength: 0.8 });
    trails.push({ name, until: time + 0.32, next: time + 0.045 });
  });
  events.on('dog:pushStart', ({ name }) => {
    const p = dogPos(name);
    if (p) {
      sfx('pushStart', p.x, p.z);
      particles.dust({ x: p.x, y: 0.03, z: p.z }, { count: 4, size: 0.9, alpha: 0.42, strength: 0.6 });
    } else audio.play('pushStart');
  });
  events.on('dog:jump', ({ x, z, dirX = 0, dirZ = 0 }) => {
    sfx('jump', x, z);
    particles.dust({ x, y: 0.03, z }, { count: 4, size: 0.85, alpha: 0.38, dir: { x: -dirX, z: -dirZ }, strength: 0.6 });
  });
  events.on('dog:land', ({ x, z }) => {
    sfx('land', x, z);
    particles.dust({ x, y: 0.03, z }, { count: 5, size: 0.9, alpha: 0.4, strength: 0.55 });
  });
  // superbafo: mira, sopro (poeira verde), nuvem saindo de duto e a Rhaenyra fazendo "eca"
  events.on('bafo:aim', ({ x, z }) => sfx('bafoAim', x, z));
  events.on('dog:bafo', ({ x, z, dirX = 0, dirZ = 0 }) => {
    sfx('bafo', x, z);
    particles.dust({ x, y: 0.25, z }, { count: 7, size: 1.1, alpha: 0.5, color: '#A8E07A', dir: { x: dirX, z: dirZ }, strength: 1.1 });
  });
  events.on('scent:exit', ({ x, z }) => {
    sfx('scentPuff', x, z);
    particles.dust({ x, y: 0.3, z }, { count: 5, size: 1.0, alpha: 0.45, color: '#A8E07A', strength: 0.7 });
  });
  events.on('dog:yuck', ({ x, z }) => sfx('yuck', x, z));
  // pombo: y = altura de onde ele sai (padrão: poleiro); do chão, um voo curto (pigeonHop)
  events.on('pigeon:flee', ({ x, z, y = 1.3 }) => {
    sfx(y < 0.6 ? 'pigeonHop' : 'pigeonFlee', x, z);
    particles.feathers({ x, y, z }, { count: 6, size: 0.8 });
  });
  events.on('pigeon:land', ({ x, z }) => sfx('pigeonCoo', x, z));
  events.on('pigeon:shrug', ({ x, z }) => sfx('pigeonShrug', x, z));
  events.on('fan:aligned', ({ x, z }) => sfx('latch', x, z));
  // fase 5: trava do portãozinho e caixa de almofadas desmontando
  events.on('latch:start', ({ x, z }) => sfx('babyLatch', x, z));
  events.on('box:collapse', ({ x, z }) => {
    audio.stop?.('crateDrag');
    sfx('boxScuff', x, z);
    particles.dust({ x, y: 0.1, z }, { count: 8, size: 1.0, alpha: 0.4, strength: 0.8, spread: 0.4 });
    particles.burst({ x: x - 0.3, y: 0.3, z }, { kind: 'stars', count: 6, size: 0.7, speed: 0.6 });
  });
  // fase 6: o trenzinho que espirra. Fungada ao sentir o cheiro, "atchim" (spray para a janela e o tranco
  // de ré), vapor da chaminé no ritmo do trem, agulha mudando, bolinha descendo a canaleta, plim na bandeja
  // e apito ao voltar. Sons de uma vez só: nada fica tocando depois de pausa, reinício ou troca de fase.
  events.on('expresso:sneeze', ({ x, z }) => {
    sfx('trainSniff', x, z);
    particles.sparkle({ x, y: 0.62, z }, { count: 5, radius: 0.12, size: 0.6, rise: 0.4, color: '#CDEBA8' });
  });
  events.on('expresso:atchim', ({ x, y = 0.6, z, dirX = 0, dirZ = 1 }) => {
    sfx('trainSneeze', x, z);
    particles.dust({ x: x + dirX * 0.08, y, z: z + dirZ * 0.08 }, { count: 10, size: 1.05, alpha: 0.55, color: '#F7F3EA', dir: { x: dirX, z: dirZ }, strength: 1.2, spread: 0.08 });
    particles.splash({ x, y, z }, { count: 8, size: 0.6, strength: 0.5, mist: 4, dir: { x: dirX * 0.8, z: dirZ * 0.8 } });
    particles.burst({ x, y: y + 0.1, z }, { kind: 'stars', count: 6, size: 0.65, speed: 0.6 });
  });
  events.on('expresso:chuff', ({ x, y = 0.95, z }) => {
    sfx('trainChuff', x, z);
    particles.dust({ x, y, z }, { count: 2, size: 0.8, alpha: 0.42, color: '#FBF7EE', strength: 0.5, spread: 0.03 });
  });
  events.on('expresso:route', ({ x, z, signX, signZ }) => {
    const sx = Number.isFinite(signX) ? signX : x;
    const sz = Number.isFinite(signZ) ? signZ : z;
    later(0.12, () => {
      sfx('railSwitch', sx, sz);
      particles.sparkle({ x: sx, y: 1.12, z: sz }, { count: 8, radius: 0.18, size: 0.8, rise: 0.5 });
    });
  });
  events.on('expresso:unload', ({ x, z }) => sfx('ballRoll', x, z));
  events.on('expresso:delivery', ({ x, z }) => {
    sfx('trayDing', x, z);
    particles.sparkle({ x, y: 0.25, z }, { count: 14, radius: 0.3, size: 0.9, rise: 1.0 });
    particles.ring({ x, y: 0, z }, { radius: 0.75, from: 0.15, life: 0.8, color: '#FFE09A', opacity: 0.6, width: 0.09 });
  });
  events.on('expresso:return', ({ x, z }) => {
    sfx('toyWhistle', x, z);
    particles.ring({ x, y: 0.16, z }, { radius: 0.8, from: 0.2, life: 0.7, color: '#FFF1D6', opacity: 0.45, width: 0.08 });
  });
  // cancela fechada: dois apitos e o "!" sobre o trem; cancela mexendo: catraca
  events.on('expresso:blocked', ({ x, z }) => {
    sfx('toyWhistle', x, z);
    later(0.32, () => sfx('toyWhistle', x, z, { volume: 0.9 }));
    popIcon('alert', { at: { x, y: 1.1, z }, life: 1.4, size: 0.24 });
  });
  events.on('expresso:barrier', ({ x, z }) => sfx('barrierMove', x, z));
  // pórtico da lua: a portinhola abre e a lua cai no vagão
  events.on('expresso:fetch', ({ x, y = 0.85, z }) => {
    sfx('hopperDrop', x, z);
    particles.sparkle({ x, y, z }, { count: 8, radius: 0.15, size: 0.8, rise: 0.5 });
  });
  events.on('expresso:loaded', ({ x, z }) => {
    sfx('trayDing', x, z, { volume: 0.8 });
    particles.sparkle({ x, y: 0.6, z }, { count: 10, radius: 0.2, size: 0.85, rise: 0.8 });
  });
  // foguete: cada carga encaixa com brilho; com as duas, decola com fumaça e confete
  events.on('expresso:dock', ({ x, z }) => {
    sfx('trayDing', x, z);
    particles.sparkle({ x, y: 0.35, z }, { count: 16, radius: 0.3, size: 0.95, rise: 1.0 });
    particles.ring({ x, y: 0, z }, { radius: 0.7, from: 0.15, life: 0.7, color: '#FFE09A', opacity: 0.55, width: 0.09 });
  });
  events.on('expresso:launch', ({ x, z }) => {
    later(0.2, () => sfx('rocketLaunch', x, z));
    for (const at of [0.3, 0.7, 1.1, 1.5]) {
      later(at, () => particles.dust({ x, y: 0.08, z }, { count: 9, size: 1.3, alpha: 0.5, color: '#F4EFE6', strength: 1.1, spread: 0.2 }));
    }
    later(0.9, () => particles.sparks({ x, y: 0.15, z }, { count: 16, size: 1.1, speed: 0.9 }));
  });
  events.on('dog:bump', ({ x, z, strength = 0.7 }) => {
    sfx('bump', x, z, { strength });
    particles.dust({ x, y: 0.05, z }, { count: 3, size: 0.7, alpha: 0.35, strength: 0.5 });
  });
  events.on('dog:bark', ({ name, x, z }) => sfx(`bark-${name}`, x, z));

  events.on('companion:stay', ({ name, stay: on, x, z }) => {
    if (!dogs[name]) return;
    stay[name] = !!on;
    const p = dogPos(name);
    const px = Number.isFinite(x) ? x : p?.x;
    const pz = Number.isFinite(z) ? z : p?.z;
    if (on) {
      sfx('stay', px, pz, { name });
      popIcon('paw', { follow: name, life: 1.4, size: 0.22 });
      stayRings[name].pop = 1;
      if (Number.isFinite(px)) particles.ring({ x: px, y: 0, z: pz }, { radius: 0.55, from: 0.15, life: 0.55, color: '#FFD49A', opacity: 0.55, width: 0.1 });
    } else {
      sfx('come', px, pz, { name });
      if (Number.isFinite(px)) {
        particles.dust({ x: px, y: 0.03, z: pz }, { count: 3, size: 0.75, alpha: 0.35, strength: 0.5 });
        const h = headPos(name, tmp);
        if (h) particles.burst({ x: h.x, y: h.y, z: h.z }, { kind: 'hearts', count: 2, size: 0.7 });
      }
    }
  });

  // ---------- fase 1 (mantidos) ----------
  events.on('cart:move', ({ x, z, speed = 0.85 }) => {
    audio.play('cartRoll', { speed });
    const CH = L().CART?.halfSize || { x: 0.575, z: 0.31 };
    if (Math.abs(speed) > 0.15 && time > cartDustT) {
      cartDustT = time + 0.13;
      const back = Math.sign(speed || 1) * -1;
      const bx = x + back * (CH.x + 0.04);
      for (const s of [-1, 1]) {
        if (Math.random() < 0.7) particles.dust({ x: bx, y: 0.03, z: z + s * (CH.z - 0.05) }, { count: 1, size: 0.75, alpha: 0.38, dir: { x: back * 0.5, z: 0 }, strength: 0.45 });
      }
    }
  });
  events.on('rope:tug', ({ x, z }) => {
    sfx('tug', x, z);
    const a = L().ROPE?.anchor;
    particles.sparkle({ x: a?.x ?? x, y: (a?.y ?? 0.8) - 0.15, z: a?.z ?? z }, { count: 4, radius: 0.12, size: 0.7, rise: 0.4 });
  });
  events.on('gate:open', ({ x, z }) => {
    const ln = gateLine(x, z);
    const cx = (ln.a.x + ln.b.x) / 2;
    const cz = (ln.a.z + ln.b.z) / 2;
    sfx('latch', ln.a.x, ln.a.z);
    later(0.14, () => sfx('gateCreak', cx, cz));
    later(0.1, () => {
      particles.ring({ x: cx, y: 0, z: cz }, { radius: 1.15, from: 0.2, life: 0.9, color: '#FFE3A6', opacity: 0.7, width: 0.09 });
      gateSparkles(ln);
    });
    later(0.45, () => particles.ring({ x: cx, y: 0, z: cz }, { radius: 0.85, from: 0.15, life: 0.7, color: '#FFF1D6', opacity: 0.4, width: 0.07 }));
  });
  events.on('carrot:revealed', ({ x, z }) => {
    const C = L().CARROT || { x: 4.4, z: -4 };
    revealFx(x ?? C.x, z ?? C.z, 'carrot');
  });
  events.on('carrot:pickup', ({ x, z }) => pickupFx(x, z, 'carrot'));

  // ---------- itens genéricos ----------
  events.on('item:revealed', ({ item, x, z }) => revealFx(x, z, item));
  events.on('item:pickup', ({ item, x, z }) => pickupFx(x, z, item));
  events.on('collectible:pickup', ({ x, z, count = 1, total = 3 }) => {
    sfx('collect', x, z, { count, total });
    particles.sparkle({ x, y: 0.15, z }, { count: 12, radius: 0.22, size: 0.9, rise: 1.1 });
    particles.ring({ x, y: 0, z }, { radius: 0.62, from: 0.08, life: 0.65, color: '#FFE09A', opacity: 0.65, width: 0.1 });
  });

  // ---------- mecânicas novas ----------
  events.on('plate:press', ({ x, z }) => {
    sfx('plateDown', x, z);
    particles.dust({ x, y: 0.03, z }, { count: 4, size: 0.8, alpha: 0.35, strength: 0.5, spread: 0.3 });
    particles.ring({ x, y: 0, z }, { radius: 0.62, from: 0.2, life: 0.5, color: '#FFE3A6', opacity: 0.5, width: 0.09 });
  });
  events.on('plate:release', ({ x, z }) => {
    sfx('plateUp', x, z);
  });
  events.on('gate:close', ({ x, z }) => {
    const ln = gateLine(x, z);
    sfx('gateClose', (ln.a.x + ln.b.x) / 2, (ln.a.z + ln.b.z) / 2);
    later(0.32, () => particles.dust({ x: ln.a.x, y: 0.05, z: ln.a.z }, { count: 3, size: 0.7, alpha: 0.32, strength: 0.4 }));
  });
  events.on('gate:locked', ({ x, z }) => {
    const ln = gateLine(x, z);
    const cx = (ln.a.x + ln.b.x) / 2;
    const cz = (ln.a.z + ln.b.z) / 2;
    later(0.05, () => {
      sfx('gateLocked', cx, cz);
      particles.ring({ x: cx, y: 0, z: cz }, { radius: 1.0, from: 0.2, life: 0.8, color: '#FFE3A6', opacity: 0.65, width: 0.09 });
      gateSparkles(ln, 5);
    });
  });
  events.on('wedge:kick', ({ x, z, locked }) => {
    sfx('wedgeKick', x, z, { locked: !!locked });
    particles.dust({ x, y: 0.03, z }, { count: 5, size: 0.8, alpha: 0.4, strength: 0.7 });
    if (locked) {
      later(0.22, () => {
        particles.sparkle({ x, y: 0.2, z }, { count: 10, radius: 0.2, size: 0.85, rise: 0.9 });
        particles.ring({ x, y: 0, z }, { radius: 0.55, from: 0.1, life: 0.55, color: '#FFE09A', opacity: 0.6, width: 0.1 });
      });
    }
  });
  events.on('sprinkler:hit', ({ name, x, z }) => {
    const p0 = dogPos(name);
    const px = Number.isFinite(x) ? x : p0?.x;
    const pz = Number.isFinite(z) ? z : p0?.z;
    if (!Number.isFinite(px)) return;
    sfx('splash', px, pz);
    particles.splash({ x: px, y: 0.35, z: pz }, { count: 12, size: 0.9, strength: 0.7, mist: 5 });
    // o chacoalhar (a dog faz 'shake' ~0,9 s)
    later(0.42, () => {
      const p = dogPos(name);
      if (!p) return;
      sfx('shake', p.x, p.z);
      const h = name === 'rhaenyra' ? 0.42 : 0.32;
      particles.drops({ x: p.x, y: h, z: p.z }, { count: 12, radius: 0.15, speed: 0.9 });
      later(0.22, () => { const q = dogPos(name); if (q) particles.drops({ x: q.x, y: h, z: q.z }, { count: 10, radius: 0.15, speed: 0.8 }); });
      later(0.45, () => { const q = dogPos(name); if (q) particles.drops({ x: q.x, y: h, z: q.z }, { count: 6, radius: 0.15, speed: 0.6 }); });
    });
  });
  events.on('sprinkler:off', ({ x, z }) => {
    sfx('waterOff', x, z);
    particles.splash({ x, y: 0.1, z }, { count: 6, size: 0.8, strength: 0.4, mist: 8, mistAlpha: 0.38 });
    later(0.55, () => {
      particles.sparkle({ x, y: 0.3, z }, { count: 14, radius: 0.5, size: 1, rise: 1.0 });
      particles.ring({ x, y: 0, z }, { radius: 1.4, from: 0.3, life: 1.0, color: WATER_RING, opacity: 0.55, width: 0.07 });
    });
  });
  events.on('valve:turn', ({ x, z }) => {
    sfx('valve', x, z);
    const y = L().VALVE?.y ?? 0.55;
    particles.sparkle({ x, y, z: z + 0.1 }, { count: 5, radius: 0.12, size: 0.7, rise: 0.4 });
  });
  events.on('crate:move', ({ x, z, speed = 0.7 }) => {
    audio.play('crateDrag', { speed });
    let dx = 0;
    let dz = 0;
    if (lastCrate) {
      dx = x - lastCrate.x;
      dz = z - lastCrate.z;
      const m = Math.hypot(dx, dz);
      if (m > 1e-5) { dx /= m; dz /= m; } else { dx = dz = 0; }
    }
    lastCrate = { x, z };
    if (Math.abs(speed) > 0.12 && time > crateDustT && (dx || dz)) {
      crateDustT = time + 0.12;
      const h = L().CRATE?.half ?? 0.36;
      const bx = x - dx * (h + 0.04);
      const bz = z - dz * (h + 0.04);
      for (const s of [-1, 1]) {
        if (Math.random() < 0.75) particles.dust({ x: bx + dz * s * (h - 0.06), y: 0.03, z: bz - dx * s * (h - 0.06) }, { count: 1, size: 0.85, alpha: 0.4, dir: { x: -dx * 0.5, z: -dz * 0.5 }, strength: 0.5 });
      }
    }
  });
  events.on('crate:sink', ({ x, z }) => {
    audio.stop?.('crateDrag');
    lastCrate = null;
    later(0.18, () => {
      sfx('crateSink', x, z, { volume: 1.1 });
      particles.splash({ x, y: 0.05, z }, { count: 30, size: 1.15, strength: 1.25, mist: 12, mistAlpha: 0.4 });
      particles.ring({ x, y: 0, z }, { radius: 0.95, from: 0.3, life: 0.9, color: WATER_RING, opacity: 0.42, width: 0.08 });
    });
    later(0.5, () => particles.ring({ x, y: 0, z }, { radius: 0.7, from: 0.2, life: 0.8, color: '#FFFFFF', opacity: 0.22, width: 0.06 }));
    later(0.95, () => {
      particles.sparkle({ x, y: 0.25, z }, { count: 16, radius: 0.45, size: 1, rise: 1.1 });
    });
  });
  events.on('lantern:on', ({ id, x, z, y }) => {
    const ly = Number.isFinite(y) ? y : (L().LANTERNS?.[id]?.y ?? 1.1);
    sfx('lanternOn', x, z);
    particles.sparks({ x, y: ly, z }, { count: 14, size: 1, speed: 0.8 });
    particles.sparkle({ x, y: ly - 0.05, z }, { count: 6, radius: 0.15, size: 0.9, rise: 0.6, color: '#FFD9A0' });
    particles.ring({ x, y: 0, z }, { radius: 0.9, from: 0.15, life: 0.8, color: '#FFC46E', opacity: 0.5, width: 0.08 });
  });
  events.on('lantern:off', ({ id, x, z, y }) => {
    const ly = Number.isFinite(y) ? y : (L().LANTERNS?.[id]?.y ?? 1.1);
    sfx('lanternOff', x, z);
    particles.sparks({ x, y: ly, z }, { count: 4, size: 0.7, speed: 0.4, rise: 0.5 });
  });

  // ---------- Dona Gansa ----------
  const gooseHead = (x, z) => ({ x, y: 0.62, z });
  events.on('goose:alert', ({ x, z }) => {
    sfx('gooseAlert', x, z);
    popIcon('alert', { at: gooseHead(x, z), life: 1.1, size: 0.22 });
  });
  events.on('goose:honk', ({ x, z }) => sfx('honk', x, z));
  events.on('goose:charge', ({ x, z }) => {
    sfx('gooseCharge', x, z);
    popIcon('alert', { at: gooseHead(x, z), life: 0.9, size: 0.24 });
    particles.dust({ x, y: 0.03, z }, { count: 5, size: 0.8, alpha: 0.4, strength: 0.7 });
  });
  events.on('goose:hit', ({ x, z }) => {
    sfx('gooseHit', x, z);
    particles.feathers({ x, y: 0.4, z }, { count: 9, size: 1 });
    particles.burst({ x, y: 0.45, z }, { kind: 'stars', count: 6, size: 0.7, speed: 0.6 });
    particles.dust({ x, y: 0.04, z }, { count: 4, size: 0.85, alpha: 0.42, strength: 0.7 });
  });
  events.on('goose:lured', ({ x, z }) => {
    sfx('gooseLured', x, z);
    popIcon('curious', { at: gooseHead(x, z), life: 1.5, size: 0.22 });
  });
  events.on('goose:return', ({ x, z }) => sfx('gooseReturn', x, z));

  // ---------- comemoração e vitória ----------
  events.on('celebrate:start', ({ x, z }) => {
    audio.play('celebrate');
    const G = L().GOAL;
    const cx = x ?? G?.x ?? 0;
    const cz = z ?? G?.z ?? 0;
    const heartsOn = (n, s = 1) => {
      for (const name of Object.keys(dogs)) {
        const p = dogPos(name);
        if (p) particles.burst({ x: p.x, y: 0.6, z: p.z }, { kind: 'hearts', count: n, size: s });
      }
    };
    heartsOn(5);
    particles.burst({ x: cx, y: 0.25, z: cz }, { kind: 'confetti', count: 46 });
    particles.ring({ x: cx, y: 0, z: cz }, { radius: 1.3, from: 0.2, life: 1.0, color: '#FFE3A6', opacity: 0.5, width: 0.07 });
    later(0.7, () => heartsOn(3, 0.9));
    later(1.2, () => particles.burst({ x: cx + 0.2, y: 0.25, z: cz }, { kind: 'confetti', count: 28 }));
    later(1.6, () => heartsOn(3, 0.85));
  });
  events.on('victory', () => audio.play('victory'));

  // ---------- quadro a quadro ----------
  function update(dt, t) {
    time = t ?? time + dt;

    // espelha estado/dog ativa/fica do jogo (robustez a eventos perdidos)
    const gm = window.__game?.game;
    if (gm) {
      if (typeof gm.state === 'string' && gm.state !== state) {
        if (gm.state === 'playing' && state !== 'paused') playingSince = time;
        state = gm.state;
      }
      if (gm.activeDog && gm.activeDog !== active && dogs[gm.activeDog]) {
        active = gm.activeDog;
        dogRings[active].pop = 1;
      }
      const gs = gm.stay;
      if (gs) for (const n of Object.keys(stay)) stay[n] = !!gs[n];
    }
    audio.update?.(dt);

    // ações adiadas (congeladas na pausa)
    if (state !== 'paused') {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (time >= queue[i].at) {
          const { fn } = queue[i];
          queue.splice(i, 1);
          fn();
        }
      }
    } else {
      for (const q of queue) q.at += dt;
    }

    // rastro do dash
    for (let i = trails.length - 1; i >= 0; i--) {
      const tr = trails[i];
      if (time > tr.until) { trails.splice(i, 1); continue; }
      if (time >= tr.next) {
        tr.next = time + 0.045;
        const p = dogPos(tr.name);
        if (p) particles.dust({ x: p.x, y: 0.03, z: p.z }, { count: 1, size: 0.8, alpha: 0.38, strength: 0.35 });
      }
    }

    // brilho contínuo e discreto no item revelado (lido na hora: segue o objeto se ele se mover)
    if (glowItem && state === 'playing' && time > glowT) {
      glowT = time + 0.38;
      const o = itemObject(glowItem.item);
      if (o) o.getWorldPosition(tmp);
      else tmp.set(glowItem.x, 0.15, glowItem.z);
      particles.sparkle({ x: tmp.x, y: Math.max(0.12, tmp.y) + 0.05, z: tmp.z }, { count: 1, radius: 0.28, size: 0.75, rise: 0.6, alpha: 0.8 });
    }

    const showWorldUi = state === 'playing' || state === 'paused';

    // marcador de objetivo
    const ap = dogPos(active);
    let want = showWorldUi && !!mk.target;
    if (want && ap) {
      const d = Math.hypot(ap.x - mk.target.x, ap.z - mk.target.z);
      const hide = mk.vis > 0.5 ? d < 1.2 : d < 1.45; // histerese
      if (hide) want = false;
    }
    mk.vis = damp(mk.vis, want ? 1 : 0, want ? 5 : 9, dt);
    marker.visible = mk.vis > 0.01;
    if (marker.visible) {
      if (mk.target) marker.position.set(mk.target.x, 0, mk.target.z);
      mk.pop = Math.min(1, mk.pop + dt * 2.2);
      const e = mk.pop;
      const pop = 1 + Math.sin(e * Math.PI) * 0.35 * (1 - e);
      const bob = Math.sin(time * 2.1) * 0.05;
      dropPivot.position.y = mk.height + bob + (1 - mk.vis) * 0.25;
      drop.rotation.y = time * 0.9;
      dropPivot.scale.setScalar(Math.max(0.001, mk.vis * pop));
      dropMat.opacity = mk.vis;
      gloss.material.opacity = 0.85 * mk.vis;
      const breathe = 1 + Math.sin(time * 2.1) * 0.04;
      groundRing.scale.setScalar(0.62 * breathe);
      groundMat.uniforms.uOpacity.value = 0.4 * mk.vis;
      const pt = (time % 1.8) / 1.8;
      pingRing.scale.setScalar(0.4 + pt * 0.75);
      pingMat.uniforms.uOpacity.value = 0.35 * mk.vis * Math.pow(1 - pt, 2) * Math.min(1, pt * 8);
    }

    // anéis das dogs + anel tracejado da companheira esperando
    for (const [name, r] of Object.entries(dogRings)) {
      const p = dogPos(name);
      const on = showWorldUi && name === active && !!p;
      r.a = damp(r.a, on ? 1 : 0, on ? 6 : 10, dt);
      r.s = damp(r.s, on ? 1 : 0.6, 8, dt);
      r.pop = Math.max(0, r.pop - dt * 2.5);
      r.mesh.visible = r.a > 0.01;
      if (r.mesh.visible && p) {
        r.mesh.position.set(p.x, 0.018, p.z);
        const pulse = 1 + Math.sin(r.pop * Math.PI) * 0.22;
        r.mesh.scale.setScalar(r.r * 2 * r.s * pulse);
        r.mat.uniforms.uOpacity.value = 0.55 * r.a;
      }
      const sr = stayRings[name];
      const son = showWorldUi && name !== active && stay[name] && !!p;
      sr.a = damp(sr.a, son ? 1 : 0, son ? 5 : 9, dt);
      sr.pop = Math.max(0, sr.pop - dt * 2.2);
      sr.mesh.visible = sr.a > 0.01;
      if (sr.mesh.visible && p) {
        sr.mesh.position.set(p.x, 0.016, p.z);
        const pulse = 1 + Math.sin(sr.pop * Math.PI) * 0.3;
        sr.mesh.scale.setScalar(sr.r * 2 * pulse * (0.96 + Math.sin(time * 2.4) * 0.04));
        sr.mat.uniforms.uOpacity.value = 0.5 * sr.a;
        sr.mat.uniforms.uTime.value = time * 0.6;
      }
    }

    // ícones flutuantes
    for (const ic of icons) {
      if (!ic.sp.visible) continue;
      ic.age += state === 'paused' ? 0 : dt;
      const k = ic.age / ic.life;
      if (k >= 1) { ic.sp.visible = false; ic.follow = null; continue; }
      if (ic.follow) {
        const h = headPos(ic.follow, tmp);
        if (h) { ic.x = h.x; ic.y = h.y + 0.08; ic.z = h.z; }
      }
      const pop = k < 0.18 ? 1 + Math.sin((k / 0.18) * Math.PI) * 0.25 : 1;
      const grow = Math.min(1, k / 0.12);
      const fade = 1 - clamp((k - 0.75) / 0.25, 0, 1);
      ic.sp.position.set(ic.x, ic.y + k * 0.12 + Math.sin(ic.age * 5) * 0.012, ic.z);
      ic.sp.scale.setScalar(ic.size * grow * pop);
      ic.mat.opacity = fade;
    }
  }

  return { update, marker, dogRings, stayRings, popIcon };
}
