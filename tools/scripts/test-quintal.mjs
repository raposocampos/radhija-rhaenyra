// Fase 10 (Festa no Quintal) no navegador, com teclas reais nas ações (teleporte só para levar as duas de um cenário
// a outro): o caixote empurrado para fora da mangueira, o impulso na torneira e no disjuntor, o chapeuzinho no
// barquinho, o chapéu fora de ordem caindo da mesa e o quadro da sala; o latido que distrai a gansa e a cordinha do
// portão, o superbafo pelo cano de brinquedo, o balde com a Rhaenyra puxando a corda, o deque (E desamarra o laço, E
// escorrega); os caixotes da despensa (a Rhaenyra puxa até as marcas, a Radhija sobe e pega o biscoito); a lama, o Lambe-Lambe, o
// botão alto do galpão (com ?botao=1, o primeiro abre a porta) e a arrancada na rampa; a piñata (superbafo e as
// batidas da Rhaenyra); e o bolo completo na ordem do quadro. As regras de cada passo estão em test/fase10.test.mjs.
//   node tools/scripts/test-quintal.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/quintal' });
const { check, info, ev, shot, logOf, clearLog, walkTo, walkPath, load, page, waitFor, keysFor } = H;
const qt = (s) => s.quintal || {};

/** Teleporte de preparo: a dog `name` em (x, z), olhando para `yaw`. */
async function put(name, x, z, yaw) {
  await ev((a) => {
    const g = window.__game.game;
    g.debug.teleport(a.name, a.x, a.z);
    g.debug.ctrls[a.name].yaw = a.yaw;
  }, { name, x, z, yaw });
  await H.gsleep(150);
}
/** Q até a dog `name` ficar ativa. */
async function as(name) {
  const s = await info();
  if (s.activeDog !== name) await page.keyboard.press('KeyQ');
  return waitFor((i) => i.activeDog === name, { timeout: 1500 });
}
/** A Rhaenyra de frente para o botão/alavanca `cfg` (14 cm à esquerda dele) e Espaço: impulso na parede. */
async function wallJump(cfg) {
  await put('rhaenyra', cfg.x + cfg.nx * 0.6 - cfg.nz * 0.14, cfg.z + cfg.nz * 0.6 + cfg.nx * 0.14, Math.atan2(-cfg.nx, -cfg.nz));
  await page.keyboard.press('Space');
  await waitFor((s) => !!s.dogs.rhaenyra.wall, { timeout: 1500 });
  return waitFor((s) => !s.dogs.rhaenyra.wall, { timeout: 3000 });
}
/** A Rhaenyra pega a alça do caixote i (no começo do trilho) e anda para trás até ele travar na marca do chão. */
async function pullCrate(i, L) {
  const CR = L.PANTRY_CRATES;
  const st0 = await info();
  await put('rhaenyra', qt(st0).crates[i].x + CR.hx + 0.33, CR.list[i].z, -Math.PI / 2);
  await page.keyboard.press('KeyE');
  let state = await waitFor((s) => s.quintal.crateHold === i, { timeout: 1500 });
  check(qt(state).crateHold === i, `E: a Rhaenyra pega o caixote ${i + 1} pela alça`);
  state = await H.holdUntil(keysFor(1, 0), (s, a) => s.quintal.crates[a].locked, { timeout: 5000, arg: i });
  state = await waitFor((s) => s.quintal.crates[i].locked && s.quintal.crateHold === null, { timeout: 1500 });
  check(qt(state).crates[i].locked, `andando para trás, o caixote ${i + 1} chega na marca e trava sozinho`, JSON.stringify(qt(state).crates[i]));
  return state;
}
/** Leva o enfeite da dog ativa até a mesa do bolo (pela frente da mesa). */
async function toCake(L) {
  const s = await info();
  await put(s.activeDog, -1.0, -2.9, Math.PI);
  await walkTo(L.GOAL.x, L.GOAL.z + 1.0, { tol: 0.15 });
  return H.gsleep(300);
}

