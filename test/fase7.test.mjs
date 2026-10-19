// Lambe-Lambe (as duas dogs, L / L2; o superbafo da Radhija segue no R / R2) e a fase 7, Lambe-Lambe na Pracinha.
// Núcleo, controladores, colisão, puzzle e cenário reais; só navegador/canvas, renderer e modelos das dogs
// são dublês (sem GPU). Fluxo da fase: a Radhija passa pelo túnel de lama (só ela cabe) e sai enlameada,
// destrava o portão por dentro, a Rhaenyra entra e a limpa com o Lambe-Lambe; limpa, a Radhija sobe o
// escorregador com uma arrancada e desce com o frisbee; as duas levam frisbee e bolinha ao piquenique.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fase7 from '../src/levels/fase7/index.js';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';
import { DOG_CONFIG } from '../src/dogs/config.js';
import { STAGES, slideY } from '../src/levels/fase7/puzzle.js';
import { createCollisionWorld } from '../src/game/collision.js';
import { createNavigator } from '../src/game/navigation.js';
import { createHeadlessGame } from './helpers/headless.mjs';

const L = fase7.layout;
/** Posição da fase 7 na campanha (a última). */
const INDEX = LEVELS.indexOf(fase7);
const info = (h) => {
  const i = h.info();
  return { ...i, ...i.lambe, state: i.state };
};

/** A fase 7 na campanha, com o cenário real; as outras fases ficam com dublês. */
async function campaign(t, query = '') {
  const module = await fase7.load();
  const h = await createHeadlessGame({
    level: INDEX + 1, query,
    configure({ levels, engine }) {
      // A fábrica real recebe o mesmo root e escopo de recursos do jogo.
      levels[INDEX].build = module.build;
      engine.renderer.getDrawingBufferSize = (v) => v.set(1280, 720);
      engine.renderer.capabilities = { getMaxAnisotropy: () => 4 };
      engine.sun = new THREE.DirectionalLight();
      engine.userData = {};
    },
  });
  t.after(async () => {
    h.releaseAll();
    h.setPad(null);
    if (h.game.level === INDEX) await h.game.loadLevel(0, { mode: 'title', initial: true });
  });
  assert.equal(h.game.state, 'playing', 'o cenário e o puzzle reais carregam juntos');
  return h;
}

function select(h, name) {
  h.releaseAll();
  if (h.game.activeDog !== name) h.tap('KeyQ');
  assert.equal(h.game.activeDog, name);
}

function waitFor(h, predicate, message, seconds = 15) {
  assert.ok(predicate(info(h)) || h.run(seconds, { until: (i) => predicate({ ...i, ...i.lambe, state: i.state }) }), message);
}

/** Segura L (o Lambe-Lambe) por `sec` segundos e solta. */
function holdL(h, sec) {
  h.keyDown('KeyL');
  h.run(sec);
  h.keyUp('KeyL');
}

const hints = (h) => h.log('hint').map((x) => x.text);

// ------------------------------------------------------------------------------------------------ habilidade
test('Lambe-Lambe: as duas lambem; o superbafo continua só da Radhija', () => {
  for (const name of ['radhija', 'rhaenyra']) assert.ok(DOG_CONFIG[name].lickStroke > 0 && DOG_CONFIG[name].lickReach > 0, name);
  assert.ok(DOG_CONFIG.radhija.lickStroke < DOG_CONFIG.rhaenyra.lickStroke, 'a Radhija lambe mais rapidinho');
  assert.ok(DOG_CONFIG.radhija.bafoSpeed > 0, 'a Radhija continua com o superbafo');
  assert.equal(DOG_CONFIG.rhaenyra.bafoSpeed, undefined, 'a Rhaenyra continua sem superbafo');
});

