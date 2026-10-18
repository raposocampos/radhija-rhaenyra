// ARENA DO PULO (fase de desenvolvimento) — CENÁRIO.
// Base em blocos (_placeholder.js: chão, troncos e muretas) + a parede de treino do impulso na parede: reboco
// creme com rodapé, as patinhas pintadas, o botão com anel de luzes, a alavanca, o armarinho de madeira com a
// portinhola basculante (um ossinho dentro) e as luzinhas penduradas. Os ossinhos dourados ficam à vista.
import * as THREE from 'three';
import { buildPlaceholderWorld } from '../_placeholder.js';
import { rbox, canvasTexture, plasterMat, woodMat, stdMat, contactShadow, shadowAll } from '../../world/util.js';
import { buildWallButton, wallButtonYaw } from '../../world/wallButton.js';
import { buildTreats } from '../../world/treats.js';

const TAU = Math.PI * 2;

/** Ossinho pintado na portinhola (decalque). */
function boneSignTexture() {
  return canvasTexture(128, 64, (g) => {
    g.clearRect(0, 0, 128, 64);
    g.fillStyle = 'rgba(255,247,230,0.95)';
    g.fillRect(34, 26, 60, 12);
    for (const [x, y] of [[30, 24], [30, 40], [98, 24], [98, 40]]) {
      g.beginPath();
      g.arc(x, y, 10, 0, TAU);
      g.fill();
    }
  }, { repeat: false });
}

/** Parede de treino: reboco, rodapé e capa de madeira no topo (a face fica em W.z, para +Z). */
function buildTrainingWall(root, W) {
  const len = 11.9;
  const thick = 0.25;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, W.height, thick), plasterMat('#efe0c4'));
  wall.position.set(0, W.height / 2, W.z - thick / 2);
  wall.name = 'parede-de-treino';
  const base = new THREE.Mesh(rbox(len, 0.11, 0.03, 0.008), woodMat('#9a6b45', { key: 'pulo-rodape' }));
  base.position.set(0, 0.055, W.z + 0.011); // atrás começa dentro do reboco
  const cap = new THREE.Mesh(rbox(len + 0.04, 0.05, thick + 0.05, 0.012), woodMat('#8a5c3a', { key: 'pulo-capa' }));
  cap.position.set(0, W.height + 0.02, W.z - thick / 2 + 0.02);
  root.add(wall, base, cap);
  shadowAll(wall, false, true);
  shadowAll(cap);
}

/** Armarinho de madeira encostado na parede, com almofada e portinhola basculante (articulada no alto). */
function buildCubby(root, C) {
  const group = new THREE.Group();
  group.name = 'armarinho';
  const wood = new THREE.MeshStandardMaterial({ color: '#c98e5a', roughness: 0.72 });
  const trim = new THREE.MeshStandardMaterial({ color: '#7fa7a0', roughness: 0.6 });
  const depth = C.zFront - C.zBack;
  const midZ = (C.zBack + C.zFront) / 2;
  for (const x of [C.x0 - C.wall / 2, C.x1 + C.wall / 2]) {
    const side = new THREE.Mesh(rbox(C.wall, C.height, depth, 0.01), wood);
    side.position.set(x, C.height / 2, midZ - 0.004); // fundo dentro do reboco
    group.add(side);
  }
  const roof = new THREE.Mesh(rbox(C.x1 - C.x0 + C.wall * 2 + 0.06, 0.045, depth + 0.05, 0.012), trim);
  roof.position.set((C.x0 + C.x1) / 2, C.height + 0.022, midZ + 0.01);
  group.add(roof);
  // almofada vermelha no fundo
  const cushion = new THREE.Mesh(rbox(C.x1 - C.x0 - 0.06, 0.07, depth - 0.12, 0.03), stdMat('#d9614c', { roughness: 0.95 }));
  cushion.position.set((C.x0 + C.x1) / 2, 0.036, C.zBack + depth / 2 - 0.04);
  group.add(cushion);
  // portinhola: painel com moldura e o ossinho pintado, articulado no alto da frente
  const hinge = new THREE.Group();
  hinge.name = 'portinhola';
  hinge.position.set((C.x0 + C.x1) / 2, C.height - 0.035, C.zFront + 0.012);
  const panelH = C.height - 0.07;
  const panel = new THREE.Mesh(rbox(C.x1 - C.x0 - 0.01, panelH, 0.022, 0.01), new THREE.MeshStandardMaterial({ color: '#e7b77a', roughness: 0.7 }));
  panel.position.y = -panelH / 2;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.15),
    new THREE.MeshStandardMaterial({ map: boneSignTexture(), transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  sign.position.set(0, -panelH * 0.52, 0.0125);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), stdMat('#3f6f78', { roughness: 0.4 }));
  knob.position.set(0, -panelH + 0.05, 0.02);
  hinge.add(panel, sign, knob);
  group.add(hinge);
  shadowAll(group);
  root.add(group);
  const sh = contactShadow((C.x1 - C.x0) * 0.75, depth * 0.6, 0.35);
  sh.position.set((C.x0 + C.x1) / 2, 0.006, midZ + 0.04);
  root.add(sh);
  return {
    group,
    hatch: {
      object: hinge,
      /** 0 fechada … 1 levantada (gira para fora e para cima, como portinhola de pet). */
      setOpen(t) { hinge.rotation.x = -1.45 * THREE.MathUtils.clamp(t, 0, 1); },
    },
  };
}

