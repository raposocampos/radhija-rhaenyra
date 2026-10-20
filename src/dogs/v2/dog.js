// Modelo novo das cachorrinhas (etapa 1 da troca dos modelos, docs/ARQUITETURA.md §7): mesma API de createDog
// (dog.js), com o esqueleto novo de 38 ossos (skeleton.js), o desenho revisto pelas fotos (design.js) e a malha na
// mesma base procedural (SDF → Surface Nets → SkinnedMesh com pesos automáticos + cascas de pelo).
// A base é a pose da animação atual (dogAnimation.js) num esqueleto atual invisível, copiada para o novo (retarget.js):
// todas as poses e extras do jogo, com o jeito aprovado. Por cima dela, em camadas (LAYERS, abaixo): a locomoção
// própria (gait.js: patas plantadas e firmes, passinhos de ajuste ao parar), a rolagem (roll.js) e a cabeça que desvia
// das paredes e dos móveis (head.js); depois, a pata e o corpo que não atravessam o chão (contacts.js) e a física das
// correntinhas: orelhas e rabo (physics.js).
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
import { createChainPhysics, designChains } from './physics.js';
import { createRollOverlay } from './roll.js';
import { createGait } from './gait.js';
import { createHeadAvoid } from './head.js';

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
  // orelhas e rabo com física (mola, inércia, gravidade e chão): reagem ao pulo, às curvas e ao rolar (o rabo, firme)
  const physics = createChainPhysics({ skel2, chains: designChains(skel2, design) });
  // rolar de costas: pose própria do modelo novo por cima da do guia (roll.js)
  const roll = createRollOverlay({ skel2, cfg });
  // andar, trotar, galopar e girar: patas próprias, plantadas no chão, no ritmo do guia (gait.js)
  const gait = createGait({ skel2, retarget, s });
  // a cabeça desvia das paredes e dos móveis do mundo da fase (setWorld): o desenho recua e o pescoço vira (head.js)
  const head = createHeadAvoid({ skel2, retarget, design, s, hs: P.hs, cfg });
  /** @type {import('../../types').CollisionWorld | null} */
  let world = null;
  /**
   * Camadas por cima da base (as poses do modelo atual), em ordem; cada uma mexe nos ossos dela e devolve o peso
   * aplicado no quadro (0 = nada; self.layers guarda os pesos):
   *   · cabeça (head.js): perto de uma parede ou móvel, o desenho inteiro recua e o pescoço e a cabeça viram (antes da
   *     locomoção, para as patas plantadas darem os passos do recuo);
   *   · locomoção (gait.js): patas e escápula quando ela anda, trota, galopa ou gira (fora das poses do guia);
   *   · rolagem (roll.js): o corpo inteiro enquanto o extra 'roll' roda.
   * Depois delas vêm a pata que não atravessa o chão, o contato do corpo com o chão (settle) e a física das
   * correntinhas (orelhas e rabo). O peito e a garupa ficam fora das paredes pela colisão do jogo (resolveBody).
   * @type {{ name: string, apply: (dt: number, A: import('../../types').DogAnim) => number }[]}
   */
  const LAYERS = [
    { name: 'head', apply: (dt, A) => head.apply(dt, A, inner, object, world) },
    { name: 'gait', apply: (dt, A) => gait.apply(dt, A, st, inner, object) },
    { name: 'roll', apply: (dt, A) => roll.apply(A.extra, inner) },
  ];

  const I2 = BONE_INDEX_V2;
  const _pv = new THREE.Vector3(), _pf = new THREE.Vector3(), _ph = new THREE.Vector3(), _pc = new THREE.Vector3();
  const _qx = new THREE.Quaternion();
  const _X = new THREE.Vector3(1, 0, 0);
  /** Posição do osso i no referencial do objeto (com o corpo como está agora). */
  const toObject = (out, i) => out.copy(retarget.P2[i]).applyQuaternion(inner.quaternion).add(inner.position);
  /** Meio de duas patas no referencial do objeto. */
  const pair = (out, a, b) => toObject(out, a).add(toObject(_pc, b)).multiplyScalar(0.5);
  /**
   * A pata não atravessa o chão: se a almofadinha afundaria (os dedos dobrados num passo baixo, por exemplo na volta
   * do empurrão em pé), a pata gira no tornozelo até ficar rente ao chão, em vez de o corpo inteiro subir. Só a pata
   * gira (ela não tem ossos filhos): o resto da pose não muda.
   */
  const PAW_IDX = [I2.FLp, I2.FRp, I2.HLp, I2.HRp];
  const pawContacts = PAW_IDX.map((i) => contacts.filter((k) => k.i === i));
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
  /** O ponto mais baixo da pata j com ela girada `ang` (rad, no eixo de lado do corpo) a partir da rotação _qa. */
  function pawLow(j, ang) {
    retarget.Q2[PAW_IDX[j]].copy(_qb.setFromAxisAngle(_X, ang).multiply(_qa));
    return lowestPoint(pawContacts[j], retarget.P2, retarget.Q2, inner.position, inner.quaternion);
  }
  function pawGuard() {
    self.pawFix = 0;
    for (let j = 0; j < 4; j++) {
      const i = PAW_IDX[j];
      _qa.copy(retarget.Q2[i]);
      const low0 = lowestPoint(pawContacts[j], retarget.P2, retarget.Q2, inner.position, inner.quaternion);
      if (low0 >= -GROUND_TOLERANCE) continue;
      // para que lado girar sobe a almofadinha; quanto girar (duas aproximações, no máximo 0,8 rad)
      const target = -GROUND_TOLERANCE * 0.75;
      const up = pawLow(j, 0.12), dn = pawLow(j, -0.12);
      const dir = up >= dn ? 1 : -1;
      const slope = (Math.max(up, dn) - low0) / 0.12;
      let ang = 0;
      if (slope > 1e-4) {
        ang = dir * Math.min(0.8, (target - low0) / slope);
        const low = pawLow(j, ang);
        if (low < target) ang = dir * Math.min(0.8, Math.abs(ang) + (target - low) / slope);
      }
      pawLow(j, ang);
      bones[i].quaternion.copy(retarget.Q2[skel2.parentIdx[i]]).invert().multiply(retarget.Q2[i]);
      self.pawFix = Math.max(self.pawFix, Math.abs(ang));
    }
  }

  /** Giro e subida aplicados pela correção do chão: mudam no máximo um tanto por quadro (sem tremer o corpo). */
  let tiltS = 0, liftS = 0, tiltFront = true;
  const TILT_STEP = 0.5 * Math.PI / 180, LIFT_UP = 0.002, LIFT_DOWN = 0.001; // por quadro a 60 qps
  /**
   * Nada do corpo passa do chão. Se a pose afundaria (a garupa da Rhaenyra sentada, por exemplo), o corpo primeiro
   * gira sobre as patas que estão apoiadas do outro lado (sentada: as da frente ficam no chão e a garupa sobe); o que
   * ainda faltar, o corpo inteiro sobe. O giro e a subida mudam aos poucos (no máximo 0,5° e 2 mm por quadro): uma
   * pata que encosta no chão por um quadro não faz o corpo inteiro saltar. rest (0..1): rolando, o corpo fica apoiado
   * no chão (`floor`, a altura do monte quando houver): a altura vem do ponto mais baixo, para cima ou para baixo.
   */
  function settle(rest = 0, floor = 0, dt = 1 / 60) {
    let low = lowestPoint(contacts, retarget.P2, retarget.Q2, inner.position, inner.quaternion);
    if (rest > 0) {
      inner.position.y += (floor - low) * rest;
      low += (floor - low) * rest;
    }
    low -= floor;
    self.lowest = low;
    self.lowestBone = bones[lowestPoint.bone]?.name ?? '';
    const k = Math.max(dt, 1e-3) * 60;
    // giro que a pose pede (sobre as patas apoiadas do outro lado)
    let want = 0;
    if (low < -GROUND_TOLERANCE) {
      const lz = toObject(_pv, lowestPoint.bone).z;
      const mid = toObject(_pc, I2.body).z;
      const front = lz < mid;
      const pivot = front ? pair(_pf, I2.FLp, I2.FRp) : pair(_ph, I2.HLp, I2.HRp);
      const arm = Math.abs(lz - pivot.z);
      if (pivot.y < 0.035 * s && arm > 0.08) {
        want = Math.atan2(-GROUND_TOLERANCE - low, arm) * (lz < pivot.z ? 1 : -1);
        tiltFront = front;
      }
    }
    tiltS += clamp(want - tiltS, -TILT_STEP * k, TILT_STEP * k);
    if (Math.abs(tiltS) < 1e-5) tiltS = 0;
    if (tiltS) {
      const pivot = tiltFront ? pair(_pf, I2.FLp, I2.FRp) : pair(_ph, I2.HLp, I2.HRp);
      _qx.setFromAxisAngle(_X, tiltS);
      inner.position.sub(pivot).applyQuaternion(_qx).add(pivot);
      inner.quaternion.premultiply(_qx);
      low = lowestPoint(contacts, retarget.P2, retarget.Q2, inner.position, inner.quaternion) - floor;
    }
    self.tilt = tiltS;
    // o que ainda faltar, o corpo inteiro sobe (e desce de volta devagar)
    liftS += clamp(Math.max(0, -GROUND_TOLERANCE - low) - liftS, -LIFT_DOWN * k, LIFT_UP * k);
    if (liftS < 1e-6) liftS = 0;
    self.lift = liftS;
    inner.position.y += liftS;
  }

  /** @param {number} dt @param {import('../../types').DogAnim} [anim] */
  const update = (dt, anim) => {
    animate(dt, anim);
    inner.position.copy(driverInner.position);
    inner.quaternion.copy(driverInner.quaternion);
    retarget.apply();
    const A = anim || {};
    let any = 0;
    for (const L of LAYERS) any = Math.max(any, (self.layers[L.name] = L.apply(dt, A)));
    self.gait = self.layers.gait;
    self.overlay = self.layers.roll;
    // a sombra e o marcador acompanham o desenho recuado (o marcador vem suavizado do guia: 0,2 por quadro)
    shadow.position.z -= head.info.back * 0.9;
    markerAnchor.position.z -= head.info.back * 0.2;
    if (any > 0) retarget.refresh();
    pawGuard();
    // o monte (anim.jump) só vale como chão para a rolagem: no escorregador e no pulo o chão continua o do objeto
    settle(self.overlay, self.overlay > 0 ? Math.max(0, anim?.jump || 0) : 0, dt);
    physics.update(dt, { P: retarget.P2, Q: retarget.Q2, inner, object, floorY: object.position.y });
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
    /** Quanto a pata mais girada no tornozelo para não atravessar o chão (rad), no último quadro. */
    pawFix: 0,
    /** Peso da locomoção própria (gait.js) nas patas, no último quadro (0..1), e o estado dela (testes e capturas). */
    gait: 0,
    locomotion: gait,
    /** Peso de cada camada (LAYERS) no último quadro. */
    layers: { head: 0, gait: 0, roll: 0 },
    /** Cabeça que desvia: recuo do desenho e giro da cabeça no último quadro (head.info) e os pontos de contato. */
    head,
    /** O mundo de colisão da fase (paredes e móveis de que a cabeça desvia); null fora de uma fase. */
    setWorld(w) {
      world = w || null;
      head.reset();
    },
    /** Física das orelhas e do rabo (testes: physics.tip('tail')). */
    physics,
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