test('Lambe-Lambe (fase 1): pertinho da irmã, segurar L lambe em ritmo e a irmã reage; nada de superbafo', async () => {
  const h = await createHeadlessGame({ level: 1, query: 'dog=rhaenyra' });
  const rh = h.ctrls.rhaenyra;
  h.teleport('radhija', rh.x + 0.9, rh.z, -Math.PI / 2);
  h.game.setStay('radhija', true);
  h.run(0.3);
  h.clearLog();
  h.keyDown('KeyL');
  h.run(0.5);
  assert.equal(info(h).lick.on, true, 'começou a lamber');
  assert.equal(h.dogs.rhaenyra.anim.action, 'lick');
  h.run(1.0);
  assert.equal(h.dogs.radhija.anim.action, 'licked', 'a irmã fecha os olhos a cada lambida');
  assert.ok(h.dogs.radhija.anim.lickPhase >= 0 && h.dogs.rhaenyra.anim.lickPhase === h.dogs.radhija.anim.lickPhase, 'as duas no mesmo ritmo');
  const licks = h.log('dog:lick');
  assert.ok(licks.length >= 2, `lambidas em ritmo (${licks.length})`);
  assert.ok(licks.every((l) => l.target === 'radhija' && Number.isFinite(l.y)), 'cada lambida chega na irmã');
  assert.equal(h.log('lick:start').length, 1);
  assert.equal(h.log('dog:bafo').length, 0, 'L com a Rhaenyra não sopra');
  assert.ok(!hints(h).some((t) => t.startsWith('Só a Radhija tem o superbafo') || t.startsWith('Lambe-Lambe: chegue')), 'perto da irmã, sem dica');
  assert.ok(h.dogs.rhaenyra.anim.lickY > 0 && h.dogs.rhaenyra.anim.lickY < 0.4, 'a Rhaenyra lambe abaixo da própria boca');
  const at = { x: rh.x, z: rh.z };
  h.keyDown('KeyD');
  h.run(0.3);
  h.keyUp('KeyD');
  assert.ok(Math.hypot(rh.x - at.x, rh.z - at.z) < 0.05, 'lambendo, ela não sai andando');
  h.keyUp('KeyL');
  h.run(0.6);
  assert.equal(info(h).lick.on, false, 'soltou: termina a lambida e para');
  assert.equal(h.log('lick:end').length, 1);
  assert.equal(h.dogs.radhija.anim.lickPhase, -1);
  // o R com a Rhaenyra é o superbafo da irmã: só a dica, sem lambida
  h.clearLog();
  holdR(h, 0.4);
  h.run(0.3);
  assert.equal(h.log('lick:start').length + h.log('dog:bafo').length, 0);
  assert.ok(hints(h).some((t) => t.startsWith('Só a Radhija tem o superbafo')), 'R: dica do superbafo');
});

/** Segura R (o superbafo) por `sec` segundos e solta. */
function holdR(h, sec) {
  h.keyDown('KeyR');
  h.run(sec);
  h.keyUp('KeyR');
}

test('Lambe-Lambe da Radhija (fase 1): ela encosta mais perto, estica o pescoço para a bochecha e a Rhaenyra reage', async () => {
  const h = await createHeadlessGame({ level: 1 });
  const rh = h.ctrls.rhaenyra;
  const rad = h.ctrls.radhija;
  // a Rhaenyra olhando para +x; a Radhija do lado direito dela, na altura da cabeça
  h.teleport('rhaenyra', -1.5, -1.0, Math.PI / 2);
  h.game.setStay('rhaenyra', true);
  h.teleport('radhija', -1.18, -1.6, 0);
  h.run(0.3);
  rh.yaw = Math.PI / 2;
  h.clearLog();
  h.keyDown('KeyL');
  assert.ok(h.run(1.5, { until: (i) => i.lick.stage === 'licking' && i.lick.strokes >= 2 }), 'lambendo em ritmo');
  let i = info(h);
  assert.equal(i.lick.by, 'radhija');
  assert.equal(i.lick.target, 'rhaenyra');
  assert.equal(h.dogs.radhija.anim.action, 'lick');
  assert.equal(h.dogs.rhaenyra.anim.action, 'licked', 'a Rhaenyra fecha os olhos a cada lambida');
  assert.ok(h.dogs.rhaenyra.anim.lickPhase >= 0 && h.dogs.radhija.anim.lickPhase === h.dogs.rhaenyra.anim.lickPhase, 'as duas no mesmo ritmo');
  assert.ok(h.dogs.radhija.anim.lickY > 0.4, `bochecha da irmã maior, acima da boca da Radhija (${h.dogs.radhija.anim.lickY})`);
  assert.equal(h.dogs.rhaenyra.anim.lickY, -1);
  assert.ok(h.dogs.rhaenyra.anim.lookAt && h.dogs.rhaenyra.anim.lookAt.y < 0.35, 'a Rhaenyra abaixa a cabeça para a irmã menor');
  const licks = h.log('dog:lick');
  assert.ok(licks.length >= 2 && licks.every((l) => l.name === 'radhija' && l.target === 'rhaenyra' && l.y > 0.4), 'cada lambida chega na bochecha');
  // a Radhija, mais curta, para mais perto do ponto lambido do que a Rhaenyra pararia (0,56 m)
  const p = licks.at(-1);
  const d = Math.hypot(rad.x - p.x, rad.z - p.z);
  assert.ok(d > 0.38 && d < 0.53, `distância até a bochecha (${d.toFixed(3)})`);
  // no ritmo dela (lickStroke da Radhija, mais rápido que o da Rhaenyra): quanto a lambida avança num quadro
  const p0 = info(h).lick.phase;
  h.step();
  let p1 = info(h).lick.phase;
  if (p1 < p0) p1 += 1;
  const want = (1 / 60) / DOG_CONFIG.radhija.lickStroke;
  assert.ok(Math.abs(p1 - p0 - want) < 0.003, `ritmo da Radhija (${(p1 - p0).toFixed(4)} por quadro, esperado ${want.toFixed(4)})`);
  // lambendo, nem superbafo nem arrancada
  h.keyDown('KeyR');
  h.tap('ShiftLeft');
  h.run(0.4);
  h.keyUp('KeyR');
  h.run(0.2);
  assert.equal(h.log('bafo:aim').length + h.log('dog:bafo').length + h.log('dog:dash').length, 0, 'R e Shift não atrapalham a lambida');
  assert.equal(info(h).lick.on, true);
  h.keyUp('KeyL');
  h.run(0.6);
  i = info(h);
  assert.equal(i.lick.on, false, 'soltou: termina');
  assert.equal(h.log('lick:end').length, 1);
  assert.equal(h.dogs.rhaenyra.anim.lickPhase, -1);
  // e mirando o superbafo, o L não começa a lambida
  h.run(1.0);
  h.clearLog();
  h.keyDown('KeyR');
  h.run(0.3);
  h.keyDown('KeyL');
  h.run(0.4);
  assert.ok(info(h).bafo.aiming && !info(h).lick.on, 'mirando: sem lambida');
  h.keyUp('KeyR');
  h.keyUp('KeyL');
  h.run(0.3);
  assert.equal(h.log('dog:bafo').length, 1);
  assert.equal(h.log('lick:start').length, 0);
});

