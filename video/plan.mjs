// Plano da execução do workflow do trailer: o que gravar e montar. No disparo manual, vem dos campos do formulário;
// num envio para um branch claude/trailer-*, de video/ciclo.json. Escreve linhas chave=valor para o GITHUB_OUTPUT.
import { readFileSync } from 'node:fs';
import { GROUPS, SHOTS } from './capture/shots.mjs';

const manual = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
const cfg = manual
  ? { etapa: process.env.IN_ETAPA, cenas: process.env.IN_CENAS, clipes_de: process.env.IN_CLIPES, gl: process.env.IN_GL }
  : JSON.parse(readFileSync(new URL('./ciclo.json', import.meta.url), 'utf8'));
const etapa = ['tudo', 'cenas', 'montagem', 'bancada'].includes(cfg.etapa) ? cfg.etapa : 'tudo';
// vulkan: o lavapipe do Mesa desenha ~4× mais rápido que o SwiftShader no runner, com a mesma imagem (bancada)
const gl = ['swiftshader', 'gl', 'vulkan'].includes(cfg.gl) ? cfg.gl : 'vulkan';
const wanted = String(cfg.cenas || 'todas').split(',').map((s) => s.trim()).filter(Boolean);
// todas: um job por cena e formato (os planos de cada fase, de dois em dois), para o tempo total ficar curto
const todas = () => {
  const out = [];
  for (const [id, shot] of Object.entries(SHOTS)) {
    if (id.startsWith('estab-')) continue;
    if (shot.vertical) out.push(`${id}@h`, `${id}@v`);
    else out.push(id);
  }
  for (let n = 1; n <= 10; n += 2) out.push(`estab-${n}+estab-${n + 1}`);
  return out;
};
const grupos = wanted.includes('todas') ? todas() : wanted;
const clipes = String(cfg.clipes_de || '').split(/[\s,]+/).filter((s) => /^\d+$/.test(s)).join(' ');
console.error(`etapa=${etapa} grupos=${grupos.join(',')} clipes_de=${clipes || '-'}`);
console.log(`etapa=${etapa}`);
console.log(`grupos=${JSON.stringify(grupos)}`);
console.log(`clipes_de=${clipes}`);
console.log(`gl=${gl}`);
