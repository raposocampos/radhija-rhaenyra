// Partidas automatizadas de ponta a ponta (npm run test:e2e).
// Sobe um servidor Vite SEM HMR numa porta livre, roda as partidas Playwright em sequência e derruba o
// servidor no fim (inclusive em erro ou Ctrl+C). No Windows, matar o shell não mata o node filho do
// Vite: por isso o Vite é iniciado direto pelo node (sem npx/cmd) e encerrado com `taskkill /T /F`.
//   node tools/scripts/run-e2e.mjs [--only fase1,fase2,fase3,fase4,fase5,controle,regressoes,pulo,bafo] [--port 5190] [--url http://...]
// Com --url, usa um servidor já rodando (não sobe nem derruba nada).
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/harness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SUITES = [
  { id: 'fase1', script: 'tools/scripts/playthrough.mjs' },
  { id: 'fase2', script: 'tools/scripts/playthrough-fase2.mjs' },
  { id: 'fase3', script: 'tools/scripts/playthrough-fase3.mjs' },
  { id: 'fase4', script: 'tools/scripts/playthrough-fase4.mjs' },
  { id: 'fase5', script: 'tools/scripts/playthrough-fase5.mjs' },
  { id: 'controle', script: 'tools/scripts/test-gamepad.mjs' },
  { id: 'regressoes', script: 'tools/scripts/test-regressoes.mjs' },
  { id: 'pulo', script: 'tools/scripts/test-pulo.mjs' },
  { id: 'bafo', script: 'tools/scripts/test-bafo.mjs' },
];

const args = parseArgs();
const only = typeof args.only === 'string' ? new Set(args.only.split(',')) : null;
const suites = SUITES.filter((s) => !only || only.has(s.id));

/** Porta livre em 127.0.0.1 (a pedida, se estiver livre; senão uma qualquer do sistema). */
function freePort(wanted = 0) {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.unref();
    srv.once('error', (err) => (wanted ? freePort(0).then(res, rej) : rej(err)));
    srv.listen(wanted, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

/** O servidor responde em `url`? */
async function isUp(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

let server = null;
function killServer() {
  if (!server || server.exitCode !== null || server.killed) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); }
  }
  server.killed = true;
}
process.on('exit', killServer);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    killServer();
    process.exit(130);
  });
}

async function startServer(port) {
  const viteBin = resolve(ROOT, 'node_modules/vite/bin/vite.js');
  const cfg = resolve(ROOT, 'tools/scripts/vite.nohmr.config.mjs');
  server = spawn(process.execPath, [viteBin, '--config', cfg, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32', // grupo próprio no Linux/macOS (kill(-pid) derruba tudo)
    windowsHide: true,
  });
  let out = '';
  server.stdout.on('data', (d) => { out += d; });
  server.stderr.on('data', (d) => { out += d; });
  const url = `http://127.0.0.1:${port}/`;
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    if (server.exitCode !== null) throw new Error(`o Vite saiu com código ${server.exitCode}:\n${out}`);
    if (await isUp(url)) return url;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`o Vite não respondeu em ${url} em 60 s:\n${out}`);
}

/** Roda um script de partida e devolve { code, summary } (repassa a saída ao vivo). */
function runSuite(s, url) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [resolve(ROOT, s.script), '--url', url], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
    let tail = '';
    child.stdout.on('data', (d) => {
      process.stdout.write(d);
      tail = (tail + d).slice(-4000);
    });
    child.on('close', (code) => {
      const m = [...tail.matchAll(/(\d+) ok, (\d+) falha\(s\)/g)].at(-1);
      res({ code: code ?? 1, ok: m ? +m[1] : null, fail: m ? +m[2] : null, consoleErrors: /ERROS DE CONSOLE/.test(tail) });
    });
  });
}

let exitCode = 0;
try {
  let url = typeof args.url === 'string' ? args.url : null;
  if (!url) {
    const port = await freePort(+args.port || 0);
    console.log(`[e2e] subindo o Vite sem HMR em 127.0.0.1:${port}…`);
    url = await startServer(port);
  }
  console.log(`[e2e] servidor: ${url}`);
  const results = [];
  for (const s of suites) {
    console.log(`\n[e2e] ===== ${s.id} (${s.script}) =====`);
    const t0 = Date.now();
    const r = await runSuite(s, url);
    results.push({ ...s, ...r, sec: Math.round((Date.now() - t0) / 1000) });
    if (r.code !== 0) exitCode = 1;
  }
  console.log('\n[e2e] resumo');
  for (const r of results) {
    const counts = r.ok === null ? 'sem contagem' : `${r.ok}/${r.ok + r.fail}`;
    console.log(`  ${r.code === 0 ? 'ok    ' : 'FALHOU'} ${r.id.padEnd(11)} ${counts.padEnd(8)} ${String(r.sec).padStart(4)} s${r.consoleErrors ? '  (com erros de console)' : ''}`);
  }
} catch (err) {
  console.error(`[e2e] erro: ${err.message}`);
  exitCode = 1;
} finally {
  killServer();
}
process.exit(exitCode);