test('Lambe-Lambe: longe da irmã é só uma lambidinha no focinho (com a dica); a Radhija continua soprando', async () => {
  const h = await createHeadlessGame({ level: 1, query: 'dog=rhaenyra' });
  const rh = h.ctrls.rhaenyra;
  h.teleport('radhija', rh.x + 3.2, rh.z + 0.5);
  h.game.setStay('radhija', true);
  h.clearLog();
  h.tap('KeyL');
  h.run(0.8);
  const licks = h.log('dog:lick');
  assert.equal(h.log('lick:start').length, 0);
  assert.ok(licks.length >= 1 && licks.every((l) => l.target === null), 'lambidinha sem alvo');
  assert.equal(info(h).lick.on, false);
  assert.ok(hints(h).some((t) => t.startsWith('Lambe-Lambe: chegue pertinho da irmã')), 'a dica ensina o alcance');
  // a Radhija ainda sopra com R e faz a própria lambidinha com L (a irmã fica longe, em Fica)
  h.tap('KeyQ');
  h.game.setStay('rhaenyra', true);
  h.run(0.9);
  h.keyDown('KeyR');
  h.run(0.2);
  h.keyUp('KeyR');
  h.step();
  assert.equal(h.log('dog:bafo').length, 1, 'superbafo intacto');
  // soprando ("HÁÁÁ!", 0,45 s) a lambida não começa: o L vem depois do sopro
  h.tap('KeyL');
  h.run(0.2);
  assert.equal(info(h).lick.on, false, 'soprando, sem lambida');
  h.run(0.5);
  h.clearLog();
  h.tap('KeyL');
  h.run(0.8);
  assert.ok(h.log('dog:lick').length >= 1 && h.log('dog:lick').every((l) => l.name === 'radhija' && l.target === null), 'lambidinha da Radhija');
});

test('Lambe-Lambe: trocar de dog, pausar e reiniciar não deixam a lambida presa', async () => {
  const h = await createHeadlessGame({ level: 2, query: 'dog=rhaenyra' });
  const rh = h.ctrls.rhaenyra;
  h.teleport('radhija', rh.x + 0.8, rh.z);
  h.game.setStay('radhija', true);
  h.keyDown('KeyL');
  h.run(0.7);
  assert.equal(info(h).lick.on, true);
  // pausa congela
  h.tap('Escape');
  const phase = info(h).lick.phase;
  h.run(0.5);
  assert.equal(info(h).lick.phase, phase, 'a pausa congela a lambida');
  h.tap('Escape');
  h.keyUp('KeyL');
  h.keyDown('KeyL');
  h.run(0.2);
  // troca de dog encerra
  h.tap('KeyQ');
  assert.equal(info(h).lick.on, false, 'Q encerra a lambida');
  assert.equal(h.dogs.radhija.anim.lickPhase, -1);
  h.keyUp('KeyL');
  h.events.emit('ui:restart', {});
  h.run(0.2);
  assert.equal(info(h).lick.on, false);
});

// ------------------------------------------------------------------------------------------------ fase 7
test('fase 7: na campanha antes da 8, com cenário sob demanda e props reais', async (t) => {
  assert.equal(LEVELS[INDEX + 1]?.id, 'fase8', 'depois da 7 vem a 8');
  assert.equal(LEVELS.filter((def) => def.id === 'fase7').length, 1);
  assert.equal(DEV_LEVELS.some((def) => def.id === 'fase7'), false, 'saiu do catálogo de desenvolvimento');
  assert.equal(typeof fase7.load, 'function');
  assert.equal(fase7.item, 'frisbee');
  const h = await campaign(t);
  const i = info(h);
  assert.equal(i.levelId, 'fase7');
  assert.equal(i.stage, 'start');
  assert.deepEqual(i.place, { ball: 'ground', frisbee: 'top' });
  assert.equal(i.gateOpen, false);
  assert.equal(i.mud.radhija.k, 0);
  assert.ok(h.props.frisbee.object.position.y > L.SLIDE.deck - 0.01, 'o frisbee começa no alto do escorregador');
  assert.equal(i.objective, 'Só a Radhija cabe no túnel do morrinho: entre no parquinho por ele');
});

