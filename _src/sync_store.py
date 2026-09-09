# -*- coding: utf-8 -*-
"""Push _src/store.js into every page that carries it.

The block between the two markers is the same text in all five files.
Edit _src/store.js, run this, and they stay that way.
"""
import io, os, sys

ROOT = sys.argv[1]
SRC = os.path.join(ROOT, '_src', 'store.js')
store = io.open(SRC, encoding='utf-8').read().strip()

TAIL = '/* ═══ end CORAL PROJECT STORE v2 ═══ */'

for page in ['hub', 'ventilation', 'ervload', 'acoustic', 'ervroi']:
    p = os.path.join(ROOT, page, 'index.html')
    s = io.open(p, encoding='utf-8').read()
    k = s.index('CORAL PROJECT STORE v2')
    i = s.rindex('/*', 0, k)
    j = s.index(TAIL) + len(TAIL)
    assert j > i, page
    s = s[:i] + store + s[j:]
    io.open(p, 'w', encoding='utf-8').write(s)
    print('%-12s store synced' % page)
