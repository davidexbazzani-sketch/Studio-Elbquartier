# Geometrie-Helfer: Quader mit Welt-UVs (1 Einheit = 1 m), Fasen, Dielenboden, Wände mit Öffnungen.
import bpy, bmesh, math, random
from mathutils import Vector, Matrix

COLL = {}

def collection(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c)
    return c

def world_uv(bm, uvname='UVMap', offset=(0, 0, 0), rot=0.0):
    """Box-Projektion in Weltmetern. rot dreht die Maserung (Grad) auf horizontalen Flächen."""
    uv = bm.loops.layers.uv.get(uvname) or bm.loops.layers.uv.new(uvname)
    ox, oy, oz = offset
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            p = l.vert.co
            x, y, z = p.x + ox, p.y + oy, p.z + oz
            if ax == 2:
                u, v = x * c - y * s, x * s + y * c
            elif ax == 0:
                u, v = (y if n.x > 0 else -y), z
            else:
                u, v = (-x if n.y > 0 else x), z
            l[uv].uv = (u, v)

def mesh_obj(name, bm, mats, coll='Architektur', uv=True, uv_rot=0.0, uv_offset=(0, 0, 0), smooth=False):
    if uv: world_uv(bm, rot=uv_rot, offset=uv_offset)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for m in (mats if isinstance(mats, (list, tuple)) else [mats]):
        me.materials.append(m)
    if smooth:
        for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    collection(coll).objects.link(ob)
    return ob

