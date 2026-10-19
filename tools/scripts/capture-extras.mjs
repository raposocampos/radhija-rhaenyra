// Capturas de revisão dos extras escondidos (src/game/extras.js) em qualidade visual completa: a sequência do
// cocô quadro a quadro (as duas dogs: a voltinha, a agachada de lado, por trás e de frente, e a comemoração com o
// brilho, os zoomies, a reverência, os pulinhos e a irmã), no gramado da fase 1 e na cozinha da fase 5, e cada
// animação do cenário nas oito fases.
// Roda no GitHub Actions (E2E manual, suíte extras), depois da partida. O laço do jogo fica congelado e o script
// avança quadro a quadro (1/60 s); teclas reais chegam pelos ouvintes do jogo; teleporte só prepara as cenas.
// Saída: shots/extras-revisao/*.png.
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';
import { closeBrowser, openPage } from './lib/page-guard.mjs';

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
  // redes de prazo (lib/page-guard.mjs): uma aba que trava ou cai encerra o passo em minutos, com o passo e o estado
  const { page, guard } = await openPage(browser, { viewport: { width: 1280, height: 720 } }, { name: 'extras' });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
  });

  /** Abre a fase congelada, com as funções de passo e de câmera. */
  async function open(level) {
    guard.note(`abrir ${level}`);
    await page.evaluate(() => { window.__freezeReview = false; }).catch(() => {});
    await page.goto(`${url}?level=${level}&play`);
    await page.waitForFunction(() => window.__game?.game?.state === 'playing', null, { timeout: 120000 });
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
    if (!ok) throw new Error(`condição não alcançada: ${pred}; ${await guard.peek()}`);
  };
  const tap = (code) => page.evaluate((c) => window.__tap(c), code);
  const shot = async (name, cam = null) => {
    await page.evaluate((c) => window.__render(c), cam);
    await page.screenshot({ path: `${OUT}/${name}.png`, style: '#ui, #loading { display: none !important; }' });
    shots++;
    guard.note(`captura ${name}`);
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

  /** Câmera fixa olhando (x, z) de `dist` m na direção da câmera do jogo (o que o jogador vê, mais perto). */
  const gameCam = () => page.evaluate(() => { const c = window.__game.engine.camera.position; return { x: c.x, z: c.z }; });
  const toward = (at, cp, dist, h, lookY = 0.15) => {
    const dx = cp.x - at.x;
    const dz = cp.z - at.z;
    const L = Math.hypot(dx, dz) || 1;
    return { pos: [at.x + (dx / L) * dist, h, at.z + (dz / L) * dist], look: [at.x, lookY, at.z] };
  };
  /** Como o jogador vê (um quadro para a câmera do jogo voltar à pose dela). */
  const shotGame = async (name) => {
    await step(1);
    await shot(name, null);
  };
  /** O lugar mais aberto da fase (grade, de 2,6 m livres em volta para baixo), para a volta inteira e os zoomies. */
  const openSpot = () => page.evaluate(() => {
    const w = window.__game.game.debug.world;
    const b = w.bounds;
    for (const r of [2.6, 2.4, 2.2, 2.0]) {
      for (let z = b.minZ + r; z <= b.maxZ - r; z += 0.25) {
        for (let x = b.minX + r; x <= b.maxX - r; x += 0.25) if (!w.overlaps(x, z, r, 'large')) return { x, z };
      }
    }
    return null;
  });
  const plopAt = () => page.evaluate(() => window.__game.game.debug.events('extra:plop').at(-1)?.payload ?? null);

  /**
   * O cocô inteiro com a dog `name` em `at` (a irmã sentada ao lado, para reagir): a voltinha (de cima, de perto, os
   * pés e como o jogador vê), a agachada (de lado, por trás e de frente) e a comemoração (o brilho de perto, os
   * zoomies de longe, a reverência, os pulinhos, a irmã e o cocô no fim).
   */
  async function poopScene(level, name, at, tag, { sister = true, party = true } = {}) {
    await open(level);
    await put(name, at.x, at.z, at.yaw);
    await collectAll();
    await put(name, at.x, at.z, at.yaw);
    const cp = await gameCam();
    if (sister) {
      // ao lado dela, de frente para a câmera, a ~2 m
      await page.evaluate(({ n, at: a, cp: c }) => {
        const g = window.__game.game;
        const vx = a.x - c.x;
        const vz = a.z - c.z;
        const L = Math.hypot(vx, vz) || 1;
        g.debug.teleport(n, a.x - (vz / L) * 1.9 - (vx / L) * 0.4, a.z + (vx / L) * 1.9 - (vz / L) * 0.4);
        g.debug.ctrls[n].yaw = Math.atan2(c.x - a.x, c.z - a.z);
        g.setStay(n, true);
        window.__step(40);
      }, { n: name === 'radhija' ? 'rhaenyra' : 'radhija', at, cp });
      await put(name, at.x, at.z, at.yaw);
    }
    await step(30);
    const s0 = await dogAt(name);
    await tap('KeyC');
    const wide = toward(s0, cp, 2.2, 1.4, 0.1);
    for (const [k, label] of [[0.08, 'fareja'], [0.28, 'volta-a'], [0.45, 'volta-b'], [0.62, 'volta-c'], [0.8, 'volta-d'], [0.96, 'acomoda']]) {
      await until(new Function('i', `const p = i.extras?.poop; return !p || p.phase !== 'pre' || (p.t + p.pre) / p.pre >= ${k}`));
      await shot(`${tag}-1-${label}`, wide);
      if (label === 'volta-b' || label === 'volta-c') {
        const d = await dogAt(name);
        await shot(`${tag}-1-${label}-perto`, around(d, 'side', 1.15, 0.5));
        await shot(`${tag}-1-${label}-patas`, around(d, 'side', 0.8, 0.2, 0.08));
      }
      if (label === 'volta-b') await shotGame(`${tag}-1-${label}-jogo`);
    }
    // a agachada (como na versão aprovada)
    await until((i) => i.extras?.poop?.phase === 'squat');
    const d = await dogAt(name);
    for (const [k, label] of [[0.08, 'agacha'], [0.24, 'forca'], [0.34, 'saindo'], [0.58, 'alivio'], [0.66, 'passinho'], [0.8, 'cava']]) {
      await until(new Function('i', `return (i.extras?.poop?.k ?? 9) >= ${k}`));
      await shot(`${tag}-2-${label}-lado`, around(d, 'side'));
      if (['forca', 'saindo', 'cava'].includes(label)) await shot(`${tag}-2-${label}-tras`, around(d, 'back', 1.2, 0.6));
      if (['forca', 'alivio'].includes(label)) await shot(`${tag}-2-${label}-frente`, around(d, 'front', 1.05, 0.45, 0.3));
      if (label === 'forca') await shotGame(`${tag}-2-${label}-jogo`);
    }
    // a comemoração
    await until((i) => (i.extras?.poop?.party ?? -1) >= 0);
    const P = await page.evaluate(() => window.__game.game.debug.info().extras.poop);
    const pp = await plopAt();
    const far = toward(pp, cp, 3.0, 1.7, 0.15);
    const sisName = name === 'radhija' ? 'rhaenyra' : 'radhija';
    /** @type {[number, string, () => Promise<object | null> | object | null][]} */
    const marks = [
      [0.22, 'brilho-perto', () => toward(pp, cp, 0.75, 0.32, 0.12)],
      [0.4, 'brilho', () => far],
      [0.62, 'brilho-perto-2', () => toward(pp, cp, 0.6, 0.22, 0.1)],
      [0.9, 'jogo', null],
    ];
    if (party) {
      for (let s = 0.55; s < P.end; s += 0.3) marks.push([s, `festa-${s.toFixed(2)}`, () => far]);
      const bow = P.end - 2.25 + 0.38;
      const hop = P.end - 1.43 + 0.17;
      marks.push([bow, 'reverencia', async () => around(await dogAt(name), 'side', 1.2, 0.45)]);
      marks.push([bow + 0.02, 'reverencia-frente', async () => around(await dogAt(name), 'front', 1.1, 0.4, 0.2)]);
      marks.push([hop, 'pulinho', async () => around(await dogAt(name), 'side', 1.25, 0.5)]);
      marks.push([P.end - 0.35, 'orgulhosa', async () => around(await dogAt(name), 'front', 1.1, 0.45, 0.3)]);
      if (sister) {
        marks.push([0.5, 'irma-uau', async () => around(await dogAt(sisName), 'front', 1.05, 0.45, 0.32)]);
        marks.push([1.0, 'irma-coracoes', async () => around(await dogAt(sisName), 'front', 1.3, 0.55, 0.4)]);
      }
    }
    marks.sort((a, b) => a[0] - b[0]);
    for (const [s, label, cam] of marks) {
      await until(new Function('i', `const p = i.extras?.poop; return !p || p.party >= ${s}`));
      if (cam === null) await shotGame(`${tag}-3-${label}`);
      else await shot(`${tag}-3-${label}`, await cam());
    }
    await until((i) => !i.extras?.poop);
    await step(40);
    await shot(`${tag}-4-coco-no-chao`, toward(pp, cp, 0.55, 0.2, 0.06));
    await step(100); // a estrelinha pisca de vez em quando
    await shot(`${tag}-4-coco-depois`, toward(pp, cp, 0.55, 0.2, 0.06));
  }

  // 1. o cocô com as duas dogs: no gramado aberto da fase 1 (volta inteira e zoomies) e na cozinha da fase 5
  await open('fase1');
  const lawn = await openSpot();
  if (!lawn) throw new Error('a fase 1 não tem um lugar aberto para a volta inteira');
  for (const name of ['radhija', 'rhaenyra']) await poopScene('fase1', name, { ...lawn, yaw: 0.4 }, `${name}-gramado`);
  for (const name of ['radhija', 'rhaenyra']) await poopScene('fase5', name, { x: 0.2, z: 1.3, yaw: 2.4 }, `${name}-cozinha`, { sister: false, party: name === 'radhija' });

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
  // rolar: as duas dogs, quadro a quadro, com a câmera baixa (o contato com o chão aparece) e de cima
  for (const who of ['radhija', 'rhaenyra']) {
    await scene('fase8', 'pilha-de-roupa', who, [
      [0.08, `${who}-deita`, 'side'], [0.16, `${who}-deitada`, 'front'], [0.22, `${who}-tomba`, 'side'], [0.3, `${who}-de-lado`, 'side'],
      [0.4, `${who}-de-costas`, 'side'], [0.48, `${who}-esfrega`, 'front'], [0.56, `${who}-esfrega-2`, 'side'], [0.64, `${who}-esfrega-3`, 'back'],
      [0.74, `${who}-volta`, 'side'], [0.83, `${who}-de-brucos`, 'front'], [0.92, `${who}-levanta`, 'side'],
    ], { dist: 1.25, h: 0.32, lookY: 0.12 });
  }
  await scene('fase8', 'pilha-de-roupa', 'radhija', [[0.24, 'deitando', 'front'], [0.42, 'de-costas', 'side'], [0.58, 'rolando', 'front']], { dist: 1.4, h: 0.8, lookY: 0.12 });
  // a mesma rolagem no tapete persa da fase 9 (à noite, na frente da lareira)
  for (const who of ['radhija', 'rhaenyra']) {
    await scene('fase9', 'tapete', who, [
      [0.16, `${who}-deitada`, 'front'], [0.3, `${who}-de-lado`, 'back'], [0.46, `${who}-de-costas`, 'front'],
      [0.58, `${who}-esfrega`, 'back'], [0.83, `${who}-de-brucos`, 'front'],
    ], { dist: 1.25, h: 0.32, lookY: 0.12 });
  }
  await scene('fase9', 'tapete', 'radhija', [[0.5, 'de-costas-cima', 'front']], { dist: 1.6, h: 1.0, lookY: 0.1 });
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
  await closeBrowser(browser);
  await server?.close();
}
