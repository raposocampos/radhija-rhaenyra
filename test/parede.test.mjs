// Impulso na parede da Rhaenyra: escolha da parede marcada (pickWallSpot), roteiro do controlador (chega à parede,
// toca o alto uma vez, volta ao chão sem atravessar nada), botão/alavanca (createWallButton), a pose real do modelo
// (as patas encostam onde o desenho pinta as patinhas e no botão) e a parede de treino da Arena do Pulo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCollisionWorld } from '../src/game/collision.js';
import {
  createController, placeController, steer, integrate, pickWallSpot, startWallJump, wallKick, wallLift, canJump, WALL_TOUCH,
} from '../src/game/dogController.js';
import { createWallButton, WALL_BUTTON_SHAPE } from '../src/game/mechanics/wallButton.js';
import { createPressurePlate } from '../src/game/mechanics/pressurePlate.js';
import { DOG_CONFIG, withStart } from '../src/dogs/config.js';
import { PAD } from '../src/game/input.js';
import { LEVELS } from '../src/levels/index.js';
import pulo from '../src/levels/_pulo/index.js';
import { createHeadlessGame, installBrowserStubs } from './helpers/headless.mjs';

const levels = [...LEVELS, pulo];
const arena = (query = 'dog=rhaenyra') => createHeadlessGame({ level: levels.length, levels, query });
const L = pulo.layout;
const BTN = L.WALL_BUTTON;
const LEV = L.WALL_LEVER;
const CUB = L.CUBBY;
const D = DOG_CONFIG.rhaenyra.wallJumpTime;
/** @type {import('../src/types').WallSpot} */
const SPOT = { id: 'teste', x: 0, z: -2, nx: 0, nz: 1, top: 1.2 };

const rhaenyra = (x, z, yaw) => createController('rhaenyra', withStart('rhaenyra', { x, z, yaw }));

test('impulso: só vale de frente para a parede marcada, do lado de cá e perto', () => {
  const c = rhaenyra(0, -1.5, Math.PI); // olhando para o norte (−Z), para a parede
  assert.equal(pickWallSpot(c, [SPOT]), SPOT, 'de frente e perto');
  c.yaw = 0;
  assert.equal(pickWallSpot(c, [SPOT]), null, 'de costas, parada');
  assert.equal(pickWallSpot(c, [SPOT], 0, -1), SPOT, 'de costas, mas o analógico aponta para a parede');
  assert.equal(pickWallSpot(c, [SPOT], 1, 0), null, 'analógico de lado');
  c.yaw = Math.PI;
  const K = wallKick(SPOT, c.r);
  c.z = K.z + DOG_CONFIG.rhaenyra.wallReach - 0.02;
  assert.equal(pickWallSpot(c, [SPOT]), SPOT, 'no limite do alcance');
  c.z = K.z + DOG_CONFIG.rhaenyra.wallReach + 0.05;
  assert.equal(pickWallSpot(c, [SPOT]), null, 'longe demais');
  const behind = rhaenyra(0, -2.6, 0); // atrás da parede, olhando para ela
  assert.equal(pickWallSpot(behind, [SPOT]), null, 'do outro lado da parede');
  const radhija = createController('radhija', withStart('radhija', { x: 0, z: -1.5, yaw: Math.PI }));
  assert.equal(pickWallSpot(radhija, [SPOT]), null, 'a Radhija não pega impulso');
  const other = { ...SPOT, id: 'outro', x: 0.9 };
  const near = rhaenyra(0.7, -1.5, Math.PI);
  assert.equal(pickWallSpot(near, [SPOT, other]), other, 'com duas ao alcance, a mais perto');
  assert.equal(pickWallSpot(near, []), null);
  assert.equal(pickWallSpot(near, undefined), null);
});

