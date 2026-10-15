// Partículas leves (THREE.Points com shader próprio + anéis no chão).
// API do contrato: createParticles(engine) → { dust, sparkle, burst, ring, update }
// v2: splash (respingos + névoa), drops (gotas), feathers (penas), sparks (faíscas quentes),
//     fireflies(opts|null) → efeito ambiente de vagalumes (um por vez; o cenário pode chamar).
// Extras: clear(), count(). Exporta createRingMaterial() para o feedback.
// Pool fixo (~650 pontos + 12 anéis), sem alocações por quadro.
import * as THREE from 'three';

const TILE = { puff: 0, sparkle: 1, heart: 2, confetti: 3, star: 4, dot: 5, feather: 6, drop: 7 };
const MODE = { dust: 0, sparkle: 1, confetti: 2, heart: 3, star: 4, water: 5, mist: 6, feather: 7, spark: 8, firefly: 9 };
const COLS = 4;

// ---------------------------------------------------------------------------
//  Atlas gerado em canvas (4 × 2 células de 128 px, máscaras brancas)
// ---------------------------------------------------------------------------
function makeAtlas() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = S * COLS;
  cv.height = S * 2;
  const g = cv.getContext('2d');
  const at = (tile, fn) => {
    const col = tile % COLS;
    const row = Math.floor(tile / COLS);
    g.save();
    // flipY da textura: linha 0 do atlas (uv baixo) fica na metade de baixo do canvas
    g.translate(col * S + S / 2, (1 - row) * S + S / 2);
    fn(g);
    g.restore();
  };
  const starPath = (g, n, rOut, rIn) => {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? rIn : rOut;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
  };

  // baforada: blob macio com "caroços"
  at(TILE.puff, (g) => {
    const blob = (x, y, r, a) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(0.55, `rgba(255,255,255,${a * 0.55})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    };
    blob(0, 0, 54, 0.75);
    blob(-16, -10, 30, 0.35);
    blob(18, -6, 28, 0.3);
    blob(4, 16, 30, 0.3);
  });
  // brilho de 4 pontas com halo
  at(TILE.sparkle, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 46);
    gr.addColorStop(0, 'rgba(255,255,255,0.75)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.18)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 46, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    starPath(g, 4, 54, 8);
    g.fill();
  });
  // coração
  at(TILE.heart, (g) => {
    g.fillStyle = '#fff';
    g.shadowColor = 'rgba(255,255,255,0.8)';
    g.shadowBlur = 4;
    g.beginPath();
    g.moveTo(0, 40);
    g.bezierCurveTo(-8, 30, -50, 8, -46, -20);
    g.bezierCurveTo(-42, -46, -10, -48, 0, -22);
    g.bezierCurveTo(10, -48, 42, -46, 46, -20);
    g.bezierCurveTo(50, 8, 8, 30, 0, 40);
    g.fill();
  });
  // confete (retângulo arredondado)
  at(TILE.confetti, (g) => {
    g.fillStyle = '#fff';
    const w = 46, h = 80, r = 10;
    g.beginPath();
    g.roundRect(-w / 2, -h / 2, w, h, r);
    g.fill();
  });
  // estrela de 5 pontas arredondada
  at(TILE.star, (g) => {
    g.fillStyle = '#fff';
    g.strokeStyle = '#fff';
    g.lineJoin = 'round';
    g.lineWidth = 10;
    starPath(g, 5, 46, 20);
    g.fill();
    g.stroke();
  });
  // ponto suave
  at(TILE.dot, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.8)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 30, 0, Math.PI * 2);
    g.fill();
  });

  // pena: haste curva + palheta macia
  at(TILE.feather, (g) => {
    g.rotate(-0.5);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, -56);
    g.bezierCurveTo(26, -40, 30, 10, 6, 46);
    g.lineTo(0, 54);
    g.lineTo(-6, 46);
    g.bezierCurveTo(-30, 10, -24, -40, 0, -56);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const y = -30 + i * 12;
      g.beginPath(); g.moveTo(0, y); g.lineTo(22, y - 10); g.stroke();
      g.beginPath(); g.moveTo(0, y + 4); g.lineTo(-22, y - 6); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, -50); g.quadraticCurveTo(3, 0, 0, 60); g.stroke();
  });
  // gota: ponta para cima, com brilho
  at(TILE.drop, (g) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, -50);
    g.bezierCurveTo(10, -26, 34, 0, 34, 20);
    g.arc(0, 20, 34, 0, Math.PI, false);
    g.bezierCurveTo(-34, 0, -10, -26, 0, -50);
    g.fill();
  });

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aRot;
  attribute float aTile;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vRot;
  varying float vTile;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aAlpha <= 0.001 ? 0.0 : aSize * uScale / max(0.05, -mv.z);
    vAlpha = aAlpha;
    vColor = aColor;
    vRot = aRot;
    vTile = aTile;
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uTex;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vRot;
  varying float vTile;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    p.y = -p.y;
    float c = cos(vRot), s = sin(vRot);
    p = mat2(c, s, -s, c) * p;
    p += 0.5;
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) discard;
    float tx = mod(vTile, 4.0);
    float ty = floor(vTile / 4.0 + 0.001);
    vec2 uv = (p + vec2(tx, ty)) / vec2(4.0, 2.0);
    vec4 tex = texture2D(uTex, uv);
    float a = tex.a * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * tex.rgb, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function makeSystem(N, blending, atlas) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const alpha = new Float32Array(N);
  const rot = new Float32Array(N);
  const tile = new Float32Array(N);
  const attr = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr(pos, 3));
  geo.setAttribute('aColor', attr(col, 3));
  geo.setAttribute('aSize', attr(size, 1));
  geo.setAttribute('aAlpha', attr(alpha, 1));
  geo.setAttribute('aRot', attr(rot, 1));
  geo.setAttribute('aTile', attr(tile, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: atlas }, uScale: { value: 800 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 20;
  return {
    N, geo, mat, points, pos, col, size, alpha, rot, tile,
    vel: new Float32Array(N * 3),
    age: new Float32Array(N),
    life: new Float32Array(N), // 0 = livre
    s0: new Float32Array(N),
    s1: new Float32Array(N),
    a0: new Float32Array(N),
    rotV: new Float32Array(N),
    drag: new Float32Array(N),
    grav: new Float32Array(N),
    phase: new Float32Array(N),
    mode: new Uint8Array(N),
    cursor: 0,
    alive: 0,
    fireflies: 0,
  };
}

function alloc(sys) {
  const { N, life } = sys;
  for (let k = 0; k < N; k++) {
    const i = (sys.cursor + k) % N;
    if (life[i] <= 0) {
      sys.cursor = (i + 1) % N;
      return i;
    }
  }
  // pool cheio: recicla a mais antiga a partir do cursor
  const i = sys.cursor;
  sys.cursor = (i + 1) % N;
  return i;
}

const _c = new THREE.Color();
function spawn(sys, o) {
  const i = alloc(sys);
  const i3 = i * 3;
  sys.pos[i3] = o.x; sys.pos[i3 + 1] = o.y; sys.pos[i3 + 2] = o.z;
  sys.vel[i3] = o.vx || 0; sys.vel[i3 + 1] = o.vy || 0; sys.vel[i3 + 2] = o.vz || 0;
  _c.set(o.color);
  const k = o.boost ?? 1;
  sys.col[i3] = _c.r * k; sys.col[i3 + 1] = _c.g * k; sys.col[i3 + 2] = _c.b * k;
  sys.age[i] = 0;
  sys.life[i] = o.life;
  sys.s0[i] = o.s0;
  sys.s1[i] = o.s1 ?? o.s0;
  sys.a0[i] = o.alpha ?? 1;
  sys.rot[i] = o.rot ?? Math.random() * Math.PI * 2;
  sys.rotV[i] = o.rotV ?? 0;
  sys.drag[i] = o.drag ?? 2;
  sys.grav[i] = o.grav ?? 0;
  sys.phase[i] = Math.random() * Math.PI * 2;
  sys.mode[i] = o.mode;
  sys.tile[i] = o.tile;
  sys.size[i] = o.s0;
  sys.alpha[i] = 0;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function step(sys, dt) {
  const { N, pos, vel, age, life, s0, s1, a0, rot, rotV, drag, grav, phase, mode, size, alpha } = sys;
  let alive = 0;
  sys.fireflies = 0;
  for (let i = 0; i < N; i++) {
    if (life[i] <= 0) {
      if (alpha[i] !== 0) alpha[i] = 0;
      continue;
    }
    age[i] += dt;
    const t = age[i] / life[i];
    if (t >= 1) {
      life[i] = 0;
      alpha[i] = 0;
      continue;
    }
    alive++;
    const i3 = i * 3;
    const damp = Math.exp(-drag[i] * dt);
    vel[i3] *= damp;
    vel[i3 + 1] = vel[i3 + 1] * damp - grav[i] * dt;
    vel[i3 + 2] *= damp;
    pos[i3] += vel[i3] * dt;
    pos[i3 + 1] += vel[i3 + 1] * dt;
    pos[i3 + 2] += vel[i3 + 2] * dt;
    rot[i] += rotV[i] * dt;
    const m = mode[i];
    let a = a0[i];
    let sz;
    if (m === MODE.dust) {
      sz = s0[i] + (s1[i] - s0[i]) * (1 - (1 - t) * (1 - t));
      a *= smooth(0, 0.12, t) * Math.pow(1 - t, 1.5);
    } else if (m === MODE.sparkle) {
      sz = s0[i] * (0.4 + 0.6 * smooth(0, 0.18, t)) * (1 - 0.5 * t);
      a *= smooth(0, 0.1, t) * (1 - smooth(0.55, 1, t)) * (0.65 + 0.35 * Math.sin(age[i] * 22 + phase[i]));
    } else if (m === MODE.confetti) {
      // flutua de lado e assenta no chão
      pos[i3] += Math.sin(age[i] * 6 + phase[i]) * 0.35 * dt;
      if (pos[i3 + 1] < 0.03) {
        pos[i3 + 1] = 0.03;
        vel[i3 + 1] = 0;
        vel[i3] *= 0.6; vel[i3 + 2] *= 0.6;
        rotV[i] *= 0.85;
      }
      sz = s0[i] * (0.85 + 0.15 * Math.abs(Math.sin(age[i] * 9 + phase[i])));
      a *= smooth(0, 0.05, t) * (1 - smooth(0.75, 1, t));
    } else if (m === MODE.heart) {
      pos[i3] += Math.sin(age[i] * 3.2 + phase[i]) * 0.22 * dt;
      const pop = t < 0.15 ? 0.3 + 0.9 * smooth(0, 0.15, t) : 1.2 - 0.2 * smooth(0.15, 0.3, t);
      sz = s0[i] * pop;
      a *= smooth(0, 0.08, t) * (1 - smooth(0.6, 1, t));
      rot[i] = Math.sin(age[i] * 2.4 + phase[i]) * 0.25;
    } else if (m === MODE.water) {
      // gota: cai e some ao tocar o chão
      if (pos[i3 + 1] < 0.02) { life[i] = 0; alpha[i] = 0; continue; }
      sz = s0[i] * (1 - 0.3 * t);
      a *= smooth(0, 0.05, t) * (1 - smooth(0.7, 1, t));
    } else if (m === MODE.mist) {
      sz = s0[i] + (s1[i] - s0[i]) * (1 - (1 - t) * (1 - t));
      a *= smooth(0, 0.15, t) * Math.pow(1 - t, 1.8);
    } else if (m === MODE.feather) {
      // pena: balança de lado e assenta no chão
      const sw = Math.sin(age[i] * 3.1 + phase[i]);
      pos[i3] += sw * 0.45 * dt;
      pos[i3 + 2] += Math.cos(age[i] * 2.3 + phase[i]) * 0.25 * dt;
      rot[i] = phase[i] + sw * 0.9;
      if (pos[i3 + 1] < 0.025) {
        pos[i3 + 1] = 0.025;
        vel[i3] = vel[i3 + 1] = vel[i3 + 2] = 0;
      }
      sz = s0[i];
      a *= smooth(0, 0.05, t) * (1 - smooth(0.8, 1, t));
    } else if (m === MODE.spark) {
      sz = s0[i] * (1 - 0.6 * t);
      a *= smooth(0, 0.05, t) * (1 - smooth(0.4, 1, t)) * (0.6 + 0.4 * Math.sin(age[i] * 31 + phase[i]));
    } else if (m === MODE.firefly) {
      // vagalume: passeia devagar e pisca
      vel[i3] += Math.sin(age[i] * 1.3 + phase[i]) * 0.35 * dt;
      vel[i3 + 1] += Math.cos(age[i] * 0.9 + phase[i] * 1.7) * 0.12 * dt;
      vel[i3 + 2] += Math.cos(age[i] * 1.1 + phase[i]) * 0.35 * dt;
      const blink = Math.pow(0.5 + 0.5 * Math.sin(age[i] * 2.1 + phase[i] * 3.0), 3);
      sz = s0[i] * (0.75 + 0.25 * blink);
      a *= smooth(0, 0.12, t) * (1 - smooth(0.85, 1, t)) * (0.12 + 0.88 * blink);
      sys.fireflies++;
    } else {
      // estrela
      sz = s0[i] * (0.5 + 0.5 * smooth(0, 0.15, t)) * (1 - 0.35 * t);
      a *= smooth(0, 0.06, t) * (1 - smooth(0.5, 1, t));
    }
    size[i] = sz;
    alpha[i] = a;
  }
  sys.alive = alive;
  const at = sys.geo.attributes;
  at.position.needsUpdate = true;
  at.aSize.needsUpdate = true;
  at.aAlpha.needsUpdate = true;
  at.aRot.needsUpdate = true;
  at.aColor.needsUpdate = true;
  at.aTile.needsUpdate = true;
}

// ---------------------------------------------------------------------------
//  Material de anel no chão (compartilhado com o feedback)
// ---------------------------------------------------------------------------
export function createRingMaterial({ color = '#FFE6B0', opacity = 0.7, width = 0.18, fill = 0, dash = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uWidth: { value: width },
      uFill: { value: fill },
      uDash: { value: dash },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity, uWidth, uFill, uDash, uTime;
      varying vec2 vUv;
      void main() {
        vec2 q = vUv - 0.5;
        float d = length(q) * 2.0;
        float r = 1.0 - uWidth;
        float ring = 1.0 - smoothstep(0.0, uWidth, abs(d - r));
        if (uDash > 0.0) {
          float ang = atan(q.y, q.x) + uTime;
          ring *= smoothstep(-0.2, 0.25, sin(ang * uDash));
        }
        float fill = uFill * (1.0 - smoothstep(0.0, r, d)) * 0.6 + uFill * 0.4 * step(d, r);
        float a = (ring + fill * (1.0 - ring)) * uOpacity * (1.0 - smoothstep(0.97, 1.0, d));
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

// ---------------------------------------------------------------------------
//  API
// ---------------------------------------------------------------------------
const DUST_COLORS = ['#E9D6B2', '#DEC59A', '#EFE0C4', '#D8BC8E'];
const GOLD = ['#FFD66E', '#FFE7A3', '#FFC94D', '#FFF3CC'];
const CONFETTI = ['#F08A3C', '#7FA36B', '#FFF6E6', '#F27B6B', '#B9A3E3', '#F6C85F', '#4E9A9A'];
const HEARTS = ['#F37C8A', '#F59AA6', '#EE6A6A', '#F7A9B4'];
const WATER = ['#DDF2FF', '#C4E6FA', '#EAF7FF', '#B4DCF5'];
const FEATHERS = ['#FFFFFF', '#F7F4EE', '#EFEBE3'];
const EMBERS = ['#FFB347', '#FFD27A', '#FF9A3C', '#FFE6A8'];
const FIREFLY = ['#E9FF8F', '#D4F76E', '#F4FFB8'];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export function createParticles(engine) {
  const atlas = makeAtlas();
  const soft = makeSystem(400, THREE.NormalBlending, atlas);
  const glow = makeSystem(250, THREE.AdditiveBlending, atlas);
  const group = new THREE.Group();
  group.name = 'fx-particles';
  group.add(soft.points, glow.points);
  engine.scene.add(group);

  // anéis
  const ringGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const rings = [];
  for (let i = 0; i < 12; i++) {
    const mat = createRingMaterial({ opacity: 0 });
    const m = new THREE.Mesh(ringGeo, mat);
    m.visible = false;
    m.renderOrder = 15;
    m.frustumCulled = false;
    group.add(m);
    rings.push({ mesh: m, mat, age: 0, life: 0, r0: 0.1, r1: 1, op: 0.7 });
  }
  let ringCursor = 0;

  const v = new THREE.Vector2();
  const P = (pos) => ({ x: pos.x ?? 0, y: pos.y ?? 0, z: pos.z ?? 0 });

  function dust(pos, opts = {}) {
    const p = P(pos);
    const n = opts.count ?? 5;
    const sc = opts.size ?? 1;
    const spread = opts.spread ?? 0.12;
    const dx = opts.dir?.x ?? 0;
    const dz = opts.dir?.z ?? 0;
    const st = opts.strength ?? 0.6;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      spawn(soft, {
        x: p.x + Math.cos(a) * r,
        y: Math.max(0.03, p.y) + Math.random() * 0.05,
        z: p.z + Math.sin(a) * r,
        vx: Math.cos(a) * rnd(0.15, 0.45) * st + dx * rnd(0.4, 0.9) * st,
        vy: rnd(0.25, 0.55) * st,
        vz: Math.sin(a) * rnd(0.15, 0.45) * st + dz * rnd(0.4, 0.9) * st,
        color: opts.color ?? pick(DUST_COLORS),
        life: rnd(0.55, 0.95) * (opts.life ?? 1),
        s0: rnd(0.08, 0.14) * sc,
        s1: rnd(0.3, 0.46) * sc,
        alpha: (opts.alpha ?? 0.5) * rnd(0.75, 1),
        rotV: rnd(-0.8, 0.8),
        drag: 3.2,
        grav: -0.12,
        mode: MODE.dust,
        tile: TILE.puff,
      });
    }
  }

  function sparkle(pos, opts = {}) {
    const p = P(pos);
    const n = opts.count ?? 10;
    const R = opts.radius ?? 0.35;
    const sc = opts.size ?? 1;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * R;
      spawn(glow, {
        x: p.x + Math.cos(a) * r,
        y: p.y + rnd(-0.1, 0.25) * (opts.height ?? 1),
        z: p.z + Math.sin(a) * r,
        vx: Math.cos(a) * rnd(0.05, 0.3),
        vy: rnd(0.25, 0.7) * (opts.rise ?? 1),
        vz: Math.sin(a) * rnd(0.05, 0.3),
        color: opts.color ?? pick(GOLD),
        boost: 1.15,
        life: rnd(0.5, 0.95) * (opts.life ?? 1),
        s0: rnd(0.09, 0.17) * sc,
        alpha: opts.alpha ?? 0.95,
        rot: rnd(-0.3, 0.3),
        rotV: rnd(-1.5, 1.5),
        drag: 2.2,
        grav: 0.1,
        mode: MODE.sparkle,
        tile: Math.random() < 0.8 ? TILE.sparkle : TILE.dot,
      });
    }
  }

  function burst(pos, opts = {}) {
    const p = P(pos);
    const kind = opts.kind ?? 'stars';
    const sc = opts.size ?? 1;
    if (kind === 'confetti') {
      const n = opts.count ?? 40;
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const h = rnd(0.5, 1.6);
        spawn(soft, {
          x: p.x + rnd(-0.1, 0.1), y: p.y, z: p.z + rnd(-0.1, 0.1),
          vx: Math.cos(a) * h, vy: rnd(2.6, 4.0), vz: Math.sin(a) * h,
          color: pick(CONFETTI),
          life: rnd(1.8, 2.6),
          s0: rnd(0.11, 0.15) * sc,
          alpha: 1,
          rotV: rnd(-9, 9),
          drag: 1.4,
          grav: 5.5,
          mode: MODE.confetti,
          tile: Math.random() < 0.8 ? TILE.confetti : TILE.dot,
        });
      }
    } else if (kind === 'hearts') {
      const n = opts.count ?? 6;
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        spawn(soft, {
          x: p.x + Math.cos(a) * rnd(0.05, 0.22), y: p.y + rnd(0, 0.15), z: p.z + Math.sin(a) * rnd(0.05, 0.22),
          vx: Math.cos(a) * rnd(0.1, 0.3), vy: rnd(0.55, 0.9), vz: Math.sin(a) * rnd(0.1, 0.3),
          color: pick(HEARTS),
          life: rnd(1.4, 2.0),
          s0: rnd(0.14, 0.2) * sc,
          alpha: 0.95,
          drag: 1.2,
          grav: -0.05,
          mode: MODE.heart,
          tile: TILE.heart,
        });
      }
    } else {
      const n = opts.count ?? 14;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rnd(-0.2, 0.2);
        const s = rnd(1.3, 2.3) * (opts.speed ?? 1);
        spawn(glow, {
          x: p.x, y: p.y, z: p.z,
          vx: Math.cos(a) * s, vy: rnd(0.8, 1.8), vz: Math.sin(a) * s,
          color: opts.color ?? pick(GOLD),
          boost: 1.1,
          life: rnd(0.7, 1.1),
          s0: rnd(0.11, 0.17) * sc,
          alpha: 1,
          rotV: rnd(-4, 4),
          drag: 3.2,
          grav: 1.6,
          mode: MODE.star,
          tile: TILE.star,
        });
      }
    }
  }

  /** Respingo: gotas voando + névoa macia. opts: count, size, strength, mist, dir {x,z}. */
  function splash(pos, opts = {}) {
    const p = P(pos);
    const n = opts.count ?? 16;
    const sc = opts.size ?? 1;
    const st = opts.strength ?? 1;
    const dx = opts.dir?.x ?? 0;
    const dz = opts.dir?.z ?? 0;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const h = rnd(0.4, 1.4) * st;
      spawn(soft, {
        x: p.x + rnd(-0.06, 0.06), y: Math.max(0.05, p.y) + rnd(0, 0.08), z: p.z + rnd(-0.06, 0.06),
        vx: Math.cos(a) * h + dx * st, vy: rnd(1.4, 3.0) * st, vz: Math.sin(a) * h + dz * st,
        color: pick(WATER),
        life: rnd(0.6, 1.1),
        s0: rnd(0.055, 0.095) * sc,
        alpha: 0.95,
        rot: 0,
        drag: 0.8,
        grav: 7.5,
        mode: MODE.water,
        tile: Math.random() < 0.5 ? TILE.drop : TILE.dot,
      });
    }
    const m = opts.mist ?? Math.round(n * 0.35);
    for (let k = 0; k < m; k++) {
      const a = Math.random() * Math.PI * 2;
      spawn(soft, {
        x: p.x + Math.cos(a) * rnd(0, 0.15), y: Math.max(0.06, p.y) + rnd(0, 0.2), z: p.z + Math.sin(a) * rnd(0, 0.15),
        vx: Math.cos(a) * rnd(0.1, 0.4) * st, vy: rnd(0.15, 0.45), vz: Math.sin(a) * rnd(0.1, 0.4) * st,
        color: '#E8F5FF',
        life: rnd(0.8, 1.4),
        s0: rnd(0.12, 0.2) * sc,
        s1: rnd(0.45, 0.7) * sc,
        alpha: (opts.mistAlpha ?? 0.32) * rnd(0.7, 1),
        rotV: rnd(-0.6, 0.6),
        drag: 2.6,
        grav: -0.05,
        mode: MODE.mist,
        tile: TILE.puff,
      });
    }
  }

  /** Gotas radiais (chacoalhar o pelo): saem quase na horizontal ao redor do ponto. */
  function drops(pos, opts = {}) {
    const p = P(pos);
    const n = opts.count ?? 14;
    const sc = opts.size ?? 1;
    const R = opts.radius ?? 0.12;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = rnd(1.2, 2.4) * (opts.speed ?? 1);
      spawn(soft, {
        x: p.x + Math.cos(a) * R, y: p.y + rnd(-0.08, 0.1), z: p.z + Math.sin(a) * R,
        vx: Math.cos(a) * s, vy: rnd(0.4, 1.3), vz: Math.sin(a) * s,
        color: pick(WATER),
        life: rnd(0.5, 0.9),
        s0: rnd(0.055, 0.09) * sc,
        alpha: 0.95,
        rot: 0,
        drag: 1.2,
        grav: 6.5,
        mode: MODE.water,
        tile: TILE.dot,
      });
    }
  }

  /** Penas voando e assentando no chão. */
  function feathers(pos, opts = {}) {
    const p = P(pos);
    const n = opts.count ?? 8;
    const sc = opts.size ?? 1;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const h = rnd(0.5, 1.3);
      spawn(soft, {
        x: p.x + rnd(-0.08, 0.08), y: p.y + rnd(0, 0.15), z: p.z + rnd(-0.08, 0.08),
        vx: Math.cos(a) * h, vy: rnd(1.2, 2.2), vz: Math.sin(a) * h,
        color: pick(FEATHERS),
        life: rnd(2.2, 3.4),
        s0: rnd(0.1, 0.15) * sc,
        alpha: 1,
        rot: Math.random() * Math.PI * 2,
        drag: 2.8,
        grav: 1.6,
        mode: MODE.feather,
        tile: TILE.feather,
      });
    }
  }

  /** Faíscas quentes (lanterna acendendo). */
  function sparks(pos, opts = {}) {
    const p = P(pos);
    const n = opts.count ?? 12;
    const sc = opts.size ?? 1;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = rnd(0.3, 1.1) * (opts.speed ?? 1);
      spawn(glow, {
        x: p.x + Math.cos(a) * rnd(0, 0.06), y: p.y + rnd(-0.03, 0.05), z: p.z + Math.sin(a) * rnd(0, 0.06),
        vx: Math.cos(a) * s, vy: rnd(0.6, 1.6) * (opts.rise ?? 1), vz: Math.sin(a) * s,
        color: opts.color ?? pick(EMBERS),
        boost: 1.4,
        life: rnd(0.5, 1.1) * (opts.life ?? 1),
        s0: rnd(0.045, 0.085) * sc,
        alpha: 1,
        drag: 2.0,
        grav: 1.2,
        mode: MODE.spark,
        tile: TILE.dot,
      });
    }
  }

  // ---- vagalumes (ambiente opcional) ----
  let ff = null; // { x, z, radius, count, y0, y1, color, acc }
  /**
   * Liga/desliga o efeito ambiente de vagalumes (um por vez; chamar de novo substitui).
   * opts: { x, z, radius = 5, count = 14, y0 = 0.25, y1 = 1.4 } | null para desligar.
   */
  function fireflies(opts) {
    if (!opts) { ff = null; return null; }
    ff = { x: opts.x ?? 0, z: opts.z ?? 0, radius: opts.radius ?? 5, count: Math.min(40, opts.count ?? 14), y0: opts.y0 ?? 0.25, y1: opts.y1 ?? 1.4, acc: 0 };
    return { stop: () => { ff = null; } };
  }
  function spawnFirefly() {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * ff.radius;
    spawn(glow, {
      x: ff.x + Math.cos(a) * r, y: rnd(ff.y0, ff.y1), z: ff.z + Math.sin(a) * r,
      vx: rnd(-0.1, 0.1), vy: rnd(-0.03, 0.03), vz: rnd(-0.1, 0.1),
      color: pick(FIREFLY),
      boost: 1.5,
      life: rnd(5, 9),
      s0: rnd(0.06, 0.09),
      alpha: 1,
      rot: 0,
      drag: 0.9,
      grav: 0,
      mode: MODE.firefly,
      tile: TILE.dot,
    });
  }

  function ring(pos, opts = {}) {
    const p = P(pos);
    const r = rings[ringCursor];
    ringCursor = (ringCursor + 1) % rings.length;
    r.age = 0;
    r.life = opts.life ?? 0.8;
    r.r0 = opts.from ?? 0.15;
    r.r1 = opts.radius ?? 0.9;
    r.op = opts.opacity ?? 0.6;
    r.mat.uniforms.uColor.value.set(opts.color ?? '#FFE2A0');
    r.mat.uniforms.uWidth.value = opts.width ?? 0.1;
    r.mat.uniforms.uFill.value = opts.fill ?? 0.05;
    r.mesh.position.set(p.x, (p.y || 0) + 0.025, p.z);
    r.mesh.scale.setScalar(r.r0 * 2);
    r.mesh.visible = true;
  }

  function update(dt) {
    // escala de tamanho em pixels: altura do buffer / (2·tan(fov/2))
    engine.renderer.getDrawingBufferSize(v);
    const fov = THREE.MathUtils.degToRad(engine.camera.fov ?? 40);
    const scale = v.y / (2 * Math.tan(fov / 2));
    soft.mat.uniforms.uScale.value = scale;
    glow.mat.uniforms.uScale.value = scale;
    step(soft, dt);
    step(glow, dt);
    if (ff) {
      ff.acc += dt;
      if (ff.acc > 0.12 && glow.fireflies < ff.count) {
        ff.acc = 0;
        spawnFirefly();
      }
    }
    for (const r of rings) {
      if (!r.mesh.visible) continue;
      r.age += dt;
      const t = r.age / r.life;
      if (t >= 1) {
        r.mesh.visible = false;
        continue;
      }
      const e = 1 - Math.pow(1 - t, 3);
      r.mesh.scale.setScalar((r.r0 + (r.r1 - r.r0) * e) * 2);
      r.mat.uniforms.uOpacity.value = r.op * Math.pow(1 - t, 1.4) * Math.min(1, t * 12);
    }
  }

  function clear() {
    for (const s of [soft, glow]) {
      s.life.fill(0);
      s.alpha.fill(0);
      s.geo.attributes.aAlpha.needsUpdate = true;
    }
    for (const r of rings) r.mesh.visible = false;
  }

  return {
    dust, sparkle, burst, ring, update, clear,
    splash, drops, feathers, sparks, fireflies,
    count: () => soft.alive + glow.alive,
    group,
  };
}
