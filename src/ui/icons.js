// Ícones SVG inline desenhados para o jogo (sem emojis).
// Sem gradientes com id (evita conflito/quebra de url(#id) entre cópias ocultas).

const INK = '#4A3426';

export function carrotIcon({ leaves = true } = {}) {
  return `<svg class="ico ico-carrot" viewBox="0 0 64 64" aria-hidden="true">
  ${leaves ? `<g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round">
    <path d="M44.5 19.5 C 41 11, 43 4.5, 48.5 2.5 C 51.5 8.5, 50.5 15, 46.5 20.5 Z" fill="#94BC7C"/>
    <path d="M45 20 C 50 12, 56 9.5, 61.5 10.5 C 59 16.5, 53.5 20, 47 21.5 Z" fill="#7FA36B"/>
    <path d="M45.5 21 C 52.5 19.5, 58.5 21.5, 61.5 26 C 55.5 28.5, 50 27, 46 23.5 Z" fill="#6B9158"/>
  </g>` : ''}
  <path d="M47.5 18 C 52.5 22.5, 51.5 29, 46 34 L 15.5 58.5 C 11 62, 4.5 57, 7.8 52.3 L 31.5 22.5 C 36.5 16.5, 43 13.5, 47.5 18 Z"
        fill="#F08A3C" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M44.5 19.5 C 47.5 22, 47 26, 43.5 29.5 L 16 52" fill="none" stroke="#FFC08A" stroke-width="3" stroke-linecap="round" opacity=".75"/>
  <g stroke="#C4581A" stroke-width="2.2" stroke-linecap="round" opacity=".75">
    <path d="M33.5 28.5 l4.5 3.6"/><path d="M26 37.5 l4.8 3.6"/><path d="M19 46.5 l4 3"/>
  </g>
</svg>`;
}

