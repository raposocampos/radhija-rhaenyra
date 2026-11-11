# Modo História: visão de design

Situação: **etapa 1 (roteiro) integrada no PR #74. Etapa 2 (fatia jogável) em construção: em 2026-11-01 o usuário
confirmou as seis decisões padrão e escolheu o botão do Faro (V, L3 e o botão do focinho no toque). No mesmo dia,
pediu o Modo História em 3ª pessoa (veja "Câmera em 3ª pessoa").**
- O roteiro completo ("As Aventuras de Radhija & Rhaenyra": enredo, elenco, casos, capítulos e mapa-múndi) está em
  [HISTORIA.md](HISTORIA.md).
- Este documento trata da estrutura, do desempenho, do progresso e das etapas de entrega.
- No menu (Jogar), o cartão "Modo História" ainda mostra o selo "Em breve" e não abre nada (`MODES.story` em
  `src/ui/markup.js`). A fatia da etapa 2 abre só pela entrada das prévias: `?historia` (veja "Etapa 2" abaixo).

## O que o usuário pediu

**Em 2026-10-18:**
- um **mapa-múndi** no estilo de Super Mario World, com áreas;
- áreas que guardam puzzles, colecionáveis, segredos e uma **missão principal** que libera o próximo mapa;
- o Condomínio como primeira área;
- áreas separadas por causa do desempenho.

**Em 2026-10-29, com o roteiro:**
- **O mapa-múndi é próprio e separado do mapa das fases.** Pandorópolis, o mapa livre isométrico, continua sendo o
  mapa das fases. O Modo História tem uma maquete leve com caminhos, como no Mario World, e cada área abre um mapa
  maior, com carregamentos escondidos.
- **O Condomínio é o Recanto das Patinhas** (cap. 1).
- **8 capítulos, com um núcleo de 4** (1, 2, 6 e 8), que conta a história completa sozinho.
- **Falas em HQ (decisão do usuário em 2026-11-10, no lugar de "sem palavras"):** as cenas viram páginas de HQ dentro
  do jogo, no estilo mangá / Scott Pilgrim (quadros, balões com falas curtas em pt-BR, caixas de narração,
  onomatopeias, efeitos), com a voz em sílabas sintetizadas por personagem; no jogo, falas curtas viram legenda. Os
  humanos aparecem só de relance.
- **Árvore de pistas (decisão do usuário em 2026-11-10):** um botão (Tab, Select/View ou o do HUD) abre o quadro de
  dedução no estilo dos jogos do Sherlock Holmes: a pergunta-raiz do capítulo, as perguntas, as pistas ligadas a cada
  uma (desenho + anotação) e as conclusões, escolhidas pelo jogador.
- **Investigação:** Faro, Reconstrução, pistas, mural de pistas e enigmas.
- **Sem ligação de enredo com as 10 fases.** Personagens e peças podem ser reaproveitados.

## Estrutura

### 1. Mapa-múndi

Uma maquete pequena e leve, na direção artística das fases.
- As irmãs andam pela trilha entre os nós, a ativa na frente e a irmã atrás.
- Um caminho só abre quando a missão da área anterior termina. Às vezes também depende do enigma do mapa do Capitão.
- Cada nó mostra o estado da missão, as pistas e os colecionáveis achados.
- O mural de pistas abre a partir do mapa.

### 2. Área

- **Tamanho.** Um mapa aberto do tamanho de **uma a duas fases atuais**, dividido em zonas.
- **Carregamento.** Ela carrega inteira atrás do cartão "Capítulo N" e é descartada ao sair, como as fases hoje.

### 3. Conteúdo de cada área

- **Missão principal:** uma sequência de etapas que termina num acontecimento e abre o caminho seguinte.
- **Pistas:** 1 obrigatória na missão e 2 escondidas, achadas com Faro, enigma ou observação.
- **Puzzles paralelos:** 2 ou 3, com as mecânicas atuais e as novas da história.
- **Colecionáveis:** o colecionável próprio da área e os petiscos de sempre.
- **Segredos:** sem dica, sem aparecer em nenhum menu, contador ou texto do jogo.

