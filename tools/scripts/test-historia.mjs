// Modo História (suíte 'historia'): a fatia jogável no navegador de verdade, pela entrada das prévias (?historia).
//  - a abertura "A noite da garoa" com o HUD da história (faixas de cinema, o HUD do jogo escondido), filmada de dentro
//    do quarto, e segurar E pula o resto;
//  - o quarto: o aviso do Faro com a tecla do aparelho, o V solta o pulso e a nuvem de cheiro, o E examina a trilha, o
//    pote e a pena; a cena dos pombos na janela e a cartela do capítulo;
//  - a missão com as teclas reais, puzzle a puzzle: a portinha de gato e o pedal da grade, o saco de ração e a
//    maçaneta, o galho, a passagem do muro e a argola do ferrolho, o Faro na piscina (a Reconstrução), o cesto e a
//    arrancada no varal, a senha do interfone (o Faro mostra) e a porta de mola com a irmã segurando, o Superbafo na
//    grelha da guarita e o latido grosso, o portãozinho (o fechamento, assistido). Os trechos longos entre um puzzle e
//    outro são postos no lugar (o mapa cresceu; a caminhada com a IA fica nos testes de unidade);
//  - o mural provisório: a patinha do tutorial, a ligação errada volta, arrastar e tocar, Continuar, o fim do capítulo
//    e Jogar de novo; ninguém atravessa nada no caminho;
//  - no celular (iPhone 13): o botão ⏩ segurado pula, o toque no aviso do Faro, o botão do focinho;
//  - o HUD da história (lupa e meias, faixas, cartela, aviso, mural, fim) nos 11 tamanhos de tela, com capturas;
//  - a câmera em 3ª pessoa: o dedo arrastado na parte livre da tela gira a câmera e no joystick anda com a dog (sem
//    girar); no PC, arrastar com o mouse gira e só passar o mouse por cima, não.
//   node tools/scripts/test-historia.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';
import { SCREENS, boxesIn, outside, overlapPairs, settle, touchDevice, IPHONE_UA } from './lib/screens.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/historia' });
const { page, check, info, ev, shot, logOf, clearLog, load, press, waitFor, walkTo, walkPath, holdUntil, keysFor } = H;

const story = async () => (await info()).story;
const hudState = () => ev(() => window.__game.storyHud?.state() ?? null);
/** Nenhuma dog no chão dentro de um colisor (nada atravessa nada). */
const noOverlap = () => ev(() => {
  const g = window.__game.game;
  const w = g.debug.world;
  const out = [];
  for (const n of ['radhija', 'rhaenyra']) {
    const c = g.debug.ctrls[n];
    if ((c.y || 0) > 0.05) continue;
    const hits = w.contacts(c.x, c.z, c.r * 0.85, c.size).filter((h) => h.depth > 0.02);
    if (hits.length) out.push({ n, x: +c.x.toFixed(2), z: +c.z.toFixed(2), hits: hits.map((h) => h.id) });
  }
  return out;
});
/** Troca para a dog (Q) se preciso. */
async function become(name) {
  // logo depois de uma arrancada um extra pode ocupar a dog por um instante: tenta de novo
  for (let k = 0; k < 4 && (await info()).activeDog !== name; k++) await press('KeyQ', 400);
  const i = await info();
  check(i.activeDog === name, `${name} ativa`, i.activeDog);
}
/** Pula a cena que está rodando segurando E (o anel enche) e espera a cena acabar. */
async function skipScene(label) {
  const s0 = await story();
  if (!s0.scene) { check(false, `${label}: nenhuma cena rodando para pular`, s0); return; }
  await holdUntil(['KeyE'], (i) => !i.story.scene, { timeout: 6000, label: `pular ${label}` });
  const s = await story();
  check(!s.scene, `${label}: segurar E pula a cena`, { scene: s.scene, stage: s.stage });
}
/** Espera a etapa. */
const stageIs = (st, timeout = 20000) => waitFor((i) => i.story?.stage === st && !i.story.scene, { timeout });

// ---------- a câmera em 3ª pessoa pelo dedo e pelo mouse ----------
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const camHeading = (pg) => pg.evaluate(() => window.__game.game.debug.cam.heading);
/** O joystick com o dedo agora (o eixo da entrada e o aro aceso). */
const stickNow = () => ({ m: window.__game.game.input.axis().m, on: !!document.querySelector('.rr-touch__stick')?.classList.contains('is-on') });
/**
 * Arrasta um dedo de verdade (protocolo do navegador: touch + pointer events, como num celular), como na suíte toque.
 * Antes de soltar, mede o joystick na página.
 */
async function fingerDrag(pg, from, to, { steps = 8, hold = 60 } = {}) {
  const cdp = await pg.context().newCDPSession(pg);
  try {
    const at = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 8, radiusY: 8, force: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(from.x, from.y) });
    for (let k = 1; k <= steps; k++) {
      await pg.waitForTimeout(35);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(from.x + ((to.x - from.x) * k) / steps, from.y + ((to.y - from.y) * k) / steps) });
    }
    await pg.waitForTimeout(hold);
    const stick = await pg.evaluate(stickNow);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return stick;
  } finally {
    await cdp.detach().catch(() => {});
  }
}
/** Um ponto da tela com só o jogo por baixo (sem HUD nem botão) e o centro do joystick parado (na área dele). */
const dragSpots = (pg) => pg.evaluate(() => {
  const canvas = window.__game.engine.renderer.domElement;
  const vw = innerWidth, vh = innerHeight;
  const free = [[0.6, 0.3], [0.55, 0.22], [0.66, 0.42], [0.5, 0.4], [0.72, 0.25], [0.6, 0.55]]
    .map(([fx, fy]) => ({ x: Math.round(vw * fx), y: Math.round(vh * fy) }))
    .find((p) => document.elementFromPoint(p.x, p.y) === canvas) ?? null;
  const sr = document.querySelector('.rr-touch__stick')?.getBoundingClientRect();
  const zone = sr && sr.width > 0 ? { x: Math.round(sr.left + sr.width / 2), y: Math.round(sr.top + sr.height / 2) } : null;
  const zoneTop = zone ? String(document.elementFromPoint(zone.x, zone.y)?.className ?? '') : null;
  return { free, zone, zoneTop, vw };
});
/** O seguimento sem plano de cena (a entrada da câmera só vale jogando) e sem a volta automática para trás da dog. */
async function cameraReady(pg) {
  await pg.waitForFunction(() => { const c = window.__game.game.debug.cam; return c.mode === 'follow' && !c.shotActive; }, null, { timeout: 15000 }).catch(() => {});
  await pg.evaluate(() => { window.__game.game.debug.cam.autoRecenter = false; });
}
/**
 * Toque: o dedo arrastado na parte livre da tela gira a câmera (sem acender o joystick); no joystick, anda com a dog e a
 * câmera fica (a câmera não rouba o dedo do joystick).
 */
