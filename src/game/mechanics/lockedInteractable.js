// Interagível com trava (registro, corda, alavanca…): E perto → a dog fica presa numa ação
// (ex.: 'turn', 'tug') por `duration` s, olhando para `face`; onProgress(t 0..1) anima o prop;
// onDone() no fim. once: true → só uma vez (até reset).
import { reach } from '../puzzleKit.js';

export function createLockedInteractable({ id, x, z, r = 0.6, face = null, duration = 1.0, action = 'turn', once = true, canUse = null, onStart = null, onProgress = null, onDone = null }) {
  const S = { t: -1, dog: null, used: false };

  const available = () => !(once && S.used) && S.t < 0;
  /** A dog `c` pode usar agora (perto e disponível)? */
  function near(c) {
    if (!available()) return false;
    if (canUse && !canUse(c)) return false;
    return reach(c, x, z) < r;
  }
  function start(c) {
    if (!available()) return false;
    S.t = 0;
    S.dog = c.name;
    S.used = true;
    onStart?.(c);
    return true;
  }
  function update(dt) {
    if (S.t < 0) return;
    S.t += dt;
    const k = Math.min(1, S.t / duration);
    onProgress?.(k);
    if (k >= 1) {
      S.t = -1;
      const who = S.dog;
      S.dog = null;
      onDone?.(who);
    }
  }
  function lockFor(name) {
    if (S.t < 0 || S.dog !== name) return null;
    const f = face || { x, z };
    return { action, faceX: f.x, faceZ: f.z };
  }
  function reset() {
    S.t = -1;
    S.dog = null;
    S.used = false;
  }
  /** Marca como já usado (depuração / ?stage=). */
  function markUsed() {
    S.used = true;
    S.t = -1;
    S.dog = null;
  }
  return {
    id, x, z, near, start, update, lockFor, reset, markUsed,
    get running() { return S.t >= 0; },
    get used() { return S.used; },
    get dog() { return S.dog; },
    info: () => ({ running: S.t >= 0, used: S.used, t: S.t < 0 ? null : +(S.t / duration).toFixed(2) }),
  };
}
