// Monta o cenário DE VERDADE de uma fase no Node (sem navegador nem GPU), para testes que olham a cena:
// as texturas em canvas viram dublês (installBrowserStubs), o resto é Three.js normal.
//   const { root, built } = await buildLevelWorld(def);
import * as THREE from 'three';
import { installBrowserStubs } from './headless.mjs';
import { createResourceScope } from '../../src/core/resources.js';

/** Motor mínimo: o que os construtores de cenário usam (cena, câmera, renderer para tamanho, userData). */
function stubEngine() {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 400),
    renderer: { getDrawingBufferSize: (v) => v.set(1280, 720), capabilities: { getMaxAnisotropy: () => 4 } },
    sun: new THREE.DirectionalLight(),
    userData: {},
    applyLighting() {},
  };
}

/**
 * @template {import('../../src/types').LevelProps} P
 * @param {import('../../src/types').LevelDef<P>} def
 */
export async function buildLevelWorld(def) {
  installBrowserStubs();
  // aceita tanto build direto quanto carregamento sob demanda (def.load → { build })
  const build = def.build ?? (await def.load?.())?.build;
  if (typeof build !== 'function') throw new Error(`${def.id}: sem build`);
  const root = new THREE.Group();
  root.name = `fase:${def.id}`;
  const resources = createResourceScope(root);
  const engine = stubEngine();
  engine.scene.add(root);
  try {
    const built = build({ engine, root, layout: def.layout, params: new URLSearchParams() });
    // estado inicial dos props, como no jogo
    built.props.reset?.();
    built.update?.(0, 0);
    root.updateMatrixWorld(true);
    return {
      root, built,
      dispose() { try { built.dispose?.(); } finally { resources.dispose(); } },
    };
  } catch (error) {
    resources.dispose();
    throw error;
  }
}