async function touchDragChecks(pg, label) {
  await cameraReady(pg);
  const s = await dragSpots(pg);
  check(!!s.free, `${label}: uma parte livre da tela para girar a câmera`, s);
  if (s.free) {
    const h0 = await camHeading(pg);
    const stick = await fingerDrag(pg, s.free, { x: s.free.x - s.vw * 0.2, y: s.free.y });
    await pg.waitForTimeout(250);
    const turn = Math.abs(wrapAngle((await camHeading(pg)) - h0));
    check(turn > 0.25, `${label}: arrastar o dedo na parte livre gira a câmera`, { turn: +turn.toFixed(2) });
    check(!stick.on && stick.m < 0.05, `${label}: esse arraste não mexe no joystick`, stick);
  }
  check(!!s.zone && s.zoneTop.includes('rr-touch__zone'), `${label}: o joystick por cima na área dele`, s);
  if (s.zone) {
    const h0 = await camHeading(pg);
    const stick = await fingerDrag(pg, s.zone, { x: s.zone.x + s.vw * 0.08, y: s.zone.y - 30 }, { steps: 10, hold: 300 });
    await pg.waitForTimeout(250);
    const turn = Math.abs(wrapAngle((await camHeading(pg)) - h0));
    check(stick.on || stick.m > 0.2, `${label}: o dedo no joystick fica com o joystick`, stick);
    check(turn < 0.02, `${label}: arrastar no joystick não gira a câmera`, { turn: +turn.toFixed(3) });
  }
  // os botões de toque têm prioridade: o dedo que aperta o focinho e escorrega um pouco (sem sair dele) fica com o
  // botão; a câmera não gira (no canvas, 12 px girariam 0,09 rad)
  const fb = await pg.evaluate(() => {
    const el = document.querySelector('.rr-tbtn--faro');
    const r = el?.getBoundingClientRect();
    if (!r || r.width < 1) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, ativa: window.__game.game.activeDog };
  });
  check(!!fb, `${label}: o botão do focinho nos controles`, fb);
  if (fb) {
    await pg.waitForFunction(() => window.__game.game.debug.info().story.faroReady, null, { timeout: 30000 }).catch(() => {});
    await pg.evaluate(() => window.__game.game.debug.clearLog());
    const h0 = await camHeading(pg);
    await fingerDrag(pg, fb, { x: fb.x - 12, y: fb.y }, { steps: 4, hold: 60 });
    await pg.waitForFunction(() => window.__game.game.debug.events('story:faro').length > 0, null, { timeout: 10000 }).catch(() => {});
    const faros = await pg.evaluate(() => window.__game.game.debug.events('story:faro').length);
    check(faros >= 1, `${label}: o focinho solta o Faro`, faros);
    const turn = Math.abs(wrapAngle((await camHeading(pg)) - h0));
    check(turn < 0.02, `${label}: o dedo no botão não gira a câmera`, { turn: +turn.toFixed(3) });
  }
}
/** PC: arrastar com o mouse (botão apertado) gira a câmera; só passar o mouse por cima, não. */
async function mouseDragChecks(pg, label) {
  await cameraReady(pg);
  const s = await dragSpots(pg);
  check(!!s.free, `${label}: uma parte livre da tela para girar a câmera`, s);
  if (!s.free) return;
  const h0 = await camHeading(pg);
  await pg.mouse.move(s.free.x, s.free.y);
  await pg.mouse.down();
  await pg.mouse.move(s.free.x - s.vw * 0.2, s.free.y, { steps: 8 });
  await pg.mouse.up();
  await pg.waitForTimeout(250);
  const h1 = await camHeading(pg);
  const turn = Math.abs(wrapAngle(h1 - h0));
  check(turn > 0.25, `${label}: arrastar com o mouse gira a câmera`, { turn: +turn.toFixed(2) });
  await pg.mouse.move(s.free.x, s.free.y, { steps: 8 });
  await pg.waitForTimeout(250);
  const hover = Math.abs(wrapAngle((await camHeading(pg)) - h1));
  check(hover < 0.01, `${label}: só passar o mouse não gira a câmera`, { turn: +hover.toFixed(3) });
}

