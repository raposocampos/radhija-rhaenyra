// Porquinhos no navegador (Arena dos Porquinhos, ?level=porcos): teclas reais, renderização real.
// A lógica completa está em test/porcos.test.mjs (headless); aqui, a integração com a página: os modelos montados
// no navegador, a Radhija entrando na horta pelo vão e pisando no botão, a porteira abrindo e os porquinhos saindo e
// indo atrás dela, o milho pego (E) do outro lado e largado (E) na horta, um porquinho comendo, o sininho (E) e todos
// de volta ao chiqueiro; e a cenoura derrubada da boca (quem leva algo é o alvo preferido deles). Com os porcos
// soltos, as idas longas são teleporte (eles atrapalham de propósito).
//   node tools/scripts/test-porcos.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/porcos' });
const { check, info, ev, shot, logOf, clearLog, walkPath, load, waitFor, press } = H;
const veg = (s, kind) => s.veggies.find((v) => v.kind === kind) || {};
/** Teleporte (só para atravessar o quintal com os porcos soltos). */
const tp = (name, x, z, yaw = 0) => ev(({ n, x: px, z: pz, y }) => {
  const g = window.__game.game;
  g.debug.teleport(n, px, pz);
  g.debug.ctrls[n].yaw = y;
}, { n: name, x, z, y: yaw });

