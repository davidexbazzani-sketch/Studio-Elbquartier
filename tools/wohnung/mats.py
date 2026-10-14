# Materialbibliothek für die Musterwohnung (Blender, Principled BSDF).
# Texturen: Poly Haven / ambientCG (CC0), liegen in tools/wohnung/quelle/tex/.
# Jede Texturgröße steht in Metern (UV0 der eigenen Geometrie ist 1 Einheit = 1 m).
import bpy, os

TEX = os.path.join(os.path.dirname(__file__), 'quelle', 'tex')

def _img(path, color=True):
    name = os.path.basename(path)
    im = bpy.data.images.get(name) or bpy.data.images.load(path, check_existing=True)
    im.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    return im

def _ph(asset, kind):
    return os.path.join(TEX, asset, f'{asset}_{kind}_2k.jpg')

def _acg(asset, kind):
    return os.path.join(TEX, 'acg-' + asset, f'{asset}_2K-JPG_{kind}.jpg')

def new(name, color=(0.8, 0.8, 0.8), rough=0.5, metal=0.0, **kw):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m

def textured(name, size, diff=None, nor=None, rough=None, tint=None, rough_val=None, rough_mul=1.0,
             nor_strength=1.0, metal=0.0, flat_color=None, spec=0.5):
    """size = Kantenlänge der Textur in Metern. tint multipliziert die Farbtextur,
    flat_color ersetzt sie (Struktur kommt dann nur aus Normal/Rauheit)."""
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']
    b.inputs['Metallic'].default_value = metal
    b.inputs['Specular IOR Level'].default_value = spec
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping')
    sx, sy = (size, size) if not isinstance(size, tuple) else size
    mp.inputs['Scale'].default_value = (1 / sx, 1 / sy, 1)
    L.new(tc.outputs['UV'], mp.inputs['Vector'])
    def tex(path, color):
        t = N.new('ShaderNodeTexImage'); t.image = _img(path, color)
        L.new(mp.outputs['Vector'], t.inputs['Vector']); return t
    if flat_color is not None:
        b.inputs['Base Color'].default_value = (*flat_color, 1)
    elif diff:
        t = tex(diff, True)
        if tint:
            mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1.0
            L.new(t.outputs['Color'], mix.inputs['A']); mix.inputs['B'].default_value = (*tint, 1)
            L.new(mix.outputs['Result'], b.inputs['Base Color'])
        else:
            L.new(t.outputs['Color'], b.inputs['Base Color'])
    if rough and rough_val is None:
        t = tex(rough, False)
        if rough_mul != 1.0:
            mt = N.new('ShaderNodeMath'); mt.operation = 'MULTIPLY'; mt.inputs[1].default_value = rough_mul
            L.new(t.outputs['Color'], mt.inputs[0]); L.new(mt.outputs[0], b.inputs['Roughness'])
        else:
            L.new(t.outputs['Color'], b.inputs['Roughness'])
    else:
        b.inputs['Roughness'].default_value = rough_val if rough_val is not None else 0.5
    if nor:
        t = tex(nor, False); nm = N.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = nor_strength
        L.new(t.outputs['Color'], nm.inputs['Color']); L.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m

def thin_glass(name):
    """Dünnes Architekturglas: Schattenstrahlen gehen ungebrochen durch (Sonne fällt ins Zimmer),
    Spiegelung nach Fresnel. In three.js wird Glas separat behandelt (Materialname 'glas')."""
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial')
    tr = N.new('ShaderNodeBsdfTransparent'); tr.inputs['Color'].default_value = (0.92, 0.95, 0.94, 1)
    gl = N.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = 0.0
    fr = N.new('ShaderNodeFresnel'); fr.inputs['IOR'].default_value = 1.52
    # Rückseiten (Strahl im Glas) ohne Totalreflexion, Schattenstrahlen immer durchlassen
    geo = N.new('ShaderNodeNewGeometry'); lp = N.new('ShaderNodeLightPath')
    inv = N.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
    L.new(geo.outputs['Backfacing'], inv.inputs[1])
    inv2 = N.new('ShaderNodeMath'); inv2.operation = 'SUBTRACT'; inv2.inputs[0].default_value = 1.0
    L.new(lp.outputs['Is Shadow Ray'], inv2.inputs[1])
    m1 = N.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; L.new(fr.outputs[0], m1.inputs[0]); L.new(inv.outputs[0], m1.inputs[1])
    m2 = N.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; L.new(m1.outputs[0], m2.inputs[0]); L.new(inv2.outputs[0], m2.inputs[1])
    mx = N.new('ShaderNodeMixShader')
    L.new(m2.outputs[0], mx.inputs[0]); L.new(tr.outputs[0], mx.inputs[1]); L.new(gl.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs['Surface'])
    m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    return m

