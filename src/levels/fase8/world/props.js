// FASE 8 · Props interativos: a meia listrada (no varal), o cesto de roupa com rodinhas (furinhos de verdade,
// alças e rodízios que giram), a mantinha dobrada (em cima da máquina, caindo em arco, no cesto, no chão ou na
// caminha), a caminha das dogs (GOAL), os dois botões da parede, os ossinhos e as luzes quentes.
import * as THREE from 'three';
import { rbox, canvasTexture, stdMat, contactShadow, shadowAll } from '../../../world/util.js';
import { createSock } from '../../../world/toys.js';
import { buildTreats } from '../../../world/treats.js';
import { buildWallButton, wallButtonYaw } from '../../../world/wallButton.js';

const ease = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const smooth = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };

// ================================================================== cesto de roupa
/** Furinhos ovais do plástico (alphaMap: branco = plástico, preto = furo) e as alças no alto. */
function holesTexture() {
  return canvasTexture(256, 160, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#000000';
    const rows = 4, cols = 7;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = 26 + i * ((w - 52) / (cols - 1)) + (j % 2 ? 8 : -8);
      const y = 52 + j * 26;
      g.beginPath(); g.ellipse(x, y, 7, 9, 0, 0, Math.PI * 2); g.fill();
    }
    // alça (rasgo largo no alto, no meio)
    g.beginPath(); g.roundRect(w / 2 - 34, 12, 68, 18, 9); g.fill();
  }, { srgb: false, repeat: false });
}

function buildBasket(root, B) {
  const grp = new THREE.Group();
  grp.name = 'cesto';
  const L = B.half * 2, H = B.height;
  const plastic = new THREE.MeshStandardMaterial({ color: '#79c0e3', roughness: 0.38, alphaMap: holesTexture(), alphaTest: 0.5, side: THREE.DoubleSide, emissive: '#ffcf7a', emissiveIntensity: 0 });
  const solid = new THREE.MeshStandardMaterial({ color: '#68b3d8', roughness: 0.4, emissive: '#ffcf7a', emissiveIntensity: 0 });
  const wallH = H - 0.09;
  const t = 0.022;
  // paredes com furinhos (um plano por lado, um pouco inclinadas para fora como um cesto de verdade)
  const wallGeo = new THREE.PlaneGeometry(L - 0.02, wallH);
  for (const [x, z, ry] of /** @type {[number, number, number][]} */ ([[0, L / 2 - t / 2, 0], [0, -L / 2 + t / 2, Math.PI], [L / 2 - t / 2, 0, Math.PI / 2], [-L / 2 + t / 2, 0, -Math.PI / 2]])) {
    const wm = new THREE.Mesh(wallGeo, plastic);
    wm.position.set(x, 0.07 + wallH / 2, z);
    wm.rotation.y = ry;
    grp.add(wm);
  }
  // borda de cima (moldura grossa) e o fundo
  for (const [x, z, w, d] of [[0, L / 2 - 0.014, L, 0.03], [0, -L / 2 + 0.014, L, 0.03], [L / 2 - 0.014, 0, 0.03, L - 0.056], [-L / 2 + 0.014, 0, 0.03, L - 0.056]]) {
    const rim = new THREE.Mesh(rbox(w, 0.032, d, 0.012), solid);
    rim.position.set(x, 0.07 + wallH + 0.012, z);
    grp.add(rim);
  }
  const bottom = new THREE.Mesh(rbox(L - 0.01, 0.024, L - 0.01, 0.01), solid);
  bottom.position.y = 0.072;
  grp.add(bottom);
  // rodízios: garfo e rodinha (gira com o deslocamento)
  const wheels = [];
  const forkMat = stdMat('#dfe2e4', { roughness: 0.35, metalness: 0.6 });
  const wheelMat = stdMat('#3a3a36', { roughness: 0.7 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const fork = new THREE.Mesh(rbox(0.03, 0.04, 0.03, 0.006), forkMat);
    fork.position.set(sx * (L / 2 - 0.05), 0.058, sz * (L / 2 - 0.05));
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 14).rotateZ(Math.PI / 2), wheelMat);
    wheel.position.set(sx * (L / 2 - 0.05), 0.03, sz * (L / 2 - 0.05));
    grp.add(fork, wheel);
    wheels.push(wheel);
  }
  // uma meinha esquecida no fundo do cesto
  const lost = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.08, 4, 8).rotateZ(Math.PI / 2), stdMat('#f2c14e', { roughness: 0.95 }));
  lost.position.set(0.1, 0.1, -0.12);
  lost.rotation.y = 0.6;
  grp.add(lost);
  const anchor = new THREE.Object3D();
  anchor.position.y = 0.085;
  grp.add(anchor);
  shadowAll(grp);
  root.add(grp);
  const sh = contactShadow(B.half * 1.2, B.half * 1.2, 0.38);
  sh.position.y = 0.005;
  root.add(sh);
  const S = { x: B.start.x, z: B.start.z, roll: 0, hl: false, glow: 0 };
  const setPos = (x, z) => {
    S.roll += Math.hypot(x - S.x, z - S.z) / 0.03;
    S.x = x;
    S.z = z;
    grp.position.set(x, 0, z);
    sh.position.set(x, 0.005, z);
    for (const w of wheels) w.rotation.x = S.roll;
  };
  setPos(B.start.x, B.start.z);
  return {
    object: grp,
    anchor,
    setPos,
    setHighlight(on) { S.hl = !!on; },
    update(dt, tt) {
      S.glow = ease(S.glow, S.hl ? 1 : 0, dt, 4);
      plastic.emissiveIntensity = solid.emissiveIntensity = S.glow * (0.16 + 0.08 * Math.sin(tt * 4));
    },
    reset() { S.roll = 0; S.hl = false; S.glow = 0; setPos(B.start.x, B.start.z); },
  };
}

