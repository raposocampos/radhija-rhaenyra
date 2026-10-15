// Entrada: teclado (KeyboardEvent.code) + controle (Gamepad API, mapeamento "standard").
// Estado contínuo (isDown / shift / axis) + toques de borda (consume) por quadro.
// O controle é lido por polling (poll() no começo do quadro) e traduzido para os MESMOS códigos
// lógicos do teclado, então o jogo não precisa saber de onde veio o comando:
// Mapeamento por posição (PlayStation / Xbox):
//   ✕/A → 'Jump' (pular; teclado Espaço) · ○/B → 'KeyE' (interagir/latir) · □/X → 'Bark' (latir sempre)
//   △/Y → 'KeyF' (Fica/Vem) · L1/LB → 'KeyQ' (trocar) · Options/Start → 'Escape' (pausar)
//   R1/RB ou R2/RT → Shift (segurar = empurrar; borda = arrancada)
//   L2/LT → bafo() (segurar = mirar o superbafo, soltar = soprar; teclado R)
//   analógico esquerdo (zona morta radial + curva, magnitude 0..1) / D-pad → axis()
// Ver docs/ARQUITETURA.md §6. Para os menus da UI: pollMenuPad() (abaixo), com estado próprio.

const MOVE = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};
const SHIFT = ['ShiftLeft', 'ShiftRight'];
const PAD_SHIFT = 'PadShift';
const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

/** Índices do mapeamento "standard" (Xbox / PlayStation). */
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, HOME: 16 };
export const PAD_DEADZONE = 0.18;

/** Botões → código lógico (borda). R1/R2 viram Shift e L2 o bafo (tratados à parte). */
const PAD_EDGE_CODES = [
  [PAD.A, 'Jump'],
  [PAD.B, 'KeyE'],
  [PAD.X, 'Bark'],
  [PAD.Y, 'KeyF'],
  [PAD.LB, 'KeyQ'],
  [PAD.START, 'Escape'],
];

function connectedPads() {
  try {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    return [...navigator.getGamepads()].filter((p) => p && p.connected !== false);
  } catch {
    return [];
  }
}

const btnDown = (p, i, thr = 0.5) => {
  const b = p.buttons?.[i];
  if (!b) return false;
  return typeof b === 'object' ? !!b.pressed || (b.value ?? 0) > thr : b > thr;
};
const btnValue = (p, i) => {
  const b = p.buttons?.[i];
  if (!b) return 0;
  return typeof b === 'object' ? (b.value ?? (b.pressed ? 1 : 0)) : +b || 0;
};

/** Analógico com zona morta radial + curva suave → { x, y (frente +), m 0..1 }. */
export function shapeStick(rx, ry, dead = PAD_DEADZONE) {
  const m = Math.hypot(rx, ry);
  if (!(m > dead)) return { x: 0, y: 0, m: 0 };
  const u = Math.min(1, (m - dead) / (1 - dead));
  const k = 0.12 + 0.88 * Math.pow(u, 1.35); // devagar → trote, sem degrau no fim da zona morta
  return { x: (rx / m) * k, y: (-ry / m) * k, m: k };
}

/**
 * Lê todos os controles conectados e funde num estado único (OR dos botões, o analógico mais inclinado).
 * → { connected, pad (o controle com atividade mais recente), down: bool[17], rt, stick {x,y,m}, dpad {x,y} }
 */
export function readGamepad() {
  const pads = connectedPads();
  const out = { connected: pads.length > 0, pad: null, down: new Array(17).fill(false), rt: 0, lt: 0, stick: { x: 0, y: 0, m: 0 }, dpad: { x: 0, y: 0 }, count: pads.length };
  let bestM = 0;
  let bestTs = -Infinity;
  for (const p of pads) {
    let active = false;
    for (let i = 0; i < 17; i++) {
      const d = i === PAD.RT || i === PAD.LT ? btnValue(p, i) > 0.5 : btnDown(p, i);
      if (d) { out.down[i] = true; active = true; }
    }
    out.rt = Math.max(out.rt, btnValue(p, PAD.RT));
    out.lt = Math.max(out.lt, btnValue(p, PAD.LT));
    const s = shapeStick(p.axes?.[0] || 0, p.axes?.[1] || 0);
    if (s.m > bestM) { bestM = s.m; out.stick = s; }
    if (s.m > 0) active = true;
    const ts = (active ? 1e12 : 0) + (p.timestamp || 0);
    if (ts > bestTs) { bestTs = ts; out.pad = p; }
  }
  out.dpad.x = (out.down[PAD.RIGHT] ? 1 : 0) - (out.down[PAD.LEFT] ? 1 : 0);
  out.dpad.y = (out.down[PAD.UP] ? 1 : 0) - (out.down[PAD.DOWN] ? 1 : 0);
  return out;
}

/** Vibração curta (se o controle suportar). strong/weak 0..1, ms. */
export function rumblePad(pad, strong = 0.3, weak = 0.3, ms = 120) {
  try {
    const act = pad?.vibrationActuator;
    if (act?.playEffect) {
      act.playEffect('dual-rumble', {
        startDelay: 0, duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak),
      })?.catch?.(() => {});
      return true;
    }
    pad?.hapticActuators?.[0]?.pulse?.(Math.max(strong, weak), ms);
  } catch { /* sem vibração */ }
  return false;
}

