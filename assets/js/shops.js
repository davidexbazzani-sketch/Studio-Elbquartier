// Gemeinsame Daten für die Drehscheibe (3D) und die Ersatzansicht.
// Farben stammen aus dem Design System (Pastell-Akzente + zwei Illustrationstöne).

const ALLE = [
  {
    id: 'juwelier',
    type: 'Juwelier',
    name: 'Holst & Tochter',
    district: 'Neuer Wall',
    teaser: 'Schmuck in 3D – drehen, zoomen, funkeln lassen.',
    url: 'beispiele/juwelier/',
    colors: { body: '#dfe6ea', deep: '#637b88', trim: '#c9d4da' },
  },
  {
    id: 'blumen',
    type: 'Blumenladen',
    name: 'Blütenkontor',
    district: 'Ottensen',
    teaser: 'Strauß selbst zusammenstellen, Preis live sehen.',
    url: 'beispiele/blumenladen/',
    colors: { body: '#dde4d4', deep: '#6f8263', trim: '#c8d3bd' },
  },
  {
    id: 'restaurant',
    type: 'Restaurant',
    name: 'Fährhaus Zwölf',
    district: 'Övelgönne',
    teaser: 'Karte ansehen, Team kennenlernen, Tisch reservieren.',
    url: 'beispiele/restaurant/',
    colors: { body: '#f1ddd7', deep: '#b07a6d', trim: '#e6c8bf' },
  },
  {
    id: 'cafe',
    type: 'Café',
    name: 'Kaffeehaus Möwe',
    district: 'Altona',
    teaser: 'Vier Lieblingsgetränke in kurzen Filmen, zum Vorbestellen.',
    url: 'beispiele/cafe/',
    colors: { body: '#efe3cc', deep: '#a88a5f', trim: '#e2d1b2' },
  },
  {
    id: 'bar',
    type: 'Bar',
    name: 'Nachtfalter',
    district: 'Sternschanze',
    teaser: 'Jeder Drink in seinem schönsten Moment, als Film.',
    url: 'beispiele/bar/',
    colors: { body: '#dcd6e4', deep: '#6e6488', trim: '#c9c1d6' },
  },
  {
    id: 'boutique',
    type: 'Boutique',
    name: 'Linnen & Lou',
    district: 'Eppendorf',
    teaser: 'Leinen zum Anfassen in 3D, Lookbook und Anprobe.',
    url: 'beispiele/boutique/',
    colors: { body: '#ede7dd', deep: '#2b2722', trim: '#ddd5c8' },
  },
  {
    id: 'autohaus',
    // vorerst nicht veröffentlicht: Automodelle mit Hersteller-Marken, zwei vermutlich aus Spielen (siehe README „Rechte“)
    aus: true,
    type: 'Autohaus',
    name: 'Halden Automobile',
    district: 'HafenCity',
    teaser: 'Showroom in 3D: jedes Auto umrunden, heranzoomen, Farbe wählen.',
    url: 'beispiele/autohaus/',
    colors: { body: '#e4e4e2', deep: '#4b4f53', trim: '#d0d1d1' },
  },
  {
    id: 'getraenke',
    type: 'Getränke-Shop',
    name: 'FUNKL',
    district: 'Online',
    teaser: 'Energy-Drink mit Motion Graphics und beschlagenen Dosen in 3D.',
    url: 'beispiele/getraenke/',
    colors: { body: '#ffe6ad', deep: '#ff2f7d', trim: '#ffd27a' },
  },
  {
    id: 'immobilien',
    type: 'Immobilienmakler',
    name: 'Solmund',
    district: 'Elbvororte',
    teaser: 'Film, fünf Objekte und eine Wohnung mit Elbblick zum Begehen in 3D.',
    url: 'beispiele/immobilien/',
    colors: { body: '#ebe5da', deep: '#7d7262', trim: '#d9d0c2' },
  },
  {
    id: 'brillen',
    type: 'Optiker',
    name: 'Klarsund',
    district: 'Winterhude',
    teaser: 'Brillen in 3D und Live-Anprobe mit der Kamera – Foto inklusive.',
    url: 'beispiele/brillen/',
    colors: { body: '#e6e9ea', deep: '#2f4550', trim: '#d2d8db' },
  },
];

/** Läden auf der Startseite (ausgeblendete bleiben im Code, werden aber nicht gezeigt). */
export const SHOPS = ALLE.filter((s) => !s.aus);

// ---------------------------------------------------------------------------
// Flache SVG-Fassade für die Ersatzansicht (schwache Geräte, reduzierte Bewegung)
// ---------------------------------------------------------------------------