## Desempenho (celular incluído)

- **Aparelhos-alvo.** Precisa rodar bem no Infinix Note 30 5G, no iPhone 13 e no Android pequeno, inclusive no perfil
  `minima` (sem pós-processamento e sem sombras), sem mudar o perfil do PC.
- **Mapa-múndi.** Cena pequena, com poucas luzes e sem física. Usa os perfis de `src/core/quality.js`.
- **Áreas.** O orçamento é medido com `tools/scripts/measure-resources.mjs`.
  - O teto de desenho e de triângulos é o da fase 10.
  - Zonas fora de vista não desenham.
  - Objetos repetidos usam instâncias.
  - As sombras ficam limitadas à vizinhança das cachorrinhas.
- **Carregamentos escondidos.** A área inteira monta e compila (`compileAsync`) atrás do cartão, como o PR #60 faz
  nas fases.
  - Nada é montado nem compilado com a câmera andando.
  - Mudanças de luz, maré e chuva acontecem só nas transições.
- **Faro.** Funciona sem pós-processamento: trilhas emissivas e um véu leve à frente da câmera.

## Progresso

- **Save próprio.** O modo tem a chave `rr-story-v1`, separada do save das fases (`rr-progress-v1`), e usa
  `storageKey()` nas prévias.
- **O que se guarda, sempre por id para sobreviver a mudanças de versão:**
  - o capítulo atual;
  - os nós e caminhos abertos;
  - a etapa da missão de cada área;
  - as pistas achadas;
  - os casos fechados, com o carimbo comum ou dourado;
  - os puzzles resolvidos, os colecionáveis e os segredos;
  - as cenas já vistas.
- **Continuar** leva ao mapa-múndi, no nó da última área visitada.
- **O modo sem dicas.** Vale também aqui:
  - esconde o objetivo do HUD, o marcador e os balões de dica;
  - mantém os títulos de capítulo, as cenas e o mural, onde a pergunta aberta continua como pictograma.

## Arquitetura (proposta)

- **Pasta própria, `src/story/`:**
  - o controlador do modo;
  - o mapa-múndi;
  - o save;
  - o kit de cenas: sequenciador com botão de pular (segurar), gestos, balões de ícone, faixas de cinema e íris;
  - a investigação: Faro, Reconstrução e mural;
  - as áreas, por exemplo `areas/recanto/`, com layout, cenário e puzzles.
- **O que se reaproveita:**
  - as mecânicas de `src/game/mechanics/` e o `puzzleKit`;
  - o HUD e a cortina;
  - a câmera de seguimento e o `focusShot` de `src/game/cameraRig.js`;
  - o `walkPath` e o `InputLock.drive`;
  - a colisão e a navegação por layout;
  - o descarte de recursos por escopo;
  - o padrão do mapa das fases (`src/levels/mapa/`, `levelPreload`).
- **O "puzzle de área".** O núcleo hoje trata a fase como uma unidade com uma vitória. A área precisa de vários
  objetivos ao mesmo tempo, de uma missão que atravessa zonas e de salvar no meio. A proposta é um "puzzle de área"
  que compõe puzzles de zona, cada um com o contrato de `Puzzle` atual, e emite eventos `story:*` para o progresso, o
  mural e o HUD.
- **Sistemas novos:**
  - o Faro e a Reconstrução;
  - os NPCs cachorros, Pandora e Amora (`npcDog` sobre `src/dogs/v2/`);
  - as mãos e os pés humanos.
- **No menu,** o "Em breve" do cartão Modo História dá lugar à abertura do mapa-múndi.

## Entregas (um PR cada, com prévia e aprovação)

Cada etapa começa depois de o usuário aprovar a anterior. **A etapa 2 é um portão:** se a fatia jogável não divertir
ou não se entender, a história volta para revisão antes de seguir.

