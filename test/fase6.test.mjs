// Expresso do Superbafo: núcleo, controladores, cheiro, colisão, puzzle e props reais.
// Apenas navegador/canvas, renderer e modelos das dogs são dublês; não há GPU.
// Fluxo: o trem busca a lua no pórtico (rota da lua), leva as duas cargas pela estrela (com a cancela
// segurada na placa) até a bandeja, e as duas vão na boca ao foguete → decola. A ordem inversa também vale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fase6 from '../src/levels/fase6/index.js';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';
import { PAD } from '../src/game/input.js';
import { createTrack } from '../src/levels/fase6/track.js';
import { STAGES as STATES, BARRIER_STOP } from '../src/levels/fase6/puzzle.js';
import { createHeadlessGame } from './helpers/headless.mjs';

const L = fase6.layout;
/** Posição da fase 6 na campanha (depois dela vem a fase 7). */
const INDEX = LEVELS.indexOf(fase6);
const TRACK = createTrack();
/** Diferença entre dois ângulos, em [0, π]. */
const turn = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
/** Etapas com o trem andando (ou parado na cancela) com carga a bordo. */
const TRIP = ['sneezing', 'movingLoop', 'movingDelivery', 'movingMoon', 'blocked', 'returning'];
function info(h) {
  const current = h.info();
  // state continua sendo o estado do jogo; stage é a etapa local do puzzle.
  return { ...current, ...current.expresso, state: current.state };
}
const near = (actual, expected, message, epsilon = 1e-7) => {
  assert.ok(Math.abs(actual - expected) < epsilon, `${message}: ${actual} ≠ ${expected}`);
};

