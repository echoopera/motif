# Version strings.
def apply(P, mods):
    P.rep('<title>Motif 8</title>', '<title>Motif 9</title>')
    P.rep('<span class="wm">MOTIF</span><b>8</b>', '<span class="wm">MOTIF</span><b>9</b>')
    P.rep('<span class="ver">MOTIF 8.0</span>', '<span class="ver">MOTIF 9.0</span>')
    P.rep("report = { app: 'Motif 8',", "report = { app: 'Motif 9',")
    P.rep('# Created by Motif 8 ', '# Created by Motif 9 ')
