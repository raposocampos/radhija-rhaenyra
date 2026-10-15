// FASE 1 · Operação Cenoura — definição da fase (formato: docs/CONTRATO.md §4 "Definição de fase").
import layout from './layout.js';
import { createPuzzle } from './puzzle.js';
import { buildEnvironment } from '../../world/environment.js';
import { createProps } from '../../world/props.js';
import { LIGHTING_DEFAULT } from '../../core/engine.js';

export default {
  id: 'fase1',
  number: 1,
  name: 'Operação Cenoura',
  subtitle: 'Fim de tarde no jardim',
  intro: 'A cenoura de brinquedo foi parar do outro lado da cerca. Tragam ela de volta para casa!',
  item: 'carrot', // ícone do item da fase na UI
  ambience: 'day', // som ambiente: 'day' | 'dusk' | 'night'
  texts: {
    celebrate: 'Eba! A cenoura chegou em casa!',
    victoryTitle: 'Operação Cenoura concluída!',
    victorySub: 'Radhija e Rhaenyra trouxeram a cenoura de volta.',
  },
  layout,
  lighting: LIGHTING_DEFAULT,

  /** Monta o cenário e os props dentro de `root` (Group descartado ao trocar de fase). */
  build({ engine, root }) {
    // Os construtores da fase 1 fazem engine.scene.add(...): aponta a "cena" deles para o root.
    const eng = Object.create(engine);
    eng.scene = root;
    const env = buildEnvironment(eng, layout);
    const props = createProps(eng, layout);
    return {
      env,
      props,
      seeThrough: [env.fence?.group, props.gate?.object],
      update(dt, t) {
        env.update(dt, t);
        props.update(dt, t);
      },
    };
  },

  createPuzzle,
};
