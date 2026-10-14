# Lichtberechnung (Cycles) und Export für den Web-Rundgang.
#  - Große Flächen: Lightmaps (Bestrahlungsstärke ohne Albedo) in UV-Kanal 'lm' → EXR
#  - Kleine/organische Objekte: Licht je Vertex im Attribut '_lm'
#  - Reflexions-Panoramen (HDR) je Raum
#  - GLB ohne Lichter/Kameras/Umgebung
# Aufruf: Blender -b wohnung.blend -P bake.py -- <ausgabeordner> <auflösungsfaktor> <samples> [schritte]
import bpy, bmesh, sys, os, math, json, time
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = os.path.abspath(argv[0]); os.makedirs(OUT, exist_ok=True)
RES = float(argv[1]) if len(argv) > 1 else 1.0
SPP = int(argv[2]) if len(argv) > 2 else 256
STEPS = argv[3].split(',') if len(argv) > 3 else ['uv', 'lm', 'vx', 'env', 'mask', 'glb']
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
sc.cycles.samples = SPP; sc.cycles.use_adaptive_sampling = False
sc.cycles.use_denoising = False
sc.render.bake.margin = 6; sc.render.bake.margin_type = 'EXTEND'

def log(*a): print('BAKE', time.strftime('%H:%M:%S'), *a, flush=True)

# ------------------------------------------------------------------ Gruppen
VX_NAMES = ('vx_', 'sessel', 'lounge', 'couchtisch', 'stehleuchte', 'stuhl', 'barhocker', 'kugelleuchte', 'monstera', 'palme',
            'efeutute', 'olive', 'bistro', 'vase', 'obstschale', 'sukkulente', 'holzschale', 'kissen', 'buecher',
            'vh_', 'pendel_seil', 'pendel_baldachin', 'armatur', 'nt_w_schirm', 'nt_o_schirm', 'nt_w_lampfuss', 'nt_o_lampfuss')
SKIP_NAMES = ('glas', 'gelaender_glas')
LM_GROUPS = {   # Gruppe: (Auflösung, Kollektionen)
    'boden': (4096, None),
    'wand': (4096, ('Architektur', 'Details', 'Fenster', 'Tueren')),
    'moebel': (4096, ('Kueche', 'Moebel', 'Textil', 'Bett', 'Deko', 'Leuchten')),
    'aussen': (2048, ('Aussen',)),
}

def export_objects():
    out = []
    for o in sc.objects:
        if o.type != 'MESH' or o.hide_render: continue
        cols = {c.name for c in o.users_collection}
        if cols & {'Umgebung', '_Vorlagen'}: continue
        out.append(o)
    return out

def classify():
    groups = {k: [] for k in LM_GROUPS}; vx = []; skip = []
    for o in export_objects():
        n = o.name
        if n in SKIP_NAMES: skip.append(o); continue
        if n in ('boden', 'bad_boden'): groups['boden'].append(o); continue
        if n.startswith(VX_NAMES): vx.append(o); continue
        cols = {c.name for c in o.users_collection}
        for g, (_, cs) in LM_GROUPS.items():
            if cs and cols & set(cs): groups[g].append(o); break
        else:
            vx.append(o)
    return groups, vx, skip

GROUPS, VX, SKIP = classify()
ONLY = set(filter(None, os.environ.get('BAKE_GROUPS', '').split(',')))   # z. B. BAKE_GROUPS=moebel
def wanted(g): return not ONLY or g in ONLY
for g, obs in GROUPS.items(): log(g, len(obs), 'Objekte')
log('vertex', len(VX), 'skip', len(SKIP))

def select_only(obs):
    bpy.ops.object.mode_set(mode='OBJECT') if bpy.context.object and bpy.context.object.mode != 'OBJECT' else None
    for o in sc.objects: o.select_set(False)
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]

# ------------------------------------------------------------------ UV 'lm'
FLOOR_BOUNDS = (0.0, 16.0, 0.0, 10.5)