export function boneIcon() {
  const shapes = `<circle cx="15" cy="25.5" r="7.2"/><circle cx="15" cy="38.5" r="7.2"/>
    <circle cx="49" cy="25.5" r="7.2"/><circle cx="49" cy="38.5" r="7.2"/>
    <rect x="14" y="26" width="36" height="12" rx="4"/>`;
  return `<svg class="ico ico-bone" viewBox="0 0 64 64" aria-hidden="true">
  <g transform="rotate(-24 32 32)">
    <g fill="${INK}" stroke="${INK}" stroke-width="5" stroke-linejoin="round">${shapes}</g>
    <g fill="#FFF1D9">${shapes}</g>
    <path d="M18 23.5 a4.5 4.5 0 0 1 4.5 -2.5 M22 30 h22" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".9"/>
    <path d="M17 41 a5 5 0 0 0 6 0.5 M24 36.5 h21" stroke="#E7C9A0" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
}

const DOG_COLORS = {
  radhija: { fur: '#F2D3A0', ear: '#D9A35A', tuft: '#E7B977', muzzle: '#FAE8C8', patch: null },
  rhaenyra: { fur: '#FBF6EC', ear: '#EFE2CB', tuft: '#F3EADB', muzzle: '#FFFDF8', patch: '#E6C89E' },
};

export function dogIcon(kind = 'radhija') {
  const c = DOG_COLORS[kind] || DOG_COLORS.radhija;
  return `<svg class="ico ico-dog" viewBox="0 0 64 64" aria-hidden="true">
  <g stroke="${INK}" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M17 20 C 8.5 21.5, 5 33, 6.5 43 C 7.5 50, 12.5 54, 17 50.5 C 20.5 47, 21.5 37.5, 22 28 Z" fill="${c.ear}"/>
    <path d="M47 20 C 55.5 21.5, 59 33, 57.5 43 C 56.5 50, 51.5 54, 47 50.5 C 43.5 47, 42.5 37.5, 42 28 Z" fill="${c.ear}"/>
    <path d="M14.5 32 C 13.5 22, 19 14.5, 25 13 C 27 9, 37 9, 39 13 C 45 14.5, 50.5 22, 49.5 32 C 49.5 44, 42 51.5, 32 51.5 C 22 51.5, 14.5 44, 14.5 32 Z" fill="${c.fur}"/>
    <ellipse cx="32" cy="40.5" rx="9.8" ry="7.4" fill="${c.muzzle}"/>
  </g>
  <path d="M24.5 14.5 C 27 9.5, 37 9.5, 39.5 14.5 C 36.5 12.8, 34.2 13.4, 32 15.6 C 29.8 13.4, 27.5 12.8, 24.5 14.5 Z" fill="${c.tuft}"/>
  <path d="M8.5 40 c 1 3.5, 3 6, 5.5 7 M55.5 40 c -1 3.5, -3 6, -5.5 7" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".35"/>
  ${c.patch ? `<ellipse cx="23.6" cy="36.4" rx="2.3" ry="3.3" fill="${c.patch}"/><ellipse cx="40.4" cy="36.4" rx="2.3" ry="3.3" fill="${c.patch}"/>` : ''}
  <ellipse cx="19.8" cy="39.5" rx="3" ry="1.8" fill="#F4A08A" opacity=".5"/>
  <ellipse cx="44.2" cy="39.5" rx="3" ry="1.8" fill="#F4A08A" opacity=".5"/>
  <circle cx="24.6" cy="31" r="3.5" fill="#2A1C14"/><circle cx="39.4" cy="31" r="3.5" fill="#2A1C14"/>
  <circle cx="25.8" cy="29.7" r="1.2" fill="#fff"/><circle cx="40.6" cy="29.7" r="1.2" fill="#fff"/>
  <path d="M28.4 36.4 C 28.4 34.6, 35.6 34.6, 35.6 36.4 C 35.6 38.5, 33.5 40, 32 40 C 30.5 40, 28.4 38.5, 28.4 36.4 Z" fill="#2A1C14"/>
  <path d="M30.2 35.7 c 0.8 -0.4, 2 -0.4, 2.6 0" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".55" fill="none"/>
  <path d="M32 40 v1.8 M32 41.8 c -1.4 1.6, -3.4 1.6, -4.5 0.4 M32 41.8 c 1.4 1.6, 3.4 1.6, 4.5 0.4" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
</svg>`;
}

export function pawIcon() {
  return `<svg class="ico ico-paw" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor">
  <path d="M12 11.2c-3 0-5.6 3.2-5.6 5.6 0 1.8 1.4 2.6 2.8 2.6 1.2 0 1.8-.6 2.8-.6s1.6.6 2.8.6c1.4 0 2.8-.8 2.8-2.6 0-2.4-2.6-5.6-5.6-5.6z"/>
  <ellipse cx="5.6" cy="10.2" rx="1.9" ry="2.4" transform="rotate(-18 5.6 10.2)"/>
  <ellipse cx="9.4" cy="6.4" rx="1.9" ry="2.5" transform="rotate(-6 9.4 6.4)"/>
  <ellipse cx="14.6" cy="6.4" rx="1.9" ry="2.5" transform="rotate(6 14.6 6.4)"/>
  <ellipse cx="18.4" cy="10.2" rx="1.9" ry="2.4" transform="rotate(18 18.4 10.2)"/>
</g></svg>`;
}

export function clockIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
  <circle cx="12" cy="13" r="8"/><path d="M12 9v4.2l2.8 1.8"/><path d="M9.5 2.8h5"/></svg>`;
}

export function speakerIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" fill-opacity=".18"/>
  <path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18.2 6.6a7.6 7.6 0 0 1 0 10.8"/></svg>`;
}

export function sparkIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor"
  d="M12 2.5c.5 4.6 2.6 6.9 7.2 7.5-4.6.6-6.7 2.9-7.2 7.5-.5-4.6-2.6-6.9-7.2-7.5 4.6-.6 6.7-2.9 7.2-7.5z"/>
  <circle cx="18.5" cy="18.5" r="1.8" fill="currentColor" opacity=".7"/></svg>`;
}

export function playIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.6c0-1 1.1-1.6 1.9-1.1l9 6.1c.8.5.8 1.7 0 2.2l-9 6.1c-.8.5-1.9-.1-1.9-1.1z"/></svg>`;
}

export function restartIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 4.5v4h4"/></svg>`;
}

// ---------------------------------------------------------------------------
//  v2: itens das fases, fluxo de fases e controle
// ---------------------------------------------------------------------------
export function ballIcon() {
  return `<svg class="ico ico-ball" viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="33" r="22" fill="#D4E84B" stroke="${INK}" stroke-width="2.6"/>
  <path d="M20 16.5 C 30 24, 30 42, 20 50" fill="none" stroke="#FFFBEA" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M44 16.5 C 34 24, 34 42, 44 50" fill="none" stroke="#FFFBEA" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M17 26 a17 17 0 0 1 9 -9" fill="none" stroke="#F4FBC6" stroke-width="3" stroke-linecap="round" opacity=".8"/>
  <path d="M40 52.5 a22 22 0 0 0 13 -11" fill="none" stroke="#AFC232" stroke-width="3" stroke-linecap="round" opacity=".7"/>
</svg>`;
}