test('impulso: chega à parede, toca o alto uma vez no meio e volta ao chão afastada, sem atravessar nada', () => {
  const world = createCollisionWorld({
    WORLD: { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } },
    STATIC_COLLIDERS: [{ id: 'parede', shape: 'box', x: 0, z: -2.5, hx: 3, hz: 0.5 }], // face em z = −2
  });
  const c = rhaenyra(0.45, -1.35, Math.PI - 0.5); // de lado e um pouco longe: ela se alinha
  assert.ok(pickWallSpot(c, [SPOT]), 'ao alcance');
  startWallJump(c, SPOT);
  assert.equal(canJump(c), false, 'sem outro pulo no meio do impulso');
  const K = wallKick(SPOT, c.r);
  const dt = 1 / 60;
  let touches = 0;
  let touchAt = null;
  let landedAt = null;
  let peak = 0;
  for (let i = 1; i <= 90; i++) {
    // a entrada não muda o roteiro; depois do pouso ela fica parada (para medir onde pousou)
    steer(c, dt, c.wallDur > 0 ? { dx: 1, dz: 0, speed: 2 } : { dx: 0, dz: 0, speed: 0 });
    integrate(c, dt, world);
    peak = Math.max(peak, c.y);
    assert.ok(!world.overlaps(c.x, c.z, c.r * 0.99, c.size), `quadro ${i}: dentro da parede (${c.x.toFixed(3)}, ${c.z.toFixed(3)})`);
    if (c.wallHit) {
      touches++;
      touchAt = { t: i * dt, x: c.x, z: c.z, yaw: c.yaw };
      c.wallHit = null;
    }
    if (c.landed && landedAt == null) landedAt = i * dt;
  }
  assert.equal(touches, 1, 'um toque por impulso');
  assert.ok(Math.abs(touchAt.t - WALL_TOUCH * D) < 1.5 * dt, `toque em ${touchAt.t.toFixed(3)} s`);
  assert.ok(Math.hypot(touchAt.x - K.x, touchAt.z - K.z) < 0.02, 'no toque, encostada no ponto de impulso');
  assert.ok(Math.abs(touchAt.yaw - Math.PI) < 0.05 || Math.abs(touchAt.yaw + Math.PI) < 0.05, 'de frente para a parede');
  assert.ok(Math.abs(landedAt - D) < 1.5 * dt, `volta ao chão em ${landedAt?.toFixed(3)} s`);
  assert.ok(Math.abs(peak - wallLift(WALL_TOUCH, SPOT.top)) < 0.01, `sobe o pico (${peak.toFixed(3)})`);
  assert.equal(c.wallDur, 0);
  assert.equal(c.wall, null);
  assert.equal(c.y, 0);
  assert.ok(Math.abs(c.z - (K.z + DOG_CONFIG.rhaenyra.wallBack)) < 0.03, `afastada da parede (z=${c.z.toFixed(3)})`);
  assert.ok(Math.abs(c.x - K.x) < 0.01);
});

test('impulso: com algo no caminho não começa; se algo aparecer no caminho, não alcança o botão', () => {
  const world = createCollisionWorld({
    WORLD: { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } },
    STATIC_COLLIDERS: [{ id: 'parede', shape: 'box', x: 0, z: -2.5, hx: 3, hz: 0.5 }],
  });
  const gate = world.addDynamic({ id: 'portao', shape: 'segment', ax: -1, az: -1.55, bx: 1, bz: -1.55, t: 0.03 });
  const c = rhaenyra(0, -1.15, Math.PI); // 0,4 m do ponto de impulso, com o portão entre ela e a parede
  assert.equal(pickWallSpot(c, [SPOT]), SPOT, 'sem conferir o caminho, estaria ao alcance');
  assert.equal(pickWallSpot(c, [SPOT], 0, 0, world), null, 'com o portão fechado no caminho, nada de impulso');
  gate.enabled = false;
  assert.equal(pickWallSpot(c, [SPOT], 0, 0, world), SPOT, 'portão aberto: vale');
  // o portão fecha logo depois de começar: ela fica presa longe da parede e o toque não acontece
  startWallJump(c, SPOT);
  gate.enabled = true;
  let hit = false;
  for (let i = 0; i < 80; i++) {
    steer(c, 1 / 60, { dx: 0, dz: 0, speed: 0 });
    integrate(c, 1 / 60, world);
    if (c.wallHit) hit = true;
  }
  assert.equal(hit, false, 'não alcança o botão através do portão');
  assert.ok(c.z > -1.55, 'ficou do lado de cá do portão');
  assert.equal(c.wallDur, 0, 'o impulso terminou e ela voltou ao chão');
});

