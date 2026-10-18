// Botão ou alavanca no alto de uma parede marcada com patinhas: só o impulso na parede da Rhaenyra alcança
// (Espaço / ✕ de frente para as patinhas; o núcleo chama puzzle.onWallTouch quando a pata chega ao alto).
// cfg (do layout): { x, z, nx, nz, top, kind: 'button' | 'lever', mode, holdTime }
//   (x, z) = pé da parede no meio das patinhas; (nx, nz) = normal da parede (para o lado da dog); top = altura do
//   que a pata toca (m): o topo do botão ou a bolinha da alavanca levantada. O spot leva também a saliência e a
//   altura e o afastamento das patinhas dianteiras (WALL_BUTTON_SHAPE, as mesmas medidas de src/world/wallButton.js).
//   mode 'timed' (padrão do botão): liga por holdTime s e desliga sozinho (o anel de luzes mostra o tempo);
//   'toggle' (padrão da alavanca): cada impulso troca; 'once': liga e fica.
// O puzzle oferece `spot` em wallSpots() enquanto o botão vale e repassa onWallTouch → touch(). Eventos:
//   wall:button { id, kind, on, x, y, z } a cada acionamento · wall:tick { id, left, x, y, z } a cada segundo do
//   botão com tempo · wall:timeout { id, x, y, z } quando o tempo acaba. (x, z) um pouco à frente da parede.
import { pickWallSpot } from '../dogController.js';

/**
 * Medidas do desenho (src/world/wallButton.js) que a pose usa: out = quanto o que a pata toca sai da parede;
 * paws = quanto abaixo do toque ficam as patinhas dianteiras pintadas, side = quanto para cada lado (m).
 */
export const WALL_BUTTON_SHAPE = Object.freeze({
  button: Object.freeze({ out: 0.058, paws: 0.07, side: 0.165 }),
  lever: Object.freeze({ out: 0.08, paws: 0.07, side: 0.165 }),
});

/**
 * @param {{ id: string, cfg: import('../../types').WallButtonCfg, emit: import('../../types').GameEmit,
 *   prop?: import('../../types').WallButtonProp | null }} opts
 */
export function createWallButton({ id, cfg, emit, prop = null }) {
  const kind = cfg.kind || 'button';
  const mode = cfg.mode || (kind === 'lever' ? 'toggle' : 'timed');
  const holdTime = cfg.holdTime ?? 5;
  /** @type {import('../../types').WallSpot} */
  const shape = WALL_BUTTON_SHAPE[kind];
  const spot = { id, x: cfg.x, z: cfg.z, nx: cfg.nx, nz: cfg.nz, top: cfg.top, out: shape.out, paws: cfg.top - shape.paws, side: shape.side };
  const S = { on: false, t: 0, press: 0, presses: 0 };
  const at = () => ({ id, x: cfg.x + cfg.nx * 0.1, y: cfg.top, z: cfg.z + cfg.nz * 0.1 });

  function show() {
    prop?.setPress(S.press);
    prop?.setOn(S.on);
    prop?.setTimer?.(mode === 'timed' && S.on ? Math.max(0, S.t / holdTime) : null);
  }

  /** A pata chegou ao alto (puzzle.onWallTouch com este spot). → true se acionou. */
  function touch() {
    S.press = 1;
    S.presses++;
    if (mode === 'toggle') S.on = !S.on;
    else {
      S.on = true;
      if (mode === 'timed') S.t = holdTime; // de novo durante o tempo: recomeça a contar
    }
    emit('wall:button', { ...at(), kind, on: S.on, mode });
    show();
    return true;
  }

  /** Por quadro (pausa congela: o puzzle só chama em 'playing'). */
  function update(dt) {
    if (S.press > 0) S.press = Math.max(0, S.press - dt * 3.2);
    if (mode === 'timed' && S.on) {
      const before = Math.ceil(S.t);
      S.t -= dt;
      if (S.t > 0 && Math.ceil(S.t) < before) emit('wall:tick', { ...at(), left: Math.ceil(S.t) });
      if (S.t <= 0) {
        S.t = 0;
        S.on = false;
        emit('wall:timeout', at());
      }
    }
    show();
  }

  function reset() {
    Object.assign(S, { on: false, t: 0, press: 0, presses: 0 });
    show();
  }

  return {
    id,
    kind,
    mode,
    spot,
    touch,
    update,
    reset,
    get on() { return S.on; },
    /** Segundos que faltam (botão com tempo). */
    get remaining() { return S.t; },
    get presses() { return S.presses; },
    /** A dog `c` daria o impulso aqui agora (perto, do lado de cá e de frente)? Para o prompt do puzzle. */
    inReach(c) { return pickWallSpot(c, [spot]) === spot; },
    /** Ponto do alto (onde fica o marcador do objetivo). */
    target(y = 0.25) { return { x: cfg.x + cfg.nx * 0.12, y: cfg.top + y, z: cfg.z + cfg.nz * 0.12 }; },
    /** Liga/desliga direto (jumpToStage e testes): sem evento. */
    setOn(on, t = holdTime) {
      S.on = !!on;
      S.t = S.on && mode === 'timed' ? t : 0;
      show();
    },
    info: () => ({ on: S.on, remaining: +S.t.toFixed(2), presses: S.presses }),
  };
}