/**
 * Entrada do jogo. opts.onDevice(type) é chamado quando o último dispositivo usado muda
 * ('keyboard' | 'gamepad') — o jogo emite `input:device {type}`.
 */
/** @param {{ onDevice?: (type: 'keyboard' | 'gamepad') => void }} [opts] */
export function createInput({ onDevice } = {}) {
  const down = new Set();
  const pressed = new Set();
  let device = 'keyboard';
  const setDevice = (t) => {
    if (t === device) return;
    device = t;
    onDevice?.(t);
  };

  const onDown = (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    setDevice('keyboard');
    if (e.repeat) return;
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  };
  const onUp = (e) => {
    down.delete(e.code);
  };
  // ---------- controle ----------
  const pad = {
    prev: new Array(17).fill(false),
    cur: new Array(17).fill(false),
    latched: new Set(), // botões ignorados até soltar (não vazam do menu para o jogo)
    stick: { x: 0, y: 0, m: 0 },
    dpad: { x: 0, y: 0 },
    shiftHeld: false,
    bafo: false,
    rtHeld: false,
    ltHeld: false,
    connected: false,
    last: null, // controle com atividade mais recente (vibração)
  };
  const clear = () => {
    down.clear();
    pressed.clear();
    pad.latched = new Set(pad.cur.map((d, i) => (d ? i : -1)).filter((i) => i >= 0));
  };
  addEventListener('keydown', onDown);
  addEventListener('keyup', onUp);
  addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clear();
  });
  addEventListener('gamepadconnected', () => { pad.connected = true; });
  addEventListener('gamepaddisconnected', () => {
    // Desconectou no meio do jogo: solta tudo o que estava "segurado" pelo controle.
    const g = readGamepad();
    if (!g.connected) {
      pad.cur.fill(false);
      pad.prev.fill(false);
      pad.stick = { x: 0, y: 0, m: 0 };
      pad.dpad = { x: 0, y: 0 };
      pad.shiftHeld = false;
      pad.bafo = false;
      pad.connected = false;
      pad.last = null;
      if (device === 'gamepad') setDevice('keyboard');
    }
  });

  /** Lê o controle (chame uma vez no começo do quadro). Gera as bordas nos códigos lógicos. */
  function poll() {
    const g = readGamepad();
    pad.connected = g.connected;
    if (!g.connected) {
      if (pad.cur.some(Boolean) || pad.stick.m) {
        pad.cur.fill(false);
        pad.prev.fill(false);
        pad.stick = { x: 0, y: 0, m: 0 };
        pad.dpad = { x: 0, y: 0 };
        pad.shiftHeld = false;
        pad.bafo = false;
      }
      return;
    }
    pad.last = g.pad;
    pad.prev = pad.cur;
    pad.cur = g.down.slice();
    // RT com histerese (gatilho analógico)
    pad.rtHeld = pad.rtHeld ? g.rt > 0.35 : g.rt > 0.55;
    pad.cur[PAD.RT] = pad.rtHeld;
    pad.ltHeld = pad.ltHeld ? g.lt > 0.35 : g.lt > 0.55;
    pad.cur[PAD.LT] = pad.ltHeld;
    for (const i of [...pad.latched]) if (!pad.cur[i]) pad.latched.delete(i);
    const isDown = (i) => pad.cur[i] && !pad.latched.has(i);
    const edge = (i) => isDown(i) && !pad.prev[i];
    let activity = g.stick.m > 0.25;
    for (const [i, code] of PAD_EDGE_CODES) {
      if (edge(i)) { pressed.add(code); activity = true; }
    }
    const shiftNow = isDown(PAD.RB) || isDown(PAD.RT);
    pad.bafo = isDown(PAD.LT);
    if (shiftNow && !pad.shiftHeld) { pressed.add(PAD_SHIFT); activity = true; }
    pad.shiftHeld = shiftNow;
    pad.stick = g.stick;
    pad.dpad = {
      x: (isDown(PAD.RIGHT) ? 1 : 0) - (isDown(PAD.LEFT) ? 1 : 0),
      y: (isDown(PAD.UP) ? 1 : 0) - (isDown(PAD.DOWN) ? 1 : 0),
    };
    if (pad.dpad.x || pad.dpad.y) activity = true;
    for (let i = 0; i < 17; i++) if (edge(i)) activity = true;
    if (activity) setDevice('gamepad');
  }

  const any = (codes) => codes.some((c) => down.has(c));

  return {
    poll,
    isDown: (code) => down.has(code),
    any,
    /** true se a tecla/botão lógico foi apertado desde o último endFrame (consome o toque). */
    consume(...codes) {
      let hit = false;
      for (const c of codes) {
        if (pressed.has(c)) {
          pressed.delete(c);
          hit = true;
        }
      }
      return hit;
    },
    shift: () => any(SHIFT) || pad.shiftHeld,
    /** Superbafo: segurando (teclado R ou L2/LT). */
    bafo: () => down.has('KeyR') || pad.bafo,
    consumeShift() {
      let hit = false;
      for (const c of SHIFT) if (pressed.delete(c)) hit = true;
      if (pressed.delete(PAD_SHIFT)) hit = true;
      return hit;
    },
    /**
     * Eixos: x = direita(+)/esquerda(−), y = frente(+)/trás(−). m = magnitude 0..1 (velocidade
     * proporcional no analógico; teclado e D-pad = 1).
     */
    axis() {
      if (pad.stick.m > 0) return { x: pad.stick.x, y: pad.stick.y, m: pad.stick.m };
      let x = (any(MOVE.right) ? 1 : 0) - (any(MOVE.left) ? 1 : 0) + pad.dpad.x;
      let y = (any(MOVE.up) ? 1 : 0) - (any(MOVE.down) ? 1 : 0) + pad.dpad.y;
      x = Math.max(-1, Math.min(1, x));
      y = Math.max(-1, Math.min(1, y));
      return { x, y, m: x || y ? 1 : 0 };
    },
    /** Ignora os botões do controle que estão segurados agora até serem soltos (ao voltar a jogar). */
    latchPad() {
      // relê o controle agora (a UI pode ter visto o botão neste quadro antes do jogo)
      const g = readGamepad();
      for (let i = 0; i < 17; i++) if (pad.cur[i] || g.down[i]) pad.latched.add(i);
      if (g.rt > 0.35) pad.latched.add(PAD.RT);
      if (g.lt > 0.35) pad.latched.add(PAD.LT);
      pad.bafo = false;
      for (const [, code] of PAD_EDGE_CODES) if (code !== 'Escape') pressed.delete(code);
      pad.shiftHeld = false;
      pressed.delete(PAD_SHIFT);
    },
    /** Descarta os toques pendentes do controle (ex.: fora de 'playing'). */
    dropPadEdges() {
      for (const [, code] of PAD_EDGE_CODES) if (code !== 'Escape') pressed.delete(code);
      pressed.delete(PAD_SHIFT);
    },
    /** Vibração curta no controle usado por último (só se o último dispositivo for o controle). */
    rumble(strong, weak, ms) {
      if (device !== 'gamepad' || !pad.last) return false;
      return rumblePad(pad.last, strong, weak, ms);
    },
    get device() { return device; },
    get padConnected() { return pad.connected; },
    endFrame() {
      pressed.clear();
    },
    clear,
  };
}

