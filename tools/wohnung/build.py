# Baut die Musterwohnung als Blender-Szene.
# Aufruf: Blender -b --factory-startup -P tools/wohnung/build.py -- <ausgabe.blend>
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, mats, geo, arch, sky
for m in (mats, geo, arch, sky): importlib.reload(m)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else os.path.join(os.path.dirname(__file__), 'arbeit', 'wohnung.blend'))
os.makedirs(os.path.dirname(OUT), exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'
M = mats.library()
arch.build(M)
try:
    import moebel; importlib.reload(moebel); moebel.build(M)
except ModuleNotFoundError as e:
    print('ohne Möbel:', e)
sky.setup(sc, os.path.dirname(OUT))

# Kameras für Vorschaubilder (Augenhöhe 1,62 m)
CAMS = {
    'diele_blick': ((7.4, 9.9, 1.62), (7.0, 3.0, 1.35), 62),
    'wohnen_elbe': ((8.6, 5.9, 1.62), (3.0, 0.0, 1.2), 64),
    'essen_kueche': ((7.8, 1.2, 1.62), (1.0, 8.5, 1.1), 64),
    'balkon': ((5.0, 1.5, 1.62), (4.0, -10.0, 0.6), 66),
    'schlafen': ((10.2, 0.8, 1.62), (13.6, 4.8, 0.9), 66),
    'arbeiten': ((12.4, 7.2, 1.62), (15.8, 9.8, 1.0), 72),
}
for name, (loc, tgt, fov) in CAMS.items():
    cd = bpy.data.cameras.new(name); cd.lens_unit = 'FOV'; cd.angle = math.radians(fov); cd.sensor_fit = 'HORIZONTAL'
    cd.clip_start = 0.05; cd.clip_end = 3000
    co = bpy.data.objects.new(name, cd); sc.collection.objects.link(co)
    co.location = loc
    from mathutils import Vector
    co.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
sc.camera = bpy.data.objects['diele_blick']

# Render-Grundeinstellungen (Cycles, CPU)
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 128
sc.cycles.use_denoising = True
sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.max_bounces = 8; sc.cycles.diffuse_bounces = 5; sc.cycles.glossy_bounces = 3
sc.cycles.transmission_bounces = 4; sc.cycles.transparent_max_bounces = 8
sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
sc.cycles.sample_clamp_indirect = 8.0
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Base Contrast'
sc.view_settings.exposure = 0.0
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('GESPEICHERT', OUT)