test('fase 7: os petiscos ficam em lugares livres e alcançáveis pela Radhija', () => {
  // só o cenário fixo: portão, bolinha e a irmã se mexem (a navegação do jogo contorna)
  const world = createCollisionWorld(L);
  const nav = createNavigator(L, world);
  const r = L.DOGS.radhija.radius, size = 'small';
  for (const flags of [{ tunnel: true, gateOpen: false }, { tunnel: false, gateOpen: true }]) {
    const when = flags.gateOpen ? 'portão aberto' : 'pelo túnel';
    for (const point of L.COLLECTIBLES) {
      assert.equal(world.overlaps(point.x, point.z, r, size), false, `${point.id}: petisco num lugar livre`);
      const path = nav.findPath(L.DOGS.radhija.start, point, { r, size, flags });
      assert.equal(path.reachable, true, `${point.id} (${when}): petisco alcançável`);
      let previous = L.DOGS.radhija.start;
      for (const next of [...path.waypoints, point]) {
        assert.ok(world.segmentClear(previous.x, previous.z, next.x, next.z, r * 0.9, size), `${point.id} (${when}): caminho sem atravessar nada`);
        previous = next;
      }
    }
  }
});

test('fase 7: só a Radhija cabe no túnel; ela sai enlameada, lenta e sem arrancada', async (t) => {
  const h = await campaign(t);
  // a Rhaenyra empaca na boca do túnel
  select(h, 'rhaenyra');
  h.teleport('rhaenyra', L.TUNNEL.x0 - 0.6, L.TUNNEL.z, Math.PI / 2);
  h.hold([1, 0]);
  h.run(1.2);
  h.hold(null);
  assert.ok(h.ctrls.rhaenyra.x < L.TUNNEL.x0, 'a Rhaenyra não entra');
  assert.ok(hints(h).some((x) => x.startsWith('A Rhaenyra é grande demais')));
  // a Radhija passa e se suja
  select(h, 'radhija');
  h.game.setStay('rhaenyra', true);
  h.teleport('radhija', L.TUNNEL.x0 - 0.45, L.TUNNEL.z, Math.PI / 2);
  h.clearLog();
  h.walkTo(L.TUNNEL.x1 + 0.5, L.TUNNEL.z, { timeout: 12 });
  let i = info(h);
  assert.ok(i.inside.radhija, 'chegou ao parquinho');
  assert.equal(i.mud.radhija.k, 1, 'enlameada');
  assert.equal(i.stage, 'inside');
  assert.equal(h.log('mud:soak').filter((e) => e.name === 'radhija').length, 1, 'um mergulho na lama');
  assert.ok(hints(h).some((x) => x.startsWith('Que lamaçal')));
  // lenta: anda metade do caminho em 1 s
  const x0 = h.ctrls.radhija.x;
  h.teleport('radhija', 0.3, -0.4, Math.PI / 2);
  const start = h.ctrls.radhija.x;
  h.hold([1, 0]);
  h.run(1.0);
  h.hold(null);
  const muddyDist = h.ctrls.radhija.x - start;
  assert.ok(muddyDist < DOG_CONFIG.radhija.walkSpeed * 0.62, `enlameada anda devagar (${muddyDist.toFixed(2)} m em 1 s)`);
  void x0;
  // sem arrancada: Shift só faz o "pfff"
  h.clearLog();
  h.hold([1, 0], ['ShiftLeft']);
  h.run(0.3);
  h.hold(null);
  assert.equal(h.log('dog:dash').length, 0, 'nada de arrancada');
  assert.equal(h.log('dog:dashBlocked').length, 1);
  assert.ok(hints(h).some((x) => x.startsWith('Com tanta lama, nada de arrancada')));
});

test('fase 7: o trinco do portão só abre por dentro', async (t) => {
  const h = await campaign(t, 'stage=inside');
  // de fora, a Rhaenyra não alcança
  select(h, 'rhaenyra');
  h.teleport('rhaenyra', L.LATCH.x, L.FENCE.south + 0.35, Math.PI);
  h.run(0.2);
  h.clearLog();
  h.tap('KeyE');
  h.run(0.2);
  assert.ok(hints(h).some((x) => x.startsWith('O trinco do portão fica do lado de dentro')));
  assert.equal(info(h).gateOpen, false);
  // por dentro, a Radhija destrava
  select(h, 'radhija');
  h.teleport('radhija', L.LATCH.x, L.LATCH.z - 0.1, 0);
  h.run(0.2);
  assert.equal(h.info().prompt, 'Destravar o portão');
  h.tap('KeyE');
  assert.equal(h.dogs.radhija.anim.action, 'tug', 'puxa o ferrolho com a boca');
  waitFor(h, (i) => i.gateOpen, 'o portão abriu', 3);
  h.run(1.2);
  const i = info(h);
  assert.ok(i.gate.t > 0.95 && i.gate.locked, 'aberto e travado');
  assert.equal(i.stage, 'muddy');
  assert.equal(h.log('gate:open').length, 1);
  assert.equal(h.puzzle.navFlags().gateOpen, true);
  assert.equal(h.puzzle.navFlags().tunnel, false, 'com o portão aberto, a companheira não usa o túnel');
});

