// Controles de toque: o joystick e os botões virtuais (src/ui/touchControls.js) chegam ao jogo pela mesma entrada
// lógica do teclado e do controle (input.touch, TOUCH_BUTTONS em src/game/input.js). Jogo de verdade, sem navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOUCH_BUTTONS, TOUCH_DEADZONE, touchStick, shapeStick } from '../src/game/input.js';
import { CONTROLS, glyph, richText } from '../src/ui/markup.js';
import { createHeadlessGame } from './helpers/headless.mjs';

const touch = (h) => h.game.input.touch;
/** Toque curto num botão: aperta, um quadro, solta, mais um quadro. */
function tapTouch(h, id, after = 1) {
  touch(h).press(id);
  h.step();
  touch(h).release(id);
  for (let i = 0; i < after; i++) h.step();
}
/** Joystick na direção (dx, dz) do MUNDO, com inclinação m (0..1), como a jogadora faria olhando a câmera. */
function stickToward(h, dx, dz, m = 1) {
  const B = h.game.debug.cam.basis();
  const fwd = dx * B.fx + dz * B.fz;
  const rgt = dx * B.rx + dz * B.rz;
  const L = Math.hypot(fwd, rgt) || 1;
  const R = 50; // raio do aro em px
  const a = touchStick((rgt / L) * R * m, (-fwd / L) * R * m, R);
  touch(h).stick(a.x, a.y, a.m);
}
/** Joystick pelo deslocamento do dedo na tela (px, y para baixo; aro de 50 px). */
const stickPx = (h, dx, dy) => {
  const a = touchStick(dx, dy, 50);
  touch(h).stick(a.x, a.y, a.m);
};
const pointer = (type) => {
  const e = new Event('pointerdown');
  e.pointerType = type;
  globalThis.dispatchEvent(e);
};

test('mapeamento dos botões de toque = os códigos do teclado e do controle', () => {
  assert.deepEqual(TOUCH_BUTTONS, {
    act: { code: 'KeyE' },
    jump: { code: 'Jump' },
    bafo: { hold: 'bafo' },
    lick: { hold: 'lick' },
    dash: { code: 'TouchShift', hold: 'shift' },
    swap: { code: 'KeyQ' },
    stay: { code: 'KeyF' },
    pause: { code: 'Escape' },
  });
});

test('ajuda e dicas: superbafo em R · R2 · Superbafo, Lambe-Lambe em L · L2 · Lamber, arrancada em Shift · R1', () => {
  const row = (start) => CONTROLS.find(([label]) => label.startsWith(start));
  assert.deepEqual(row('Superbafo').slice(1), ['R', ['RT'], ['wind']]);
  assert.deepEqual(row('Lambe-Lambe').slice(1), ['L', ['LT'], ['lick']]);
  assert.deepEqual(row('Correr').slice(1), ['Shift', ['RB'], ['dashOnly', 'push']]);
  assert.ok(!row('Lambe-Lambe')[0].includes('Rhaenyra'), 'as duas lambem');
  const r = glyph('R');
  assert.ok(r.includes('aria-label="R2 / RT"') && r.includes('aria-label="Superbafo"') && !r.includes('L2 / LT'), 'R: R2 e o botão Superbafo');
  const l = glyph('L');
  assert.ok(l.includes('aria-label="L2 / LT"') && l.includes('aria-label="Lamber"') && l.includes('>L</kbd>'), 'L: L2 e o botão Lamber');
  const s = glyph('Shift');
  assert.ok(s.includes('aria-label="R1 / RB"') && !s.includes('R2 / RT'), 'Shift: só o R1');
  const hint = richText('Continue lambendo (segure L).');
  assert.ok(hint.includes('aria-label="L2 / LT"') && hint.includes('rr-aside'), 'o "(segure L)" vira a tecla desenhada');
  assert.ok(richText('Pegue (L)').includes('aria-label="Lamber"'));
});

test('joystick virtual: zona morta, direção e velocidade proporcional como o analógico', () => {
  assert.deepEqual(touchStick(3, -4, 50), { x: 0, y: 0, m: 0 }, 'dedo quase no centro: parada');
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const up = touchStick(0, -50, 50);
  assert.ok(near(up.m, 1) && near(up.x, 0) && near(up.y, 1), 'para cima no aro = frente, trote');
  const right = touchStick(80, 0, 50);
  assert.ok(near(right.m, 1) && near(right.x, 1) && near(right.y, 0), 'além do aro continua 1');
  const half = touchStick(0, 25, 50);
  assert.ok(half.y < 0 && half.m > 0.2 && half.m < 0.6, `meia inclinação para baixo = devagar para trás (${half.m.toFixed(2)})`);
  const diag = touchStick(30, -30, 50);
  assert.ok(Math.abs(diag.x - diag.y) < 1e-9 && diag.x > 0, 'diagonal');
  assert.deepEqual(touchStick(10, 20, 50), shapeStick(0.2, 0.4, TOUCH_DEADZONE), 'mesma curva do analógico');
  assert.deepEqual(touchStick(10, 0, 0), touchStick(10, 0, 1), 'raio inválido não quebra');
});

