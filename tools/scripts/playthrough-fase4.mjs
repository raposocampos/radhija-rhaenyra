// FASE 4 · Operação Patinho — partida no navegador com TECLAS REAIS para as ações (R, Q, Shift, E) e
// teletransportes entre os trechos (a lógica fina está em test/fase4.test.mjs).
//   node tools/scripts/playthrough-fase4.mjs [--url http://127.0.0.1:5176/]
// Capturas em shots/mecanica/f4-*.png. Sai com código 1 se algo falhar.
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/mecanica' });
const { check, sleep, info, ev, shot, logOf, clearLog, walkTo, press, load, waitFor, page, keysFor } = H;
const L = () => ev(() => window.__game.layout);
const place = (name, x, z, yaw) => ev(([n, a, b, y]) => {
  window.__game.game.debug.teleport(n, a, b);
  window.__game.game.debug.ctrls[n].yaw = y;
}, [name, x, z, yaw]);
const blow = async () => {
  await page.keyboard.down('KeyR');
  await sleep(420);
  await page.keyboard.up('KeyR');
  await sleep(150);
};

try {
  console.log('\n== Fase 4: partida (terraço) ==');
  await load('?level=4&play');
  const lay = await L();
  let i = await info();
  check(i.state === 'playing' && i.levelId === 'fase4' && i.stage === 'start' && i.nap === 'asleep', 'fase 4 começa com o pombo cochilando na passagem', `${i.levelId}/${i.stage}/${i.nap}`);
  check(i.objective === 'Acorde o pombo da passagem com um superbafo (segure R e solte)', 'objetivo inicial', i.objective);
  check(await ev(() => !!document.querySelector('.rr-hud .ico-duck, .rr .ico-duck')), 'ícone do patinho no HUD');
  await shot('f4-01-inicio.png');

  // 1) superbafo direto no pombo da passagem
  await clearLog();
  await place('radhija', lay.NAP_PIGEON.x - 0.9, lay.NAP_PIGEON.z, Math.PI / 2);
  await sleep(300);
  await blow();
  i = await waitFor((s) => s.stage === 'passOpen', { timeout: 4000 });
  check(i.stage === 'passOpen' && i.nap !== 'asleep', 'superbafo (R) acorda o pombo e abre a passagem', `${i.stage}/${i.nap}`);
  check((await logOf('pigeon:flee')).length === 1, 'evento pigeon:flee');
  await sleep(1400);
  await shot('f4-02-passagem-livre.png');

  // 2) Rhaenyra empurra o ventilador (S + Shift) até o encaixe
  await press('KeyQ', 300);
  await place('rhaenyra', lay.FAN.start.x - 0.05, lay.FAN.start.z - lay.FAN.half - 0.28, 0);
  await sleep(300);
  const keys = [...keysFor(0, 1), 'ShiftLeft'];
  for (const k of keys) await page.keyboard.down(k);
  i = await waitFor((s) => s.fan.z > lay.FAN.alignZ - 0.12, { timeout: 9000 });
  for (const k of keys.reverse()) await page.keyboard.up(k);
  i = await waitFor((s) => s.fan.aligned, { timeout: 2000 });
  check(i.fan.aligned, 'Rhaenyra empurra o ventilador até a marca (encaixa)', `z=${i.fan.z}`);
  await shot('f4-03-ventilador.png');

  // 3) Radhija sopra no corredor: duto → pombo → placa → portão
  await press('KeyQ', 300);
  await place('radhija', (lay.CORRIDOR.door.x0 + lay.CORRIDOR.door.x1) / 2, lay.CORRIDOR.z, Math.PI / 2);
  await sleep(400);
  await clearLog();
  await blow();
  i = await waitFor((s) => s.stage === 'gateOpen', { timeout: 9000 });
  check(i.stage === 'gateOpen' && i.pigeon === 'B' && i.gate.locked, 'vento → duto → pombo → placa → portão aberto e travado', `${i.stage}/${i.pigeon}`);
  check((await logOf('scent:duct')).length === 1 && (await logOf('scent:exit')).length === 1, 'eventos scent:duct e scent:exit');
  await sleep(800);
  await shot('f4-04-portao-aberto.png');

  // 4) patinho (E) e entrega no capacho
  await place('radhija', lay.DUCK.x - 0.62, lay.DUCK.z - 0.1, Math.PI / 2);
  i = await waitFor((s) => s.prompt === 'Pegar o patinho', { timeout: 2000 });
  check(i.prompt === 'Pegar o patinho', 'prompt "Pegar o patinho"', i.prompt);
  await press('KeyE', 300);
  i = await info();
  check(i.carrier === 'radhija' && i.stage === 'carrying', 'Radhija pega o patinho', `${i.carrier}/${i.stage}`);
  await shot('f4-05-patinho.png');
  await place('radhija', lay.GOAL.x + 0.2, lay.GOAL.z + 1.4, Math.PI);
  await sleep(300);
  await walkTo(lay.GOAL.x, lay.GOAL.z + 0.1, { tol: 0.25 });
  i = await waitFor((s) => s.state === 'victory', { timeout: 6000 });
  check(i.state === 'victory', 'entrega no capacho → vitória');
  const vic = await logOf('victory');
  check(vic.length === 1 && vic[0].levelId === 'fase4' && vic[0].hasNext === true, 'evento victory (fase4, com a fase 5 depois)', JSON.stringify(vic[0] || {}));
  await sleep(1200);
  await shot('f4-06-vitoria.png');

  console.log('\n== Fase 4: casos de borda ==');
  await load('?level=4&play');
  await clearLog();
  await place('radhija', lay.NAP_PIGEON.x - 0.8, lay.NAP_PIGEON.z, Math.PI / 2);
  await sleep(300);
  await press('KeyE', 300);
  check((await logOf('hint')).some((h) => h.text.startsWith('O pombo nem liga para latido')), 'latido (E) não acorda o pombo (dica)');
  check((await info()).nap === 'asleep', 'o pombo continua dormindo');
  for (const s of ['passOpen', 'gateOpen', 'carrying']) {
    await load(`?level=4&play&stage=${s}`);
    check((await info()).stage === s, `?stage=${s}`);
  }
} catch (e) {
  check(false, `exceção: ${e.message}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
