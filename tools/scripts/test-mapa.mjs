// Mapa das fases (suíte 'mapa'): Pandorópolis no navegador de verdade. Abre direto (?mapa) e pelo menu, confere o HUD
// (placa da cidade, plaquinha com a barrinha da fase carregando por baixo, Entrar, atalho), anda pela cidade com as
// teclas reais (a companheira segue, ninguém atravessa nada), as nuvens e a ponte pelo save, o atalho (R/L, números,
// ◀ ▶), a bandeirinha trancada, entrar numa fase já pré-carregada (a cortina curta), a volta pelo Voltar do cartão e
// pela vitória (a bandeirinha fica verde e a próxima acende) e o HUD inteiro nos tamanhos de tela do celular ao PC.
//   node tools/scripts/test-mapa.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';
import { SCREENS, boxesIn, outside, overlapPairs, settle } from './lib/screens.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/mapa' });
const { page, check, sleep, info, ev, shot, logOf, clearLog, load, press, waitFor } = H;
const DONE = { done: true, best: 80, treats: 2, total: 3, clears: 1 };
const save = (ids, extra = {}) => ev((s) => localStorage.setItem('rr-progress-v1', s), JSON.stringify({ v: 1, levels: { ...Object.fromEntries(ids.map((id) => [id, DONE])), ...extra } }));
const campaign = (n) => Array.from({ length: n }, (_, i) => `fase${i + 1}`);
const hud = () => ev(() => {
  const q = (s) => document.querySelector(s);
  const vis = (s) => { const el = q(s); return !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none'; };
  return {
    hub: q('.rr').dataset.hub === '1',
    plate: q('.rr-mapplate')?.textContent.replace(/\s+/g, ' ').trim(),
    signOn: q('.rr-sign')?.classList.contains('is-on'),
    sign: { n: q('.rr-sign__num')?.textContent, name: q('.rr-sign__name')?.textContent, state: q('.rr-sign')?.dataset.state, load: q('.rr-sign__load')?.hidden ? null : q('.rr-sign__load span')?.textContent },
    prompt: q('.rr-prompt')?.classList.contains('is-on') ? q('.rr-prompt__text').textContent : null,
    travel: vis('.rr-travel'), level: vis('.rr-level'), treats: vis('.rr-treats'),
  };
});
/** Nenhuma dog dentro de um colisor (nada atravessa nada). */
const noOverlap = () => ev(() => {
  const g = window.__game.game;
  const w = g.debug.world;
  const out = [];
  for (const n of ['radhija', 'rhaenyra']) {
    const c = g.debug.ctrls[n];
    const hits = w.contacts(c.x, c.z, c.r * 0.9, c.size).filter((h) => h.depth > 0.02);
    if (hits.length) out.push({ n, x: +c.x.toFixed(2), z: +c.z.toFixed(2), hits: hits.map((h) => h.id) });
  }
  return out;
});

/** Tamanhos de tela: o HUD do mapa inteiro e sem sobreposição; com toque, também com os controles. */
async function screenSizes() {
  for (const scr of SCREENS.filter((s) => !s.portrait)) {
    console.log(`\n== Tamanho de tela: ${scr.label} (${scr.opts.viewport.width}×${scr.opts.viewport.height}) ==`);
    const p = await H.newPage(scr.opts, scr.id, { lowGfx: true });
    try {
      await p.goto(`${BASE}?mapa`, { waitUntil: 'load', timeout: 120000 });
      await p.waitForFunction(() => window.__game?.game?.isHub && window.__game.game.state === 'playing' && window.__game.game.debug.info().near === 1, null, { timeout: 120000 });
      // um toque na tela (no celular) mostra os controles de toque
      if (scr.touch) await p.touchscreen.tap(scr.opts.viewport.width / 2, scr.opts.viewport.height / 2);
      await p.waitForTimeout(900);
      await settle(p);
      const { width: vw, height: vh } = scr.opts.viewport;
      const sels = ['.rr-hud__dogs', '.rr-objective', '.rr-mapplate', '.rr-sign', '.rr-prompt', '.rr-travel', '.rr-esc'];
      const bx = await boxesIn(p, sels);
      const shown = bx.filter(Boolean).map((b) => b.sel);
      check(['.rr-mapplate', '.rr-sign', '.rr-prompt', '.rr-travel'].every((s) => shown.includes(s)), `${scr.id}: placa, plaquinha, Entrar e atalho na tela`, shown);
      const out = outside(bx, vw, vh);
      check(out.length === 0, `${scr.id}: HUD do mapa inteiro na tela`, out);
      check(overlapPairs(bx).length === 0, `${scr.id}: HUD do mapa sem sobreposição`, overlapPairs(bx));
      if (scr.touch) {
        const ctl = await p.evaluate(() => [...document.querySelectorAll('.rr-tbtn, .rr-touch__stick')].filter((el) => el.getClientRects().length && getComputedStyle(el).display !== 'none').map((el) => {
          const r = el.getBoundingClientRect();
          return { sel: el.dataset.touch ? `.rr-tbtn[data-touch="${el.dataset.touch}"]` : '.rr-touch__stick', left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
        }));
        const hits = [];
        for (const c of ctl) for (const b of bx.filter(Boolean)) if (overlapPairs([c, b]).length) hits.push([c.sel, b.sel]);
        check(ctl.length >= 5 && hits.length === 0, `${scr.id}: controles de toque fora do HUD do mapa`, { n: ctl.length, hits });
        check(!ctl.some((c) => /bafo|lick/.test(c.sel)), `${scr.id}: sem Superbafo e Lamber no mapa`, ctl.map((c) => c.sel));
      }
      // tamanho das letras (o "HUD de navegador": nada minúsculo nem gigante)
      const font = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.rr-sign__name')).fontSize));
      check(font >= 10 && font <= 22, `${scr.id}: nome na plaquinha com letra legível (${font}px)`, font);
      await p.evaluate(() => window.__e2eRender?.());
      await p.screenshot({ path: `shots/mapa/telas-${scr.id}.png` });
      console.log(`  captura: shots/mapa/telas-${scr.id}.png`);
    } catch (err) {
      check(false, `${scr.id}: erro inesperado: ${err.stack || err.message}`);
    } finally {
      await p.close().catch(() => {});
    }
  }
}

try {
  console.log('\n== Direto no mapa (?mapa), save novo ==');
  await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
  await ev(() => { localStorage.removeItem('rr-progress-v1'); localStorage.removeItem('rr-settings-v1'); });
  await load('?mapa');
  let i = await waitFor((x) => x.state === 'playing' && x.level === -1 && x.near === 1, { timeout: 60000 });
  check(i.hub && i.near === 1 && i.next === 1, '?mapa abre o mapa na frente da bandeirinha 1', { near: i.near, next: i.next });
  check(i.zones.leste === false && i.zones.chacara === false, 'save novo: leste e chácara nas nuvens', i.zones);
  let h = await hud();
  check(h.hub && !h.level && !h.treats && h.travel, 'HUD do mapa (sem a fase e os petiscos no canto, com o atalho)', h);
  check(/0\s*\/\s*10/.test(h.plate || '') && /Pandorópolis/.test(h.plate || ''), 'placa da cidade: Pandorópolis, 0 de 10', h.plate);
  check(h.signOn && h.sign.n === '1' && h.sign.state === 'next' && h.prompt === 'Entrar', 'plaquinha da fase 1 (a próxima) e Entrar', h);
  const env = await ev(() => window.__game.env);
  console.log(`  montagem do mapa: ${JSON.stringify(env?.timings)} · ${env?.meshes} malhas`);
  // parada na frente: a fase vai sendo preparada por baixo até a barrinha dizer que está pronta
  i = await waitFor((x) => x.preload?.status === 'ready', { timeout: 60000 });
  h = await hud();
  check(i.preload?.index === 0 && i.preload.status === 'ready' && /Pronta/.test(h.sign.load || ''), 'parada na frente da bandeirinha: a fase 1 fica pronta (barrinha cheia)', { preload: i.preload, load: h.sign.load });
  await shot('01-mapa-fase1-pronta.png');

  console.log('\n== Passeio: teclas reais, a companheira segue, nada atravessa nada ==');
  await clearLog();
  await H.walkTo(-13.2, 25.2, { timeout: 30000 });
  i = await info();
  const lead = i.dogs[i.activeDog];
  const comp = i.dogs[i.activeDog === 'radhija' ? 'rhaenyra' : 'radhija'];
  check(Math.hypot(lead.x + 13.2, lead.z - 25.2) < 0.6, 'andou até a esquina da rua de baixo', lead);
  check(Math.hypot(comp.x - lead.x, comp.z - lead.z) < 4.5, 'a companheira veio junto', { lead, comp });
  check(i.preload === null, 'longe da bandeirinha: a montagem adiantada foi descartada', i.preload);
  check((await noOverlap()).length === 0, 'ninguém dentro de nada', await noOverlap());
  await shot('02-passeio-esquina.png');
  // contra o muro do condomínio e as nuvens do leste: param na borda
  await H.walkTo(-13.2, 33, { timeout: 8000 });
  i = await info();
  check(i.dogs[i.activeDog].z < 28.8 - 0.1, 'o muro do condomínio segura', i.dogs[i.activeDog]);
  await H.walkTo(0, 25.2, { timeout: 12000 });
  i = await info();
  check(i.dogs[i.activeDog].x < -11.5, 'as nuvens do leste seguram (área fechada)', i.dogs[i.activeDog]);
  check((await noOverlap()).length === 0, 'ninguém dentro de nada (muro, nuvens)', await noOverlap());

  console.log('\n== Save com as fases 1 a 5: o leste aberto, o atalho ==');
  await save(campaign(5));
  await load('?mapa');
  i = await waitFor((x) => x.state === 'playing' && x.hub && x.near === 6, { timeout: 60000 });
  check(i.near === 6 && i.zones.leste && !i.zones.chacara, 'fases 1–5: abre na frente da 6, o leste aberto, a chácara fechada', { near: i.near, zones: i.zones });
  h = await hud();
  check(/5\s*\/\s*10/.test(h.plate || ''), 'placa da cidade: 5 de 10', h.plate);
  await shot('03-mapa-leste-aberto.png');
  await clearLog();
  await press('Digit3', 300);
  i = await waitFor((x) => x.near === 3, { timeout: 5000 });
  check(i.near === 3 && (await logOf('map:travel')).at(-1)?.to === 3, 'tecla 3: direto para a bandeirinha 3', i.near);
  await press('KeyR', 300);
  i = await waitFor((x) => x.near === 4, { timeout: 5000 });
  check(i.near === 4, 'R: a próxima liberada (4)', i.near);
  await press('KeyL', 300);
  i = await waitFor((x) => x.near === 3, { timeout: 5000 });
  check(i.near === 3, 'L: a anterior (3)', i.near);
  await page.click('.rr-travel__next');
  i = await waitFor((x) => x.near === 4, { timeout: 5000 });
  check(i.near === 4, 'botão ▶ na tela: a 4', i.near);
  await press('Digit8', 300);
  await sleep(300);
  const hint = (await logOf('hint')).at(-1)?.text ?? '';
  check((await info()).near === 4 && /trancada/i.test(hint), 'tecla 8 (trancada): fica e avisa', { near: (await info()).near, hint });
  check((await logOf('bafo:aim')).length === 0, 'no mapa, R não mira o superbafo', (await logOf('bafo:aim')).length);
  // trancada: andar até a 8 (no jardim) não abre nada
  await ev(() => { const g = window.__game.game; const f = window.__game.layout.FLAGS[7]; g.debug.teleport(g.activeDog, f.x, f.z + 2.2); });
  i = await waitFor((x) => x.near === 8, { timeout: 5000 });
  h = await hud();
  check(h.sign.state === 'locked' && h.prompt === null && h.sign.load === null, 'bandeirinha 8 trancada: plaquinha cinza, sem Entrar nem barrinha', h);
  await clearLog();
  await press('KeyE', 300);
  check((await info()).state === 'playing' && (await logOf('map:denied')).length === 1, 'E na trancada: nada carrega', (await info()).state);
  await shot('04-mapa-trancada.png');

  console.log('\n== Entrar numa fase pré-carregada e voltar ==');
  await press('Digit3', 300);
  i = await waitFor((x) => x.preload?.index === 2 && x.preload.status === 'ready', { timeout: 60000 });
  check(i.preload?.status === 'ready', 'a fase 3 fica pronta parada na frente', i.preload);
  await clearLog();
  const t0 = Date.now();
  await press('KeyE', 100);
  i = await waitFor((x) => x.state === 'intro' && x.levelId === 'fase3', { timeout: 60000 });
  const loadMs = Date.now() - t0;
  console.log(`  entrar na fase 3 pré-carregada: ${loadMs} ms até o cartão`);
  check(i.state === 'intro' && i.levelId === 'fase3', 'E na bandeirinha 3: o cartão da fase 3', i.levelId);
  await sleep(1000);
  await press('Escape', 300);
  i = await waitFor((x) => x.state === 'playing' && x.hub && x.near === 3, { timeout: 60000 });
  check(i.near === 3, 'Esc no cartão: de volta ao mapa, na frente da 3', i.near);

  console.log('\n== Vitória: de volta ao mapa, a bandeirinha fica verde e a próxima acende ==');
  await save(campaign(5));
  await load('?mapa');
  await waitFor((x) => x.hub && x.near === 6, { timeout: 60000 });
  await press('Digit1', 300);
  await waitFor((x) => x.near === 1, { timeout: 5000 });
  await save([]); // a fase 1 de novo do zero: ao vencer, a 1 fica concluída
  await press('KeyE', 100);
  await waitFor((x) => x.state === 'intro' && x.levelId === 'fase1', { timeout: 60000 });
  await sleep(800);
  await press('Enter', 300);
  await waitFor((x) => x.state === 'playing' && x.levelId === 'fase1', { timeout: 10000 });
  await ev(() => {
    const g = window.__game.game;
    g.debug.setStage('carrying');
    const inf = g.debug.info();
    const G = window.__game.layout.GOAL;
    const who = inf.carrier || g.activeDog;
    g.debug.teleport(who, G.x, G.z);
    if (who !== g.activeDog) g.debug.teleport(g.activeDog, G.x + 0.3, G.z + 0.3);
  });
  i = await waitFor((x) => x.state === 'victory', { timeout: 60000 });
  await sleep(1400);
  const acts = await ev(() => [...document.querySelectorAll('.rr-victory__actions [data-action]')].map((b) => b.dataset.action));
  check(acts.join() === 'next,map,restart', 'vitória com o mapa: Próxima fase, Mapa e Jogar novamente', acts);
  await shot('05-vitoria-com-mapa.png');
  await clearLog();
  await page.click('.rr-victory [data-action="map"]');
  i = await waitFor((x) => x.state === 'playing' && x.hub, { timeout: 60000 });
  await sleep(600);
  i = await info();
  const flags = await ev(() => window.__game.game.puzzle.flagStates().map((f) => f.state));
  check(flags[0] === 'done' && flags[1] === 'next', 'de volta: a 1 concluída (verde) e a 2 é a próxima', flags);
  check(i.near === 1, 'as dogs voltam na frente da bandeirinha 1', i.near);
  check((await logOf('map:newFlag')).at(-1)?.n === 2, 'a novidade (a 2) ganha uma olhadinha da câmera', await logOf('map:newFlag'));
  await shot('06-mapa-depois-da-vitoria.png');

  console.log('\n== Pelo menu: Jogar ==');
  await load('');
  await page.click('.rr-btn--play');
  i = await waitFor((x) => x.state === 'playing' && x.hub && x.near != null, { timeout: 60000 });
  check(i.hub && i.near === 2, 'Jogar abre o mapa na frente da próxima (2)', i.near);
  // a pausa do mapa: Menu inicial leva à tela inicial sobre o mapa
  await press('Escape', 300);
  check((await info()).state === 'paused', 'Esc pausa no mapa');
  await page.click('.rr-pause [data-action="menu"]');
  i = await waitFor((x) => x.state === 'title', { timeout: 10000 });
  const ribbon = await ev(() => document.querySelector('.rr-logo__name').textContent);
  check(i.hub && ribbon === 'Pandorópolis', 'Menu inicial: a tela inicial sobre o mapa (fita "Pandorópolis")', ribbon);
  await clearLog();
  await page.click('.rr-btn--play');
  i = await waitFor((x) => x.state === 'playing' && x.hub, { timeout: 10000 });
  check(i.hub && (await logOf('level:loading')).length === 0, 'Jogar de novo: o mapa já montado, sem carregar', i.state);

  await screenSizes();
} catch (err) {
  check(false, `erro inesperado: ${err.stack || err.message}`);
} finally {
  const failed = await H.close();
  process.exit(failed ? 1 : 0);
}
