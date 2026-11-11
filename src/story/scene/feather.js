// A PENA DE POMBO molhada (Modo História, cap. 1): a que cai no parapeito na abertura e fica lá de manhã, a pista que
// as irmãs farejam e examinam de perto. Uma pena de cobertura de pombo-comum, de desenho mas lida de perto:
//  - a RAQUE curva (o cálamo transparente na base, afinando até a ponta, que sobe um pouco);
//  - o VEXILO assimétrico (um lado mais largo), cinza-azulado, com a ponta mais escura e a borda mais clara, aberto em
//    tufos de barbas (os vãos em "V" na borda) que se soltam em FIOS na ponta;
//  - a PENUGEM clara e solta na base;
//  - o FURTA-COR verde e roxo perto da base (muda com o ângulo, como o pescoço dos pombos do esquadrão);
//  - MOLHADA (setWet(k), 0..1): os tufos e os fios grudam (os vãos abrem), a penugem deita na raque, a cor escurece,
//    brilha mais e aparecem as gotinhas.
// Deitada: a origem no meio dela, no plano em que ela encosta (y = 0 é o apoio), a ponta para +Z (a base para −Z) e o
// lado de cima para +Y. Mede ~13 cm. createFeather() → { object, setWet(k), length }.
import * as THREE from 'three';

const { clamp, lerp, smoothstep: ss } = THREE.MathUtils;

const LEN = 0.13; // a pena inteira (m)
const CALAMUS = 0.14; // o pedaço sem barbas, na base (fração do comprimento)
const W = { 1: 0.025, [-1]: 0.018 }; // a largura de cada lado do vexilo
/** Onde o vexilo racha (fração do trecho com barbas), de cada lado: poucas no meio, mais perto da ponta. */
const SPLITS = { 1: [0.21, 0.43, 0.6, 0.72, 0.82, 0.9, 0.955], [-1]: [0.29, 0.5, 0.66, 0.77, 0.86, 0.93] };
const NV = 4; // segmentos de cada trecho, da raque para fora

/** Um número pseudoaleatório estável por índice. */
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** O contorno do vexilo: 0 na base das barbas, máximo perto de 40%, redondo na ponta. */
const shape = (u) => Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.8))));

/** A raque: o ponto, a tangente e o lado (horizontal) em t ∈ [0, 1] (da base à ponta). */
function rachis(t, wet, out) {
  const z = -LEN / 2 + LEN * t;
  const x = -0.006 * 4 * t * (1 - t);
  const y = 0.0035 + 0.0032 * Math.sin(Math.PI * t) + (0.005 + 0.002 * wet) * Math.pow(t, 4);
  out.p.set(x, y, z);
  // a tangente pela derivada numérica
  const e = 1e-3, t2 = Math.min(1, t + e), t1 = Math.max(0, t - e);
  const zx = (a) => -0.006 * 4 * a * (1 - a), zy = (a) => 0.0035 + 0.0032 * Math.sin(Math.PI * a) + (0.005 + 0.002 * wet) * Math.pow(a, 4);
  out.t.set(zx(t2) - zx(t1), zy(t2) - zy(t1), LEN * (t2 - t1)).normalize();
  out.s.set(out.t.z, 0, -out.t.x).normalize(); // +x, deitado
  return out;
}

/**
 * A pena inteira numa lista de posições (mesma ordem seca e molhada: a molhada vira o alvo de morph), mais as cores, o
 * furta-cor e os índices (só na passada seca).
 */
