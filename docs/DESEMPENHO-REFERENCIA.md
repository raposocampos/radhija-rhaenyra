# Referência de desempenho — cinco fases isoladas

Commit: `b4a61b380cfd96b1f27ba8f4fba28037ee228b4d`. Execução: `39082606479`, tentativa `1`.
Build único SHA-256: `76f50595f93c659ade530cde16a157d9c944b469453f8e2259b728b68b03f630`.

Cinco jobs paralelos recebem o mesmo build. Cada fase tem A/B sequenciais no mesmo runner e navegador novo por referência. Hardware pode diferir entre fases: compare apenas cada fase com sua referência equivalente.

| Fase | Chromium | CPU | CPUs lógicas | Imagem do runner |
| --- | --- | --- | ---: | --- |
| fase1 | 131.0.6778.33 | AMD EPYC 9V74 80-Core Processor | 4 | ubuntu24 20261012.334.1 |
| fase2 | 131.0.6778.33 | AMD EPYC 7763 64-Core Processor | 4 | ubuntu24 20261012.334.1 |
| fase3 | 131.0.6778.33 | AMD EPYC 9V45 96-Core Processor | 4 | ubuntu24 20261012.334.1 |
| fase4 | 131.0.6778.33 | AMD EPYC 7763 64-Core Processor | 4 | ubuntu24 20261012.334.1 |
| fase5 | 131.0.6778.33 | AMD EPYC 7763 64-Core Processor | 4 | ubuntu24 20261012.334.1 |

Qualidade completa: 1280×720, DPR 1, sombras 2048, bloom e quatro passes. Cada navegador inicia diretamente na fase alvo, faz um reload de aquecimento e três reloads medidos da mesma fase. Cada janela medida exige pelo menos 20 quadros e 8 s; simulação/efeitos permanecem ativos e a câmera fixa é igual dentro de cada par. Heap após GC é coletado fora da janela e seguido de reaquecimento.

