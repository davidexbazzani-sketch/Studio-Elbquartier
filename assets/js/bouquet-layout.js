// Anordnung eines gebundenen Straußes – ohne 3D-Abhängigkeit,
// damit die 3D-Ansicht und die gezeichnete Ersatzansicht identisch arrangieren.
//
// Prinzip wie beim Floristen: Die Stiele kreuzen sich im Bindepunkt (Spiraltechnik),
// die Blüten liegen auf einer Kuppel. Große Blüten in die Mitte, Grün an den Rand,
// jede Sorte über den Strauß verteilt, damit es natürlich gemischt wirkt.

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// 0 = Mitte, 1 = Rand
export const TYPE_PREF = { peony: 0.12, rose: 0.3, tulip: 0.44, lavender: 0.6, gypsophila: 0.66, eucalyptus: 0.86 };
// Abstand Bindepunkt → Blütenansatz
export const TYPE_REACH = { peony: 0.8, rose: 0.84, tulip: 0.9, lavender: 0.9, gypsophila: 0.86, eucalyptus: 0.76 };

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

/** Öffnungswinkel der Kuppel: wenige Blumen eng, viele weit. */
export const capAngle = (n) => Math.min(1.12, 0.36 + 0.14 * Math.sqrt(Math.max(1, n)));

/**
 * @param {{id: string, type: string}[]} stems
 * @returns {{ slots: Map<string, {dir:number[], theta:number, phi:number, reach:number, spin:number}>, cap: number }}
 */
export function layoutBouquet(stems) {
  const n = stems.length;
  const cap = capAngle(n);
  const counts = {};
  const seen = {};
  stems.forEach((s) => { counts[s.type] = (counts[s.type] || 0) + 1; });

  const scored = stems.map((s) => {
    const k = (seen[s.type] = (seen[s.type] ?? -1) + 1);
    const c = counts[s.type];
    const spread = c > 1 ? (k / (c - 1) - 0.5) * 0.55 : 0;
    return { s, pref: TYPE_PREF[s.type] + spread + (hash(s.id) - 0.5) * 0.08 };
  }).sort((a, b) => a.pref - b.pref);

  const slots = new Map();
  scored.forEach(({ s }, i) => {
    const t = (i + 0.5) / n;
    const cosT = 1 - (1 - Math.cos(cap)) * t;
    const theta = Math.acos(cosT);
    const phi = i * GOLDEN + 0.6;
    slots.set(s.id, {
      dir: [Math.sin(theta) * Math.cos(phi), cosT, Math.sin(theta) * Math.sin(phi)],
      theta,
      phi,
      reach: TYPE_REACH[s.type] * (0.97 + hash(s.id + 'r') * 0.06),
      spin: hash(s.id + 's') * Math.PI * 2,
    });
  });
  return { slots, cap };
}
