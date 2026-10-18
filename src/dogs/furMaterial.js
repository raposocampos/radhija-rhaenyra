// Material de pelo por cascas (shells): cada casca é extrudada ao longo da normal já com skinning,
// com leve gravidade; alpha vem de ruído 3D na posição de repouso (fios contínuos entre cascas).
// Lama e brilho de limpinha: mudShader.js (uniforms compartilhados com a pele, passados em `mud`).
import * as THREE from 'three';
import { MUD_GLSL, createMudUniforms } from './mudShader.js';

export function createFurMaterial({ strandFreq = 400, gravity = 0.35, base = 0.0015, mud = createMudUniforms() } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const uniforms = {
    uFreq: { value: strandFreq },
    uGravity: { value: gravity },
    uBase: { value: base },
    uWind: { value: new THREE.Vector3() }, // deslocamento extra das pontas (ex.: arrancada)
    uWet: { value: 0 }, // 0..1 molhado: pelo curto, caído, grudado em mechas e mais escuro
    ...mud, // uMud, uClean, uShine, uTime (lama em placas e brilho de limpinha)
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aShell;
        attribute float aFur;
        attribute float aGrav;
        uniform float uGravity;
        uniform float uBase;
        uniform vec3 uWind;
        uniform float uWet;
        varying float vShell;
        varying float vFur;
        varying vec3 vRest;
        ${MUD_GLSL}`,
      )
      .replace(
        '#include <skinning_vertex>',
        `vRest = position;
        #include <skinning_vertex>
        {
          float hh = aShell;
          vec3 nrmF = normalize(objectNormal);
          float mudV = mudMask(position); // enlameado: pelo grudado, curto e caído
          float fl = aFur * (1.0 - 0.55 * uWet) * (1.0 - 0.5 * mudV);
          transformed += nrmF * (uBase + fl * hh);
          transformed += (vec3(0.0, -(uGravity * aGrav * 2.5 + uWet * 1.3 + mudV * 1.1), 0.0) + uWind) * fl * hh * hh;
          vShell = hh;
          vFur = aFur;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uFreq;
        uniform float uWet;
        varying float vShell;
        varying float vFur;
        varying vec3 vRest;
        float gMud;
        ${MUD_GLSL}
        float fhash(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float fnoise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(fhash(i + vec3(0,0,0)), fhash(i + vec3(1,0,0)), f.x),
                         mix(fhash(i + vec3(0,1,0)), fhash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(fhash(i + vec3(0,0,1)), fhash(i + vec3(1,0,1)), f.x),
                         mix(fhash(i + vec3(0,1,1)), fhash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 q = vRest * uFreq;
          float n = fnoise(q) * 0.6 + fnoise(q * 2.3 + 7.1) * 0.4;
          float clump = fnoise(q * 0.18 + 3.3);
          n = n * 0.75 + clump * 0.35;
          gMud = mudMask(vRest);
          n = mix(n, clump * 1.25 - 0.1, max(uWet * 0.7, gMud * 0.85)); // molhado/enlameado: mechas grudadas
          float fw = length(fwidth(q));
          n = mix(n, 0.55, clamp(fw * 0.45 - 0.1, 0.0, 0.85));
          float h = vShell;
          float a = clamp((n - h * 0.95) * 3.2 + 0.25 * (1.0 - h), 0.0, 1.0);
          a *= smoothstep(0.0015, 0.006, vFur);
          a *= 1.0 - h * 0.35;
          if (a < 0.02) discard;
          diffuseColor.a = a;
          diffuseColor.rgb *= mix(0.8, 1.06, h) * mix(1.0, 0.7, uWet);
          // lama: escura e molhada no miolo da placa, as pontas dos fios um pouco mais claras (secando)
          vec3 mudC = mudColor(vRest) * mix(1.0, 1.35, smoothstep(0.4, 1.0, h));
          diffuseColor.rgb = mix(diffuseColor.rgb, mudC, gMud * 0.95);
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.24, gMud * (0.4 + 0.6 * mudCore));',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vec3(0.17, 0.13, 0.09) * (0.6 + 0.6 * vShell);
        if (uShine > 0.001) {
          // limpinha: pelo mais claro e brilhinhos que piscam nas pontas dos fios
          float glint = step(0.993, mHash(floor(vRest * 150.0) + floor(uTime * 5.0))) * smoothstep(0.4, 0.9, vShell);
          totalEmissiveRadiance += uShine * (diffuseColor.rgb * (0.12 + 0.22 * vShell) + vec3(1.0, 0.96, 0.86) * glint * 1.6);
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'dogFurShells_v4';
  return mat;
}
