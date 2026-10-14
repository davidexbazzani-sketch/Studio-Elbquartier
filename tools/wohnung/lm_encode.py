# Wandelt die gebackenen HDR-Lightmaps (EXR) in 8-Bit-WebP für das Web um.
# Kodierung (logarithmisch, gleichmäßige relative Genauigkeit):
#   enc = ln(1 + L/A) / ln(1 + LMAX/A)      L = A * (exp(enc * ln(1 + LMAX/A)) - 1)
# Optional: Entrauschen (OIDN über den Blender-Compositor) und verkleinerte Fassung für Handys.
# Aufruf: Blender -b -P lm_encode.py -- <ordner mit lm_*.exr> <zielordner> [entrauschen 0/1]
import bpy, sys, os, json, glob, math
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = os.path.abspath(argv[0]), os.path.abspath(argv[1])
DENOISE = len(argv) > 2 and argv[2] == '1'
os.makedirs(DST, exist_ok=True)
A = 0.02

def denoise(img):
    sc = bpy.data.scenes.new('dn'); sc.use_nodes = True
    nt = sc.node_tree; nt.nodes.clear()
    n_in = nt.nodes.new('CompositorNodeImage'); n_in.image = img
    dn = nt.nodes.new('CompositorNodeDenoise')
    try: dn.use_hdr = True
    except Exception: pass
    try: dn.prefilter = 'NONE'
    except Exception: pass
    out = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(n_in.outputs['Image'], dn.inputs['Image']); nt.links.new(dn.outputs['Image'], out.inputs['Image'])
    cam = bpy.data.objects.new('dncam', bpy.data.cameras.new('dncam')); sc.collection.objects.link(cam); sc.camera = cam
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.resolution_x, sc.render.resolution_y = img.size; sc.render.resolution_percentage = 100
    sc.render.use_compositing = True; sc.render.use_sequencer = False
    sc.view_settings.view_transform = 'Standard'
    bpy.ops.render.render(scene=sc.name)
    rr = bpy.data.images['Render Result']
    tmp = os.path.join(DST, '_dn.exr')
    sc.render.image_settings.file_format = 'OPEN_EXR'; sc.render.image_settings.color_depth = '32'
    rr.save_render(tmp, scene=sc)
    res = bpy.data.images.load(tmp)
    px = np.array(res.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)
    bpy.data.images.remove(res); os.remove(tmp)
    bpy.data.scenes.remove(sc)
    return px

def push_pull(rgb, mask):
    """Leere Texel (zwischen den UV-Inseln) mit den Farben der Nachbarn füllen, damit beim
    Filtern und in den Mip-Stufen kein Schwarz in die Kanten blutet."""
    levels = [(rgb * mask[..., None], mask.astype(np.float32))]
    while min(levels[-1][1].shape) > 2:
        c, m = levels[-1]
        h, w = m.shape; h2, w2 = h // 2 * 2, w // 2 * 2
        c = c[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2, 3).sum(axis=(1, 3))
        m = m[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2).sum(axis=(1, 3))
        levels.append((c, m))
    # von grob nach fein auffüllen
    c, m = levels[-1]
    fill = c / np.maximum(m, 1e-6)[..., None]
    for c, m in reversed(levels[:-1]):
        h, w = m.shape
        up = np.repeat(np.repeat(fill, 2, 0), 2, 1)
        up = np.pad(up, ((0, max(0, h - up.shape[0])), (0, max(0, w - up.shape[1])), (0, 0)), mode='edge')[:h, :w]
        own = c / np.maximum(m, 1e-6)[..., None]
        fill = np.where((m > 0)[..., None], own, up)
    return np.where(mask[..., None], rgb, fill)

info = {}
for f in sorted(glob.glob(os.path.join(SRC, 'lm_*.exr'))):
    name = os.path.splitext(os.path.basename(f))[0]
    img = bpy.data.images.load(f)
    w, h = img.size
    px = denoise(img) if DENOISE else np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    rgb = np.clip(px[..., :3], 0, None)
    lum = rgb.mean(-1)
    covered = lum > 1e-6
    lmax = float(np.percentile(lum[covered], 99.95)) * 1.15 if covered.any() else 1.0
    rgb = push_pull(rgb, covered)
    k = math.log(1 + lmax / A)
    enc = np.log1p(rgb / A) / k
    # leichtes Dithering gegen Stufen
    enc = np.clip(enc + (np.random.rand(*enc.shape) - 0.5) / 255.0, 0, 1)
    for suffix, scale in (('', 1), ('_klein', 2)):
        e = enc
        if scale > 1:
            e = e[:h - h % 2, :w - w % 2].reshape(h // 2, 2, w // 2, 2, 3).mean(axis=(1, 3))
        hh, ww = e.shape[:2]
        out = bpy.data.images.new(name + suffix, ww, hh, alpha=False, float_buffer=False)
        out.colorspace_settings.name = 'Non-Color'
        rgba = np.concatenate([e, np.ones((hh, ww, 1), np.float32)], axis=-1)
        out.pixels.foreach_set(rgba.astype(np.float32).ravel())
        p = os.path.join(DST, name + suffix + '.webp')
        out.filepath_raw = p; out.file_format = 'WEBP'
        out.save(quality=92)
        print('LM', name + suffix, ww, hh, 'max', round(lmax, 3), os.path.getsize(p) // 1024, 'KB')
    info[name.replace('lm_', '')] = {'max': lmax, 'a': A, 'w': w, 'h': h}
json.dump(info, open(os.path.join(DST, 'lightmaps.json'), 'w'), indent=1)