// ================================================================== mantinha
function plaidTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#f6e3d3'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(232,154,176,0.6)';
    for (let i = 0; i < w; i += 32) { g.fillRect(i, 0, 12, h); g.fillRect(0, i, w, 12); }
    g.fillStyle = 'rgba(127,176,200,0.45)';
    for (let i = 20; i < w; i += 32) { g.fillRect(i, 0, 4, h); g.fillRect(0, i, w, 4); }
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 400; i++) g.fillRect((i * 37) % w, (i * 61) % h, 2, 2);
  });
}

/**
 * Mantinha dobrada (grande demais para a boca). Lugares: 'machine' (em cima da máquina, em washerTop), 'basket'
 * (no fundo do cesto, meio desabada), 'floor' (amarfanhada na frente da máquina), 'bed' (na caminha). place(lugar,
 * anima) vai em arco até lá (da máquina: escorrega e cai, em fallTime s); wobble(k) = escorregando na tampa.
 */
function buildBlanket(root, layout, { washerTop, basketAnchor, bedSpot }) {
  const { CATCH, SPIN } = layout;
  const tex = plaidTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  const obj = new THREE.Group();
  obj.name = 'mantinha';
  const body = new THREE.Mesh(rbox(0.46, 0.12, 0.34, 0.05), mat);
  body.position.y = 0.06;
  // dobras: duas faixas mais claras nas laterais e franjinhas na frente
  const foldMat = new THREE.MeshStandardMaterial({ color: '#fbefe4', roughness: 1 });
  for (const y of [0.04, 0.085]) {
    const f = new THREE.Mesh(rbox(0.47, 0.012, 0.345, 0.006), foldMat);
    f.position.y = y;
    obj.add(f);
  }
  const fringeMat = stdMat('#e89ab0', { roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const fr = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.04, 4), fringeMat);
    fr.position.set(-0.2 + i * 0.05, 0.03, 0.18);
    fr.rotation.x = 0.4;
    obj.add(fr);
  }
  obj.add(body);
  shadowAll(obj);
  // onde e como ela fica em cada lugar (pai, posição, rotação, escala)
  const floorAnchor = new THREE.Object3D();
  floorAnchor.position.set(CATCH.x, 0.004, CATCH.z);
  root.add(floorAnchor);
  /** @type {Record<string, { parent: THREE.Object3D, pos: THREE.Vector3, rot: THREE.Euler, scale: THREE.Vector3 }>} */
  const SPOTS = {
    machine: { parent: washerTop, pos: new THREE.Vector3(0.02, 0, 0.02), rot: new THREE.Euler(0, 0.12, 0), scale: new THREE.Vector3(1, 1, 1) },
    basket: { parent: basketAnchor, pos: new THREE.Vector3(0, 0, 0), rot: new THREE.Euler(0.06, 0.4, -0.05), scale: new THREE.Vector3(0.95, 0.8, 0.95) },
    floor: { parent: floorAnchor, pos: new THREE.Vector3(0, 0, 0), rot: new THREE.Euler(0.04, 0.9, 0.06), scale: new THREE.Vector3(1.08, 0.6, 1.02) },
    bed: { parent: bedSpot, pos: new THREE.Vector3(0, 0, 0), rot: new THREE.Euler(0, -0.5, 0), scale: new THREE.Vector3(1.05, 0.55, 1.02) },
  };
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  const _tp = new THREE.Vector3(), _tq = new THREE.Quaternion(), _ts = new THREE.Vector3(), _m = new THREE.Matrix4();
  const S = { where: 'machine', tween: null, wobble: 0 };
  function snap(where) {
    const sp = SPOTS[where];
    sp.parent.add(obj);
    obj.position.copy(sp.pos);
    obj.rotation.copy(sp.rot);
    obj.scale.copy(sp.scale);
    S.where = where;
  }
  /** Transformação de mundo do lugar `where` agora (o cesto pode ter andado). */
  function targetWorld(where) {
    const sp = SPOTS[where];
    sp.parent.updateWorldMatrix(true, false);
    _m.compose(sp.pos, _q.setFromEuler(sp.rot), sp.scale).premultiply(sp.parent.matrixWorld);
    _m.decompose(_tp, _tq, _ts);
  }
  snap('machine');
  return {
    object: obj,
    /** @param {import('../../../types').Fase8BlanketPlace} where @param {boolean} [animate] */
    place(where, animate = false) {
      if (!animate) { S.tween = null; snap(where); return; }
      obj.updateWorldMatrix(true, false);
      obj.matrixWorld.decompose(_p, _q, _s);
      const from = { p: _p.clone(), q: _q.clone(), s: _s.clone() };
      root.add(obj);
      obj.position.copy(from.p);
      obj.quaternion.copy(from.q);
      obj.scale.copy(from.s);
      const fall = S.where === 'machine';
      S.tween = { where, t: 0, dur: fall ? SPIN.fallTime : 0.45, from, fall };
      S.where = where;
      S.wobble = 0;
    },
    wobble(k) { S.wobble = k; },
    update(dt, tt) {
      const tw = S.tween;
      if (tw) {
        tw.t += dt;
        const u = Math.min(1, tw.t / tw.dur);
        targetWorld(tw.where);
        if (tw.fall) {
          // escorrega para fora da tampa e cai (y em queda livre, para a frente reto)
          const ux = smooth(Math.min(1, u * 1.4));
          obj.position.set(tw.from.p.x + (_tp.x - tw.from.p.x) * ux, tw.from.p.y + (_tp.y - tw.from.p.y) * u * u + 0.04 * Math.sin(Math.PI * Math.min(1, u * 2)), tw.from.p.z + (_tp.z - tw.from.p.z) * ux);
          obj.quaternion.copy(tw.from.q).slerp(_tq, smooth(u)).multiply(_q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.sin(Math.PI * u) * 0.9));
        } else {
          const k = smooth(u);
          obj.position.lerpVectors(tw.from.p, _tp, k);
          obj.position.y += Math.sin(Math.PI * u) * 0.22;
          obj.quaternion.copy(tw.from.q).slerp(_tq, k);
        }
        obj.scale.lerpVectors(tw.from.s, _ts, smooth(u));
        if (u >= 1) { S.tween = null; snap(tw.where); }
        return;
      }
      if (S.where === 'machine') {
        // escorregando na tampa enquanto a máquina chacoalha
        const k = S.wobble;
        const sp = SPOTS.machine;
        obj.position.set(sp.pos.x + Math.sin(tt * 37) * 0.006 * k, sp.pos.y + Math.abs(Math.sin(tt * 29)) * 0.01 * k, sp.pos.z + 0.16 * k);
        obj.rotation.set(sp.rot.x + 0.3 * k * k, sp.rot.y + Math.sin(tt * 23) * 0.05 * k, sp.rot.z);
      }
    },
    reset() { S.tween = null; S.wobble = 0; snap('machine'); },
  };
}

