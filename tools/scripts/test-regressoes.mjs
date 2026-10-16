// Regressões no navegador (UI, modelos e câmera reais). A lógica das mesmas regressões roda em Node em
// test/regressoes.test.mjs; aqui ficam as partes que dependem da tela:
//   - ✕ do controle que confirma "Começar" na tela inicial (UI de verdade) não vira pulo nem latido;
//   - o calço VISUAL da fase 2 trava embaixo da folha aberta do portão (prop 3D, não só o colisor);
//   - a dog atrasada chega ao lugar da comemoração andando, com a câmera de verdade.
// (Item na boca ao trocar de fase e A da pausa: tools/scripts/test-gamepad.mjs. Arrancada contra a
// cerca: tools/scripts/playthrough.mjs.)
//   node tools/scripts/test-regressoes.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/mecanica' });
const { check, sleep, info, ev, shot, logOf, clearLog, walkPath, load, waitFor, record, page } = H;
const PAD_A = 0; // ✕
const PAD_B = 1; // ○

const connectPad = () => ev(() => {
  const pad = {
    id: 'Controle falso (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
  };
  window.__fakePads = [pad];
  window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad }));
});
const btn = (i, on) => ev(([ii, o]) => { const p = window.__fakePads[0]; p.buttons[ii] = { pressed: o, touched: o, value: o ? 1 : 0 }; p.timestamp = performance.now(); }, [i, on]);

try {
  // ------------------------------------------------------------------ A do menu (tela inicial)
  console.log('\n== ✕ que confirma "Começar" na tela inicial ==');
  await load('');
  await connectPad();
  await sleep(400);
  let i = await info();
  check(i.state === 'title', 'tela inicial', i.state);
  await clearLog();
  await btn(PAD_A, true); // segura o ✕: a UI confirma "Começar"
  await sleep(2200);
  i = await info();
  check(i.state === 'playing', '✕ na tela inicial começa a partida', i.state);
  check((await logOf('dog:bark')).length === 0 && (await logOf('dog:jump')).length === 0, '✕ segurado do menu não vira pulo nem latido no jogo');
  await btn(PAD_A, false);
  await sleep(200);
  await btn(PAD_B, true);
  await sleep(150);
  await btn(PAD_B, false);
  await sleep(200);
  check((await logOf('dog:bark')).length === 1, '○ no jogo (sem nada perto) late');
  await ev(() => { window.__fakePads = []; });

  // ------------------------------------------------------------------ Calço visual sob a folha
  console.log('\n== Calço da fase 2 sob a folha aberta (prop 3D) ==');
  await load('?level=2&play&stage=gateLocked');
  await sleep(600);
  const geo = await ev(() => {
    const { THREE, props, layout } = window.__game;
    const pivot = props.gate.object;
    pivot.updateMatrixWorld(true);
    const hinge = new THREE.Vector3().setFromMatrixPosition(pivot.matrixWorld);
    const tip = new THREE.Vector3(0, 0, -layout.GATE.length).applyMatrix4(pivot.matrixWorld);
    const w = new THREE.Vector3();
    props.wedge.object.getWorldPosition(w);
    const ux = tip.x - hinge.x;
    const uz = tip.z - hinge.z;
    const L = Math.hypot(ux, uz);
    const along = ((w.x - hinge.x) * ux + (w.z - hinge.z) * uz) / (L * L);
    const across = Math.abs((w.x - hinge.x) * uz - (w.z - hinge.z) * ux) / L;
    return { along, across, wedge: [w.x, w.z], tip: [tip.x, tip.z] };
  });
  i = await info();
  check(i.wedge.locked && i.gate.t > 0.97, '?stage=gateLocked: portão aberto e calço travado', JSON.stringify(i.wedge));
  check(geo.across < 0.08 && geo.along > 0.6 && geo.along < 1.0, 'calço 3D embaixo da folha aberta, perto da ponta',
    `${(geo.along * 100).toFixed(0)}% da folha, ${geo.across.toFixed(3)} m da linha`);
  await shot('reg-calco-sob-a-folha.png');

  // ------------------------------------------------------------------ Dog atrasada na comemoração
  console.log('\n== Dog atrasada chegando à comemoração ==');
  await load('?play&stage=carrying');
  await page.keyboard.press('KeyF'); // a Radhija (companheira) fica
  await sleep(200);
  await ev(() => window.__game.game.debug.teleport('radhija', 5.2, 3.6));
  await clearLog();
  await walkPath([[3.0, -1.2], [1.75, 1.6], [0.35, 1.75], [-2.0, -1.0], [-3.6, -3.7]]);
  i = await info();
  check(i.state === 'celebrating', 'entregou a cenoura → comemoração', i.state);
  const spot = await ev(() => window.__game.layout.GOAL.celebrate.radhija);
  // Quadro a quadro na página: lendo por info() (uma ida e volta por amostra), uma máquina carregada deixa passar
  // vários quadros entre duas leituras e a caminhada normal parecia um "salto" de 0,9 m.
  const rec = await record((g) => {
    const d = g.debug.info().dogs.radhija;
    return { state: g.state, x: d.x, z: d.z, action: d.action, visible: d.visible };
  });
  const near = (d) => Math.hypot(d.x - spot.x, d.z - spot.z) < 0.6 && (d.action === 'celebrate' || d.action === 'sit');
  i = await waitFor((s) => near(s.dogs.radhija), { timeout: 14000, step: 100 });
  const frames = await rec.stop();
  const wrong = [];
  let arrived = null;
  let prev = frames[0];
  for (const f of frames) {
    const dist = Math.hypot(f.x - spot.x, f.z - spot.z);
    if ((f.action === 'celebrate' || f.action === 'sit') && dist > 0.8) wrong.push(`${f.state}: ${f.action} a ${dist.toFixed(2)} m`);
    if (Math.hypot(f.x - prev.x, f.z - prev.z) > 0.9 && (prev.visible || f.visible)) wrong.push('reapareceu à vista');
    if (!arrived && near(f)) arrived = f.state;
    prev = f;
  }
  check(wrong.length === 0, 'não comemora longe do lugar nem aparece do nada na tela', wrong.slice(0, 3).join(' | '));
  check(!!arrived, 'a Radhija chega ao lugar e comemora/senta', arrived || 'não chegou');
  await shot('reg-dog-atrasada.png');
} catch (e) {
  check(false, `exceção: ${e.message}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
