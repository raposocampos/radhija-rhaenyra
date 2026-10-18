// Lambe-Lambe (habilidade da Rhaenyra, no botão do superbafo) e a fase 7, Lambe-Lambe na Pracinha.
// Núcleo, controladores, colisão, puzzle e cenário reais; só navegador/canvas, renderer e modelos das dogs
// são dublês (sem GPU). Fluxo da fase: a Radhija passa pelo túnel de lama (só ela cabe) e sai enlameada,
// destrava o portão por dentro, a Rhaenyra entra e a limpa com o Lambe-Lambe; limpa, a Radhija sobe o
// escorregador com uma arrancada e desce com o frisbee; as duas levam frisbee e bolinha ao piquenique.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fase7 from '../src/levels/fase7/index.js';
import modelo from '../src/levels/_modelo/index.js';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS, devCatalog } from '../src/levels/dev.js';
import { DOG_CONFIG } from '../src/dogs/config.js';
import { STAGES, slideY } from '../src/levels/fase7/puzzle.js';
import { createHeadlessGame } from './helpers/headless.mjs';

const L = fase7.layout;
const info = (h) => {
  const i = h.info();
  return { ...i, ...i.lambe, state: i.state };
};

async function prototype(t, query = '') {
  const module = await fase7.load();
  const h = await createHeadlessGame({
    levels: [fase7, modelo], query,
    configure({ levels, engine }) {
      // A fábrica real recebe o mesmo root e escopo de recursos do jogo.
      levels[0].build = module.build;
      engine.renderer.getDrawingBufferSize = (v) => v.set(1280, 720);
      engine.renderer.capabilities = { getMaxAnisotropy: () => 4 };
      engine.sun = new THREE.DirectionalLight();
      engine.userData = {};
    },
  });
  t.after(async () => {
    h.releaseAll();
    h.setPad(null);
    if (h.game.level === 0) await h.game.loadLevel(1, { mode: 'title', initial: true });
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

/** Segura R (o botão do superbafo) por `sec` segundos e solta. */
function holdR(h, sec) {
  h.keyDown('KeyR');
  h.run(sec);
  h.keyUp('KeyR');
}

const hints = (h) => h.log('hint').map((x) => x.text);

// ------------------------------------------------------------------------------------------------ habilidade
test('Lambe-Lambe: só a Rhaenyra tem, no mesmo botão do superbafo', () => {
  assert.ok(DOG_CONFIG.rhaenyra.lickStroke > 0 && DOG_CONFIG.rhaenyra.lickReach > 0);
  assert.equal(DOG_CONFIG.radhija.lickStroke, undefined, 'a Radhija continua com o superbafo');
  assert.equal(DOG_CONFIG.rhaenyra.bafoSpeed, undefined, 'a Rhaenyra continua sem superbafo');
});

test('Lambe-Lambe (fase 1): pertinho da irmã, segurar R lambe em ritmo e a irmã reage; nada de superbafo', async () => {
  const h = await createHeadlessGame({ level: 1, query: 'dog=rhaenyra' });
  const rh = h.ctrls.rhaenyra;
  h.teleport('radhija', rh.x + 0.9, rh.z, -Math.PI / 2);
  h.game.setStay('radhija', true);
  h.run(0.3);
  h.clearLog();
  h.keyDown('KeyR');
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
  assert.equal(h.log('dog:bafo').length, 0, 'R com a Rhaenyra não sopra');
  assert.ok(hints(h).some((t) => t.startsWith('Só a Radhija tem o superbafo') && t.includes('Lambe-Lambe')), 'dica explica o botão');
  const at = { x: rh.x, z: rh.z };
  h.keyDown('KeyD');
  h.run(0.3);
  h.keyUp('KeyD');
  assert.ok(Math.hypot(rh.x - at.x, rh.z - at.z) < 0.05, 'lambendo, ela não sai andando');
  h.keyUp('KeyR');
  h.run(0.6);
  assert.equal(info(h).lick.on, false, 'soltou: termina a lambida e para');
  assert.equal(h.log('lick:end').length, 1);
  assert.equal(h.dogs.radhija.anim.lickPhase, -1);
});

test('Lambe-Lambe: longe da irmã é só uma lambidinha no focinho; a Radhija continua soprando', async () => {
  const h = await createHeadlessGame({ level: 1, query: 'dog=rhaenyra' });
  const rh = h.ctrls.rhaenyra;
  h.teleport('radhija', rh.x + 3.2, rh.z + 0.5);
  h.game.setStay('radhija', true);
  h.clearLog();
  h.tap('KeyR');
  h.run(0.8);
  const licks = h.log('dog:lick');
  assert.equal(h.log('lick:start').length, 0);
  assert.ok(licks.length >= 1 && licks.every((l) => l.target === null), 'lambidinha sem alvo');
  assert.equal(info(h).lick.on, false);
  // a Radhija ainda sopra com R
  h.tap('KeyQ');
  h.run(0.9);
  h.keyDown('KeyR');
  h.run(0.2);
  h.keyUp('KeyR');
  h.step();
  assert.equal(h.log('dog:bafo').length, 1, 'superbafo intacto');
});

test('Lambe-Lambe: trocar de dog, pausar e reiniciar não deixam a lambida presa', async () => {
  const h = await createHeadlessGame({ level: 2, query: 'dog=rhaenyra' });
  const rh = h.ctrls.rhaenyra;
  h.teleport('radhija', rh.x + 0.8, rh.z);
  h.game.setStay('radhija', true);
  h.keyDown('KeyR');
  h.run(0.7);
  assert.equal(info(h).lick.on, true);
  // pausa congela
  h.tap('Escape');
  const phase = info(h).lick.phase;
  h.run(0.5);
  assert.equal(info(h).lick.phase, phase, 'a pausa congela a lambida');
  h.tap('Escape');
  h.keyUp('KeyR');
  h.keyDown('KeyR');
  h.run(0.2);
  // troca de dog encerra
  h.tap('KeyQ');
  assert.equal(info(h).lick.on, false, 'Q encerra a lambida');
  assert.equal(h.dogs.radhija.anim.lickPhase, -1);
  h.keyUp('KeyR');
  h.events.emit('ui:restart', {});
  h.run(0.2);
  assert.equal(info(h).lick.on, false);
});

// ------------------------------------------------------------------------------------------------ fase 7
test('fase 7: protótipo só no catálogo de desenvolvimento, com cenário sob demanda e props reais', async (t) => {
  assert.equal(LEVELS.some((def) => def.id === 'fase7'), false, 'não altera campanha nem progresso');
  assert.equal(DEV_LEVELS.filter((def) => def.id === 'fase7').length, 1);
  assert.equal(typeof fase7.load, 'function');
  assert.equal(fase7.item, 'frisbee');
  const h = await prototype(t);
  const i = info(h);
  assert.equal(i.levelId, 'fase7');
  assert.equal(i.stage, 'start');
  assert.deepEqual(i.place, { ball: 'ground', frisbee: 'top' });
  assert.equal(i.gateOpen, false);
  assert.equal(i.mud.radhija.k, 0);
  assert.ok(h.props.frisbee.object.position.y > L.SLIDE.deck - 0.01, 'o frisbee começa no alto do escorregador');
  assert.equal(i.objective, 'Só a Radhija cabe no túnel do morrinho: entre no parquinho por ele');
});

test('catálogo das prévias: os protótipos 6 e 7 entram juntos e em ordem; arenas entram sozinhas', () => {
  const ids = (catalog) => catalog.levels.map((def) => def.id);
  const published = LEVELS.map((def) => def.id);
  for (const [id, index] of [['fase6', published.length], ['fase7', published.length + 1]]) {
    const catalog = devCatalog(LEVELS, id);
    assert.deepEqual(ids(catalog), [...published, 'fase6', 'fase7'], `${id}: o menu mostra as fases 6 e 7`);
    assert.equal(catalog.index, index, `${id}: começa na fase pedida`);
    catalog.levels.forEach((def, i) => assert.equal(def.number, i + 1, `${def.id}: numeração em sequência no menu`));
  }
  for (const id of ['pulo', 'bafo', 'modelo']) {
    const catalog = devCatalog(LEVELS, id);
    assert.deepEqual(ids(catalog), [...published, id], `${id}: arena entra sozinha no fim`);
    assert.equal(catalog.index, published.length);
  }
  assert.equal(devCatalog(LEVELS, 'nada'), null);
  assert.deepEqual(LEVELS.map((def) => def.id), published, 'a campanha publicada não muda');
});

test('fase 7: os petiscos ficam em lugares livres e alcançáveis pela Radhija', async (t) => {
  const h = await prototype(t);
  const c = h.ctrls.radhija;
  for (const stage of ['start', 'clean']) {
    h.puzzle.jumpToStage(stage);
    h.step();
    const ctx = { r: c.r, size: c.size, flags: h.puzzle.navFlags() };
    for (const point of L.COLLECTIBLES) {
      assert.equal(h.world.overlaps(point.x, point.z, c.r, c.size), false, `${point.id}: petisco num lugar livre`);
      const path = h.nav.findPath(L.DOGS.radhija.start, point, ctx);
      assert.equal(path.reachable, true, `${point.id} (${stage}): petisco alcançável`);
      let previous = L.DOGS.radhija.start;
      for (const next of [...path.waypoints, point]) {
        assert.ok(h.world.segmentClear(previous.x, previous.z, next.x, next.z, c.r * 0.9, c.size), `${point.id}: caminho sem atravessar nada`);
        previous = next;
      }
    }
  }
});

test('fase 7: só a Radhija cabe no túnel; ela sai enlameada, lenta e sem arrancada', async (t) => {
  const h = await prototype(t);
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
  const h = await prototype(t, 'stage=inside');
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
  const h = await prototype(t, 'stage=muddy&dog=rhaenyra');
  assert.equal(h.game.activeDog, 'rhaenyra');
  const rad = h.ctrls.radhija;
  h.teleport('rhaenyra', rad.x - 0.75, rad.z, Math.PI / 2);
  h.game.setStay('radhija', true);
  h.run(0.2);
  h.clearLog();
  // uma lambida só tira uma placa
  h.tap('KeyR');
  h.run(1.0);
  let i = info(h);
  assert.equal(h.log('mud:lick').length, 1);
  assert.ok(i.mud.radhija.k > 0.7 && i.mud.radhija.k < 0.9, `uma placa (${i.mud.radhija.k})`);
  assert.equal(i.mud.radhija.spots, 1, 'o lugar lambido ficou limpo');
  assert.ok(hints(h).some((x) => x.startsWith('Isso! Continue lambendo')));
  // trocar de dog no meio não perde o que já saiu
  h.keyDown('KeyR');
  h.run(0.7);
  h.tap('KeyQ');
  h.keyUp('KeyR');
  const kept = info(h).mud.radhija.k;
  assert.ok(kept <= 0.6 + 1e-6, `progresso guardado (${kept})`);
  h.tap('KeyQ');
  // segurando R até limpar
  h.keyDown('KeyR');
  waitFor(h, (x) => x.mud.radhija.k === 0, 'limpinha', 6);
  h.keyUp('KeyR');
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
  h.tap('KeyR');
  h.run(0.8);
  assert.equal(h.log('mud:lick').length, 0);
  assert.ok(hints(h).some((x) => x.startsWith('A Radhija já está limpinha')));
});

test('fase 7: no escorregador, andando, enlameada ou a Rhaenyra escorregam de volta', async (t) => {
  const h = await prototype(t, 'stage=muddy');
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
  const h = await prototype(t, 'stage=clean');
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
  const h = await prototype(t, 'stage=clean');
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
  const h = await prototype(t);
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
  const h = await prototype(t, 'stage=clean&dog=rhaenyra');
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
  const h = await prototype(t);
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
  h.keyDown('KeyR');
  waitFor(h, (i) => i.mud.radhija.k === 0, 'Lambe-Lambe limpou a Radhija', 8);
  h.keyUp('KeyR');
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
});
