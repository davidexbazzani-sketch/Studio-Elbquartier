// Entscheidet, ob 3D automatisch geladen wird.
// Schwache Geräte, Datensparmodus und „reduzierte Bewegung“ bekommen die ruhige Ersatzansicht;
// 3D bleibt dort per Button trotzdem abrufbar. ?lite in der Adresse erzwingt die Ersatzansicht.

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Günstige Prüfung ohne Test-Zeichenfläche: Ein extra WebGL-Kontext kostete beim Laden über 100 ms
// (auf Handys ein Vielfaches). Scheitert der 3D-Start trotzdem, zeigen die Seiten ihre Ersatzansicht.
let webgl2;
export function hasWebGL2() {
  webgl2 ??= typeof WebGL2RenderingContext !== 'undefined';
  return webgl2;
}

/**
 * Ruft fn erst auf, wenn jemand die Seite bedient (scrollen, tippen, Maus, Taste), spätestens nach `fallback` ms.
 * Für 3D unterhalb des Startbilds: So rechnet das Handy nicht schon beim Seitenaufbau daran.
 */
export function afterInteraction(fn, { fallback = 10000, events = ['scroll', 'wheel', 'pointerdown', 'pointermove', 'keydown', 'touchstart'] } = {}) {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    events.forEach((ev) => removeEventListener(ev, go));
    fn();
  };
  events.forEach((ev) => addEventListener(ev, go, { passive: true }));
  if (fallback !== Infinity) setTimeout(go, fallback);
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

/**
 * Für 3D unterhalb des ersten Bildschirms: erst starten, wenn wirklich gescrollt wird und das Element in die Nähe kommt.
 * Wer nur den Anfang der Seite ansieht, bekommt so eine ruckelfreie, sofort bedienbare Seite.
 */
export function whenScrolledNear(el, fn, { margin = '400px 0px' } = {}) {
  const io = new IntersectionObserver((list) => {
    if (list.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: margin });
  const go = () => io.observe(el);
  if (window.scrollY > 0) go();
  else afterInteraction(go, { fallback: Infinity, events: ['scroll', 'wheel', 'keydown', 'touchmove'] });
}
