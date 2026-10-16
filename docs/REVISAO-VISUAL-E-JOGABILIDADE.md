# Radhija & Rhaenyra — revisão visual e de jogabilidade para análise independente

Data da avaliação inicial: 16 de outubro de 2026.

## Orientação ao agente que receber este arquivo

**Analise criticamente o que está sendo apresentado aqui. Este documento reúne observações de uma avaliação anterior, interpretações e sugestões; não é uma verdade absoluta, uma especificação aprovada ou uma lista de alterações obrigatórias.**

Sua tarefa inicial é examinar o jogo, as evidências disponíveis e o código atual para formar sua própria avaliação. Você pode confirmar, refutar, reformular ou considerar inconclusivo qualquer ponto. Não implemente mudanças automaticamente apenas porque elas aparecem neste documento.

Em especial:

- Reproduza os comportamentos antes de classificá-los como defeitos.
- Diferencie uma falha funcional de uma preferência estética, uma hipótese de usabilidade ou uma escolha intencional de design.
- Considere o público, a proposta aconchegante do jogo e a intenção do autor. Uma instrução muito explícita pode ser adequada para o público pretendido.
- Verifique se as capturas representam situações persistentes ou apenas um instante de animação, transição ou movimento de câmera.
- Questione também as soluções sugeridas. Confirme primeiro o problema; depois avalie alternativas e seus custos.
- Não atribua causas de desempenho a sombras, vegetação ou efeitos sem medições que sustentem essa relação.
- Preserve o trabalho local existente e as características que já funcionam bem.

As prioridades abaixo são propostas iniciais e podem mudar após sua análise. Se as evidências não sustentarem uma recomendação, explique isso e descarte-a ou reformule-a.

## Contexto do projeto

Jogo 3D para navegador feito em JavaScript, Three.js e Vite. Um jogador alterna entre duas cachorrinhas com habilidades complementares: Radhija atravessa espaços estreitos, dá arrancadas e usa o superbafo; Rhaenyra empurra objetos e pula. A personagem não controlada acompanha a outra ou espera quando recebe o comando “Fica”.

Existem cinco fases, com cenários e puzzles próprios. Os modelos, cenários e efeitos são construídos em código. A estrutura do projeto está descrita em [ARQUITETURA.md](ARQUITETURA.md).

## O que foi efetivamente examinado

- Execução local em Chrome headless, com Playwright e ferramentas já existentes no projeto.
- Inspeção de capturas das cinco fases em 1280×720.
- Uma checagem da interface da fase 4 em 800×600; isso não representa uma auditoria completa de responsividade.
- Conclusão da fase 1 por roteiro automatizado com teclas reais, cobrindo passagem estreita, portão, troca de personagem, carrinho e entrega.
- Avanço na fase 2 até a formação da ponte, incluindo placa de pressão, Fica/Vem, calço, irrigador, registro e caixote. A conclusão dessa fase não foi verificada nesta sessão.
- Movimentação básica e troca de personagem em outras fases.
- Teste direcionado do superbafo na fase 4: a Radhija foi posicionada por ferramenta de depuração perto do pombo; o comando de teclado afastou o pombo e liberou a passagem. Isso não equivale a percorrer a fase inteira sem assistência.
- Leitura de trechos do código para contextualizar observações da interface.

Não houve uma sessão de teste com uma pessoa descobrindo os puzzles pela primeira vez. Roteiros automatizados conhecem o caminho e não demonstram, por si só, que a orientação do jogo é suficiente. Áudio, controle físico e experiência móvel não foram avaliados.

## Qualidades percebidas a preservar

Estas também são avaliações, não critérios absolutos:

- Identidade visual coerente entre tipografia arredondada, cores, menus e objetos.
- Ambientes reconhecíveis e variados, com destaque para a atmosfera do jardim noturno e o interior da casa.
- Diferenças entre as personagens com função concreta nos puzzles.
- Tutorial contextual da placa de pressão e do comando Fica na fase 2.
- Menus de pausa e vitória com boa organização visual.
- No teste isolado de movimento, a Radhija atingiu a velocidade prevista de 2,4 m/s e praticamente parou após soltar a tecla.

## Pontos para investigar

### 1. Visibilidade de passagens e alvos importantes

**Prioridade sugerida:** alta, se a dificuldade de leitura for confirmada em movimento.

**Observação:** a abertura da cerca na fase 1 parece discreta no enquadramento capturado. Na fase 4, as flores da jardineira encobrem parte da região do pombo e da indicação de mira.

