# Erzeugt die Druckdaten der Visitenkarte als PDF (Vektor, Schriften eingebettet) mit Chrome im Hintergrund.
# Aufruf im Projektordner:  python3 tools/druck/visitenkarte-pdf.py [Beschnitt in mm, Standard 3]
#   3 mm → Datenformat 91 × 61 mm (Dateinamen ohne Zusatz), 1 mm → 87 × 57 mm für Flyeralarm (Zusatz „-87x57“).
# Ergebnis in Druckdaten/: beide Seiten in einer Datei sowie Vorder- und Rückseite einzeln.

import base64, os, re, subprocess, sys, tempfile, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'tools', 'druck', 'visitenkarte.html')
OUT = os.path.join(ROOT, 'Druckdaten')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

BLEED = float(sys.argv[1]) if len(sys.argv) > 1 else 3.0
W, H = 85 + 2 * BLEED, 55 + 2 * BLEED
SUFFIX = '' if BLEED == 3 else f'-{W:g}x{H:g}'

html = open(SRC, encoding='utf-8').read()
# Beschnitt und Seitengröße fest eintragen (@page versteht keine CSS-Variablen)
html = html.replace(':root { --b: 3mm; }', f':root {{ --b: {BLEED:g}mm; }}')
html = re.sub(r'@page \{ size: [^;]+; margin: 0; \}', f'@page {{ size: {W:g}mm {H:g}mm; margin: 0; }}', html)

# Schriften direkt einbetten, damit Chrome sie auch ohne Webserver lädt
def inline_font(m):
    path = os.path.normpath(os.path.join(os.path.dirname(SRC), m.group(1)))
    data = base64.b64encode(open(path, 'rb').read()).decode()
    return f"url(data:font/woff2;base64,{data})"
html = re.sub(r"url\(([^)]+\.woff2)\)", inline_font, html)

def only(part):
    """Nur eine Seite behalten (part = 'VORNE' oder 'HINTEN')."""
    other = 'HINTEN' if part == 'VORNE' else 'VORNE'
    return re.sub(rf'<!-- {other} -->.*?<!-- /{other} -->', '', html, flags=re.S)

variants = {
    f'visitenkarte-vorder-und-rueckseite{SUFFIX}.pdf': html,
    f'visitenkarte-vorderseite{SUFFIX}.pdf': only('VORNE'),
    f'visitenkarte-rueckseite{SUFFIX}.pdf': only('HINTEN'),
}

os.makedirs(OUT, exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
    for name, doc in variants.items():
        page = os.path.join(tmp, 'karte.html')
        open(page, 'w', encoding='utf-8').write(doc)
        target = os.path.join(OUT, name)
        if os.path.exists(target):
            os.remove(target)
        # Ausgaben nicht mitlesen: Chrome startet nebenbei seinen Updater, der sonst die Pipes offen hält
        proc = subprocess.Popen([
            CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--disable-background-networking', '--disable-component-update',
            f'--user-data-dir={os.path.join(tmp, "profil")}',
            '--no-pdf-header-footer', '--virtual-time-budget=4000',
            f'--print-to-pdf={target}', 'file://' + page,
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # Chrome beendet sich im Hintergrundmodus nicht immer selbst: warten, bis die PDF fertig geschrieben ist
        last, stable = -1, 0
        for _ in range(180):
            if proc.poll() is not None:
                break
            size = os.path.getsize(target) if os.path.exists(target) else -1
            stable = stable + 1 if size > 0 and size == last else 0
            last = size
            if stable >= 3:
                break
            time.sleep(0.5)
        if proc.poll() is None:
            proc.kill()
        if not os.path.exists(target) or os.path.getsize(target) == 0:
            sys.exit(f'{name}: Chrome hat kein PDF geschrieben')
        pdf = open(target, 'rb').read()
        pages = len(re.findall(rb'/Type\s*/Page[^s]', pdf))
        box = re.search(rb'/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]', pdf)
        w, h = (float(box.group(3)) - float(box.group(1)), float(box.group(4)) - float(box.group(2)))
        print(f'{name}: {pages} Seite(n), {w / 72 * 25.4:.1f} × {h / 72 * 25.4:.1f} mm, {len(pdf) // 1024} KB')