function build(wet, dry) {
  const pos = [], col = [], fx = [], idx = [];
  const R = { p: new THREE.Vector3(), t: new THREE.Vector3(), s: new THREE.Vector3() };
  const c = new THREE.Color();
  const BASE = new THREE.Color('#8E99AD'), TIP = new THREE.Color('#5E6779'), EDGE = new THREE.Color('#B7C0CF');
  const GREEN = new THREE.Color('#3F9A80'), VIOLET = new THREE.Color('#7E5BAE'), DOWN = new THREE.Color('#D3D8E1');
  const QUILL = new THREE.Color('#E6E3DA'), SHAFT = new THREE.Color('#C9CED7');
  const push = (x, y, z, color, irid = 0, hue = 0) => {
    pos.push(x, y, z);
    if (dry) { col.push(color.r, color.g, color.b); fx.push(irid, hue); }
    return pos.length / 3 - 1;
  };

  // ---- a raque: um tubo de seis lados que afina (o cálamo mais grosso e claro)
  const RINGS = 28, SIDES = 6;
  const tmp = new THREE.Vector3(), up = new THREE.Vector3();
  for (let j = 0; j <= RINGS; j++) {
    const t = j / RINGS;
    rachis(t, wet, R);
    up.crossVectors(R.s, R.t).normalize();
    const r = t < CALAMUS ? 0.00095 + 0.0002 * (1 - t / CALAMUS) : 0.00092 * (1 - 0.8 * (t - CALAMUS) / (1 - CALAMUS)) + 0.00016;
    for (let k = 0; k < SIDES; k++) {
      const a = (k / SIDES) * Math.PI * 2;
      tmp.copy(R.p).addScaledVector(R.s, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r * 0.8);
      c.copy(t < CALAMUS ? QUILL : SHAFT).lerp(TIP, 0.5 * ss(t, 0.75, 1));
      push(tmp.x, tmp.y, tmp.z, c);
    }
  }
  for (let j = 0; j < RINGS; j++) for (let k = 0; k < SIDES; k++) {
    const a = j * SIDES + k, b = j * SIDES + ((k + 1) % SIDES), a2 = a + SIDES, b2 = b + SIDES;
    if (dry) idx.push(a, b, b2, a, b2, a2);
  }

  /** Um ponto do vexilo: o lado (σ), o lugar na raque (t0), o quanto para fora (v) e o ângulo da barba (θ). */
  const P = new THREE.Vector3(), D = new THREE.Vector3();
  const vanePoint = (sg, t0, v, theta, lenMul = 1) => {
    rachis(t0, wet, R);
    const u = (t0 - CALAMUS) / (1 - CALAMUS);
    const L = (W[sg] * (1 - 0.1 * wet) * shape(u) * lenMul) / Math.cos(theta);
    D.copy(R.s).multiplyScalar(sg * Math.cos(theta)).addScaledVector(R.t, Math.sin(theta));
    P.copy(R.p).addScaledVector(D, L * v);
    // em concha: a borda desce até encostar no apoio; um ondulado leve
    P.y = lerp(R.p.y, 0.0004, Math.pow(v, 1.6)) + 0.0006 * Math.sin(t0 * 47 + sg) * v;
    return P;
  };
  const barbAngle = (t0) => lerp(0.62, 1.0, ss(t0, 0.2, 1));

  // ---- o vexilo: trechos contínuos entre as rachaduras (cada lado tem as suas, irregulares); na borda, cada trecho
  // junta as barbas para o meio dele e as rachaduras abrem em "V" (pouco seca, muito molhada, mais perto da ponta)
  const T0 = CALAMUS + 0.05, T1 = 0.985;
  for (const sg of [1, -1]) {
    const cuts = SPLITS[sg];
    for (let i = 0; i <= cuts.length; i++) {
      const sa = lerp(T0, T1, i ? cuts[i - 1] : 0), sb = lerp(T0, T1, i < cuts.length ? cuts[i] : 1);
      const mid = (sa + sb) / 2, span = sb - sa;
      const nearTip = ss(mid, 0.68, 1);
      const notch = lerp(lerp(0.1, 0.32, nearTip), lerp(0.42, 0.62, nearTip), wet) * (0.85 + 0.3 * hash(i * 7 + sg));
      const nc = Math.max(2, Math.round(span / 0.03)) + 1; // as linhas de barbas do trecho
      const first = pos.length / 3;
      for (let k = 0; k <= NV; k++) {
        const v = k / NV;
        const f = 1 - notch * Math.pow(v, 1.5);
        for (let q = 0; q < nc; q++) {
          const t0 = mid + (q / (nc - 1) - 0.5) * span * f * (i === 0 && q === 0 ? 1 : 0.995);
          const p = vanePoint(sg, t0, v, barbAngle(t0), 1 + 0.05 * (hash(i * 3 + sg * 5) - 0.5));
          const u = (t0 - CALAMUS) / (1 - CALAMUS);
          // a cor: cinza-azulado, a ponta escura, a borda clara, o furta-cor perto da base e o risco das barbas
          const band = ss(u, 0.0, 0.12) * (1 - ss(u, 0.3, 0.5));
          c.copy(BASE).lerp(TIP, 0.55 * ss(u, 0.72, 0.98)).lerp(EDGE, 0.35 * ss(v, 0.72, 1) * (1 - nearTip));
          c.lerp(sg > 0 ? GREEN : VIOLET, 0.42 * band * (1 - 0.5 * v));
          c.multiplyScalar(1 + (q % 2 ? 0.035 : -0.035) * (k > 0 ? 1 : 0));
          push(p.x, p.y, p.z, c, 0.9 * band * (1 - 0.4 * v), sg > 0 ? 0.1 + 0.3 * u : 0.65 + 0.2 * u);
        }
      }
      if (dry) for (let k = 0; k < NV; k++) for (let q = 0; q < nc - 1; q++) {
        const a = first + k * nc + q, b = a + 1, a2 = a + nc, b2 = a2 + 1;
        idx.push(a, b, b2, a, b2, a2);
      }
    }
  }

  /** Um fio (barba solta): tira fina de `n` segmentos de `from` na direção `dir`, com a curva `bend` para o lado. */
  const strand = (from, dir, len, width, bend, lift, color, n = 3) => {
    const first = pos.length / 3;
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    for (let k = 0; k <= n; k++) {
      const v = k / n;
      tmp.copy(from).addScaledVector(dir, len * v).addScaledVector(side, bend * v * v);
      tmp.y = from.y + lift * Math.sin(Math.PI * v * 0.8) - (from.y - 0.0004) * Math.pow(v, 1.4) * (1 - wet * 0.3);
      const w = width * (1 - 0.6 * v);
      push(tmp.x - side.x * w, tmp.y, tmp.z - side.z * w, color);
      push(tmp.x + side.x * w, tmp.y, tmp.z + side.z * w, color);
    }
    if (dry) for (let k = 0; k < n; k++) {
      const a = first + k * 2, b = a + 1, a2 = a + 2, b2 = a + 3;
      idx.push(a, b, b2, a, b2, a2);
    }
  };

  // ---- os fios soltos na ponta (molhados, grudam aos pares)
  const F = new THREE.Vector3(), dir = new THREE.Vector3();
  for (const sg of [1, -1]) {
    for (let i = 0; i < 6; i++) {
      const t0 = 0.84 + i * 0.026 + 0.008 * hash(i + sg * 11);
      rachis(t0, wet, R);
      F.copy(R.p);
      const th = barbAngle(t0) + 0.12 * (hash(i * 5 + sg) - 0.5) + (i % 2 ? 1 : -1) * 0.08 * (1 - wet);
      dir.copy(R.s).multiplyScalar(sg * Math.cos(th)).addScaledVector(R.t, Math.sin(th)).normalize();
      const u = (t0 - CALAMUS) / (1 - CALAMUS);
      const len = (W[sg] * Math.max(0.35, shape(u)) / Math.cos(th)) * (1.12 + 0.25 * hash(i * 13 + sg)) * (1 - 0.15 * wet);
      c.copy(TIP).lerp(EDGE, 0.25);
      strand(F, dir, len, 0.00065, sg * 0.002 * (hash(i + 3) - 0.3) * (1 - wet), 0.0012 * (1 - wet), c);
    }
  }
  // dois fios na pontinha, continuando a raque
  for (const sg of [1, -1]) {
    rachis(0.995, wet, R);
    dir.copy(R.t).addScaledVector(R.s, sg * 0.35 * (1 - 0.6 * wet)).normalize();
    strand(R.p.clone(), dir, 0.009, 0.0006, 0, 0.001 * (1 - wet), c.copy(TIP));
  }

  // ---- a penugem da base: fios claros e soltos, enrolando para cima; molhada, deita na raque
  for (const sg of [1, -1]) {
    for (let i = 0; i < 6; i++) {
      const t0 = CALAMUS - 0.01 + i * 0.013;
      rachis(t0, wet, R);
      F.copy(R.p);
      const th = lerp(0.35 + 0.18 * i, -0.7, wet) + 0.2 * (hash(i * 17 + sg) - 0.5);
      dir.copy(R.s).multiplyScalar(sg * Math.cos(th)).addScaledVector(R.t, Math.sin(th)).normalize();
      const len = lerp(0.013 + 0.006 * hash(i * 23 + sg), 0.009, wet);
      strand(F, dir, len, lerp(0.0011, 0.0006, wet), sg * lerp(0.004, 0.0005, wet), lerp(0.004, 0.0004, wet), DOWN, 3);
    }
  }
  return { pos, col, fx, idx };
}