try {
  console.log('\n== Fase 10: Festa no Quintal ==');
  await load('?level=fase10&play&botao=1');
  let state = await info();
  const L = await ev(() => {
    const l = window.__game.layout;
    return {
      TAP: l.TAP, BREAKER: l.BREAKER, CRATE: l.CRATE, BOAT: l.BOAT, GOAL: l.GOAL, PAINTING: l.PAINTING, CORD: l.CORD,
      TUBE: l.TUBE, BUCKET: l.BUCKET, ROPE: l.ROPE, HORTA: l.HORTA, RAMP: l.RAMP, DECK: l.DECK,
      DECK_PATH: l.DECK_PATH, PANTRY_CRATES: l.PANTRY_CRATES, SHED_BUTTONS: l.SHED_BUTTONS, ROSE_BUSH: l.ROSE_BUSH, CHICKENS: l.CHICKENS,
    };
  });
  check(state.levelId === 'fase10' && state.state === 'playing', 'link por id (?level=fase10) abre a fase 10');
  // ritmo do jogo logo no começo (o cenário é o maior da demo): muito lento, reprova já, com o número no log
  {
    const a = await info();
    await H.sleep(6000);
    const b = await info();
    const pace = (b.simSec - a.simSec) / 6;
    console.log(`  ritmo inicial do jogo: ${pace.toFixed(2)}× o relógio`);
    if (pace < 0.12) throw new Error(`ritmo do jogo muito baixo (${pace.toFixed(2)}×): o cenário está pesado demais para o CI`);
  }
  const catalog = await ev(() => ({ ids: window.__game.levels.map((level) => level.id).join(), level: window.__game.game.debug.info().level }));
  check(catalog.ids.endsWith('fase9,fase10') && catalog.level === 9, 'na campanha, a última, depois da fase 9', JSON.stringify(catalog));
  check(qt(state).stage === 'start' && qt(state).crateOnHose && !qt(state).power, 'o bolo vazio, o caixote em cima da mangueira, sem energia');
  await shot('01-quintal.png');

  // ---- CHAPÉU: caixote (Shift), torneira (impulso), piscininha enchendo, disjuntor e o vento
  await as('rhaenyra');
  await put('radhija', -5.0, 1.6, 0);
  await page.keyboard.press('KeyF');
  await put('rhaenyra', L.CRATE.start.x, L.CRATE.start.z - 1.15, 0);
  await walkTo(L.CRATE.start.x, L.CRATE.start.z - (L.CRATE.half + 0.3), { tol: 0.08 });
  state = await H.holdUntil([...keysFor(0, 1), 'ShiftLeft'], (s) => !s.quintal.crateOnHose && s.quintal.crate.z > 0.0, { timeout: 7000 });
  check(!qt(state).crateOnHose, 'caixote empurrado (Shift) para fora da mangueira', JSON.stringify(qt(state).crate));
  state = await wallJump(L.TAP);
  check(qt(state).tap && qt(state).flowing, 'impulso no botão da torneira: a água corre pela mangueira');
  await shot('02-agua-correndo.png');
  state = await waitFor((s) => s.quintal.full, { timeout: 12000 });
  check(qt(state).full && !qt(state).boat.docked, 'a piscininha enche; sem vento, o barquinho fica no meio');
  state = await wallJump(L.BREAKER);
  check(qt(state).power, 'impulso no disjuntor da cozinha liga as luzes da festa');
  state = await waitFor((s) => s.quintal.powerStage === 'painting', { timeout: 3000 });
  check(qt(state).powerStage === 'painting', 'a energia chega primeiro nas luzinhas em volta do quadro');
  state = await waitFor((s) => s.quintal.powerStage === 'on', { timeout: 6000 });
  check(qt(state).powerStage === 'on', 'depois segue para as luzinhas da festa na varanda');
  state = await waitFor((s) => s.quintal.boat.docked, { timeout: 6000 });
  check(qt(state).boat.docked, 'o ventilador leva o barquinho até a borda');
  await as('radhija');
  await put('radhija', L.BOAT.dock.x + 0.65, L.BOAT.dock.z, -Math.PI / 2);
  await page.keyboard.press('KeyE');
  state = await waitFor((s) => s.hat?.holder === 'radhija', { timeout: 1500 });
  check(state.hat?.holder === 'radhija', 'E na borda: a Radhija pega o chapeuzinho');
  await shot('03-chapeuzinho.png');

  // ---- fora de ordem: o chapéu balança e cai; o quadro mostra a ordem
  await clearLog();
  state = await toCake(L);
  check((await logOf('cake:wrong')).length === 1, 'o chapéu primeiro: fora de ordem, ele balança no bolo');
  state = await waitFor((s) => s.quintal.place.hat === 'floor' && !s.quintal.rejecting, { timeout: 3000 });
  check(qt(state).place.hat === 'floor' && qt(state).cake.length === 0, 'e cai na grama ao lado da mesa');
  await shot('04-fora-de-ordem.png');
  await put('radhija', L.PAINTING.x, L.PAINTING.z + 0.95, Math.PI);
  await page.keyboard.press('KeyE');
  state = await waitFor((s) => s.quintal.lookedPainting, { timeout: 1500 });
  check(qt(state).lookedPainting, 'E na frente do quadro: a câmera mostra a festa do ano passado');
  await H.gsleep(900);
  await shot('05-quadro-de-perto.png');

  // ---- LAÇO: latido de longe, cordinha, cano de brinquedo e o balde
  await put('radhija', 1.8, 1.4, Math.PI / 2);
  await clearLog();
  await page.keyboard.press('KeyE');
  await H.gsleep(300);
  check((await logOf('goose:lured')).length >= 1, 'o latido de longe atrai a Dona Gansa');
  await walkPath([[2.8, -1.6], [4.5, -1.2], [L.CORD.x - 0.43, L.CORD.z - 0.06, { tol: 0.08 }]], { tol: 0.15 });
  await H.hold(keysFor(1, 0), 80);
  await page.keyboard.press('KeyE');
  state = await waitFor((s) => s.quintal.gateOpen, { timeout: 2000 });
  check(qt(state).gateOpen, 'a outra puxa a cordinha: o portãozinho abre');
  await H.gsleep(700); // termina de puxar
  await put('radhija', L.TUBE.inlet.x, L.TUBE.inlet.z + 0.85, Math.PI);
  await clearLog();
  await H.hold(['KeyR'], 350);
  state = await waitFor((s) => s.quintal.pigeon !== 'asleep', { timeout: 7000 });
  check(qt(state).pigeon !== 'asleep' && (await logOf('scent:duct')).length >= 1, 'o superbafo no funil sobe pelo cano e o pombo voa', JSON.stringify({ spawn: await logOf('scent:spawn'), duct: await logOf('scent:duct') }));
  await put('radhija', L.BUCKET.x, L.BUCKET.z + 0.7, Math.PI);
  await page.keyboard.press('KeyE');
  state = await waitFor((s) => s.quintal.bucket.riding, { timeout: 2000 });
  check(qt(state).bucket.riding, 'E: a Radhija pula para dentro do balde');
  await as('rhaenyra');
  await put('rhaenyra', L.ROPE.rest.x, L.ROPE.rest.z + 0.5, Math.PI);
  await page.keyboard.press('KeyE');
  state = await waitFor((s) => s.quintal.rope.holder === 'rhaenyra', { timeout: 1500 });
  check(qt(state).rope.holder === 'rhaenyra', 'E: a Rhaenyra pega a corda');
  await walkTo(L.ROPE.ring.x, L.ROPE.ring.z + 3.2, { tol: 0.12, timeout: 12000, stopIf: (s) => !!s.quintal.deck || s.quintal.onDeck });
  state = await waitFor((s) => s.quintal.onDeck, { timeout: 4000 });
  check(qt(state).onDeck, 'andando para longe do balde, ele sobe e a Radhija pula para o deque', JSON.stringify(qt(state).bucket));
  await shot('06-no-deque.png');
  // lá em cima quem anda é o jogador: até o laço (E desamarra) e até a boca do escorregador (E escorrega)
  await as('radhija');
  await walkTo(L.DECK_PATH.ribbon.x, L.DECK_PATH.ribbon.z, { tol: 0.12 });
  state = await info();
  check(qt(state).deckAction === 'untie' && state.dogs.radhija.y > L.DECK.h - 0.01, 'no deque, perto do laço (prompt de desamarrar)', JSON.stringify({ rad: state.dogs.radhija, act: qt(state).deckAction }));
  await page.keyboard.press('KeyE');
  state = await waitFor((s) => s.ribbon?.holder === 'radhija' && s.quintal.deck === 'free', { timeout: 3000 });
  check(state.ribbon?.holder === 'radhija', 'E: lá em cima ela desamarra o laço');
  await walkTo(L.DECK_PATH.slideTop.x, L.DECK_PATH.slideTop.z, { tol: 0.12 });
  await page.keyboard.press('KeyE');
  state = await waitFor((s) => !s.quintal.deck && !s.quintal.onDeck, { timeout: 5000 });
  check(state.ribbon?.holder === 'radhija' && state.dogs.radhija.y < 0.01, 'E na boca do escorregador: desce com o laço', JSON.stringify(state.dogs.radhija));
  await as('rhaenyra');
  await H.gsleep(150);
  await page.keyboard.press('KeyE'); // solta a corda (espera antes do Q: no mesmo quadro, o E iria para a Radhija)
  state = await waitFor((s) => s.quintal.rope.holder === null, { timeout: 1500 });
  check(qt(state).rope.holder === null, 'E: a Rhaenyra solta a corda (o balde desce)');
  await as('radhija');
  await clearLog();
  state = await toCake(L);
  check(qt(state).cake.join() === 'ribbon', 'o laço no andar de baixo', JSON.stringify(qt(state).cake));

  // ---- BISCOITO: os três caixotes até as marcas do chão (viram escadinha); a Radhija sobe por eles
  await as('rhaenyra');
  await pullCrate(0, L);
  await pullCrate(1, L);
  state = await pullCrate(2, L);
  check(qt(state).stairs, 'os três caixotes viraram uma escadinha', JSON.stringify(qt(state).crates));
  await shot('09-caixotes.png');
  await as('radhija');
  const CR = L.PANTRY_CRATES;
  await put('radhija', CR.x1, CR.list[2].z + CR.hz + 0.3, Math.PI);
  await page.keyboard.press('KeyE');
  state = await waitFor((s) => s.cookie?.holder === 'radhija' && !s.quintal.climb, { timeout: 12000 });
  check(state.cookie?.holder === 'radhija' && state.dogs.radhija.y < 0.01, 'E: a Radhija sobe pelos caixotes, pega o biscoito e desce', JSON.stringify({ climb: qt(state).climb, rad: state.dogs.radhija }));
  state = await toCake(L);
  check(qt(state).cake.join() === 'ribbon,cookie', 'o biscoito no segundo andar', JSON.stringify(qt(state).cake));

  // ---- as galinhas do quintal: o latido as faz voar
  {
    const A = L.CHICKENS.area;
    await as('radhija');
    await put('radhija', (A.minX + A.maxX) / 2 - 1.2, (A.minZ + A.maxZ) / 2, Math.PI / 2);
    await clearLog();
    await page.keyboard.press('KeyE');
    state = await waitFor((s) => s.quintal.chickens.some((k) => k.state === 'glide'), { timeout: 1500 });
    check(qt(state).chickens.some((k) => k.state === 'glide'), 'o latido assusta as galinhas: voo curto', JSON.stringify(qt(state).chickens));
    await H.gsleep(450);
    await shot('09b-galinhas-voando.png');
    state = await waitFor((s) => s.quintal.chickens.every((k) => k.state !== 'glide'), { timeout: 4000 });
  }

  // ---- VELA: lama, Lambe-Lambe, botão do galpão e rampa
  await put('radhija', L.HORTA.x0 - 0.5, 1.55, Math.PI / 2);
  await walkPath([[L.HORTA.x0 + 0.45, 1.55], [8.1, 1.85]], { tol: 0.15 });
  state = await info();
  check(qt(state).mud.k > 0, 'a Radhija passa pelo vão da tábua e cai na lama');
  await as('rhaenyra');
  await page.keyboard.press('KeyF');
  await put('rhaenyra', 8.95, L.HORTA.z0 - 0.42, 0);
  state = await H.holdUntil(keysFor(0, 1), (s) => s.quintal.inHorta.rhaenyra && !s.dogs.rhaenyra.jumping, { timeout: 2000, during: () => page.keyboard.press('Space') });
  check(qt(state).inHorta.rhaenyra, 'a Rhaenyra pula a cerca baixa da horta');
  await walkTo(8.62, 1.75, { tol: 0.12 }); // pertinho da irmã
  state = await H.holdUntil(['KeyL'], (s) => s.quintal.mud.k === 0, { timeout: 8000 });
  check(qt(state).mud.k === 0, 'o Lambe-Lambe tira a lama', JSON.stringify(qt(state).mud));
  state = await wallJump(L.SHED_BUTTONS[0]);
  state = await waitFor((s) => s.quintal.doorOpen, { timeout: 2500 });
  check(qt(state).doorOpen && !qt(state).shed.sty, 'impulso no botão alto do galpão: a porta basculante sobe (o chiqueiro fica fechado)');
  await shot('07-porta-do-galpao.png');
  await as('radhija');
  await walkPath([[9.0, 2.0], [9.9, 2.0], [9.8, L.RAMP.z - 0.05, { tol: 0.1 }]], { tol: 0.15 });
  await put('radhija', 9.85, L.RAMP.z, Math.PI / 2); // de frente para a rampa, parada
  await page.keyboard.press('ShiftLeft');
  state = await waitFor((s) => s.candle?.holder === 'radhija' && !s.quintal.ramp, { timeout: 5000 });
  check(state.candle?.holder === 'radhija', 'com uma arrancada, a Radhija sobe a rampa e pega a vela do 3', JSON.stringify({ ramp: qt(state).ramp, rad: state.dogs.radhija }));
  await clearLog();
  state = await toCake(L);
  check(qt(state).cake.join() === 'ribbon,cookie,candle', 'a vela no terceiro andar', JSON.stringify(qt(state).cake));

  // ---- o outro botão do galpão solta os porquinhos na horta
  await as('rhaenyra');
  state = await wallJump(L.SHED_BUTTONS[1]);
  state = await waitFor((s) => s.quintal.pigs.released && s.quintal.pigs.inPen === 0, { timeout: 12000 });
  check(qt(state).shed.sty && qt(state).pigs.inPen === 0, 'o outro botão abre o chiqueiro e os três porquinhos saem para a horta', JSON.stringify(qt(state).pigs.pigs));
  await H.gsleep(800);
  await shot('09c-porquinhos-soltos.png');
  await as('radhija'); // de volta para a Radhija, perto da mesa do bolo

  // ---- o chapéu do chão no quarto andar
  const hat = qt(state).floor.hat;
  await walkTo(hat.x, hat.z + 0.32, { tol: 0.1 });
  await H.hold(keysFor(0, -1), 80);
  await page.keyboard.press('KeyE');
  state = await waitFor((s) => s.hat?.holder === 'radhija', { timeout: 1500 });
  check(state.hat?.holder === 'radhija', 'pega o chapéu do chão (E)');
  await walkTo(L.GOAL.x, L.GOAL.z + 1.0, { tol: 0.15 });
  state = await waitFor((s) => s.quintal.cake.length === 4, { timeout: 3000 });
  check(qt(state).cake.join() === 'ribbon,cookie,candle,hat', 'o chapéu no quarto andar', JSON.stringify(qt(state).cake));

  // ---- ESTRELA: o superbafo balança a piñata; a Rhaenyra pula e bate quando ela passa por cima (três vezes)
  const west = { x: L.ROSE_BUSH.x - 1.5, z: L.ROSE_BUSH.z };
  const east = { x: L.ROSE_BUSH.x + 0.98, z: L.ROSE_BUSH.z };
  const blow = async () => {
    await as('radhija');
    await put('radhija', west.x, west.z, Math.PI / 2);
    await H.hold(['KeyR'], 350);
    await H.gsleep(150);
    await as('rhaenyra');
    await put('rhaenyra', east.x, east.z, -Math.PI / 2);
  };
  await clearLog();
  await blow();
  state = await waitFor((s) => Math.abs(s.quintal.pinata.ax) > 0.2, { timeout: 3000 });
  check((await logOf('pinata:swing')).length >= 1, 'o superbafo balança a piñata para fora da roseira', JSON.stringify(qt(state).pinata));
  await shot('10-pinata.png');
  let blows = 1;
  const t0 = Date.now();
  for (;;) {
    state = await info();
    const p = qt(state).pinata;
    if (p.broken || Date.now() - t0 > 90000) break;
    const rh = state.dogs.rhaenyra;
    if (!rh.jumping && Math.hypot(p.x - rh.x, p.z - rh.z) < 0.5) {
      await page.keyboard.press('Space');
      await H.gsleep(450);
    } else if (Math.hypot(p.ax, p.az) < 0.08 && !rh.jumping && blows < 12) {
      blows++;
      await blow();
    } else await H.sleep(20);
  }
  check(qt(state).pinata.broken, 'três batidas da Rhaenyra abrem a piñata', JSON.stringify({ pinata: qt(state).pinata, blows }));
  state = await waitFor((s) => s.quintal.place.star === 'floor', { timeout: 2000 });
  await H.gsleep(600);
  await shot('11-pinata-aberta.png');
  const star = qt(state).floor.star;
  await walkTo(star.x + 0.3, star.z, { tol: 0.1 });
  await page.keyboard.press('KeyE');
  state = await waitFor((s) => s.star?.holder === 'rhaenyra', { timeout: 1500 });
  check(state.star?.holder === 'rhaenyra', 'E: a Rhaenyra pega a estrela no gramado');
  state = await toCake(L);
  state = await waitFor((s) => s.state === 'celebrating' || s.state === 'victory', { timeout: 4000 });
  check(['celebrating', 'victory'].includes(state.state), 'a estrela no topo: o bolo está pronto');
  await H.gsleep(1200);
  await shot('08-bolo-pronto.png');
  state = await waitFor((s) => s.state === 'victory', { timeout: 15000 });
  const vic = await logOf('victory');
  check(state.state === 'victory' && vic.length === 1 && vic[0].hasNext === false, 'vitória da última fase (sem "Próxima fase")', JSON.stringify(vic[0] || {}));
  await ev(() => window.__game.game.reset());
  state = await info();
  check(qt(state).cake.length === 0 && !qt(state).gateOpen && qt(state).water === 0 && qt(state).pigeon === 'asleep' && !qt(state).shed.open && !qt(state).pinata.broken && !qt(state).stairs, 'reinício devolve bolo, portão, água, pombo, galpão, piñata e caixotes');
} catch (e) {
  check(false, `exceção: ${e.stack || e}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
