# Umgebung der Musterwohnung: Elbhang mit Laubbäumen, Villen, Strand und Uferweg.
# Ergebnis für den Rundgang:
#   - umgebung_farbe.exr / umgebung_hoehe.exr: Draufsicht (Cycles, gleiche Sonne wie innen) + Höhenkarte
#   - villen.glb: Villen als eigene Netze mit eingebackenem Licht (Wände würden in der Höhenkarte verzerren)
# Aufruf: Blender -b --factory-startup -P umgebung.py -- <ausgabeordner> [samples] [m_pro_pixel]
import bpy, bmesh, sys, os, math, random, json
import numpy as np
from mathutils import Vector, Matrix, noise
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sky, mats
from geo import mesh_obj, collection, world_uv, bm_box

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else os.path.join(os.path.dirname(__file__), 'arbeit', 'umgebung'))
SPP = int(argv[1]) if len(argv) > 1 else 48
MPP = float(argv[2]) if len(argv) > 2 else 0.12
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
TREES = os.path.join(HERE, '..', 'models', 'quelle')

# Bereich der Draufsicht (Blender-Koordinaten)
X0, X1, Y0, Y1 = -260.0, 280.0, -175.0, 60.0
HOUSE = (-0.3, 16.3, -2.4, 10.8)      # Grundfläche Haus inkl. Balkon

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
rnd = random.Random(11)

# ------------------------------------------------------------------ Gelände
def crest(x):      # Hangkante (y), leicht geschwungen
    return -9.0 + 3.0 * math.sin(x / 47.0) + 2.0 * math.sin(x / 19.0 + 1.3)

def height(x, y):
    yc = crest(x)
    top = -14.0
    if y >= yc:      # Hochfläche (Gärten), leicht gewellt
        return top + 0.6 * noise.noise(Vector((x / 40.0, y / 40.0, 0.3))) + min(0.0, (y - yc)) * 0.0
    d = yc - y                                  # Abstand hangabwärts
    L = 108.0 + 8.0 * math.sin(x / 33.0)        # Hanglänge bis zum Strand
    if d <= L:
        t = d / L
        s = t * t * (3 - 2 * t)                 # S-Profil (oben und unten flacher)
        h = top + (-29.4 - top) * s
        h += 1.4 * noise.noise(Vector((x / 22.0, y / 22.0, 1.7))) * math.sin(t * math.pi)   # Rinnen und Kuppen
        return h
    d2 = d - L                                  # Strand, flach ins Wasser
    return -29.4 - min(d2, 30.0) * 0.06 - max(0.0, d2 - 16.0) * 0.12

def zone(x, y):
    yc = crest(x); d = yc - y
    if HOUSE[0] - 22 < x < HOUSE[1] + 22 and yc - 16 < y: return 'plateau'      # Garten vor dem Haus: Rasen
    L = 108.0 + 8.0 * math.sin(x / 33.0)
    if d < 0: return 'plateau'
    if d < L - 7: return 'hang'
    if d < L - 3.5: return 'weg'
    return 'strand'

def build_terrain(M):
    step = 1.5
    nx = int((X1 - X0) / step) + 1; ny = int((Y1 - Y0) / step) + 1
    bm = bmesh.new()
    vs = [[None] * nx for _ in range(ny)]
    for j in range(ny):
        y = Y0 + j * step
        for i in range(nx):
            x = X0 + i * step
            vs[j][i] = bm.verts.new((x, y, height(x, y)))
    zmat = {'plateau': 0, 'hang': 1, 'weg': 2, 'strand': 3}
    for j in range(ny - 1):
        for i in range(nx - 1):
            f = bm.faces.new([vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]])
            c = f.calc_center_median()
            f.material_index = zmat[zone(c.x, c.y)]
    bm.normal_update()
    ob = mesh_obj('gelaende', bm, [M['rasen'], M['waldboden'], M['kies'], M['sand']], 'Umgebung')
    for p in ob.data.polygons: p.use_smooth = True
    return ob