test('dedo na tela troca o dispositivo para toque; tecla ou controle voltam', async () => {
  const h = await createHeadlessGame({ level: 1 });
  h.clearLog();
  assert.equal(h.info().input.device, 'keyboard');
  pointer('mouse');
  assert.equal(h.info().input.device, 'keyboard', 'mouse não é toque');
  pointer('touch');
  assert.equal(h.info().input.device, 'touch');
  assert.deepEqual(h.log('input:device').map((d) => d.type), ['touch']);
  h.tap('KeyW');
  assert.equal(h.info().input.device, 'keyboard');
  touch(h).press('act');
  touch(h).release('act');
  assert.equal(h.info().input.device, 'touch', 'apertar um botão de toque também troca');
  h.setPad(h.pad({ down: [0] }));
  h.step();
  h.setPad(null);
  h.step();
  assert.equal(h.info().input.device, 'gamepad');
  pointer('pen');
  assert.equal(h.info().input.device, 'touch', 'caneta conta como toque');
});

test('joystick anda com velocidade proporcional e para ao soltar', async () => {
  // mesmo espaço aberto do teste do analógico (tools/scripts/test-gamepad.mjs): para a frente da câmera
  const h = await createHeadlessGame({ level: 1 });
  h.teleport('radhija', -2.0, -0.2);
  h.run(0.3);
  stickPx(h, 0, -25); // meio caminho até o aro
  h.run(0.9);
  const slow = h.info().dogs.radhija.speed;
  touch(h).stick(0, 0, 0);
  h.teleport('radhija', -2.0, -0.2);
  h.run(0.3);
  const B = h.game.debug.cam.basis();
  stickPx(h, 0, -50); // no aro
  h.run(0.8);
  const fast = h.info().dogs.radhija;
  assert.ok(slow > 0.3 && slow < fast.speed * 0.75, `meia inclinação mais devagar (${slow} < ${fast.speed})`);
  // (a Radhija anda a 2,1 m/s: DOG_CONFIG)
  assert.ok(fast.speed > 1.9, `inclinação total: trote (${fast.speed})`);
  assert.ok((fast.x + 2.0) * B.fx + (fast.z + 0.2) * B.fz > 0.8, 'andou para a frente da câmera');
  touch(h).stick(0, 0, 0);
  h.run(0.6);
  assert.ok(h.info().dogs.radhija.speed < 0.05, 'soltou: para');
});

test('botões: Agir late, Trocar, Fica/Vem, Pular, Arrancada e pausa', async () => {
  const h = await createHeadlessGame({ level: 1 });
  h.teleport('radhija', -2.0, -0.2);
  h.run(0.3);
  h.clearLog();
  tapTouch(h, 'act');
  assert.equal(h.log('dog:bark').length, 1, 'Agir sem nada perto: late');
  tapTouch(h, 'jump');
  h.run(0.1);
  assert.equal(h.log('dog:jump').length, 0);
  assert.ok(h.log('hint').some((x) => x.text === 'Só a Rhaenyra pula! (Q)'), 'Radhija: dica do pulo');
  // arrancada: toque no botão com o joystick para a frente
  stickPx(h, 0, -50);
  h.run(0.2);
  tapTouch(h, 'dash');
  assert.equal(h.log('dog:dash').length, 1, 'Arrancada');
  touch(h).stick(0, 0, 0);
  h.run(0.8);
  tapTouch(h, 'stay');
  assert.equal(h.info().stay.rhaenyra, true, 'Fica');
  tapTouch(h, 'stay');
  assert.equal(h.info().stay.rhaenyra, false, 'Vem');
  tapTouch(h, 'swap');
  assert.equal(h.info().activeDog, 'rhaenyra', 'Trocar');
  tapTouch(h, 'jump');
  assert.equal(h.log('dog:jump').length, 1, 'Pular com a Rhaenyra');
  h.run(0.8);
  tapTouch(h, 'pause');
  assert.equal(h.info().state, 'paused');
  tapTouch(h, 'act');
  assert.equal(h.info().state, 'paused', 'pausado, os botões não fazem nada');
  tapTouch(h, 'pause');
  assert.equal(h.info().state, 'playing', 'o mesmo botão retoma');
  h.run(0.2);
  assert.equal(h.log('dog:bark').length, 1, 'o Agir apertado na pausa não vazou');
});