test('fase 7: cinco lambidas tiram a lama em placas; ela sacode e a arrancada volta', async (t) => {
  const h = await campaign(t, 'stage=muddy&dog=rhaenyra');
  assert.equal(h.game.activeDog, 'rhaenyra');
  const rad = h.ctrls.radhija;
  h.teleport('rhaenyra', rad.x - 0.75, rad.z, Math.PI / 2);
  h.game.setStay('radhija', true);
  h.run(0.2);
  h.clearLog();
  // uma lambida só tira uma placa
  h.tap('KeyL');
  h.run(1.0);
  let i = info(h);
  assert.equal(h.log('mud:lick').length, 1);
  assert.ok(i.mud.radhija.k > 0.7 && i.mud.radhija.k < 0.9, `uma placa (${i.mud.radhija.k})`);
  assert.equal(i.mud.radhija.spots, 1, 'o lugar lambido ficou limpo');
  assert.ok(hints(h).some((x) => x.startsWith('Isso! Continue lambendo')));
  // trocar de dog no meio não perde o que já saiu
  h.keyDown('KeyL');
  h.run(0.7);
  h.tap('KeyQ');
  h.keyUp('KeyL');
  const kept = info(h).mud.radhija.k;
  assert.ok(kept <= 0.6 + 1e-6, `progresso guardado (${kept})`);
  h.tap('KeyQ');
  // segurando L até limpar
  h.keyDown('KeyL');
  waitFor(h, (x) => x.mud.radhija.k === 0, 'limpinha', 6);
  h.keyUp('KeyL');
  assert.equal(h.log('mud:lick').length, 5, 'cinco placas');
  assert.equal(h.log('mud:clean').length, 1);
  assert.ok(hints(h).some((x) => x.startsWith('Limpinha!')));
  h.run(0.1);
  assert.equal(info(h).effects.radhija.action, 'shake', 'sacode as gotinhas');
  h.run(1.2);
  i = info(h);
  assert.equal(i.lick.on, false, 'a lambida parou sozinha no fim');
  assert.equal(i.stage, 'clean');
  // a arrancada voltou e a velocidade também
  select(h, 'radhija');
  h.game.setStay('rhaenyra', true);
  h.teleport('radhija', 0.3, -0.4, Math.PI / 2);
  h.clearLog();
  h.hold([1, 0], ['ShiftLeft']);
  h.run(0.2);
  h.hold(null);
  assert.equal(h.log('dog:dash').length, 1, 'arrancada de volta');
  // lamber de novo, limpa, não suja nem trava
  select(h, 'rhaenyra');
  h.teleport('rhaenyra', h.ctrls.radhija.x - 0.75, h.ctrls.radhija.z, Math.PI / 2);
  h.game.setStay('radhija', true);
  h.clearLog();
  h.tap('KeyL');
  h.run(0.8);
  assert.equal(h.log('mud:lick').length, 0);
  assert.ok(hints(h).some((x) => x.startsWith('A Radhija já está limpinha')));
});

test('fase 7: a Radhija enlameada lambe a Rhaenyra: só carinho (a lama continua, dica para trocar)', async (t) => {
  const h = await campaign(t, 'stage=muddy');
  select(h, 'radhija');
  const rh = h.ctrls.rhaenyra;
  h.teleport('radhija', rh.x - 0.75, rh.z, Math.PI / 2);
  h.game.setStay('rhaenyra', true);
  h.run(0.2);
  h.clearLog();
  holdL(h, 1.6);
  h.run(0.6);
  const i = info(h);
  assert.equal(h.log('lick:start').length, 1);
  assert.ok(h.log('dog:lick').some((l) => l.name === 'radhija' && l.target === 'rhaenyra'), 'a Radhija lambeu a irmã');
  assert.equal(h.log('mud:lick').length, 0, 'nenhuma placa saiu');
  assert.equal(i.mud.radhija.k, 1, 'a Radhija continua enlameada');
  assert.equal(i.mud.rhaenyra.k, 0);
  assert.equal(i.stage, 'muddy');
  assert.ok(hints(h).some((x) => x.startsWith('A Rhaenyra adorou! Mas quem está enlameada é a Radhija')), 'dica para trocar');
  // longe da irmã, a lambidinha da Radhija não dá a dica de alcance (essa é da Rhaenyra)
  h.teleport('radhija', rh.x - 2.2, rh.z, Math.PI / 2);
  h.run(0.3);
  h.clearLog();
  h.tap('KeyL');
  h.run(0.8);
  assert.equal(h.log('lick:start').length, 0);
  assert.ok(!hints(h).some((x) => x.startsWith('Chegue pertinho da Radhija') || x.startsWith('Tem cerca no meio')), 'sem a dica da Rhaenyra');
  assert.equal(info(h).mud.radhija.k, 1);
});

