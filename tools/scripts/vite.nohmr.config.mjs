// Servidor de teste sem HMR: salvar um arquivo no meio de uma partida automatizada não recarrega a página.
// `npm run test:e2e` sobe este servidor sozinho (tools/scripts/run-e2e.mjs). Para subir à mão:
//   npx vite --config tools/scripts/vite.nohmr.config.mjs --port 5176 --strictPort --host 127.0.0.1
// O cache de dependências é separado do servidor de desenvolvimento (node_modules/.vite), para que os
// dois possam rodar ao mesmo tempo sem um reotimizar as dependências do outro.
import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export default defineConfig({
  root,
  cacheDir: resolve(root, 'node_modules/.vite-test'),
  clearScreen: false,
  server: { host: '127.0.0.1', port: 5176, hmr: false, watch: { ignored: ['**/shots/**', '**/.builds/**', '**/dist/**'] } },
});
