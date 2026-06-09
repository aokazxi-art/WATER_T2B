// ============================================================
//  server/webhook.mjs
//  รับ uplink event จาก ChirpStack webhook → เขียนเข้า Firebase
//  รัน: node server/webhook.mjs
// ============================================================

import express              from "express";
import { initializeApp }    from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

// ────────────────────────────────────────────────────────────
//  Firebase config
// ────────────────────────────────────────────────────────────

const firebaseConfig = {
  databaseURL: "https://gen-lang-client-0103823618-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const firebaseApp = initializeApp(firebaseConfig);
const db          = getDatabase(firebaseApp);

// ────────────────────────────────────────────────────────────
//  config บ่อ: ความลึก (cm) และพื้นที่หน้าตัด (cm²)
// ────────────────────────────────────────────────────────────

const POND_CONFIG = {
  pond_1: { depth_cm: 200, area_cm2: 40000 },
};

/** แปลง DevEUI → pondId */
function devEuiToPondId(devEui) {
  const map = {
    "0102030405060708": "pond_1",
  };
  return map[devEui] ?? null;
}

// ────────────────────────────────────────────────────────────
//  Express webhook endpoint
// ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  try {
    const payload = req.body;
    console.log("📥 Received:", JSON.stringify(payload, null, 2));

    // ข้ามถ้าไม่ใช่ uplink (ไม่มี data หรือ fPort)
    if (payload.data === undefined || payload.fPort === undefined) {
      return res.status(200).send("Not an uplink, skipped");
    }

    const devEui = payload.deviceInfo?.devEui;
    const pondId = devEuiToPondId(devEui);
    const config = POND_CONFIG[pondId];

    if (!config) {
      console.warn("⚠️  Unknown device:", devEui);
      return res.status(200).send("Unknown device");
    }

    // แกะ payload: [raw_cm (2B BE), battery% (1B)]
    const buf     = Buffer.from(payload.data, "base64");
    const raw_cm  = buf.readUInt16BE(0);
    const battery = buf.readUInt8(2);

    // คำนวณระดับน้ำ
    const totalDist   = config.depth_cm + 30;
    const waterHeight = totalDist - raw_cm;
    const waterPct    = Math.round((waterHeight / config.depth_cm) * 100);
    const volumeM3 = Math.round((config.area_cm2 * waterHeight) / 1_000_000 * 100) / 100;

    // บันทึกเข้า Firebase
    await set(ref(db, `ponds/${pondId}/last_reading`), {
      raw_cm,
      water_height_cm: waterHeight,
      water_pct:       waterPct,
      volume_m3:       volumeM3,
      battery,
      rssi:      payload.rxInfo?.[0]?.rssi ?? null,
      snr:       payload.rxInfo?.[0]?.snr  ?? null,
      timestamp: Date.now(),
    });

    console.log(`✅ pond=${pondId}  raw=${raw_cm}cm  water=${waterPct}%  vol=${volumeM3}m³`);
    return res.status(200).send("OK");

  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.status(500).send("Internal error");
  }
});

// ────────────────────────────────────────────────────────────
//  Start server
// ────────────────────────────────────────────────────────────

app.listen(3002, () => {
  console.log("🚀 Webhook server running at http://localhost:3002");
});
