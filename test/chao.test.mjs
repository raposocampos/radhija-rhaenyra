// Chão e apoio das patas (etapa 4, retorno do usuário na prévia do #48):
//   · empurrando de pé, as patas da frente apoiam no DESENHO do objeto (pushRest.js), não na caixa de colisão (no
//     carrinho da fase 1 a caixa passa 6 cm das pontas e a beirada fica abaixo da altura das patas: elas ficavam no ar);
//   · as coisas baixas de pisar (placas de pressão, pedais, botões do chão e as caminhas) viram chão (ground.js): a dog
//     sobe nelas, e no modelo novo cada pata pisa em cima (antes as patas entravam no estrado e as dogs atravessavam a
//     caminha).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installBrowserStubs } from './helpers/headless.mjs';
import { buildLevelWorld } from './helpers/worldBuild.mjs';
import { withSeed } from './helpers/seeded.mjs';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';
import { pushRest } from '../src/game/pushRest.js';
import { createGround, walkablesOf, bodyGround, planRimHop, pushOffRims } from '../src/game/ground.js';
import { createCollisionWorld } from '../src/game/collision.js';
import { createController, placeController, steer, integrate, startHop } from '../src/game/dogController.js';
import { withStart } from '../src/dogs/config.js';
import { createHeadlessGame } from './helpers/headless.mjs';

installBrowserStubs();
const DT = 1 / 60;
const level = (id) => [...LEVELS, ...DEV_LEVELS].find((d) => d.id === id);

test('empurrando de pé: as patas apoiam no desenho de cada objeto de empurrar (cenário real de cada fase)', async () => {
  const L = (id) => level(id).layout;
  // [fase, prop, meia largura em x da caixa de colisão]
  const cases = [
    ['fase1', 'cart', L('fase1').CART.halfSize.x],
    ['fase2', 'crate', L('fase2').CRATE.half],
    ['fase4', 'fan', L('fase4').FAN.half],
    ['fase5', 'pillowBox', L('fase5').BOX_PILLOWS.half],
    ['fase8', 'basket', L('fase8').BASKET.half],
    ['fase9', 'ladder', L('fase9').LADDER.half],
    ['fase9', 'globe', L('fase9').GLOBE.half],
    ['fase9', 'fan', L('fase9').FAN.half],
    ['fase9', 'planter', L('fase9').PLANTER.half],
    ['fase10', 'crate', L('fase10').CRATE.half],
  ];
  const report = [];
  const bad = [];
  const worlds = new Map();
  try {
    for (const [id, key, hx] of cases) {
      if (!worlds.has(id)) worlds.set(id, await buildLevelWorld(level(id)));
      const fx = worlds.get(id);
      const obj = fx.built.props[key].object;
      fx.root.updateMatrixWorld(true);
      const c = obj.getWorldPosition(new THREE.Vector3());
      // a Rhaenyra (quem empurra) de frente para a face oeste, com o peito encostado na caixa de colisão
      const near = 0.245;
      const at = { x: c.x - hx - near, z: c.z, yaw: Math.PI / 2 };
      const r = pushRest(obj, at, { near, pref: 0.36 * 1.133, scale: 1.133 });
      const tag = `${id} ${key}`;
      if (!r) {
        bad.push(`${tag}: os raios não acharam o desenho`);
        continue;
      }
      const top = Number.isFinite(r.top) ? `${(r.top * 100).toFixed(1)} cm` : 'alta';
      report.push(`${tag}: face a ${((r.gap - near) * 100).toFixed(1)} cm da caixa, beirada ${top}, patas a ${(r.y * 100).toFixed(1)} cm`);
      // o desenho não passa da caixa (o peito entraria nele) nem fica longe demais dela (as patas não alcançam)
      if (r.gap < near - 0.02) bad.push(`${tag}: o desenho passa ${((near - r.gap) * 100).toFixed(1)} cm da caixa de colisão`);
      if (r.gap > near + 0.2) bad.push(`${tag}: o desenho fica ${((r.gap - near) * 100).toFixed(1)} cm atrás da caixa`);
      if (Number.isFinite(r.top) && r.y > r.top + 1e-6) bad.push(`${tag}: patas acima da beirada`);
    }
  } finally {
    for (const fx of worlds.values()) fx.dispose();
  }
  console.log(`[chão] patas no desenho\n  ${report.join('\n  ')}`);
  assert.deepEqual(bad, []);
});

