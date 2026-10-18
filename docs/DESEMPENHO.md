# Referência de desempenho

O workflow **Referência de desempenho** (`.github/workflows/desempenho.yml`) mede as cinco fases publicadas
com a renderização normal. É independente das partidas E2E, que reduzem qualidade para verificar gameplay,
e de `measure-resources.mjs`, que compara contagens de recursos com desenhos controlados. Nenhum dos dois
substitui este instrumento temporal. Não executar a medição no PC sem solicitação explícita.

## Protocolo

- Protocolo `isolated-level-v2` (schema 2). Um job gera o build único, distribuído como artefato para cinco
  jobs paralelos, um por fase, com Ubuntu 24.04, Node 24 e Chromium fixado no lockfile. Cada job executa A e B
  sequencialmente no mesmo runner/build/SHA, com navegador novo para cada referência. Hardware pode diferir
  entre fases; ambiente e limites são guardados por fase, sem comparar tempos de fases em máquinas distintas.
- Viewport 1280×720, DPR 1, sombras 2048, bloom e quatro passes completos. A câmera fixa enquadra os limites
  de cada fase. O jogo fica em `playing`, sem comandos; simulação, companheira, cenário, UI e efeitos continuam
  avançando normalmente. Nenhum `gl.finish`, pausa de updates ou passo artificial é usado na janela temporal.
- O navegador abre diretamente a fase publicada pelo índice numérico (`?level=3&play` para fase 3); ID e
  catálogo são conferidos antes da amostra. Não inicializa a fase 1 nos outros jobs. Faz um reload de
  aquecimento e três reloads medidos da **mesma fase**; não percorre fases vizinhas. Cada janela medida exige pelo menos 20
  quadros e 8 segundos. A janela só começa após carregamento, retirada total da cortina, coleta de heap e
  reaquecimento de pelo menos quatro quadros/um segundo.
- O build é servido em subcaminho de prévia. Cada relatório identifica SHA do checkout e hash de todos os
  arquivos do build, execução/tentativa, navegador, CPU, sistema, imagem do runner, qualidade e câmera.
  O build desta medição não é o artefato binário publicado pelo CI da prévia.
- Um agregador exige exatamente cinco pares, todos completos/aprovados, mesmo SHA/hash/run/tentativa/protocolo.
  Dentro de cada par exige A/B distintos, sequenciais e mesmo ambiente/qualidade/câmera, quatro visitas
  (uma de aquecimento e três medidas), volume/qualidade originais e prova negativa real. Falhas de um job não
  cancelam os outros; artefatos parciais são preservados e não viram referência válida.

## O que cada número significa

| Dado | Interpretação e limite |
| --- | --- |
| Cadência rAF (ms) | Intervalos entre callbacks reais que executaram update e desenho. Inclui agendamento/backpressure; não usar o `dt` da simulação, limitado a 50 ms, como tempo real. |
| CPU do quadro (ms) | Entrada de `game.update` até retorno de `engine.render`, incluindo efeitos/UI e pequeno custo da instrumentação. Não mede conclusão da GPU. |
| CPU de render (ms) | Duração síncrona de `engine.render`; o desenho original e todos os passes permanecem ativos. Não equivale a GPU time. |
| Reload aquecido (ms) | `level:loading` até `level:loaded` ao recarregar a mesma fase; módulos já importados, descarte, montagem, iluminação e compile, mais espera intencional de transição. Não separa custo interno de cada etapa. |
| Primeira submissão de render | Retorno síncrono de render real da geração/root nova após `level:loaded`. Compile não conta como desenho; sem fence, este proxy não prova apresentação na tela nem conclusão da GPU. |
| Render com UI liberada | Primeira submissão após remoção do overlay de boot e término da cortina; inclui duração da transição da UI. Também é um proxy, não confirmação de um quadro visível. |
| Heap JS (bytes) | `Runtime.getHeapUsage` após `HeapProfiler.collectGarbage`, fora da janela temporal. Inclui JS da página/probe; não é VRAM nem memória total do processo. |

O primeiro carregamento da fase escolhida termina antes de `window.__game` existir. Seus eventos vêm do histórico de
diagnóstico, com precisão arredondada de 1 ms; o setter instalado antes do boot captura a primeira submissão.
O relatório também separa navegação → submissão inicial/com UI liberada. Nas trocas seguintes o probe observa
os eventos e mede a promessa de `loadLevel`; geração + ID + UUID de root distinguem inclusive reload da mesma
fase. O boot inicial fica separado; ciclo 0 aquece o reload e ciclos 1–3 medem módulos/caches da mesma fase.
Heap representa essa fase isolada, não os caches acumulados de todas as outras. Alternâncias e ownership
continuam cobertos pelo medidor de recursos de EST-05.

## Execução e leitura

Na instalação, o PR dispara o workflow quando altera seus próprios arquivos. Após o workflow entrar no main,
despache `gh workflow run desempenho.yml --ref codex/minha-branch`. O workflow tem somente `contents: read`,
checkout sem credenciais persistidas, nenhum ambiente de publicação e nenhum segredo. Não é check obrigatório
novo e não altera proteções do repositório.

