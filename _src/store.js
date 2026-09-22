/* ═══════════════════════════════════════════════════════════════════════
   CORAL PROJECT STORE v2
   Shared by every tool. Identical text in all five pages - edit the copy in
   the scratchpad and run sync_store.py, never one page by hand.

   project  → scenario → room
   A project is a building. A scenario is one set of design conditions for
   that building; a project can hold several, so "with ERV" and "with plain
   fans", or two efficiencies, live side by side over the same rooms rather
   than as two disconnected copies of the job.

   Conditions live on the scenario. A room may override one, and when it
   does the tools say so and offer to put it back, because a room quietly
   carrying a different outdoor temperature from its own project is the
   kind of error nobody finds by reading the summary.
   ═══════════════════════════════════════════════════════════════════════ */
var CS_K1 = 'coral.projects.v1';   /* the old shape - kept, never written to again */
var CS_K2 = 'coral.projects.v2';

function csUid(){
  return String(Date.now()) + String(Math.round(Math.random()*100000));
}
function csNum(x, d){
  var v = parseFloat(x);
  return isFinite(v) ? v : (d === undefined ? 0 : d);
}

/* The conditions a scenario carries. Outdoor design drives equipment size,
   outdoor average drives the electricity bill; using one for the other is a
   standing mistake, so they are separate fields with separate labels. */
function csNewScenario(name){
  return {
    id: csUid(), name: name || 'ทางเลือกที่ 1', note: '', off: false,
    city: '',
    oaPk: { t:33.5, rh:68.5 },  /* design · sizing · = CS_SITE_PEAK.bkk */
    co2:  { oa:400 },          /* outdoor CO2 ppm · the floor indoor CO2 decays to */
    /* ── which criteria this job is actually held to ──
       A room is not failing LEED when nobody is chasing LEED. Judging
       every room against every standard produced shortfalls against
       things the project never agreed to, and worse, let one of them
       become the governing figure and drive the airflow. So the project
       says which ones count; the rest still compute and are shown, but
       marked as not in use and kept out of the verdict. */
    crit: { ash:true, law:true, leed:false, ceil:true, p1000:true },
    /* Which weather file the tools should read when they work a condition
       out for themselves. One of the keys in CS_SITES. Bangkok unless the
       job says otherwise, because most of them are.
       This lives on the scenario rather than in each tool, so ERV Energy
       Saving and ERV Load cannot end up quoting different provinces for
       the same building. */
    site: 'bkk',
    /* the sizing pair below is bkk's, kept in step with CS_SITE_PEAK */
    /* Bangkok Metropolis TMYx 2011-2025 (WMO 484550), the 08:00-17:00
       hours: mean enthalpy 77.42 kJ/kg. 31 C / 63.6 % reproduces it.
       The old default of 31 C / 70 % is 82.21 kJ/kg, which against a
       25 C / 50 % room overstates the load - and therefore the saving -
       by 19 %. See _src/bkk_windows.py. */
    oaAv: { t:31, rh:63 },     /* annual average · energy */
    room: { t:25, rh:50 },     /* indoor */
    erv:  { et:67, es:70 },    /* core effectiveness, total and sensible, % */
    /* ohA/ohB are the clock hours the system runs, e.g. 8 and 17. Blank
       means nobody said, and then hpd is typed by hand and the outdoor
       average has to be too. They sit beside hpd because the window is
       what hpd is derived from once it is filled in. */
    bill: { rate:4.15, hpd:10, dpy:300, cop:3.2, ohA:null, ohB:null },
    roi:  {},                  /* the rest of ERV Energy Saving's own inputs */
    rooms: [ csNewRoom('ห้องที่ 1') ]
  };
}
function csNewRoom(name){
  return {
    id: csUid(), name: name || 'ห้อง', tag: '',
    level: '', system: '', zone: '',
    a: 80, h: 2.8, pz: 20,
    /* true while the headcount is still the reference density talking.
       Typing a real number clears it; rooms made before this existed do
       not have it, so their numbers are left exactly as they are. */
    pzAuto: true,
    qty: 1,                    /* how many identical rooms this row stands for */
    cat: 'AC',                 /* 'AC' air conditioned · 'MV' ventilation only */
    cap: 0, qac: 0,            /* existing plant, several units summed */
    vent: null, erv: null, ac: null
  };
}
function csNewProject(name){
  return {
    id: csUid(), name: name || 'โปรเจคใหม่', client: '', note: '',
    off: false, status: '',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    scenarios: [ csNewScenario('ทางเลือกที่ 1') ]
  };
}

/* ── the conditions a room actually runs at ──
   A room field wins over the scenario only when the room carries one, so a
   room that was never touched follows its project for ever after. */
/* the floor area of a room · rooms written before the area was typed
   directly still carry the width and length it was worked out from */
function csArea(rm){
  if(!rm) return 0;
  var a = csNum(rm.a, NaN);
  if(isFinite(a) && a > 0) return a;
  return csNum(rm.w) * csNum(rm.l);
}
function csVolume(rm){ return csArea(rm) * csNum(rm.h); }

function csCond(scn, rm){
  var c = {
    oaPkT: csNum(scn.oaPk.t,33.5), oaPkRh: csNum(scn.oaPk.rh,68.5),
    oaAvT: csNum(scn.oaAv.t,31), oaAvRh: csNum(scn.oaAv.rh,63),
    rT: csNum(scn.room.t,25),    rRh: csNum(scn.room.rh,50),
    et: csNum(scn.erv.et,67),    es: csNum(scn.erv.es,70),
    oaCo: csNum(scn.co2 && scn.co2.oa, 400),
    site: CS_SITES[scn.site] ? scn.site : 'bkk',
    crit: scn.crit || { ash:true, law:true, leed:false, ceil:true, p1000:true },
    over: []
  };
  var o = rm && rm.cond;
  if(o){
    ['oaPkT','oaPkRh','rT','rRh','et','es','oaCo'].forEach(function(k){
      if(o[k] != null && isFinite(o[k]) && Math.abs(o[k] - c[k]) > 1e-9){
        c[k] = +o[k]; c.over.push(k);
      }
    });
  }
  return c;
}
/* ══════════════════════════════════════════════════════════════════
   WEATHER STATIONS

   All six from climate.onebuilding.org, TMYx 2011-2025, downloaded
   22 Sep 2026. One per region, which is as far as six files can honestly
   stretch: a job is being told the weather of the nearest of six stations,
   not its own. Both tools say so on screen.

   pk   the SIZING pair. Straight out of the DESIGN CONDITIONS header of
        the same EPW file, which carries the 2025 ASHRAE Handbook
        Fundamentals ch.14 figures. It is the 0.4 % ENTHALPY design
        condition paired with its mean coincident dry bulb - not the 0.4 %
        dry bulb, because an outdoor-air load is driven by enthalpy and
        picking the hot dry hour would size for something that costs the
        coil less than a cooler soaking one. Stored as dry bulb plus the
        relative humidity that puts it at the design enthalpy, because
        that is the pair the tools ask for.
   hAvg the mean enthalpy over all 8760 hours. Energy, not sizing.
   hMin
   hMax the extremes of the year, kept so the table can show that a mild
        average and a mild peak are different questions: cnx has the
        lightest average of the six and a heavier peak than bkk.

   ⚠ kan is Thong Pha Phum, in Kanchanaburi province but up the valley,
   not the town. Nothing closer exists in the archive, and being remote its
   record leans on ERA5 reanalysis rather than instruments - it has by far
   the widest spread of the six. Treat its extremes as indicative.
   hkt also has a long tail, which for a humid island is believable.
   ══════════════════════════════════════════════════════════════════ */
