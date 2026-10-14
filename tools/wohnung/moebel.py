# Einrichtung der Musterwohnung: eigene (prozedurale) Einbauten + platzierte Modelle.
import bpy, bmesh, math, random
from mathutils import Vector, Matrix
from geo import box, rounded_slab, cylinder, mesh_obj, bm_box, collection, world_uv
from arch import H, W, D
import assets as A

def join(name, objs, coll='Moebel'):
    base = objs[0]
    if len(objs) > 1:
        with bpy.context.temp_override(active_object=base, selected_editable_objects=objs, object=base):
            bpy.ops.object.join()
    base.name = name
    for c in base.users_collection: c.objects.unlink(base)
    collection(coll).objects.link(base)
    return base

# ---------------------------------------------------------------- Küche
def kueche(M):
    parts = []
    gap = 0.003
    # Nordzeile x 0..4.75, Tiefe 0.62, Sockel zurückgesetzt
    y0, y1 = D - 0.62, D
    parts.append(box('k_sockel', 0.0, 4.75, y0 + 0.07, y1, 0.0, 0.1, M['schattenfuge'], 'Kueche'))
    n = 6; w = 4.75 / n
    for i in range(n):
        x0 = i * w
        # zwei Schubkästen übereinander mit Griffleiste (Schattenfuge oben)
        parts.append(box(f'k_front_{i}a', x0 + gap, x0 + w - gap, y0, y0 + 0.019, 0.1 + gap, 0.47, M['eiche_moebel'], 'Kueche', bevel=0.0012))
        parts.append(box(f'k_front_{i}b', x0 + gap, x0 + w - gap, y0, y0 + 0.019, 0.47 + gap * 2, 0.84, M['eiche_moebel'], 'Kueche', bevel=0.0012))
    parts.append(box('k_korpus', 0.0, 4.75, y0 + 0.019, y1, 0.1, 0.88, M['lack_greige'], 'Kueche'))
    parts.append(box('k_griffmulde', 0.0, 4.75, y0 + 0.019, y0 + 0.05, 0.84, 0.88, M['schattenfuge'], 'Kueche'))
    parts.append(box('k_platte', 0.0, 4.75, y0 - 0.02, y1, 0.88, 0.92, M['travertin_hell'], 'Kueche', bevel=0.002))
    parts.append(box('k_rueckwand', 0.0, 4.75, y1 - 0.015, y1, 0.92, 1.55, M['travertin_hell'], 'Kueche'))
    parts.append(box('k_bord', 0.4, 4.4, y1 - 0.26, y1 - 0.015, 1.55, 1.59, M['eiche_moebel'], 'Kueche', bevel=0.002))
    # Spüle (Unterbau, Edelstahl) + Armatur (Messing gebürstet)
    parts.append(box('k_spuele', 1.95, 2.65, y0 + 0.08, y0 + 0.5, 0.905, 0.921, M['edelstahl'], 'Kueche'))
    tap = armatur(M, 2.3, y1 - 0.09)
    # Hochschränke an der Ostwand x 4.75..5.4
    xa, xb = 4.75, 5.4
    parts.append(box('k_hoch_korpus', xa + 0.019, xb, 7.55, D, 0.0, H, M['lack_greige'], 'Kueche'))
    cols = [(7.55, 8.3), (8.3, 9.05), (9.05, 9.8), (9.8, D)]
    for j, (a, b) in enumerate(cols):
        if j == 1:  # Backofen + Dampfgarer in Schwarzglas
            parts.append(box('k_ofen', xa, xa + 0.02, a + gap, b - gap, 0.95, 1.55, M['ceran'], 'Kueche', bevel=0.002))
            parts.append(box('k_dampf', xa, xa + 0.02, a + gap, b - gap, 1.55 + gap * 2, 2.0, M['ceran'], 'Kueche', bevel=0.002))
            parts.append(box('k_hf_u', xa, xa + 0.019, a + gap, b - gap, 0.1 + gap, 0.95 - gap, M['lack_greige'], 'Kueche', bevel=0.0012))
            parts.append(box('k_hf_o', xa, xa + 0.019, a + gap, b - gap, 2.0 + gap * 2, H - 0.01, M['lack_greige'], 'Kueche', bevel=0.0012))
            parts.append(box('k_ofengriff', xa - 0.03, xa - 0.012, a + 0.08, b - 0.08, 1.48, 1.5, M['edelstahl'], 'Kueche', bevel=0.004))
        else:
            parts.append(box(f'k_hf_{j}', xa, xa + 0.019, a + gap, b - gap, 0.1 + gap, H - 0.01, M['lack_greige'], 'Kueche', bevel=0.0012))
            # senkrechte Griffleiste
            gy = b - 0.03 if j % 2 == 0 else a + 0.012
            parts.append(box(f'k_griff_{j}', xa - 0.002, xa + 0.019, gy, gy + 0.018, 0.1, H - 0.01, M['schattenfuge'], 'Kueche'))
    parts.append(box('k_hoch_sockel', xa + 0.05, xb, 7.55, D, 0.0, 0.1, M['schattenfuge'], 'Kueche'))
    # Insel x 1.0..4.0, y 7.55..8.6 – Travertin mit Wangen, Kochfeld
    ix0, ix1, iy0, iy1 = 1.0, 4.0, 7.55, 8.6
    parts.append(box('i_platte', ix0, ix1, iy0, iy1, 0.87, 0.92, M['travertin_hell'], 'Kueche', bevel=0.002))
    parts.append(box('i_wange_w', ix0, ix0 + 0.05, iy0, iy1, 0.0, 0.87, M['travertin_hell'], 'Kueche', bevel=0.002))
    parts.append(box('i_wange_o', ix1 - 0.05, ix1, iy0, iy1, 0.0, 0.87, M['travertin_hell'], 'Kueche', bevel=0.002))
    parts.append(box('i_korpus', ix0 + 0.05, ix1 - 0.05, iy0 + 0.3, iy1 - 0.02, 0.1, 0.87, M['lack_greige'], 'Kueche'))
    parts.append(box('i_sockel', ix0 + 0.05, ix1 - 0.05, iy0 + 0.35, iy1 - 0.08, 0.0, 0.1, M['schattenfuge'], 'Kueche'))
    nn = 4; ww = (ix1 - ix0 - 0.1) / nn
    for i in range(nn):
        xx = ix0 + 0.05 + i * ww
        parts.append(box(f'i_front_{i}', xx + gap, xx + ww - gap, iy1 - 0.02, iy1, 0.1 + gap, 0.83, M['eiche_moebel'], 'Kueche', bevel=0.0012))
    parts.append(box('i_griffmulde', ix0 + 0.05, ix1 - 0.05, iy1 - 0.05, iy1 - 0.02, 0.83, 0.87, M['schattenfuge'], 'Kueche'))
    # Theke (Sitzseite Süd): Überstand 0.3, Unterseite Eiche
    parts.append(box('i_kochfeld', 2.1, 2.9, 8.05, 8.55, 0.92, 0.922, M['ceran'], 'Kueche'))
    # Schneidebrett an der Rückwand, angelehnt
    brett = box('k_brett', -0.24, 0.24, -0.011, 0.011, 0.0, 0.38, M['nussbaum'], 'Kueche', bevel=0.004)
    brett.location = (3.25, D - 0.05, 0.92); brett.rotation_euler = (math.radians(-12), 0, 0)
    parts.append(brett)
    for nm in parts: pass
    return parts

