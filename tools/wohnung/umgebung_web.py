# Umgebung für den Rundgang aufbereiten:
#   - Höhenkarte (Tiefe von oben) → Tiefenmodell umgebung.glb (Gelände + Kronen + Villen als Höhenfeld)
#   - Panoramen (EXR mit Alpha) → umgebung_<k>.webp (+ _klein), sRGB von 0..4 wie der Himmel
#   - Metadaten → umgebung.json
# Aufruf: Blender -b --factory-startup -P umgebung_web.py -- <umgebung-ordner> <ziel assets/wohnung>
import bpy, bmesh, sys, os, json, math
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = os.path.abspath(argv[0]), os.path.abspath(argv[1])
meta = json.load(open(os.path.join(SRC, 'umgebung.json')))
SCALE = 4.0

def load(path):
    im = bpy.data.images.load(path); w, h = im.size
    return np.array(im.pixels[:], np.float32).reshape(h, w, 4), w, h

# ------------------------------------------------------------------ Höhenfeld
px, w, h = load(os.path.join(SRC, 'tiefe0001.exr'))
z = px[..., 0]
height = meta['cam_z'] - z
height[z > 1e5] = -30.5                     # nichts getroffen → unter Wasser
# Blätterlücken schließen: Maximum (3×3) dann Minimum (3×3), danach weich
def filt(a, fn, r):
    pad = np.pad(a, r, mode='edge'); out = None
    for dy in range(2 * r + 1):
        for dx in range(2 * r + 1):
            s = pad[dy:dy + a.shape[0], dx:dx + a.shape[1]]
            out = s if out is None else fn(out, s)
    return out
height = filt(height, np.maximum, 2)
height = filt(height, np.minimum, 1)
k = np.array([1, 4, 6, 4, 1], np.float32); k /= k.sum()
for ax in (0, 1):
    height = np.apply_along_axis(lambda m: np.convolve(np.pad(m, 2, mode='edge'), k, mode='valid'), ax, height)
# Raster (Blender-Bild: Zeile 0 = unten = y0)
step = 2                                     # 0,3 m × 2 = 0,6 m Raster
hs = height[::step, ::step]
ny, nx = hs.shape
x0, x1, y0, y1 = meta['x0'], meta['x1'], meta['y0'], meta['y1']
xs = np.linspace(x0, x1, nx); ys = np.linspace(y0, y1, ny)
bm = bmesh.new()
verts = [[bm.verts.new((xs[i], ys[j], float(hs[j, i]))) for i in range(nx)] for j in range(ny)]
# Wohnung und Balkon frei lassen (das Haus selbst ist ja da)
def inside_house(x, y): return -0.5 < x < 16.5 and -2.6 < y < 11.0
for j in range(ny - 1):
    for i in range(nx - 1):
        cx, cy = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2
        if inside_house(cx, cy): continue
        if max(hs[j, i], hs[j, i + 1], hs[j + 1, i], hs[j + 1, i + 1]) < -30.3: continue   # reines Wasser
        bm.faces.new([verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]])
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context='VERTS')
me = bpy.data.meshes.new('umgebung'); bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new('umgebung', me); bpy.context.scene.collection.objects.link(ob)
n0 = len(me.polygons)
mod = ob.modifiers.new('dec', 'DECIMATE'); mod.ratio = 0.3; mod.use_collapse_triangulate = True
with bpy.context.temp_override(active_object=ob, object=ob, selected_editable_objects=[ob]):
    bpy.ops.object.modifier_apply(modifier='dec')
print('HOEHENFELD', nx, 'x', ny, n0, '→', len(me.polygons), 'Flächen')
for o in bpy.context.scene.objects: o.select_set(o == ob)
bpy.ops.export_scene.gltf(filepath=os.path.join(DST, 'umgebung.glb'), export_format='GLB', use_selection=True,
                          export_normals=False, export_texcoords=False, export_materials='NONE', export_yup=True)

# ------------------------------------------------------------------ Panoramen
def srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)
for k in meta['panos']:
    px, w, h = load(os.path.join(SRC, f'pano_{k}.exr'))
    a = px[..., 3:4]
    rgb = np.where(a > 1e-4, px[..., :3] / np.maximum(a, 1e-4), 0)      # nicht vorvervielfacht
    out = np.concatenate([srgb(rgb / SCALE), np.clip(a, 0, 1)], -1).astype(np.float32)
    for suffix, tw in (('', w), ('_klein', w // 2)):
        im = bpy.data.images.new(f'u_{k}{suffix}', w, h, alpha=True, float_buffer=False)
        im.colorspace_settings.name = 'Non-Color'
        im.pixels.foreach_set(out.ravel())
        if tw != w: im.scale(tw, h * tw // w)
        p = os.path.join(DST, f'umgebung_{k}{suffix}.webp')
        im.filepath_raw = p; im.file_format = 'WEBP'; im.save(quality=86)
        print('PANO', p, im.size[:], os.path.getsize(p) // 1024, 'KB')
json.dump({'panos': meta['panos'], 'lat': meta['lat'], 'skala': SCALE}, open(os.path.join(DST, 'umgebung.json'), 'w'), indent=1)
print('FERTIG')
