# Baumkulisse am Elbhang: Waldkante aus einem Foto, Himmel freigestellt → assets/wohnung/baumkante.webp
import bpy, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
im = bpy.data.images.load(os.path.join(HERE, 'quelle', 'fotos', 'baumkante.jpg'))
w, h = im.size
px = np.array(im.pixels[:], np.float32).reshape(h, w, 4)[::-1, :, :3]
band = px[480:1290, 240:4000].copy()
H, W = band.shape[:2]
# Himmel: Farbe je Zeile aus den obersten Zeilen extrapoliert (glatter Verlauf)
top = band[:40].reshape(-1, 3).mean(0)
d = np.abs(band - top[None, None, :]).max(2)
lum = band.mean(2); blue = band[..., 2] - band[..., 0]
sky = (d < 0.09) | ((blue > 0.12) & (lum > 0.55))
alpha = np.where(sky, 0.0, 1.0).astype(np.float32)
# nur von oben her freistellen: unterhalb der ersten Baumzeile je Spalte alles deckend
first = np.argmax(alpha > 0.5, axis=0)
yy = np.arange(H)[:, None]
alpha = np.where(yy >= first[None, :] + 3, 1.0, alpha)
a = np.pad(alpha, 1, mode='edge'); alpha = sum(a[i:i + H, j:j + W] for i in range(3) for j in range(3)) / 9
rgb = band * alpha[..., None] + top[None, None, :] * (1 - alpha[..., None])
out = bpy.data.images.new('baumkante', W, H, alpha=True)
out.pixels.foreach_set(np.concatenate([rgb, alpha[..., None]], -1)[::-1].astype(np.float32).ravel())
out.scale(2400, int(H * 2400 / W))
p = os.path.join(HERE, '..', '..', 'assets', 'wohnung', 'baumkante.webp')
out.filepath_raw = p; out.file_format = 'WEBP'; out.save(quality=86)
print('BAUM', p, out.size[:], os.path.getsize(p) // 1024, 'KB')
