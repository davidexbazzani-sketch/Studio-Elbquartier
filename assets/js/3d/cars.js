// Die drei Fahrzeuge des Autohaus-Showrooms: Modelle, echte Maße, Lackfarben und
// Materialregeln. Die Modelle stammen aus verschiedenen Quellen (siehe CREDITS.md) und
// haben sehr unterschiedliche Materialien; die Regeln unten machen daraus einheitlich
// glaubwürdige Oberflächen (Lack mit Klarlack, Glas, Chrom, Gummi, Kunststoff).
//
// Regel-Arten (kind):
//   paint      Wagenfarbe (wird beim Farbwechsel getauscht)
//   glass      Scheiben, leicht getönt;  tint: dunkle Privacy-Scheiben
//   lens       klare Scheinwerfer- und Rückleuchtengläser
//   chrome     poliertes Metall;  satin: gebürstetes Aluminium / Felgen
//   tire       Reifengummi;  plastic: genarbter Kunststoff;  gloss: Klavierlack-Schwarz
//   caliper    Bremssattel (lackiert);  rim: Felge mit Textur;  reflector: Scheinwerfer-Reflektor
//   plate      Kennzeichen-Fläche: bekommt ein Händlerschild „HALDEN · HAMBURG“
//   keep       Original lassen (nur Grenzen setzen)
//   hide       nicht anzeigen

const MODELS = '../../assets/models/autos/';

