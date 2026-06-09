const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const POND_CONFIG = {
  pond_1: { depth_cm: 200, area_cm2: 40000 }
};

exports.chirpstackWebhook = functions
  .region("asia-east1")
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      const payload = req.body;

      if (!payload.object || payload.object.distance_cm === undefined) {
        return res.status(200).send("Not an uplink, skipped");
      }

      const devEui = payload.deviceInfo?.devEui;
      const pondId = devEuiToPondId(devEui);
      const config = POND_CONFIG[pondId];

      if (!config) {
        console.warn("Unknown device:", devEui);
        return res.status(200).send("Unknown device");
      }

      const raw_cm      = payload.object.distance_cm;
      const totalDist   = config.depth_cm + 30;
      const waterHeight = totalDist - raw_cm;
      const waterPct    = Math.round((waterHeight / config.depth_cm) * 100);
      const volumeM3 = Math.round((config.area_cm2 * waterHeight) / 1_000_000 * 100) / 100;

      const db  = admin.database();
      const ref = db.ref(`ponds/${pondId}/last_reading`);

      await ref.set({
        raw_cm,
        water_height_cm : waterHeight,
        water_pct       : waterPct,
        volume_m3       : volumeM3,
        battery         : payload.object.battery ?? null,
        rssi            : payload.rxInfo?.[0]?.rssi ?? null,
        snr             : payload.rxInfo?.[0]?.snr  ?? null,
        timestamp       : Date.now()
      });

      console.log(`pond=${pondId} raw=${raw_cm} pct=${waterPct}%`);
      return res.status(200).send("OK");

    } catch (err) {
      console.error("Webhook error:", err);
      return res.status(500).send("Internal error");
    }
  });

function devEuiToPondId(devEui) {
  const map = {
    "0102030405060708": "pond_1",
  };
  return map[devEui] ?? null;
}