// ============================================================
//  simulator/firebase.mjs
//  จำลอง sensor ส่งข้อมูลเข้า Firebase Realtime Database โดยตรง
//  รัน: node simulator/firebase.mjs
// ============================================================

const FIREBASE_URL = "https://gen-lang-client-0103823618-default-rtdb.asia-southeast1.firebasedatabase.app/ponds";

const INTERVAL_MS  = 10000; // ส่งทุก 10 วินาที

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
//  ฟังก์ชัน simulate
// ────────────────────────────────────────────────────────────

/** drift ค่า raw_cm ±2 cm ต่อรอบ เพื่อจำลองน้ำขึ้น-ลง */
function drift(current, min, max) {
  const delta = (Math.random() - 0.5) * 4;
  return Math.min(max, Math.max(min, current + delta));
}

/** ส่งข้อมูลบ่อหนึ่งเข้า Firebase */
async function sendReading(pond) {
  const body = JSON.stringify({
    raw_cm:    Math.round(pond.rawCm * 10) / 10,
    timestamp: Date.now(),
    battery:   pond.battery,
  });

  const res = await fetch(`${FIREBASE_URL}/pond_${pond.id}/last_reading.json`, {
    method:  "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const waterPct = ((pond.depth + 30 - pond.rawCm) / pond.depth * 100).toFixed(1);
  console.log(
    `[pond_${pond.id}]  raw_cm=${pond.rawCm.toFixed(1)}` +
    `  water=${waterPct}%` +
    `  battery=${pond.battery.toFixed(1)}%` +
    `  → ${res.ok ? "OK" : "ERROR"}`
  );
}

/** วนลูปส่งข้อมูลทุก INTERVAL_MS */
async function loop() {
  console.log(`🚀 Firebase simulator started — sending every ${INTERVAL_MS / 1000}s (Ctrl+C to stop)\n`);

  while (true) {
    for (const pond of PONDS) {
      await sendReading(pond);
      pond.rawCm   = drift(pond.rawCm, 30, pond.depth + 30);
      pond.battery = Math.max(0, pond.battery - 0.1);
    }
    console.log("---");
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

loop();
