// Redes de prazo para QUALQUER página do Playwright: a do harness, as páginas extras das suítes (outro aparelho) e as
// dos scripts de captura, que não passam pelo harness nem pelo runner. Sem elas, uma aba que cai ou trava no CI prende
// o passo até o timeout do workflow: o Playwright 1.49 não avisa a queda (prova "crash" de test-e2e-infra.mjs) e deixa
// waitForFunction/evaluate pendentes para sempre, sem vencer o próprio prazo.
//   - teto de relógio (evalMs) no que não tem prazo próprio: evaluate, teclado, mouse, toque, CDP, viewport;
//   - vigia do processo: uma operação em curso (goto, waitForFunction, screenshot, clique...) sem retorno por opMaxMs
//     encerra o processo dizendo a operação, a linha do script, o último passo e o estado do jogo;
//   - 'crash' da aba e 'disconnected' do navegador: quando o Playwright avisa, o que está em curso falha na hora;
//   - um prazo do Playwright vencido (waitForFunction etc.) leva a linha do script e o estado do jogo na mensagem.
// Uso nas capturas:  const { page, guard } = await openPage(browser, { viewport }, { name: 'lambe' });
//                    guard.note('captura 01');  …  await closeBrowser(browser);
// Nas suítes, H.newPage(opções, nome) abre a página extra já protegida (lib/harness.mjs).

/** Tetos de RELÓGIO (ms). Ajuste por variável de ambiente ou pela opção `limits` (createHarness, guardPage). */
export const DEFAULT_LIMITS = {
  wallFactor: 8, // E2E_WALL_FACTOR: uma espera de `ms` de jogo termina (com aviso) em max(wallMinMs, wallFactor × ms)
  wallMinMs: 10000, // E2E_WALL_MIN_MS
  stallMs: 60000, // E2E_STALL_MS: simSec sem mudar por esse tempo de relógio = o jogo parou de avançar (reprova)
  evalMs: 60000, // E2E_EVAL_MS: cada ida ao navegador sem prazo próprio (page.evaluate, teclado, mouse, toque, CDP)
  closeMs: 30000, // E2E_CLOSE_MS: fechar o navegador no fim
  // E2E_OP_MAX_MS: uma operação em curso (etapa do load(), captura, goto, waitForFunction) sem retorno por esse tempo,
  // apesar dos prazos próprios (120 s do Playwright, evalMs), encerra o processo com diagnóstico. É o que pega a aba
  // que caiu no CI: o Playwright não avisa a queda e deixa waitForFunction pendente para sempre.
  opMaxMs: 150000,
};
const LIMIT_ENV = {
  wallFactor: 'E2E_WALL_FACTOR', wallMinMs: 'E2E_WALL_MIN_MS', stallMs: 'E2E_STALL_MS', evalMs: 'E2E_EVAL_MS', closeMs: 'E2E_CLOSE_MS', opMaxMs: 'E2E_OP_MAX_MS',
};
// Rodando sob o runner (suite-runner.mjs), o processo da suíte tem um canal IPC para o sinal do harness. O canal não
// pode segurar o processo aberto depois que a suíte termina.
process.channel?.unref?.();
export function limitsFrom(overrides = {}) {
  const out = {};
  for (const [key, name] of Object.entries(LIMIT_ENV)) {
    const raw = overrides[key] ?? process.env[name];
    const value = raw === undefined || raw === '' ? DEFAULT_LIMITS[key] : Number(raw);
    if (!(value > 0)) throw new Error(`limite do harness inválido: ${key} (${name}) = ${raw}`);
    out[key] = value;
  }
  return out;
}