def armatur(M, x, y):
    """Einhebel-Küchenarmatur, gebürstetes Messing (Rohr mit Bogen)."""
    cu = bpy.data.curves.new('armatur', 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('BEZIER'); pts = [(0, 0, 0.92), (0, 0, 1.22), (0, -0.2, 1.22), (0, -0.2, 1.12)]
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    sp.bezier_points[1].handle_left_type = sp.bezier_points[1].handle_right_type = 'AUTO'
    cu.bevel_depth = 0.014; cu.bevel_resolution = 6; cu.resolution_u = 24; cu.use_fill_caps = True
    ob = bpy.data.objects.new('armatur', cu); collection('Kueche').objects.link(ob)
    ob.data.materials.append(M['messing'])
    ob.location = (x, y, 0)
    with bpy.context.temp_override(active_object=ob, selected_editable_objects=[ob], object=ob, selected_objects=[ob]):
        bpy.ops.object.convert(target='MESH')
    ob = bpy.data.objects['armatur']
    hebel = cylinder('armatur_hebel', x + 0.04, y, 0.012, 1.0, 1.09, M['messing'], 'Kueche', seg=24)
    sockel = cylinder('armatur_sockel', x, y, 0.025, 0.92, 0.96, M['messing'], 'Kueche', seg=32)
    return [ob, hebel, sockel]

# ---------------------------------------------------------------- Essen
def esstisch(M, cx, cy):
    L, B, T = 2.4, 1.0, 0.045
    top = box('tisch_platte', cx - B / 2, cx + B / 2, cy - L / 2, cy + L / 2, 0.75 - T, 0.75, M['eiche_moebel'], 'Moebel', bevel=0.003)
    legs = []
    for s in (-1, 1):
        yy = cy + s * (L / 2 - 0.42)
        legs.append(box(f'tisch_wange_{s}', cx - 0.36, cx + 0.36, yy - 0.03, yy + 0.03, 0.0, 0.75 - T, M['eiche_moebel'], 'Moebel', bevel=0.003))
    legs.append(box('tisch_traverse', cx - 0.03, cx + 0.03, cy - L / 2 + 0.45, cy + L / 2 - 0.45, 0.5, 0.56, M['eiche_moebel'], 'Moebel', bevel=0.003))
    return [top] + legs

def linear_pendel(M, cx, cy, z, length=1.6):
    p = [box('pendel_balken', cx - 0.025, cx + 0.025, cy - length / 2, cy + length / 2, z, z + 0.04, M['eiche_moebel'], 'Leuchten', bevel=0.004)]
    p.append(box('pendel_licht', cx - 0.018, cx + 0.018, cy - length / 2 + 0.02, cy + length / 2 - 0.02, z - 0.001, z, M['leinen_hell'], 'Leuchten'))
    for s in (-1, 1):
        yy = cy + s * (length / 2 - 0.15)
        p.append(cylinder(f'pendel_seil_{s}', cx, yy, 0.0012, z + 0.04, H - 0.01, M['schwarz_matt'], 'Leuchten', seg=8))
        p.append(cylinder(f'pendel_baldachin_{s}', cx, yy, 0.035, H - 0.012, H, M['messing'], 'Leuchten', seg=32))
    return p

# ---------------------------------------------------------------- Wohnen
def sideboard(M, x_wall, y0, y1):
    """Lowboard mit kannelierten Fronten (Eiche), schwebend an der Wand."""
    d = 0.46; x0 = x_wall - d; z0, z1 = 0.16, 0.66
    parts = [box('sb_korpus', x0 + 0.02, x_wall, y0, y1, z0, z1, M['eiche_moebel'], 'Moebel', bevel=0.002)]
    parts.append(box('sb_platte', x0, x_wall, y0, y1, z1, z1 + 0.025, M['eiche_moebel'], 'Moebel', bevel=0.002))
    bm = bmesh.new()
    step = 0.034; y = y0 + 0.004
    while y + step <= y1 - 0.002:
        # halbrunde Kannelur
        seg = 8
        for k in range(seg):
            a0 = math.pi * k / seg; a1 = math.pi * (k + 1) / seg
            r = step / 2
            ya, yb = y + r - r * math.cos(a0), y + r - r * math.cos(a1)
            xa, xb = x0 + 0.02 - r * 0.55 * math.sin(a0), x0 + 0.02 - r * 0.55 * math.sin(a1)
            vs = [bm.verts.new((xa, ya, z0 + 0.004)), bm.verts.new((xa, ya, z1 - 0.004)),
                  bm.verts.new((xb, yb, z1 - 0.004)), bm.verts.new((xb, yb, z0 + 0.004))]   # Normale zeigt in den Raum
            bm.faces.new(vs)
        y += step
    bm.normal_update()
    fl = mesh_obj('sb_kanneluren', bm, M['eiche_moebel'], 'Moebel', uv=False)
    me = fl.data; me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        p.use_smooth = True
        for li in p.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            me.uv_layers[0].data[li].uv = (v.y, v.z)
    parts.append(fl)
    # Fugen zwischen den Türen
    for k in range(1, 4):
        yy = y0 + (y1 - y0) * k / 4
        parts.append(box(f'sb_fuge_{k}', x0 + 0.005, x0 + 0.021, yy - 0.002, yy + 0.002, z0, z1, M['schattenfuge'], 'Moebel'))
    return parts

def kunst(M, name, axis, c, a, z, w, h, mat=None, depth=0.04, facing=1):
    """Leinwand mit Relieftextur, axis='x': hängt an Wand bei x=c (Fläche in y), facing = Richtung in den Raum."""
    mat = mat or M['kunst_relief']
    if axis == 'x':
        x0, x1 = (c, c + depth) if facing > 0 else (c - depth, c)
        return box(name, x0, x1, a - w / 2, a + w / 2, z - h / 2, z + h / 2, mat, 'Deko', bevel=0.003)
    else:
        y0, y1 = (c, c + depth) if facing > 0 else (c - depth, c)
        return box(name, a - w / 2, a + w / 2, y0, y1, z - h / 2, z + h / 2, mat, 'Deko', bevel=0.003)

def teppich(M, name, cx, cy, w, d, mat=None, rot=0.0):
    ob = rounded_slab(name, 0, 0, w, d, 0.0, 0.012, 0.05, mat or M['teppich'], 'Textil', bevel=0.004)
    ob.location = (cx, cy, 0.0005); ob.rotation_euler = (0, 0, math.radians(rot))
    return ob

def vorhang(M, name, axis, c, a0, a1, gathered=True, inward=1):
    """Leinen-Voile in weichen Falten vom Deckenschlitz bis knapp über den Boden."""
    bm = bmesh.new(); uv = bm.loops.layers.uv.new('UVMap')
    n = max(8, int((a1 - a0) / 0.012)); fold = 0.11 if gathered else 0.16; amp = 0.045 if gathered else 0.03
    z0, z1 = 0.012, H - 0.004
    rows = 12
    grid = []
    rnd = random.Random(hash(name) & 0xffff)
    ph = rnd.random() * 6.28
    for j in range(rows + 1):
        z = z0 + (z1 - z0) * j / rows
        row = []
        for i in range(n + 1):
            a = a0 + (a1 - a0) * i / n
            t = (a - a0) / fold * 2 * math.pi + ph
            # Falten werden unten etwas weiter, oben gerafft
            off = amp * (0.75 + 0.25 * (1 - j / rows)) * math.sin(t) + 0.004 * math.sin(t * 2.7 + j * 0.6)
            p = (c + inward * (0.15 + off), a, z) if axis == 'x' else (a, c + inward * (0.15 + off), z)
            row.append(bm.verts.new(p))
        grid.append(row)
    for j in range(rows):
        for i in range(n):
            f = bm.faces.new([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]])
            for l in f.loops:
                p = l.vert.co
                l[uv].uv = ((p.y if axis == 'x' else p.x), p.z)
    bm.normal_update()
    ob = mesh_obj(name, bm, M['vorhang'], 'Textil', uv=False, smooth=True)
    return ob

