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
    oaPk: { t:35, rh:60 },     /* design · sizing */
    oaAv: { t:31, rh:70 },     /* annual average · energy */
    room: { t:25, rh:50 },     /* indoor */
    erv:  { et:67, es:70 },    /* core effectiveness, total and sensible, % */
    bill: { rate:4.15, hpd:10, dpy:300, cop:3.2 },
    roi:  {},                  /* the rest of ERV Energy Saving's own inputs */
    rooms: [ csNewRoom('ห้องที่ 1') ]
  };
}
function csNewRoom(name){
  return {
    id: csUid(), name: name || 'ห้อง', tag: '',
    level: '', system: '', zone: '',
    w: 8, l: 10, h: 2.8, pz: 20,
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
function csCond(scn, rm){
  var c = {
    oaPkT: csNum(scn.oaPk.t,35), oaPkRh: csNum(scn.oaPk.rh,60),
    oaAvT: csNum(scn.oaAv.t,31), oaAvRh: csNum(scn.oaAv.rh,70),
    rT: csNum(scn.room.t,25),    rRh: csNum(scn.room.rh,50),
    et: csNum(scn.erv.et,67),    es: csNum(scn.erv.es,70),
    over: []
  };
  var o = rm && rm.cond;
  if(o){
    ['oaPkT','oaPkRh','rT','rRh','et','es'].forEach(function(k){
      if(o[k] != null && isFinite(o[k]) && Math.abs(o[k] - c[k]) > 1e-9){
        c[k] = +o[k]; c.over.push(k);
      }
    });
  }
  return c;
}
var CS_COND_TH = { oaPkT:'อุณหภูมิภายนอก', oaPkRh:'ความชื้นภายนอก',
                   rT:'อุณหภูมิห้อง', rRh:'ความชื้นห้อง',
                   et:'ประสิทธิภาพรวม ηt', es:'ประสิทธิภาพสัมผัส ηs' };

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
    sc.rooms = (p.rooms || []).map(function(rm){
      var nr = csNewRoom(rm.name);
      nr.id = rm.id;
      ['w','l','h','pz','cap','qac'].forEach(function(k){ nr[k] = csNum(rm[k]); });
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
      ['oaPk','oaAv','room','erv','bill'].forEach(function(g){
        if(!s[g]) s[g] = d[g];
        else Object.keys(d[g]).forEach(function(k){
          if(s[g][k] == null) s[g][k] = d[g][k]; });
      });
      if(!s.roi) s.roi = {};
      if(!Array.isArray(s.rooms)) s.rooms = [];
      s.rooms.forEach(function(r){
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
function csWrite(db){
  try { localStorage.setItem(CS_K2, JSON.stringify(db)); return true; }
  catch(e){ return false; }
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
    r.area   += csNum(rm.w)*csNum(rm.l)*q;
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
/* ═══ end CORAL PROJECT STORE v2 ═══ */
