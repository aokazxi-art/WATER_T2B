// จำลอง sensor ส่งข้อมูลเข้า Firebase ทุก 5 วินาที
// รัน: node simulate.mjs

const BASE_URL = 'https://gen-lang-client-0103823618-default-rtdb.asia-southeast1.firebasedatabase.app/ponds';

// config แต่ละบ่อ: depth (cm), raw_cm เริ่มต้น
const PONDS = [
  { id: 1, depth: 100, rawCm: 100,  battery: 85 },
  { id: 2, depth: 120, rawCm: 102, battery: 72 },
  { id: 3, depth: 200, rawCm: 86,  battery: 91 },
  { id: 4, depth: 180, rawCm: 52,  battery: 60 },
];

// drift ค่า raw_cm ±2 cm ต่อรอบ (จำลองน้ำขึ้น-ลง)
function drift(current, min, max) {
  const delta = (Math.random() - 0.5) * 4;
  return Math.min(max, Math.max(min, current + delta));
}

async function sendReading(pond) {
  const body = JSON.stringify({
    raw_cm: Math.round(pond.rawCm * 10) / 10,
    timestamp: Date.now(),
    battery: pond.battery,
  });

  const res = await fetch(`${BASE_URL}/pond_${pond.id}/last_reading.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const pct = ((pond.depth + 30 - pond.rawCm) / pond.depth * 100).toFixed(1);
  console.log(`[pond_${pond.id}] raw_cm=${pond.rawCm.toFixed(1)}  water=${pct}%  battery=${pond.battery.toFixed(1)}%  → ${res.ok ? 'OK' : 'ERROR'}`);
}

async function loop() {
  console.log('Simulator started — sending every 60s (Ctrl+C to stop)\n');
  while (true) {
    for (const pond of PONDS) {
      await sendReading(pond);
      pond.rawCm = drift(pond.rawCm, 30, pond.depth + 30);
      pond.battery = Math.max(0, pond.battery - 0.1);
    }
    console.log('---');
    await new Promise(r => setTimeout(r, 10000));
  }
}

loop();
