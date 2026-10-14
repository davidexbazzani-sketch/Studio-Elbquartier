# Himmel: Poly-Haven-HDRI (kloofendal_48d_partly_cloudy_puresky, CC0).
# Die Sonne wird aus dem HDRI herausgerechnet und als exakte Sonnenlampe ersetzt
# (gleiche Richtung, gleiche Bestrahlungsstärke) – scharfe Schatten, wenig Rauschen.
import bpy, math, os, json
import numpy as np
from mathutils import Vector, Matrix

HDR = os.path.join(os.path.dirname(__file__), '..', 'hdri', 'kloofendal_48d_partly_cloudy_puresky_2k.hdr')
# Gewünschte Sonnenrichtung in der Szene: Azimut von Süd über West (Grad), Höhe aus dem HDRI
SUN_AZ_FROM_SOUTH_TO_WEST = 32.0
# Das HDRI ist leicht dunstig (Sonne:Himmel ≈ 1,8:1); für einen klaren Sonnentag wird die Sonne verstärkt.
SUN_BOOST = 2.0

def dir_from_uv(u, v):
    phi = (u - 0.5) * 2 * math.pi; th = (v - 0.5) * math.pi
    return Vector((-math.cos(phi) * math.cos(th), math.sin(phi) * math.cos(th), math.sin(th)))

def setup(scene, out_dir):
    img = bpy.data.images.load(os.path.abspath(HDR), check_existing=True)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    lum = 0.2126 * px[..., 0] + 0.7152 * px[..., 1] + 0.0722 * px[..., 2]
    iy, ix = np.unravel_index(np.argmax(lum), lum.shape)
    u, v = (ix + 0.5) / w, (iy + 0.5) / h
    s_img = dir_from_uv(u, v)
    # Sonnenpixel: alles im Umkreis von 3°, das deutlich heller als der Himmel ringsum ist
    ys, xs = np.mgrid[0:h, 0:w]
    uu, vv = (xs + 0.5) / w, (ys + 0.5) / h
    phi = (uu - 0.5) * 2 * np.pi; th = (vv - 0.5) * np.pi
    dx, dy, dz = -np.cos(phi) * np.cos(th), np.sin(phi) * np.cos(th), np.sin(th)
    cosang = dx * s_img.x + dy * s_img.y + dz * s_img.z
    ring = (cosang > math.cos(math.radians(6))) & (cosang < math.cos(math.radians(3.5)))
    sky_ring = np.median(px[ring][:, :3], axis=0)
    core = (cosang > math.cos(math.radians(3.5))) & (lum > 4 * (0.2126 * sky_ring[0] + 0.7152 * sky_ring[1] + 0.0722 * sky_ring[2]))
    # Raumwinkel je Pixel (equirect)
    dOmega = (2 * np.pi / w) * (np.pi / h) * np.cos(th)
    excess = np.clip(px[..., :3] - sky_ring[None, None, :], 0, None)
    E = (excess[core] * dOmega[core][:, None]).sum(axis=0)   # Bestrahlungsstärke senkrecht zur Sonne (RGB)
    px[core, :3] = sky_ring
    clean = bpy.data.images.new('himmel_ohne_sonne', w, h, alpha=False, float_buffer=True)
    clean.pixels.foreach_set(px.ravel())
    path = os.path.join(out_dir, 'himmel_ohne_sonne.exr')
    clean.filepath_raw = path; clean.file_format = 'OPEN_EXR'; clean.save()
    # Drehung: Sonne soll aus SSW kommen
    az_img = math.atan2(s_img.y, s_img.x)
    a = math.radians(SUN_AZ_FROM_SOUTH_TO_WEST)
    target = Vector((-math.sin(a), -math.cos(a), 0))        # Süd = -y, West = -x
    az_t = math.atan2(target.y, target.x)
    rot = az_t - az_img      # Weltrichtung d = Rz(rot) * Bildrichtung
    sun_dir = Matrix.Rotation(rot, 3, 'Z') @ s_img
    # Welt
    wd = bpy.data.worlds.get('Himmel') or bpy.data.worlds.new('Himmel')
    scene.world = wd; wd.use_nodes = True; nt = wd.node_tree; nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Rotation'].default_value = (0, 0, -rot)   # Lookup = Rz(-rot) * d
    env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = clean
    bg = nt.nodes.new('ShaderNodeBackground'); out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
    nt.links.new(env.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    wd.cycles.sampling_method = 'MANUAL'; wd.cycles.sample_map_resolution = 2048
    # Sonne
    Esum = float(E.sum()); col = E / max(E.max(), 1e-9)
    sd = bpy.data.lights.get('Sonne') or bpy.data.lights.new('Sonne', 'SUN')
    sd.energy = float(E.max()) * SUN_BOOST
    sd.color = tuple(float(c) for c in col)
    sd.angle = math.radians(0.53)
    so = bpy.data.objects.get('Sonne') or bpy.data.objects.new('Sonne', sd)
    if so.name not in scene.collection.objects: scene.collection.objects.link(so)
    so.rotation_euler = (-sun_dir).to_track_quat('-Z', 'Y').to_euler()
    info = {'sun_dir': list(sun_dir), 'sun_rgb_irradiance': [float(c) for c in E], 'rotation_z': rot,
            'elevation_deg': math.degrees(math.asin(max(-1, min(1, sun_dir.z)))), 'sky_ring': [float(c) for c in sky_ring]}
    json.dump(info, open(os.path.join(out_dir, 'sonne.json'), 'w'), indent=1)
    print('SONNE', info)
    return info