test('impulso: com algo atrás, volta ao chão onde dá, sem atravessar', () => {
  const world = createCollisionWorld({
    WORLD: { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } },
    STATIC_COLLIDERS: [
      { id: 'parede', shape: 'box', x: 0, z: -2.5, hx: 3, hz: 0.5 },
      { id: 'caixote', shape: 'box', x: 0, z: -1.25, hx: 0.6, hz: 0.12 }, // logo atrás do ponto de impulso
    ],
  });
  const c = rhaenyra(0, -1.65, Math.PI);
  startWallJump(c, SPOT);
  for (let i = 0; i < 80; i++) {
    steer(c, 1 / 60, { dx: 0, dz: 0, speed: 0 });
    integrate(c, 1 / 60, world);
    assert.ok(!world.overlaps(c.x, c.z, c.r * 0.99, c.size), `quadro ${i}`);
  }
  assert.equal(c.wallDur, 0);
});

test('placa de pressão não conta quem está no impulso na parede', () => {
  const plate = createPressurePlate({ id: 'p', x: 0, z: 0, r: 0.5, requires: 'large', emit: () => {} });
  const dog = { name: 'rhaenyra', size: 'large', x: 0, z: 0, r: 0.22, jumpT: 0, wallDur: 1 };
  assert.equal(plate.update(1 / 60, { ctrls: { rhaenyra: /** @type {any} */ (dog) } }).pressed, false);
  dog.wallDur = 0;
  assert.equal(plate.update(1 / 60, { ctrls: { rhaenyra: /** @type {any} */ (dog) } }).pressed, true);
});

test('botão e alavanca: tempo, troca, uma vez, eventos e o desenho', () => {
  const log = [];
  const emit = (name, p) => log.push([name, p]);
  const calls = [];
  const prop = { object: new THREE.Group(), setPress(t) { calls.push(['press', t]); }, setOn(on) { calls.push(['on', on]); }, setTimer(k) { calls.push(['timer', k]); } };
  const timed = createWallButton({ id: 'b', cfg: { x: 1, z: -2, nx: 0, nz: 1, top: 1.2, holdTime: 3 }, emit, prop });
  assert.equal(timed.mode, 'timed');
  assert.deepEqual(
    { out: timed.spot.out, paws: timed.spot.paws, side: timed.spot.side, lat: timed.spot.lat },
    { out: WALL_BUTTON_SHAPE.button.out, paws: 1.2 - WALL_BUTTON_SHAPE.button.paws, side: WALL_BUTTON_SHAPE.button.side, lat: WALL_BUTTON_SHAPE.button.lat },
    'o spot leva as medidas do desenho para a pose',
  );
  const K = wallKick(timed.spot, 0.22);
  assert.ok(Math.abs(K.x - (1 - WALL_BUTTON_SHAPE.button.lat)) < 1e-9, 'a dog fica à esquerda do botão (oeste, olhando para o norte)');
  timed.touch();
  assert.equal(timed.on, true);
  assert.deepEqual(log.at(-1)[0], 'wall:button');
  for (let i = 0; i < 60 * 2; i++) timed.update(1 / 60);
  assert.equal(timed.on, true, 'ainda contando');
  timed.touch(); // de novo: recomeça
  for (let i = 0; i < 60 * 2.5; i++) timed.update(1 / 60);
  assert.equal(timed.on, true, 'o segundo toque recomeçou o tempo');
  for (let i = 0; i < 60; i++) timed.update(1 / 60);
  assert.equal(timed.on, false, 'desligou sozinho');
  assert.equal(log.filter(([n]) => n === 'wall:timeout').length, 1);
  assert.ok(log.filter(([n]) => n === 'wall:tick').length >= 3, 'tique a cada segundo');
  assert.ok(calls.some(([k, v]) => k === 'timer' && v > 0 && v < 1), 'anel de luzes mostra o tempo');
  assert.deepEqual(calls.at(-1), ['timer', null], 'desligado, o anel apaga');

  const lever = createWallButton({ id: 'a', cfg: { x: 0, z: -2, nx: 0, nz: 1, top: 1.2, kind: 'lever' }, emit });
  assert.equal(lever.mode, 'toggle');
  lever.touch();
  assert.equal(lever.on, true);
  lever.touch();
  assert.equal(lever.on, false);
  const once = createWallButton({ id: 'u', cfg: { x: 0, z: -2, nx: 0, nz: 1, top: 1.2, mode: 'once' }, emit });
  once.touch();
  once.touch();
  for (let i = 0; i < 600; i++) once.update(1 / 60);
  assert.equal(once.on, true, 'uma vez: fica ligado');
  once.reset();
  assert.equal(once.on, false);
  assert.equal(once.presses, 0);
});

