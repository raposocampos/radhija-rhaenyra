// FASE 1 · Operação Cenoura — puzzle (implementa a interface de puzzle: docs/CONTRATO.md §5).
// Cordinha → portão, empurrar o carrinho, cenoura, porta, colecionáveis,
// prompts (interact:prompt) e dicas contextuais (hint) sem repetição excessiva.
import { approach } from '../../game/dogController.js';
import { gateTip } from '../../game/collision.js';

export const STAGES = ['start', 'east', 'gateOpen', 'cartMoved', 'carrying', 'done'];

const TEXT = {
  objective: {
    start: 'Leve a Radhija pela abertura na cerca',
    east: 'Puxe a cordinha do portão (E)',
    gateOpenRadhija: 'Troque para a Rhaenyra (Q) e passe pelo portão',
    gateOpenRhaenyra: 'Empurre o carrinho com a Rhaenyra (segure Shift)',
    cartMoved: 'Pegue a cenoura (E)',
    carrying: 'Leve a cenoura até a porta de casa',
  },
  hint: {
    gap: 'A Rhaenyra não cabe aqui… mas a Radhija cabe!',
    heavy: 'Pesado demais para a Radhija. Chame a Rhaenyra (Q)!',
    shift: 'Segure Shift para empurrar',
    locked: 'Trancado… o trinco fica do outro lado da cerca.',
  },
  prompt: { rope: 'Puxar a cordinha', carrot: 'Pegar a cenoura' },
};

// Linha do tempo da cordinha/portão (s desde o E)
const TUG_DUR = 0.6;
const GATE_START = 0.45;
const GATE_DUR = 0.9;