| Etapa | O que entrega |
|---|---|
| 1 | O roteiro ([HISTORIA.md](HISTORIA.md)) e um storyboard visual para aprovação. |
| 2 | **Fatia jogável.** Inclui:<br>• a abertura e o cap. 1 completo;<br>• o Faro em pulso e a Reconstrução da piscina;<br>• a lupa do HUD guardando as pistas;<br>• um mural provisório, aberto no fim do cap. 1, só com o caso 3 e um tutorial curto sem a Pandora (a etapa 4 o troca pelo empréstimo e pelo tutorial dela);<br>• o kit de cenas, só no que essas cenas pedem.<br>É testada nos três aparelhos e mostrada a alguém que não leu o roteiro. |
| 3 | Mapa-múndi, save `rr-story-v1`, mural completo e cartão do menu ativo. Na prévia, `?historia&tudo` libera tudo. |
| 4 | Cap. 2: Pandora e Amora, o latidão e o tutorial completo do mural. |
| 5 | Cap. 6: lanterna, equilíbrio nos raios, roda-gigante e a virada do meio. |
| 6 | Cap. 8, final e créditos, com o cabrestante. No núcleo, a escada usa o empurrão no lugar do quebra-vento, e o caso 2 fecha na porta da torre. Com isso o núcleo fica jogável de ponta a ponta e pode ser publicado. |
| 7 a 10 | Caps. 3, 4, 5 e 7, na ordem que o usuário preferir, cada um cortável. Uma mecânica nova (tirolesa, nado, cavar, quebra-vento) ganha antes um PR de protótipo numa arena. |
| 11 | Polimento de desempenho e créditos com todos os capítulos. |

**Verificação de cada etapa:**
- **Testes unitários:**
  - estado final igual com e sem pular a cena;
  - nenhuma trava de controle sobrando;
  - ninguém atravessando;
  - regras do mural: a ligação errada volta, e o caso só fecha com as pistas necessárias.
- **E2E** do capítulo pelo workflow manual.
- **Capturas** nos 11 tamanhos de tela.
- **Orçamento** com `measure-resources.mjs`.
- **Fluidez:** nenhum quadro longo com a câmera andando, e Faro legível no perfil `minima`.
- **Teste do usuário** nos três aparelhos.

## Câmera em 3ª pessoa (decisão de 2026-11-01)

Depois de ver a prévia da fatia, o usuário mudou o escopo: **o Modo História é um jogo em 3ª pessoa.** Na câmera de
cima, havia pontos do mapa ruins de enxergar.
- **Como funciona:** a câmera fica atrás da cachorrinha ativa e gira livre: analógico direito, arrastar com o mouse ou
  com o dedo na parte livre da tela, rodinha e pinça para aproximar. Ela desvia das paredes (o braço encurta) e não
  passa do forro dentro dos cômodos. Quando a dog anda sem que a jogadora mexa na câmera, ela volta devagar para trás.
- **Lugar apertado (revisão de 2026-11-09):** o usuário reprovou a câmera "empurrada para uma visão de cima" na casa
  pequena. Agora:
  - o mapa ficou 1,7× maior (cômodos de ~6 m), e dentro de casa a câmera chega mais perto (2,1 m) e fica mais baixa;
  - só paredes encurtam o braço. Móveis, árvores e o carro ficam por conta do recorte que deixa ver as dogs;
  - com o braço curto, a câmera sobe só até passar da cabeça da dog e olha para a frente, por cima do ombro dela;
  - do título para o jogo não há mais travelling (ele atravessava paredes).
- **Só no Modo História:** as 10 fases e Pandorópolis continuam com a câmera de cima.
- **Nas cenas:** os planos do diretor assumem a câmera, sempre de DENTRO dos lugares (a casa é inteira). O recorte
  "ver através" fica desligado durante a cena. No fim (assistida ou pulada), a câmera volta suave para trás da dog
  ativa, em 0,6 s, sem trava sobrando.
