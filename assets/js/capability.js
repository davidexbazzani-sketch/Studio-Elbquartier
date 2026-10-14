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