var CS_SITES = {
  bkk: { th:'กรุงเทพฯ',  reg:'ภาคกลาง',     st:'Bangkok Metropolis', wmo:'484550', el:4,
         pk:{ t:33.5, rh:68.5, h:91.5 }, hAvg:76.23, hMin:43.66, hMax:95.05 },
  cnx: { th:'เชียงใหม่', reg:'ภาคเหนือ',    st:'Chiang Mai Intl AP', wmo:'483270', el:316,
         pk:{ t:32.2, rh:69.8, h:87.0 }, hAvg:64.93, hMin:27.83, hMax:101.76 },
  kkc: { th:'ขอนแก่น',   reg:'ภาคอีสาน',    st:'Khon Kaen AP',       wmo:'483810', el:204,
         pk:{ t:32.9, rh:67.9, h:88.4 }, hAvg:69.14, hMin:36.96, hMax:100.58 },
  ray: { th:'ระยอง',     reg:'ภาคตะวันออก', st:'Rayong',             wmo:'484780', el:5,
         pk:{ t:33.3, rh:71.2, h:93.0 }, hAvg:77.18, hMin:42.17, hMax:98.00 },
  kan: { th:'กาญจนบุรี', reg:'ภาคตะวันตก',  st:'Thong Pha Phum',     wmo:'484210', el:99,
         pk:{ t:34.3, rh:60.7, h:88.0 }, hAvg:72.39, hMin:30.80, hMax:120.07 },
  hkt: { th:'ภูเก็ต',    reg:'ภาคใต้',      st:'Phuket',             wmo:'485640', el:4,
         pk:{ t:32.8, rh:68.1, h:88.2 }, hAvg:78.42, hMin:59.58, hMax:109.15 }
};
var CS_SITE_ORDER = ['bkk', 'cnx', 'kkc', 'ray', 'kan', 'hkt'];
function csSite(k){ return CS_SITES[k] || CS_SITES.bkk; }
function csSiteLabel(k){ var x = csSite(k); return x.th + ' · ' + x.reg; }
function csSitePeak(k){ return csSite(k).pk; }

/* ── hour of day, per station ──
   Mean enthalpy and mean dry bulb for each of the 24 hours of the day over
   a whole year. Index 0 is EPW hour 1, the clock period 00:00-01:00, so a
   window from clock A to clock B is indices A .. B-1, B-A of them.

   Every bucket holds exactly 365 samples, so the mean over a window is the
   plain average of the buckets in it - exact, not a weighting. And because
   the load is linear in enthalpy, one calculation at that mean gives the
   same annual figure as 8760 separate ones. Built by _src/wx_build.py. */
var WX_DAY = {
  bkk:{ h:[75.55, 75.26, 74.772, 74.439, 74.029, 73.838, 73.626, 73.452, 74.606, 75.518, 76.688, 77.483, 77.995, 78.805, 78.696, 78.613, 78.419, 78.763, 77.67, 76.7, 76.35, 76.368, 76.151, 75.804],
       t:[27.639, 27.408, 27.184, 26.966, 26.748, 26.642, 26.521, 26.413, 27.655, 28.898, 30.141, 30.94, 31.735, 32.534, 32.493, 32.448, 32.407, 31.425, 30.42, 29.447, 28.996, 28.548, 28.098, 27.87] },
  cnx:{ h:[62.258, 63.695, 60.716, 60.244, 61.979, 59.235, 59.027, 61.114, 61.597, 62.591, 67.241, 67.414, 65.543, 69.943, 67.9, 67.546, 70.058, 75.666, 70.681, 68.754, 63.409, 63.775, 65.595, 62.262],
       t:[24.414, 24.435, 23.507, 23.12, 23.227, 22.393, 22.177, 22.612, 23.783, 25.668, 27.673, 28.655, 29.921, 31.508, 31.476, 31.827, 32.385, 31.104, 29.85, 28.876, 27.022, 26.216, 25.991, 25.06] },
  kkc:{ h:[67.482, 67.145, 65.896, 65.359, 65.162, 64.466, 64.087, 64.821, 67.527, 69.053, 70.408, 72.896, 73.299, 72.84, 73.585, 73.177, 71.709, 72.897, 71.214, 70.738, 69.009, 69.283, 69.285, 67.904],
       t:[25.188, 25.06, 24.342, 24.002, 23.944, 23.42, 23.183, 23.725, 25.13, 27.135, 28.686, 30.063, 31.126, 31.803, 31.957, 32.023, 31.71, 30.556, 29.099, 28.364, 27.103, 26.578, 26.433, 25.586] },
  ray:{ h:[76.266, 75.889, 75.228, 74.609, 74.138, 73.712, 73.418, 73.359, 75.054, 76.707, 78.507, 79.055, 79.724, 80.735, 80.326, 80.165, 80.277, 79.433, 78.67, 78.128, 77.678, 77.396, 77.138, 76.641],
       t:[27.309, 27.141, 26.933, 26.729, 26.559, 26.441, 26.331, 26.3, 27.513, 28.705, 29.893, 30.29, 30.682, 31.121, 30.892, 30.685, 30.529, 29.841, 29.175, 28.565, 28.228, 27.937, 27.667, 27.488] },
  kan:{ h:[69.464, 68.606, 67.993, 67.37, 66.749, 66.419, 66.023, 65.678, 68.36, 71.093, 74.391, 75.769, 75.972, 77.725, 78.006, 78.33, 79.525, 80.029, 77.83, 74.894, 73.13, 72.301, 71.499, 70.3],
       t:[24.911, 24.455, 24.156, 23.845, 23.539, 23.407, 23.241, 23.092, 24.825, 26.754, 28.581, 29.859, 31.241, 32.474, 32.43, 32.308, 32.165, 29.797, 29.373, 28.08, 27.331, 26.526, 25.816, 25.363] },
  hkt:{ h:[76.278, 76.275, 75.589, 75.287, 75.326, 74.928, 74.893, 75.154, 76.167, 77.479, 79.705, 80.799, 82.02, 84.399, 83.695, 84.089, 83.861, 80.237, 78.55, 78.316, 77.624, 77.307, 77.345, 76.687],
       t:[27.416, 27.225, 26.965, 26.761, 26.592, 26.498, 26.427, 26.406, 27.556, 28.835, 30.026, 30.615, 31.146, 31.558, 31.563, 31.638, 31.559, 30.804, 29.852, 29.035, 28.633, 28.276, 27.941, 27.658] }
};