/** Espera ou ida ao navegador que venceu o teto de relógio. O script não deve seguir: a página travou ou o jogo parou. */
export class HarnessAbort extends Error {
  constructor(message) {
    super(`[harness] ${message}`);
    this.name = 'HarnessAbort';
  }
}
export const secs = (ms) => `${+(ms / 1000).toFixed(1)} s`;
export const snippet = (fn) => String(fn).replace(/\s+/g, ' ').slice(0, 90);
const joined = (...parts) => parts.filter(Boolean).join(' ');
const LIB = new URL('./', import.meta.url).href;
/** Linha do script que fez a chamada: o primeiro quadro da pilha fora de tools/scripts/lib. */
export function siteOf(err) {
  for (const line of String(err.stack).split('\n').slice(1)) {
    const m = line.match(/([^\s()]+):(\d+):\d+\)?\s*$/);
    if (m && !m[1].startsWith(LIB) && !m[1].startsWith('node:')) return `${m[1].split(/[\\/]/).pop()}:${m[2]}`;
  }
  return null;
}
/** Uma linha com o estado do jogo (debug.info()). */
export function describe(i) {
  if (!i) return 'nenhuma';
  const d = i.dogs?.[i.activeDog];
  const dog = d ? ` ${i.activeDog}(${Number(d.x).toFixed(2)}, ${Number(d.z).toFixed(2)})` : '';
  return `estado=${i.state} fase=${i.levelId ?? i.level} etapa=${i.stage} timeSec=${i.timeSec} simSec=${i.simSec}${dog}`;
}

// ---- Vigia do processo: as operações em curso de todas as páginas. A cada 2 s, o sinal do harness (pelo IPC do
// runner) diz o que o script espera e desde quando; o log ganha "ainda aguardando" a cada minuto; passado o opMaxMs da
// página, o processo sai com diagnóstico (o prazo próprio da operação não funcionou). Se nem este relógio rodar (event
// loop bloqueado), o runner vê o silêncio e encerra a suíte de fora; um script de captura fica com o timeout do job.
const ops = new Set(); // { what, at (Error da chamada), tag, since, told, max, overdue(age) }
const guards = new Set();
let beat = null;
let watching = true;
let beatInfo = null; // dado extra do sinal: a última leitura do estado (harness)
const labelOf = (op) => {
  if (op.label === undefined) {
    const site = op.at && siteOf(op.at);
    op.label = `${op.tag}${op.what}${site ? ` (${site})` : ''}`;
  }
  return op.label;
};
function tick() {
  const now = Date.now();
  if (process.connected) {
    try {
      process.send({ e2eHeartbeat: true, pending: [...ops].map((op) => ({ what: labelOf(op), ms: now - op.since })), lastRead: beatInfo?.() ?? null }, () => {});
    } catch {}
  }
  for (const op of ops) {
    const age = now - op.since;
    if (age >= op.max) {
      stopWatch();
      op.overdue(age);
      return;
    }
    if (age >= 60000 && now - op.told >= 60000) {
      op.told = now;
      console.log(`  [harness] ainda aguardando ${labelOf(op)} há ${secs(age)}`);
    }
  }
}
function startWatch() {
  if (beat || !watching) return;
  beat = setInterval(tick, 2000);
  beat.unref();
  tick(); // o runner sabe desde já que o harness existe
}
/** Para o vigia (fim do script: o fechamento do navegador tem prazo próprio). */
export function stopWatch() {
  watching = false;
  clearInterval(beat);
  beat = null;
}
function overdueText(label, age, context, state) {
  return `[harness] ${label} sem retorno há ${secs(age)}, mesmo com os prazos (Playwright ou navegador travado; sem aviso `
    + `de queda da aba). ${joined(context, state && `Agora: ${state}`)}`;
}
function exitOverdue(message) {
  console.log(`  FALHOU ${message}`);
  process.exit(1); // o Playwright encerra o navegador na saída
}

/** Uma operação sem página (abrir uma página nova), sob o vigia do processo. */
async function watched(what, run, { tag = '', limits = limitsFrom(), onOverdue = exitOverdue } = {}) {
  const op = { what, tag, at: new Error(), since: Date.now(), told: 0, max: limits.opMaxMs, overdue: (age) => onOverdue(overdueText(labelOf(op), age, '', '')) };
  ops.add(op);
  startWatch();
  try {
    return await run();
  } finally {
    ops.delete(op);
  }
}

