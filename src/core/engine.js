// Engine: renderer, câmera, luz, céu, environment map e pós-processamento.
// API: createEngine(container, { params }) → {
//   renderer, scene, camera, sun, hemi, sky, composer, bloom, grade,
//   applyLighting(preset, bounds)  // por fase: sol/lua, hemisfério, névoa, céu, env map, grading, sombra
//   quality                        // qualidade por aparelho (src/core/quality.js): PC 'alta' (a de sempre), celular mais leve
//   render(dt, t)
// }
// Formato do preset: ver LIGHTING_DEFAULT (= fim de tarde da fase 1) e docs/ARQUITETURA.md §4.3 (tipo LightingPreset).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createSky } from '../world/sky.js';
import { SUN_DIR, shared } from '../world/util.js';
import { events } from './events.js';
import {
  applyQualityProfile, createQualityControl, detectDevice, loadQualityMode, pixelRatioFor, readDeviceEnv, readGpuName,
  SKY_FIRST, SKY_LAST,
} from './quality.js';

/** Iluminação de fim de tarde (fase 1). Cores em hex = sRGB; arrays em `sky.cloudTint`/`grade.*` = linear. */
export const LIGHTING_DEFAULT = {
  sun: { dir: [-0.62, 0.42, 0.38], color: '#ffc58a', intensity: 3.2, shadowBias: -0.00035, shadowNormalBias: 0.025 },
  hemi: { sky: '#bcd4f2', ground: '#9a7a4a', intensity: 1.05 },
  fog: { color: '#e9c6a2', near: 17, far: 72 },
  exposure: 1.12,
  sky: {
    zenith: '#5f93cf', mid: '#a9c6e2', horizon: '#ffcf9e', ground: '#d9b48e', sun: '#fff0d0',
    stars: 0, clouds: 1, glow: 1, disk: 1, cloudTint: [1.0, 0.86, 0.74],
  },
  env: { intensity: 0.6, ground: '#7d7a45' },
  grade: { warm: [1.035, 1.0, 0.93], sat: 1.07, lift: [0.006, 0.003, 0.0], vignette: 0.24 },
  bloom: { strength: 0.22, radius: 0.55, threshold: 0.92 },
};