- **Toque e mouse:** o dedo só gira a câmera na parte livre da tela (o joystick e os botões ficam com o dedo deles).
  O arraste segue o dedo ou o mouse mesmo passando por cima do HUD. Só passar o mouse por cima não gira, e nada pede
  permissão ao navegador (sem trava do ponteiro).
- **Controle:** o analógico direito gira a câmera (nas fases, ele continua olhando em volta). Um clique sem querer
  nele, logo depois de girar, não vale como botão.
- **Distância de desenho:** a câmera corta o que está além de 72 m, depois da névoa (que acaba em 64 m de dia). O
  Faro virou contas de luz um pouco acima do chão, legíveis de lado, sem pós-processamento.
- **Orçamento:** a medição de recursos confere o pior quadro da 3ª pessoa em vários pontos do mapa (atrás da dog
  olhando para os quatro lados, e quase rente ao chão olhando o horizonte) contra o teto da fase 10.
- **No cenário:** a casa ficou inteira (paredes até o forro, vergas nas passagens, telhado), o muro do sul voltou à
  altura e o depósito ganhou laje. As paredes da casa não projetam sombra, para o sol continuar entrando nos cômodos.
  O recorte que deixa ver as dogs através do que as tapa continua valendo.
- **Para depois, sem decisão:** levar o jogo para C++/engine, com build jogável.


**Como abrir.** `?historia` numa prévia de PR ou na versão de desenvolvimento (`src/story/gate.js`). No link principal
não abre nada. `?historia&stage=varal` começa numa etapa da missão (testes e revisão).

**Controles novos.** Faro: V, L3 ou o botão do focinho no toque, com qualquer uma das duas; liga e desliga, e gasta
o fôlego de cada dog (8 s cheio, recarrega desligado; `src/story/faro/faroMode.js`, o medidor em `faroMeter.js`).
Árvore de pistas: Tab, Select ou o botão do HUD; ligar uma pista a uma pergunta é tocar/clicar na pista e depois na
pergunta. Falar com uma testemunha: E, de perto. Examinar uma pista
revelada: E, de perto. Pular cena: segurar E (ou Espaço, Enter), ✕/○ no controle, ou o botão ⏩ na tela de toque. No
quarto, o aviso do Faro também é tocável.

**Onde está cada coisa:**
- `src/story/scene/`: o kit de cenas. O sequenciador de beats (`sequencer.js`) põe o que fica de permanente no commit, e
  por isso pular e assistir dão no mesmo. Também o diretor (câmera, dogs, balões, sons), os balões de ícone num atlas
  só, o pular segurando, o clima (noite e manhã sem recompilar sombreadores) e as mãos e pés humanos.
- `src/story/faro/scentCloud.js`: a nuvem de cheiro. Um rastro de nuvenzinhas (uma malha só, instâncias viradas para
  a câmera) do focinho de quem fareja até a próxima pista, pelo grafo de navegação da área, sem olhar o que está
  fechado.
- `src/story/faro/`: o pulso do Faro, sem pós-processamento (véu na tela e trilhas aditivas), e a Reconstrução com
  silhuetas translúcidas e animação gravada.
- `src/story/clues.js` e `src/story/mural/rules.js`: o catálogo das pistas (com a anotação de cada uma), a lupa e as
  regras do mural.
- `src/story/deduction.js`: o estado da árvore de pistas (perguntas, pistas ligadas, conclusões; `story:board`).
- `src/story/scene/storyteller.js`: as falas (`dir.say`), a página de HQ (`dir.comic`, `panel`, `onomato`, `caption`,
  `fx`) e a lente dos planos (`dir.lens`).
- `src/story/ui/board.js`, `subtitles.js` e `comic.js`: o quadro de dedução, as legendas com voz e a camada de HQ.
- `src/story/ui/`: o HUD da história (faixas, cartela, aviso do Faro, lupa, meias, mural provisório e fim do capítulo).
- `src/story/areas/recanto/`: o Recanto das Patinhas, com layout, iluminação, cenário em zonas (`world/`), as seis cenas
  (`scenes.js`) e a missão (`puzzle.js`).