def bm_box(bm, x0, x1, y0, y1, z0, z1, mat_index=0):
    vs = [bm.verts.new(v) for v in [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                     (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    out = []
    for f in faces:
        fa = bm.faces.new([vs[i] for i in f]); fa.material_index = mat_index; out.append(fa)
    return out

def box(name, x0, x1, y0, y1, z0, z1, mat, coll='Architektur', bevel=0.0, segments=2, uv_rot=0.0, skip=()):
    """skip: Seiten, die weggelassen werden ('-z','+z','-x','+x','-y','+y')."""
    bm = bmesh.new()
    faces = bm_box(bm, x0, x1, y0, y1, z0, z1)
    names = ['-z', '+z', '-y', '+x', '+y', '-x']
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segments, profile=0.5, affect='EDGES',
                        clamp_overlap=True)
    elif skip:
        for f, n in zip(faces, names):
            if n in skip: bm.faces.remove(f)
    bm.normal_update()
    return mesh_obj(name, bm, mat, coll, uv_rot=uv_rot, smooth=bevel > 0)

def rounded_slab(name, cx, cy, w, d, z0, z1, r, mat, coll='Moebel', bevel=0.004, seg=10):
    """Platte mit abgerundeten Ecken (Teppich, Tischplatte)."""
    bm = bmesh.new()
    pts = []
    for i, (sx, sy, a0) in enumerate([(1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)]):
        ccx, ccy = cx + sx * (w / 2 - r), cy + sy * (d / 2 - r)
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((ccx + r * math.cos(a), ccy + r * math.sin(a)))
    bot = [bm.verts.new((x, y, z0)) for x, y in pts]
    top = [bm.verts.new((x, y, z1)) for x, y in pts]
    bm.faces.new(top); bm.faces.new(list(reversed(bot)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([bot[i], bot[j], top[j], top[i]])
    if bevel > 0:
        edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)
    bm.normal_update()
    return mesh_obj(name, bm, mat, coll, smooth=False)

def cylinder(name, cx, cy, r, z0, z1, mat, coll='Moebel', seg=48, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r, depth=z1 - z0,
                          matrix=Matrix.Translation((cx, cy, (z0 + z1) / 2)))
    if bevel > 0:
        edges = [e for e in bm.edges if e.is_boundary is False and abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6
                 and len(e.link_faces) == 2 and abs(e.link_faces[0].normal.z - e.link_faces[1].normal.z) > 0.5]
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=3, profile=0.5, affect='EDGES', clamp_overlap=True)
    bm.normal_update()
    ob = mesh_obj(name, bm, mat, coll)
    for p in ob.data.polygons:
        if abs(p.normal.z) < 0.9: p.use_smooth = True
    return ob

def plank_floor(name, x0, x1, y0, y1, mat_wood, mat_gap, z=0.0, w=0.22, lmin=1.6, lmax=2.6, along='y', seed=7, gap=0.0016):
    """Landhausdielen: jede Diele mit eigener, zufälliger Stelle der Maserung; Fugen als dunkler Grund darunter."""
    rnd = random.Random(seed)
    bm = bmesh.new(); uv = bm.loops.layers.uv.new('UVMap')
    def plank(a0, a1, b0, b1):
        # a = Längsrichtung, b = Querrichtung
        if along == 'y':
            q = [(b0, a0), (b1, a0), (b1, a1), (b0, a1)]
        else:
            q = [(a0, b0), (a0, b1), (a1, b1), (a1, b0)]
        vs = [bm.verts.new((x, y, z)) for x, y in q]
        f = bm.faces.new(vs); f.material_index = 0
        ou, ov = rnd.random() * 8, rnd.random() * 8
        flip = rnd.random() < 0.5
        for l, (x, y) in zip(f.loops, q):
            a = y if along == 'y' else x; b = x if along == 'y' else y
            u = (b - b0) + ou; v = (a - a0) / 1.7 + ov
            if flip: u = -u
            l[uv].uv = (u, v)
    A0, A1 = (y0, y1) if along == 'y' else (x0, x1)
    B0, B1 = (x0, x1) if along == 'y' else (y0, y1)
    b = B0
    while b < B1 - 1e-4:
        bb = min(b + w, B1)
        a = A0 - rnd.random() * lmax
        while a < A1:
            L = rnd.uniform(lmin, lmax)
            pa0, pa1 = max(a, A0), min(a + L, A1)
            if pa1 - pa0 > 0.05:
                plank(pa0 + gap / 2 if pa0 > A0 else pa0, pa1 - gap / 2 if pa1 < A1 else pa1,
                      b + gap / 2 if b > B0 else b, bb - gap / 2 if bb < B1 else bb)
            a += L
        b = bb
    # Fugengrund
    base = [bm.verts.new(v) for v in [(x0, y0, z - 0.0015), (x1, y0, z - 0.0015), (x1, y1, z - 0.0015), (x0, y1, z - 0.0015)]]
    f = bm.faces.new(base); f.material_index = 1
    for l in f.loops: l[uv].uv = (l.vert.co.x, l.vert.co.y)
    bm.normal_update()
    return mesh_obj(name, bm, [mat_wood, mat_gap], 'Boden', uv=False)

def wall(name, axis, c0, c1, t0, t1, z0, z1, openings, mat, coll='Architektur'):
    """Wand entlang einer Achse. axis='x': Wand läuft in x von c0..c1, Dicke in y t0..t1.
    openings: Liste (a0, a1, zb, zt) – Öffnung von a0..a1 (Lauflänge), Brüstung zb, Sturz zt."""
    bm = bmesh.new()
    def add(a0, a1, zz0, zz1):
        if a1 - a0 < 1e-4 or zz1 - zz0 < 1e-4: return
        if axis == 'x': bm_box(bm, a0, a1, t0, t1, zz0, zz1)
        else: bm_box(bm, t0, t1, a0, a1, zz0, zz1)
    ops = sorted(openings)
    a = c0
    for (o0, o1, zb, zt) in ops:
        add(a, o0, z0, z1)
        add(o0, o1, z0, zb)
        add(o0, o1, zt, z1)
        a = o1
    add(a, c1, z0, z1)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    # innere, deckungsgleiche Flächen entfernen
    dup = {}
    for f in list(bm.faces):
        key = tuple(sorted(tuple(round(c, 4) for c in v.co) for v in f.verts))
        dup.setdefault(key, []).append(f)
    for fs in dup.values():
        if len(fs) > 1:
            for f in fs: bm.faces.remove(f)
    bm.normal_update()
    return mesh_obj(name, bm, mat, coll)

def place(ob, x, y, z=0.0, rot=0.0):
    ob.location = (x, y, z); ob.rotation_euler = (0, 0, math.radians(rot))
    return ob