| Fase | Cadência p95 A / B (ms) | CPU quadro p95 A / B (ms) | Reload A / B (ms) | Render com UI liberada A / B (ms) | Heap A / B (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| fase1 | 3433.2 / 3418.3 | 14.2 / 14.1 | 11976.0 / 11948.3 | 15426.4 / 15432.3 | 13.4 / 13.5 |
| fase2 | 4734.9 / 4734.9 | 20.4 / 20.1 | 16514.3 / 16505.0 | 21394.5 / 21465.9 | 15.3 / 15.3 |
| fase3 | 3649.9 / 3454.9 | 15.1 / 18.6 | 12281.3 / 11580.1 | 17554.0 / 19902.0 | 16.8 / 16.6 |
| fase4 | 5368.2 / 5384.8 | 34.9 / 35.4 | 17631.2 / 17805.0 | 30685.4 / 30646.7 | 15.1 / 15.2 |
| fase5 | 1701.7 / 1699.9 | 15.3 / 17.9 | 5769.4 / 5763.7 | 10395.9 / 10427.1 | 13.4 / 13.3 |

Valores são medianas das três visitas; cadência/CPU usam o p95 de cada janela. Reload inclui preparação e espera intencional; render com UI liberada inclui a cortina. Submissão não confirma apresentação física da GPU. JSONs preservam quadros brutos, p50/p90/p95/p99, desvio padrão e MAD. Este protocolo isolado não é comparável à rodada incompleta de alternâncias entre fases.

| Fase | Métrica | Mín.–máx. nas 6 visitas | MAD | Limite exploratório |
| --- | --- | ---: | ---: | ---: |
| fase1 | cadenceP95Ms (ms) | 3416.6–3436.6 | 1.7 | 3779.9 |
| fase1 | frameCpuP95Ms (ms) | 11.9–18.8 | 1.4 | 25.8 |
| fase1 | loadMs (ms) | 11924.5–11999.6 | 21.4 | 13196.1 |
| fase1 | uiReleasedRenderMs (ms) | 15361.0–16571.5 | 57.8 | 18114.4 |
| fase1 | heapUsedBytes (MiB) | 13.2–13.5 | 0.1 | 14.9 |
| fase2 | cadenceP95Ms (ms) | 4718.2–4818.2 | 8.4 | 5291.6 |
| fase2 | frameCpuP95Ms (ms) | 18.3–26.4 | 0.9 | 34.6 |
| fase2 | loadMs (ms) | 16399.9–16565.5 | 42.9 | 18216.5 |
| fase2 | uiReleasedRenderMs (ms) | 21175.1–24720.1 | 58.2 | 28265.1 |
| fase2 | heapUsedBytes (MiB) | 15.1–15.4 | 0.1 | 17.0 |
| fase3 | cadenceP95Ms (ms) | 3416.5–3701.6 | 97.5 | 4056.8 |
| fase3 | frameCpuP95Ms (ms) | 14.0–20.6 | 1.8 | 27.2 |
| fase3 | loadMs (ms) | 11575.5–12335.7 | 215.8 | 13545.0 |
| fase3 | uiReleasedRenderMs (ms) | 15258.9–21286.4 | 2253.4 | 28046.7 |
| fase3 | heapUsedBytes (MiB) | 16.6–16.9 | 0.1 | 18.6 |
| fase4 | cadenceP95Ms (ms) | 5368.2–5399.7 | 8.3 | 5938.1 |
| fase4 | frameCpuP95Ms (ms) | 33.2–36.8 | 0.7 | 41.8 |
| fase4 | loadMs (ms) | 17545.0–17892.6 | 71.4 | 19657.3 |
| fase4 | uiReleasedRenderMs (ms) | 30609.0–30843.2 | 23.0 | 33910.5 |
| fase4 | heapUsedBytes (MiB) | 15.0–15.3 | 0.1 | 16.8 |
| fase5 | cadenceP95Ms (ms) | 1686.7–1716.7 | 0.9 | 1886.7 |
| fase5 | frameCpuP95Ms (ms) | 14.1–20.3 | 1.4 | 26.6 |
| fase5 | loadMs (ms) | 5729.7–7422.4 | 6.2 | 9115.1 |
| fase5 | uiReleasedRenderMs (ms) | 10310.2–12010.2 | 60.9 | 13710.2 |
| fase5 | heapUsedBytes (MiB) | 13.1–13.5 | 0.2 | 14.9 |

Limites calculados após medir: máximo + max(amplitude, 3×MAD, 10% da mediana, piso). Pisos de 5 ms (cadência/CPU), 50 ms (reload/UI liberada), 1 MiB (heap). São pontos de investigação, não metas de produção ou intervalos de confiança. O workflow reprova integridade/completude/qualidade/erros, sem bloquear PR por ruído temporal de runner compartilhado.

A prova negativa de cada referência removeu o desenho apenas da página instrumentada e rejeitou a falsa melhora por draw calls ausentes. O jogo publicado não foi alterado. Heap JS não é VRAM nem memória total do processo; CPU síncrona não mede conclusão da GPU. SwiftShader não representa o hardware do jogador.

## Adoção e interpretação

Referência revisada e adotada em 2026-10-17 por Codex, com revisão independente.
[Execução de origem](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39082606479),
[commit medido](https://github.com/raposocampos/radhija-rhaenyra/commit/b4a61b380cfd96b1f27ba8f4fba28037ee228b4d).
Os valores completos e os ambientes estão em [performance-baseline.json](performance-baseline.json),
com status `adopted`. O commit que adiciona estes documentos não é o commit medido acima:
sua validação final deve ser conferida no PR #16 pelo SHA atual.

Foram revisados dez relatórios, 40 visitas (30 medidas, 600 quadros), cinco pares sequenciais,
identidades e qualidade iguais dentro de cada par e dez provas negativas reais. Os 25 limites e
os percentis/dispersão foram recalculados a partir dos dados brutos sem divergências. Oito testes
da infraestrutura passaram. Relatórios sem erros, warnings ou falhas de coleta.

Mesmo com o mesmo código, CPU do quadro p95 variou de 15,1 para 18,6 ms entre A/B na fase 3,
e de 15,3 para 17,9 ms na fase 5. A fase 5 teve um reload de 7.422,4 ms, acima das medianas
próximas de 5.770 ms. Isso evidencia o ruído e explica margens explícitas; não é comparação entre
versões nem prova de regressão. Diferenças de CPU entre jobs impedem ordenar as fases por custo.

Os limites ficam fixos em futuras execuções. Se o ambiente de uma fase diferir da referência,
a comparação temporal dessa fase é declarada incompatível. Um excesso comparável pede reprodução
e investigação, sem recalibrar o JSON automaticamente. O novo candidato de cada execução fica
no artefato; substituí-lo exige revisão explícita com origem preservada.

Estas seis visitas por fase não provam ausência de vazamento de longo prazo. Heap JS não cobre
VRAM, e o cenário sem comandos não representa todas as combinações de habilidades/partículas.
A fase 6 permanece em DEV e está fora deste catálogo de cinco fases; sua inclusão futura exige
ampliar explicitamente protocolo e referência. Não interpretar os segundos de cadência de
SwiftShader como desempenho do jogo no computador ou celular do usuário.

Os artefatos `desempenho-cinco-fases`/`desempenho-faseN` da execução guardam os dados brutos por
14 dias. Este resumo e o JSON versionado preservam valores, dispersão, limites e identidade
após a expiração. O [protocolo](DESEMPENHO.md) explica como repetir a coleta na nuvem.
