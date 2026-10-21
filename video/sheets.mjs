// Folhas de contato das cenas gravadas (2 quadros por segundo, 6 × 4 por folha) para revisar sem assistir aos vídeos.
//   node video/sheets.mjs <pasta dos mp4> <pasta de saída>
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const [src, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
if (existsSync(src)) {
  for (const f of readdirSync(src).filter((n) => n.endsWith('.mp4'))) {
    const name = f.replace(/\.mp4$/, '');
    const vertical = name.endsWith('-v');
    try {
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', `${src}/${f}`,
        '-vf', `fps=2,scale=${vertical ? 216 : 384}:-2,tile=${vertical ? '8x2' : '6x4'}`,
        '-q:v', '4', `${out}/${name}-%02d.jpg`], { stdio: 'inherit' });
    } catch (e) {
      console.error(`folha de ${f}: ${e.message}`);
    }
  }
}