export function slipperIcon() {
  return `<svg class="ico ico-slipper" viewBox="0 0 64 64" aria-hidden="true">
  <g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
    <path d="M6 44 C 6 38, 12 36, 20 36 L 50 35 C 57 35, 60 39, 59 44 C 58 49, 54 51, 48 51 L 14 51 C 9 51, 6 48.5, 6 44 Z" fill="#E9D6BE"/>
    <path d="M8 41 C 10 30, 22 23, 34 24 C 44 25, 48 31, 47 38 L 10 42 Z" fill="#F4A7BC"/>
  </g>
  <path d="M13 37 C 17 31, 25 27.5, 33 28" fill="none" stroke="#FCD2DD" stroke-width="3" stroke-linecap="round"/>
  <circle cx="30" cy="22.5" r="6.4" fill="#FFF8F2" stroke="${INK}" stroke-width="2.2"/>
  <circle cx="28.4" cy="21" r="2" fill="#FFFFFF"/>
  <path d="M14 46.5 H 52" stroke="#CDB599" stroke-width="2" stroke-linecap="round" stroke-dasharray="2.5 3.5"/>
</svg>`;
}

export function duckIcon() {
  return `<svg class="ico ico-duck" viewBox="0 0 64 64" aria-hidden="true">
  <g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
    <path d="M8 34 C 6 27, 10 24, 13 27 C 16 30, 20 31, 26 31 L 40 31 C 52 31, 58 38, 56 46 C 54 53, 46 56, 34 56 L 24 56 C 14 56, 9 50, 8 42 Z" fill="#FFD23C"/>
    <circle cx="40" cy="22" r="11" fill="#FFD23C"/>
    <path d="M49 21.5 C 55 19.5, 60 21, 61 24 C 58 27.5, 53 27.5, 49 26.5 Z" fill="#FF8A2A"/>
  </g>
  <path d="M15 40 C 20 46, 30 47.5, 39 44" fill="none" stroke="#F4B21E" stroke-width="3" stroke-linecap="round"/>
  <path d="M32 18 a9 9 0 0 1 8 -5" fill="none" stroke="#FFF2B0" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="43" cy="20" r="2.6" fill="#2A1C14"/><circle cx="43.9" cy="19.1" r="0.9" fill="#fff"/>
  <path d="M10 60 C 20 57.5, 44 57.5, 56 60" stroke="#8FC8E8" stroke-width="2.4" stroke-linecap="round" fill="none"/>
</svg>`;
}

export function bearIcon() {
  return `<svg class="ico ico-bear" viewBox="0 0 64 64" aria-hidden="true">
  <g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round">
    <circle cx="17" cy="15" r="7" fill="#C08D5E"/><circle cx="47" cy="15" r="7" fill="#C08D5E"/>
    <ellipse cx="32" cy="48" rx="15" ry="13" fill="#C08D5E"/>
    <circle cx="32" cy="27" r="15" fill="#C08D5E"/>
    <ellipse cx="32" cy="33" rx="7.5" ry="5.6" fill="#EFD5AE"/>
  </g>
  <circle cx="17" cy="15" r="3" fill="#EFD5AE"/><circle cx="47" cy="15" r="3" fill="#EFD5AE"/>
  <ellipse cx="32" cy="50" rx="8" ry="7" fill="#EFD5AE"/>
  <circle cx="26" cy="25" r="2.5" fill="#2A1C14"/><circle cx="38" cy="25" r="2.5" fill="#2A1C14"/>
  <circle cx="26.8" cy="24.2" r="0.8" fill="#fff"/><circle cx="38.8" cy="24.2" r="0.8" fill="#fff"/>
  <path d="M29.5 31 C 29.5 29.5, 34.5 29.5, 34.5 31 C 34.5 32.5, 33 33.4, 32 33.4 C 31 33.4, 29.5 32.5, 29.5 31 Z" fill="#2A1C14"/>
  <path d="M24 41.5 L 32 44 L 40 41.5 L 40 46 L 32 43.6 L 24 46 Z" fill="#E0566C" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
</svg>`;
}