const guarded = new WeakMap();
const LOST = Symbol('lost');
const TIMEOUT = Symbol('timeout');
const fmt = (a) => {
  if (typeof a === 'function') return snippet(a);
  if (typeof a === 'string') return `'${a.length > 70 ? `${a.slice(0, 69)}…` : a}'`;
  if (typeof a === 'number' || typeof a === 'boolean') return String(a);
  if (a && typeof a.path === 'string') return `{ path: '${a.path}' }`;
  if (a && typeof a.width === 'number') return `${a.width}×${a.height}`;
  return null;
};
const callText = (name, args) => `${name}(${args.map(fmt).filter((x) => x !== null).join(', ')})`;

/**
 * Protege uma página do Playwright (ver o topo do arquivo). Troca, na própria página, evaluate, teclado, mouse, toque,
 * setViewportSize, addInitScript e as sessões CDP (teto evalMs) e goto, reload, waitForFunction, waitForSelector,
 * screenshot, click e close (vigia opMaxMs). Devolve o guarda:
 *   note(texto)   último passo do script, repetido nos diagnósticos (ex.: a última captura gravada);
 *   peek()        o estado do jogo agora, em até 5 s, sem marcar a página como travada;
 *   evaluate(what, fn, arg), during(what, run), abort(what, site, why), raw: usados pelo harness.
 * Opções: name (prefixo nas mensagens), limits, context() (texto de contexto no lugar do último passo), onAbort(msg)
 * (cada HarnessAbort, para o fim reprovar mesmo se o script engolir a exceção), onOverdue(msg) (padrão: imprime e sai
 * com 1), onBeat() (dado extra do sinal para o runner).
 */