# ------------------------------------------------------------------ Bäume
def load_trees():
    """Lädt alle Baum-Modelle als Vorlagen (Ursprung am Stammfuß, Höhe 1 m)."""
    tpls = []
    for f, keep in (('baum-trees.glb', None), ('baum-buche.glb', None), ('baum-eiche.glb', None), ('baum-birke.glb', None)):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(TREES, f))
        new = [o for o in bpy.data.objects if o not in before]
        meshes = [o for o in new if o.type == 'MESH']
        for o in meshes:
            mw = o.matrix_world.copy(); o.parent = None; o.data = o.data.copy(); o.data.transform(mw); o.matrix_world = Matrix.Identity(4)
        for o in new:
            if o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
        # Packs mit mehreren Bäumen: in einzelne Bäume trennen (Grundriss-Rechtecke, die sich berühren)
        def rect(o):
            xs = [v.co.x for v in o.data.vertices]; ys = [v.co.y for v in o.data.vertices]
            return [min(xs), max(xs), min(ys), max(ys)]
        groups = []
        for o in meshes:
            r = rect(o); hit = [g for g in groups if r[0] < g['r'][1] + 0.3 and r[1] > g['r'][0] - 0.3 and r[2] < g['r'][3] + 0.3 and r[3] > g['r'][2] - 0.3]
            if hit:
                g = hit[0]; g['obs'].append(o)
                g['r'] = [min(g['r'][0], r[0]), max(g['r'][1], r[1]), min(g['r'][2], r[2]), max(g['r'][3], r[3])]
                for h in hit[1:]:
                    g['obs'] += h['obs']; g['r'] = [min(g['r'][0], h['r'][0]), max(g['r'][1], h['r'][1]), min(g['r'][2], h['r'][2]), max(g['r'][3], h['r'][3])]; groups.remove(h)
            else:
                groups.append({'obs': [o], 'r': r})
        for gi, g in enumerate(groups):
            obs = g['obs']
            with bpy.context.temp_override(active_object=obs[0], selected_editable_objects=obs, object=obs[0]):
                if len(obs) > 1: bpy.ops.object.join()
            ob = obs[0]; me = ob.data
            xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
            h = max(zs) - min(zs)
            if h < 0.5: bpy.data.objects.remove(ob, do_unlink=True); continue
            me.transform(Matrix.Translation((-(max(xs) + min(xs)) / 2, -(max(ys) + min(ys)) / 2, -min(zs))))
            me.transform(Matrix.Diagonal((1 / h, 1 / h, 1 / h, 1)))
            w = max(max(xs) - min(xs), max(ys) - min(ys)) / h
            ob.name = f'tpl_{f[:-4]}_{gi}'
            for c in ob.users_collection: c.objects.unlink(ob)
            collection('_Baumvorlagen').objects.link(ob)
            ob.hide_render = True
            tpls.append((ob, w))
            print('BAUM', ob.name, 'Breite/Höhe', round(w, 2), len(me.polygons))
    return tpls

def scatter_trees(tpls):
    coll = collection('Baeume')
    placed = []
    def free(x, y, r):
        for (px, py, pr) in placed:
            if (px - x) ** 2 + (py - y) ** 2 < (0.62 * (r + pr)) ** 2: return False
        return True
    tries = 0
    n = 0
    while tries < 120000:
        tries += 1
        x = rnd.uniform(X0 + 5, X1 - 5); y = rnd.uniform(Y0 + 30, Y1 - 5)
        z = zone(x, y)
        if z in ('weg', 'strand'): continue
        # Haus und Garten davor frei lassen
        if HOUSE[0] - 22 < x < HOUSE[1] + 22 and crest(x) - 16 < y < HOUSE[3] + 14: continue   # Garten vor dem Haus
        if any(v['x0'] - 4 < x < v['x1'] + 4 and v['y0'] - 4 < y < v['y1'] + 4 for v in VILLEN): continue
        if z == 'plateau' and rnd.random() < 0.72: continue         # Gärten: lockerer
        tpl, wr = tpls[rnd.randrange(len(tpls))]
        H = rnd.uniform(12.0, 22.0)
        if wr > 1.6: continue
        g = height(x, y)
        # Blick aus der Wohnung (Augenhöhe +1,6 m) muss über die Kronen hinweg die Elbe ab ~170 m Entfernung zeigen
        ex, ey = min(max(x, 0.0), 16.0), -1.0
        dist = math.hypot(x - ex, y - ey)
        if -170 < x < 190 and y < 4:
            top = -3.0 - 0.19 * dist
            H = min(H, top - g)
            if H < 5.0: H = rnd.uniform(3.5, 5.5)        # dort nur Büsche
        elif y >= 4 and -60 < x < 76:
            H = min(H, 14.0)
        r = 0.5 * wr * H
        if not free(x, y, r): continue
        ob = tpl.copy(); ob.data = tpl.data          # verknüpfte Netze (Instanzen)
        ob.hide_render = False
        coll.objects.link(ob)
        ob.location = (x, y, g - 0.3); ob.rotation_euler = (rnd.uniform(-0.04, 0.04), rnd.uniform(-0.04, 0.04), rnd.uniform(0, 6.283))
        ob.scale = (H * rnd.uniform(0.9, 1.15), H * rnd.uniform(0.9, 1.15), H)
        placed.append((x, y, r)); n += 1
    print('BAEUME', n)
    # Unterholz: kleine Bäume und Büsche zwischen den großen Stämmen
    m = 0
    for _ in range(9000):
        x = rnd.uniform(X0 + 5, X1 - 5); y = rnd.uniform(Y0 + 30, Y1 - 5)
        if zone(x, y) != 'hang': continue
        tpl, wr = tpls[rnd.randrange(len(tpls))]
        if wr > 1.3: continue
        H = rnd.uniform(1.8, 4.2)
        ob = tpl.copy(); ob.data = tpl.data; ob.hide_render = False; coll.objects.link(ob)
        ob.location = (x, y, height(x, y) - 0.2); ob.rotation_euler = (0, 0, rnd.uniform(0, 6.283))
        ob.scale = (H * 1.3, H * 1.3, H); m += 1
    print('UNTERHOLZ', m)

