// Protótipo Expresso: núcleo, controladores, cheiro, colisão, puzzle e props reais.
// Apenas navegador/canvas, renderer e modelos das dogs são dublês; não há GPU.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fase6 from '../src/levels/fase6/index.js';
import modelo from '../src/levels/_modelo/index.js';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';
import { PAD } from '../src/game/input.js';
import { createHeadlessGame } from './helpers/headless.mjs';

const L = fase6.layout;
const STATES = ['waiting', 'sneezing', 'movingLoop', 'movingDelivery', 'returning', 'ready', 'carrying', 'done'];
function info(h) {
  const current = h.info();
  // state continua sendo o estado do jogo; stage é a etapa local do puzzle.
  return { ...current, ...current.expresso, state: current.state };
}
const near = (actual, expected, message, epsilon = 1e-7) => {
  assert.ok(Math.abs(actual - expected) < epsilon, `${message}: ${actual} ≠ ${expected}`);
};

async function prototype(t, query = '') {
  const module = await fase6.load();
  const h = await createHeadlessGame({
    levels: [fase6, modelo], query,
    configure({ levels, engine }) {
      // A fábrica real recebe o mesmo root e escopo de recursos do jogo.
      // O segundo cenário serve para exercitar o descarte de uma fase inteira.
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
    clouds: h.game.debug.scent.clouds.map((c) => ({ id: c.id, x: c.x, z: c.z, age: c.age })),
    jump: [h.ctrls.rhaenyra.jumpT, h.ctrls.rhaenyra.y],
  };
}

test('fase 6: protótipo fica no catálogo de desenvolvimento, com props reais completos', async (t) => {
  assert.equal(LEVELS.some((def) => def.id === 'fase6'), false, 'não altera campanha/progresso');
  assert.equal(DEV_LEVELS.filter((def) => def.id === 'fase6').length, 1);
  const h = await prototype(t);
  assert.equal(info(h).levelId, 'fase6');
  assert.equal(info(h).stage, 'waiting');
  assert.equal(info(h).route, 'loop');
  assert.equal(info(h).trips, 0);
  assert.equal(h.game.debug.scent.noses.filter((n) => n.id === L.NOSE.id).length, 1);
  for (const key of ['pedal', 'junction', 'train', 'nose', 'ball', 'goal']) {
    assert.ok(h.props[key].object instanceof THREE.Object3D, `${key} é objeto Three real`);
  }
  assert.ok(h.props.ball.home instanceof THREE.Vector3);
  assert.equal(h.props.ball.object.parent, h.engine.scene.getObjectByName('fase:fase6'), 'bola tem parent estável na raiz');
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
  const h = await prototype(t, 'dog=rhaenyra');
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

test('fase 6: pouso real aciona uma vez; outro pulo alterna e pouso fora não aciona', async (t) => {
  const h = await prototype(t, 'dog=rhaenyra');
  jumpPedal(h);
  assert.equal(info(h).route, 'delivery');
  assert.equal(info(h).routeChanges, 1);
  assert.equal(h.log('dog:land').length, 1);
  assert.equal(h.ctrls.rhaenyra.landed, false, 'núcleo consumiu landed depois do puzzle');
  h.run(2);
  assert.equal(info(h).routeChanges, 1, 'ficar sobre o pedal não repete o impacto');
  jumpPedal(h);
  assert.equal(info(h).route, 'loop');
  assert.equal(info(h).routeChanges, 2);
  place(h, 'rhaenyra', { x: L.PEDAL.x, z: L.PEDAL.z + L.PEDAL.r + 0.5 });
  h.tap('Space');
  h.run(0.8);
  assert.equal(h.log('dog:land').length, 3, 'houve um terceiro pouso real');
  assert.equal(info(h).routeChanges, 2, 'pouso fora do pedal não vale');
});

test('fase 6: trocar de personagem no ar preserva um único pouso no pedal', async (t) => {
  const h = await prototype(t, 'dog=rhaenyra');
  select(h, 'rhaenyra');
  place(h, 'rhaenyra', L.PEDAL);
  h.tap('Space');
  h.tap('KeyQ');
  h.game.setStay('rhaenyra', true);
  assert.equal(h.game.activeDog, 'radhija');
  h.run(1);
  assert.equal(h.log('dog:land').length, 1);
  assert.equal(info(h).routeChanges, 1);
  assert.equal(info(h).route, 'delivery');
  assert.equal(h.ctrls.rhaenyra.y, 0);
});

test('fase 6: aproximar, latir e interagir no nariz não substitui bafo', async (t) => {
  const h = await prototype(t);
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

test('fase 6: bafo real percorre loop recuperável; pulo e segundo bafo entregam a bola uma vez', async (t) => {
  const h = await prototype(t);
  blow(h);
  waitFor(h, (i) => i.stage === 'movingLoop', 'primeiro bafo inicia a rota circular');
  assert.equal(info(h).tripRoute, 'loop');
  waitFor(h, (i) => i.stage === 'waiting' && i.armed, 'loop retorna e rearma');
  assert.equal(info(h).trips, 1);
  assert.equal(h.puzzle.carrier, null);
  near(h.props.ball.object.position.x, L.BALL.x, 'bola voltou ao vagão X');
  near(h.props.ball.object.position.z, L.BALL.z, 'bola voltou ao vagão Z');
  jumpPedal(h);
  assert.equal(info(h).route, 'delivery');
  blow(h);
  waitFor(h, (i) => i.stage === 'movingDelivery', 'segundo bafo usa a seleção do pulo');
  assert.equal(info(h).tripRoute, 'delivery');
  waitFor(h, (i) => i.stage === 'ready', 'bola descarregada na bandeja');
  assert.equal(info(h).trips, 2);
  near(h.props.ball.object.position.x, L.TRAY.x, 'bandeja X');
  near(h.props.ball.object.position.y, L.TRAY.y, 'bandeja Y');
  near(h.props.ball.object.position.z, L.TRAY.z, 'bandeja Z');
  h.walkTo(L.TRAY.x, L.TRAY.z, { tol: 0.15 });
  h.tap('KeyE');
  assert.equal(h.puzzle.carrier, 'radhija');
  assert.equal(h.props.ball.object.parent, h.dogs.radhija.mouthSocket);
  assert.deepEqual(h.props.ball.object.position.toArray(), [0, 0, 0]);
  h.tap('KeyE');
  h.tap('KeyQ');
  assert.equal(h.puzzle.carrier, 'radhija', 'troca de dog não transfere/duplica a bolinha');
  assert.equal(h.log('item:pickup').length, 1);
  select(h, 'radhija');
  h.walkPath([[L.TRAY.x, 2.5], [L.GOAL.x, 2.5], [L.GOAL.x, L.GOAL.z]]);
  waitFor(h, (i) => i.state === 'victory', 'entrega termina a missão', 8);
  h.run(2);
  assert.equal(h.log('victory').length, 1);
  assert.equal(info(h).trips, 2);
});

test('fase 6: rota fica travada no espirro/viagem, sem pulo enfileirado nem nova viagem', async (t) => {
  const h = await prototype(t);
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
  const h = await prototype(t);
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
  const h = await prototype(t);
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
  for (const shot of shots) {
    h.puzzle.reset();
    assert.equal(h.world.overlaps(shot.x, shot.z, radius, 'small'), false, 'origem possível da dog');
    // A mesma distância boca→centro e velocidade do jogo, incluindo a cabeça
    // que pode ultrapassar visualmente a borda. O cheiro colide de verdade.
    scent.spawn({ x: shot.x + shot.dx * 0.36, z: shot.z + shot.dz * 0.36,
      dirX: shot.dx, dirZ: shot.dz, speed: L.DOGS.radhija.bafoSpeed, life: 5 });
    for (let frame = 0; frame < 310; frame++) scent.update(1 / 60);
    assert.equal(info(h).trips, 0, `contorno rejeita bafo em (${shot.x}, ${shot.z})`);
  }
  for (const offset of [-0.43, 0, 0.43]) {
    h.puzzle.reset();
    scent.spawn({ x: L.NOSE.x + offset, z: L.NOSE.frontZ + 0.2, speed: 0, life: 2 });
    for (let frame = 0; frame < 30; frame++) scent.update(1 / 60);
    assert.equal(info(h).trips, 1, `janela permite sopro frontal com deslocamento ${offset}`);
  }
});

test('fase 6: rearme captura TODAS as nuvens, inclusive longe; expiração poda IDs e reset limpa', async (t) => {
  const h = await prototype(t);
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
  const h = await prototype(t);
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

test('fase 6: retirada só em ready, inclusive quando a cabeça alcança a pose da bola', async (t) => {
  const h = await prototype(t);
  for (const state of STATES.filter((s) => !['ready', 'carrying', 'done'].includes(s))) {
    assert.equal(h.game.debug.setStage(state, 'radhija'), true, state);
    // Chama a interação real exatamente sobre a bola para provar a trava lógica,
    // independentemente da proteção geométrica que é testada separadamente.
    const c = { ...h.ctrls.radhija, x: h.props.ball.object.position.x, z: h.props.ball.object.position.z };
    h.puzzle.interact(c);
    assert.equal(h.puzzle.carrier, null, `retirada bloqueada em ${state}`);
  }
  h.game.debug.setStage('movingDelivery', 'radhija');
  waitFor(h, (i) => i.unloading, 'trem chegou, mas a descarga ainda não terminou');
  place(h, 'radhija', L.TRAY);
  h.tap('KeyE');
  assert.equal(h.puzzle.carrier, null, 'bola na canaleta ainda não pode ser retirada');
  for (const name of ['radhija', 'rhaenyra']) {
    assert.equal(h.game.debug.setStage('ready', name), true);
    place(h, name, L.TRAY);
    h.tap('KeyE');
    assert.equal(h.puzzle.carrier, name, `qualquer irmã pode retirar: ${name}`);
    const ball = h.props.ball.object;
    assert.equal(ball.parent, h.dogs[name].mouthSocket);
    h.tap('KeyE');
    frontCloud(h);
    h.run(0.5);
    assert.equal(ball.parent, h.dogs[name].mouthSocket, 'trem não move a bola depois da retirada');
    assert.deepEqual(ball.position.toArray(), [0, 0, 0]);
    assert.equal(h.puzzle.stage, 'carrying');
  }
  const before = info(h).routeChanges;
  jumpPedal(h);
  assert.equal(info(h).routeChanges, before, 'salto depois da retirada não reinicia o mecanismo');
  assert.equal(h.puzzle.carrier, 'rhaenyra');
});

test('fase 6: pausa congela salto, espirro, trajetos, rearme e animação da descarga', async (t) => {
  const h = await prototype(t, 'dog=rhaenyra');
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

test('fase 6: reinício de cada estado devolve parent/pose, trem, rota, nuvens e petiscos', async (t) => {
  const h = await prototype(t);
  const ball = h.props.ball.object;
  const home = { parent: ball.parent, pos: ball.position.clone(), quat: ball.quaternion.clone() };
  const trainHome = h.props.train.object.position.clone();
  for (const state of STATES) {
    assert.equal(h.game.debug.setStage(state, 'radhija'), true, state);
    if (state === 'carrying') assert.equal(ball.parent, h.dogs.radhija.mouthSocket);
    h.game.debug.scent.spawn({ x: 4, z: 3, speed: 0, life: 60 });
    h.props.collectibles[0].collect();
    h.game.built.update?.(1, 1);
    h.events.emit('ui:restart', {});
    assert.equal(h.game.state, 'playing');
    assert.equal(h.puzzle.stage, 'waiting', state);
    assert.equal(h.puzzle.carrier, null);
    assert.equal(ball.parent, home.parent, `parent restaurado: ${state}`);
    assert.ok(ball.position.equals(home.pos), `posição restaurada: ${state}`);
    assert.ok(ball.quaternion.equals(home.quat), `rotação restaurada: ${state}`);
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
  const h = await prototype(t);
  for (const state of STATES) {
    assert.equal(h.game.debug.setStage(state, 'radhija'), true, state);
    const scent = h.game.debug.scent;
    const oldPuzzle = h.puzzle;
    const oldBall = h.props.ball.object;
    const oldRoot = h.engine.scene.getObjectByName('fase:fase6');
    const wasCarried = oldBall.parent === h.dogs.radhija.mouthSocket;
    const geometries = new Set();
    oldRoot.traverse((object) => { if (object.isMesh) geometries.add(object.geometry); });
    const observers = [...geometries].map((geometry) => {
      const entry = { geometry, count: 0, onDispose: () => { entry.count++; } };
      geometry.addEventListener('dispose', entry.onDispose);
      return entry;
    });
    assert.equal(await h.game.loadLevel(1, { mode: 'play', initial: true }), true);
    for (const entry of observers) entry.geometry.removeEventListener('dispose', entry.onDispose);
    assert.equal(oldRoot.parent, null, `root descartado: ${state}`);
    assert.ok(observers.some((entry) => entry.count === 1), `recurso local descartado: ${state}`);
    assert.ok(observers.every((entry) => entry.count <= 1), 'recursos compartilhados ficam; locais saem no máximo uma vez');
    assert.equal(scent.noses.length, 0);
    assert.equal(scent.clouds.length, 0);
    assert.equal(oldPuzzle.carrier, null);
    assert.notEqual(oldBall.parent, h.dogs.radhija.mouthSocket);
    assert.notEqual(oldBall.parent, h.dogs.rhaenyra.mouthSocket);
    if (wasCarried) assert.equal(h.dogs.radhija.carryKind, null);
    const oldState = oldPuzzle.info();
    scent.spawn({ x: L.NOSE.x, z: L.NOSE.frontZ + 0.2, speed: 0 });
    scent.update(1);
    h.run(0.1);
    assert.deepEqual(oldPuzzle.info(), oldState, 'campo descartado não chama o puzzle antigo');
    assert.equal(info(h).levelId, 'modelo');
    assert.equal(await h.game.loadLevel(0, { mode: 'play', initial: true }), true);
    assert.equal(h.game.debug.scent.noses.filter((n) => n.id === L.NOSE.id).length, 1);
  }
});

test('fase 6: passeio, estações e petiscos são alcançáveis por ambas, ferrovia bloqueia inclusive saltos', async (t) => {
  const h = await prototype(t);
  const stations = [L.PEDAL, L.BLOW_SPOT, L.TRAY, L.GOAL, ...L.COLLECTIBLES];
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
      const x = yard.x + dx * (yard.hx + c.r + 0.3);
      const z = yard.z + dz * (yard.hz + c.r + 0.3);
      for (const airborne of [false, true]) {
        const moved = h.world.move(x, z, -dx * 0.9, -dz * 0.9, c.r, c.size, { airborne });
        assert.ok(Math.abs(moved.x - yard.x) >= yard.hx || Math.abs(moved.z - yard.z) >= yard.hz, `${name}: ferrovia bloqueia ${airborne ? 'no ar' : 'no chão'}`);
        assert.ok(moved.hits.some((hit) => hit.id === 'ferrovia'));
      }
    }
  }
});
