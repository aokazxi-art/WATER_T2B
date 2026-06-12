// ============================================================
//  server/webhook.mjs
//  รับ uplink event จาก ChirpStack webhook → เขียนเข้า Firestore
//  รัน: node server/webhook.mjs
// ============================================================

import express from "express";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

// ────────────────────────────────────────────────────────────
//  Firebase config
// ────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            "AIzaSyCI4NaqTuySWIsZHmNiMmgUet6ZWUkATis",
  authDomain:        "t2bwater.firebaseapp.com",
  projectId:         "t2bwater",
  storageBucket:     "t2bwater.firebasestorage.app",
  messagingSenderId: "857659938393",
  appId:             "1:857659938393:web:d7c0b30e40a01f06a1c348",
};

const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);

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

    // บันทึกเข้า Firestore  ponds/{pondId}
    await setDoc(doc(db, "ponds", pondId), {
      last_reading: {
        raw_cm,
        battery,
        rssi:      payload.rxInfo?.[0]?.rssi ?? null,
        snr:       payload.rxInfo?.[0]?.snr  ?? null,
        timestamp: Date.now(),
        updatedAt: serverTimestamp(),
      },
    }, { merge: true });

    console.log(`✅ pond=${pondId}  raw=${raw_cm}cm  battery=${battery}%`);
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
