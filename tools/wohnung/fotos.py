# Beschneidet und verkleinert Objektfotos → assets/img/immobilien/*.webp (Blender-Python)
# Aufruf: Blender -b --factory-startup -P fotos.py
import bpy, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'quelle', 'fotos'); DST = os.path.join(HERE, '..', '..', 'assets', 'img', 'immobilien')
os.makedirs(DST, exist_ok=True)
# name: (x0, y0, x1, y1) als Anteil (y von oben), Zielbreiten
CROPS = {
    'elbhang': (0.12, 0.18, 0.92, 0.92),
    'treppenviertel': (0.0, 0.10, 1.0, 0.78),
    'reetdach': (0.03, 0.08, 0.85, 0.95),
    'neubau': (0.0, 0.08, 1.0, 0.86),
}
for name, (x0, y0, x1, y1) in CROPS.items():
    im = bpy.data.images.load(os.path.join(SRC, name + '.jpg'))
    w, h = im.size
    px = np.array(im.pixels[:], np.float32).reshape(h, w, 4)[::-1]     # Zeile 0 = oben
    c = px[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    for tw in (1600, 800):
        ch, cw = c.shape[:2]; th = int(ch * tw / cw)
        out = bpy.data.images.new(f'{name}_{tw}', cw, ch, alpha=False)
        out.pixels.foreach_set(c[::-1].ravel()); out.scale(tw, th)
        p = os.path.join(DST, f'{name}-{tw}.webp')
        out.filepath_raw = p; out.file_format = 'WEBP'; out.save(quality=82)
        print('FOTO', p, tw, th, os.path.getsize(p) // 1024, 'KB')
