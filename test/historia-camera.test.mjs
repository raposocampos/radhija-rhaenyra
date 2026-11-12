// Modo História em 3ª pessoa (decisão do usuário em 2026-11-01): a câmera atrás da cachorrinha ativa, girando livre,
// no jogo de verdade (headless, cenário do Recanto). As fases e o mapa continuam com a câmera de cima.
//  - a entrada é relativa à câmera: girou a câmera, o "para a frente" gira junto;
//  - o braço encurta antes de entrar numa parede e, dentro da casa, a câmera chega mais perto e não passa do forro;
//  - lugar apertado NÃO vira vista de cima (retorno do usuário em 2026-11-09): com o braço curto, a câmera fica logo
//    acima da cabeça da dog e olha para a frente;
//  - andando sem mexer na câmera, ela volta devagar para trás da dog;
//  - nas cenas, os planos do diretor assumem a câmera, de DENTRO dos lugares.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStoryGame, storyInfo, playScene, skipScene } from './helpers/historia.mjs';
import { createHeadlessGame } from './helpers/headless.mjs';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** Algum colisor de parede (muro, casa, prédio, porta) no lugar da câmera? */
function cameraInsideWall(h) {
  const p = h.engine.camera.position;
  const tall = /^(muro|casa|quarto|cozinha|quintal|torre|guarita|deposito|porta)/;
  return h.world.contacts(p.x, p.z, 0.05, 'large').filter((c) => tall.test(c.id) && c.depth > 0.02).map((c) => c.id);
}
/** Quanto a câmera olha para baixo (rad; 0 = horizonte). */
function lookDown(h) {
  const d = h.engine.camera.getWorldDirection(new THREE.Vector3());
  return Math.asin(Math.max(-1, Math.min(1, -d.y)));
}
/** Põe a dog no lugar com a câmera já assentada atrás dela (sem a transição da carga). */
function settle(h, x, z, yaw, heading = yaw) {
  const cam = h.game.debug.cam;
  h.teleport('radhija', x, z, yaw);
  cam.heading = heading;
  cam.snapFollow(x, z);
  h.run(1.6);
}

test('3ª pessoa: só o Modo História; as fases continuam com a câmera de cima', async () => {
  const h = await createStoryGame({ query: 'stage=casa' });
  assert.equal(h.game.debug.cam.kind, 'third', 'a área da história usa a 3ª pessoa');
  const f = await createHeadlessGame({ level: 1 });
  assert.notEqual(f.game.debug.cam.kind, 'third', 'a fase 1 segue com a câmera de cima');
});

