// Servidor de teste da Mecânica sem HMR (evita recarregar a página no meio de uma partida automatizada
// quando outro agente salva um arquivo). Uso:
//   npx vite --config tools/scripts/vite.nohmr.config.mjs --port 5176 --strictPort --host 127.0.0.1
import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export default defineConfig({
  root,
  server: { host: '127.0.0.1', port: 5176, hmr: false, watch: { ignored: ['**/shots/**', '**/.builds/**'] } },
});