def make_lm_uvs():
    for g, obs in GROUPS.items():
        if not wanted(g): continue
        for o in obs:
            me = o.data
            if o.data.users > 1: o.data = o.data.copy(); me = o.data
            lm = me.uv_layers.get('lm') or me.uv_layers.new(name='lm')
            me.uv_layers.active = lm
            for uvl in me.uv_layers: uvl.active_render = (uvl.name != 'lm' and uvl == me.uv_layers[0])
        if g == 'boden':
            x0, x1, y0, y1 = FLOOR_BOUNDS
            for o in obs:
                me = o.data; lm = me.uv_layers['lm']
                mw = o.matrix_world
                for poly in me.polygons:
                    fuge = o.material_slots[poly.material_index].material.name.startswith('fuge') if o.material_slots else False
                    for li in poly.loop_indices:
                        p = mw @ me.vertices[me.loops[li].vertex_index].co
                        # Fugengrund (unter den Dielen) nicht in die Lightmap schreiben: winzige Ecke
                        lm.data[li].uv = (0.9995, 0.9995) if fuge else ((p.x - x0) / (x1 - x0), (p.y - y0) / (y1 - y0))
            continue
        select_only(obs)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0,
                                 correct_aspect=True, scale_to_bounds=False)
        res = LM_GROUPS[g][0] * RES
        bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, margin_method='FRACTION',
                                margin=6.0 / res, shape_method='CONCAVE', scale=True)
        bpy.ops.object.mode_set(mode='OBJECT')
        log('UV', g, 'fertig')

# ------------------------------------------------------------------ Lightmaps
def bake_lm():
    info = {}
    for g, obs in GROUPS.items():
        if not obs or not wanted(g): continue
        r = int(LM_GROUPS[g][0] * RES)
        w, h = (r, int(r * 10.5 / 16)) if g == 'boden' else (r, r)
        # immer ein frisches Bild (ein aus der Datei geladenes altes kann den Farbraum verfälschen)
        old = bpy.data.images.get('lm_' + g)
        if old: old.name = 'lm_' + g + '_alt'; bpy.data.images.remove(old)
        img = bpy.data.images.new('lm_' + g, w, h, alpha=False, float_buffer=True)
        img.colorspace_settings.name = 'Linear Rec.709' if 'Linear Rec.709' in [c.identifier for c in img.colorspace_settings.bl_rna.properties['name'].enum_items] else img.colorspace_settings.name
        # Für die Berechnung alle Objekte der Gruppe zu EINEM Netz vereinen (Kopie) – sonst rechnet Cycles
        # jedes Objekt einzeln mit vollem Szenen-Abgleich. Die UVs 'lm' bleiben dabei erhalten.
        copies = []
        for o in obs:
            c = o.copy(); c.data = o.data.copy(); sc.collection.objects.link(c); copies.append(c)
            o.hide_render = True
        for c in copies:
            c.data.uv_layers.active = c.data.uv_layers['lm']
        with bpy.context.temp_override(active_object=copies[0], selected_editable_objects=copies, object=copies[0]):
            bpy.ops.object.join()
        joined = copies[0]
        mats = {s.material for s in joined.material_slots if s.material}
        nodes = []
        for m in mats:
            nt = m.node_tree
            n = nt.nodes.new('ShaderNodeTexImage'); n.image = img; n.name = '__bake'
            nt.nodes.active = n; nodes.append((nt, n))
        select_only([joined])
        t = time.time(); log('Lightmap', g, w, 'x', h, 'Objekte', len(obs))
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=6, use_clear=True,
                            target='IMAGE_TEXTURES')
        log('Lightmap', g, 'fertig in', round(time.time() - t), 's')
        for nt, n in nodes: nt.nodes.remove(n)
        bpy.data.objects.remove(joined, do_unlink=True)
        for o in obs: o.hide_render = False
        path = os.path.join(OUT, f'lm_{g}.exr')
        img.filepath_raw = path; img.file_format = 'OPEN_EXR'; img.save()
        info[g] = {'w': w, 'h': h}
    old = json.load(open(os.path.join(OUT, 'lightmaps.json'))) if ONLY and os.path.exists(os.path.join(OUT, 'lightmaps.json')) else {}
    old.update(info)
    json.dump(old, open(os.path.join(OUT, 'lightmaps.json'), 'w'))