// Color grading + vinheta (em espaço linear, antes do tone mapping).
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.24 },
    uWarm: { value: new THREE.Vector3(1.035, 1.0, 0.93) },
    uSat: { value: 1.07 },
    uLift: { value: new THREE.Vector3(0.006, 0.003, 0.0) },
    uAspect: { value: 1.7 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uVignette, uSat, uAspect; uniform vec3 uWarm, uLift;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * uWarm + uLift;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = max(mix(vec3(l), col, uSat), 0.0);
      // sombras levemente mais frias, realces mais quentes
      col *= mix(vec3(0.97, 0.99, 1.04), vec3(1.02, 1.0, 0.97), smoothstep(0.02, 0.6, l));
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
      float v = smoothstep(0.35, 1.15, length(q) * 1.05);
      col *= 1.0 - uVignette * v;
      gl_FragColor = vec4(col, c.a);
    }`,
};

const merge = (base, over) => {
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    const v = over[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(base[k] || {}, v) : v;
  }
  return out;
};
const setColor = (c, v) => (Array.isArray(v) ? c.setRGB(v[0], v[1], v[2]) : c.set(v));

/**
 * @param {HTMLElement} container
 * @param {{ params?: URLSearchParams }} [opts]
 */
export function createEngine(container, { params } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  // Qualidade por aparelho: o perfil inicial sai do aparelho, da GPU (só no celular/tablet; no PC nem se consulta) e
  // da escolha salva no menu (no PC, 'alta', com os mesmos valores de sempre). As trocas depois (menu ou governador
  // de FPS do celular) passam por setProfile.
  const device = detectDevice(readDeviceEnv(window));
  const quality = createQualityControl({
    device,
    mode: loadQualityMode(),
    gpu: device === 'desktop' ? '' : readGpuName(renderer.getContext()),
    apply: (next, reason) => setProfile(next, reason),
    onChange: (s) => events.emit('quality:change', s),
  });
  let profile = quality.profile;
  const pr = pixelRatioFor(profile, { dpr: window.devicePixelRatio, width: window.innerWidth, height: window.innerHeight });
  /** Perfil aplicado (diagnóstico e testes): nível, pixel ratio e o motivo da última troca. */
  const qualityState = { level: profile.name, pixelRatio: pr, reason: 'inicio' };
  renderer.setPixelRatio(pr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = profile.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = profile.shadowEvery <= 1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color('#e9c6a2'), 17, 72);
  scene.background = new THREE.Color('#e9c6a2');

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 220);
  camera.position.set(1.4, 4.6, 4.4);
  camera.lookAt(0, 0.3, -0.3);

  // ------------------------------------------------ luzes
  const hemi = new THREE.HemisphereLight('#bcd4f2', '#9a7a4a', 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffc58a', 3.2);
  const sunTarget = new THREE.Vector3(0.4, 0, -0.15);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(profile.shadowSize, profile.shadowSize);

  /** Ajusta o frustum ortográfico da sombra só à área da fase (+ margem), no espaço da luz. */
  function fitShadow(b) {
    sunTarget.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
    sun.position.copy(sunTarget).addScaledVector(SUN_DIR, 30);
    sun.target.position.copy(sunTarget);
    sun.target.updateMatrixWorld();
    const cam = sun.shadow.camera;
    const look = new THREE.OrthographicCamera();
    look.position.copy(sun.position);
    look.lookAt(sunTarget);
    look.updateMatrixWorld();
    const inv = look.matrixWorld.clone().invert();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const p = new THREE.Vector3();
    for (const x of [b.minX - 1.2, b.maxX + 0.6]) for (const z of [b.minZ - 0.6, b.maxZ + 0.9]) for (const y of [0, 3.3]) {
      p.set(x, y, z).applyMatrix4(inv);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    cam.left = minX; cam.right = maxX; cam.bottom = minY; cam.top = maxY;
    cam.near = 2; cam.far = 70;
    cam.updateProjectionMatrix();
  }

  // ------------------------------------------------ céu
  const sky = createSky(SUN_DIR);
  // no celular o céu (nuvens por ruído, caro por pixel) vem depois do cenário: só os pixels de céu que sobram
  sky.renderOrder = profile.skyLast ? SKY_LAST : SKY_FIRST;
  scene.add(sky);

  // ------------------------------------------------ pós-processamento
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: profile.msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.22, 0.55, 0.92);
  bloom.enabled = profile.bloom;
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  const usePost = !(params && params.has && params.has('nopost'));

  // ------------------------------------------------ iluminação por fase
  let envRT = null;
  function rebuildEnv(L) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = createSky(SUN_DIR, { radius: 50 });
    copySkyUniforms(envSky.material.uniforms, L.sky);
    envScene.add(envSky);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: L.env.ground }));
    g.position.y = -1.5;
    envScene.add(g);
    const next = pmrem.fromScene(envScene, 0.02);
    envRT?.dispose();
    envRT = next;
    scene.environment = next.texture;
    scene.environmentIntensity = L.env.intensity;
    pmrem.dispose();
    envSky.geometry.dispose();
    envSky.material.dispose();
    g.geometry.dispose();
    g.material.dispose();
  }

  function copySkyUniforms(u, S) {
    u.uSunDir.value.copy(SUN_DIR);
    setColor(u.uZenith.value, S.zenith);
    setColor(u.uMid.value, S.mid);
    setColor(u.uHorizon.value, S.horizon);
    setColor(u.uGround.value, S.ground);
    setColor(u.uSun.value, S.sun);
    setColor(u.uCloudTint.value, S.cloudTint);
    u.uStars.value = S.stars;
    u.uClouds.value = S.clouds;
    u.uGlow.value = S.glow;
    u.uDisk.value = S.disk;
  }

  let lighting = LIGHTING_DEFAULT;
  let lightCastsShadow = true; // a fase quer sombra do sol (o perfil de qualidade pode desligar)
  function applyLighting(preset, bounds) {
    const L = merge(LIGHTING_DEFAULT, preset || {});
    lighting = L;
    SUN_DIR.set(.../** @type {[number, number, number]} */ (L.sun.dir)).normalize();
    sun.color.set(L.sun.color);
    sun.intensity = L.sun.intensity;
    lightCastsShadow = L.sun.castShadow !== false;
    sun.castShadow = lightCastsShadow && profile.shadows;
    sun.shadow.bias = L.sun.shadowBias;
    sun.shadow.normalBias = L.sun.shadowNormalBias;
    hemi.color.set(L.hemi.sky);
    hemi.groundColor.set(L.hemi.ground);
    hemi.intensity = L.hemi.intensity;
    const fog = /** @type {THREE.Fog} */ (scene.fog);
    fog.color.set(L.fog.color);
    fog.near = L.fog.near;
    fog.far = L.fog.far;
    /** @type {THREE.Color} */ (scene.background).set(L.fog.color);
    renderer.toneMappingExposure = L.exposure;
    copySkyUniforms(sky.material.uniforms, L.sky);
    const G = grade.uniforms;
    G.uWarm.value.set(...L.grade.warm);
    G.uSat.value = L.grade.sat;
    G.uLift.value.set(...L.grade.lift);
    G.uVignette.value = L.grade.vignette;
    bloom.strength = L.bloom.strength;
    bloom.radius = L.bloom.radius;
    bloom.threshold = L.bloom.threshold;
    if (bounds) fitShadow(bounds);
    rebuildEnv(L);
  }
  applyLighting(LIGHTING_DEFAULT, { minX: -6, maxX: 6.8, minZ: -4.8, maxZ: 4.5 });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    grade.uniforms.uAspect.value = w / h;
  }
  window.addEventListener('resize', resize);
  resize();

  let shadowFrame = 0;
  /** @param {import('./quality.js').QualityProfile} next @param {string} reason */
  function setProfile(next, reason) {
    const prev = profile;
    profile = next;
    qualityState.pixelRatio = applyQualityProfile({
      renderer, composer, sun, bloom, scene, sky, castShadow: lightCastsShadow,
      dpr: window.devicePixelRatio, width: window.innerWidth, height: window.innerHeight,
    }, next, prev);
    qualityState.level = next.name;
    qualityState.reason = reason;
  }

  return {
    renderer, scene, camera, sun, hemi, sky, composer, bloom, grade,
    applyLighting,
    get lighting() { return lighting; },
    /** Controle da qualidade: device, mode, level, setMode(m) (menu), frame(now, active) (governador). Cada troca
     *  emite 'quality:change' no barramento de eventos. */
    quality,
    /** Perfil aplicado agora: { level, pixelRatio, reason }. */
    get qualityState() { return { ...qualityState }; },
    render(dt, t) {
      shared.time.value = t ?? shared.time.value;
      sky.material.uniforms.uTime.value = shared.time.value;
      // o céu acompanha a câmera (sem paralaxe)
      sky.position.copy(camera.position);
      // perfis leves redesenham o mapa de sombra a cada N quadros (a passada de sombra repete o cenário inteiro)
      if (profile.shadowEvery > 1 && ++shadowFrame % profile.shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
      if (usePost && profile.post) composer.render(dt);
      else renderer.render(scene, camera);
    },
  };
}
