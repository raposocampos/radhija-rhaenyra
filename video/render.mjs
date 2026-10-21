// Monta o trailer a partir das cenas gravadas (shots/trailer/clips): decodifica os quadros, desenha cada quadro na
// página de montagem (video/compose/), renderiza a trilha, ajusta o volume (-14 LUFS) e codifica os MP4.
// Também gera o material de revisão: quadros-chave, folha de contato, forma de onda, espectrograma e a lista de cenas.
// Uso (na raiz do repositório, no GitHub Actions): node video/render.mjs [16x9,9x16]
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import tl16 from './compose/timeline-16x9.js';
import tl9 from './compose/timeline-9x16.js';
import { clipsUsed } from './compose/timeline-util.js';

if (!process.env.CI) throw new Error('A montagem do trailer roda no GitHub Actions, conforme AGENTS.md.');
const ROOT = resolve('.');
const CLIPS = 'shots/trailer/clips';
const FRAMES = 'shots/trailer/frames';
const OUT = 'shots/trailer/final';
const REV = `${OUT}/revisao`;
const FPS = 30;
const WORKERS = Number(process.env.TRAILER_WORKERS || 4);
const formats = (process.argv[2] || '16x9,9x16').split(',');
const TL = { '16x9': tl16, '9x16': tl9 };
mkdirSync(OUT, { recursive: true });
mkdirSync(REV, { recursive: true });

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], ...opts });
const ffmpeg = (args) => sh('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

// ---------------------------------------------------------------- 1. índice e quadros das cenas
const index = {};
for (const f of existsSync(CLIPS) ? readdirSync(CLIPS) : []) {
  if (!f.endsWith('.json') || f.startsWith('relatorio')) continue;
  const id = f.replace(/\.json$/, '');
  const meta = JSON.parse(readFileSync(join(CLIPS, f), 'utf8'));
  if (meta.failed || !meta.frames || !existsSync(join(CLIPS, `${id}.mp4`))) continue;
  index[id] = { frames: meta.frames, fps: meta.fps || FPS, marks: meta.marks || [], sounds: meta.sounds || [], warnings: meta.warnings || [] };
}
const needed = [...new Set(formats.flatMap((k) => clipsUsed(TL[k])))];
const missing = needed.filter((id) => !index[id]);
if (missing.length) console.log(`AVISO: cenas ausentes (o quadro fica escuro no lugar): ${missing.join(', ')}`);
for (const id of needed.filter((k) => index[k])) {
  const dir = join(FRAMES, id);
  mkdirSync(dir, { recursive: true });
  ffmpeg(['-i', join(CLIPS, `${id}.mp4`), '-q:v', '2', join(dir, '%05d.jpg')]);
  const n = readdirSync(dir).filter((x) => x.endsWith('.jpg')).length;
  if (n !== index[id].frames) console.log(`  ${id}: ${n} quadros decodificados (o JSON diz ${index[id].frames})`);
  index[id].frames = n;
}
writeFileSync(join(FRAMES, 'index.json'), JSON.stringify(index));
console.log(`cenas: ${Object.keys(index).length} gravadas, ${needed.length} usadas`);

// ---------------------------------------------------------------- 2. servidor estático (raiz do repositório)
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.css': 'text/css' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const report = { formats: {} };
const tc = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;

async function openPage(fmt) {
  const tl = TL[fmt];
  const page = await browser.newPage({ viewport: { width: tl.width, height: tl.height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  page.setDefaultTimeout(600000);
  await page.goto(`${base}/video/compose/index.html?formato=${fmt}`);
  await page.waitForFunction(() => window.__ready || window.__failed, null, { timeout: 120000 });
  const failed = await page.evaluate(() => window.__failed);
  if (failed) throw new Error(`a página de montagem falhou: ${failed}`);
  return { page, errors };
}

try {
  for (const fmt of formats) {
    const tl = TL[fmt];
    const t0 = Date.now();
    const dir = `${OUT}/quadros-${fmt}`;
    mkdirSync(dir, { recursive: true });
    const main = await openPage(fmt);
    const plan = await main.page.evaluate(() => window.__plan());
    writeFileSync(`${OUT}/plano-${fmt}.json`, JSON.stringify(plan, null, 2));
    console.log(`\n== ${fmt}: ${plan.duration.toFixed(1)} s, fontes: ${plan.fonts.join(', ')}`);

    // trilha
    const audio = await main.page.evaluate(() => window.__audio());
    const wav = `${OUT}/trilha-${fmt}.wav`;
    writeFileSync(wav, Buffer.from(audio.wav, 'base64'));
    console.log(`  trilha: pico ${audio.stats.peakBefore}, ${audio.stats.gameSounds} sons do jogo`);

    // quadros (vários desenhistas)
    const n = Math.round(plan.duration * FPS);
    const pages = [main, ...await Promise.all(Array.from({ length: WORKERS - 1 }, () => openPage(fmt)))];
    let done = 0;
    await Promise.all(pages.map(async ({ page }, w) => {
      for (let f = w; f < n; f += pages.length) {
        const url = await page.evaluate(([t, k]) => window.__seek(t, k), [f / FPS, f]);
        writeFileSync(join(dir, `${String(f + 1).padStart(5, '0')}.jpg`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
        if (++done % 300 === 0) console.log(`  ${done}/${n} quadros`);
      }
    }));
    const pageErrors = pages.flatMap((p) => p.errors);
    for (const p of pages) await p.page.close();

    // volume: duas passadas do loudnorm (-14 LUFS, pico -1 dBTP)
    const m = spawnSync('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
    const meas = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf('{'), m.stderr.lastIndexOf('}') + 1));
    const fadeAt = Math.max(0, plan.duration - 1.2).toFixed(2);
    const af = `loudnorm=I=-14:TP=-1.0:LRA=11:measured_I=${meas.input_i}:measured_TP=${meas.input_tp}:measured_LRA=${meas.input_lra}:measured_thresh=${meas.input_thresh}:offset=${meas.target_offset}:linear=true,aresample=48000,afade=t=out:st=${fadeAt}:d=1.2`;
    const mp4 = `${OUT}/trailer-${fmt}.mp4`;
    ffmpeg(['-framerate', String(FPS), '-i', join(dir, '%05d.jpg'), '-i', wav, '-filter_complex', `[1:a]${af}[a]`, '-map', '0:v', '-map', '[a]',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', plan.duration.toFixed(3), mp4]);
    const loud = spawnSync('ffmpeg', ['-hide_banner', '-i', mp4, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    const summary = loud.slice(loud.lastIndexOf('Summary:')).replace(/\s+/g, ' ').trim();

    // revisão: quadros-chave (entrada e meio de cada trecho; textos já animados), folha, onda e espectrograma
    const marks = new Set();
    for (const s of plan.segs) { marks.add(+(s.start + 0.2).toFixed(2)); marks.add(+((s.start + s.end) / 2).toFixed(2)); }
    for (const o of plan.overlays) if (o.end - o.start > 0.5) marks.add(+(o.start + 0.7).toFixed(2));
    for (const t of [...marks].sort((a, b) => a - b)) {
      const f = Math.min(n - 1, Math.round(t * FPS));
      copyFileSync(join(dir, `${String(f + 1).padStart(5, '0')}.jpg`), `${REV}/${fmt}-${tc(t).replace(':', 'm').replace('.', 's')}.jpg`);
    }
    ffmpeg(['-i', mp4, '-vf', `fps=1,scale=${fmt === '16x9' ? 320 : 180}:-2,tile=${fmt === '16x9' ? '8x10' : '13x2'}`, '-frames:v', '1', '-q:v', '3', `${REV}/${fmt}-folha.jpg`]);
    ffmpeg(['-i', mp4, '-filter_complex', 'showwavespic=s=1800x300:split_channels=1:colors=#F28C38|#4FB3A9', '-frames:v', '1', `${REV}/${fmt}-onda.png`]);
    ffmpeg(['-i', mp4, '-lavfi', 'showspectrumpic=s=1600x500:legend=1:scale=log', `${REV}/${fmt}-espectro.png`]);

    report.formats[fmt] = {
      seconds: plan.duration, frames: n, renderSec: Math.round((Date.now() - t0) / 1000), loudness: summary,
      perSecDb: audio.stats.perSecDb, gameSounds: audio.stats.gameSounds, missing: plan.segs.filter((s) => s.missing).map((s) => s.clip),
      pageErrors: pageErrors.slice(0, 20),
    };
    console.log(`  ${mp4}: ${n} quadros, ${summary}`);
    if (pageErrors.length) console.log(`  avisos da página: ${pageErrors.slice(0, 5).join(' | ')}`);
  }
} finally {
  await browser.close();
  server.close();
}

// ---------------------------------------------------------------- 3. lista de cenas para o usuário
const LABEL = {
  abertura: 'Abertura: as duas na porta de casa, fase 1 (Operação Cenoura)',
  'retrato-radhija': 'Radhija de perto (latidinho)', 'retrato-rhaenyra': 'Rhaenyra de perto (latidinho)',
  superbafo: 'Superbafo da Radhija acorda o pombo (fase 4)', arrancada: 'Arrancada: a Radhija sobe o escorregador e pega o frisbee (fase 7)',
  vao: 'Só a Radhija cabe no túnel de lama (fase 7)', parede: 'Pulo na parede da Rhaenyra: botão da máquina e a mantinha (fase 8)',
  empurrao: 'Empurrão em pé: a Rhaenyra derruba a piñata da mangueira (fase 10)', pulo: 'A Rhaenyra pula o portãozinho (fase 5)',
  lambe: 'Lambe-Lambe: a Rhaenyra limpa a lama da irmã (fase 7)', 'fase2-irrigador': 'Fase 2: o irrigador na área de serviço',
  'fase3-gansa': 'Fase 3: a Dona Gansa guardando a ponte', 'fase4-pombo': 'Fase 4: vento, duto e o pombo que abre o portão',
  'fase6-trem': 'Fase 6: o trem de brinquedo espirra e parte', porcos: 'Fase 10: os porquinhos soltos na horta',
  'coop-portao': 'Juntas: a Radhija puxa a cordinha e abre o portão para a irmã (fase 1)',
  'coop-escada': 'Juntas: a Rhaenyra segura a escada e a Radhija pega os óculos (fase 9)',
  'coop-balde': 'Juntas: a Rhaenyra puxa a corda e o balde leva a Radhija ao deque (fase 10)',
  luzes: 'Fase 10: as luzinhas da festa acendem', pinata: 'Fase 10: a piñata abre', bolo: 'Fase 10: o bolo pronto e a comemoração',
  'final-fundo': 'Cartão final sobre o quintal em festa',
};
const lines = ['# Trailer da demo: lista de cenas', ''];
for (const fmt of formats) {
  const plan = JSON.parse(readFileSync(`${OUT}/plano-${fmt}.json`, 'utf8'));
  lines.push(`## ${fmt === '16x9' ? 'Principal 16:9 (1920×1080)' : 'Vertical 9:16 (1080×1920)'} — ${plan.duration.toFixed(1)} s`, '');
  lines.push('| Início | Fim | Cena |', '|---|---|---|');
  for (const s of plan.segs) {
    const id = s.clip.replace(/-v$/, '');
    const label = LABEL[id] || (id.startsWith('estab-') ? `Fase ${id.slice(6)} com a câmera do jogo` : id);
    lines.push(`| ${tc(s.start)} | ${tc(s.end)} | ${label}${s.missing ? ' (AUSENTE)' : ''} |`);
  }
  lines.push('');
}
writeFileSync(`${OUT}/cenas.md`, `${lines.join('\n')}\n`);
writeFileSync(`${OUT}/relatorio.json`, JSON.stringify(report, null, 2));
console.log('\npronto:', formats.map((f) => `${OUT}/trailer-${f}.mp4`).join(', '));
