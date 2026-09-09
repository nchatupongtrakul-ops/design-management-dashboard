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

  if(!jobs.length){ csDirState = 'linked'; csFileTell(); return Promise.resolve(true); }
  return jobs.reduce(function(c, j){ return c.then(j); }, Promise.resolve())
    .then(function(){
      csDirState = 'linked';
      try { localStorage.setItem('coral.dir.at', new Date().toISOString()); } catch(e){}
      csFileTell();
      return true;
    })
    .catch(function(){
      csDirState = 'needsPermission'; csFileTell();
      return false;
    });
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