/* What the outdoor air averages over the hours this scenario actually
   runs. Returns null when no window is set - there is no single right
   answer then, and guessing one would be worse than saying nothing. */
function csWindow(scn){
  var b = scn.bill || {}, site = csSite(scn.site) ? (CS_SITES[scn.site] ? scn.site : 'bkk') : 'bkk';
  var a = csNum(b.ohA, NaN), z = csNum(b.ohB, NaN);
  if(!isFinite(a) || !isFinite(z)) return null;
  a = Math.round(a); z = Math.round(z);
  if(a < 0 || a > 24 || z < 0 || z > 24) return null;
  a = a % 24;
  var n = (z - a + 24) % 24; if(n === 0) n = 24;
  var D = WX_DAY[site], sh = 0, st = 0;
  for(var k = 0; k < n; k++){ var i = (a + k) % 24; sh += D.h[i]; st += D.t[i]; }
  var h = sh/n, t = st/n;
  /* the dry bulb is rounded here, and the caller solves the humidity AT
     that rounded value with its own psychrometrics - rounding both ends
     separately threw away 1.7 % of the load when this was first written.
     The store deliberately carries no psychrometrics of its own; two of
     the five pages that share this block have no use for them. */
  return { a:a, b:z % 24, n:n, h:h, t:Math.round(t*10)/10, site:site };
}

/* The provenance table, rendered once here and shown in all three tools,
   so no page carries a hand-typed copy that can drift from the data the
   calculations actually use. `now` highlights the row in use. */
function csSiteTable(now){
  var head = '<div class="tablewrap"><table class="dtable"><thead><tr>'
    + '<th>ภาค</th><th>จังหวัด</th><th>สถานี · WMO</th><th class="num">สูง</th>'
    + '<th class="num">สภาวะออกแบบ</th><th class="num">h ออกแบบ</th>'
    + '<th class="num">h เฉลี่ยทั้งปี</th><th class="num">h ต่ำสุด–สูงสุด</th>'
    + '</tr></thead><tbody>';
  var body = CS_SITE_ORDER.map(function(k){
    var x = CS_SITES[k], on = (k === now);
    return '<tr' + (on ? ' style="background:#EFF6EF"' : '') + '>'
      + '<td>' + x.reg + '</td>'
      + '<td>' + (on ? '<b>' + x.th + '</b> ← ที่ใช้อยู่' : x.th) + '</td>'
      + '<td>' + x.st + ' · ' + x.wmo + '</td>'
      + '<td class="num">' + x.el + ' m</td>'
      + '<td class="num">' + x.pk.t + ' °C / ' + x.pk.rh + ' %</td>'
      + '<td class="num">' + x.pk.h.toFixed(1) + '</td>'
      + '<td class="num">' + x.hAvg.toFixed(2) + '</td>'
      + '<td class="num">' + x.hMin.toFixed(1) + ' – ' + x.hMax.toFixed(1) + '</td>'
      + '</tr>';
  }).join('');
  return head + body + '</tbody></table></div>';
}
/* the paragraph that has to travel with the table wherever it is shown */
function csSiteNote(){
  return '<b>ที่มา</b> climate.onebuilding.org · <b>TMYx 2011–2025</b> · '
    + 'โหลด 22 ก.ย. 2569 · หน่วยเอนทัลปี kJ/kg อากาศแห้ง<br>'
    + '<b>สภาวะออกแบบ</b> มาจากหัว <code>DESIGN CONDITIONS</code> ของไฟล์อากาศเอง '
    + 'ซึ่งบรรจุตัวเลข <b>ASHRAE Handbook Fundamentals 2025 บทที่ 14</b> · '
    + 'ใช้ <b>เอนทัลปีออกแบบ 0.4 % กับอุณหภูมิที่เกิดร่วม</b> '
    + 'ไม่ใช่กระเปาะแห้ง 0.4 % <b>เพราะภาระอากาศนอกขับด้วยเอนทัลปี</b> — '
    + 'ชั่วโมงร้อนแห้งไม่ได้หนักเท่าชั่วโมงที่เย็นกว่าแต่ชื้นกว่า '
    + '(กาญจนบุรีกระเปาะแห้งสูงสุด 38.6 °C แต่ h ออกแบบ 88.0 · '
    + 'ระยองแค่ 35.0 °C แต่ h ออกแบบ 93.0)<br>'
    + '<b>h เฉลี่ยทั้งปี</b> ใช้คิดค่าไฟ ไม่ใช่คิดขนาดเครื่อง · '
    + 'ERV Energy Saving หยิบเฉพาะชั่วโมงที่ระบบเดินจริงมาเฉลี่ยอีกที<br>'
    + '⚠️ <b>เชียงใหม่เฉลี่ยเบาที่สุด (64.93) แต่ยอดสูงกว่ากรุงเทพ (101.8 เทียบ 95.1)</b> — '
    + 'ค่าเฉลี่ยกับค่าสุดขีดเป็นคนละเรื่อง งานที่ดูแต่ค่าเฉลี่ยจะพลาดตรงนี้<br>'
    + '⚠️ <b>กาญจนบุรีใช้สถานี Thong Pha Phum</b> ซึ่งอยู่ในจังหวัดจริงแต่เป็นในหุบ '
    + 'ไม่ใช่ตัวเมือง · เป็นสถานีห่างไกลที่ข้อมูลพึ่ง ERA5 reanalysis มากกว่าเครื่องวัด '
    + 'และหางกว้างที่สุดในหกสถานี · <b>ใช้ดูแนวโน้มได้ อย่ายกค่าสุดขีดไปใส่เอกสาร</b><br>'
    + '⚠️ <b>หกสถานีแทนทั้งประเทศเป็นการยืด</b> งานหนึ่งกำลังถูกบอกอากาศของสถานี'
    + 'ที่ใกล้ที่สุดในหกแห่ง ไม่ใช่ของที่ตั้งจริง · '
    + '<b>งานที่ต้องการความแม่นควรโหลดไฟล์ของสถานีที่ใกล้จริงมาคิดเอง</b> '
    + '(สคริปต์ <code>_src/wx_build.py</code> รับไฟล์ไหนก็ได้)<br>'
    + '<b>TMYx เป็นปีตัวแทน</b> ประกอบจากเดือนที่ปกติที่สุดของ 15 ปีจริงมาต่อกัน '
    + 'ตามวิธี ISO 15927-4:2005 · '
    + 'ใช้ทำนายค่าเฉลี่ยระยะยาวได้ <b>ใช้ทำนายบิลของเดือนใดเดือนหนึ่งไม่ได้</b><br>'
    + '⚠️ <b>ชุดนี้เป็นตัวแทนปี ค.ศ. 2018</b> (กึ่งกลางของช่วง 2011–2025) '
    + 'ขณะที่เครื่องจะทำงานไปถึงราวปี 2046 · <b>จึงเย็นกว่าที่เครื่องจะเจอจริง</b> — '
    + 'ตัวเลขประหยัดผิดในทางที่ปลอดภัย (ของจริงจะมากกว่า) '
    + 'แต่<b>ขนาดเครื่องผิดในทางที่เสี่ยง</b> · งานที่เฉียดเกณฑ์ควรลองบวก 0.5–1.0 °C '
    + 'เข้าสภาวะออกแบบแล้วดูซ้ำ<br>'
    + '📖 <b><a href="../_src/doc-weather.html" target="_blank" rel="noopener">'
    + 'เปิดคู่มือข้อมูลอากาศฉบับเต็ม</a></b> — ที่มา วิธีคิด ข้อจำกัดทุกข้อ '
    + 'และรายการอ้างอิง';
}
var CS_COND_TH = { oaPkT:'อุณหภูมิภายนอก', oaPkRh:'ความชื้นภายนอก',
                   rT:'อุณหภูมิห้อง', rRh:'ความชื้นห้อง',
                   et:'ประสิทธิภาพรวม ηt', es:'ประสิทธิภาพสัมผัส ηs',
                   oaCo:'CO₂ อากาศภายนอก' };