test('empurrando de pé: no ventilador (cano fino, grade no alto) as patas sempre acham onde apoiar, de qualquer lado, desviada ou torta', async () => {
  // retorno do usuário: "nos empurrões no ventilador, tem hora que encosta, tem hora que fica no ar". Com um raio só, no
  // meio da dog, o cano passava ao lado e a medida caía na caixa de colisão (a pata no ar)
  const report = [];
  const bad = [];
  for (const id of ['fase4', 'fase9']) {
    const def = level(id);
    const fx = await buildLevelWorld(def);
    try {
      const obj = fx.built.props.fan.object;
      obj.updateWorldMatrix(true, true);
      const c = obj.getWorldPosition(new THREE.Vector3());
      const half = def.layout.FAN.half;
      let n = 0, round = 0;
      for (const [kind, near, pref, scale] of [['radhija', 0.2, 0.36, 1], ['rhaenyra', 0.245, 0.408, 1.133]]) {
        for (const [dx, dz] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
          for (const lat of [-0.15, -0.06, 0, 0.06, 0.15]) {
            for (const tilt of [-0.25, 0, 0.25]) {
              const at = { x: c.x + dx * (half + near) + (dz ? lat : 0), z: c.z + dz * (half + near) + (dx ? lat : 0), yaw: Math.atan2(-dx, -dz) + tilt };
              const r = pushRest(obj, at, { near, pref: pref * scale, scale });
              n++;
              if (!r) { bad.push(`${id} ${kind} de (${dx}, ${dz}), ${lat} de lado, torta ${tilt}: sem apoio (a pata ficaria no ar)`); continue; }
              if (r.round) round++;
              if (r.gap > near + 0.45) bad.push(`${id} ${kind}: o apoio a ${((r.gap - near) * 100).toFixed(0)} cm além da caixa`);
            }
          }
        }
      }
      report.push(`${id}: ${n} posições, todas com apoio; abraçando o cano em ${round}`);
    } finally {
      fx.dispose();
    }
  }
  console.log(`[chão] ventilador\n  ${report.join('\n  ')}`);
  assert.deepEqual(bad.slice(0, 8), []);
});

test('empurrando de pé: no carrinho da fase 1 as patas vão em cima da beirada (ela fica abaixo da altura das patas)', async () => {
  const def = level('fase1');
  const fx = await buildLevelWorld(def);
  try {
    const { CART } = def.layout;
    const obj = fx.built.props.cart.object;
    fx.root.updateMatrixWorld(true);
    const c = obj.getWorldPosition(new THREE.Vector3());
    const r = pushRest(obj, { x: c.x - CART.halfSize.x - 0.245, z: c.z, yaw: Math.PI / 2 }, { near: 0.245, pref: 0.408, scale: 1.133 });
    assert.ok(r, 'achou o carrinho');
    // a tábua da ponta fica uns 5 cm para dentro da caixa e acaba a ~37,5 cm do chão
    assert.ok(r.gap > 0.245 + 0.02 && r.gap < 0.245 + 0.09, `face da ponta a ${((r.gap - 0.245) * 100).toFixed(1)} cm da caixa`);
    assert.ok(Number.isFinite(r.top) && Math.abs(r.top - 0.375) < 0.02, `beirada a ${(r.top * 100).toFixed(1)} cm`);
    assert.ok(r.top < 0.408 + 0.034, 'mais baixa que as patas: elas vão em cima');
  } finally {
    fx.dispose();
  }
});

test('placas de pisar e caminhas (cenário real): viram chão; longe delas, o chão de sempre', async () => {
  const cases = [['fase2', 'PLANK'], ['fase3', 'PLATE_H'], ['fase6', 'PEDAL'], ['fase6', 'BARRIER_PLATE'], ['fase9', 'DAMPER_PLATE'], ['porcos', 'BUTTON'],
    ['fase2', 'DOG_BED'], ['fase5', 'DOG_BED'], ['fase8', 'DOG_BED'], ['fase9', 'CAT.bed']];
  const report = [];
  const bad = [];
  const worlds = new Map();
  try {
    for (const [id, key] of cases) {
      const def = level(id);
      if (!worlds.has(id)) worlds.set(id, await buildLevelWorld(def));
      const fx = worlds.get(id);
      fx.root.updateMatrixWorld(true);
      const ground = createGround(walkablesOf(fx.root));
      const P = key.split('.').reduce((o, k) => o[k], def.layout);
      const h = ground.heightAt(P.x, P.z);
      const far = ground.heightAt(P.x + 3, P.z + 3);
      report.push(`${id} ${key}: ${(h * 100).toFixed(1)} cm (${ground.count} coisa(s) de pisar na fase)`);
      if (!(h > 0.01 && h < 0.2)) bad.push(`${id} ${key}: alto ${(h * 100).toFixed(1)} cm`);
      if (far !== 0) bad.push(`${id} ${key}: 3 m dela o chão está a ${(far * 100).toFixed(1)} cm`);
    }
  } finally {
    for (const fx of worlds.values()) fx.dispose();
  }
  console.log(`[chão] placas\n  ${report.join('\n  ')}`);
  assert.deepEqual(bad, []);
});

