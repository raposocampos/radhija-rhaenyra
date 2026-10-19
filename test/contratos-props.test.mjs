// Contratos exercitados nos objetos reais de world/, sem renderer/GPU. As
// texturas de canvas são dublês; a árvore Three e os métodos dos props são reais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';
import { createCarryItem } from '../src/game/puzzleKit.js';
import { buildLevelWorld } from './helpers/worldBuild.mjs';
import { createHeadlessGame, stubDog } from './helpers/headless.mjs';
import { stubProps } from './helpers/props.mjs';

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);

test('dublês: props e métodos desconhecidos falham, inclusive chamadas opcionais', () => {
  const root = new THREE.Group();
  const def = LEVELS[1];
  const props = stubProps(def.id, root, def.layout);
  const count = root.children.length;
  assert.throws(() => props.portao?.setOpen?.(1), /Prop não declarado: fase2.portao/);
  assert.throws(() => props.gate.setOpne?.(1), /Prop não declarado: fase2.gate.setOpne/);
  assert.throws(() => props.wedge.bumpTypo(), /Prop não declarado: fase2.wedge.bumpTypo/);
  assert.equal(root.children.length, count, 'uma leitura desconhecida não cria objetos');
  props.wedge.setState(1);
  props.wedge.bump();
  assert.deepEqual(props.wedge.calls, [['setState', 1], ['bump']], 'spies preservam chamadas dos métodos declarados');
  assert.throws(() => stubProps('fase-inexistente', root, def.layout), /sem fábrica explícita/);
});

for (const def of DEV_LEVELS.filter((entry) => entry.id === 'modelo' || entry.id === 'pulo')) {
  test(`${def.id}: dublê preserva props opcionais ausentes e fallback para item real`, async (t) => {
    const fixture = await buildLevelWorld(def);
    t.after(() => fixture.dispose());
    const real = fixture.built.props;
    const fake = stubProps(def.id, new THREE.Group(), def.layout);
    for (const name of ['ball', 'plate', 'gate']) {
      assert.equal(real[name], undefined, `${name} não existe no cenário provisório`);
      assert.equal(fake[name], undefined, `${name} não deve ser fabricado pelo dublê`);
      assert.equal(Object.hasOwn(fake, name), false);
    }
    assert.deepEqual(Object.keys(fake.item).filter((name) => name !== 'calls').sort(), Object.keys(real.item).sort());
    const h = await createHeadlessGame({ levels: [def] });
    assert.equal(h.game.state, 'playing', 'puzzle inicializa com os opcionais ausentes');
    assert.equal(h.props.ball, undefined);
    h.puzzle.jumpToStage('carrying');
    assert.ok(h.puzzle.carrier, 'puzzle usa fallback do objeto item ao carregar');
    assert.equal(h.props.item.object.parent, h.dogs[h.puzzle.carrier].mouthSocket);
    h.puzzle.reset();
    assert.equal(h.puzzle.carrier, null);
    assert.notEqual(h.props.item.object.parent, h.dogs.radhija.mouthSocket);
    assert.notEqual(h.props.item.object.parent, h.dogs.rhaenyra.mouthSocket);
  });
}

