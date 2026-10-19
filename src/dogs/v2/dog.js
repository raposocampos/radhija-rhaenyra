// Modelo novo das cachorrinhas (etapa 1 da troca dos modelos, docs/ARQUITETURA.md §7): mesma API de createDog
// (dog.js), com o esqueleto novo de 38 ossos (skeleton.js), o desenho revisto pelas fotos (design.js) e a malha na
// mesma base procedural (SDF → Surface Nets → SkinnedMesh com pesos automáticos + cascas de pelo).
// Por enquanto a pose vem da animação atual (dogAnimation.js) num esqueleto atual invisível, copiada para o novo
// (retarget.js); o modelo novo ainda garante que nada do corpo passa do chão (contacts.js).
// No jogo: ?dogs=novo troca as duas dogs pelo modelo novo (main.js); a arena ?level=canil mostra os dois lado a lado.
import * as THREE from 'three';
import { DOG_CONFIG } from '../config.js';
import { DOG_PARAMS, buildDesign, buildGeometryFromDesign } from '../dogModel.js';
import { createFurMaterial } from '../furMaterial.js';
import { MAX_CLEAN, createMudUniforms } from '../mudShader.js';
import { createDogRig } from '../dogRig.js';
import { createDogFace } from '../dogFace.js';
import { createCarrySocket } from '../carryPose.js';
import { createDogAnimation, clamp, lerp } from '../dogAnimation.js';
import { contactShadowTexture } from '../contactShadow.js';
import { shareResource } from '../../core/resources.js';
import { BONE_INDEX_V2, createSkeletonV2 } from './skeleton.js';
import { buildDesignV2, paramsV2 } from './design.js';
import { createSkinMaterial } from './materials.js';
import { createRetarget } from './retarget.js';
import { groundContacts, lowestPoint } from './contacts.js';

/**
 * Quanto as formas de contato podem passar do chão antes de o corpo ser levantado (m). As formas já levam a folga da
 * união suave (contacts.js): a almofadinha da pata encostada no chão fica dentro da tolerância.
 */
export const GROUND_TOLERANCE = 0.004;

const cache = new Map();
/** Malhas do modelo novo (uma vez por dog; vivem com a aplicação, como as do atual). */
export function buildDogGeometryV2(kind, { shells = 10 } = {}) {
  if (cache.has(kind)) return cache.get(kind);
  const P = paramsV2(kind);
  const design = buildDesignV2(P);
  const G = buildGeometryFromDesign(design, P, { shells, boneIndex: BONE_INDEX_V2 });
  for (const g of [G.bodyGeo, G.earGeo, G.furGeo]) shareResource(g);
  cache.set(kind, G);
  return G;
}

/**
 * @param {import('../../types').DogName} kind
 * @returns {import('../../types').DogModel & { model: 'v2', lowest: number, driver: { rig: any, inner: THREE.Group } }}
 */