- No núcleo: a área carrega como fase especial fora da lista (`STORY = −2`, em `src/game/game.js`). Durante uma cena,
  `puzzle.cinematic()` segura a entrada e as dogs, e `puzzle.onFaro` recebe o botão do Faro.
- `src/story/camera/thirdPerson.js`: a câmera em 3ª pessoa. O núcleo escolhe a câmera pelo layout
  (`CAMERA.rig = 'third'`, com `createGame({ cameraRigs })`).

**O capítulo 1 (refeito em 2026-11-09: mais passos, das duas, com investigação).**
- **A abertura**, em 5 beats, filmada dentro do quarto: a noite, os pombos no parapeito, o preto, a manhã sem a
  cenoura, as duas acordando. Termina com a jogadora no quarto.
- **A missão:**
  1. o quarto: farejar e examinar a trilha, o pote e a pena; a cena dos pombos na janela e a cartela;
  2. a casa: a portinha de gato e o pedal da grade (Radhija); o saco de ração e a maçaneta (Rhaenyra);
  3. o quintal: a porta trancada por fora; o galho na frente da passagem do muro (Rhaenyra); a passagem e a argola do
     ferrolho (Radhija);
  4. a piscina: o Faro mostra a Reconstrução;
  5. o varal: o cesto embaixo da cenoura e o empurra-empurra da Rhaenyra no poste (Shift / R1, três empurrões);
  6. a torre: a senha do interfone (4 botões; a Reconstrução mostra dois e o espirro do Soneca esconde o terceiro, que
     vem do depoimento da Dona Gansa); a porta de mola com a irmã segurando; o terraço jogável (`rooftop.js`, fora do
     mapa): encurralar os pombos com uma dog no Fica, o caixote embaixo da escada, o pulo na parede no trinco, a fuga
     e a pista da tampa;
  7. a portaria: o Superbafo pela grelha abre a janela; o latido grosso da Rhaenyra acorda o Sr. Luiz, que dá o
     depoimento (contradito pela grelha: pergunta nova no quadro);
  8. o portãozinho.
- **As testemunhas:** a Dona Gansa (quer o broche que caiu na ilha) e o Bichano, no capô da caminhonete (quer a
  bolinha presa no depósito); cada uma dá um depoimento para a árvore de pistas.
- **Os três puzzles paralelos:**
  - o barquinho até a ilha, com a Dona Gansa distraída por um latido;
  - a lixeira e o toldo até a meia da antena;
  - a corda, o balde e a bola até a meia do depósito.
- **Pistas:** as obrigatórias, as de cena e duas escondidas (a baba e o ralo).
- **Colecionáveis:** três meias e quatro petiscos.
- **O fim:** o mural provisório, só com o caso 3, e a tela de fim do capítulo.

**Verificação.**
- **Testes unitários no CI** (`test/historia-*.test.mjs`):
  - regras do mural e da lupa;
  - mapa da área;
  - cada cena assistida × pulada;
  - travas e "ninguém atravessa nada" quadro a quadro;
  - a missão e os paralelos com os controles de verdade;
  - o cenário (z-fighting e colisores).
- **E2E** na suíte `historia` do workflow manual, com capturas nos 11 tamanhos de tela. Nos de toque, um dedo de
  verdade arrastado na parte livre gira a câmera e, no joystick, não gira. No PC, o arraste do mouse gira e só passar o
  mouse por cima, não. A partida confere cada puzzle com as teclas; os trechos longos entre eles são postos no lugar
  (a caminhada com a IA fica nos testes de unidade).
- **Capturas de revisão** em qualidade cheia (`capture-historia.mjs`).

## Em aberto com o usuário

**Ainda por decidir:**
- a voz "uá-uá" dos humanos;
- a duração de cada capítulo (proposta: 12 a 20 minutos);
- o ângulo de câmera do mapa-múndi (a 3ª pessoa vale dentro das áreas).