/** A fase 6 na campanha, com o cenário real; as outras fases ficam com dublês. */
async function campaign(t, query = '') {
  const module = await fase6.load();
  const h = await createHeadlessGame({
    level: INDEX + 1, query,
    configure({ levels, engine }) {
      // A fábrica real recebe o mesmo root e escopo de recursos do jogo.
      // A fase seguinte (dublê) serve para exercitar o descarte de uma fase inteira.
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
    if (h.game.level === INDEX) await h.game.loadLevel(INDEX + 1, { mode: 'title', initial: true });
  });
  assert.equal(h.game.state, 'playing', 'o cenário e puzzle reais carregam juntos');
  return h;
}

function select(h, name) {
  h.releaseAll();
  if (h.game.activeDog !== name) h.tap('KeyQ');
  assert.equal(h.game.activeDog, name);
  h.game.setStay(name === 'radhija' ? 'rhaenyra' : 'radhija', true);
}

function place(h, name, point, yaw = point.yaw ?? 0) {
  h.teleport(name, point.x, point.z, yaw);
  near(h.ctrls[name].x, point.x, 'posição X acessível');
  near(h.ctrls[name].z, point.z, 'posição Z acessível');
}

function waitFor(h, predicate, message, seconds = 20) {
  assert.ok(predicate(info(h)) || h.run(seconds, { until: (i) => predicate({ ...i, ...i.expresso, state: i.state }) }), message);
}

function jumpPedal(h) {
  select(h, 'rhaenyra');
  place(h, 'rhaenyra', L.PEDAL);
  h.tap('Space');
  assert.ok(h.ctrls.rhaenyra.jumpT > 0, 'pulo iniciado pela entrada real');
  waitFor(h, () => h.ctrls.rhaenyra.jumpT === 0, 'pousou no pedal', 2);
  h.run(0.2);
}

/** Pula no pedal até a agulha apontar para `route` (volta → lua → estrela). */
function jumpTo(h, route) {
  for (let i = 0; i < 3 && info(h).route !== route; i++) jumpPedal(h);
  assert.equal(info(h).route, route, `a agulha chegou a ${route}`);
}

function blow(h) {
  select(h, 'radhija');
  place(h, 'radhija', L.BLOW_SPOT);
  h.run(0.9); // recarga e fim da animação anterior, quando houver.
  const before = h.log('dog:bafo').length;
  h.keyDown('KeyR');
  h.run(0.2);
  assert.equal(info(h).bafo.aiming, true);
  h.keyUp('KeyR');
  h.step();
  assert.equal(h.log('dog:bafo').length, before + 1, 'R realmente criou o superbafo');
}

function frontCloud(h, life = 2) {
  return h.game.debug.scent.spawn({ x: L.NOSE.x, z: L.NOSE.frontZ + 0.2, speed: 0, life });
}

/** A Rhaenyra fica (Fica) na placa da cancela; a Radhija vira a ativa. */
function holdBarrier(h) {
  select(h, 'radhija');
  place(h, 'rhaenyra', L.BARRIER_PLATE);
  h.game.setStay('rhaenyra', true);
  waitFor(h, (i) => i.barrier.open >= 1, 'a cancela subiu com alguém na placa', 3);
}

function snapshot(h) {
  const i = info(h);
  return {
    stage: i.stage, route: i.route, tripRoute: i.tripRoute, trips: i.trips,
    routeChanges: i.routeChanges, armed: i.armed, blocked: i.blockedCloudIds,
    train: h.props.train.object.position.toArray(),
    trainRotation: h.props.train.object.quaternion.toArray(),
    ball: h.props.ball.object.position.toArray(),
    ballRotation: h.props.ball.object.quaternion.toArray(),
    pedal: h.props.pedal.object.children.map((object) => object.position.toArray()),
    nose: h.props.nose.object.scale.toArray(),
    moon: h.props.moon.object.position.toArray(),
    barrier: i.barrier, loading: i.loading, mode: i.mode, distance: i.distance,
    clouds: h.game.debug.scent.clouds.map((c) => ({ id: c.id, x: c.x, z: c.z, age: c.age })),
    jump: [h.ctrls.rhaenyra.jumpT, h.ctrls.rhaenyra.y],
  };
}

test('fase 6: na campanha depois da fase 5, com props reais completos', async (t) => {
  assert.equal(INDEX, 5, 'sexta fase da campanha');
  assert.equal(LEVELS.filter((def) => def.id === 'fase6').length, 1);
  assert.equal(DEV_LEVELS.some((def) => def.id === 'fase6'), false, 'saiu do catálogo de desenvolvimento');
  const h = await campaign(t);
  assert.equal(info(h).levelId, 'fase6');
  assert.equal(info(h).stage, 'waiting');
  assert.equal(info(h).route, 'loop');
  assert.equal(info(h).trips, 0);
  assert.equal(h.game.debug.scent.noses.filter((n) => n.id === L.NOSE.id).length, 1);
  for (const key of ['pedal', 'junction', 'train', 'nose', 'ball', 'moon', 'barrier', 'barrierPlate', 'hopper', 'goal']) {
    assert.ok(h.props[key].object instanceof THREE.Object3D, `${key} é objeto Three real`);
  }
  assert.ok(h.props.ball.home instanceof THREE.Vector3);
  assert.equal(h.props.ball.object.parent, h.engine.scene.getObjectByName('fase:fase6'), 'bola tem parent estável na raiz');
  assert.equal(h.props.moon.object.parent, h.engine.scene.getObjectByName('fase:fase6'), 'lua tem parent estável na raiz');
  for (const cargo of ['planet', 'moon']) assert.ok(h.props.goal.socket(cargo) instanceof THREE.Object3D, `berço do foguete: ${cargo}`);
  assert.deepEqual(info(h).place, { planet: 'wagon', moon: 'gantry' });
  assert.equal(info(h).barrier.open, 0, 'a cancela começa fechada');
  // a lua está dentro da maquete, no pórtico: só o trem chega até ela
  const yard = L.RAIL_YARD;
  assert.ok(Math.abs(L.MOON.x - yard.x) < yard.hx - 0.3 && Math.abs(L.MOON.z - yard.z) < yard.hz, 'a lua fica dentro do cercado');
  near(h.props.moon.object.position.x, L.MOON.x, 'lua no pórtico X');
  near(h.props.moon.object.position.y, L.MOON.y, 'lua no pórtico Y');
  near(h.props.moon.object.position.z, L.MOON.z, 'lua no pórtico Z');
  assert.deepEqual(h.props.collectibles.map((c) => c.id).sort(), L.COLLECTIBLES.map((c) => c.id).sort());
});

test('fase 6: fábrica headless explícita suporta suítes comuns sem fabricar métodos', async () => {
  const h = await createHeadlessGame({ levels: [fase6] });
  assert.equal(h.game.state, 'playing');
  assert.equal(h.puzzle.stage, 'waiting');
  assert.throws(() => h.props.portao?.setOpen?.(1), /Prop não declarado: fase6.portao/);
  assert.throws(() => h.props.train.setPos?.(1, 2), /Prop não declarado: fase6.train.setPos/);
  assert.throws(() => h.props.pedal.setOpen?.(1), /Prop não declarado: fase6.pedal.setOpen/);
  const pose = { x: 1.8, z: -0.3, yaw: Math.PI };
  h.props.train.setPose(pose);
  assert.deepEqual(h.props.train.object.position.toArray(), [pose.x, 0, pose.z]);
  h.game.reset();
  assert.deepEqual(h.props.train.object.position.toArray(), [L.TRAIN.start.x, 0, L.TRAIN.start.z]);
  assert.deepEqual(h.props.ball.object.position.toArray(), [L.BALL.x, L.BALL.y, L.BALL.z]);
});

test('fase 6: andar, permanecer, latir, interagir e arrancar no pedal não trocam a rota', async (t) => {
  const h = await campaign(t, 'dog=rhaenyra');
  select(h, 'rhaenyra');
  place(h, 'rhaenyra', { x: L.PEDAL.x, z: L.PEDAL.z + L.PEDAL.r + 0.3 });
  h.walkTo(L.PEDAL.x, L.PEDAL.z, { tol: 0.1 });
  assert.ok(Math.hypot(h.ctrls.rhaenyra.x - L.PEDAL.x, h.ctrls.rhaenyra.z - L.PEDAL.z) < 0.2);
  h.run(2);
  h.tap('KeyE');
  h.setPad(h.pad({ down: [PAD.X] }));
  h.step();
  h.setPad(null);
  h.step();
  assert.ok(h.log('dog:bark').length > 0, 'latido foi exercitado');
  assert.equal(info(h).routeChanges, 0);
  select(h, 'radhija');
  place(h, 'radhija', L.PEDAL, Math.PI / 2);
  h.tap('ShiftLeft');
  h.run(0.5);
  assert.equal(h.log('dog:dash').length, 1);
  h.tap('Space');
  assert.equal(info(h).route, 'loop');
  assert.equal(info(h).routeChanges, 0);
  assert.equal(h.log('dog:jump').length, 0, 'a Radhija não pode substituir o salto');
});

test('fase 6: pouso real aciona uma vez; cada pulo avança a agulha (volta → lua → estrela → volta) e pouso fora não aciona', async (t) => {
  const h = await campaign(t, 'dog=rhaenyra');
  jumpPedal(h);
  assert.equal(info(h).route, 'moon');
  assert.equal(info(h).routeChanges, 1);
  assert.equal(h.log('dog:land').length, 1);
  assert.equal(h.ctrls.rhaenyra.landed, false, 'núcleo consumiu landed depois do puzzle');
  const hintsAfterLanding = h.log('hint').length;
  h.run(2);
  assert.equal(info(h).routeChanges, 1, 'ficar sobre o pedal não repete o impacto');
  assert.equal(h.log('hint').slice(hintsAfterLanding).some((hint) => hint.text === h.puzzle.TEXT.hint.jump), false,
    'trilho correto não pede outro pulo que desfaria a escolha');
  jumpPedal(h);
  assert.equal(info(h).route, 'delivery');
  assert.equal(info(h).routeChanges, 2);
  place(h, 'rhaenyra', { x: L.PEDAL.x, z: L.PEDAL.z + L.PEDAL.r + 0.5 });
  h.tap('Space');
  h.run(0.8);
  assert.equal(h.log('dog:land').length, 3, 'houve um terceiro pouso real');
  assert.equal(info(h).routeChanges, 2, 'pouso fora do pedal não vale');
  jumpPedal(h);
  assert.equal(info(h).route, 'loop', 'depois da estrela, a agulha volta para a volta');
  assert.equal(info(h).routeChanges, 3);
  assert.deepEqual(h.log('expresso:route').map((e) => e.route), ['moon', 'delivery', 'loop']);
});

test('fase 6: trocar de personagem no ar preserva um único pouso no pedal', async (t) => {
  const h = await campaign(t, 'dog=rhaenyra');
  select(h, 'rhaenyra');
  place(h, 'rhaenyra', L.PEDAL);
  h.tap('Space');
  h.tap('KeyQ');
  h.game.setStay('rhaenyra', true);
  assert.equal(h.game.activeDog, 'radhija');
  h.run(1);
  assert.equal(h.log('dog:land').length, 1);
  assert.equal(info(h).routeChanges, 1);
  assert.equal(info(h).route, 'moon');
  assert.equal(h.ctrls.rhaenyra.y, 0);
});

test('fase 6: aproximar, latir e interagir no nariz não substitui bafo', async (t) => {
  const h = await campaign(t);
  select(h, 'radhija');
  place(h, 'radhija', L.BLOW_SPOT);
  h.run(1);
  h.tap('KeyE');
  h.setPad(h.pad({ down: [PAD.X] }));
  h.step();
  h.setPad(null);
  h.run(1);
  assert.ok(h.log('dog:bark').length > 0);
  assert.equal(info(h).trips, 0);
  assert.equal(info(h).stage, 'waiting');
  select(h, 'rhaenyra');
  place(h, 'rhaenyra', L.BLOW_SPOT);
  h.tap('KeyR');
  h.run(1);
  assert.equal(h.log('dog:bafo').length, 0, 'a Rhaenyra não tem superbafo');
  assert.equal(info(h).trips, 0);
});

test('fase 6: ordem inversa — a volta é recuperável, a cancela barra a estrela e, segura na placa, o planeta chega antes da lua', async (t) => {
  const h = await campaign(t);
  const ball = h.props.ball.object;
  blow(h);
  waitFor(h, (i) => i.stage === 'movingLoop', 'primeiro bafo inicia a rota circular');
  waitFor(h, (i) => i.stage === 'waiting' && i.armed, 'a volta retorna e rearma');
  assert.equal(info(h).trips, 1);
  near(ball.position.x, L.BALL.x, 'bola voltou no vagão X');
  near(ball.position.z, L.BALL.z, 'bola voltou no vagão Z');
  jumpTo(h, 'delivery');
  // ninguém na placa: o trem para antes do braço, apita e volta de frente com o planeta
  blow(h);
  waitFor(h, (i) => i.stage === 'blocked', 'a cancela fechada segura o trem');
  near(info(h).distance, BARRIER_STOP, 'parou no ponto da cancela', 1e-9);
  assert.equal(h.log('expresso:blocked').length, 1);
  waitFor(h, (i) => i.stage === 'returning', 'volta para a estação com o planeta');
  waitFor(h, (i) => i.stage === 'waiting' && i.armed, 'chegou de volta e pode tentar de novo');
  assert.equal(info(h).place.planet, 'wagon');
  near(ball.position.z, L.BALL.z, 'o planeta continua no vagão');
  // a Rhaenyra fica na placa (Fica): a cancela sobe e só o planeta (a lua segue no pórtico) chega à bandeja
  holdBarrier(h);
  blow(h);
  waitFor(h, (i) => i.stage === 'ready', 'planeta descarregado na bandeja da estrela', 25);
  assert.equal(info(h).trips, 3);
  assert.equal(info(h).place.moon, 'gantry');
  near(ball.position.y, L.TRAY.y, 'na bandeja Y');
  near(ball.position.z, L.TRAY.z, 'na bandeja Z');
  waitFor(h, (i) => i.mode === 'idle', 'o trem volta sozinho para a estação', 12);
  near(h.props.train.object.position.z, L.TRAIN.start.z, 'estacionou na estação');
  // pega na bandeja e leva ao foguete
  place(h, 'radhija', { x: L.TRAY.x - 0.1, z: L.TRAY.z + 0.55, yaw: Math.PI });
  h.tap('KeyE');
  assert.equal(h.puzzle.carrier, 'radhija');
  assert.equal(ball.parent, h.dogs.radhija.mouthSocket);
  assert.deepEqual(ball.position.toArray(), [0, 0, 0]);
  // E de novo ali, com o planeta na boca: ele desce de volta para o lugar dele na bandeja; E pega de novo
  h.tap('KeyE');
  assert.equal(h.puzzle.carrier, null, 'na bandeja, E com a carga na boca a devolve');
  assert.equal(info(h).place.planet, 'tray');
  h.run(1);
  near(ball.position.x, L.TRAY.x - 0.1, 'de volta no lugar dela X');
  near(ball.position.y, L.TRAY.y, 'de volta no lugar dela Y');
  near(ball.position.z, L.TRAY.z, 'de volta no lugar dela Z');
  h.tap('KeyE');
  assert.equal(h.puzzle.carrier, 'radhija', 'pegou de volta');
  h.tap('KeyQ');
  assert.equal(h.puzzle.carrier, 'radhija', 'troca de dog não transfere nem duplica a carga');
  assert.equal(h.log('item:pickup').length, 2);
  select(h, 'radhija');
  h.clearLog();
  h.walkPath([[L.TRAY.x, 2.5], [L.GOAL.x, 2.5], [L.GOAL.x, L.GOAL.z]]);
  waitFor(h, (i) => i.place.planet === 'rocket', 'o planeta encaixou no foguete', 8);
  assert.equal(ball.parent, h.props.goal.socket('planet'));
  assert.equal(info(h).state, 'playing', 'só o planeta ainda não termina a fase');
  assert.equal(info(h).stage, 'planetDocked');
  assert.ok(h.log('hint').some((x) => x.text === h.puzzle.TEXT.hint.needMoon), 'pede para mandar o trem buscar a lua');
  assert.equal(info(h).objective, h.puzzle.TEXT.objective.switchJump, 'a Radhija é mandada trocar para pular até a lua');
  assert.equal(h.log('expresso:dock').length, 1);
  assert.equal(h.log('victory').length, 0);
  // a lua: um pulo (estrela → volta → lua são dois), o trem busca e volta com ela; depois a estrela de novo
  jumpTo(h, 'moon');
  blow(h);
  waitFor(h, (i) => i.stage === 'moonLoaded' && i.mode === 'idle', 'o trem trouxe a lua do pórtico', 15);
  assert.deepEqual(info(h).cargo, ['moon'], 'só a lua no vagão');
  jumpTo(h, 'delivery');
  holdBarrier(h);
  blow(h);
  waitFor(h, (i) => i.stage === 'moonReady', 'a lua chegou à bandeja', 25);
  near(h.props.moon.object.position.x, L.TRAY.x + 0.1, 'lua no lado leste da bandeja');
});
test('fase 6: rota fica travada no espirro/viagem, sem pulo enfileirado nem nova viagem', async (t) => {
  const h = await campaign(t);
  frontCloud(h, 0.3);
  h.step();
  assert.equal(info(h).stage, 'sneezing');
  assert.equal(info(h).tripRoute, 'loop');
  jumpPedal(h);
  assert.equal(info(h).routeChanges, 0, 'pouso durante espirro foi recusado');
  waitFor(h, (i) => i.stage === 'movingLoop', 'trem em movimento');
  jumpPedal(h);
  frontCloud(h, 1);
  h.run(0.4);
  assert.equal(info(h).route, 'loop');
  assert.equal(info(h).tripRoute, 'loop');
  assert.equal(info(h).trips, 1);
  waitFor(h, (i) => i.stage === 'waiting' && i.armed, 'retornou normalmente');
  h.run(1);
  assert.equal(info(h).routeChanges, 0, 'nenhum pouso antigo ficou enfileirado');
  assert.equal(info(h).trips, 1, 'nenhum segundo bafo criou viagem duplicada');
});

test('fase 6: contato lateral consumido pelo cheiro real não ganha segunda chance pela frente', async (t) => {
  const h = await campaign(t);
  const scent = h.game.debug.scent;
  const cloud = scent.spawn({ x: L.NOSE.x + L.NOSE.halfWidth + 0.12, z: L.NOSE.frontZ + 0.12, speed: 0, life: 10 });
  cloud.r = 1.05; // nuvem já espalhada: pior raio calmo do sistema existente.
  h.step();
  assert.equal(h.log('scent:smell').filter((p) => p.id === L.NOSE.id && p.cloud === cloud.id).length, 1);
  assert.ok(cloud.smelled.has(L.NOSE.id), 'campo real consumiu o primeiro contato');
  assert.equal(info(h).trips, 0, 'setor lateral rejeitado');
  cloud.x = L.NOSE.x;
  cloud.z = L.NOSE.frontZ + 0.2;
  h.run(0.3);
  assert.equal(info(h).trips, 0, 'mover a mesma nuvem para a frente não reutiliza tentativa');
  assert.equal(h.log('scent:smell').filter((p) => p.id === L.NOSE.id && p.cloud === cloud.id).length, 1);
  frontCloud(h);
  h.step();
  assert.equal(info(h).trips, 1, 'somente um novo sopro frontal inicia o trem');
});

test('fase 6: bafo pelo contorno não atravessa a ferrovia; janela aceita uma faixa frontal ampla', async (t) => {
  const h = await campaign(t);
  const scent = h.game.debug.scent;
  const yard = L.RAIL_YARD;
  const radius = L.DOGS.radhija.radius;
  const shots = [];
  for (const part of [-1, -0.75, -0.5, 0, 0.5, 0.75, 1]) {
    for (const side of [-1, 1]) {
      shots.push({ x: yard.x + side * (yard.hx + radius + 0.03), z: yard.z + part * yard.hz, dx: -side, dz: 0 });
      if (side < 0 || Math.abs(part * yard.hx) > 1) {
        shots.push({ x: yard.x + part * yard.hx, z: yard.z + side * (yard.hz + radius + 0.03), dx: 0, dz: -side });
      }
    }
  }
  let fired = 0;
  for (const shot of shots) {
    h.puzzle.reset();
    // a canaleta encosta na borda sul: dali a Radhija não sopra (o colisor dela ocupa a origem)
    if (h.world.overlaps(shot.x, shot.z, radius, 'small')) {
      assert.equal(h.world.overlaps(shot.x, shot.z, radius, 'small', { ignore: new Set(['canaleta']) }), false, `só a canaleta ocupa (${shot.x}, ${shot.z})`);
      continue;
    }
    fired++;
    // A mesma distância boca→centro e velocidade do jogo, incluindo a cabeça
    // que pode ultrapassar visualmente a borda. O cheiro colide de verdade.
    scent.spawn({ x: shot.x + shot.dx * 0.36, z: shot.z + shot.dz * 0.36,
      dirX: shot.dx, dirZ: shot.dz, speed: L.DOGS.radhija.bafoSpeed, life: 5 });
    for (let frame = 0; frame < 310; frame++) scent.update(1 / 60);
    assert.equal(info(h).trips, 0, `contorno rejeita bafo em (${shot.x}, ${shot.z})`);
  }
  assert.ok(fired >= shots.length - 2, `quase todo o contorno foi testado (${fired} de ${shots.length})`);
  for (const offset of [-0.43, 0, 0.43]) {
    h.puzzle.reset();
    scent.spawn({ x: L.NOSE.x + offset, z: L.NOSE.frontZ + 0.2, speed: 0, life: 2 });
    for (let frame = 0; frame < 30; frame++) scent.update(1 / 60);
    assert.equal(info(h).trips, 1, `janela permite sopro frontal com deslocamento ${offset}`);
  }
});

test('fase 6: rearme captura TODAS as nuvens, inclusive longe; expiração poda IDs e reset limpa', async (t) => {
  const h = await campaign(t);
  const scent = h.game.debug.scent;
  frontCloud(h, 0.25);
  h.step();
  const far = scent.spawn({ x: 4, z: 3, speed: 0, life: 60 });
  waitFor(h, (i) => i.stage === 'waiting' && i.armed, 'loop voltou e nariz rearmou');
  assert.ok(info(h).blockedCloudIds.includes(far.id), 'snapshot inclui nuvem longe do nariz');
  assert.equal(info(h).blockedCloudIdsCount, info(h).blockedCloudIds.length);
  far.x = L.NOSE.x;
  far.z = L.NOSE.frontZ + 0.2;
  h.step();
  assert.ok(far.smelled.has(L.NOSE.id), 'a nuvem antiga alcançou de fato o sensor');
  assert.equal(info(h).trips, 1, 'cheiro antigo que chega depois do rearme continua inválido');
  far.age = far.life + 1;
  h.step();
  h.step(); // scent expira depois do update do puzzle; próximo quadro faz a poda.
  assert.equal(scent.clouds.some((c) => c.id === far.id), false);
  assert.equal(info(h).blockedCloudIds.includes(far.id), false);
  frontCloud(h, 0.25);
  h.step();
  assert.equal(info(h).trips, 2, 'nuvem criada depois do rearme pode iniciar nova viagem');
  const otherFar = scent.spawn({ x: -4.8, z: 3.2, speed: 0, life: 60 });
  waitFor(h, (i) => i.stage === 'waiting' && i.armed, 'segunda volta também rearma');
  assert.ok(info(h).blockedCloudIds.includes(otherFar.id));
  assert.equal(info(h).blockedCloudIds.includes(far.id), false, 'snapshot não acumula histórico');
  h.game.reset();
  assert.deepEqual(info(h).blockedCloudIds, []);
  assert.equal(info(h).blockedCloudIdsCount, 0);
  assert.equal(scent.clouds.length, 0);
  assert.equal(scent.noses.filter((n) => n.id === L.NOSE.id).length, 1, 'reset não registra nariz duplicado');
});

test('fase 6: nuvem ainda no nariz impede rearme depois da volta', async (t) => {
  const h = await campaign(t);
  const cloud = frontCloud(h, 60);
  h.step();
  waitFor(h, (i) => i.stage === 'waiting', 'trem retornou');
  assert.equal(info(h).armed, false, 'nariz coberto não rearma');
  h.run(2);
  assert.equal(info(h).trips, 1);
  cloud.x = 4;
  cloud.z = 3;
  waitFor(h, (i) => i.armed, 'retirar cheiro da área permite rearmar', 1);
  assert.ok(info(h).blockedCloudIds.includes(cloud.id), 'cheiro antigo distante fica bloqueado');
});

test('fase 6: carga só sai do trem pela bandeja, inclusive quando a cabeça alcança a pose dela', async (t) => {
  const h = await campaign(t);
  for (const state of TRIP) {
    assert.equal(h.game.debug.setStage(state, 'radhija'), true, state);
    // Chama a interação real exatamente sobre a carga do vagão para provar a trava lógica,
    // independentemente da proteção geométrica que é testada separadamente.
    const c = { ...h.ctrls.radhija, x: h.props.ball.object.position.x, z: h.props.ball.object.position.z };
    h.puzzle.interact(c);
    assert.equal(h.puzzle.carrier, null, `retirada bloqueada em ${state}`);
  }
  h.game.debug.setStage('movingDelivery', 'radhija');
  waitFor(h, (i) => i.unloading, 'o trem chegou, mas a descarga ainda não terminou');
  place(h, 'radhija', { x: L.TRAY.x - 0.1, z: L.TRAY.z + 0.55, yaw: Math.PI });
  h.tap('KeyE');
  assert.equal(h.puzzle.carrier, null, 'carga na canaleta ainda não pode ser retirada');
  for (const name of ['radhija', 'rhaenyra']) {
    assert.equal(h.game.debug.setStage('ready', name), true);
    // as duas cargas estão na bandeja: a da frente da cabeça é a que vem
    place(h, name, { x: L.TRAY.x - 0.1, z: L.TRAY.z + 0.55, yaw: Math.PI });
    h.tap('KeyE');
    assert.equal(h.puzzle.carrier, name, `qualquer irmã pode retirar: ${name}`);
    const ball = h.props.ball.object;
    assert.equal(ball.parent, h.dogs[name].mouthSocket, 'pegou o planeta, que estava diante dela');
    assert.equal(info(h).place.moon, 'tray', 'a lua espera na bandeja');
    frontCloud(h);
    h.run(0.5);
    assert.equal(ball.parent, h.dogs[name].mouthSocket, 'o trem não leva a carga depois da retirada');
    assert.deepEqual(ball.position.toArray(), [0, 0, 0]);
    assert.equal(h.puzzle.stage, 'carrying');
  }
  // uma carga em cada boca: quem já leva o planeta não pega a lua (E ali devolve o planeta ao lugar dele na bandeja);
  // ela pega o planeta de volta e a outra irmã, de boca vazia, pega a lua
  h.game.debug.setStage('carrying', 'radhija');
  place(h, 'radhija', { x: L.TRAY.x + 0.1, z: L.TRAY.z + 0.55, yaw: Math.PI });
  h.tap('KeyE');
  assert.equal(info(h).moon.holder, null, 'a mesma boca não leva duas cargas');
  assert.equal(info(h).place.moon, 'tray');
  assert.equal(info(h).place.planet, 'tray', 'o planeta voltou para a bandeja');
  place(h, 'radhija', { x: L.TRAY.x - 0.1, z: L.TRAY.z + 0.35, yaw: Math.PI });
  h.tap('KeyE');
  assert.equal(info(h).ball.holder, 'radhija', 'diante do lugar dele, pegou o planeta de volta');
  place(h, 'radhija', { x: L.TRAY.x - 0.6, z: L.TRAY.z + 0.9 });
  select(h, 'rhaenyra');
  place(h, 'rhaenyra', { x: L.TRAY.x + 0.1, z: L.TRAY.z + 0.55, yaw: Math.PI });
  h.tap('KeyE');
  assert.equal(info(h).moon.holder, 'rhaenyra', 'a outra irmã, de boca vazia, pega a lua');
  assert.equal(info(h).ball.holder, 'radhija', 'o planeta continua com a Radhija');
  assert.equal(h.props.moon.object.parent, h.dogs.rhaenyra.mouthSocket);
  assert.equal(h.puzzle.carries('radhija'), true);
  assert.equal(h.puzzle.carries('rhaenyra'), true);
  assert.equal(info(h).dogs.radhija.carrying && info(h).dogs.rhaenyra.carrying, true, 'o núcleo vê as duas carregando');
  assert.equal(info(h).objective, h.puzzle.TEXT.objective.carryingBoth);
  // e a lua no pórtico não sai pela cerca: dentro da maquete, só o trem chega
  h.game.debug.setStage('waiting', 'radhija');
  select(h, 'radhija');
  place(h, 'radhija', { x: L.MOON.x, z: L.RAIL_YARD.z - L.RAIL_YARD.hz - 0.3, yaw: Math.PI });
  h.tap('KeyE');
  assert.equal(info(h).moon.holder, null, 'do lado de fora da cerca, a lua não se pega');
  assert.equal(info(h).place.moon, 'gantry');
});
test('fase 6: dica da bandeja só anuncia a carga no trem enquanto ele viaja', async (t) => {
  const h = await campaign(t);
  for (const stage of STATES) {
    assert.equal(h.game.debug.setStage(stage, 'radhija'), true, stage);
    // Fora do alcance de retirada (0,6), dentro da região da dica (0,85).
    // A cabeça aponta para longe, mantendo reach em 0,7.
    const c = { ...h.ctrls.radhija, x: L.TRAY.x, z: L.TRAY.z + 0.7, yaw: 0 };
    const holder = h.puzzle.carrier;
    h.clearLog();
    const handled = h.puzzle.interact(c);
    const traveling = TRIP.includes(stage);
    // com a carga na boca, o E ali (longe do lugar dela na bandeja) a larga no chão, sem a dica do trem
    assert.equal(handled, traveling || holder !== null, `interação na borda: ${stage}`);
    assert.equal(h.log('hint').some((hint) => hint.text === h.puzzle.TEXT.hint.early), traveling,
      `dica corresponde ao estado real: ${stage}`);
    assert.equal(h.log('item:drop').length, holder ? 1 : 0, `só larga quem carrega: ${stage}`);
    assert.equal(h.puzzle.carrier, null, holder ? `a carga vai para o chão: ${stage}` : 'interação distante não muda quem carrega');
  }
});

test('fase 6: pausa congela salto, espirro, trajetos, rearme e animação da descarga', async (t) => {
  const h = await campaign(t, 'dog=rhaenyra');
  select(h, 'rhaenyra');
  place(h, 'rhaenyra', L.PEDAL);
  h.tap('Space');
  h.events.emit('ui:pause', {});
  const inAir = snapshot(h);
  assert.ok(inAir.jump[0] > 0);
  h.run(3);
  assert.deepEqual(snapshot(h), inAir);
  h.events.emit('ui:resume', {});
  h.run(0.8);
  assert.equal(info(h).routeChanges, 1);
  for (const state of STATES) {
    h.game.debug.setStage(state, 'radhija');
    h.events.emit('ui:pause', {});
    assert.equal(h.game.state, 'paused', state);
    const before = snapshot(h);
    h.run(3);
    assert.deepEqual(snapshot(h), before, `estado congelado: ${state}`);
    h.events.emit('ui:resume', {});
    assert.equal(h.game.state, 'playing');
  }
  h.game.debug.setStage('movingDelivery', 'radhija');
  waitFor(h, (i) => i.unloading, 'alcançou a animação da canaleta');
  h.events.emit('ui:pause', {});
  const unloading = snapshot(h);
  h.run(3);
  assert.deepEqual(snapshot(h), unloading, 'a bolinha não chega à bandeja com o jogo pausado');
  h.events.emit('ui:resume', {});
  waitFor(h, (i) => i.stage === 'ready', 'descarga termina depois de retomar', 2);
});

test('fase 6: reinício de cada estado devolve parent/pose das cargas, trem, rota, cancela, nuvens e petiscos', async (t) => {
  const h = await campaign(t);
  const items = [h.props.ball.object, h.props.moon.object].map((o) => ({ o, parent: o.parent, pos: o.position.clone(), quat: o.quaternion.clone() }));
  const trainHome = h.props.train.object.position.clone();
  const rocket = h.engine.scene.getObjectByName('foguete');
  for (const state of STATES) {
    assert.equal(h.game.debug.setStage(state, 'radhija'), true, state);
    if (state === 'carrying') assert.equal(h.props.ball.object.parent, h.dogs.radhija.mouthSocket);
    if (state === 'carryingMoon') assert.equal(h.props.moon.object.parent, h.dogs.radhija.mouthSocket);
    if (state === 'planetDocked') assert.equal(h.props.ball.object.parent, h.props.goal.socket('planet'));
    h.game.debug.scent.spawn({ x: 4, z: 3, speed: 0, life: 60 });
    h.props.collectibles[0].collect();
    h.game.built.update?.(1, 1);
    h.events.emit('ui:restart', {});
    assert.equal(h.game.state, 'playing');
    assert.equal(h.puzzle.stage, 'waiting', state);
    assert.equal(h.puzzle.carrier, null);
    for (const it of items) {
      assert.equal(it.o.parent, it.parent, `parent restaurado (${it.o.name}): ${state}`);
      assert.ok(it.o.position.equals(it.pos), `posição restaurada (${it.o.name}): ${state}`);
      assert.ok(it.o.quaternion.equals(it.quat), `rotação restaurada (${it.o.name}): ${state}`);
      assert.equal(it.o.visible, true);
    }
    assert.deepEqual(info(h).place, { planet: 'wagon', moon: 'gantry' });
    assert.equal(info(h).barrier.open, 0, 'cancela fechada de novo');
    assert.equal(rocket.position.y, 0, 'foguete no chão');
    assert.ok(h.props.train.object.position.equals(trainHome));
    assert.equal(info(h).route, 'loop');
    assert.equal(info(h).trips, 0);
    assert.equal(info(h).routeChanges, 0);
    assert.deepEqual(info(h).blockedCloudIds, []);
    assert.equal(h.game.debug.scent.clouds.length, 0);
    assert.equal(h.game.debug.scent.noses.filter((n) => n.id === L.NOSE.id).length, 1);
    assert.equal(h.puzzle.collected, 0);
    assert.ok(h.props.collectibles.every((c) => c.object.visible));
    assert.equal(h.dogs.radhija.carryKind, null);
    assert.equal(h.dogs.rhaenyra.carryKind, null);
  }
});

test('fase 6: troca de fase em cada estado descarta nariz e item sem callbacks tardios', async (t) => {
  const h = await campaign(t);
  for (const state of STATES) {
    assert.equal(h.game.debug.setStage(state, 'radhija'), true, state);
    const scent = h.game.debug.scent;
    const oldPuzzle = h.puzzle;
    const oldBall = h.props.ball.object;
    const oldMoon = h.props.moon.object;
    const oldRoot = h.engine.scene.getObjectByName('fase:fase6');
    const wasCarried = oldBall.parent === h.dogs.radhija.mouthSocket || oldMoon.parent === h.dogs.radhija.mouthSocket;
    const geometries = new Set();
    oldRoot.traverse((object) => { if (object.isMesh) geometries.add(object.geometry); });
    const observers = [...geometries].map((geometry) => {
      const entry = { geometry, count: 0, onDispose: () => { entry.count++; } };
      geometry.addEventListener('dispose', entry.onDispose);
      return entry;
    });
    assert.equal(await h.game.loadLevel(INDEX + 1, { mode: 'play', initial: true }), true);
    for (const entry of observers) entry.geometry.removeEventListener('dispose', entry.onDispose);
    assert.equal(oldRoot.parent, null, `root descartado: ${state}`);
    assert.ok(observers.some((entry) => entry.count === 1), `recurso local descartado: ${state}`);
    assert.ok(observers.every((entry) => entry.count <= 1), 'recursos compartilhados ficam; locais saem no máximo uma vez');
    assert.equal(scent.noses.length, 0);
    assert.equal(scent.clouds.length, 0);
    assert.equal(oldPuzzle.carrier, null);
    for (const o of [oldBall, oldMoon]) {
      assert.notEqual(o.parent, h.dogs.radhija.mouthSocket);
      assert.notEqual(o.parent, h.dogs.rhaenyra.mouthSocket);
    }
    if (wasCarried) assert.equal(h.dogs.radhija.carryKind, null);
    const oldState = oldPuzzle.info();
    scent.spawn({ x: L.NOSE.x, z: L.NOSE.frontZ + 0.2, speed: 0 });
    scent.update(1);
    h.run(0.1);
    assert.deepEqual(oldPuzzle.info(), oldState, 'campo descartado não chama o puzzle antigo');
    assert.equal(info(h).levelId, 'fase7');
    assert.equal(await h.game.loadLevel(INDEX, { mode: 'play', initial: true }), true);
    assert.equal(h.game.debug.scent.noses.filter((n) => n.id === L.NOSE.id).length, 1);
  }
});

test('fase 6: passeio, estações e petiscos são alcançáveis por ambas, ferrovia bloqueia inclusive saltos', async (t) => {
  const h = await campaign(t);
  // onde as dogs param para usar cada coisa (a bandeja tem colisor: diante dela)
  const stations = [L.PEDAL, L.BLOW_SPOT, { x: L.TRAY.x, z: L.TRAY.z + 0.55 }, L.GOAL, L.BARRIER_PLATE, ...L.COLLECTIBLES];
  const yard = L.RAIL_YARD;
  for (const name of ['radhija', 'rhaenyra']) {
    const c = h.ctrls[name];
    const ctx = { r: c.r, size: c.size, flags: h.puzzle.navFlags() };
    for (const point of stations) {
      assert.equal(h.world.overlaps(point.x, point.z, c.r, c.size), false, `${name}: estação livre`);
      const path = h.nav.findPath(L.DOGS[name].start, point, ctx);
      assert.equal(path.reachable, true, `${name}: estação alcançável`);
      let previous = L.DOGS[name].start;
      for (const next of [...path.waypoints, point]) {
        assert.ok(h.world.segmentClear(previous.x, previous.z, next.x, next.z, c.r * 0.9, c.size), 'navegação não cruza ferrovia');
        previous = next;
      }
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      // ao norte e ao sul, um pouco a oeste (longe da canaleta e da janela do nariz)
      const x = yard.x + dx * (yard.hx + c.r + 0.3) + (dz ? -0.8 : 0);
      const z = yard.z + dz * (yard.hz + c.r + 0.3);
      for (const airborne of [false, true]) {
        const moved = h.world.move(x, z, -dx * 0.9, -dz * 0.9, c.r, c.size, { airborne });
        assert.ok(Math.abs(moved.x - yard.x) >= yard.hx || Math.abs(moved.z - yard.z) >= yard.hz, `${name}: ferrovia bloqueia ${airborne ? 'no ar' : 'no chão'}`);
        assert.ok(moved.hits.some((hit) => hit.id === 'ferrovia'));
      }
    }
  }
});

// ------------------------------------------------------------------ trilho e composição (acabamento)

/** Cantos do retângulo de um carro visto de cima (frente = cara da locomotiva = direção do yaw). */
function footprint(pose, body) {
  const fx = Math.sin(pose.yaw), fz = Math.cos(pose.yaw), rx = Math.cos(pose.yaw), rz = -Math.sin(pose.yaw);
  return [[body.front, body.halfWidth], [body.front, -body.halfWidth], [-body.back, -body.halfWidth], [-body.back, body.halfWidth]]
    .map(([f, r]) => [pose.x + fx * f + rx * r, pose.z + fz * f + rz * r]);
}
/** Folga (m) entre o retângulo do carro e um enfeite (círculo {x, z, r} ou retângulo {x, z, hx, hz}); < 0 = encosta. */
function clearance(poly, d) {
  if (d.r !== undefined) {
    let inside = true, best = Infinity;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % 4];
      const ex = bx - ax, ez = bz - az;
      const k = Math.max(0, Math.min(1, ((d.x - ax) * ex + (d.z - az) * ez) / (ex * ex + ez * ez)));
      best = Math.min(best, Math.hypot(ax + ex * k - d.x, az + ez * k - d.z));
      if (ex * (d.z - az) - ez * (d.x - ax) > 0) inside = false;
    }
    return inside ? -1 : best - d.r;
  }
  const rect = [[d.x - d.hx, d.z - d.hz], [d.x + d.hx, d.z - d.hz], [d.x + d.hx, d.z + d.hz], [d.x - d.hx, d.z + d.hz]];
  let gap = -Infinity; // maior separação entre as projeções (teorema do eixo separador)
  for (const P of [poly, rect]) for (let i = 0; i < 4; i++) {
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % 4];
    const nx = az - bz, nz = bx - ax, len = Math.hypot(nx, nz);
    const pa = poly.map(([x, z]) => (x * nx + z * nz) / len), pb = rect.map(([x, z]) => (x * nx + z * nz) / len);
    gap = Math.max(gap, Math.min(...pb) - Math.max(...pa), Math.min(...pa) - Math.max(...pb));
  }
  return gap;
}

