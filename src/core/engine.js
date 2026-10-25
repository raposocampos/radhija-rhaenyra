// Engine: renderer, câmera, luz, céu, environment map e pós-processamento.
// API: createEngine(container, { params }) → {
//   renderer, scene, camera, sun, hemi, sky, composer, bloom, grade,
//   applyLighting(preset, bounds)  // por fase: sol/lua, hemisfério, névoa, céu, env map, grading, sombra
//   prepare()                      // aquece a GPU com a fase inteira (sem engasgo na 1ª vez em cada área)
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
  /** @param {import('../types').Bounds} b @param {number} [topY] altura do que faz sombra (padrão: 3,3 m, as fases) */
  function fitShadow(b, topY = 3.3) {
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
    for (const x of [b.minX - 1.2, b.maxX + 0.6]) for (const z of [b.minZ - 0.6, b.maxZ + 0.9]) for (const y of [0, topY]) {
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
  /** Limites da fase atual (aplicados com a iluminação): a vista geral do aquecimento enquadra a fase. */
  let levelBounds = null;
  /** Ponto que a sombra acompanha agora (focusShadow), vazio com a sombra da fase inteira. */
  let shadowFocusKey = '';
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
    if (bounds) {
      levelBounds = bounds;
      shadowFocusKey = '';
      fitShadow(bounds);
    }
    rebuildEnv(L);
  }
  applyLighting(LIGHTING_DEFAULT, { minX: -6, maxX: 6.8, minZ: -4.8, maxZ: 4.5 });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    // perfis com orçamento de pixels (celular/tablet): o pixel ratio acompanha a tela (tela cheia, rotação, barra do
    // navegador). No PC ('alta', sem orçamento) fica o de sempre, calculado uma vez.
    if (profile.pixelBudget > 0) {
      const next = pixelRatioFor(profile, { dpr: window.devicePixelRatio, width: w, height: h });
      if (next !== qualityState.pixelRatio) {
        qualityState.pixelRatio = next;
        renderer.setPixelRatio(next);
        composer.setPixelRatio(next);
      }
    }
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    grade.uniforms.uAspect.value = w / h;
  }
  window.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------ aquecimento da GPU (na carga da fase, atrás da cortina)
  // Na primeira vez que um material aparece, o WebGL compila o programa dele (no Windows o ANGLE ainda traduz para
  // HLSL) e a GPU recebe as texturas e as geometrias: um quadro de dezenas a centenas de ms na primeira passagem por
  // cada área nova. O programa depende de para onde se desenha: no alvo do compositor, sem tone mapping e em espaço
  // linear; direto na tela (sem pós), com os dois. Por isso compilar sem alvo não basta quando há compositor: a
  // variante do jogo ficava para o primeiro quadro em que cada coisa entrava na câmera.
  // O desenho do aquecimento é uma vista geral da fase, num alvo pequeno: com quase tudo cobrindo algum pixel, também
  // fica pronto o que a GPU só prepara ao pintar de verdade (no SwiftShader do CI, a pintura e a leitura de cada textura).
  const WARM_W = 256, WARM_H = 144;
  const warmCam = new THREE.PerspectiveCamera(38, WARM_W / WARM_H, 0.1, 400);
  /** Alvo do mesmo tipo do compositor (o programa não depende do tamanho), ou null quando se desenha na tela. */
  const warmTarget = () => (usePost && profile.post
    ? new THREE.WebGLRenderTarget(WARM_W, WARM_H, { type: THREE.HalfFloatType, samples: profile.msaa })
    : null);
  /** Câmera alta, de frente e um pouco de lado, enquadrando os limites da fase (sem limites: a câmera do jogo). */
  function overview() {
    const b = levelBounds;
    if (!b) return camera;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    warmCam.fov = camera.fov;
    warmCam.position.set(cx + span * 0.3, span * 0.85, cz + span * 0.9);
    warmCam.lookAt(cx, 0, cz);
    warmCam.updateProjectionMatrix();
    warmCam.updateMatrixWorld();
    return warmCam;
  }
  /** Compila os programas de toda a cena, inclusive do que está escondido, na variante de agora. */
  function compileScene(target) {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    try {
      return renderer.compileAsync(scene, camera);
    } finally {
      renderer.setRenderTarget(prev);
    }
  }
  /**
   * Desenha a cena INTEIRA uma vez, da vista geral (sem o recorte pela câmera e com o que ainda está escondido), num
   * alvo pequeno ou num canto da tela: envia texturas e geometrias e prepara os programas da sombra. As luzes ficam
   * como estão (a quantidade de luzes faz parte do programa).
   */
  function drawEverything(target) {
    const lights = new Set();
    scene.traverseVisible((o) => { if (/** @type {THREE.Light} */ (o).isLight) lights.add(o); });
    /** @type {[THREE.Object3D, boolean, boolean][]} */
    const changed = [];
    scene.traverse((o) => {
      if (/** @type {THREE.Light} */ (o).isLight) {
        // a luz dentro de um grupo escondido, que agora aparece, continua apagada
        if (o.visible && !lights.has(o)) { changed.push([o, true, o.frustumCulled]); o.visible = false; }
        return;
      }
      const drawable = /** @type {THREE.Mesh} */ (o).isMesh || /** @type {THREE.Points} */ (o).isPoints
        || /** @type {THREE.Line} */ (o).isLine || /** @type {THREE.Sprite} */ (o).isSprite;
      if (o.visible && !(drawable && o.frustumCulled)) return;
      changed.push([o, o.visible, o.frustumCulled]);
      o.visible = true;
      if (drawable) o.frustumCulled = false;
    });
    const prev = renderer.getRenderTarget();
    const viewport = renderer.getViewport(new THREE.Vector4());
    const scissor = renderer.getScissor(new THREE.Vector4());
    const scissorTest = renderer.getScissorTest();
    renderer.shadowMap.needsUpdate = true;
    try {
      renderer.setRenderTarget(target);
      if (!target) {
        // na tela, só um canto (o quadro normal logo depois cobre tudo)
        renderer.setViewport(0, 0, WARM_W, WARM_H);
        renderer.setScissor(0, 0, WARM_W, WARM_H);
        renderer.setScissorTest(true);
      }
      renderer.render(scene, overview());
    } finally {
      for (const [o, visible, culled] of changed) { o.visible = visible; o.frustumCulled = culled; }
      if (!target) {
        renderer.setViewport(viewport);
        renderer.setScissor(scissor);
        renderer.setScissorTest(scissorTest);
      }
      renderer.setRenderTarget(prev);
      // o mapa de sombra saiu com o que estava escondido: o próximo quadro redesenha
      renderer.shadowMap.needsUpdate = true;
    }
  }
  /**
   * Espera a GPU terminar tudo o que já recebeu, sem travar a página: o WebGL só enfileira os comandos, e a
   * compilação na hora do desenho, os envios e os desenhos do aquecimento ficariam para o primeiro quadro visível.
   * @param {number} timeoutMs
   */
  function gpuIdle(timeoutMs) {
    const gl = /** @type {WebGL2RenderingContext} */ (renderer.getContext());
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) return Promise.resolve();
    gl.flush();
    const t0 = performance.now();
    return /** @type {Promise<void>} */ (new Promise((resolve) => {
      const check = () => {
        const status = gl.clientWaitSync(sync, 0, 0);
        // WAIT_FAILED: contexto perdido; também não espera para sempre
        if (status !== gl.TIMEOUT_EXPIRED || performance.now() - t0 > timeoutMs) {
          gl.deleteSync(sync);
          resolve();
        } else setTimeout(check, 4);
      };
      check();
    }));
  }
  const mark = (name) => globalThis.performance?.mark?.(`rr:gpu:${name}`);
  /**
   * Prepara a GPU para a fase montada: programas (com KHR_parallel_shader_compile, sem travar a página enquanto
   * compilam), texturas, geometrias, sombra e o compositor, e espera a GPU terminar. Chamado no carregamento, com a
   * fase já no lugar e a tela coberta (a cortina ou a tela de carregamento).
   */
  async function prepare() {
    const target = warmTarget();
    try {
      // sem resposta da GPU (contexto perdido), segue: o desenho abaixo termina o que faltar
      await Promise.race([compileScene(target), new Promise((r) => setTimeout(r, 8000))]);
      mark('compiled');
      drawEverything(target);
      // e um quadro de verdade, ainda coberto: os passes do compositor e o primeiro quadro já ficam prontos
      render(0);
      mark('drawn');
      await gpuIdle(10000);
      mark('idle');
    } catch (error) {
      // o aquecimento só adianta trabalho: se falhar, a fase abre e o que faltou acontece no primeiro uso
      console.warn('[engine] aquecimento da GPU incompleto', error);
    } finally {
      target?.dispose();
    }
  }

  /**
   * Uma fase montada FORA da cena (o mapa das fases adiantando a próxima, src/game/levelPreload.js): compila os
   * programas dela na variante do jogo, com as luzes de agora mais as dela (compileAsync, sem travar a página), e
   * envia as texturas aos poucos (um pedaço por quadro). Geometrias e sombra ficam para o prepare() da entrada, que
   * assim fica curto.
   * @param {THREE.Object3D} stagedRoot @param {{ onProgress?: (k: number) => void, budgetMs?: number }} [opts]
   */
  async function precompile(stagedRoot, { onProgress, budgetMs = 5 } = {}) {
    const target = warmTarget();
    try {
      const prev = renderer.getRenderTarget();
      let job;
      renderer.setRenderTarget(target);
      try {
        job = renderer.compileAsync(stagedRoot, camera, scene);
      } finally {
        renderer.setRenderTarget(prev);
      }
      await Promise.race([job, new Promise((r) => setTimeout(r, 8000))]);
      onProgress?.(0.6);
      /** @type {Set<THREE.Texture>} */
      const textures = new Set();
      stagedRoot.traverse((o) => {
        const m = /** @type {THREE.Mesh} */ (o).material;
        for (const mm of Array.isArray(m) ? m : m ? [m] : []) {
          for (const v of Object.values(mm)) if (v && /** @type {THREE.Texture} */ (v).isTexture) textures.add(v);
        }
      });
      let i = 0;
      let t0 = performance.now();
      for (const t of textures) {
        renderer.initTexture(t);
        i++;
        if (performance.now() - t0 > budgetMs) {
          onProgress?.(0.6 + (0.4 * i) / textures.size);
          await new Promise((r) => requestAnimationFrame(() => r(undefined)));
          t0 = performance.now();
        }
      }
      onProgress?.(1);
    } finally {
      target?.dispose();
    }
  }

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
    // outro tipo de sombra ou sem compositor muda a variante dos programas: compila a fase toda de novo agora, em
    // segundo plano, em vez de engasgar em cada área (texturas e geometrias continuam na GPU)
    const target = warmTarget();
    try {
      compileScene(target).finally(() => target?.dispose());
    } catch (error) {
      target?.dispose();
      console.warn('[engine] recompilação da fase incompleta', error);
    }
  }

  /** @param {number} dt @param {number} [t] */
  function render(dt, t) {
    shared.time.value = t ?? shared.time.value;
    sky.material.uniforms.uTime.value = shared.time.value;
    // o céu acompanha a câmera (sem paralaxe)
    sky.position.copy(camera.position);
    // perfis leves redesenham o mapa de sombra a cada N quadros (a passada de sombra repete o cenário inteiro)
    if (profile.shadowEvery > 1 && ++shadowFrame % profile.shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
    if (usePost && profile.post) composer.render(dt);
    else renderer.render(scene, camera);
  }

  /**
   * Num cenário grande (o mapa das fases), a sombra do sol cobre só a vizinhança de (x, z): a caixa do mapa de sombra
   * acompanha o ponto em passos de `step` m (refeita só quando ele anda: sem tremer a cada quadro).
   */
  function focusShadow(x, z, { half = 16, top = 12, step = 4 } = {}) {
    const cx = Math.round(x / step) * step;
    const cz = Math.round(z / step) * step;
    const key = `${cx},${cz},${half},${top}`;
    if (key === shadowFocusKey) return;
    shadowFocusKey = key;
    fitShadow({ minX: cx - half, maxX: cx + half, minZ: cz - half, maxZ: cz + half }, top);
    renderer.shadowMap.needsUpdate = true;
  }

  return {
    renderer, scene, camera, sun, hemi, sky, composer, bloom, grade,
    applyLighting,
    focusShadow,
    precompile,
    /** Aquecimento da GPU para a fase montada (programas, texturas, geometrias, sombra): no carregamento. */
    prepare,
    get lighting() { return lighting; },
    /** Controle da qualidade: device, mode, level, setMode(m) (menu), frame(now, active) (governador). Cada troca
     *  emite 'quality:change' no barramento de eventos. */
    quality,
    /** Perfil aplicado agora: { level, pixelRatio, reason }. */
    get qualityState() { return { ...qualityState }; },
    render,
  };
}