test('desenho do botão e da alavanca: o que a pata toca fica onde a pose espera', async () => {
  installBrowserStubs();
  const { buildWallButton } = await import('../src/world/wallButton.js');
  const button = buildWallButton({ kind: 'button', top: 1.2 });
  button.object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(button.object);
  assert.ok(Math.abs(box.max.z - WALL_BUTTON_SHAPE.button.out) < 0.008, `o botão sai ${box.max.z.toFixed(3)} m da parede`);
  assert.ok(box.min.z > 0, 'nada atrás da parede');
  const lever = buildWallButton({ kind: 'lever', top: 1.2, name: 'alavanca' });
  lever.object.updateMatrixWorld(true);
  const knob = lever.object.getObjectByName('alavanca:bolinha');
  const p = knob.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(p.y - 1.2) < 0.005 && Math.abs(p.z - WALL_BUTTON_SHAPE.lever.out) < 0.005, `bolinha em y=${p.y.toFixed(3)}, z=${p.z.toFixed(3)}`);
  lever.setOn(true);
  for (let i = 0; i < 60; i++) lever.update(1 / 60, i / 60);
  lever.object.updateMatrixWorld(true);
  assert.ok(knob.getWorldPosition(new THREE.Vector3()).y < 1.05, 'ligada, a alavanca desce');
  const marks = button.object.getObjectByName('botao-parede:patinhas');
  assert.ok(marks, 'patinhas pintadas');
  const mb = new THREE.Box3().setFromObject(marks);
  assert.ok(mb.min.y <= 0.36 - 0.06 && mb.max.y >= 1.2 - WALL_BUTTON_SHAPE.button.paws, 'das traseiras às dianteiras');
  assert.ok(mb.max.x >= WALL_BUTTON_SHAPE.button.side, 'as dianteiras ficam dos lados da placa');
});

