# Vorschaubilder aus der Blender-Szene (Cycles).
# Aufruf: Blender -b <wohnung.blend> -P render.py -- <ausgabeordner> [kamera,...] [samples] [breite] [belichtung]
import bpy, sys, os
argv = sys.argv[sys.argv.index('--') + 1:]
out = argv[0]; os.makedirs(out, exist_ok=True)
cams = argv[1].split(',') if len(argv) > 1 and argv[1] != 'alle' else [o.name for o in bpy.data.objects if o.type == 'CAMERA']
sc = bpy.context.scene
if len(argv) > 2: sc.cycles.samples = int(argv[2])
if len(argv) > 3:
    sc.render.resolution_x = int(argv[3]); sc.render.resolution_y = int(int(argv[3]) * 9 / 16)
if len(argv) > 4: sc.view_settings.exposure = float(argv[4])
sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 90
sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.02
for c in cams:
    sc.camera = bpy.data.objects[c]
    sc.render.filepath = os.path.join(out, c + '.jpg')
    bpy.ops.render.render(write_still=True)
    print('BILD', sc.render.filepath)