test('fase 6: trilho — a volta fecha alinhada na estação, o tronco acaba na agulha e não há quina nem salto', () => {
  const { loop, delivery } = TRACK.routes;
  assert.equal(loop.closed, true);
  near(loop.end.x, L.TRAIN.start.x, 'a volta termina na estação (X)', 1e-9);
  near(loop.end.z, L.TRAIN.start.z, 'a volta termina na estação (Z)', 1e-9);
  near(loop.end.dx, loop.start.dx, 'chega andando na mesma direção em que saiu (X)', 1e-9);
  near(loop.end.dz, loop.start.dz, 'chega andando na mesma direção em que saiu (Z)', 1e-9);
  near(TRACK.junction.x, L.JUNCTION.x, 'tronco termina na agulha (X)', 1e-9);
  near(TRACK.junction.z, L.JUNCTION.z, 'tronco termina na agulha (Z)', 1e-9);
  const minRadius = Math.min(...TRACK.pieces.filter((p) => p.kind === 'arc').map((p) => p.r));
  for (const route of [loop, delivery, TRACK.routes.moon]) {
    const step = 0.004;
    let prev = route.at(0);
    for (let s = step; s <= route.length + 1e-9; s += step) {
      const p = route.at(s);
      assert.ok(Math.hypot(p.x - prev.x, p.z - prev.z) <= step + 1e-9, `${route.name}: sem salto em s=${s.toFixed(3)}`);
      assert.ok(turn(Math.atan2(p.dx, p.dz), Math.atan2(prev.dx, prev.dz)) <= (step / minRadius) * 1.001 + 1e-9, `${route.name}: sem quina em s=${s.toFixed(3)}`);
      prev = p;
    }
  }
  // as duas rotas saem juntas pelo tronco: a mesma pose parada, seja qual for a escolha
  const rest = TRACK.consist('loop', 0);
  for (const other of ['delivery', 'moon']) {
    const r = TRACK.consist(other, 0);
    for (const k of ['x', 'z', 'yaw']) {
      near(rest[k], r[k], `mesma pose parada na volta e em ${other} (${k})`, 1e-12);
      near(rest.wagon[k], r.wagon[k], `mesmo vagão parado na volta e em ${other} (${k})`, 1e-12);
    }
  }
  near(rest.wagon.x, L.BALL.x, 'vagão parado onde a bolinha começa (X)', 1e-9);
  near(rest.wagon.z, L.BALL.z, 'vagão parado onde a bolinha começa (Z)', 1e-9);
  // fim da entrega: vagão alinhado com a canaleta e inteiro sobre o trilho do para-choque
  const end = TRACK.consist('delivery', delivery.length);
  near(end.wagon.x, L.CHUTE.x, 'vagão alinhado com a canaleta', 1e-9);
  const tailEnd = delivery.end.z + delivery.end.dz * L.TRACK.tail.delivery;
  assert.ok(end.wagon.z + L.TRAIN_BODY.wagon.back <= tailEnd + 1e-9, 'vagão cabe no trilho antes do para-choque');
  assert.ok(end.wagon.z + L.TRAIN_BODY.wagon.back < L.CHUTE.z0, 'vagão para dentro da maquete, antes da canaleta');
  // fim da lua: logo depois da agulha, com o lugar da frente do vagão bem embaixo da cestinha do pórtico
  const moon = TRACK.routes.moon;
  const moonEnd = TRACK.consist('moon', moon.length);
  const ahead = { x: -Math.sin(moonEnd.wagon.yaw), z: -Math.cos(moonEnd.wagon.yaw) };
  near(moonEnd.wagon.x + ahead.x * L.TRAIN.slot, L.MOON.x, 'lugar da frente do vagão embaixo da lua (X)', 1e-9);
  near(moonEnd.wagon.z + ahead.z * L.TRAIN.slot, L.MOON.z, 'lugar da frente do vagão embaixo da lua (Z)', 1e-9);
  const moonTailEnd = moon.end.z + moon.end.dz * L.TRACK.tail.moon;
  assert.ok(moonEnd.wagon.z - L.TRAIN_BODY.wagon.back >= moonTailEnd - 1e-9, 'vagão cabe no trilho antes do para-choque do norte');
  assert.ok(moonEnd.wagon.z - L.TRAIN_BODY.wagon.back > L.RAIL_YARD.z - L.RAIL_YARD.hz + 0.07, 'vagão para antes da cerca do norte');
  // os postes do pórtico ladeiam o vagão parado, com folga
  for (const s of [-1, 1]) {
    assert.ok(Math.abs(L.MOON_GANTRY.x + s * L.MOON_GANTRY.legX - moonEnd.wagon.x) - L.MOON_GANTRY.legR > L.TRAIN_BODY.wagon.halfWidth + 0.03, 'poste longe do vagão');
  }
  // a cancela fica na reta leste da estrela, e o ponto de parada deixa o vagão antes dela
  const arm = delivery.at(L.BARRIER.s);
  near(arm.x, L.BARRIER.x, 'cancela sobre o trilho (X)', 1e-6);
  near(arm.z, L.BARRIER.z, 'cancela sobre o trilho (Z)', 0.01);
  const stop = TRACK.consist('delivery', BARRIER_STOP);
  assert.ok(stop.wagon.z + L.TRAIN_BODY.wagon.back < L.BARRIER.z - 0.03, 'o vagão para antes do braço');
});

