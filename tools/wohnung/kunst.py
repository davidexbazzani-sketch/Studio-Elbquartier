# Fotografien für die Bilder an den Wänden: auf das Leinwandformat zuschneiden → assets/wohnung/kunst_*.webp
import bpy, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'quelle', 'fotos'); DST = os.path.join(HERE, '..', '..', 'assets', 'wohnung')
JOBS = {   # Zielname: (Quelle, Breite/Höhe der Leinwand, Mittelpunkt x, y des Ausschnitts)
    'kunst_wohnen': ('kunst-9eTP3GF4liQ.jpg', 1.25 / 0.95, 0.5, 0.5),
    'kunst_diele': ('kunst-3fN13Uap0d4.jpg', 1.0 / 1.4, 0.42, 0.5),
    'kunst_flur': ('kunst-Ke96snCJ1m0.jpg', 0.8 / 1.1, 0.5, 0.5),
    'kunst_bett': ('kunst-COE-CIGj8VA.jpg', 1.7 / 0.85, 0.5, 0.5),
    'kunst_arbeiten': ('kunst-8OseV2SX5bY.jpg', 1.1 / 0.75, 0.5, 0.55),
}
for name, (f, ar, cx, cy) in JOBS.items():
    im = bpy.data.images.load(os.path.join(SRC, f)); w, h = im.size
    px = np.array(im.pixels[:], np.float32).reshape(h, w, 4)
    if w / h > ar: cw, ch = int(h * ar), h
    else: cw, ch = w, int(w / ar)
    x0 = int(min(max(cx * w - cw / 2, 0), w - cw)); y0 = int(min(max((1 - cy) * h - ch / 2, 0), h - ch))
    c = px[y0:y0 + ch, x0:x0 + cw].copy()
    out = bpy.data.images.new(name, cw, ch, alpha=False)
    out.pixels.foreach_set(c.ravel())
    s = 1024 / max(cw, ch); out.scale(int(cw * s), int(ch * s))
    p = os.path.join(DST, name + '.webp'); out.filepath_raw = p; out.file_format = 'WEBP'; out.save(quality=85)
    print('KUNST', name, out.size[:], os.path.getsize(p) // 1024, 'KB')
