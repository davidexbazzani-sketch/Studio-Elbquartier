# Rechte-Bereinigung im Rundgang (13.10.2026): Möbel, die bekannte Designs nachbilden oder Teile mit
# nicht-kommerzieller Lizenz enthalten, durch eigene, schlichte Entwürfe ersetzen.
#   - Sessel (Nachbau eines Harvey-Probber-Sessels)  → eigener Kastensessel (Eiche + Leinen)
#   - Couchtisch (Noguchi-Nachbau)                    → eigener runder Tisch (Travertin auf Eichensockel)
#   - Esszimmer-/Schreibtischstühle (HAY-AAC-Nachbau) → eigener Holzstuhl mit Leinenpolster
#   - Obstschale: Teller (CC BY-NC) entfernt         → eigene Keramikschale, Früchte bleiben (CC BY)
# Aufruf: Blender -b <wohnung.blend> -P nachtrag_recht.py   (speichert die Datei)
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geo import box, cylinder, mesh_obj
import assets as A

M = {k: bpy.data.materials[k] for k in ('eiche_moebel', 'eiche_dunkel', 'leinen', 'boucle', 'travertin_hell', 'keramik')}

def weg(name):
    o = bpy.data.objects.get(name)
    if o:
        me = o.data; bpy.data.objects.remove(o, do_unlink=True)
        if me and me.users == 0: bpy.data.meshes.remove(me)

def vereinen(name, teile, x, y, rot, z=0.0):
    """Teile (in lokalen Koordinaten um 0,0 gebaut) zu einem Objekt vereinen und aufstellen."""
    base = teile[0]
    if len(teile) > 1:
        with bpy.context.temp_override(active_object=base, selected_editable_objects=teile, object=base):
            bpy.ops.object.join()
    base.name = name; base.data.name = name
    for c in list(base.users_collection): c.objects.unlink(base)
    bpy.data.collections['Moebel'].objects.link(base)
    base.location = (x, y, z); base.rotation_euler = (0, 0, math.radians(rot))
    return base

# ------------------------------------------------------------------ Sessel
def sessel(name, x, y, rot):
    t = []
    for s in (-1, 1):   # Seitenwangen aus Eiche, stehen direkt auf dem Boden
        t.append(box(f'{name}_w{s}', s * 0.355 - 0.03, s * 0.355 + 0.03, -0.38, 0.38, 0.0, 0.56, M['eiche_moebel'], 'Moebel', bevel=0.012, segments=3))
    t.append(box(f'{name}_sockel', -0.325, 0.325, -0.35, 0.36, 0.10, 0.34, M['leinen'], 'Moebel', bevel=0.03, segments=4))
    t.append(box(f'{name}_sitz', -0.322, 0.322, -0.375, 0.24, 0.34, 0.47, M['leinen'], 'Moebel', bevel=0.045, segments=5))
    t.append(box(f'{name}_ruecken', -0.322, 0.322, 0.22, 0.38, 0.34, 0.76, M['leinen'], 'Moebel', bevel=0.05, segments=5))
    return vereinen(name, t, x, y, rot)

# ------------------------------------------------------------------ Couchtisch
def couchtisch(x, y):
    t = [cylinder('ct_platte', 0, 0, 0.5, 0.35, 0.39, M['travertin_hell'], 'Moebel', seg=96, bevel=0.006),
         cylinder('ct_sockel', 0, 0, 0.26, 0.0, 0.35, M['eiche_dunkel'], 'Moebel', seg=64, bevel=0.004)]
    return vereinen('couchtisch', t, x, y, 0)

# ------------------------------------------------------------------ Stuhl
def stuhl(name, x, y, rot):
    t = []
    for i, (lx, ly) in enumerate(((-0.195, -0.19), (0.195, -0.19), (-0.195, 0.19), (0.195, 0.19))):
        top = 0.80 if ly > 0 else 0.445   # hintere Beine laufen als Lehnenpfosten weiter
        t.append(cylinder(f'{name}_b{i}', lx, ly, 0.017, 0.0, top, M['eiche_moebel'], 'Moebel', seg=16))
    t.append(box(f'{name}_zarge', -0.21, 0.21, -0.205, 0.205, 0.40, 0.445, M['eiche_moebel'], 'Moebel', bevel=0.006, segments=2))
    t.append(box(f'{name}_polster', -0.205, 0.205, -0.215, 0.18, 0.445, 0.49, M['leinen'], 'Moebel', bevel=0.018, segments=4))
    t.append(box(f'{name}_lehne', -0.215, 0.215, 0.175, 0.205, 0.62, 0.79, M['eiche_moebel'], 'Moebel', bevel=0.008, segments=2))
    return vereinen(name, t, x, y, rot)

