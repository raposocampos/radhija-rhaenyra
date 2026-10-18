# Contexto para retomar o projeto

Última atualização: 2026-10-17. Agente: Codex.

Leia primeiro `AGENTS.md`, na raiz, para as regras de entrega, testes e
privacidade. Este documento registra o andamento compartilhado com o Claude.

## EST-08 — referência adotada, validação final pendente (2026-10-17, Codex)

PR #16, branch `codex/desempenho-expansao`, worktree `desempenho-expansao`.
Coordenador incorporou a base publicada `b954b24` (PR #15); conflitos apenas
nos dois registros de contexto/plano, reconciliados sem alterar o runtime.
Instrumento `b4a61b3`: CI `39082606472` aprovou 183 testes/tipos/build;
medição `39082606479` passou oito provas da infraestrutura e cinco pares A/B,
com três reloads medidos por referência, qualidade completa, desenho real,
nenhum erro/warning e provas negativas corretas. Revisão dos dados por agentes
independentes. Baseline preserva SHA/hash/run de origem, não o commit documental.

Protocolo `isolated-level-v2`: build único, cinco jobs paralelos, A/B sequenciais
no mesmo runner por fase e navegador novo por referência. Boot direto, um reload
de aquecimento e três medidos, 20 quadros/8 s mínimos, simulação/render normais,
GC/heap fora da janela e reaquecimento. Ambiente e limite fixo por fase; hardware
pode diferir entre fases. SwiftShader não representa GPU física nem FPS do jogador.
Detalhes, valores, dispersão e limites em `DESEMPENHO-REFERENCIA.md` e
`performance-baseline.json`; protocolo em `DESEMPENHO.md`. Não recalibrar limites
silenciosamente. A rodada antiga `39080397088` excedeu 25 min, não é baseline.

Guia de novas fases cobre DEV antes do catálogo, factories estritas, contratos,
ações inválidas, pausa/reset/descarte, progresso/hasNext, runner/workflow, arte e
aprovação. PR #16 só altera instrumento/workflow/documentação em relação ao main.
Nenhum teste/build local; inspeção, revisão de dados já produzidos e diff-check.

Próximo passo: enviar o commit combinado (base + baseline + resumo), acompanhar
CI/prévia e medição próprios. O novo run compara com a referência fixa; ambientes
incompatíveis impedem comparação temporal, não justificam inventar conclusão.
Conferir head/base/version.json, registrar resultados no PR e apresentar a prévia
para aprovação. EST-08 ainda não está publicada. Não criar commit só para informar
o resultado do CI deste próprio checkpoint.

## PR #15 — protótipo Expresso publicado (2026-10-17, Codex)

Usuário aprovou o protótipo corrigido `05e2287`, base `fae8acd`, após prévia
`/previews/pr-15/39082917531-1/?level=fase6&play`. CI `39082917531` passou
207 testes/tipos/build; E2E Expresso `39082921941` passou 24 verificações,
4 de infraestrutura, 23 de smoke, 28 de recuperação e 30 comparações de recursos
estáveis, sem erros/warnings/descarte global. Capturas das seis fases revisadas.
A correção impede dica falsa perto da bandeja em ready/carrying e tem regressão
nos oito estados e interação real. Conversa de revisão resolvida com evidência.

Integrado por squash `b954b24942fe93aa30429351f2c20fe7e41b8119`, árvore idêntica
à aprovada. CI main `39083884706` passou; deploy `39083918751` passou após liberar
somente o deployment `7147954364` com a aprovação do chat. Produção HTTP 200 e
`version.json` confirmaram `b954b24` e o run do main. Não repetir merge/deploy.

Acesso `?level=fase6&play`, somente `DEV_LEVELS`; cinco fases da campanha intactas.
Oficina procedural na direção artística existente. Rhaenyra pousa no pedal para
escolher trilho; Radhija sopra no nariz do trem, que espirra e traz a bolinha-planeta.
Rota circular permite repetir; rota congelada em movimento. Oito estados, controle
de nuvens, pausa/reset/descarte e petiscos opcionais. 18 testes da fase e oito
provas negativas de tipos; suíte expresso também pertence ao E2E completo.

Limites aprovados: blocagem jogável, espirro visual sem som exclusivo, curvas
segmentadas com giro imediato do vagão. Próxima entrega: acabamento da oficina,
animações/som e, depois de validar, entrada no catálogo/progressão. Manter arte
coerente com o jogo. Proposta do PR #9 incorporada em `PROPOSTA-FASE6.md`.
A aprovação/publicação de #15 não cobre #16 nem acabamento futuro.

## EST-07A — configuração publicada (2026-10-17, Codex)

[PR #13](https://github.com/raposocampos/radhija-rhaenyra/pull/13), head aprovado
`0571ccfbe041986c546fe1de6bedb7b093f70624`, base `597c8f2`.
Configuração global em `src/dogs/config.js`, sem posições; `withStart` cria
cópias independentes para os oito layouts. Modelo visual independente da fase 1.
Valores, posições e habilidades preservados, com três testes novos.

CI `39076340307`: 176 testes, tipos e build aprovados; prévia conferida.
E2E completo `39076338931` passou no mesmo head: 313 verificações de gameplay,
quatro de infraestrutura, 19 de smoke e 28 de recuperação. Recursos estáveis
nas cinco fases, 25 amostras, globais preservados e nenhum erro/warning.
Capturas de cenários e recuperação revisadas sem regressão aparente.

Usuário aprovou no chat. Integrado por squash em
`4552e602de7b55b3372ac8d8309ce20884ab6cb0`, árvore idêntica à aprovada.
CI main `39077869869` aprovou 176 testes/tipos/build; deploy `39077894749`
concluído após liberar somente o deployment `7147072605` com essa aprovação.
Produção HTTP 200/version.json confirmou `4552e60` e o run do main.
Publicado; não repetir merge/deploy do #13.

## EST-07B — eventos publicados (2026-10-17, Codex)

[PR #14](https://github.com/raposocampos/radhija-rhaenyra/pull/14): emissão,
vibração, histórico e diagnóstico da câmera extraídos para `gameEvents.js`,
sete testes runtime e três provas negativas. Estado/carregamento/reset/descarte
preservados no núcleo. Usuário aprovou head `cf33d69977aff41d96f40d984d3431a2a1648f44`,
base `4552e60`; CI `39078268404` aprovou 183 testes/tipos/build; prévia conferida.
E2E completo `39078277583`: 313 verificações de gameplay, quatro de infraestrutura,
19 de smoke, 28 de recuperação; 25 amostras de recursos estáveis, globais
preservados, erros/warnings vazios e capturas revisadas.

Squash `fae8acdce2fc7ae15c8feaec33a695a974fc94e0`, árvore idêntica à aprovada.
CI main `39079619941` passou. Deploy `39079647854`, deployment `7147332851`,
concluído após liberação com essa aprovação. Produção HTTP 200/version.json
confirmou `fae8acd` e o run do main. Publicado; não repetir merge/deploy.

## Etapas restantes e fase 6 (2026-10-17, Codex)

EST-07B foi aprovado/integrado. Resta EST-08 para encerrar a estabilização.
EST-08 foi delimitada a um PR após #14: medir carregamento, cadência com render
normal e heap JS; duas referências comparáveis no mesmo SHA, qualidade completa,
ambiente/amostras/dispersão registrados e limites definidos após medir. Reutilizar
identidade/servidor/qualidade do medidor de recursos, que já descobre LEVELS;
seus dois renders controlados por visita não medem FPS. SwiftShader não representa
GPU física. Atualizar guia: testes na nuvem, suíte no runner e workflow,
contratos/reset/pausa/save/hasNext, protótipo isolado e aprovação da prévia.
Concluir com relatório das cinco fases, provas negativas e CI/medição do head final.
Sem novas extrações ou otimizações preventivas para ampliar essa etapa.

Fase 6: após o usuário rejeitar a repetição do pombo, o PR #9 foi reformulado
como **Expresso do Superbafo**, head `aa48121`, base `597c8f2`; CI `39076630494`
e prévia passaram. Oficina de brinquedos e bolinha-planeta: Rhaenyra pula no
pedal para escolher o trilho; Radhija provoca um espirro do trem com superbafo
para trazer o objeto. Proposta e imagem conceitual apresentadas; tema/puzzle
ainda não aprovados naquele checkpoint; escolha posterior e protótipo acima.
Branch documental `codex/proposta-fase6`,
worktree `proposta-fase6`. Não reutilizar a prévia antiga para aprovação após
atualizar sua base. Protótipo pode avançar em paralelo após a escolha do desenho;
as dependências técnicas EST-03/04/05/06 já foram entregues.

## EST-06 — contratos publicados (2026-10-17, Codex)

Execução autorizada após aprovação/publicação do PR #11. Base `ca8c6f2`.
Coordenador em `codex/contratos-fases`, worktree `contratos-fases`, responsável
por integração, documentação, PR e CI. Dois executores em worktrees próprios:

- `codex/tipos-fases`, worktree `tipos-fases`: `src/types.d.ts`, definições,
  puzzles e retornos dos cenários, fronteira dinâmica do núcleo, eventos de
  carregamento, `jsconfig.json` e fixture `test/types/`. Ligar `LevelDef<P>`,
  `LevelBuild<P>` e `PuzzleContext<P>` às props reais de cada fase; fechar o
  índice permissivo e declarar `plate.surfaceY` da fase 4.
- `codex/contratos-testes`, worktree `contratos-testes`: helpers e testes
  runtime. Substituir a fabricação automática de props/métodos por fábricas
  explícitas; manter ausências reais de props opcionais em `_modelo`/`_pulo`.
  Testar cenário real da fase 4 (altura da placa, pressão/reset e pombo), itens
  carregáveis, portões e reset, preservando carregamento/descarte.
- Combinar a interface antes de integrar. `jsconfig.json` hoje exclui os
  helpers `.mjs`: a fixture direcionada precisa realmente checar as factories
  e reprovar contratos inválidos, não apenas acrescentar JSDoc sem cobertura.
  Tipagem completa de layouts, navegação e IA fica fora desta entrega.

Implementações combinadas: tipos `89370fc` → `e7d366d`, testes `7a449c3` →
`37c1bbc`. Nove testes runtime novos e fixture de tipos com exemplos inválidos;
factories reais e dublês entram na checagem, preservando retorno dos helpers de
medição com genéricos. Emissão de eventos de carregamento tipada por nome
literal; listeners, nomes dinâmicos, layouts e navegação continuam fronteiras
abertas, documentadas. Gameplay e ownership de EST-05 preservados.

Primeiro CI `39073795596`, head `7842015`, detectou três produtores reais que
ainda aceitavam métodos inexistentes: literais JS intermediários tinham índice
aberto implícito. Corrigidos nos produtores em `d61914c`, com anotações de
retorno/variável verificadas, sem casts nem remoção das provas negativas.
As interfaces dos puzzles estão fechadas; não afirmar tipagem exaustiva de
todas as funções internas. Revisão independente sem bloqueios.

[PR #12](https://github.com/raposocampos/radhija-rhaenyra/pull/12), head aprovado
`4086c1995cc14ec200af0e7228f59d8f83061bdf`, base `ca8c6f2`:
CI `39073923073` passou 173 testes, tipos (19 provas negativas) e build;
prévia `39073952808` conferida por HTTP/version.json. E2E `39073972653`
passou no mesmo head: 313 verificações de gameplay, quatro de infraestrutura,
19 de smoke e 28 de recuperação. Recursos estáveis nas cinco fases, 25 amostras,
globais preservados e erros/warnings vazios. Capturas de cenários, recuperação
e amostras comparativas da fase 4 revisadas sem regressão aparente.

Usuário aprovou a versão; integrada por squash em
`597c8f2b77b7765b0b911f3e25629c74c8e4eecd`, árvore idêntica ao head aprovado.
CI main `39075921425` aprovou 173 testes/tipos/build. Deploy `39075957502`
concluído após liberar somente o deployment `7146778253` com a aprovação
do chat. Produção HTTP 200/version.json confirmou `597c8f2` e o run do main.
Publicado; não repetir integração/deploy de #12. Próximo trabalho é EST-07.

## EST-05 — recursos gráficos publicados (2026-10-17, Codex)

Branch `codex/recursos-graficos`, worktree `recursos-graficos`, base publicada
`9be3075`. Medição e workflow de `codex/medicao-recursos` combinados no
[PR #11](https://github.com/raposocampos/radhija-rhaenyra/pull/11). Usuário
aprovou o head `c69a9f0`; integrado por squash em
`ca8c6f2941b06dd545394c29ff236b632537720f`, com árvores idênticas. Publicado;
não repetir integração/deploy de #11.

- Escopo por fase criado antes de `build`, com coleta da árvore atual e extras
  declarados: geometrias, materiais, texturas, instâncias e debug. Caches são
  preservados por identidade, inclusive texturas emprestadas a materiais locais
  e geometria global de Sprite. Texturas de chão capturadas por closures são
  registradas ao nascer, inclusive se a montagem falhar antes do retorno.
- Reset devolve itens carregados antes da coleta; a limpeza continua se um hook
  falhar. Scent tem `dispose` separado de `reset`, liberando também esfera fora
  da árvore após expiração. Seu grupo sai antes do scope pai, evitando dupla
  liberação. Referências descartadas são anuladas; `debug.info()` tolera erro
  antes da primeira montagem e depois de limpeza parcial.
- Linhas de debug reutilizam atributos e liberam o buffer anterior antes de
  crescer. Onze testes novos usam objetos Three reais; as regressões de
  carregamento também conferem diagnóstico após falha. Protocolo de ownership
  em [ARQUITETURA.md](ARQUITETURA.md#31-propriedade-e-descarte-de-recursos).
- Medição: duas passagens de aquecimento e três medidas por fase, ciclos pelas
  cinco fases, render completo em Chromium/SwiftShader, DPR 1, cheiro/preview e
  debug. Comparar contagens GPU por fase após aquecimento, sem exigir zero de
  caches. Não mede MB, VRAM ou FPS; observação dos globais cobre geometrias e
  materiais iniciais, complementada pelos testes de ownership.
- Prova negativa `39064044388`, instrumento `98c96a2` sobre a base sem correção:
  25 amostras, sem erros/warnings de navegador; reprovou pelo crescimento de
  60 geometrias e 147 texturas por ciclo e descarte de geometria global.
- E2E `todas` `39071375058`, head `3a37f58`, passou 313 verificações de gameplay,
  quatro de infraestrutura, 19 de smoke e 28 de recuperação. A medição aprovou
  25 amostras, 15 após aquecimento, contagens estáveis nas cinco fases, globais
  preservados e erros/warnings vazios. Capturas da recuperação conferidas.
- O último ajuste mudou somente captura e contexto (`display:none` temporário
  nos overlays); código do jogo idêntico ao E2E completo. No head aprovado
  `c69a9f0`, CI `39072371165` passou 164 testes/tipos/build, prévia `39072399080`
  conferida HTTP/version e E2E `recursos` `39072373671` aprovado. Cinco PNGs
  revisados, sem overlays ou corrupção aparente. Platôs geometria/textura/programa:
  F1 521/45/242, F2 546/62/269, F3 706/59/254, F4 822/70/244, F5 519/58/235.
- CI main `39073156852` aprovou 164 testes/tipos/build. Deploy `39073191543`
  passou após liberar somente o deployment `7146356056`, usando a aprovação
  do chat. Produção HTTP 200/version.json confirmou `ca8c6f2` e o run do main.
  Nenhum teste/build local; próxima entrega EST-06 exige aprovação própria.

## EST-03 — recuperação publicada (2026-10-17, Codex)

Implementado no [PR #10](https://github.com/raposocampos/radhija-rhaenyra/pull/10),
branch `codex/recuperacao-carregamento`, worktree `recuperacao-carregamento`.
Após atualizar sobre `2ee7e07`, o usuário aprovou o head `019723f`. Integrado
por squash em `9be3075ec05a4903218822f047be5405c51d108c` e publicado; não repetir
integração/deploy de #10.

- `loadLevel` observa rejeições desde o início e resolve um resultado booleano.
  Em falha, entra em `load-error` e emite `level:error`. Comandos normais ficam
  bloqueados; simulação, efeitos e render não usam objetos parciais.
- A UI fecha a cortina, informa o problema e oferece recarga por mouse/teclado.
  `ui:cancelLoad` permite retornar à fase anterior apenas quando nenhum objeto
  dela foi alterado. Depois de reset/descarte/montagem parcial, só recarga.
  O fallback de boot funciona mesmo antes de engine/UI/`__game` existirem.
- Oito testes Node cobrem rejeição imediata, exceção síncrona, concorrência,
  chamador da UI e falhas em build/puzzle/reset/descarte/compile. O teste de
  navegador no E2E manual também cobre ações acessíveis e aba antiga após
  remoção de chunks, com recarga e save preservado. O manifest e a cópia de
  arquivos com nomes novos pertencem ao build próprio do E2E, não à prévia.
- Arquivos: núcleo/entrada, UI/cortina/markup, bloco CSS de erro ao fim do
  arquivo, helper headless, testes novos, workflow E2E e documentação pertinente.
  Não altera o bloco de foco do menu, progress.js, CI obrigatório ou publicação.
- Versão aprovada: `019723f`, base `2ee7e07`. CI `39062287562` aprovou
  tipos, 153 testes e build; publicação `39062324764` passou com prévia HTTP 200
  e identidade conferida. E2E `39062283263` aprovou 313 verificações de gameplay,
  quatro de infraestrutura, 19 de smoke e 28 de recuperação; capturas da fase 4
  com `errors: []`. Capturas de recuperação revisadas visualmente, sem bloqueios.
  Preservados os 19 testes de progresso e os oito de recuperação.
- [CI main 39063414327](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39063414327)
  aprovou tipos, 153 testes e build; [deploy 39063438736](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39063438736)
  passou após liberação do deployment `7144785613` com aprovação do chat.
  Produção HTTP 200/version.json confirmou `9be3075` e a execução do main.
  Nenhum teste/tipo/build local; resultados anteriores pertencem ao histórico.

## EST-04 — progresso publicado (2026-10-17, Codex)

Implementado no [PR #7](https://github.com/raposocampos/radhija-rhaenyra/pull/7),
branch `codex/progresso-validado`, worktree isolado `progresso-validado`.
Após revalidação sobre `d38574a`, o usuário aprovou o head
`a39a3422dc1aa06847ef67a92f4948ce23d7d8c9`. Integrado por squash em
`2ee7e078d25140a82ccf4ee31aa4d7abcea5ac7c`, com árvores idênticas ao head
aprovado e ao merge sintético; produção confirmada.

- Escopo próprio: `src/ui/progress.js`, `test/progress.test.mjs`, contexto e
  plano. Código de progresso e seus 19 testes preservados nesta atualização
  de #10; CSS e teste de controle vêm integralmente do #8 já publicado.
- Formato e chave v1 mantidos, sem migração necessária. Validação rejeita
  arrays/estruturas incompatíveis e normaliza os campos inválidos de cada
  fase sem apagar suas marcas válidas. Contagens exigem inteiros seguros
  não negativos; tempos exigem números finitos não negativos, sem coerção.
  Petiscos anteriores são preservados; total conhecido nunca fica abaixo
  da coleta. IDs de fases desconhecidas e chaves como `__proto__` permanecem
  propriedades próprias, sem modificar o protótipo do mapa.
- Política de versão: qualquer versão declarada diferente de 1 fica intacta
  no storage. A partida usa uma cópia v1 vazia em memória; vitórias e reset
  não sobrescrevem esse formato desconhecido. A gravação relê a versão para
  detectar alteração por outra aba e retorna booleano; vitória retorna `saved`.
- Falha de leitura impede gravação sobre conteúdo desconhecido; quota/falha
  de escrita preserva o save anterior e não interrompe a partida. JSON
  corrompido pode ser substituído por um novo save válido ao concluir fase.
- Regressões cobrem saves v1, fases desconhecidas, arrays, strings, números
  inválidos, recordes, releitura entre abas, versões futuras, falhas de
  storage e isolamento das prévias. No head aprovado, CI `39060731088`
  passou tipos, 145 testes e build; E2E fase1 `39060727463` passou 61 e
  controle `39060729617` passou 60 verificações, sem falhas/erros de console.
  Prévia `39060761036` conferida por HTTP/version e revisão sem bloqueios.
- [CI main 39061928859](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39061928859)
  aprovou tipos, 145 testes e build Vite 6.4.4. [Deploy 39061964438](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39061964438)
  concluído após liberação do deployment `7144556034` com a aprovação do chat.
  Produção HTTP 200 e `version.json` confirmou head/commit `2ee7e07`, base nula,
  run `39061928859`, tentativa 1. Não repetir integração/publicação de #7.

## Onde paramos

**PR #14 publicado; protótipo Expresso combinado para validação.**
Produção confirmada em `fae8acd`, CI `39079619941` e deploy `39079647854`
aprovados, HTTP/version.json conferidos. Não repetir merge/deploy.
Protótipo autorizado em `codex/prototipo-expresso`; nunca publicar sem aprovação
da prévia específica. EST-08 em implementação separada, única etapa restante.
Testes continuam no GitHub; conferir estado atual pelos SHAs e execuções.

Plano e critérios: [PLANO-ESTABILIZACAO.md](PLANO-ESTABILIZACAO.md).
Histórico da correção do menu: branch `codex/menu-jogar-visivel`, worktree
`menu-jogar-visivel`; entrega a partir de `b1b026e29abb7cc80fff6a13224e967d78415151`.
EST-09: conflito entre a animação de entrada `rr-rise` e a de foco
`rr-focus-pulse` reiniciava a entrada com opacidade zero ao sair do botão.
Reprodução em `7a05466de2f3d605139ef2b8f7336b0925a8824b`,
[E2E 39057998118](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39057998118):
56 verificações passaram e quatro falharam pelo motivo esperado, opacidade
zero ao descer por teclado/D-pad/analógico e ao retornar ao mouse.
Correção: excluir Jogar apenas da animação de pulso do foco; entrada, halo e
anel de seleção permanecem. Revisão independente sem bloqueios. O teste
amostra estilos dentro do navegador, para não perder a falha entre leituras.
No head aprovado `8494143bbe918bb804c05bb115ff1e7770aaef7c`,
[CI 39058279947](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39058279947)
passou tipos, 126 testes e build; [E2E controle 39058279323](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39058279323)
passou 60 verificações, sem erros de console, com opacidade mínima 1 nos
sete cenários. O usuário aprovou essa prévia. Squash
`d38574a54d1203a3f7d71dd26541167d93819db3` tem árvore idêntica ao head
aprovado e ao merge sintético `196f108`, conferidos independentemente.
[CI main 39060437829](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39060437829)
aprovou tipos, 126 testes e build Vite 6.4.4; [deploy 39060461084](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39060461084)
concluiu após liberação do deployment `7144319080` com a aprovação do chat.
Produção HTTP 200 e `version.json` confirmou head/commit `d38574a`, run
`39060437829`, tentativa 1. Nenhum teste/build local; não repetir publicação.

- EST-01: executor Codex em `codex/estabilidade-e2e`, worktree
  `estabilidade-e2e`; implementado no [PR #6](https://github.com/raposocampos/radhija-rhaenyra/pull/6),
  head `6ebacd999da6bd36249cd76ef3e90a319752b666`.
  Harness e runner agora reprovam erros do navegador, falhas e resumo ausente;
  as provas com Chromium confirmam a propagação até o processo final. O smoke
  serve somente `dist`, abre as cinco fases e confere imports e recursos.
  [CI 39052841286](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39052841286)
  aprovado: tipos, 126 testes rápidos e build. [Prévia](https://raposocampos.github.io/radhija-rhaenyra/previews/pr-6/39052841286-1/)
  publicada, com head/base conferidos em `version.json`.
  [E2E completo 39052837420](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39052837420)
  aprovado no mesmo head: nove suítes, 299 verificações de gameplay, quatro
  provas de propagação de erro e 19 verificações do build estático, sem erros
  de console. Capturas da fase 4 concluídas, com `errors: []` no log.
  A [revisão de fluxo](https://github.com/raposocampos/radhija-rhaenyra/pull/6#discussion_r4303596789)
  foi atendida e a conversa resolvida: navegador fica no `E2E manual`, na opção
  `todas`; o CI obrigatório mantém tipos/testes rápidos/build. O smoke testa
  um build próprio da execução E2E, distinto do artefato da prévia. O usuário
  aprovou essa versão no chat; integrada por squash em
  `9fcce7505e75d3080d9c2529c76ea97b7fa72a90`.
  [CI do main 39053762821](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39053762821)
  aprovado. [Deploy 39053794991](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39053794991)
  concluído com sucesso após liberação com essa aprovação. Produção respondeu
  HTTP 200 e `version.json` confirmou `9fcce75` e CI `39053762821`.
- EST-02: executor Codex em `codex/atualizar-vite`, worktree
  `atualizar-vite`; Vite 6.4.4 implementado no [PR #5](https://github.com/raposocampos/radhija-rhaenyra/pull/5),
  head aprovado `3f9540248b33b78b1cc43aa834352901ef3ec457`, após merge normal da
  base `9fcce7505e75d3080d9c2529c76ea97b7fa72a90`, sem force push. Nenhuma
  dependência transitiva mudou; auditoria do lockfile continua sem avisos.
  A versão segue o [aviso oficial GHSA-rq7h-c2jc-7f22](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22):
  `6.4.4` corrige o acesso indevido fora de `server.fs.allow`, ainda presente
  até `6.4.3`. A evidência é a versão corrigida e a auditoria do lockfile;
  não foi executada prova de exploração. A atualização usou apenas
  `--package-lock-only --ignore-scripts`, sem testes/build locais. O servidor
  de desenvolvimento continua em `127.0.0.1` e produção serve arquivos estáticos.
  O head anterior `4f03e38` passou CI `39051377056` e E2E `39051384592`
  (123 testes rápidos e 299 verificações de gameplay), mas esses resultados
  não validam a nova combinação. No head atual, [CI 39053902153](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39053902153)
  aprovou tipos, 126 testes rápidos e build. [Prévia](https://raposocampos.github.io/radhija-rhaenyra/previews/pr-5/39053902153-1/)
  publicada, HTTP 200 e head/base conferidos em `version.json`.
  [E2E completo 39053897305](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39053897305)
  aprovado no mesmo head: 299 verificações nas nove partidas, quatro provas
  de infraestrutura e 19 verificações do smoke, sem erros de console. Capturas
  da fase 4 concluídas, com `errors: []`. O usuário aprovou explicitamente
  integrar e publicar o PR #5 no chat. Integrado por squash em
  `18629a0e3877cc6c56201f5a12b3048feb1514e9`, com árvore idêntica ao head aprovado,
  confirmada por revisão independente. [CI do main 39056035625](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39056035625)
  aprovado: tipos, 126 testes rápidos e build Vite 6.4.4.
  [Deploy 39056064315](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39056064315)
  concluído com sucesso usando essa aprovação. Produção HTTP 200 e
  `version.json` confirmou `18629a0` e execução `39056035625`.
- EST-00: [PR #4](https://github.com/raposocampos/radhija-rhaenyra/pull/4)
  aprovado pelo usuário no head `2fcbca3` e integrado por squash em
  `b1b026e29abb7cc80fff6a13224e967d78415151`.
  [CI main 39057715283](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39057715283)
  e [deploy 39057744110](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39057744110)
  concluídos com sucesso. Produção HTTP 200 e `version.json` conferido no
  squash e CI acima. Primeira etapa (#6, #5, #4) integrada e publicada.
- EST-03: [PR #10](https://github.com/raposocampos/radhija-rhaenyra/pull/10), executor
  em `codex/recuperacao-carregamento`, worktree `recuperacao-carregamento`,
  incorporando `2ee7e07` para revalidação, conforme checkpoint acima. Dono do núcleo,
  inicialização, UI de erro, cortina, testes de carregamento e acréscimo
  isolado ao E2E manual. Não alterar regras de foco nem teste de controle.
- EST-04: [PR #7](https://github.com/raposocampos/radhija-rhaenyra/pull/7), executor
  em `codex/progresso-validado`, worktree `progresso-validado`, já publicado
  em `2ee7e07`. `src/ui/progress.js` e testes próprios são herdados sem alterações
  por #10. Preservar saves v1 válidos; versões não suportadas não podem ser
  sobrescritas silenciosamente. Sem mudanças no menu ou núcleo.
- EST-09: publicado no #8; coordenador dono do bloco de foco em `src/ui/ui.css`
  e regressões em `test-gamepad.mjs`. Nesta rodada, o executor EST-03 é o único
  editor do plano compartilhado por delegação. O CSS de erro de EST-03 é um bloco
  próprio, sem editar essas regras. Retomadas dos executores são registradas
  no contexto de suas branches e reconciliadas na integração.
- Ordem desta rodada: EST-09 e EST-04 publicados; segue EST-03, com aprovação
  própria. #10 incorpora a base `2ee7e07` e passa por nova validação completa.
  EST-05 depende de EST-03; EST-06/07/08 continuam pendentes. A próxima fase pode
  ser desenhada/prototipada isoladamente. O usuário autorizou preparar uma
  proposta combinando pulo e superbafo, já documentada no
  [PR #9](https://github.com/raposocampos/radhija-rhaenyra/pull/9), head `62b9b6c`,
  branch `codex/proposta-fase6`, worktree `proposta-fase6`, sem código novo nem
  mudança no catálogo. Tema/objeto sugeridos ainda precisam de aprovação.

## Evidências da avaliação anterior

- Base examinada: `baa8af07e8f1e81bf03c7ec6f379c32955a2efd6`.
  O registro anterior estava desatualizado: o [PR #3](https://github.com/raposocampos/radhija-rhaenyra/pull/3)
  foi integrado. [CI 39009757588](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39009757588)
  aprovou tipos, 123 testes e build; [deploy 39009786059](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39009786059)
  terminou com sucesso. `version.json` de produção confirmou esse SHA e CI.
  Não repetir merge/deploy. Decisões dos pombos permanecem em `docs/POMBOS.md`.
- Conferidas por API as proteções do main, checks obrigatórios e revisão do
  ambiente de produção. Nenhuma proteção ou configuração alterada.
- [E2E completo 39048060825](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39048060825)
  executado no GitHub, suíte `todas`, no SHA acima: **sucesso nas nove suítes,
  299 verificações aprovadas e nenhum erro de console nos logs**. Contagens:
  bafo 12, fase4 17, regressões 9, pulo 8, controle 46, fase5 18, fase2 77,
  fase1 61 e fase3 51. Essa execução da avaliação foi concluída; não valida
  os novos commits da estabilização.
- Prioridades propostas na avaliação da base `baa8af0`:
  1. Erros inesperados de console/pageerror eram apenas registrados pelo E2E;
     faltava um teste mínimo do build estático. **Concluído em EST-01, PR #6:**
     erros agora reprovam e há um smoke do build próprio do E2E. As partidas
     de gameplay continuam usando o servidor de desenvolvimento.
  2. Recuperar estado e oferecer ação útil quando loadLevel rejeitar. Avaliar
     também abas antigas após deploy: os arquivos anteriores são removidos,
     e imports de fases sob demanda podem apontar para chunks inexistentes.
  3. Definir descarte de materiais/texturas exclusivos e propriedade dos
     recursos compartilhados; medir memória após alternar fases repetidamente.
     O descarte incompleto foi inspecionado, mas crescimento de memória não
     foi medido nesta avaliação.
  4. Fortalecer tipos entre puzzle/cenário e dublês de props: o uso de any e
     Proxy permissivo pode esconder incompatibilidades. Validar contratos reais.
  5. Validar/migrar o progresso salvo antes de ampliar conteúdo; extrair
     configurações comuns das dogs da fase1 e dividir o núcleo gradualmente.
- Consulta leve `npm audit --package-lock-only --ignore-scripts --json`:
  Vite 6.3.5 é a única dependência sinalizada, severidade agregada alta; o
  relatório indica 6.4.4 como correção sem troca de major. Os avisos consultados
  referem-se ao servidor de desenvolvimento; produção usa arquivos estáticos.
  Nenhuma dependência foi instalada ou atualizada.
- Nenhum teste, build ou partida foi executado no PC durante a avaliação.
  Inspeção local do diff e `git diff --check` sem problemas. A implementação
  de EST-01 e EST-02 agora está autorizada e usa validações próprias na nuvem.

## O que foi feito

1. **Preparação para publicação:** o trabalho do branch
   `claude/fervent-agnesi-36ed38` foi integrado ao `main`. O histórico foi
   revisado antes de publicar e a identidade pessoal dos autores foi
   substituída pela identidade pública com e-mail `noreply`. As referências
   locais antigas foram preservadas em backup local, que não deve ser enviado.
   Não foram encontradas credenciais na revisão feita naquele momento.
2. **Privacidade:** fotos de `referencias/fotos/`, configurações locais,
   credenciais e saídas de build/testes permanecem fora do Git. Isso não dispensa
   revisar novas alterações antes de publicar.
3. **CI e publicação inicial:** `.github/workflows/ci.yml` roda tipos, testes rápidos
   e build no GitHub. O fluxo antigo publicava automaticamente após sucesso no main;
   esta tarefa substitui isso por PR, prévia e aprovação para produção.
   `vite.config.js` usa `base: './'` para os caminhos do site funcionarem.
4. **E2E na nuvem:** `.github/workflows/e2e.yml` permite escolher `todas` ou uma
   suíte. Cada suíte roda numa máquina Linux do GitHub. O Chromium é instalado
   pelo Playwright; `tools/scripts/lib/browser.mjs` centraliza a configuração.
5. **Estabilidade dos E2E:** o harness usa tempo simulado e reduz o custo de
   renderização apenas no CI. Foram corrigidas esperas de comandos curtos,
   pausa/retomada da fase 1, alinhamento ao caixote da fase 2 e medição do tempo
   de curiosidade da gansa na fase 3. A redução visual dos testes não altera a
   qualidade visual da versão publicada.
6. **Instruções dos agentes:** `AGENTS.md` define o fluxo; `CLAUDE.md` o importa.
   Ambos agora direcionam o agente a este documento de contexto.
7. **Dica de empurrar:** `richText` em `src/ui/markup.js` reconhece Shift também
   fora de parênteses. A UI mostra R1 no PlayStation, RB no Xbox e Shift no
   teclado, acompanhando a troca de dispositivo com a dica já na tela.

## Validações já realizadas

- Navegação do menu, commit `b3023aa`: CI aprovado na
  [execução 38999914786](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38999914786)
  e E2E `controle` aprovado na
  [execução 38999915196](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38999915196).
  As 46 verificações passaram no GitHub; nenhum teste ou build local foi rodado.
- Correção da dica, commit `f925a94`: CI aprovado na
  [execução 38999413489](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38999413489)
  e E2E `controle` aprovado na
  [execução 38999413926](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38999413926).
  Todos os testes desta tarefa rodaram no GitHub, sem build ou partidas locais.
  Publicada em `8fe992f`, com
  [CI/deploy 38999578176](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38999578176)
  aprovado e site respondendo HTTP 200.
- CI e deploy de `7c874dc`: aprovados na
  [execução 38997538477](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38997538477).
  O site respondeu HTTP 200 após essa publicação.
- A implantação inicial validou os 112 testes rápidos no GitHub. As nove
  suítes E2E somaram 280 verificações aprovadas, sem erros de console, em
  execuções sucessivas durante os ajustes. **Não foi uma única execução completa
  no mesmo commit final.** Não atribuir esses resultados a mudanças futuras.
- Referências dos E2E aprovados: fase 4, fase 5, regressões e pulo na execução
  `38990015603` (outras suítes dessa execução falharam); controle em
  `38990311359`; bafo em `38990313401`; fase 1 em `38990463878`; fase 2 em
  `38990695795`; fase 3 em `38990809581`. Os ajustes de código terminaram em
  `cd1499a`.
- Para verificar a publicação desta atualização documental ou de uma versão
  posterior, consultar o workflow do commit correspondente no
  [histórico de CI](https://github.com/raposocampos/radhija-rhaenyra/actions/workflows/ci.yml).
  Os resultados acima são evidências anteriores, não aprovação antecipada.
- Não executar testes ou build locais para atualizar este documento. Usar
  revisão do diff e `git diff --check`; deixar o CI rodar no GitHub.

## Decisões do usuário

- Pedir uma implementação inclui enviar um branch, abrir PR, acompanhar CI e
  entregar uma prévia. **Aguardar aprovação explícita para integrar e publicar
  no mesmo link principal.** O agente pode concluir as ações no GitHub usando
  essa aprovação dada no chat, sem exigir que o usuário opere o GitHub.
- Testes e build devem rodar na nuvem. Testes pesados no PC só por pedido
  explícito. E2E é separado e acionado quando necessário.
- A passagem entre Codex e Claude será por este Markdown. **ai-memory foi
  pesquisado, mas não instalado; ficou para outro projeto.**
- Usar branches/worktrees separados para trabalho simultâneo, com integração
  de PRs uma por vez. Este documento não é um bloqueio automático de edição:
  conferir atividade alheia antes de modificar arquivos ou trocar branch.

## Próximo passo para o agente que assumir

1. Ler as instruções e este resumo; conferir `git status`, branch, commits e
   estado remoto, preservando alterações existentes.
2. Se precisar confirmar a última entrega, localizar o CI pelo SHA atual no
   GitHub. Não confundir um workflow anterior aprovado com o commit atual.
3. PRs #1 a #8 e #10 a #15 integrados e publicados. Produção confirmada em
   `b954b24`, deploy `39083918751`; não repetir merge/deploy. O Expresso é
   protótipo DEV, acabamento/áudio/campanha são uma próxima entrega.
   PR #16 executa EST-08: baseline adotada de `b4a61b3`/`39082606479`; validar
   o commit final atualizado e apresentar prévia para aprovação própria.
   PR #9 contém a proposta já incorporada. Não reutilizar aprovação anterior
   nem tratar medição parcial como referência. Não instalar ai-memory.
4. Ao receber uma tarefa, atualizar este documento com o novo objetivo e,
   durante a execução, manter um ponto de retomada útil ao outro agente.