def library():
    M = {}
    # Böden
    M['eiche_boden'] = textured('eiche_boden', 1.0, _ph('oak_veneer_03', 'diff'), _ph('oak_veneer_03', 'nor_gl'),
                                _ph('oak_veneer_03', 'rough'), tint=(0.98, 0.93, 0.86), rough_mul=0.85, nor_strength=0.6)
    M['fuge'] = new('fuge', (0.12, 0.09, 0.07), 0.8)
    M['travertin_hell'] = textured('travertin_hell', 1.2, _acg('Travertine009', 'Color'), _acg('Travertine009', 'NormalGL'),
                                   _acg('Travertine009', 'Roughness'), tint=(1.0, 0.97, 0.93), rough_mul=0.75, nor_strength=0.5)
    M['travertin_bad'] = textured('travertin_bad', 1.2, _acg('Travertine004', 'Color'), _acg('Travertine004', 'NormalGL'),
                                  _acg('Travertine004', 'Roughness'), tint=(1.05, 1.0, 0.95), nor_strength=0.5)
    M['balkon_stein'] = textured('balkon_stein', 1.2, _acg('Travertine009', 'Color'), _acg('Travertine009', 'NormalGL'),
                                 _acg('Travertine009', 'Roughness'), tint=(0.93, 0.9, 0.86), rough_val=0.62, nor_strength=0.9)
    # Wände / Decke
    M['wand'] = textured('wand', 2.0, None, _ph('white_stucco', 'nor_gl'), None, flat_color=(0.80, 0.775, 0.735),
                         rough_val=0.88, nor_strength=0.25)
    M['wand_kalk'] = textured('wand_kalk', 2.4, _acg('Plaster001', 'Color'), _acg('Plaster001', 'NormalGL'), None,
                              tint=(0.86, 0.80, 0.72), rough_val=0.9, nor_strength=0.35)
    M['decke'] = new('decke', (0.83, 0.82, 0.80), 0.92)
    M['sockel'] = new('sockel', (0.80, 0.78, 0.75), 0.55)
    M['schattenfuge'] = new('schattenfuge', (0.05, 0.05, 0.05), 0.9)
    M['fassade'] = textured('fassade', 2.0, None, _ph('white_stucco', 'nor_gl'), None, flat_color=(0.78, 0.76, 0.72),
                            rough_val=0.85, nor_strength=0.5)
    # Metall / Glas
    M['bronze'] = new('bronze', (0.16, 0.13, 0.10), 0.38, 1.0)
    M['messing'] = new('messing', (0.80, 0.62, 0.38), 0.28, 1.0)
    M['edelstahl'] = new('edelstahl', (0.72, 0.72, 0.72), 0.22, 1.0)
    M['schwarz_matt'] = new('schwarz_matt', (0.03, 0.03, 0.03), 0.55)
    M['glas'] = thin_glass('glas')
    M['ceran'] = new('ceran', (0.01, 0.01, 0.012), 0.08)
    # Holz / Lack
    M['eiche_moebel'] = textured('eiche_moebel', 1.0, _ph('oak_veneer_03', 'diff'), _ph('oak_veneer_03', 'nor_gl'),
                                 _ph('oak_veneer_03', 'rough'), tint=(0.92, 0.84, 0.74), rough_mul=0.8, nor_strength=0.5)
    M['eiche_dunkel'] = textured('eiche_dunkel', 1.0, _ph('white_oak_veneer', 'diff'), _ph('white_oak_veneer', 'nor_gl'),
                                 _ph('white_oak_veneer', 'rough'), tint=(0.85, 0.78, 0.70), rough_mul=0.75, nor_strength=0.5)
    M['nussbaum'] = textured('nussbaum', 1.0, _ph('smoked_walnut_veneer', 'diff'), _ph('smoked_walnut_veneer', 'nor_gl'),
                             _ph('smoked_walnut_veneer', 'rough'), tint=(0.62, 0.52, 0.44), rough_mul=0.7, nor_strength=0.5)
    M['lack_greige'] = new('lack_greige', (0.62, 0.58, 0.52), 0.42)
    M['lack_weiss'] = new('lack_weiss', (0.80, 0.78, 0.75), 0.45)
    # Stoffe
    M['boucle'] = textured('boucle', 0.33, _ph('curly_teddy_natural', 'diff'), _ph('curly_teddy_natural', 'nor_gl'),
                           _ph('curly_teddy_natural', 'rough'), tint=(0.86, 0.84, 0.80), nor_strength=1.0, spec=0.3)
    M['leinen'] = textured('leinen', 0.27, None, _ph('rough_linen', 'nor_gl'), _ph('rough_linen', 'rough'),
                           flat_color=(0.62, 0.56, 0.48), nor_strength=0.8, spec=0.3)
    M['leinen_hell'] = textured('leinen_hell', 0.27, None, _ph('rough_linen', 'nor_gl'), _ph('rough_linen', 'rough'),
                                flat_color=(0.78, 0.75, 0.70), nor_strength=0.8, spec=0.3)
    M['bettwaesche'] = textured('bettwaesche', 0.28, None, _ph('waffle_pique_cotton', 'nor_gl'), None,
                                flat_color=(0.82, 0.80, 0.76), rough_val=0.85, nor_strength=0.35, spec=0.3)
    M['samt_salbei'] = textured('samt_salbei', 0.28, None, _ph('velour_velvet', 'nor_gl'), _ph('velour_velvet', 'rough'),
                                flat_color=(0.36, 0.38, 0.31), nor_strength=0.6, spec=0.3)
    M['leder_cognac'] = textured('leder_cognac', 0.3, None, _ph('leather_white', 'nor_gl'), _ph('leather_white', 'rough'),
                                 flat_color=(0.34, 0.18, 0.09), nor_strength=0.6)
    M['teppich'] = textured('teppich', 0.9, _acg('Carpet016', 'Color'), _acg('Carpet016', 'NormalGL'), _acg('Carpet016', 'Roughness'),
                            tint=(1.12, 1.08, 1.02), nor_strength=1.0, spec=0.2)
    M['teppich_hell'] = textured('teppich_hell', 0.9, _acg('Carpet014', 'Color'), _acg('Carpet014', 'NormalGL'), _acg('Carpet014', 'Roughness'),
                                 tint=(1.12, 1.08, 1.0), nor_strength=1.0, spec=0.2)
    M['vorhang'] = new('vorhang', (0.86, 0.84, 0.80), 0.9, 0.0, **{'Transmission Weight': 0.0})
    M['keramik'] = new('keramik', (0.80, 0.78, 0.74), 0.35)
    M['kunst'] = new('kunst', (0.7, 0.66, 0.6), 0.9)
    return M
