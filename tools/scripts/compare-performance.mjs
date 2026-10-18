import { readFile, readdir, writeFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { aggregateReferences, createBaseline, evaluateBaseline, REFERENCE_LEVELS } from './lib/performance-report.mjs';

const directory = fileURLToPath(new URL('../../shots/performance/', import.meta.url));
const folders = (await readdir(directory, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
if (JSON.stringify(folders) !== JSON.stringify(REFERENCE_LEVELS)) throw new Error(`incomplete phase artifacts: ${folders.join(', ')}`);
const pairs = [];
for (const level of REFERENCE_LEVELS) {
  const a = JSON.parse(await readFile(`${directory}/${level}/a/report.json`, 'utf8'));
  const b = JSON.parse(await readFile(`${directory}/${level}/b/report.json`, 'utf8'));
  pairs.push({ level, a, b });
}
const aggregate = aggregateReferences(pairs);
await writeFile(`${directory}/baseline-candidate.json`, JSON.stringify(createBaseline(aggregate), null, 2) + '\n');
let baseline = null;
try { baseline = JSON.parse(await readFile(fileURLToPath(new URL('../../docs/performance-baseline.json', import.meta.url)), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const baselineComparison = baseline ? evaluateBaseline(baseline, aggregate) : {
  phases: REFERENCE_LEVELS.map((level) => ({ level, comparable: false, reasons: ['first reference: no adopted baseline yet'], metrics: [] })),
};
const report = { ...aggregate, baselineComparison,
  purpose: 'fixed per-phase investigation envelope on equivalent hardware/protocol; not a production SLA or physical GPU target',
  formula: 'max + max(range, 3*MAD, median*0.10, floor); floor 5ms cadence/CPU, 50ms load/UI released render, 1MiB heap', passed: true };
await writeFile(`${directory}/comparison.json`, JSON.stringify(report, null, 2) + '\n');
const number = (n) => n.toFixed(1);
const lines = [
  '# Referência de desempenho — cinco fases isoladas', '',
  `Commit: \`${aggregate.commit}\`. Execução: \`${aggregate.run}\`, tentativa \`${aggregate.attempt}\`.`,
  `Build único SHA-256: \`${aggregate.buildHash}\`.`, '',
  'Cinco jobs paralelos recebem o mesmo build. Cada fase tem A/B sequenciais no mesmo runner e navegador novo por referência. Hardware pode diferir entre fases: compare apenas cada fase com sua referência equivalente.', '',
  '| Fase | Chromium | CPU | CPUs lógicas | Imagem do runner |', '| --- | --- | --- | ---: | --- |',
];
for (const row of aggregate.phases) {
  const e = row.environment;
  lines.push(`| ${row.level} | ${e.browser} | ${e.cpu} | ${e.logicalCpus} | ${e.runnerImage} ${e.runnerImageVersion} |`);
}
lines.push('', 'Qualidade completa: 1280×720, DPR 1, sombras 2048, bloom e quatro passes. Cada navegador inicia diretamente na fase alvo, faz um reload de aquecimento e três reloads medidos da mesma fase. Cada janela exige pelo menos 20 quadros e 8 s; simulação/efeitos permanecem ativos e a câmera fixa é igual dentro de cada par. Heap após GC é coletado fora da janela e seguido de reaquecimento.', '',
  '| Fase | Cadência p95 A / B (ms) | CPU quadro p95 A / B (ms) | Reload A / B (ms) | Render com UI liberada A / B (ms) | Heap A / B (MiB) |',
  '| --- | ---: | ---: | ---: | ---: | ---: |');
for (const row of aggregate.phases) {
  const pair = (metric, divisor = 1) => `${number(row.metrics[metric].referenceA.p50 / divisor)} / ${number(row.metrics[metric].referenceB.p50 / divisor)}`;
  lines.push(`| ${row.level} | ${pair('cadenceP95Ms')} | ${pair('frameCpuP95Ms')} | ${pair('loadMs')} | ${pair('uiReleasedRenderMs')} | ${pair('heapUsedBytes', 1048576)} |`);
}
lines.push('', 'Valores são medianas das três visitas; cadência/CPU usam o p95 de cada janela. Reload inclui preparação e espera intencional; render com UI liberada inclui a cortina. Submissão não confirma apresentação física da GPU. JSONs preservam quadros brutos, p50/p90/p95/p99, desvio padrão e MAD. Este protocolo isolado não é comparável à rodada incompleta de alternâncias entre fases.', '',
  '| Fase | Métrica | Mín.–máx. nas 6 visitas | MAD | Limite exploratório |', '| --- | --- | ---: | ---: | ---: |');
for (const row of aggregate.phases) for (const [metric, value] of Object.entries(row.metrics)) {
  const divisor = metric.endsWith('Bytes') ? 1048576 : 1, unit = divisor === 1 ? 'ms' : 'MiB', s = value.envelope;
  lines.push(`| ${row.level} | ${metric} (${unit}) | ${number(s.min / divisor)}–${number(s.max / divisor)} | ${number(s.mad / divisor)} | ${number(s.upper / divisor)} |`);
}
lines.push('', 'Limites calculados após medir: máximo + max(amplitude, 3×MAD, 10% da mediana, piso). Pisos de 5 ms (cadência/CPU), 50 ms (reload/UI liberada), 1 MiB (heap). São pontos de investigação, não metas de produção ou intervalos de confiança. O workflow reprova integridade/completude/qualidade/erros, sem bloquear PR por ruído temporal de runner compartilhado.', '',
  'A prova negativa de cada referência removeu o desenho apenas da página instrumentada e rejeitou a falsa melhora por draw calls ausentes. O jogo publicado não foi alterado. Heap JS não é VRAM nem memória total do processo; CPU síncrona não mede conclusão da GPU. SwiftShader não representa o hardware do jogador.', '',
  '## Comparação com a referência adotada', '');
if (baseline) lines.push(`Origem: commit \`${baselineComparison.baselineCommit}\`, execução \`${baselineComparison.baselineRun}\`. Limites permanecem fixos por fase.`, '');
for (const phase of baselineComparison.phases) {
  if (!phase.comparable) { lines.push(`${phase.level}: sem comparação temporal válida — ${phase.reasons.join('; ')}.`, ''); continue; }
  lines.push(`### ${phase.level}`, '', '| Métrica | Máximo observado | Limite adotado | Investigar |', '| --- | ---: | ---: | --- |');
  for (const row of phase.metrics) lines.push(`| ${row.metric} | ${number(row.observedMax)} | ${number(row.baselineUpper)} | ${row.requiresInvestigation ? 'sim' : 'não'} |`);
  lines.push('');
}
lines.push('Na comparação fixa, métricas terminadas em Bytes estão em bytes; demais em ms. Ambiente incompatível invalida só a comparação da fase afetada. Um excesso pede reprodução e investigação; não recalibra o limite.', '',
  'Dados: `faseN/a/report.json`, `faseN/b/report.json`, `comparison.json`. `baseline-candidate.json` (schema 2) é proposta; revisar e versionar como `docs/performance-baseline.json` com status `adopted` e resumo durável que identifique SHA/run de origem. Não substituir automaticamente a referência em cada PR.', '');
const markdown = lines.join('\n');
await writeFile(`${directory}/report.md`, markdown);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);
