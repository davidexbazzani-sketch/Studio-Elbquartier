# Bereitet Himmel und Metadaten für den Web-Rundgang vor.
# Aufruf: Blender -b -P web_prep.py -- <bake-ordner> <ziel assets/wohnung>
import bpy, sys, os, json, math
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = os.path.abspath(argv[0]), os.path.abspath(argv[1])
os.makedirs(DST, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
SKY_SCALE = 4.0   # Himmel wird als sRGB-Bild von 0..4 gespeichert (im Shader × 4)

def save_webp(arr, path, q=90):
    h, w = arr.shape[:2]
    im = bpy.data.images.new(os.path.basename(path), w, h, alpha=False, float_buffer=False)
    im.colorspace_settings.name = 'Non-Color'
    rgba = np.concatenate([arr, np.ones((h, w, 1), np.float32)], -1)
    im.pixels.foreach_set(rgba.astype(np.float32).ravel())
    im.filepath_raw = path; im.file_format = 'WEBP'; im.save(quality=q)
    bpy.data.images.remove(im)

def srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)

if '--himmel' in argv or not os.path.exists(os.path.join(DST, 'himmel_8k.webp')):
    img = bpy.data.images.load(os.path.join(HERE, '..', 'hdri', 'kloofendal_48d_partly_cloudy_puresky_8k.hdr'))
    w, h = img.size
    px = np.array(img.pixels[:], np.float32).reshape(h, w, 4)[..., :3]
    lo = srgb(px / SKY_SCALE).astype(np.float32)
    save_webp(lo, os.path.join(DST, 'himmel_8k.webp'), 88)
    lo4 = lo.reshape(h // 2, 2, w // 2, 2, 3).mean(axis=(1, 3))
    save_webp(lo4, os.path.join(DST, 'himmel_4k.webp'), 88)
    print('HIMMEL gespeichert')

sonne = json.load(open(os.path.join(SRC, '..', 'sonne.json'))) if os.path.exists(os.path.join(SRC, '..', 'sonne.json')) \
    else json.load(open(os.path.join(HERE, 'arbeit', 'sonne.json')))
sd = sonne['sun_dir']
lms = json.load(open(os.path.join(DST, 'lightmaps.json')))
sonden = json.load(open(os.path.join(SRC, 'sonden.json')))
maske = json.load(open(os.path.join(SRC, 'maske.json')))
meta = {
    'glb': 'wohnung.glb', 'glb_klein': 'wohnung_klein.glb',
    'lightmaps': lms, 'sonden': sonden, 'maske': maske,
    'sonne': [sd[0], sd[2], -sd[1]],
    'himmel_drehung': sonne['rotation_z'], 'himmel_helligkeit': SKY_SCALE,
    'raeume': {
        'Wohnen': [0.0, 9.2, 0.0, 6.6], 'Küche': [0.0, 5.4, 6.6, 10.5], 'Diele': [5.52, 9.2, 6.72, 10.5],
        'Flur': [9.32, 16.0, 5.32, 6.6], 'Schlafen': [9.32, 16.0, 0.0, 5.2], 'Arbeiten': [12.0, 16.0, 6.72, 10.5],
        'Balkon': [-0.3, 16.3, -2.4, 0.0],
    },
    'ziele': {
        'Diele': [7.4, 9.7, 180], 'Wohnen': [7.2, 5.6, 170], 'Küche': [3.0, 6.4, 0], 'Balkon': [5.6, -1.2, 180],
        'Schlafen': [10.6, 0.9, 315], 'Arbeiten': [13.3, 7.4, 300],
    },
    'start': {'pos': [7.4, 9.75], 'yaw': 180},
    'belichtung': 1.0, 'belichtung_ziel': 0.18,
}
json.dump(meta, open(os.path.join(DST, 'wohnung.json'), 'w'), indent=1, ensure_ascii=False)
print('META gespeichert')
