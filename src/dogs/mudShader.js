// Lama e brilho de "limpinha" nos materiais da dog (pele e cascas de pelo).
// A lama é um campo procedural na posição de repouso (metros, no referencial da dog): pernas e barriga
// mais sujas, manchas grandes no corpo e respingos pequenos. uMud (0..1) é o limiar: conforme cai, as
// partes mais fracas do campo somem primeiro, então a lama sai em placas. Cada ponto de uClean
// (x, y, z, raio) apaga a lama em volta, com borda irregular: é onde a irmã lambeu.
// uShine (0..1) clareia o pelo e acende brilhinhos que piscam nas pontas (uTime).
import * as THREE from 'three';

export const MAX_CLEAN = 6;

export function createMudUniforms() {
  return {
    uMud: { value: 0 },
    uClean: { value: Array.from({ length: MAX_CLEAN }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uShine: { value: 0 },
    uTime: { value: 0 },
  };
}

/** Declarações e funções (vertex e fragment). Cores em espaço linear. */
export const MUD_GLSL = /* glsl */ `
uniform float uMud;
uniform vec4 uClean[${MAX_CLEAN}];
uniform float uShine;
uniform float uTime;
const vec3 MUD_WET = vec3(0.069, 0.034, 0.016);
const vec3 MUD_DRY = vec3(0.25, 0.15, 0.07);
float mHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.71, 0.33));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float mNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(mHash(i), mHash(i + vec3(1, 0, 0)), f.x), mix(mHash(i + vec3(0, 1, 0)), mHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(mHash(i + vec3(0, 0, 1)), mHash(i + vec3(1, 0, 1)), f.x), mix(mHash(i + vec3(0, 1, 1)), mHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float mudField(vec3 p) {
  float low = 1.0 - smoothstep(0.05, 0.3, p.y);
  float belly = (1.0 - smoothstep(0.17, 0.26, p.y)) * 0.35;
  float blot = mNoise(p * 9.0) * 0.62 + mNoise(p * 21.0 + 4.1) * 0.38;
  float f = low * 0.8 + belly + blot * 0.78 - 0.4;
  float spl = smoothstep(0.7, 0.8, mNoise(p * 33.0 + 9.7));
  return max(f, spl * 0.95);
}
float mudMask(vec3 p) {
  if (uMud < 0.002) return 0.0;
  float th = mix(1.1, 0.1, uMud);
  float m = smoothstep(th, th + 0.07, mudField(p));
  for (int i = 0; i < ${MAX_CLEAN}; i++) {
    vec4 c = uClean[i];
    if (c.w > 0.0) {
      float d = distance(p, c.xyz) + (mNoise(p * 45.0) - 0.5) * 0.025;
      m *= smoothstep(c.w * 0.8, c.w * 1.15, d);
    }
  }
  return m;
}
`;