test('segurar Superbafo mira e soltar sopra (Radhija); com a Rhaenyra ele só dá a dica', async () => {
  const h = await createHeadlessGame({ level: 1 });
  h.teleport('radhija', -2.0, -1.0, Math.PI / 2);
  h.run(0.3);
  h.clearLog();
  touch(h).press('bafo');
  h.run(0.6);
  assert.ok(h.info().bafo.aiming, 'segurando: mira');
  assert.equal(h.log('bafo:aim').length, 1);
  touch(h).release('bafo');
  h.run(0.1);
  assert.equal(h.log('dog:bafo').length, 1, 'soltou: sopra');

  const g = await createHeadlessGame({ level: 1, query: 'dog=rhaenyra' });
  const rh = g.ctrls.rhaenyra;
  g.teleport('radhija', rh.x + 0.9, rh.z, -Math.PI / 2);
  g.game.setStay('radhija', true);
  g.run(0.3);
  g.clearLog();
  touch(g).press('bafo');
  g.run(0.6);
  touch(g).release('bafo');
  g.run(0.2);
  assert.equal(g.log('dog:bafo').length + g.log('lick:start').length, 0, 'a Rhaenyra nem sopra nem lambe');
  assert.ok(g.log('hint').some((x) => x.text.startsWith('Só a Radhija tem o superbafo')), 'dica');
});

test('segurar Lamber: as duas lambem a irmã (sem superbafo)', async () => {
  // a mesma montagem de test/fase7.test.mjs, com o botão de toque no lugar do L
  const g = await createHeadlessGame({ level: 1, query: 'dog=rhaenyra' });
  const rh = g.ctrls.rhaenyra;
  g.teleport('radhija', rh.x + 0.9, rh.z, -Math.PI / 2);
  g.game.setStay('radhija', true);
  g.run(0.3);
  g.clearLog();
  checkLick(g, 'rhaenyra');

  const h = await createHeadlessGame({ level: 1 });
  const rad = h.ctrls.radhija;
  h.teleport('rhaenyra', rad.x + 0.9, rad.z, -Math.PI / 2);
  h.game.setStay('rhaenyra', true);
  h.run(0.3);
  h.clearLog();
  checkLick(h, 'radhija');
});

function checkLick(h, by) {
  touch(h).press('lick');
  h.run(1.0);
  assert.equal(h.info().lick.on, true, 'Lamber');
  assert.equal(h.info().lick.by, by);
  assert.ok(h.log('dog:lick').length >= 1);
  assert.equal(h.log('dog:bafo').length + h.log('bafo:aim').length, 0);
  touch(h).release('lick');
  h.run(0.6);
  assert.equal(h.info().lick.on, false, 'soltou: para de lamber');
}

test('Empurrar (Rhaenyra): segurar o botão é segurar Shift', async () => {
  const h = await createHeadlessGame({ level: 1, query: 'dog=rhaenyra' });
  const inp = h.game.input;
  assert.equal(inp.shift(), false);
  touch(h).press('dash');
  assert.equal(inp.shift(), true, 'segurando');
  assert.equal(inp.consumeShift(), true, 'e a borda (arrancada) uma vez');
  assert.equal(inp.consumeShift(), false);
  touch(h).release('dash');
  assert.equal(inp.shift(), false);
});

test('soltar tudo: dedos fora da tela, janela sem foco ou fim da partida', async () => {
  const h = await createHeadlessGame({ level: 1 });
  const inp = h.game.input;
  touch(h).press('bafo');
  touch(h).press('lick');
  touch(h).press('dash');
  touch(h).stick(0.5, 0.5, 0.7);
  assert.ok(inp.bafo() && inp.lick() && inp.shift() && inp.axis().m > 0);
  touch(h).releaseAll();
  assert.ok(!inp.bafo() && !inp.lick() && !inp.shift() && inp.axis().m === 0);
  touch(h).press('bafo');
  touch(h).stick(0, 1, 1);
  globalThis.dispatchEvent(new Event('blur'));
  assert.ok(!inp.bafo() && inp.axis().m === 0, 'blur solta o toque também');
  assert.equal(touch(h).press('nada'), false, 'botão desconhecido');
});

test('trecho da fase 1 só com toque: abertura, cordinha, portão e troca', async () => {
  const h = await createHeadlessGame({ level: 1 });
  /** Anda até (x, z) só com o joystick virtual (malha fechada, devagar perto do alvo). */
  const stickTo = (x, z, tol = 0.2) => {
    for (let i = 0; i < 900; i++) {
      const c = h.ctrls[h.game.activeDog];
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < tol) break;
      stickToward(h, x - c.x, z - c.z, d < 0.6 ? 0.45 : 1);
      h.step();
    }
    touch(h).stick(0, 0, 0);
    h.run(0.2);
  };
  assert.equal(h.info().stage, 'start');
  stickTo(0.3, -2.1);
  stickTo(1.7, -2.05);
  assert.equal(h.info().stage, 'east', 'Radhija passou pela abertura');
  stickTo(1.5, 0.9);
  h.run(3, { until: (i) => i.prompt === 'Puxar a cordinha' });
  assert.equal(h.info().prompt, 'Puxar a cordinha');
  tapTouch(h, 'act');
  h.run(3, { until: (i) => i.stage === 'gateOpen' });
  assert.equal(h.info().stage, 'gateOpen', 'Agir puxou a cordinha e abriu o portão');
  stickTo(2.4, 0.9);
  h.run(6, { until: (i) => i.dogs.rhaenyra.x > 1.05 });
  tapTouch(h, 'swap');
  assert.equal(h.info().activeDog, 'rhaenyra');
  assert.equal(h.info().input.device, 'touch');
});
