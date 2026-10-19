// Modelo novo das cachorrinhas no navegador (etapa 1 da troca dos modelos): o Canil das Dogs (?level=canil) com a
// vitrine e o painel de poses, e o jogo com as duas dogs no modelo novo (?dogs=novo) na fase 1 e na Arena do Pulo.
// A lógica do modelo (esqueleto, pesos, guia, chão) está em test/dogV2.test.mjs; aqui, a integração com a página.
//   node tools/scripts/test-canil.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/canil' });
const { check, sleep, info, ev, shot, logOf, clearLog, walkTo, load, page } = H;

try {
  console.log('\n== Canil das Dogs: vitrine e painel ==');
  await load('?level=canil&play&dog=rhaenyra');
  let i = await info();
  check(i.levelId === 'canil' && i.activeDog === 'rhaenyra', 'canil carregado com a Rhaenyra', `${i.levelId}/${i.activeDog}`);
  const dogs = i.canil?.dogs ?? [];
  check(dogs.length === 4, 'quatro dogs na vitrine', JSON.stringify(dogs));
  check(dogs.filter((d) => d.model === 'v2').every((d) => d.bones === 38) && dogs.filter((d) => d.model === 'v1').every((d) => d.bones === 28),
    'modelo atual com 28 ossos e o novo com 38', JSON.stringify(dogs.map((d) => `${d.kind}/${d.model}:${d.bones}`)));
  check(i.canil?.panel === true && (await page.locator('.canil-panel').count()) === 1, 'painel da vitrine na tela');
  check(i.canil?.camera === 'vitrine', 'a câmera começa na vitrine');
  await shot('01-vitrine.png');

  // Cada pose pelo painel: a vitrine troca, nenhum osso vira NaN e o modelo novo não afunda no chão.
  const poses = await ev(() => [...document.querySelectorAll('.canil-panel [data-pose]')].map((b) => b.dataset.pose));
  check(poses.length >= 25, 'botões de todas as poses', String(poses.length));
  check(!poses.some((p) => /coc|poop/i.test(p)), 'o segredo não aparece no painel');
  const bad = [];
  for (const p of poses) {
    await page.click(`.canil-panel [data-pose="${p}"]`);
    i = await H.gsleep(700);
    if (i.canil?.pose !== p) bad.push(`${p}: pose não trocou (${i.canil?.pose})`);
    const st = await ev(() => window.__game.props.display.info().dogs.map((d) => d.lowest));
    for (const low of st) if (low !== null && !Number.isFinite(low)) bad.push(`${p}: contato inválido (${low})`);
    const nan = await ev(() => window.__game.props.display.object.children.some((o) => {
      let broken = false;
      o.traverse((b) => { if (b.isBone && !Number.isFinite(b.quaternion.x + b.position.y)) broken = true; });
      return broken;
    }));
    if (nan) bad.push(`${p}: osso com NaN`);
    if (['trote', 'sentada', 'deitada', 'pulo', 'lambendo', 'bebendo', 'rolando', 'superbafo'].includes(p)) await shot(`02-pose-${p}.png`);
  }
  check(bad.length === 0, 'todas as poses do painel funcionam nas quatro dogs', bad.join(' | '));

  // Vistas e opções
  for (const view of ['lado', 'frente', 'costas', 'tres-quartos', 'girando']) {
    await page.click(`.canil-panel [data-view="${view}"]`);
    await H.gsleep(250);
  }
  i = await info();
  check(i.canil?.view === 'girando', 'vistas pelo painel', i.canil?.view);
  await page.click('.canil-panel [data-pose="trote"]');
  await page.click('.canil-panel [data-view="lado"]');
  await page.click('.canil-panel [data-toggle="skeleton"]');
  await page.click('.canil-panel [data-toggle="wet"]');
  i = await H.gsleep(400);
  check(i.canil?.skeleton === true && i.canil?.wet === true, 'esqueleto e pelo molhado ligados', JSON.stringify(i.canil));
  await shot('03-esqueleto-de-lado.png');
  await page.click('.canil-panel [data-toggle="skeleton"]');
  await page.click('.canil-panel [data-toggle="wet"]');

  // Enquadramentos da vitrine
  for (const cam of ['radhija', 'rhaenyra', 'vitrine']) {
    await page.click(`.canil-panel [data-camera="${cam}"]`);
    i = await H.gsleep(900);
    if (cam !== 'vitrine') await shot(`03-camera-${cam}.png`);
    check(i.canil?.camera === cam, `câmera da vitrine: ${cam}`, i.canil?.camera);
  }

  // O painel não rouba o teclado: depois de um clique, Espaço ainda é o pulo da Rhaenyra.
  await page.click('.canil-panel [data-camera="livre"]');
  await clearLog();
  await page.keyboard.press('Space');
  await H.gsleep(900);
  check((await logOf('dog:jump')).length === 1, 'Espaço pula depois de clicar no painel');
  i = await info();
  check(i.canil?.camera === 'livre', 'câmera na dog');
  await walkTo(1.6, 1.2);
  await shot('04-camera-na-dog.png');

  // Fecha e reabre o painel
  await page.click('.canil-panel .canil-head');
  check((await ev(() => document.querySelector('.canil-panel').dataset.open)) === '0', 'painel fecha');
  await page.click('.canil-panel .canil-head');

  // Ao sair da fase o painel some
  await load('?level=1&play&dogs=novo');
  check((await page.locator('.canil-panel').count()) === 0, 'outra fase: sem o painel do canil');

  console.log('\n== Fase 1 com o modelo novo (?dogs=novo) ==');
  const model = await ev(() => Object.values(window.__game.dogs).map((d) => `${d.kind}:${d.model ?? 'v1'}:${d.bones.length}`));
  check(model.every((m) => m.endsWith(':v2:38')), 'as duas dogs com o modelo novo', model.join(' '));
  i = await info();
  const start = i.dogs[i.activeDog];
  await H.hold(['KeyW'], 900);
  await H.hold(['KeyD'], 700);
  i = await info();
  const moved = Math.hypot(i.dogs[i.activeDog].x - start.x, i.dogs[i.activeDog].z - start.z);
  check(moved > 0.5, 'a dog anda com o modelo novo', moved.toFixed(2));
  const steps = await logOf('dog:step');
  check(steps.length >= 2, 'pisadas pelo modelo novo (pegadas e sons)', String(steps.length));
  await shot('05-fase1-modelo-novo.png');
  await page.keyboard.press('KeyQ');
  await H.gsleep(600);
  await H.hold(['KeyA'], 600);
  await shot('06-fase1-troca.png');

  console.log('\n== Arena do Pulo com o modelo novo: pulo e impulso na parede ==');
  await load('?level=pulo&play&dog=rhaenyra&dogs=novo');
  const fence = await ev(() => window.__game.layout.LOG_FENCE);
  await walkTo(fence.x - 0.9, -0.6);
  await clearLog();
  await page.keyboard.down('KeyD');
  await sleep(150);
  await page.keyboard.press('Space');
  await sleep(160);
  const up = await ev(() => window.__game.dogs.rhaenyra.object.children[0].position.y);
  check(up > 0.1, 'no ar, o modelo novo sobe junto', up.toFixed(3));
  await shot('07-pulo-modelo-novo.png');
  await sleep(700);
  await page.keyboard.up('KeyD');
  i = await H.waitFor((s) => !s.dogs.rhaenyra.jumping, { timeout: 3000 });
  check(i.dogs.rhaenyra.x > fence.x + fence.hx && (await logOf('dog:land')).length === 1, 'pousou do outro lado');

  await load('?level=pulo&play&dog=rhaenyra&dogs=novo');
  const W = await ev(() => window.__game.layout.WALL_BUTTON);
  await page.keyboard.press('KeyF');
  await walkTo(W.x, W.z + 0.55, { tol: 0.12 });
  await H.hold(['KeyW'], 250);
  await clearLog();
  await page.keyboard.press('Space');
  await H.waitFor((s) => (s.dogs.rhaenyra.wall?.k ?? 0) > 0.5, { timeout: 3000 });
  await shot('08-parede-modelo-novo.png');
  i = await H.waitFor((s) => !s.dogs.rhaenyra.wall && s.dogs.rhaenyra.y === 0, { timeout: 4000 });
  check(i.wall?.button?.on === true, 'o impulso na parede aperta o botão com o modelo novo', JSON.stringify(i.wall?.button));
} catch (e) {
  check(false, `exceção: ${e.message}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