/** O material: cor por vértice, as duas faces, e o furta-cor e o brilho de molhado no shader. */
function featherMaterial(U) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFeatherWet = U.wet;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 featherFx;\nvarying vec2 vFeatherFx;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFeatherFx = featherFx;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFeatherFx;\nuniform float uFeatherWet;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // furta-cor: o matiz anda do verde para o roxo conforme a pena vira para a câmera
        vec3 fView = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
        float fFacing = clamp(abs(dot(normal, fView)), 0.0, 1.0);
        float fHue = clamp(vFeatherFx.y + (0.65 - fFacing) * 1.3, 0.0, 1.0);
        vec3 fIrid = mix(vec3(0.07, 0.4, 0.25), vec3(0.4, 0.13, 0.48), fHue);
        diffuseColor.rgb = mix(diffuseColor.rgb, fIrid, vFeatherFx.x * (0.5 + 0.5 * (1.0 - fFacing)));
        roughnessFactor = mix(roughnessFactor, 0.28, vFeatherFx.x * 0.6);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // a borda de penugem clara (e o brilho da água, molhada)
        totalEmissiveRadiance += diffuseColor.rgb * pow(1.0 - fFacing, 3.0) * (0.1 + 0.3 * uFeatherWet);`);
  };
  m.customProgramCacheKey = () => 'feather-pena-1';
  return m;
}

export function createFeather() {
  const object = new THREE.Group();
  object.name = 'historia:pena-de-pombo';
  const dry = build(0, true), wetB = build(1, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(dry.pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(dry.col, 3));
  geo.setAttribute('featherFx', new THREE.Float32BufferAttribute(dry.fx, 2));
  geo.setIndex(dry.idx);
  geo.computeVertexNormals();
  const wetPos = new THREE.Float32BufferAttribute(wetB.pos, 3);
  wetPos.name = 'molhada';
  geo.morphAttributes.position = [wetPos];
  geo.computeBoundingSphere();
  const U = { wet: { value: 0 } };
  const mat = featherMaterial(U);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'pena-vexilo';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.updateMorphTargets();
  object.add(mesh);

  // as gotinhas (aparecem molhada): contas de água em cima do vexilo e da raque
  const dropMat = new THREE.MeshStandardMaterial({ color: '#dfeeff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.6, depthWrite: false });
  const drops = new THREE.Group();
  drops.name = 'pena-gotas';
  const R = { p: new THREE.Vector3(), t: new THREE.Vector3(), s: new THREE.Vector3() };
  for (const [t, side, off, r] of [[0.42, 1, 0.009, 0.0026], [0.6, -1, 0.006, 0.002], [0.3, 0, 0, 0.0017], [0.75, 1, 0.012, 0.0018]]) {
    rachis(t, 1, R);
    const d = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 5), dropMat);
    d.scale.set(1, 0.7, 1);
    const along = off * Math.sin(0.8);
    d.position.copy(R.p).addScaledVector(R.s, side * off * Math.cos(0.8)).addScaledVector(R.t, along);
    d.position.y = (side === 0 ? R.p.y + 0.0012 : lerp(R.p.y, 0.0004, Math.pow(off / W[side], 1.6))) + r * 0.55;
    d.castShadow = false;
    drops.add(d);
  }
  object.add(drops);

  const DRY = new THREE.Color('#ffffff'), WET = new THREE.Color('#c3cad6');
  const api = {
    object,
    length: LEN,
    /** 0 seca … 1 encharcada: os tufos e os fios grudam, a penugem deita, escurece, brilha e pinga. */
    setWet(k) {
      const w = clamp(k || 0, 0, 1);
      mesh.morphTargetInfluences[0] = w;
      mat.roughness = lerp(0.78, 0.3, w);
      mat.color.copy(DRY).lerp(WET, w);
      U.wet.value = w;
      drops.visible = w > 0.05;
      drops.children.forEach((d, i) => d.scale.set(1, 0.7, 1).multiplyScalar(ss(w, 0.05 + i * 0.12, 0.5 + i * 0.12) + 1e-3));
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      dropMat.dispose();
      for (const d of drops.children) /** @type {THREE.Mesh} */ (d).geometry.dispose();
      object.removeFromParent();
    },
  };
  api.setWet(0.45);
  return api;
}
