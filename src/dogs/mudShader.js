// Lama e brilho de "limpinha" nos materiais da dog (pele e cascas de pelo).
// A lama é um campo procedural na posição de repouso (metros, no referencial da dog): "botas" de barro nas
// patas com a borda irregular, a barriga suja, respingos que escorrem para baixo e pingos miúdos. Cada região
// tem uma força aleatória: conforme uMud (0..1) cai, as placas mais fracas somem primeiro, então a lama sai em
// placas, uma de cada vez. Cada ponto de uClean (x, y, z, raio) apaga a lama em volta, com borda irregular:
// é onde a irmã lambeu. No miolo da placa a lama é escura e molhada; na borda, mais clara (secando).
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

/**
 * Declarações e funções (vertex e fragment). Cores em espaço linear. mudMask(p) devolve a cobertura e deixa em
 * mudCore o quanto o ponto está no miolo da placa (0 na borda … 1 no meio).
 */
export const MUD_GLSL = /* glsl */ `
uniform float uMud;
uniform vec4 uClean[${MAX_CLEAN}];
uniform float uShine;
uniform float uTime;
const vec3 MUD_WET = vec3(0.030, 0.016, 0.007);
const vec3 MUD_DRY = vec3(0.17, 0.105, 0.052);
float mudCore;
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
float mudShape(vec3 p) {
  float jag = (mNoise(p * 22.0) - 0.5) * 0.09;
  float boots = 1.0 - smoothstep(0.1 + jag, 0.17 + jag, p.y);
  float belly = 1.0 - smoothstep(0.175 + jag, 0.205 + jag, p.y);
  // respingos esticados na vertical (escorrendo) com a borda rasgada
  float drip = mNoise(vec3(p.x * 12.0, p.y * 6.0, p.z * 12.0) + 4.1) + (mNoise(p * 46.0) - 0.5) * 0.24;
  float splat = smoothstep(0.64, 0.7, drip);
  float dots = smoothstep(0.79, 0.83, mNoise(p * 38.0 + 9.7));
  return max(max(boots, belly * 0.95), max(splat, dots * 0.9));
}
float mudMask(vec3 p) {
  mudCore = 0.0;
  if (uMud < 0.002) return 0.0;
  // cada região sai num momento: as mais fracas primeiro. O ruído é esticado para ficar quase uniforme,
  // então cada lambida tira mais ou menos a mesma quantidade de placas.
  float strength = 0.1 + 0.9 * clamp((mNoise(p * 4.5 + 11.3) - 0.5) * 2.3 + 0.5, 0.0, 1.0);
  float f = mudShape(p) * strength;
  float th = mix(1.02, 0.04, uMud);
  float m = smoothstep(th, th + 0.035, f);
  mudCore = smoothstep(th + 0.03, th + 0.3, f);
  for (int i = 0; i < ${MAX_CLEAN}; i++) {
    vec4 c = uClean[i];
    if (c.w > 0.0) {
      float d = distance(p, c.xyz) + (mNoise(p * 45.0) - 0.5) * 0.03;
      float keep = smoothstep(c.w * 0.75, c.w * 1.1, d);
      m *= keep;
      mudCore *= keep;
    }
  }
  return m;
}
/** Cor da lama: escura e molhada no miolo, mais clara na borda, com variação. */
vec3 mudColor(vec3 p) {
  return mix(MUD_DRY, MUD_WET, 0.2 + 0.8 * mudCore) * (0.82 + 0.36 * mNoise(p * 31.0));
}
`;