export function frisbeeIcon() {
  return `<svg class="ico ico-frisbee" viewBox="0 0 64 64" aria-hidden="true">
  <ellipse cx="32" cy="38" rx="26" ry="12" fill="#C8483C" stroke="${INK}" stroke-width="2.6"/>
  <ellipse cx="32" cy="33" rx="26" ry="12.5" fill="#F26B5B" stroke="${INK}" stroke-width="2.6"/>
  <ellipse cx="32" cy="32" rx="16.5" ry="7.4" fill="none" stroke="#FFF4E2" stroke-width="2.6"/>
  <path d="M32 26.5l1.9 3.6 4 .5-2.9 2.6.8 3.9-3.8-2-3.8 2 .8-3.9-2.9-2.6 4-.5z" fill="#FFC94D" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M12 28.5 C 16 24, 24 21.5, 31 21.3" fill="none" stroke="#FFC1B7" stroke-width="2.6" stroke-linecap="round"/>
</svg>`;
}

/** Meia listrada (vermelho e creme) com o punho canelado e o calcanhar dobrado. */
export function sockIcon() {
  return `<svg class="ico ico-sock" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M22 6 h20 v26 c0 4 1.5 6 5 9 c6 5 6.5 13 1 17 c-5 3.6 -11 2.4 -16 -1.4 l-10 -8 c-3.4 -2.8 -5 -6 -5 -10 Z"
        fill="#FFF4E2" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M22 17 h20 v7 h-20 Z M22 31 h20.4 c.2 2.2 1 3.6 2.6 5.2 l-21.5 0 c-1 -1.4 -1.5 -3.2 -1.5 -5.2 Z" fill="#E8554A"/>
  <path d="M28 44 c5 -1 10.5 .6 14 4 c-3 4 -9 4.6 -14 .2 Z" fill="#E8554A"/>
  <path d="M22 6 h20 v6 h-20 Z" fill="#F2C14E" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
  <g stroke="${INK}" stroke-width="1.4" opacity=".55"><path d="M26 6.5 v5"/><path d="M30 6.5 v5"/><path d="M34 6.5 v5"/><path d="M38 6.5 v5"/></g>
  <path d="M22 6 h20 v26 c0 4 1.5 6 5 9 c6 5 6.5 13 1 17 c-5 3.6 -11 2.4 -16 -1.4 l-10 -8 c-3.4 -2.8 -5 -6 -5 -10 Z"
        fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
</svg>`;
}

/** Óculos redondos dourados de leitura. */
export function glassesIcon() {
  return `<svg class="ico ico-glasses" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M8 26 l-3 -4 M56 26 l3 -4" stroke="#C9A24A" stroke-width="3" stroke-linecap="round"/>
  <circle cx="20" cy="34" r="12" fill="#DFF1FF" fill-opacity=".55" stroke="${INK}" stroke-width="2.6"/>
  <circle cx="44" cy="34" r="12" fill="#DFF1FF" fill-opacity=".55" stroke="${INK}" stroke-width="2.6"/>
  <circle cx="20" cy="34" r="10" fill="none" stroke="#C9A24A" stroke-width="2"/>
  <circle cx="44" cy="34" r="10" fill="none" stroke="#C9A24A" stroke-width="2"/>
  <path d="M28 31 q4 -5 8 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M14 29 q3 -3 6 -2 M38 29 q3 -3 6 -2" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" fill="none"/>
</svg>`;
}

