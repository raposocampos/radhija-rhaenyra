// "Ver através": recorta com pontilhado os fragmentos que ficam entre a câmera e as dogs
// (cerca, portão), para que nenhum obstáculo esconda as personagens.
import * as THREE from 'three';

const uniforms = {
  uSTA: { value: new THREE.Vector4(0, -100, 0, 0.42) }, // xyz = alvo, w = raio
  uSTB: { value: new THREE.Vector4(0, -100, 0, 0.32) },
};

export function applySeeThrough(material) {
  if (material.userData.seeThrough) return;
  material.userData.seeThrough = true;
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (sh, r) => {
    prev?.call(material, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSTWorld;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 stp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            stp = instanceMatrix * stp;
          #endif
          vSTWorld = (modelMatrix * stp).xyz; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSTWorld;
        uniform vec4 uSTA; uniform vec4 uSTB;
        float stMask(vec4 tgt) {
          vec3 d = tgt.xyz - cameraPosition;
          float t = dot(vSTWorld - cameraPosition, d) / max(dot(d, d), 1e-4);
          if (t <= 0.0 || t >= 0.96) return 0.0;
          float dist = length(vSTWorld - (cameraPosition + d * t));
          return 1.0 - smoothstep(tgt.w * 0.55, tgt.w, dist);
        }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        { float m = max(stMask(uSTA), stMask(uSTB) * 0.8);
          float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          if (ign < m * 0.82) discard; }`);
  };
  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|seeThrough`;
  material.needsUpdate = true;
}

/** Aplica a todos os materiais de malhas dentro dos objetos dados. */
export function applySeeThroughTo(...roots) {
  for (const root of roots) {
    root?.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) applySeeThrough(m);
    });
  }
}

/** A cada quadro: alvo A = dog ativa, B = companheira (no meio do corpo). */
export function updateSeeThrough(dogs, activeName) {
  const other = activeName === 'radhija' ? 'rhaenyra' : 'radhija';
  const a = dogs[activeName]?.object.position;
  const b = dogs[other]?.object.position;
  if (a) uniforms.uSTA.value.set(a.x, 0.25, a.z, 0.42);
  if (b) uniforms.uSTB.value.set(b.x, 0.25, b.z, 0.34);
}