# ------------------------------------------------------------------ Vertex-Licht
def bake_vx():
    """Licht je Vertex. Auch hier wird auf einer vereinten Kopie gerechnet; Herkunft (Objekt, Vertex)
    steht in Integer-Attributen und das Ergebnis wird danach zurückverteilt."""
    import numpy as np
    nur = set(filter(None, os.environ.get('VX_NUR', '').split(',')))
    obs = [o for o in VX if not nur or o.name in nur]
    copies = []
    for i, o in enumerate(obs):
        if o.data.users > 1: o.data = o.data.copy()
        c = o.copy(); c.data = o.data.copy(); sc.collection.objects.link(c); copies.append(c)
        me = c.data; n = len(me.vertices)
        a = me.attributes.new('src_o', 'INT', 'POINT'); a.data.foreach_set('value', np.full(n, i, dtype=np.int32))
        b = me.attributes.new('src_v', 'INT', 'POINT'); b.data.foreach_set('value', np.arange(n, dtype=np.int32))
        o.hide_render = True
    with bpy.context.temp_override(active_object=copies[0], selected_editable_objects=copies, object=copies[0]):
        bpy.ops.object.join()
    j = copies[0]; me = j.data
    ca = me.color_attributes.new('_lm', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = ca
    select_only([j])
    t = time.time(); log('Vertex-Licht', len(obs), 'Objekte', len(me.vertices), 'Vertices')
    sc.cycles.samples = SPP * 4   # Licht je Vertex ist billig, aber Rauschen fällt hier stark auf
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, target='VERTEX_COLORS')
    log('Vertex-Licht fertig in', round(time.time() - t), 's')
    sc.cycles.samples = SPP
    n = len(me.vertices)
    col = np.empty(n * 4, dtype=np.float32); me.color_attributes['_lm'].data.foreach_get('color', col)
    so = np.empty(n, dtype=np.int32); me.attributes['src_o'].data.foreach_get('value', so)
    sv = np.empty(n, dtype=np.int32); me.attributes['src_v'].data.foreach_get('value', sv)
    col = col.reshape(n, 4)
    for i, o in enumerate(obs):
        m = so == i
        om = o.data; on = len(om.vertices)
        arr = np.zeros((on, 4), dtype=np.float32); arr[sv[m]] = col[m]
        ca = om.color_attributes.get('_lm') or om.color_attributes.new('_lm', 'FLOAT_COLOR', 'POINT')
        ca.data.foreach_set('color', arr.ravel())
        o.hide_render = False
    bpy.data.objects.remove(j, do_unlink=True)

# ------------------------------------------------------------------ Reflexions-Panoramen
PROBES = {   # Raum: (Aufnahmepunkt, Box-Grenzen x0,x1,y0,y1,z0,z1)
    'wohnen': ((5.0, 3.6, 1.4), (0.0, 9.2, 0.0, 10.5, 0.0, 2.85)),
    'diele': ((7.4, 8.6, 1.4), (5.52, 9.2, 6.72, 10.5, 0.0, 2.85)),
    'schlafen': ((12.7, 2.2, 1.4), (9.32, 16.0, 0.0, 5.2, 0.0, 2.85)),
    'flur': ((12.6, 5.95, 1.4), (9.32, 16.0, 5.32, 6.6, 0.0, 2.85)),
    'arbeiten': ((14.0, 8.6, 1.4), (12.0, 16.0, 6.72, 10.5, 0.0, 2.85)),
    'balkon': ((6.0, -1.3, 1.4), (-0.3, 16.3, -2.4, 0.0, 0.0, 2.85)),
}

