// PANDORÓPOLIS — as bandeirinhas das fases. Cada uma: o mastro com a bola dourada (no kit, junto com a cidade), a
// bandeira tremulando com o número (a cor diz o estado: laranja = a próxima, verde = concluída, dourada = com os três
// biscoitos, cinza = trancada), o número pintado no chão na frente, os três biscoitos girando em cima (os ganhos
// dourados, os que faltam claros) e o cadeado das trancadas. Tudo em poucas malhas: as bandeiras numa geometria só
// (cores por vértice, a onda calculada no processador), os números do chão em outra, biscoitos e cadeados instanciados.
// API: buildMarkers(kit, root, L) → { setState(n, state, treats, total), redraw(), update(dt, t), seeThrough }
import * as THREE from 'three';
import { canvasTexture, mat, paint, mergeGeometries } from '../../../world/util.js';
import { cyl, sphere, rb } from './kit.js';

export const FLAG_COLORS = { next: '#f08a3c', done: '#7fbf5a', gold: '#f2b24c', locked: '#b9b1a6' };
const POLE_H = 2.05;
const CLOTH = { w: 0.95, h: 0.62, sx: 8, sy: 4 };
/** Para onde a bandeira tremula (de frente para a câmera, que olha de sudeste). */
const WIND = new THREE.Vector3(1, 0, -1).normalize();
const FONT = '"Fredoka", "Nunito", system-ui, sans-serif';

