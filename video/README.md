# Trailer da demo

Vídeo de apresentação de **Radhija & Rhaenyra**, feito em código: cenas reais do jogo gravadas quadro a quadro,
motion graphics desenhados em Canvas e trilha original sintetizada. Tudo roda no GitHub Actions (workflow
**Trailer da demo**, `.github/workflows/trailer.yml`), nunca no PC (AGENTS.md). Nada aqui entra no build, nos testes
ou nas dependências do jogo.

## Como funciona

1. **Cenas** (`capture/`): `record.mjs` abre o jogo no Chromium do Playwright, pelo mesmo servidor Vite dos scripts de
   captura, com a qualidade visual completa. O laço do jogo fica congelado e cada quadro avança 1/30 s (dois passos de
   1/60 s), aplica a câmera da cena e é desenhado. As cenas (`shots.mjs`) preparam o momento com os atalhos de
   depuração que os scripts de captura já usam (etapa, posições) e jogam com teclas de verdade. Cada cena vira um MP4
   (`shots/trailer/clips/<cena>.mp4`, e `<cena>-v.mp4` em 9:16) e um JSON com as marcas (o instante do pulo, do sopro…)
   e os **sons que o jogo tocou**, com o tempo de cada um.
2. **Montagem** (`compose/`): a página `index.html` desenha cada quadro com `seek(t)`, sempre o mesmo para o mesmo t
   (vários desenhistas em paralelo). `timeline-16x9.js` e `timeline-9x16.js` são as edições: trechos das cenas
   (com o ponto de entrada alinhado a uma marca), transições (patinha, círculo, deslize, chicote, zoom) e grafismos
   (`compose.js`: legendas, logo, cartões das irmãs, selos das habilidades, selos das fases, mosaico das 10 fases e
   cartão final). Fontes Fredoka e Nunito (OFL), as mesmas do jogo.
3. **Trilha** (`compose/music.js`, `compose/soundtrack.js`): música original em ré maior a 120 BPM (um tempo = 0,5 s =
   15 quadros, para os cortes caírem na batida), sintetizada em WebAudio offline: corda dedilhada (Karplus-Strong),
   marimba, glockenspiel, caixinha de música, pad, baixo e bateria. Por cima, os sopros das transições e os sons do
   próprio jogo (`src/fx/audio`, os mesmos do jogo) na hora em que aconteceram. Nenhum áudio de terceiros.
4. **Saída** (`render.mjs`): quadros em JPEG, volume em -14 LUFS (loudnorm em duas passadas), H.264 + AAC, e o
   material de revisão (quadros-chave, folha de contato, forma de onda, espectrograma e `cenas.md`).

## Rodar

No GitHub: Actions → **Trailer da demo** → Run workflow. `etapa`: `tudo` (grava e monta), `cenas` (só grava) ou
`montagem` (só monta, com as cenas de execuções anteriores em `clipes_de`). `cenas` aceita grupos ou cenas de
`capture/shots.mjs` (`todas` = todos os grupos). Nos branches `claude/trailer-*`, um envio que mexe em `video/` roda o
que estiver em `ciclo.json`. Os artefatos `trailer` (MP4 e lista de cenas) e `trailer-revisao` ficam 7 dias.

## Roteiro (16:9, 72 s)

| Tempo | Compassos | Seção |
|---|---|---|
| 0:00–0:08 | 1–4 | Abertura no jardim ("Duas irmãs." / "Dez aventuras."), retratos das duas |
| 0:08–0:12 | 5–6 | Logo |
| 0:12–0:20 | 7–10 | Radhija: superbafo, arrancada, cabe nos vãos pequenos |
| 0:20–0:28 | 11–14 | Rhaenyra: pulo na parede, empurrão em pé, pulo |
| 0:28–0:32 | 15–16 | Lambe-Lambe |
| 0:32–0:34 | 17 | Mosaico "10 fases" |
| 0:34–0:50 | 18–25 | As fases: irrigador, gansa, pombo, ursinho, trem, lavanderia, biblioteca, porquinhos |
| 0:50–0:58 | 26–29 | Juntas: portão, escada, balde |
| 0:58–1:04 | 30–32 | Festa: luzinhas, piñata, bolo |
| 1:04–1:12 | 33–36 | Cartão final: logo, "Demo · 10 fases", link e plataformas |

O corte vertical (9:16, 26 s) usa a mesma música encurtada: gancho (o superbafo faz o trem espirrar), logo, quatro
habilidades, porquinhos e o bolo ("10 fases"), "Juntas!" e o convite.

## Gravação: renderizador

Os runners não têm GPU. A bancada (`etapa: bancada`, `capture/gl-bench.mjs`) mediu 3,5–6 s por quadro em 1080p no
SwiftShader (o padrão dos testes do jogo) e 1–1,8 s no lavapipe (Vulkan do Mesa), com a mesma imagem: a gravação do
trailer usa o lavapipe (`TRAILER_GL=vulkan`, `capture/gl.mjs`). Cada cena roda num job próprio.