O artefato agregado `desempenho-cinco-fases` contém `faseN/a/report.json`, `faseN/b/report.json`,
`comparison.json` e `report.md`. Cada job também preserva seu artefato `desempenho-faseN`.
Os JSONs guardam amostras brutas e p50/p90/p95/p99, média, desvio padrão e MAD; o Markdown e o resumo da execução
mostram medianas das três visitas de cada referência, dispersão das seis visitas combinadas e limites calculados.
Conferir SHA, hash, ambiente, qualidade, completude, erros e warnings antes de interpretar tempos. O processo
reprova erros inesperados do navegador, HTTP, identidades misturadas, ausência de desenho ou qualidade reduzida.
Logs e `pendingStage` identificam boot, reload, UI, heap, aquecimento e janela temporal. Esperas têm prazo
diagnóstico: 180 s por operação, 300 s no controlador da janela e 270 s no probe (com fase/geração/quadros
no erro); o watchdog de 25 min por referência continua ativo. Timeout reprova, nunca aceita janela incompleta.

A prova negativa do navegador remove apenas o desenho na página instrumentada depois das medições: quadros
aparentemente rápidos precisam ser rejeitados por draw calls ausentes. `test-performance-infra.mjs` acrescenta
provas negativas para qualidade reduzida, mistura de reloads/SHA/build/run, A/B invertido/duplicado, fases ou
visitas ausentes/duplicadas, ausência de prova real e cálculo de percentis/caudas. As provas rodam
na nuvem; não mudam o jogo distribuído.

## Limites depois de medir

A referência adotada está em [DESEMPENHO-REFERENCIA.md](DESEMPENHO-REFERENCIA.md), com origem,
valores e dispersão. Os limites completos ficam em [performance-baseline.json](performance-baseline.json).

Não há números de referência inventados neste documento. A primeira execução válida gera, para cada fase,
limites exploratórios a partir de seis visitas: `máximo + max(amplitude, 3×MAD, 10% da mediana, piso)`.
Pisos: 5 ms para cadência/CPU, 50 ms para carregamento/render com UI liberada, 1 MiB para heap. São margens explícitas de
investigação, calculadas **depois** das amostras; não são metas de produção nem intervalos de confiança.
O PR deve ligar o relatório e registrar valores/variação observados antes de declarar EST-08 concluída.

O artefato também traz `baseline-candidate.json`. Na primeira entrega, revisar os dados e versionar a referência
como `docs/performance-baseline.json` com status `adopted`, junto de um resumo em `DESEMPENHO-REFERENCIA.md` com
valores, dispersão, limitações e SHA/run medidos. Assim a referência continua disponível depois de expirar o
artefato. Essa atualização documental gera outro commit: os dados conservam seu SHA de origem e a validação
do commit final precisa de execução própria; nunca atribuir o resultado anterior ao novo SHA.

Execuções futuras leem automaticamente a referência adotada e mostram excessos sobre seus limites fixos.
Não recalibrar o orçamento silenciosamente a cada PR: o candidato novo fica separado, sem substituir o JSON
versionado. Ambiente próprio da fase (exceto o nome efêmero do runner), protocolo, catálogo, câmera e qualidade
precisam coincidir; incompatibilidade explica e suprime somente a comparação da fase afetada. Nunca atribuir
o ambiente da fase 1 às demais. Atualizar uma referência exige decisão explícita
justificada pelas medições e revisão, preservando a origem anterior no histórico.

Para avaliar uma mudança futura, repetir o mesmo protocolo e comparar ambientes/SHA/qualidade. Se superar o
limite observado, reproduzir e investigar a fase antes de otimizar; não relaxar a qualidade para melhorar a
medição. Tempos em runner compartilhado têm ruído: o workflow valida integridade do instrumento, sem tornar
essa margem um bloqueio automático por desempenho. Seis visitas não bastam para afirmar ausência de vazamento
de longo prazo; contagens gráficas e testes de ownership continuam necessários.

SwiftShader renderiza por software e não representa a GPU física do jogador. Este cenário parado com simulação
ativa também não mede todas as combinações de pulo, superbafo e partículas. Problemas concretos nesses caminhos
pedem cenário de medição próprio. Expandir o protocolo para uma sexta fase exige atualizar explicitamente seu
catálogo e a referência; o protótipo em `DEV_LEVELS` não entra silenciosamente nos números desta rodada.

## Diagnóstico da instalação

A execução `39080397088`, commit `0b2a329`, tentou percorrer as cinco fases em série por referência. O watchdog
de 25 min encerrou A após 11 das 20 visitas, sem falhas de qualidade ou erros anteriores. Janelas de 20 quadros
chegaram a 142 s na fase 3 em SwiftShader. B e a prova negativa real não chegaram a rodar; essa execução é
diagnóstico, **não baseline**. O redesenho distribui as fases em jobs, preserva quantidade de amostras/quadros e
qualidade e muda explicitamente o cenário para reload isolado. Não combinar números dos dois protocolos.
