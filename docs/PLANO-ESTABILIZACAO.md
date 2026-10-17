# Plano de estabilização do jogo

Data de início: 2026-10-17. Coordenação: Codex.

Preparar o jogo para receber novas fases e mecânicas com menos regressões.
A execução foi autorizada pelo usuário. As regras de entrega, privacidade e
validação estão em [AGENTS.md](../AGENTS.md); integração e produção dependem
da aprovação explícita de cada versão apresentada.

## Base e organização

Base inicial: `baa8af07e8f1e81bf03c7ec6f379c32955a2efd6`.
A [avaliação registrada](CONTEXTO.md) confirmou 123 testes rápidos e
299 verificações E2E nessa base. Novos commits precisam de validação própria.

Um coordenador mantém prioridades, reconcilia registros e revisa entregas.
Dois executores implementam escopos delimitados, cada um com branch e
worktree próprios; uma revisão sem edição pode avançar em paralelo. O
coordenador também implementa uma tarefa isolada, acompanha CI e prévias, apresenta as versões
ao usuário e integra um PR por vez, somente após aprovação.

As tarefas podem ser desenvolvidas em paralelo; uma alteração na base exige
atualizar as branches restantes, revalidar e apresentar as novas versões.
Carregamento, descarte de recursos e divisão do núcleo avançam em sequência
quando alteram a mesma área. Revisões sem alterações podem ocorrer em paralelo.

Ordem de integração da primeira etapa: PR #6 (E2E), PR #5 (Vite) e PR #4
(documentação consolidada). O #6 foi aprovado no chat, integrado e publicado
em `9fcce7505e75d3080d9c2529c76ea97b7fa72a90`. O #5 foi aprovado após revalidação
e integrado/publicado em `18629a0e3877cc6c56201f5a12b3048feb1514e9`, nova base do PR #4.
O #4 foi aprovado, integrado e publicado em `b1b026e29abb7cc80fff6a13224e967d78415151`,
base da segunda rodada. CI `39057715283`, deploy `39057744110` e versão de
produção conferidos. A aprovação desses PRs não inclui as próximas correções.

EST-09 também foi aprovado e publicado pelo PR #8, squash
`d38574a54d1203a3f7d71dd26541167d93819db3`; CI `39060437829` e deploy
`39060461084` aprovados, produção HTTP 200 e `version.json` conferido.
Depois, EST-04 foi aprovado e publicado pelo PR #7, squash
`2ee7e078d25140a82ccf4ee31aa4d7abcea5ac7c`; CI `39061928859` e deploy
`39061964438` aprovados, produção HTTP 200 e `version.json` conferido.
Depois, EST-03 foi aprovado e publicado pelo PR #10, squash
`9be3075ec05a4903218822f047be5405c51d108c`; CI `39063414327` e deploy
`39063438736` aprovados, produção HTTP 200/version.json conferida. Essa é a
base de EST-05; o coordenador delegou este plano ao executor de recursos.

## Boas práticas a preservar

- Fases com definição, layout, puzzle e cenário separados, reunidas no
  [registro de fases](../src/levels/index.js). Novas fases devem seguir o
  [guia existente](COMO-CRIAR-UMA-FASE.md), evitando condições específicas no núcleo.
- [Mecânicas compartilhadas](../src/game/mechanics/index.js) para comportamentos
  reutilizáveis. Corrigir a mecânica comum reduz divergências entre fases.
- [Entrada centralizada](../src/game/input.js) traduz teclado e controle para
  comandos lógicos comuns. Preservar esse contrato ao acrescentar ações.
- Tipos verificados em JavaScript, testes rápidos e partidas E2E já existentes.
  Ampliar a cobertura nas fronteiras alteradas; as lacunas abaixo não exigem
  reescrever o jogo nem trocar toda a tecnologia.
- Versões exatas e lockfile versionado, CI com leitura e publicação confiável
  separada, prévias identificadas por commit e aprovação humana para produção.