def schalter(M, axis, c, a, z=1.05, facing=1, n=1):
    """Lichtschalter/Steckdose (weiß, flach) an Wand."""
    out = []
    for k in range(n):
        aa = a + k * 0.081
        if axis == 'x':
            x0, x1 = (c, c + 0.009) if facing > 0 else (c - 0.009, c)
            out.append(box(f'schalter_{axis}{c:.2f}_{aa:.2f}_{z:.2f}', x0, x1, aa - 0.04, aa + 0.04, z - 0.04, z + 0.04, M['lack_weiss'], 'Details', bevel=0.0025))
        else:
            y0, y1 = (c, c + 0.009) if facing > 0 else (c - 0.009, c)
            out.append(box(f'schalter_{axis}{c:.2f}_{aa:.2f}_{z:.2f}', aa - 0.04, aa + 0.04, y0, y1, z - 0.04, z + 0.04, M['lack_weiss'], 'Details', bevel=0.0025))
    return out

# ---------------------------------------------------------------- Schlafen
def bett(M, cx, y_wall):
    parts = []
    bw, bl = 2.0, 2.15
    y1 = y_wall - 0.04; y0 = y1 - bl
    parts.append(box('bett_kopfteil', cx - 1.1, cx + 1.1, y1 - 0.12, y1, 0.0, 1.15, M['leinen'], 'Bett', bevel=0.035, segments=4))
    parts.append(box('bett_rahmen', cx - bw / 2, cx + bw / 2, y0, y1 - 0.12, 0.08, 0.36, M['leinen'], 'Bett', bevel=0.03, segments=4))
    parts.append(box('bett_sockel', cx - bw / 2 + 0.08, cx + bw / 2 - 0.08, y0 + 0.08, y1 - 0.2, 0.0, 0.08, M['schattenfuge'], 'Bett'))
    parts.append(box('bett_matratze', cx - 0.9, cx + 0.9, y0 + 0.06, y1 - 0.14, 0.36, 0.56, M['bettwaesche'], 'Bett', bevel=0.05, segments=4))
    return parts, (cx, y0, y1)

