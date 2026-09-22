# -*- coding: utf-8 -*-
"""Average outdoor enthalpy for Bangkok, over the hours a system actually runs.

WHY THIS EXISTS
    ervroi asks for an "average outdoor condition" to work the annual bill
    out from, and the default shipped with the tool was 31 C / 70 % with no
    source behind it at all. Against a 25 C / 50 % room that pair is
    19 % too heavy, and a design condition typed in by mistake
    (35 C / 60 %) is 49 % too heavy. The saving is proportional to the
    enthalpy difference, so those errors land straight on the number a
    customer is quoted.

DATA
    climate.onebuilding.org, TMYx 2011-2025, Bangkok Metropolis WMO 484550
    THA_CRG_Bangkok.Metropolis.484550_TMYx.2011-2025.zip -> the .epw inside
    8760 hourly rows. Put the zip next to this file and run it.

RESULT (22 Sep 2026)
    all 8760 h        T 29.15  RH 72.4 %   h = 76.23 kJ/kg
    08-17 Mon-Fri     T 30.54  RH 66.0 %   h = 77.04 kJ/kg   <- the default
    08-20 every day   T 30.54  RH 66.2 %   h = 77.19 kJ/kg
    31 C / 63 % gives 76.96, which is the pair now shipped as the default.

    Averaging T and RH separately and pairing them up costs only +0.5 %,
    much less than feared. The thing that matters is picking the right
    hours, not the averaging method.

IS AVERAGING FIRST THE SAME AS 8760 SEPARATE SUMS?
    Yes, exactly, and not by luck. The load is linear in enthalpy:
        q(hour) = 1.2 * Ls * (h_hour - h_room)
    so  sum over hours  =  1.2 * Ls * N * (mean(h) - h_room)
    Measured on the same 2690 office hours with the Lebua job's numbers:
        hour by hour, 2690 separate sums : 898.10 kWh/yr
        mean h, one equation             : 898.10 kWh/yr   (differ by 4e-14 %)
    So there is no approximation in what the tool does - as long as nothing
    in the chain bends. It would stop being exact if the COP varied with
    outdoor temperature, if the ERV bypassed on cool hours, or if the AC ran
    out of capacity part of the time. None of those are modelled today.

NOTE
    One station, one city. A job outside Bangkok needs its own file, and
    a building that runs different hours needs its own selection.
"""
    lo, hi = 0.0, 1.0
    for _ in range(80):
        mid = (lo + hi)/2
        if hof(t, Wof(t, mid)) > h_target:
            hi = mid
        else:
            lo = mid
    return (lo + hi)/2

for label, h in [('ทั้งปี ทุกชั่วโมง', allh),
                 ('ออฟฟิศ 08-17 จ-ศ', off),
                 ('กลางวัน 08-17 ทุกวัน', offall),
                 ('ยาว 08-20 ทุกวัน', ext)]:
    if h is None:
        continue
    line = '%-24s h=%6.2f : ' % (label, h)
    for t in (28, 29, 30, 31, 32):
        rh = pair_for(h, t)
        line += '%d C/%.0f%%  ' % (t, rh*100) if 0.01 < rh < 0.995 else '%d C/–  ' % t
    o.write(line + '\n')
o.close()
print('done')
