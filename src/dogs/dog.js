// Cachorrinhas procedurais — Radhija & Rhaenyra.
// Malha: SDF (união suave) → Surface Nets → SkinnedMesh com pesos automáticos + cascas de pelo.
// Animação: procedural (trote com pés plantados via IK, galope na arrancada, ações do jogo).
// Este arquivo monta a dog e expõe a API pública (docs/ARQUITETURA.md, "Personagens"); as partes moram em:
//   dogModel.js (geometria) · furMaterial.js (pelo) · dogRig.js (esqueleto, FK/IK) · dogFace.js (rosto)
//   carryPose.js (item na boca) · dogAnimation.js (pose a cada quadro) · contactShadow.js (sombra)
import * as THREE from 'three';
import { DOG_CONFIG } from './config.js';
import { buildDogGeometry } from './dogModel.js';
import { createFurMaterial } from './furMaterial.js';
import { MUD_GLSL, MAX_CLEAN, createMudUniforms } from './mudShader.js';
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
  const cfg = DOG_CONFIG[kind];
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
  // Lama e brilho de limpinha (mudShader.js): os mesmos uniforms na pele e no pelo.
  const mudU = createMudUniforms();
  skinMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWet = wetU;
    Object.assign(sh.uniforms, mudU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMudP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMudP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uWet;\nvarying vec3 vMudP;\nfloat gMud;\n${MUD_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb *= mix(1.0, 0.7, uWet);
        gMud = mudMask(vMudP);
        diffuseColor.rgb = mix(diffuseColor.rgb, mudColor(vMudP), gMud * 0.96);`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.2, gMud * (0.4 + 0.6 * mudCore));')
      // o brilho aveludado do pelo (sheen) deixaria a lama acinzentada: some onde há lama
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_SHEEN\n material.sheenColor *= 1.0 - gMud;\n#endif')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * (vec3(0.16, 0.12, 0.08) * (1.0 - 0.45 * uWet) + 0.1 * uShine);',
      );
  };
  skinMat.customProgramCacheKey = () => 'dogSkin_v4';
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
  const { st, update: animate } = createDogAnimation({
    object, inner, cfg, s, rig, face, carry, furMat, shadow, shadowBase, markerAnchor, design, fur: P.fur,
    onFootstep: (i) => self.onFootstep?.(i),
  });
  /** @param {number} dt @param {import('../types').DogAnim} [anim] */
  const update = (dt, anim) => {
    animate(dt, anim);
    mudU.uTime.value = st.t;
  };

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
    /** Força a pose do item na boca: 'carrot' | 'ball' | 'slipper' | 'duck' | 'bear' | 'frisbee' | 'sock' | 'glasses' | 'book' | 'hat' | 'ribbon' | 'candle' | 'rope' | null (automático). */
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
    /**
     * Lama 0..1 (some em placas conforme cai) e pontos já limpos { x, y, z, r } no referencial da dog
     * (onde a irmã lambeu). O estado do jogo fica em src/game/mechanics/mud.js.
     * @param {number} k @param {{ x: number, y: number, z: number, r: number }[]} [clean]
     */
    setMud(k, clean = []) {
      st.mud = clamp(k || 0, 0, 1);
      mudU.uMud.value = st.mud;
      const last = clean.slice(-MAX_CLEAN); // os mais recentes
      mudU.uClean.value.forEach((slot, i) => {
        const c = last[i];
        if (c) slot.set(c.x, c.y, c.z, c.r);
        else slot.set(0, 0, 0, 0);
      });
    },
    /** Brilho de pelo limpinho 0..1 (o feedback faz o brilho sumir aos poucos). */
    setShine(k) {
      mudU.uShine.value = clamp(k || 0, 0, 1);
    },
    get mud() { return st.mud; },
  };

  // pose inicial
  for (let i = 0; i < rig.nB; i++) rig.Lq[i].identity();
  rig.Wp[0].copy(rest[0]);
  update(1 / 60, { speed: 0, action: 'none' });
  return self;
}
