# -*- coding: utf-8 -*-
"""Build both weather blocks the tools carry, for all six stations.

WHAT IT PRODUCES
    WX_DAY    24 hourly means of enthalpy and dry bulb per station.
              ervroi uses it to turn "the system runs 08:00-17:00" into an
              average outdoor condition. A mean is all it needs.
    WX_HOURS  every one of the 8760 hours, packed two base64 characters
              each. ervload uses it to count how many hours of the year the
              load beats what the AC has left - counting hours over a
              threshold needs the distribution, and a mean throws the
              distribution away.

ENCODING
    value = round((h - 20) * 36)  ->  0..4095, step 0.0278 kJ/kg, worst
    error across all six files 0.0139 kJ/kg. The offset reaches down to 20
    because Chiang Mai gets to 27.8 on a winter morning; an earlier version
    that started at 30 clamped those hours and was 2.2 kJ/kg out there.

DATA
    climate.onebuilding.org, TMYx 2011-2025, one station per region.
    Download the six .zip files next to this script under the short names
    in FILE below, then run it. Paste the two blocks into ervroi and
    ervload. Both blocks must come from the same run.

    TMYx is a composite year: each month is taken from whichever of the 15
    real years was most typical, so it predicts long-run averages and not
    any particular month's bill.

SIX STATIONS FOR A COUNTRY
    This is a stretch and both tools say so on screen. A job is being told
    the weather of the nearest of six, not its own. Work that needs to be
    right should download its own station.

    kan is Thong Pha Phum - in Kanchanaburi province but up the valley, not
    the town, and remote enough that its record leans on ERA5 reanalysis.
    It has the widest spread of the six.
"""
import io, math, zipfile, json

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

CITIES = [
    ('bkk',  'กรุงเทพฯ',   'กลาง',        'Bangkok Metropolis',  '484550'),
    ('cnx',  'เชียงใหม่',  'เหนือ',       'Chiang Mai Intl AP',  '483270'),
    ('kkc',  'ขอนแก่น',    'อีสาน',       'Khon Kaen AP',        '483810'),
    ('ray',  'ระยอง',      'ตะวันออก',    'Rayong',              '484780'),
    ('kan',  'กาญจนบุรี',  'ตะวันตก',     'Thong Pha Phum',      '484210'),
    ('hkt',  'ภูเก็ต',     'ใต้',          'Phuket',              '485640'),
]
FILE = { 'bkk':'bkk', 'cnx':'chiangmai', 'kkc':'khonkaen',
         'ray':'rayong', 'kan':'thongphaphum', 'hkt':'phuket' }

o = io.open(r'C:\tmp\wx\all.txt', 'w', encoding='utf-8')
hours_js, day_js, summary = [], [], []

for key, th, region, station, wmo in CITIES:
    z = zipfile.ZipFile(r'C:\tmp\wx\%s.zip' % FILE[key])
    name = [n for n in z.namelist() if n.lower().endswith('.epw')][0]
    raw = z.read(name).decode('latin-1').splitlines()
    head = raw[0].split(',')
    H, buckH, buckT = [], {h: [] for h in range(1, 25)}, {h: [] for h in range(1, 25)}
    for line in raw[8:]:
        f = line.split(',')
        if len(f) < 10: continue
        t = float(f[6]); rh = min(max(float(f[8])/100.0, 0.0), 1.0)
        h = hof(t, Wof(t, rh))
        H.append(h)
        k = int(f[3]); buckH[k].append(h); buckT[k].append(t)
    assert len(H) == 8760, (key, len(H))

    packed, worst = [], 0.0
    for h in H:
        v = max(0, min(4095, int(round((h - 20)*36))))
        worst = max(worst, abs(v/36.0 + 20 - h))
        packed.append(B64[v >> 6] + B64[v & 63])
    blob = ''.join(packed)

    HH = [round(sum(buckH[i])/len(buckH[i]), 3) for i in range(1, 25)]
    TT = [round(sum(buckT[i])/len(buckT[i]), 3) for i in range(1, 25)]

    hours_js.append("  %s:'%s'" % (key, blob))
    day_js.append("  %s:{ h:%s,\n       t:%s }"
                  % (key, json.dumps(HH), json.dumps(TT)))
    summary.append((key, th, region, station, wmo, head[9].strip(),
                    sum(H)/8760, min(H), max(H), worst))

o.write('== stations ==\n')
o.write('%-5s %-11s %-10s %-22s %-8s %7s %8s %8s %8s\n'
        % ('key','จังหวัด','ภาค','station','WMO','elev m','h เฉลี่ย','h ต่ำสุด','h สูงสุด'))
for r in summary:
    o.write('%-5s %-11s %-10s %-22s %-8s %7s %8.2f %8.2f %8.2f\n'
            % (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]))
o.write('\nworst pack error: %.4f kJ/kg\n' % max(r[9] for r in summary))
o.write('total packed chars: %d\n\n' % sum(len(h) for h in hours_js))

o.write('/* ---- for ervroi (24 buckets each) ---- */\nvar WX_DAY = {\n'
        + ',\n'.join(day_js) + '\n};\n\n')
o.write('/* ---- for ervload (8760 packed each) ---- */\nvar WX_HOURS = {\n'
        + ',\n'.join(hours_js) + '\n};\n')
o.close()
print('done')