- Documentação de arquitetura e criação de fases já presente. Manter decisões,
  checklist e retomada junto do código para não depender do histórico dos chats.

## Checklist e ordem

A caixa marcada indica que os critérios de aceitação foram atendidos e
validados. O estado de publicação é registrado separadamente.

| Critérios atendidos | ID | Entrega | Responsável | Dependência | Situação neste marco |
| --- | --- | --- | --- | --- | --- |
| [x] | EST-00 | Avaliação preservada e plano de execução | Coordenador | Nenhuma | PR #4 aprovado, integrado e publicado |
| [x] | EST-01 | E2E rigoroso e smoke do build | Executor E2E | Base inicial | PR #6 aprovado, integrado e publicado |
| [x] | EST-02 | Atualização pontual do Vite | Executor dependências | Base 9fcce75 | PR #5 aprovado, integrado e publicado |
| [x] | EST-03 | Recuperação de falhas no carregamento | Executor carregamento | EST-01 e EST-02 integrados | PR #10 aprovado, integrado e publicado em 9be3075 |
| [x] | EST-04 | Validação e compatibilidade do progresso | Executor progresso | EST-01 integrado | PR #7 aprovado, integrado e publicado em 2ee7e07 |
| [ ] | EST-05 | Ciclo de vida dos recursos gráficos | Executor recursos + executor medição | EST-03 integrado | Implementado; validação na nuvem pendente |
| [ ] | EST-06 | Contratos entre puzzle e cenário | A atribuir | EST-05 integrado para edições no núcleo | Planejado |
| [ ] | EST-07 | Configuração comum e divisão gradual do núcleo | A atribuir | EST-03, EST-05 e EST-06 integrados | Planejado |
| [ ] | EST-08 | Medições de desempenho e protocolo para novas fases | A atribuir | EST-05 e EST-06 validados | Planejado |
| [x] | EST-09 | Botão Jogar desaparece ao navegar no menu | Coordenador | Primeira etapa publicada | PR #8 aprovado, integrado e publicado em d38574a |

Etapa 1: EST-01 e EST-02. Etapa 2: EST-03 e EST-04. Etapa 3: EST-05 e
revisão sem edição de EST-06. Etapa 4: implementação de EST-06. EST-07 e
EST-08 seguem em entregas próprias, com escopo ajustado às medições.

Na segunda rodada, EST-09, EST-04 e EST-03 foram publicados. Agora EST-05
combina descarte e medição em um PR sobre `9be3075`, com novos
CI/prévia e E2E `todas` antes de pedir aprovação. Cada versão
apresentada exige aprovação própria. Áreas reservadas e checkpoints em
`CONTEXTO.md`; cada executor registra sua entrega na própria branch.
Planejamento da próxima fase pode avançar em paralelo sem mudar o catálogo
principal. A proposta já está no PR #9; ainda não há tema/objeto aprovado
nem código de fase 6 implementado.

Os estados são: planejado, em execução, em validação, aguardando aprovação e
publicado. Um PR com CI aprovado ainda pode aguardar E2E ou aprovação humana.
Consultar PR e execuções pelo SHA para o estado atual; atualizar este quadro
nos marcos, sem criar commits apenas para registrar o CI do próprio documento.

## Critérios de aceitação

### EST-00 Avaliação e plano

- Preservar achados, evidências e limites da avaliação em Markdown versionado.
- Registrar responsáveis, dependências, critérios e instruções de retomada.
- Abrir PR documental e conferir os checks e a prévia, sem E2E adicional para
  uma mudança apenas documental.

