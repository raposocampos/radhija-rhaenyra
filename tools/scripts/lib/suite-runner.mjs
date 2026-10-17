import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// Não confiar apenas no exit code: uma suíte antiga pode imprimir erros e sair com 0.
export function suiteResult(code, output) {
  const match = [...output.matchAll(/(\d+) ok, (\d+) falha\(s\)/g)].at(-1);
  const ok = match ? Number(match[1]) : null;
  const fail = match ? Number(match[2]) : null;
  const consoleErrors = /ERROS DE CONSOLE/.test(output);
  return { code: code ?? 1, ok, fail, consoleErrors, failed: code !== 0 || !match || fail > 0 || consoleErrors };
}

function runSuite(suite, url, root) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [resolve(root, suite.script), '--url', url, ...(suite.args || [])], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    // Preserva o diagnóstico inteiro: uma lista longa de erros não pode apagar o marcador.
    let output = '';
    for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on('data', (data) => { output += data; destination.write(data); });
    }
    child.once('error', reject);
    child.once('close', (code) => resolveResult(suiteResult(code, output)));
  });
}

// Compartilhado pelo comando E2E e pela prova de falha com navegador real no CI.
export async function runSuites(suites, url, root) {
  if (!suites.length) throw new Error('nenhuma suíte selecionada');
  const results = [];
  for (const suite of suites) {
    console.log(`\n[e2e] ===== ${suite.id} (${suite.script}) =====`);
    const start = Date.now();
    const result = await runSuite(suite, url, root);
    results.push({ ...suite, ...result, sec: Math.round((Date.now() - start) / 1000) });
  }
  console.log('\n[e2e] resumo');
  for (const result of results) {
    const counts = result.ok === null ? 'sem contagem' : `${result.ok}/${result.ok + result.fail}`;
    console.log(`  ${result.failed ? 'FALHOU' : 'ok    '} ${result.id.padEnd(11)} ${counts.padEnd(8)} ${String(result.sec).padStart(4)} s${result.consoleErrors ? '  (com erros de console)' : ''}`);
  }
  return results.some((result) => result.failed) ? 1 : 0;
}