test('pose do impulso no modelo real: patas na parede e no botão; nada atravessa a parede nem o chão', async () => {
  installBrowserStubs();
  const { createDog } = await import('../src/dogs/dog.js');
  const d = createDog('rhaenyra');
  const shape = WALL_BUTTON_SHAPE.button;
  // o mesmo caminho do jogo: controlador de verdade numa parede (face em z = −2) e a animação recebendo o que o
  // núcleo manda (game.js → applyDogs), começando 35 cm atrás do ponto de impulso
  const world = createCollisionWorld({
    WORLD: { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } },
    STATIC_COLLIDERS: [{ id: 'parede', shape: 'box', x: 0, z: -2.5, hx: 3, hz: 0.5 }],
  });
  const top = 1.2;
  /** @type {import('../src/types').WallSpot} */
  const spot = { id: 'pose', x: 0, z: -2, nx: 0, nz: 1, top, out: shape.out, paws: top - shape.paws, side: shape.side, lat: shape.lat };
  const c = rhaenyra(0, 0, Math.PI);
  const K = wallKick(spot, c.r);
  placeController(c, K.x, K.z + 0.35, Math.PI);
  const sync = () => {
    const W = c.wallDur > 0 ? c.wall : null;
    d.object.position.set(c.x, 0, c.z);
    d.object.rotation.y = c.yaw;
    d.update(1 / 60, {
      speed: c.animSpeed, action: W ? 'wallJump' : 'none',
      wallK: W ? Math.min(1, c.wallT / c.wallDur) : -1,
      wallGap: W ? (c.x - W.x) * W.nx + (c.z - W.z) * W.nz : 0,
      wallTop: W?.top ?? 0, wallOut: W?.out ?? 0, wallPaws: W?.paws ?? 0, wallSide: W?.side ?? 0, wallLat: W?.lat ?? 0,
    });
    d.object.updateMatrixWorld(true);
  };
  for (let i = 0; i < 30; i++) sync();
  startWallJump(c, spot);
  // posições em relação ao botão: x para a direita de quem olha a parede (+X), y altura, z distância da parede
  const rel = (name) => {
    const p = d.bones.find((b) => b.name === name).getWorldPosition(new THREE.Vector3());
    return new THREE.Vector3(p.x - spot.x, p.y, p.z - spot.z);
  };
  let minWall = Infinity;
  let minWallAt = '';
  let minY = Infinity;
  let maxY = 0;
  const at = {};
  const v = new THREE.Vector3();
  for (let i = 0; i < 80 && (c.wallDur > 0 || i < 2); i++) {
    steer(c, 1 / 60, { dx: 0, dz: 0, speed: 0 });
    integrate(c, 1 / 60, world);
    const k = c.wallDur > 0 ? c.wallT / c.wallDur : 1;
    sync();
    for (const b of d.bones) {
      b.getWorldPosition(v);
      if (v.z - spot.z < minWall) {
        minWall = v.z - spot.z;
        minWallAt = `${b.name} em ${(k * 100).toFixed(0)}%`;
      }
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
    }
    if (!at.touch && k >= WALL_TOUCH) at.touch = { FR: rel('FRp'), FL: rel('FLp') };
    if (!at.kick && k >= 0.45) at.kick = { HL: rel('HLp'), HR: rel('HRp') };
  }
  const near = (p, x, y, z, tol, msg) => {
    const dd = p.distanceTo(new THREE.Vector3(x, y, z));
    assert.ok(dd < tol, `${msg}: ${dd.toFixed(3)} m de (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}) → (${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`);
  };
  // em relação ao botão: a dog está lat m à esquerda (−X, olhando para o norte); a pata direita toca o botão
  near(at.touch.FR, 0.01, top - 0.025, shape.out + 0.02, 0.035, 'a pata direita no botão');
  near(at.touch.FL, -shape.side, top - shape.paws - 0.022, 0.03, 0.035, 'a esquerda na patinha pintada');
  near(at.kick.HL, -shape.lat - 0.055, 0.345, 0.022, 0.04, 'traseira esquerda pegando impulso');
  near(at.kick.HR, -shape.lat + 0.055, 0.345, 0.022, 0.04, 'traseira direita pegando impulso');
  assert.ok(minWall > -0.005, `nenhuma articulação atravessa a parede (a ${minWall.toFixed(3)} m dela: ${minWallAt})`);
  assert.ok(minY > -0.02, `nada abaixo do chão (y mín ${minY.toFixed(3)})`);
  assert.ok(maxY > top - 0.05, 'chega lá no alto');
  const inner = d.object.children[0];
  assert.ok(Math.abs(inner.rotation.x) < 1e-6 && Math.abs(inner.position.z) < 1e-6, 'depois do impulso o corpo volta ao normal');
});

