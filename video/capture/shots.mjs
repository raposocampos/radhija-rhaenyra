// Cenas do trailer: cada uma abre uma fase, prepara o momento (etapa, posições, atalhos de depuração que os scripts
// de captura já usam) e grava com teclas reais e uma câmera de cinema. Só as mecânicas que o jogo apresenta e as
// animações comuns das dogs.
// Câmeras: (t, H, a) => { pos, look, fov? } rodando na página (t em s desde r.camera; a = argumentos). Ver
// page-helpers.js (H.path, H.orbit, H.follow). `vertical`: grava também em 1080×1920 (corte 9:16), com `pull` (a
// câmera recua) e `vfov` (campo vertical) próprios do retrato.
const PI = Math.PI;
const kick = (c) => ({ x: c.x + c.nx * 0.5 - c.nz * 0.14, z: c.z + c.nz * 0.5 + c.nx * 0.14, yaw: Math.atan2(-c.nx, -c.nz) });
const pathCam = (t, H, a) => H.path(t, a.keys, a.ease);

/** Câmera de quadros-chave (o mais comum). */
async function keysCam(r, keys, extra = {}) {
  await r.camera(pathCam, { keys, ...extra });
}

export const SHOTS = {
  // ---------------------------------------------------------------- abertura (fase 1, jardim ao entardecer)
  abertura: {
    level: '1',
    async run(r) {
      // as duas na porta de casa, viradas para o jardim; a câmera desce devagar até elas
      await r.setup({ active: 'radhija', place: { radhija: { x: -3.2, z: -3.55, yaw: 0.55 }, rhaenyra: { x: -3.85, z: -3.7, yaw: 0.75 } }, settle: 90 });
      const c = [-3.5, 0.3, -3.62];
      await keysCam(r, [
        { at: 0, pos: [c[0] + 2.5, 1.75, c[2] + 3.9], look: [c[0] + 0.2, 0.55, c[2]], fov: 40 },
        { at: 9, pos: [c[0] + 1.15, 0.62, c[2] + 1.9], look: [c[0], 0.32, c[2]], fov: 34 },
      ]);
      await r.record(3.0);
      await r.tap('KeyE'); // latidinho
      await r.record(6.2);
    },
  },
  'retrato-radhija': {
    level: '1',
    vertical: { pull: 1.0 },
    async run(r) {
      const p = { x: -3.0, z: -3.3 };
      await r.setup({ active: 'radhija', place: { radhija: { ...p, yaw: 0.7 }, rhaenyra: { x: -0.9, z: -1.2, yaw: 3.6 } }, stay: 'rhaenyra', settle: 60 });
      await r.camera((t, H, a) => {
        const k = H.inOut(Math.min(1, t / 4.5));
        return { ...H.orbit(a.c, a.a0 + (a.a1 - a.a0) * k, 0.95 - 0.12 * k, 0.44 - 0.06 * k, 0.27), fov: 30 };
      }, { c: [p.x, 0.27, p.z], a0: 0.25, a1: 0.95 });
      await r.record(1.6);
      await r.tap('KeyE');
      await r.record(3.2);
    },
  },
  'retrato-rhaenyra': {
    level: '1',
    vertical: { pull: 1.0 },
    async run(r) {
      const p = { x: -3.0, z: -3.3 };
      await r.setup({ active: 'rhaenyra', place: { rhaenyra: { ...p, yaw: 0.7 }, radhija: { x: -0.9, z: -1.2, yaw: 3.6 } }, stay: 'radhija', settle: 60 });
      await r.camera((t, H, a) => {
        const k = H.inOut(Math.min(1, t / 4.5));
        return { ...H.orbit(a.c, a.a0 + (a.a1 - a.a0) * k, 1.25 - 0.15 * k, 0.6 - 0.08 * k, 0.38), fov: 30 };
      }, { c: [p.x, 0.38, p.z], a0: 1.1, a1: 0.45 });
      await r.record(1.8);
      await r.tap('KeyE');
      await r.record(3.0);
    },
  },
  'coop-portao': {
    level: '1',
    async run(r) {
      // a Radhija puxa a cordinha do portão (de ré); a Rhaenyra espera do outro lado e passa
      await r.setup({ active: 'radhija', place: { radhija: { x: 1.75, z: 0.95, yaw: -PI / 2 }, rhaenyra: { x: -0.15, z: 1.8, yaw: PI / 2 } }, settle: 90 });
      await keysCam(r, [
        { at: 0, pos: [2.9, 1.25, 3.3], look: [1.0, 0.42, 1.25], fov: 38 },
        { at: 5, pos: [2.5, 1.05, 3.0], look: [0.8, 0.38, 1.3], fov: 36 },
      ]);
      await r.record(0.4);
      await r.tap('KeyE');
      await r.recordUntil((i) => i.rope?.phase === 'hold', 2.5);
      await r.keys(['KeyD'], true);
      await r.recordUntil((i) => i.stage === 'gateOpen', 3.0);
      await r.up('KeyD');
      r.mark('aberto');
      await r.record(2.4);
    },
  },

  // ---------------------------------------------------------------- Radhija: superbafo, arrancada, vãos
  superbafo: {
    level: '4',
    vertical: { pull: 1.35 },
    async run(r, L) {
      const P = L.NAP_PIGEON;
      await r.setup({ active: 'radhija', place: { radhija: { x: P.x - 0.95, z: P.z, yaw: PI / 2 }, rhaenyra: { x: P.x - 2.3, z: P.z + 0.3, yaw: PI / 2 } }, stay: 'rhaenyra', settle: 40 });
      const m = [P.x - 0.45, 0.2, P.z];
      await keysCam(r, [
        { at: 0, pos: [m[0] - 0.35, 0.5, m[2] + 1.25], look: m, fov: 36 },
        { at: 4.5, pos: [m[0] + 0.05, 0.62, m[2] + 1.1], look: [m[0] + 0.25, 0.32, m[2]], fov: 38 },
      ]);
      await r.record(0.8);
      await r.key('KeyR', true);
      r.mark('mira');
      await r.record(0.5);
      await r.up('KeyR');
      r.mark('sopro');
      await r.recordUntil((i) => i.nap && i.nap !== 'asleep', 2.5);
      r.mark('pombo');
      await r.record(2.2);
    },
  },
  arrancada: {
    level: 'fase7',
    vertical: { pull: 1.45 },
    async run(r, L) {
      // escorregador: sobe com a arrancada, pega o frisbee e desce de barriga
      await r.setup({ stage: 'clean', active: 'radhija', place: { radhija: { x: L.SLIDE_ENTRY.minX - 0.25, z: L.SLIDE.z, yaw: PI / 2 } }, stay: 'rhaenyra', settle: 20 });
      const cx = (L.SLIDE.x0 + L.SLIDE.x1) / 2 + 0.3;
      await keysCam(r, [
        { at: 0, pos: [cx - 0.5, 1.0, L.SLIDE.z + 2.3], look: [cx - 0.5, 0.5, L.SLIDE.z], fov: 38 },
        { at: 4.5, pos: [cx + 0.2, 1.15, L.SLIDE.z + 2.1], look: [cx + 0.2, 0.62, L.SLIDE.z], fov: 38 },
      ]);
      await r.record(0.5);
      await r.key('KeyD', true);
      await r.record(1 / 30);
      await r.key('ShiftLeft', true);
      await r.record(1 / 30);
      await r.up('ShiftLeft');
      r.mark('arrancada');
      await r.recordUntil((i) => !!i.lambe?.slide, 1.5);
      await r.up('KeyD');
      await r.recordUntil((i) => i.lambe?.slide?.phase === 'grab', 3);
      r.mark('frisbee');
      await r.recordUntil((i) => !i.lambe?.slide, 4, 0.7);
    },
  },
  'arrancada-meia': {
    level: 'fase8',
    async run(r, L) {
      // lavanderia: a Rhaenyra já baixou o varal; a arrancada da Radhija solta a meia do pregador
      await r.setup({ stage: 'start', active: 'rhaenyra', place: { rhaenyra: { x: L.RACK.x - 0.14, z: L.RACK.z + 0.6, yaw: PI }, radhija: { x: L.SOCK.x, z: L.SOCK.z + 1.25, yaw: PI } }, stay: 'radhija' });
      await r.tap('Space');
      await r.until((i) => i.lavanderia?.rackDown, 200);
      await r.setup({ active: 'radhija', place: { radhija: { x: L.SOCK.x, z: L.SOCK.z + 1.25, yaw: PI } }, settle: 6 });
      await keysCam(r, [
        { at: 0, pos: [L.SOCK.x + 1.4, 0.75, L.SOCK.z + 1.3], look: [L.SOCK.x, 0.42, L.SOCK.z + 0.35], fov: 38 },
        { at: 3, pos: [L.SOCK.x + 1.15, 0.7, L.SOCK.z + 1.0], look: [L.SOCK.x, 0.42, L.SOCK.z + 0.2], fov: 38 },
      ]);
      await r.record(0.4);
      await r.key('KeyW', true);
      await r.record(0.15);
      await r.key('ShiftLeft', true);
      await r.record(1 / 30);
      await r.up('ShiftLeft');
      r.mark('arrancada');
      await r.recordUntil((i) => i.sock?.holder === 'radhija', 2);
      await r.up('KeyW');
      await r.record(1.4);
    },
  },
  vao: {
    level: 'fase7',
    async run(r, L) {
      // só a Radhija cabe no túnel de lama: entra limpinha e sai enlameada
      const T = L.TUNNEL;
      await r.setup({ stage: 'start', active: 'radhija', place: { radhija: { x: T.x0 - 0.35, z: T.z, yaw: PI / 2 }, rhaenyra: { x: T.x0 - 1.3, z: T.z + 0.55, yaw: PI / 2 } }, stay: 'rhaenyra', settle: 30 });
      await keysCam(r, [
        { at: 0, pos: [T.x1 + 1.45, 0.62, T.z + 0.6], look: [T.x1 - 0.3, 0.2, T.z], fov: 38 },
        { at: 5, pos: [T.x1 + 1.2, 0.5, T.z + 0.75], look: [T.x1 + 0.1, 0.22, T.z], fov: 36 },
      ]);
      await r.drive(T.x1 + 0.75, T.z + 0.15, { tol: 0.12, maxSec: 6 });
      await r.record(5.0);
    },
  },

  // ---------------------------------------------------------------- Rhaenyra: impulso na parede, empurrão em pé, pulo
  parede: {
    level: 'fase8',
    vertical: { pull: 1.3 },
    async run(r, L) {
      const S = L.SPIN;
      const W = L.WASHER;
      await r.setup({ stage: 'start', active: 'rhaenyra', place: { rhaenyra: { x: S.x - 0.14, z: S.z + 0.62, yaw: PI }, radhija: { x: -3.6, z: -0.5, yaw: 1.5 } }, stay: 'radhija' });
      await r.ev((c) => { window.__game.game.puzzle.placeBasket(c.x, c.z); window.__step(2); }, L.CATCH);
      await keysCam(r, [
        { at: 0, pos: [S.x + 1.05, 1.05, S.z + 1.85], look: [S.x - 0.15, 0.82, S.z + 0.2], fov: 38 },
        { at: 1.7, pos: [S.x + 0.95, 1.15, S.z + 1.75], look: [S.x - 0.15, 0.9, S.z + 0.2], fov: 38 },
        { at: 4.2, pos: [W.x + 1.0, 1.05, W.z + 1.9], look: [W.x, 0.55, W.z + 0.35], fov: 38 },
      ]);
      await r.record(0.35);
      await r.key('Space', true);
      await r.record(1 / 30);
      await r.up('Space');
      r.mark('pulo');
      await r.recordUntil((i) => (i.dogs.rhaenyra.wall?.k ?? 0) >= 0.52, 1.5);
      r.mark('botao');
      await r.recordUntil((i) => i.lavanderia?.blanket === 'falling', 4);
      r.mark('mantinha');
      await r.recordUntil((i) => i.lavanderia?.blanket && i.lavanderia.blanket !== 'falling', 2.5, 0.8);
    },
  },
  empurrao: {
    level: 'fase10',
    vertical: { pull: 1.3 },
    async run(r, L) {
      // a piñata enroscada no alto da mangueira: a Rhaenyra fica de pé e empurra o tronco até ela descer
      const MS = L.MANGO_SHOVE;
      await r.setup({ stage: 'cake4', active: 'rhaenyra', place: { rhaenyra: { x: MS.x + MS.nx * 0.55, z: MS.z + MS.nz * 0.55, yaw: Math.atan2(-MS.nx, -MS.nz) }, radhija: { x: MS.x - 1.9, z: MS.z + 0.3, yaw: 1 } }, stay: 'radhija', settle: 20 });
      const toTrunk = await r.keysFor(-MS.nx, -MS.nz);
      await keysCam(r, [
        { at: 0, pos: [MS.x - 1.05, 1.15, MS.z + 1.75], look: [MS.x + 0.1, 0.75, MS.z], fov: 38 },
        { at: 2.2, pos: [MS.x - 1.15, 1.3, MS.z + 1.95], look: [MS.x + 0.05, 0.9, MS.z], fov: 38 },
        { at: 3.6, pos: [MS.x - 1.4, 1.55, MS.z + 2.6], look: [MS.x - 1.0, 1.55, MS.z - 0.7], fov: 40 },
      ]);
      await r.record(0.3);
      await r.keys([...toTrunk, 'ShiftLeft'], true);
      await r.recordUntil((i) => !!i.dogs.rhaenyra.shove, 2);
      r.mark('de-pe');
      await r.recordUntil((i) => i.quintal?.pinata?.stage === 'slide', 4);
      r.mark('escorrega');
      await r.recordUntil((i) => i.quintal?.pinata?.stage === 'drop', 2);
      await r.keys([...toTrunk, 'ShiftLeft'], false);
      await r.record(1.3);
    },
  },
  pulo: {
    level: '5',
    async run(r, L) {
      // a Rhaenyra pula o portãozinho de bebê (câmera do jogo)
      const W = L.WALL_SH;
      await r.setup({ active: 'rhaenyra', place: { rhaenyra: { x: W.x - 1.3, z: 0.4, yaw: PI / 2 }, radhija: { x: W.x - 1.9, z: 0.95, yaw: PI / 2 } }, stay: 'radhija', settle: 40 });
      await r.camera(null);
      const keys = await r.keysFor(1, 0);
      await r.record(0.3);
      await r.keys(keys, true);
      for (let k = 0; k < 45; k++) {
        await r.record(1 / 30);
        const d = await r.dog('rhaenyra');
        if (d.cx >= W.x - 0.62) break;
      }
      await r.key('Space', true);
      await r.record(1 / 30);
      await r.up('Space');
      r.mark('pulo');
      await r.record(0.9);
      await r.keys(keys, false);
      await r.record(1.2);
    },
  },
  lambe: {
    level: 'fase7',
    vertical: { pull: 1.25 },
    async run(r) {
      // Lambe-Lambe: a Rhaenyra limpa a lama da irmã; ela se sacode e brilha
      const C = { x: 1.0, z: -0.45 };
      await r.setup({ stage: 'muddy', active: 'rhaenyra', place: { radhija: { x: C.x, z: C.z, yaw: PI / 2 }, rhaenyra: { x: C.x + 0.18, z: C.z - 0.62, yaw: PI } }, stay: 'radhija', settle: 30 });
      await keysCam(r, [
        { at: 0, pos: [C.x + 1.45, 0.66, C.z + 0.05], look: [C.x + 0.12, 0.34, C.z - 0.28], fov: 36 },
        { at: 8, pos: [C.x + 1.1, 0.56, C.z - 0.02], look: [C.x + 0.1, 0.33, C.z - 0.25], fov: 34 },
      ]);
      await r.record(0.3);
      await r.key('KeyL', true);
      r.mark('lambe');
      await r.recordUntil((i) => i.lambe?.mud?.radhija?.k === 0, 10);
      await r.up('KeyL');
      r.mark('limpa');
      await r.record(2.2);
    },
  },

  // ---------------------------------------------------------------- destaques das fases
  'fase4-pombo': {
    level: '4',
    async run(r, L) {
      // o vento do ventilador leva o cheiro pelo duto até o pombo, que voa para a placa e abre o portão (câmera do jogo)
      await r.ev(() => {
        const g = window.__game;
        const d = g.game.debug;
        d.setStage('passOpen');
        d.puzzle.mech.fan.setPos(g.layout.FAN.start.x, g.layout.FAN.alignZ);
        d.teleport('radhija', 1.1, g.layout.CORRIDOR.z);
        d.ctrls.radhija.yaw = Math.PI / 2;
        window.__step(240);
        d.cam.snapFollow(1.1, g.layout.CORRIDOR.z);
      });
      await r.camera(null);
      await r.record(0.5);
      await r.key('KeyR', true);
      await r.record(0.42);
      await r.up('KeyR');
      r.mark('sopro');
      await r.recordUntil((i) => i.stage === 'gateOpen', 8, 1.0);
    },
  },
  'fase6-trem': {
    level: 'fase6',
    vertical: { pull: 1.3 },
    async run(r, L) {
      // o superbafo na janelinha faz o trem de brinquedo espirrar e partir
      const B = L.BLOW_SPOT;
      await r.setup({ active: 'radhija', place: { radhija: { x: B.x, z: B.z, yaw: B.yaw }, rhaenyra: { x: B.x - 1.0, z: B.z + 0.5, yaw: PI } }, stay: 'rhaenyra', settle: 40 });
      await keysCam(r, [
        { at: 0, pos: [1.35, 0.8, 2.2], look: [0.0, 0.45, 0.55], fov: 38 },
        { at: 2.2, pos: [1.45, 0.95, 1.9], look: [0.0, 0.45, 0.2], fov: 38 },
        { at: 5.5, pos: [1.9, 1.5, 1.6], look: [-0.2, 0.35, -1.6], fov: 40 },
      ]);
      await r.record(0.6);
      await r.key('KeyR', true);
      await r.record(0.45);
      await r.up('KeyR');
      r.mark('sopro');
      await r.recordUntil((i) => (i.expresso?.trips ?? 0) >= 1, 3);
      r.mark('partiu');
      await r.record(3.2);
    },
  },
  porcos: {
    level: 'fase10',
    query: '&botao=1',
    vertical: { pull: 1.2 },
    async run(r) {
      // o chiqueiro aberto: os três porquinhos saem e vêm atrapalhar as dogs na horta
      await r.setup({ stage: 'cake1', active: 'radhija', set: [['generator', true], ['clean', true]], place: { radhija: { x: 8.7, z: 4.3, yaw: PI / 2 }, rhaenyra: { x: 8.1, z: 3.7, yaw: PI / 2 } }, stay: 'rhaenyra', settle: 20 });
      await r.ev(() => window.__game.game.puzzle.debugSet('pigsOut', true));
      await r.step(70);
      await keysCam(r, [
        { at: 0, pos: [7.5, 2.2, 6.9], look: [8.5, 0.25, 4.0], fov: 38 },
        { at: 5, pos: [8.2, 1.25, 6.1], look: [8.6, 0.25, 4.2], fov: 36 },
      ]);
      await r.drive(9.3, 4.9, { tol: 0.15, maxSec: 3 });
      await r.record(5.2);
    },
  },
  luzes: {
    level: 'fase10',
    vertical: { pull: 1.15, vfov: 46 },
    async run(r, L) {
      // o disjuntor: a energia chega à varanda e as luzinhas da festa acendem em onda
      await r.setup({ stage: 'start', active: 'rhaenyra', place: { rhaenyra: kick(L.BREAKER), radhija: { x: -2.2, z: 0.6, yaw: PI } }, stay: 'radhija' });
      await r.tap('Space');
      await r.until((i) => i.quintal?.powerStage === 'porch', 900);
      await r.step(10);
      await keysCam(r, [
        { at: 0, pos: [0.8, 3.0, 1.6], look: [-2.0, 1.55, -3.6], fov: 40 },
        { at: 5, pos: [0.3, 2.6, 0.9], look: [-2.2, 1.55, -3.6], fov: 40 },
      ]);
      await r.recordUntil((i) => i.quintal?.powerStage === 'on', 4, 2.6);
    },
  },
  bolo: {
    level: 'fase10',
    vertical: { pull: 1.25 },
    async run(r, L) {
      // o bolo completo e a comemoração das duas
      const K = L.CAKE;
      await r.setup({ stage: 'done', set: [['power', true]], settle: 2 });
      await keysCam(r, [
        { at: 0, pos: [K.x + 1.15, 1.5, K.z + 1.95], look: [K.x, 0.9, K.z], fov: 38 },
        { at: 5, pos: [K.x + 0.8, 1.25, K.z + 1.45], look: [K.x, 0.85, K.z], fov: 36 },
      ]);
      await r.record(5.0);
    },
  },
  'final-fundo': {
    level: 'fase10',
    vertical: { pull: 1.0, vfov: 50 },
    async run(r) {
      // plano aberto do quintal em festa, para o fundo do cartão final
      await r.setup({ stage: 'done', set: [['power', true]], settle: 120 });
      await keysCam(r, [
        { at: 0, pos: [3.8, 5.2, 9.2], look: [-1.0, 0.8, -1.5], fov: 40 },
        { at: 9, pos: [1.2, 4.4, 8.4], look: [-2.2, 0.9, -1.8], fov: 40 },
      ], { ease: 'linear' });
      await r.record(9.0);
    },
  },
  pinata: {
    level: 'fase10',
    async run(r, L) {
      // o superbafo balança a piñata e a Rhaenyra pula e bate nela quando ela passa por cima
      const R = L.ROSE_BUSH;
      await r.setup({ stage: 'cake4', active: 'radhija', set: [['pinataDown', true]], place: { radhija: { x: R.x - 1.5, z: R.z, yaw: PI / 2 }, rhaenyra: { x: R.x + 0.98, z: R.z, yaw: -PI / 2 } }, stay: 'rhaenyra', settle: 20 });
      // as duas primeiras batidas já foram (a terceira abre)
      await r.ev(() => {
        const g = window.__game;
        const S = g.game.puzzle.S;
        if (S?.pin) { S.pin.hits = 2; g.props?.pinata?.setCracks?.(2); }
      });
      await keysCam(r, [
        { at: 0, pos: [R.x + 0.1, 1.45, R.z + 3.0], look: [R.x + 0.2, 1.05, R.z], fov: 38 },
        { at: 6, pos: [R.x + 0.2, 1.3, R.z + 2.6], look: [R.x + 0.25, 0.95, R.z], fov: 38 },
      ]);
      await r.record(0.3);
      await r.key('KeyR', true);
      await r.record(0.6);
      await r.up('KeyR');
      await r.record(0.2);
      await r.tap('KeyQ');
      // a Rhaenyra pula quando a piñata passa por cima dela
      await r.brain((H, a, s) => {
        const g = H.G.game;
        const q = H.info().quintal;
        const c = g.debug.ctrls.rhaenyra;
        if (s.release) { H.key('Space', false); s.release = false; }
        if (g.activeDog !== 'rhaenyra' || q.pinata.broken) return;
        if (!c.jumpT && Math.hypot(q.pinata.x - c.x, q.pinata.z - c.z) < 0.5) { H.key('Space', true); s.release = true; }
      });
      await r.recordUntil((i) => i.quintal?.pinata?.broken, 7, 2.2);
    },
  },
  'fase3-gansa': {
    level: '3',
    async run(r, L) {
      // noite no jardim do lago: a Dona Gansa guarda a ponte
      const g = L.GOOSE.home;
      await r.setup({ active: 'radhija', place: { radhija: { x: g.x - 2.0, z: g.z - 0.4, yaw: PI / 2 }, rhaenyra: { x: g.x - 2.7, z: g.z + 0.2, yaw: PI / 2 } }, settle: 60 });
      await keysCam(r, [
        { at: 0, pos: [g.x - 1.6, 0.85, g.z + 1.9], look: [g.x - 0.2, 0.3, g.z - 0.3], fov: 38 },
        { at: 5, pos: [g.x - 1.2, 0.75, g.z + 1.6], look: [g.x, 0.3, g.z - 0.3], fov: 36 },
      ]);
      await r.drive(g.x - 0.75, g.z - 0.3, { tol: 0.15, maxSec: 3 });
      await r.record(5.0);
    },
  },
  'fase2-irrigador': {
    level: '2',
    async run(r, L) {
      // crepúsculo na área de serviço: o irrigador girando no meio do caminho
      const S = L.SPRINKLER;
      await r.setup({ active: 'radhija', place: { radhija: { x: S.x - 2.6, z: S.z + 0.3, yaw: PI / 2 }, rhaenyra: { x: S.x - 3.2, z: S.z + 0.7, yaw: PI / 2 } }, settle: 60 });
      await keysCam(r, [
        { at: 0, pos: [S.x - 2.6, 1.3, S.z + 2.7], look: [S.x - 0.5, 0.3, S.z], fov: 40 },
        { at: 5, pos: [S.x - 1.9, 1.1, S.z + 2.4], look: [S.x - 0.2, 0.3, S.z], fov: 38 },
      ]);
      await r.drive(S.x - 2.15, S.z + 0.2, { tol: 0.12, maxSec: 2 });
      await r.record(5.0);
    },
  },

  // ---------------------------------------------------------------- cooperação
  'coop-escada': {
    level: 'fase9',
    async run(r, L) {
      // a Rhaenyra segura a escadinha (E) e a Radhija sobe para pegar os óculos do vovô
      await r.setup({ stage: 'start', active: 'rhaenyra', place: { rhaenyra: kick(L.BRAKE), radhija: { x: 2.0, z: -0.8, yaw: 1.5 } }, stay: 'radhija' });
      await r.tap('Space');
      await r.until((i) => !i.dogs.rhaenyra.wall && (i.biblioteca?.brake === false || true), 160);
      await r.step(50);
      const hold = { x: L.LADDER.minX + L.HOLD.side, z: L.HOLD.z + 0.02 };
      await r.setup({
        crates: [['globo', L.GLOBE.minX, L.GLOBE.start.z], ['escadinha', L.LADDER.minX, L.LADDER.start.z]],
        place: { rhaenyra: { ...hold, yaw: -PI / 2 }, radhija: { x: L.LADDER.minX, z: -1.98, yaw: PI } },
      });
      await r.tap('KeyE'); // a Rhaenyra segura a escada
      await r.tap('KeyQ'); // a Radhija sobe
      await r.step(10);
      const x = L.LADDER.minX;
      await keysCam(r, [
        { at: 0, pos: [x + 1.35, 1.15, -1.15], look: [x, 0.75, -2.7], fov: 38 },
        { at: 2.6, pos: [x + 1.2, 1.45, -1.35], look: [x + 0.05, 1.35, -2.75], fov: 38 },
        { at: 4.2, pos: [x + 1.0, 1.75, -1.7], look: [L.GLASSES.x, L.GLASSES.y - 0.15, L.GLASSES.z], fov: 38 },
      ]);
      await r.record(0.4);
      await r.tap('KeyE');
      r.mark('sobe');
      await r.recordUntil((i) => i.biblioteca?.climb?.phase === 'grab', 5);
      r.mark('oculos');
      await r.record(1.4);
    },
  },
  'coop-balde': {
    level: 'fase10',
    vertical: { pull: 1.2 },
    async run(r, L) {
      // a Radhija deita no balde e a Rhaenyra puxa a corda: o balde sobe até o deque da casa na árvore
      const B = L.BUCKET;
      await r.setup({ stage: 'start', set: [['pigeon', true]], active: 'radhija', place: { radhija: { x: B.x, z: B.z + 0.7, yaw: PI } } });
      await r.tap('KeyE');
      await r.until((i) => i.quintal?.bucket?.riding, 120);
      await r.step(10);
      await r.setup({ active: 'rhaenyra', place: { rhaenyra: { x: L.ROPE.rest.x, z: L.ROPE.rest.z + 0.5, yaw: PI } } });
      await r.tap('KeyE');
      await r.step(4);
      await keysCam(r, [
        { at: 0, pos: [B.x - 1.1, 1.2, B.z + 1.85], look: [B.x, 0.45, B.z], fov: 38 },
        { at: 2.4, pos: [B.x - 1.4, 1.9, B.z + 2.3], look: [B.x + 0.2, 1.3, B.z - 0.4], fov: 40 },
        { at: 5.5, pos: [5.9, 3.0, -0.9], look: [7.1, 2.2, -3.7], fov: 40 },
      ]);
      await r.record(0.3);
      await r.key('KeyS', true);
      r.mark('puxa');
      await r.recordUntil((i) => i.quintal?.deck === 'hop', 6);
      await r.up('KeyS');
      r.mark('deque');
      await r.recordUntil((i) => i.quintal?.onDeck, 2, 0.6);
    },
  },
};

