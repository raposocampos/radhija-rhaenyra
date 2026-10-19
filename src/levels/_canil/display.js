// CANIL DAS DOGS — a vitrine: as quatro dogs (Radhija e Rhaenyra, no modelo atual e no novo) fazendo a mesma pose
// ao mesmo tempo, num giro lento ou paradas de lado, de frente ou de costas. As dogs só nascem em start() (o puzzle
// chama ao montar a fase): os testes que montam só o cenário não constroem os modelos.
import * as THREE from 'three';
import { createDog } from '../../dogs/dog.js';
import { createDogV2 } from '../../dogs/v2/dog.js';
import { contactShadowTexture } from '../../dogs/contactShadow.js';
import { shareResource } from '../../core/resources.js';
import { EXTRA_TIME } from '../../game/extras.js';

/** @typedef {import('../../types').DogAnim} DogAnim */
/** @typedef {{ id: string, label: string, anim: (t: number) => DogAnim, bark?: number, carry?: boolean }} CanilPose */

const cycle = (kind, t) => {
  const dur = EXTRA_TIME[kind] ?? 3;
  const u = t % dur;
  return { extra: { kind, k: u / dur, t: u } };
};
/** Lambida em ritmo (a cada 0,44 s, como no jogo), balançando a cabeça de um lado para o outro. */
const lick = (t) => ({ lickPhase: (t % 0.44) / 0.44, lickSide: Math.floor(t / 0.44) % 2 ? -1 : 1 });
/** Pulinho no lugar a cada 1,1 s (sobe 0,3 m em 0,42 s). */
const hop = (t) => {
  const u = t % 1.1;
  if (u >= 0.42) return {};
  const k = u / 0.42;
  return { airK: k, jump: 4 * 0.3 * k * (1 - k) };
};

/**
 * Poses da vitrine. O que anda fica na esteira (as dogs não saem do tapete). O segredo não entra aqui.
 * @type {CanilPose[]}
 */
export const POSES = [
  { id: 'parada', label: 'Parada', anim: () => ({}) },
  { id: 'passo', label: 'Passo', anim: () => ({ speed: 0.7 }) },
  { id: 'trote', label: 'Trote', anim: () => ({ speed: 1.9 }) },
  { id: 'galope', label: 'Galope', anim: () => ({ speed: 5.5, action: 'dash' }) },
  { id: 'sentada', label: 'Sentada', anim: () => ({ action: 'sit' }) },
  { id: 'deitada', label: 'Deitada', anim: (t) => ({ extra: { kind: 'roll', k: 0.145, t } }) },
  { id: 'rolando', label: 'Rolando', anim: (t) => cycle('roll', t) },
  { id: 'farejando', label: 'Farejando', anim: () => ({ action: 'sniff', speed: 0.25 }) },
  { id: 'latindo', label: 'Latindo', bark: 1.1, anim: () => ({}) },
  { id: 'comemorando', label: 'Comemorando', anim: () => ({ action: 'celebrate' }) },
  { id: 'chacoalhando', label: 'Chacoalhando', anim: (t) => ({ action: t % 2.2 < 1.4 ? 'shake' : 'none' }) },
  { id: 'susto', label: 'Susto', anim: (t) => ({ action: t % 2.4 < 1.6 ? 'startled' : 'none' }) },
  { id: 'empurrando', label: 'Empurrando', anim: () => ({ action: 'push', speed: 0.6 }) },
  { id: 'forca', label: 'Fazendo força', anim: () => ({ action: 'strain', speed: 0.2 }) },
  { id: 'puxando', label: 'Puxando a corda', anim: () => ({ action: 'tug' }) },
  { id: 'registro', label: 'Girando o registro', anim: () => ({ action: 'turn' }) },
  { id: 'pulo', label: 'Pulinho', anim: (t) => hop(t) },
  { id: 'superbafo', label: 'Superbafo', anim: (t) => ({ action: t % 3 < 1.2 ? 'bafoAim' : t % 3 < 1.8 ? 'bafo' : 'proud' }) },
  { id: 'eca', label: 'Eca!', anim: () => ({ action: 'yuck' }) },
  { id: 'lambendo', label: 'Lambendo', anim: (t) => ({ action: 'lick', ...lick(t) }) },
  { id: 'lambida', label: 'Sendo lambida', anim: (t) => ({ action: 'licked', ...lick(t) }) },
  { id: 'escorregando', label: 'Escorregando', anim: () => ({ action: 'slide' }) },
  { id: 'bolinha', label: 'Com a bolinha', carry: true, anim: () => ({ carrying: true, speed: 0.9 }) },
  { id: 'bebendo', label: 'Bebendo', anim: (t) => cycle('drink', t) },
  { id: 'comendo', label: 'Comendo', anim: (t) => cycle('eat', t) },
  { id: 'cavando', label: 'Cavando', anim: (t) => cycle('dig', t) },
  { id: 'espirro', label: 'Espirro', anim: (t) => cycle('sneeze', t) },
  { id: 'focinhada', label: 'Focinhada', anim: (t) => cycle('nudge', t) },
];