test('fase 6: o trem inteiro (corpo e teto) fica dentro da cerca e longe dos enfeites nas três rotas', () => {
  const Y = L.RAIL_YARD, inset = 0.07; // cerca sobre a moldura de 7 cm
  const B = { minX: Y.x - Y.hx + inset, maxX: Y.x + Y.hx - inset, minZ: Y.z - Y.hz + inset, maxZ: Y.z + Y.hz - inset };
  const bodyIn = (poly, what) => {
    for (const [x, z] of poly) {
      assert.ok(x >= B.minX && x <= B.maxX && z >= B.minZ && z <= B.maxZ, `${what} sai da maquete em (${x.toFixed(3)}, ${z.toFixed(3)})`);
    }
  };
  for (const route of ['loop', 'delivery', 'moon']) {
    const length = TRACK.routes[route].length;
    for (let s = 0; s <= length + 1e-9; s += 0.01) {
      const c = TRACK.consist(route, s);
      const cars = [['locomotiva', footprint(c, L.TRAIN_BODY.loco)], ['vagão', footprint(c.wagon, L.TRAIN_BODY.wagon)]];
      for (const [what, poly] of cars) {
        bodyIn(poly, `${route} s=${s.toFixed(2)}: ${what}`);
        for (const [id, d] of Object.entries(L.YARD_DECOR)) {
          assert.ok(clearance(poly, d) > 0.01, `${route} s=${s.toFixed(2)}: ${what} encosta em ${id}`);
        }
      }
      bodyIn(footprint(c, L.TRAIN_BODY.roof), `${route} s=${s.toFixed(2)}: teto da cabine`);
    }
  }
});