# ------------------------------------------------------------------ Austausch
for n in ('sessel_0', 'sessel_1', 'sessel_schlafen', 'sessel_arbeiten', 'couchtisch', 'couchtisch.001', 'stuhl_arbeiten',
          *[f'stuhl_{s}{i}' for s in 'wo' for i in range(3)], 'sessel', 'stuhl'):
    weg(n)

for i, (x, y) in enumerate([(4.75, 2.2), (7.95, 2.2)]):
    sessel(f'sessel_{i}', x, y, A.face_to(x, y, 6.35, 3.25))
sessel('sessel_schlafen', 15.4, 3.85, A.face_to(15.4, 3.85, 13.0, 1.0))
sessel('sessel_arbeiten', 13.0, 9.75, A.face_to(13.0, 9.75, 14.4, 8.2))
couchtisch(6.35, 3.15)
for i, yy in enumerate((2.6, 3.35, 4.1)):
    stuhl(f'stuhl_w{i}', 1.05, yy, A.face_to(1.05, yy, 3.0, yy))
    stuhl(f'stuhl_o{i}', 2.85, yy, A.face_to(2.85, yy, 0.0, yy))
stuhl('stuhl_arbeiten', 14.45, 8.45, A.face_to(14.45, 8.45, 16, 8.45))

# ------------------------------------------------------------------ Obstschale: fremden Teller entfernen, eigene Schale
# die platzierte Schale (die gleichnamige Vorlage in _Vorlagen wird nicht exportiert und gelöscht)
ob = next(o for o in bpy.data.objects if o.name.startswith('obstschale') and 'Moebel' in [c.name for c in o.users_collection])
for o in [o for o in bpy.data.objects if o.name.startswith('obstschale') and o is not ob]: weg(o.name)
me = ob.data
ker = {i for i, m in enumerate(me.materials) if m and m.name == 'keramik'}
bm = bmesh.new(); bm.from_mesh(me)
teller = [f for f in bm.faces if f.material_index in ker]
pts = [v.co.copy() for f in teller for v in f.verts]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
bmesh.ops.delete(bm, geom=teller, context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(me); bm.free()
# Schale als Drehkörper aus einem Profil (Radius, Höhe) in Objektkoordinaten der Obstschale
cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
R = max(hi.x - lo.x, hi.y - lo.y) / 2; Hh = hi.z - lo.z; z0 = lo.z
prof = [(0.0, 0.0), (0.42, 0.0), (0.47, 0.06), (0.62, 0.18), (0.82, 0.45), (0.97, 0.86), (1.0, 1.0),
        (0.965, 1.0), (0.93, 0.86), (0.78, 0.5), (0.58, 0.3), (0.0, 0.26)]
bm = bmesh.new()
seg = 64
ringe = []
for r, h in prof:
    ringe.append([bm.verts.new((cx + R * r * math.cos(2 * math.pi * k / seg), cy + R * r * math.sin(2 * math.pi * k / seg), z0 + Hh * h)) for k in range(seg)])
for a, b in zip(ringe, ringe[1:]):
    for k in range(seg):
        bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
schale = mesh_obj('obstschale_schale', bm, M['keramik'], 'Moebel', smooth=True)
schale.parent = None
schale.matrix_world = ob.matrix_world.copy()
with bpy.context.temp_override(active_object=ob, selected_editable_objects=[ob, schale], object=ob):
    bpy.ops.object.join()
ob.name = 'obstschale'
print('OBSTSCHALE Teller entfernt, eigene Schale', round(R * ob.scale[0], 3), 'm')

bpy.ops.wm.save_mainfile()
print('RECHT fertig', sorted(o.name for o in bpy.data.objects if o.name.startswith(('sessel', 'stuhl', 'couchtisch', 'obstschale'))))
