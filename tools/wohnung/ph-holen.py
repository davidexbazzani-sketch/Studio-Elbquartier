# Lädt Poly-Haven-Modelle (glTF 2k) und -Texturen (2k jpg) nach tools/wohnung/quelle/ (CC0).
import json, os, sys, urllib.request
UA = {'User-Agent': 'Mozilla/5.0 (Studio Elbquartier asset fetch)'}
def fetch(url): return urllib.request.urlopen(urllib.request.Request(url, headers=UA))
BASE = os.path.join(os.path.dirname(__file__), 'quelle')
def get(url, path):
    if os.path.exists(path): return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = fetch(url).read()
    open(path, 'wb').write(data)
def files(a): return json.load(fetch('https://api.polyhaven.com/files/' + a))
def model(a, res='2k'):
    d = files(a)['gltf'][res]['gltf']
    root = os.path.join(BASE, 'ph', a)
    get(d['url'], os.path.join(root, os.path.basename(d['url'])))
    for rel, inc in d.get('include', {}).items(): get(inc['url'], os.path.join(root, rel))
def texture(a, res='2k'):
    d = files(a); root = os.path.join(BASE, 'tex', a)
    for key in ['Diffuse', 'nor_gl', 'Rough', 'arm', 'AO', 'Displacement']:
        if key in d and res in d[key]:
            f = d[key][res].get('jpg') or d[key][res].get('png')
            if f: get(f['url'], os.path.join(root, os.path.basename(f['url'])))
kind = sys.argv[1]
for a in sys.argv[2:]:
    try:
        (model if kind == 'model' else texture)(a); print('ok', a)
    except Exception as e: print('FEHLER', a, e)
