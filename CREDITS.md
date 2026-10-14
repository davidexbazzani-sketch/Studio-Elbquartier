# Quellen & Lizenzen

Alle Dateien liegen lokal auf dem eigenen Server. Es werden keine externen Dienste, Schriften oder Skripte nachgeladen.

## Programmbibliotheken

| Datei | Quelle | Version | Lizenz |
|---|---|---|---|
| `assets/vendor/three/*` | [three.js](https://threejs.org), über npm/jsDelivr | 0.186.1 | MIT (siehe `assets/vendor/three/LICENSE`) |
| `assets/vendor/three/addons/environments/RoomEnvironment.js`, `geometries/RoundedBoxGeometry.js`, `loaders/HDRLoader.js`, `utils/BufferGeometryUtils.js` | three.js Beispiel-Module | 0.186.1 | MIT |
| `assets/vendor/three/addons/loaders/GLTFLoader.js`, `libs/meshopt_decoder.module.js`, `utils/SkeletonUtils.js`, `postprocessing/*` (EffectComposer, RenderPass, ShaderPass, MaskPass, Pass, GTAOPass, OutputPass), `shaders/*` (Copy, Output, GTAO, PoissonDenoise), `math/SimplexNoise.js` | three.js Beispiel-Module (Autohaus-Showroom) | 0.186.1 | MIT |
| `assets/vendor/gsap/gsap.min.js`, `ScrollTrigger.min.js` | [GSAP](https://gsap.com), über npm/jsDelivr | 3.15.0 | GSAP Standard „No Charge“ License (kostenlos, auch kommerziell): https://gsap.com/standard-license |

Nur zum Berechnen der Bilder, nicht auf dem Server (Ordner `tools/vendor/`, Änderungen in `tools/vendor/AENDERUNGEN.txt`):

| Datei | Quelle | Version | Lizenz |
|---|---|---|---|
| `tools/vendor/three-gpu-pathtracer/` | [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) von Garrett Johnson | 0.0.26 | MIT |
| `tools/vendor/three-mesh-bvh/` | [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) von Garrett Johnson | 0.9.15 | MIT |
| `tools/vendor/three-addons/postprocessing/Pass.js` | three.js Beispiel-Modul | 0.186.1 | MIT |

## Schriften

| Datei | Schrift | Quelle | Lizenz |
|---|---|---|---|
| `assets/fonts/inter-latin-wght.woff2` | Inter (variabel) von Rasmus Andersson | Fontsource | SIL Open Font License 1.1 |
| `assets/fonts/instrument-serif-*.woff2` | Instrument Serif von Instrument | Fontsource | SIL Open Font License 1.1 |
| `assets/fonts/fraunces-*.woff2` | Fraunces (variabel) von Undercase Type | Fontsource | SIL Open Font License 1.1 |
| `assets/fonts/cormorant-garamond-*.woff2` | Cormorant Garamond (variabel) von Christian Thalmann | Fontsource | SIL Open Font License 1.1 |
| `assets/fonts/bodoni-moda-*.woff2` | Bodoni Moda (variabel) von Owen Earl (indestructible type*) | Fontsource | SIL Open Font License 1.1 |
| `assets/fonts/bricolage-grotesque-wght.woff2` | Bricolage Grotesque (variabel) von Mathieu Triay | Fontsource | SIL Open Font License 1.1 |
| `assets/fonts/gloock-400.woff2` | Gloock von Duarte Pinto | Fontsource | SIL Open Font License 1.1 |

## HDRIs (Umgebungslicht)

| Datei | Name | Urheber | Quelle | Lizenz |
|---|---|---|---|---|
| `assets/hdri/studio_small_09_1k.hdr` | Studio Small 09 (1K) | Sergej Majboroda | [Poly Haven](https://polyhaven.com/a/studio_small_09) | CC0 1.0 (gemeinfrei, kommerziell frei nutzbar, keine Namensnennung nötig) |
| `tools/hdri/warm_bar_1k.hdr` (nur zum Rendern) | Warm Bar (1K) | Greg Zaal, Jarod Guest | [Poly Haven](https://polyhaven.com/a/warm_bar) | CC0 1.0 |

Im Code werden die HDRIs aufbereitet: für den Schmuck eine weiche Softbox von oben und eine aufgehellte Variante („Lichtzelt“) für die Metallreflexe (`assets/js/3d/viewer.js`). Für die früheren, gerechneten Drink-Bilder der Bar (heute im Archiv `tools/archiv/bar-spin/`, nicht mehr auf der Website) beleuchtete das HDRI die Szene, ergänzt um Lichtstreifen wie in der Getränkefotografie (`tools/bake-bar-spin.html`).

## Grafiken & 3D

| Element | Herkunft | Lizenz |
|---|---|---|
| Logo, Favicon, Laden-Illustrationen (SVG) | selbst erstellt | eigene Arbeit |
| 3D-Läden auf der Drehscheibe | im Code aus Grundformen erzeugt (`assets/js/turntable.js`) | eigene Arbeit |
| Umgebungslicht der Drehscheibe | `RoomEnvironment` aus three.js (prozedural, keine Bilddatei) | MIT |
| Schmuck: Brillantschliff, Diamant-Shader, Ringe, Ohrstecker, Anhänger mit Kette, Armreif, Perlen | im Code modelliert (`assets/js/3d/brilliant.js`, `diamond-material.js`, `jewelry.js`) | eigene Arbeit |
| Schmuckbilder `assets/img/juwelier/*.webp` | aus denselben 3D-Modellen gerendert (`tools/bake-juwelier.html`) | eigene Arbeit |
| Blumen im Strauß-Konfigurator (Rose, Pfingstrose, Tulpe, Eukalyptus, Schleierkraut, Lavendel), Papier und Satinband | im Code modelliert (`assets/js/3d/flowers.js`, `bouquet.js`), gezeichnete Ersatzansicht in `beispiele/blumenladen/bouquet-2d.js` | eigene Arbeit |
| Bar: sechs Drinks mit Coupette, Copa-Glas, Tumbler, Martinischale, Weinglas und Kupferbecher, Flüssigkeiten, Eis, Perlage, Zitronenzeste, Hornveilchen, Orangen- und Limettenscheiben, Limettenschnitz, Minze, Gurkenband, Wacholder, Kaffeebohnen, Crema, Steintheke | im Code modelliert (`tools/models/drinks.js`, die Theke in `tools/bake-bar-spin.html`) | eigene Arbeit |
| Drehbilder `tools/archiv/bar-spin/<drink>/*.webp` (je Drink eine volle Drehung; Archiv, auf der Website ersetzt durch Filme) | aus denselben 3D-Modellen mit Path Tracing gerechnet: echte Lichtbrechung, Absorption in Flüssigkeit und Eis, Spiegelung auf der Theke, Schärfentiefe; eigener Rauschfilter (Non-Local Means nach Rousselle, Knaus und Zwicker 2012). Werkzeug: `tools/bake-bar-spin.html` | eigene Arbeit |
| Boutique: Leinentuch als Stoffsimulation (Verlet-Integration, greifbar), Holzstab, Preisanhänger, Kalkwand | im Code berechnet (`assets/js/3d/cloth.js`); die Gewebestruktur stammt aus dem Foto `leinen-textur.webp` (siehe unten) | eigene Arbeit |
| Ersatzbilder `assets/img/boutique/stoff-*.webp` | aus derselben Stoffsimulation gerendert (`tools/bake-boutique.html`) | eigene Arbeit |
| Autohaus: Showroom (Raum, Lichtbänder, polierter Boden mit Spiegelung, Kontaktschatten, Drehscheibe), Lack-, Glas- und Materialaufbereitung, Händlerschild, Logo „Halden“ | im Code erzeugt (`assets/js/3d/showroom.js`, `cars.js`) | eigene Arbeit |
| Autohaus-Bilder `assets/img/autohaus/{porsche,ferrari,g63,karte-*}.webp` | aus dem 3D-Showroom gerendert (`tools/autohaus-showroom.html?bake`) | eigene Arbeit mit den Modellen unten |

| FUNKL: Marke, Logo, Dosen-Etiketten, Dose (Geometrie), Kondenswasser-Simulation, Motion-Graphics-Intro, Zutaten (Mango, Maracuja, Melone, Limette, Blaubeere, Yuzu) | im Code erzeugt (`assets/js/3d/can.js`, `funkl-hero.js`, `funkl-showcase.js`, `funkl-data.js`), Schrift Bricolage Grotesque (OFL) | eigene Arbeit |
| FUNKL-Bilder `assets/img/funkl/*.webp` | aus denselben 3D-Szenen gerendert (`tools/funkl-bake.html`) | eigene Arbeit |

### 3D-Früchte (FUNKL)

Fotogrammetrie-Scans, am 10./11. Oktober 2026 heruntergeladen (Sketchfab über das Konto des Teams, Poly Haven direkt), mit glTF-Transform verkleinert (Geometrie vereinfacht, Texturen WebP 1024 px, Meshopt) und im Code mit Licht-Material versehen. Originale in `tools/models/quelle/` (nicht hochladen). Die Namensnennung steht auch im Seitenfuß von FUNKL.

| Datei (`assets/models/funkl/`) | Modell | Urheber | Lizenz | Quelle |
|---|---|---|---|---|
| `mango-ganz.glb` | Mango (abgeleitet von „Small Mango #2“ von mjkzz, CC BY 4.0) | Meerschaum Digital | CC BY 4.0 | [Sketchfab](https://sketchfab.com/3d-models/mango-e5fd174d7a2e4ac894e3e69a4550d1e2) |
| `mango-scheibe.glb` | Mango Slice Without Pit 3D Fruit Scan | Arkify 3D | CC BY 4.0 | [Sketchfab](https://sketchfab.com/3d-models/mango-slice-without-pit-3d-fruit-scan-1a8acf811bbe4b05bb32c55a8528b286) |
| `mango-kern.glb` | Mango Slice With Pit 3D Fruit Scan | Arkify 3D | CC BY 4.0 | [Sketchfab](https://sketchfab.com/3d-models/mango-slice-with-pit-3d-fruit-scan-103e066a3c9545e4b3bfd2f176b38f52) |
| `melone-stueck.glb` | slice of watermelon | sv1nks | CC BY 4.0 | [Sketchfab](https://sketchfab.com/3d-models/slice-of-watermelon-9cd77994e4ae48c084698000133c8a76) |
| `limette-scheibe.glb` | Lime Slice 3D Scan | Arkify 3D | CC BY 4.0 | [Sketchfab](https://sketchfab.com/3d-models/lime-slice-3d-scan-9a1c7a00013745ab8b79be940e77f824) |
| `blaubeere.glb` | Gourmet Blueberry (Material in Metall/Rauheit umgewandelt) | inciprocal | CC BY 4.0 | [Sketchfab](https://sketchfab.com/3d-models/gourmet-blueberry-62f6c6368c484dd6a85a2a162133d2e0) |
| `yuzu.glb` (Ersatz, falls die Zitrone fehlt; derzeit nicht angezeigt) | Yuzu (Japanese) Orange – Polycam | rocknrodent | CC BY 4.0 | [Sketchfab](https://sketchfab.com/3d-models/yuzu-japanese-orange-polycam-fb57d2cf33af44349e11161069ae222c) |
| `limette.glb` | Food Lime 01 | Poly Haven | CC0 | [polyhaven.com/a/food_lime_01](https://polyhaven.com/a/food_lime_01) |
| `zitrone.glb` (steht für die Yuzu) | Lemon | Poly Haven | CC0 | [polyhaven.com/a/lemon](https://polyhaven.com/a/lemon) |

Licht und Spiegelungen der FUNKL-Dosen kommen aus dem Studio-HDRI `assets/hdri/studio_small_09_1k.hdr` (Poly Haven, CC0, siehe oben).

### 3D-Automodelle (Autohaus)

Seit 14. Oktober 2026 zeigt das Autohaus nur noch **markenlose Fahrzeuge**: eigene Entwürfe des Urhebers, keine Nachbildungen echter Modelle, keine Logos. Alle unter [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) (Namensnennung, gewerbliche Nutzung erlaubt), über das Sketchfab-Konto des Teams geladen, mit glTF-Transform verkleinert und im Showroom neu materialisiert/lackiert. Die Namensnennung steht im Seitenfuß des Autohauses und in `lizenzen.html`. Originale in `tools/models/quelle/` (nicht hochladen).

| Datei (`assets/models/autos/`) | Im Showroom | Modell | Urheber | Quelle |
|---|---|---|---|---|
| `gt-coupe.glb` | GT Coupé | Generic Sport Coupé Car | MMC Works | [Sketchfab](https://sketchfab.com/3d-models/generic-sport-coupe-car-820a13c4831c41959ce75e6c2014e882) |
| `limousine.glb` | Limousine | Generic Sedan Car | MMC Works | [Sketchfab](https://sketchfab.com/3d-models/generic-sedan-car-58c33766470d46e7b2aed542650494e5) |
| `suv.glb` | SUV | MMC Generic Small SUV Car | MMC Works | [Sketchfab](https://sketchfab.com/3d-models/mmc-generic-small-suv-car-5db696c6ed5d4bdc87905c1040fa072a) |

Die früheren Modelle (Porsche 911, Ferrari Roma, Mercedes G63) und der Intro-Film mit einer G-Klasse sind nicht mehr auf der Website: Hersteller-Designs und -Marken sind durch die CC-Lizenz nicht gedeckt, und die Herkunft zweier Modelle war nicht eindeutig belegt. Sie liegen nur noch in `tools/models/autos-quelle/marken/` und `tools/archiv/autohaus-alt/` (nicht hochladen, nicht im GitHub-Repository).

## Fotos & Videos

Alle Fotos stammen von [Unsplash](https://unsplash.com) und stehen unter der [Unsplash-Lizenz](https://unsplash.com/license): kostenlos für kommerzielle und nicht-kommerzielle Nutzung, keine Erlaubnis und keine Namensnennung nötig (wir nennen die Urheber trotzdem). Nicht erlaubt: die Fotos unverändert zu verkaufen oder einen vergleichbaren Bilderdienst damit aufzubauen. Alle wurden beim Herunterladen geprüft (2. bis 4. Oktober 2026; frei, nicht „Unsplash+“), lokal als WebP gespeichert und zugeschnitten. Auf den Fotos sind keine erkennbaren Gesichter und keine echten Firmennamen zu sehen.

| Datei (`assets/img/blumen/`) | Motiv | Fotograf/in | Quelle |
|---|---|---|---|
| `hero-schaufenster.webp`, `hero-schaufenster-mobil.webp` | Schaufenster mit Rosen und Ranunkeln in Eimern | Alisa Anton | [unsplash.com/photos/D4Blldtly00](https://unsplash.com/photos/D4Blldtly00) |
| `strauss-ottensen.webp` | Strauß mit Pfingstrosen, Rosen und Eukalyptus in Kraftpapier | Sammi (@splendidmusings) | [unsplash.com/photos/CCk6ZbuOW2w](https://unsplash.com/photos/CCk6ZbuOW2w) |
| `strauss-elbfruehling.webp` | Rosa Tulpen in braunem Papier | Polina Zimenkova | [unsplash.com/photos/xX3m0OHerFY](https://unsplash.com/photos/xX3m0OHerFY) |
| `strauss-spaetsommer.webp` | Spätsommerstrauß mit Dahlie | Matthew Nevins Bell | [unsplash.com/photos/hg0EDH34Nm0](https://unsplash.com/photos/hg0EDH34Nm0) |
| `strauss-pfingstrosen.webp` | Weiße Pfingstrosen in Kraftpapier | Alina Karpenko | [unsplash.com/photos/WCkWGoHHNOM](https://unsplash.com/photos/WCkWGoHHNOM) |
| `handwerk-binden.webp` | Hände binden einen Strauß | Viktoriia Yatsentiuk | [unsplash.com/photos/3DyfEiITFz4](https://unsplash.com/photos/3DyfEiITFz4) |
| `handwerk-pfingstrosen.webp` | Rosa Pfingstrosen mit Eukalyptus | Bonnie Kittle | [unsplash.com/photos/BjvINSPxoOc](https://unsplash.com/photos/BjvINSPxoOc) |

| Datei (`assets/img/restaurant/`) | Motiv | Fotograf/in | Quelle |
|---|---|---|---|
| `hero-gastraum.webp` | Gedeckter Tisch im warm beleuchteten Gastraum | Nikita Tikhomirov | [unsplash.com/photos/zUQeFiobRYs](https://unsplash.com/photos/zUQeFiobRYs) |
| `elbe-oevelgoenne.webp` | Elbstrand mit Häusern am Hang | Victoria Prymak | [unsplash.com/photos/T8SstBQbvaw](https://unsplash.com/photos/T8SstBQbvaw) |
| `gericht-scholle.webp` | Gebratener Fisch mit Kartoffeln | Farhad Ibrahimzade | [unsplash.com/photos/X9h-2CptvKw](https://unsplash.com/photos/X9h-2CptvKw) |
| `gericht-zander.webp` | Fischfilet mit Blattsalat und Sauce | Neon Wang | [unsplash.com/photos/hc1TswjkUJo](https://unsplash.com/photos/hc1TswjkUJo) |
| `gericht-vorspeise.webp` | Pochiertes Ei mit Kroketten | Nima Naseri | [unsplash.com/photos/7yadCXv7BwY](https://unsplash.com/photos/7yadCXv7BwY) |
| `gericht-dessert.webp` | Stück Schokoladentorte | Will Echols | [unsplash.com/photos/P_l1bJQpQF0](https://unsplash.com/photos/P_l1bJQpQF0) |
| `koch.webp` | Hände eines Kochs richten Fisch auf blauen Tellern an | Enmanuel Abreu | [unsplash.com/photos/jNH7zaOLLc8](https://unsplash.com/photos/jNH7zaOLLc8) |
| `team.webp` | Zwei Köche richten gemeinsam an (Ausschnitt ohne Gesichter) | Trình Minh Thư | [unsplash.com/photos/Wpzd4dQDmfQ](https://unsplash.com/photos/Wpzd4dQDmfQ) |
| `reservierung.webp` | Gedeckter Tisch vor einem runden Fenster mit Meerblick im Abendlicht | Romain Gal | [unsplash.com/photos/rGAoOn1p_e0](https://unsplash.com/photos/rGAoOn1p_e0) |

| Datei (`assets/img/bar/`) | Motiv | Fotograf/in | Quelle |
|---|---|---|---|
| `bar-tresen.webp`, `bar-tresen-mobil.webp` | Tresen mit beleuchteten Flaschenregalen und Barhockern (Flaschenregale leicht weichgezeichnet, Etiketten unlesbar, 13.10.2026) | Shawn DENG | [unsplash.com/photos/nsgzQHsxbXE](https://unsplash.com/photos/nsgzQHsxbXE) |
| `bar-einschenken.webp` | Barkeeper gießt mit dem Messbecher über Eis | Louis Hansel | [unsplash.com/photos/yLUvnCFI500](https://unsplash.com/photos/yLUvnCFI500) |
| `bar-mixen.webp` | Drink wird aus dem Shaker in eine Cocktailschale gegossen | Michael Cummins | [unsplash.com/photos/FdmsRk1DVns](https://unsplash.com/photos/FdmsRk1DVns) |
| `bar-drink-hand.webp` | Hand reicht einen Drink in der Coupette | Hybrid Storytellers | [unsplash.com/photos/rHNFyTwlqx8](https://unsplash.com/photos/rHNFyTwlqx8) |

Auf der Tresen-Aufnahme stehen Flaschen im Hintergrund; die Regale sind weichgezeichnet, sodass keine Etiketten lesbar sind. Originale aller retuschierten Bilder: `tools/archiv/bilder-original/` (Werkzeug `tools/bilder/retusche.mjs`).

| Datei (`assets/img/cafe/`) | Motiv | Fotograf/in | Quelle |
|---|---|---|---|
| `cafe-fenster.webp` | Heller Tresen am großen Fenster, draußen ein Baum (links beschnitten: Porträtfoto und Zeitschriften an der Wand, 13.10.2026) | Dmitrii Filatov | [unsplash.com/photos/j6ERcKXdlXw](https://unsplash.com/photos/j6ERcKXdlXw) |
| `cafe-barista.webp` | Milchschaum wird zu einem Herz gegossen | Nathan Dumlao | [unsplash.com/photos/2z3MOB3kfJU](https://unsplash.com/photos/2z3MOB3kfJU) |
| `cafe-roesten.webp` | Kaffeebohnen in der Trommel des Röstofens | Tim Mossholder | [unsplash.com/photos/YC6RVdoTtIk](https://unsplash.com/photos/YC6RVdoTtIk) |
| `kuchen-zimtschnecken.webp` | Zimtschnecken auf dem Kuchengitter | Rexi Pratama | [unsplash.com/photos/qm7hrKF6lq0](https://unsplash.com/photos/qm7hrKF6lq0) |
| `kuchen-kaese.webp` | Stück gebackener Käsekuchen | mahyar mirghasemi | [unsplash.com/photos/z35wEXJ8kvA](https://unsplash.com/photos/z35wEXJ8kvA) |
| `kuchen-apfel.webp` | Apfelkuchen mit Streuseln | Joanna Stołowicz | [unsplash.com/photos/676v4dR2c48](https://unsplash.com/photos/676v4dR2c48) |

Die Filme der vier Café-Getränke stammen von [Pexels](https://www.pexels.com) und stehen unter der [Pexels-Lizenz](https://www.pexels.com/license/): kostenlos nutzbar, auch gewerblich, Bearbeiten erlaubt, keine Namensnennung nötig (wir nennen die Urheber trotzdem). Nicht erlaubt: erkennbare Personen in schlechtem Licht zeigen, unveränderte Kopien verkaufen, eine Empfehlung durch abgebildete Personen oder Marken andeuten, die Filme auf anderen Bild- oder Videoplattformen weitergeben oder als Marke nutzen. Am 4. Oktober 2026 heruntergeladen und geprüft; gekürzt, zugeschnitten und neu komprimiert mit `tools/video/cut.swift`. Zu sehen sind nur Hände, keine Gesichter und keine Markennamen.

| Datei (`assets/video/cafe/`) | Motiv | Filmer/in | Quelle |
|---|---|---|---|
| `crema.mp4`, erste Einstellung | Espresso läuft aus dem Siebträger in eine Steinguttasse | cottonbro studio | [pexels.com/video/4796945](https://www.pexels.com/video/4796945/) |
| `crema.mp4`, zweite Einstellung | Espresso läuft in eine weiße Tasse, die Crema bildet sich | Mizuno K | [pexels.com/video/13736520](https://www.pexels.com/video/13736520/) |
| `matcha.mp4` | Aufgeschlagener Matcha wird aus der Schale in ein Glas Milch gegossen | Anna Pou | [pexels.com/video/8295303](https://www.pexels.com/video/8295303/) |
| `cappuccino.mp4` | Milchschaum wird als Tulpe in den Espresso gegossen | mehmetography | [pexels.com/video/35394696](https://www.pexels.com/video/35394696/) |
| `schokolade.mp4` | Heiße Schokolade fließt aus einem Kännchen in eine Porzellantasse | Gizem Gökce | [pexels.com/video/36066271](https://www.pexels.com/video/36066271/) |

Die Standbilder in `assets/img/cafe/getraenke/` (Poster, ruhige Ansicht, Vorschaubilder der Auswahl) sind Einzelbilder aus diesen Filmen.

Die Filme der sechs Bar-Drinks stammen ebenfalls von Pexels (gleiche Lizenz, am 4. Oktober 2026 heruntergeladen und geprüft, gekürzt und zugeschnitten mit `tools/video/cut.swift`). Zu sehen sind nur Hände und Gläser, keine Gesichter, keine Logos und keine lesbaren Etiketten. Die Namen der Drinks auf der Karte sind erfunden; die Filme zeigen passende echte Drinks.

| Datei (`assets/video/bar/`) | Motiv | Filmer/in | Quelle |
|---|---|---|---|
| `nachtfalter.mp4` | Dunkelroter Drink läuft aus dem Shaker in ein Nick-&-Nora-Glas | cottonbro studio | [pexels.com/video/4667167](https://www.pexels.com/video/4667167/) |
| `elbtonic.mp4` | Gin Tonic im Copa-Glas mit Limette und Wacholder, wird umgerührt | Kapaw | [pexels.com/video/4873619](https://www.pexels.com/video/4873619/) |
| `negroni.mp4`, erste Einstellung | Negroni wird im Rührglas gerührt | ArtHouse Studio | [pexels.com/video/7219889](https://www.pexels.com/video/7219889/) |
| `negroni.mp4`, zweite Einstellung | Negroni wird auf einen Eisblock im Kristall-Tumbler gegossen | ArtHouse Studio | [pexels.com/video/7219887](https://www.pexels.com/video/7219887/) |
| `espresso.mp4` | Espresso Martini läuft durch das Sieb in eine Kristall-Coupette | mehmetakifarts | [pexels.com/video/38702518](https://www.pexels.com/video/38702518/) |
| `mule.mp4` | Aus einer Kupferkanne wird in einen verzierten Kupferbecher gegossen | Yan Krukau | [pexels.com/video/8810908](https://www.pexels.com/video/8810908/) |
| `holunder.mp4` | Drink mit Minze, zerstoßenem Eis und getrockneter Limette dreht sich | Denys Gromov | [pexels.com/video/5230367](https://www.pexels.com/video/5230367/) |

Die Standbilder in `assets/img/bar/drinks/` sind Einzelbilder aus diesen Filmen.

Der Intro-Film des Autohauses stammt ebenfalls von Pexels (gleiche Lizenz, am 14. Oktober 2026 heruntergeladen und geprüft): eine nächtliche Fahrt durch einen Tunnel, ohne erkennbare Fahrzeuge, Marken oder Personen. Auf 10 Sekunden gekürzt und in Schwarz-Weiß umgewandelt (`tools/video/cut.swift --mono`).

| Datei | Motiv | Filmer/in | Quelle |
|---|---|---|---|
| `assets/video/autohaus/intro-tunnel.mp4`, Standbild `assets/img/autohaus/intro-poster.jpg` | Nachtfahrt durch einen beleuchteten Tunnel | 정규송 Nui MALAMA | [pexels.com/video/33938671](https://www.pexels.com/video/33938671/) |

| Datei (`assets/img/boutique/`) | Motiv | Fotograf/in | Quelle |
|---|---|---|---|
| `boutique-laden.webp` | Heller Laden mit Leinenkleidung auf der Stange (Buchtitel mit Markenname auf dem Hocker unkenntlich gemacht, 13.10.2026) | Caroline Badran | [unsplash.com/photos/Q8G9oX_SsEM](https://unsplash.com/photos/Q8G9oX_SsEM) |
| `boutique-lookbook.webp` | Kleiderstange in Naturtönen mit Pampasgras | Alyssa Strohmann | [unsplash.com/photos/TS--uNw-JqE](https://unsplash.com/photos/TS--uNw-JqE) |
| `leinen-stapel.webp` | Gefaltete Leinenstoffe auf einem Holzhocker | Svitlana | [unsplash.com/photos/HbiRi1Owk9k](https://unsplash.com/photos/HbiRi1Owk9k) |
| `leinen-textur.webp` | Leinengewebe in Nahaufnahme (Ausschnitt), dient als Stoffstruktur des 3D-Tuchs | Annie Spratt | [unsplash.com/photos/xTaOPMa6wAE](https://unsplash.com/photos/xTaOPMa6wAE) |
| `hemd-ecru.webp` | Henley-Hemd aus Leinen am Holzbügel | tian dayong | [unsplash.com/photos/S4f4apZd-hA](https://unsplash.com/photos/S4f4apZd-hA) |
| `hemd-streifen.webp` | Stehkragenhemd mit feinen Streifen | tian dayong | [unsplash.com/photos/SI7Hmk8MXQU](https://unsplash.com/photos/SI7Hmk8MXQU) |
| `hemd-marine.webp` | Kurzarmhemd in Marineblau | tian dayong | [unsplash.com/photos/8UsQoiJLNNQ](https://unsplash.com/photos/8UsQoiJLNNQ) |
| `hemd-grau.webp` | Graues Shirt mit V-Ausschnitt | tian dayong | [unsplash.com/photos/maHb1ki_X3o](https://unsplash.com/photos/maHb1ki_X3o) |

## Solmund (Immobilienmakler, `beispiele/immobilien/`)

Alle Quellen am 11. Oktober 2026 heruntergeladen und geprüft.

**Fotos (Unsplash-Lizenz, kostenlos, keine Namensnennung nötig – wir nennen sie trotzdem).** Jedes Bild in voller Größe auf Gesichter und Markennamen geprüft; Personen sind höchstens winzig im Hintergrund zu sehen.

| Datei (`assets/img/immobilien/`) | Motiv | Fotograf/in | Quelle |
|---|---|---|---|
| `beletage-*.webp` (seit 13.10.2026, ersetzt ein Foto eines echten, erkennbaren Hauses in Blankenese) | Heller Altbau-Salon mit Stuck und Fischgrätparkett (Ausschnitt 4:3) | Lydia Griva | [pexels.com/photo/35665522](https://www.pexels.com/photo/35665522/) (Pexels-Lizenz) |
| `kapitaenshaus-*.webp` (seit 13.10.2026, ersetzt das Foto aus dem Blankeneser Treppenviertel) | Esszimmer vor einem Erkerfenster (Ausschnitt 4:3) | Maria Orlova | [pexels.com/photo/4916279](https://www.pexels.com/photo/4916279/) (Pexels-Lizenz) |
| `reetdach-*.webp` | Weißes Reetdachhaus mit Blumenampeln (rechts beschnitten: Auto) | Karen Cann | [unsplash.com/photos/CuqyajLPjGs](https://unsplash.com/photos/CuqyajLPjGs) |
| `neubau-*.webp` | Moderne weiße Villa in der Dämmerung | Arthur Baudry | [unsplash.com/photos/4vioYQ9Nn9Y](https://unsplash.com/photos/4vioYQ9Nn9Y) |
| `assets/wohnung/ufer.webp` | Containerterminal am gegenüberliegenden Elbufer (Himmel freigestellt, leicht weichgezeichnet; Schriftzüge an Schiffen unkenntlich) | Steffen Lemmerzahl | [unsplash.com/photos/e4et1JptP2Q](https://unsplash.com/photos/e4et1JptP2Q) |
| `assets/wohnung/baumkante.webp` | Bewaldeter Hang (Himmel freigestellt) – Baumkulisse am Elbufer | Norbert Buduczki | [unsplash.com/photos/MkbLijnk_HQ](https://unsplash.com/photos/MkbLijnk_HQ) |
| `assets/wohnung/kunst_wohnen.webp` | Düne mit einzelnem Baum (Bild über dem Sideboard) | Gantaro | [unsplash.com/photos/9eTP3GF4liQ](https://unsplash.com/photos/9eTP3GF4liQ) |
| `assets/wohnung/kunst_diele.webp` | Sanddüne im Gegenlicht (Diele) | Brandon Smith | [unsplash.com/photos/3fN13Uap0d4](https://unsplash.com/photos/3fN13Uap0d4) |
| `assets/wohnung/kunst_flur.webp` | Segelboot auf ruhigem Wasser (Flur) | Hugo Kerr | [unsplash.com/photos/Ke96snCJ1m0](https://unsplash.com/photos/Ke96snCJ1m0) |
| `assets/wohnung/kunst_bett.webp` | Meer im Nebel, schwarz-weiß (über dem Bett) | Taylor Leopold | [unsplash.com/photos/COE-CIGj8VA](https://unsplash.com/photos/COE-CIGj8VA) |
| `assets/wohnung/kunst_arbeiten.webp` | Weiße Dünen mit Strandhafer (Arbeitszimmer) | Elvira Blumfelde | [unsplash.com/photos/8OseV2SX5bY](https://unsplash.com/photos/8OseV2SX5bY) |

**Filme im Intro (Pexels-Lizenz).** Auf 1280 × 720 verkleinert, gekürzt, ohne Ton. Keine Personen im Bild.

| Datei (`assets/video/immobilien/`) | Motiv | Quelle |
|---|---|---|
| `licht.mp4` | Sonnenlicht mit Blätterschatten auf einem Vorhang | [pexels.com/video/35161057](https://www.pexels.com/video/35161057/) |
| `vase.mp4` | Sonnenstrahl wandert über eine Wand, Vase mit Zweig | [pexels.com/video/6963729](https://www.pexels.com/video/6963729/) |
| `elbe-morgen.mp4` | Luftaufnahme: Hamburger Hafen und Elbphilharmonie im Morgendunst | [pexels.com/video/35998900](https://www.pexels.com/video/35998900/) |
| `elbe-abend.mp4` | Luftaufnahme: Elbe bei Sonnenuntergang | [pexels.com/video/35919119](https://www.pexels.com/video/35919119/) |
| `vorhang.mp4` | Voile-Vorhänge bewegen sich im Wind | [pexels.com/video/38675645](https://www.pexels.com/video/38675645/) |

**3D-Rundgang (`assets/wohnung/`).** Architektur, Küche, Sofa, Bett, Bettwäsche (Stoffsimulation), Kissen, Sideboard, Tisch, Regal, Schränke, Teppiche, Vorhänge und Leuchten sind selbst in Blender gebaut (`tools/wohnung/`). Licht mit Blender Cycles vorberechnet. Die Umgebung (Elbhang mit rund 4.900 Bäumen, Villen, Strand) ist ebenfalls in Blender gebaut und als Panoramen gerechnet, die im Browser auf ein Tiefenmodell projiziert werden (`tools/wohnung/umgebung.py`, `umgebung_web.py`).

| Modell | Urheber/in | Lizenz | Quelle |
|---|---|---|---|
| Barhocker (neu bezogen) | Andriano Milanovic | CC BY 4.0 | [Dima upholstered barstool](https://sketchfab.com/3d-models/dima-upholstered-barstool-2be0e4efd95d4b9b9740eeeaae318af6) |
| Stehleuchte (Leinenschirm) | alpaca. | CC BY 4.0 | [Drum shade floor lamp](https://sketchfab.com/3d-models/drum-shade-floor-lamp-1aa6739d774348efa691340e3a12b870) |
| Monstera | Giora | CC BY 4.0 | [Monstera Deliciosa Potted](https://sketchfab.com/3d-models/monstera-deliciosa-potted-mid-century-plant-1ab9bf841df04c07b1819be596327629) |
| Efeutute | AllQuad | CC BY 4.0 | [Pothos Potted Plant](https://sketchfab.com/3d-models/free-pothos-potted-plant-money-plant-e9832f38484f4f85b3f9081b51fa3799) |
| Fächerpalme | AllQuad | CC BY 4.0 | [Livistona Chinensis](https://sketchfab.com/3d-models/free-livistona-chinensis-fan-palm-f59bab2a81244b869e1ca5aefd4ad94a) |
| Olivenbäume auf dem Balkon | massive-graphisme | CC BY 4.0 | [Old olive tree](https://sketchfab.com/3d-models/old-olive-tree-6328df8a0f214143a880a72b86db2ab4) |
| Bäume am Elbhang: Realistic Trees Collection | Jungle Jim | CC BY 4.0 | [Realistic Trees Collection](https://sketchfab.com/3d-models/realistic-trees-collection-fe67c886eebf4bcb988d7c45e69995ad) |
| Bäume am Elbhang: Beech tree | evolveduk | CC BY 4.0 | [Beech tree](https://sketchfab.com/3d-models/beech-tree-0983d8933531491f9be71c669e8a907b) |
| Bäume am Elbhang: Oak tree | massive-graphisme | CC BY 4.0 | [Oak tree](https://sketchfab.com/3d-models/oak-tree-3dc59560f2d24345bdbe65c44636453b) |
| Bäume am Elbhang: Birch trees | Igor_K. | CC BY 4.0 | [Birch trees](https://sketchfab.com/3d-models/birch-trees-de6263e5400b4a52a795decf84f06575) |
| Früchte der Obstschale (Kiwi: Surfin’ USSR, Granatapfel: Moshe Caine, Banane: tanophotogrammetry, übrige: Meerschaum Digital); der Teller des Originals steht unter CC BY-NC und wurde am 13.10.2026 entfernt, die Schale ist selbst gebaut | Meerschaum Digital | CC BY 4.0 | [Fruit Bowl](https://sketchfab.com/3d-models/fruit-bowl-373c679b7bd644aea12373945834e973) |
| Lounge Chair, Vasen, Kugelleuchten, Bücher, Sukkulente, Holzschale, Bistrotisch | Poly Haven | CC0 | [polyhaven.com/models](https://polyhaven.com/models) |
| Texturen Eiche, Nussbaum, Leinen, Bouclé (Teddy), Waffelpikee, Samt, Leder, Putz | Poly Haven | CC0 | [polyhaven.com/textures](https://polyhaven.com/textures) |
| Texturen Travertin, Kalkputz, Teppich | ambientCG | CC0 | [ambientcg.com](https://ambientcg.com) |
| Himmel (HDRI „Kloofendal 48d Partly Cloudy, Pure Sky“) | Greg Zaal, Jarod Guest / Poly Haven | CC0 | [polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky) |
| Wasser-Normalenkarte `wasser_normal.webp` | three.js-Beispiele | MIT | [github.com/mrdoob/three.js](https://github.com/mrdoob/three.js/blob/r169/examples/textures/waternormals.jpg) |

Nicht genutzte Sketchfab-Modelle liegen nur in `tools/models/quelle/` (Sofa, Spülen-Set, Pendelleuchte). Seit 13.10.2026 ebenfalls nicht mehr genutzt (Nachbauten bekannter, noch geschützter Designs): Harvey-Probber-Sessel, Noguchi-Couchtisch und die AAC-Stühle des „Dining Set“ – ersetzt durch eigene Entwürfe (`tools/wohnung/nachtrag_recht.py`).

## Blütenkontor: echte Blumen im Strauß-Konfigurator (`assets/models/blumen/`)

Seit 11. Oktober 2026 bindet der 3D-Konfigurator echte Blumen. Rosen, Pfingstrosen und Tulpen sind 3D-Fotoscans echter Blüten; sie wurden mit `tools/blumen/koepfe.py` (Blender) vom Stiel getrennt, aufgerichtet, verkleinert und reduziert. Farbvarianten ohne eigenen Scan entstehen im Browser durch Umfärben der Fototextur (`assets/js/3d/real-flowers.js`). Eukalyptus, Schleierkraut und Lavendel sind freigestellte Fotos echter Zweige (`tools/blumen/fueller.py`). Die gezeichneten Blüten aus `flowers.js` bleiben nur noch als Ersatz, falls das Laden scheitert.

| Blüte | Urheber/in | Lizenz | Quelle |
|---|---|---|---|
| Rose (Samtrot) | Heliona | CC BY 4.0 | [Rose](https://sketchfab.com/3d-models/rose-6281bf3703584323bb4d8326f1f1b59d) |
| Rose (Rosa) | Emm | CC BY 4.0 | [Pink rose](https://sketchfab.com/3d-models/pink-rose-3a56a21aae594934aae7f9daa1bfd5b4) |
| Rose (Apricot, Creme umgefärbt) | Akiko_NAKAMURA | CC BY 4.0 | [Pale orange rose（name unknown）](https://sketchfab.com/3d-models/pale-orange-rosename-unknown-47594b5e34f44f2982cb2a1f506318b9) |
| Pfingstrose (Altrosa, Weiß und Koralle umgefärbt) | Terrie Simmons-Ehrhardt | CC BY 4.0 | [Peony](https://sketchfab.com/3d-models/peony-4a90c5fa3d824d1d87cd63bbae14ca59) |
| Tulpe (Rot, weitere Farben umgefärbt) | Lassi Kaukonen | CC BY 4.0 | [Red Tulip](https://sketchfab.com/3d-models/red-tulip-651e57a3728b4208b77d6d765260d018) |

| Datei | Motiv | Fotograf/in | Quelle |
|---|---|---|---|
| `eukalyptus.webp` | Eukalyptuszweig auf weißem Grund (freigestellt) | Sixteen Miles Out | [unsplash.com/photos/LGcO26RPdC4](https://unsplash.com/photos/LGcO26RPdC4) |
| `schleierkraut.webp` | Schleierkraut vor hellgrauem Grund (freigestellt) | Annie Spratt | [unsplash.com/photos/z2lM7dCbXkA](https://unsplash.com/photos/z2lM7dCbXkA) |
| `lavendel.webp` | Zwei getrocknete Lavendelzweige auf Packpapier (freigestellt) | Edward Howell | [unsplash.com/photos/qMOMUCGjxLA](https://unsplash.com/photos/qMOMUCGjxLA) |

## Klarsund (Optiker, `beispiele/brillen/`)

Am 11. Oktober 2026 heruntergeladen und geprüft. Die Brillenmodelle wurden mit `tools/brillen/vorbereiten.py` (Blender) auf Realmaß in Zentimetern gebracht, ausgerichtet und reduziert; alle Oberflächen (Acetat, Havanna, Kristall, Metall, Gläser) sind eigene Materialien der Seite, Texturen oder Logos der Vorlagen werden nicht verwendet.

| Modell | Urheber/in | Lizenz | Quelle |
|---|---|---|---|
| Elbe (Acetat-Vollrand) | Marius.Eder | CC BY 4.0 | [Glasses](https://sketchfab.com/3d-models/glasses-007651a9450746a5b6c5a126d484cd52) |
| Ottensen (Metall rund) | Agha.Najam | CC BY 4.0 | [Ray Ban Glasses](https://sketchfab.com/3d-models/ray-ban-glasses-bb3a3736110a41bdacc9f92e11831a41) |
| Kapitän (Pilotenbrille) | Kimppo | CC BY 4.0 | [Aviator sunglasses](https://sketchfab.com/3d-models/aviator-sunglasses-00d1cb5aa82745228a3b764c97f867de) |

**Gesichtserkennung:** MediaPipe Tasks Vision 0.10.21 und Modell „Face Landmarker“ von Google (Apache License 2.0), liegen in `assets/vendor/mediapipe/`; das Gesichtsmodell `assets/models/brillen/gesicht.json` ist aus `canonical_face_model.obj` von MediaPipe umgewandelt (Apache 2.0). Alles läuft im Browser, es werden keine Kamerabilder übertragen.

| Datei (`assets/img/brillen/`) | Motiv | Fotograf/in | Quelle |
|---|---|---|---|
| `laden-*.webp` | Heller Brillenladen mit Wandregalen (rechts beschnitten: Porträt-Plakate) | Takeshi Morisato | [unsplash.com/photos/-yk2yfYwTiE](https://unsplash.com/photos/-yk2yfYwTiE) |
| `sehtest-*.webp` | Phoropter (Messgerät für den Sehtest) | CDC | [unsplash.com/photos/fiHQ3-D45zo](https://unsplash.com/photos/fiHQ3-D45zo) |
| `detail-schwarz-*.webp` | Schwarze Acetatbrille auf weißem Grund | Fernando Lavin | [unsplash.com/photos/jT4zew8IENc](https://unsplash.com/photos/jT4zew8IENc) |
| `detail-rund-*.webp` | Runde Brille auf hellem Grund | Redowan Dhrubo | [unsplash.com/photos/arWoSRonAk0](https://unsplash.com/photos/arWoSRonAk0) |

Zum Testen der Anprobe ohne Kamera wurden zwei Porträtfilme von Pexels als künstliche Kamera verwendet; sie liegen nur im Arbeitsordner und werden nicht veröffentlicht.

## Erfundene Namen

Alle Ladennamen der Muster-Websites sind erfunden (Holst & Tochter, Blütenkontor, Fährhaus Zwölf, Kaffeehaus Möwe, Nachtfalter, Linnen & Lou, Halden Automobile, FUNKL, Solmund, Klarsund; Halden und FUNKL am 10. Oktober 2026 per Websuche geprüft: kein Getränk namens „FUNKL“ gefunden, nur ähnlich klingende Marken wie „FLCK“. „Solmund“ am 11. Oktober 2026 geprüft: kein Makler oder Unternehmen dieses Namens, nur ein isländischer Vorname und ein färöischer Ortsname; „Klarsund“ am 11. Oktober 2026 geprüft: kein Optiker dieses Namens, nur die ähnlich klingende schwedische Kette „Klarsynt“). Am 2. Oktober 2026 per Websuche geprüft: kein gleichnamiges Geschäft in Hamburg gefunden. Der ursprüngliche Name „Blattwerk“ gehört zu einem echten Blumenladen in Reinbek und wurde deshalb durch „Blütenkontor“ ersetzt. Adressen ohne Hausnummer und Telefonnummern sind Platzhalter; Preise sind erfunden.