try {
  console.log('\n== Abertura: "A noite da garoa" ==');
  await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
  await ev(() => { localStorage.removeItem('rr-progress-v1'); localStorage.removeItem('rr-settings-v1'); });
  await load('?historia');
  let i = await info();
  check(await ev(() => window.__game.game.isStory), '?historia abre a área da história (prévia/desenvolvimento)');
  check(i.story?.scene === 'abertura', 'a abertura começa sozinha', i.story);
  let hs = await hudState();
  check(hs?.story && hs.cinema, 'HUD da história com as faixas de cinema', hs);
  const hudHidden = await ev(() => getComputedStyle(document.querySelector('.rr-hud')).visibility === 'hidden');
  check(hudHidden, 'na cena, o HUD do jogo some (nada de texto em cena)');
  // a câmera de cinema fica dentro do quarto (a casa é inteira: nada de filmar através de parede)
  const camInRoom = () => ev(() => {
    const p = window.__game.engine.camera.position;
    const Q = window.__game.layout.ROOMS.quarto;
    return { ok: p.x > Q.x0 && p.x < Q.x1 && p.z > Q.z0 && p.z < Q.z1 && p.y < window.__game.layout.WALLS.h, at: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] };
  });
  // o primeiro plano é a grua lá fora, na garoa, descendo até o basculante; depois, tudo dentro do quarto
  await H.sleep(2600);
  await shot('00-abertura-fora.png');
  i = await waitFor((x) => x.story?.beat === 'noite', { timeout: 20000 });
  await H.sleep(3000);
  check((await camInRoom()).ok, 'a noite da garoa é filmada de dentro do quarto', await camInRoom());
  await shot('01-abertura-noite.png');
  i = await waitFor((x) => x.story?.beat === 'pombos', { timeout: 40000 });
  await H.sleep(4200);
  check((await camInRoom()).ok, 'os pombos no parapeito, vistos de dentro do quarto', await camInRoom());
  await shot('02-abertura-pombos.png');
  await H.sleep(4300);
  await shot('02b-abertura-capitao.png');
  i = await waitFor((x) => x.story?.beat === 'manha', { timeout: 40000 });
  await H.sleep(6000);
  await shot('03-abertura-manha.png');
  await H.sleep(4100);
  await shot('03b-abertura-cade-a-cenoura.png');
  // o resto, pulando (segurar E)
  await skipScene('abertura');
  i = await stageIs('quarto', 20000);
  check(i.story.stage === 'quarto', 'a abertura termina com a jogadora no quarto', i.story.stage);
  hs = await hudState();
  check(!hs.cinema, 'as faixas saem e o HUD volta', hs);
  check(hs.clues.length === 2, 'a lupa guarda as 2 pistas de cena', hs.clues);
  check((await ev(() => document.querySelector('.rr-objective')?.innerText || '')).includes('A cenoura sumiu'), 'o objetivo diz o mistério: a cenoura sumiu', await ev(() => document.querySelector('.rr-objective')?.innerText));
  check((await noOverlap()).length === 0, 'ninguém dentro de nada', await noOverlap());
  // a câmera em 3ª pessoa fica parada no rumo da câmera de cima (o do offset do layout): as teclas do harness contam
  // com ele. Posto aqui, depois da abertura (o fim das cenas gira a câmera para trás da dog).
  await ev(() => {
    const cam = window.__game.game.debug.cam;
    const off = window.__game.layout.CAMERA.offset;
    cam.autoRecenter = false;
    cam.heading = Math.atan2(-off[0], -off[2]);
  });
  const camFixed = await ev(() => {
    const b = window.__game.game.debug.cam.basis();
    const off = window.__game.layout.CAMERA.offset;
    const L = Math.hypot(off[0], off[2]);
    return Math.abs(b.fx + off[0] / L) < 1e-6 && Math.abs(b.fz + off[2] / L) < 1e-6;
  });
  check(camFixed, 'a câmera parada no rumo das teclas do harness');
  const LY = await ev(() => {
    const L = window.__game.layout;
    const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, o[k]]));
    return {
      spots: L.CLUE_SPOTS, flap: L.PET_FLAP, gate: L.PET_GATE, pedal: L.PET_PEDAL, sack: L.FOOD_SACK, handle: L.KITCHEN_HANDLE,
      branch: L.BRANCH, sdoor: L.SERVICE_DOOR, gap: L.YARD_GAP, bolt: L.SERVICE_BOLT, yard: pick(L.YARD, ['x0', 'x1', 'z0']),
      recon: L.RECON, laundry: L.LAUNDRY, pin: L.CARROT_PIN, post: L.DASH_POST, tdoor: L.TOWER_DOOR, intercom: L.INTERCOM,
      booth: L.BOOTH, vent: L.BOOTH_VENT, lgate: L.GATE, house: pick(L.HOUSE, ['x1']),
    };
  });
  /** Põe uma dog num lugar (os trechos longos: a partida confere cada puzzle com as teclas, não a caminhada). */
  const tp = (name, x, z, yaw = null) => ev(({ name: n, x: px, z: pz, yaw: y }) => {
    const g = window.__game.game;
    g.debug.teleport(n, px, pz);
    if (y !== null) g.debug.ctrls[n].yaw = y;
  }, { name, x, z, yaw });

  console.log('\n== O quarto: farejar (V) e examinar (E) a trilha, o pote e a pena ==');
  // o aviso do Faro com a tecla do aparelho
  await H.sleep(600);
  const prompt = await ev(() => {
    const el = document.querySelector('.rr-story__prompt');
    const key = [...el.querySelectorAll('[data-dev]')].find((k) => getComputedStyle(k).display !== 'none');
    return { on: el.classList.contains('is-on'), key: key?.textContent?.trim() ?? null };
  });
  check(prompt.on && prompt.key === 'V', 'o aviso do focinho com a tecla V (teclado)', prompt);
  await clearLog();
  await press('KeyV', 900);
  i = await info();
  check((await logOf('story:faro')).length >= 1 && i.story.faroMode?.on, 'V liga o Faro (o modo fica aceso, gastando o fôlego)', i.story.faroMode);
  check(['trilha', 'pote', 'pena'].every((id) => i.story.revealed.includes(id)), 'o Faro revela a trilha, o pote e a pena', i.story.revealed);
  check(i.story.cloud.on && i.story.cloud.puffs >= 2, 'a nuvem de cheiro sai do focinho até a pista mais perto', i.story.cloud);
  check(!(await ev(() => document.querySelector('.rr-story__prompt').classList.contains('is-on'))), 'depois do primeiro Faro, o aviso some');
  await shot('04-quarto-faro.png');
  for (const id of ['trilha', 'pote', 'pena']) {
    const s = LY.spots[id];
    const at = s.at ?? s;
    if (id === 'pena') await tp('radhija', at.x, at.z, Math.PI);
    else await walkTo(at.x, at.z, { timeout: 12000, tol: 0.3 });
    await press('KeyE', 1600);
    i = await waitFor((x) => x.story.clues.includes(id), { timeout: 4000 });
    check((await story()).clues.includes(id), `${id}: examinada com o E, vira pista na lupa`, (await story()).clues);
  }
  // examinadas as três: a pergunta "Quem entrou no quarto?" fica pronta na árvore de pistas (Tab abre o quadro)
  await H.sleep(1800);
  check((await story()).scene === null, 'só examinar não traz a cena: falta deduzir', await story());
  await press('Tab', 900);
  check(await ev(() => !!document.querySelector('.rr-board') && getComputedStyle(document.querySelector('.rr-board')).display !== 'none'), 'Tab abre a árvore de pistas');
  await shot('05a-arvore-de-pistas.png');
  // as três pistas chegam soltas na bandeja de Achados: o jogador liga cada uma à pergunta
  check(await ev(() => !document.querySelector('.rr-board__node.is-pronta[data-node="quem"]')), 'antes de ligar as pistas, a pergunta ainda não está pronta');
  for (const id of ['trilha', 'pote', 'pena']) {
    await page.click(`.rr-board__tcard[data-tray="${id}"]`);
    await H.sleep(250);
    await page.click('.rr-board__node[data-node="quem"]');
    await H.sleep(500);
  }
  check(await ev(() => !!document.querySelector('.rr-board__node.is-pronta[data-node="quem"]')), 'ligadas as três, a pergunta "Quem entrou no quarto?" fica pronta para deduzir', (await story()).board);
  await shot('05aa-pistas-ligadas.png');
  await page.click('.rr-board__node[data-node="quem"]');
  await H.sleep(700);
  await page.click('.rr-board__opt[data-opt="2"]');
  await H.sleep(900);
  check(!(await story()).board.solved.includes('quem'), 'a conclusão errada não passa', (await story()).board);
  await page.click('.rr-board__opt[data-opt="0"]');
  await H.sleep(700);
  await shot('05b-conclusao.png');
  check((await story()).board.solved.includes('quem'), 'a conclusão certa: "Foram os pombos!"', (await story()).board);
  // a conclusão certa traz os pombos à janela com a cenoura nas patas
  i = await waitFor((x) => x.story.scene === 'janela', { timeout: 6000 });
  check(i.story.scene === 'janela', 'deduzido, a cena dos pombos na janela', i.story);
  i = await waitFor((x) => x.story.beat === 'voo', { timeout: 6000 });
  await H.sleep(2300);
  await shot('05-janela-pombos.png');
  i = await waitFor((x) => !x.story.scene, { timeout: 30000 });
  await shot('06-cartela.png');
  i = await stageIs('casa', 20000);
  check(i.story.stage === 'casa', 'a missão: atrás dos pombos', i.story.stage);
  await H.sleep(2500); // os cartões voam até a lupa, um por vez
  check((await ev(() => document.querySelector('[data-n="pistas"]').textContent)) === '5', 'o contador da lupa mostra 5', await ev(() => document.querySelector('[data-n="pistas"]').textContent));
  await ev(() => { const cam = window.__game.game.debug.cam; const off = window.__game.layout.CAMERA.offset; cam.heading = Math.atan2(-off[0], -off[2]); });

  console.log('\n== A casa: a portinha de gato, o pedal da grade, o saco de ração e a maçaneta ==');
  const fz = (LY.flap.z0 + LY.flap.z1) / 2;
  await become('radhija');
  await walkPath([[LY.flap.x - 0.75, fz], [LY.flap.x + 0.85, fz]], { timeout: 20000, tol: 0.16 });
  i = await info();
  check(i.dogs.radhija.x > LY.flap.x + 0.3, 'a Radhija passa pela portinha de gato da grade', i.dogs.radhija);
  await walkTo(LY.pedal.x, LY.pedal.z, { timeout: 10000, tol: 0.14, stopIf: (x) => x.story.flags.petGateOpen });
  i = await waitFor((x) => x.story.flags.petGateOpen && x.story.doors.petGate > 0.9, { timeout: 5000 });
  check(i.story.flags.petGateOpen, 'o pedal solta a grade do quarto', i.story.doors);
  await shot('07-grade-aberta.png');
  await become('rhaenyra');
  const gz = (LY.gate.hinge.z + LY.gate.latchPost.z) / 2;
  await walkPath([[LY.gate.hinge.x - 0.9, gz], [LY.gate.hinge.x + 1.3, gz]], { timeout: 25000 });
  i = await info();
  check(i.dogs.rhaenyra.x > LY.gate.hinge.x + 0.6, 'a Rhaenyra passa pela grade aberta', i.dogs.rhaenyra);
  // o saco de ração está na frente da maçaneta: a Rhaenyra empurra para o norte
  await walkTo(LY.sack.start.x, LY.sack.start.z + LY.sack.half + 0.3, { timeout: 20000, tol: 0.12 });
  i = await holdUntil([...keysFor(0, -1), 'ShiftLeft'], (x) => x.story.flags.sackFree, { timeout: 12000, label: 'empurrar o saco de ração' });
  check(i.story.flags.sackFree, 'a Rhaenyra empurra o saco de ração para o lado', i.story.pushables);
  await walkTo(LY.handle.x - 0.46, LY.handle.z, { timeout: 10000, tol: 0.12 });
  // de frente para a porta (leste) e o pulo
  await H.hold(keysFor(1, 0), 120);
  await press('Space', 1500);
  i = await waitFor((x) => x.story.flags.kitchenOpen, { timeout: 6000 });
  check(i.story.flags.kitchenOpen && i.story.stage === 'quintal', 'o impulso na maçaneta abre a porta da cozinha', i.story);
  await shot('08-cozinha-porta.png');

  console.log('\n== O quintal: o galho, a passagem do muro e a argola do ferrolho ==');
  const sdx = (LY.sdoor.hinge.x + LY.sdoor.latchPost.x) / 2;
  await tp('rhaenyra', sdx - 0.2, LY.sdoor.hinge.z + 0.8, Math.PI);
  await press('KeyE', 900);
  i = await info();
  check(!i.story.flags.serviceOpen, 'o E na porta não abre: o ferrolho fica do outro lado', i.story.flags);
  check((await ev(() => document.querySelector('.rr-objective')?.innerText || '')).includes('galho'), 'o objetivo aponta a passagem atrás do galho');
  await H.sleep(2800); // o plano da câmera na passagem do muro
  await tp('rhaenyra', LY.branch.start.x + LY.branch.half + 0.26, LY.branch.start.z, -Math.PI / 2);
  await H.sleep(300);
  i = await holdUntil([...keysFor(-1, 0), 'ShiftLeft'], (x) => x.story.flags.branchFree, { timeout: 14000, label: 'empurrar o galho' });
  check(i.story.flags.branchFree, 'a Rhaenyra empurra o galho para longe da passagem', i.story.flags);
  check(i.story.clues.includes('telhas'), 'as telhas da tempestade (caso 2) na lupa', i.story.clues);
  check((await ev(() => document.querySelector('.rr-objective')?.innerText || '')).includes('ferrolho'), 'o objetivo aponta o ferrolho do outro lado do muro');
  await become('radhija');
  const gapX = LY.gap.x1 - 0.3;
  await tp('radhija', gapX, LY.gap.z + 0.8, Math.PI);
  await H.sleep(300);
  await walkTo(gapX, LY.gap.z - 0.9, { timeout: 10000, tol: 0.16 });
  i = await info();
  check(i.dogs.radhija.z < LY.gap.z - 0.3, 'a Radhija passa pela passagem baixa do muro', i.dogs.radhija);
  await shot('09-passagem-do-muro.png');
  await walkTo(LY.bolt.ring.x, LY.bolt.ring.z - 0.5, { timeout: 12000, tol: 0.16 });
  await press('KeyE', 300);
  await page.waitForFunction(() => !!window.__game.game.puzzle.lockFor('radhija')?.pull, null, { timeout: 15000 }).catch(() => {});
  const pull = await ev(() => { const p = window.__game.game.puzzle.lockFor('radhija')?.pull; return p ? { ax: p.ax, az: p.az } : null; });
  check(!!pull, 'a Radhija morde a argola do ferrolho', await story());
  if (pull) {
    i = await holdUntil(keysFor(pull.ax, pull.az), (x) => x.story.flags.boltOpen, { timeout: 10000, label: 'puxar a argola' });
    check(i.story.flags.boltOpen, 'puxando a argola, o ferrolho corre', i.story.flags);
  }
  i = await stageIs('piscina', 8000);
  check(i.story.flags.serviceOpen, 'e a porta da área de serviço abre', i.story);
  await shot('10-porta-de-servico.png');

  console.log('\n== A piscina: o Faro mostra a Reconstrução ==');
  await tp('radhija', LY.recon.x - 0.9, LY.recon.z + 1.5, Math.PI);
  await H.sleep(1500);
  await clearLog();
  await press('KeyV', 800);
  i = await waitFor((x) => x.story.scene === 'reconstrucao', { timeout: 6000 });
  check(i.story.scene === 'reconstrucao', 'o Faro perto da piscina mostra a Reconstrução', i.story);
  await H.sleep(2200);
  await shot('11-reconstrucao.png');
  i = await stageIs('varal', 30000);
  check(i.story.clues.includes('boia'), 'a boia (caso 1) na lupa', i.story.clues);

  console.log('\n== O varal: o cesto embaixo da cenoura e o empurra-empurra da Rhaenyra no poste ==');
  await become('rhaenyra');
  await tp('rhaenyra', LY.laundry.start.x - LY.laundry.half - 0.28, LY.laundry.start.z, Math.PI / 2);
  await H.sleep(300);
  i = await holdUntil([...keysFor(1, 0), 'ShiftLeft'], (x) => x.story.flags.basketUnder, { timeout: 20000, label: 'empurrar o cesto de roupa' });
  check(i.story.flags.basketUnder, 'a Rhaenyra põe o cesto de roupa embaixo da cenoura', i.story.pushables);
  await shot('12-varal-cesto.png');
  await tp('rhaenyra', LY.post.x, LY.post.z + 0.62, Math.PI);
  await H.sleep(300);
  await holdUntil([...keysFor(0, -1), 'ShiftLeft'], (x) => !!x.story.scene, { timeout: 9000, label: 'empurra-empurra no poste' });
  i = await waitFor((x) => x.story.scene === 'varal' || x.story.stage === 'torre', { timeout: 4000 });
  check(i.story.scene === 'varal' || i.story.stage === 'torre', 'com o cesto no lugar, o empurra-empurra da Rhaenyra no poste solta o pregador', i.story);
  if (i.story.scene) {
    i = await waitFor((x) => x.story.beat === 'voa' || !x.story.scene, { timeout: 8000 });
    await H.sleep(900);
    await shot('13-varal-farelo-com-a-cenoura.png');
    await skipScene('varal');
  }
  i = await stageIs('torre', 10000);
  check(i.story.stage === 'torre', 'os pombos levam a cenoura para a torre', i.story.stage);

  console.log('\n== A torre: a senha do interfone (o Faro mostra) e a porta de mola ==');
  const tdz = (LY.tdoor.hinge.z + LY.tdoor.latchPost.z) / 2;
  await tp('radhija', LY.tdoor.hinge.x - 1.7, tdz + 1.3, Math.PI / 2);
  await H.sleep(1500);
  await press('KeyV', 800);
  i = await waitFor((x) => x.story.scene === 'senha', { timeout: 6000 });
  check(i.story.scene === 'senha', 'o Faro perto da porta mostra o Farelo apertando a senha', i.story);
  await H.sleep(3600);
  await shot('14-senha-do-interfone.png');
  i = await waitFor((x) => !x.story.scene, { timeout: 30000 });
  check(i.story.clues.includes('senha') && i.story.flags.codeSeen, 'a senha vira pista na lupa', i.story.clues);
  await become('rhaenyra');
  for (const id of LY.intercom.code) {
    const b = LY.intercom.buttons.find((x) => x.id === id);
    await tp('rhaenyra', b.x - 0.46, b.z, Math.PI / 2);
    await H.sleep(300);
    await H.hold(keysFor(1, 0), 120);
    await press('Space', 1700);
    i = await waitFor((x) => x.story.code.includes(id) || x.story.flags.towerUnlocked, { timeout: 4000 });
  }
  i = await waitFor((x) => x.story.flags.towerUnlocked, { timeout: 5000 });
  check(i.story.flags.towerUnlocked, 'os três botões na ordem da senha destravam a porta da torre', { code: i.story.code, flags: i.story.flags });
  await shot('15-interfone-destravado.png');
  await tp('rhaenyra', LY.tdoor.hinge.x - 0.4, tdz, Math.PI / 2);
  // a Radhija espera fora da linha do vão: as teclas seguradas na troca não a levam para dentro antes da hora
  await tp('radhija', LY.tdoor.hinge.x - 1.3, LY.tdoor.latchPost.z + 1.1, Math.PI / 2);
  await H.sleep(300);
  i = await holdUntil([...keysFor(1, 0), 'ShiftLeft'], (x) => x.story.doors.tower > 0.65, { timeout: 6000, label: 'empurrar a porta de mola' });
  check(i.story.doors.tower > 0.6, 'a Rhaenyra abre a porta de mola', i.story.doors);
  // segurando, troca para a Radhija: a irmã no vão fica segurando
  await holdUntil([...keysFor(1, 0), 'ShiftLeft'], () => false, { timeout: 250, during: () => press('KeyQ', 100), label: 'trocar segurando a porta' });
  i = await info();
  check(i.activeDog === 'radhija' && i.stay.rhaenyra, 'trocando com a irmã no vão, ela fica segurando (Fica automático)', { active: i.activeDog, stay: i.stay });
  await H.sleep(800);
  check((await story()).doors.tower > 0.3, 'com a irmã no vão, a mola não fecha', (await story()).doors);
  // a irmã segura encostada na folha (do lado da dobradiça): a Radhija passa pelo lado do batente e entra no saguão
  await walkPath([[LY.tdoor.hinge.x - 0.5, LY.tdoor.latchPost.z - 0.25], [LY.tdoor.hinge.x + 0.25, LY.tdoor.latchPost.z - 0.25], [LY.tdoor.hinge.x + 0.9, LY.tdoor.latchPost.z - 0.1]], { timeout: 14000, tol: 0.16 });
  i = await waitFor((x) => x.story.scene === 'telhadoChega' || !!x.story.roof?.phase && x.story.roof.phase !== 'off', { timeout: 8000 });
  check(i.story.scene === 'telhadoChega' || i.story.roof?.phase !== 'off', 'a Radhija passa pela irmã e entra no saguão: as duas sobem ao terraço', i.story);
  if (i.story.scene) {
    await H.sleep(2600);
    await shot('16-terraco-chegada.png');
    // num runner lento, a cena pode acabar sozinha durante a captura: só pula se ainda estiver rodando
    if ((await story()).scene) await skipScene('chegada ao terraço');
  }
  // lá em cima é jogável (o pega-pega com os pombos: test/historia-telhado.test.mjs joga com as teclas); aqui, a
  // dog anda no terraço e o resto vai de uma vez
  i = await waitFor((x) => !x.story.scene && x.story.roof?.phase && x.story.roof.phase !== 'off', { timeout: 8000 });
  check(!!i.story.roof && i.story.roof.phase !== 'off', 'no terraço, jogando', i.story.roof);
  await shot('16b-terraco-jogando.png');
  check((await noOverlap()).length === 0, 'ninguém dentro de nada no terraço', await noOverlap());
  await ev(() => window.__game.game.puzzle.rooftop.skipToEnd());
  i = await stageIs('portaria', 10000);
  check(i.story.clues.includes('tampa'), 'a tampa de borracha da caixa d’água (pista)', i.story.clues);
  check((await noOverlap()).length === 0, 'ninguém dentro de nada na torre', await noOverlap());

  console.log('\n== A portaria: o Superbafo na grelha, a janela e o latido grosso ==');
  const bx = (LY.booth.x0 + LY.booth.x1) / 2;
  await become('rhaenyra');
  await tp('rhaenyra', bx + 0.4, LY.booth.awning.z1 + 0.9, Math.PI);
  await H.sleep(400);
  await press('KeyE', 900);
  i = await info();
  check(!i.story.scene && i.story.stage === 'portaria' && !i.story.flags.windowOpen, 'de janela fechada, o latido grosso não acorda o porteiro', i.story.flags);
  await become('radhija');
  await tp('radhija', LY.vent.x - 0.75, LY.vent.z, Math.PI / 2);
  await H.sleep(500);
  // o Superbafo é de segurar (mira) e soltar (sopra): um toque instantâneo cabe entre dois quadros e não conta
  await H.hold(['KeyR'], 350);
  i = await waitFor((x) => x.story.scene === 'cheiro' || x.story.flags.windowOpen, { timeout: 10000 });
  check(i.story.scene === 'cheiro' || i.story.flags.windowOpen, 'o Superbafo entra pela grelha da guarita', i.story);
  if (i.story.scene) {
    await H.sleep(3200);
    await shot('17-janela-da-guarita.png');
  }
  i = await waitFor((x) => !x.story.scene && x.story.flags.windowOpen, { timeout: 30000 });
  check(i.story.flags.windowOpen, 'e a janela abre', i.story.flags);
  await tp('radhija', bx - 0.5, LY.booth.awning.z1 + 0.9, Math.PI);
  await H.sleep(400);
  await press('KeyE', 900);
  i = await info();
  check(!i.story.scene && i.story.stage === 'portaria', 'o latido fino da Radhija não acorda o porteiro', i.story);
  await become('rhaenyra');
  await press('KeyE', 600);
  i = await waitFor((x) => x.story.scene === 'porteiro', { timeout: 4000 });
  check(i.story.scene === 'porteiro', 'o latido grosso da Rhaenyra acorda o porteiro', i.story);
  await H.sleep(3000);
  await shot('18-porteiro.png');
  await skipScene('porteiro');
  i = await stageIs('fechamento', 10000);
  check(i.story.flags.gateOpen, 'o portãozinho aberto', i.story.flags);

  console.log('\n== O portãozinho (o fechamento, assistido) e o mural ==');
  const gtx = (LY.lgate.x0 + LY.lgate.x1) / 2;
  await walkPath([[gtx - 0.2, LY.lgate.z + 2.4], [gtx, LY.lgate.z + 0.75]], { timeout: 20000 });
  i = await waitFor((x) => x.story.scene === 'fechamento', { timeout: 4000 });
  check(i.story.scene === 'fechamento', 'no portãozinho, o fechamento', i.story);
  await H.sleep(4200);
  await shot('19-fechamento.png');
  i = await waitFor((x) => x.story.stage === 'mural', { timeout: 30000 });
  await H.sleep(800);
  hs = await hudState();
  check(hs.mural, 'o mural provisório abre', hs);
  const tray = await ev(() => [...document.querySelectorAll('.rr-mural__tray .rr-mural__card')].map((c) => c.dataset.id));
  check(tray.length === 4 && ['pombos', 'pote', 'trilha', 'abraco'].every((id) => tray.includes(id)), 'os quatro cartões do caso 3 na bandeja', tray);
  check(await ev(() => !!document.querySelector('.rr-mural__slot.is-lock')), 'a casa do cartão que falta tem o "?"');
  await H.sleep(1200);
  await shot('20-mural-tutorial.png');
  // a ligação errada volta
  await page.click('.rr-mural__tray [data-id="trilha"]');
  await page.click('.rr-mural__slot[data-slot="0"]');
  await H.sleep(300);
  let board = await ev(() => { const b = window.__game.storyHud.mural.board; return { errors: b.errors, placed: b.placed, loose: b.loose() }; });
  check(board.errors === 1 && board.placed['0'] === null && board.loose.includes('trilha'), 'a ligação errada volta (e conta um erro)', board);
  // arrastar o primeiro cartão até perto da lua
  const a = await page.locator('.rr-mural__tray [data-id="pombos"]').boundingBox();
  const b0 = await page.locator('.rr-mural__slot[data-slot="0"]').boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 - 10, { steps: 4 });
  await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2, { steps: 10 });
  await page.mouse.up();
  await H.sleep(300);
  board = await ev(() => window.__game.storyHud.mural.board.placed);
  check(board['0'] === 'pombos', 'arrastar o cartão dos pombos até perto da lua', board);
  // os outros tocando (cartão, depois casa)
  for (const [id, slot] of [['pote', 2], ['trilha', 3], ['abraco', 4]]) {
    await page.click(`.rr-mural__tray [data-id="${id}"]`);
    await page.click(`.rr-mural__slot[data-slot="${slot}"]`);
    await H.sleep(250);
  }
  const done = await ev(() => { const b = window.__game.storyHud.mural.board; return { settled: b.settled, closed: b.closed }; });
  check(done.settled && !done.closed, 'tudo no lugar; o caso continua aberto (falta o cartão de um capítulo futuro)', done);
  check(await ev(() => !document.querySelector('.rr-mural__go').hidden), 'aparece o Continuar');
  await shot('21-mural-completo.png');
  await clearLog();
  await page.click('.rr-mural__go');
  i = await waitFor((x) => x.story.stage === 'fim', { timeout: 5000 });
  await H.sleep(500);
  hs = await hudState();
  const end = (await logOf('story:chapterEnd')).at(-1);
  check(hs.end && end?.chapter === 1, 'o fim do capítulo, com a lupa, as escondidas e as meias', end);
  await shot('22-fim-do-capitulo.png');
  check((await noOverlap()).length === 0, 'ninguém dentro de nada no fim', await noOverlap());
  // Jogar de novo: a abertura de novo, do começo
  await page.click('.rr-story__end [data-act="again"]');
  i = await waitFor((x) => x.story?.scene === 'abertura', { timeout: 8000 });
  check(i.story.scene === 'abertura' && (await hudState()).clues.length === 0, 'Jogar de novo começa a abertura do zero', i.story);

  console.log('\n== Celular (iPhone 13): o ⏩ segurado, o toque no aviso do Faro e o botão do focinho ==');
  const p = await H.newPage(touchDevice(844, 390, 3, IPHONE_UA), 'iphone13', { lowGfx: true });
  try {
    await p.goto(`${BASE}?historia`, { waitUntil: 'load', timeout: 120000 });
    await p.waitForFunction(() => window.__game?.game?.isStory && window.__game.game.debug.info().story?.scene === 'abertura', null, { timeout: 120000 });
    await p.touchscreen.tap(422, 195);
    await p.waitForTimeout(1500);
    // segurar o ⏩ pula a abertura (o dedo fica no botão)
    await p.evaluate(() => document.querySelector('.rr-story__skip').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true })));
    await p.waitForFunction(() => !window.__game.game.debug.info().story.scene, null, { timeout: 20000 }).catch(() => {});
    await p.evaluate(() => document.querySelector('.rr-story__skip').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', isPrimary: true })));
    const st = await p.evaluate(() => window.__game.game.debug.info().story);
    check(!st.scene && st.stage === 'quarto', 'iPhone: segurar o ⏩ pula a cena', st);
    await p.touchscreen.tap(422, 195);
    // no quarto, o aviso do Faro com o botão do focinho (sem tecla); tocar nele fareja
    await p.waitForFunction(() => document.querySelector('.rr-story__prompt')?.classList.contains('is-on'), null, { timeout: 20000 }).catch(() => {});
    const touchKey = await p.evaluate(() => {
      const el = document.querySelector('.rr-story__prompt');
      const key = [...el.querySelectorAll('[data-dev]')].find((k) => getComputedStyle(k).display !== 'none');
      return { on: el.classList.contains('is-on'), dev: key?.dataset.dev ?? null };
    });
    check(touchKey.on && touchKey.dev === 'touch', 'iPhone: o aviso mostra o botão do focinho (sem tecla)', touchKey);
    await p.evaluate(() => window.__game.game.debug.clearLog());
    const pb = await p.locator('.rr-story__prompt').boundingBox();
    await p.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
    await p.waitForFunction(() => window.__game.game.debug.events('story:faro').length > 0, null, { timeout: 10000 }).catch(() => {});
    check((await p.evaluate(() => window.__game.game.debug.events('story:faro').length)) >= 1, 'iPhone: tocar no aviso fareja');
    await p.waitForTimeout(800);
    const faroBtn = await p.evaluate(() => {
      const el = document.querySelector('.rr-tbtn--faro');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { shown: el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none', x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    check(faroBtn?.shown, 'iPhone: o botão do focinho nos controles de toque', faroBtn);
    if (faroBtn?.shown) {
      // o Faro liga e desliga (com fôlego): ligado pelo toque no aviso, o botão do focinho desliga; o próximo toque liga
      const modeOn = () => p.evaluate(() => !!window.__game.game.debug.info().story.faroMode?.on);
      if (await modeOn()) {
        await p.touchscreen.tap(faroBtn.x, faroBtn.y);
        await p.waitForFunction(() => !window.__game.game.debug.info().story.faroMode?.on, null, { timeout: 10000 }).catch(() => {});
        check(!(await modeOn()), 'iPhone: o botão do focinho desliga o Faro');
        // o botão tem uma trava de 0,15 s de jogo depois de desligar (faroMode: bounce, contra o toque duplo): o
        // próximo toque espera 0,3 s do relógio do jogo (no SwiftShader, o quadro pode ser rápido ou lento)
        const t0 = await p.evaluate(() => window.__game.game.debug.info().simSec);
        await p.waitForFunction((t) => window.__game.game.debug.info().simSec > t + 0.3, t0, { timeout: 15000 }).catch(() => {});
      }
      await p.waitForFunction(() => window.__game.game.debug.info().story.faroReady, null, { timeout: 30000 }).catch(() => {});
      await p.evaluate(() => window.__game.game.debug.clearLog());
      await p.touchscreen.tap(faroBtn.x, faroBtn.y);
      // o pulso sai no quadro seguinte ao toque; no SwiftShader com DPR 3, um quadro em 3ª pessoa passa de 0,5 s
      await p.waitForFunction(() => window.__game.game.debug.events('story:faro').length > 0, null, { timeout: 10000 }).catch(() => {});
      const diag = await p.evaluate(({ x, y }) => {
        const g = window.__game.game;
        const top = document.elementFromPoint(x, y);
        return {
          faros: g.debug.events('story:faro').length, ativa: g.activeDog, faro: g.debug.info().story.faro.active, modo: g.debug.info().story.faroMode,
          toque: !!document.querySelector('.rr-touch.is-on'), alvo: top?.closest?.('[data-touch]')?.dataset.touch ?? top?.tagName ?? null,
        };
      }, faroBtn);
      check(diag.faros >= 1, 'iPhone: o botão do focinho solta o pulso do Faro', diag);
    }
    await p.evaluate(() => window.__e2eRender?.());
    await p.screenshot({ path: 'shots/historia/23-iphone-faro.png' });
  } catch (err) {
    check(false, `iPhone: erro inesperado: ${err.stack || err.message}`);
  } finally {
    await p.close().catch(() => {});
  }

  console.log('\n== O HUD da história nos tamanhos de tela ==');
  for (const scr of SCREENS) {
    const q = await H.newPage(scr.opts, scr.id, { lowGfx: true });
    try {
      await q.goto(`${BASE}?historia&stage=casa`, { waitUntil: 'load', timeout: 120000 });
      // de pé, o aviso de girar pausa o jogo: ali só a etapa conta
      await q.waitForFunction((portrait) => window.__game?.game?.isStory && (portrait || window.__game.game.state === 'playing') && window.__game.game.debug.info().story?.stage === 'casa', !!scr.portrait, { timeout: 120000 });
      if (scr.touch) await q.touchscreen.tap(scr.opts.viewport.width / 2, scr.opts.viewport.height / 2);
      await q.waitForTimeout(800);
      await settle(q);
      const { width: vw, height: vh } = scr.opts.viewport;
      const name = (s) => `shots/historia/telas-${scr.id}-${s}.png`;
      const snap = async (s) => { await q.evaluate(() => window.__e2eRender?.()); await q.screenshot({ path: name(s) }); };
      if (!scr.portrait) {
        // jogando: a lupa e as meias junto do HUD do jogo, sem sobrepor nada
        const sels = ['.rr-story__lupa', '.rr-story__meias', '.rr-hud__dogs', '.rr-objective', '.rr-level', '.rr-treats', '.rr-esc'];
        const bx = await boxesIn(q, sels);
        check(bx[0] && bx[1], `${scr.id}: lupa e meias na tela`, bx.slice(0, 2));
        check(outside(bx, vw, vh).length === 0, `${scr.id}: HUD inteiro na tela`, outside(bx, vw, vh));
        check(overlapPairs(bx).length === 0, `${scr.id}: HUD sem sobreposição`, overlapPairs(bx));
        await snap('jogando');
        // a câmera em 3ª pessoa: o dedo (na parte livre da tela, não no joystick) ou o mouse giram
        if (scr.touch) await touchDragChecks(q, scr.id);
        else await mouseDragChecks(q, scr.id);
        await snap('girada');
        // em cena: as faixas, o pular e o aviso do Faro (o HUD do jogo some)
        await q.evaluate(() => { const e = window.__game.events; e.emit('story:cinema', { on: true, id: 'teste' }); e.emit('story:prompt', { kind: 'faro', on: true }); });
        await q.waitForTimeout(700);
        await settle(q);
        const cine = await boxesIn(q, ['.rr-story__prompt', '.rr-story__skip', '.rr-story__bar--top', '.rr-story__bar--bottom']);
        check(cine[0] && outside([cine[0], cine[1]], vw, vh).length === 0, `${scr.id}: aviso do Faro e pular na tela`, cine.slice(0, 2));
        check(!overlapPairs([cine[0], cine[1]]).length, `${scr.id}: aviso e pular sem sobreposição`, overlapPairs([cine[0], cine[1]]));
        await snap('cena');
        await q.evaluate(() => { const e = window.__game.events; e.emit('story:prompt', { kind: 'faro', on: false }); e.emit('story:title', { eyebrow: 'Capítulo 1', title: 'As Aventuras de Radhija & Rhaenyra', chapter: 'Cadê a Cenoura?' }); });
        await q.waitForTimeout(900);
        const tb = await boxesIn(q, ['.rr-story__title .t-name', '.rr-story__title .t-chapter']);
        check(tb[0] && outside(tb, vw, vh).length === 0, `${scr.id}: cartela do capítulo inteira na tela`, tb);
        await snap('cartela');
        await q.evaluate(() => window.__game.events.emit('story:cinema', { on: false, id: 'teste' }));
        // o mural: tudo na tela, sem sobreposição
        await q.evaluate(() => window.__game.game.debug.setStage('mural'));
        await q.waitForFunction(() => window.__game.storyHud.state().mural, null, { timeout: 8000 });
        await q.waitForTimeout(700);
        const mb = await boxesIn(q, ['.rr-mural__board', '.rr-mural__line', '.rr-mural__tray', '.rr-mural__head']);
        check(mb[0] && outside(mb, vw, vh).length === 0, `${scr.id}: mural inteiro na tela`, outside(mb, vw, vh));
        const cards = await q.evaluate(() => [...document.querySelectorAll('.rr-mural__card, .rr-mural__slot')].map((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; }));
        const small = cards.filter((c) => Math.min(c.w, c.h) < 30);
        check(cards.length >= 9 && small.length === 0, `${scr.id}: cartões e casas grandes o bastante para o dedo (≥ 30 px)`, { n: cards.length, small });
        await snap('mural');
      } else {
        const rot = await q.evaluate(() => { const el = document.querySelector('.rr-rotate'); return !!el && getComputedStyle(el).display !== 'none'; });
        check(rot, `${scr.id}: de pé, o aviso de girar cobre a tela`);
        await snap('de-pe');
      }
      console.log(`  capturas: shots/historia/telas-${scr.id}-*.png`);
    } catch (err) {
      check(false, `${scr.id}: erro inesperado: ${err.stack || err.message}`);
    } finally {
      await q.close().catch(() => {});
    }
  }
} catch (err) {
  check(false, `erro inesperado: ${err.stack || err.message}`);
} finally {
  const failed = await H.close();
  process.exit(failed ? 1 : 0);
}