/** Livro de histórias de capa vermelha com a lua dourada. */
export function bookIcon() {
  return `<svg class="ico ico-book" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M14 10 h32 c3 0 5 2 5 5 v36 c0 3 -2 5 -5 5 h-32 Z" fill="#F6ECD6" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M12 8 h31 c2.5 0 4 1.5 4 4 v38 c0 2.5 -1.5 4 -4 4 h-31 Z" fill="#9C2F2A" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <rect x="16" y="12" width="27" height="38" rx="2" fill="none" stroke="#E6C25A" stroke-width="2"/>
  <path d="M33 22 a8 8 0 1 0 2 12 a6.5 6.5 0 1 1 -2 -12 Z" fill="#F6E3A0"/>
  <path d="M22 20 l1 2 2 .3 -1.5 1.3 .4 2 -1.9 -1 -1.9 1 .4 -2 -1.5 -1.3 2 -.3 Z" fill="#F6E3A0"/>
  <path d="M19 44 h21" stroke="#E6C25A" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;
}

/** Chapeuzinho de festa: cone listrado de rosa e creme, bolinhas douradas, pompom e o elástico. */
export function hatIcon() {
  return `<svg class="ico ico-hat" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M15 52 Q 32 60 49 52" fill="none" stroke="#E8A93C" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M32 9 L 49 51 Q 32 57 15 51 Z" fill="#FF8FC4" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M28.6 17.4 L 35.4 17.4 L 38.6 25.2 L 25.4 25.2 Z M 22.2 33 L 41.8 33 L 45 40.8 L 19 40.8 Z" fill="#FFF1D9"/>
  <g fill="#F5C543"><circle cx="31" cy="30" r="1.8"/><circle cx="36.5" cy="45" r="1.8"/><circle cx="25" cy="46" r="1.6"/><circle cx="33.5" cy="21.5" r="1.3"/></g>
  <path d="M32 9 L 49 51 Q 32 57 15 51 Z" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <circle cx="32" cy="9" r="5.2" fill="#FFE27A" stroke="${INK}" stroke-width="2.4"/>
  <path d="M29.6 7.2 q1.4 -1.6 3.2 -1" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" fill="none"/>
</svg>`;
}

/** Laço de cetim rosa com as pontas caídas e o nó no meio. */
export function ribbonIcon() {
  return `<svg class="ico ico-ribbon" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M29 34 L 20 56 L 26 53 L 29 59 L 33 37 Z M35 34 L 44 56 L 38 53 L 35 59 L 31 37 Z" fill="#E0568E" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M30 31 C 20 18, 6 20, 8 31 C 9 41, 22 42, 30 35 Z" fill="#F78DB8" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M34 31 C 44 18, 58 20, 56 31 C 55 41, 42 42, 34 35 Z" fill="#F78DB8" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M14 29 C 17 25, 22 25, 25 29 M50 29 C 47 25, 42 25, 39 29" fill="none" stroke="#FFD0E3" stroke-width="2" stroke-linecap="round"/>
  <rect x="27" y="27" width="10" height="11" rx="3.5" fill="#E0568E" stroke="${INK}" stroke-width="2.4"/>
</svg>`;
}

/** Vela do número 3: o 3 rosa com bolinhas, o pavio aceso e duas estrelinhas. */
export function candleIcon() {
  return `<svg class="ico ico-candle" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M32 4 C 36 9, 36 13, 32 15 C 28 13, 28 9, 32 4 Z" fill="#FFB63D" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M32 8.5 C 33.6 10.5, 33.6 12, 32 13 C 30.4 12, 30.4 10.5, 32 8.5 Z" fill="#FFF3B0"/>
  <path d="M32 15 v4" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M20 26 C 21 18, 43 16, 44 26 C 45 32, 40 35, 36 36.5 C 41 38, 46 41, 45 48 C 44 59, 20 59, 19 50 L 27 48.5 C 28 52, 37 52, 37 47.5 C 37 43, 32 41.5, 28.5 41.5 L 28.5 33 C 32 33, 36.5 31.5, 36.5 28 C 36.5 23.5, 28.5 23.5, 27.5 27.5 Z"
        fill="#FF8FC4" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <g fill="#FFF1D9"><circle cx="24.5" cy="24" r="1.7"/><circle cx="40.5" cy="27" r="1.7"/><circle cx="41" cy="47" r="1.7"/><circle cx="25" cy="53" r="1.5"/><circle cx="32" cy="38" r="1.4"/></g>
  <path d="M10 20 l1.4 3 3.2 .4 -2.4 2.2 .7 3.2 -2.9 -1.6 -2.9 1.6 .7 -3.2 -2.4 -2.2 3.2 -.4 Z" fill="#FFD94D" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M54 36 l1 2.2 2.4 .3 -1.8 1.6 .5 2.4 -2.1 -1.2 -2.1 1.2 .5 -2.4 -1.8 -1.6 2.4 -.3 Z" fill="#FFD94D" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
</svg>`;
}

/** Ícone do item da fase ('carrot' | 'ball' | 'slipper' | 'duck' | 'bear' | 'frisbee' | 'sock' | 'glasses' | 'book' | 'hat' | 'ribbon' | 'candle'). */
export function itemIcon(item) {
  if (item === 'hat') return hatIcon();
  if (item === 'ribbon') return ribbonIcon();
  if (item === 'candle') return candleIcon();
  if (item === 'glasses') return glassesIcon();
  if (item === 'book') return bookIcon();
  if (item === 'ball') return ballIcon();
  if (item === 'frisbee') return frisbeeIcon();
  if (item === 'sock') return sockIcon();
  if (item === 'slipper') return slipperIcon();
  if (item === 'duck') return duckIcon();
  if (item === 'bear') return bearIcon();
  return carrotIcon();
}

export function lockIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
  <path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5"/></g>
  <rect x="4.8" y="10.2" width="14.4" height="10.3" rx="3" fill="currentColor"/>
  <circle cx="12" cy="15" r="1.6" fill="#FFF6E6"/><path d="M12 15.5v2" stroke="#FFF6E6" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

export function checkIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2L18.5 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function trophyIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M7 4.5h10v4.5a5 5 0 0 1-10 0z" fill="currentColor" fill-opacity=".2"/><path d="M7 6.5H4.5a3 3 0 0 0 3 4"/><path d="M17 6.5h2.5a3 3 0 0 1-3 4"/>
  <path d="M12 14v3.5"/><path d="M8.5 20h7"/></g></svg>`;
}

