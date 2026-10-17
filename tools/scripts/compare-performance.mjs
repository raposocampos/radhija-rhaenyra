import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compareReferences, createBaseline, evaluateBaseline } from './lib/performance-report.mjs';

const directory = fileURLToPath(new URL('../../shots/performance/', import.meta.url));
const a = JSON.parse(await readFile(`${directory}/a/report.json`, 'utf8'));
const b = JSON.parse(await readFile(`${directory}/b/report.json`, 'utf8'));
const comparison = compareReferences(a, b);
const candidate = createBaseline(a, comparison);
await writeFile(`${directory}/baseline-candidate.json`, JSON.stringify(candidate, null, 2) + '\n');
let baseline = null;
try { baseline = JSON.parse(await readFile(fileURLToPath(new URL('../../docs/performance-baseline.json', import.meta.url)), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const baselineComparison = baseline ? evaluateBaseline(baseline, a, comparison) : { comparable: false, reasons: ['first reference: no adopted baseline yet'], metrics: [] };
const report = { commit: a.commit, buildHash: a.buildHash, run: a.run, attempt: a.attempt,
  environment: a.environment, conditions: a.conditions, comparison, baselineComparison,
  purpose: 'observed envelope for investigation on an equivalent runner/protocol, not a production SLA or physical GPU target',
  formula: 'max + max(range, 3*MAD, median*0.10, floor); floor 5ms cadence/CPU, 50ms load/UI released render, 1MiB heap',
  passed: true };
await writeFile(`${directory}/comparison.json`, JSON.stringify(report, null, 2) + '\n');
const number = (n) => n.toFixed(1);
const lines = [
  '# Referência de desempenho — cinco fases', '',
  `Commit: \`${a.commit}\`. Execução: \`${a.run}\`, tentativa \`${a.attempt}\`.`,
  `Build SHA-256: \`${a.buildHash}\`.`, '',
  `${a.environment.browser}, ${a.environment.os} ${a.environment.release}, ${a.environment.cpu}, ${a.environment.logicalCpus} CPUs lógicas.`,
  'Chromium/SwiftShader, 1280×720, DPR 1, sombras 2048 e quatro passes completos. Duas referências sequenciais no mesmo runner e build; navegador novo em cada uma.', '',
  'Cada referência visita as cinco fases em um ciclo de aquecimento e três medidos. Cada janela medida tem pelo menos 20 quadros e 8 s. A simulação e os efeitos continuam ativos, sem comandos de jogador; a câmera mostra a mesma vista geral por fase.', '',
  '| Fase | Cadência p95 A / B (ms) | CPU quadro p95 A / B (ms) | Carga A / B (ms) | Render com UI liberada A / B (ms) | Heap A / B (MiB) |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
];
for (const row of comparison) {
  const pair = (metric, divisor = 1) => `${number(row.metrics[metric].referenceA.p50 / divisor)} / ${number(row.metrics[metric].referenceB.p50 / divisor)}`;
  lines.push(`| ${row.level} | ${pair('cadenceP95Ms')} | ${pair('frameCpuP95Ms')} | ${pair('loadMs')} | ${pair('uiReleasedRenderMs')} | ${pair('heapUsedBytes', 1048576)} |`);
}
lines.push('', 'Valores da tabela são medianas das três visitas; cadência/CPU usam o p95 de cada janela. Carga inclui a preparação completa e a espera intencional de transição; render com UI liberada inclui a cortina. O relatório JSON preserva todas as amostras, p50/p90/p95/p99, desvio padrão, MAD e valores por visita. Não misturar estes tempos com GPU time ou com o dt limitado da simulação.', '',
  '| Fase | Métrica | Mín.–máx. nas 6 visitas | MAD | Limite exploratório |', '| --- | --- | ---: | ---: | ---: |');
for (const row of comparison) for (const [metric, value] of Object.entries(row.metrics)) {
  const divisor = metric.endsWith('Bytes') ? 1048576 : 1, unit = divisor === 1 ? 'ms' : 'MiB';
  const s = value.envelope;
  lines.push(`| ${row.level} | ${metric} (${unit}) | ${number(s.min / divisor)}–${number(s.max / divisor)} | ${number(s.mad / divisor)} | ${number(s.upper / divisor)} |`);
}
lines.push('', 'Limites calculados após estas medições: máximo observado + maior valor entre amplitude, 3×MAD, 10% da mediana e piso de 5 ms (cadência/CPU), 50 ms (carga/UI liberada) ou 1 MiB (heap). São pontos de investigação para novas execuções equivalentes; a dispersão de seis visitas não estabelece um orçamento de produção. O workflow reprova identidade, qualidade, ausência de desenho, dados incompletos e erros reais; não bloqueia PR por ruído de tempo de um runner compartilhado.', '',
  'Heap é JavaScript após GC forçado, coletado fora da janela temporal e seguido de reaquecimento. Não mede VRAM nem memória total do navegador. Cadência rAF inclui agendamento e pressão da renderização; CPU síncrona não espera a GPU. Nenhum gl.finish é chamado.', '',
  'A prova negativa substituiu somente o desenho por uma função vazia na página instrumentada: ambas as referências rejeitaram a falsa melhora por ausência de draw calls. O jogo publicado não foi alterado.', '',
  'Dados: `a/report.json`, `b/report.json`, `comparison.json`. As duas referências usam um build próprio desta execução; a prévia tem um build separado. SwiftShader não representa o PC, celular ou controle do jogador.', '');
lines.push('## Comparação com a referência adotada', '');
if (!baselineComparison.comparable) lines.push(`Sem comparação temporal válida: ${baselineComparison.reasons.join('; ')}.`, '');
else {
  lines.push(`Origem: commit \`${baselineComparison.baselineCommit}\`, execução \`${baselineComparison.baselineRun}\`. Os limites dessa referência permanecem fixos.`, '',
    '| Fase | Métrica | Máximo observado | Limite adotado | Investigar |', '| --- | --- | ---: | ---: | --- |');
  for (const row of baselineComparison.metrics) lines.push(`| ${row.level} | ${row.metric} | ${number(row.observedMax)} | ${number(row.baselineUpper)} | ${row.requiresInvestigation ? 'sim' : 'não'} |`);
  lines.push('', 'Bytes são mantidos nessa comparação quando a métrica termina em Bytes; demais métricas em ms. Um excesso pede reprodução e investigação, não reprova automaticamente.', '');
}
lines.push('`baseline-candidate.json` é uma proposta derivada desta execução, nunca substitui automaticamente a referência adotada. Para a primeira entrega, revisar e versionar como `docs/performance-baseline.json` com status `adopted`, junto de um resumo durável dos resultados e SHA/run de origem. Não recalibrar limites a cada mudança.', '');
const markdown = lines.join('\n');
await writeFile(`${directory}/report.md`, markdown);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);