/* the criteria, in the order they are shown */
var CS_CRIT = [
  ['ash',   'ASHRAE 62.1 · Table 6-1',      'Rp ต่อคน + Ra ต่อพื้นที่'],
  ['law',   'กฎกระทรวงฉบับที่ 39',           'เกณฑ์ที่กฎหมายไทยบังคับ'],
  ['leed',  'LEED / WELL',                  'ASHRAE 62.1 × 1.3 · เลือกเมื่อโครงการทำ certification'],
  ['ceil',  'เพดาน CO₂ ของ ASHRAE 62.1',    'ตามหมวดพื้นที่ · บางหมวดไม่มีเกณฑ์'],
  ['p1000', 'เป้าหมาย 1,000 ppm',           'ตัวชี้วัดดั้งเดิม ไม่ใช่ข้อบังคับของมาตรฐานใด']
];

/* ── migration ──
   v1 is left exactly where it is. If v2 ever has to be thrown away the old
   registry is still there to read. */
function csMigrate(old){
  var out = { v:2, projects:[] };
  (old.projects || []).forEach(function(p){
    var np = csNewProject(p.name);
    np.id = p.id; np.client = p.client || ''; np.note = p.note || '';
    np.off = !!p.off;
    var sc = csNewScenario('ทางเลือกที่ 1');
    /* conditions the ROI page had been carrying for the whole project */
    var r = p.roi || {};
    if(isFinite(csNum(r.tpk, NaN))) sc.oaPk.t  = csNum(r.tpk);
    if(isFinite(csNum(r.rpk, NaN))) sc.oaPk.rh = csNum(r.rpk);
    if(isFinite(csNum(r.tav, NaN))) sc.oaAv.t  = csNum(r.tav);
    if(isFinite(csNum(r.rav, NaN))) sc.oaAv.rh = csNum(r.rav);
    if(isFinite(csNum(r.tr,  NaN))) sc.room.t  = csNum(r.tr);
    if(isFinite(csNum(r.rr,  NaN))) sc.room.rh = csNum(r.rr);
    if(isFinite(csNum(r.et,  NaN))) sc.erv.et  = csNum(r.et);
    ['rate','hpd','dpy','cop'].forEach(function(k){
      if(isFinite(csNum(r[k], NaN))) sc.bill[k] = csNum(r[k]);
    });
    sc.roi = r;
    sc.site = 'bkk';          /* everything written before this existed */
    sc.rooms = (p.rooms || []).map(function(rm){
      var nr = csNewRoom(rm.name);
      nr.id = rm.id;
      ['h','pz','cap','qac'].forEach(function(k){ nr[k] = csNum(rm[k]); });
      nr.a = csNum(rm.w) * csNum(rm.l);
      nr.vent = rm.vent || null; nr.erv = rm.erv || null; nr.ac = rm.ac || null;
      /* the load tool used to keep a full copy of the conditions on every
         room; those become overrides so nothing silently changes value */
      if(rm.erv){
        nr.cond = {};
        if(isFinite(csNum(rm.erv.toa,  NaN))) nr.cond.oaPkT  = csNum(rm.erv.toa);
        if(isFinite(csNum(rm.erv.rhoa, NaN))) nr.cond.oaPkRh = csNum(rm.erv.rhoa);
        if(isFinite(csNum(rm.erv.tr,   NaN))) nr.cond.rT     = csNum(rm.erv.tr);
        if(isFinite(csNum(rm.erv.rhr,  NaN))) nr.cond.rRh    = csNum(rm.erv.rhr);
        if(isFinite(csNum(rm.erv.et,   NaN))) nr.cond.et     = csNum(rm.erv.et);
        if(isFinite(csNum(rm.erv.es,   NaN))) nr.cond.es     = csNum(rm.erv.es);
      }
      return nr;
    });
    if(!sc.rooms.length) sc.rooms = [ csNewRoom('ห้องที่ 1') ];
    np.scenarios = [ sc ];
    out.projects.push(np);
  });
  return out;
}

function csRead(){
  var db = null;
  try { db = JSON.parse(localStorage.getItem(CS_K2)); } catch(e){ db = null; }
  if(db && Array.isArray(db.projects)) return csHeal(db);
  var old = null;
  try { old = JSON.parse(localStorage.getItem(CS_K1)); } catch(e){ old = null; }
  if(old && Array.isArray(old.projects) && old.projects.length){
    var mig = csMigrate(old);
    csWrite(mig);
    return mig;
  }
  return { v:2, projects:[] };
}
/* fill in anything a hand-edited or older v2 file is missing, so no page has
   to guard every field it reads */
