// Capturas na nuvem: mesmo enquadramento/iluminação/tempo para base e head.
// Não usa a redução de qualidade visual do harness de partidas.
import './lib/browser-log.mjs'; // antes do playwright-core: registro do Chromium em shots/diagnostico/
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';
import { closeBrowser, openPage } from './lib/page-guard.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const head = git('rev-parse', 'HEAD');
const base = git('merge-base', 'HEAD', 'origin/main');
// Antes = o pombo do main (ancestral comum), nas fotos e no vídeo do voo.
const baselinePath = 'src/world/.pigeon-baseline.js';
// wx evita sobrescrever qualquer arquivo que não pertença a esta execução.
writeFileSync(baselinePath, git('show', `${base}:src/world/pigeon.js`), { flag: 'wx' });
mkdirSync('shots/pombos', { recursive: true });
let server, browser;
const errors = [];
try {
  server = await createServer({ configFile: 'tools/scripts/vite.nohmr.config.mjs', server: { port: 0 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch(browserOptions());
  // redes de prazo (lib/page-guard.mjs): uma aba que trava ou cai encerra o passo em minutos, com o passo e o estado
  const { page, guard } = await openPage(browser, { viewport: { width: 1280, height: 1272 } }, { name: 'pombos' });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${url}tools/pigeon-review.html`);
  await page.waitForFunction(() => !!window.reviewPigeons, null, { timeout: 120000 });
  await page.evaluate(() => window.reviewPigeons());
  await page.screenshot({ path: 'shots/pombos/01-silhuetas.png', fullPage: true });
  const stats = await page.evaluate(() => window.reviewPigeons(true));
  await page.screenshot({ path: 'shots/pombos/02-animacoes.png', fullPage: true });
  // Limite explícito: não dobrar triângulos, nem aumentar as malhas ou os materiais do personagem.
  const old = stats.find((s) => s.label === 'Antes');
  const next = stats.find((s) => s.label === 'Depois');
  if (next.meshes > old.meshes || next.triangles > old.triangles * 2 || next.materials > old.materials) {
    throw new Error('Orçamento geométrico excedido.');
  }

  await page.setViewportSize({ width: 1280, height: 672 });
  await page.waitForFunction(() => !!window.startPigeonMotionReview);
  await page.evaluate(() => window.startPigeonMotionReview());
  mkdirSync('shots/pombos/voo', { recursive: true });
  for (let frame = 0; frame < 180; frame++) {
    guard.note(`voo antes/depois, quadro ${frame}`);
    await page.evaluate((f) => window.pigeonMotionFrame(f), frame);
    await page.screenshot({ path: `shots/pombos/voo/frame-${String(frame).padStart(3, '0')}.png` });
  }
  execFileSync('ffmpeg', ['-y', '-framerate', '30', '-i', 'shots/pombos/voo/frame-%03d.png',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'shots/pombos/07-voo-antes-depois.mp4'], { stdio: 'pipe' });
  execFileSync('ffmpeg', ['-y', '-i', 'shots/pombos/07-voo-antes-depois.mp4',
    '-vf', 'fps=2,scale=640:-1,tile=3x4', '-frames:v', '1', 'shots/pombos/08-sequencia-voo.png'], { stdio: 'pipe' });

  // Cena real: congela apenas depois do boot; desenha com sombras e pós-processamento normais.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
  });
  guard.note('cena real da fase 4');
  await page.goto(`${url}?level=4&play`);
  await page.waitForFunction(() => !!window.__game?.game, null, { timeout: 120000 });
  await page.evaluate(() => { window.__freezeReview = true; });
  await page.evaluate(() => {
    const g = window.__game;
    document.getElementById('loading')?.remove();
    for (let i = 1; i <= 120; i++) g.game.update(1 / 60, i / 60);
    g.engine.render(0, 2);
  });
  await page.screenshot({ path: 'shots/pombos/03-fase4.png' });
  await page.evaluate(() => {
    const g = window.__game, p = g.layout.NAP_PIGEON;
    g.engine.camera.position.set(p.x + 0.7, 0.6, p.z + 0.9);
    g.engine.camera.lookAt(p.x, 0.16, p.z);
    g.engine.render(0, 2);
  });
  await page.screenshot({ path: 'shots/pombos/04-cochilo-no-cenario.png' });
  await page.evaluate(() => {
    const g = window.__game, p = g.props.pigeon.object.position;
    g.engine.camera.position.set(p.x + 0.8, p.y + 0.5, p.z + 0.85);
    g.engine.camera.lookAt(p.x, p.y + 0.16, p.z);
    g.engine.render(0, 2);
  });
  await page.screenshot({ path: 'shots/pombos/05-pombo-do-portao.png' });
  await page.evaluate(() => {
    const g = window.__game;
    const birds = g.engine.scene.getObjectsByProperty('name', 'pombo');
    if (birds.length !== 4) throw new Error('A revisão precisa dos quatro pombos da fase.');
    const coop = birds.filter((p) => p !== g.props.pigeon.object && p !== g.props.napPigeon.object);
    const center = coop[0].position.clone().add(coop[1].position).multiplyScalar(0.5);
    g.engine.camera.position.copy(center).add(new g.THREE.Vector3(0.5, 0.8, 1.8));
    g.engine.camera.lookAt(center.x, center.y + 0.16, center.z);
    g.engine.render(0, 2);
  });
  await page.screenshot({ path: 'shots/pombos/06-pombal.png' });
  // Plano real do mecanismo: usa a reação de cheiro e a câmera do jogo, sem
  // posicionar a câmera manualmente. O E2E separado percorre a cadeia com teclas.
  const setupMechanism = async () => page.evaluate(() => {
    const g = window.__game, d = g.game.debug;
    d.setStage('passOpen');
    d.puzzle.mech.fan.setPos(g.layout.FAN.start.x, g.layout.FAN.alignZ);
    d.teleport('radhija', 1.1, g.layout.CORRIDOR.z);
    for (let i = 0; i < 240; i++) g.game.update(1 / 60, 4 + i / 60);
    d.cam.snapFollow(1.1, g.layout.CORRIDOR.z);
    d.clearLog();
    d.puzzle.mech.nose.onSmell();
  });
  await setupMechanism();
  mkdirSync('shots/pombos/mecanismo', { recursive: true });
  const framing = [];
  for (let frame = 0; frame < 150; frame++) {
    guard.note(`mecanismo da fase 4, quadro ${frame}`);
    const sample = await page.evaluate((f) => {
      const g = window.__game;
      for (let i = 0; i < 2; i++) g.game.update(1 / 60, 8 + (f * 2 + i) / 60);
      g.engine.render(0, 8 + f / 30);
      const project = (x, y, z) => new g.THREE.Vector3(x, y, z).project(g.engine.camera).toArray();
      const p = g.props.pigeon.object.position, b = g.layout.PERCH_B, gate = g.layout.GATE;
      return { frame: f, pigeon: project(p.x, p.y + 0.16, p.z), plate: project(b.x, b.y + 0.12, b.z),
        gate: project(gate.hinge.x, 0.65, (gate.hinge.z + gate.latchPost.z) / 2),
        stage: g.game.debug.puzzle.stage, shot: g.game.debug.cam.shotActive };
    }, frame);
    framing.push(sample);
    if (frame >= 9 && frame <= 100 && (Math.abs(sample.pigeon[0]) > 0.9 || Math.abs(sample.pigeon[1]) > 0.85)) {
      throw new Error(`Pombo fora da área legível no quadro ${frame}: ${sample.pigeon}`);
    }
    if (frame >= 65 && frame <= 95 && [sample.plate, sample.gate].some((p) => Math.abs(p[0]) > 0.9 || Math.abs(p[1]) > 0.85)) {
      throw new Error(`Mecanismo fora do enquadramento no quadro ${frame}`);
    }
    await page.screenshot({ path: `shots/pombos/mecanismo/frame-${String(frame).padStart(3, '0')}.png` });
  }
  const events = await page.evaluate(() => window.__game.game.debug.events().map((e) => e.name));
  for (const event of ['pigeon:land', 'plate:press', 'gate:open']) {
    if (!events.includes(event)) throw new Error(`Evento ausente na captura: ${event}`);
  }
  execFileSync('ffmpeg', ['-y', '-framerate', '30', '-i', 'shots/pombos/mecanismo/frame-%03d.png',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'shots/pombos/09-camera-mecanismo.mp4'], { stdio: 'pipe' });
  execFileSync('ffmpeg', ['-y', '-i', 'shots/pombos/09-camera-mecanismo.mp4',
    '-vf', 'fps=2,scale=640:-1,tile=2x5', '-frames:v', '1', 'shots/pombos/10-sequencia-mecanismo.png'], { stdio: 'pipe' });
  await page.setViewportSize({ width: 720, height: 1280 });
  await setupMechanism();
  await page.evaluate(() => {
    const g = window.__game;
    for (let i = 0; i < 150; i++) g.game.update(1 / 60, 8 + i / 60);
    g.engine.render(0, 10.5);
  });
  await page.screenshot({ path: 'shots/pombos/11-mecanismo-vertical.png' });
  writeFileSync('shots/pombos/metrics.json', JSON.stringify({ base, head, stats, framing, events, errors }, null, 2));
  console.log(JSON.stringify({ base, head, before: old, after: next, errors }, null, 2));
  if (errors.length) throw new Error('Erros no navegador durante a revisão visual.');
} finally {
  await closeBrowser(browser);
  await server?.close();
  unlinkSync(baselinePath);
}