export function guardPage(page, { name = null, limits: overrides = {}, context = null, onAbort = null, onOverdue = null, onBeat = null } = {}) {
  if (guarded.has(page)) return guarded.get(page);
  const limits = limitsFrom(overrides);
  const tag = name ? `[${name}] ` : '';
  const browser = page.context().browser();
  const raw = {};
  for (const m of ['evaluate', 'goto', 'reload', 'waitForFunction', 'waitForSelector', 'screenshot', 'click', 'close', 'setViewportSize', 'addInitScript']) raw[m] = page[m].bind(page);
  let wedged = null; // primeira operação sem resposta
  let lost = null; // motivo da queda avisada pelo Playwright
  let closing = false; // o 'disconnected' do fechamento não é queda
  let note = null;
  const aborts = [];
  const inflight = new Set(); // quem para cada operação em curso desta página quando ela cai
  if (onBeat) beatInfo = onBeat;

  const contextText = () => (context ? context() : note ? `Último passo: ${note.text}, há ${secs(Date.now() - note.at)}.` : '');
  function abort(what, site, why) {
    const e = new HarnessAbort(`${tag}${what}${site ? ` (${site})` : ''}: ${why}`);
    if (onAbort) onAbort(e.message); else aborts.push(e.message);
    return e;
  }
  const lostWhy = () => joined(`${lost}.`, contextText());
  // A aba (renderer) ou o navegador caiu e o Playwright avisou: toda operação em curso falha na hora, dizendo o motivo.
  // No CI, uma aba derrubada com chrome://crash NÃO gerou o aviso (prova "crash"): quem encerra é o opMaxMs.
  const markLost = (why) => {
    if (lost || closing) return;
    lost = why;
    wedged = wedged || why;
    console.log(`  [harness] ${tag}${why}`);
    for (const stop of inflight) stop(LOST);
  };
  const onCrash = () => markLost('a aba do navegador caiu (crash do renderer)');
  const onDisconnect = () => markLost('o navegador fechou ou caiu');
  page.on('crash', onCrash);
  browser?.on('disconnected', onDisconnect);
  const release = () => {
    closing = true;
    browser?.off('disconnected', onDisconnect);
    guards.delete(g);
  };

  /** Corre `call` contra a queda da página e, se `ms`, contra o teto de relógio. */
  function race(call, ms) {
    let timer;
    let stop;
    const stopper = new Promise((_, reject) => {
      stop = reject;
      if (lost) reject(LOST);
      inflight.add(reject);
      if (ms) timer = setTimeout(reject, ms, TIMEOUT);
    });
    return Promise.race([call, stopper]).finally(() => {
      clearTimeout(timer);
      inflight.delete(stop);
    });
  }
  const track = (what, at, max) => {
    const op = { what, tag, at, since: Date.now(), told: 0, max, overdue: (age) => overdue(op, age) };
    ops.add(op);
    return op;
  };
  function overdue(op, age) {
    // a página ainda responde? (sem aviso de queda: senão a operação já teria falhado na hora)
    peek().then((state) => (onOverdue || exitOverdue)(overdueText(labelOf(op), age, contextText(), state)));
  }

  /** Operação com prazo próprio (navegação, waitForFunction, captura): só o vigia (opMaxMs) e a queda da página. */
  async function during(what, run, at = new Error()) {
    const op = track(what, at, limits.opMaxMs);
    try {
      return await race(Promise.resolve().then(run));
    } catch (e) {
      if (e === LOST) throw abort(what, siteOf(at), lostWhy());
      throw e;
    } finally {
      ops.delete(op);
    }
  }
  // ---- Teto de relógio em cada ida ao navegador sem prazo próprio. Com a aba (ou a GPU) travada, a promessa nunca
  // volta. Vencido o teto, a página fica marcada como travada e as idas seguintes falham na hora (o catch do script e
  // o fechamento terminam rápido).
  async function guard(what, start, ms = limits.evalMs) {
    const at = new Error();
    if (wedged) throw new HarnessAbort(`${tag}${what} não executado: a página já estava travada (${wedged})`);
    const op = track(what, at, limits.opMaxMs);
    const call = Promise.resolve().then(start);
    try {
      return await race(call, ms);
    } catch (e) {
      if (e === LOST || (lost && e !== TIMEOUT)) {
        call.catch(() => {});
        throw abort(what, siteOf(at), lostWhy());
      }
      if (e !== TIMEOUT) throw e;
      call.catch(() => {}); // a resposta tardia (ou o erro ao fechar o navegador) não vira rejeição solta
      wedged = `${tag}${what} ficou ${secs(ms)} sem resposta`;
      throw abort(what, siteOf(at), joined(`a página não respondeu em ${secs(ms)} (page.evaluate/entrada sem retorno: aba ou GPU travada?).`, contextText()));
    } finally {
      ops.delete(op);
    }
  }
  /** Estado do jogo agora, para um diagnóstico: no máximo 5 s, sem marcar a página como travada. */
  async function peek() {
    let timer;
    const reading = raw.evaluate(() => window.__game?.game?.debug?.info?.() ?? null)
      .then((i) => (i ? `estado agora: ${describe(i)}` : 'window.__game ainda não existe'), (e) => `a leitura do estado falhou: ${String(e.message).split('\n')[0]}`);
    reading.finally(() => clearTimeout(timer)).catch(() => {});
    return Promise.race([reading, new Promise((done) => { timer = setTimeout(done, 5000, 'a página não respondeu à leitura do estado em 5 s'); })]);
  }
  /** Um prazo do Playwright venceu (ou outro erro da página): a mensagem ganha a linha do script e o estado do jogo. */
  async function annotate(e, at) {
    if (e instanceof HarnessAbort || closing || typeof e?.message !== 'string') return e;
    const first = e.message.split('\n')[0];
    const better = `${first} [${tag}${siteOf(at) ?? 'linha desconhecida'}; ${await peek()}]`;
    e.message = e.message.replace(first, better);
    if (typeof e.stack === 'string') e.stack = e.stack.replace(first, better);
    return e;
  }

  const evaluate = (what, fn, arg) => guard(what, () => raw.evaluate(fn, arg));
  // Os scripts usam a página direto: os mesmos tetos valem para eles.
  page.evaluate = (fn, arg) => evaluate(`page.evaluate(${snippet(fn)})`, fn, arg);
  page.setViewportSize = (size) => guard(callText('page.setViewportSize', [size]), () => raw.setViewportSize(size));
  page.addInitScript = (script, arg) => guard('page.addInitScript()', () => raw.addInitScript(script, arg));
  for (const [obj, methods] of [['keyboard', ['down', 'up', 'press', 'type', 'insertText']], ['mouse', ['move', 'down', 'up', 'click', 'wheel']], ['touchscreen', ['tap']]]) {
    for (const m of methods) {
      const rawInput = page[obj][m].bind(page[obj]);
      page[obj][m] = (...a) => guard(`${obj}.${m}(${a.filter((x) => typeof x !== 'object').join(', ')})`, () => rawInput(...a), limits.evalMs + (a.at(-1)?.delay || 0));
    }
  }
  for (const m of ['goto', 'reload', 'waitForFunction', 'waitForSelector', 'screenshot', 'click']) {
    page[m] = async (...a) => {
      const at = new Error();
      const what = callText(`page.${m}`, a);
      if (wedged) throw new HarnessAbort(`${tag}${what} não executado: a página já estava travada (${wedged})`);
      try {
        return await during(what, () => raw[m](...a), at);
      } catch (e) {
        throw await annotate(e, at);
      }
    };
  }
  page.close = async (...a) => {
    release();
    if (lost) return raw.close(...a).catch(() => {});
    return during('page.close()', () => raw.close(...a));
  };
  // Sessões CDP desta página (ex.: os dedos reais da suíte toque, Input.dispatchTouchEvent): o mesmo teto em cada comando.
  const ctx = page.context();
  const rawCDPSession = ctx.newCDPSession.bind(ctx);
  ctx.newCDPSession = async (target) => {
    const session = await rawCDPSession(target);
    if (target === page) {
      const send = session.send.bind(session);
      session.send = (method, params) => guard(`cdp.send(${method})`, () => send(method, params));
    }
    return session;
  };

  const g = {
    page, browser, limits, raw, aborts, evaluate, during, guard, abort, peek, release,
    note(text) { note = { text, at: Date.now() }; },
    get wedged() { return wedged; },
    get lost() { return lost; },
  };
  guarded.set(page, g);
  guards.add(g);
  startWatch();
  return g;
}

