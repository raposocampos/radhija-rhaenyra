// Tela cheia no iPhone. O Safari do iPhone não deixa uma página ocupar a tela inteira (requestFullscreen só vale para
// vídeo); o caminho é o app da tela inicial (manifest + metas apple-* do index.html: abre pelo ícone sem a barra do
// Safari, deitado e respeitando as áreas seguras). Fora dele, esta dica explica como, de três jeitos discretos:
// - na tela inicial, um cartão sob o Jogar, uma vez só (fecha no ×, ou conta como visto ao começar a jogar deitado);
// - no aviso de girar o celular, uma linha;
// - nos ajustes da pausa (e das Opções, no menu com telas), uma nota curta com o passo a passo (no Android ali fica o
//   botão Tela cheia; o iPhone não tem essa API).
//   É só texto: nada focável que o teclado ou o controle ativariam sem efeito.
// No PC, no Android, no iPad com tela cheia e no app da tela inicial nada disso existe (needsInstallTip).
// Os elementos são inseridos no DOM da UI depois que ela é montada (ui.js não muda).
import './installHint.css';
import { events } from '../core/events.js';
import { storageKey } from '../game/storageKey.js';
import { needsInstallTip, readInstallEnv } from '../core/quality.js';

export const INSTALL_TIP_KEY = storageKey('rr-dica-tela-inicial');

const ico = (d) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
/** Botão Compartilhar do Safari (caixa com seta para cima) e "Adicionar à Tela de Início" (quadrado com +). */
const SHARE = ico('<path d="M12 3.5v11"/><path d="M8.2 7.2L12 3.4l3.8 3.8"/><path d="M8 10H6.2A1.7 1.7 0 0 0 4.5 11.7v7.6A1.7 1.7 0 0 0 6.2 21h11.6a1.7 1.7 0 0 0 1.7-1.7v-7.6A1.7 1.7 0 0 0 17.8 10H16"/>');
const ADD = ico('<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>');
const STEPS = `toque em ${SHARE}<b>Compartilhar</b> e em ${ADD}<b>Adicionar à Tela de Início</b>; depois abra o jogo pelo ícone.`;

/**
 * @param {{ root: HTMLElement, device: import('../core/quality.js').DeviceKind, audio?: any,
 *           storage?: Storage | null, env?: ReturnType<typeof readInstallEnv> }} opts
 */
export function createInstallHint({ root, device, audio = null, storage = globalThis.localStorage, env = readInstallEnv(window) }) {
  if (!needsInstallTip({ ...env, device })) return { active: false, tipShown: false };
  root.dataset.installTip = '1';

  // 1) cartão na tela inicial, uma vez só
  let seen = false;
  try { seen = storage?.getItem(INSTALL_TIP_KEY) === '1'; } catch { /* armazenamento indisponível */ }
  const card = document.createElement('div');
  card.className = 'rr-ios-tip';
  card.setAttribute('role', 'note');
  card.innerHTML = `<span class="rr-ios-tip__text"><b class="rr-ios-tip__title">Tela cheia no iPhone:</b> ${STEPS}</span>
    <button class="rr-ios-tip__close" type="button" aria-label="Fechar a dica">×</button>`;
  const dismiss = () => {
    if (!card.isConnected) return;
    card.remove();
    try { storage?.setItem(INSTALL_TIP_KEY, '1'); } catch { /* armazenamento indisponível */ }
  };
  // sob o Jogar: na tela principal do menu (.rr-screen--main, do menu com telas) ou no centro da tela inicial
  if (!seen) (root.querySelector('.rr-screen--main') || root.querySelector('.rr-title__center'))?.appendChild(card);
  card.querySelector('button').addEventListener('click', (e) => {
    e.stopPropagation();
    audio?.play?.('uiClick');
    dismiss();
  });
  const landscape = () => {
    try { return matchMedia('(orientation: landscape)').matches; } catch { return true; }
  };
  // começar a jogar com o cartão à vista (celular deitado) também conta como visto
  events.on('game:state', ({ state, prev }) => {
    if (prev === 'title' && state !== 'title' && landscape()) dismiss();
  });

  // 2) uma linha no aviso de girar o celular
  const rotate = root.querySelector('.rr-rotate__box');
  if (rotate) {
    const line = document.createElement('span');
    line.className = 'rr-rotate__ios';
    line.innerHTML = `Para jogar em tela cheia, ${STEPS}`;
    rotate.appendChild(line);
  }

  // 3) nos ajustes (pausa e, no menu com telas, Opções), uma nota com o passo a passo (só texto)
  for (const settings of root.querySelectorAll('.rr-pause__settings, .rr-card--options .rr-settings')) {
    const how = document.createElement('p');
    how.className = 'rr-ios-fs__how';
    how.innerHTML = `<b class="rr-ios-tip__title">Tela cheia no iPhone:</b> ${STEPS}`;
    settings.append(how);
  }

  return {
    active: true,
    get tipShown() { return card.isConnected; },
    dismiss,
  };
}
