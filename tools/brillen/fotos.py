# Fotos für Klarsund zuschneiden → assets/img/brillen/*.webp
import bpy, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(HERE, '..', '..', 'assets', 'img', 'brillen')
JOBS = {   # Ziel: (Quelle, x0, y0, x1, y1 als Anteil, y von oben)
    'laden': ('-yk2yfYwTiE.jpg', 0.0, 0.06, 0.655, 1.0),
    'sehtest': ('fiHQ3-D45zo.jpg', 0.05, 0.0, 0.95, 0.9),
    'detail-schwarz': ('jT4zew8IENc.jpg', 0.0, 0.0, 1.0, 1.0),
    'detail-rund': ('arWoSRonAk0.jpg', 0.0, 0.0, 1.0, 1.0),
}
for name, (f, x0, y0, x1, y1) in JOBS.items():
    im = bpy.data.images.load(os.path.join(HERE, 'fotos', f)); w, h = im.size
    px = np.array(im.pixels[:], np.float32).reshape(h, w, 4)[::-1]
    c = px[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    for tw in (1600, 800):
        ch, cw = c.shape[:2]
        out = bpy.data.images.new(f'{name}{tw}', cw, ch, alpha=False)
        out.pixels.foreach_set(c[::-1].astype(np.float32).ravel()); out.scale(tw, int(ch * tw / cw))
        p = os.path.join(DST, f'{name}-{tw}.webp'); out.filepath_raw = p; out.file_format = 'WEBP'; out.save(quality=82)
        print('FOTO', name, tw, out.size[:], os.path.getsize(p) // 1024, 'KB')
