// Constantes globais embutidas pelo Vite (define em vite.config.js). Arquivo sem import/export: declarações globais.

/** Versão calculada no CI (tools/deploy/version.mjs); na prévia, version/build são os do main sob ela. */
interface GameBuildInfo {
  version: string | null;
  build: number | null;
  pr: number | null;
  label: string;
}

/** Ausente fora do Vite (testes em Node): ler com try/catch (src/core/version.js). */
declare const __GAME_VERSION__: GameBuildInfo | undefined;
