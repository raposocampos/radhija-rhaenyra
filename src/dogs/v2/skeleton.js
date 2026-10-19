// Esqueleto do modelo novo das cachorrinhas (src/dogs/v2/): 38 ossos. Em relação ao modelo atual (28 ossos):
// coluna em dois gomos de cada lado do meio (spineF/spineB), pescoço em dois (neck/neck1), escápula nas patas da
// frente (scapL/scapR), pulso separado da pata (FLc/FRc = carpo; FLp/FRp = pata), orelhas em três gomos e rabo em
// cinco. Os nomes que já existiam continuam valendo (testes, pegadas do feedback e capturas procuram por eles).
import * as THREE from 'three';

/** [nome, pai] na ordem em que a cinemática percorre (pai sempre antes do filho).
 * @type {[string, string | null][]} */
export const BONES_V2 = ([
  ['body', null],
  ['spineB', 'body'], ['hips', 'spineB'],
  ['tail0', 'hips'], ['tail1', 'tail0'], ['tail2', 'tail1'], ['tail3', 'tail2'], ['tail4', 'tail3'],
  ['HLu', 'hips'], ['HLl', 'HLu'], ['HLm', 'HLl'], ['HLp', 'HLm'],
  ['HRu', 'hips'], ['HRl', 'HRu'], ['HRm', 'HRl'], ['HRp', 'HRm'],
  ['spineF', 'body'], ['chest', 'spineF'],
  ['neck', 'chest'], ['neck1', 'neck'], ['head', 'neck1'], ['jaw', 'head'],
  ['earL0', 'head'], ['earL1', 'earL0'], ['earL2', 'earL1'],
  ['earR0', 'head'], ['earR1', 'earR0'], ['earR2', 'earR1'],
  ['scapL', 'chest'], ['FLu', 'scapL'], ['FLl', 'FLu'], ['FLc', 'FLl'], ['FLp', 'FLc'],
  ['scapR', 'chest'], ['FRu', 'scapR'], ['FRl', 'FRu'], ['FRc', 'FRl'], ['FRp', 'FRc'],
]);

export const BONE_NAMES_V2 = BONES_V2.map(([n]) => n);
/** @type {Record<string, number>} */
export const BONE_INDEX_V2 = Object.fromEntries(BONE_NAMES_V2.map((n, i) => [n, i]));
export const PARENT_IDX_V2 = BONES_V2.map(([, p]) => (p ? BONE_INDEX_V2[p] : -1));

/**
 * Cria os ossos (filhos de `parent`) nas posições de repouso do desenho (design.bones) e o Skeleton.
 * @param {{ bones: Record<string, number[]> }} design @param {THREE.Object3D} parent
 */
export function createSkeletonV2(design, parent) {
  const rest = BONE_NAMES_V2.map((n) => new THREE.Vector3(...design.bones[n]));
  const bones = BONE_NAMES_V2.map((n, i) => {
    const b = new THREE.Bone();
    b.name = n;
    const p = PARENT_IDX_V2[i];
    b.position.copy(p < 0 ? rest[i] : rest[i].clone().sub(rest[p]));
    return b;
  });
  bones.forEach((b, i) => (PARENT_IDX_V2[i] < 0 ? parent.add(b) : bones[PARENT_IDX_V2[i]].add(b)));
  parent.updateMatrixWorld(true);
  return { bones, skeleton: new THREE.Skeleton(bones), rest, parentIdx: PARENT_IDX_V2, index: BONE_INDEX_V2 };
}