test('modelo novo atravessando uma placa: cada pata pisa em cima dela, o corpo sobe e nada fica dentro dela', async () => {
  const { createDogV2 } = await import('../src/dogs/v2/dog.js');
  // placa de 9 cm (como o pedal da fase 6) a 1 m da dog, marcada para pisar
  const scene = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.09, 0.8), new THREE.MeshBasicMaterial());
  plate.position.set(0, 0.045, 1.2);
  plate.userData.walkable = true;
  scene.add(plate);
  scene.updateMatrixWorld(true);
  const ground = createGround(walkablesOf(scene));
  const PAWS = ['FLp', 'FRp', 'HLp', 'HRp'];
  const report = [];
  const bad = [];
  for (const kind of ['radhija', 'rhaenyra']) {
    withSeed(55, () => {
      const d = createDogV2(kind);
      d.setGround(ground.heightAt);
      let y = 0, z = 0;
      const m = { inside: Infinity, insideAt: '', onTop: 0, lift: 0 };
      for (let f = 0; f < 150; f++) {
        // como no jogo: anda 0,9 m/s para a frente; o chão do objeto vem suavizado do chão embaixo do centro
        z += 0.9 * DT;
        y += (ground.heightAt(0, z) - y) * (1 - Math.exp(-14 * DT));
        d.object.position.set(0, y, z);
        d.update(DT, { speed: 0.9, action: 'none' });
        d.object.updateMatrixWorld(true);
        m.lift = Math.max(m.lift, y);
        d.locomotion.legs.forEach((L, i) => {
          const p = d.bones.find((b) => b.name === PAWS[i]).getWorldPosition(new THREE.Vector3());
          const g = ground.heightAt(p.x, p.z);
          // a articulação da pata apoiada fica acima do chão embaixo dela (a almofadinha, uns 2 cm abaixo dela)
          if (!L.swing && p.y - g < m.inside) { m.inside = p.y - g; m.insideAt = `${PAWS[i]} a ${(p.y * 100).toFixed(1)} cm, chão ${(g * 100).toFixed(1)} cm`; }
          if (!L.swing && g > 0.05) m.onTop++;
        });
      }
      report.push(`${kind}: corpo subiu até ${(m.lift * 100).toFixed(1)} cm; pata apoiada mais baixa em relação ao chão embaixo dela: ${(m.inside * 1000).toFixed(1)} mm (${m.insideAt}); quadros de pata apoiada em cima da placa: ${m.onTop}`);
      if (m.lift < 0.08) bad.push(`${kind}: o corpo não subiu na placa (${(m.lift * 100).toFixed(1)} cm)`);
      if (m.onTop < 40) bad.push(`${kind}: as patas não pisaram em cima da placa (${m.onTop} quadros)`);
      // a articulação da pata apoiada fica ~2 cm acima do chão embaixo dela: menos que 5 mm, a pata entrou
      if (m.inside < 0.005) bad.push(`${kind}: uma pata apoiada entrou na placa (${m.insideAt})`);
    });
  }
  console.log(`[chão] modelo novo na placa\n  ${report.join('\n  ')}`);
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------------------------------------------------------
// Caminhas com borda (2º retorno da prévia do #48: "as caminhas" sem colisão; "deve valer para todas as caminhas ou
// objetos com esse tipo de borda"). A borda alta e fofa (`userData.rim`) não é para pisar com a pata: andando para ela,
// a dog dá um pulinho por cima (ground.planRimHop, game.js hopOverRim) e pousa na almofada; a caminha pequena da fase 2
// é sólida.
// ---------------------------------------------------------------------------------------------------------------
/** Até onde as patas da frente vão à frente do centro (m), como no ground.planRimHop. */
const c0 = (kind) => withStart(kind, { x: 0, z: 0, yaw: 0 }).body.front * 0.8;

