// Capturas de revisão dos extras escondidos (src/game/extras.js) em qualidade visual completa: a sequência do
// cocô quadro a quadro (as duas dogs, de lado e por trás) e cada animação do cenário nas oito fases.
// Roda no GitHub Actions (E2E manual, suíte extras), depois da partida. O laço do jogo fica congelado e o script
// avança quadro a quadro (1/60 s); teclas reais chegam pelos ouvintes do jogo; teleporte só prepara as cenas.
// Saída: shots/extras-revisao/*.png.
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const OUT = 'shots/extras-revisao';
mkdirSync(OUT, { recursive: true });
let server, browser;
const errors = [];
let shots = 0;
try {
  server = await createServer({ configFile: 'tools/scripts/vite.nohmr.config.mjs', server: { port: 0 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch(browserOptions());
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
  });

  /** Abre a fase congelada, com as funções de passo e de câmera. */
  async function open(level) {
    await page.evaluate(() => { window.__freezeReview = false; }).catch(() => {});
    await page.goto(`${url}?level=${level}&play`);
    await page.waitForFunction(() => window.__game?.game?.state === 'playing', null, { timeout: 180000 });
    await page.evaluate(() => {
      window.__freezeReview = true;
      document.getElementById('loading')?.remove();
      const G = window.__game;
      const rev = { t: 20 };
      window.__step = (n = 1) => {
        for (let i = 0; i < n; i++) {
          rev.t += 1 / 60;
          G.game.update(1 / 60, rev.t);
          G.seeThrough();
          G.feedback.update(1 / 60, rev.t);
          G.particles.update(1 / 60);
        }
      };
      window.__stepUntil = (src, max = 600) => {
        const fn = new Function(`return (${src})`)();
        for (let i = 0; i < max; i++) {
          window.__step(1);
          if (fn(G.game.debug.info())) return true;
        }
        return false;
      };
      window.__render = (cam) => {
        if (cam) {
          G.engine.camera.position.set(...cam.pos);
          G.engine.camera.lookAt(...cam.look);
          G.engine.camera.updateMatrixWorld();
        }
        G.engine.render(1 / 60, rev.t);
        G.engine.renderer.getContext().finish();
      };
      window.__key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code }));
      window.__tap = (code) => { window.__key(code, true); window.__step(1); window.__key(code, false); window.__step(1); };
    });
    await page.evaluate(() => window.__step(30));
  }
  const step = (n) => page.evaluate((k) => window.__step(k), n);
  const until = async (pred, max = 900) => {
    const ok = await page.evaluate(({ src, max: m }) => window.__stepUntil(src, m), { src: pred.toString(), max });
    if (!ok) throw new Error(`condição não alcançada: ${pred}`);
  };
  const tap = (code) => page.evaluate((c) => window.__tap(c), code);
  const shot = async (name, cam = null) => {
    await page.evaluate((c) => window.__render(c), cam);
    await page.screenshot({ path: `${OUT}/${name}.png`, style: '#ui, #loading { display: none !important; }' });
    shots++;
    console.log(`  captura: ${OUT}/${name}.png`);
  };
  /** Dog ativa = name, parada em (x, z) olhando para yaw. */
  const put = (name, x, z, yaw) => page.evaluate(({ n, x: px, z: pz, yaw: y }) => {
    const g = window.__game.game;
    if (g.activeDog !== n) window.__tap('KeyQ');
    g.debug.teleport(n, px, pz);
    g.debug.ctrls[n].yaw = y;
    window.__step(12);
  }, { n: name, x, z, yaw });
  const dogAt = (name) => page.evaluate((n) => { const c = window.__game.game.debug.ctrls[n]; return { x: c.x, z: c.z, yaw: c.yaw }; }, name);
  /** Câmeras em volta da dog: lado (direito), trás em 3/4 e frente em 3/4. */
  const around = (d, kind, dist = 1.15, h = 0.55, lookY = 0.22) => {
    const fx = Math.sin(d.yaw), fz = Math.cos(d.yaw);
    const rx = fz, rz = -fx; // direita da dog
    const off = kind === 'side' ? [rx, rz] : kind === 'back' ? [-fx * 0.85 + rx * 0.55, -fz * 0.85 + rz * 0.55] : [fx * 0.85 + rx * 0.6, fz * 0.85 + rz * 0.6];
    const L = Math.hypot(off[0], off[1]);
    return { pos: [d.x + (off[0] / L) * dist, h, d.z + (off[1] / L) * dist], look: [d.x, lookY, d.z] };
  };
  const collectAll = () => page.evaluate(() => {
    const g = window.__game.game;
    for (const c of window.__game.layout.COLLECTIBLES) {
      g.debug.teleport(g.activeDog, c.x, c.z);
      window.__step(10);
    }
  });

  // 1. o cocô, quadro a quadro, com as duas dogs (cozinha da fase 5, com espaço em volta)
  for (const name of ['radhija', 'rhaenyra']) {
    await open('fase5');
    await put(name, 0.2, 1.3, 2.4);
    await collectAll();
    await put(name, 0.2, 1.3, 2.4);
    await tap('KeyC');
    // a câmera acompanha a direção final (depois da voltinha ela volta para a mesma)
    const d = await dogAt(name);
    const marks = [[-0.17, 'voltinha'], [0.08, 'agacha'], [0.24, 'forca-1'], [0.34, 'saindo'], [0.46, 'saiu'], [0.58, 'alivio'], [0.66, 'passinho'], [0.76, 'cava-1'], [0.84, 'cava-2'], [0.97, 'fim']];
    for (const [k, label] of marks) {
      await until(new Function('i', `return (i.extras?.poop?.k ?? 1) >= ${k}`));
      await shot(`${name}-coco-${label}-lado`, around(d, 'side'));
      if (['forca-1', 'saindo', 'saiu', 'cava-1', 'fim'].includes(label)) await shot(`${name}-coco-${label}-tras`, around(d, 'back', 1.2, 0.6));
      if (['forca-1', 'alivio'].includes(label)) await shot(`${name}-coco-${label}-frente`, around(d, 'front', 1.05, 0.45, 0.3));
    }
    await until((i) => !i.extras?.poop);
    await step(40);
    await shot(`${name}-coco-no-chao`, around(d, 'back', 0.9, 0.45, 0.06));
  }

  /** E perto de um ponto do cenário e capturas nos momentos pedidos. */
  async function scene(level, id, who, marks, opts = {}) {
    await open(level);
    if (opts.stage) await page.evaluate((s) => window.__game.game.debug.setStage(s), opts.stage);
    const sp = await page.evaluate((i) => window.__game.game.levelDef.extras.find((e) => e.id === i), id);
    // do lado de fora do ponto, oposto a `face` (como em test/extras.test.mjs)
    const face = sp.face ?? sp;
    let x, z;
    if (sp.stand && !sp.hop) { x = sp.stand.x; z = sp.stand.z + 0.12; } else {
      const away = Math.hypot(sp.x - face.x, sp.z - face.z) > 1e-3 ? Math.atan2(sp.x - face.x, sp.z - face.z) : (opts.approach ?? 0);
      const d = (sp.r ?? 0.6) - 0.15;
      x = sp.x + Math.sin(away) * d;
      z = sp.z + Math.cos(away) * d;
    }
    const p = await page.evaluate(({ n, px, pz }) => window.__game.game.debug.teleport(n, px, pz), { n: who, px: x, pz: z });
    await put(who, p.x, p.z, Math.atan2(face.x - p.x, face.z - p.z));
    await tap('KeyE');
    await until((i) => !!i.extras?.act, 30);
    for (const [k, label, kind] of marks) {
      await until(new Function('i', `return (i.extras?.act?.k ?? 1) >= ${k}`));
      const d = await dogAt(who);
      await shot(`${level}-${id}-${label}`, around(d, kind || 'front', opts.dist ?? 1.2, opts.h ?? 0.6, opts.lookY ?? 0.22));
    }
    await until((i) => !i.extras?.act);
  }

  // 2. as animações do cenário
  await scene('fase5', 'racao', 'radhija', [[0.5, 'comendo', 'side'], [0.62, 'comendo-frente', 'front']]);
  await scene('fase5', 'agua', 'rhaenyra', [[0.5, 'bebendo', 'front']]);
  await scene('fase7', 'balanco-1', 'radhija', [[0.06, 'pulando', 'front'], [0.45, 'balancando', 'front'], [0.62, 'balancando-2', 'side']], { dist: 1.8, h: 0.9, lookY: 0.45 });
  await scene('fase7', 'areia-sul', 'rhaenyra', [[0.12, 'pulando', 'side'], [0.4, 'cavando', 'side'], [0.6, 'cavando-2', 'front']]);
  await scene('fase8', 'pilha-de-roupa', 'radhija', [[0.24, 'deitando', 'front'], [0.38, 'de-costas', 'side'], [0.6, 'rolando', 'front']], { dist: 1.4, h: 0.8, lookY: 0.12 });
  await scene('fase1', 'poca-bebedouro', 'radhija', [[0.5, 'bebendo', 'side']]);
  await scene('fase1', 'lavanda', 'rhaenyra', [[0.35, 'cheirando', 'side'], [0.64, 'atchim', 'front']]);
  await scene('fase3', 'lago-3', 'rhaenyra', [[0.5, 'bebendo', 'side']]);
  await scene('fase4', 'floreira-3l', 'radhija', [[0.64, 'atchim', 'front']]);
  await scene('fase6', 'bolinha', 'radhija', [[0.43, 'focinhada', 'side'], [0.9, 'bola-rolou', 'front']]);
  await scene('fase2', 'irrigador', 'rhaenyra', [[0.4, 'esguicho', 'front'], [0.66, 'sacudindo', 'front']], { stage: 'sprinklersOff' });

  if (errors.length) throw new Error(`erros no navegador:\n${errors.join('\n')}`);
  console.log(`\n${shots} capturas de revisão; sem erros de console`);
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
}