function csHeal(db){
  db.projects.forEach(function(p){
    if(!Array.isArray(p.scenarios) || !p.scenarios.length)
      p.scenarios = [ csNewScenario('ทางเลือกที่ 1') ];
    if(!p.createdAt) p.createdAt = new Date().toISOString();
    if(!p.updatedAt) p.updatedAt = p.createdAt;
    if(p.status == null) p.status = '';
    p.scenarios.forEach(function(s){
      var d = csNewScenario('x');
      ['oaPk','oaAv','room','erv','bill','crit'].forEach(function(g){
        if(!s[g]) s[g] = d[g];
        else Object.keys(d[g]).forEach(function(k){
          if(s[g][k] == null) s[g][k] = d[g][k]; });
      });
      if(!CS_SITES[s.site]) s.site = 'bkk';
      if(!s.roi) s.roi = {};
      if(!Array.isArray(s.rooms)) s.rooms = [];

      /* ── outdoor CO2 moved from the room up to the scenario ──
         It was typed into every room in the CO2 tool, which let one
         building hold several different outdoor concentrations without
         anything saying so - the same shape of error as the two tools
         once sizing at 38 °C and billing at 35 °C for one building.

         The lift takes the first room's figure as the building's, and any
         room that disagreed keeps its own as a VISIBLE override rather
         than being quietly changed. The room copy is deleted, so the
         field has exactly one owner from here on. */
      if(!s.co2){
        s.co2 = { oa:null };
        s.rooms.forEach(function(r){
          var k = r.vent && r.vent.keep;
          if(!k || k.co == null) return;
          var v = csNum(k.co, 400);
          delete k.co;
          if(s.co2.oa == null){ s.co2.oa = v; return; }
          if(Math.abs(v - s.co2.oa) > 1e-9){
            if(!r.cond) r.cond = {};
            if(r.cond.oaCo == null) r.cond.oaCo = v;
          }
        });
        if(s.co2.oa == null) s.co2.oa = 400;
      }

      s.rooms.forEach(function(r){
        /* one-time lift: the area used to be a width and a length */
        if(r.a == null && (r.w != null || r.l != null)){
          r.a = csNum(r.w) * csNum(r.l);
          delete r.w; delete r.l;
        }
        if(r.a == null) r.a = 0;
        if(r.qty == null || !(csNum(r.qty) >= 1)) r.qty = 1;
        if(!r.cat) r.cat = 'AC';
        if(r.tag == null) r.tag = '';
        ['level','system','zone'].forEach(function(k){ if(r[k] == null) r[k] = ''; });
        if(r.cap == null) r.cap = 0;
        if(r.qac == null) r.qac = 0;
      });
    });
  });
  return db;
}
function csWrite(db, flushNow){
  var ok = true;
  try { localStorage.setItem(CS_K2, JSON.stringify(db)); }
  catch(e){ ok = false; }
  /* a folder is the team arrangement and takes precedence over a single
     file, but both are mirrored if somebody has linked both */
  csDirSync(db, !!flushNow);
  csFileSync(db, !!flushNow);
  return ok;
}
function csTouch(p){ if(p) p.updatedAt = new Date().toISOString(); }

/* Locate one room. The scenario id is optional so a link written before
   scenarios existed still lands somewhere sensible. */
function csFind(db, pid, sid, rid){
  var hit = null;
  db.projects.forEach(function(p){
    if(p.id !== pid) return;
    p.scenarios.forEach(function(s){
      if(sid && s.id !== sid) return;
      s.rooms.forEach(function(r){ if(r.id === rid && !hit) hit = { p:p, s:s, r:r }; });
    });
  });
  if(!hit && sid){                       /* the room moved, or the link is old */
    db.projects.forEach(function(p){
      if(p.id !== pid) return;
      p.scenarios.forEach(function(s){
        s.rooms.forEach(function(r){ if(r.id === rid && !hit) hit = { p:p, s:s, r:r }; });
      });
    });
  }
  return hit;
}
function csFindScenario(db, pid, sid){
  var hit = null;
  db.projects.forEach(function(p){
    if(p.id !== pid) return;
    p.scenarios.forEach(function(s){
      if(!hit && (!sid || s.id === sid)) hit = { p:p, s:s };
    });
  });
  return hit;
}

/* ── what a scenario's rooms add up to ──
   Q'ty multiplies everything physical. It never multiplies CO2 or dB(A):
   twenty identical rooms are not louder than one, they are twenty rooms
   each at that level. */
function csRoll(scn){
  var r = { rows:0, rooms:0, area:0, people:0, cmh:0, rt:0, cap:0, acRows:0,
            done:{vent:0, erv:0, ac:0}, failCo2:0, failAc:0, noData:0,
            noCap:0, mv:0, worstCo2:null, worstDba:null };
  (scn.rooms || []).forEach(function(rm){
    var q = Math.max(1, csNum(rm.qty, 1));
    r.rows++; r.rooms += q;
    r.area   += csArea(rm)*q;
    r.people += csNum(rm.pz)*q;
    /* a ventilation-only room has no air conditioning, so neither its plant
       nor any load left on a previous pass belongs in these totals */
    var mv = rm.cat === 'MV';
    if(mv) r.mv++;
    else {
      r.acRows++;
      r.cap += csNum(rm.cap)*q;
      if(csNum(rm.cap) <= 0) r.noCap++;
    }
    if(rm.vent){
      r.done.vent++; r.cmh += csNum(rm.vent.q)*q;
      if(rm.vent.ok === false) r.failCo2 += q;
      var c = csNum(rm.vent.co2, NaN);
      if(isFinite(c) && (r.worstCo2 === null || c > r.worstCo2)) r.worstCo2 = c;
    }
    if(rm.erv && !mv){
      r.done.erv++; r.rt += csNum(rm.erv.rt)*q;
      if(rm.erv.ok === false) r.failAc += q;
    }
    if(rm.ac){
      r.done.ac++;
      var d = csNum(rm.ac.dba, NaN);
      if(isFinite(d) && (r.worstDba === null || d > r.worstDba)) r.worstDba = d;
    }
    if(!rm.vent && !rm.erv && !rm.ac) r.noData++;
  });
  return r;
}

/* ═══════════════════════════════════════════════════════════════════════
   THE LINKED FILE
   The registry lives in this browser. That is one machine, one browser,
   one profile, and it goes when site data is cleared - which is not a
   place to keep a job. Linking a file puts a copy somewhere that syncs
   and gets backed up: pick a file inside the company OneDrive folder and
   every save is written there too.

   This is a mirror, not a database. Two people editing the same file at
   once still ends with the later save winning; what it buys is that the
   work survives the machine, and that a colleague can open it.

   Chrome and Edge only - Firefox and Safari have no way to hold on to a
   file. Everywhere else the buttons say so and Export JSON still works.
   ═══════════════════════════════════════════════════════════════════════ */
var CS_DBN = 'coral-file', CS_STORE = 'handles', CS_HKEY = 'registry';
var csFileHandle = null;      /* resolved once per page */
var csFileName = '';
var csFileState = 'none';     /* none | linked | needsPermission | unsupported */
var csFileAt = null;          /* when the file was last written from here */
var csFileWatchers = [];

function csFileSupported(){
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}
function csFileInfo(){
  /* the folder is the arrangement to report when there is one */
  if(csDirState === 'linked' || csDirState === 'needsPermission'){
    var at = null;
    try { at = localStorage.getItem('coral.dir.at'); } catch(e){}
    return { kind:'dir', state:csDirState, name:csDirName, at:at,
             supported:csDirSupported() };
  }
  return { kind:'file', state:csFileState, name:csFileName, at:csFileAt,
           supported:csFileSupported() };
}
function csFileOn(fn){ csFileWatchers.push(fn); fn(csFileInfo()); }
function csFileTell(){
  var i = csFileInfo();
  csFileWatchers.forEach(function(fn){ try { fn(i); } catch(e){} });
}

