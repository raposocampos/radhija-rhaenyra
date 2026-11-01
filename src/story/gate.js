// Onde o Modo História pode abrir por enquanto (docs/MODO-HISTORIA.md, etapa 2): ?historia vale numa prévia de PR
// (o caminho /previews/pr-N/… ou o build da prévia, com o número do PR) e na versão de desenvolvimento (sem versão:
// o Vite local e o servidor do E2E). No link principal (produção) não abre nada, e o card do menu segue "Em breve"
// até a etapa 3. Fica fora de src/story/areas/ para o main.js decidir sem baixar a área.

/**
 * @param {{ version?: string | null, pr?: number | null } | null | undefined} build a versão embutida (src/core/version.js)
 * @param {string} [pathname] location.pathname
 */
export function storyAllowed(build, pathname = '') {
  if (/\/previews\/pr-\d+\//.test(pathname)) return true;
  if (!build) return true;
  if (build.pr != null) return true;
  return build.version == null;
}
