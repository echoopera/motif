import sys
class Patcher:
    def __init__(self, text): self.t = text; self.n = 0
    def rep(self, old, new, count=1, label=''):
        c = self.t.count(old)
        if c != count:
            sys.exit(f'PATCH FAILED [{label or old[:70]!r}]: expected {count} match(es), found {c}')
        self.t = self.t.replace(old, new); self.n += 1
    def after(self, anchor, add, label=''): self.rep(anchor, anchor + add, 1, label)
    def before(self, anchor, add, label=''): self.rep(anchor, add + anchor, 1, label)
