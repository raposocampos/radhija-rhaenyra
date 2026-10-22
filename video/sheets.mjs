// Folhas de contato das cenas gravadas (2 quadros por segundo, 6 × 4 por folha) para revisar sem assistir aos vídeos.
//   node video/sheets.mjs <pasta dos mp4> <pasta de saída>
// Os quadros saem um a um e a última folha é completada repetindo o último quadro (o filtro tile do ffmpeg só
// entrega folhas cheias).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const [src, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
if (existsSync(src)) {
  for (const f of readdirSync(src).filter((n) => n.endsWith('.mp4'))) {
    const name = f.replace(/\.mp4$/, '');
    const vertical = name.endsWith('-v');
    const [cols, rows] = vertical ? [8, 2] : [6, 4];
    const tmp = join(out, `.tmp-${name}`);
    try {
      mkdirSync(tmp, { recursive: true });
      ff(['-i', join(src, f), '-vf', `fps=2,scale=${vertical ? 216 : 384}:-2`, '-q:v', '4', join(tmp, '%04d.jpg')]);
      const frames = readdirSync(tmp).filter((x) => x.endsWith('.jpg')).sort();
      if (!frames.length) continue;
      const per = cols * rows;
      for (let i = frames.length; i % per; i++) copyFileSync(join(tmp, frames[frames.length - 1]), join(tmp, `${String(i + 1).padStart(4, '0')}.jpg`));
      ff(['-framerate', '2', '-i', join(tmp, '%04d.jpg'), '-vf', `tile=${cols}x${rows}`, '-q:v', '4', join(out, `${name}-%02d.jpg`)]);
    } catch (e) {
      console.error(`folha de ${f}: ${e.message}`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
}
