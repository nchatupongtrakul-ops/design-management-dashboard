# -*- coding: utf-8 -*-
"""Mean outdoor enthalpy for a range of operating windows, so a user can look
up the pair that matches the hours they typed into the tool."""
import io, math, zipfile

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
rows = []
for line in raw[8:]:
    f = line.split(',')
    if len(f) < 10: continue
    t, rh = float(f[6]), float(f[8])/100.0
    if t <= -99 or not (0 <= rh <= 1.05): continue
    rows.append((int(f[3]), hof(t, Wof(t, min(rh, 1.0)))))   # (hour 1..24, h)

o = io.open(r'C:\tmp\wx\out4.txt', 'w', encoding='utf-8')

o.write('== h เฉลี่ยรายชั่วโมงของวัน (เฉลี่ยทั้งปี) ==\n')
for hh in range(1, 25):
    sub = [r[1] for r in rows if r[0] == hh]
    o.write('  %02d:00  n=%3d  h=%6.2f\n' % (hh % 24, len(sub), sum(sub)/len(sub)))

WIN = [('24 ชม. ทุกวัน · โรงแรม โรงพยาบาล', 1, 24),
       ('06:00-18:00 · โรงงานกะเดียว',       6, 18),
       ('07:00-17:00',                        7, 17),
       ('08:00-17:00 · ออฟฟิศ',               8, 17),
       ('08:00-18:00',                        8, 18),
       ('09:00-18:00',                        9, 18),
       ('10:00-21:00 · ร้านค้า ห้าง',        10, 21),
       ('11:00-22:00 · ร้านอาหาร',           11, 22),
       ('06:00-22:00 · สองกะ',                6, 22),
       ('18:00-08:00 · กลางคืน ที่พัก',      18,  8)]

o.write('\n== ช่วงเวลาเดิน -> h เฉลี่ย -> คู่ T/RH ที่ให้ h เท่านั้น ==\n')
o.write('%-34s %7s %8s   %s\n' % ('ช่วงเวลา', 'ชม./วัน', 'h̄', 'คู่ที่ใส่ได้'))
for tag, a, b in WIN:
    if a <= b:
        sel = [r[1] for r in rows if a <= r[0] <= b]
        span = b - a + 1
    else:                                    # wraps past midnight
        sel = [r[1] for r in rows if r[0] >= a or r[0] <= b]
        span = (24 - a + 1) + b
    h = sum(sel)/len(sel)
    pairs = ' · '.join('%d°C/%.0f%%' % (t, rh_for(h, t)*100) for t in (29, 30, 31, 32))
    o.write('%-34s %7d %8.2f   %s\n' % (tag, span, h, pairs))

o.write('\n== วันในสัปดาห์มีผลไหม (ช่วง 08-17) ==\n')
for tag, sel in [('ทุกวัน', lambda i: True),
                 ('5 ใน 7 วัน (proxy วันทำงาน)', lambda i: (i % 7) < 5)]:
    sub = [h for i, (hh, h) in enumerate(rows) if 8 <= hh <= 17 and sel(i // 24)]
    o.write('  %-30s n=%5d  h=%6.2f\n' % (tag, len(sub), sum(sub)/len(sub)))
o.close()
print('done')
