import { spawn, spawnSync } from 'node:child_process';
import { cpus, freemem, loadavg, totalmem } from 'node:os';
import { resolve } from 'node:path';

// Não confiar apenas no exit code: uma suíte antiga pode imprimir erros e sair com 0.
export function suiteResult(code, output) {
  const match = [...output.matchAll(/(\d+) ok, (\d+) falha\(s\)/g)].at(-1);
  const ok = match ? Number(match[1]) : null;
  const fail = match ? Number(match[2]) : null;
  const consoleErrors = /ERROS DE CONSOLE/.test(output);
  return { code: code ?? 1, ok, fail, consoleErrors, failed: code !== 0 || !match || fail > 0 || consoleErrors };
}

/** Silêncio máximo de uma suíte (E2E_SILENCE_MS). Os prazos do harness rodam dentro do processo da suíte; se ele
 *  parar de escrever por tanto tempo (event loop bloqueado, máquina sem CPU ou memória), o runner registra o
 *  diagnóstico, encerra a suíte com o navegador e reprova. O maior silêncio normal medido no CI foi de 91 s (fase3). */
export const SILENCE_MS = 300000;
const secs = (ms) => `${Math.round(ms / 1000)} s`;
const gb = (bytes) => (bytes / 2 ** 30).toFixed(1);

/** Encerra o processo e os descendentes (o navegador do Playwright é filho do processo da suíte). */
function killTree(pid) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  const kids = new Map();
  const ps = spawnSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8', timeout: 10000 });
  for (const line of (ps.stdout || '').trim().split('\n')) {
    const [p, pp] = line.trim().split(/\s+/).map(Number);
    if (!kids.has(pp)) kids.set(pp, []);
    kids.get(pp).push(p);
  }
  const tree = [];
  const walk = (p) => { tree.push(p); for (const k of kids.get(p) || []) walk(k); };
  walk(pid);
  for (const p of tree) {
    try { process.kill(p, 'SIGKILL'); } catch {}
  }
}

/** O que se sabe de uma suíte calada: o último sinal do harness (pelo IPC), a máquina e os processos. */
function silenceReport(suite, silent, beat) {
  const now = Date.now();
  const lines = [`\n[e2e] ${suite.id}: ${secs(silent)} sem nenhuma saída; a suíte travou fora do alcance dos prazos do harness. Encerrando a suíte e o navegador.`];
  if (!beat) lines.push('  sinal do harness: nenhum (a suíte travou antes de criar o harness, ou não o usa)');
  else {
    const age = now - beat.at;
    lines.push(age < 6000
      ? `  sinal do harness: há ${secs(age)}; o processo da suíte segue vivo`
      : `  sinal do harness: o último foi há ${secs(age)}; o processo da suíte parou de responder (event loop bloqueado ou sem CPU)`);
    const ops = beat.pending.map((op) => `${op.what} (há ${secs(op.ms + age)})`);
    lines.push(`  em curso: ${ops.length ? ops.join('; ') : 'nada no harness (a suíte espera fora dele)'}`);
    if (beat.lastRead) lines.push(`  última leitura do estado, há ${secs(beat.lastRead.ms + age)}: ${beat.lastRead.text}`);
  }
  const [l1, l5, l15] = loadavg();
  lines.push(`  máquina: carga ${l1.toFixed(1)}/${l5.toFixed(1)}/${l15.toFixed(1)} em ${cpus().length} CPUs; memória livre ${gb(freemem())} de ${gb(totalmem())} GB`);
  if (process.platform !== 'win32') {
    const ps = spawnSync('ps', ['-eo', 'pid,ppid,stat,pcpu,pmem,rss,etime,comm', '--sort=-pcpu'], { encoding: 'utf8', timeout: 10000 });
    if (ps.stdout) lines.push('  processos por CPU:', ...ps.stdout.trim().split('\n').slice(0, 13).map((line) => `    ${line}`));
  }
  return `${lines.join('\n')}\n`;
}

function runSuite(suite, url, root, silenceMs) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [resolve(root, suite.script), '--url', url, ...(suite.args || [])], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
    });
    // Preserva o diagnóstico inteiro: uma lista longa de erros não pode apagar o marcador.
    let output = '';
    let lastOutput = Date.now();
    let beat = null; // último sinal do harness da suíte
    for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on('data', (data) => { lastOutput = Date.now(); output += data; destination.write(data); });
    }
    child.on('message', (message) => { if (message?.e2eHeartbeat) beat = { ...message, at: Date.now() }; });
    const watchdog = setInterval(() => {
      const silent = Date.now() - lastOutput;
      if (silent < silenceMs) return;
      clearInterval(watchdog);
      const report = silenceReport(suite, silent, beat);
      output += report;
      process.stdout.write(report);
      killTree(child.pid);
    }, Math.min(5000, silenceMs / 3));
    child.once('error', (error) => { clearInterval(watchdog); reject(error); });
    child.once('close', (code) => { clearInterval(watchdog); resolveResult(suiteResult(code, output)); });
  });
}

// Compartilhado pelo comando E2E e pela prova de falha com navegador real no CI.
export async function runSuites(suites, url, root, { silenceMs = Number(process.env.E2E_SILENCE_MS) || SILENCE_MS } = {}) {
  if (!suites.length) throw new Error('nenhuma suíte selecionada');
  const results = [];
  for (const suite of suites) {
    console.log(`\n[e2e] ===== ${suite.id} (${suite.script}) =====`);
    const start = Date.now();
    const result = await runSuite(suite, url, root, silenceMs);
    results.push({ ...suite, ...result, sec: Math.round((Date.now() - start) / 1000) });
  }
  console.log('\n[e2e] resumo');
  for (const result of results) {
    const counts = result.ok === null ? 'sem contagem' : `${result.ok}/${result.ok + result.fail}`;
    console.log(`  ${result.failed ? 'FALHOU' : 'ok    '} ${result.id.padEnd(11)} ${counts.padEnd(8)} ${String(result.sec).padStart(4)} s${result.consoleErrors ? '  (com erros de console)' : ''}`);
  }
  return results.some((result) => result.failed) ? 1 : 0;
}
