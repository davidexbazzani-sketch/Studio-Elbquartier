# Echte Blüten (3D-Fotoscans von Sketchfab) für den Strauß-Konfigurator aufbereiten:
# Blüte anhand der Fotofarbe vom grünen Stiel/Laub trennen, aufrecht ausrichten (Blüte zeigt nach +Z,
# Blütenboden im Ursprung), auf Zielgröße bringen, Polygone reduzieren, Textur verkleinern, als GLB speichern.
# Aufruf: Blender -b --factory-startup -P koepfe.py -- <zielordner> [name ...]
import bpy, bmesh, sys, os, math
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'models', 'quelle')
argv = sys.argv[sys.argv.index('--') + 1:]
DST = os.path.abspath(argv[0]); os.makedirs(DST, exist_ok=True)
ONLY = set(argv[1:])

# name: Quelle, Zielgröße (Durchmesser quer zur Blühachse bzw. Höhe), Dreiecke, Optionen
MODELS = {
    'rose-rot':     ('blume-rose-rot.glb', {'diam': 0.40, 'tris': 7000, 'keep_mat': 'petal'}),
    'rose-rosa':    ('blume-rose-pink.glb', {'diam': 0.44, 'tris': 7000}),
    'rose-apricot': ('blume-rose-apricot.glb', {'diam': 0.42, 'tris': 7000, 'hoehe_rel': 0.72}),
    'rose-meilland':('blume-rose-meilland.glb', {'diam': 0.42, 'tris': 7000}),
    'pfingstrose':  ('blume-pfingstrose.glb', {'diam': 0.56, 'tris': 9000, 'axis': (0, 0, 1)}),
    'tulpe':        ('blume-tulpe-rot.glb', {'height': 0.34, 'tris': 6000, 'axis': (0, 0, 1)}),
}

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def import_joined(path):
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in meshes:
        mw = o.matrix_world.copy(); o.parent = None; o.data = o.data.copy(); o.data.transform(mw); o.matrix_world = Matrix.Identity(4)
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
    with bpy.context.temp_override(active_object=meshes[0], selected_editable_objects=meshes, object=meshes[0]):
        if len(meshes) > 1: bpy.ops.object.join()
    return meshes[0]

