# -*- coding: utf-8 -*-
"""Pack a whole year of outdoor enthalpy into the string ervload carries.

WHY A WHOLE YEAR AND NOT THE 24 MEANS
    ervroi only needs a mean, so it carries 24 numbers (see bkk_windows.py).
    ervload asks a different question - "how many hours of the year does the
    load beat what the AC has left?" - and counting how many hours cross a
    threshold needs the distribution. A mean throws the distribution away.
    17 KB of text buys an exact answer, and because the order is the
    calendar order, "which month" and "what time of day" come along free.

ENCODING
    value = round((h - 30) * 40)  ->  0..4095, two base64 characters each.
    Step 0.025 kJ/kg, worst rounding error over the year 0.0125 kJ/kg.
    8760 hours -> 17,520 characters.

DATA
    climate.onebuilding.org, TMYx 2011-2025, Bangkok Metropolis WMO 484550.
    Put THA_CRG_Bangkok.Metropolis.484550_TMYx.2011-2025.zip next to this
    file and run it. Paste the string into BKK_H8760_B64 in ervload.

    One city, one station. The card in ervload says so; keep that warning
    with the number if this is ever regenerated for somewhere else.

CHECK (22 Sep 2026, against the page)
    room 25 C / 50 %, et 67 %, air 3000 CMH, AC 75 RT already 95 % loaded
      -> threshold 90.2921 kJ/kg -> 43 hours a year, mostly April and May
    same room, 6000 CMH, AC 40 RT already 90 % loaded
      -> threshold 71.6414 kJ/kg -> 6704 hours a year
    Both reproduced here from the packed string and independently in the
    browser. They agree exactly.
"""
import io, math, zipfile

NC = [0.11670521452767e4, -0.72421316703206e6, -0.17073846940092e2,
      0.12020824702470e5, -0.32325550323333e7,  0.14915108613530e2,
      -0.48232657361591e4, 0.40511340542057e6, -0.23855557567849e0,
      0.65017534844798e3]
PATM = 101.325
B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

def pws(t):
    T = t + 273.15
    th = T + NC[8]/(T - NC[9])
    A = th*th + NC[0]*th + NC[1]
    B = NC[2]*th*th + NC[3]*th + NC[4]
    D = NC[5]*th*th + NC[6]*th + NC[7]
    return (2*D/(-B + math.sqrt(B*B - 4*A*D)))**4 * 1000

def Wof(t, rh):
    pw = rh*pws(t)
    if pw >= PATM: pw = PATM*0.9999
    return 0.621945*pw/(PATM - pw)

def hof(t, W): return 1.006*t + W*(2501 + 1.86*t)

z = zipfile.ZipFile('THA_CRG_Bangkok.Metropolis.484550_TMYx.2011-2025.zip')
name = [n for n in z.namelist() if n.lower().endswith('.epw')][0]
raw = z.read(name).decode('latin-1').splitlines()

H = []
for line in raw[8:]:
    f = line.split(',')
    if len(f) < 10: continue
    t = float(f[6]); rh = min(max(float(f[8])/100.0, 0.0), 1.0)
    H.append(hof(t, Wof(t, rh)))
assert len(H) == 8760, len(H)

out, worst = [], 0.0
for h in H:
    v = max(0, min(4095, int(round((h - 30)*40))))
    worst = max(worst, abs(v/40.0 + 30 - h))
    out.append(B64[v >> 6] + B64[v & 63])
blob = ''.join(out)

o = io.open('bkk_hours.out.txt', 'w', encoding='utf-8')
o.write('hours        : %d\n' % len(H))
o.write('h range      : %.2f .. %.2f kJ/kg\n' % (min(H), max(H)))
o.write('chars        : %d\n' % len(blob))
o.write('worst error  : %.4f kJ/kg\n\n' % worst)
o.write("var BKK_H8760_B64 = '" + blob + "';\n")
o.close()
print('wrote bkk_hours.out.txt · %d chars · worst error %.4f kJ/kg' % (len(blob), worst))
