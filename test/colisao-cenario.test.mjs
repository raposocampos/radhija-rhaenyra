// Objetos do cenário na altura das dogs têm colisor, em TODAS as fases (registradas e de desenvolvimento): nenhuma
// dog pode ficar com o corpo por cima de um vaso, da perna de um móvel ou de uma pilha de coisas. Retorno do usuário
// na prévia do PR #48 (2026-10-20): "muitos objetos dos mapas ainda permanecem sem colisão".
// O cenário é montado DE VERDADE (test/helpers/worldBuild.mjs) e varrido por test/helpers/obstaculos.mjs contra o
// mundo de colisão do jogo na etapa inicial (estáticos do layout e dinâmicos do puzzle).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';
import { buildLevelWorld } from './helpers/worldBuild.mjs';
import { createHeadlessGame } from './helpers/headless.mjs';
import { findLooseObstacles } from './helpers/obstaculos.mjs';

const ALL = [...LEVELS, ...DEV_LEVELS];

// Sem colisor de propósito: nome do desenho (ou de um pai) → motivo. Itens que vão na boca ficam de fora sozinhos
// (userData.carryKind), como as coisas baixas de pisar marcadas com userData.walkable (src/game/ground.js).
const SEM_COLISOR = [
  [/^(grama-baixa|grama-alta|grama-do-morrinho|florzinhas|folhinhas)$/, 'capim, florzinhas e a pele de folhinhas: as dogs passam roçando'],
  [/^osso-/, 'ossinho: as dogs passam por cima para pegar'],
  [/^caminha$/, 'caminha: as dogs sobem nela (chão, como as placas do PR #48)'],
  [/^almofada-do-gato$/, 'almofada do Bichano: fofa e baixinha (12 cm), como as caminhas'],
  [/^(tabua-pressao|pedra-de-pressao-.+|pedal-de-pulo|placa-da-cancela|botao-do-registro|botao-do-chiqueiro)$/, 'placa de pisar: é chão (src/game/ground.js)'],
  [/^cenoura$/, 'item da fase (vai na boca)'],
  [/^bolinha-listrada$/, 'bolinha que rola com a focinhada (src/world/extraProps.js)'],
  [/^fita-do-vento$/, 'fitas do ventilador: tecido leve'],
  [/^corda-da-tabua$/, 'corda fina da tábua até a roldana, rente ao chão (de 4 a 11 cm): a pata passa por cima'],
  [/^(manilha|lama)$/, 'túnel da fase 7: a Radhija passa por dentro (as paredes do corredor são os colisores manilha-norte/sul)'],
  [/^(milharal|rama-de-abobora)$/, 'folhas do milho e a rama das abóboras: o colisor é a fileira e a abóbora; a Radhija passa roçando'],
  [/^(corda-da-roldana|puxador)$/, 'cordas finas e o puxador do portãozinho: as dogs pegam e puxam com a boca'],
  [/^(torneira|cano-da-torneira|mangueira)$/, 'torneira da fase 10 é um botão de parede (impulso): um colisor na frente dela impede o impulso'],
  [/^rampa-do-galpao$/, 'pé da rampa da fase 10: a dog encosta o peito na tábua para subir (o colisor começa 22 cm depois do pé, onde a tábua já tem 17 cm)'],
];
const skipped = (o) => {
  for (let p = o; p; p = p.parent) if (p.name && SEM_COLISOR.some(([re]) => re.test(p.name))) return true;
  return false;
};

const fmt = (f) => {
  const s = f.suggest;
  const sug = s.shape === 'circle' ? `circle x ${s.x} z ${s.z} r ${s.r}` : `box x ${s.x} z ${s.z} hx ${s.hx} hz ${s.hz}`;
  return `\n  • (${f.center.x}, ${f.center.z}) alcançado x[${f.box.minX}, ${f.box.maxX}] z[${f.box.minZ}, ${f.box.maxZ}]`
    + ` · desenho x[${f.foot.minX}, ${f.foot.maxX}] z[${f.foot.minZ}, ${f.foot.maxZ}] · y ${f.y[0]}–${f.y[1]}`
    + ` · entra ${f.depth} m (${f.sizes.join(', ')}) · ${f.points} pts\n    ${f.meshes.join('\n    ')}\n    sugestão: ${sug}`;
};

for (const [idx, def] of ALL.entries()) {
  test(`${def.id}: objetos do cenário na altura das dogs têm colisor`, async () => {
    const h = await createHeadlessGame({ level: idx + 1, levels: ALL });
    const { root, dispose } = await buildLevelWorld(def);
    try {
      const L = def.layout;
      const dogs = ['radhija', 'rhaenyra'].map((name) => ({
        name, size: L.DOGS[name].size, r: L.DOGS[name].radius, yMax: L.DOGS[name].visual.headTop * 0.85,
      }));
      const t0 = performance.now();
      const found = findLooseObstacles(root, h.world, { dogs, skip: skipped });
      const ms = Math.round(performance.now() - t0);
      console.log(`\n#### AUDITORIA ${def.id}: ${found.length} achado(s) em ${ms} ms; colisores ${h.world.statics.length} estáticos, ${h.world.dynamics.length} dinâmicos${found.map(fmt).join('')}\n#### FIM ${def.id}`);
      assert.equal(found.length, 0, `${found.length} desenho(s) na altura das dogs sem colisor`);
    } finally {
      dispose();
    }
  });
}
