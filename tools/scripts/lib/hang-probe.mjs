// Sonda de travamento da aba (E2E): o que o navegador, a máquina e a própria página mostram quando ela para de
// responder. Os travamentos do CI no primeiro carregamento de uma fase deixam a página aberta, sem window.__game, sem
// responder a page.evaluate; o waitForFunction do Playwright 1.49 nem vence o prazo, porque ao vencer ele espera
// a limpeza `handle.evaluate(h => h.abort())` NA PÁGINA antes de rejeitar (server/frames.js e progress.js). O relatório
// separa as causas possíveis: thread principal presa em JavaScript (pilha pelo Debugger.pause), presa fora dele
// (chamada nativa, GPU) ou aba morta; quem gasta CPU (processo e thread do Chromium); memória e OOM do kernel; console
// da página (com os marcos do boot `rr:*`) e o registro do próprio Chromium (browser-log.mjs).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { cpus, loadavg } from 'node:os';
import { DIAG_DIR, browserLogFile } from './browser-log.mjs';

const run = promisify(execFile);
const CONSOLE_KEEP = 80;
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;

/** Promessa com prazo: { ok, value } ou { ok: false, error } (sem rejeição solta). */
async function within(promise, ms, what) {
  let timer;
  const p = Promise.resolve(promise);
  p.catch(() => {});
  try {
    return { ok: true, value: await Promise.race([p, new Promise((_, fail) => { timer = setTimeout(() => fail(new Error(`${what}: sem resposta em ${secs(ms)}`)), ms); })]) };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).split('\n')[0] };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Processos do Chromium pelo /proc (Linux): estado, CPU e threads, em duas amostras.
const TICKS = 100; // CLK_TCK dos runners Linux
function statOf(path) {
  const s = readFileSync(path, 'utf8');
  const rest = s.slice(s.lastIndexOf(')') + 2).split(' ');
  return { state: rest[0], cpu: Number(rest[11]) + Number(rest[12]), threads: Number(rest[17]), rss: Number(rest[21]) * 4096 };
}
function chromiumProcesses() {
  const out = [];
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    let cmd;
    // os filhos do zygote reescrevem o título (setproctitle): a linha toda pode vir num só trecho, com espaços
    try { cmd = readFileSync(`/proc/${name}/cmdline`, 'utf8').replace(/\0/g, ' '); } catch { continue; }
    if (!/^\S*(headless_shell|chrome|chromium)\b/.test(cmd)) continue;
    const type = cmd.match(/--type=([\w-]+)/)?.[1] || 'browser';
    const sub = cmd.match(/--utility-sub-type=([\w.]+)/)?.[1].split('.').pop();
    out.push({ pid: Number(name), type: sub ? `${type}:${sub}` : type });
  }
  return out;
}
function sampleProcesses(procs) {
  return new Map(procs.map((p) => {
    try {
      const st = statOf(`/proc/${p.pid}/stat`);
      const threads = new Map();
      for (const tid of readdirSync(`/proc/${p.pid}/task`)) {
        try {
          const t = statOf(`/proc/${p.pid}/task/${tid}/stat`);
          const comm = readFileSync(`/proc/${p.pid}/task/${tid}/comm`, 'utf8').trim();
          let wchan = '';
          try { wchan = readFileSync(`/proc/${p.pid}/task/${tid}/wchan`, 'utf8').trim(); } catch {}
          threads.set(tid, { comm: Number(tid) === p.pid ? `${comm} (principal)` : comm, state: t.state, cpu: t.cpu, wchan });
        } catch {}
      }
      return [p.pid, { ...st, threads }];
    } catch {
      return [p.pid, null];
    }
  }));
}
async function processSection(gapMs = 1500) {
  if (process.platform !== 'linux') return ['  processos: só no Linux (CI)'];
  const procs = chromiumProcesses();
  if (!procs.length) return ['  processos do Chromium: nenhum (navegador fechado ou caído)'];
  const a = sampleProcesses(procs);
  const t0 = Date.now();
  await new Promise((done) => setTimeout(done, gapMs));
  const b = sampleProcesses(chromiumProcesses());
  const dt = (Date.now() - t0) / 1000;
  const pct = (ticks) => `${Math.round((ticks / TICKS / dt) * 100)}%`;
  const lines = [`  processos do Chromium (CPU medida em ${dt.toFixed(1)} s; estado R = rodando, S = esperando, D = disco, Z = morto):`];
  for (const p of procs) {
    const x = a.get(p.pid);
    const y = b.get(p.pid);
    if (!x || !y) {
      lines.push(`    ${p.type.padEnd(22)} pid ${p.pid}: ${x ? 'SUMIU durante a medição' : 'sumiu'}`);
      continue;
    }
    lines.push(`    ${p.type.padEnd(22)} pid ${p.pid} ${y.state} CPU ${pct(y.cpu - x.cpu).padStart(4)}  RSS ${Math.round(y.rss / 2 ** 20)} MB  ${y.threads.size} threads`);
    // threads que gastaram CPU na janela, mais a principal (mesmo parada: onde ela espera, pelo wchan)
    const busy = [...y.threads].map(([tid, t]) => ({ tid, ...t, used: t.cpu - (x.threads.get(tid)?.cpu ?? t.cpu) }))
      .filter((t) => t.used > 0 || t.comm.endsWith('(principal)'))
      .sort((m, n) => n.used - m.used)
      .slice(0, 6);
    for (const t of busy) lines.push(`      ${t.comm.padEnd(30)} ${t.state} CPU ${pct(t.used).padStart(4)}${t.wchan && t.wchan !== '0' ? `  espera em ${t.wchan}` : ''}`);
    // GPU e abas: TODAS as threads, agrupadas por nome, estado e espera (um impasse deixa todas paradas, sem CPU)
    if (p.type === 'gpu-process' || p.type === 'renderer') {
      const groups = new Map();
      for (const t of y.threads.values()) {
        const key = `${t.comm.replace(/\d+$/, '#')} ${t.state}${t.wchan && t.wchan !== '0' ? ` em ${t.wchan}` : ''}`;
        groups.set(key, (groups.get(key) || 0) + 1);
      }
      lines.push(`      todas: ${[...groups].map(([k, n]) => (n > 1 ? `${n}× ${k}` : k)).join(' · ')}`);
    }
  }
  return lines;
}