/** Vistas: giro lento ou o corpo parado num ângulo (yaw, rad; a câmera fica ao sul). */
export const VIEWS = [
  { id: 'girando', label: 'Girando', yaw: null },
  { id: 'lado', label: 'De lado', yaw: Math.PI / 2 },
  { id: 'frente', label: 'De frente', yaw: 0 },
  { id: 'tres-quartos', label: '3/4', yaw: Math.PI / 4 },
  { id: 'costas', label: 'De costas', yaw: Math.PI },
];

/**
 * Props do Canil (cenário em world.js).
 * @typedef {ReturnType<typeof createDisplay>} CanilDisplay
 * @typedef {import('../../types').LevelProps & { display: CanilDisplay, reset(): void }} CanilProps
 */

/** Bolinha de tênis para a pose "com a bolinha". */
function makeBall() {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), new THREE.MeshStandardMaterial({ color: '#d7e83a', roughness: 0.9 }));
  ball.name = 'ball';
  ball.castShadow = true;
  return ball;
}

/**
 * @param {{ root: THREE.Object3D, z: number, spots: { kind: import('../../types').DogName, model: 'v1' | 'v2', x: number }[] }} opts
 */
export function createDisplay({ root, z, spots }) {
  const object = new THREE.Group();
  object.name = 'vitrine';
  root.add(object);
  /** @type {{ kind: import('../../types').DogName, model: 'v1' | 'v2', dog: any, ball: THREE.Mesh, helper: THREE.SkeletonHelper }[]} */
  const dogs = [];
  const S = { pose: 'parada', view: 'girando', skeleton: false, wet: false, t: 0, spin: 0.4 };

  /** Monta as quatro dogs (uma vez). As malhas e a sombra são caches da aplicação: não saem com a fase. */
  function start() {
    if (dogs.length) return;
    for (const s of spots) {
      const dog = s.model === 'v2' ? createDogV2(s.kind) : createDog(s.kind);
      if (s.model === 'v1') for (const m of Object.values(dog.meshes)) shareResource(m.geometry);
      shareResource(contactShadowTexture());
      dog.object.name = `vitrine:${s.kind}:${s.model}`;
      dog.object.position.set(s.x, 0, z);
      object.add(dog.object);
      const helper = new THREE.SkeletonHelper(dog.object);
      helper.visible = false;
      object.add(helper);
      dogs.push({ kind: s.kind, model: s.model, dog, ball: makeBall(), helper });
    }
    apply();
  }

  /** Item na boca, pelo molhado e esqueleto conforme a escolha atual. */
  function apply() {
    const pose = POSES.find((p) => p.id === S.pose) || POSES[0];
    for (const e of dogs) {
      if (pose.carry && e.ball.parent !== e.dog.mouthSocket) e.dog.mouthSocket.add(e.ball);
      if (!pose.carry && e.ball.parent) e.ball.removeFromParent();
      e.dog.setWet(S.wet ? 1 : 0);
      e.helper.visible = S.skeleton;
    }
  }

  return {
    object,
    poses: POSES,
    views: VIEWS,
    start,
    /** @param {string} id */
    setPose(id) {
      if (!POSES.some((p) => p.id === id)) return false;
      S.pose = id;
      S.t = 0;
      apply();
      return true;
    },
    /** @param {string} id */
    setView(id) {
      if (!VIEWS.some((v) => v.id === id)) return false;
      S.view = id;
      return true;
    },
    /** @param {boolean} on */
    setSkeleton(on) {
      S.skeleton = !!on;
      apply();
    },
    /** @param {boolean} on */
    setWet(on) {
      S.wet = !!on;
      apply();
    },
    /** @param {number} dt */
    update(dt) {
      if (!dogs.length) return;
      const pose = POSES.find((p) => p.id === S.pose) || POSES[0];
      const view = VIEWS.find((v) => v.id === S.view) || VIEWS[0];
      const t0 = S.t;
      S.t += dt;
      if (view.yaw === null) S.spin += dt * 0.55;
      const yaw = view.yaw === null ? S.spin : view.yaw;
      const barkNow = pose.bark && Math.floor(S.t / pose.bark) !== Math.floor(t0 / pose.bark);
      for (const e of dogs) {
        e.dog.object.rotation.y = yaw;
        if (barkNow) e.dog.triggerBark();
        e.dog.update(dt, { speed: 0, turn: 0, action: 'none', ...pose.anim(S.t) });
      }
    },
    reset() {
      Object.assign(S, { pose: 'parada', view: 'girando', skeleton: false, wet: false, t: 0, spin: 0.4 });
      apply();
    },
    info() {
      return {
        pose: S.pose, view: S.view, skeleton: S.skeleton, wet: S.wet,
        dogs: dogs.map((e) => ({ kind: e.kind, model: e.model, bones: e.dog.bones.length, lowest: e.dog.lowest ?? null })),
      };
    },
  };
}