**Hipótese:** o jogador pode gastar esforço procurando um alvo oculto pela câmera ou pela decoração, em vez de compreender e resolver o desafio.

**Como verificar:** aproximar-se por trajetórias diferentes, observar a passagem e a mira em movimento e verificar se as dicas e os enquadramentos existentes já resolvem a dúvida. Idealmente, observar uma pessoa que ainda não conhece a solução.

**Possíveis melhorias, caso necessárias:** reforçar contraste ou composição da passagem; usar marcas ambientais discretas; reposicionar plantas; ajustar o enquadramento; ampliar a transparência de objetos que encobrem o alvo da interação. Evitar adotar contornos e marcadores em todo o cenário sem necessidade.

Evidências: [abertura da cerca](../shots/game/11-diante-da-abertura.png), [mira do superbafo](../shots/review-20261016/level4-aim.png), [passagem após o sopro](../shots/review-20261016/level4-after-blow.png).

### 2. Competição visual do cenário e leitura do percurso

**Prioridade sugerida:** alta para legibilidade; a alteração estética deve ser conservadora.

**Observação:** o piso estampado da fase 2 ocupa uma grande área com bastante contraste e repetição. Na fase 3, as lâmpadas são muito luminosas em relação a algumas áreas do chão.

**Hipótese:** a decoração pode disputar atenção com personagens, objetos pequenos e caminhos.

**Como verificar:** comparar o jogo em movimento e em diferentes tamanhos de janela; observar se o jogador encontra objetos e distingue as áreas transitáveis sem dificuldade. Uma captura isolada não basta para afirmar que a fase está escura demais.

**Possíveis melhorias:** suavizar contraste ou escala da estampa; iluminar discretamente trechos do percurso; reduzir o brilho difuso das lâmpadas. Preservar o clima noturno e a identidade dos materiais.

Evidências: [fase 2](../shots/review-20261016/level-2-start.png), [fase 3](../shots/review-20261016/level-3-start.png).

### 3. Estado da companheira no painel

**Prioridade sugerida:** alta, se a mensagem induzir interpretação incorreta.

**Observação:** na fase 1, a Rhaenyra esperou sentada do outro lado de um portão fechado enquanto o painel mostrava “seguindo”. O roteiro confirmou que ela estava esperando por falta de caminho.

**Interpretação possível:** “seguindo” representa a ordem vigente, não a ação instantânea. Isso pode ser intencional, mas também pode parecer uma falha da companheira para quem está aprendendo.

**Como verificar:** reproduzir espera por portão fechado, espera pelo comando Fica e retomada do acompanhamento. Conferir se a interface diferencia suficientemente essas situações.

**Possíveis melhorias:** apresentar “sem passagem” ou “aguardando caminho” quando houver bloqueio; manter “esperando” para a ordem Fica; considerar um indicador discreto junto à personagem. Não alterar a navegação se o problema estiver apenas na comunicação.

Evidência: [companheira esperando no portão](../shots/game/13-rhaenyra-esperando-portao.png). Pontos de leitura: `src/ui/hud.js`, `src/game/companion.js` e os eventos do jogo.

### 4. Equilíbrio entre orientação e descoberta

**Prioridade sugerida:** média; depende da intenção de design e do público.

**Observação:** vários objetivos informam diretamente qual personagem usar e qual ação executar. A fase 2 mostrou uma sequência clara de instruções para trocar de personagem, mandar ficar e atravessar o portão.

**Hipótese:** isso ajuda a acessibilidade, mas pode reduzir a oportunidade de descobrir a solução para alguns jogadores. Não foi feito teste com usuários que confirme essa perda de satisfação.

**Como verificar:** entender a intenção do autor e observar jogadores novos. Avaliar se eles se sentem orientados, excessivamente conduzidos ou ainda confusos.

**Possíveis melhorias:** dicas progressivas ou assistência configurável, passando de objetivo geral para pista e depois ação explícita. Manter a orientação atual pode ser a decisão correta para o público pretendido.

### 5. Consistência das instruções de habilidades

**Prioridade sugerida:** média.

**Observação:** a instrução “segure R e solte” do superbafo aparece como texto corrido, enquanto Q e E recebem representação visual de tecla em outros objetivos. Na captura em 800×600, o objetivo ocupa mais da metade da largura da janela, sem sobreposição aparente dos painéis superiores.