export function heartIcon() {
  return `<svg class="ico ico-heart" viewBox="0 0 24 24" aria-hidden="true"><path fill="#F37C8A" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"
  d="M12 20.2c-.3 0-7.8-4.6-8.6-9.6C2.8 7 5 4.6 7.7 4.6c1.8 0 3.3 1 4.3 2.6 1-1.6 2.5-2.6 4.3-2.6 2.7 0 4.9 2.4 4.3 6-.8 5-8.3 9.6-8.6 9.6z"/>
  <path d="M7 7.6c-1 .3-1.7 1.2-1.8 2.3" fill="none" stroke="#FFD0D6" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

export function homeIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 11.2L12 4.5l8 6.7"/><path d="M6.3 9.5v9.3a1 1 0 0 0 1 1h3.4v-5.2h2.6v5.2h3.4a1 1 0 0 0 1-1V9.5"/></svg>`;
}

/** Mapa dobrado com o alfinete (o mapa das fases). */
export function mapIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3.5 6.5l5-2 7 2.5 5-2v13l-5 2-7-2.5-5 2z"/><path d="M8.5 4.5v13M15.5 7v13"/>
  <circle cx="12" cy="10.5" r="1.4" fill="currentColor" stroke="none"/></svg>`;
}

export function nextIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 12h12.5"/><path d="M12.5 6.5L18 12l-5.5 5.5"/></svg>`;
}

/** Duas patinhas em diagonal (seguindo). */
export function followIcon() {
  const paw = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(.5)" fill="currentColor">
    <path d="M0 2.5c-3 0-5.6 3.2-5.6 5.6 0 1.8 1.4 2.6 2.8 2.6 1.2 0 1.8-.6 2.8-.6s1.6.6 2.8.6c1.4 0 2.8-.8 2.8-2.6C5.6 5.7 3 2.5 0 2.5z"/>
    <ellipse cx="-6.4" cy="1.5" rx="1.9" ry="2.4"/><ellipse cx="-2.6" cy="-2.3" rx="1.9" ry="2.5"/><ellipse cx="2.6" cy="-2.3" rx="1.9" ry="2.5"/><ellipse cx="6.4" cy="1.5" rx="1.9" ry="2.4"/></g>`;
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${paw(7, 15, -25)}${paw(16.5, 6.5, 20)}</svg>`;
}

/** Alfinete de mapa (esperando aqui). */
export function stayIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8a6.6 6.6 0 0 0-6.6 6.6c0 4.7 5.4 10.6 6 11.2a.8.8 0 0 0 1.2 0c.6-.6 6-6.5 6-11.2A6.6 6.6 0 0 0 12 2.8z"/>
  <circle cx="12" cy="9.4" r="2.6" fill="#FFF6E6"/></svg>`;
}

export function keyboardIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
  <rect x="2.5" y="6.5" width="19" height="11" rx="2.4"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6.5 14h11"/></svg>`;
}