# ------------------------------------------------------------------ Villen
VILLEN = []
def plan_villas():
    spots = [(-48, 3), (-95, -2), (-150, 6), (-205, 0), (62, 2), (112, 5), (168, -1), (226, 4),
             (-70, -42), (-128, -55), (85, -48), (150, -40), (-30, -78), (200, -70)]
    for (x, y) in spots:
        w, d = rnd.uniform(13, 19), rnd.uniform(10, 14)
        VILLEN.append({'x0': x - w / 2, 'x1': x + w / 2, 'y0': y - d / 2, 'y1': y + d / 2,
                       'floors': rnd.choice((2, 2, 3)), 'roof': rnd.choice(('flach', 'walm', 'walm', 'flach'))})

def build_villas(M):
    coll = 'Villen'
    out = []
    for i, v in enumerate(VILLEN):
        x0, x1, y0, y1 = v['x0'], v['x1'], v['y0'], v['y1']
        g = min(height(x, y) for x in (x0, x1) for y in (y0, y1)) - 1.0
        fh = 3.2; H = v['floors'] * fh + 0.6
        bm = bmesh.new()
        bm_box(bm, x0, x1, y0, y1, g, g + H + 1.0)
        bm.normal_update()
        body = mesh_obj(f'villa_{i}', bm, M['putz_weiss'], coll)
        out.append(body)
        # Fenster: dunkle Glasflächen mit hellem Rahmen, je Geschoss
        win = bmesh.new()
        for k in range(v['floors']):
            zb = g + 1.0 + k * fh + 0.85; zt = zb + 1.6
            for side in ('s', 'n', 'w', 'e'):
                L = (x1 - x0) if side in 's n' else (y1 - y0)
                n = max(2, int(L / 2.6))
                for j in range(n):
                    a = (j + 0.5) / n
                    if side == 's' and v['floors'] > 1 and k == v['floors'] - 1 and j % 3 == 1: zb2, zt2 = zb - 0.85, zt   # bodentiefe Fenster
                    else: zb2, zt2 = zb, zt
                    ww = 1.1 if side in 'ns' else 1.0
                    if side == 's': c = x0 + a * (x1 - x0); bm_box(win, c - ww / 2, c + ww / 2, y0 - 0.06, y0 + 0.02, zb2, zt2)
                    if side == 'n': c = x0 + a * (x1 - x0); bm_box(win, c - ww / 2, c + ww / 2, y1 - 0.02, y1 + 0.06, zb2, zt2)
                    if side == 'w': c = y0 + a * (y1 - y0); bm_box(win, x0 - 0.06, x0 + 0.02, c - ww / 2, c + ww / 2, zb2, zt2)
                    if side == 'e': c = y0 + a * (y1 - y0); bm_box(win, x1 - 0.02, x1 + 0.06, c - ww / 2, c + ww / 2, zb2, zt2)
        win.normal_update()
        out.append(mesh_obj(f'villa_{i}_fenster', win, M['fensterglas'], coll))
        # Dach
        rb = bmesh.new()
        top = g + H + 1.0
        if v['roof'] == 'flach':
            bm_box(rb, x0 - 0.25, x1 + 0.25, y0 - 0.25, y1 + 0.25, top, top + 0.35)
            # Staffelgeschoss
            if v['floors'] >= 2:
                sx0, sx1 = x0 + (x1 - x0) * 0.3, x1 - 0.8; sy0, sy1 = y0 + 2.5, y1 - 0.8
                bm_box(rb, sx0, sx1, sy0, sy1, top + 0.35, top + 3.2)
                bm_box(rb, sx0 - 0.2, sx1 + 0.2, sy0 - 0.2, sy1 + 0.2, top + 3.2, top + 3.5)
            mat = M['dach_flach']
        else:
            o = 0.7
            ridge = (y0 + y1) / 2; rh = min(x1 - x0, y1 - y0) * 0.32
            p = [rb.verts.new(c) for c in ((x0 - o, y0 - o, top), (x1 + o, y0 - o, top), (x1 + o, y1 + o, top), (x0 - o, y1 + o, top),
                                           (x0 + (y1 - y0) / 2, ridge, top + rh), (x1 - (y1 - y0) / 2, ridge, top + rh))]
            rb.faces.new([p[0], p[1], p[5], p[4]]); rb.faces.new([p[2], p[3], p[4], p[5]])
            rb.faces.new([p[1], p[2], p[5]]); rb.faces.new([p[3], p[0], p[4]])
            rb.faces.new([p[3], p[2], p[1], p[0]])
            mat = M['dach_ziegel']
        rb.normal_update()
        out.append(mesh_obj(f'villa_{i}_dach', rb, mat, coll))
        # Terrasse aus Stein
        tb = bmesh.new(); bm_box(tb, x0 - 1, x1 + 1, y0 - 5, y0, g + 0.9, g + 1.0); tb.normal_update()
        out.append(mesh_obj(f'villa_{i}_terrasse', tb, M['terrasse'], coll))
    return out