// ================================================================== caminha (GOAL)
function buildDogBed(root, B, spots) {
  const grp = new THREE.Group();
  grp.name = 'caminha';
  const plaid = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#5f8fb0'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,248,236,0.45)';
    for (let i = 0; i < w; i += 32) { g.fillRect(i, 0, 10, h); g.fillRect(0, i, w, 10); }
    g.fillStyle = 'rgba(30,50,80,0.3)';
    for (let i = 16; i < w; i += 32) { g.fillRect(i, 0, 4, h); g.fillRect(0, i, w, 4); }
  });
  const rimMat = new THREE.MeshStandardMaterial({ map: plaid, roughness: 1, emissive: '#ffb347', emissiveIntensity: 0 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(B.r - 0.1, 0.11, 14, 40).rotateX(Math.PI / 2), rimMat);
  rim.scale.set(1, 1.15, 1);
  rim.position.y = 0.11;
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(B.r - 0.12, B.r - 0.1, 0.08, 32), new THREE.MeshStandardMaterial({ color: '#f6eadb', roughness: 1 }));
  cushion.position.y = 0.06;
  // argolinha de borracha com cravinhos (brinquedo delas; antes era um travesseirinho em forma de osso, que se
  // confundia com os ossinhos colecionáveis: retorno do usuário na prévia do PR #48), deitada no lado sudoeste da
  // almofada, longe dos lugares da meia e da mantinha
  const toy = new THREE.Group();
  toy.name = 'argolinha';
  const rubber = stdMat('#e8554a', { roughness: 0.55 });
  toy.add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.024, 12, 32).rotateX(Math.PI / 2), rubber));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const nub = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), rubber);
    nub.position.set(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1);
    toy.add(nub);
  }
  toy.position.set(-0.24, 0.125, 0.2);
  toy.rotation.set(0.12, 0.4, -0.08);
  grp.add(rim, cushion, toy);
  grp.position.set(B.x, 0, B.z);
  const spot = (name) => {
    const o = new THREE.Object3D();
    o.name = `caminha:${name}`;
    o.position.set(spots[name].x - B.x, 0.1, spots[name].z - B.z);
    grp.add(o);
    return o;
  };
  const sockSpot = spot('sock');
  sockSpot.rotation.set(Math.PI / 2, 0, 0.6); // a meia deitada na almofada
  sockSpot.position.y = 0.13;
  const blanketSpot = spot('blanket');
  shadowAll(grp);
  root.add(grp);
  const sh = contactShadow(B.r + 0.05, B.r + 0.05, 0.3);
  sh.position.set(B.x, 0.005, B.z);
  root.add(sh);
  return { group: grp, rimMat, sockSpot, blanketSpot };
}