// ---- Pilhas nativas (gdb) do processo da GPU e das abas: onde cada thread espera quando ninguém gasta CPU. Só no
// Linux com gdb (no CI, pelo sudo sem senha). O binário do Chromium não tem símbolos: os quadros dele saem como
// "headless_shell", mas os das bibliotecas (SwiftShader, ANGLE, libc) dizem quem espera quem. O texto inteiro vai para
// shots/diagnostico/pilhas-*.txt; no log, um resumo por thread (quadros do topo), com as iguais juntas.
let gdbPath;
async function findGdb() {
  if (gdbPath !== undefined) return gdbPath;
  gdbPath = null;
  if (process.platform !== 'linux') return gdbPath;
  for (const p of ['/usr/bin/gdb', '/usr/local/bin/gdb']) if (existsSync(p)) gdbPath = p;
  return gdbPath;
}
/** Resumo de `thread apply all bt`: { nome da thread → quadros do topo } agrupados. */
export function summarizeStacks(text, frames = 10) {
  const threads = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const head = line.match(/^Thread \d+ \(.*?LWP (\d+)\)(?: "([^"]*)")?/);
    if (head) {
      cur = { lwp: head[1], name: head[2] || '?', frames: [] };
      threads.push(cur);
      continue;
    }
    const f = cur && line.match(/^#\d+\s+(?:0x[0-9a-f]+ in )?(\S+)(?: \(.*?\))?(?: from (\S+))?(?: at (\S+))?/);
    if (!f || cur.frames.length >= frames) continue;
    const fn = f[1] === '??' ? null : f[1].replace(/\(.*$/, '');
    const lib = f[2] ? f[2].split('/').pop() : null;
    const where = fn ? (lib && !/^lib(c|pthread)\.so/.test(lib) ? `${fn}@${lib}` : fn) : `??@${lib || 'headless_shell'}`;
    if (cur.frames.at(-1) !== where) cur.frames.push(where);
  }
  const groups = new Map();
  for (const t of threads) {
    const key = `${t.name.replace(/\d+$/, '#')}: ${t.frames.join(' ← ')}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  return [...groups].map(([k, n]) => (n > 1 ? `${n}× ${k}` : k));
}
async function nativeStackSection() {
  if (process.platform !== 'linux') return [];
  const gdb = await findGdb();
  if (!gdb) return ['  pilhas nativas: sem gdb nesta máquina'];
  const procs = chromiumProcesses().filter((p) => p.type === 'gpu-process' || p.type === 'renderer');
  const lines = [];
  const started = Date.now();
  for (const p of procs) {
    if (Date.now() - started > 40000) { lines.push(`  pilhas nativas: ${p.type} ${p.pid} não lido (tempo do diagnóstico esgotado)`); continue; }
    const cmd = process.env.CI ? 'sudo' : gdb;
    const argv = [...(process.env.CI ? ['-n', gdb] : []), '-p', String(p.pid), '-batch', '-nx', '-q', '-ex', 'set pagination off', '-ex', 'thread apply all bt 40'];
    const out = await run(cmd, argv, { timeout: 25000, maxBuffer: 32 * 2 ** 20 }).then((r) => r.stdout, (e) => (e.stdout ? String(e.stdout) : `falhou: ${String(e.message).split('\n')[0]}`));
    let file = '';
    try {
      mkdirSync(DIAG_DIR, { recursive: true });
      file = resolve(DIAG_DIR, `pilhas-${p.type}-${p.pid}-${Date.now()}.txt`);
      writeFileSync(file, out);
      file = ` (inteiras em shots/diagnostico/${file.split(/[\\/]/).pop()})`;
    } catch { file = ''; }
    lines.push(`  pilhas nativas de ${p.type} ${p.pid}${file}:`);
    const summary = summarizeStacks(out);
    if (!summary.length) lines.push(`    ${out.split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 300)}`);
    for (const s of summary.slice(0, 40)) lines.push(`    ${s.slice(0, 400)}`);
  }
  return lines;
}

/** Modelo da CPU do runner (os runners do GitHub variam de hardware; um defeito só num tipo de CPU apareceria assim). */
export function cpuModel() {
  let model = cpus()[0]?.model || '?';
  let extra = '';
  try {
    const info = readFileSync('/proc/cpuinfo', 'utf8');
    model = info.match(/^model name\s*:\s*(.+)$/m)?.[1] || model;
    const flags = info.match(/^flags\s*:\s*(.+)$/m)?.[1].split(' ') || [];
    extra = ['avx2', 'avx512f'].filter((f) => flags.includes(f)).join(' ');
  } catch {}
  return `${model.trim()} × ${cpus().length}${extra ? ` (${extra})` : ''}`;
}
/** Tempos agregados das CPUs (/proc/stat): para medir o roubo do hipervisor (steal) e a espera de disco. */
function cpuTimes() {
  try {
    const f = readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
    return { total: f.reduce((a, b) => a + b, 0), idle: f[3], iowait: f[4], steal: f[7] || 0 };
  } catch {
    return null;
  }
}

// ---- Máquina: CPU, memória, carga e mensagens do kernel (OOM killer, segfault).
async function machineSection() {
  const lines = [];
  const a = cpuTimes();
  await new Promise((done) => setTimeout(done, 1500));
  const b = cpuTimes();
  if (a && b && b.total > a.total) {
    const pct = (k) => `${Math.round(((b[k] - a[k]) / (b.total - a.total)) * 100)}%`;
    lines.push(`  CPU: ${cpuModel()}; em 1,5 s: ocioso ${pct('idle')}, roubado pelo hipervisor ${pct('steal')}, espera de disco ${pct('iowait')}`);
  } else lines.push(`  CPU: ${cpuModel()}`);
  const [l1, l5] = loadavg();
  let mem = '';
  try {
    const info = Object.fromEntries(readFileSync('/proc/meminfo', 'utf8').split('\n').map((l) => l.split(/:\s+/)).filter((kv) => kv.length === 2).map(([k, v]) => [k, parseInt(v, 10)]));
    mem = `; memória disponível ${(info.MemAvailable / 2 ** 20).toFixed(1)} de ${(info.MemTotal / 2 ** 20).toFixed(1)} GB, swap livre ${(info.SwapFree / 2 ** 20).toFixed(1)} GB`;
  } catch {}
  lines.push(`  máquina: carga ${l1.toFixed(1)}/${l5.toFixed(1)} em ${cpus().length} CPUs${mem}`);
  if (process.platform === 'linux') {
    let kern = await run('dmesg', ['--ctime'], { timeout: 3000 }).catch(() => null);
    if (!kern && process.env.CI) kern = await run('sudo', ['-n', 'dmesg', '--ctime'], { timeout: 3000 }).catch(() => null);
    if (kern) {
      const hits = kern.stdout.split('\n').filter((l) => /oom|out of memory|killed process|segfault|headless_shell|chrom|gpu|hung task/i.test(l));
      lines.push(hits.length ? '  kernel (dmesg):' : '  kernel (dmesg): nada sobre memória, OOM ou falha de processo');
      for (const l of hits.slice(-8)) lines.push(`    ${l.slice(0, 220)}`);
    } else lines.push('  kernel (dmesg): sem acesso');
  }
  return lines;
}

/** Últimas linhas do registro do Chromium (stderr do navegador; ver browser-log.mjs). */
export function browserLogTail(n = 30) {
  if (!browserLogFile || !existsSync(browserLogFile)) return [];
  const lines = readFileSync(browserLogFile, 'utf8').split('\n').filter((l) => /\]\[(err|out)\]|process did exit/.test(l));
  return lines.slice(-n).map((l) => l.replace(/^\S+ pw:browser /, '').slice(0, 260));
}

/** Sondas das páginas abertas neste processo: o diagnóstico de uma aba diz também se as outras ainda recebem quadros
 *  (todas paradas = o processo da GPU, compartilhado, parou; só uma = a aba). */
const probes = new Set();
/** O navegador entrega quadros à aba? requestAnimationFrame em até 3 s, visibilidade e o tempo simulado do jogo. */
const FRAME_CHECK = `new Promise((done) => {
  const raf = window.__probeRaf || window.requestAnimationFrame.bind(window);
  const t0 = performance.now();
  let info = null;
  try { info = window.__game?.game?.debug?.info?.() ?? null; } catch {}
  const base = { vis: document.visibilityState, state: info?.state ?? null, sim: info?.simSec ?? null };
  const timer = setTimeout(() => done({ ...base, raf: null }), 3000);
  raf(() => { clearTimeout(timer); done({ ...base, raf: Math.round(performance.now() - t0) }); });
})`;
async function frameCheck(session) {
  const r = await within(session.send('Runtime.evaluate', { expression: FRAME_CHECK, awaitPromise: true, returnByValue: true }), 4500, 'quadro');
  if (!r.ok) return `teste de quadro: ${r.error}`;
  const v = r.value?.result?.value;
  if (!v) return 'teste de quadro: sem resultado';
  const game = v.state ? `; jogo ${v.state}, simSec ${v.sim}` : '';
  return `${v.raf === null ? 'NENHUM QUADRO em 3 s (requestAnimationFrame parado)' : `quadros chegando (rAF em ${v.raf} ms)`}, aba ${v.vis}${game}`;
}

/**
 * Liga a sonda numa página recém-criada, antes da primeira navegação. Abre uma sessão CDP própria com o Debugger já
 * ligado: com a thread principal ocupada, o Chromium só atende comandos de interrupção (Debugger.pause), e um
 * Debugger.enable depois do travamento nunca seria atendido. Também transforma os marcos do boot do jogo
 * (performance.mark('rr:…'), ver src/main.js e loadLevel) em console.debug, que chega mesmo se a thread travar logo
 * depois. `report(motivo)` devolve o texto do diagnóstico (no máximo ~8 s).
 */
export async function attachHangProbe(page) {
  const t0 = Date.now();
  const consoleTail = [];
  const remember = (type, text) => {
    consoleTail.push({ at: Date.now(), type, text: String(text).replace(/\s+/g, ' ').slice(0, 200) });
    if (consoleTail.length > CONSOLE_KEEP) consoleTail.shift();
  };
  page.on('console', (m) => remember(m.type(), m.text()));
  page.on('pageerror', (e) => remember('pageerror', e.message));
  page.on('crash', () => remember('crash', 'o Playwright avisou que a aba caiu'));
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) remember('navegação', f.url()); });
  await page.addInitScript(() => {
    // o requestAnimationFrame original, antes de outra troca (as capturas congelam o laço do jogo por ele)
    window.__probeRaf = window.requestAnimationFrame.bind(window);
    const mark = performance.mark.bind(performance);
    performance.mark = (name, options) => {
      if (typeof name === 'string' && name.startsWith('rr:')) console.debug(`[marco] ${name} ${Math.round(performance.now())} ms`);
      return mark(name, options);
    };
  });
  let session = null;
  let sessionNote = '';
  try {
    session = await page.context().newCDPSession(page);
    await session.send('Debugger.enable');
  } catch (error) {
    session = null;
    sessionNote = String(error?.message || error).split('\n')[0];
  }

  async function jsSection() {
    if (!session) return [`  JavaScript da aba: sessão de diagnóstico indisponível (${sessionNote || 'não aberta'})`];
    // A thread principal atende um comando comum? (ociosa ou esperando a rede)
    const alive = await within(session.send('Runtime.evaluate', { expression: 'document.readyState + " " + location.search', returnByValue: true }), 2000, 'Runtime.evaluate');
    if (alive.ok) {
      // Responde, mas o navegador ainda entrega quadros a ela? Sem quadros, o laço do jogo (requestAnimationFrame) e as
      // transições de CSS param, e toques podem cair num elemento que nunca terminou de aparecer.
      const frames = await frameCheck(session);
      return [`  JavaScript da aba: a thread principal RESPONDE (${alive.value?.result?.value ?? '?'}); não está presa; ${frames}`];
    }
    if (!/sem resposta/.test(alive.error)) return [`  JavaScript da aba: a sessão de diagnóstico falhou (${alive.error}); aba fechada ou caída?`];
    // Ocupada: Debugger.pause é atendido por interrupção do V8 se ela estiver rodando JavaScript.
    const paused = new Promise((done) => { session.once('Debugger.paused', done); });
    const sent = await within(session.send('Debugger.pause'), 2000, 'Debugger.pause');
    const hit = await within(paused, 3000, 'Debugger.paused');
    if (!hit.ok) {
      return [`  JavaScript da aba: a thread principal NÃO responde e não pausou (${sent.ok ? 'pedido aceito' : sent.error}): está presa fora do JavaScript (chamada nativa: GPU/shaders, E/S) ou a aba morreu. Ver os processos abaixo.`];
    }
    const frames = hit.value.callFrames || [];
    const lines = [`  JavaScript da aba: a thread principal está RODANDO JAVASCRIPT (pausada para ler a pilha, motivo ${hit.value.reason}):`];
    for (const f of frames.slice(0, 14)) {
      const url = (f.url || '').replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '') || `script ${f.location.scriptId}`;
      lines.push(`    em ${f.functionName || '(anônima)'}  ${url}:${f.location.lineNumber + 1}:${f.location.columnNumber + 1}`);
    }
    if (frames.length > 14) lines.push(`    … mais ${frames.length - 14} quadros`);
    within(session.send('Debugger.resume'), 2000, 'Debugger.resume');
    return lines;
  }

  async function browserSection() {
    const lines = [];
    const browser = page.context().browser();
    if (!browser?.isConnected()) return ['  navegador: desconectado'];
    const cdp = await within(browser.newBrowserCDPSession(), 3000, 'sessão CDP do navegador');
    if (!cdp.ok) return [`  navegador: ${cdp.error}`];
    const [procs, targets, gpu] = await Promise.all([
      within(cdp.value.send('SystemInfo.getProcessInfo'), 3000, 'SystemInfo.getProcessInfo'),
      within(cdp.value.send('Target.getTargets'), 3000, 'Target.getTargets'),
      within(cdp.value.send('SystemInfo.getInfo'), 3000, 'SystemInfo.getInfo'),
    ]);
    lines.push(procs.ok
      ? `  navegador vê os processos: ${procs.value.processInfo.map((p) => `${p.type} ${p.id} (${p.cpuTime.toFixed(1)} s de CPU)`).join(', ')}`
      : `  navegador (processos): ${procs.error}`);
    lines.push(targets.ok
      ? `  abas e alvos: ${targets.value.targetInfos.map((t) => `${t.type}${t.attached ? '' : ' (solto)'} ${t.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 60)}`).join('; ')}`
      : `  abas e alvos: ${targets.error}`);
    if (gpu.ok) {
      const st = gpu.value.gpu?.featureStatus || {};
      const dev = gpu.value.gpu?.devices?.find((d) => d.active) || gpu.value.gpu?.devices?.[0];
      lines.push(`  GPU: webgl=${st.webgl ?? '?'} webgl2=${st.webgl2 ?? '?'} compositing=${st.gpu_compositing ?? '?'}; ${dev ? `${dev.vendorString || ''} ${dev.deviceString || ''}`.trim() : 'sem dispositivo'}`);
    } else lines.push(`  GPU: ${gpu.error}`);
    within(cdp.value.detach(), 2000, 'detach');
    return lines;
  }

  async function othersSection() {
    const lines = [];
    for (const other of probes) {
      if (other === probe || !other.session) continue;
      const alive = await within(other.session.send('Runtime.evaluate', { expression: 'location.pathname + location.search', returnByValue: true }), 2000, 'Runtime.evaluate');
      lines.push(`  outra aba${other.label ? ` [${other.label}]` : ''}: ${alive.ok ? `responde; ${await frameCheck(other.session)}` : `não responde (${alive.error})`}`);
    }
    return lines;
  }

  async function report(reason) {
    const started = Date.now();
    const [js, others, browser, procs, machine] = await Promise.all([jsSection(), othersSection(), browserSection(), processSection(), machineSection()]);
    // gdb pausa o processo lido: depois das medições de CPU
    const stacks = await nativeStackSection();
    const lines = [`  [diagnóstico] ${reason} (página aberta há ${secs(started - t0)})`, ...js, ...others, ...browser, ...procs, ...machine, ...stacks];
    lines.push(`  console da página (últimas ${Math.min(25, consoleTail.length)} de ${consoleTail.length}, tempo desde a abertura):`);
    for (const m of consoleTail.slice(-25)) lines.push(`    +${secs(m.at - t0).padStart(7)} ${m.type.padEnd(9)} ${m.text}`);
    const log = browserLogTail();
    if (log.length) {
      lines.push(`  registro do Chromium (últimas ${log.length} linhas; inteiro em ${browserLogFile.replace(/\\/g, '/').replace(/^.*?(shots\/)/, '$1')}):`);
      for (const l of log) lines.push(`    ${l}`);
    } else lines.push('  registro do Chromium: vazio ou desligado (browser-log.mjs)');
    lines.push(`  [diagnóstico] fim (${secs(Date.now() - started)})`);
    return lines.join('\n');
  }

  const probe = { report, consoleTail, label: null, get session() { return session; } };
  probes.add(probe);
  page.once('close', () => probes.delete(probe));
  return probe;
}

/** Tempos do boot do jogo na página atual, pelos marcos `rr:*` (src/main.js e loadLevel em src/game/game.js). */
export const BOOT_STEPS = {
  'rr:boot:start': 'html+módulos', 'rr:boot:engine': 'motor', 'rr:boot:dogs': 'cachorras', 'rr:boot:ui': 'interface',
  'rr:level:code': 'código da fase', 'rr:level:build': 'cenário', 'rr:level:setup': 'puzzle', 'rr:level:compile': 'shaders',
  'rr:level:loaded': 'fim da fase', 'rr:boot:ready': 'pronto',
};
export async function bootTimeline(page) {
  const marks = await page.evaluate(() => performance.getEntriesByType('mark').filter((m) => m.name.startsWith('rr:')).map((m) => [m.name, m.startTime]));
  let prev = 0;
  const parts = [];
  for (const [name, at] of marks) {
    parts.push(`${BOOT_STEPS[name] || name} ${((at - prev) / 1000).toFixed(1)}`);
    prev = at;
  }
  return { total: prev / 1000, text: parts.join(' · '), marks };
}
