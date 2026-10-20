// Versão do jogo, mostrada no canto do menu principal (regra em docs/ENTREGA.md, "Versão do jogo"). O CI calcula
// pelo histórico do main (tools/deploy/version.mjs) e o Vite embute no build (define __GAME_VERSION__ em
// vite.config.js). Produção: "v0.10.0 · build 90"; prévia de PR: "prévia PR #49 · sobre v0.10.0".

/** @returns {GameBuildInfo | null} */
function readBuildInfo() {
  try {
    return __GAME_VERSION__ ?? null;
  } catch {
    return null; // fora do Vite (testes em Node, servidor do E2E sem o define): versão de desenvolvimento
  }
}

export const BUILD_INFO = readBuildInfo();
export const VERSION_LABEL = BUILD_INFO?.label || 'versão de desenvolvimento';