test('3ª pessoa: girou a câmera, o "para a frente" do controle gira junto', async () => {
  const h = await createStoryGame({ query: 'stage=casa' });
  const cam = h.game.debug.cam;
  h.run(0.4);
  const b0 = cam.basis();
  cam.nudge({ yaw: Math.PI / 2 });
  h.run(0.1);
  const b1 = cam.basis();
  assert.ok(Math.abs(b0.fx * b1.fx + b0.fz * b1.fz) < 0.15, `girou 90° (${JSON.stringify({ b0, b1 })})`);
  // andar para a frente (W) leva a dog para onde a câmera olha
  const Q = h.layout.ROOMS.quarto;
  h.teleport('radhija', (Q.x0 + Q.x1) / 2 + 0.6, Q.z1 - 1.6, 0);
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

test('3ª pessoa: ao ar livre a câmera fica a ~2,8 m; dentro de casa chega mais perto e fica mais baixa', async () => {
  const h = await createStoryGame({ query: 'stage=piscina' });
  const cam = h.game.debug.cam;
  const T = h.layout.CAMERA.third;
  // no gramado, longe de tudo
  settle(h, -13.6, -2.7, Math.PI);
  const out = { d: cam.distance, y: h.engine.camera.position.y };
  assert.ok(Math.abs(out.d - T.distance) < 0.15, `ao ar livre, o braço inteiro (${out.d.toFixed(2)} m)`);
  // no meio do quarto, olhando para o norte (a parede do sul fica a 3 m atrás)
  const Q = h.layout.ROOMS.quarto;
  settle(h, (Q.x0 + Q.x1) / 2 + 0.6, (Q.z0 + Q.z1) / 2, Math.PI);
  const inn = { d: cam.distance, y: h.engine.camera.position.y };
  assert.ok(Math.abs(inn.d - T.indoor.distance) < 0.15, `dentro de casa, o braço menor (${inn.d.toFixed(2)} m)`);
  assert.ok(inn.y < out.y - 0.2, `e a câmera mais baixa (${inn.y.toFixed(2)} × ${out.y.toFixed(2)} m)`);
  assert.deepEqual(cameraInsideWall(h), []);
  // no meio do cômodo a câmera cabe inteira: não precisa encurtar (a casa antiga, de 3,7 m, não dava)
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    settle(h, (Q.x0 + Q.x1) / 2 + 0.6, (Q.z0 + Q.z1) / 2, yaw);
    assert.ok(cam.distance > T.indoor.distance - 0.15, `no meio do quarto, olhando para ${yaw.toFixed(2)}: braço ${cam.distance.toFixed(2)} m`);
  }
});

test('3ª pessoa: o braço encurta antes de entrar numa parede', async () => {
  const h = await createStoryGame({ query: 'stage=quintal' });
  const cam = h.game.debug.cam;
  // no quintal (o norte, perto da goiabeira), encostada no muro leste dele, olhando para o oeste: a câmera ficaria do
  // outro lado do muro
  const Y = h.layout.YARD;
  h.teleport('rhaenyra', Y.x0 + 2.2, 6.6, 0);
  settle(h, Y.x1 - 0.45, 7.4, -Math.PI / 2);
  assert.deepEqual(cameraInsideWall(h), [], 'a câmera não fica dentro do muro');
  assert.ok(h.engine.camera.position.x < Y.x1 - 0.05, `a câmera fica do lado da dog (x ${h.engine.camera.position.x.toFixed(2)})`);
  assert.ok(cam.distance < 1, `o braço encurtou (${cam.distance.toFixed(2)} m)`);
});

test('3ª pessoa: no quintal maior, o fundo é aberto, os canteiros baixos não encurtam o braço e o muro alto do lote sim', async () => {
  const h = await createStoryGame({ query: 'stage=quintal' });
  skipScene(h, 'quintalChega');
  const cam = h.game.debug.cam;
  const T = h.layout.CAMERA.third, SP = h.layout.SPRINKLERS, Y = h.layout.YARD;
  h.teleport('rhaenyra', -10.2, 19.4, 0);
  // no fundo do quintal, olhando para o norte (a horta do meio lá na frente): o braço inteiro
  settle(h, -8.5, 21.6, Math.PI);
  assert.ok(Math.abs(cam.distance - T.distance) < 0.15, `no fundo do quintal, o braço inteiro (${cam.distance.toFixed(2)} m)`);
  assert.deepEqual(cameraInsideWall(h), []);
  // no gramadinho dos aspersores, entre os canteiros de flores: eles são baixos, não encurtam o braço
  h.puzzle.quintal.skipAll();
  settle(h, SP.heads[1].x, SP.heads[1].z + 0.4, Math.PI);
  assert.ok(Math.abs(cam.distance - T.distance) < 0.15, `entre os canteiros, o braço inteiro (${cam.distance.toFixed(2)} m)`);
  assert.ok(lookDown(h) < 0.45, 'olhando para a frente, não de cima');
  // encostada no muro alto do lote (a leste do fundo), olhando para o oeste: o braço encurta antes do muro
  settle(h, Y.x1 - 0.42, 20.9, -Math.PI / 2);
  assert.deepEqual(cameraInsideWall(h), [], 'a câmera fora do muro do lote');
  assert.ok(h.engine.camera.position.x < Y.x1 - 0.05, `do lado do quintal (x ${h.engine.camera.position.x.toFixed(2)})`);
  assert.ok(cam.distance < 1, `o braço encurtou (${cam.distance.toFixed(2)} m)`);
});

test('3ª pessoa: lugar apertado não vira vista de cima (a câmera olha para a frente, por cima do ombro)', async () => {
  const h = await createStoryGame({ query: 'stage=casa' });
  const cam = h.game.debug.cam;
  const Q = h.layout.ROOMS.quarto;
  h.teleport('rhaenyra', Q.x1 - 1.2, Q.z1 - 1.2, 0);
  const spots = [
    // de costas para a parede do sul do quarto, olhando para o norte
    { x: (Q.x0 + Q.x1) / 2 + 0.8, z: Q.z1 - 0.5, yaw: Math.PI, what: 'de costas para a parede' },
    // no canto sudoeste, olhando para o meio do quarto
    { x: Q.x0 + 1.4, z: Q.z1 - 0.55, yaw: Math.PI * 0.75, what: 'no canto' },
    // encostada na parede do leste, olhando para o oeste
    { x: Q.x1 - 0.5, z: Q.z1 - 1.6, yaw: -Math.PI / 2, what: 'encostada na parede do leste' },
  ];
  for (const s of spots) {
    settle(h, s.x, s.z, s.yaw);
    const p = h.engine.camera.position;
    const c = h.ctrls.radhija;
    assert.deepEqual(cameraInsideWall(h), [], `${s.what}: a câmera fora da parede`);
    assert.ok(cam.distance < 1.2, `${s.what}: o braço encurtou (${cam.distance.toFixed(2)} m)`);
    assert.ok(p.y < 1.25, `${s.what}: a câmera fica baixa, logo acima da cabeça dela (${p.y.toFixed(2)} m)`);
    assert.ok(lookDown(h) < 0.35, `${s.what}: olhando para a frente, não de cima (${lookDown(h).toFixed(2)} rad para baixo)`);
    // e para a frente da dog: o que a câmera olha está adiante dela
    const d = h.engine.camera.getWorldDirection(new THREE.Vector3());
    assert.ok(d.x * Math.sin(s.yaw) + d.z * Math.cos(s.yaw) > 0.85, `${s.what}: a câmera olha para onde ela olha`);
    assert.ok(Math.hypot(p.x - c.x, p.z - c.z) < 1.2, `${s.what}: perto dela`);
  }
});

test('3ª pessoa: dentro da casa, a câmera não passa do forro', async () => {
  const h = await createStoryGame({ query: 'stage=casa' });
  const cam = h.game.debug.cam;
  const Q = h.layout.ROOMS.quarto;
  settle(h, (Q.x0 + Q.x1) / 2, (Q.z0 + Q.z1) / 2, Math.PI);
  cam.nudge({ pitch: 2 }); // olhar de cima ao máximo
  h.run(0.8);
  const y = h.engine.camera.position.y;
  assert.ok(y < h.layout.WALLS.h - 0.1, `abaixo do forro (${y.toFixed(2)} m)`);
  assert.deepEqual(cameraInsideWall(h), []);
});

test('3ª pessoa: andando sem mexer na câmera, ela volta devagar para trás da dog', async () => {
  const h = await createStoryGame({ query: 'stage=piscina' });
  const cam = h.game.debug.cam;
  h.teleport('radhija', -13.6, -2.7, Math.PI);
  // a câmera de lado (sem ser pela entrada: conta como sem mexer nela)
  const north = Math.PI;
  cam.heading = north + 1.4;
  h.run(1.3);
  const before = Math.abs(wrap(north - cam.heading));
  // anda para o norte (uma direção fixa do mundo, como as partidas do E2E)
  h.walkTo(-13.6, -8.2, { timeout: 4 });
  const after = Math.abs(wrap(north - cam.heading));
  assert.ok(after < before - 0.3, `a câmera foi para trás da dog (${before.toFixed(2)} → ${after.toFixed(2)} rad)`);
});

test('3ª pessoa: nas cenas, a câmera de cinema fica DENTRO do quarto e o seguimento volta no fim', async () => {
  const h = await createStoryGame();
  const Q = h.layout.ROOMS.quarto;
  const inRoom = (p) => p.x > Q.x0 + 0.2 && p.x < Q.x1 - 0.2 && p.z > Q.z0 + 0.2 && p.z < Q.z1 - 0.2 && p.y > 0.2 && p.y < h.layout.WALLS.h - 0.2;
  h.run(0.3);
  assert.equal(storyInfo(h).scene, 'abertura');
  assert.ok(h.game.debug.cam.shotActive, 'a abertura segura um plano');
  // a abertura inteira: nenhum plano de dentro de parede (a casa é inteira, com forro e telhado)
  const bad = new Set();
  playScene(h, {
    each() {
      if (storyInfo(h).scene !== 'abertura') return;
      const p = h.engine.camera.position;
      // o primeiro plano (desde 2026-11-10) é a grua lá fora, na garoa, descendo até o vidro do basculante: fora da
      // casa, do lado da janela, e nunca dentro de parede; o resto, dentro do quarto
      // e o close do Capitão no parapeito é de fora, com o quarto pelo vidro atrás dele
      const outside = storyInfo(h).beat === 'fora' || (storyInfo(h).beat === 'pombos' && p.z < h.layout.WINDOW.z - 0.3);
      const W = h.layout.WINDOW;
      if (outside ? !(p.z < W.z - 0.3 && p.y > 0.4) : !inRoom(p)) bad.add(`${storyInfo(h).beat}: câmera em (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
      for (const id of cameraInsideWall(h)) bad.add(`${storyInfo(h).beat}: câmera dentro de ${id}`);
    },
  });
  assert.deepEqual([...bad], [], 'a abertura é filmada de dentro do quarto');
  h.run(1.2);
  assert.equal(h.game.debug.cam.shotActive, false, 'depois da cena, o seguimento');
  assert.equal(h.game.debug.cam.mode, 'follow');
  assert.deepEqual(cameraInsideWall(h), [], 'no quarto, fora das paredes');
  assert.ok(lookDown(h) < 0.5, 'atrás da dog, olhando para a frente');
});