/* a one-table IndexedDB, only because a file handle cannot go in localStorage */
function csIdb(){
  return new Promise(function(res, rej){
    var rq = indexedDB.open(CS_DBN, 1);
    rq.onupgradeneeded = function(){ rq.result.createObjectStore(CS_STORE); };
    rq.onsuccess = function(){ res(rq.result); };
    rq.onerror = function(){ rej(rq.error); };
  });
}
function csIdbGet(k){
  return csIdb().then(function(db){
    return new Promise(function(res, rej){
      var t = db.transaction(CS_STORE, 'readonly').objectStore(CS_STORE).get(k);
      t.onsuccess = function(){ res(t.result || null); };
      t.onerror = function(){ rej(t.error); };
    });
  }).catch(function(){ return null; });
}
function csIdbPut(k, v){
  return csIdb().then(function(db){
    return new Promise(function(res, rej){
      var st = db.transaction(CS_STORE, 'readwrite').objectStore(CS_STORE);
      var t = (v === null) ? st.delete(k) : st.put(v, k);
      t.onsuccess = function(){ res(true); };
      t.onerror = function(){ rej(t.error); };
    });
  }).catch(function(){ return false; });
}

/* Permission survives a reload only sometimes; when it does not, the user
   has to click once. Never ask without a click behind it - the browser
   refuses, and a refusal looks like a bug. */
function csFilePerm(handle, ask){
  if(!handle || !handle.queryPermission) return Promise.resolve('denied');
  var opt = { mode:'readwrite' };
  return handle.queryPermission(opt).then(function(p){
    if(p === 'granted') return 'granted';
    if(!ask) return p;
    return handle.requestPermission(opt);
  }).catch(function(){ return 'denied'; });
}

/* called once as a page starts */
function csFileInit(){
  return csDirInit().then(csFileInit1).then(function(){ csFileTell(); });
}
function csFileInit1(){
  if(!csFileSupported()){ csFileState = 'unsupported'; csFileTell(); return Promise.resolve(); }
  return csIdbGet(CS_HKEY).then(function(h){
    if(!h){ csFileState = 'none'; csFileTell(); return; }
    csFileHandle = h; csFileName = h.name || 'ไฟล์ที่เชื่อมไว้';
    try { csFileAt = localStorage.getItem('coral.file.at') || null; } catch(e){}
    return csFilePerm(h, false).then(function(p){
      csFileState = (p === 'granted') ? 'linked' : 'needsPermission';
      csFileTell();
    });
  });
}

/* Linking. Both paths need a click behind them. */
function csFileLinkNew(){
  return window.showSaveFilePicker({
    suggestedName: 'Coral-projects.json',
    types: [{ description:'Coral projects', accept:{ 'application/json':['.json'] } }]
  }).then(function(h){
    return csIdbPut(CS_HKEY, h).then(function(){
      csFileHandle = h; csFileName = h.name; csFileState = 'linked';
      csFileTell();
      return true;
    });
  });
}
function csFileLinkExisting(){
  return window.showOpenFilePicker({
    multiple: false,
    types: [{ description:'Coral projects', accept:{ 'application/json':['.json'] } }]
  }).then(function(list){
    var h = list[0];
    return csFilePerm(h, true).then(function(p){
      if(p !== 'granted') throw new Error('ไม่ได้รับสิทธิ์เขียนไฟล์');
      return csIdbPut(CS_HKEY, h).then(function(){
        csFileHandle = h; csFileName = h.name; csFileState = 'linked';
        csFileTell();
        return true;
      });
    });
  });
}
function csFileUnlink(){
  return csIdbPut(CS_HKEY, null).then(function(){
    csFileHandle = null; csFileName = ''; csFileState = 'none'; csFileAt = null;
    try { localStorage.removeItem('coral.file.at'); } catch(e){}
    csFileTell();
  });
}
function csFileGrant(){
  if(!csFileHandle) return Promise.resolve(false);
  return csFilePerm(csFileHandle, true).then(function(p){
    csFileState = (p === 'granted') ? 'linked' : 'needsPermission';
    csFileTell();
    return p === 'granted';
  });
}

function csFileRead(){
  if(!csFileHandle) return Promise.resolve(null);
  return csFileHandle.getFile()
    .then(function(f){ return f.text(); })
    .then(function(t){
      if(!t || !t.trim()) return null;
      var d = JSON.parse(t);
      var got = Array.isArray(d) ? d : (d && d.projects);
      if(!Array.isArray(got)) return null;
      return { projects: got, savedAt: (d && d.savedAt) ? d.savedAt : null };
    })
    .catch(function(){ return null; });
}

/* Writes are collapsed: typing saves on every keystroke, and one file
   write per keystroke would be both slow and pointless. */
var csFileTimer = null, csFilePending = null;
function csFileSync(db, now){
  if(csFileState !== 'linked' || !csFileHandle) return;
  csFilePending = db;
  if(csFileTimer){ clearTimeout(csFileTimer); csFileTimer = null; }
  if(now) return csFileFlush();
  csFileTimer = setTimeout(csFileFlush, 1200);
}
function csFileFlush(){
  csFileTimer = null;
  var db = csFilePending;
  if(!db || !csFileHandle) return Promise.resolve(false);
  var payload = { format:'coral.projects', v:2,
                  savedAt:new Date().toISOString(), projects:db.projects };
  return csFileHandle.createWritable()
    .then(function(w){
      return w.write(JSON.stringify(payload, null, 1)).then(function(){ return w.close(); });
    })
    .then(function(){
      csFileAt = payload.savedAt;
      try { localStorage.setItem('coral.file.at', csFileAt); } catch(e){}
      csFileState = 'linked'; csFileTell();
      return true;
    })
    .catch(function(){
      /* the usual cause is the permission lapsing after a browser restart */
      csFileState = 'needsPermission'; csFileTell();
      return false;
    });
}

/* ═══════════════════════════════════════════════════════════════════════
   THE LINKED FOLDER — one file per project
   For a shared team folder on SharePoint or OneDrive. One file holding
   everything is the wrong shape there: two people saving at the same
   moment leaves the sync client to invent a conflict copy, and it does
   that for the whole registry even when the two were working on entirely
   different jobs.

   A file per project narrows that to the case where two people really
   are in the same project, and the folder stays readable in the browser -
   a job is a file with the job's name on it. Only projects that actually
   changed are rewritten, so a save touches one small file.

   Conflict copies can still appear. They are found on load by project id,
   the newest kept, and the rest reported rather than silently dropped.
   ═══════════════════════════════════════════════════════════════════════ */
var CS_DKEY = 'folder';
var csDirHandle = null, csDirName = '', csDirState = 'none';
var csDirSeen = {};        /* project id → the text last read from or written to disk */
var csDirNames = {};       /* project id → the file it lives in */