test('fase 6: viagem real — locomotiva, vagão e bolinha seguem o trilho quadro a quadro, sem salto nem giro parado', async (t) => {
  const h = await campaign(t);
  const loco = h.props.train.object;
  const wagon = h.engine.scene.getObjectByName('vagao');
  const ball = h.props.ball.object;
  const minRadius = Math.min(...TRACK.pieces.filter((p) => p.kind === 'arc').map((p) => p.r));
  const stages = new Set();
  let prev = null;
  let frames = 0;
  const check = () => {
    const i = info(h);
    stages.add(i.stage);
    const c = TRACK.consist(i.tripRoute || 'loop', i.distance);
    near(loco.position.x, c.x, 'locomotiva no trilho (X)', 1e-9);
    near(loco.position.z, c.z, 'locomotiva no trilho (Z)', 1e-9);
    assert.ok(turn(loco.rotation.y, c.yaw) < 1e-9, 'locomotiva na tangente do trilho');
    near(wagon.position.x, c.wagon.x, 'vagão no trilho (X)', 1e-9);
    near(wagon.position.z, c.wagon.z, 'vagão no trilho (Z)', 1e-9);
    assert.ok(turn(wagon.rotation.y, c.wagon.yaw) < 1e-9, 'vagão na tangente do trilho (articulado)');
    near(ball.position.x, c.wagon.x, 'bolinha no vagão (X)', 1e-9);
    near(ball.position.y, L.TRAIN.cargoY, 'bolinha no vagão (Y)', 1e-9);
    near(ball.position.z, c.wagon.z, 'bolinha no vagão (Z)', 1e-9);
    if (prev) {
      const moved = Math.hypot(loco.position.x - prev.x, loco.position.z - prev.z);
      assert.ok(moved <= L.TRAIN.speed / 60 + 1e-9, `no máximo a velocidade de cruzeiro (${moved})`);
      // na curva o giro é arco/raio; a corda andada é um tiquinho menor que o arco (folga de 0,1 %)
      assert.ok(turn(loco.rotation.y, prev.yaw) <= (moved / minRadius) * 1.001 + 1e-9, 'só gira andando pela curva: nunca parado');
    }
    prev = { x: loco.position.x, z: loco.position.z, yaw: loco.rotation.y };
    frames++;
    return false;
  };
  frontCloud(h, 0.3);
  h.step();
  assert.equal(info(h).stage, 'sneezing');
  check();
  h.run(1, { until: () => { check(); return info(h).stage !== 'sneezing'; } });
  assert.equal(info(h).stage, 'movingLoop');
  assert.ok(info(h).distance > 0, 'o atchim já deu o tranco de ré antes do fim do espirro');
  assert.ok(h.run(20, { until: () => { check(); return info(h).stage === 'waiting'; } }), 'a volta termina');
  assert.ok(stages.has('returning'), 'a chegada pela curva do sul conta como voltando');
  assert.ok(frames > 200, `quadros conferidos: ${frames}`);
  near(loco.rotation.y, L.TRAIN.start.yaw, 'chega olhando para a janela, sem girar no lugar', 1e-9);
  assert.equal(h.log('expresso:atchim').length, 1, 'um atchim por viagem');
  assert.ok(h.log('expresso:chuff').length >= 10, 'a chaminé solta vapor no ritmo do trem');
  assert.equal(h.log('expresso:return').length, 1);
});

