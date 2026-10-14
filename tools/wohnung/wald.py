# Baumkronen-Textur (Luftbild von oben) kachelbar machen → assets/wohnung/wald.webp
import bpy, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
im = bpy.data.images.load(os.path.join(HERE, 'quelle', 'fotos', 'wald.jpg'))
w, h = im.size
px = np.array(im.pixels[:], np.float32).reshape(h, w, 4)[..., :3]
s = min(w, h); x0 = (w - s) // 2; y0 = (h - s) // 2
sq = px[y0:y0 + s, x0:x0 + s]
# kachelbar: um die halbe Breite verschobene Kopie, an den Rändern weich darübergelegt
sh = np.roll(np.roll(sq, s // 2, 0), s // 2, 1)
t = np.linspace(-1, 1, s)
edge = np.maximum(np.abs(t)[None, :], np.abs(t)[:, None])
mask = np.clip((edge - 0.55) / 0.35, 0, 1)[..., None]
mask = mask * mask * (3 - 2 * mask)
out = sq * (1 - mask) + sh * mask
img = bpy.data.images.new('wald', s, s, alpha=False)
img.pixels.foreach_set(np.concatenate([out, np.ones((s, s, 1), np.float32)], -1).astype(np.float32).ravel())
img.scale(1536, 1536)
p = os.path.join(HERE, '..', '..', 'assets', 'wohnung', 'wald.webp')
img.filepath_raw = p; img.file_format = 'WEBP'; img.save(quality=86)
print('WALD', p, os.path.getsize(p) // 1024, 'KB')
