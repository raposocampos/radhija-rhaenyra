// Clima de cena: troca a luz da área (noite ↔ manhã) no meio da partida sem recompilar nada.
// O engine.applyLighting refaz o mapa do ambiente (PMREM: programas novos na GPU, um engasgo no celular e reprovação
// na medição da primeira passagem). Aqui só mudam cores e intensidades que já são uniformes: sol, hemisfério, neblina,
// fundo, exposição, céu, correção de cor e brilho, e a força do ambiente (scene.environmentIntensity). A direção do sol
// e a sombra ficam como estão (mudar a sombra recompilaria os materiais).
// Uso: const mood = createMood(engine, { base: MORNING }); mood.set(NIGHT) / mood.set(MORNING) / mood.blend(A, B, k).
// No Node (testes) o motor é falso: o que faltar é ignorado.
import * as THREE from 'three';

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

/** Preset completo: o padrão do motor, a base da área e o que mudar, nessa ordem. */
function full(defaults, base, over) {
  const out = {};
  for (const src of [defaults, base, over]) {
    if (!src) continue;
    for (const [k, v] of Object.entries(src)) {
      out[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...(out[k] || {}), ...v } : v;
    }
  }
  return out;
}

const lerpN = (a, b, k) => a + (b - a) * k;
function lerpColor(target, a, b, k) {
  if (!target?.set) return;
  tmpA.set(a);
  tmpB.set(b);
  target.copy(tmpA).lerp(tmpB, k);
}

/**
 * @param {any} engine o motor do jogo (src/core/engine.js) ou o falso dos testes
 * @param {{ base?: object, defaults?: object }} [opts]
 */
export function createMood(engine, { base = null, defaults = null } = {}) {
  let current = null;

  /** Aplica a mistura de A (k = 0) a B (k = 1). */
  function blend(A, B, k) {
    const a = full(defaults, base, A);
    const b = full(defaults, base, B);
    const t = Math.max(0, Math.min(1, k));
    const sun = engine?.sun;
    if (sun) {
      lerpColor(sun.color, a.sun?.color, b.sun?.color, t);
      sun.intensity = lerpN(a.sun?.intensity ?? 1, b.sun?.intensity ?? 1, t);
    }
    const hemi = engine?.hemi;
    if (hemi) {
      lerpColor(hemi.color, a.hemi?.sky, b.hemi?.sky, t);
      lerpColor(hemi.groundColor, a.hemi?.ground, b.hemi?.ground, t);
      hemi.intensity = lerpN(a.hemi?.intensity ?? 1, b.hemi?.intensity ?? 1, t);
    }
    const scene = engine?.scene;
    const fog = scene?.fog;
    if (fog && a.fog && b.fog) {
      lerpColor(fog.color, a.fog.color, b.fog.color, t);
      fog.near = lerpN(a.fog.near, b.fog.near, t);
      fog.far = lerpN(a.fog.far, b.fog.far, t);
      if (scene.background?.isColor) scene.background.copy(fog.color);
    }
    if (scene && a.env && b.env && 'environmentIntensity' in scene) {
      scene.environmentIntensity = lerpN(a.env.intensity ?? 0.6, b.env.intensity ?? 0.6, t);
    }
    const r = engine?.renderer;
    if (r && typeof r.toneMappingExposure === 'number') r.toneMappingExposure = lerpN(a.exposure ?? 1, b.exposure ?? 1, t);
    const u = engine?.sky?.material?.uniforms;
    if (u && a.sky && b.sky) {
      for (const [key, name] of [['uZenith', 'zenith'], ['uMid', 'mid'], ['uHorizon', 'horizon'], ['uGround', 'ground'], ['uSun', 'sun']]) {
        if (u[key]) lerpColor(u[key].value, a.sky[name], b.sky[name], t);
      }
      if (u.uCloudTint && a.sky.cloudTint && b.sky.cloudTint) {
        u.uCloudTint.value.setRGB(...a.sky.cloudTint.map((v, i) => lerpN(v, b.sky.cloudTint[i], t)));
      }
      for (const [key, name] of [['uStars', 'stars'], ['uClouds', 'clouds'], ['uGlow', 'glow'], ['uDisk', 'disk']]) {
        if (u[key]) u[key].value = lerpN(a.sky[name] ?? 0, b.sky[name] ?? 0, t);
      }
    }
    const G = engine?.grade?.uniforms;
    if (G && a.grade && b.grade) {
      if (G.uWarm) G.uWarm.value.set(...a.grade.warm.map((v, i) => lerpN(v, b.grade.warm[i], t)));
      if (G.uSat) G.uSat.value = lerpN(a.grade.sat, b.grade.sat, t);
      if (G.uLift) G.uLift.value.set(...a.grade.lift.map((v, i) => lerpN(v, b.grade.lift[i], t)));
      if (G.uVignette) G.uVignette.value = lerpN(a.grade.vignette, b.grade.vignette, t);
    }
    const bloom = engine?.bloom;
    if (bloom && a.bloom && b.bloom) {
      bloom.strength = lerpN(a.bloom.strength, b.bloom.strength, t);
      bloom.radius = lerpN(a.bloom.radius, b.bloom.radius, t);
      bloom.threshold = lerpN(a.bloom.threshold, b.bloom.threshold, t);
    }
    current = t >= 1 ? B : t <= 0 ? A : null;
  }

  return {
    blend,
    /** Aplica um preset de uma vez (no preto de uma cena). */
    set(P) { blend(P, P, 1); },
    get current() { return current; },
  };
}
