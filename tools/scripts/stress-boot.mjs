// Carregamentos repetidos (E2E manual, suíte "carregamento"): reproduz o travamento intermitente do PRIMEIRO boot de
// uma fase num navegador novo (cerca de 1% dos jobs do E2E; ver docs/ARQUITETURA.md §10, "Travamento no primeiro
// carregamento"). Cada rodada sobe um Vite novo e um navegador novo, como cada suíte e cada script de captura, abre
// uma fase (em rodízio) e a abre de novo no mesmo navegador, para comparar o boot frio com o quente. Se a aba travar,
// a sonda do harness (lib/hang-probe.mjs) imprime o diagnóstico e o processo reprova. No fim, os tempos por fase.
// Roda no GitHub Actions: node tools/scripts/stress-boot.mjs [--rounds 25] [--offset 0] [--levels fase1,...,fase8]
import { createHarness, parseArgs } from './lib/harness.mjs';
import { bootTimeline } from './lib/hang-probe.mjs';
import { createServer } from 'vite';

if (!process.env.CI) throw new Error('Este estresse deve rodar no GitHub Actions, conforme AGENTS.md.');
const args = parseArgs();
const ROUNDS = Number(args.rounds) || 25;
const OFFSET = Number(args.offset) || 0;
const LEVELS = (typeof args.levels === 'string' ? args.levels : 'fase1,fase2,fase3,fase4,fase5,fase6,fase7,fase8').split(',');

const results = []; // { level, cold, ms, compile }
let pass = 0;
let fail = 0;
const t0 = Date.now();
for (let round = 0; round < ROUNDS; round++) {
  const level = LEVELS[(OFFSET + round) % LEVELS.length];
  console.log(`\n== rodada ${round + 1}/${ROUNDS}: ${level} (Vite e navegador novos) ==`);
  const server = await createServer({ configFile: 'tools/scripts/vite.nohmr.config.mjs', server: { port: 0 }, logLevel: 'warn' });
  await server.listen();
  const H = await createHarness({ base: server.resolvedUrls.local[0], outDir: 'shots/carregamento' });
  try {
    for (const cold of [true, false]) {
      const start = Date.now();
      await H.load(`?level=${level}&play`);
      const ms = Date.now() - start;
      const boot = await bootTimeline(H.page);
      const at = (name) => boot.marks.find(([n]) => n === name)?.[1];
      results.push({ level, cold, ms, compile: (at('rr:level:compile') - at('rr:level:setup')) || 0 });
      const i = await H.info();
      H.check(i.state === 'playing' && i.levelId === level, `${level}: boot ${cold ? 'frio' : 'quente'} chegou ao jogo`, `${(ms / 1000).toFixed(1)} s`);
    }
  } catch (e) {
    H.check(false, `${level}: exceção: ${e.message}`);
  } finally {
    const failures = await H.close();
    pass += H.pass;
    fail += failures;
    await server.close();
  }
}

const stat = (xs) => {
  const v = [...xs].sort((a, b) => a - b);
  return v.length ? `mediana ${(v[v.length >> 1] / 1000).toFixed(1)} s, máx ${(v[v.length - 1] / 1000).toFixed(1)} s` : '-';
};
console.log(`\n[carregamento] ${results.length} boots em ${Math.round((Date.now() - t0) / 1000)} s`);
for (const level of LEVELS) {
  const of = (cold) => results.filter((r) => r.level === level && r.cold === cold);
  if (!of(true).length) continue;
  console.log(`  ${level}: frio (${of(true).length}) ${stat(of(true).map((r) => r.ms))}; shaders ${stat(of(true).map((r) => r.compile))}`
    + ` | quente (${of(false).length}) ${stat(of(false).map((r) => r.ms))}; shaders ${stat(of(false).map((r) => r.compile))}`);
}
console.log(`\n${pass} ok, ${fail} falha(s)`);
process.exitCode = fail ? 1 : 0;