// ================================================================== tudo junto
/**
 * @param {{ root: THREE.Object3D, layout: import('../../../types').LevelLayout, washer: { top: THREE.Object3D, setSpin(k: number): void, group: THREE.Object3D }, rackBuilder: (sock: THREE.Object3D) => any }} args
 */
export function buildProps({ root, layout, washer, rackBuilder }) {
  const { BASKET, DOG_BED, BED_SPOTS, COLLECTIBLES, SPIN_BUTTON, RACK_BUTTON } = layout;
  // a meia listrada começa no varal (o varal monta e devolve o ponto dela)
  const sockObj = createSock(0.26);
  const rack = rackBuilder(sockObj);
  sockObj.position.set(0, 0, 0);
  const sockHome = sockObj.position.clone();
  const sockMats = [];
  sockObj.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) sockMats.push(o.material); });
  const basket = buildBasket(root, BASKET);
  const bed = buildDogBed(root, DOG_BED, BED_SPOTS);
  const blanket = buildBlanket(root, layout, { washerTop: washer.top, basketAnchor: basket.anchor, bedSpot: bed.blanketSpot });
  const place = (prop, cfg) => {
    prop.object.position.set(cfg.x, 0, cfg.z);
    prop.object.rotation.y = wallButtonYaw(cfg.nx, cfg.nz);
    root.add(prop.object);
    return prop;
  };
  const spinButton = place(buildWallButton({ kind: 'button', top: SPIN_BUTTON.top, color: '#e8554a', name: 'botao-centrifugar' }), SPIN_BUTTON);
  const rackButton = place(buildWallButton({ kind: 'button', top: RACK_BUTTON.top, color: '#f2c14e', trim: '#c96f4a', name: 'botao-varal' }), RACK_BUTTON);
  const treats = buildTreats(root, COLLECTIBLES, { glow: 0.22 });

  // ---- luzes quentes (sem sombra): perto da caminha, o brilho da janela e o canto do tanque
  const lights = [];
  const addLight = (x, y, z, color, intensity, dist) => {
    const l = new THREE.PointLight(color, intensity, dist, 1.6);
    l.position.set(x, y, z);
    root.add(l);
    lights.push(l);
  };
  addLight(DOG_BED.x - 0.3, 1.0, DOG_BED.z - 0.2, '#ffc07a', 1.2, 4.0);
  addLight(layout.WINDOW.cx, 1.7, layout.WORLD.bounds.minZ + 0.6, '#fff1d6', 1.4, 4.5);
  addLight(layout.TANK.x, 1.9, layout.TANK.z + 0.8, '#ffe2b8', 0.8, 3.5);

  const st = { sockHl: false, sockGlow: 0, bedHl: false, bedGlow: 0 };
  /** @satisfies {import('../../../types').Fase8Props} */
  const props = {
    sock: {
      object: sockObj, home: sockHome,
      setHighlight(on) { st.sockHl = !!on; },
    },
    rack: { object: rack.object, sockAnchor: rack.sockAnchor, setLower: rack.setLower },
    washer: { object: washer.group, setSpin: washer.setSpin },
    blanket: { object: blanket.object, place: blanket.place, wobble: blanket.wobble },
    basket: { object: basket.object, anchor: basket.anchor, setPos: basket.setPos, setHighlight: basket.setHighlight },
    spinButton,
    rackButton,
    bed: {
      object: bed.group,
      setHighlight(on) { st.bedHl = !!on; },
      spot: (thing) => (thing === 'sock' ? bed.sockSpot : bed.blanketSpot),
    },
    collectibles: treats.list,
    fireflies: false,
    update(dt, t) {
      rack.update(dt);
      basket.update(dt, t);
      blanket.update(dt, t);
      spinButton.update?.(dt, t);
      rackButton.update?.(dt, t);
      treats.update(dt, t);
      st.sockGlow = ease(st.sockGlow, st.sockHl ? 1 : 0, dt, 5);
      for (const m of sockMats) m.emissive?.setRGB(0.5 * st.sockGlow, 0.32 * st.sockGlow, 0.18 * st.sockGlow).multiplyScalar(0.6 + 0.4 * Math.sin(t * 5));
      st.bedGlow = ease(st.bedGlow, st.bedHl ? 1 : 0, dt, 4);
      bed.rimMat.emissiveIntensity = st.bedGlow * (0.22 + 0.1 * Math.sin(t * 4));
    },
    reset() {
      rack.reset();
      rack.sockAnchor.add(sockObj);
      sockObj.position.copy(sockHome);
      sockObj.rotation.set(0, 0, 0);
      sockObj.visible = true;
      basket.reset();
      blanket.reset();
      spinButton.setOn(false);
      spinButton.setPress(0);
      spinButton.setTimer?.(null);
      rackButton.setOn(false);
      rackButton.setPress(0);
      rackButton.setTimer?.(null);
      washer.setSpin(0);
      st.sockHl = st.bedHl = false;
      for (const c of treats.list) c.reset();
    },
  };
  props.reset();
  return { props, seeThrough: [rack.object, basket.object], lights };
}
