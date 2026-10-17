import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // URLs relativas funcionam também na subpasta do GitHub Pages.
  base: './',
  server: { host: '127.0.0.1', port: 5173 },
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // O cenário de cada fase vem sob demanda (LevelDef.load): o chunk leva o nome da fase (fase2-world-….js).
        chunkFileNames(chunk) {
          const fase = chunk.facadeModuleId?.match(/levels[\\/]([^\\/]+)[\\/]world/)?.[1];
          return `assets/${fase ? `${fase}-world` : '[name]'}-[hash].js`;
        },
      },
    },
  },
});
