// Entscheidet, ob 3D automatisch geladen wird.
// Schwache Geräte, Datensparmodus und „reduzierte Bewegung“ bekommen die ruhige Ersatzansicht;
// 3D bleibt dort per Button trotzdem abrufbar. ?lite in der Adresse erzwingt die Ersatzansicht.

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function hasWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch (_) {
    return false;
  }
}

/**
 * Ruft fn erst auf, wenn jemand die Seite bedient (scrollen, tippen, Maus, Taste), spätestens nach `fallback` ms.
 * Für 3D unterhalb des Startbilds: So rechnet das Handy nicht schon beim Seitenaufbau daran.
 */
export function afterInteraction(fn, { fallback = 10000 } = {}) {
  const events = ['scroll', 'wheel', 'pointerdown', 'pointermove', 'keydown', 'touchstart'];
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    events.forEach((ev) => removeEventListener(ev, go));
    fn();
  };
  events.forEach((ev) => addEventListener(ev, go, { passive: true }));
  setTimeout(go, fallback);
}

export function can3D() {
  if (new URLSearchParams(location.search).has('lite')) return { ok: false, why: 'Leichte Ansicht.' };
  if (!hasWebGL2()) return { ok: false, why: 'Ihr Browser unterstützt kein WebGL 2.' };
  if (reducedMotion) return { ok: false, why: 'Reduzierte Bewegung ist aktiv, daher die ruhige Ansicht.' };
  if (navigator.connection?.saveData) return { ok: false, why: 'Datensparmodus aktiv, daher die leichte Ansicht.' };
  if ((navigator.deviceMemory ?? 8) < 4 || (navigator.hardwareConcurrency ?? 8) < 4) {
    return { ok: false, why: 'Vereinfachte Ansicht für dieses Gerät.' };
  }
  return { ok: true };
}