// Um plano de cada fase, com a câmera do jogo e a dog andando (para o mosaico "10 fases")
for (let n = 1; n <= 10; n++) {
  SHOTS[`estab-${n}`] = {
    level: String(n),
    async run(r, L) {
      await r.step(240);
      const d = await r.dog(await r.ev(() => window.__game.game.activeDog));
      const f = [Math.sin(d.yaw), Math.cos(d.yaw)];
      await r.camera(null);
      await r.drive(d.cx + f[0] * 1.8, d.cz + f[1] * 1.8, { tol: 0.2, maxSec: 3 });
      await r.record(3.2);
    },
  };
}

/** Grupos = jobs paralelos do workflow (cenas da mesma fase juntas). */
export const GROUPS = {
  'fase1': ['abertura', 'retrato-radhija', 'retrato-rhaenyra', 'coop-portao'],
  'fase4': ['superbafo', 'fase4-pombo'],
  'fase7': ['arrancada', 'vao', 'lambe'],
  'fase8': ['parede', 'arrancada-meia'],
  'fase10-a': ['empurrao', 'pinata'],
  'fase10-b': ['porcos', 'coop-balde'],
  'fase10-c': ['luzes', 'bolo', 'final-fundo'],
  'fases-5-6': ['pulo', 'fase6-trem'],
  'fase9': ['coop-escada'],
  'fases-2-3': ['fase2-irrigador', 'fase3-gansa'],
  'estab-a': ['estab-1', 'estab-2', 'estab-3', 'estab-4', 'estab-5'],
  'estab-b': ['estab-6', 'estab-7', 'estab-8', 'estab-9', 'estab-10'],
};
