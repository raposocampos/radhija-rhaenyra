// Desenhos dos cartões de pista (pictogramas, sem letras) e dos ícones do HUD da história: SVG em texto, 60 × 60,
// contorno de chocolate e cores chapadas, no estilo dos ícones do jogo (src/ui/icons.js). O quadro de dedução, o mural
// e o cartão da pista anotada (que voa até o botão do quadro) usam os mesmos desenhos.
const INK = '#2a2318';
const S = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
const card = (inner) => `<svg viewBox="0 0 60 60" aria-hidden="true"><rect x="2" y="2" width="56" height="56" rx="7" fill="#FFFDF6" ${S}/>${inner}</svg>`;

/** Um pombo de perfil (pés em x, y), olhando para a direita; wet: pingos; fly: asas abertas. */
function pigeon(x, y, s = 1, { fly = false, wet = false, flip = false, cap = false } = {}) {
  const t = `translate(${x} ${y}) scale(${flip ? -s : s} ${s})`;
  let g = `<path d="M-7,-7 l-7,1 l2,-5z" fill="#66718A" ${S}/><ellipse cx="0" cy="-7" rx="8" ry="6" fill="#8E98AA" ${S}/>`;
  g += fly ? `<path d="M-2,-10 q-5,-12 -13,-11 q5,5 13,7z M2,-10 q3,-12 11,-13 q-3,6 -9,9z" fill="#66718A" ${S}/>` : `<ellipse cx="-2" cy="-7" rx="5.5" ry="3.6" fill="#66718A" ${S}/>`;
  g += `<circle cx="6" cy="-13" r="4" fill="#8E98AA" ${S}/><path d="M9.6,-13.6 l3.4,1 l-3.4,1.2z" fill="#3A3A40"/><circle cx="7.2" cy="-14" r="1" fill="${INK}"/>`;
  if (!fly) g += '<path d="M-1.5,-2 l-.8,2.4 M2,-2 l.8,2.4" stroke="#E58A8A" stroke-width="1.4"/>';
  if (cap) g += `<path d="M3,-16 h6 v-3 q-3,-2 -6,0z" fill="#33456b" ${S}/>`;
  if (wet) g += '<path d="M-3,-17 q-2,3 0,4.4 q2,-1.4 0,-4.4z M5,-21 q-2,3 0,4.4 q2,-1.4 0,-4.4z" fill="#7CC3EA" stroke="#3d7fb0" stroke-width=".7"/>';
  return `<g transform="${t}">${g}</g>`;
}
/** Uma dog deitada, de lado (rad: creme; rha: branca), olhando para a direita. */
function lying(x, y, s, who, flip = false) {
  const c = who === 'rad' ? '#E8C07A' : '#F8F6F1';
  const d = who === 'rad' ? '#B8893F' : '#CFC8BC';
  const t = `translate(${x} ${y}) scale(${flip ? -s : s} ${s})`;
  return `<g transform="${t}"><ellipse cx="0" cy="-7" rx="18" ry="7" fill="${c}" ${S}/><circle cx="17" cy="-8" r="7.5" fill="${c}" ${S}/>`
    + `<ellipse cx="22" cy="-6" rx="5" ry="3.6" fill="${c}" ${S}/><circle cx="26" cy="-7" r="1.7" fill="${INK}"/>`
    + `<path d="M15,-9 q1.8,1.6 3.6,0" fill="none" ${S}/><ellipse cx="13" cy="-4" rx="3.6" ry="6" fill="${d}" ${S} transform="rotate(20 13 -7)"/></g>`;
}