// ---------------------------------------------------------------------
//  Leitura do controle para os MENUS da UI (estado próprio, independente do jogo).
//  Chame uma vez por quadro no ui.update(). Devolve bordas já com auto-repetição nas direções:
//  { connected, up, down, left, right, confirm (A), back (B), start (Start), any, stick:{x,y} }
// ---------------------------------------------------------------------
const menuPad = { prev: new Array(17).fill(false), dir: null, dirT: 0, last: 0 };
const REPEAT_DELAY = 0.38;
const REPEAT_RATE = 0.13;
export function pollMenuPad(now = performance.now()) {
  const g = readGamepad();
  const dt = menuPad.last ? Math.min(0.1, (now - menuPad.last) / 1000) : 0;
  menuPad.last = now;
  const out = { connected: g.connected, up: false, down: false, left: false, right: false, confirm: false, back: false, start: false, any: false, stick: { x: g.stick.x, y: g.stick.y } };
  if (!g.connected) {
    menuPad.prev.fill(false);
    menuPad.dir = null;
    return out;
  }
  const edge = (i) => g.down[i] && !menuPad.prev[i];
  out.confirm = edge(PAD.A);
  out.back = edge(PAD.B);
  out.start = edge(PAD.START);
  // Direção: D-pad ou analógico (limiar 0,5), com repetição ao segurar.
  let dir = null;
  const sx = g.stick.x;
  const sy = g.stick.y;
  if (g.down[PAD.UP] || (sy > 0.5 && Math.abs(sy) >= Math.abs(sx))) dir = 'up';
  else if (g.down[PAD.DOWN] || (sy < -0.5 && Math.abs(sy) >= Math.abs(sx))) dir = 'down';
  else if (g.down[PAD.LEFT] || sx < -0.5) dir = 'left';
  else if (g.down[PAD.RIGHT] || sx > 0.5) dir = 'right';
  if (dir !== menuPad.dir) {
    menuPad.dir = dir;
    menuPad.dirT = 0;
    if (dir) out[dir] = true;
  } else if (dir) {
    const before = menuPad.dirT;
    menuPad.dirT += dt;
    if (before < REPEAT_DELAY && menuPad.dirT >= REPEAT_DELAY) out[dir] = true;
    else if (menuPad.dirT > REPEAT_DELAY && Math.floor((menuPad.dirT - REPEAT_DELAY) / REPEAT_RATE) > Math.floor((before - REPEAT_DELAY) / REPEAT_RATE)) out[dir] = true;
  }
  menuPad.prev = g.down.slice();
  out.any = out.confirm || out.back || out.start || out.up || out.down || out.left || out.right;
  return out;
}