test('fase 7: com a cerca ou o portão fechado no meio, a Rhaenyra não lambe a irmã', async (t) => {
  const h = await campaign(t, 'stage=inside&dog=rhaenyra');
  const F = L.FENCE;
  // pela cerca e pelo portão fechado: as duas a 0,8 m, dentro do alcance da lambida
  for (const x of [0.5, (L.GATE.hinge.x + L.GATE.latchPost.x) / 2]) {
    h.teleport('radhija', x, F.south - 0.4, Math.PI / 2);
    h.teleport('rhaenyra', x, F.south + 0.4, Math.PI);
    h.game.setStay('radhija', true);
    h.run(0.3);
    h.clearLog();
    holdL(h, 1.2);
    h.run(0.4);
    assert.equal(h.log('lick:start').length, 0, `x=${x}: nada de lambida através da cerca`);
    assert.ok(h.log('dog:lick').every((l) => l.target === null), 'só a lambidinha no focinho');
    assert.equal(h.log('mud:lick').length, 0);
    assert.equal(info(h).mud.radhija.k, 1, 'a lama continua');
    // a dica tem intervalo mínimo entre repetições: só a primeira tentativa a mostra
    if (x === 0.5) assert.ok(hints(h).some((text) => text.startsWith('Tem cerca no meio')), 'a dica explica a cerca');
  }
});

test('fase 7: pegar a bolinha no meio da lambida encerra o Lambe-Lambe', async (t) => {
  const h = await campaign(t, 'stage=muddy&dog=rhaenyra');
  // a bolinha fica entre as duas, ao alcance da Rhaenyra
  h.teleport('radhija', L.BALL.x, L.BALL.z - 0.36, Math.PI / 2);
  h.teleport('rhaenyra', L.BALL.x, L.BALL.z + 0.3, Math.PI);
  h.game.setStay('radhija', true);
  h.run(0.2);
  h.clearLog();
  h.keyDown('KeyL');
  waitFor(h, (i) => i.lick.on && i.lick.stage === 'licking' && i.lick.strokes >= 1, 'começou a lamber', 2);
  h.tap('KeyE');
  h.run(0.1);
  assert.equal(info(h).place.ball, 'carried', 'pegou a bolinha');
  assert.equal(info(h).lick.on, false, 'com a boca ocupada a lambida acaba');
  const licks = h.log('mud:lick').length;
  h.run(1.5);
  h.keyUp('KeyL');
  assert.equal(h.log('mud:lick').length, licks, 'nenhuma lambida com a bolinha na boca');
  assert.equal(h.log('lick:end').length, 1);
});

test('fase 7: no escorregador, andando, enlameada ou a Rhaenyra escorregam de volta', async (t) => {
  const h = await campaign(t, 'stage=muddy');
  select(h, 'radhija');
  h.game.setStay('rhaenyra', true);
  h.teleport('radhija', L.SLIDE_ENTRY.minX - 0.3, L.SLIDE.z, Math.PI / 2);
  h.clearLog();
  h.hold([1, 0]);
  waitFor(h, (i) => i.slide?.mode === 'slip', 'enlameada, escorrega', 3);
  h.hold(null);
  waitFor(h, (i) => !i.slide, 'voltou ao chão', 3);
  assert.equal(h.log('slide:slip')[0].reason, 'slipMud');
  assert.ok(hints(h).some((x) => x.startsWith('Com as patas enlameadas ela escorrega')));
  assert.equal(info(h).place.frisbee, 'top');
  assert.equal(h.ctrls.radhija.y, 0);
  // limpa, mas andando
  h.puzzle.jumpToStage('clean');
  h.game.setStay('rhaenyra', true);
  h.clearLog();
  h.hold([1, 0]);
  waitFor(h, (i) => i.slide?.mode === 'slip', 'andando, escorrega', 3);
  h.hold(null);
  waitFor(h, (i) => !i.slide, 'voltou ao chão', 3);
  assert.equal(h.log('slide:slip')[0].reason, 'slipWalk');
  // a Rhaenyra também não sobe
  select(h, 'rhaenyra');
  h.teleport('rhaenyra', L.SLIDE_ENTRY.minX - 0.3, L.SLIDE.z, Math.PI / 2);
  h.run(0.8); // passa a pausa depois da escorregada anterior
  h.clearLog();
  h.hold([1, 0]);
  waitFor(h, (i) => i.slide?.mode === 'slip', 'a Rhaenyra escorrega', 3);
  h.hold(null);
  waitFor(h, (i) => !i.slide, 'voltou ao chão', 3);
  assert.equal(h.log('slide:slip')[0].reason, 'slipRh');
  assert.equal(info(h).place.frisbee, 'top');
});

