# Gegenufer für den Rundgang: Streifen aus dem Foto (Containerterminal gegenüber Övelgönne),
# Himmel freigestellt (Alpha) → assets/wohnung/ufer.webp
import bpy, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
im = bpy.data.images.load(os.path.join(HERE, 'quelle', 'fotos', 'ufer-e4et1JptP2Q.jpg'))
w, h = im.size
px = np.array(im.pixels[:], np.float32).reshape(h, w, 4)[::-1, :, :3]   # Zeile 0 = oben
y0, y1 = 700, 1424            # vom Himmel über den Kränen bis zur Wasserlinie
band = px[y0:y1].copy()
H = band.shape[0]
# Himmel je Zeile: Median der hellsten 60 % (Kräne sind dunkler/satter)
sky = np.zeros((H, 3), np.float32)
for r in range(H):
    row = band[r]
    l = row.mean(1)
    sel = row[l >= np.percentile(l, 70)]
    sky[r] = np.median(sel, axis=0)
# Glätten über die Zeilen
k = 15
pad = np.pad(sky, ((k, k), (0, 0)), mode='edge')
sky = np.stack([np.convolve(pad[:, c], np.ones(2 * k + 1) / (2 * k + 1), mode='valid') for c in range(3)], 1)
d = np.abs(band - sky[:, None, :]).max(2)
alpha = np.clip((d - 0.035) / 0.06, 0, 1)
# heller, ungesättigter Dunst/Wolken → Himmel
lum = band.mean(2); sat = band.max(2) - band.min(2)
hazy = (lum > 0.6) & (sat < 0.28) & (band[..., 2] >= band[..., 0])
alpha[hazy] *= 0.0
# Unterhalb der Uferlinie (Rümpfe, Kaimauer) immer deckend
yy = np.arange(H)[:, None]
alpha = np.maximum(alpha, (yy > H - 42).astype(np.float32))
# leichtes Weichzeichnen der Kante (3×3)
a = np.pad(alpha, 1, mode='edge')
alpha = sum(a[i:i + H, j:j + w] for i in range(3) for j in range(3)) / 9
# untere Kante: 6 px weich ins Wasser
alpha[-6:] *= np.linspace(1, 0.0, 6)[:, None]
# Dunst: Bild auf 2400 px Breite und leicht weich (aus 900 m sieht man keine Schrift)
def blur(img, r):
    k = np.ones(2 * r + 1) / (2 * r + 1)
    out = img
    for ax in (0, 1):
        out = np.apply_along_axis(lambda m: np.convolve(np.pad(m, r, mode='edge'), k, mode='valid'), ax, out)
    return out
band = np.stack([blur(band[..., c], 2) for c in range(3)], -1)
# Schriftzüge an Schiffsrümpfen zusätzlich unkenntlich machen
for (xa, xb) in ((650, 1150), (1250, 1700), (2000, 2650)):
    reg = band[H - 110:H - 20, xa:xb]
    band[H - 110:H - 20, xa:xb] = np.stack([blur(reg[..., c], 7) for c in range(3)], -1)
# vorgemultiplizierte Farbe vermeiden: Himmel-Pixel auf Himmel setzen (keine Säume)
rgb = band * alpha[..., None] + sky[:, None, :] * (1 - alpha[..., None])
out = bpy.data.images.new('ufer', w, H, alpha=True)
rgba = np.concatenate([rgb, alpha[..., None]], -1)[::-1]
out.pixels.foreach_set(rgba.astype(np.float32).ravel())
for name, tw in (('ufer.webp', 2400), ('ufer_klein.webp', 1400)):
    out.scale(tw, int(H * tw / w))
    p = os.path.join(HERE, '..', '..', 'assets', 'wohnung', name)
    out.filepath_raw = p; out.file_format = 'WEBP'; out.save(quality=88)
    print('UFER', p, out.size[:], os.path.getsize(p) // 1024, 'KB')
