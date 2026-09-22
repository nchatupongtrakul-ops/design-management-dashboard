# -*- coding: utf-8 -*-
"""The 24 numbers the tool needs to work out the mean condition for any
operating window on its own.

EPW hour h covers the clock period ENDING at h:00, so hour 1 is 00:00-01:00
and hour 9 is 08:00-09:00. A window from clock A to clock B is therefore
EPW hours A+1 .. B, which is B-A hours long. The earlier table got this
off by one; this is the corrected version.

Each hour-of-day bucket holds exactly 365 samples, so the mean over any
window is just the plain average of the buckets in it - no weighting, and
exact, not an approximation.
"""
import io, math, zipfile, json

NC = [0.11670521452767e4, -0.72421316703206e6, -0.17073846940092e2,
      0.12020824702470e5, -0.32325550323333e7,  0.14915108613530e2,
      -0.48232657361591e4, 0.40511340542057e6, -0.23855557567849e0,
      0.65017534844798e3]
PATM = 101.325

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

def rh_for(h_target, t):
    lo, hi = 0.0, 1.0
    for _ in range(80):
        mid = (lo + hi)/2
        if hof(t, Wof(t, mid)) > h_target: hi = mid
        else: lo = mid
    return (lo + hi)/2

z = zipfile.ZipFile(r'C:\tmp\wx\bkk.zip')
name = [n for n in z.namelist() if n.lower().endswith('.epw')][0]
raw = z.read(name).decode('latin-1').splitlines()

buck = {h: [] for h in range(1, 25)}
for line in raw[8:]:
    f = line.split(',')
    if len(f) < 10: continue
    t, rh = float(f[6]), float(f[8])/100.0
    if t <= -99 or not (0 <= rh <= 1.05): continue
    buck[int(f[3])].append(hof(t, Wof(t, min(rh, 1.0))))

o = io.open(r'C:\tmp\wx\out5.txt', 'w', encoding='utf-8')
o.write('== h เฉลี่ยของแต่ละชั่วโมงในวัน (365 ตัวอย่างต่อช่อง) ==\n')
o.write('   ช่วงเวลานาฬิกา   EPW hour   n     h เฉลี่ย\n')
H = []
for hh in range(1, 25):
    v = sum(buck[hh])/len(buck[hh])
    H.append(round(v, 3))
    o.write('   %02d:00-%02d:00        %2d     %3d   %6.2f\n'
            % (hh-1, hh % 24, hh, len(buck[hh]), v))

o.write('\nJS array (index 0 = EPW hour 1 = 00:00-01:00):\n')
o.write('var BKK_H = ' + json.dumps(H) + ';\n')
o.write('ทั้งปี 8760 ชม. -> h = %.3f\n' % (sum(H)/24))

def win(a, b):
    """clock a:00 to b:00 -> EPW hours a+1..b, wrapping past midnight"""
    hrs = []
    n = (b - a) % 24 or 24
    for k in range(n):
        hrs.append(((a + k) % 24) + 1)
    return sum(H[i-1] for i in hrs)/len(hrs), n

o.write('\n== ตารางที่แก้ off-by-one แล้ว ==\n')
o.write('%-32s %7s %8s   %s\n' % ('ช่วงเวลา', 'ชม./วัน', 'h เฉลี่ย', 'คู่ที่ใส่ได้'))
WIN = [('00:00-24:00 · ตลอดวัน',       0, 24),
       ('18:00-08:00 · กลางคืน',      18,  8),
       ('06:00-18:00 · โรงงานกะเดียว', 6, 18),
       ('06:00-22:00 · สองกะ',         6, 22),
       ('07:00-17:00',                 7, 17),
       ('08:00-17:00 · ออฟฟิศ',        8, 17),
       ('08:00-18:00',                 8, 18),
       ('09:00-18:00',                 9, 18),
       ('10:00-21:00 · ร้านค้า',      10, 21),
       ('11:00-22:00 · ร้านอาหาร',    11, 22)]
for tag, a, b in WIN:
    h, n = win(a, b)
    pairs = ' · '.join('%d/%.0f' % (t, rh_for(h, t)*100) for t in (30, 31, 32))
    o.write('%-32s %7d %8.2f   %s\n' % (tag, n, h, pairs))

o.write('\n== ตรวจว่าเฉลี่ยจากถัง 24 ช่อง = เฉลี่ยจากชั่วโมงดิบ ==\n')
rows = []
for line in raw[8:]:
    f = line.split(',')
    if len(f) < 10: continue
    t, rh = float(f[6]), float(f[8])/100.0
    if t <= -99 or not (0 <= rh <= 1.05): continue
    rows.append((int(f[3]), hof(t, Wof(t, min(rh, 1.0)))))
for tag, a, b in [('08:00-17:00', 8, 17), ('18:00-08:00', 18, 8), ('10:00-21:00', 10, 21)]:
    hb, n = win(a, b)
    want = set(((a + k) % 24) + 1 for k in range((b - a) % 24 or 24))
    sub = [r[1] for r in rows if r[0] in want]
    hr_ = sum(sub)/len(sub)
    o.write('  %-12s  ถัง=%7.4f  ดิบ=%7.4f  ต่าง=%.2e\n' % (tag, hb, hr_, abs(hb-hr_)))
o.close()
print('done')