// ---------------------------------------------------------------- Arena do Pulo (jogo headless)

/** Leva a Rhaenyra até ficar de frente para a parede marcada em `cfg` (a companheira fica com o Fica). */
function faceWall(h, cfg, back = 0.55) {
  h.walkTo(cfg.x, cfg.z + back, { tol: 0.08 });
  h.hold([0, -1]);
  h.run(0.2);
  h.hold(null);
  h.run(0.2);
}

test('Arena do Pulo: o botão abre a portinhola por 6 s; dentro, ela espera a dog sair para fechar', async () => {
  const h = await arena();
  h.tap('KeyF'); // a Radhija fica onde está
  assert.equal(h.info().total, 2, 'dois ossinhos (um no armarinho)');
  faceWall(h, BTN);
  assert.equal(h.info().prompt, 'Impulso na parede');
  h.clearLog();
  h.tap('Space');
  assert.equal(h.log('dog:wallJump').length, 1, 'impulso');
  assert.equal(h.log('dog:jump').length, 0, 'não é pulo comum');
  assert.equal(h.info().dogs.rhaenyra.action, 'wallJump');
  h.run(WALL_TOUCH * D + 0.05);
  assert.equal(h.log('wall:touch').length, 1);
  assert.equal(h.log('wall:button').at(-1)?.on, true);
  assert.equal(h.info().wall.hatch, true, 'portinhola aberta');
  assert.equal(h.log('hatch:open').length, 1);
  h.run(D);
  assert.equal(h.log('dog:land').length, 1, 'volta ao chão uma vez');
  const mid = (CUB.x0 + CUB.x1) / 2;
  h.walkPath([[mid, CUB.zFront + 0.45], [mid, CUB.zBack + 0.36]], { tol: 0.1 });
  assert.equal(h.info().collected, 1, 'pegou o ossinho do armarinho');
  h.run(6.5);
  assert.equal(h.info().wall.button.on, false, 'o tempo do botão acabou');
  assert.equal(h.info().wall.hatch, true, 'com ela dentro, a portinhola não fecha');
  h.walkTo(mid, CUB.zFront + 0.7, { tol: 0.1 });
  h.run(0.4);
  assert.equal(h.info().wall.hatch, false, 'fechou depois que ela saiu');
  assert.equal(h.log('hatch:close').length, 1);
  h.walkTo(mid, CUB.zBack + 0.3, { timeout: 2 });
  assert.ok(h.ctrls.rhaenyra.z > CUB.zFront, 'fechada, não dá para entrar');
});

test('Arena do Pulo: a alavanca liga e desliga as luzinhas (um impulso cada); ✕ do controle também vale', async () => {
  const h = await arena();
  h.tap('KeyF');
  faceWall(h, LEV);
  h.clearLog();
  h.tap('Space');
  h.run(D + 0.3);
  assert.equal(h.info().wall.lever.on, true);
  assert.equal(h.log('lantern:on').length, 1);
  assert.equal(h.log('wall:button').at(-1)?.kind, 'lever');
  faceWall(h, LEV);
  const press = (on) => h.setPad(h.pad({ down: on ? [PAD.A] : [] }));
  press(false);
  h.run(0.1);
  press(true);
  h.run(0.1);
  press(false);
  h.run(D + 0.3);
  assert.equal(h.log('dog:wallJump').length, 2, '✕ pega impulso');
  assert.equal(h.info().wall.lever.on, false);
  assert.equal(h.log('lantern:off').length, 1);
  h.setPad(null);
});

