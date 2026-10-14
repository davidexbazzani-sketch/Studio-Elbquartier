// Die Fahrzeuge des Autohaus-Showrooms: Modelle, echte Maße, Lackfarben und Materialregeln.
// Alle Fahrzeuge sind markenlose Entwürfe (keine Nachbildungen echter Modelle, keine Logos);
// Quellen und Lizenzen siehe CREDITS.md und lizenzen.html. Die Regeln unten machen aus den sehr
// unterschiedlichen Vorlagen einheitlich glaubwürdige Oberflächen (Lack mit Klarlack, Glas, Chrom, Gummi, Kunststoff).
//
// Regel-Arten (kind):
//   paint      Wagenfarbe (wird beim Farbwechsel getauscht)
//   glass      Scheiben, leicht getönt;  tint: dunkle Privacy-Scheiben
//   lens       klare Scheinwerfer- und Rückleuchtengläser
//   chrome     poliertes Metall;  satin: gebürstetes Aluminium / Felgen;  alloy: helle Felge ohne Vorlagen-Textur
//   tire       Reifengummi;  plastic: genarbter Kunststoff;  gloss: Klavierlack-Schwarz
//   caliper    Bremssattel (lackiert);  rim: Felge mit Textur;  reflector: Scheinwerfer-Reflektor
//   plate      Kennzeichen-Fläche: bekommt ein Händlerschild „HALDEN · HAMBURG“
//   keep       Original lassen (nur Grenzen setzen)
//   hide       nicht anzeigen
// rules prüfen den Materialnamen; meshRules (optional, Vorrang) prüfen den Objektnamen.

const MODELS = '../../assets/models/autos/';
const MARKE = 'Halden Edition';

export const CARS = {
  coupe: {
    url: MODELS + 'gt-coupe.glb',
    name: 'GT Coupé',
    make: MARKE,
    year: 2024,
    type: 'Coupé · 2+2',
    claim: 'Lange Haube, kurzes Heck, Platz für zwei und ein Wochenende.',
    length: 4.72,
    yaw: Math.PI / 2,
    specs: [['Leistung', '510 PS'], ['0–100 km/h', '3,9 s'], ['Spitze', '305 km/h'], ['Laufleistung', '6.200 km']],
    price: '164.900 €',
    paints: [
      { id: 'rubin', name: 'Rubinrot metallic', color: '#6e0b10', kind: 'metallic' },
      { id: 'graphit', name: 'Graphit metallic', color: '#3d4045', kind: 'metallic' },
      { id: 'kreide', name: 'Kreideweiß', color: '#e8e6e0', kind: 'solid' },
      { id: 'nacht', name: 'Nachtblau metallic', color: '#16233a', kind: 'metallic' },
    ],
    paint: 'graphit',
    smoothPaint: true,
    rules: [
      [/^car-body$/, 'paint'],
      [/^Glass_ext-tinted$/, 'tint'],
      [/^Glass_ext$/, 'glass'],
      [/^Glass_-_Clear$|^Glass_-_Clear_-_Bumps$|^Glass_-_Clear_-_Ridged/, 'lens'],
      [/^tire-low/, 'tire'],
      [/^wheel-brake-disc$/, 'alloy'],
      [/^black-metal$|^Rubber_-_Black$|^wipers$|^mirror$/, 'plastic'],
      [/.*/, 'keep'],
    ],
    credit: { title: 'Generic Sport Coupé Car', author: 'MMC Works', url: 'https://sketchfab.com/3d-models/generic-sport-coupe-car-820a13c4831c41959ce75e6c2014e882' },
  },

  limousine: {
    url: MODELS + 'limousine.glb',
    name: 'Limousine',
    make: MARKE,
    year: 2023,
    type: 'Limousine · 5 Sitze',
    claim: 'Leise, geräumig, souverän. Für die Autobahn genauso wie für die Elbchaussee.',
    length: 4.95,
    yaw: Math.PI / 2,
    specs: [['Leistung', '340 PS'], ['0–100 km/h', '5,4 s'], ['Spitze', '250 km/h'], ['Laufleistung', '18.700 km']],
    price: '79.800 €',
    paints: [
      { id: 'saphir', name: 'Saphirschwarz metallic', color: '#0e1014', kind: 'metallic' },
      { id: 'silber', name: 'Polarsilber metallic', color: '#a9acaf', kind: 'metallic' },
      { id: 'tiefblau', name: 'Tiefblau metallic', color: '#1a2536', kind: 'metallic' },
      { id: 'weiss', name: 'Alpinweiß', color: '#eceae5', kind: 'solid' },
    ],
    paint: 'saphir',
    smoothPaint: true,
    rules: [
      [/^Car_Paint_-_All_Colors$/, 'paint'],
      [/^Glass_ext-tinted$/, 'tint'],
      [/^Glass_ext$/, 'glass'],
      [/^Glass_-_Clear$|^Glass_-_Clear_-_Bumps$/, 'lens'],
      [/^tire-low$/, 'tire'],
      [/^Metal_-_Chrome_-_Rough$/, 'chrome'],
      [/^Headlight_Metal$/, 'reflector'],
      [/^Plastic_ext_matt$|^Rubber_-_Black$/, 'plastic'],
      [/.*/, 'keep'],
    ],
    credit: { title: 'Generic Sedan Car', author: 'MMC Works', url: 'https://sketchfab.com/3d-models/generic-sedan-car-58c33766470d46e7b2aed542650494e5' },
  },

  suv: {
    url: MODELS + 'suv.glb',
    name: 'SUV',
    make: MARKE,
    year: 2024,
    type: 'SUV · Allrad',
    claim: 'Hoch sitzen, leise reisen. Allrad für den Elbstrand und die Tiefgarage.',
    length: 4.55,
    yaw: Math.PI / 2,
    specs: [['Leistung', '300 PS'], ['0–100 km/h', '6,1 s'], ['Spitze', '230 km/h'], ['Laufleistung', '9.400 km']],
    price: '72.500 €',
    paints: [
      { id: 'bronze', name: 'Bronze metallic', color: '#5b4a39', kind: 'metallic' },
      { id: 'schiefer', name: 'Schiefergrau metallic', color: '#46494d', kind: 'metallic' },
      { id: 'weiss', name: 'Perlweiß', color: '#e6e4de', kind: 'solid' },
      { id: 'schwarz', name: 'Schwarz', color: '#0b0b0c', kind: 'solid' },
    ],
    paint: 'schiefer',
    smoothPaint: true,
    rules: [
      [/^body$/, 'paint'],
      [/^Glass_ext-tinted$/, 'tint'],
      [/^glass-windshield$/, 'glass'],
      [/^glass-headlight-cover$/, 'lens'],
      [/^tire-low$/, 'tire'],
      [/^black-plastic-glossy$/, 'gloss'],
      [/^mirror$|^Car_paint_-_black_matte$/, 'plastic'],
      [/.*/, 'keep'],
    ],
    credit: { title: 'MMC Generic Small SUV Car', author: 'MMC Works', url: 'https://sketchfab.com/3d-models/mmc-generic-small-suv-car-5db696c6ed5d4bdc87905c1040fa072a' },
  },
};

export const ORDER = ['coupe', 'limousine', 'suv'];