/** Luzinhas: fio caído entre ganchos e lâmpadas coloridas que acendem pela alavanca. */
function buildLights(root, Lg) {
  const group = new THREE.Group();
  group.name = 'luzinhas';
  const hooks = [];
  const n = Math.round((Lg.x1 - Lg.x0) / 1.35);
  for (let i = 0; i <= n; i++) hooks.push(Lg.x0 + ((Lg.x1 - Lg.x0) * i) / n);
  const pts = [];
  const sag = 0.13;
  for (let i = 0; i < hooks.length - 1; i++) {
    for (let k = 0; k < 12; k++) {
      const u = k / 12;
      pts.push(new THREE.Vector3(hooks[i] + (hooks[i + 1] - hooks[i]) * u, Lg.y - sag * 4 * u * (1 - u), Lg.z + 0.03));
    }
  }
  pts.push(new THREE.Vector3(hooks[hooks.length - 1], Lg.y, Lg.z + 0.03));
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.004, 5), stdMat('#3a3a36', { roughness: 0.6 }));
  group.add(wire);
  const hookMat = stdMat('#c9c4bb', { roughness: 0.3, metalness: 0.6 });
  for (const x of hooks) {
    const hk = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), hookMat);
    hk.position.set(x, Lg.y, Lg.z + 0.015);
    group.add(hk);
  }
  const colors = ['#ffd36b', '#ff7b6b', '#8fe08a', '#7fc4ff'];
  const offMats = colors.map((c) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c).multiplyScalar(0.55), roughness: 0.35 }));
  const onMats = colors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, emissive: c, emissiveIntensity: 1.5 }));
  const capMat = stdMat('#5a5a52', { roughness: 0.5 });
  const bulbGeo = new THREE.SphereGeometry(0.026, 12, 10).scale(1, 1.35, 1);
  const bulbs = [];
  for (let i = 1; i < pts.length - 1; i += 4) {
    const p = pts[i];
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 8), capMat);
    cap.position.set(p.x, p.y - 0.012, p.z);
    const bulb = new THREE.Mesh(bulbGeo, offMats[bulbs.length % colors.length]);
    bulb.position.set(p.x, p.y - 0.05, p.z);
    bulb.userData.color = bulbs.length % colors.length;
    group.add(cap, bulb);
    bulbs.push(bulb);
  }
  root.add(group);
  let on = false;
  return {
    object: group,
    setOn(v) {
      on = !!v;
      for (const b of bulbs) b.material = (on ? onMats : offMats)[b.userData.color];
    },
    /** Piscadinha suave das luzes acesas. */
    update(t) {
      if (!on) return;
      for (const [i, m] of onMats.entries()) m.emissiveIntensity = 1.25 + 0.35 * Math.sin(t * 2.2 + i * 1.7);
    },
  };
}

/**
 * @param {import('../../types').LevelBuildArgs} args
 * @returns {import('../../types').LevelBuild<import('../../types').PuloProps>}
 */
export function buildPuloWorld({ root, layout }) {
  const { WALL_TRAINING, WALL_BUTTON, WALL_LEVER, CUBBY, LIGHTS, COLLECTIBLES } = layout;
  const base = buildPlaceholderWorld({ root, layout, skip: new Set(['limite-norte', 'armarinho-oeste', 'armarinho-leste']) });
  buildTrainingWall(root, WALL_TRAINING);
  const cubby = buildCubby(root, CUBBY);
  const lights = buildLights(root, LIGHTS);

  const place = (prop, cfg) => {
    prop.object.position.set(cfg.x, 0, cfg.z);
    prop.object.rotation.y = wallButtonYaw(cfg.nx, cfg.nz);
    root.add(prop.object);
    return prop;
  };
  const wallButton = place(buildWallButton({ kind: 'button', top: WALL_BUTTON.top, color: '#e8554a', name: 'botao-treino', markColor: '#fffaf0' }), WALL_BUTTON);
  const wallLever = place(buildWallButton({ kind: 'lever', top: WALL_LEVER.top, color: '#f2c14e', trim: '#c96f4a', name: 'alavanca-treino', markColor: '#fffaf0' }), WALL_LEVER);
  // o ossinho do armarinho fica em cima da almofada; os outros, no chão
  const inCubby = (c) => c.x > CUBBY.x0 && c.x < CUBBY.x1 && c.z > CUBBY.zBack && c.z < CUBBY.zFront;
  const floorTreats = buildTreats(root, COLLECTIBLES.filter((c) => !inCubby(c)));
  const cubbyTreats = buildTreats(root, COLLECTIBLES.filter(inCubby), { y: 0.072 });
  const treatList = [...floorTreats.list, ...cubbyTreats.list];

  /** @type {import('../../types').PuloProps} */
  const props = {
    ...base.props,
    wallButton,
    wallLever,
    hatch: cubby.hatch,
    lights,
    collectibles: treatList, // a coleta acha cada ossinho pelo id
    reset() {
      cubby.hatch.setOpen(0);
      lights.setOn(false);
      wallButton.setOn(false);
      wallButton.setPress(0);
      wallButton.setTimer?.(null);
      wallLever.setOn(false);
      wallLever.setPress(0);
    },
  };
  return {
    props,
    seeThrough: [cubby.group],
    update(dt, t) {
      wallButton.update?.(dt, t);
      wallLever.update?.(dt, t);
      lights.update(t);
      floorTreats.update(dt, t);
      cubbyTreats.update(dt, t);
    },
  };
}