test('Arena do Pulo: o botão de pulo do toque também pega impulso na parede', async () => {
  const h = await arena();
  h.tap('KeyF');
  faceWall(h, BTN);
  h.clearLog();
  const touch = h.game.input.touch;
  touch.press('jump');
  h.step();
  touch.release('jump');
  h.run(D + 0.3);
  assert.equal(h.log('dog:wallJump').length, 1, 'impulso pelo botão de toque');
  assert.equal(h.log('dog:jump').length, 0);
  assert.equal(h.info().wall.button.on, true);
  assert.equal(h.info().input.device, 'touch');
});

test('Arena do Pulo: de costas é pulo comum; a Radhija não pega impulso e ganha a dica', async () => {
  const h = await arena();
  h.tap('KeyF');
  faceWall(h, BTN);
  h.hold([0, 1]); // vira para o sul (o giro de 180° leva ~0,25 s)
  h.run(0.35);
  h.hold(null);
  h.run(0.3);
  h.clearLog();
  h.tap('Space');
  h.run(0.8);
  assert.equal(h.log('dog:wallJump').length, 0);
  assert.equal(h.log('dog:jump').length, 1, 'de costas: pulo comum');
  h.tap('KeyQ'); // agora a Radhija
  h.clearLog();
  h.walkTo(BTN.x + 0.5, BTN.z + 0.5, { tol: 0.1 });
  h.hold([0, -1]);
  h.run(0.2);
  h.hold(null);
  assert.ok(h.log('hint').some((x) => x.text.startsWith('Alto demais para a Radhija')), 'dica para trocar');
  h.tap('Space');
  h.run(0.6);
  assert.equal(h.log('dog:wallJump').length, 0, 'a Radhija não pega impulso');
});

test('impulso: pausa congela, trocar de dog no meio termina como companheira, reiniciar cancela', async () => {
  const h = await arena();
  h.tap('KeyF');
  faceWall(h, BTN);
  h.clearLog();
  h.tap('Space');
  h.run(0.2);
  h.tap('Escape');
  assert.equal(h.info().state, 'paused');
  const k = h.info().dogs.rhaenyra.wall.k;
  h.run(1.5);
  assert.equal(h.info().dogs.rhaenyra.wall.k, k, 'pausado, o impulso não anda');
  assert.equal(h.log('wall:touch').length, 0);
  h.events.emit('ui:resume', {});
  h.run(D);
  assert.equal(h.log('wall:touch').length, 1, 'retoma e toca uma vez');
  assert.equal(h.log('dog:land').length, 1);

  // trocar no meio: a Rhaenyra termina o impulso como companheira e o botão liga
  h.game.reset(); // volta com a Rhaenyra ativa (dog=rhaenyra)
  h.run(0.1);
  assert.equal(h.info().activeDog, 'rhaenyra');
  h.tap('KeyF');
  faceWall(h, BTN);
  h.clearLog();
  h.tap('Space');
  h.run(0.15);
  h.tap('KeyQ');
  assert.equal(h.info().activeDog, 'radhija');
  h.step();
  assert.equal(h.dogs.rhaenyra.anim.action, 'wallJump', 'como companheira, segue a pose do impulso');
  h.run(D);
  assert.equal(h.log('wall:touch').length, 1, 'o toque acontece mesmo como companheira');
  assert.equal(h.info().wall.button.on, true);
  assert.equal(h.log('dog:land').length, 1);
  assert.equal(h.ctrls.rhaenyra.wall, null);
  assert.equal(h.dogs.rhaenyra.anim.wallK, -1, 'a animação também terminou');

  // reiniciar no meio: nada fica pela metade
  h.game.reset();
  h.run(0.1);
  h.tap('KeyF');
  faceWall(h, BTN);
  h.clearLog();
  h.tap('Space');
  h.run(0.3);
  h.game.reset();
  assert.equal(h.ctrls.rhaenyra.wall, null);
  assert.equal(h.ctrls.rhaenyra.wallDur, 0);
  h.run(1.2);
  assert.equal(h.log('wall:touch').length, 0, 'reiniciado antes do toque: o botão não liga');
  assert.equal(h.info().wall.button.on, false);
  assert.equal(h.info().wall.hatch, false);
});
