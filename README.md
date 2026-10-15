# Studio Elbquartier – Website

Statische Website mit 3D (three.js) und Scroll-Animationen (GSAP). Kein Build-Schritt, keine Cookies, kein Tracking, keine externen Dienste: Schriften, Bibliotheken, Bilder und HDRIs liegen alle im Projekt.

## Lokal ansehen

Die Seite muss über einen kleinen Webserver laufen (wegen der JavaScript-Module). Am besten mit dem Entwicklungs-Server aus dem Projekt, er schaltet das Zwischenspeichern ab:

```bash
python3 tools/dev-server.py .
```

Dann im Browser: http://localhost:8765 (ein einfaches `python3 -m http.server 8765` geht auch).

Ohne Python (z. B. unter Windows) gibt es denselben Server für Node: `node tools/dev-server.mjs .` Er komprimiert zusätzlich wie der echte Webserver (siehe `.htaccess`), damit Messungen mit Lighthouse realistisch sind.

Tipps zum Testen:
- `?lite` an die Adresse hängen (z. B. `/beispiele/bar/?lite`) zeigt die leichte Ansicht ohne 3D, wie auf schwachen Geräten oder bei „Bewegung reduzieren“.
- Jede 3D-Ansicht lädt erst, wenn man in ihre Nähe scrollt.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html` | Startseite (Hero, 3D-Drehscheibe mit den zehn Läden, Ablauf, Website-Pakete, Softwarelösungen, Team, Kontakt) |
| `impressum.html`, `datenschutz.html` | Entwürfe, die markierten Stellen vor dem Livegang ausfüllen |
| `design-system.html` | Übersicht aller Farben, Schriften, Abstände und Bausteine |
| `assets/css/design-system.css` | Design System (Tokens und Komponenten), von allen Seiten genutzt |
| `assets/js/` | Startseite, Drehscheibe, gemeinsame Helfer (`capability.js` entscheidet, ob 3D läuft) |
| `assets/js/3d/` | 3D: Autohaus-Showroom (`showroom.js`, `cars.js`), Bühne (`stage.js`), Schmuck (`brilliant.js`, `diamond-material.js`, `jewelry.js`, `viewer.js`), Blumen (`flowers.js`, `bouquet.js`), Boutique (`cloth.js`) |
| `assets/video/cafe/`, `assets/video/bar/` | Kurze Filme der vier Café-Getränke und der sechs Bar-Drinks (H.264, 720 × 900), Standbilder dazu in `assets/img/cafe/getraenke/` und `assets/img/bar/drinks/` |
| `beispiele/<laden>/` | Die Muster-Websites: Juwelier, Blumenladen, Restaurant, Bar, Café, Boutique, Getränke-Shop (FUNKL), Immobilienmakler (Solmund), Optiker (Klarsund), Autohaus (Halden Automobile) |
| `assets/wohnung/`, `assets/video/immobilien/`, `assets/img/immobilien/` | Solmund: begehbare 3D-Wohnung (GLB mit Lightmaps, Raum-Panoramen, Himmel, Gegenufer, Begehbarkeits-Maske), Intro-Filme und Objektfotos; Rundgang-Code in `assets/js/3d/rundgang.js` |
| `assets/models/autos/`, `assets/video/autohaus/` | Autohaus: drei 3D-Automodelle (GLB, Meshopt-komprimiert) und der Intro-Film (900 × 1600, schwarz-weiß); Showroom-Code in `assets/js/3d/showroom.js` und `cars.js` |
| `kontakt.php` | Mailversand des Kontaktformulars an hallo@studio-elbquartier.de (das Postfach muss bei netcup angelegt sein) |
| `CREDITS.md` | Alle Quellen und Lizenzen (Bibliotheken, Schriften, HDRIs, Fotos) |
| `tools/` | Interne Werkzeuge: 3D-Testseiten, Bilder rendern (mit den Bar-Modellen `tools/models/drinks.js` und dem Bar-HDRI `tools/hdri/`), Videos zuschneiden (`tools/video/`), Dev-Server, Archiv (`tools/archiv/`: die früheren, mit Path Tracing gerechneten Drehbilder der Bar und ihr Viewer `spin.js`). **Nicht hochladen.** |

## Ersatzbilder neu rendern

Für Geräte ohne 3D zeigen die Seiten Bilder, die aus denselben 3D-Modellen gerendert sind. Nach Änderungen an einem Modell:

1. `python3 tools/dev-server.py .` starten (er kann Bilder speichern).
2. Die passende Seite aufrufen:

| Seite | Ergebnis |
|---|---|
| http://localhost:8765/tools/bake-juwelier.html | `assets/img/juwelier/*.webp` |
| http://localhost:8765/tools/bake-bar-spin.html | `assets/img/bar-spin/<drink>/00–23.webp` (Path Tracing, rund 30 Minuten pro Drink; wird auf der Website nicht mehr genutzt, die fertigen Bilder liegen in `tools/archiv/bar-spin/`) |
| http://localhost:8765/tools/bake-boutique.html?save | `assets/img/boutique/stoff-*.webp` |

Der Blumenladen braucht keine Bilder: Seine Ersatzansicht wird direkt gezeichnet.

Zur Bar (Archiv): Die Bar zeigt ihre Drinks inzwischen als kurze Filme (siehe unten). Die früheren Drehbilder sind keine Live-3D-Ansicht, sondern mit Path Tracing gerechnete Bilder (echte Lichtbrechung in Glas, Eis und Flüssigkeit, Schärfentiefe). Das Werkzeug setzt fort, wo es aufgehört hat: Vorhandene Bilder werden übersprungen, also zum Neuberechnen eines Drinks dessen Ordner löschen. Mit `?test` entsteht je Drink nur ein Probebild in `assets/img/bar-spin/test/`. Auf Macs mit zwei Grafikchips rechnet das Werkzeug auf der schnellen Grafikkarte (dort etwa ein Drink pro halbe Stunde). Es rechnet in kleinen Kacheln, prüft jedes Bild auf GPU-Fehler und lädt bei Problemen neu. Wichtig: Der Mac darf währenddessen nicht schlafen, und der Browser-Tab muss offen bleiben.

## Videos zuschneiden (Café und Bar)

Die Filme stammen von Pexels (siehe `CREDITS.md`) und werden mit einem kleinen Swift-Programm zugeschnitten, das die Videofunktionen von macOS nutzt (kein ffmpeg nötig). Es schneidet Zeit und Bildausschnitt, verkleinert auf 720 × 900, komprimiert als H.264 für das Web und kann Standbilder als JPEG speichern; mehrere Abschnitte werden weich überblendet.

```bash
swiftc -O tools/video/cut.swift -o /tmp/cut
/tmp/cut --in quelle.mp4 --start 0 --end 7.5 --crop 0,420,1080,1350 --out assets/video/cafe/cappuccino.mp4 --size 720x900 --bitrate 1050000 --still 0:start.jpg
```

Die genauen Einstellungen der Café-Filme:

| Film | Quelle(n) (Pexels) | Abschnitt und Ausschnitt |
|---|---|---|
| `crema.mp4` | 4796945, dann 13736520 | `--seg 4796945.mp4:0.4:5.2:724,0,864,1080 --seg 13736520.mp4:3.6:9.9:216,760,864,1080 --xfade 0.6` |
| `matcha.mp4` | 8295303 | `--start 0 --end 9.9 --crop 0,460,1080,1350` |
| `cappuccino.mp4` | 35394696 | `--start 0 --end 7.5 --crop 0,420,1080,1350` |
| `schokolade.mp4` | 36066271 | `--start 1.6 --end 11.0 --crop 0,330,1080,1350` |

Die Bar-Filme (`assets/video/bar/`):

| Film | Quelle(n) (Pexels) | Abschnitt und Ausschnitt |
|---|---|---|
| `nachtfalter.mp4` | 4667167 | `--start 7.5 --end 17.5 --crop 0,560,1080,1350` |
| `elbtonic.mp4` | 4873619 (zwei Stellen) | `--seg 4873619.mp4:23.4:28.6:378,0,864,1080 --seg 4873619.mp4:33.6:37.4:378,0,864,1080 --xfade 0.5` |
| `negroni.mp4` | 7219889, dann 7219887 | `--seg 7219889.mp4:5.0:8.5:0,470,1080,1350 --seg 7219887.mp4:3.2:11.5:0,400,1080,1350 --xfade 0.5` |
| `espresso.mp4` | 38702518 | `--start 0.2 --end 8.8 --crop 216,520,864,1080 --fps 30` |
| `mule.mp4` | 8810908 | `--start 0.3 --end 11.0 --crop 190,500,880,1100` |
| `holunder.mp4` | 5230367 | `--start 0 --end 11 --crop 528,0,864,1080` |

Alle mit `--size 720x900 --bitrate 1050000`. Die Standbilder der Bar (`<drink>-start.webp` als Poster, `<drink>.webp` als Bild ohne Film) liegen in `assets/img/bar/drinks/`. Die Standbilder des Cafés (`<getränk>-start.webp` als Poster, `<getränk>.webp` für die ruhige Ansicht, `<getränk>-klein.webp` für die Auswahl) sind Einzelbilder daraus, als WebP gespeichert. `swift tools/video/probe.swift datei.mp4` zeigt Größe, Dauer und Bildrate einer Datei.

## Visitenkarte drucken

Die Druckdaten liegen in `Druckdaten/` (Datenformat 91 × 61 mm = 85 × 55 mm plus 3 mm Beschnitt, ohne Schnittmarken, Vektor, Schriften eingebettet, RGB): beide Seiten in einer Datei sowie Vorder- und Rückseite einzeln. Erzeugt werden sie aus `tools/druck/visitenkarte.html` (gleicher Entwurf wie im Design-Artifact) mit:

```bash
python3 tools/druck/visitenkarte-pdf.py
```

Das Skript nutzt Google Chrome im Hintergrund. Mit `python3 tools/druck/visitenkarte-pdf.py 1` entsteht die Fassung mit 1 mm Beschnitt (Datenformat 87 × 57 mm, Dateinamen mit `-87x57`), die Flyeralarm für „Visitenkarten mit Veredelung“ verlangt. Bestellt sind dort 100 Stück mit Soft-Feel-Folie (Auftrag DE262848721, Druckdaten am 4. Oktober 2026 hochgeladen). In `Druckdaten/` liegt auch ein fertiger Auftrag für Claude in Chrome (Druckerei suchen, Softtouch-Karten konfigurieren, Daten hochladen, vor der Kasse anhalten).

## Hochladen (netcup)

**Seit 15.10.2026 live über Git:** netcup holt die Website direkt aus diesem GitHub-Repository („Bereitstellung über Git“ im Webhosting-Panel, Verzweigung `main`, automatisch nach `/studio-elbquartier.de/httpdocs`). Für ein Update: Änderungen committen und pushen, dann im netcup-Panel unter Websites & Domains › Git › „Jetzt Pull ausführen“ klicken. Interne Ordner (`tools/`, `Druckdaten/`, README, CREDITS) liegen dabei mit auf dem Server, die `.htaccess` liefert sie aber nicht aus (404). SSL: Let's Encrypt für Domain und www, verlängert sich automatisch. PHP für das Kontaktformular: mindestens 8.1 (PHP-Einstellungen der Domain).

Der folgende manuelle Weg bleibt als Alternative:

Am einfachsten auf dem Mac: `tools/paket.sh` ausführen. Das Skript legt in `Upload/` genau die Dateien ab, die auf den Server gehören, und prüft, dass nichts Internes dabei ist. Den **Inhalt** von `Upload/` per FTP oder netcup-Dateimanager in das Web-Verzeichnis der Domain laden.

Ohne das Skript (z. B. unter Windows): alles hochladen **außer** `tools/`, `Druckdaten/`, `Vorschau/`, `Upload/`, `.git/`, `.gitignore`, `.claude/`, `README.md`, `CREDITS.md`, `assets/img/funkl-test/` und `assets/img/autohaus-test/`.

Wichtig: Die Datei `.htaccess` im Hauptordner muss mit hoch (manche FTP-Programme blenden Dateien mit Punkt am Anfang aus). Sie schaltet auf dem Server die Kompression ein (JavaScript wird etwa 75 % kleiner, 3D-Modelle 15–30 %, die Brillen-Anprobe von 9,6 auf 2,9 MB) und lässt den Browser Bilder, Videos und Modelle zwischenspeichern. Nach dem Hochladen prüfen: In den Entwicklertools des Browsers (Netzwerk) sollte bei `three.core.js` „Content-Encoding: gzip“ oder „br“ stehen.

PHP 8.1 oder neuer wird für `kontakt.php` benötigt. Vor dem Livegang im netcup-Kundenbereich: SSL-Zertifikat aktivieren, Auftragsverarbeitungsvertrag abschließen, Speicherdauer der Logfiles in `datenschutz.html` eintragen, Kontaktformular einmal testen.

## Auf einem anderen Rechner weiterarbeiten (GitHub)

Das Projekt liegt im öffentlichen Repository https://github.com/davidexbazzani-sketch/Studio-Elbquartier – **ohne** große Arbeitsdateien und heruntergeladene Originalmodelle (siehe `.gitignore`); Texte, Seiten, Bilder, Skripte und Werkzeuge sind vollständig dabei.

1. Einmalig: GitHub Desktop installieren und mit dem GitHub-Konto anmelden, dann „Clone repository“ → `Studio-Elbquartier`.
2. Ansehen: im Projektordner `python3 tools/dev-server.py .` (oder `python3 -m http.server 8765`) starten, `http://localhost:8765` öffnen.
3. Ändern, neue Bilder nach `assets/img/<laden>/` legen (Quelle und Lizenz in `CREDITS.md` und `lizenzen.html` eintragen).
4. In GitHub Desktop „Commit“ und „Push origin“. **Vor dem Arbeiten immer erst „Fetch/Pull origin“**, damit beide Rechner denselben Stand haben.

Nur auf dem Mac mit allen Arbeitsdateien möglich: den 3D-Rundgang neu berechnen (Blender, `tools/wohnung/`) und Modelle neu aufbereiten (`tools/models/`).

## Autohaus: Modelle und Bilder

- Seit 14.10.2026 nur noch **markenlose** Fahrzeuge (GT Coupé, Limousine, SUV von MMC Works, CC BY 4.0). Die früheren Modelle mit Hersteller-Marken liegen nur noch in `tools/models/autos-quelle/marken/` und dürfen nicht veröffentlicht werden.
- Neue Modelle: Quelle nach `tools/models/quelle/`, dann `npx @gltf-transform/cli optimize <quelle.glb> assets/models/autos/<name>.glb --compress meshopt --texture-compress webp --texture-size 2048 --simplify false --palette false --join false --instance false --flatten false`. Nicht vereinfachen, sonst spiegelt der Lack wellig.
- Materialregeln je Auto (welches Material ist Lack, Glas, Chrom, Reifen …) stehen in `assets/js/3d/cars.js`.
- Prüfen ohne sichtbares Browserfenster: `tools/autohaus-shots.sh "shots=coupe,limousine,suv&views=schraeg,seite,heck&tag=x"` rendert Standbilder nach `assets/img/autohaus-test/` (Ordner nicht hochladen). `tools/autohaus-shots.sh "bake=1"` erneuert die Bühnen- und Kartenbilder in `assets/img/autohaus/`.

## FUNKL (Getränke-Shop)

- Echtzeit-3D: Dose und Etikett (Druck mit Farblasur, weißer Deckfarbe und blankem Aluminium) (`assets/js/3d/can.js`), Kondenswasser-Simulation auf der Grafikkarte (`Condensation` in derselben Datei), Motion-Graphics-Intro (`assets/js/3d/funkl-hero.js`), Sorten mit schwebenden echten Früchten (Fotoscans in `assets/models/funkl/`, siehe CREDITS) und Drehen per Ziehen (`assets/js/3d/funkl-showcase.js`), Sorten und Farben in `assets/js/3d/funkl-data.js`.
- Das Logo im Intro setzt sich im HTML aus 15 Strichen und einem Funken zusammen (GSAP, `beispiele/getraenke/getraenke.js`).
- Bilder für Shop und ruhige Ansicht neu rendern: Dev-Server starten, dann `tools/funkl-shot.sh "funkl-bake.html"` (schreibt nach `assets/img/funkl/`). Testseite für eine einzelne Dose: `tools/funkl-dose.html?f=mango|melone|blau&t=Sekunden&zoom=1`. Testbilder landen in `assets/img/funkl-test/` (nicht hochladen).
- Neue 3D-Modelle von Sketchfab holen: angemeldet auf sketchfab.com die Download-Adressen abrufen und an `tools/modelle-holen.html` übergeben; die Seite speichert über den Dev-Server (`POST /__savemodel`) nach `tools/models/quelle/`. Danach mit glTF-Transform verkleinern (`optimize … --simplify-ratio 0.35 --texture-size 1024`, dann `meshopt`).

## Solmund (Immobilienmakler) und der 3D-Rundgang

- Startseite `beispiele/immobilien/`: Motion-Graphics-Film aus fünf kurzen Clips (GSAP, `immobilien.js`): eine Architektenzeichnung zeichnet sich selbst, ihr Fenster öffnet sich zum ersten Film; Übergänge als Fenster, Bogen, Schiebetür, Sonne, Schluss mit Logo. Darunter fünf Objekte mit Pflichtangaben aus dem Energieausweis (GEG) und Käuferprovision.
- Rundgang `beispiele/immobilien/rundgang.html`: Am Computer `W A S D` und Maus/Touchpad (Pointer Lock), am Handy linker Daumen = gehen (Joystick erscheint dort, wo man tippt), rechts wischen = umsehen, kurz auf den Boden tippen = dorthin gehen. Raumknöpfe unten gleiten sanft zum Raum, Grundriss oben rechts. `?lite` lädt die kleine Fassung (Handys laden sie automatisch).
- Die Wohnung entsteht komplett per Skript in **Blender 4.5** (`tools/wohnung/`): `build.py` (Szene), `arch.py` (Grundriss, Wände, Fenster), `moebel.py` (Einrichtung, Stoffsimulation fürs Bett), `assets.py` (Modelle laden), `mats.py` (Materialien), `sky.py` (Himmel und Sonne).
- `pipeline.sh <ordner> <auflösung> <samples>` rechnet alles neu: Szene bauen → Licht mit Cycles backen (`bake.py`: Lightmaps, Licht je Vertex, Raum-Panoramen für Spiegelungen, Begehbarkeits-Maske, GLB) → `lm_encode.py` (entrauschen, logarithmisch in WebP) → `web_prep.py` (Himmel, `wohnung.json`) → glTF-Transform (Meshopt + WebP, kleine Handy-Fassung). Endfassung: `tools/wohnung/pipeline.sh arbeit/final 1.0 128` (etwa 2 Stunden auf dem Mac, nur Prozessor).
- Umgebung (Elbhang, Villen, Strand): `umgebung.py <ordner> 48 0.3` baut den Hang mit rund 4.900 Bäumen und Unterholz (Sketchfab-Modelle aus `tools/models/quelle/baum-*.glb`), Villen und Strand und rechnet eine Höhenkarte sowie zwei Panoramen aus der Wohnung (je etwa 20 Minuten). `umgebung_web.py <ordner> assets/wohnung` macht daraus das Tiefenmodell `umgebung.glb` und `umgebung_w/o.webp`; im Browser werden die Panoramen auf das Tiefenmodell projiziert. Danach `umgebung.glb` mit glTF-Transform (`optimize --compress meshopt`) verkleinern.
- Blender liegt nicht im Projekt (kostenlos von blender.org, Version 4.5 LTS für Intel-Macs); der Pfad wird über `BLENDER=…` übergeben.
- `tools/wohnung/arbeit/` enthält Zwischenstände (mehrere hundert MB) und `tools/wohnung/quelle/` die Originale – beides **nicht hochladen**.

## Blütenkontor: echte Blumen

- Der Strauß-Konfigurator (`beispiele/blumenladen/`) zeigt echte Blumen: 3D-Fotoscans (Rosen, Pfingstrosen, Tulpen) in `assets/models/blumen/*.glb` und freigestellte Fotos (Eukalyptus, Schleierkraut, Lavendel) als `*.webp`. Laden und Umfärben: `assets/js/3d/real-flowers.js`; Einbau in den Strauß: `assets/js/3d/bouquet.js`.
- Neu aufbereiten mit Blender: `tools/blumen/koepfe.py arbeit` (Blüten aus `tools/models/quelle/blume-*.glb`) und `tools/blumen/fueller.py arbeit` (Fotos aus `tools/blumen/fotos/`), danach die GLBs mit glTF-Transform (`optimize --compress meshopt --texture-compress webp --texture-size 1024 --simplify false`) nach `assets/models/blumen/`.

## Klarsund (Optiker) und die Live-Anprobe

- Seite `beispiele/brillen/`: Kollektion mit drei Brillen in 3D (`assets/js/3d/brillen-ansicht.js`), Farben je Modell, Live-Anprobe als Vollbild.
- Live-Anprobe (`assets/js/3d/brillen-ar.js`): Selfie-Kamera am Handy bzw. Webcam am Laptop, Gesichtserkennung mit MediaPipe Face Landmarker (`assets/vendor/mediapipe/`, rund 13 MB, wird erst beim Start der Anprobe geladen). Die Brille sitzt über die Kopfmatrix von MediaPipe auf dem Gesicht (Maße in cm), ein unsichtbares Kopfmodell verdeckt die Bügel, Spiegelungen und Helligkeit kommen aus dem Kamerabild, ein weicher Schatten liegt auf der Haut. Foto-Knopf: Bild speichern oder über „Teilen“ verschicken.
- Kamera geht nur über **https** (oder `localhost`). Auf dem Handy also erst nach dem Hochladen testen – im lokalen Netz über `http://` blockiert der Browser die Kamera.
- Modelle und Materialien: `assets/js/3d/brillen.js`; Modelle neu aufbereiten: `tools/brillen/vorbereiten.py arbeit` (Blender), danach glTF-Transform `optimize --compress meshopt --simplify false --palette false --join false` nach `assets/models/brillen/`.
- Testseite ohne Kamera: `tools/brillen-ar-test.html` mit Chrome-Schaltern `--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<video.y4m>`.