/** Uma caminha como a das fases 5 e 8 (borda em toro, almofada no meio), em (0, 0). */
function bedScene(R = 0.62) {
  const scene = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.11, 14, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial());
  rim.scale.set(1, 1.15, 1);
  rim.position.y = 0.11;
  Object.assign(rim.userData, { walkable: true, rim: { r: R - 0.1, t: 0.11 } });
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.12, R - 0.1, 0.08, 32), new THREE.MeshBasicMaterial());
  cushion.position.y = 0.06;
  cushion.userData.walkable = true;
  scene.add(rim, cushion);
  scene.updateMatrixWorld(true);
  return { scene, ground: createGround(walkablesOf(scene)), R };
}

test('caminha com borda: a borda é achada à frente (onde começa e acaba) e o pulinho leva as patas de trás além dela', () => {
  const { ground } = bedScene();
  assert.equal(ground.rims, 1);
  // de fora (leste), andando para o oeste: a borda vai de 0,63 a 0,41 m do meio
  const rim = ground.rimAlong(1.2, 0, -1, 0, 0.16, 0.6);
  assert.ok(rim, 'achou a borda');
  assert.ok(Math.abs(1.2 - rim.start - 0.63) < 0.04 && Math.abs(1.2 - rim.end - 0.41) < 0.04, `de ${rim.start.toFixed(2)} a ${rim.end.toFixed(2)} m`);
  assert.ok(Math.abs(rim.top - 0.236) < 0.01, `alto ${(rim.top * 100).toFixed(1)} cm`);
  assert.equal(ground.rimAlong(1.2, 2, -1, 0, 0.16, 0.6), null, 'passando longe, nada (e nem raio)');
  assert.equal(ground.rimAlong(0, 0, 1, 0, 0.16, 0.2), null, 'no meio, a borda ainda está longe');
  for (const kind of ['radhija', 'rhaenyra']) {
    // andando para o oeste, com as patas da frente a 1–2 cm da borda
    const x0 = 0.63 + c0(kind) + 0.015;
    const c = createController(kind, withStart(kind, { x: x0, z: 0, yaw: -Math.PI / 2 }));
    placeController(c, x0, 0, -Math.PI / 2);
    c.v = c.cfg.walkSpeed;
    const hop = planRimHop(ground, c, 0);
    assert.ok(hop, `${kind}: pula`);
    // pousa com as patas de trás (0,8 da garupa atrás do centro) além da borda, em cima da almofada
    const land = x0 - hop.speed * hop.time;
    assert.ok(land + c.cfg.body.back * 0.8 < 0.41, `${kind}: as patas de trás passam da borda (pousa a ${land.toFixed(2)} m)`);
    assert.ok(Math.abs(hop.g1 - 0.1) < 0.01, `${kind}: o corpo pousa na almofada (${(hop.g1 * 100).toFixed(1)} cm)`);
    assert.ok(hop.height + (hop.g0 + hop.g1) / 2 > 0.236, `${kind}: o arco passa por cima da borda`);
    // indo para um ponto antes da borda (a comemoração perto dela), não pula
    assert.equal(planRimHop(ground, c, 0, { x: x0 - 0.15, z: 0 }), null, `${kind}: o lugar dela fica antes da borda`);
  }
});

