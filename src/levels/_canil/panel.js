// CANIL DAS DOGS — painel da vitrine (só nesta fase de desenvolvimento): pose, vista, esqueleto, pelo molhado,
// câmera e o link para jogar as fases com o modelo novo. Fica sob a interface do jogo (#ui, z-index 10): a pausa
// e o cartão da fase cobrem o painel. Os botões não ficam com o foco do teclado (Espaço continua sendo o pulo).

const CSS = `
.canil-panel { position: fixed; top: 112px; right: 14px; z-index: 9; width: 264px; max-height: calc(100vh - 190px);
  display: flex; flex-direction: column; font: 600 13px/1.25 Nunito, system-ui, sans-serif; color: #4A3426;
  background: rgba(255, 246, 230, 0.9); border-radius: 14px; box-shadow: 0 6px 18px rgba(54, 32, 16, 0.22); }
.canil-panel[data-open="0"] { width: auto; }
.canil-panel[data-open="0"] .canil-body { display: none; }
.canil-head { all: unset; cursor: pointer; padding: 9px 12px; font-weight: 800; font-size: 14px; display: flex; justify-content: space-between; gap: 10px; }
.canil-body { overflow-y: auto; padding: 0 10px 10px; }
.canil-tip { margin: 0 2px 8px; font-weight: 600; opacity: .8; }
.canil-h { margin: 8px 2px 4px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; opacity: .7; }
.canil-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.canil-btn { all: unset; cursor: pointer; padding: 5px 7px; border-radius: 8px; background: rgba(74, 52, 38, 0.08); text-align: center; }
.canil-btn:hover { background: rgba(240, 138, 60, 0.22); }
.canil-btn[aria-pressed="true"] { background: #F08A3C; color: #fff; }
.canil-link { display: block; margin-top: 10px; padding: 7px 8px; border-radius: 8px; background: #7FA36B; color: #fff; text-align: center; text-decoration: none; }
`;

/**
 * @param {{
 *   poses: { id: string, label: string }[], views: { id: string, label: string }[],
 *   onPose(id: string): void, onView(id: string): void, onSkeleton(on: boolean): void, onWet(on: boolean): void,
 *   onCamera(mode: 'vitrine' | 'livre'): void,
 * }} opts
 * → { el, sync(state), dispose() } ou null sem DOM (testes em Node)
 */
export function createPanel(opts) {
  if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') return null;
  const el = document.createElement('div');
  el.className = 'canil-panel';
  el.dataset.open = '1';
  const style = document.createElement('style');
  style.textContent = CSS;
  el.append(style);

  const head = document.createElement('button');
  head.className = 'canil-head';
  head.type = 'button';
  head.innerHTML = '<span>Canil · atual × nova</span><span aria-hidden="true">▾</span>';
  const body = document.createElement('div');
  body.className = 'canil-body';
  el.append(head, body);

  const tip = document.createElement('p');
  tip.className = 'canil-tip';
  tip.textContent = 'Em cada par, a dog do modelo atual fica à esquerda e a do novo à direita. Todas fazem a mesma pose.';
  body.append(tip);

  /** @type {HTMLButtonElement[]} */
  const buttons = [];
  /** Botão que não rouba o foco (o teclado segue no jogo). */
  const button = (label, data, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'canil-btn';
    b.textContent = label;
    b.tabIndex = -1;
    for (const [k, v] of Object.entries(data)) b.dataset[k] = v;
    b.addEventListener('pointerdown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      onClick();
      b.blur();
    });
    buttons.push(b);
    return b;
  };
  const section = (title, items) => {
    const h = document.createElement('p');
    h.className = 'canil-h';
    h.textContent = title;
    const grid = document.createElement('div');
    grid.className = 'canil-grid';
    grid.append(...items);
    body.append(h, grid);
  };

  section('Pose', opts.poses.map((p) => button(p.label, { pose: p.id }, () => opts.onPose(p.id))));
  section('Vista', opts.views.map((v) => button(v.label, { view: v.id }, () => opts.onView(v.id))));
  const state = { skeleton: false, wet: false, camera: 'vitrine' };
  section('Mostrar', [
    button('Esqueleto', { toggle: 'skeleton' }, () => opts.onSkeleton(!state.skeleton)),
    button('Pelo molhado', { toggle: 'wet' }, () => opts.onWet(!state.wet)),
    button('Câmera na vitrine', { camera: 'vitrine' }, () => opts.onCamera('vitrine')),
    button('Câmera na dog', { camera: 'livre' }, () => opts.onCamera('livre')),
  ]);
  const link = document.createElement('a');
  link.className = 'canil-link';
  link.href = '?level=1&play&dogs=novo';
  link.textContent = 'Jogar as fases com o modelo novo';
  link.dataset.link = 'fases-modelo-novo';
  body.append(link);

  head.addEventListener('pointerdown', (e) => e.preventDefault());
  head.addEventListener('click', () => {
    el.dataset.open = el.dataset.open === '1' ? '0' : '1';
    head.blur();
  });
  // no celular a tela é pequena: o painel começa fechado
  if (globalThis.matchMedia?.('(max-width: 900px), (pointer: coarse)').matches) el.dataset.open = '0';
  document.body.append(el);

  return {
    el,
    /** Marca os botões ativos. @param {{ pose: string, view: string, skeleton: boolean, wet: boolean, camera: string }} s */
    sync(s) {
      Object.assign(state, { skeleton: s.skeleton, wet: s.wet, camera: s.camera });
      for (const b of buttons) {
        const d = b.dataset;
        const on = d.pose ? d.pose === s.pose : d.view ? d.view === s.view : d.toggle ? !!s[d.toggle] : d.camera === s.camera;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    },
    dispose() {
      el.remove();
    },
  };
}
