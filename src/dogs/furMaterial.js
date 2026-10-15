// Material de pelo por cascas (shells): cada casca é extrudada ao longo da normal já com skinning,
// com leve gravidade; alpha vem de ruído 3D na posição de repouso (fios contínuos entre cascas).
import * as THREE from 'three';

export function createFurMaterial({ strandFreq = 400, gravity = 0.35, base = 0.0015 } = {}) {
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
        varying vec3 vRest;`,
      )
      .replace(
        '#include <skinning_vertex>',
        `vRest = position;
        #include <skinning_vertex>
        {
          float hh = aShell;
          vec3 nrmF = normalize(objectNormal);
          float fl = aFur * (1.0 - 0.55 * uWet);
          transformed += nrmF * (uBase + fl * hh);
          transformed += (vec3(0.0, -(uGravity * aGrav * 2.5 + uWet * 1.3), 0.0) + uWind) * fl * hh * hh;
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
          n = mix(n, clump * 1.25 - 0.1, uWet * 0.7); // molhado: fios grudados em mechas
          float fw = length(fwidth(q));
          n = mix(n, 0.55, clamp(fw * 0.45 - 0.1, 0.0, 0.85));
          float h = vShell;
          float a = clamp((n - h * 0.95) * 3.2 + 0.25 * (1.0 - h), 0.0, 1.0);
          a *= smoothstep(0.0015, 0.006, vFur);
          a *= 1.0 - h * 0.35;
          if (a < 0.02) discard;
          diffuseColor.a = a;
          diffuseColor.rgb *= mix(0.8, 1.06, h) * mix(1.0, 0.7, uWet);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3(0.17, 0.13, 0.09) * (0.6 + 0.6 * vShell);',
      );
  };
  mat.customProgramCacheKey = () => 'dogFurShells_v2';
  return mat;
}
