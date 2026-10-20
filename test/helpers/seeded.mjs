// Sorteio com semente para os testes: as dogs começam com a fase da passada, o relógio e as piscadas sorteados
// (Math.random); com a semente, cada caso se repete igual em qualquer máquina e dá para medir muitas amostras.

/** Gerador mulberry32 (rápido e bom o bastante para testes). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roda fn com Math.random trocado por um gerador com a semente `seed` (e devolve o resultado de fn). */
export function withSeed(seed, fn) {
  const orig = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

/** Roda fn com a semente, também quando fn é assíncrona (o Math.random original volta no fim). */
export async function withSeedAsync(seed, fn) {
  const orig = Math.random;
  Math.random = mulberry32(seed);
  try {
    return await fn();
  } finally {
    Math.random = orig;
  }
}