def base_image(mat):
    if not mat or not mat.use_nodes: return None
    b = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not b or not b.inputs['Base Color'].is_linked:     # unbeleuchtete Fotoscans: erste Bildtextur
        t = next((n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
        return t.image if t else None
    n = b.inputs['Base Color'].links[0].from_node
    while n and n.type != 'TEX_IMAGE':
        ins = [i for i in n.inputs if i.is_linked]
        n = ins[0].links[0].from_node if ins else None
    return n.image if n else None

def face_colors(ob):
    """Mittlere Fotofarbe je Fläche (aus der Grundfarb-Textur an den UV-Koordinaten)."""
    me = ob.data
    imgs = {}
    for i, m in enumerate(me.materials):
        im = base_image(m)
        if im and im.size[0]:
            imgs[i] = (np.array(im.pixels[:], np.float32).reshape(im.size[1], im.size[0], 4), im.size)
    uv = me.uv_layers.active
    cols = np.zeros((len(me.polygons), 3), np.float32)
    for p in me.polygons:
        if p.material_index not in imgs or uv is None:
            cols[p.index] = (0.5, 0.5, 0.5); continue
        px, (w, h) = imgs[p.material_index]
        u = sum(uv.data[li].uv.x for li in p.loop_indices) / p.loop_total
        v = sum(uv.data[li].uv.y for li in p.loop_indices) / p.loop_total
        x = int((u % 1.0) * (w - 1)); y = int((v % 1.0) * (h - 1))
        cols[p.index] = px[y, x, :3]
    return cols

def process(name, src, opt):
    reset()
    ob = import_joined(os.path.join(SRC, src))
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    if 'keep_mat' in opt:
        keep = [i for i, m in enumerate(me.materials) if m and opt['keep_mat'] in m.name.lower()]
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index not in keep], context='FACES')
        bm.faces.ensure_lookup_table()
        green = np.zeros(len(bm.faces), bool)
    else:
        bm.to_mesh(me)
        cols = face_colors(ob)
        r, g, b = cols[:, 0], cols[:, 1], cols[:, 2]
        green = (g > r * 1.02) & (g > b * 0.95) & (g - np.minimum(r, b) > 0.03)
    centers = np.array([f.calc_center_median()[:] for f in bm.faces], np.float32)
    areas = np.array([f.calc_area() for f in bm.faces], np.float32)
    petal = ~green
    if petal.sum() < 10: petal = np.ones(len(bm.faces), bool)
    # Blüte = größter dichter Haufen nicht-grüner Flächen
    pc = centers[petal]; pa = areas[petal]
    diag = float(np.linalg.norm(centers.max(0) - centers.min(0)))
    c = np.average(pc, axis=0, weights=pa)
    for _ in range(6):                                          # robuste Mitte (Ausreißer wie rote Dornen raus)
        d = np.linalg.norm(pc - c, axis=1)
        R = np.percentile(d, 80) * 1.4
        sel = d < R
        c = np.average(pc[sel], axis=0, weights=pa[sel])
    d_all = np.linalg.norm(centers - c, axis=1)
    rad = float(np.percentile(np.linalg.norm(pc - c, axis=1), 92))
    head = (petal & (d_all < rad * 1.35)) | (green & (d_all < rad * 0.95))      # Kelchblätter dicht an der Blüte behalten
    # Blühachse: vom Stielansatz (grüne Flächen knapp unterhalb) zur Blütenmitte
    if 'axis' in opt:
        axis = Vector(opt['axis']).normalized()
    else:
        ring = green & (d_all > rad * 0.6) & (d_all < rad * 2.2)
        if ring.sum() > 5:
            s = np.average(centers[ring], axis=0, weights=areas[ring])
            axis = (Vector(c) - Vector(s)).normalized()
        else:
            axis = Vector((0, 0, 1))
    lay = bm.faces.layers.int.new('petal')
    for i, f in enumerate(bm.faces): f[lay] = 1 if petal[i] else 0
    bmesh.ops.delete(bm, geom=[f for i, f in enumerate(bm.faces) if not head[i]], context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    # ausrichten: Achse → +Z, Blütenboden (tiefster Punkt entlang der Achse) in den Ursprung
    rot = axis.rotation_difference(Vector((0, 0, 1))).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=rot @ Matrix.Translation(-Vector(c)), verts=bm.verts)
    # alles unterhalb des Kelchs (Stielrest, Blätter) abschneiden
    bm.faces.ensure_lookup_table()
    pz = np.array([f.calc_center_median().z for f in bm.faces if f[lay]])
    if len(pz) > 20:
        zcut = np.percentile(pz, 1.5) - rad * 0.12
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z < zcut], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    if 'hoehe_rel' in opt:
        bm.faces.ensure_lookup_table()
        fc = np.array([f.calc_center_median()[:] for f in bm.faces])
        zmax = np.percentile(fc[:, 2], 99.5)
        top = fc[fc[:, 2] > zmax - (zmax - fc[:, 2].min()) * 0.35]
        D = 2 * np.percentile(np.linalg.norm(top[:, :2] - top[:, :2].mean(0), axis=1), 97)
        zcut = zmax - opt['hoehe_rel'] * D
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z < zcut], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    zs = np.array([v.co.z for v in bm.verts]); xy = np.array([(v.co.x, v.co.y) for v in bm.verts])
    z0 = np.percentile(zs, 1.0)
    cxy = xy.mean(0)
    bmesh.ops.translate(bm, vec=Vector((-cxy[0], -cxy[1], -z0)), verts=bm.verts)
    if 'height' in opt:
        s = opt['height'] / (np.percentile(zs, 99.5) - z0)
    else:
        rr = np.linalg.norm(xy - cxy, axis=1)
        s = opt['diam'] / (2 * np.percentile(rr, 98))
    bmesh.ops.scale(bm, vec=Vector((s, s, s)), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    me.update()
    n0 = len(me.polygons)
    ratio = min(1.0, opt['tris'] / max(1, sum(len(p.vertices) - 2 for p in me.polygons)))
    if ratio < 1:
        mod = ob.modifiers.new('dec', 'DECIMATE'); mod.ratio = ratio; mod.use_collapse_triangulate = True
        with bpy.context.temp_override(active_object=ob, object=ob, selected_editable_objects=[ob]):
            bpy.ops.object.modifier_apply(modifier='dec')
    for p in me.polygons: p.use_smooth = True
    # Texturen auf höchstens 1024 px
    for im in bpy.data.images:
        if im.size[0] > 1024: im.scale(1024, max(1, int(im.size[1] * 1024 / im.size[0])))
    # leere Materialplätze entfernen
    used = {p.material_index for p in me.polygons}
    for i in reversed(range(len(me.materials))):
        if i not in used and len(me.materials) > 1:
            ob.active_material_index = i
            with bpy.context.temp_override(active_object=ob, object=ob):
                bpy.ops.object.material_slot_remove()
    ob.name = name
    for o in bpy.context.scene.objects: o.select_set(o == ob)
    out = os.path.join(DST, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True,
                              export_image_format='WEBP' if hasattr(bpy.types, 'Image') else 'AUTO')
    print('KOPF', name, 'Flächen', n0, '→', len(me.polygons), 'Achse', tuple(round(a, 2) for a in axis),
          'Radius', round(rad, 3), 'Skala', round(s, 3), os.path.getsize(out) // 1024, 'KB', flush=True)

for name, (src, opt) in MODELS.items():
    if ONLY and name not in ONLY: continue
    try:
        process(name, src, opt)
    except Exception as e:
        import traceback; traceback.print_exc(); print('FEHLER', name, e)