def nachttisch(M, name, cx, y_wall):
    y1 = y_wall - 0.01; y0 = y1 - 0.42
    p = [box(name + '_korpus', cx - 0.27, cx + 0.27, y0, y1, 0.22, 0.5, M['eiche_moebel'], 'Moebel', bevel=0.003)]
    p.append(box(name + '_fuge', cx - 0.25, cx + 0.25, y0 - 0.001, y0 + 0.01, 0.36, 0.364, M['schattenfuge'], 'Moebel'))
    # Tischleuchte: Travertinfuß + Leinenschirm
    p.append(cylinder(name + '_lampfuss', cx - 0.08, y0 + 0.2, 0.065, 0.5, 0.78, M['travertin_hell'], 'Leuchten', seg=48, bevel=0.01))
    shade = cylinder(name + '_schirm', cx - 0.08, y0 + 0.2, 0.17, 0.74, 0.98, M['leinen_hell'], 'Leuchten', seg=64)
    p.append(shade)
    return p

def bank(M, cx, cy):
    return [box('bank_polster', cx - 0.7, cx + 0.7, cy - 0.21, cy + 0.21, 0.32, 0.46, M['boucle'], 'Moebel', bevel=0.03, segments=4),
            box('bank_gestell', cx - 0.66, cx + 0.66, cy - 0.17, cy + 0.17, 0.0, 0.32, M['eiche_moebel'], 'Moebel', bevel=0.003)]

def schrankwand(M, name, axis, c, a0, a1, depth=0.62, facing=1, h=H):
    """Raumhohe grifflose Schrankfronten (Lack greige) mit senkrechten Fugen."""
    parts = []
    n = max(2, round((a1 - a0) / 0.6)); w = (a1 - a0) / n
    if axis == 'x':  # Wand bei x=c, Fronten in y
        xf = c + facing * depth
        parts.append(box(name + '_korpus', min(c, xf - facing * 0.02), max(c, xf - facing * 0.02), a0, a1, 0.0, h, M['lack_greige'], 'Moebel'))
        for i in range(n):
            ya = a0 + i * w
            x0, x1 = (xf - 0.02, xf) if facing > 0 else (xf, xf + 0.02)
            parts.append(box(f'{name}_front{i}', x0, x1, ya + 0.002, ya + w - 0.002, 0.06, h - 0.004, M['lack_greige'], 'Moebel', bevel=0.0012))
    else:
        yf = c + facing * depth
        parts.append(box(name + '_korpus', a0, a1, min(c, yf - facing * 0.02), max(c, yf - facing * 0.02), 0.0, h, M['lack_greige'], 'Moebel'))
        for i in range(n):
            xa = a0 + i * w
            y0, y1 = (yf - 0.02, yf) if facing > 0 else (yf, yf + 0.02)
            parts.append(box(f'{name}_front{i}', xa + 0.002, xa + w - 0.002, y0, y1, 0.06, h - 0.004, M['lack_greige'], 'Moebel', bevel=0.0012))
    return parts


def _apply_all(ob):
    with bpy.context.temp_override(active_object=ob, object=ob, selected_editable_objects=[ob], selected_objects=[ob]):
        for m in list(ob.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)

