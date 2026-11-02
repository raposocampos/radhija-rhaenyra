// Modo História em 3ª pessoa (decisão do usuário em 2026-11-01): a câmera atrás da cachorrinha ativa, girando livre,
// no jogo de verdade (headless, cenário do Recanto). As fases e o mapa continuam com a câmera de cima.
//  - a entrada é relativa à câmera: girou a câmera, o "para a frente" gira junto;
//  - o braço encurta antes de entrar numa parede e, dentro da casa, a câmera não passa do forro;
//  - andando sem mexer na câmera, ela volta devagar para trás da dog;
//  - nas cenas, os planos do diretor assumem a câmera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoryGame, storyInfo, playScene } from './helpers/historia.mjs';
import { createHeadlessGame } from './helpers/headless.mjs';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** Algum colisor alto (parede, muro, prédio) no lugar da câmera? */
function cameraInsideWall(h) {
  const p = h.engine.camera.position;
  const tall = /^(muro|casa|quarto|cozinha|quintal|torre|guarita|deposito|arvore|porta)/;
  return h.world.contacts(p.x, p.z, 0.05, 'large').filter((c) => tall.test(c.id) && c.depth > 0.02).map((c) => c.id);
}

test('3ª pessoa: só o Modo História; as fases continuam com a câmera de cima', async () => {
  const h = await createStoryGame({ query: 'stage=cozinha' });
  assert.equal(h.game.debug.cam.kind, 'third', 'a área da história usa a 3ª pessoa');
  const f = await createHeadlessGame({ level: 1 });
  assert.notEqual(f.game.debug.cam.kind, 'third', 'a fase 1 segue com a câmera de cima');
});

test('3ª pessoa: girou a câmera, o "para a frente" do controle gira junto', async () => {
  const h = await createStoryGame({ query: 'stage=cozinha' });
  const cam = h.game.debug.cam;
  h.run(0.4);
  const b0 = cam.basis();
  cam.nudge({ yaw: Math.PI / 2 });
  h.run(0.1);
  const b1 = cam.basis();
  assert.ok(Math.abs(b0.fx * b1.fx + b0.fz * b1.fz) < 0.15, `girou 90° (${JSON.stringify({ b0, b1 })})`);
  // andar para a frente (W) leva a dog para onde a câmera olha
  h.teleport('radhija', -8.9, 3.0, 0);
  h.run(0.2);
  const c = h.ctrls.radhija;
  const x0 = c.x, z0 = c.z;
  const fb = cam.basis();
  h.keyDown('KeyW');
  h.run(0.5);
  h.keyUp('KeyW');
  const dx = c.x - x0, dz = c.z - z0;
  const L = Math.hypot(dx, dz);
  assert.ok(L > 0.2, `andou (${L.toFixed(2)} m)`);
  assert.ok((dx * fb.fx + dz * fb.fz) / L > 0.8, 'para onde a câmera olha');
});

test('3ª pessoa: o braço encurta antes de entrar numa parede', async () => {
  const h = await createStoryGame({ query: 'stage=galho' });
  const cam = h.game.debug.cam;
  // no quintal, encostada no muro leste dele, olhando para o oeste: a câmera ficaria do outro lado do muro
  const Y = h.layout.YARD;
  h.teleport('radhija', Y.x1 - 0.45, 5.6, -Math.PI / 2);
  h.teleport('rhaenyra', -5.5, 5.2, 0);
  cam.heading = -Math.PI / 2;
  cam.snapFollow(h.ctrls.radhija.x, h.ctrls.radhija.z); // sem a transição da carga
  h.run(0.8);
  assert.deepEqual(cameraInsideWall(h), [], 'a câmera não fica dentro do muro');
  assert.ok(h.engine.camera.position.x < Y.x1 - 0.05, `a câmera fica do lado da dog (x ${h.engine.camera.position.x.toFixed(2)})`);
  assert.ok(cam.distance < 2, `o braço encurtou (${cam.distance.toFixed(2)} m)`);
});

test('3ª pessoa: dentro da casa, a câmera não passa do forro', async () => {
  const h = await createStoryGame({ query: 'stage=cozinha' });
  const cam = h.game.debug.cam;
  h.teleport('radhija', -12.0, 3.6, Math.PI);
  cam.snapFollow(h.ctrls.radhija.x, h.ctrls.radhija.z); // sem a transição da carga
  h.run(0.3);
  cam.nudge({ pitch: 2 }); // olhar de cima ao máximo
  h.run(0.8);
  const y = h.engine.camera.position.y;
  assert.ok(y < h.layout.WALLS.h - 0.1, `abaixo do forro (${y.toFixed(2)} m)`);
  assert.deepEqual(cameraInsideWall(h), []);
});

test('3ª pessoa: andando sem mexer na câmera, ela volta devagar para trás da dog', async () => {
  const h = await createStoryGame({ query: 'stage=piscina' });
  const cam = h.game.debug.cam;
  h.teleport('radhija', -8.0, -1.6, Math.PI);
  // a câmera de lado (sem ser pela entrada: conta como sem mexer nela)
  const north = Math.PI;
  cam.heading = north + 1.4;
  h.run(1.3);
  const before = Math.abs(wrap(north - cam.heading));
  // anda para o norte (uma direção fixa do mundo, como as partidas do E2E)
  h.walkTo(-8.0, -5.4, { timeout: 4 });
  const after = Math.abs(wrap(north - cam.heading));
  assert.ok(after < before - 0.3, `a câmera foi para trás da dog (${before.toFixed(2)} → ${after.toFixed(2)} rad)`);
});

test('3ª pessoa: nas cenas, os planos do diretor assumem a câmera e o seguimento volta no fim', async () => {
  const h = await createStoryGame();
  h.run(0.3);
  assert.equal(storyInfo(h).scene, 'abertura');
  assert.ok(h.game.debug.cam.shotActive, 'a abertura segura um plano');
  const p = h.engine.camera.position;
  assert.ok(p.z < h.layout.HOUSE.z0, `o primeiro plano olha o basculante de fora (z ${p.z.toFixed(2)})`);
  playScene(h, { skip: true });
  h.run(1.2);
  assert.equal(h.game.debug.cam.shotActive, false, 'depois da cena, o seguimento');
  assert.equal(h.game.debug.cam.mode, 'follow');
  assert.deepEqual(cameraInsideWall(h), [], 'no quarto, fora das paredes');
});