test('fase 6: entrega real — o vagão para no para-choque, a caçamba bascula, o planeta rola até a bandeja e o trem volta sozinho', async (t) => {
  const h = await campaign(t, 'dog=rhaenyra');
  jumpTo(h, 'delivery');
  holdBarrier(h);
  const bed = h.engine.scene.getObjectByName('cacamba');
  const ball = h.props.ball.object;
  frontCloud(h, 0.3);
  h.step();
  assert.ok(h.run(20, { until: () => info(h).unloading }), 'chegou ao fim da estrela');
  const end = TRACK.consist('delivery', TRACK.routes.delivery.length);
  near(h.props.train.object.position.z, end.z, 'locomotiva parou no fim do trilho', 1e-9);
  assert.equal(h.log('expresso:unload').length, 1);
  const slotX = L.TRAY.x - 0.1; // o planeta assenta no lado oeste da bandeja (a lua cabe no outro)
  let maxTip = 0;
  let lastZ = ball.position.z;
  let minY = Infinity;
  assert.ok(h.run(3, {
    until: () => {
      maxTip = Math.max(maxTip, Math.abs(bed.rotation.x));
      assert.ok(ball.position.z >= lastZ - 1e-9, 'o planeta só anda em direção à bandeja');
      assert.ok(ball.position.x >= slotX - 1e-9 && ball.position.x <= L.CHUTE.x + 1e-9, 'o planeta desce pelo meio da canaleta');
      lastZ = ball.position.z;
      minY = Math.min(minY, ball.position.y);
      return info(h).stage === 'ready';
    },
  }), 'descarga termina');
  assert.ok(maxTip > 0.4, `a caçamba basculou (${maxTip.toFixed(2)} rad)`);
  near(bed.rotation.x, 0, 'a caçamba volta ao lugar', 1e-9);
  assert.ok(minY >= L.TRAY.y - 1e-9, 'o planeta nunca afunda abaixo do fundo da bandeja');
  near(ball.position.x, slotX, 'bandeja X');
  near(ball.position.y, L.TRAY.y, 'bandeja Y');
  near(ball.position.z, L.TRAY.z, 'bandeja Z');
  assert.ok(Math.abs(ball.rotation.x) > 1, 'o planeta rolou (girou pela distância) em vez de deslizar');
  assert.equal(h.log('expresso:delivery').length, 1);
  // depois de uma pausa, o trem volta de frente para a estação, sem a carga
  waitFor(h, (i) => i.mode === 'home', 'o trem parte de volta', 3);
  assert.equal(info(h).stage, 'ready', 'a etapa continua sendo a do planeta na bandeja');
  waitFor(h, (i) => i.mode === 'idle', 'chegou à estação', 12);
  near(h.props.train.object.position.x, L.TRAIN.start.x, 'na estação X', 1e-9);
  near(h.props.train.object.position.z, L.TRAIN.start.z, 'na estação Z', 1e-9);
  near(h.props.train.object.rotation.y, L.TRAIN.start.yaw, 'olhando para a janela', 1e-9);
  assert.equal(h.log('expresso:return').length, 1);
});

