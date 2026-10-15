// PROVISÓRIO — cenário e puzzle mínimos para fases ainda em construção (permite testar o fluxo
// entre fases). Cada fase substitui isso pelo seu world/ e puzzle.js de verdade.
import * as THREE from 'three';
import { createHints, createCollectibles, createCarryItem, reach, deliveredAt } from '../game/puzzleKit.js';

export function buildPlaceholderWorld({ root, layout, colors = {} }) {
  const B = layout.WORLD.bounds;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(B.maxX - B.minX + 16, B.maxZ - B.minZ + 16),
    new THREE.MeshStandardMaterial({ color: colors.ground || '#5f7f4a', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((B.minX + B.maxX) / 2, 0, (B.minZ + B.maxZ) / 2);
  ground.receiveShadow = true;
  root.add(ground);
  const mat = new THREE.MeshStandardMaterial({ color: colors.block || '#b39274', roughness: 0.9 });
  const water = new THREE.MeshStandardMaterial({ color: '#3d6f8f', roughness: 0.2, metalness: 0.1 });
  for (const c of layout.STATIC_COLLIDERS) {
    if (c.blocks === 'large') continue;
    const m = c.kind === 'water' ? water : mat;
    const h = c.kind === 'water' ? 0.04 : 0.6;
    let mesh;
    if (c.shape === 'box') mesh = new THREE.Mesh(new THREE.BoxGeometry(c.hx * 2, h, c.hz * 2), m);
    else if (c.shape === 'circle') mesh = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, h, 20), m);
    else continue;
    mesh.position.set(c.x, h / 2, c.z);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  }
  const item = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshStandardMaterial({ color: '#d8f04a' }));
  item.add(ball);
  const it = layout.BALL || layout.SLIPPER;
  item.position.set(it.x, 0.07, it.z);
  root.add(item);
  return {
    props: { item: { object: item, setHighlight() {} }, collectibles: [], reset() {} },
    seeThrough: [],
    update() {},
  };
}

/** Puzzle mínimo: pegar o item e levar ao objetivo. */
export function createPlaceholderPuzzle({ layout, props, dogs, emit, root }) {
  const it = layout.BALL || layout.SLIPPER;
  const hints = createHints(emit, { hint: { wip: 'Fase em construção: pegue o item e leve ao objetivo.' }, prompt: { item: 'Pegar' } });
  const cols = createCollectibles({ list: layout.COLLECTIBLES, props, emit, pickupR: layout.COLLECTIBLE_PICKUP_R });
  const item = createCarryItem({ obj: props.item?.object, dogs, scene: root, carrier: it.carrier || 'any' });
  let stage = 'start';
  let onStageChange = () => {};
  const setStage = (s) => {
    if (s !== stage) {
      stage = s;
      onStageChange(s);
    }
  };
  return {
    stages: ['start', 'carrying', 'done'],
    objective() {
      if (stage === 'start') return { text: 'Fase em construção — pegue o item (E)', target: { x: it.x, y: 0.8, z: it.z }, stage };
      if (stage === 'carrying') return { text: 'Leve até o objetivo', target: { x: layout.GOAL.x, y: 0.9, z: layout.GOAL.z }, stage };
      return { text: null, target: null, stage };
    },
    update(dt, { active, ctrls }) {
      hints.frame(dt);
      hints.setPrompt(stage === 'start' && item.canCarry(active) && reach(active, it.x, it.z) < it.pickupR ? 'item' : null);
      cols.update(active);
      if (stage === 'carrying' && deliveredAt(layout.GOAL, ctrls[item.holder], active)) {
        setStage('done');
        return 'delivered';
      }
      return null;
    },
    interact(c) {
      if (stage === 'start' && item.canCarry(c) && reach(c, it.x, it.z) < it.pickupR) {
        item.attach(c.name);
        emit('carrot:pickup', { name: c.name, x: c.x, z: c.z });
        setStage('carrying');
        return true;
      }
      return false;
    },
    lockFor: () => null,
    lookTarget: () => null,
    navFlags: () => ({ gateOpen: true, sprinklersOff: true, bridge: true }),
    setPrompt: (k) => hints.setPrompt(k),
    reset() {
      stage = 'start';
      item.returnHome();
      cols.reset();
      hints.reset();
    },
    jumpToStage: () => null,
    set onStageChange(fn) { onStageChange = fn; },
    get stage() { return stage; },
    get carrier() { return item.holder; },
    get collected() { return cols.count; },
    get total() { return cols.total; },
    S: hints.S,
  };
}
