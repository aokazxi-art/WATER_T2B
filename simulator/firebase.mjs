// ============================================================
//  simulator/firebase.mjs
//  จำลอง sensor ส่งข้อมูลเข้า Firestore โดยตรง
//  รัน: node simulator/firebase.mjs
// ============================================================

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, collection, setDoc, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyASAWkCGV7Vjg38mBP1w7N0WHlErRf87nw",
  authDomain: "gen-lang-client-0103823618.firebaseapp.com",
  projectId: "gen-lang-client-0103823618",
  storageBucket: "gen-lang-client-0103823618.firebasestorage.app",
  messagingSenderId: "459966832920",
  appId: "1:459966832920:web:7598c6ba6507a6f969be6d"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const INTERVAL_MS = 10000; // ส่งทุก 10 วินาที

// ────────────────────────────────────────────────────────────
//  config แต่ละบ่อ: depth (cm), raw_cm เริ่มต้น, battery (%)
// ────────────────────────────────────────────────────────────

const PONDS = [
  { id: 1, depth: 100, rawCm: 120, battery: 85 },
  { id: 2, depth: 120, rawCm: 102, battery: 72 },
  { id: 3, depth: 200, rawCm:  86, battery: 91 },
  { id: 4, depth: 180, rawCm:  52, battery: 60 },
];

// ────────────────────────────────────────────────────────────
//  helpers
// ────────────────────────────────────────────────────────────

/** drift ค่า raw_cm ±2 cm ต่อรอบ เพื่อจำลองน้ำขึ้น-ลง */
function drift(current, min, max) {
  const delta = (Math.random() - 0.5) * 4;
  return Math.min(max, Math.max(min, current + delta));
}

function dayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ────────────────────────────────────────────────────────────
//  ส่งข้อมูลหนึ่งรอบ
// ────────────────────────────────────────────────────────────

async function sendReading(pond) {
  const timestamp = Date.now();
  const rawCm     = Math.round(pond.rawCm * 10) / 10;
  const battery   = Math.round(pond.battery * 10) / 10;
  const dateKey   = dayStr();
  const waterPct  = ((pond.depth + 30 - rawCm) / pond.depth * 100).toFixed(1);

  const reading = { raw_cm: rawCm, timestamp, battery };

  // 1. อัปเดตค่าปัจจุบันใน collection "ponds" (merge เพื่อไม่ลบ config)
  await setDoc(
    doc(db, 'ponds', `pond_${pond.id}`),
    { last_reading: reading },
    { merge: true }
  );

  // 2. บันทึกประวัติใน collection "history/{pondId}/readings"
  await addDoc(
    collection(db, 'history', `pond_${pond.id}`, 'readings'),
    { ...reading, date: dateKey, pct: parseFloat(waterPct) }
  );

  console.log(
    `[pond_${pond.id}]  raw_cm=${rawCm.toFixed(1)}` +
    `  water=${waterPct}%` +
    `  battery=${battery.toFixed(1)}%  → OK`
  );
}

// ────────────────────────────────────────────────────────────
//  main loop
// ────────────────────────────────────────────────────────────

async function loop() {
  console.log(`🚀 Firestore simulator started — sending every ${INTERVAL_MS / 1000}s (Ctrl+C to stop)\n`);

  while (true) {
    for (const pond of PONDS) {
      await sendReading(pond);
      pond.rawCm   = drift(pond.rawCm, 30, pond.depth + 30);
      pond.battery = Math.max(0, pond.battery - 0.1);
    }
    console.log('---');
    await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
  }
}

loop();
