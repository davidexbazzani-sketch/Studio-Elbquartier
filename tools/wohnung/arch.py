# Architektur der Musterwohnung „Elbblick“ (Blender-Koordinaten: x = Ost, y = Nord, z = oben, Meter).
# Südfassade (Elbe) bei y = 0, Balkon davor (y < 0). Raumhöhe 2,85 m.
import bpy, bmesh, math
from geo import box, wall, plank_floor, mesh_obj, bm_box, collection, rounded_slab
from mathutils import Vector

H = 2.85            # lichte Raumhöhe
EXT = 0.30          # Außenwand
INT = 0.12          # Innenwand
W, D = 16.0, 10.5   # Innenmaß gesamt

# Räume (für Kollision, Boden, Licht-Sonden). x0, x1, y0, y1
ROOMS = {
    'wohnen':  (0.0, 9.2, 0.0, 6.6),
    'kueche':  (0.0, 5.4, 6.6, D),
    'diele':   (5.52, 9.2, 6.72, D),
    'flur':    (9.32, W, 5.32, 6.6),
    'schlafen': (9.32, W, 0.0, 5.2),
    'arbeiten': (12.0, W, 6.72, D),
    'bad':     (9.32, 11.88, 6.72, D),
}

# Fensteröffnungen (Lauflänge a0..a1, Brüstung, Sturz) je Außenwand
WIN_S = [(0.35, 8.85, 0.0, H), (9.65, 15.65, 0.0, H)]
WIN_W = [(1.0, 5.6, 0.0, H), (7.0, 9.4, 0.0, H)]
WIN_E = [(0.8, 4.4, 0.0, H), (7.3, 9.7, 0.0, H)]
DOOR_FRONT = (6.85, 7.95, 0.0, 2.35)

# Innentüren: (Wandname, a0, a1) – 2,35 m hoch, raumhohe Optik mit verdeckter Zarge
DOORS = {
    'flur_wohnen': ('x', 9.2, 9.32, 5.45, 6.45),   # Wand x=9.2..9.32, Öffnung in y
    'schlafen':    ('y', 5.2, 5.32, 10.15, 11.05),
    'bad':         ('y', 6.6, 6.72, 10.4, 11.3),
    'arbeiten':    ('y', 6.6, 6.72, 12.7, 13.6),
}
DOOR_H = 2.35