test('fase 6: cancela — fechada segura o trem antes do braço; segura na placa, deixa passar e não desce em cima dele', async (t) => {
  const h = await campaign(t, 'dog=rhaenyra');
  jumpTo(h, 'delivery');
  frontCloud(h, 0.3);
  h.step();
  waitFor(h, (i) => i.stage === 'blocked', 'a cancela fechada segura o trem');
  near(info(h).distance, BARRIER_STOP, 'parou no ponto da cancela', 1e-9);
  const wagon = h.engine.scene.getObjectByName('vagao');
  assert.ok(wagon.position.z + L.TRAIN_BODY.wagon.back < L.BARRIER.z - 0.03, 'o vagão parou antes do braço');
  assert.equal(info(h).barrier.open, 0);
  waitFor(h, (i) => i.mode === 'idle', 'voltou de frente para a estação', 12);
  assert.equal(info(h).place.planet, 'wagon');
  assert.equal(info(h).trips, 1);
  // a Rhaenyra fica na placa: a cancela sobe e o trem passa
  holdBarrier(h);
  assert.equal(info(h).barrier.plate, true);
  frontCloud(h, 0.3);
  h.step();
  waitFor(h, (i) => i.distance > BARRIER_STOP + 0.3, 'o trem passou do ponto da cancela', 12);
  // ela sai da placa com o trem já do outro lado: o braço espera o trem voltar
  place(h, 'rhaenyra', { x: 3.6, z: 2.2 });
  h.run(0.6);
  assert.equal(info(h).barrier.plate, false);
  assert.equal(info(h).barrier.open, 1, 'a cancela continua em pé com o trem do outro lado');
  waitFor(h, (i) => i.mode === 'idle' && i.stage === 'ready', 'entregou e voltou', 20);
  h.run(1);
  assert.equal(info(h).barrier.open, 0, 'com o trem de volta e a placa solta, a cancela desce');
  assert.equal(h.log('expresso:blocked').length, 1, 'só a primeira viagem foi barrada');
});

test('fase 6: pórtico — o trem busca a lua: a portinhola abre, a lua cai na frente do vagão, o planeta abre espaço e os dois voltam', async (t) => {
  const h = await campaign(t, 'dog=rhaenyra');
  jumpPedal(h);
  assert.equal(info(h).route, 'moon', 'um pulo: a lua');
  const moon = h.props.moon.object;
  const ball = h.props.ball.object;
  const wagon = h.engine.scene.getObjectByName('vagao');
  frontCloud(h, 0.3);
  h.step();
  assert.equal(info(h).stage, 'sneezing', 'buscar a lua é uma viagem de verdade');
  assert.equal(info(h).objective, h.puzzle.TEXT.objective.fetching);
  waitFor(h, (i) => i.stage === 'movingMoon', 'parte pela rota da lua');
  assert.ok(h.run(10, { until: () => info(h).loading }), 'chegou embaixo do pórtico');
  const end = TRACK.consist('moon', TRACK.routes.moon.length);
  near(h.props.train.object.position.z, end.z, 'parou no fim da rota da lua', 1e-9);
  assert.equal(h.log('expresso:fetch').length, 1);
  assert.equal(info(h).place.moon, 'loading');
  // a lua cai do pórtico só para baixo (deriva mínima) e o planeta rola para trás
  let lastY = moon.position.y;
  let maxPlanetShift = 0;
  assert.ok(h.run(L.MOON_GANTRY.loadTime + 0.2, {
    until: () => {
      assert.ok(moon.position.y <= lastY + 0.04, 'a lua só sobe no quiquinho dentro do vagão');
      lastY = moon.position.y;
      assert.ok(Math.hypot(moon.position.x - L.MOON.x, moon.position.z - L.MOON.z) <= 0.1, 'cai embaixo da cestinha');
      maxPlanetShift = Math.max(maxPlanetShift, Math.hypot(ball.position.x - wagon.position.x, ball.position.z - wagon.position.z));
      return info(h).mode !== 'loading';
    },
  }), 'a carga terminou');
  assert.equal(h.log('expresso:loaded').length, 1);
  assert.deepEqual(info(h).cargo, ['planet', 'moon'], 'as duas no vagão');
  near(maxPlanetShift, L.TRAIN.slot, 'o planeta foi para o lugar de trás', 1e-6);
  near(moon.position.x, L.MOON.x, 'a lua ficou embaixo de onde estava (X)');
  near(moon.position.y, L.TRAIN.cargoY, 'a lua está no vagão (Y)');
  near(moon.position.z, L.MOON.z, 'a lua ficou embaixo de onde estava (Z)');
  assert.ok(h.log('hint').some((x) => x.text === h.puzzle.TEXT.hint.loaded));
  // volta sozinho, com as duas acompanhando o vagão quadro a quadro
  const check = () => {
    const c = TRACK.consist(info(h).tripRoute || 'loop', info(h).distance);
    const a = { x: -Math.sin(c.wagon.yaw), z: -Math.cos(c.wagon.yaw) };
    near(moon.position.x, c.wagon.x + a.x * L.TRAIN.slot, 'lua na frente do vagão (X)', 1e-9);
    near(moon.position.z, c.wagon.z + a.z * L.TRAIN.slot, 'lua na frente do vagão (Z)', 1e-9);
    near(ball.position.x, c.wagon.x - a.x * L.TRAIN.slot, 'planeta atrás (X)', 1e-9);
    near(ball.position.z, c.wagon.z - a.z * L.TRAIN.slot, 'planeta atrás (Z)', 1e-9);
    return info(h).mode === 'idle';
  };
  assert.ok(h.run(12, { until: check }), 'voltou para a estação');
  assert.equal(info(h).stage, 'moonLoaded');
  assert.equal(info(h).place.moon, 'wagon');
  // com as duas a bordo, o objetivo leva à estrela (um pulo depois da lua)
  assert.equal(info(h).objective, h.puzzle.TEXT.objective.pedal);
  // de novo na lua: o pórtico está vazio, a viagem não muda nada e o trem volta
  h.game.debug.setStage('ready', 'radhija');
  jumpPedal(h);
  assert.equal(info(h).route, 'moon');
  h.clearLog();
  frontCloud(h, 0.3);
  h.step();
  waitFor(h, (i) => i.mode === 'parked', 'chegou ao pórtico vazio', 8);
  assert.ok(h.log('hint').some((x) => x.text === h.puzzle.TEXT.hint.gantryEmpty));
  assert.equal(h.log('expresso:fetch').length, 0);
  assert.equal(info(h).stage, 'ready', 'viagem vazia não muda a etapa');
  waitFor(h, (i) => i.mode === 'idle', 'voltou', 8);
  assert.deepEqual(info(h).place, { planet: 'tray', moon: 'tray' });
});