def kissen_form(name, cx, cy, cz, w, d, h, rot=(0, 0, 0), mat=None, coll='Bett'):
    """Kopfkissen: unterteilter Würfel, zu einer Kissenform mit spitzen Ecken gedrückt."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=10, use_grid_fill=True)
    rnd = random.Random(hash(name) & 0xffff)
    for v in bm.verts:
        x, y, z = v.co
        # Kissenwulst: in der Mitte dick, an den Rändern dünn, Ecken spitz
        fx = 1 - abs(x) ** 3; fy = 1 - abs(y) ** 3
        bulge = max(0.0, fx * fy) ** 0.55
        v.co.x = x * w / 2 * (1 - 0.06 * (1 - abs(y)) * abs(x))
        v.co.y = y * d / 2 * (1 - 0.06 * (1 - abs(x)) * abs(y))
        v.co.z = z * h / 2 * (0.12 + 0.88 * bulge) + rnd.uniform(-0.002, 0.002)
    bm.normal_update()
    ob = mesh_obj(name, bm, mat, coll, smooth=True)
    mod = ob.modifiers.new('sub', 'SUBSURF'); mod.levels = 1; mod.render_levels = 1
    _apply_all(ob)
    ob.location = (cx, cy, cz); ob.rotation_euler = rot
    return ob

def stoff_sim(name, x0, x1, y0, y1, z, cuts, mat, colliders, frames=48, coll='Bett', thick=0.02, seed=3,
              tension=12.0, bending=0.4, mass=0.25):
    """Stoff (Bettdecke, Plaid) per Cloth-Simulation auf die Kollisionskörper fallen lassen."""
    bm = bmesh.new()
    nx, ny = cuts
    rnd = random.Random(seed)
    grid = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx; y = y0 + (y1 - y0) * j / ny
            row.append(bm.verts.new((x, y, z + rnd.uniform(-0.004, 0.004))))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]])
    ob = mesh_obj(name, bm, mat, coll, smooth=True)   # Welt-UVs (Draufsicht) → Stoffstruktur stimmt
    cm = ob.modifiers.new('Cloth', 'CLOTH')
    st = cm.settings; st.quality = 6; st.mass = mass
    st.tension_stiffness = tension; st.compression_stiffness = tension; st.shear_stiffness = tension * 0.5
    st.bending_stiffness = bending; st.air_damping = 1.0
    cs = cm.collision_settings; cs.distance_min = 0.006; cs.use_self_collision = False
    cm.point_cache.frame_start = 1; cm.point_cache.frame_end = frames
    cols = []
    for c in colliders:
        cc = c.copy(); cc.data = c.data.copy(); collection('_Sim').objects.link(cc)
        m = cc.modifiers.new('Collision', 'COLLISION'); cc.collision.thickness_outer = 0.004
        cc.hide_render = True; cols.append(cc)
    sc = bpy.context.scene
    sc.frame_start = 1; sc.frame_end = frames
    for f in range(1, frames + 1):
        sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = ob.data; ob.modifiers.clear(); ob.data = me; bpy.data.meshes.remove(old)
    for cc in cols: bpy.data.objects.remove(cc, do_unlink=True)
    sc.frame_set(1)
    sol = ob.modifiers.new('dicke', 'SOLIDIFY'); sol.thickness = thick; sol.offset = 1.0
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = 1
    _apply_all(ob)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def bettwaesche(M, cx, y0, y1, colliders):
    # Bettdecke: fällt über die Matratze, hängt seitlich und am Fußende herunter
    decke = stoff_sim('bettdecke', cx - 1.14, cx + 1.14, y0 - 0.12, y1 - 0.68, 0.64, (64, 52), M['bettwaesche'],
                      colliders, frames=50, thick=0.035, seed=5, tension=10, bending=0.6, mass=0.35)
    # Kissen: zwei große, zwei kleine Leinenkissen ans Kopfteil gelehnt
    kz = 0.56
    k = []
    for i, s in enumerate((-1, 1)):
        k.append(kissen_form(f'kissen_gross_{i}', cx + s * 0.45, y1 - 0.34, kz + 0.17, 0.8, 0.52, 0.2,
                             rot=(math.radians(62), 0, math.radians(s * 2)), mat=M['bettwaesche']))
        k.append(kissen_form(f'kissen_klein_{i}', cx + s * 0.3, y1 - 0.52, kz + 0.17, 0.48, 0.48, 0.15,
                             rot=(math.radians(68), 0, math.radians(-s * 4)), mat=M['leinen'] if i == 0 else M['samt_salbei']))
    # Plaid am Fußende quer über der Decke
    plaid = stoff_sim('plaid', cx - 1.2, cx + 1.2, y0 + 0.05, y0 + 0.62, 0.95, (60, 16), M['leinen'],
                      colliders + [decke], frames=45, thick=0.012, seed=9, tension=6, bending=0.15, mass=0.2)
    return [decke, plaid] + k

# ---------------------------------------------------------------- Arbeiten
def schreibtisch(M, cx, cy):
    return [box('st_platte', cx - 0.4, cx + 0.4, cy - 0.85, cy + 0.85, 0.72, 0.75, M['eiche_moebel'], 'Moebel', bevel=0.003),
            box('st_bein_s', cx - 0.36, cx + 0.36, cy - 0.83, cy - 0.79, 0.0, 0.72, M['eiche_moebel'], 'Moebel', bevel=0.003),
            box('st_bein_n', cx - 0.36, cx + 0.36, cy + 0.79, cy + 0.83, 0.0, 0.72, M['eiche_moebel'], 'Moebel', bevel=0.003)]

def regal(M, x_wall, y0, y1):
    d = 0.36; parts = []
    parts.append(box('regal_rueck', x_wall, x_wall + 0.02, y0, y1, 0.0, H - 0.05, M['eiche_moebel'], 'Moebel'))
    for z in (0.0, 0.42, 0.84, 1.26, 1.68, 2.1, 2.52):
        parts.append(box(f'regal_boden_{z}', x_wall, x_wall + d, y0, y1, z, z + 0.03, M['eiche_moebel'], 'Moebel', bevel=0.002))
    for yy in (y0, (y0 + y1) / 2 - 0.015, y1 - 0.03):
        parts.append(box(f'regal_seite_{yy:.2f}', x_wall, x_wall + d, yy, yy + 0.03, 0.0, 2.55, M['eiche_moebel'], 'Moebel', bevel=0.002))
    return parts

def pflanzkuebel(M, name, cx, cy, s=0.7, h=0.6):
    return box(name, cx - s / 2, cx + s / 2, cy - s / 2, cy + s / 2, 0.0, h, M['beton_dunkel'], 'Aussen', bevel=0.01)

def schale_umfaerben(ob, ziel):
    """Blaugraue Kunststoffschale des Stuhls in ein warmes Creme umfärben, Eichenbeine bleiben."""
    import numpy as np
    for slot in ob.material_slots:
        m = slot.material
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links):
                im = n.image; w, h = im.size
                px = np.array(im.pixels[:], np.float32).reshape(h, w, 4)
                r, g, b = px[..., 0], px[..., 1], px[..., 2]
                blau = (b > r + 0.03)
                lum = (0.3 * r + 0.59 * g + 0.11 * b)
                f = np.clip(lum / max(float(np.median(lum[blau])), 1e-3), 0.6, 1.4)
                for c in range(3):
                    px[..., c] = np.where(blau, ziel[c] * f, px[..., c])
                neu = bpy.data.images.new(im.name + '_creme', w, h, alpha=True)
                neu.pixels.foreach_set(px.ravel()); neu.pack()
                n.image = neu
        b = m.node_tree.nodes.get('Principled BSDF')
        if b and not b.inputs['Roughness'].is_linked: b.inputs['Roughness'].default_value = 0.45

def sofa_neu(M, cx=6.35, cy=4.55):
    """Modulsofa in Bouclé (selbst gebaut, saubere Geometrie für die Lichtberechnung).
    Front zeigt nach Süden (−y)."""
    W, D = 2.84, 1.06
    x0, x1, y0, y1 = cx - W / 2, cx + W / 2, cy - D / 2, cy + D / 2
    parts = []
    parts.append(box('sofa_sockel', x0 + 0.08, x1 - 0.08, y0 + 0.08, y1 - 0.08, 0.0, 0.09, M['schattenfuge'], 'Moebel'))
    parts.append(box('sofa_rahmen', x0 + 0.2, x1 - 0.2, y0 + 0.02, y1, 0.09, 0.38, M['boucle'], 'Moebel', bevel=0.035, segments=4))
    for s, xa, xb in ((-1, x0, x0 + 0.24), (1, x1 - 0.24, x1)):
        parts.append(box(f'sofa_lehne_{s}', xa, xb, y0, y1, 0.09, 0.6, M['boucle'], 'Moebel', bevel=0.06, segments=5))
    parts.append(box('sofa_ruecken', x0 + 0.2, x1 - 0.2, y1 - 0.24, y1, 0.36, 0.7, M['boucle'], 'Moebel', bevel=0.06, segments=5))
    sw = (W - 0.48) / 2
    for i in range(2):
        xc = x0 + 0.24 + sw * (i + 0.5)
        parts.append(kissen_form(f'sofa_sitz_{i}', xc, y0 + 0.02 + 0.39, 0.465, sw - 0.012, 0.78, 0.17, mat=M['boucle'], coll='Moebel'))
        parts.append(kissen_form(f'sofa_rueckkissen_{i}', xc, y1 - 0.33, 0.74, sw - 0.03, 0.5, 0.2,
                                 rot=(math.radians(74), 0, 0), mat=M['boucle'], coll='Moebel'))
    return parts

def sofa_kissen(M):
    """Zwei Dekokissen (Leinen, Samt) in den Sofaecken, Licht je Vertex."""
    out = []
    for i, (x, rz, mat) in enumerate(((5.3, 10, 'leinen'), (5.62, -6, 'samt_salbei'), (7.42, -12, 'leinen'))):
        out.append(kissen_form(f'vx_sofakissen_{i}', x, 4.6, 0.75, 0.5 if i != 1 else 0.44, 0.5 if i != 1 else 0.44, 0.16,
                               rot=(math.radians(68), 0, math.radians(rz)), mat=M[mat], coll='Moebel'))
    return out

def sofa_sockel(M):
    """Das Kaufmodell hat unten offene Seitenteile – ein gepolsterter Sockel schließt sie."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=24, use_grid_fill=True)
    for v in bm.verts:
        v.co.x = 6.35 + v.co.x * 2.64; v.co.y = 4.56 + v.co.y * 0.9; v.co.z = 0.155 + v.co.z * 0.25
    bm.normal_update()
    ob = mesh_obj('vx_sofa_sockel', bm, M['boucle'], 'Moebel')
    return ob

