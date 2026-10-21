// Ganchos instalados na página do jogo para gravar cenas quadro a quadro (roda DENTRO do navegador).
// O laço do jogo fica congelado (requestAnimationFrame preso por __freezeReview) e cada quadro do vídeo avança o jogo
// por 1/fps s em passos de 1/60 s, aplica a câmera da cena, desenha e devolve o quadro em JPEG.
// Também anota os sons que o jogo tocaria (audio.play) com o tempo do quadro: a trilha do trailer toca esses sons
// sintetizados (os mesmos do jogo) na hora certa.
export function installRecorder() {
  /* eslint-disable no-undef */
  window.__freezeReview = true;
  document.getElementById('loading')?.remove();
  const G = window.__game;
  // sem objetivo escrito, marcador laranja e dicas em balão (modo desafio): imagem limpa
  G.settings.setNoHints(true);
  const cam = G.engine.camera;
  const R = (window.__rec = {
    t: 30, // relógio do jogo (s)
    frameT: 0, // tempo do quadro em gravação (s, desde o começo da cena)
    recording: false,
    sounds: [],
    loops: {},
    keys: new Set(),
    drive: null,
    brain: null,
    cam: null,
    camArgs: null,
    camT0: 0,
    camState: {},
    fov0: cam.fov,
    warnings: [],
  });

  const key = (code, down) => {
    if (down) R.keys.add(code);
    else R.keys.delete(code);
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code }));
  };
  window.__key = key;
  // teclas (8 direções relativas à câmera do jogo) para andar na direção (dx, dz) do mundo, como nos testes
  const keysFor = (dx, dz) => {
    const B = G.game.debug.cam.basis();
    const fwd = dx * B.fx + dz * B.fz;
    const rgt = dx * B.rx + dz * B.rz;
    const k = ((Math.round(Math.atan2(rgt, fwd) / (Math.PI / 4)) % 8) + 8) % 8;
    return [['KeyW'], ['KeyW', 'KeyD'], ['KeyD'], ['KeyS', 'KeyD'], ['KeyS'], ['KeyS', 'KeyA'], ['KeyA'], ['KeyW', 'KeyA']][k];
  };
  window.__keysFor = keysFor;
  const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  const setMove = (want) => {
    for (const k of MOVE) {
      const on = want.includes(k);
      if (on !== R.keys.has(k)) key(k, on);
    }
  };
  // anda a dog ativa até (x, z): reavalia as teclas a cada passo
  const driveStep = () => {
    const d = R.drive;
    if (!d) return;
    const c = G.game.debug.ctrls[G.game.activeDog];
    const dx = d.x - c.x;
    const dz = d.z - c.z;
    const dist = Math.hypot(dx, dz);
    if (dist < d.tol || (d.until && R.t > d.until)) {
      setMove([]);
      if (d.extra) for (const k of d.extra) if (R.keys.has(k)) key(k, false);
      R.drive = null;
      return;
    }
    setMove(keysFor(dx, dz));
    if (d.extra) for (const k of d.extra) if (!R.keys.has(k)) key(k, true);
  };

  const H = {
    G,
    get L() { return G.layout; },
    info: () => G.game.debug.info(),
    key,
    tap: (code) => { key(code, true); window.__step(1); key(code, false); },
    keysFor,
    setMove,
    dog(name) {
      const c = G.game.debug.ctrls[name];
      const o = G.dogs[name].object.position;
      return { x: o.x, y: o.y, z: o.z, cx: c.x, cz: c.z, yaw: c.yaw };
    },
    lerp: (a, b, t) => a + (b - a) * t,
    clamp: (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)),
    smooth: (t) => t * t * (3 - 2 * t),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    mix3: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    /** Câmera por quadros-chave: keys = [{ at (s), pos, look, fov? }], interpolação suave entre eles. */
    path(t, keys, ease = 'inOut') {
      if (t <= keys[0].at) return keys[0];
      for (let i = 1; i < keys.length; i++) {
        const a = keys[i - 1];
        const b = keys[i];
        if (t <= b.at) {
          let k = (t - a.at) / Math.max(1e-6, b.at - a.at);
          k = ease === 'linear' ? k : ease === 'out' ? H.out(k) : H.inOut(k);
          return {
            pos: H.mix3(a.pos, b.pos, k),
            look: H.mix3(a.look, b.look, k),
            fov: a.fov !== undefined && b.fov !== undefined ? H.lerp(a.fov, b.fov, k) : (b.fov ?? a.fov),
          };
        }
      }
      return keys[keys.length - 1];
    },
    /** Órbita em volta de um ponto: ângulo a (rad, 0 = +z), raio r, altura y. */
    orbit(center, a, r, y, lookY = center[1]) {
      return { pos: [center[0] + Math.sin(a) * r, y, center[2] + Math.cos(a) * r], look: [center[0], lookY, center[2]] };
    },
    /** Segue uma dog com atraso (estado guardado em R.camState). off/lookOff no mundo. */
    follow(name, off, lookOff = [0, 0.25, 0], lag = 0.12) {
      const d = H.dog(name);
      const tgt = [d.x + lookOff[0], (d.y || 0) + lookOff[1], d.z + lookOff[2]];
      const s = R.camState;
      const k = s.f ? 1 - Math.exp(-(1 / 30) / Math.max(0.001, lag)) : 1;
      s.f = s.f ? H.mix3(s.f, tgt, k) : tgt;
      return { pos: [s.f[0] + off[0], s.f[1] + off[1] - lookOff[1], s.f[2] + off[2]], look: s.f };
    },
  };
  window.__H = H;

  window.__step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      if (R.brain) {
        try { R.brain(H, R.brainArgs, R.brainState); } catch (e) { R.warnings.push(`brain: ${e.message}`); R.brain = null; }
      }
      driveStep();
      R.t += 1 / 60;
      G.game.update(1 / 60, R.t);
      G.seeThrough();
      G.feedback.update(1 / 60, R.t);
      G.particles.update(1 / 60);
    }
  };
  window.__stepUntil = (src, max = 600, args = null) => {
    const fn = new Function(`return (${src})`)();
    for (let i = 0; i < max; i++) {
      window.__step(1);
      if (fn(G.game.debug.info(), H, args)) return i + 1;
    }
    return 0;
  };
  window.__setCam = (src, args) => {
    R.cam = src ? new Function(`return (${src})`)() : null;
    R.camArgs = args ?? null;
    R.camT0 = R.frameT;
    R.camState = {};
  };
  window.__setBrain = (src, args) => {
    R.brain = src ? new Function(`return (${src})`)() : null;
    R.brainArgs = args ?? null;
    R.brainState = {};
  };

  const applyCam = () => {
    if (!R.cam) {
      if (cam.fov !== R.fov0) { cam.fov = R.fov0; cam.updateProjectionMatrix(); }
      return null;
    }
    const c = R.cam(R.frameT - R.camT0, H, R.camArgs);
    if (!c) return null;
    let pos = c.pos;
    const look = c.look;
    // retrato (9:16): a mesma cena um pouco mais de longe, para caber de lado
    const portrait = window.innerHeight > window.innerWidth;
    const pull = portrait ? (R.camArgs?.pull ?? 1) : 1;
    if (pull !== 1) pos = [look[0] + (pos[0] - look[0]) * pull, look[1] + (pos[1] - look[1]) * pull, look[2] + (pos[2] - look[2]) * pull];
    cam.position.set(pos[0], pos[1], pos[2]);
    cam.lookAt(look[0], look[1], look[2]);
    const fov = (portrait ? (c.vfov ?? R.camArgs?.vfov) : null) ?? c.fov ?? R.fov0;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    return { pos, look, fov };
  };

  // sons: o jogo continua mudo; a chamada vira uma anotação com o tempo do quadro
  const LOOPS = new Set(['cartRoll', 'crateDrag']);
  G.audio.play = (name, opts = {}) => {
    if (!R.recording) return;
    if (LOOPS.has(name)) {
      const last = R.loops[name];
      if (last && R.frameT - last.t < 0.1) return;
      R.loops[name] = { t: R.frameT };
      R.sounds.push({ t: +R.frameT.toFixed(4), name, loop: true, speed: +(opts.speed ?? 0.8).toFixed(3) });
      return;
    }
    R.sounds.push({
      t: +R.frameT.toFixed(4),
      name,
      pan: +(opts.pan ?? 0).toFixed(3),
      volume: +(opts.volume ?? 1).toFixed(3),
      pitch: +(opts.pitch ?? 1).toFixed(3),
    });
  };

  /** Um quadro do vídeo: avança o jogo (exceto no primeiro), aplica a câmera, desenha e devolve o JPEG. */
  window.__frame = (index, fps, quality) => {
    R.recording = true;
    R.frameT = index / fps;
    if (index > 0) window.__step(Math.round(60 / fps));
    const c = applyCam();
    G.engine.render(1 / fps, R.t);
    const url = G.engine.renderer.domElement.toDataURL('image/jpeg', quality);
    const i = G.game.debug.info();
    return { url, cam: c, stage: i.stage, active: i.activeDog };
  };
  window.__stopRecording = () => {
    R.recording = false;
    for (const k of [...R.keys]) key(k, false);
    R.drive = null;
    R.brain = null;
  };
  /** Cópia serializável do layout da fase (sem ciclos nem funções). */
  window.__layout = () => {
    const seen = new WeakSet();
    return JSON.parse(JSON.stringify(G.layout || {}, (k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return undefined;
        seen.add(v);
      }
      return typeof v === 'function' ? undefined : v;
    }));
  };
}
