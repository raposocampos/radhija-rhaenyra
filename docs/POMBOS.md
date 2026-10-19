# Referências e revisão dos pombos

Pesquisa e implementação: Codex, 2026-10-17. Redesenho visual: Claude, 2026-10-19
(seção "Pombo mais bonito", abaixo).

## Direção visual

Preservar a escala, a paleta suave e o comportamento da fase 4. O pombo deve
ser reconhecível pela silhueta, mesmo pequeno na câmera alta: peito cheio,
cabeça menor que o corpo, pescoço contínuo, asas fechadas afiladas e cauda
larga com ponta arredondada. O objetivo é uma interpretação fofa, não uma
reprodução fotográfica.

Referências consultadas (fotografias não são copiadas para o jogo):

- [Cornell Lab — Rock Pigeon, identificação e galeria](https://www.allaboutbirds.org/guide/Rock_Pigeon/id):
  proporções, cabeça pequena, pernas curtas, asas largas que terminam em ponta,
  cauda arredondada, duas barras escuras nas asas e plumagem cinza-azulada.
- [Macaulay Library — referência 201329971](https://macaulaylibrary.org/asset/201329971):
  fotografia de J. del Hoyo/Lynx, inspecionada em detalhe; peito arredondado,
  pescoço verde, cabeça cinza, bico fino com cera clara e asas sobrepostas.
- [Macaulay Library — referência 659425743](https://macaulaylibrary.org/asset/659425743):
  vista alta de pombos no chão; relação entre dorso, asas, cauda e pés rosados.
- [RSPB — Rock Dove/Feral Pigeon](https://www.rspb.org.uk/birds-and-wildlife/rock-dove-feral-pigeon):
  referência complementar da espécie e de sua variedade de plumagens.

Tradução para a modelagem: corpo em gota e pescoço afunilado com normais suaves;
cabeça arredondada, olhos laterais âmbar e bico curto; verde e violeta graduais
no pescoço; duas barras seguindo a superfície das asas; cauda em leque com
penas arredondadas e faixa terminal escura; dedos delicados, incluindo o dedo
traseiro. Sem novas texturas externas, shaders especiais ou dependências.

## Pombo mais bonito (2026-10-19)

Pedido do usuário: "melhorar o visual do modelo do pombo, pode ser mais bonito".
O pombo aparece nas fases 4 e 10. O modelo foi refeito com a mesma API e os
mesmos campos de `setPose`, e ganhou `peck()`, que é opcional.

- **Proporções**: corpo em gota com peito cheio que avança embaixo, dorso
  descendo até a cauda, pescoço grosso e curto inclinado para a frente e cabeça
  arredondada com a testa descendo até o bico. Olho e cabeça um pouco maiores
  que no natural, para ficar fofo.
- **Pescoço furta-cor**: o violeta embaixo vira verde em cima (matiz por vértice)
  e o matiz anda conforme a pena vira de lado para a câmera, no shader (`onBeforeCompile`
  do material único, chave de programa fixa `pigeon-plumage-1`). A região fica
  mais lisa e levemente metálica; o alto do peito continua o violeta.
- **Cabeça**: bico escuro e fino, a ponta descendo de leve, com a **carúncula**
  branca em dois gominhos; **olhos** com pele clara em volta, íris laranja que
  brilha (emissão por vértice), pupila e dois reflexos.
- **Asas**: coberteiras em folha curvada (abraça o corpo dobrada e arqueia
  aberta) com as **duas barras escuras**, quatro secundárias e cinco primárias
  em degrau com pontas escuras. Cada pena tem três formas (dobrada, batida de
  força e recuperação) como alvos de morph; todas são rotações próprias, então
  a interpolação não vira a pena do avesso.
- **Cauda**: dez penas em leque com a **faixa escura na ponta**, coberteiras
  claras em cima e escuras embaixo; o leque abre (morph) no voo, na frenagem,
  no pouso e no susto.
- **Pés rosados**: pernas curtas com "calças" de pena saindo da barriga, três
  dedos para a frente, um para trás e unhas escuras.

Poses: acordado, olha em volta com giros rápidos de cabeça e pisca; no
cochilo encolhe o pescoço, afofa as penas, tomba a cabeça para um lado e
encosta a barriga no apoio; com o latido, `peek()` abre **um olho só**;
`peck()` dá um susto (penas afofadas, olhos arregalados), duas estocadas do
pescoço e asas batendo no lugar, com os pés no apoio, e volta a cochilar se
`asleep` continuar. No voo a cabeça fica estável e os pés recolhem para trás;
na frenagem descem e avançam para o contato.

Custo: **7 malhas e 1 material por pombo** (antes 13 malhas e 9 materiais),
cerca de 7 mil triângulos (antes 4.740; limite do teste: 8 mil, e do script de
captura, o dobro do main). Cor, brilho e furta-cor ficam em atributos de vértice
(`color` e `pigeonFx`). Olhos fechados (um alvo por olho), asas e leque são
alvos de morph; nada é recriado no update. As partes estáticas de cada malha são
unidas por `Parts` (uma geometria por parte móvel). Não houve medição de FPS
em aparelho real.

Na fase 10 (PR #33), `treehouse.js` simula a bicada com `flying` ligado
por meio segundo (o pombo paira com os pés recolhidos). Com este modelo,
`pigeonModel.peck()` faz a bicada sem sair do apoio; a troca fica com a sessão
da fase 10.

## Escopo e custo

`src/world/pigeon.js` continua sendo a única fábrica dos quatro pombos de
`src/levels/fase4/world/props.js`: passagem, portão e dois no pombal. API,
posições, escalas, sementes e tons de cada instância são preservados. Sono,
espiada, balanço da cabeça e sprites de sono continuam disponíveis.
Não há alterações de colisão, regras, controles ou progressão.

### Revisão do voo após o feedback do usuário

O visual em repouso de `7427dda` foi bem recebido; o usuário pediu melhorar
as animações, sobretudo o voo. A animação anterior girava asas ainda fechadas,
ocultava os pés e mudava a inclinação/direção instantaneamente.

Agora as mesmas malhas têm duas formas de voo interpoladas na GPU: asa aberta
na batida de força e punho flexionado na recuperação. A descida dura 42% do
ciclo, a recuperação 58%; são escolhas de estilização para leitura no jogo,
não medições biológicas. A decolagem recebe mais energia e a transição para
repouso recolhe as asas gradualmente. Corpo, cabeça, cauda e pés acompanham o
ciclo; direção usa a volta mais curta e interpolação, inclusive no pouso.
O puzzle informa `flightProgress` para antecipar a frenagem e estender os pés.
Na correção seguinte, o segundo voo ganha 0,3 s de antecipação para a câmera
chegar ao pombo antes da decolagem. O pouso acompanha a altura da placa móvel;
eventos, colisões e gatilhos permanecem iguais.

### Correção das pernas e leitura do mecanismo

O feedback sobre `a9b0906` mostrou que os pés estavam em outro grupo e se
separavam do corpo ao inclinar/frear. As pernas agora pertencem ao corpo e
giram em quadris dentro do tronco; no chão, a altura do corpo é resolvida pelo
apoio, com flexão no impacto e no sono. Um teste geométrico verifica as duas
raízes dentro da malha em cada quadro de voo, curva, frenagem e pouso.

O plano da câmera usa alvo 3D atualizado durante o voo e depois revela a
placa e o portão juntos, sem reiniciar o foco no pouso. A placa tem base
contrastante, molas, compressão visível e uma ligação dourada até a trava.
Um pulso percorre essa ligação ao ativar; a dica explica a relação causal.

Referência de movimento: [Berg e Biewener, 2010 — Wing and body kinematics of
takeoff and landing flight in the pigeon](https://journals.biologists.com/jeb/article/213/10/1651/9685/Wing-and-body-kinematics-of-takeoff-and-landing).
O estudo distingue decolagem, voo intermediário e pouso, com maior esforço
inicial e mudança da orientação de corpo/cauda na chegada. A implementação é
uma interpretação estilizada, não uma simulação aerodinâmica.

Barras pintadas nos vértices substituem peças sobrepostas. Penas da cauda e
partes dos pés são unidas por material para conter draw calls. A geometria é
criada uma vez por pombo; o update não reconstrói malhas. O relatório de revisão
mede meshes, triângulos e chamadas de desenho antes/depois. Contagens não são
uma medição de FPS em aparelhos reais.

Na revisão de `85d91bd` (E2E `39005533740`), cada pombo passou de 25 para
13 meshes e de 3.020 para 4.740 triângulos. Na cena isolada em três quartos,
as chamadas de desenho passaram de 29 para 17 (incluindo chão e sprites).
O aumento de triângulos compra curvatura, enquanto a união das peças reduz
o custo de submissão. Não foi medido FPS em hardware do usuário.

## Como validar na nuvem

Executar **E2E manual**, suíte `fase4`, no branch do PR. Além da partida normal,
o workflow gera o artefato `capturas-fase4`, pasta `pombos/`:

- `01-silhuetas.png`: antes/depois em três quartos, perfil, frente, vista alta
  e a cabeça de perto (olho, bico e carúncula).
- `02-animacoes.png`: sono, espiada, bicada, dois extremos da batida de asas
  e frenagem do pouso.
- `03-fase4.png` e `04-cochilo-no-cenario.png`: fase real e detalhe no cenário,
  com resolução normal, sombras e pós-processamento do jogo.
- `05-pombo-do-portao.png` e `06-pombal.png`: demais instâncias, tons e escalas.
- `metrics.json`: SHAs da base e do head, contagens e erros do navegador.
- `07-voo-antes-depois.mp4` e `08-sequencia-voo.png`: decolagem, batidas,
  pouso, bicada e cochilo em tempo simulado fixo (6 s), pombo do main à esquerda
  e o novo à direita. O vídeo é codificado com FFmpeg apenas no runner.
- `09-camera-mecanismo.mp4` e `10-sequencia-mecanismo.png`: segundo voo,
  placa e abertura do portão com a câmera real do jogo; enquadramento validado
  pela projeção do pombo, placa e portão, eventos registrados em `metrics.json`.
- `11-mecanismo-vertical.png`: enquadramento após o pouso em tela vertical.

O script compara o head com o ancestral comum de `origin/main`, usando os
mesmos tempos, semente, câmera e luz. Requer histórico completo no checkout.
A página de estudo em `tools/` não é uma entrada do build publicado. O modelo
antigo é criado temporariamente no runner e removido no encerramento.

No teste humano da prévia: abrir a fase 4, observar o cochilo, latir para o
pombo espiar (um olho só), usar superbafo para fazê-lo voar e conferir o pombo
do portão (voo e pouso na placa) e os dois sobre o pombal (olham em volta e
piscam). A publicação em produção depende da aprovação da
versão apresentada, conforme `AGENTS.md`.
