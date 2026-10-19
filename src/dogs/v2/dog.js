// Modelo novo das cachorrinhas (etapa 1 da troca dos modelos, docs/ARQUITETURA.md §7): mesma API de createDog
// (dog.js), com o esqueleto novo de 38 ossos (skeleton.js), o desenho revisto pelas fotos (design.js) e a malha na
// mesma base procedural (SDF → Surface Nets → SkinnedMesh com pesos automáticos + cascas de pelo).
// A pose vem da animação atual (dogAnimation.js) num esqueleto atual invisível, copiada para o novo (retarget.js);
// por cima dela o modelo novo tem a locomoção própria (gait.js: patas plantadas, que rolam, escápula, passinhos de
// ajuste ao parar) e a rolagem (roll.js), e garante que nada do corpo passa do chão (contacts.js).
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
import { createEarPhysics } from './physics.js';
import { createRollOverlay } from './roll.js';
import { createGait } from './gait.js';

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
  const G = buildGeometryFromDesign(design, P, { shells, boneIndex: BONE_INDEX_V2, exactBounds: true });
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
  // orelha: lâmina fina; desenhada dos dois lados para nunca deixar ver o que está atrás dela
  const earMat = createSkinMaterial({ bodyColor: P.colors.body, wetU, mudU });
  earMat.side = THREE.DoubleSide;
  const furMat = createFurMaterial({ strandFreq: P.strandFreq / s, gravity: 0.32, mud: mudU });
  const bodyMesh = new THREE.SkinnedMesh(G.bodyGeo, skinMat);
  const earMesh = new THREE.SkinnedMesh(G.earGeo, earMat);
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
    // andando com a locomoção própria (gait.js), as pisadas saem de lá, no pouso de cada pata
    onFootstep: (i, v) => {
      if (self.gait <= 0.5) self.onFootstep?.(i, v);
    },
  });
  const retarget = createRetarget({ rig1, design1, design2: design, skel2 });
  // contato com o chão: tronco, cabeça e patas (rabo e orelhas caem por cima do chão sem levantar o corpo)
  const contacts = groundContacts(design, BONE_INDEX_V2, skel2.rest, { skip: ['tail', 'ear'] });
  // orelhas com física (mola, inércia, gravidade e chão): reagem ao pulo, às curvas e ao rolar
  const earPhysics = createEarPhysics({ skel2, design });
  // rolar de costas: pose própria do modelo novo por cima da do guia (roll.js)
  const roll = createRollOverlay({ skel2, cfg });
  // andar, trotar, galopar e girar: patas próprias, plantadas no chão, no ritmo do guia (gait.js)
  const gait = createGait({ skel2, retarget, s });

  const I2 = BONE_INDEX_V2;
  const _pv = new THREE.Vector3(), _pf = new THREE.Vector3(), _ph = new THREE.Vector3(), _pc = new THREE.Vector3();
  const _qx = new THREE.Quaternion();
  const _X = new THREE.Vector3(1, 0, 0);
  /** Posição do osso i no referencial do objeto (com o corpo como está agora). */
  const toObject = (out, i) => out.copy(retarget.P2[i]).applyQuaternion(inner.quaternion).add(inner.position);
  /** Meio de duas patas no referencial do objeto. */
  const pair = (out, a, b) => toObject(out, a).add(toObject(_pc, b)).multiplyScalar(0.5);
  /**
   * Nada do corpo passa do chão. Se a pose afundaria (a garupa da Rhaenyra sentada, por exemplo), o corpo primeiro
   * gira sobre as patas que estão apoiadas do outro lado (sentada: as da frente ficam no chão e a garupa sobe); o que
   * ainda faltar, o corpo inteiro sobe. rest (0..1): rolando, o corpo fica apoiado no chão (`floor`, a altura do monte
   * quando houver): a altura vem do ponto mais baixo, para cima ou para baixo.
   */
  function settle(rest = 0, floor = 0) {
    let low = lowestPoint(contacts, retarget.P2, retarget.Q2, inner.position, inner.quaternion);
    if (rest > 0) {
      inner.position.y += (floor - low) * rest;
      low += (floor - low) * rest;
    }
    low -= floor;
    self.lowest = low;
    self.lowestBone = bones[lowestPoint.bone]?.name ?? '';
    self.tilt = 0;
    self.lift = 0;
    if (low >= -GROUND_TOLERANCE) return;
    const lz = toObject(_pv, lowestPoint.bone).z;
    const mid = toObject(_pc, I2.body).z;
    const pivot = lz < mid ? pair(_pf, I2.FLp, I2.FRp) : pair(_ph, I2.HLp, I2.HRp);
    const arm = Math.abs(lz - pivot.z);
    if (pivot.y < 0.035 * s && arm > 0.08) {
      const th = Math.atan2(-GROUND_TOLERANCE - low, arm) * (lz < pivot.z ? 1 : -1);
      _qx.setFromAxisAngle(_X, th);
      inner.position.sub(pivot).applyQuaternion(_qx).add(pivot);
      inner.quaternion.premultiply(_qx);
      self.tilt = th;
      low = lowestPoint(contacts, retarget.P2, retarget.Q2, inner.position, inner.quaternion) - floor;
    }
    if (low < -GROUND_TOLERANCE) {
      self.lift = -GROUND_TOLERANCE - low;
      inner.position.y += self.lift;
    }
  }

  /** @param {number} dt @param {import('../../types').DogAnim} [anim] */
  const update = (dt, anim) => {
    animate(dt, anim);
    inner.position.copy(driverInner.position);
    inner.quaternion.copy(driverInner.quaternion);
    retarget.apply();
    self.gait = gait.apply(dt, anim || {}, st, inner, object);
    self.overlay = roll.apply(anim?.extra, inner);
    if (self.gait > 0 || self.overlay > 0) retarget.refresh();
    // o monte (anim.jump) só vale como chão para a rolagem: no escorregador e no pulo o chão continua o do objeto
    settle(self.overlay, self.overlay > 0 ? Math.max(0, anim?.jump || 0) : 0);
    earPhysics.update(dt, { P: retarget.P2, Q: retarget.Q2, inner, object, floorY: object.position.y });
    mudU.uTime.value = st.t;
    // pisadas da locomoção própria, com a pose do quadro pronta (a pegada sai onde a pata pousou)
    for (const [i, v] of gait.takeSteps()) self.onFootstep?.(i, v);
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
    /**
     * Ponto mais baixo do corpo no último quadro (m, antes da correção do chão), o osso dele, o giro sobre as patas
     * apoiadas (rad) e a subida do corpo inteiro (m) aplicados.
     */
    lowest: 0,
    lowestBone: '',
    /** Peso da pose própria do modelo novo (a rolagem) sobre a do guia, no último quadro (0..1). */
    overlay: 0,
    /** Peso da locomoção própria (gait.js) nas patas, no último quadro (0..1), e o estado dela (testes e capturas). */
    gait: 0,
    locomotion: gait,
    tilt: 0,
    lift: 0,
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
      for (const m of [skinMat, earMat]) {
        m.roughness = lerp(0.8, 0.42, st.wet);
        m.sheen = lerp(1.0, 0.35, st.wet);
      }
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