for (const def of LEVELS) {
  test(`${def.id}: item carregável, o que abre e coletáveis mantêm o contrato do cenário real`, async (t) => {
    const fixture = await buildLevelWorld(def);
    t.after(() => fixture.dispose());
    const { root, built } = fixture;
    const props = built.props;
    const carried = props[def.item];
    assert.ok(carried.object instanceof THREE.Object3D, 'item real existe');
    assert.ok(carried.home instanceof THREE.Vector3, 'posição original explícita');
    assert.ok(carried.home.toArray().every(Number.isFinite));
    assert.equal(typeof carried.setHighlight, 'function');
    const home = { parent: carried.object.parent, pos: carried.object.position.clone(), quat: carried.object.quaternion.clone() };
    assert.ok(home.parent, 'item começa na árvore da fase');
    const dogs = { radhija: stubDog('radhija'), rhaenyra: stubDog('rhaenyra') };
    const carry = createCarryItem({ obj: carried.object, dogs, scene: root, name: def.item });
    for (const name of ['radhija', 'rhaenyra']) {
      carry.attach(name);
      assert.equal(carried.object.parent, dogs[name].mouthSocket);
      assert.deepEqual(carried.object.position.toArray(), [0, 0, 0]);
      carry.returnHome();
      assert.equal(carried.object.parent, home.parent, 'reset restaura o parent original, inclusive itens aninhados');
      assert.ok(carried.object.position.equals(home.pos));
      assert.ok(carried.object.quaternion.equals(home.quat));
      assert.equal(carry.holder, null);
      assert.equal(dogs[name].carryKind, null);
    }
    // O que abre na fase, como o cenário real declara: portão (fases 1–4 e 7), portãozinho (5), cancela e
    // portinhola do pórtico (6, que não tem portão). A pose da subárvore inteira conta: a cancela gira o braço,
    // não o objeto.
    // A fase 8 não tem nada que abra (varal, máquina e botões têm contratos próprios em test/fase8.test.mjs); na 9,
    // a porta do escritório abre.
    const opening = Object.entries(props).filter(([, prop]) => typeof prop?.setOpen === 'function');
    if (def.id !== 'fase8') assert.ok(opening.length > 0, 'a fase tem algo que abre');
    const pose = (object) => {
      const values = [];
      object.traverse((o) => values.push(...o.quaternion.toArray(), ...o.position.toArray()));
      return values;
    };
    for (const [name, prop] of opening) {
      assert.ok(prop.object instanceof THREE.Object3D, `${name}: objeto real`);
      props.reset();
      const closed = pose(prop.object);
      prop.setOpen(1);
      assert.notDeepEqual(pose(prop.object), closed, `${name}: abrir muda a pose do objeto real`);
      props.reset();
      assert.deepEqual(pose(prop.object), closed, `${name}: reset do cenário fecha`);
    }
    assert.deepEqual(props.collectibles.map((entry) => entry.id).sort(), def.layout.COLLECTIBLES.map((entry) => entry.id).sort());
    for (const collectible of props.collectibles) {
      assert.ok(collectible.object instanceof THREE.Object3D);
      collectible.collect();
    }
    built.update(0.6, 0.6); // A coleta termina uma animação de 0,55 s antes de esconder.
    assert.ok(props.collectibles.every((entry) => !entry.object.visible), 'coleta esconde os objetos após a animação');
    props.reset();
    assert.ok(props.collectibles.every((entry) => entry.object.visible), 'reset devolve todos os coletáveis');
  });
}

test('fase4: surfaceY real acompanha pressão/reset, puzzle pousa nessa altura e mundo mantém o pombo sobre a placa', async (t) => {
  const def = LEVELS.find((entry) => entry.id === 'fase4');
  const fixture = await buildLevelWorld(def);
  t.after(() => fixture.dispose());
  const { built } = fixture;
  const { plate, pigeon } = built.props;
  const initialY = plate.surfaceY;
  assert.ok(Number.isFinite(initialY));
  assert.ok(initialY > plate.object.position.y, 'altura é a face superior, não o centro da placa');
  plate.setPress(1);
  built.update(1 / 60, 1 / 60);
  const firstPressY = plate.surfaceY;
  assert.ok(firstPressY < initialY, 'placa começa a descer');
  built.update(0.25, 0.25);
  assert.ok(plate.surfaceY < firstPressY, 'altura acompanha a animação, não fica congelada');
  near(pigeon.object.position.y, plate.surfaceY, 'pombo acompanha a superfície pressionada');
  plate.setPress(0);
  near(plate.surfaceY, initialY, 'soltar a placa restaura altura imediatamente');
  plate.setPress(1);
  built.update(0.25, 0.5);
  built.props.reset();
  near(plate.surfaceY, initialY, 'reset do cenário restaura altura');

  // Usa o puzzle e a montagem reais juntos. Capturar a pose enviada verifica
  // o consumidor de surfaceY antes do update visual, que poderia mascará-lo.
  const poses = [];
  const setPose = pigeon.setPose;
  pigeon.setPose = (pose) => { poses.push({ ...pose }); setPose(pose); };
  const h = await createHeadlessGame({
    levels: [def], query: 'stage=gateOpen',
    configure({ levels }) {
      levels[0].build = ({ root }) => { root.add(fixture.root); return built; };
    },
  });
  assert.equal(h.game.state, 'playing');
  assert.equal(h.puzzle.stage, 'gateOpen');
  const landing = poses.findLast((pose) => pose.x === def.layout.PERCH_B.x && pose.z === def.layout.PERCH_B.z && pose.flying === false);
  assert.ok(landing, 'puzzle enviou pose de pouso');
  near(landing.y, initialY, 'puzzle usa surfaceY real antes da pressão');
  h.step();
  near(pigeon.object.position.y, plate.surfaceY, 'pombo segue sobre a placa após um quadro do jogo');
  h.puzzle.reset();
  near(plate.surfaceY, initialY, 'reset do puzzle restaura altura');
  assert.equal(h.puzzle.info().pigeon, 'A');
});