Branch: `codex/avaliacao-evolucao`. Worktree: `avaliacao-evolucao`.
Escopo: `AGENTS.md`, `docs/CONTEXTO.md`, este plano.
Entrega: [PR #4](https://github.com/raposocampos/radhija-rhaenyra/pull/4).
Integrado e publicado em `b1b026e` após aprovação do head `2fcbca3`.
CI `39057715283` e deploy `39057744110` aprovados; versão pública conferida.
Atualizações posteriores do plano acompanham os checks da própria entrega.

### EST-01 E2E e build

- Erros inesperados de `console.error` e `pageerror` fazem a execução reprovar.
- Um teste com erro injetado confirma a saída não zero pelo motivo esperado;
  uma execução sem erro continua aprovando. Não usar permissões amplas para
  ignorar erros.
- Um smoke testa o build estático em subcaminho semelhante à prévia, incluindo
  a abertura das cinco fases e o carregamento dos módulos sob demanda.
- Prova de erro e smoke de navegador ficam em um job do `E2E manual`, na
  seleção `todas`, conforme a separação exigida por `AGENTS.md`. O smoke testa
  o build gerado nessa execução; não é o mesmo artefato binário da prévia.
- CI e todas as suítes E2E aprovam o commit entregue, com logs conferidos.
- Preservar os nomes dos checks, permissões de leitura do CI e publicação
  confiável definida no main.

Branch: `codex/estabilidade-e2e`. Worktree: `estabilidade-e2e`.
Escopo: harness, runner, testes, smoke, workflows de CI/E2E e documentação da
tarefa. `package.json`, lockfile, gameplay e publicador ficam fora desta frente.

Entrega: [PR #6](https://github.com/raposocampos/radhija-rhaenyra/pull/6),
head `6ebacd999da6bd36249cd76ef3e90a319752b666`, base inicial acima.
[CI 39052841286](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39052841286)
aprovado: 126 testes rápidos, tipos e build.
[Prévia validada](https://raposocampos.github.io/radhija-rhaenyra/previews/pr-6/39052841286-1/).
[E2E 39052837420](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39052837420)
aprovado: 299 verificações de gameplay nas nove suítes, quatro provas da
infraestrutura e 19 verificações do build, sem erros de console. Capturas da
fase 4 concluídas, com `errors: []` no log. A revisão foi atendida: os testes
de navegador estão no workflow manual e a conversa foi resolvida.
Aprovado pelo usuário no chat e integrado por squash em
`9fcce7505e75d3080d9c2529c76ea97b7fa72a90`.
[CI do main 39053762821](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39053762821)
e [deploy 39053794991](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39053794991)
aprovados. Produção HTTP 200 e `version.json` conferido nesse SHA.

### EST-02 Vite

- Atualizar o Vite para uma versão corrigida adequada da linha 6, com versão
  exata e lockfile consistente, após conferir os avisos e a auditoria atuais.
- Não misturar atualizações de outras dependências sem necessidade comprovada.
- Registrar o resultado da auditoria e validar tipos, testes, build, prévia e
  todas as suítes E2E no GitHub, para o commit entregue.

Branch: `codex/atualizar-vite`. Worktree: `atualizar-vite`.
Escopo: `package.json`, `package-lock.json` e registro próprio no contexto.

Entrega: [PR #5](https://github.com/raposocampos/radhija-rhaenyra/pull/5),
head aprovado `3f9540248b33b78b1cc43aa834352901ef3ec457`, base `9fcce75`.
Vite 6.4.4, sem alterações de dependências transitivas; auditoria do lockfile
sem vulnerabilidades conhecidas reportadas na consulta. O head anterior
`4f03e38` passou CI `39051377056` e E2E `39051384592` na base inicial; esses
resultados não validam a combinação atual.
[CI 39053902153](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39053902153)
aprovado no head atual: tipos, 126 testes rápidos e build.
[Prévia atual](https://raposocampos.github.io/radhija-rhaenyra/previews/pr-5/39053902153-1/)
conferida por HTTP e `version.json`, com head/base corretos.
[E2E 39053897305](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39053897305)
aprovado no mesmo head: 299 verificações nas nove partidas, quatro provas da
infraestrutura e 19 verificações do smoke, sem erros de console. Capturas da
fase 4 concluídas, com `errors: []`. Versão aprovada explicitamente no chat e
integrada por squash em `18629a0e3877cc6c56201f5a12b3048feb1514e9`; a árvore
integrada foi comparada com o head aprovado e é idêntica.
[CI do main 39056035625](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39056035625)
aprovado: tipos, 126 testes rápidos e build Vite 6.4.4.
[Deploy 39056064315](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39056064315)
concluído com sucesso. Produção HTTP 200 e `version.json` confirmado com
commit `18629a0` e execução `39056035625`.

### EST-03 Carregamento

- Falha na importação ou montagem de fase produz estado recuperável e uma
  ação clara para o jogador; não deixa o jogo preso em `loading`.
- Cobrir importação rejeitada, falha na montagem e recuperação sem duplicar
  eventos ou recursos. Testar aba antiga após publicação de novos arquivos.
- Verificar a estratégia para arquivos antigos e atualização da página,
  preservando progresso e o fluxo confiável de publicação.

Diagnóstico na base anterior: `loadLevel` em `src/game/game.js` iniciava a
importação antes de esperar 420 ms da cortina e só depois aguardava sua promessa.
Capturar a rejeição desde o início. Separar recuperação antes do descarte da
fase antiga do erro após montagem parcial; não tentar restaurar recursos já
descartados. Ligar a ação de recuperação a `ui.js`, `curtain.js` e ao erro de
`boot()` em `main.js`, incluindo os chamadores assíncronos da seleção de fase.

Cenários implementados no PR #10: rejeição antes dos 420 ms; erro
no primeiro carregamento; exceção em `build`/`createPuzzle`/`reset`/descarte;
falha seguida de repetição de comandos sem duplicar montagem ou `level:loaded`;
aba antiga com chunk ausente recuperada por recarga. O helper
`headlessLevels()` permite falhas controladas para essas regressões. A prova
de aba antiga confirma o 404 específico e novas URLs após recarga, preservando
o save; erros não identificados continuam reprovando o harness.

Branch `codex/recuperacao-carregamento`, worktree `recuperacao-carregamento`.
No head aprovado `019723f`, base `2ee7e07`: CI `39062287562` aprovou 153
testes, tipos e build; E2E `39062283263` aprovou 313 verificações de gameplay,
quatro de infraestrutura, 19 do smoke e 28 de recuperação. Capturas da fase 4
sem erros; capturas de recuperação revisadas visualmente, sem bloqueios.
Prévia `39062324764` publicada e conferida. Integrado após aprovação em
`9be3075`; CI main `39063414327` aprovou 153 testes/tipos/build e deploy
`39063438736` passou. Produção HTTP 200/version.json conferida. Não repetir
integração/publicação de #10; a aprovação não cobre versões futuras.

### EST-04 Progresso

- Validar versão e formato do save, incluindo registros das fases; tratar
  arrays, valores inválidos, JSON corrompido e armazenamento indisponível.
- Manter compatibilidade com saves válidos existentes e preservar progresso
  ao adicionar uma fase. Introduzir migração apenas quando o formato exigir.
- Testar os casos de recuperação e manter isolamento entre prévias e produção.

Implementado no PR #7: `loadProgress`, `saveProgress` e `recordLevelClear` em
`src/ui/progress.js`, com 19 regressões específicas:

- `levels` como array, registro de fase inválido e contadores como strings;
  concluir uma fase deve produzir números válidos, sem concatenar `clears`.
- Tempo negativo ou não finito e contagens inválidas; definir normalização
  preservando os campos válidos do progresso existente.
- Versão desconhecida: definir tratamento sem sobrescrever silenciosamente
  dados que o jogo atual não sabe interpretar.
- JSON corrompido, leitura/escrita de storage indisponível e save válido da
  versão atual, incluindo releitura ao concluir fase e adição de uma fase nova.

Chave e formato v1 mantidos, sem migração necessária. Campos inválidos são
normalizados sem apagar marcas válidas; IDs desconhecidos são preservados,
inclusive propriedades como `__proto__`. Versões declaradas diferentes de 1
ficam intactas no storage; a partida usa uma cópia v1 vazia em memória.
Falha de leitura bloqueia escrita; falha de quota não interrompe a partida.

Branch `codex/progresso-validado`, worktree `progresso-validado`. Head aprovado
`a39a342`, base `d38574a`: CI `39060731088` aprovou 145 testes, tipos e build;
E2E fase1 `39060727463` passou 61 e controle `39060729617` passou 60 verificações,
sem erros de console. Prévia `39060761036` conferida, revisão sem bloqueios.
Após aprovação no chat, integrado por squash em
`2ee7e078d25140a82ccf4ee31aa4d7abcea5ac7c`, com árvores idênticas ao head
aprovado e ao merge sintético. CI main `39061928859` aprovou 145 testes,
tipos e build Vite 6.4.4; deploy `39061964438` concluído após liberação do
deployment `7144556034` com essa aprovação. Produção HTTP 200/version.json
confirmou head/commit `2ee7e07`, run `39061928859`, tentativa 1. Publicado;
não repetir integração/deploy. Nenhum teste/build local.

### EST-05 Recursos gráficos

- Definir recursos pertencentes à fase e recursos compartilhados, com descarte
  de geometrias, materiais e texturas e limpeza das referências temporárias.
- Confirmar que voltar a uma fase mantém os recursos compartilhados válidos.
- Medir alternâncias repetidas entre fases na nuvem e verificar estabilização
  após aquecimento. Registrar contagens e condições; caches legítimos não
  precisam chegar a zero. Conferir a prévia visualmente.

Branch `codex/recursos-graficos`, worktree `recursos-graficos`, base `9be3075`.
Implementação: escopo por fase, caches por identidade, extras declarados,
descarte de cheiro e debug, limpeza após falhas e onze testes com Three real.
Regras para novas fases em `ARQUITETURA.md` §3.1. Instrumento separado em
`codex/medicao-recursos` será combinado no mesmo PR: duas passagens de
aquecimento e três medidas comparáveis por fase, render completo com
Chromium/SwiftShader e DPR 1. Medir geometrias/texturas/programas e raízes;
não interpretar como MB, VRAM ou FPS. Testes de ownership complementam a
observação limitada de geometrias/materiais globais do navegador.
Prova negativa na base sem correção e validação do head final ainda pendentes
neste checkpoint. Nenhum teste/build local; sem aprovação para produção.

### EST-06 Contratos

- Tipar a ligação entre definição, cenário e puzzle, reduzindo o uso de `any`
  nos pontos de integração e descrevendo os eventos relevantes.
- Validar contratos de objetos reais e impedir que dublês aceitem qualquer
  método silenciosamente. Cobrir incompatibilidades concretas.
- Manter tipos, testes rápidos e E2E aprovados sem uma reescrita geral do jogo.

### EST-07 Núcleo

- Extrair configurações comuns das personagens da fase 1 e explicitar o que
  permanece global ou varia por fase.
- Separar responsabilidades do núcleo em PRs pequenos, com comportamento
  preservado e testes das fronteiras alteradas. Evitar misturar refatoração
  com nova mecânica.

### EST-08 Desempenho e expansão

- Definir cenário, qualidade gráfica e ambiente de referência para medir
  carregamento, tempo por quadro e memória; estabelecer limites após medir.
- Documentar o protocolo de nova fase: protótipo, mecânica, ações fora de
  ordem, pausa, reinício, troca de personagem, itens e revisão da prévia.
- Manter medições de desempenho separadas do E2E com renderização reduzida.

### EST-09 Botão Jogar no menu

Relato de 2026-10-17: ao apertar para baixo para escolher uma fase no menu
inicial, o botão "Jogar" desaparecia por alguns segundos. A correção foi
autorizada após a primeira etapa e entregue no PR #8.

- Reproduzir na nuvem a navegação para baixo e identificar a causa do sumiço.
- Manter o botão visível ou uma transição intencional e consistente, sem
  prejudicar seleção, foco, teclado ou controle.
- Acrescentar regressão útil à suíte de controle e entregar prévia própria.
  Nenhuma correção desta tarefa foi incluída nos PRs #4, #5 ou #6.

Responsável: coordenador, `codex/menu-jogar-visivel`, worktree
`menu-jogar-visivel`, base `b1b026e`. Escopo: foco em `ui.css`, regressão no
E2E de controle e documentação. Diagnóstico: animação de foco substitui a
entrada do botão; ao perder foco, a entrada pode reiniciar invisível.
Reprodução negativa em `7a05466`, [E2E 39057998118](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39057998118):
56 verificações aprovadas, quatro falhas de opacidade zero, sem falhas nas
46 verificações anteriores. Excluir apenas Jogar do pulso de foco corrige a
substituição da animação. Revisão independente sem bloqueios.

Head aprovado pelo usuário: `8494143bbe918bb804c05bb115ff1e7770aaef7c`.
CI `39058279947`: tipos, 126 testes e build aprovados. E2E controle
`39058279323`: 60 verificações, zero falhas/erros de console; sete cenários
mantiveram opacidade mínima 1. Prévia publicada e versão conferida.
Squash `d38574a54d1203a3f7d71dd26541167d93819db3` tem árvore idêntica ao
head aprovado e merge sintético `196f108`, verificada independentemente.
CI main `39060437829` aprovou tipos, 126 testes e build Vite 6.4.4;
deploy `39060461084` concluiu após liberação do deployment `7144319080`
com a aprovação do chat. Produção HTTP 200 e `version.json` confirmou
head/commit `d38574a`, run `39060437829`, tentativa 1. Não repetir publicação.

### Preparação da próxima fase (proposta)

- Usar `_modelo` e registro em `DEV_LEVELS` para protótipo isolado, com pasta
  e testes próprios. A prévia do PR isola o save; `DEV_LEVELS` sozinho não.
- O usuário autorizou preparar a proposta combinando pulo e superbafo.
  Responsável: agente de planejamento, `codex/proposta-fase6`, worktree
  `proposta-fase6`. Proposta no [PR #9](https://github.com/raposocampos/radhija-rhaenyra/pull/9),
  head `62b9b6c`. Documento e contexto próprios; nenhum código de fase.
  Escolher/aprovar tema e objeto antes de implementar conteúdo.
- Definir puzzle, ações fora de ordem, dicas, reset, colisores e navegação
  sem modificar núcleo, UI, progresso ou helpers reservados à estabilização.
- Integrar ao menu após EST-03/04; adequar recursos e contratos a EST-05/06.
- Ao registrar a fase, atualizar `hasNext` da fase 5 nos testes e incluir
  E2E no runner e nas opções/matriz do workflow. O smoke descobre o catálogo.
- Em EST-08, corrigir o guia de criação de fases: orientar testes na nuvem
  e documentar a atualização do workflow, hoje omitida.

## Evidências e retomada

Cada entrega deve identificar ID da tarefa, branch, SHA da base e do head, PR,
execuções de CI/E2E, URL da prévia e roteiro de teste. O PR concentra os links
atualizados; o contexto registra decisões e o próximo passo.

Antes de interromper ou trocar de agente, registrar no contexto da branch:
arquivos alterados, mudanças sem commit, execuções em andamento, limitações e
próxima ação. O coordenador reconcilia esses registros sem apagar trabalho de
outras frentes. Dados privados, tokens e caminhos pessoais ficam fora dos
documentos públicos.

Ao retomar, ler `AGENTS.md`, `docs/CONTEXTO.md` e este plano; conferir o Git e
o GitHub. Não repetir descobertas já documentadas nem considerar uma execução
antiga como aprovação de um novo commit.
