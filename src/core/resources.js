// Propriedade dos recursos GPU: caches vivem com a aplicação; o restante vive
// com a fase. Identidade (WeakSet) não é copiada por Material/Texture.clone().
import * as THREE from 'three';

/** @typedef {{ dispose(): void }} Resource */
/** @type {WeakSet<object>} */
const shared = new WeakSet();
/** @type {WeakMap<THREE.Object3D, Set<Resource>>} */
const extras = new WeakMap();

/** Texturas em propriedades de material ou uniforms, incluindo arrays. */
function materialTextures(material) {
  const textures = new Set();
  const visit = (value) => {
    if (value instanceof THREE.Texture) textures.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
  };
  Object.values(material).forEach(visit);
  if (material instanceof THREE.ShaderMaterial) {
    Object.values(material.uniforms).forEach((uniform) => visit(uniform.value));
  }
  return textures;
}

/** Marca um recurso de cache e suas texturas como pertencentes à aplicação.
 * @template {Resource} T @param {T} resource @returns {T}
 */
export function shareResource(resource) {
  shared.add(resource);
  if (resource instanceof THREE.Material) {
    for (const texture of materialTextures(resource)) shared.add(texture);
  }
  return resource;
}

/** Registra recursos fora da árvore (ex.: textura capturada por onBeforeCompile).
 * Chamar ao criá-los, antes que build possa falhar; root já existe nesse ponto.
 * @template {Resource} T @param {THREE.Object3D} root @param {T} resource @returns {T}
 */
export function ownResource(root, resource) {
  if (!extras.has(root)) extras.set(root, new Set());
  extras.get(root).add(resource);
  return resource;
}

/** Escopo idempotente criado antes de build(). Coleta a árvore atual ao sair,
 * incluindo objetos adicionados pelo puzzle, e aceita raízes auxiliares.
 * @param {THREE.Object3D} root
 */
export function createResourceScope(root) {
  let disposed = false;
  return {
    /** @param {...THREE.Object3D} otherRoots */
    dispose(...otherRoots) {
      if (disposed) return;
      disposed = true;
      /** @type {Set<Resource>} */
      const resources = new Set();
      const materials = new Set();
      const roots = [root, ...otherRoots].filter(Boolean);
      const add = (resource) => {
        if (resource instanceof THREE.Material) materials.add(resource);
        else if (resource) resources.add(resource);
      };
      for (const tree of roots) tree.traverse((object) => {
        // Sprite usa uma geometria global interna do Three, inclusive no feedback.
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) add(object.geometry);
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points || object instanceof THREE.Sprite) {
          const list = Array.isArray(object.material) ? object.material : [object.material];
          list.forEach(add);
        }
        // Esses objetos têm buffers próprios além de geometry/material (Three r170).
        if (object instanceof THREE.InstancedMesh) add(object);
        if (object instanceof THREE.SkinnedMesh) add(object.skeleton);
        if (object instanceof THREE.DirectionalLight || object instanceof THREE.PointLight || object instanceof THREE.SpotLight) add(object.shadow);
        extras.get(object)?.forEach(add);
        extras.delete(object);
      });
      // Protege dependências de materiais compartilhados antes de liberar qualquer
      // textura: um material exclusivo pode usar a mesma textura de um cache.
      for (const material of materials) if (shared.has(material)) shareResource(material);
      for (const material of materials) {
        resources.add(material);
        materialTextures(material).forEach((texture) => resources.add(texture));
      }
      const errors = [];
      for (const resource of resources) {
        if (shared.has(resource)) continue;
        try { resource.dispose(); } catch (error) { errors.push(error); }
      }
      for (const tree of roots) { tree.removeFromParent(); tree.clear(); }
      resources.clear();
      materials.clear();
      if (errors.length) throw new AggregateError(errors, 'Falha ao liberar recursos da fase');
    },
  };
}