export function gamepadIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"
  d="M7.2 7h9.6a4.6 4.6 0 0 1 4.5 3.7l.9 4.7a2.6 2.6 0 0 1-4.6 2.1L15.9 15H8.1l-1.7 2.5a2.6 2.6 0 0 1-4.6-2.1l.9-4.7A4.6 4.6 0 0 1 7.2 7z"/>
  <path d="M7.5 9.8v3.4M5.8 11.5h3.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
  <circle cx="16" cy="10.4" r="1.1" fill="currentColor"/><circle cx="18" cy="12.4" r="1.1" fill="currentColor"/></svg>`;
}

// ---------------------------------------------------------------------------
//  Toque: botões virtuais (src/ui/touchControls.js) e os mesmos ícones nas dicas
// ---------------------------------------------------------------------------
const stroke = (d, w = 2.3) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

/** Pular: seta para cima saindo do chão. */
export function jumpIcon() {
  return stroke('<path d="M12 17.5V5.5"/><path d="M6.8 10.6L12 5.4l5.2 5.2"/><path d="M5.5 20.5h13" opacity=".55"/>');
}
/** Superbafo: rajadas de vento. */
export function windIcon() {
  return stroke('<path d="M3.5 9.5h9.8a2.6 2.6 0 1 0-2.6-2.6"/><path d="M3.5 14h13.4a2.9 2.9 0 1 1-2.9 2.9"/><path d="M3.5 18.3h5.5" opacity=".6"/>');
}
/** Lambe-Lambe: linguinha. */
export function lickIcon() {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4.5 7.5c2.2 1.4 4.7 2.1 7.5 2.1s5.3-.7 7.5-2.1"/>
  <path d="M7.6 9.1v3.9a4.4 4.4 0 0 0 8.8 0V9.1" fill="currentColor" fill-opacity=".22"/><path d="M12 10.2v3.6"/></svg>`;
}
/** Arrancada: seta com rastro de velocidade. */
export function dashIcon() {
  return stroke('<path d="M13 5.5l6.5 6.5-6.5 6.5"/><path d="M4 8.5h6M2.8 12h9.5M4 15.5h6"/>');
}
/** Empurrar: caixa com seta. */
export function pushIcon() {
  return stroke('<rect x="12.5" y="6" width="8.5" height="12" rx="1.6" fill="currentColor" fill-opacity=".22"/><path d="M2.8 12h7"/><path d="M7 8.6l3.3 3.4L7 15.4"/>');
}
/** Trocar de cachorrinha: duas setas em círculo. */
export function swapIcon() {
  return stroke('<path d="M16.5 3.8l3.2 3.2-3.2 3.2"/><path d="M19.5 7H9.2a5 5 0 0 0-5 5"/><path d="M7.5 20.2l-3.2-3.2 3.2-3.2"/><path d="M4.5 17h10.3a5 5 0 0 0 5-5"/>', 2.2);
}
export function pauseIcon() {
  return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.2" y="5" width="4.2" height="14" rx="1.5" fill="currentColor"/><rect x="13.6" y="5" width="4.2" height="14" rx="1.5" fill="currentColor"/></svg>';
}
/** Joystick virtual (para "Mover" nas dicas e na tabela de controles). */
export function stickIcon() {
  return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="3.9" fill="currentColor"/></svg>';
}
export function fullscreenIcon() {
  return stroke('<path d="M4 9V4.5h4.5M20 9V4.5h-4.5M4 15v4.5h4.5M20 15v4.5h-4.5"/>');
}
/** Qualidade gráfica: quadro com paisagem. */
export function qualityIcon() {
  return stroke('<rect x="3" y="5" width="18" height="14" rx="2.6"/><path d="M6.4 16l3.6-4 2.6 3 2.1-2.1L18 16"/><circle cx="15.6" cy="9.2" r="1.3" fill="currentColor"/>', 1.9);
}
/** Aviso de girar o celular: aparelho deitando, com seta. */
export function rotatePhoneIcon() {
  return `<svg class="ico ico-rotate" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="20" y="6" width="22" height="38" rx="4.5" opacity=".45" stroke-dasharray="4 5"/>
  <rect x="12" y="34" width="44" height="23" rx="4.5" fill="currentColor" fill-opacity=".14"/>
  <path d="M51.5 39v13" opacity=".5"/>
  <path d="M46 12c6 2.5 9.5 8 9.6 14.5"/><path d="M51.4 23.6l4.2 3.4 3.4-4.3"/></svg>`;
}

