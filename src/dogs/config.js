// Atributos comuns das personagens. As posições iniciais pertencem aos layouts.
// Os controladores mantêm estes atributos ao trocar de fase; withStart não cria
// variantes de habilidades por cenário.

/**
 * @typedef {Readonly<Omit<import('../types').DogStats, 'start' | 'visual' | 'body'>> & {
 *   readonly visual: Readonly<import('../types').DogStats['visual']>,
 *   readonly body: Readonly<import('../types').DogBody>
 * }} DogConfig
 */

/** @type {Readonly<Record<import('../types').DogName, DogConfig>>} */
export const DOG_CONFIG = Object.freeze({
  radhija: Object.freeze({
    displayName: 'Radhija',
    size: 'small',
    radius: 0.17, // colisão (círculo no plano XZ)
    // peito e garupa na colisão (o corpo vai de ~0,2 m à frente a ~0,22 m atrás do centro; ver collision.js resolveBody)
    body: Object.freeze({ front: 0.2, back: 0.225, r: 0.08 }),
    walkSpeed: 2.1, // retorno do usuário (2026-10-20): a 2,4 m/s ela andava rápido demais; ainda um tiquinho mais ligeira que a irmã
    dashSpeed: 6.0,
    dashTime: 0.3,
    dashCooldown: 0.8,
    // Superbafo (R / R2): nuvem soprada a ~2,6 m/s que dura ~5 s (ver src/game/mechanics/scent.js).
    bafoSpeed: 2.6,
    bafoLife: 5,
    bafoCooldown: 0.8,
    // Lambe-Lambe (L / L2), como a irmã: lambidinhas mais rápidas, esticando o pescoço até ela (é a menor).
    lickStroke: 0.38,
    lickReach: 1.5,
    accel: 16,
    decel: 20,
    turnSpeed: 13, // rad/s máx. de giro do corpo
    // Guia visual (não é colisão): comprimento focinho→garupa e altura do topo da cabeça
    visual: Object.freeze({ length: 0.6, headTop: 0.48, shoulder: 0.3 }),
  }),
  rhaenyra: Object.freeze({
    displayName: 'Rhaenyra',
    size: 'large',
    radius: 0.22,
    body: Object.freeze({ front: 0.245, back: 0.275, r: 0.09 }),
    walkSpeed: 2.0,
    pushSpeed: 0.85,
    // Pulo (Espaço / ✕): sobe ~0,5 m em 0,42 s e avança ~1,3 m; só passa por cima de colisores jumpable.
    jumpHeight: 0.5,
    jumpTime: 0.42,
    jumpSpeed: 3.0,
    jumpCooldown: 0.15,
    // Impulso na parede (o mesmo Espaço / ✕, de frente para uma parede marcada com patinhas, até wallReach m
    // dela): sobe apoiando as patas, aperta o botão ou puxa a alavanca no alto e volta ao chão em wallJumpTime s,
    // wallBack m afastada da parede (src/game/dogController.js).
    wallJumpTime: 1.05,
    wallReach: 0.8,
    wallBack: 0.32,
    // Lambe-Lambe (L / L2, as duas dogs): pertinho da irmã (até lickReach m), segurar lambe em ritmo, uma
    // lambida a cada lickStroke s. O efeito de cada lambida é decidido pela fase (puzzle.onLick).
    lickStroke: 0.44,
    lickReach: 1.5,
    accel: 12,
    decel: 16,
    turnSpeed: 10,
    visual: Object.freeze({ length: 0.72, headTop: 0.56, shoulder: 0.34 }),
  }),
});

/**
 * Cria a configuração de um layout sem compartilhar objetos mutáveis com
 * outro layout, com a definição comum ou com a posição recebida.
 * @param {import('../types').DogName} name
 * @param {import('../types').DogStats['start']} start
 * @returns {import('../types').DogStats}
 */
export function withStart(name, start) {
  const cfg = DOG_CONFIG[name];
  return { ...cfg, visual: { ...cfg.visual }, body: { ...cfg.body }, start: { ...start } };
}
