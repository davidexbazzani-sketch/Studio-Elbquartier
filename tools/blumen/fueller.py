# Füllgrün aus echten Fotos freistellen (Eukalyptus, Schleierkraut, Lavendel) → WebP mit Alpha.
# Hintergrund wird aus dem Foto selbst geschätzt (grob gefilterte Fläche), Vordergrund = deutliche
# Farb- oder Helligkeitsabweichung. Schatten auf dem Papier (nur dunkler, gleiche Farbe) zählen nicht.
# Aufruf: Blender -b --factory-startup -P fueller.py -- <zielordner>
import bpy, sys, os, json
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index('--') + 1:]
DST = os.path.abspath(argv[0]); os.makedirs(DST, exist_ok=True)

# name: Foto, Ausschnitt (x0, y0, x1, y1 als Anteil, y von oben), Schwellen (Farbe, Helligkeit), Zielhöhe px
JOBS = {
    'eukalyptus': ('LGcO26RPdC4.jpg', (0.0, 0.0, 1.0, 1.0), (0.05, 0.10), 1024),
    'schleierkraut': ('z2lM7dCbXkA.jpg', (0.2, 0.15, 0.85, 1.0), (0.035, 0.06), 1024),
    'lavendel': ('qMOMUCGjxLA.jpg', (0.5, 0.08, 0.8, 1.0), (0.07, 0.16), 1024),
}

def load(path):
    im = bpy.data.images.load(path); w, h = im.size
    px = np.array(im.pixels[:], np.float32).reshape(h, w, 4)[::-1, :, :3]   # Zeile 0 = oben
    bpy.data.images.remove(im)
    return px

def box_blur(a, r):
    k = np.ones(2 * r + 1, np.float32) / (2 * r + 1)
    out = a
    for ax in (0, 1):
        out = np.apply_along_axis(lambda m: np.convolve(np.pad(m, r, mode='edge'), k, mode='valid'), ax, out)
    return out

def background(px, step=24):
    """Hintergrund: nur Pixel nahe der typischen Papierfarbe zählen, je Kachel mitteln, Lücken auffüllen."""
    h, w = px.shape[:2]
    med = np.median(px.reshape(-1, 3), axis=0)
    m0 = (np.abs(px - med).max(-1) < 0.09).astype(np.float32)
    gh, gw = h // step, w // step
    P = px[:gh * step, :gw * step].reshape(gh, step, gw, step, 3)
    M = m0[:gh * step, :gw * step].reshape(gh, step, gw, step)
    wsum = M.sum(axis=(1, 3)); csum = (P * M[..., None]).sum(axis=(1, 3))
    ok = wsum > step * step * 0.25
    tile = np.where(ok[..., None], csum / np.maximum(wsum, 1)[..., None], 0)
    known = ok.astype(np.float32)
    for _ in range(60):                                  # Lücken aus der Nachbarschaft füllen
        if known.min() > 0: break
        pad_t = np.pad(tile * known[..., None], ((1, 1), (1, 1), (0, 0)), mode='edge'); pad_k = np.pad(known, 1, mode='edge')
        nb = sum(pad_t[1 + dy:1 + dy + gh, 1 + dx:1 + dx + gw] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        nk = sum(pad_k[1 + dy:1 + dy + gh, 1 + dx:1 + dx + gw] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        fill = (known == 0) & (nk > 0)
        tile[fill] = nb[fill] / nk[fill][..., None]; known[fill] = 1
    tile = np.stack([box_blur(tile[..., c], 2) for c in range(3)], -1)
    yy = ((np.arange(h) + 0.5) / step - 0.5).clip(0, gh - 1); xx = ((np.arange(w) + 0.5) / step - 0.5).clip(0, gw - 1)
    y0 = np.floor(yy).astype(int); x0 = np.floor(xx).astype(int); y1 = np.minimum(y0 + 1, gh - 1); x1 = np.minimum(x0 + 1, gw - 1)
    fy = (yy - y0)[:, None, None]; fx = (xx - x0)[None, :, None]
    return (tile[y0][:, x0] * (1 - fy) * (1 - fx) + tile[y1][:, x0] * fy * (1 - fx) + tile[y0][:, x1] * (1 - fy) * fx + tile[y1][:, x1] * fy * fx)

info = {}
for name, (f, (x0, y0, x1, y1), (tc, tl), th) in JOBS.items():
    px = load(os.path.join(HERE, 'fotos', f))
    h, w = px.shape[:2]
    px = px[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    bg = background(px)
    lum = px.mean(-1); blum = bg.mean(-1)
    chroma = px - lum[..., None]; bchroma = bg - blum[..., None]
    dc = np.abs(chroma - bchroma).max(-1)                  # Farbabweichung
    dl = np.abs(lum - blum)                                # Helligkeitsabweichung
    shadow = (lum < blum) & (dc < tc * 0.8)                # nur dunkler, gleiche Farbe → Schatten
    a = np.clip(np.maximum((dc - tc * 0.5) / tc, np.where(shadow, 0, (dl - tl * 0.5) / tl)), 0, 1)
    # Krümel entfernen (Papierstruktur): Öffnung mit 2 px
    def mn(x): return np.minimum.reduce([np.roll(np.roll(x, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)])
    def mx(x): return np.maximum.reduce([np.roll(np.roll(x, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)])
    if name == 'lavendel': a = mx(mx(mn(mn(a))))
    a = box_blur(a, 1)
    # helle Blüten (Schleierkraut) bleiben weiß: heller als das Papier → Weiß verstärken
    bright = (lum > blum + 0.02)[..., None]
    px = np.where(bright, np.clip(px + (px - bg) * 0.9 + 0.04, 0, 1), px)
    # vom Hintergrund befreite Farbe (gegen helle Säume)
    dec = np.clip((px - bg * (1 - a[..., None])) / np.maximum(a[..., None], 0.35), 0, 1)
    col = np.where(a[..., None] > 0.35, dec, px)
    # zuschneiden auf das Motiv
    ys, xs = np.where(a > 0.5)
    pad = 8
    yb0, yb1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + pad)
    xb0, xb1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + pad)
    col = col[yb0:yb1, xb0:xb1]; a = a[yb0:yb1, xb0:xb1]
    # Stielfuß: Mitte der untersten 3 % deckender Pixel
    hh, ww = a.shape
    rows = np.where(a.max(1) > 0.5)[0]; low = rows[rows > rows.max() - max(3, hh * 0.03)]
    fx = float(np.mean(np.where(a[low] > 0.5)[1])) / ww
    out = np.concatenate([col, a[..., None]], -1)[::-1].astype(np.float32)
    im = bpy.data.images.new(name, ww, hh, alpha=True)
    im.pixels.foreach_set(out.ravel())
    s = th / hh; im.scale(max(8, int(ww * s)), th)
    p = os.path.join(DST, name + '.webp'); im.filepath_raw = p; im.file_format = 'WEBP'; im.save(quality=88)
    info[name] = {'aspect': ww / hh, 'fuss': fx}
    print('FUELLER', name, im.size[:], 'Fuß', round(fx, 2), os.path.getsize(p) // 1024, 'KB', flush=True)
json.dump(info, open(os.path.join(DST, 'fueller.json'), 'w'), indent=1)