function csDirInfo(){
  return { state:csDirState, name:csDirName, supported:csDirSupported() };
}
function csDirSupported(){
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/* A file name a person can find in SharePoint, with the id kept on the end
   so a rename never orphans the project it belongs to. */
function csSafe(s){
  /* the characters a Windows or SharePoint file name cannot carry.
     A literal dash inside a class is a range waiting to happen, so it is
     not in here at all - a dash in a file name is harmless. */
  return String(s || 'โปรเจค')
    .replace(/[\\/:*?"<>|#%{}~]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 60) || 'โปรเจค';
}
function csDirFileName(p){ return csSafe(p.name) + '__' + p.id + '.json'; }
function csDirIdOf(fn){
  var m = /__([A-Za-z0-9_-]+)\.json$/.exec(fn);
  return m ? m[1] : null;
}

function csDirInit(){
  if(!csDirSupported()){ csDirState = 'unsupported'; return Promise.resolve(); }
  return csIdbGet(CS_DKEY).then(function(h){
    if(!h){ csDirState = 'none'; return; }
    csDirHandle = h; csDirName = h.name || 'โฟลเดอร์ที่เชื่อมไว้';
    return csFilePerm(h, false).then(function(p){
      csDirState = (p === 'granted') ? 'linked' : 'needsPermission';
    });
  });
}
function csDirLink(){
  return window.showDirectoryPicker({ mode:'readwrite' }).then(function(h){
    return csFilePerm(h, true).then(function(p){
      if(p !== 'granted') throw new Error('ไม่ได้รับสิทธิ์เขียนโฟลเดอร์');
      return csIdbPut(CS_DKEY, h).then(function(){
        csDirHandle = h; csDirName = h.name; csDirState = 'linked';
        csDirSeen = {}; csDirNames = {};
        return true;
      });
    });
  });
}
function csDirUnlink(){
  return csIdbPut(CS_DKEY, null).then(function(){
    csDirHandle = null; csDirName = ''; csDirState = 'none';
    csDirSeen = {}; csDirNames = {};
  });
}
function csDirGrant(){
  if(!csDirHandle) return Promise.resolve(false);
  return csFilePerm(csDirHandle, true).then(function(p){
    csDirState = (p === 'granted') ? 'linked' : 'needsPermission';
    return p === 'granted';
  });
}

/* Read every project file in the folder.
   Two files can claim the same project when the sync client has made a
   conflict copy; the newer savedAt wins and the loser is reported. */
function csDirRead(){
  if(!csDirHandle) return Promise.resolve(null);
  var out = [], dupes = [], bad = [], byId = {};
  return (function(){
    var it = csDirHandle.values(), chain = Promise.resolve();
    var acc = [];
    function step(){
      return it.next().then(function(r){
        if(r.done) return acc;
        var e = r.value;
        if(e.kind === 'file' && /\.json$/i.test(e.name)) acc.push(e);
        return step();
      });
    }
    return step();
  })().then(function(entries){
    return entries.reduce(function(chain, e){
      return chain.then(function(){
        return e.getFile().then(function(f){ return f.text(); }).then(function(t){
          var d = JSON.parse(t);
          var p = d && d.project ? d.project : null;
          if(!p || !p.id) throw new Error('ไม่ใช่ไฟล์โปรเจค');
          p.__savedAt = (d.savedAt || '');
          p.__file = e.name;
          p.__text = t;
          var prev = byId[p.id];
          if(prev){
            var keep = (p.__savedAt > prev.__savedAt) ? p : prev;
            var drop = (keep === p) ? prev : p;
            dupes.push({ id:p.id, name:p.name, kept:keep.__file, other:drop.__file });
            byId[p.id] = keep;
          } else { byId[p.id] = p; }
        }).catch(function(){ bad.push(e.name); });
      });
    }, Promise.resolve());
  }).then(function(){
    Object.keys(byId).forEach(function(k){ out.push(byId[k]); });
    return { projects:out, dupes:dupes, bad:bad };
  }).catch(function(){ return null; });
}

/* Load the folder into the registry, remembering what each file held so a
   later save can tell which projects actually changed. */
function csDirAdopt(got){
  csDirSeen = {}; csDirNames = {};
  var projects = got.projects.map(function(p){
    csDirNames[p.id] = p.__file;
    var clean = JSON.parse(JSON.stringify(p));
    delete clean.__savedAt; delete clean.__file; delete clean.__text;
    csDirSeen[p.id] = JSON.stringify(clean);
    return clean;
  });
  return csHeal({ v:2, projects: projects });
}

/* Write the projects whose content has moved since the folder was last
   read or written, and remove files for projects that are gone. */
var csDirTimer = null, csDirPending = null;
function csDirSync(db, now){
  if(csDirState !== 'linked' || !csDirHandle) return;
  csDirPending = db;
  if(csDirTimer){ clearTimeout(csDirTimer); csDirTimer = null; }
  if(now) return csDirFlush();
  csDirTimer = setTimeout(csDirFlush, 1200);
}
function csDirFlush(){
  csDirTimer = null;
  var db = csDirPending;
  if(!db || !csDirHandle) return Promise.resolve(false);
  var live = {};
  var jobs = db.projects.map(function(p){
    live[p.id] = true;
    var text = JSON.stringify(p);
    if(csDirSeen[p.id] === text) return null;      /* untouched */
    var want = csDirFileName(p), had = csDirNames[p.id];
    var payload = { format:'coral.project', v:2,
                    savedAt:new Date().toISOString(), project:p };
    return function(){
      return csDirHandle.getFileHandle(want, { create:true })
        .then(function(fh){ return fh.createWritable(); })
        .then(function(w){
          return w.write(JSON.stringify(payload, null, 1)).then(function(){ return w.close(); });
        })
        .then(function(){
          csDirSeen[p.id] = text;
          csDirNames[p.id] = want;
          /* the project was renamed, so the old file should not linger */
          if(had && had !== want)
            return csDirHandle.removeEntry(had).catch(function(){});
        });
    };
  }).filter(Boolean);

  /* projects deleted here should go from the folder too */
  Object.keys(csDirNames).forEach(function(id){
    if(live[id]) return;
    var fn = csDirNames[id];
    jobs.push(function(){
      return csDirHandle.removeEntry(fn)
        .then(function(){ delete csDirNames[id]; delete csDirSeen[id]; })
        .catch(function(){});
    });
  });

  if(!jobs.length){ csDirState = 'linked'; csFileTell(); csBackupDaily(db); return Promise.resolve(true); }
  return jobs.reduce(function(c, j){ return c.then(j); }, Promise.resolve())
    .then(function(){
      csDirState = 'linked';
      try { localStorage.setItem('coral.dir.at', new Date().toISOString()); } catch(e){}
      csFileTell();
      csBackupDaily(db);
      return true;
    })
    .catch(function(){
      csDirState = 'needsPermission'; csFileTell();
      return false;
    });
}

/* ═══════════════════════════════════════════════════════════════════════
   SNAPSHOTS, IN THE TEAM FOLDER

   Backing up used to mean remembering to press a button, and the file
   landed in whatever the browser calls its download folder - somewhere
   nobody else can see and the person themselves forgets. So the same
   payload goes into _backup/ beside the projects instead: once on the
   first folder write of a day, and again whenever somebody asks for one.

   The project files are a MIRROR - delete a project in the tool and its
   file goes too. These snapshots are the part that remembers yesterday.

   One file per day, and pressing the button again just rewrites today's.
   A file per press piles up for no gain: what a backup has to give back is
   YESTERDAY, and the last state of today. Keeping 09:14 as well as 15:42 of
   the same day only makes the folder harder to look at.

   Pruning only ever touches files inside _backup whose names this code
   wrote. Anything else in there belongs to a person and is not ours to
   remove. A failed snapshot is never allowed to fail the save it rode in
   on, because losing today's work to protect last week's would be absurd.
   ═══════════════════════════════════════════════════════════════════════ */
var CS_BDIR = '_backup';
/* the -hhmm tail is gone · still matched so files written by the first
   version of this get swept up by the same pruning */
var CS_BPAT = /^coral-backup-(\d{4}-\d{2}-\d{2})(?:-\d{4})?\.json$/;
var CS_BKEEP = 30;                 /* days */

function csPad(n, w){ var s = String(n); while(s.length < w) s = '0' + s; return s; }
function csBackupName(d){
  return 'coral-backup-' + d.getFullYear() + '-' + csPad(d.getMonth() + 1, 2)
    + '-' + csPad(d.getDate(), 2) + '.json';
}
function csBackupAt(){
  try { return localStorage.getItem('coral.backup.at') || ''; } catch(e){ return ''; }
}
function csDirBackup(db, why){
  if(csDirState !== 'linked' || !csDirHandle)
    return Promise.reject(new Error('ยังไม่ได้เชื่อมโฟลเดอร์ทีม'));
  var now = new Date(), name = csBackupName(now), dir = null;
  var payload = { format:'coral.projects', v:2, savedAt:now.toISOString(),
                  why: why || '', projects: db.projects };
  return csDirHandle.getDirectoryHandle(CS_BDIR, { create:true })
    .then(function(d){ dir = d; return d.getFileHandle(name, { create:true }); })
    .then(function(fh){ return fh.createWritable(); })
    .then(function(w){
      return w.write(JSON.stringify(payload, null, 1)).then(function(){ return w.close(); });
    })
    .then(function(){
      try { localStorage.setItem('coral.backup.at', now.toISOString()); } catch(e){}
      return csDirPrune(dir, now);
    })
    .then(function(gone){ return { name:name, pruned:gone }; });
}
/* only files inside _backup that match the name this code writes */
function csDirPrune(dir, now){
  var cutoff = now.getTime() - CS_BKEEP * 86400000, doomed = [];
  var it = dir.values();
  function step(){
    return it.next().then(function(r){
      if(r.done) return;
      var e = r.value;
      if(e.kind === 'file'){
        var m = CS_BPAT.exec(e.name);
        if(m && new Date(m[1] + 'T00:00:00').getTime() < cutoff) doomed.push(e.name);
      }
      return step();
    });
  }
  return step().then(function(){
    return doomed.reduce(function(c, n){
      return c.then(function(){ return dir.removeEntry(n).catch(function(){}); });
    }, Promise.resolve());
  }).then(function(){ return doomed.length; });
}
/* the first folder write of a day leaves one behind · quiet either way */
function csBackupDaily(db){
  if(!db || csDirState !== 'linked') return;
  var today = new Date().toISOString().slice(0, 10);
  if(csBackupAt().slice(0, 10) === today) return;
  csDirBackup(db, 'อัตโนมัติ · ครั้งแรกของวัน').catch(function(){});
}
/* ═══════════════════════════════════════════════════════════════════════
   KEEP LISTS — one declaration, both directions

   Every tool saves back to its room on every render. That is what makes
   the work impossible to lose, and it is also what makes an incomplete
   restore dangerous: merely OPENING a room then recomputes it from
   whatever the page defaulted to and writes that over the real answer.
   Nobody touches anything and a number changes. That happened.

   The cure is to stop maintaining two lists. A tool declares once what it
   keeps; csKeepGet reads those out of the page and csKeepSet puts them
   back. There is no second place to forget.

   An entry is either an element id, or { k, get, set } for state that does
   not live in an input — a segmented button, a mode flag, an array.

   csKeepAudit is the other half: it walks every input and select on the
   page and reports anything in neither the keep list nor the explicit skip
   list. A field added later cannot quietly go missing; it has to be named
   in one list or the other. Open any tool with ?audit=1 to see the result
   on the page rather than only in the console. */
function csKeepGet(list){
  var o = {};
  list.forEach(function(f){
    if(typeof f === 'string'){
      var el = document.getElementById(f);
      if(el) o[f] = el.value;
    } else if(f && f.k){
      try { o[f.k] = f.get(); } catch(e){}
    }
  });
  return o;
}
function csKeepSet(list, o){
  if(!o) return;
  list.forEach(function(f){
    if(typeof f === 'string'){
      if(o[f] === undefined || o[f] === null) return;
      var el = document.getElementById(f);
      if(!el) return;
      /* widen a range before writing, or a large value is clamped away */
      if(el.type === 'range'){
        var v = parseFloat(o[f]);
        if(isFinite(v) && v > parseFloat(el.max)) el.max = v;
      }
      el.value = o[f];
    } else if(f && f.k){
      if(o[f.k] === undefined) return;
      try { f.set(o[f.k]); } catch(e){}
    }
  });
}
function csKeepNames(list){
  return list.map(function(f){ return (typeof f === 'string') ? f : f.k; });
}
function csKeepAudit(list, skip, label, barId){
  var covered = {};
  csKeepNames(list).forEach(function(k){ covered[k] = 1; });
  /* a custom entry may read several elements, or one whose id differs from
     the key it is stored under; ids says which so the audit can see them */
  list.forEach(function(f){
    if(f && f.ids) f.ids.forEach(function(k){ covered[k] = 1; }); });
  (skip || []).forEach(function(k){ covered[k] = 1; });
  var missing = [];
  document.querySelectorAll('input, select').forEach(function(el){
    if(!el.id || el.type === 'file') return;
    if(!covered[el.id]) missing.push(el.id);
  });
  if(missing.length){
    try { console.warn('[' + label + '] ช่องที่ไม่ได้เก็บและไม่ได้ประกาศว่าไม่เก็บ: '
                       + missing.join(', ')); } catch(e){}
  }
  if(new URLSearchParams(location.search).get('audit') === '1'){
    /* deferred, because every page renders after boot and would otherwise
       overwrite whichever element this writes into */
    setTimeout(function(){
      var bar = document.getElementById(barId || 'hubBar');
      if(!bar) return;
      bar.hidden = false;
      bar.innerHTML = '<b>ตรวจความครบของการเก็บค่า · ' + label + '</b> · '
        + 'เก็บ ' + csKeepNames(list).length + ' · ประกาศไม่เก็บ ' + (skip||[]).length + ' · '
        + (missing.length
            ? '<span style="color:#B4291F">ยังไม่ครอบคลุม ' + missing.length + ' ช่อง: '
              + missing.join(', ') + '</span>'
            : '<span style="color:#2E7D32">ครบทุกช่อง</span>');
    }, 60);
  }
  return missing;
}
/* ═══ end CORAL PROJECT STORE v2 ═══ */