test('caminha com borda (modelo novo, como no jogo): pulinho para entrar e para sair, pousa na almofada e nenhuma pata entra no desenho', async () => {
  const { createDogV2 } = await import('../src/dogs/v2/dog.js');
  const { ground } = bedScene();
  const world = createCollisionWorld({ STATIC_COLLIDERS: [], WORLD: { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } } });
  const PAWS = ['FLp', 'FRp', 'HLp', 'HRp'];
  const report = [];
  const bad = [];
  for (const kind of ['radhija', 'rhaenyra']) {
    withSeed(77, () => {
      const c = createController(kind, withStart(kind, { x: 1.4, z: 0.3, yaw: -Math.PI / 2 }));
      placeController(c, 1.4, 0.3, -Math.PI / 2);
      const d = createDogV2(kind);
      d.setGround(ground.heightAt);
      const G = { y: 0, hop: null };
      const m = { hops: 0, stand: Infinity, standAt: '', air: Infinity, drags: 0, inside: null };
      // como o game.js: o pulinho (hopOverRim), o controle, o chão do corpo e a animação
      const frame = (tx, tz) => {
        const dx = tx - c.x, dz = tz - c.z, L = Math.hypot(dx, dz);
        if (!(c.jumpT > 0)) {
          const hop = planRimHop(ground, c, G.y, { x: tx, z: tz });
          if (hop) {
            G.hop = { g0: hop.g0, g1: hop.g1 };
            startHop(c, hop.dx, hop.dz, hop);
            m.hops++;
          }
        }
        steer(c, DT, L > 0.08 ? { dx: dx / L, dz: dz / L, speed: c.cfg.walkSpeed } : { dx: 0, dz: 0, speed: 0 });
        integrate(c, DT, world);
        if (!(c.jumpT > 0)) {
          const p = pushOffRims(ground, c);
          if (p) { c.x = p.x; c.z = p.z; }
        }
        let gy = bodyGround(ground, c.x, c.z, c.yaw, c.cfg.body);
        if (G.hop && c.jumpT > 0 && c.hopH > 0) gy = G.hop.g0 + (G.hop.g1 - G.hop.g0) * (1 - c.jumpT / c.jumpDur);
        else G.hop = null;
        G.y += (gy - G.y) * (1 - Math.exp(-14 * DT));
        d.object.position.set(c.x, G.y, c.z);
        d.object.rotation.y = c.yaw;
        d.update(DT, { speed: c.animSpeed, turn: c.yawRate, action: c.jumpT > 0 ? 'jump' : 'none', jump: c.y, airK: c.jumpT > 0 ? 1 - c.jumpT / c.jumpDur : -1 });
        d.object.updateMatrixWorld(true);
        d.locomotion.legs.forEach((Lg, i) => {
          const p = d.bones.find((b) => b.name === PAWS[i]).getWorldPosition(new THREE.Vector3());
          const gap = p.y - ground.heightAt(p.x, p.z); // a articulação da pata fica ~2 cm acima da sola
          if (Lg.dragged) m.drags++;
          if (c.jumpT > 0 || Lg.swing) m.air = Math.min(m.air, gap);
          else if (d.gait > 0.5 && gap < m.stand) { m.stand = gap; m.standAt = PAWS[i]; }
        });
      };
      for (let f = 0; f < 150; f++) frame(0, 0);
      m.inside = { r: Math.hypot(c.x, c.z), y: G.y };
      for (let f = 0; f < 150; f++) frame(1.5, 0);
      report.push(`${kind}: ${m.hops} pulinho(s); dentro a ${(m.inside.r * 100).toFixed(0)} cm do meio com o corpo a ${(m.inside.y * 100).toFixed(1)} cm; fora a ${(Math.hypot(c.x, c.z) * 100).toFixed(0)} cm; pata apoiada a ${(m.stand * 1000).toFixed(0)} mm do chão embaixo dela (${m.standAt}); no ar, ${(m.air * 1000).toFixed(0)} mm; arrastada ${m.drags} quadro(s)`);
      if (m.hops !== 2) bad.push(`${kind}: ${m.hops} pulinho(s) (um para entrar e um para sair)`);
      if (m.inside.r > 0.3 || Math.abs(m.inside.y - 0.1) > 0.01) bad.push(`${kind}: dentro, a ${(m.inside.r * 100).toFixed(0)} cm do meio e o corpo a ${(m.inside.y * 100).toFixed(1)} cm`);
      if (Math.hypot(c.x, c.z) < 1.2) bad.push(`${kind}: não saiu da caminha`);
      if (m.stand < 0.005) bad.push(`${kind}: uma pata apoiada entrou no desenho (${(m.stand * 1000).toFixed(0)} mm, ${m.standAt})`);
      if (m.air < -0.035) bad.push(`${kind}: no pulinho uma pata passou ${(-m.air * 100).toFixed(1)} cm por dentro da borda`);
      if (m.drags > 15) bad.push(`${kind}: pata arrastada ${m.drags} quadros`);
    });
  }
  console.log(`[chão] caminha com borda\n  ${report.join('\n  ')}`);
  assert.deepEqual(bad, []);
});