test('fase 7: limpa, a arrancada sobe a rampa; lá em cima pega o frisbee e desce de barriga', async (t) => {
  const h = await campaign(t, 'stage=clean');
  assert.equal(h.game.activeDog, 'radhija');
  h.game.setStay('rhaenyra', true);
  h.teleport('radhija', L.SLIDE_ENTRY.minX - 0.25, L.SLIDE.z, Math.PI / 2);
  h.clearLog();
  h.hold([1, 0], ['ShiftLeft']);
  h.run(0.15);
  h.hold(null);
  waitFor(h, (i) => i.slide?.mode === 'climb', 'subiu correndo', 2);
  let maxY = 0;
  let sawSlide = false;
  let slopeUp = 0;
  let slopeDown = 0;
  h.run(4, {
    until: (i) => {
      maxY = Math.max(maxY, h.ctrls.radhija.y);
      if (h.dogs.radhija.anim.action === 'slide') sawSlide = true;
      slopeUp = Math.max(slopeUp, h.dogs.radhija.anim.slope);
      slopeDown = Math.min(slopeDown, h.dogs.radhija.anim.slope);
      return !i.lambe.slide;
    },
  });
  const i = info(h);
  assert.ok(maxY > L.SLIDE.deck - 0.02, `chegou no deque (${maxY.toFixed(2)} m)`);
  assert.ok(sawSlide, 'desceu de barriga');
  assert.ok(slopeUp > 0.3 && slopeDown < -0.3, 'o corpo inclina subindo e descendo a rampa');
  assert.equal(i.frisbee.holder, 'radhija', 'frisbee na boca');
  assert.equal(i.place.frisbee, 'carried');
  assert.equal(i.stage, 'carrying');
  assert.equal(h.ctrls.radhija.y, 0, 'de volta ao chão');
  assert.ok(h.ctrls.radhija.x < L.SLIDE.x0, 'saiu pelo pé da rampa');
  for (const ev of ['slide:climb', 'slide:top', 'slide:down', 'slide:land']) assert.equal(h.log(ev).length, 1, ev);
  assert.equal(h.log('item:pickup').filter((e) => e.item === 'frisbee').length, 1);
  assert.ok(!h.world.overlaps(h.ctrls.radhija.x, h.ctrls.radhija.z, h.ctrls.radhija.r, 'small'), 'termina num lugar livre');
  // a superfície da rampa é a mesma do roteiro da subida/descida
  assert.equal(slideY(L.SLIDE.x0), 0);
  assert.ok(Math.abs(slideY(L.SLIDE.x1) - L.SLIDE.deck) < 1e-9);
});

test('fase 7: pausa congela a descida e reiniciar devolve tudo', async (t) => {
  const h = await campaign(t, 'stage=clean');
  h.game.setStay('rhaenyra', true);
  h.teleport('radhija', L.SLIDE_ENTRY.minX - 0.25, L.SLIDE.z, Math.PI / 2);
  h.hold([1, 0], ['ShiftLeft']);
  h.run(0.15);
  h.hold(null);
  waitFor(h, (i) => i.slide?.phase === 'down', 'descendo', 4);
  h.tap('Escape');
  const y = h.ctrls.radhija.y;
  const x = h.ctrls.radhija.x;
  h.run(1.0);
  assert.equal(h.ctrls.radhija.y, y, 'pausa congela a altura');
  assert.equal(h.ctrls.radhija.x, x);
  h.tap('Escape');
  h.run(0.1);
  h.events.emit('ui:restart', {});
  h.run(0.3);
  const i = info(h);
  assert.equal(i.stage, 'start');
  assert.equal(i.slide, null);
  assert.equal(h.ctrls.radhija.y, 0);
  assert.deepEqual(i.place, { ball: 'ground', frisbee: 'top' });
  assert.equal(i.frisbee.holder, null);
  assert.ok(Math.abs(h.props.frisbee.object.position.y - L.FRISBEE.y) < 1e-6, 'frisbee de volta ao deque');
  assert.equal(i.gateOpen, false);
  assert.equal(i.mud.radhija.k, 0);
});

test('fase 7: todas as etapas de depuração montam um estado coerente', async (t) => {
  const h = await campaign(t);
  for (const st of STAGES) {
    const who = h.puzzle.jumpToStage(st);
    assert.ok(who === 'radhija' || who === 'rhaenyra', `${st}: devolve a dog ativa`);
    h.step();
    const i = info(h);
    if (st === 'done') {
      assert.ok(['celebrating', 'playing'].includes(i.state));
      continue;
    }
    assert.equal(i.stage, st, `${st}: etapa derivada do estado`);
    for (const n of ['radhija', 'rhaenyra']) {
      const c = h.ctrls[n];
      assert.ok(!h.world.overlaps(c.x, c.z, c.r, c.size), `${st}: ${n} num lugar livre`);
    }
  }
});