**Como verificar:** conferir o formatador de textos em `src/ui/markup.js` e testar a alternância efetiva entre teclado e controle. Uma tentativa com controle simulado não ativou o modo de controle na captura; portanto, esta avaliação não confirma como a instrução aparece em uma sessão real de gamepad.

**Possíveis melhorias:** padronizar a representação de R e a substituição pelo botão correspondente; reduzir a extensão da mensagem; testar uma indicação contextual de “mirar” e “soltar” perto da personagem sem obstruir o alvo.

Evidências: [objetivo da fase 4](../shots/review-20261016/level-4-start.png), [janela de 800×600](../shots/review-20261016/small-800x600.png).

### 6. Estabilidade de desempenho

**Prioridade sugerida:** média, condicionada à reprodução em condições representativas.

**Medição:** uma amostra isolada de aproximadamente quatro segundos no terraço, em Chrome headless, registrou cerca de 41 FPS, com percentil 95 dos intervalos entre quadros em aproximadamente 33,3 ms. Outras amostras ocorreram com mais de uma sessão de teste em execução e não devem ser usadas como comparação confiável entre fases.

**Limites:** não houve benchmark em navegador visível, caracterização do hardware ou isolamento completo da carga do computador. Não foi demonstrado que a causa está no código do jogo, nem em um recurso gráfico específico.

**Como verificar:** medir quadros e carregamento em navegador visível, com uma sessão do jogo, resolução e hardware registrados. Separar compilação inicial de shaders de desempenho após aquecimento e repetir percursos representativos.

**Possíveis melhorias, somente após diagnóstico:** opções de qualidade gráfica; ajuste de sombras, vegetação, resolução interna ou pós-processamento conforme o custo efetivamente medido.

Evidência: [registro do teste focado](../shots/review-20261016/focused-log.txt).

## Resultados de testes que exigem cautela

A bateria extensa de regressão no navegador não terminou. Na fase 1, a partida principal chegou à vitória, mas testes adicionais registraram duas falhas nas verificações de aceleração/inversão de movimento e um timeout de carregamento. Havia sessões simultâneas em parte dessa execução.

No teste isolado posterior, a velocidade foi medida enquanto a tecla permanecia pressionada: 2,4 m/s. Após soltar a tecla e esperar cerca de 250 ms, a velocidade observada ficou próxima de zero. Esse resultado não reproduziu a falha de aceleração, mas também não verificou novamente toda a sequência de inversão brusca do teste original.

Portanto:

- Não declarar essas falhas como bugs confirmados da jogabilidade.
- Não afirmar que toda a bateria passou.
- Investigar temporização, condições do teste, carga da máquina e comportamento do jogo antes de atribuir uma causa.
- Não confundir ausência de erro de console com ausência de problemas visuais ou de usabilidade.

## Evidências e arquivos locais

As capturas e os roteiros desta avaliação estão em `shots/review-20261016/`. Capturas da partida automatizada também estão em `shots/game/` e `shots/mecanica/`.

**A pasta `shots/` é ignorada pelo Git.** Se este Markdown for enviado sozinho a outro agente ou computador, as imagens e os registros podem não estar disponíveis. Nesse caso, use as descrições como hipóteses a reproduzir, não como evidências que você já inspecionou. Solicite os arquivos relevantes ou gere novas capturas. Arquivos de roteiros antigos também podem ser sobrescritos por novas execuções.

Para iniciar o jogo, use `npm run dev` e abra o endereço informado pelo Vite. Se já houver um servidor do projeto na porta 5173, reutilize-o. Os parâmetros documentados `?level=N&play` permitem inspecionar uma fase diretamente, mas pulam parte da experiência normal de entrada e progressão.

## Entrega esperada da análise independente

Apresente sua própria conclusão e, para cada ponto relevante, registre:

1. **Veredito:** confirmado, parcialmente confirmado, não reproduzido, discordância de design ou inconclusivo.
2. **Evidência:** comportamento observado, captura, medição ou trecho de código que sustenta a conclusão.
3. **Impacto:** quem pode ser afetado e em qual situação.
4. **Recomendação:** manter como está, investigar mais ou propor uma alteração específica, com seus possíveis efeitos negativos.
5. **Prioridade revisada:** justificada pela sua análise, sem herdar automaticamente a prioridade deste documento.

Conclua indicando o que vale preservar e quais poucas mudanças teriam maior benefício. Se uma sugestão anterior estiver errada ou não compensar, diga isso explicitamente. **O objetivo é uma avaliação fundamentada do jogo, não validar a avaliação anterior por concordância.**
