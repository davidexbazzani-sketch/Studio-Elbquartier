# Brillenmodelle für die AR-Anprobe vorbereiten (Blender):
#  - Einheit 1 = 1 cm (wie das Gesichtsmodell von MediaPipe), Frontbreite auf Realmaß
#  - Ursprung: Mitte der Brücke auf Höhe der Glasmitten, Vorderseite der Fassung bei z = 0 (glTF),
#    Bügel zeigen nach −z (nach hinten), oben = +y
#  - Materialien umbenannt in rahmen / metall / glas / pads, damit die Seite eigene Materialien setzen kann
# Aufruf: Blender -b --factory-startup -P vorbereiten.py -- <zielordner>
import bpy, bmesh, sys, os, re, json
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'models', 'quelle')
DST = os.path.abspath(sys.argv[sys.argv.index('--') + 1]); os.makedirs(DST, exist_ok=True)

MODELS = {
    # name: Quelle, Frontbreite cm, Material-Zuordnung (Regex → Rolle), Dreiecke
    'elbe':     ('brille-acetat.glb', 13.7, {r'^Frame$': 'rahmen', r'^Frame\.1$': 'glas', r'Handles': 'rahmen'}, 40000),
    'ottensen': ('brille-rayban-rund.glb', 13.4, {r'Default': 'metall', r'Glass': 'glas'}, 30000),
    'kapitaen': ('brille-aviator.glb', 14.4, {r'Black': 'rahmen', r'Glass_tinted': 'glas', r'Gold': 'metall', r'Silver': 'metall2', r'Transparent': 'pads'}, 60000),
}

def reset(): bpy.ops.wm.read_factory_settings(use_empty=True)

info = {}
for name, (src, width, roles, tris) in MODELS.items():
    reset()
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, src))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in meshes:
        mw = o.matrix_world.copy(); o.parent = None; o.data = o.data.copy(); o.data.transform(mw); o.matrix_world = Matrix.Identity(4)
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
    # Rollen-Materialien
    role_mats = {}
    for o in meshes:
        for i, m in enumerate(o.data.materials):
            role = next((r for pat, r in roles.items() if m and re.search(pat, m.name)), 'rahmen')
            if role not in role_mats:
                mm = bpy.data.materials.new(role); mm.use_nodes = True
                col = {'rahmen': (0.1, 0.1, 0.1, 1), 'metall': (0.8, 0.6, 0.3, 1), 'metall2': (0.7, 0.7, 0.7, 1),
                       'glas': (0.9, 0.95, 0.95, 1), 'pads': (0.95, 0.95, 0.9, 1)}[role]
                mm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = col   # verschiedene Farben: sonst fasst glTF-Transform sie zusammen
                role_mats[role] = mm
            o.data.materials[i] = role_mats[role]
            print('MAT', name, m.name if m else None, '→', role)
    with bpy.context.temp_override(active_object=meshes[0], selected_editable_objects=meshes, object=meshes[0]):
        if len(meshes) > 1: bpy.ops.object.join()
    ob = meshes[0]; me = ob.data
    co = np.array([v.co[:] for v in me.vertices])
    # Blender: Front = −y, Bügel nach +y, oben = +z
    ymin = co[:, 1].min()
    depth = co[:, 1].max() - ymin
    front = co[co[:, 1] < ymin + depth * 0.18]                   # Vorderteil (Fassung + Gläser)
    fw = front[:, 0].max() - front[:, 0].min()
    s = width / fw
    cx = (front[:, 0].max() + front[:, 0].min()) / 2
    # Glasmitte (Höhe): Mitte der Glas-Flächen, sonst Mitte der Front
    glass_idx = [i for i, m in enumerate(me.materials) if m and m.name.startswith('glas')]
    gz = None
    if glass_idx:
        vs = set()
        for p in me.polygons:
            if p.material_index in glass_idx: vs.update(p.vertices)
        if vs: g = co[list(vs)]; gz = (g[:, 2].max() + g[:, 2].min()) / 2
    if gz is None: gz = (front[:, 2].max() + front[:, 2].min()) / 2
    # Brückenmitte: vorderste Punkte nahe x = cx
    mid = front[np.abs(front[:, 0] - cx) < fw * 0.06]
    yfront = np.percentile(mid[:, 1], 5) if len(mid) else ymin
    me.transform(Matrix.Diagonal((s, s, s, 1)) @ Matrix.Translation((-cx, -yfront, -gz)))
    # Dreiecke reduzieren (Bügel und Scharniere bleiben fein genug)
    n = sum(len(p.vertices) - 2 for p in me.polygons)
    if n > tris:
        mod = ob.modifiers.new('dec', 'DECIMATE'); mod.ratio = tris / n; mod.use_collapse_triangulate = True
        with bpy.context.temp_override(active_object=ob, object=ob, selected_editable_objects=[ob]):
            bpy.ops.object.modifier_apply(modifier='dec')
    for p in me.polygons: p.use_smooth = True
    co = np.array([v.co[:] for v in me.vertices])
    ob.name = name
    for o in bpy.context.scene.objects: o.select_set(o == ob)
    out = os.path.join(DST, f'{name}.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True,
                              export_texcoords=True, export_normals=True)
    # glTF-Koordinaten: x, z(blender) → y, −y(blender) → z
    info[name] = {'breite': float(co[:, 0].max() - co[:, 0].min()), 'hoehe': float(co[:, 2].max() - co[:, 2].min()),
                  'buegel': float(co[:, 1].max()), 'oben': float(co[:, 2].max()), 'unten': float(co[:, 2].min())}
    print('BRILLE', name, {k: round(v, 2) for k, v in info[name].items()}, os.path.getsize(out) // 1024, 'KB', flush=True)
json.dump(info, open(os.path.join(DST, 'brillen.json'), 'w'), indent=1)