try {
  console.log('\n== Porquinhos (Arena dos Porquinhos) ==');
  await load('?level=porcos&play');
  let i = await info();
  check(i.levelId === 'porcos' && i.state === 'playing', 'link por id (?level=porcos) abre a arena', `${i.levelId}/${i.state}`);
  const L = await ev(() => { const l = window.__game.layout; return { BUTTON: l.BUTTON, BELL: l.BELL, VEG: l.VEGGIES, HORTA: l.HORTA, PEN: l.PEN }; });
  check(i.porcos.inPen === 3 && !i.porcos.open, 'três porquinhos no chiqueiro, porteira fechada', JSON.stringify(i.porcos.pigs.map((p) => p.state)));
  const models = await ev(() => window.__game.game.puzzle.pigs.pigs.map((p) => {
    let meshes = 0;
    p.model.object.traverse((o) => { if (o.isMesh) meshes++; });
    return { tris: p.model.stats.tris, meshes, low: +p.model.lowestY().toFixed(4), visible: p.model.object.visible };
  }));
  check(models.length === 3 && models.every((m) => m.tris > 3000 && m.meshes <= 9 && m.visible), 'modelos dos porquinhos montados', JSON.stringify(models));
  check(models.every((m) => m.low > -0.006), 'nenhum porquinho abaixo do chão', JSON.stringify(models.map((m) => m.low)));
  await shot('01-chiqueiro.png');

  // a Radhija entra na horta pelo vão da tábua quebrada e pisa no botão
  const zg = (L.HORTA.gap.z0 + L.HORTA.gap.z1) / 2;
  await walkPath([[L.HORTA.x - 0.7, zg], [L.HORTA.x + 0.7, zg], [2.8, 0.3], [L.BUTTON.x, L.BUTTON.z]], { tol: 0.14 });
  i = await waitFor((s) => s.porcos.released, { timeout: 5000 });
  check(i.stage === 'pigsOut' && i.porcos.open, 'o botão abriu a porteira', `${i.stage} ${i.porcos.open}`);
  i = await waitFor((s) => s.porcos.inPen === 0, { timeout: 14000 });
  check(i.porcos.inPen === 0 && (await logOf('pig:release')).length === 1, 'os porquinhos saíram do chiqueiro', JSON.stringify(i.porcos.pigs));
  i = await waitFor((s) => s.porcos.pestering >= 1, { timeout: 8000 });
  check(i.porcos.pestering >= 1, 'eles vão atrás da Radhija', JSON.stringify(i.porcos.pigs.map((p) => `${p.state}:${p.dog}`)));
  await shot('02-atrapalhando.png');

  // o milho do outro lado: E pega; na horta, E larga
  await tp('radhija', L.VEG.corn.x - 0.5, L.VEG.corn.z, Math.PI / 2);
  await H.gsleep(300);
  await press('KeyE');
  i = await info();
  check(veg(i, 'corn').holder === 'radhija', 'E pegou o milho', JSON.stringify(veg(i, 'corn')));
  check(i.dogs.radhija.carrying === true, 'a Radhija leva o milho na boca');
  await shot('03-milho-na-boca.png');
  await tp('radhija', 2.3, 0.7, Math.PI / 2);
  await H.gsleep(250);
  await clearLog();
  await press('KeyE');
  i = await waitFor((s) => veg(s, 'corn').state === 'ground', { timeout: 2500 });
  check(veg(i, 'corn').state === 'ground' && !!veg(i, 'corn').food, 'E largou o milho no chão da horta', JSON.stringify(veg(i, 'corn')));
  check((await logOf('item:land')).length === 1, 'item:land');
  i = await waitFor((s) => s.porcos.pigs.some((p) => p.state === 'eat'), { timeout: 12000 });
  const eater = i.porcos.pigs.find((p) => p.state === 'eat');
  check(!!eater && eater.distracted && eater.left > 20, 'um porquinho foi comer (distraído por um bom tempo)', JSON.stringify(eater));
  check((await logOf('pig:eat')).length === 1, 'pig:eat na primeira mordida');
  await H.gsleep(1500);
  await shot('04-comendo.png');
  i = await info();
  check(veg(i, 'corn').eaten > 0, 'o milho vai sumindo', String(veg(i, 'corn').eaten));

  // com algo na boca, eles derrubam: a cenoura cai no chão (e, na horta, vira comida)
  await tp('radhija', L.VEG.carrot.x + 0.5, L.VEG.carrot.z, -Math.PI / 2);
  await H.gsleep(300);
  await press('KeyE');
  i = await info();
  check(veg(i, 'carrot').holder === 'radhija', 'E pegou a cenoura', JSON.stringify(veg(i, 'carrot')));
  await tp('radhija', 3.0, -0.6, 0);
  await clearLog();
  i = await waitFor((s) => s.porcos.knocks > 0, { timeout: 15000 });
  check(i.porcos.knocks > 0 && (await logOf('pig:knock')).length >= 1, 'um porquinho derrubou a cenoura da boca', JSON.stringify(i.porcos.pigs.map((p) => `${p.state}:${p.dog}`)));
  i = await waitFor((s) => veg(s, 'carrot').state !== 'air', { timeout: 2000 });
  check(veg(i, 'carrot').holder === null && veg(i, 'carrot').state !== 'held', 'a cenoura caiu no chão', JSON.stringify(veg(i, 'carrot')));

  // o sininho chama todos de volta (a porteira fecha quando o último entra)
  await tp('radhija', L.BELL.x + 0.05, L.BELL.z + 0.6, Math.PI);
  await H.gsleep(250);
  i = await info();
  check(i.prompt === 'Tocar o sininho', 'prompt do sininho', String(i.prompt));
  await clearLog();
  await press('KeyE');
  check((await logOf('bell:ring')).length === 1, 'E tocou o sininho');
  await tp('radhija', -2.5, 1.2, -Math.PI / 2); // sai do caminho
  i = await waitFor((s) => s.porcos.inPen === 3 && !s.porcos.open && s.porcos.gateT < 0.05, { timeout: 30000 });
  check(i.porcos.inPen === 3 && !i.porcos.open, 'todos de volta e a porteira fechou', JSON.stringify(i.porcos.pigs.map((p) => p.state)));
  check((await logOf('pig:home')).length === 1, 'pig:home');
  await shot('05-de-volta.png');
} catch (e) {
  check(false, `exceção: ${e.message}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