export const CARS = {
  porsche: {
    url: MODELS + 'porsche-911.glb',
    name: '911 Turbo',
    make: 'Porsche',
    year: 1979,
    type: 'Coupé · Klassiker',
    claim: 'Der Urtyp. Luftgekühlt, mit Turbo und dem breitesten Heck seiner Zeit.',
    length: 4.291, // m
    yaw: Math.PI / 2, // Drehung, damit die Front nach +x zeigt
    specs: [
      ['Leistung', '260 PS'],
      ['0–100 km/h', '5,5 s'],
      ['Spitze', '250 km/h'],
      ['Laufleistung', '61.400 km'],
    ],
    price: '189.000 €',
    paints: [
      { id: 'grandprix', name: 'Grand-Prix-Weiß', color: '#e9e7e1', kind: 'solid' },
      { id: 'diamant', name: 'Diamantsilber metallic', color: '#a7a9ab', kind: 'metallic' },
      { id: 'indischrot', name: 'Indischrot', color: '#8f0f12', kind: 'solid' },
      { id: 'schwarz', name: 'Schwarz', color: '#0b0b0c', kind: 'solid' },
    ],
    paint: 'diamant',
    rules: [
      [/^material_0$/, 'hide'], // Schattenfläche aus der Vorlage, wir zeichnen eigene Schatten
      [/^coat$/, 'hide'], // zusätzliche Klarlack-Hülle; übernimmt der Lack selbst
      [/^paint$/, 'paint'],
      [/^glass$/, 'glass'],
      [/^930_lights_refraction$/, 'lens'],
      [/^930_tire$/, 'tire'],
      [/^930_rim$/, 'rim'],
      [/^930_lights$/, 'reflector'],
      [/^930_chromes$/, 'chrome'],
      [/^black$/, 'plastic'],
      [/.*/, 'keep'],
    ],
    credit: { title: 'FREE 1975 Porsche 911 (930) Turbo', author: 'Lionsharp Studios', url: 'https://sketchfab.com/3d-models/free-1975-porsche-911-930-turbo-8568d9d14a994b9cae59499f0dbed21e' },
  },

  ferrari: {
    url: MODELS + 'ferrari-roma.glb',
    name: 'Roma',
    make: 'Ferrari',
    year: 2021,
    type: 'Coupé · 2+2',
    claim: 'Gran Turismo im Stil der Sechziger. 620 PS, die man nicht hört, bis man will.',
    length: 4.656,
    yaw: Math.PI / 2,
    specs: [
      ['Leistung', '620 PS'],
      ['0–100 km/h', '3,4 s'],
      ['Spitze', '320 km/h'],
      ['Laufleistung', '8.900 km'],
    ],
    price: '214.900 €',
    paints: [
      { id: 'titanio', name: 'Grigio Titanio metallic', color: '#4e5257', kind: 'metallic' },
      { id: 'cervino', name: 'Bianco Cervino', color: '#ecebe6', kind: 'solid' },
      { id: 'portofino', name: 'Rosso Portofino', color: '#9a0d10', kind: 'metallic' },
      { id: 'blu', name: 'Blu Roma', color: '#1d2a3c', kind: 'metallic' },
    ],
    paint: 'titanio',
    smoothPaint: true, // Normalen des Lacks weich neu berechnen
    paintSoften: 0.07, // Klarlack etwas weicher: die Karosserie des Modells ist leicht wellig
    rules: [
      [/Paint_Material$/, 'paint'],
      [/Window_Material$/, 'glass'],
      [/^RED_GLASS$/, 'lens'],
      [/^CHROME$/, 'chrome'],
      [/CallipersCalliperGloss/, 'caliper'],
      [/Coloured_Material$/, 'gloss'],
      [/Base_Material$/, 'plastic'],
      [/.*/, 'keep'],
    ],
    credit: { title: '2020 Ferrari Roma', author: 'Ddiaz Design', url: 'https://sketchfab.com/3d-models/2020-ferrari-roma-cbc0c13c0fb54fc8bbfa79a9ff99e3aa' },
  },

  g63: {
    url: MODELS + 'g63.glb',
    name: 'G 63',
    make: 'Mercedes-AMG',
    year: 2023,
    type: 'Geländewagen',
    claim: 'Seit 1979 kantig, heute mit 585 PS. Kein Auto parkt souveräner vor der Oper.',
    length: 4.873,
    yaw: Math.PI / 2,
    specs: [
      ['Leistung', '585 PS'],
      ['0–100 km/h', '4,5 s'],
      ['Spitze', '220 km/h'],
      ['Laufleistung', '12.300 km'],
    ],
    price: '198.500 €',
    paints: [
      { id: 'obsidian', name: 'Obsidianschwarz metallic', color: '#101113', kind: 'metallic' },
      { id: 'magno', name: 'Monzagrau magno', color: '#5d5f60', kind: 'matte' },
      { id: 'opalith', name: 'Opalithweiß magno', color: '#dcdad3', kind: 'matte' },
      { id: 'polar', name: 'Polarweiß', color: '#eeeeea', kind: 'solid' },
    ],
    paint: 'obsidian',
    smoothPaint: true,
    rules: [
      [/^bodypaint$/, 'paint'],
      [/^Scene_-_Root/, 'tire'],
      [/^gt_34$/, 'tire'],
      [/^vehicle_generic_smallspecmap__PAINT_2$/, 'caliper'],
      [/^G900_rocket_urus_27__PAINT_2_0$/, 'satin'], // Felgen-Speichen
      [/^AMG_wheels_color$/, 'gloss'],
      [/^G-class_glass_tint$|^IntWindows$/, 'tint'],
      [/^G-class_glass/, 'glass'],
      [/^amg_texture5$/, 'plate'],
      [/^AMG_silver$|^G-class_speedo_black$|^radiator_silver$|^exhausts_silver$/, 'chrome'],
      [/^G-class_foglights$/, 'lens'],
      [/^G-class_black$|^common_black033$|^window_plastic$|^plastic5$|^black[345]$|^door_handles$|^AMG_sparetire_black$|^nlightsf20$/, 'gloss'],
      [/^trucks_mechanical$|^G-class_underbody$|^gavril|^common_black010|^AMG_dash_black$|^black3$|^interiordfs$/, 'plastic'],
      [/^wiper$|^light1$|^RGB_int$|^common_black020$|^AMG_steering_black$/, 'plastic'],
      [/.*/, 'keep'],
    ],
    credit: { title: 'Mersedes-Benz G63 AMG', author: 'Black Snow', url: 'https://sketchfab.com/3d-models/mersedes-benz-g63-amg-e5e2a1d2238048a1a494b3df983c16bb' },
  },
};

export const ORDER = ['porsche', 'ferrari', 'g63'];