test('caminhas do cenário real: as das fases 5 e 8 têm borda para o pulinho; a da fase 2, pequena, é sólida (elas a contornam)', async () => {
  for (const id of ['fase5', 'fase8']) {
    const def = level(id);
    const fx = await buildLevelWorld(def);
    try {
      fx.root.updateMatrixWorld(true);
      const ground = createGround(walkablesOf(fx.root));
      const B = def.layout.DOG_BED;
      assert.ok(ground.rims >= 1, `${id}: a borda da caminha está marcada`);
      // de 1,2 m do meio, andando para ele, a borda aparece à frente
      let found = null;
      for (let k = 0; k < 8 && !found; k++) {
        const a = (k / 8) * Math.PI * 2;
        found = ground.rimAlong(B.x + Math.sin(a) * 1.2, B.z + Math.cos(a) * 1.2, -Math.sin(a), -Math.cos(a), 0.16, 0.7);
      }
      assert.ok(found && found.top > 0.15, `${id}: borda à frente (${JSON.stringify(found)})`);
    } finally {
      fx.dispose();
    }
  }
  // fase 2: andando para a caminha (de leste e de sul), as duas param encostadas nela, sem entrar
  const L2 = level('fase2').layout;
  const B = L2.DOG_BED;
  const world = createCollisionWorld(L2);
  for (const kind of ['radhija', 'rhaenyra']) {
    for (const [sx, sz] of [[1, 0], [0, 1]]) {
      const c = createController(kind, L2.DOGS[kind]);
      placeController(c, B.x + sx * 1.0, B.z + sz * 0.9, Math.atan2(-sx, -sz));
      for (let f = 0; f < 120; f++) {
        steer(c, DT, { dx: -sx, dz: -sz, speed: c.cfg.walkSpeed });
        integrate(c, DT, world);
      }
      const into = sx ? B.x + B.w / 2 - (c.x - c.r) : B.z + B.d / 2 - (c.z - c.r);
      assert.ok(into < 0.05, `${kind} vindo de ${sx ? 'leste' : 'sul'}: parou encostada (entrou ${(into * 100).toFixed(1)} cm)`);
    }
  }
});

test('caminha com borda: montada antes do primeiro quadro (o grupo posto no lugar dela ainda sem a posição no mundo), vira chão no lugar certo', () => {
  // retorno do usuário na prévia 165dcb0: no jogo as dogs subiam na borda e não pulavam. O jogo monta o chão logo depois
  // de construir a fase, e o círculo de cada desenho era medido com o grupo da caminha ainda na origem
  const root = new THREE.Group();
  const grp = new THREE.Group();
  grp.position.set(4.3, 0, 1.75);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.11, 14, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial());
  rim.position.y = 0.11;
  Object.assign(rim.userData, { walkable: true, rim: { r: 0.52, t: 0.11 } });
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.08, 32), new THREE.MeshBasicMaterial());
  cushion.position.y = 0.06;
  cushion.userData.walkable = true;
  grp.add(rim, cushion);
  root.add(grp);
  // sem root.updateMatrixWorld: como no jogo
  const ground = createGround(walkablesOf(root));
  assert.ok(Math.abs(ground.heightAt(4.3, 1.75) - 0.1) < 0.005, `almofada a ${(ground.heightAt(4.3, 1.75) * 100).toFixed(1)} cm`);
  assert.ok(ground.heightAt(4.3 + 0.52, 1.75) > 0.2, 'a borda no lugar dela');
  assert.equal(ground.heightAt(0, 0), 0, 'nada na origem');
  assert.ok(ground.rimAlong(4.3 + 1.0, 1.75, -1, 0, 0.16, 0.5), 'a borda à frente de quem vem do leste');
  assert.deepEqual(ground.rings.map((g) => [+g.x.toFixed(2), +g.z.toFixed(2), g.r, g.t]), [[4.3, 1.75, 0.52, 0.11]]);
});

