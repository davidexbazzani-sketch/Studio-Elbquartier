# Import und Aufbereitung externer Modelle (glTF/GLB) für die Musterwohnung.
import bpy, bmesh, os, re, math
from mathutils import Vector, Matrix
from geo import collection, world_uv

ROOT = os.path.dirname(os.path.abspath(__file__))
SKETCH = os.path.join(ROOT, '..', 'models', 'quelle')
PH = os.path.join(ROOT, 'quelle', 'ph')

def sf(name): return os.path.join(SKETCH, f'wohnung-{name}.glb')
def ph(name):
    d = os.path.join(PH, name)
    return os.path.join(d, [f for f in os.listdir(d) if f.endswith('.gltf')][0])

_cache = {}

def _import(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    return new

def load(key, path, keep=None, drop=None, target=None, scale=None, rot_fix=0.0, mat_map=None, uv_world=None,
         coll='Moebel', decimate=None, fix_normals=False):
    """Lädt ein Modell einmal, vereint es zu einem Objekt (Ursprung unten mittig, Front zeigt nach -y)
    und gibt eine Vorlage zurück. keep/drop: Regex auf Objektnamen. target: {'w','d','h'} in Metern
    (fehlende Achsen werden proportional skaliert). mat_map: {regex: Material} ersetzt Materialien."""
    if key in _cache: return _cache[key]
    new = _import(path)
    meshes = [o for o in new if o.type == 'MESH']
    if keep: meshes = [o for o in meshes if re.search(keep, o.name)]
    if drop: meshes = [o for o in meshes if not re.search(drop, o.name)]
    for o in new:
        if o not in meshes: pass
    # Welt-Transformation in die Netze übernehmen
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.data = o.data.copy()
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
    for o in new:
        if o not in meshes: bpy.data.objects.remove(o, do_unlink=True)
    # vereinen
    base = meshes[0]
    if len(meshes) > 1:
        ctx = {'active_object': base, 'selected_editable_objects': meshes, 'object': base}
        with bpy.context.temp_override(**ctx):
            bpy.ops.object.join()
    ob = base; ob.name = key
    me = ob.data
    if rot_fix: me.transform(Matrix.Rotation(math.radians(rot_fix), 4, 'Z'))
    # Maße
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    size = Vector((max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)))
    me.transform(Matrix.Translation((-(max(xs) + min(xs)) / 2, -(max(ys) + min(ys)) / 2, -min(zs))))
    if scale is not None:
        s = Vector((scale, scale, scale)) if not isinstance(scale, (tuple, list)) else Vector(scale)
    elif target:
        fac = {}
        for ax, i in (('w', 0), ('d', 1), ('h', 2)):
            if ax in target: fac[i] = target[ax] / size[i]
        u = sum(fac.values()) / len(fac)
        s = Vector((fac.get(0, u), fac.get(1, u), fac.get(2, u)))
    else:
        s = Vector((1, 1, 1))
    me.transform(Matrix.Diagonal((*s, 1)))
    # Materialien ersetzen
    replaced = set()
    if mat_map:
        for i, slot in enumerate(me.materials):
            if not slot: continue
            for pat, mat in mat_map.items():
                if re.search(pat, slot.name):
                    me.materials[i] = mat; replaced.add(i); break
    if uv_world or (replaced and uv_world is None):
        bm = bmesh.new(); bm.from_mesh(me)
        uv = bm.loops.layers.uv.active or bm.loops.layers.uv.new('UVMap')
        for f in bm.faces:
            if uv_world == 'all' or f.material_index in replaced:
                n = f.normal; ax = max(range(3), key=lambda k: abs(n[k]))
                for l in f.loops:
                    p = l.vert.co
                    l[uv].uv = (p.x, p.y) if ax == 2 else ((p.y if n.x > 0 else -p.y), p.z) if ax == 0 else ((-p.x if n.y > 0 else p.x), p.z)
        bm.to_mesh(me); bm.free()
    if fix_normals:
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    if decimate:
        mod = ob.modifiers.new('dec', 'DECIMATE'); mod.ratio = decimate; mod.use_collapse_triangulate = True
        with bpy.context.temp_override(active_object=ob, object=ob, selected_editable_objects=[ob]):
            bpy.ops.object.modifier_apply(modifier='dec')
    for c in ob.users_collection: c.objects.unlink(ob)
    collection('_Vorlagen').objects.link(ob)
    ob.hide_render = True; ob.hide_viewport = True
    _cache[key] = ob
    print('MODELL', key, 'Größe vorher', tuple(round(v, 3) for v in size), '→', tuple(round(v * f, 3) for v, f in zip(size, s)))
    return ob

def put(tpl, name, x, y, z=0.0, rot=0.0, coll='Moebel', scale=1.0):
    """Eigenständige Kopie (eigene Netzdaten, damit jede Kopie eigene Lightmap-Fläche bekommt)."""
    ob = tpl.copy(); ob.data = tpl.data.copy(); ob.name = name
    ob.hide_render = False; ob.hide_viewport = False
    collection(coll).objects.link(ob)
    ob.location = (x, y, z); ob.rotation_euler = (0, 0, math.radians(rot)); ob.scale = (scale,) * 3
    return ob

def face_to(x, y, tx, ty):
    """Drehwinkel (Grad), damit eine nach -y zeigende Front auf (tx, ty) blickt."""
    vx, vy = tx - x, ty - y
    return math.degrees(math.atan2(vx, -vy))