def bake_env():
    cam_d = bpy.data.cameras.new('env'); cam_d.type = 'PANO'
    try:
        cam_d.panorama_type = 'EQUIRECTANGULAR'
    except Exception:
        cam_d.cycles.panorama_type = 'EQUIRECTANGULAR'
    cam = bpy.data.objects.new('env', cam_d); sc.collection.objects.link(cam)
    sc.camera = cam
    old = (sc.render.resolution_x, sc.render.resolution_y, sc.cycles.samples, sc.view_settings.view_transform)
    sc.render.resolution_x, sc.render.resolution_y = int(1024 * max(RES, 0.5)), int(512 * max(RES, 0.5))
    sc.cycles.samples = max(64, SPP // 2); sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0
    sc.render.image_settings.file_format = 'HDR'
    for k, (p, b) in PROBES.items():
        cam.location = p; cam.rotation_euler = (math.pi / 2, 0, -math.pi / 2)  # Blickrichtung +x… siehe three.js
        sc.render.filepath = os.path.join(OUT, f'env_{k}.hdr')
        bpy.ops.render.render(write_still=True); log('Panorama', k)
    json.dump({k: {'pos': p, 'box': b} for k, (p, b) in PROBES.items()}, open(os.path.join(OUT, 'sonden.json'), 'w'), indent=1)
    sc.render.resolution_x, sc.render.resolution_y, sc.cycles.samples, _ = old
    sc.cycles.use_denoising = False

# ------------------------------------------------------------------ Export
def export_glb():
    obs = export_objects()
    for o in obs:
        kind = 'skip'
        for g, l in GROUPS.items():
            if o in l: kind = 'lm_' + g
        if o in VX: kind = 'vx'
        o['lm'] = kind
        # aktive UV für Render auf UVMap, 'lm' als zweite
        me = o.data
        if me.uv_layers.get('lm') and me.uv_layers[0].name != 'lm':
            me.uv_layers.active = me.uv_layers[0]
    # Texturen verkleinern (Web): Boden-Eiche 2048, alles andere höchstens 1024
    for im in bpy.data.images:
        if im.source != 'FILE' or not im.size[0]: continue
        lim = 2048 if 'oak_veneer_03_diff' in im.name or 'Travertine009_2K-JPG_Color' in im.name else 1024
        w, h = im.size
        if max(w, h) > lim:
            f = lim / max(w, h); im.scale(max(1, int(w * f)), max(1, int(h * f)))
    select_only(obs)
    path = os.path.join(OUT, 'wohnung.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_extras=True,
                              export_texcoords=True, export_normals=True, export_attributes=True,
                              export_vertex_color='NONE', export_lights=False, export_cameras=False,
                              export_apply=True, export_image_format='AUTO', export_yup=True)
    log('GLB', path, os.path.getsize(path) // 1024, 'KB')

# ------------------------------------------------------------------ Begehbarkeit
MASK = {'x0': -0.6, 'x1': 16.6, 'y0': -2.6, 'y1': 10.8, 'cell': 0.04}

def make_mask():
    """Draufsicht-Raster: Zelle gesperrt, wenn irgendein Dreieck zwischen 8 cm und 1,90 m Höhe darüber liegt."""
    import numpy as np
    m = MASK; c = m['cell']
    W_ = int(round((m['x1'] - m['x0']) / c)); H_ = int(round((m['y1'] - m['y0']) / c))
    blocked = np.zeros((H_, W_), dtype=bool)
    dg = bpy.context.evaluated_depsgraph_get()
    for o in export_objects():
        ev = o.evaluated_get(dg); me = ev.to_mesh()
        n = len(me.vertices)
        if n == 0: ev.to_mesh_clear(); continue
        co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(n, 3)
        mw = np.array(o.matrix_world, dtype=np.float32)
        co = co @ mw[:3, :3].T + mw[:3, 3]
        me.calc_loop_triangles()
        nt = len(me.loop_triangles)
        tri = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get('vertices', tri); tri = tri.reshape(nt, 3)
        ev.to_mesh_clear()
        P = co[tri]                      # (nt, 3, 3)
        zmin, zmax = P[:, :, 2].min(1), P[:, :, 2].max(1)
        sel = (zmax > 0.08) & (zmin < 1.9)
        P = P[sel]
        if not len(P): continue
        x0 = np.floor((P[:, :, 0].min(1) - m['x0']) / c).astype(int); x1 = np.floor((P[:, :, 0].max(1) - m['x0']) / c).astype(int)
        y0 = np.floor((m['y1'] - P[:, :, 1].max(1)) / c).astype(int); y1 = np.floor((m['y1'] - P[:, :, 1].min(1)) / c).astype(int)
        x0 = np.clip(x0, 0, W_ - 1); x1 = np.clip(x1, 0, W_ - 1); y0 = np.clip(y0, 0, H_ - 1); y1 = np.clip(y1, 0, H_ - 1)
        for a, b, cc, d in zip(x0, x1, y0, y1):
            blocked[cc:d + 1, a:b + 1] = True
    # nur Innenräume + Balkon begehbar
    ys = m['y1'] - (np.arange(H_) + 0.5) * c; xs = m['x0'] + (np.arange(W_) + 0.5) * c
    X, Y = np.meshgrid(xs, ys)
    inside = ((X > 0) & (X < 16) & (Y > 0) & (Y < 10.5)) | ((X > -0.25) & (X < 16.25) & (Y > -2.33) & (Y < 0.0))
    walk = inside & ~blocked
    img = bpy.data.images.new('begehbar', W_, H_, alpha=False)
    px = np.zeros((H_, W_, 4), np.float32); px[..., 3] = 1
    px[walk, :3] = 1
    img.pixels.foreach_set(px[::-1].ravel())   # Blender-Bilder beginnen unten
    img.filepath_raw = os.path.join(OUT, 'begehbar.png'); img.file_format = 'PNG'; img.save()
    json.dump(dict(m, w=W_, h=H_), open(os.path.join(OUT, 'maske.json'), 'w'))
    log('Maske', W_, 'x', H_, 'begehbar', int(walk.sum()), 'Zellen')

# ------------------------------------------------------------------ Metall für die Lichtberechnung abschalten
_metal_backup = []
def metals_off():
    """Cycles liefert für Metall kein diffuses Licht. Für die Bestrahlungsstärke ist die Oberfläche egal,
    also werden alle Materialien während des Backens nichtmetallisch gemacht und danach wiederhergestellt."""
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        for n in m.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                inp = n.inputs['Metallic']
                links = [(l.from_socket, l.to_socket) for l in inp.links]
                _metal_backup.append((m, n, inp.default_value, links))
                for l in list(inp.links): m.node_tree.links.remove(l)
                inp.default_value = 0.0
def metals_on():
    for m, n, val, links in _metal_backup:
        n.inputs['Metallic'].default_value = val
        for a, b in links: m.node_tree.links.new(a, b)
    _metal_backup.clear()

t0 = time.time()
if 'mask' in STEPS: make_mask()
if 'normalen' in STEPS:
    # Netze mit nach innen zeigenden Flächen (Kaufmodelle) nach außen drehen
    import bmesh
    for n in os.environ.get('NORMALEN', 'sofa').split(','):
        o = bpy.data.objects.get(n)
        if not o: continue
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(o.data); bm.free(); log('Normalen neu', n)
if 'uv' in STEPS: make_lm_uvs()
if 'lm' in STEPS or 'vx' in STEPS: metals_off()
if 'lm' in STEPS: bake_lm()
if 'vx' in STEPS: bake_vx()
metals_on()
if 'env' in STEPS: bake_env()
if 'save' in STEPS or 'uv' in STEPS:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'wohnung_gebacken.blend'))
if 'glb' in STEPS: export_glb()
log('gesamt', round(time.time() - t0), 's')
