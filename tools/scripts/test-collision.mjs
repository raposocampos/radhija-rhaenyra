// Testes das funções de colisão e navegação (Node puro).
//   node tools/scripts/test-collision.mjs
import {
  penCircleBox, penCircleCircle, penCircleSegment, gateTip, createCollisionWorld,
} from '../../src/game/collision.js';
import { createNavigator } from '../../src/game/navigation.js';
import LAYOUT from '../../src/level/layout.js';

let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log(`  ok  ${msg}`); } else { fail++; console.log(`  FALHOU  ${msg}`); }
}
const near = (a, b, e = 1e-3) => Math.abs(a - b) < e;

const { DOGS, FENCE, CART } = LAYOUT;
const R = DOGS.radhija.radius;
const H = DOGS.rhaenyra.radius;

console.log('primitivas');
{
  const p = penCircleBox(0, 1.1, 0.2, 0, 0, 1, 1);
  ok(p && near(p.nz, 1) && near(p.depth, 0.1), 'círculo × caixa: face');
  ok(penCircleBox(0, 1.3, 0.2, 0, 0, 1, 1) === null, 'círculo × caixa: sem contato');
  const c = penCircleBox(1.1, 1.1, 0.2, 0, 0, 1, 1);
  ok(c && near(c.nx, Math.SQRT1_2) && near(c.nz, Math.SQRT1_2), 'círculo × caixa: quina (normal diagonal)');
  const inside = penCircleBox(0.9, 0, 0.2, 0, 0, 1, 1);
  ok(inside && near(inside.nx, 1) && near(inside.depth, 0.3), 'círculo × caixa: centro dentro sai pelo lado mais próximo');
  const cc = penCircleCircle(0.3, 0, 0.2, 0, 0, 0.2);
  ok(cc && near(cc.nx, 1) && near(cc.depth, 0.1), 'círculo × círculo');
  const s = penCircleSegment(0.1, 0.5, 0.2, 0, 0, 0, 1, 0.05);
  ok(s && near(s.nx, 1) && near(s.depth, 0.15), 'círculo × segmento com espessura');
  const se = penCircleSegment(0, 1.2, 0.2, 0, 0, 0, 1, 0.05);
  ok(se && near(se.nz, 1) && near(se.depth, 0.05), 'círculo × ponta do segmento (arredondada)');
}

console.log('portão');
{
  const closed = gateTip(FENCE, 0);
  ok(near(closed.x, FENCE.gate.latchPost.x) && near(closed.z, FENCE.gate.latchPost.z), 'fechado: ponta no poste do trinco');
  const open = gateTip(FENCE, 1);
  ok(near(open.x, 2.18, 0.02) && near(open.z, 2.61, 0.02), `aberto: ponta ≈ (2.18, 2.61) → (${open.x.toFixed(2)}, ${open.z.toFixed(2)})`);
}

