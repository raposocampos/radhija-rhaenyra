// Cachorrinhas procedurais — Radhija & Rhaenyra.
// Malha: SDF (união suave) → Surface Nets → SkinnedMesh com pesos automáticos + cascas de pelo.
// Animação: procedural (trote com pés plantados via IK, galope na arrancada, ações do jogo).
// Este arquivo monta a dog e expõe a API pública (docs/ARQUITETURA.md, "Personagens"); as partes moram em:
//   dogModel.js (geometria) · furMaterial.js (pelo) · dogRig.js (esqueleto, FK/IK) · dogFace.js (rosto)
//   carryPose.js (item na boca) · dogAnimation.js (pose a cada quadro) · contactShadow.js (sombra)
import * as THREE from 'three';
import { DOGS } from '../levels/fase1/layout.js';
import { buildDogGeometry } from './dogModel.js';
import { createFurMaterial } from './furMaterial.js';
import { createDogRig } from './dogRig.js';
import { createDogFace } from './dogFace.js';
import { createCarrySocket } from './carryPose.js';
import { createDogAnimation, clamp, lerp } from './dogAnimation.js';
import { contactShadowTexture } from './contactShadow.js';

export { createPlushCarrot } from './plushCarrot.js';

/**
 * @param {import('../types').DogName} kind
 * @returns {import('../types').DogModel}
 */
export function createDog(kind) {
  const cfg = DOGS[kind];
  const G = buildDogGeometry(kind);
  const { P, design } = G;
  const s = P.s;

  const object = new THREE.Group();
  object.name = kind;
  const inner = new THREE.Group(); // giro/pulos da comemoração
  object.add(inner);

  // ------------------------------------------------------------------ esqueleto
  const rig = createDogRig(design, inner);
  const { bones, skeleton, BI, rest } = rig;

  // ------------------------------------------------------------------ materiais e malhas
  const skinMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0,
    sheen: 1.0,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(P.colors.body).multiplyScalar(0.55),
  });
  // "subsurface" barato: um pouco da cor base volta como emissão quente (pele clara não fica azulada na sombra)
  const wetU = { value: 0 }; // 0..1 molhada: pele mais escura e brilhante
  skinMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWet = wetU;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWet;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(1.0, 0.7, uWet);')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3(0.16, 0.12, 0.08) * (1.0 - 0.45 * uWet);',
      );
  };
  skinMat.customProgramCacheKey = () => 'dogSkin_v2';
  const furMat = createFurMaterial({ strandFreq: P.strandFreq / s, gravity: 0.32 });
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
  const headBone = bones[BI.head];
  const headRest = rest[BI.head];
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
      map: contactShadowTexture(),
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

  // ------------------------------------------------------------------ animação
  const { st, update } = createDogAnimation({
    object, inner, cfg, s, rig, face, carry, furMat, shadow, shadowBase, markerAnchor,
    onFootstep: (i) => self.onFootstep?.(i),
  });

  const self = {
    kind,
    object,
    mouthSocket,
    markerAnchor,
    /** (índice da pata 0..3) → chamado a cada pisada; o jogo liga aos passos/sons. */
    onFootstep: null,
    stats: G.stats,
    bones,
    skeleton,
    meshes: { body: bodyMesh, ears: earMesh, fur: furMesh },
    update,
    triggerBark() {
      st.bark = 0;
    },
    /** Força a pose do item na boca: 'carrot' | 'ball' | 'slipper' | 'duck' | 'bear' | null (automático). */
    setCarryPose(kind) {
      carry.setForced(kind);
    },
    get carryKind() { return carry.kind; },
    /** Pelo molhado 0..1 (escuro, murcho e brilhante). O decaimento fica com src/game/mechanics/dogEffects.js. */
    setWet(k) {
      st.wet = clamp(k || 0, 0, 1);
      wetU.value = st.wet;
      furMat.userData.uniforms.uWet.value = st.wet;
      skinMat.roughness = lerp(0.8, 0.42, st.wet);
      skinMat.sheen = lerp(1.0, 0.35, st.wet);
      furMat.roughness = lerp(0.92, 0.5, st.wet);
    },
  };

  // pose inicial
  for (let i = 0; i < rig.nB; i++) rig.Lq[i].identity();
  rig.Wp[0].copy(rest[0]);
  update(1 / 60, { speed: 0, action: 'none' });
  return self;
}