# ------------------------------------------------------------------ Materialien
def varied(name, c1, c2, scale, rough=0.9):
    """Boden mit natürlicher Farbvariation (zwei Rauschebenen, Weltkoordinaten)."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links; b = N['Principled BSDF']
    b.inputs['Roughness'].default_value = rough
    tc = N.new('ShaderNodeTexCoord')
    n1 = N.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 1.0 / scale; n1.inputs['Detail'].default_value = 8
    n2 = N.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 3.0; n2.inputs['Detail'].default_value = 6
    L.new(tc.outputs['Object'], n1.inputs['Vector']); L.new(tc.outputs['Object'], n2.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (*c1, 1); ramp.color_ramp.elements[1].color = (*c2, 1)
    ramp.color_ramp.elements[0].position = 0.3; ramp.color_ramp.elements[1].position = 0.7
    mix = N.new('ShaderNodeMath'); mix.operation = 'MULTIPLY_ADD'
    L.new(n1.outputs['Fac'], mix.inputs[0]); mix.inputs[1].default_value = 0.75; L.new(n2.outputs['Fac'], mix.inputs[2])
    sc_ = N.new('ShaderNodeMath'); sc_.operation = 'MULTIPLY'; sc_.inputs[1].default_value = 0.8
    L.new(mix.outputs[0], sc_.inputs[0]); L.new(sc_.outputs[0], ramp.inputs['Fac'])
    L.new(ramp.outputs['Color'], b.inputs['Base Color'])
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.3
    L.new(n2.outputs['Fac'], bump.inputs['Height']); L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

def materials():
    M = {}
    new = mats.new; tex = mats.textured; ph = mats._ph; acg = mats._acg
    M['rasen'] = varied('u_rasen', (0.045, 0.075, 0.022), (0.11, 0.14, 0.05), 9.0)
    M['waldboden'] = varied('u_waldboden', (0.03, 0.04, 0.018), (0.07, 0.075, 0.035), 3.0, 0.95)   # Efeu, Laub, Unterholz
    M['kies'] = new('u_kies', (0.42, 0.39, 0.33), 0.9)
    M['sand'] = varied('u_sand', (0.42, 0.37, 0.29), (0.56, 0.5, 0.4), 6.0, 0.95)
    M['putz_weiss'] = tex('u_putz', 2.0, None, ph('white_stucco', 'nor_gl'), None, flat_color=(0.78, 0.77, 0.74), rough_val=0.85, nor_strength=0.4)
    M['fensterglas'] = new('u_fenster', (0.02, 0.025, 0.03), 0.08)
    M['dach_flach'] = new('u_dach_flach', (0.12, 0.12, 0.12), 0.7)
    M['dach_ziegel'] = new('u_dach_ziegel', (0.22, 0.08, 0.05), 0.6)
    M['terrasse'] = new('u_terrasse', (0.55, 0.52, 0.47), 0.8)
    return M

M = materials()
plan_villas()
terr = build_terrain(M)
villen = build_villas(M)
# Haus selbst (nur als Schattenwerfer in der Draufsicht)
hb = bmesh.new(); bm_box(hb, HOUSE[0], HOUSE[1], 0.0 - 0.3, 10.8, -14.0, 3.5); hb.normal_update()
haus = mesh_obj('haus_block', hb, M['putz_weiss'], 'Umgebung')
tpls = load_trees()
scatter_trees(tpls)
sun = sky.setup(sc, OUT)

# ------------------------------------------------------------------ Renders
STEPS = os.environ.get('SCHRITTE', 'hoehe,pano').split(',')
PANOS = {'w': (3.5, 3.0, 1.6), 'o': (12.5, 2.5, 1.6)}     # Aufnahmepunkte in der Wohnung (Augenhöhe)
LAT = (-62.0, 14.0)                                        # Breitengrade des Panoramas (unten … etwas über Horizont)
PANO_W = int(os.environ.get('PANO_W', '8192'))
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
sc.cycles.max_bounces = 6; sc.cycles.transparent_max_bounces = 24
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0
for o in villen: o.visible_camera = True
haus.visible_camera = False           # eigenes Haus: wirft Schatten, ist aber nicht im Bild
meta = {'x0': X0, 'x1': X1, 'y0': Y0, 'y1': Y1, 'lat': LAT, 'panos': PANOS}

if 'hoehe' in STEPS:
    # Höhenkarte von oben (nur Tiefe, 1 Sample genügt)
    cam_d = bpy.data.cameras.new('oben'); cam_d.type = 'ORTHO'
    W, Hh = X1 - X0, Y1 - Y0
    cam_d.ortho_scale = W; cam_d.clip_start = 1; cam_d.clip_end = 400
    cam = bpy.data.objects.new('oben', cam_d); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = ((X0 + X1) / 2, (Y0 + Y1) / 2, 150.0); cam.rotation_euler = (0, 0, 0)
    mpp = MPP
    sc.render.resolution_x = int(W / mpp); sc.render.resolution_y = int(Hh / mpp); sc.render.resolution_percentage = 100
    sc.cycles.samples = 1; sc.cycles.use_denoising = False
    vl = sc.view_layers[0]; vl.use_pass_z = True
    sc.render.film_transparent = True
    sc.use_nodes = True; nt = sc.node_tree; nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    fo = nt.nodes.new('CompositorNodeOutputFile'); fo.base_path = OUT; fo.format.file_format = 'OPEN_EXR'; fo.format.color_depth = '32'
    fo.file_slots.clear(); fo.file_slots.new('tiefe')
    nt.links.new(rl.outputs['Depth'], fo.inputs['tiefe'])
    comp = nt.nodes.new('CompositorNodeComposite'); nt.links.new(rl.outputs['Image'], comp.inputs['Image'])
    print('HOEHE', sc.render.resolution_x, 'x', sc.render.resolution_y, flush=True)
    bpy.ops.render.render(write_still=False)
    meta.update({'cam_z': 150.0, 'mpp': mpp, 'w': sc.render.resolution_x, 'h': sc.render.resolution_y})
    sc.use_nodes = False

if 'pano' in STEPS:
    cd = bpy.data.cameras.new('pano'); cd.type = 'PANO'
    try:
        cd.panorama_type = 'EQUIRECTANGULAR'
    except Exception:
        cd.cycles.panorama_type = 'EQUIRECTANGULAR'
    for obj in (cd, getattr(cd, 'cycles', None)):
        if obj is None: continue
        for k, v in (('latitude_min', math.radians(LAT[0])), ('latitude_max', math.radians(LAT[1])),
                     ('longitude_min', -math.pi), ('longitude_max', math.pi)):
            if hasattr(obj, k): setattr(obj, k, v)
    cd.clip_start = 0.5; cd.clip_end = 3000
    pc = bpy.data.objects.new('pano', cd); sc.collection.objects.link(pc); sc.camera = pc
    sc.render.resolution_x = PANO_W; sc.render.resolution_y = int(PANO_W * (LAT[1] - LAT[0]) / 360.0)
    sc.render.resolution_percentage = 100
    sc.cycles.samples = SPP; sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'OPEN_EXR'; sc.render.image_settings.color_depth = '32'
    sc.render.image_settings.color_mode = 'RGBA'
    for k, p in PANOS.items():
        pc.location = p; pc.rotation_euler = (math.pi / 2, 0, -math.pi / 2)   # Blickrichtung Mitte = +x (Osten)
        sc.render.filepath = os.path.join(OUT, f'pano_{k}.exr')
        print('PANO', k, sc.render.resolution_x, 'x', sc.render.resolution_y, flush=True)
        bpy.ops.render.render(write_still=True)
json.dump(meta, open(os.path.join(OUT, 'umgebung.json'), 'w'), indent=1)
print('FERTIG', flush=True)