test('caminha com borda: do lado de fora, a borda segura o corpo de quem está no chão; dentro, livre', () => {
  const { ground } = bedScene(); // anel em 0,52 m, meia largura 0,11: a borda vai de 0,41 a 0,63
  for (const kind of ['radhija', 'rhaenyra']) {
    const cfg = withStart(kind, { x: 0, z: 0, yaw: 0 });
    const b = cfg.body;
    const c = createController(kind, cfg);
    // de fora, de frente para a caminha, com o peito em cima da borda: vai para fora até o peito sair
    placeController(c, 0.7, 0, -Math.PI / 2);
    const p = pushOffRims(ground, c);
    assert.ok(p, `${kind}: empurrada`);
    const chest = p.x - (b.front - b.r);
    assert.ok(chest - b.r >= 0.63 - 0.005, `${kind}: o peito fora da borda (borda dele em ${(chest - b.r).toFixed(3)})`);
    assert.ok(Math.abs(p.z) < 1e-9, `${kind}: para fora, a partir do meio da caminha`);
    // de lado, rente à borda, com a garupa em cima dela
    placeController(c, 0, 0.66, Math.PI / 2);
    const q = pushOffRims(ground, c);
    assert.ok(q && Math.hypot(q.x, q.z) > 0.66, `${kind}: rente à borda, vai para fora`);
    // longe dela, nada; dentro (na almofada, mesmo com a cabeça na borda), livre
    placeController(c, 2, 0, 0);
    assert.equal(pushOffRims(ground, c), null, `${kind}: longe`);
    placeController(c, 0.15, 0, Math.PI / 2);
    assert.equal(pushOffRims(ground, c), null, `${kind}: dentro, livre`);
  }
});

test('caminha com borda (modelo novo): passando de lado rente a ela e empurrada pela irmã, ninguém fica em cima da borda', async () => {
  const { createDogV2 } = await import('../src/dogs/v2/dog.js');
  const { ground } = bedScene();
  const world = createCollisionWorld({ STATIC_COLLIDERS: [], WORLD: { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } } });
  /** O corpo (meio, peito e garupa) em cima da borda, de fora (a borda vai de 0,41 a 0,63 m do meio). */
  const onRim = (c) => {
    const b = c.cfg.body, sx = Math.sin(c.yaw), sz = Math.cos(c.yaw);
    if (Math.hypot(c.x, c.z) < 0.52) return 0;
    return Math.max(...[[0, c.r], [b.front - b.r, b.r], [b.r - b.back, b.r]].map(([o, rr]) => 0.63 + rr - Math.hypot(c.x + sx * o, c.z + sz * o)));
  };
  const bad = [];
  for (const kind of ['radhija', 'rhaenyra']) {
    withSeed(91, () => {
      const c = createController(kind, withStart(kind, { x: -1.2, z: 0.75, yaw: Math.PI / 2 }));
      placeController(c, -1.2, 0.75, Math.PI / 2);
      const d = createDogV2(kind);
      d.setGround(ground.heightAt);
      let worst = 0, hops = 0;
      const frame = (intent, nudge = null) => {
        if (!(c.jumpT > 0) && intent.speed > 0.05) {
          const hop = planRimHop(ground, c, 0);
          if (hop) { startHop(c, hop.dx, hop.dz, hop); hops++; }
        }
        steer(c, DT, intent);
        integrate(c, DT, world);
        if (nudge) { c.x += nudge[0]; c.z += nudge[1]; } // a irmã cedendo espaço (separate) empurra para a borda
        if (!(c.jumpT > 0)) {
          const p = pushOffRims(ground, c);
          if (p) { c.x = p.x; c.z = p.z; }
          worst = Math.max(worst, onRim(c));
        }
        d.object.position.set(c.x, bodyGround(ground, c.x, c.z, c.yaw, c.cfg.body), c.z);
        d.object.rotation.y = c.yaw;
        d.update(DT, { speed: c.animSpeed, turn: c.yawRate, action: c.jumpT > 0 ? 'jump' : 'none', jump: c.y, airK: c.jumpT > 0 ? 1 - c.jumpT / c.jumpDur : -1 });
      };
      // passando de lado, rente à caminha (o corpo raspa na borda)
      for (let f = 0; f < 90; f++) frame({ dx: 1, dz: 0, speed: c.cfg.walkSpeed });
      for (let f = 0; f < 20; f++) frame({ dx: 0, dz: 0, speed: 0 });
      // parada ao lado, empurrada para a caminha (como a companheira que cede espaço à irmã que está dentro)
      placeController(c, 0, 0.9, Math.PI / 2);
      for (let f = 0; f < 60; f++) frame({ dx: 0, dz: 0, speed: 0 }, [0, -0.01]);
      if (hops) bad.push(`${kind}: pulou sem andar para a caminha (${hops})`);
      if (worst > 0.005) bad.push(`${kind}: o corpo ficou ${(worst * 100).toFixed(1)} cm em cima da borda`);
    });
  }
  assert.deepEqual(bad, []);
});