// ---------------------------------------------------------------------------
//  Menu inicial: Opções, Voltar, Dicas e os modos de jogo
// ---------------------------------------------------------------------------
/** Opções: engrenagem. */
export function gearIcon() {
  return stroke('<path d="M18.53 9.76L21.07 10.44V13.56L18.53 14.24L18.2 15.03L19.51 17.31L17.31 19.51L15.03 18.2L14.24 18.53L13.56 21.07H10.44L9.76 18.53L8.97 18.2L6.69 19.51L4.49 17.31L5.8 15.03L5.47 14.24L2.93 13.56V10.44L5.47 9.76L5.8 8.97L4.49 6.69L6.69 4.49L8.97 5.8L9.76 5.47L10.44 2.93H13.56L14.24 5.47L15.03 5.8L17.31 4.49L19.51 6.69L18.2 8.97Z" fill="currentColor" fill-opacity=".16"/><circle cx="12" cy="12" r="3"/>', 1.8);
}
/** Voltar: seta para a esquerda. */
export function backIcon() {
  return stroke('<path d="M19.5 12H5.5"/><path d="M11 6.2L5.2 12l5.8 5.8"/>', 2.4);
}
/** Dicas: lâmpada. */
export function bulbIcon() {
  return stroke('<path d="M12 3.4a6.1 6.1 0 0 0-3.6 11c.8.6 1.2 1.4 1.2 2.3v.6h4.8v-.6c0-.9.4-1.7 1.2-2.3A6.1 6.1 0 0 0 12 3.4z" fill="currentColor" fill-opacity=".18"/><path d="M9.8 20.4h4.4"/>', 1.9);
}
/** Sem dicas (modo desafio): lâmpada riscada. */
export function noBulbIcon() {
  return stroke('<path d="M12 3.4a6.1 6.1 0 0 0-3.6 11c.8.6 1.2 1.4 1.2 2.3v.6h4.8v-.6c0-.9.4-1.7 1.2-2.3A6.1 6.1 0 0 0 12 3.4z" fill="currentColor" fill-opacity=".18"/><path d="M9.8 20.4h4.4"/><path d="M4.2 4.2l15.6 15.6"/>', 1.9);
}
/** Modo História: mapa dobrado com ilhas, trilha pontilhada e um alfinete laranja. */
export function mapArt() {
  return `<svg class="ico ico-map" viewBox="0 0 64 64" aria-hidden="true">
  <g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round">
    <path d="M5 15 L22 9 L42 15 L59 9 V49 L42 55 L22 49 L5 55 Z" fill="#CFE6EE"/>
    <path d="M22 9 V49 M42 15 V55" fill="none" opacity=".35"/>
  </g>
  <path d="M22 9 L42 15 V55 L22 49 Z" fill="#B9D9E4"/>
  <g stroke="${INK}" stroke-width="2" stroke-linejoin="round">
    <path d="M9.5 24 c3-4 9-4.5 11.5-1 c2 3-.5 7.5-5 8 c-4 .5-8.5-3-6.5-7 Z" fill="#9CC488"/>
    <path d="M30 31 c4-3.5 10.5-2.5 11.5 1.5 c1 4.5-4 8-8.5 7 c-4-1-5.5-5.5-3-8.5 Z" fill="#B7D49A"/>
    <path d="M46 19 c3.5-2 8.5-.5 9 3 c.5 3.5-3 6-6.5 5.5 c-3.5-.5-5-6-2.5-8.5 Z" fill="#9CC488"/>
  </g>
  <path d="M17 29 C 24 37, 26 38, 32 36 M41 34 C 46 30, 47 27, 49 25" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="1.5 3.2" opacity=".7"/>
  <path d="M15 42 l3 3 M18 42 l-3 3" stroke="#C2601F" stroke-width="2.2" stroke-linecap="round"/>
  <g stroke="${INK}" stroke-width="2.2" stroke-linejoin="round">
    <path d="M50.5 6.5 c-4.6 0-8 3.3-8 7.6 c0 5.4 8 12.4 8 12.4 s8-7 8-12.4 c0-4.3-3.4-7.6-8-7.6 Z" fill="#F08A3C"/>
  </g>
  <circle cx="50.5" cy="14" r="2.8" fill="#FFF6E6"/>
</svg>`;
}
