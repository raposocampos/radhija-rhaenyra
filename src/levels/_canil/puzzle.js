// CANIL DAS DOGS (fase de desenvolvimento) — PUZZLE. Não há item nem objetivo: a fase é a vitrine que compara o
// modelo atual das cachorrinhas com o novo (display.js) e o painel que escolhe pose, vista e câmera (panel.js).
// A câmera começa enquadrando a vitrine; "Câmera na dog" volta ao seguimento normal.
import { createPanel } from './panel.js';

export const STAGES = ['start', 'done'];

export const TEXT = {
  objective: 'Compare o modelo atual e o novo: escolha a pose no painel',
};

/** @import { PuzzleContext, Puzzle } from '../../types' */

/**
 * @param {PuzzleContext<import('./display.js').CanilProps>} ctx
 * @returns {Puzzle}
 */
export function createPuzzle(ctx) {
  const { layout, props } = ctx;
  const { SHOWCASE } = layout;
  const display = props.display;
  display?.start?.();

  const S = { stage: 'start', camera: /** @type {'vitrine' | 'livre'} */ ('vitrine'), camT: 0 };
  /** @type {(stage: string) => void} */
  let onStageChange = () => {};

  /** Mantém (ou solta) o enquadramento da vitrine. */
  function frameShowcase(instant = false) {
    ctx.cam?.focusShot?.(0, SHOWCASE.z, { hold: 120, inT: instant ? 0.01 : 0.9, outT: 0.8, scale: 1.05, y: 0.3 });
    S.camT = 110;
  }
  function setCamera(mode) {
    S.camera = mode;
    if (mode === 'vitrine') frameShowcase();
    else ctx.cam?.focusShot?.(0, SHOWCASE.z, { hold: 0, inT: 0.01, outT: 0.9, scale: 1.05, y: 0.3 });
    sync();
  }

  const panel = createPanel({
    poses: display?.poses ?? [],
    views: display?.views ?? [],
    onPose: (id) => { display?.setPose(id); sync(); },
    onView: (id) => { display?.setView(id); sync(); },
    onSkeleton: (on) => { display?.setSkeleton(on); sync(); },
    onWet: (on) => { display?.setWet(on); sync(); },
    onCamera: (mode) => setCamera(mode),
  });
  function sync() {
    const d = display?.info?.();
    panel?.sync({ pose: d?.pose, view: d?.view, skeleton: !!d?.skeleton, wet: !!d?.wet, camera: S.camera });
  }
  frameShowcase(true);
  sync();

  function update(dt) {
    if (S.camera === 'vitrine') {
      S.camT -= dt;
      if (S.camT <= 0) frameShowcase(true);
    }
    return null;
  }

  function reset() {
    display?.reset?.();
    S.camera = 'vitrine';
    frameShowcase(true);
    sync();
  }

  return {
    stages: STAGES,
    objective: () => ({ text: TEXT.objective, target: null, stage: S.stage }),
    update,
    interact: () => false,
    reset,
    lockFor: () => null,
    lookTarget: () => null,
    navFlags: () => ({}),
    /** Para os testes e capturas: escolhe pose/vista sem o painel. */
    setPose: (id) => { const ok = display?.setPose(id); sync(); return ok; },
    setView: (id) => { const ok = display?.setView(id); sync(); return ok; },
    setCamera,
    info: () => ({ canil: { ...(display?.info?.() ?? {}), camera: S.camera, panel: !!panel } }),
    dispose() {
      panel?.dispose();
    },
    set onStageChange(fn) { onStageChange = fn; },
    get onStageChange() { return onStageChange; },
    get stage() { return S.stage; },
    get carrier() { return null; },
    get collected() { return 0; },
    get total() { return 0; },
  };
}
