// Registro do próprio Chromium para diagnosticar travamentos no CI (ver hang-probe.mjs e docs/ARQUITETURA.md §11).
// IMPORTAR ANTES DE 'playwright-core': o Playwright lê DEBUG e DEBUG_FILE ao carregar. Com eles, a saída do navegador
// (stderr do Chromium, que browserOptions liga com --enable-logging=stderr no CI) vai para um arquivo por processo em
// shots/diagnostico/, guardado no artefato do job, sem encher o log do GitHub. No PC só com E2E_BROWSER_LOG=1.
import { mkdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export const DIAG_DIR = resolve('shots/diagnostico');
export let browserLogFile = null;

if ((process.env.CI || process.env.E2E_BROWSER_LOG) && !process.env.DEBUG_FILE) {
  mkdirSync(DIAG_DIR, { recursive: true });
  const script = basename(process.argv[1] || 'node', '.mjs');
  browserLogFile = resolve(DIAG_DIR, `navegador-${script}-${process.pid}.log`);
  process.env.DEBUG_FILE = browserLogFile;
  process.env.DEBUG = [process.env.DEBUG, 'pw:browser'].filter(Boolean).join(',');
} else if (process.env.DEBUG_FILE) {
  browserLogFile = resolve(process.env.DEBUG_FILE);
}