test('fase 7: com o portão aberto, a companheira volta pelo portão e não se suja no túnel', async (t) => {
  const h = await campaign(t, 'stage=clean&dog=rhaenyra');
  const L2 = h.layout;
  const ctx = { size: 'small', r: L2.DOGS.radhija.radius, flags: h.puzzle.navFlags() };
  // como no jogo: o caminho da companheira é planejado no modo companheira
  h.world.setCompanionMode(true);
  let p;
  try { p = h.nav.findPath(L2.NAV_NODES.C, L2.NAV_NODES.LW, ctx); } finally { h.world.setCompanionMode(false); }
  assert.ok(p.reachable && !p.direct, 'nada de linha reta pelo túnel');
  assert.ok(p.waypoints.some((w) => w.id === 'GI') && !p.waypoints.some((w) => w.id === 'TE' || w.id === 'TW'), 'sai pelo portão');
  // com o portão fechado, a companheira ainda passa pelo túnel (é o único caminho)
  h.puzzle.jumpToStage('inside');
  h.world.setCompanionMode(true);
  try { p = h.nav.findPath(L2.NAV_NODES.C, L2.NAV_NODES.LW, { ...ctx, flags: h.puzzle.navFlags() }); } finally { h.world.setCompanionMode(false); }
  assert.ok(p.reachable, 'portão fechado: o túnel continua aberto para a Radhija');
});

test('fase 7: partida completa andando — túnel, trinco, Lambe-Lambe, escorregador e piquenique', async (t) => {
  const h = await campaign(t);
  const T = L.TUNNEL;
  // 1. a Radhija atravessa o túnel (a Rhaenyra fica esperando no gramado)
  select(h, 'radhija');
  h.walkPath([[-3.2, 0.9], [T.x0 - 0.35, T.z], [T.x1 + 0.45, T.z]], { timeout: 14 });
  assert.equal(info(h).mud.radhija.k, 1);
  // 2. destrava o portão por dentro
  h.walkTo(L.LATCH.x, L.LATCH.z - 0.05, { tol: 0.12 });
  h.tap('KeyE');
  waitFor(h, (i) => i.gateOpen, 'portão aberto', 4);
  // 3. a Rhaenyra vem pelo portão e lambe a irmã até limpar
  h.tap('KeyQ');
  assert.equal(h.game.activeDog, 'rhaenyra');
  h.tap('KeyF'); // a Radhija fica perto do trinco
  h.walkPath([[-2.4, 2.55], [1.9, 2.45], [1.95, 0.7]], { timeout: 20 });
  assert.ok(info(h).inside.rhaenyra, 'a Rhaenyra entrou pelo portão');
  h.keyDown('KeyL');
  waitFor(h, (i) => i.mud.radhija.k === 0, 'Lambe-Lambe limpou a Radhija', 8);
  h.keyUp('KeyL');
  h.run(1.3);
  // 4. a Rhaenyra pega a bolinha (contornando a folha aberta do portão)
  h.walkPath([[1.7, 0.1], [L.BALL.x, L.BALL.z + 0.35, { tol: 0.12 }]]);
  h.tap('KeyE');
  assert.equal(info(h).ball.holder, 'rhaenyra');
  // 5. a Radhija sobe o escorregador com arrancada
  h.tap('KeyQ');
  assert.equal(h.game.activeDog, 'radhija');
  h.walkPath([[0.75, -1.6], [L.SLIDE_ENTRY.minX - 0.3, L.SLIDE.z]], { timeout: 12 });
  h.ctrls.radhija.yaw = Math.PI / 2;
  h.hold([1, 0], ['ShiftLeft']);
  h.run(0.15);
  h.hold(null);
  waitFor(h, (i) => i.frisbee.holder === 'radhija' && !i.slide, 'frisbee na boca, de volta ao chão', 6);
  // 6. as duas levam os objetos ao piquenique (a Rhaenyra acompanha)
  h.walkPath([[1.0, -0.6], [1.95, 0.75], [1.95, 2.35], [-2.4, 2.6], [L.GOAL.x + 0.5, L.GOAL.z - 0.2]], { timeout: 25 });
  waitFor(h, (i) => i.state === 'celebrating' || i.state === 'victory', 'os dois no piquenique: comemoração', 8);
  const i = info(h);
  assert.deepEqual(i.place, { ball: 'picnic', frisbee: 'picnic' });
  assert.equal(h.log('picnic:deliver').length, 2);
  assert.equal(h.log('mud:clean').length, 1);
  // depois dela vem a fase 8: a vitória oferece "Próxima fase"
  waitFor(h, (s) => s.state === 'victory', 'tela de vitória', 12);
  const vic = h.log('victory');
  assert.equal(vic.length, 1);
  assert.equal(vic[0].levelId, 'fase7');
  assert.equal(vic[0].hasNext, true);
});
