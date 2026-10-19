// Emissão e histórico de diagnóstico. Estado do jogo e acesso ao controle ficam no núcleo.

/** @typedef {[strong: number, weak: number, ms: number]} RumblePattern */

// Vibração por evento: [forte, fraca, ms] (curta e suave), calculada a partir do payload.
/** @type {Record<string, (payload: { strength?: number, locked?: boolean }) => RumblePattern>} */
const RUMBLE = {
  'dog:bump': (p) => [0.18 + 0.3 * (p.strength || 0.3), 0.35, 90],
  'dog:dash': () => [0.05, 0.28, 70],
  'gate:open': () => [0.22, 0.18, 240],
  'sprinkler:hit': () => [0.15, 0.45, 200],
  'goose:hit': () => [0.5, 0.35, 220],
  'wedge:kick': (p) => (p.locked ? [0.35, 0.3, 160] : [0.2, 0.2, 80]),
  'crate:sink': () => [0.4, 0.2, 260],
  'plate:press': () => [0.08, 0.2, 60],
  'dog:land': () => [0.18, 0.22, 70],
  'dog:bafo': () => [0.12, 0.4, 260],
  'expresso:atchim': () => [0.28, 0.3, 170],
  'extra:secret': () => [0.22, 0.5, 380],
};

/**
 * O núcleo recebe uma função para calcular o padrão. A decisão de vibrar fica
 * depois do dispatch, inclusive durante a inicialização da entrada.
 * @param {{ dispatch: import('../types').GameEmit, now: () => number,
 *           rumble: (pattern: () => RumblePattern) => void }} deps
 */
export function createGameEvents({ dispatch, now, rumble }) {
  /** @type {{ t: number, name: string, payload: object }[]} */
  const log = [];

  /** @param {string} name @param {object} payload */
  function record(name, payload) {
    log.push({ t: Math.round(now()), name, payload });
    if (log.length > 500) log.shift();
  }

  const emitEvent = (name, payload = {}) => {
    record(name, payload);
    dispatch(name, payload);
    const pattern = RUMBLE[name];
    if (pattern) rumble(() => pattern(payload));
  };
  /** @type {import('../types').GameEmit} */
  const emit = emitEvent;

  return {
    emit,
    log,
    /** @param {string} [name] */
    events: (name) => log.filter((e) => !name || e.name === name),
    clearLog: () => { log.length = 0; },
    // Foco de câmera é só diagnóstico: não dispara listeners nem vibração.
    /** @param {number} x @param {number} z */
    recordCameraShot(x, z) {
      record('camera:shot', { x: +x.toFixed(2), z: +z.toFixed(2) });
    },
  };
}
