# Handover — เครื่องมือวิศวกรรม IAQ · Acoustic · ERV

> **เอกสารฉบับเต็มย้ายออกจาก repo นี้แล้ว** (9 ก.ย. 2569)
> repo นี้เป็น public แต่เอกสารมีชื่อโครงการลูกค้าและผลตรวจไฟล์ภายในของทีม
> จึงย้ายไปเก็บใน OneDrive ของบริษัท พร้อมกับข้อมูลโปรเจคจริง

---

## เอกสารฉบับเต็มอยู่ที่

ใน OneDrive ของบริษัท ไล่ตามโฟลเดอร์นี้

```
OneDrive - Coral Life
  └ Coral Life - BA - Solution Design
     └ 1_Non-Project
        └ 7_Engineer
           └ IAQ Solution
              └ 0_ERV Management
                 └ 1_Design Management
                    └ Project Data      ←  HANDOVER.md อยู่ที่นี่
```

โฟลเดอร์เดียวกันนี้เป็น **ที่เก็บข้อมูลจริง** ของเครื่องมือด้วย (ไฟล์โปรเจค `.json`)
และมี `CLAUDE.md` อธิบายโครงสร้างไว้ · ถ้าเข้า OneDrive ของบริษัทไม่ได้ ให้ถามคนในทีม

---

## สรุปสั้นสำหรับคนที่ clone repo นี้มา

**เครื่องมือชุด IAQ / ERV อยู่ในโฟลเดอร์ย่อยของ repo นี้** ไม่ใช่ที่ root

| โฟลเดอร์ | คืออะไร |
|---|---|
| `hub/` | Project Hub — ทะเบียนกลาง โปรเจค → ทางเลือกออกแบบ → ห้อง |
| `ventilation/` | Ventilation & CO₂ Calculator |
| `ervload/` | ERV Load Impact Calculator |
| `acoustic/` | Noise Breakout Calculator |
| `ervroi/` | ERV Energy Saving Calculator |
| `guide/` | คู่มือการใช้งาน |
| `_src/` | **โค้ดที่ใช้ร่วมกัน — แก้ที่นี่ที่เดียว** |
| root (`index.html`, `data.json`, ...) | **Design Management Dashboard ของอีกทีม · ห้ามแก้** |

### กติกาสามข้อที่พังบ่อยที่สุดถ้าไม่รู้

1. **`_src/store.js` ถูกฝังซ้ำอยู่ใน 5 หน้า** — แก้ที่ `_src/` แล้วรัน
   `python _src/sync_store.py .` · **ห้ามแก้บล็อก store ในไฟล์ใดไฟล์หนึ่งโดยตรง**
2. **ห้ามแตะ root ของ repo** เป็น dashboard ของทีม Design คนละงานกัน
   และมี commit `Update dashboard data` เข้ามาอัตโนมัติ → **`git pull` ก่อน push ทุกครั้ง**
3. **ทดสอบด้วย HTTP เสมอ** (`python -m http.server`) อย่าเปิดแบบ `file://`
   ทะเบียนกลางผูกกับ origin ถ้าเปิดเป็นไฟล์ แต่ละหน้าจะมองไม่เห็นข้อมูลกัน

### ลิงก์

| | |
|---|---|
| เครื่องมือทั้งหมด | <https://nchatupongtrakul-ops.github.io/erv-team-portal/> |
| คู่มือการใช้งาน | <https://nchatupongtrakul-ops.github.io/design-management-dashboard/guide/> |
| Project Hub | <https://nchatupongtrakul-ops.github.io/design-management-dashboard/hub/> |

---

*รายละเอียดทั้งหมด — ที่มาของทุกสมการ · โครงข้อมูล · ผลตรวจไฟล์ของทีม · งานที่ค้าง
· ค่าที่เคยผิดและแก้แล้ว — อยู่ในเอกสารฉบับเต็มตาม path ข้างบน*