def build(M):
    out = {}
    z0, z1 = 0.0, H
    # --- Außenwände (Fassade innen weiß verputzt, außen Fassadenputz) ---
    out['aw_sued'] = wall('aw_sued', 'x', -EXT, W + EXT, -EXT, 0.0, z0 - 0.3, z1 + 0.35, [(a, b, zb, zt) for a, b, zb, zt in WIN_S], M['wand'])
    out['aw_west'] = wall('aw_west', 'y', 0.0, D, -EXT, 0.0, z0 - 0.3, z1 + 0.35, WIN_W, M['wand'])
    out['aw_ost'] = wall('aw_ost', 'y', 0.0, D, W, W + EXT, z0 - 0.3, z1 + 0.35, WIN_E, M['wand'])
    out['aw_nord'] = wall('aw_nord', 'x', -EXT, W + EXT, D, D + EXT, z0 - 0.3, z1 + 0.35, [DOOR_FRONT], M['wand'])
    # --- Innenwände ---
    dz = DOOR_H
    out['iw_wohnen_ost'] = wall('iw_wohnen_ost', 'y', 0.0, D, 9.2, 9.32, z0, z1, [(5.45, 6.45, 0, dz)], M['wand'])
    out['iw_schlafen_nord'] = wall('iw_schlafen_nord', 'x', 9.32, W, 5.2, 5.32, z0, z1, [(10.15, 11.05, 0, dz)], M['wand'])
    out['iw_flur_nord'] = wall('iw_flur_nord', 'x', 9.32, W, 6.6, 6.72, z0, z1, [(10.4, 11.3, 0, dz), (12.7, 13.6, 0, dz)], M['wand'])
    out['iw_bad_ost'] = wall('iw_bad_ost', 'y', 6.72, D, 11.88, 12.0, z0, z1, [], M['wand'])
    out['iw_kueche_ost'] = wall('iw_kueche_ost', 'y', 6.6, D, 5.4, 5.52, z0, z1, [], M['wand'])
    out['iw_diele_sued'] = wall('iw_diele_sued', 'x', 5.52, 9.2, 6.6, 6.72, z0, z1, [(6.15, 8.55, 0, 2.55)], M['wand'])

    # --- Böden ---
    out['boden'] = plank_floor('boden', 0.0, W, 0.0, D, M['eiche_boden'], M['fuge'], along='y')
    # Bad: Travertin (Bodenplatte knapp über der Diele, eigenes Objekt)
    out['bad_boden'] = box('bad_boden', 9.32, 11.88, 6.72, D, 0.0, 0.003, M['travertin_bad'], coll='Boden')

    # --- Decke (mit umlaufender Schattenfuge und Einbauleuchten) ---
    out['decke'] = box('decke', -EXT, W + EXT, -EXT, D + EXT, H, H + 0.25, M['decke'], skip=('+z',))
    # Vorhangschiene als Deckenschlitz entlang Süd- und Westfenster
    for nm, (x0, x1, y0, y1) in {'schlitz_s1': (0.3, 8.9, 0.13, 0.17), 'schlitz_s2': (9.6, 15.7, 0.13, 0.17),
                                  'schlitz_w': (0.13, 0.17, 0.9, 9.5), 'schlitz_o': (15.83, 15.87, 0.7, 4.5)}.items():
        box(nm, x0, x1, y0, y1, H - 0.002, H, M['schattenfuge'], coll='Details')
    # Einbau-Downlights (aus): kleine Messingringe mit dunklem Reflektor
    spots = [(x, y) for x in (4.6, 6.4, 8.2) for y in (1.6, 4.6)] + [(1.0, 1.8), (1.0, 5.2), (1.6, 7.6), (3.4, 7.6),
             (1.6, 9.6), (3.4, 9.6), (6.5, 8.2), (8.2, 8.2), (6.5, 9.7), (8.2, 9.7),
             (10.5, 5.95), (12.5, 5.95), (14.5, 5.95), (10.4, 1.0), (14.9, 1.0), (10.4, 4.6), (14.9, 4.6),
             (13.2, 8.0), (15.0, 9.6), (10.6, 8.0), (10.6, 9.8)]
    bm = bmesh.new()
    for (x, y) in spots:
        bmesh.ops.create_circle(bm, cap_ends=True, segments=32, radius=0.045,
                                matrix=__import__('mathutils').Matrix.Translation((x, y, H - 0.0008)))
    for f in bm.faces: f.normal_flip()
    bm.normal_update()
    mesh_obj('downlights', bm, M['schattenfuge'], 'Details')
    bm = bmesh.new()
    for (x, y) in spots:
        r = bmesh.ops.create_circle(bm, cap_ends=False, segments=32, radius=0.052,
                                    matrix=__import__('mathutils').Matrix.Translation((x, y, H - 0.001)))
        inner = bmesh.ops.create_circle(bm, cap_ends=False, segments=32, radius=0.045,
                                        matrix=__import__('mathutils').Matrix.Translation((x, y, H - 0.001)))
        bm.verts.ensure_lookup_table()
        a, b = r['verts'], inner['verts']
        for i in range(32):
            bm.faces.new([a[i], a[(i + 1) % 32], b[(i + 1) % 32], b[i]])
    for f in bm.faces:
        if f.normal.z > 0: f.normal_flip()
    bm.normal_update()
    mesh_obj('downlight_ringe', bm, M['messing'], 'Details')

    # --- Sockelleisten (6 cm, weiß lackiert) entlang aller Innenwände der Räume ---
    sk = bmesh.new()
    def skirting_room(x0, x1, y0, y1, gaps=()):
        t, h = 0.012, 0.06
        segs = [('s', x0, x1, y0), ('n', x0, x1, y1), ('w', y0, y1, x0), ('e', y0, y1, x1)]
        for side, a0, a1, c in segs:
            pieces = [(a0, a1)]
            for (gs, g0, g1) in gaps:
                if gs != side: continue
                new = []
                for (p0, p1) in pieces:
                    if g1 <= p0 or g0 >= p1: new.append((p0, p1)); continue
                    if g0 > p0: new.append((p0, g0))
                    if g1 < p1: new.append((g1, p1))
                pieces = new
            for (p0, p1) in pieces:
                if p1 - p0 < 0.02: continue
                if side == 's': bm_box(sk, p0, p1, c, c + t, 0, h)
                if side == 'n': bm_box(sk, p0, p1, c - t, c, 0, h)
                if side == 'w': bm_box(sk, c, c + t, p0, p1, 0, h)
                if side == 'e': bm_box(sk, c - t, c, p0, p1, 0, h)
    # Glasflächen und Türöffnungen aussparen
    skirting_room(0.0, 9.2, 0.0, 6.6, gaps=[('s', 0.35, 8.85), ('w', 1.0, 5.6), ('n', 5.4, 9.2), ('e', 5.45, 6.45)])
    skirting_room(0.0, 5.4, 6.6, D, gaps=[('s', 0.0, 5.4), ('w', 7.0, 9.4), ('n', 0.0, 4.8), ('e', 7.5, D)])
    skirting_room(5.52, 9.2, 6.72, D, gaps=[('s', 6.15, 8.55), ('n', 6.85, 7.95)])
    skirting_room(9.32, W, 5.32, 6.6, gaps=[('w', 5.45, 6.45), ('s', 10.15, 11.05), ('n', 10.4, 11.3), ('n', 12.7, 13.6)])
    skirting_room(9.32, W, 0.0, 5.2, gaps=[('s', 9.65, 15.65), ('e', 0.8, 4.4), ('n', 10.15, 11.05)])
    skirting_room(12.0, W, 6.72, D, gaps=[('e', 7.3, 9.7), ('s', 12.7, 13.6)])
    sk.normal_update()
    out['sockel'] = mesh_obj('sockel', sk, M['sockel'], 'Details')

    # --- Fenster: raumhohe Verglasung mit schlanken Bronzeprofilen ---
    fr = bmesh.new(); gl = bmesh.new()
    def glazing(axis, c, a0, a1, n_panels, sliding=(), offen=None):
        """offen = (Flügel, Richtung): dieser Schiebeflügel ist zur Seite geschoben (Durchgang frei)."""
        """axis 'x': Fassade parallel zu x bei y=c; 'y': parallel zu y bei x=c."""
        pw = 0.05; depth = 0.07; zt = H
        def B(bmx, a, b, z0_, z1_, d0, d1):
            if axis == 'x': bm_box(bmx, a, b, c + d0, c + d1, z0_, z1_)
            else: bm_box(bmx, c + d0, c + d1, a, b, z0_, z1_)
        # Rahmen außen
        B(fr, a0, a1, 0.0, 0.035, -depth, 0.0)
        B(fr, a0, a1, zt - 0.06, zt, -depth, 0.0)
        B(fr, a0, a0 + pw, 0.0, zt, -depth, 0.0)
        B(fr, a1 - pw, a1, 0.0, zt, -depth, 0.0)
        step = (a1 - a0) / n_panels
        for i in range(1, n_panels):
            m = a0 + i * step
            B(fr, m - pw / 2, m + pw / 2, 0.0, zt, -depth - 0.01, 0.01)
        for i in range(n_panels):
            pa, pb = a0 + i * step + pw / 2, a0 + (i + 1) * step - pw / 2
            off = -0.045 if i in sliding else -0.03
            if offen and offen[0] == i:
                sh = offen[1] * (step - 0.09)
                pa, pb = pa + sh, pb + sh; off = 0.012
                # unterer Rahmen im Durchgang als flache Bodenschiene
                B(fr, a0 + i * step + pw / 2, a0 + (i + 1) * step - pw / 2, 0.0, 0.006, -depth, 0.0)
            B(gl, pa, pb, 0.035, zt - 0.06, off - 0.004, off + 0.004)
            if i in sliding:
                # Schiebeflügel: eigener umlaufender Rahmen + flacher Griff
                B(fr, pa, pb, 0.035, 0.075, off - 0.02, off + 0.02)
                B(fr, pa, pb, zt - 0.1, zt - 0.06, off - 0.02, off + 0.02)
                B(fr, pa, pa + 0.04, 0.035, zt - 0.06, off - 0.02, off + 0.02)
                B(fr, pb - 0.04, pb, 0.035, zt - 0.06, off - 0.02, off + 0.02)
                B(fr, pb - 0.07, pb - 0.05, 0.95, 1.25, off + 0.02, off + 0.05)
    glazing('x', 0.0, 0.35, 8.85, 4, sliding=(1, 2), offen=(2, 1))
    glazing('x', 0.0, 9.65, 15.65, 3, sliding=(2,), offen=(2, -1))
    glazing('y', 0.0, 1.0, 5.6, 2)
    glazing('y', 0.0, 7.0, 9.4, 1)
    # Ostfassade: Profile nach innen gespiegelt
    def glazing_east(a0, a1, n):
        pw = 0.05
        for (bmx, d0, d1) in []: pass
        bm_box(fr, W, W + 0.07, a0, a1, 0.0, 0.035); bm_box(fr, W, W + 0.07, a0, a1, H - 0.06, H)
        bm_box(fr, W, W + 0.07, a0, a0 + pw, 0, H); bm_box(fr, W, W + 0.07, a1 - pw, a1, 0, H)
        step = (a1 - a0) / n
        for i in range(1, n):
            m = a0 + i * step; bm_box(fr, W - 0.01, W + 0.08, m - pw / 2, m + pw / 2, 0, H)
        for i in range(n):
            bm_box(gl, W + 0.026, W + 0.034, a0 + i * step + pw / 2, a0 + (i + 1) * step - pw / 2, 0.035, H - 0.06)
    glazing_east(0.8, 4.4, 2)
    glazing_east(7.3, 9.7, 1)
    fr.normal_update(); gl.normal_update()
    out['fensterrahmen'] = mesh_obj('fensterrahmen', fr, M['bronze'], 'Fenster')
    out['glas'] = mesh_obj('glas', gl, M['glas'], 'Fenster')

    # --- Wohnungstür (Eiche, geschlossen) und Innentüren (geöffnet, weiß) ---
    box('wohnungstuer', 6.88, 7.92, D + 0.02, D + 0.07, 0.0, 2.34, M['eiche_dunkel'], coll='Tueren', bevel=0.002)
    box('tuergriff_wt', 7.75, 7.77, D - 0.03, D + 0.02, 1.0, 1.0 + 0.32, M['bronze'], coll='Tueren', bevel=0.004)
    def inner_door(name, hinge, swing_dir, axis, width):
        # Türblatt 4 cm, 90° geöffnet an die Wand geklappt
        hx, hy = hinge
        if axis == 'x':   # Blatt liegt dann entlang x
            x0, x1 = (hx, hx + width) if swing_dir > 0 else (hx - width, hx)
            box(name, x0, x1, hy, hy + 0.04, 0.0, DOOR_H - 0.005, M['lack_weiss'], coll='Tueren', bevel=0.0015)
        else:
            y0, y1 = (hy, hy + width) if swing_dir > 0 else (hy - width, hy)
            box(name, hx, hx + 0.04, y0, y1, 0.0, DOOR_H - 0.005, M['lack_weiss'], coll='Tueren', bevel=0.0015)
    inner_door('tuer_flur', (9.32, 5.45), -1, 'x', 0.98)       # in den Flur, an die Schlafzimmerwand
    inner_door('tuer_schlafen', (10.15, 5.16), -1, 'y', 0.88)   # ins Schlafzimmer, an die Westwand
    inner_door('tuer_arbeiten', (13.56, 6.72), 1, 'y', 0.86)    # ins Arbeitszimmer
    # Bad: Tür geschlossen
    box('tuer_bad', 10.42, 11.28, 6.63, 6.69, 0.0, DOOR_H - 0.005, M['lack_weiss'], coll='Tueren', bevel=0.0015)
    for nm, (x, y, ax) in {'drueckerbad': (11.18, 6.6, 'y')}.items():
        box(nm, x - 0.06, x + 0.06, y - 0.05, y + 0.0, 1.03, 1.05, M['bronze'], coll='Tueren', bevel=0.004)

    # --- Fassade außen, Balkon, Nachbarbauteile ---
    # Geschossdecke + Balkonplatte (Sichtkante weiß), Belag Travertin
    box('balkon_platte', -0.3, W + 0.3, -2.4, -EXT, -0.3, -0.02, M['fassade'], coll='Aussen')
    box('balkon_belag', -0.3, W + 0.3, -2.4, -EXT, -0.02, 0.0, M['balkon_stein'], coll='Aussen')
    box('sturz_sued', -EXT, W + EXT, -EXT - 0.002, 0.0, H, H + 0.35, M['fassade'], coll='Aussen')
    # Dachüberstand (oberstes Geschoss): schlanke Platte
    box('dach', -0.6, W + 0.6, -0.9, D + 0.6, H + 0.35, H + 0.6, M['fassade'], coll='Aussen')
    # Glasgeländer mit Bronze-Handlauf
    rail = bmesh.new(); railg = bmesh.new()
    bm_box(railg, -0.25, W + 0.25, -2.36, -2.35, 0.05, 1.02)
    bm_box(rail, -0.27, W + 0.27, -2.38, -2.33, 1.02, 1.06)
    bm_box(rail, -0.27, W + 0.27, -2.38, -2.33, 0.0, 0.05)
    for x in (-0.27, W + 0.22):
        bm_box(railg, x + 0.02, x + 0.03, -2.35, -0.32, 0.05, 1.02)
        bm_box(rail, x, x + 0.05, -2.38, -0.3, 1.02, 1.06)
    rail.normal_update(); railg.normal_update()
    mesh_obj('gelaender', rail, M['bronze'], 'Aussen'); mesh_obj('gelaender_glas', railg, M['glas'], 'Aussen')
    # Unteres Gebäude (die Wohnung liegt im obersten Geschoss einer Stadtvilla am Elbhang)
    box('fassade_unten', -EXT, W + EXT, -EXT, D + EXT, -14.0, -0.3, M['fassade'], coll='Aussen')
    return out