function easeOutBack(x) {
  const c1 = 1.0;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function createPuzzle({ layout, props, world, dogs, emit, cam, root: scene, place }) {
  const { FENCE, ROPE, CART, CARROT, DOOR, DOGS, COLLECTIBLES, COLLECTIBLE_PICKUP_R } = layout;

  // Colisores dinâmicos desta fase: portão (segmento girando na dobradiça) e carrinho (caixa em X).
  const gateCol = world.addDynamic({
    id: 'gate', kind: 'gate', shape: 'segment',
    ax: FENCE.gate.hinge.x, az: FENCE.gate.hinge.z, bx: FENCE.gate.latchPost.x, bz: FENCE.gate.latchPost.z, t: 0.05,
  });
  const cartCol = world.addDynamic({
    id: 'cart', kind: 'cart', shape: 'box', x: CART.start.x, z: CART.start.z, hx: CART.halfSize.x, hz: CART.halfSize.z,
  });
  const worldSetGate = (t) => {
    const tip = gateTip(FENCE, t);
    gateCol.bx = tip.x;
    gateCol.bz = tip.z;
  };
  const worldSetCartX = (x) => { cartCol.x = x; };
  const carrotObj = props.carrot?.object || null;
  const carrotHome = {
    parent: carrotObj?.parent || scene,
    pos: carrotObj ? carrotObj.position.clone() : null,
    quat: carrotObj ? carrotObj.quaternion.clone() : null,
  };

  const S = {
    stage: 'start',
    ropeT: -1, // < 0: não puxada
    gateT: 0,
    gateEmitted: false,
    cartX: CART.start.x,
    cartV: 0,
    pushing: false,
    pushOffT: 0,
    carrier: null,
    collected: new Set(),
    prompt: undefined,
    promptKind: null,
    time: 0,
    hintNext: new Map(),
    hintPrev: new Set(),
    hintNow: new Set(),
    lockLeft: 0,
    lockDog: null,
  };

  let onStageChange = () => {};

  function setStage(st, { silent = false } = {}) {
    if (S.stage === st) return;
    S.stage = st;
    if (!silent) onStageChange(st);
  }

  // ---------- dicas ----------
  /** Emite a dica na borda de subida da condição, respeitando cooldown por dica. */
  function hintCond(key, duration = 3.6, cooldown = 9) {
    S.hintNow.add(key);
    if (S.hintPrev.has(key)) return;
    if ((S.hintNext.get(key) || 0) > S.time) return;
    S.hintNext.set(key, S.time + cooldown);
    emit('hint', { text: TEXT.hint[key], duration });
  }
  function hintNow(key, duration = 3.6, cooldown = 2.5) {
    if ((S.hintNext.get(key) || 0) > S.time) return;
    S.hintNext.set(key, S.time + cooldown);
    emit('hint', { text: TEXT.hint[key], duration });
  }

  function setPrompt(kind) {
    const text = kind ? TEXT.prompt[kind] : null;
    if (text === S.prompt) return;
    S.prompt = text;
    S.promptKind = kind;
    emit('interact:prompt', text ? { text, key: 'E' } : { text: null });
  }

  // ---------- objetivo ----------
  function objective(activeName) {
    const st = S.stage;
    const O = TEXT.objective;
    switch (st) {
      case 'start': return { text: O.start, target: { x: FENCE.x, y: 0.8, z: FENCE.gap.center }, stage: st };
      case 'east': return { text: O.east, target: { x: ROPE.anchor.x, y: 1.18, z: ROPE.anchor.z }, stage: st };
      case 'gateOpen':
        return activeName === 'rhaenyra'
          ? { text: O.gateOpenRhaenyra, target: { x: S.cartX, y: 1.0, z: CART.start.z }, stage: st }
          : { text: O.gateOpenRadhija, target: { x: FENCE.x, y: 1.0, z: (FENCE.gate.hinge.z + FENCE.gate.latchPost.z) / 2 }, stage: st };
      case 'cartMoved': return { text: O.cartMoved, target: { x: CARROT.x, y: 0.75, z: CARROT.z }, stage: st };
      case 'carrying': return { text: O.carrying, target: { x: DOOR.zone.x, y: 0.95, z: DOOR.zone.z }, stage: st };
      default: return { text: null, target: null, stage: st };
    }
  }

  // ---------- portão ----------
  function setGate(t) {
    S.gateT = t;
    props.gate?.setOpen?.(t);
    worldSetGate(t);
  }
  const gateOpenEnough = () => S.gateT >= 0.97;
  const ropeAvailable = () => S.ropeT < 0;

  function startTug(c) {
    S.ropeT = 0;
    S.gateEmitted = false;
    S.lockLeft = TUG_DUR + 0.1;
    S.lockDog = c.name;
    emit('rope:tug', { x: ROPE.anchor.x, z: ROPE.anchor.z });
    if (S.stage === 'start') setStage('east', { silent: true });
  }

  function updateRope(dt) {
    S.lockLeft = Math.max(0, S.lockLeft - dt);
    if (S.ropeT < 0) return;
    const before = S.ropeT;
    S.ropeT += dt;
    const t = S.ropeT;
    if (before < TUG_DUR + dt) props.rope?.setTug?.(t < TUG_DUR ? Math.sin((Math.PI * t) / TUG_DUR) : 0);
    if (t >= GATE_START) {
      if (!S.gateEmitted) {
        S.gateEmitted = true;
        const gx = (FENCE.gate.hinge.x + 0.5);
        const gz = (FENCE.gate.hinge.z + FENCE.gate.latchPost.z) / 2;
        emit('gate:open', { x: gx, z: gz });
        cam?.focusShot(1.35, 1.75, { hold: 1.2 });
        setStage('gateOpen');
      }
      const k = Math.min(1, (t - GATE_START) / GATE_DUR);
      if (S.gateT < 1 || k < 1) setGate(k >= 1 ? 1 : easeOutBack(k));
    }
  }

  // ---------- carrinho ----------
  function setCartX(x) {
    S.cartX = x;
    worldSetCartX(x);
    props.cart?.setX?.(x);
  }

  /**
   * Empurrar/forçar o carrinho. Retorna { intent?, action? }.
   * comp: controller da companheira (para não esmagá-la contra nada).
   */
  function updatePush(dt, c, intent, shift, comp) {
    const out = { intent: null, action: null };
    let pushDir = 0;
    let pushingNow = false;
    const moving = intent.speed > 0.05 && (intent.dx || intent.dz);
    if (moving) {
      const cart = cartCol;
      const side = c.x < cart.x ? 1 : -1; // direção do empurrão a partir deste lado
      const faceDist = side > 0 ? cart.x - cart.hx - c.x : c.x - (cart.x + cart.hx);
      const atFace = faceDist > -0.03 && faceDist < c.r + 0.08 && Math.abs(c.z - cart.z) < cart.hz + 0.08;
      if (c.size === 'large') {
        if (atFace && intent.dx * side > 0.35) {
          if (shift) {
            pushingNow = true;
            pushDir = side;
          } else hintCond('shift');
        }
      } else {
        const touch = world.contacts(c.x, c.z, c.r, c.size, { margin: 0.05 });
        const ct = touch.find((h) => h.id === 'cart');
        if (ct && -(intent.dx * ct.nx + intent.dz * ct.nz) > 0.45) {
          out.action = 'strain';
          hintCond('heavy');
        }
      }
    }
    // Dinâmica do carrinho
    const target = pushingNow ? pushDir * c.cfg.pushSpeed : 0;
    S.cartV = approach(S.cartV, target, (pushingNow ? 3.2 : 7.0) * dt);
    if (Math.abs(S.cartV) > 1e-4) {
      let nx = S.cartX + S.cartV * dt;
      if (nx <= CART.minX) { nx = CART.minX; S.cartV = 0; }
      if (nx >= CART.maxX) { nx = CART.maxX; S.cartV = 0; }
      const prevX = S.cartX;
      worldSetCartX(nx);
      // Não esmaga a companheira: ela é empurrada; se não couber, o carrinho para.
      if (comp) {
        const res = world.resolve(comp.x, comp.z, comp.r, comp.size);
        if (world.overlaps(res.x, res.z, comp.r * 0.98, comp.size)) {
          worldSetCartX(prevX);
          S.cartV = 0;
          nx = prevX;
        } else {
          comp.x = res.x;
          comp.z = res.z;
        }
      }
      if (nx !== prevX) {
        setCartX(nx);
        emit('cart:move', { x: nx, z: CART.start.z, speed: Math.abs(S.cartV) });
      }
    }
    // Estado de empurrão (com pequena histerese)
    if (pushingNow) {
      S.pushOffT = 0;
      if (!S.pushing) {
        S.pushing = true;
        emit('dog:pushStart', { name: c.name });
      }
      // Mantém a Rhaenyra centralizada na face do carrinho enquanto empurra.
      const dzc = Math.max(-0.35, Math.min(0.35, (cartCol.z - c.z) * 1.6));
      const Lp = Math.hypot(pushDir, dzc);
      out.intent = { dx: pushDir / Lp, dz: dzc / Lp, speed: Math.max(0.25, Math.abs(S.cartV) + 0.12), turnScale: 0.8 };
      out.action = 'push';
    } else if (S.pushing) {
      S.pushOffT += dt;
      if (S.pushOffT > 0.15) {
        S.pushing = false;
        emit('dog:pushEnd', { name: c.name });
      }
    }
    return out;
  }

  // ---------- cenoura ----------
  function pickup(name) {
    const dog = dogs[name];
    S.carrier = name;
    if (carrotObj) {
      const socket = dog.mouthSocket || dog.object;
      socket.add(carrotObj);
      carrotObj.position.set(0, 0, 0);
      carrotObj.rotation.set(0, 0, 0);
    }
    props.carrot?.setHighlight?.(false);
    props.door?.setHighlight?.(true);
    const p = dog.object.position;
    emit('carrot:pickup', { name, x: p.x, z: p.z });
    emit('item:pickup', { name, item: 'carrot', x: p.x, z: p.z });
    setStage('carrying');
  }

  function returnCarrot() {
    if (!carrotObj) return;
    let p = carrotObj.parent;
    let inDog = false;
    while (p) {
      if (p === dogs.radhija.object || p === dogs.rhaenyra.object) inDog = true;
      p = p.parent;
    }
    if (inDog || !carrotObj.parent) {
      (carrotHome.parent || scene).add(carrotObj);
      carrotObj.position.copy(carrotHome.pos);
      carrotObj.quaternion.copy(carrotHome.quat);
    }
  }

  // ---------- interação (E) ----------
  /** Distância até um ponto medida pelo centro OU pela cabeça (o que estiver mais perto). */
  function reach(c, x, z) {
    const hl = (c.cfg.visual?.length || 0.6) * 0.42;
    const hx = c.x + Math.sin(c.yaw) * hl;
    const hz = c.z + Math.cos(c.yaw) * hl;
    return Math.min(Math.hypot(c.x - x, c.z - z), Math.hypot(hx - x, hz - z));
  }

  function interactable(c) {
    if (ropeAvailable() && c.x > ROPE.interact.requireEastOfX
      && reach(c, ROPE.interact.x, ROPE.interact.z) < ROPE.interact.r) return 'rope';
    if (S.stage === 'cartMoved' && !S.carrier && reach(c, CARROT.x, CARROT.z) < CARROT.pickupR) return 'carrot';
    return null;
  }

  function nearLockedGateWest(c) {
    if (S.gateT > 0.05 || c.x > FENCE.x) return false;
    const gz0 = FENCE.gate.latchPost.z;
    const gz1 = FENCE.gate.hinge.z;
    return c.x > FENCE.x - 0.6 && c.z > gz0 - 0.25 && c.z < gz1 + 0.25;
  }

  /** E pressionado. Retorna true se tratou (senão a dog late). */
  function interact(c) {
    const k = interactable(c);
    if (k === 'rope') { startTug(c); return true; }
    if (k === 'carrot') { pickup(c.name); return true; }
    if (nearLockedGateWest(c)) hintNow('locked');
    return false;
  }

  /** Trava de entrada (ex.: puxando a cordinha). */
  function lockFor(name) {
    if (S.lockLeft > 0 && S.lockDog === name) {
      return { action: 'tug', faceX: ROPE.anchor.x, faceZ: ROPE.anchor.z };
    }
    return null;
  }

  /** Para onde a dog ativa olha (algo interessante por perto). */
  function lookTarget(c) {
    const k = S.promptKind;
    if (k === 'rope') return { x: ROPE.anchor.x, y: ROPE.anchor.y - 0.2, z: ROPE.anchor.z };
    if (k === 'carrot') return { x: CARROT.x, y: 0.1, z: CARROT.z };
    if (S.lockLeft > 0 && S.lockDog === c.name) return { x: ROPE.anchor.x, y: ROPE.anchor.y - 0.15, z: ROPE.anchor.z };
    return null;
  }

  /**
   * Atualização por quadro durante o jogo.
   * → 'delivered' quando a cenoura chega à porta.
   */
  function update(dt, { active, comp, ctrls }) {
    S.time += dt;
    S.hintPrev = S.hintNow;
    S.hintNow = new Set();
    let result = null;

    // start → east
    if (S.stage === 'start' && (ctrls.radhija.x > 1.15 || ctrls.rhaenyra.x > 1.15)) setStage('east');

    // gateOpen → cartMoved
    if ((S.stage === 'gateOpen' || S.stage === 'east' || S.stage === 'start') && S.cartX >= CART.revealX) {
      revealCarrot();
    }

    // Dicas por contato
    const touch = world.contacts(active.x, active.z, active.r, active.size, { margin: 0.04 });
    if (active.size === 'large' && touch.some((h) => h.id === 'abertura-bloqueio-grande')) hintCond('gap');
    if (S.gateT < 0.05 && active.x < FENCE.x && touch.some((h) => h.id === 'gate')) hintCond('locked');

    // Prompt
    setPrompt(S.lockLeft > 0 ? null : interactable(active));

    // Colecionáveis (dog ativa)
    COLLECTIBLES.forEach((col, i) => {
      if (S.collected.has(col.id)) return;
      if (Math.hypot(active.x - col.x, active.z - col.z) < COLLECTIBLE_PICKUP_R) {
        S.collected.add(col.id);
        const item = props.collectibles?.find?.((p) => p.id === col.id) || props.collectibles?.[i];
        item?.collect?.();
        emit('collectible:pickup', { id: col.id, x: col.x, z: col.z, count: S.collected.size, total: COLLECTIBLES.length });
      }
    });

    // Entrega
    if (S.stage === 'carrying' && S.carrier) {
      const cc = ctrls[S.carrier];
      const d = Math.hypot(cc.x - DOOR.zone.x, cc.z - DOOR.zone.z);
      const leaderIn = Math.hypot(active.x - DOOR.zone.x, active.z - DOOR.zone.z) < DOOR.zone.r;
      if (d < DOOR.zone.r || (cc !== active && leaderIn && d < DOOR.zone.r + 0.8)) {
        setStage('done');
        result = 'delivered';
      }
    }
    return result;
  }

  function revealCarrot({ silent = false } = {}) {
    setStage('cartMoved', { silent });
    props.carrot?.setHighlight?.(true);
    if (!silent) {
      emit('carrot:revealed', { x: CARROT.x, z: CARROT.z });
      emit('item:revealed', { item: 'carrot', x: CARROT.x, z: CARROT.z });
      cam?.focusShot(CARROT.x, CARROT.z + 0.55, { hold: 1.2 });
    }
  }

  function reset() {
    if (props.reset) props.reset();
    else {
      props.gate?.setOpen?.(0);
      props.rope?.setTug?.(0);
      props.cart?.setX?.(CART.start.x);
      props.collectibles?.forEach?.((c) => c.reset?.());
    }
    returnCarrot();
    props.carrot?.setHighlight?.(false);
    props.door?.setHighlight?.(false);
    props.rope?.setTug?.(0);
    S.stage = 'start';
    S.ropeT = -1;
    S.gateEmitted = false;
    setGate(0);
    S.cartV = 0;
    setCartX(CART.start.x);
    S.pushing = false;
    S.carrier = null;
    S.collected = new Set();
    S.prompt = undefined;
    S.promptKind = null;
    S.lockLeft = 0;
    S.lockDog = null;
    S.hintPrev = new Set();
    S.hintNow = new Set();
    S.hintNext = new Map();
  }

  /** Atalhos de depuração para ?stage. */
  function forceGateOpen() {
    S.ropeT = GATE_START + GATE_DUR + 1;
    S.gateEmitted = true;
    setGate(1);
  }

  // ---------- ajudas de movimento ----------
  /** Funil suave na abertura da cerca para a Radhija (evita enroscar no batente). */
  function assist(c, intent, dt) {
    if (c.size !== 'small' || !(intent.speed > 0.05)) return;
    const dxF = Math.abs(c.x - FENCE.x);
    if (dxF > 0.55) return;
    const dzc = FENCE.gap.center - c.z;
    if (Math.abs(dzc) > 0.42 || Math.abs(intent.dx) < 0.45) return;
    const toward = (FENCE.x - c.x) * intent.dx > 0 || dxF < 0.12;
    if (!toward) return;
    const k = 1 - dxF / 0.55;
    const step = Math.sign(dzc) * Math.min(Math.abs(dzc), 1.7 * dt * (0.4 + k));
    const res = world.resolve(c.x, c.z + step, c.r, c.size);
    c.x = res.x;
    c.z = res.z;
  }

  /** Ajusta a intenção da dog ativa (empurrar/forçar o carrinho). */
  function modifyIntent(dt, c, intent, { shift, comp }) {
    return updatePush(dt, c, intent, shift, comp);
  }

  /** Flags das restrições do grafo de navegação (NAV_EDGES.requires). */
  function navFlags() {
    return { gateOpen: gateOpenEnough(), cartMoved: S.cartX >= CART.revealX - 0.05 };
  }

  /** Pula para uma etapa com as dogs posicionadas de forma coerente (?stage=). → dog ativa sugerida */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(st)) return null;
    reset();
    const other = (n) => (n === 'radhija' ? 'rhaenyra' : 'radhija');
    let active = who || (st === 'cartMoved' || st === 'carrying' ? 'rhaenyra' : 'radhija');
    switch (st) {
      case 'east':
        place('radhija', 1.75, -1.55, 2.5);
        place('rhaenyra', 0.3, -1.65, 1.57);
        setStage('east', { silent: true });
        break;
      case 'gateOpen':
        forceGateOpen();
        place('radhija', 1.65, 0.7, -1.2);
        place('rhaenyra', 0.3, 1.5, 1.57);
        setStage('gateOpen', { silent: true });
        break;
      case 'cartMoved':
      case 'carrying': {
        forceGateOpen();
        const cx = CART.revealX + 0.15;
        setCartX(cx);
        setStage('gateOpen', { silent: true });
        revealCarrot({ silent: true });
        place('rhaenyra', cx - CART.halfSize.x - DOGS.rhaenyra.radius - 0.01, CART.start.z, Math.PI / 2);
        place('radhija', 3.7, -1.3, 0.3);
        if (st === 'carrying') {
          place(active, 4.4, -3.35, 0);
          place(other(active), 3.9, -1.55, 0);
          pickup(active);
        }
        break;
      }
      default:
        active = who || 'radhija';
        break;
    }
    return active;
  }

  function info() {
    return {
      cart: { x: +S.cartX.toFixed(3), v: +S.cartV.toFixed(3), pushing: S.pushing },
      gate: { t: +S.gateT.toFixed(3), open: gateOpenEnough() },
    };
  }

  /** Encerra o empurrão (ex.: ao começar a comemoração). */
  function endActions() {
    if (S.pushing) {
      S.pushing = false;
      emit('dog:pushEnd', { name: 'rhaenyra' });
    }
  }

  return {
    S, TEXT, stages: STAGES,
    objective, update, updateAlways: updateRope, interact, lockFor, lookTarget,
    modifyIntent, assist, navFlags, jumpToStage, info, endActions,
    pickup, reset, setStage, setPrompt,
    set onStageChange(fn) { onStageChange = fn; },
    get stage() { return S.stage; },
    get carrier() { return S.carrier; },
    get collected() { return S.collected.size; },
    get total() { return COLLECTIBLES.length; },
  };
}
