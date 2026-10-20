// DIAGNÓSTICO TEMPORÁRIO (sai antes do PR): travessia do irrigador com a cabeça dele tendo colisor.
import { test } from 'node:test';
import layout from '../src/levels/fase2/layout.js';
import { BASE, crossing } from '../tools/scripts/sim-sprinkler.mjs';

test('diag irrigador', () => {
  const head = layout.STATIC_COLLIDERS.find((c) => c.id === 'irrigador');
  const per = (2 * Math.PI) / BASE.jets;
  const N = 90;
  const lines = [];
  for (const r of [0.06, 0.08, 0.1]) {
    head.r = r;
    for (let off = -0.8; off <= 0.61; off += 0.05) {
      const row = [];
      for (const [name, mode] of [['radhija', 'dash'], ['radhija', 'walk'], ['rhaenyra', 'walk']]) {
        let ok = 0, valid = 0;
        const good = [];
        for (let i = 0; i < N; i++) {
          const ph = (i / N) * per;
          const res = crossing(BASE, name, mode, ph, off);
          if (res === null) continue;
          valid++;
          if (res) { ok++; if (name === 'radhija' && mode === 'dash') good.push(ph.toFixed(2)); }
        }
        row.push(`${name}/${mode} ${ok}/${valid}${good.length ? ` [${good.join(' ')}]` : ''}`);
      }
      lines.push(`r ${r} off ${off.toFixed(2)}: ${row.join(' | ')}`);
    }
  }
  head.r = 0.12;
  console.log(`#### DIAG IRRIGADOR\n${lines.join('\n')}\n#### FIM DIAG`);
});
