// bridge.mjs — ChirpStack MQTT → Firebase bridge
// รัน: node bridge.mjs
// ต้องมี bridge-config.json ในโฟลเดอร์เดียวกัน (คัดลอกจาก bridge-config.example.json)

import mqtt from 'mqtt';
import { readFileSync } from 'fs';

// ─── Config ───────────────────────────────────────────────────────────────────

let CONFIG;
try {
  CONFIG = JSON.parse(readFileSync('./bridge-config.json', 'utf8'));
} catch {
  console.error('❌ ไม่พบ bridge-config.json');
  console.error('   คัดลอกจาก bridge-config.example.json แล้วใส่ข้อมูลจริง');
  process.exit(1);
}

const FIREBASE_URL = CONFIG.firebase.databaseURL.replace(/\/$/, '');

// ─── Device map: devEUI (lowercase, no colon) → pondId ───────────────────────

let deviceMap = {};

async function refreshDeviceMap() {
  try {
    const res  = await fetch(`${FIREBASE_URL}/pond_registry.json`);
    const data = await res.json();
    if (data && typeof data === 'object') {
      const map = {};
      for (const pond of Object.values(data)) {
        if (pond.deviceId && pond.id != null) {
          map[pond.deviceId.toLowerCase().replace(/:/g, '')] = pond.id;
        }
      }
      deviceMap = map;
      const entries = Object.entries(map).map(([k, v]) => `${k}→pond_${v}`).join(', ');
      console.log(`[map] ${entries || '(ว่าง — ตั้งค่า Device EUI ในแอปก่อน)'}`);
    }
  } catch (err) {
    console.error('[map] refresh error:', err.message);
  }
}

// ─── Firebase write ───────────────────────────────────────────────────────────

async function writeReading(pondId, raw_cm, battery) {
  const body = JSON.stringify({
    raw_cm:    Math.round(raw_cm * 10) / 10,
    timestamp: Date.now(),
    battery:   battery ?? null,
  });
  const res = await fetch(`${FIREBASE_URL}/ponds/pond_${pondId}/last_reading.json`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`Firebase PUT ${res.status}`);
}

// ─── Milesight EM500-UDL TLV decoder ─────────────────────────────────────────
//
// Milesight protocol v2 (TLV):
//   FF 0B <uint8>        → battery %
//   01 82 <uint16 LE>    → distance mm (with type byte 0x82)
//   01 <uint16 LE>       → distance mm (compact, without type byte)
//
// ตัวอย่าง: "01 4C 02" → channel=01, value=0x024C=588mm → 58.8 cm

function decodeMilesightEM500UDL(base64Payload) {
  const buf = Buffer.from(base64Payload, 'base64');
  let distance_mm = null;
  let battery     = null;

  let i = 0;
  while (i < buf.length) {
    const ch = buf[i];

    // Battery: FF 0B <uint8>
    if (ch === 0xFF && i + 2 < buf.length && buf[i + 1] === 0x0B) {
      battery = buf[i + 2];
      i += 3;
      continue;
    }

    // Distance with type byte: 01 82 <uint16 LE>
    if (ch === 0x01 && i + 3 < buf.length && buf[i + 1] === 0x82) {
      distance_mm = buf.readUInt16LE(i + 2);
      i += 4;
      continue;
    }

    // Distance compact (ไม่มี type byte): 01 <uint16 LE>
    if (ch === 0x01 && i + 2 < buf.length) {
      distance_mm = buf.readUInt16LE(i + 1);
      i += 3;
      continue;
    }

    i++;
  }

  return { distance_mm, battery };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const { host, port = 1883, username, password, appId } = CONFIG.mqtt;

console.log(`ChirpStack → Firebase bridge`);
console.log(`  MQTT   : ${host}:${port}  App: ${appId}`);
console.log(`  Firebase: ${FIREBASE_URL}\n`);

await refreshDeviceMap();
setInterval(refreshDeviceMap, 60_000);

const client = mqtt.connect(`mqtt://${host}:${port}`, {
  username:        username || undefined,
  password:        password || undefined,
  reconnectPeriod: 5000,
});

const upTopic = `application/${appId}/device/+/event/up`;

client.on('connect', () => {
  console.log(`✅ Connected to ${host}:${port}`);
  client.subscribe(upTopic, err => {
    if (err) console.error('Subscribe error:', err.message);
    else     console.log(`📡 Subscribed: ${upTopic}\n`);
  });
});

client.on('error',     err => console.error('MQTT error:', err.message));
client.on('reconnect', ()  => console.log('⏳ Reconnecting...'));

client.on('message', async (_topic, message) => {
  try {
    const msg = JSON.parse(message.toString());

    // ChirpStack v3 → msg.devEUI  |  ChirpStack v4 → msg.deviceInfo.devEui
    const rawEUI       = msg.devEUI ?? msg.deviceInfo?.devEui ?? '';
    const devEUI       = rawEUI.toLowerCase().replace(/:/g, '');
    const base64Payload = msg.data;

    if (!devEUI || !base64Payload) return;

    const pondId = deviceMap[devEUI];
    if (pondId == null) {
      console.log(`[skip] devEUI ${devEUI} ไม่ตรงกับ sensor ใดในระบบ`);
      return;
    }

    const { distance_mm, battery } = decodeMilesightEM500UDL(base64Payload);
    if (distance_mm === null) {
      console.warn(`[warn] decode ไม่ได้ devEUI=${devEUI} payload=${base64Payload}`);
      return;
    }

    const raw_cm = distance_mm / 10;
    const ts     = new Date().toLocaleTimeString('th-TH');
    console.log(`[${ts}] pond_${pondId}  devEUI=${devEUI}  dist=${raw_cm.toFixed(1)}cm  battery=${battery ?? '?'}%`);
    await writeReading(pondId, raw_cm, battery);

  } catch (err) {
    console.error('[error]', err.message);
  }
});
