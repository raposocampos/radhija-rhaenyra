// Material da pele do modelo novo: o mesmo do modelo atual (dog.js), em função própria para o v2 não depender da
// montagem do atual. Quando o modelo novo substituir o atual nas fases, dog.js passa a usar esta função.
import * as THREE from 'three';
import { MUD_GLSL } from '../mudShader.js';

/**
 * Pele com cor por vértice, brilho aveludado e "subsurface" barato; molhada (wetU 0..1) escurece e brilha; lama e
 * brilho de limpinha pelos uniforms de mudShader.js (os mesmos do pelo).
 * @param {{ bodyColor: string, wetU: { value: number }, mudU: Record<string, any> }} opts
 */
export function createSkinMaterial({ bodyColor, wetU, mudU }) {
  const skinMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0,
    sheen: 1.0,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(bodyColor).multiplyScalar(0.55),
  });
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
  // mesmo programa do modelo atual (shader idêntico)
  skinMat.customProgramCacheKey = () => 'dogSkin_v4';
  return skinMat;
}
