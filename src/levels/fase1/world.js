// FASE 1 · Operação Cenoura — cenário (carregado sob demanda pelo `load` de ./index.js).
// O jardim da fase 1 mora em src/world/ (environment.js e props.js).
import { buildEnvironment } from '../../world/environment.js';
import { createProps } from '../../world/props.js';

/**
 * Monta o cenário e os props dentro de `root` (Group descartado ao trocar de fase).
 * @param {import('../../types').LevelBuildArgs} args
 */
export function buildWorld({ engine, root, layout }) {
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
}