console.log('mundo');
const world = createCollisionWorld(LAYOUT);
// Dinâmicos da fase 1 (antes embutidos no mundo; agora registrados pelo puzzle da fase)
const { FENCE: F1F, CART: F1C } = LAYOUT;
const gateCol = world.addDynamic({ id: 'gate', kind: 'gate', shape: 'segment', ax: F1F.gate.hinge.x, az: F1F.gate.hinge.z, bx: F1F.gate.latchPost.x, bz: F1F.gate.latchPost.z, t: 0.05 });
const cartCol = world.addDynamic({ id: 'cart', kind: 'cart', shape: 'box', x: F1C.start.x, z: F1C.start.z, hx: F1C.halfSize.x, hz: F1C.halfSize.z });
world.setGate = (t) => { const tip = gateTip(F1F, t); gateCol.bx = tip.x; gateCol.bz = tip.z; };
world.setCartX = (x) => { cartCol.x = x; };
{
  // Radhija atravessa a abertura; Rhaenyra não.
  let r = world.move(0.5, FENCE.gap.center, 1.2, 0, R, 'small');
  ok(r.x > 1.5, `Radhija passa pela abertura (x final ${r.x.toFixed(2)})`);
  r = world.move(0.5, FENCE.gap.center, 1.2, 0, H, 'large');
  ok(r.x < 1.0 - 0.07 - H + 0.01, `Rhaenyra bloqueada na abertura (x final ${r.x.toFixed(2)})`);
  ok(r.hits.some((h) => h.id === 'abertura-bloqueio-grande'), 'contato reporta o bloqueio da abertura');

  // Portão fechado bloqueia as duas; aberto deixa passar.
  world.setGate(0);
  r = world.move(0.4, 1.8, 1.5, 0, R, 'small');
  ok(r.x < 1.0, `portão fechado bloqueia a Radhija (x ${r.x.toFixed(2)})`);
  r = world.move(0.4, 1.8, 1.5, 0, H, 'large');
  ok(r.x < 1.0, `portão fechado bloqueia a Rhaenyra (x ${r.x.toFixed(2)})`);
  world.setGate(1);
  r = world.move(0.4, 1.75, 1.5, 0, H, 'large');
  ok(r.x > 1.6, `portão aberto: Rhaenyra passa (x ${r.x.toFixed(2)})`);
  // Folha aberta bloqueia a passagem para o sul do lado leste
  r = world.move(1.6, 2.0, 0, 1.2, H, 'large');
  ok(r.z < 2.45, `folha aberta funciona como parede (z ${r.z.toFixed(2)})`);
  world.setGate(0);

  // Arrancada (passo grande num único quadro) não atravessa a cerca fina.
  for (const step of [0.3, 0.6, 1.2, 3.0]) {
    r = world.move(0.6, -0.5, step, 0, R, 'small');
    ok(r.x < 1.0, `arrancada de ${step} m/quadro não atravessa a cerca (x ${r.x.toFixed(3)})`);
  }
  r = world.move(0.6, 1.8, 3.0, 0, R, 'small');
  ok(r.x < 1.0, 'arrancada não atravessa o portão fechado');

  // Carrinho: bloqueia; deslizar ao longo dele.
  r = world.move(3.4, -2.25, 1.0, 0, H, 'large');
  ok(near(r.x, CART.start.x - CART.halfSize.x - H, 0.01), `carrinho bloqueia (x ${r.x.toFixed(3)})`);
  r = world.move(3.4, -1.75, 1.2, -0.2, R, 'small');
  ok(r.x > 4.3, `desliza ao longo da face do carrinho (x ${r.x.toFixed(2)}, z ${r.z.toFixed(2)})`);
  world.setCartX(5.4);
  ok(!world.overlaps(4.4, -3.0, H, 'large'), 'carrinho movido: nicho livre para a Rhaenyra');
  world.setCartX(CART.start.x);
  ok(world.overlaps(4.4, -2.25, H, 'large'), 'carrinho no início: ocupa a entrada do nicho');

  // Deslizar ao longo de parede (não gruda)
  r = world.move(0.5, -1.0, 0.6, 0.6, R, 'small');
  ok(r.z > -0.5 && r.x < 1.0, `desliza ao longo da cerca (z ${r.z.toFixed(2)})`);

  // Limites
  r = world.move(-5.7, 4.2, -3, 3, R, 'small');
  ok(r.x >= -6.0 + R - 1e-6 && r.z <= 4.5 - R + 1e-6, 'limites do mundo respeitados');

  // Círculos (bebedouro)
  r = world.move(2.5, -0.6, 1.5, 0, R, 'small');
  ok(r.x < 3.4 - 0.32 - R + 0.01, 'bebedouro bloqueia');

  // Linha de visão
  ok(!world.segmentClear(-1, -1, 3, -1, R * 0.9, 'small'), 'LOS bloqueada pela cerca');
  ok(world.segmentClear(-3, -2.1, 3, -2.1, R * 0.9, 'small'), 'LOS pela abertura (Radhija, centralizada)');
  ok(!world.segmentClear(-3, -2.1, 3, -2.1, H * 0.9, 'large'), 'LOS pela abertura bloqueada (Rhaenyra)');

  // Sem penetração residual após resolver de dentro de um obstáculo
  const res = world.resolve(3.2, -3.0, R, 'small');
  ok(!world.overlaps(res.x, res.z, R - 1e-3, 'small'), 'resolver tira de dentro da horta');
}

console.log('navegação');
{
  const nav = createNavigator(LAYOUT, world);
  world.setGate(0);
  world.setCartX(CART.start.x);
  const westPos = { x: -2.0, z: -1.0 };
  const eastPos = { x: 1.6, z: 0.8 };
  let p = nav.findPath(westPos, eastPos, { r: H, size: 'large', flags: { gateOpen: false, cartMoved: false } });
  ok(!p.reachable && p.waitNode, `Rhaenyra, portão fechado: inalcançável, espera em ${p.waitNode}`);
  ok(p.waitNode === 'W_gate', 'espera no nó do portão (mais próximo da líder)');
  p = nav.findPath(westPos, eastPos, { r: R, size: 'small', flags: { gateOpen: false, cartMoved: false } });
  ok(p.reachable && p.waypoints.some((w) => w.id === 'E_gap'), `Radhija passa pela abertura: ${p.waypoints.map((w) => w.id).join('→')}`);
  world.setGate(1);
  p = nav.findPath(westPos, eastPos, { r: H, size: 'large', flags: { gateOpen: true, cartMoved: false } });
  ok(p.reachable && p.waypoints.some((w) => w.id === 'E_gate'), `Rhaenyra, portão aberto: ${p.waypoints.map((w) => w.id).join('→')}`);
  p = nav.findPath({ x: 4.4, z: -1.3 }, { x: 4.4, z: -3.8 }, { r: H, size: 'large', flags: { gateOpen: true, cartMoved: false } });
  ok(!p.reachable, 'nicho inalcançável com o carrinho no lugar');
  world.setCartX(5.5);
  p = nav.findPath({ x: 4.4, z: -1.3 }, { x: 4.4, z: -3.8 }, { r: H, size: 'large', flags: { gateOpen: true, cartMoved: true } });
  ok(p.reachable, 'nicho alcançável com o carrinho movido');
  p = nav.findPath({ x: -3.0, z: -3.0 }, { x: -2.0, z: -2.0 }, { r: R, size: 'small', flags: { gateOpen: false, cartMoved: false } });
  ok(p.direct, 'linha reta quando livre');
  world.setGate(0);
  world.setCartX(CART.start.x);
  const n = nav.nearestReachableNode({ x: -2, z: -1 }, eastPos, { r: H, size: 'large', flags: { gateOpen: false, cartMoved: false } });
  ok(n && n.id.startsWith('W_'), `reposicionamento fica do lado alcançável (${n && n.id})`);
}

console.log(`\n${pass} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