test('fase 6: as duas pela estrela — a da frente desce primeiro, cada uma no seu lado da bandeja; uma em cada boca, decolam', async (t) => {
  const h = await campaign(t);
  h.game.debug.setStage('moonLoaded', 'radhija');
  const moon = h.props.moon.object;
  const ball = h.props.ball.object;
  assert.equal(info(h).route, 'moon');
  jumpTo(h, 'delivery');
  holdBarrier(h);
  frontCloud(h, 0.3);
  h.step();
  assert.ok(h.run(20, { until: () => info(h).unloading }), 'chegou ao fim da estrela');
  const startZ = { moon: moon.position.z, ball: ball.position.z };
  let moonFirst = null;
  assert.ok(h.run(3, {
    until: () => {
      // a lua (na frente) chega à canaleta antes do planeta
      if (moonFirst === null && (moon.position.z > L.CHUTE.z0 || ball.position.z > L.CHUTE.z0)) moonFirst = moon.position.z > L.CHUTE.z0;
      return info(h).stage === 'ready';
    },
  }), 'descarga das duas termina');
  assert.ok(startZ.moon > startZ.ball, 'a lua estava na frente (para a canaleta)');
  assert.equal(moonFirst, true, 'a da frente desce primeiro');
  near(ball.position.x, L.TRAY.x - 0.1, 'planeta no lado oeste da bandeja');
  near(moon.position.x, L.TRAY.x + 0.1, 'lua no lado leste da bandeja');
  for (const o of [ball, moon]) { near(o.position.y, L.TRAY.y, 'na bandeja Y'); near(o.position.z, L.TRAY.z, 'na bandeja Z'); }
  assert.deepEqual(h.log('expresso:delivery').map((e) => e.cargo), ['moon', 'planet']);
  assert.ok(h.log('hint').some((x) => x.text === h.puzzle.TEXT.hint.readyBoth));
  waitFor(h, (i) => i.mode === 'idle', 'o trem voltou vazio', 12);
  // cada irmã leva uma na boca: a Radhija pega o planeta, a Rhaenyra sai da placa e pega a lua
  select(h, 'radhija');
  place(h, 'radhija', { x: L.TRAY.x - 0.1, z: L.TRAY.z + 0.55, yaw: Math.PI });
  h.clearLog();
  h.tap('KeyE');
  assert.equal(info(h).ball.holder, 'radhija');
  assert.ok(h.log('hint').some((x) => x.text === h.puzzle.TEXT.hint.secondMouth), 'sugere a outra boca');
  h.tap('KeyQ');
  assert.equal(h.game.activeDog, 'rhaenyra');
  place(h, 'rhaenyra', { x: L.TRAY.x + 0.1, z: L.TRAY.z + 0.55, yaw: Math.PI });
  h.tap('KeyE');
  assert.equal(info(h).moon.holder, 'rhaenyra');
  assert.equal(info(h).ball.holder, 'radhija');
  // a Rhaenyra leva a lua até o tapete e a Radhija, seguindo com o planeta, chega junto
  h.walkPath([[L.TRAY.x + 0.1, 2.5], [L.GOAL.x, 2.5], [L.GOAL.x, L.GOAL.z]]);
  waitFor(h, (i) => i.state === 'celebrating' || i.state === 'victory', 'as duas cargas no foguete terminam a fase', 6);
  assert.equal(moon.parent, h.props.goal.socket('moon'));
  assert.equal(ball.parent, h.props.goal.socket('planet'));
  assert.equal(h.log('expresso:launch').length, 1);
  const rocket = h.engine.scene.getObjectByName('foguete');
  h.run(2.5);
  assert.ok(rocket.position.y > 0.5, `o foguete decolou (${rocket.position.y.toFixed(2)} m)`);
  const p = new THREE.Vector3();
  moon.getWorldPosition(p);
  assert.ok(p.y > 0.7, 'a lua subiu junto no berço');
});

test('fase 6: partida longa andando, com a companheira junto — lua no pórtico, cancela, estrela e as duas cargas juntas', async (t) => {
  const h = await campaign(t);
  const inside = [];
  const count = {};
  const offs = ['dog:bafo', 'expresso:dock', 'expresso:launch', 'expresso:blocked', 'expresso:loaded', 'item:pickup', 'victory']
    .map((name) => h.events.on(name, () => { count[name] = (count[name] || 0) + 1; }));
  t.after(() => { for (const off of offs) off(); });
  // a cada quadro: nenhuma das duas fica dentro de móvel, maquete, canaleta ou foguete
  const watch = () => {
    for (const name of ['radhija', 'rhaenyra']) {
      const c = h.ctrls[name];
      if (h.world.overlaps(c.x, c.z, c.r * 0.97, c.size)) inside.push(`${name} em (${c.x.toFixed(2)}, ${c.z.toFixed(2)})`);
    }
    return false;
  };
  const walk = (points, tol = 0.12) => h.walkPath(points, { tol, until: watch });
  // chega à janela vindo do sul, para terminar olhando para o nariz
  const blowNorth = () => {
    walk([[L.BLOW_SPOT.x, 2.25], [L.BLOW_SPOT.x, L.BLOW_SPOT.z]]);
    h.keyDown('KeyR');
    h.run(0.25, { until: watch });
    h.keyUp('KeyR');
    h.step();
    waitFor(h, (i) => i.mode !== 'idle', 'o superbafo fez o trem espirrar', 2);
  };
  const jumpHere = () => {
    h.tap('Space');
    h.run(1.2, { until: watch });
  };
  // 1. a Rhaenyra anda até o pedal e pula: a agulha aponta para a lua
  h.tap('KeyQ');
  assert.equal(h.game.activeDog, 'rhaenyra');
  h.walkTo(L.PEDAL.x, L.PEDAL.z, { tol: 0.15, until: watch });
  jumpHere();
  assert.equal(info(h).route, 'moon', 'o pulo de verdade virou a agulha');
  // 2. a Radhija sopra pela janela: o trem busca a lua no pórtico e volta com as duas
  h.tap('KeyQ');
  assert.equal(h.game.activeDog, 'radhija');
  walk([[-3.0, 1.75]]);
  blowNorth();
  assert.ok(h.run(20, { until: () => { watch(); return info(h).stage === 'moonLoaded' && info(h).mode === 'idle'; } }), 'o trem trouxe a lua');
  // 3. a Rhaenyra pula de novo (estrela) e vai para a placa da cancela; a Radhija manda ela ficar (F)
  h.tap('KeyQ');
  assert.equal(h.game.activeDog, 'rhaenyra');
  walk([[-3.0, 1.75], [L.PEDAL.x, L.PEDAL.z]], 0.15);
  jumpHere();
  assert.equal(info(h).route, 'delivery', 'da lua, um pulo leva à estrela');
  walk([[-3.0, 1.75], [L.BARRIER_PLATE.x, 1.75], [L.BARRIER_PLATE.x, L.BARRIER_PLATE.z]], 0.1);
  h.tap('KeyQ');
  h.tap('KeyF');
  assert.equal(h.game.activeDog, 'radhija');
  h.run(0.8, { until: watch });
  assert.equal(info(h).barrier.plate, true, 'a Rhaenyra ficou na placa');
  assert.equal(info(h).barrier.open, 1, 'a cancela subiu');
  // 4. a Radhija (que seguiu a irmã até a placa) desce pelo leste e sopra de novo: as duas cargas vão à bandeja
  walk([[L.BARRIER_PLATE.x, 1.75]]);
  blowNorth();
  assert.ok(h.run(20, { until: () => { watch(); return info(h).stage === 'ready'; } }), 'o trem levou as duas à bandeja');
  // 5. a Radhija pega o planeta (chegando pelo sul, diante dele)
  walk([[L.TRAY.x - 0.1, 2.1], [L.TRAY.x - 0.1, L.TRAY.z + 0.55]]);
  h.tap('KeyE');
  assert.equal(info(h).ball.holder, 'radhija', 'pegou o planeta');
  // 6. a Rhaenyra sai da placa, pega a lua com a boca vazia e as duas levam juntas ao foguete
  h.tap('KeyQ');
  assert.equal(h.game.activeDog, 'rhaenyra');
  walk([[L.BARRIER_PLATE.x, 1.75], [L.TRAY.x + 0.35, 2.1], [L.TRAY.x + 0.1, L.TRAY.z + 0.55]]);
  h.tap('KeyE');
  assert.equal(info(h).moon.holder, 'rhaenyra', 'a Rhaenyra pegou a lua');
  assert.equal(info(h).ball.holder, 'radhija', 'e a Radhija continua com o planeta');
  walk([[L.TRAY.x + 0.1, 2.5], [L.GOAL.x, 2.5], [L.GOAL.x, L.GOAL.z]]);
  waitFor(h, (i) => i.state === 'victory', 'as duas cargas no foguete terminam a fase', 12);
  assert.deepEqual(inside, [], 'ninguém atravessou móveis nem a maquete');
  assert.equal(count['dog:bafo'], 2, 'dois superbafos');
  assert.equal(count['expresso:loaded'], 1, 'a lua caiu uma vez no vagão');
  assert.equal(count['expresso:dock'], 2, 'as duas cargas encaixaram');
  assert.equal(count['expresso:launch'], 1, 'o foguete decolou uma vez');
  assert.equal(count['expresso:blocked'] || 0, 0, 'com a Rhaenyra na placa, a cancela nunca barrou');
  assert.equal(count['item:pickup'], 2, 'planeta e lua, uma em cada boca');
  assert.equal(count.victory, 1);
  const vic = h.log('victory');
  assert.equal(vic[0].levelId, 'fase6');
  assert.equal(vic[0].hasNext, true, 'a vitória oferece a fase 7');
  assert.equal(info(h).trips, 2);
  assert.equal(info(h).routeChanges, 2);
});