const ICONS = {
  juwelier: (c) => `
    <ellipse cx="160" cy="44" rx="25" ry="25" fill="none" stroke="#d9b877" stroke-width="7"/>
    <path d="M150 18 l10 -12 l10 12 l-10 9z" fill="#fff" stroke="${c.deep}" stroke-width="1.5" stroke-linejoin="round"/>`,
  blumen: (c) => `
    <path d="M146 70 h28 l-4 -22 h-20z" fill="${c.deep}"/>
    <path d="M152 48 q-6 -18 -14 -26 M160 48 v-30 M168 48 q6 -18 14 -26" stroke="${c.deep}" stroke-width="2.5" fill="none"/>
    <path d="M131 26 q7 -14 14 0 q-7 6 -14 0z" fill="#e7b9ad"/>
    <path d="M153 18 q7 -16 14 0 q-7 7 -14 0z" fill="#f4e4dc"/>
    <path d="M175 26 q7 -14 14 0 q-7 6 -14 0z" fill="#e7b9ad"/>`,
  restaurant: () => `
    <ellipse cx="160" cy="66" rx="34" ry="5" fill="#d8d2c8"/>
    <path d="M132 64 a28 28 0 0 1 56 0z" fill="#e9e6e1" stroke="#c9c3ba" stroke-width="1.5"/>
    <circle cx="160" cy="34" r="4" fill="#c9c3ba"/>`,
  cafe: (c) => `
    <ellipse cx="160" cy="68" rx="30" ry="5" fill="#e8e2d8"/>
    <path d="M138 36 h40 v10 a20 20 0 0 1 -40 0z" fill="#fffdf9" stroke="${c.deep}" stroke-width="1.5"/>
    <path d="M178 42 a7 7 0 0 1 0 14" fill="none" stroke="${c.deep}" stroke-width="3"/>
    <path d="M150 28 q-4 -8 0 -14 M160 28 q-4 -8 0 -14 M170 28 q-4 -8 0 -14" stroke="${c.deep}" stroke-width="1.5" fill="none" opacity=".5"/>`,
  bar: (c) => `
    <path d="M136 22 h48 l-24 24z" fill="#f3c9cf" stroke="${c.deep}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M160 46 v20 M148 68 h24" stroke="${c.deep}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="170" cy="24" r="5" fill="#9aa86b"/>`,
  autohaus: (c) => `
    <path d="M118 62 h84 q6 0 6 -8 q-10 -6 -26 -7 q-10 -14 -28 -14 q-16 0 -26 13 q-10 2 -10 10 q0 6 0 6z" fill="${c.deep}"/>
    <path d="M140 46 q8 -10 18 -10 q12 0 20 10z" fill="#d8dcdf"/>
    <circle cx="136" cy="63" r="7" fill="#1f1c18"/><circle cx="136" cy="63" r="3" fill="#e7e4df"/>
    <circle cx="186" cy="63" r="7" fill="#1f1c18"/><circle cx="186" cy="63" r="3" fill="#e7e4df"/>`,
  getraenke: (c) => `
    <rect x="146" y="22" width="28" height="48" rx="6" fill="${c.deep}"/>
    <rect x="148" y="16" width="24" height="8" rx="3" fill="#d9dbde"/>
    <path d="M152 58 V34 M152 34 h8 M152 45 h6" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M186 20 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z" fill="#ffd23f"/>`,
  immobilien: (c) => `
    <path d="M128 70 h64 v-30 h-64z" fill="#fbf8f2" stroke="${c.deep}" stroke-width="1.5"/>
    <path d="M122 40 h76" stroke="${c.deep}" stroke-width="3" stroke-linecap="round"/>
    <path d="M150 70 v-20 h20 v20" fill="#d8c9ad" stroke="${c.deep}" stroke-width="1.2"/>
    <path d="M134 48 h10 v10 h-10z M176 48 h10 v10 h-10z" fill="#c9d3d8"/>
    <path d="M168 22 a12 12 0 0 1 24 0" fill="none" stroke="#b39463" stroke-width="2.5"/>`,
  brillen: (c) => `
    <circle cx="143" cy="44" r="15" fill="#f4f6f7" stroke="${c.deep}" stroke-width="3"/>
    <circle cx="177" cy="44" r="15" fill="#f4f6f7" stroke="${c.deep}" stroke-width="3"/>
    <path d="M158 42 q2 -4 4 0" fill="none" stroke="${c.deep}" stroke-width="3"/>
    <path d="M128 40 l-10 -4 M192 40 l10 -4" stroke="${c.deep}" stroke-width="3" stroke-linecap="round"/>`,
  boutique: (c) => `
    <path d="M160 14 a5 5 0 1 1 5 5 v4 l26 14 h-62 l26 -14" fill="none" stroke="${c.deep}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M150 36 h20 l4 10 l10 26 h-48 l10 -26z" fill="#ecd0c8"/>`,
};

export function facadeSVG(shop) {
  const c = shop.colors;
  const stripes = Array.from({ length: 9 }, (_, i) =>
    i % 2 ? '' : `<path d="M${62 + i * 22} 128 h22 l-4 26 h-22z" fill="${c.deep}" opacity=".85"/>`
  ).join('');
  return `
<svg viewBox="0 0 320 300" role="img" aria-label="${shop.type} ${shop.name}" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="160" cy="276" rx="130" ry="12" fill="#1f1c18" opacity=".06"/>
  <rect x="44" y="254" width="232" height="16" rx="6" fill="${c.trim}"/>
  <rect x="58" y="86" width="204" height="170" rx="12" fill="${c.body}"/>
  <rect x="52" y="78" width="216" height="16" rx="6" fill="${c.trim}"/>
  <rect x="96" y="98" width="128" height="24" rx="5" fill="#fffdf9"/>
  <text x="160" y="115" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-style="italic" font-size="16" fill="#1f1c18">${shop.name}</text>
  <path d="M58 128 h204 l-4 26 h-196z" fill="#fffdf9"/>
  ${stripes}
  <rect x="78" y="166" width="104" height="72" rx="6" fill="${c.deep}" opacity=".9"/>
  <rect x="82" y="170" width="96" height="64" rx="4" fill="#fff4e0"/>
  <rect x="82" y="170" width="96" height="64" rx="4" fill="url(#g-${shop.id})"/>
  <rect x="198" y="164" width="46" height="90" rx="5" fill="${c.deep}"/>
  <circle cx="236" cy="212" r="2.5" fill="#e3c88f"/>
  <g transform="translate(0 4)">${ICONS[shop.id](c)}</g>
  <defs>
    <linearGradient id="g-${shop.id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".7"/>
      <stop offset=".5" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
</svg>`;
}