def umgebung(M):
    from mats import new
    wasser = new('u_wasser', (0.015, 0.03, 0.035), 0.06)
    hang = new('u_hang', (0.05, 0.07, 0.035), 0.9)
    ufer = new('u_ufer', (0.06, 0.07, 0.06), 0.9)
    bm = bmesh.new()
    for v in [(-3000, -130, -30), (3000, -130, -30), (3000, -3000, -30), (-3000, -3000, -30)]: bm.verts.new(v)
    bm.faces.new(bm.verts); mesh_obj('u_wasser', bm, wasser, 'Umgebung', uv=False)
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in [(-400, -2.4, -14), (400, -2.4, -14), (400, -130, -30), (-400, -130, -30)]]
    bm.faces.new(vs); mesh_obj('u_hang', bm, hang, 'Umgebung', uv=False)
    box('u_gegenufer', -3000, 3000, -1100, -1000, -30, -12, ufer, 'Umgebung')

# ---------------------------------------------------------------- Aufbau
def build(M):
    # zusätzliche Materialien
    from mats import new, textured, _acg, _ph
    M['kunst_relief'] = textured('kunst_relief', 0.9, _acg('Plaster001', 'Color'), _acg('Plaster001', 'NormalGL'), None,
                                 tint=(0.95, 0.88, 0.78), rough_val=0.95, nor_strength=2.5)
    M['kunst_ocker'] = textured('kunst_ocker', 0.7, _acg('Plaster001', 'Color'), _acg('Plaster001', 'NormalGL'), None,
                                tint=(0.78, 0.6, 0.42), rough_val=0.95, nor_strength=2.0)
    M['beton_dunkel'] = textured('beton_dunkel', 1.0, _acg('Plaster001', 'Color'), _acg('Plaster001', 'NormalGL'), None,
                                 tint=(0.42, 0.40, 0.37), rough_val=0.9, nor_strength=1.0)

    kueche(M)
    esstisch(M, 1.95, 3.35)
    linear_pendel(M, 1.95, 3.35, 1.52)
    sideboard(M, 9.2, 1.55, 4.05)
    kunst(M, 'kunst_wohnen', 'x', 9.2, 2.8, 1.62, 1.25, 0.95, facing=-1)
    kunst(M, 'kunst_diele', 'x', 5.52, 8.6, 1.5, 1.0, 1.4, mat=M['kunst_ocker'], facing=1)
    kunst(M, 'kunst_flur', 'x', W, 5.96, 1.5, 0.8, 1.1, facing=-1)
    kunst(M, 'kunst_bett', 'y', 5.2, 12.75, 1.88, 1.7, 0.85, facing=-1)
    teppich(M, 'teppich_wohnen', 6.35, 3.2, 3.6, 2.7)
    teppich(M, 'teppich_schlafen', 12.75, 3.2, 3.2, 2.4, M['teppich_hell'])
    # Diele: Konsole + Garderobenschrank
    box('konsole', 5.52, 5.9, 7.9, 9.3, 0.82, 0.85, M['eiche_moebel'], 'Moebel', bevel=0.002)
    schrankwand(M, 'garderobe', 'x', 9.2, 7.1, 9.9, depth=0.6, facing=-1)
    # Schlafzimmer
    bparts, (bcx, by0, by1) = bett(M, 12.75, 5.2)
    bettwaesche(M, bcx, by0, by1, [o for o in bparts if o.name in ('bett_matratze', 'bett_rahmen', 'bett_kopfteil')])
    nachttisch(M, 'nt_w', 11.3, 5.2)
    nachttisch(M, 'nt_o', 14.2, 5.2)
    bank(M, 12.75, by0 - 0.32)
    schrankwand(M, 'kleiderschrank', 'x', 9.32, 0.5, 4.05, depth=0.62, facing=1)
    # Arbeitszimmer
    schreibtisch(M, 15.2, 8.5)
    regal(M, 12.0, 7.0, 10.35)
    teppich(M, 'teppich_arbeiten', 14.1, 8.7, 2.5, 1.8, M['teppich'])
    kunst(M, 'kunst_arbeiten', 'y', D, 14.2, 1.55, 1.1, 0.75, mat=M['kunst_ocker'], facing=-1)
    cylinder('st_lampfuss', 15.45, 9.15, 0.06, 0.75, 0.77, M['messing'], 'Leuchten', seg=32)
    cylinder('st_lampstab', 15.45, 9.15, 0.008, 0.77, 1.18, M['messing'], 'Leuchten', seg=12)
    cylinder('st_lampschirm', 15.45, 9.15, 0.11, 1.12, 1.26, M['leinen_hell'], 'Leuchten', seg=48)
    # Vorhänge (Voile, seitlich gerafft)
    vorhang(M, 'vh_s1', 'y', 0.0, 0.38, 1.0, inward=1)
    vorhang(M, 'vh_s2', 'y', 0.0, 8.2, 8.84, inward=1)
    vorhang(M, 'vh_w1', 'x', 0.0, 4.95, 5.58, inward=1)
    vorhang(M, 'vh_b1', 'y', 0.0, 9.68, 10.3, inward=1)
    vorhang(M, 'vh_b2', 'y', 0.0, 15.0, 15.62, inward=1)
    vorhang(M, 'vh_o1', 'x', W, 0.82, 1.4, inward=-1)
    # Schalter & Steckdosen
    schalter(M, 'x', 9.2, 6.6, facing=-1, n=2)          # Wohnen, neben Flurtür
    schalter(M, 'y', 6.72, 8.75, facing=1)               # Diele
    schalter(M, 'x', 5.52, 10.2, facing=1, n=2)          # Diele bei Wohnungstür
    schalter(M, 'y', 5.2, 11.25, facing=-1)              # Schlafen
    schalter(M, 'y', 6.72, 13.8, facing=1)               # Arbeiten
    schalter(M, 'x', 9.2, 4.3, z=0.3, facing=-1, n=2)    # Steckdosen Wohnen
    schalter(M, 'y', 5.2, 13.75, z=0.3, facing=-1)       # Steckdose Nachttisch
    schalter(M, 'y', 5.2, 11.75, z=0.3, facing=-1)
    # Umgebung nur für die Lichtberechnung (Elbe, Hang, Gegenufer) – wird nicht exportiert
    umgebung(M)
    # Balkon
    pflanzkuebel(M, 'kuebel_w', 0.5, -1.35)
    pflanzkuebel(M, 'kuebel_o', 15.5, -1.35)

    # --- Modelle ---
    sofa_neu(M)
    probber = A.load('sessel', A.sf('probber'), target={'h': 0.74}, rot_fix=180)
    for i, (x, y) in enumerate([(4.75, 2.2), (7.95, 2.2)]):
        A.put(probber, f'sessel_{i}', x, y, rot=A.face_to(x, y, 6.35, 3.25))
    A.put(probber, 'sessel_schlafen', 15.4, 3.85, rot=A.face_to(15.4, 3.85, 13.0, 1.0))
    A.put(probber, 'sessel_arbeiten', 13.0, 9.75, rot=A.face_to(13.0, 9.75, 14.4, 8.2))
    lounge = A.load('lounge', A.ph('mid_century_lounge_chair'), target={'h': 1.0})
    A.put(lounge, 'lounge', 8.25, 0.95, rot=A.face_to(8.25, 0.95, 5.0, -3.0))
    noguchi = A.load('couchtisch', A.sf('noguchi'), target={'w': 1.28},
                     mat_map={'Glass': M['glas'], '^material$': M['nussbaum'], 'Ash': M['nussbaum']}, uv_world=None)
    A.put(noguchi, 'couchtisch', 6.35, 3.15, rot=8)
    drum = A.load('stehleuchte', A.sf('drumlamp'), target={'h': 1.62},
                  mat_map={'Lamp_Shade_Outside': M['leinen_hell'], 'Lamp_Shade_Inside': M['leinen_hell'],
                           'Black_Metal': M['bronze']}, drop=None)
    A.put(drum, 'stehleuchte', 8.45, 4.85, rot=200)
    stuhl = A.load('stuhl', A.sf('diningset'), keep=r'^AAC_CHAIR_AAC', target={'h': 0.8})
    schale_umfaerben(stuhl, (0.80, 0.74, 0.65))
    for i, yy in enumerate((2.6, 3.35, 4.1)):
        A.put(stuhl, f'stuhl_w{i}', 1.05, yy, rot=A.face_to(1.05, yy, 3.0, yy))
        A.put(stuhl, f'stuhl_o{i}', 2.85, yy, rot=A.face_to(2.85, yy, 0.0, yy))
    A.put(stuhl, 'stuhl_arbeiten', 14.45, 8.45, rot=A.face_to(14.45, 8.45, 16, 8.45))
    hocker = A.load('barhocker', A.sf('barstool'), keep=r'defaultMaterial\.00[123]', target={'h': 0.95},
                    mat_map={'Sedalo': M['leinen'], 'Nogice': M['eiche_moebel'], 'Metal_LP': M['messing']}, decimate=0.3)
    for i, x in enumerate((1.7, 2.5, 3.3)):
        A.put(hocker, f'barhocker_{i}', x, 7.15, rot=A.face_to(x, 7.15, x, 9.0))
    M['opal'] = new('opal', (0.86, 0.85, 0.83), 0.18)
    globe = A.load('kugelleuchte', A.ph('modern_ceiling_lamp_01'), scale=1.0,
                   mat_map={'globe': M['opal'], '_glass': M['opal'], 'modern_ceiling_lamp_01$': M['messing']})
    for i, x in enumerate((2.0, 3.0)):
        A.put(globe, f'kugelleuchte_{i}', x, 8.07, z=H - globe.dimensions.z if globe.dimensions.z else H - 0.952, coll='Leuchten')
    # Pflanzen
    A.put(A.load('monstera', A.sf('monstera'), target={'h': 1.45}), 'monstera', 3.85, 0.6, rot=30)
    A.put(A.load('palme', A.sf('fanpalm'), target={'h': 1.6}, decimate=0.5), 'palme', 8.8, 10.1, rot=-20)
    efeu = A.load('efeutute', A.sf('pothos'), target={'h': 0.8})
    A.put(efeu, 'efeutute', 0.45, 6.15, rot=40)
    A.put(efeu, 'efeutute_arbeiten', 15.55, 10.1, rot=200)
    A.put(A.load('monstera', A.sf('monstera'), target={'h': 1.45}), 'monstera_schlafen', 10.35, 0.5, rot=-60)
    olive = A.load('olive', A.sf('olive'), target={'h': 1.75}, decimate=0.4)
    A.put(olive, 'olive_w', 0.5, -1.35, z=0.58, rot=10, coll='Aussen')
    A.put(olive, 'olive_o', 15.5, -1.35, z=0.58, rot=140, coll='Aussen')
    A.put(A.load('bistro', A.ph('outdoor_table_chair_set_01')), 'bistro', 3.2, -1.35, rot=90, coll='Aussen')
    # Deko
    vasen = [A.load(f'vase{i}', A.ph(f'ceramic_vase_0{i}')) for i in (1, 2, 3, 4)]
    A.put(vasen[0], 'vase_sb1', 8.97, 1.95, z=0.685)
    A.put(vasen[3], 'vase_sb2', 8.95, 2.25, z=0.685, rot=60)
    A.put(vasen[2], 'vase_tisch', 1.95, 3.2, z=0.75)
    A.put(vasen[1], 'vase_konsole', 5.72, 8.3, z=0.85)
    A.put(vasen[0], 'vase_kueche', 0.6, D - 0.13, z=1.59, scale=0.7)
    A.put(vasen[2], 'vase_regal', 12.2, 7.5, z=1.29)
    A.put(vasen[3], 'vase_regal2', 12.2, 9.4, z=0.45)
    A.put(vasen[1], 'vase_schreibtisch', 15.4, 7.85, z=0.75, scale=0.8)
    A.put(A.load('obstschale', A.sf('fruitbowl'), mat_map={'^None$': M['keramik'], 'None_sf': M['keramik']}),
          'obstschale', 1.55, 8.0, z=0.92)
    A.put(A.load('sukkulente', A.ph('potted_plant_04')), 'sukkulente', 3.6, D - 0.2, z=0.92)
    holzschale = A.load('holzschale', A.ph('wooden_bowl_01'))
    A.put(holzschale, 'holzschale', 6.25, 3.05, z=0.39)
    A.put(holzschale, 'holzschale_kueche', 4.2, D - 0.3, z=0.92, rot=40, scale=0.9)
    kissen = A.load('kissen', A.ph('throw_pillows_01'), mat_map={'throw_pillows': M['leinen']}, uv_world='all',
                    target={'w': 0.95})
    sofa_kissen(M)
    buecher = A.load('buecher', A.ph('book_encyclopedia_set_01'), mat_map={'cover': M['leinen']})
    for i, (yy, z) in enumerate([(8.1, 0.45), (9.6, 1.29), (7.6, 1.71), (9.0, 2.13), (8.4, 0.87)]):
        A.put(buecher, f'buecher_{i}', 12.2, yy, z=z, rot=90)
