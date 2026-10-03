# Version strings and the bundled kit catalog.
import json, os
def apply(P, mods):
    P.rep('<title>Motif 7</title>', '<title>Motif 8</title>')
    P.rep('<span class="wm">MOTIF</span><b>7</b>', '<span class="wm">MOTIF</span><b>8</b>')
    P.rep('<span class="ver">MOTIF 7.0</span>', '<span class="ver">MOTIF 8.0</span>')
    P.rep("report = { app: 'Motif 7',", "report = { app: 'Motif 8',")
    P.rep('# Created by Motif 7 ', '# Created by Motif 8 ')
    # The three motif-kit@4 reference kits join the in-app catalog (Kits > Library), installable in one click.
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ents = []
    for k in ['stack-lab', 'vector-type', 'sequence-demo']:
        d = os.path.join(root, 'kits-src', k); files = {}
        for dp, _, fs in os.walk(d):
            for f in sorted(fs):
                if f.endswith(('.glsl', '.json', '.md', '.txt', '.svg')): files[os.path.relpath(os.path.join(dp, f), d).replace(os.sep, '/')] = open(os.path.join(dp, f), encoding='utf-8').read()
        manifest = json.loads(files.pop('manifest.json'))
        ents.append(json.dumps({'manifest': manifest, 'files': files}, ensure_ascii=False, separators=(',', ':')))
    tail = '}}]; // token-lint-ignore (kit data carries its own palettes)'
    i = P.t.index('const KIT_CATALOG = '); j = P.t.index(tail, i)
    assert P.t.index('\n', i) > j, 'catalog line shape changed'
    P.t = P.t[:j] + '}},' + ','.join(ents) + ']; // token-lint-ignore (kit data carries its own palettes)' + P.t[j + len(tail):]; P.n += 1
