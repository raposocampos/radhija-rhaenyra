// Prévias compartilham o domínio do Pages, mas salvam progresso/volume por PR.
// Preservar as chaves de produção mantém os saves existentes.
export function storageKey(key, pathname = globalThis.location?.pathname ?? '') {
  const preview = pathname.match(/\/previews\/pr-([1-9]\d*)\/\d+-\d+(?:\/|$)/);
  return preview ? `rr-preview-pr-${preview[1]}:${key}` : key;
}