/** @type {Record<string, string>} */
export const PICTOS = {
  pombos: card(`<rect x="5" y="40" width="50" height="5" fill="#cfc4b4" ${S}/>${pigeon(16, 40, 0.8, { wet: true, flip: true, cap: true })}${pigeon(31, 40, 0.8, { wet: true, flip: true })}${pigeon(45, 40, 0.85, { wet: true, flip: true })}`),
  abraco: card(`<path d="M16,10 a8,8 0 1 0 8,10 a6,6 0 1 1 -8,-10z" fill="#ffd84a" ${S}/>${lying(20, 47, 0.62, 'rha')}${lying(42, 49, 0.55, 'rad', true)}`),
  pote: card(`<path d="M8,45 q20,-5 42,1 q-20,7 -42,-1z" fill="#7CC3EA" opacity=".85"/><g transform="translate(25 38) rotate(-70)"><path d="M-11,0 h22 l-3,-8 h-16z" fill="#d9534f" ${S}/></g>`),
  trilha: card(`<path d="M8,49 h13 v-6" stroke="#8471b3" stroke-width="5" fill="none"/>${[[16, 41], [22, 35], [28, 30], [34, 25], [40, 20], [46, 15]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#ff8a2a" opacity="${(1 - i * 0.13).toFixed(2)}"/>`).join('')}<rect x="41" y="6" width="13" height="9" fill="#bfe3f5" ${S}/>`),
  pena: card(`<rect x="6" y="38" width="48" height="6" fill="#cfc4b4" ${S}/><g transform="translate(30 37) rotate(-30)"><path d="M0,0 q6,-8 2,-18 q-6,8 -2,18z" fill="#cfd5e2" ${S}/><path d="M0,0 q1,-9 2,-18" stroke="${INK}" stroke-width="1" fill="none"/></g><path d="M41,20 q-2,3 0,4.6 q2,-1.6 0,-4.6z" fill="#7CC3EA" stroke="#3d7fb0" stroke-width=".7"/>`),
  baba: card(`<rect x="6" y="30" width="48" height="6" fill="#c79a6a" ${S}/><path d="M24,36 q2,8 0,12 q-2,-4 0,-12z M32,36 q2,6 0,9 q-2,-3 0,-9z" fill="#bfe3f5" stroke="#3d7fb0" stroke-width="1"/><path d="M8,24 h44" stroke="${INK}" stroke-width="1.2" stroke-dasharray="3 3"/>`),
  telhas: card(`<path d="M8,47 l18,-14 l6,3 l-16,14z" fill="#7a5a3a" ${S}/><path d="M30,49 q6,-8 14,-4 q-4,7 -14,4z M38,39 q6,-6 12,-2 q-4,6 -12,2z" fill="#c4643f" ${S}/><path d="M34,10 l-6,10 h6 l-5,10" stroke="#5b6b9a" stroke-width="2" fill="none"/>`),
  boia: card(`<path d="M6,49 h48" stroke="#6FC3E0" stroke-width="6"/>${pigeon(30, 30, 0.8, { fly: true })}<path d="M21,40 q9,-4 18,0 q-2,6 -9,6 q-7,0 -9,-6z" fill="#F2C230" ${S} opacity=".95"/>`),
  ralo: card(`<rect x="8" y="14" width="44" height="30" rx="4" fill="#cfd8dc" ${S}/><circle cx="30" cy="34" r="5" fill="${INK}"/><path d="M30,29 q4,-8 10,-10" stroke="#9aa4aa" stroke-width="1.4" fill="none"/>`),
  senha: card(`<rect x="6" y="18" width="48" height="20" rx="5" fill="#cfd8dc" ${S}/>`
    + `<circle cx="16" cy="28" r="6.4" fill="#FFFDF6" ${S}/><path d="M12.4,30.4 q.6,-6 3.6,-6 q3,0 3.6,6z" fill="#E8B93A" ${S}/><circle cx="16" cy="31.6" r="1.1" fill="${INK}"/>`
    + `<circle cx="30" cy="28" r="6.4" fill="#FFFDF6" ${S}/><path d="M26.4,26.9 h7.2 a1.5,1.5 0 1 1 1.4,1.6 a1.5,1.5 0 1 1 -1.4,1.6 h-7.2 a1.5,1.5 0 1 1 -1.4,-1.6 a1.5,1.5 0 1 1 1.4,-1.6z" fill="#FFF6E3" stroke="${INK}" stroke-width="1"/>`
    + `<circle cx="44" cy="28" r="6.4" fill="#FFFDF6" ${S}/><path d="M43,31 v-7 l3.6,-.9 v6" fill="none" stroke="${INK}" stroke-width="1.3"/><ellipse cx="42" cy="31.2" rx="1.5" ry="1.1" fill="${INK}"/><ellipse cx="45.6" cy="30.2" rx="1.5" ry="1.1" fill="${INK}"/>`
    + `<circle cx="16" cy="45" r="1.5" fill="${INK}"/><circle cx="28.4" cy="45" r="1.5" fill="${INK}"/><circle cx="31.9" cy="45" r="1.5" fill="${INK}"/><circle cx="41" cy="45" r="1.5" fill="${INK}"/><circle cx="44.4" cy="45" r="1.5" fill="${INK}"/><circle cx="47.8" cy="45" r="1.5" fill="${INK}"/>`
    + `${pigeon(30, 16, 0.5, { flip: false })}`),
  q: card(`<path d="M24,22 q0,-8 7,-8 q7,0 7,6 q0,5 -7,7 v4" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="31" cy="40" r="2.6" fill="${INK}"/>`),
  // a grelha de ventilação da guarita, rente ao chão, com o fiapo de cheiro entrando
  grelha: card(`<rect x="8" y="10" width="44" height="40" fill="#e8dcc4" ${S}/><rect x="14" y="30" width="32" height="16" rx="2" fill="#8a8f96" ${S}/>`
    + `${[34, 38, 42].map((y) => `<path d="M16,${y} h28" stroke="${INK}" stroke-width="1.6"/>`).join('')}`
    + '<path d="M6,24 q8,-6 14,0 q6,6 12,0" fill="none" stroke="#9ccf6a" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="2 4"/>'),
  // a caixa d'água com o alçapão aberto (o tracejado onde ficava a tampa) e o pombo levando a tampa redonda embora
  tampa: card(`<path d="M8,52 v-22 l6,-5 h30 l-6,5 v22z" fill="#e8dcc4" ${S}/><path d="M38,52 v-22 l6,-5 v22z" fill="#cbbd9f" ${S}/>`
    + `<path d="M8,30 l6,-5 h30 l-6,5z" fill="#d6c7a6" ${S}/><ellipse cx="25" cy="27.6" rx="6" ry="1.9" fill="${INK}"/>`
    + `<ellipse cx="25" cy="27.6" rx="8.6" ry="3" fill="none" stroke="${INK}" stroke-width="1.1" stroke-dasharray="2 2"/>`
    + `<path d="M16,40 q3,-4 6,0 q-3,4 -6,0z" fill="#3f9fd8"/>`
    + `${pigeon(44, 18, 0.62, { fly: true })}<ellipse cx="44" cy="20.4" rx="5.4" ry="1.8" fill="#3a3d44" ${S}/>`),
  // a pipa em losango (quatro cores) caída, a rabiola em laços e, enroscados nela, uma pena cinza e o anel laranja
  pipa: card(`<path d="M18,8 l12,10 l-12,18 l-12,-18z" fill="#f2c230" ${S}/><path d="M18,8 l12,10 l-12,4z" fill="#e8475f"/><path d="M6,18 l12,4 l0,14z" fill="#3d8fd1"/>`
    + `<path d="M18,8 l0,28 M6,18 h24" stroke="${INK}" stroke-width="1.1"/>`
    + '<path d="M18,36 q4,6 10,6 q8,0 10,6 q2,5 10,6" fill="none" stroke="#f4f0e2" stroke-width="1.4"/>'
    + `<path d="M24,41 l-3,-2 l0,4z M34,44 l3,-2 l0,4z M46,53 l-3,-2 l0,4z" fill="#e8475f" ${S}/>`
    + `<g transform="translate(40 40) rotate(-35)"><path d="M0,0 q4,-6 1,-13 q-4,6 -1,13z" fill="#a9b2c2" ${S}/></g>`
    + `<circle cx="29" cy="47" r="4.2" fill="none" stroke="#f07a1a" stroke-width="2.6"/>`),
  // retratinhos de quem dá depoimento (cabeça de frente, no fundo de cor)
  gansa: portrait('#D9ECF7', `<path d="M22,58 q-2,-18 6,-26 q-6,-6 -2,-14 q4,-8 12,-6 q8,2 7,12 q-1,6 -6,9 q10,8 7,25z" fill="#FFFFFF" ${S}/>`
    + `<path d="M43,17 l11,3 l-11,4z" fill="#F29A2E" ${S}/><circle cx="38" cy="16" r="2" fill="${INK}"/><path d="M34,11 l7,2" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`
    + '<path d="M28,38 q6,3 12,0" fill="none" stroke="#c9d3dd" stroke-width="1.6" stroke-linecap="round"/>'),
  gato: portrait('#F7E2C8', `<path d="M14,20 l3,-12 l9,8z M46,20 l-3,-12 l-9,8z" fill="#9A9AA6" ${S}/><path d="M17,14 l1.4,-4 l3.4,3z M43,14 l-1.4,-4 l-3.4,3z" fill="#F2A7B5"/>`
    + `<ellipse cx="30" cy="30" rx="18" ry="15" fill="#9A9AA6" ${S}/><path d="M22,18 l2,5 M30,16 v5 M38,18 l-2,5" stroke="#6E6E7A" stroke-width="2" stroke-linecap="round"/>`
    + `<ellipse cx="23" cy="29" rx="3" ry="3.6" fill="#C8E07A" ${S}/><ellipse cx="37" cy="29" rx="3" ry="3.6" fill="#C8E07A" ${S}/><path d="M23,27 v4.4 M37,27 v4.4" stroke="${INK}" stroke-width="1.6"/>`
    + `<path d="M28,35 h4 l-2,2.4z" fill="#E58A8A" ${S}/><path d="M30,37.4 q-2,3 -5,2 M30,37.4 q2,3 5,2" fill="none" stroke="${INK}" stroke-width="1.2"/>`
    + `<path d="M8,33 l12,1 M8,38 l12,-1 M52,33 l-12,1 M52,38 l-12,-1" stroke="${INK}" stroke-width=".9"/>`),
  porteiro: portrait('#E7EFE2', `<path d="M8,58 q2,-12 22,-12 q20,0 22,12z" fill="#4E7A5E" ${S}/><path d="M24,46 l6,7 l6,-7" fill="#FFFDF6" ${S}/>`
    + `<ellipse cx="30" cy="31" rx="13" ry="14" fill="#E8B48C" ${S}/><circle cx="17.5" cy="32" r="3" fill="#E0A47C" ${S}/><circle cx="42.5" cy="32" r="3" fill="#E0A47C" ${S}/>`
    + `<circle cx="25" cy="29" r="1.6" fill="${INK}"/><circle cx="35" cy="29" r="1.6" fill="${INK}"/><path d="M28.6,31 q1.4,3 2.8,0" fill="none" stroke="${INK}" stroke-width="1.2"/>`
    + `<path d="M21,37 q4,-3 9,-1 q5,-2 9,1 q-4,3 -9,1 q-5,2 -9,-1z" fill="#5B3A26" ${S}/>`
    + `<path d="M15,21 q15,-12 30,0 l1,3 h-32z" fill="#2E4A6B" ${S}/><path d="M13,24 h34 q-2,4 -17,4 q-15,0 -17,-4z" fill="#22364F" ${S}/><circle cx="30" cy="17" r="2.4" fill="#F2C230" ${S}/>`),
};
/** O retratinho de um depoimento: o cartão com fundo de cor e a carinha (sem letras, sem clipPath: o mesmo desenho
 * aparece várias vezes na página e um id repetido quebraria o recorte). */
function portrait(bg, inner) {
  return `<svg viewBox="0 0 60 60" aria-hidden="true"><rect x="2" y="2" width="56" height="56" rx="7" fill="${bg}"/>${inner}`
    + `<rect x="2" y="2" width="56" height="56" rx="7" fill="none" ${S}/></svg>`;
}

/** Ícones do HUD (24 × 24, contorno de chocolate). */
export const HUD_ICONS = {
  lupa: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.2" fill="#DFF2FF" stroke="#4A3426" stroke-width="2"/><path d="M14.6,14.6 l5.4,5.4" stroke="#4A3426" stroke-width="3" stroke-linecap="round"/><path d="M7.2,8.4 a3.2,3.2 0 0 1 3,-2.4" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`,
  /** O quadro de dedução: a pergunta no alto ligada a dois cartões por fios de luz. */
  quadro: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12,8.4 C12,12 6.5,11 6.5,14.6 M12,8.4 C12,12 17.5,11 17.5,14.6" fill="none" stroke="#F2B544" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="6" r="4" fill="#2B3A63" stroke="#4A3426" stroke-width="1.6"/><path d="M10.6,5 q0,-1.6 1.5,-1.6 q1.5,0 1.5,1.3 q0,1 -1.4,1.5 v.7" fill="none" stroke="#FFE7A8" stroke-width="1.2" stroke-linecap="round"/><circle cx="12.2" cy="8.2" r=".55" fill="#FFE7A8"/><rect x="2.6" y="14.4" width="7.8" height="7" rx="1.4" fill="#FFF6E6" stroke="#4A3426" stroke-width="1.6" transform="rotate(-5 6.5 18)"/><rect x="13.6" y="14.4" width="7.8" height="7" rx="1.4" fill="#FFF6E6" stroke="#4A3426" stroke-width="1.6" transform="rotate(5 17.5 18)"/><path d="M4.6,17.6 h3.6 M4.8,19.4 h2.6 M15.6,17.6 h3.6 M15.8,19.4 h2.6" stroke="#B08A6A" stroke-width="1" stroke-linecap="round"/></svg>`,
  meia: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8,3 h7 v8 l4,5 v4 h-6 l-7,-7z" fill="#FFF4E2" stroke="#4A3426" stroke-width="1.8" stroke-linejoin="round"/><path d="M8,3 h7 v3 h-7z" fill="#E8554A"/><path d="M8.4,9 h6.2 M8.4,11.6 h6.2" stroke="#E8554A" stroke-width="1.6"/></svg>`,
  focinho: `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="13" cy="12" rx="7.5" ry="5.6" fill="#E8C07A" stroke="#4A3426" stroke-width="1.8"/><ellipse cx="15.2" cy="11.2" rx="3" ry="2.2" fill="#4A3426"/><path d="M4.6,7.4 q-2,4.6 0,9.2 M2.2,5.4 q-3,6.6 0,13.2" fill="none" stroke="#F08A3C" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  pular: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4,6 l7,6 l-7,6z M12,6 l7,6 l-7,6z" fill="#FFF6E6" stroke="#4A3426" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  lua: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="18" fill="#FFF3C4" stroke="#2a2318" stroke-width="2"/><circle cx="31" cy="18" r="15" fill="#C69A66"/></svg>`,
  sol: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="11" fill="#FFD84A" stroke="#2a2318" stroke-width="2"/><path d="M24,4 v6 M24,38 v6 M4,24 h6 M38,24 h6 M10,10 l4,4 M34,34 l4,4 M38,10 l-4,4 M10,38 l4,-4" stroke="#2a2318" stroke-width="2" stroke-linecap="round"/></svg>`,
  /** A Radhija de frente, para a carinha que balança a cabeça no mural. */
  radhija: `<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="13" cy="24" rx="6" ry="10" fill="#B8893F" stroke="#2a2318" stroke-width="1.6" transform="rotate(14 13 24)"/><ellipse cx="35" cy="24" rx="6" ry="10" fill="#B8893F" stroke="#2a2318" stroke-width="1.6" transform="rotate(-14 35 24)"/><circle cx="24" cy="24" r="14" fill="#E8C07A" stroke="#2a2318" stroke-width="1.6"/><ellipse cx="24" cy="30" rx="7" ry="5" fill="#F4D9A6" stroke="#2a2318" stroke-width="1.4"/><ellipse cx="24" cy="27.6" rx="3" ry="2.2" fill="#2a2318"/><circle cx="18.5" cy="21" r="2" fill="#2a2318"/><circle cx="29.5" cy="21" r="2" fill="#2a2318"/><circle cx="20" cy="11" r="3" fill="#E8C07A" stroke="#2a2318" stroke-width="1.2"/><circle cx="24" cy="9.6" r="3.2" fill="#E8C07A" stroke="#2a2318" stroke-width="1.2"/><circle cx="28" cy="11" r="3" fill="#E8C07A" stroke="#2a2318" stroke-width="1.2"/></svg>`,
  /** A patinha fantasma do tutorial do mural. */
  pata: `<svg viewBox="0 0 46 46" aria-hidden="true"><g fill="rgba(255,255,255,.92)" stroke="#2a2318" stroke-width="1.4"><path d="M23 18c-6 0-11 6-11 11 0 3 3 5 6 5 2 0 3-1 5-1s3 1 5 1c3 0 6-2 6-5 0-5-5-11-11-11z"/><ellipse cx="10" cy="15" rx="4" ry="5"/><ellipse cx="18" cy="8" rx="4" ry="5"/><ellipse cx="28" cy="8" rx="4" ry="5"/><ellipse cx="36" cy="15" rx="4" ry="5"/></g></svg>`,
};

/** O desenho de um cartão pelo id da pista (o "?" para o que falta). */
export const pictoOf = (id) => PICTOS[id] || PICTOS.q;
/** O desenho de uma pista vindo de um evento: `picto` pode ser o id do desenho ou o próprio SVG (pictoOf já aplicado). */
export const pictoSvg = (picto, id) => (typeof picto === 'string' && picto.trimStart().startsWith('<svg') ? picto : pictoOf(picto || id));