/** Abre uma página já protegida (a abertura também fica sob o vigia). → { page, guard } */
export async function openPage(browser, options = {}, guardOptions = {}) {
  const limits = limitsFrom(guardOptions.limits);
  const tag = guardOptions.name ? `[${guardOptions.name}] ` : '';
  const page = await watched('browser.newPage()', () => browser.newPage(options), { tag, limits, onOverdue: guardOptions.onOverdue });
  return { page, guard: guardPage(page, guardOptions) };
}

/** Fecha o navegador em até closeMs. Preso, reprova (report) e encerra o processo em 2 s: a conexão presa o seguraria.
 *  → true se fechou. */
export async function closeBrowser(browser, { limits: overrides = {}, report = true } = {}) {
  if (!browser) return true;
  const { closeMs } = limitsFrom(overrides);
  for (const g of [...guards]) if (g.browser === browser) g.release();
  let timer;
  const closed = await Promise.race([
    browser.close().then(() => true, () => true),
    new Promise((done) => { timer = setTimeout(done, closeMs, false); }),
  ]);
  clearTimeout(timer);
  if (!closed) {
    if (report) {
      console.log(`  FALHOU [harness] o navegador não fechou em ${secs(closeMs)}`);
      process.exitCode = 1;
    }
    setTimeout(() => process.exit(process.exitCode || 1), 2000).unref(); // o Playwright encerra o navegador filho na saída
  }
  return closed;
}
