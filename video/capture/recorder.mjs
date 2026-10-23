// Gravador de cenas do trailer (lado do Node). Abre o jogo no Chromium do Playwright (servidor Vite do próprio
// repositório, o mesmo dos scripts de captura), congela o laço e grava cada quadro com a câmera da cena.
// Cada cena vira um MP4 sem perdas visíveis (x264 CRF 12) e um JSON com os sons do jogo e avisos.
// Só no GitHub Actions (AGENTS.md: nada pesado no PC do usuário).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { installRecorder } from './page-helpers.js';

export const FPS = 30;
const JPEG_QUALITY = 0.94;

/** Codificador de uma cena: recebe JPEGs pelo stdin. */
function startEncoder(file) {
  const ff = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com ${code} em ${file}`))));
  });
  return {
    write: (buf) => new Promise((resolve, reject) => {
      if (ff.stdin.write(buf)) resolve();
      else ff.stdin.once('drain', resolve);
      ff.stdin.once('error', reject);
    }),
    end: async () => { ff.stdin.end(); await done; },
  };
}

export class Recorder {
  /**
   * @param {import('playwright-core').Page} page
   * @param {{ note: (s: string) => void, peek: () => Promise<string> }} guard
   * @param {{ id: string, out: string, variant: string }} opts
   */
  constructor(page, guard, { id, out, variant }) {
    this.page = page;
    this.guard = guard;
    this.id = id;
    this.variant = variant;
    this.out = out;
    this.frames = 0;
    this.encoder = null;
    this.warnings = [];
    this.marks = [];
    this.timing = { renderMs: 0 };
  }

  async open(url) {
    await this.page.goto(url);
    await this.page.waitForFunction(() => window.__game?.game?.state === 'playing', null, { timeout: 180000 });
    await this.page.evaluate(installRecorder);
    this.L = await this.page.evaluate(() => window.__layout());
    return this.L;
  }

  ev(fn, arg) { return this.page.evaluate(fn, arg); }
  warn(msg) {
    this.warnings.push(`${(this.frames / FPS).toFixed(2)} s: ${msg}`);
    console.log(`  [aviso ${this.id}/${this.variant}] ${msg}`);
  }
  /** Avança o jogo n passos de 1/60 s sem gravar. */
  step(n = 1) { return this.page.evaluate((k) => window.__step(k), n); }
  /** Avança sem gravar até pred(info, H, args) (no máximo `max` passos de 1/60 s). Não reprova: avisa. */
  async until(pred, max = 600, args = null) {
    const n = await this.page.evaluate(({ src, m, a }) => window.__stepUntil(src, m, a), { src: pred.toString(), m: max, a: args });
    if (!n) this.warn(`condição não alcançada: ${String(pred).slice(0, 120)}`);
    return n > 0;
  }
  key(code, down = true) { return this.page.evaluate(([c, d]) => window.__key(c, d), [code, down]); }
  up(code) { return this.key(code, false); }
  async keys(codes, down = true) { for (const c of codes) await this.key(c, down); }
  tap(code) { return this.page.evaluate((c) => window.__H.tap(c), code); }
  keysFor(dx, dz) { return this.page.evaluate(([x, z]) => window.__keysFor(x, z), [dx, dz]); }
  /** A dog ativa anda até (x, z) durante os próximos passos (gravando ou não). extra: teclas seguradas junto. */
  drive(x, z, { tol = 0.15, extra = null, maxSec = 8 } = {}) {
    return this.page.evaluate(([a, b, t, e, m]) => {
      window.__rec.drive = { x: a, z: b, tol: t, extra: e, until: window.__rec.t + m };
    }, [x, z, tol, extra, maxSec]);
  }
  /** Função chamada antes de cada passo de 1/60 s: (H, args, state) => void (decide teclas). */
  brain(fn, args = null) { return this.page.evaluate(([s, a]) => window.__setBrain(s, a), [fn ? fn.toString() : null, args]); }
  /** Câmera dos próximos quadros: (t, H, args) => { pos, look, fov? } ou null = câmera do jogo. */
  camera(fn, args = null) { return this.page.evaluate(([s, a]) => window.__setCam(s, a), [fn ? fn.toString() : null, args]); }
  info() { return this.page.evaluate(() => window.__game.game.debug.info()); }
  dog(name) { return this.page.evaluate((n) => window.__H.dog(n), name); }

  /** Etapa, dog ativa, posições (teleporte só no preparo), caixotes, atalhos de estado e o Fica. */
  setup(o) {
    return this.page.evaluate((opts) => {
      const g = window.__game.game;
      const H = window.__H;
      if (opts.stage) g.debug.setStage(opts.stage, opts.active);
      for (let k = 0; opts.active && g.activeDog !== opts.active && k < 30; k++) { H.tap('KeyQ'); window.__step(4); }
      for (const [name, p] of Object.entries(opts.place || {})) {
        g.debug.teleport(name, p.x, p.z);
        if (p.yaw !== undefined) g.debug.ctrls[name].yaw = p.yaw;
      }
      for (const [id, x, z] of opts.crates || []) g.puzzle.placeCrate(id, x, z);
      for (const [key, value] of opts.set || []) g.puzzle.debugSet(key, value);
      if (opts.stay) g.setStay(opts.stay, true);
      if (opts.unstay) g.setStay(opts.unstay, false);
      window.__step(opts.settle ?? 20);
      return g.activeDog;
    }, o);
  }

  async ensureEncoder() {
    if (this.encoder) return;
    mkdirSync(this.out, { recursive: true });
    this.file = `${this.out}/${this.id}${this.variant === 'v' ? '-v' : ''}.mp4`;
    this.encoder = startEncoder(this.file);
    this.t0 = Date.now();
  }

  /** Grava `seconds` de vídeo (30 quadros/s). onFrame(k) pode mexer em teclas entre quadros. */
  async record(seconds, onFrame = null) {
    await this.ensureEncoder();
    const n = Math.round(seconds * FPS);
    for (let k = 0; k < n; k++) {
      if (onFrame) await onFrame(k, this.frames);
      await this.frame();
    }
  }
  /** Grava até pred(info) (no máximo maxSec) e mais `after` s. → se a condição veio. */
  async recordUntil(pred, maxSec = 6, after = 0) {
    await this.ensureEncoder();
    const src = pred.toString();
    let ok = false;
    for (let k = 0; k < Math.round(maxSec * FPS); k++) {
      await this.frame();
      ok = await this.page.evaluate((s) => !!new Function(`return (${s})`)()(window.__game.game.debug.info(), window.__H), src);
      if (ok) break;
    }
    if (!ok) this.warn(`gravou sem alcançar: ${src.slice(0, 120)}`);
    if (after > 0) await this.record(after);
    return ok;
  }
  /** Avança `seconds` sem desenhar nem gravar (jogo e câmera seguem): vira um corte seco na cena gravada. */
  async skip(seconds) {
    const n = Math.round(seconds * FPS);
    for (let k = 0; k < n; k++) await this.page.evaluate(([i, fps]) => window.__frame(i, fps, 0, false), [this.frames, FPS]);
  }
  /** Avança sem desenhar até pred(info) (no máximo maxSec), quadro a quadro como na gravação. */
  async skipUntil(pred, maxSec = 6) {
    const src = pred.toString();
    for (let k = 0; k < Math.round(maxSec * FPS); k++) {
      await this.page.evaluate(([i, fps]) => window.__frame(i, fps, 0, false), [this.frames, FPS]);
      if (await this.page.evaluate((s) => !!new Function(`return (${s})`)()(window.__game.game.debug.info(), window.__H), src)) return true;
    }
    this.warn(`pulou sem alcançar: ${src.slice(0, 120)}`);
    return false;
  }
  /** Marca um instante da cena (para a montagem: por exemplo, o pombo voando). */
  mark(name) { this.marks.push({ name, t: +(this.frames / FPS).toFixed(3) }); }

  async frame() {
    const t = Date.now();
    const r = await this.page.evaluate(([i, fps, q]) => window.__frame(i, fps, q), [this.frames, FPS, JPEG_QUALITY]);
    this.timing.renderMs += Date.now() - t;
    const b64 = r.url.slice(r.url.indexOf(',') + 1);
    await this.encoder.write(Buffer.from(b64, 'base64'));
    if (this.frames % 30 === 0) this.guard.note(`${this.id}/${this.variant} quadro ${this.frames}`);
    this.frames++;
  }

  async finish(meta = {}) {
    await this.page.evaluate(() => window.__stopRecording());
    const rec = await this.page.evaluate(() => ({ sounds: window.__rec.sounds, warnings: window.__rec.warnings }));
    if (this.encoder) await this.encoder.end();
    const json = {
      id: this.id,
      variant: this.variant,
      fps: FPS,
      frames: this.frames,
      seconds: +(this.frames / FPS).toFixed(3),
      sounds: rec.sounds,
      marks: this.marks,
      warnings: [...this.warnings, ...rec.warnings],
      msPerFrame: this.frames ? Math.round(this.timing.renderMs / this.frames) : 0,
      ...meta,
    };
    writeFileSync(`${this.out}/${this.id}${this.variant === 'v' ? '-v' : ''}.json`, JSON.stringify(json, null, 2));
    console.log(`  ${this.id}/${this.variant}: ${this.frames} quadros, ${json.msPerFrame} ms/quadro, ${rec.sounds.length} sons, ${json.warnings.length} avisos`);
    return json;
  }
}