export function createDogV2(kind) {
  const cfg = DOG_CONFIG[kind];
  const G = buildDogGeometryV2(kind);
  const { P, design } = G;
  const s = P.s;

  const object = new THREE.Group();
  object.name = kind;
  const inner = new THREE.Group(); // giro/pulos da comemoração (cópia do corpo do esqueleto guia)
  object.add(inner);

  // ------------------------------------------------------------------ esqueleto novo
  const skel2 = createSkeletonV2(design, inner);
  const { bones, skeleton } = skel2;

  // ------------------------------------------------------------------ materiais e malhas
  const wetU = { value: 0 };
  const mudU = createMudUniforms();
  const skinMat = createSkinMaterial({ bodyColor: P.colors.body, wetU, mudU });
  const furMat = createFurMaterial({ strandFreq: P.strandFreq / s, gravity: 0.32, mud: mudU });
  const bodyMesh = new THREE.SkinnedMesh(G.bodyGeo, skinMat);
  const earMesh = new THREE.SkinnedMesh(G.earGeo, skinMat);
  const furMesh = new THREE.SkinnedMesh(G.furGeo, furMat);
  for (const m of [bodyMesh, earMesh, furMesh]) {
    m.bind(skeleton);
    m.frustumCulled = false;
    inner.add(m);
  }
  bodyMesh.castShadow = earMesh.castShadow = true;
  bodyMesh.receiveShadow = earMesh.receiveShadow = furMesh.receiveShadow = true;
  furMesh.renderOrder = 1;

  // ------------------------------------------------------------------ rosto e boca (filhos do osso da cabeça)
  const headBone = bones[BONE_INDEX_V2.head];
  const headRest = skel2.rest[BONE_INDEX_V2.head];
  const toHead = (p) => new THREE.Vector3(p[0], p[1], p[2]).sub(headRest);
  const face = createDogFace({ headBone, toHead, design, s, P });
  const carry = createCarrySocket({ kind, headBone, toHead, design, s, P });
  const { mouthSocket } = carry;

  const markerAnchor = new THREE.Object3D();
  markerAnchor.position.set(0, cfg.visual.headTop + 0.14, design.face.Hc[2]);
  object.add(markerAnchor);

  // sombra de contato
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: shareResource(contactShadowTexture()),
      color: 0x2a1a0c,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  shadow.position.y = 0.004;
  shadow.renderOrder = -1;
  object.add(shadow);
  const shadowBase = { x: 0.3 * s, z: cfg.visual.length * 1.05 };

  // ------------------------------------------------------------------ guia: esqueleto atual + animação atual
  const P1 = DOG_PARAMS[kind];
  const design1 = buildDesign(P1);
  const driverInner = new THREE.Group();
  const rig1 = createDogRig(design1, driverInner);
  const { st, update: animate } = createDogAnimation({
    object, inner: driverInner, cfg, s, rig: rig1, face, carry, furMat, shadow, shadowBase, markerAnchor, design: design1, fur: P1.fur,
    onFootstep: (i) => self.onFootstep?.(i),
  });
  const retarget = createRetarget({ rig1, design1, design2: design, skel2 });
  // contato com o chão: tronco, cabeça e patas (rabo e orelhas caem por cima do chão sem levantar o corpo)
  const contacts = groundContacts(design, BONE_INDEX_V2, skel2.rest, { skip: ['tail', 'ear'] });

  /** @param {number} dt @param {import('../../types').DogAnim} [anim] */
  const update = (dt, anim) => {
    animate(dt, anim);
    inner.position.copy(driverInner.position);
    inner.quaternion.copy(driverInner.quaternion);
    retarget.apply();
    // nada do corpo passa do chão: se a pose afundou, o corpo sobe o que faltou
    self.lowest = lowestPoint(contacts, retarget.P2, retarget.Q2, inner.position, inner.quaternion);
    if (self.lowest < -GROUND_TOLERANCE) inner.position.y += -GROUND_TOLERANCE - self.lowest;
    mudU.uTime.value = st.t;
  };

  const self = {
    kind,
    /** @type {'v2'} */
    model: 'v2',
    object,
    mouthSocket,
    markerAnchor,
    /** (índice da pata 0..3) → chamado a cada pisada; o jogo liga aos passos/sons. */
    onFootstep: null,
    stats: { ...G.stats, bones: bones.length },
    bones,
    skeleton,
    meshes: { body: bodyMesh, ears: earMesh, fur: furMesh },
    /** Ponto mais baixo do corpo no último quadro (m, antes da correção do chão). */
    lowest: 0,
    /** Esqueleto guia (atual, sem malha): testes e capturas comparam com ele. */
    driver: { rig: rig1, inner: driverInner },
    update,
    triggerBark() {
      st.bark = 0;
    },
    setCarryPose(k) {
      carry.setForced(k);
    },
    get carryKind() { return carry.kind; },
    setWet(k) {
      st.wet = clamp(k || 0, 0, 1);
      wetU.value = st.wet;
      furMat.userData.uniforms.uWet.value = st.wet;
      skinMat.roughness = lerp(0.8, 0.42, st.wet);
      skinMat.sheen = lerp(1.0, 0.35, st.wet);
      furMat.roughness = lerp(0.92, 0.5, st.wet);
    },
    setMud(k, clean = []) {
      st.mud = clamp(k || 0, 0, 1);
      mudU.uMud.value = st.mud;
      const last = clean.slice(-MAX_CLEAN);
      mudU.uClean.value.forEach((slot, i) => {
        const c = last[i];
        if (c) slot.set(c.x, c.y, c.z, c.r);
        else slot.set(0, 0, 0, 0);
      });
    },
    setShine(k) {
      mudU.uShine.value = clamp(k || 0, 0, 1);
    },
    get mud() { return st.mud; },
  };

  // pose inicial
  for (let i = 0; i < rig1.nB; i++) rig1.Lq[i].identity();
  rig1.Wp[0].copy(rig1.rest[0]);
  update(1 / 60, { speed: 0, action: 'none' });
  return self;
}
