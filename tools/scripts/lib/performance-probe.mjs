// Injetado SOMENTE na página de medição. O jogo publicado não recebe hooks novos.
export function installPerformanceProbe() {
  const raf = window.requestAnimationFrame.bind(window);
  let rafTimestamp = null, api;
  window.requestAnimationFrame = (callback) => raf(function (timestamp) {
    rafTimestamp = timestamp;
    return callback.call(this, timestamp);
  });
  Object.defineProperty(window, '__game', {
    configurable: true, get: () => api,
    set(value) {
      api = value;
      const { engine, game, events, THREE } = value;
      const phaseRoot = () => engine.scene.children.find((o) => o.name === `fase:${game.levelDef.id}`)?.uuid;
      const initialLoading = game.debug.log.find((e) => e.name === 'level:loading');
      const initialLoaded = game.debug.log.find((e) => e.name === 'level:loaded');
      if (!initialLoading || !initialLoaded) throw new Error('initial load events unavailable');
      const m = window.__performanceMeasurement = {
        generation: 0, active: null, framesDrawn: 0, skipDraw: false,
        loads: [{ generation: 0, level: game.levelDef.id, root: phaseRoot(), initial: true,
          startedAt: initialLoading.t, loadedAt: initialLoaded.t, eventPrecisionMs: 1,
          firstRenderSubmittedAt: null, firstUiReleasedRenderAt: null }],
      };
      events.on('level:loading', (payload) => {
        m.generation++;
        m.loads.push({ generation: m.generation, level: payload.id, initial: false,
          startedAt: performance.now(), loadedAt: null, root: null, eventPrecisionMs: null,
          firstRenderSubmittedAt: null, firstUiReleasedRenderAt: null });
      });
      events.on('level:loaded', () => Object.assign(m.loads.at(-1), { loadedAt: performance.now(), root: phaseRoot() }));
      const update = game.update;
      let lastUpdate = null;
      game.update = function (...args) {
        const startedAt = performance.now();
        const result = update.apply(this, args);
        lastUpdate = { startedAt, endedAt: performance.now(), rafTimestamp };
        return result;
      };
      const render = engine.render;
      engine.renderer.info.autoReset = false;
      engine.render = function (...args) {
        // Câmera repetível por fase; a simulação, UI, efeitos e compositor seguem normais.
        const b = game.levelDef.layout.WORLD.bounds;
        const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
        const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
        engine.camera.position.set(cx + span * 0.65, span * 0.8, cz + span * 1.1);
        engine.camera.lookAt(cx, 0, cz);
        engine.camera.updateMatrixWorld();
        engine.renderer.info.reset();
        const startedAt = performance.now();
        const result = m.skipDraw ? undefined : render.apply(this, args);
        const endedAt = performance.now();
        const load = m.loads.at(-1), root = phaseRoot();
        const draw = engine.renderer.info.render;
        const valid = load.loadedAt !== null && load.root === root && load.level === game.levelDef.id && game.state === 'playing';
        if (valid && draw.calls > 0) {
          if (load.firstRenderSubmittedAt === null) load.firstRenderSubmittedAt = endedAt;
          // Conservador: toda a cortina e a tela de boot já saíram, não só começaram a dissolver.
          if (load.firstUiReleasedRenderAt === null && !document.getElementById('loading') && !document.querySelector('.rr-curtain')?.classList.contains('is-on')) load.firstUiReleasedRenderAt = endedAt;
        }
        m.framesDrawn++;
        const active = m.active;
        if (active) {
          active.frames.push({ level: game.levelDef.id, root, generation: m.generation, state: game.state,
            rafTimestamp: lastUpdate?.rafTimestamp, updateMs: lastUpdate ? lastUpdate.endedAt - lastUpdate.startedAt : null,
            renderMs: endedAt - startedAt, frameCpuMs: lastUpdate ? endedAt - lastUpdate.startedAt : null,
            calls: draw.calls, triangles: draw.triangles });
          active.elapsedMs = endedAt - active.startedAt;
          if (active.frames.length >= active.minimumFrames && active.elapsedMs >= active.minimumDurationMs) {
            m.active = null;
            clearTimeout(active.timer);
            const { resolve, reject: _reject, timer: _timer, ...sample } = active;
            resolve(sample);
          }
        }
        return result;
      };
      m.quality = () => {
        const { renderer } = engine, gl = renderer.getContext();
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        const size = renderer.getDrawingBufferSize(new THREE.Vector2());
        return { pixelRatio: renderer.getPixelRatio(), buffer: [size.x, size.y],
          shadows: renderer.shadowMap.enabled, shadowSize: engine.sun.shadow.mapSize.toArray(),
          bloom: engine.bloom.enabled, passes: engine.composer.passes.map((p) => p.enabled),
          renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
      };
      m.collect = ({ minimumFrames, minimumDurationMs }) => {
        if (m.active) throw new Error('overlapping temporal samples');
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            const active = m.active;
            if (active?.resolve !== resolve) return;
            m.active = null;
            reject(new Error(`temporal window timed out: level=${active.level}, generation=${active.generation}, frames=${active.frames.length}, elapsedMs=${performance.now() - active.startedAt}`));
          }, 270000);
          m.active = { resolve, reject, timer, minimumFrames, minimumDurationMs, frames: [], elapsedMs: 0,
            startedAt: performance.now(), level: game.levelDef.id, root: phaseRoot(), generation: m.generation,
            quality: m.quality(), camera: { position: engine.camera.position.toArray(), fov: engine.camera.fov } };
        });
      };
    },
  });
}