/** Biscoito em forma de osso, leve (o do jogo tem detalhe demais para 30 cópias pequenas). */
function boneGeo() {
  const parts = [new THREE.CapsuleGeometry(0.055, 0.26, 2, 8).rotateZ(Math.PI / 2)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(new THREE.SphereGeometry(0.075, 10, 6).translate(sx * 0.17, 0, sz * 0.055));
  const g = mergeGeometries(parts.map((p) => { const n = p.index ? p.toNonIndexed() : p; n.deleteAttribute('uv'); return n; }));
  return g.scale(1, 0.62, 1);
}

/** Atlas dos números 1..10 (célula de 128 px): disco claro, borda e o número escuro (a cor vem do vértice). */
function numberAtlas() {
  const C = 128;
  const draw = (g) => {
    g.clearRect(0, 0, C * 10, C);
    for (let i = 0; i < 10; i++) {
      const cx = i * C + C / 2, cy = C / 2;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(cx, cy, 58, 0, Math.PI * 2); g.fill();
      g.lineWidth = 7; g.strokeStyle = '#4a3426';
      g.beginPath(); g.arc(cx, cy, 54, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#4a3426';
      g.font = `700 ${i === 9 ? 62 : 74}px ${FONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(i + 1), cx, cy + 5);
    }
  };
  const tex = canvasTexture(C * 10, C, draw, { repeat: false });
  tex.anisotropy = 8;
  return { tex, redraw: () => { const g = tex.image?.getContext?.('2d'); if (!g) return; draw(g); tex.needsUpdate = true; } };
}

/**
 * @param {ReturnType<import('./kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../types').LevelLayout} L
 */
export function buildMarkers(kit, root, L) {
  const flags = L.FLAGS;
  const atlas = numberAtlas();
  const idx = new Map(flags.map((f, i) => [f.n, i]));

  // ---------- mastros (fixos, no kit) ----------
  for (const f of flags) {
    kit.add(cyl(0.035, 0.05, POLE_H, 10), { color: '#6b4a34', x: f.x, z: f.z });
    kit.add(cyl(0.12, 0.14, 0.06, 14), { color: '#4a3426', x: f.x, z: f.z });
    kit.add(sphere(0.075, 12, 10), { color: '#ffd15c', x: f.x, y: POLE_H + 0.05, z: f.z });
  }

  // ---------- bandeiras (uma geometria, onda no processador) ----------
  const per = (CLOTH.sx + 1) * (CLOTH.sy + 1);
  const pos = new Float32Array(per * flags.length * 3);
  const uv = new Float32Array(per * flags.length * 2);
  const col = new Float32Array(per * flags.length * 3);
  const index = [];
  /** posição de repouso (u ao longo do vento, v para baixo) de cada vértice */
  const rest = [];
  flags.forEach((f, k) => {
    const cell = f.n - 1;
    for (let j = 0; j <= CLOTH.sy; j++) {
      for (let i = 0; i <= CLOTH.sx; i++) {
        const v = k * per + j * (CLOTH.sx + 1) + i;
        const u = i / CLOTH.sx, w = j / CLOTH.sy;
        rest.push({ k, u, w });
        // o número num quadrado um pouco menor que a altura da bandeira, mais para a ponta
        uv[v * 2] = (cell + THREE.MathUtils.clamp(0.5 + (u - 0.56) * (CLOTH.w / CLOTH.h) * 1.15, 0, 1)) / 10;
        uv[v * 2 + 1] = THREE.MathUtils.clamp(0.5 + (0.5 - w) * 1.15, 0, 1);
      }
    }
    for (let j = 0; j < CLOTH.sy; j++) {
      for (let i = 0; i < CLOTH.sx; i++) {
        const a = k * per + j * (CLOTH.sx + 1) + i, b = a + 1, c = a + CLOTH.sx + 1, d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
  });
  const clothGeo = new THREE.BufferGeometry();
  clothGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  clothGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  clothGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  clothGeo.setIndex(index);
  const clothMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas.tex, side: THREE.DoubleSide, roughness: 0.75 });
  // o atlas é branco fora do disco: fora dele a bandeira fica só com a cor do estado
  clothMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 texelColor = texture2D( map, vMapUv );
        diffuseColor.rgb *= mix(vec3(1.0), texelColor.rgb, texelColor.a);
      #endif`);
  };
  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.name = 'mapa:bandeiras';
  cloth.castShadow = true;
  cloth.frustumCulled = false;
  root.add(cloth);
  const tmp = new THREE.Vector3();
  function wave(t) {
    for (let v = 0; v < rest.length; v++) {
      const { k, u, w } = rest[v];
      const f = flags[k];
      const ph = f.n * 1.7;
      const amp = u * (0.07 + 0.03 * Math.sin(t * 0.7 + ph));
      const off = Math.sin(t * 5.2 - u * 5.5 + ph) * amp;
      const sag = u * u * 0.06;
      tmp.copy(WIND).multiplyScalar(0.05 + u * CLOTH.w * (1 - 0.06 * Math.abs(off)));
      pos[v * 3] = f.x + tmp.x + off * 0.707;
      pos[v * 3 + 1] = POLE_H - 0.02 - w * CLOTH.h - sag;
      pos[v * 3 + 2] = f.z + tmp.z + off * 0.707;
    }
    clothGeo.attributes.position.needsUpdate = true;
    clothGeo.computeVertexNormals();
  }

  // ---------- números pintados no chão ----------
  const decalGeos = flags.map((f) => {
    const g = new THREE.CircleGeometry(0.62, 28).rotateX(-Math.PI / 2);
    const u = g.attributes.uv;
    for (let i = 0; i < u.count; i++) u.setX(i, (f.n - 1 + u.getX(i)) / 10);
    // o "para cima" do número aponta para longe da câmera: gira o disco para o número ficar de pé na tela
    g.rotateY(Math.PI / 4);
    const [fx, fz] = f.face;
    g.translate(f.x + fx * 1.05, 0.034, f.z + fz * 1.05);
    paint(g, '#ffffff');
    return g;
  });
  const decalGeo = mergeGeometries(decalGeos);
  const decalMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas.tex, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
  const decals = new THREE.Mesh(decalGeo, decalMat);
  decals.name = 'mapa:numeros';
  decals.receiveShadow = true;
  root.add(decals);
  const decalPer = decalGeos[0].attributes.position.count;

  // ---------- biscoitos (3 por bandeira) e cadeados ----------
  const bGeo = boneGeo();
  const boneMat = mat('mapa-biscoito', () => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 }));
  const bones = new THREE.InstancedMesh(bGeo, boneMat, flags.length * 3);
  bones.name = 'mapa:biscoitos';
  bones.castShadow = true;
  bones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(bones);
  const lockGeo = mergeGeometries([
    paint(rb(0.3, 0.24, 0.12, 0.04, 2), '#d9a63a'),
    paint(new THREE.TorusGeometry(0.09, 0.025, 8, 16, Math.PI).translate(0, 0.24, 0).toNonIndexed(), '#8a8f96'),
    paint(new THREE.CircleGeometry(0.035, 10).translate(0, 0.12, 0.061).toNonIndexed(), '#4a3426'),
  ].map((g) => { g.deleteAttribute('uv'); return g; }));
  const lockMat = mat('mapa-cadeado', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.35 }));
  const locks = new THREE.InstancedMesh(lockGeo, lockMat, flags.length);
  locks.name = 'mapa:cadeados';
  locks.castShadow = true;
  locks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(locks);

  // anel da próxima fase (pulsando no chão)
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd36a', transparent: true, opacity: 0.8, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40).rotateX(-Math.PI / 2), ringMat);
  ring.position.y = 0.04;
  ring.visible = false;
  root.add(ring);

  /** estado de cada bandeirinha */
  const st = flags.map(() => ({ state: 'locked', treats: 0, total: 3 }));
  const cGold = new THREE.Color('#f2b24c'), cDim = new THREE.Color('#fff3dc'), cTmp = new THREE.Color();
  function paintFlag(k) {
    const s = st[k];
    const hex = s.state === 'done' && s.treats >= s.total ? FLAG_COLORS.gold : FLAG_COLORS[s.state];
    cTmp.set(hex);
    for (let v = k * per; v < (k + 1) * per; v++) col.set([cTmp.r, cTmp.g, cTmp.b], v * 3);
    clothGeo.attributes.color.needsUpdate = true;
    const dc = decalGeo.attributes.color;
    for (let v = k * decalPer; v < (k + 1) * decalPer; v++) dc.setXYZ(v, cTmp.r, cTmp.g, cTmp.b);
    dc.needsUpdate = true;
    for (let b = 0; b < 3; b++) bones.setColorAt(k * 3 + b, b < s.treats ? cGold : cDim);
    if (bones.instanceColor) bones.instanceColor.needsUpdate = true;
  }
  flags.forEach((_, k) => paintFlag(k));

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p3 = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function placeIcons(t) {
    flags.forEach((f, k) => {
      const s = st[k];
      const locked = s.state === 'locked';
      for (let b = 0; b < 3; b++) {
        if (locked) { bones.setMatrixAt(k * 3 + b, zero); continue; }
        const a = (b - 1) * 0.36;
        const y = POLE_H + 0.42 + (b === 1 ? 0.1 : 0) + Math.sin(t * 2 + k + b * 0.8) * 0.04;
        p3.set(f.x + Math.cos(Math.PI / 4) * a * 1.0, y, f.z - Math.sin(Math.PI / 4) * a * 1.0);
        e.set(0.25, Math.PI / 4 + Math.sin(t * 1.3 + k) * 0.35, (b - 1) * -0.35);
        q.setFromEuler(e);
        const big = b < s.treats ? 1 : 0.86;
        m4.compose(p3, q, sc.set(big, big, big));
        bones.setMatrixAt(k * 3 + b, m4);
      }
      if (locked) {
        p3.set(f.x, POLE_H * 0.55 + Math.sin(t * 1.6 + k) * 0.03, f.z);
        // pendurado no mastro, virado para a câmera
        p3.x += 0.11; p3.z += 0.11;
        e.set(0, Math.PI / 4, Math.sin(t * 1.1 + k) * 0.08);
        q.setFromEuler(e);
        m4.compose(p3, q, sc.set(1, 1, 1));
        locks.setMatrixAt(k, m4);
      } else locks.setMatrixAt(k, zero);
    });
    bones.instanceMatrix.needsUpdate = true;
    locks.instanceMatrix.needsUpdate = true;
  }

  let ringFlag = -1;
  function setState(n, state, treats = 0, total = 3) {
    const k = idx.get(n);
    if (k == null) return;
    st[k] = { state, treats: Math.max(0, Math.min(3, treats | 0)), total: total || 3 };
    paintFlag(k);
    const nextK = st.findIndex((s) => s.state === 'next');
    ringFlag = nextK;
    ring.visible = nextK >= 0;
    if (nextK >= 0) {
      const f = flags[nextK];
      ring.position.set(f.x, 0.04, f.z);
    }
  }

  wave(0);
  placeIcons(0);
  return {
    setState,
    redraw: atlas.redraw,
    /** O estado atual de uma bandeirinha (testes). */
    stateOf: (n) => st[idx.get(n)] ?? null,
    update(dt, t) {
      wave(t);
      placeIcons(t);
      if (ringFlag >= 0) {
        const k = 0.5 + 0.5 * Math.sin(t * 3.2);
        ring.scale.setScalar(1 + k * 0.18);
        ringMat.opacity = 0.45 + 0.4 * (1 - k);
      }
    },
    seeThrough: [cloth, bones, locks],
  };
}
