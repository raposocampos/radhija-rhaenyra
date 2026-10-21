// Plano da execução do workflow do trailer: o que gravar e montar. No disparo manual, vem dos campos do formulário;
// num envio para um branch claude/trailer-*, de video/ciclo.json. Escreve linhas chave=valor para o GITHUB_OUTPUT.
import { readFileSync } from 'node:fs';
import { GROUPS } from './capture/shots.mjs';

const manual = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
const cfg = manual
  ? { etapa: process.env.IN_ETAPA, cenas: process.env.IN_CENAS, clipes_de: process.env.IN_CLIPES }
  : JSON.parse(readFileSync(new URL('./ciclo.json', import.meta.url), 'utf8'));
const etapa = ['tudo', 'cenas', 'montagem'].includes(cfg.etapa) ? cfg.etapa : 'tudo';
const wanted = String(cfg.cenas || 'todas').split(',').map((s) => s.trim()).filter(Boolean);
const grupos = wanted.includes('todas') ? Object.keys(GROUPS) : wanted;
const clipes = String(cfg.clipes_de || '').split(/[\s,]+/).filter((s) => /^\d+$/.test(s)).join(' ');
console.error(`etapa=${etapa} grupos=${grupos.join(',')} clipes_de=${clipes || '-'}`);
console.log(`etapa=${etapa}`);
console.log(`grupos=${JSON.stringify(grupos)}`);
console.log(`clipes_de=${clipes}`);
