const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ── Device map ────────────────────────────────────────────────────────────────
// Replace placeholder values with real DevEUI strings from ChirpStack.
// DevEUI format: lowercase hex, no colons (e.g. "a840411d5182b9e3")
// Found in ChirpStack UI → Applications → [your app] → Devices → DevEUI column.
const DEV_EUI_MAP = {
  // Simulator DevEUIs — swap for real hardware DevEUIs when sensors arrive.
  // Real DevEUIs: ChirpStack UI → Applications → [app] → Devices → DevEUI column.
  "aabb000000000001": "pond_1",
  "aabb000000000002": "pond_2",
  "aabb000000000003": "pond_3",
  "aabb000000000004": "pond_4",
};
// ─────────────────────────────────────────────────────────────────────────────

exports.chirpstackWebhook = onRequest({ region: "asia-southeast1" }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const payload = req.body;

    // payload.object is the decoded sensor JSON from ChirpStack's JS decoder.
    // payload.data is the raw base64 bytes — we never read that here.
    if (!payload.object || payload.object.distance === undefined) {
      console.log("Skipped: no decoded distance in payload.object");
      return res.status(200).send("skipped");
    }

    const devEui = payload.deviceInfo?.devEui;
    const pondId = DEV_EUI_MAP[devEui];

    if (!pondId) {
      console.warn(`Unknown devEui: ${devEui} — ignoring (returning 200 to stop retries)`);
      return res.status(200).send("unknown device");
    }

    // distance from EM500-UDL is in mm (channel 0x03, type 0x82, UInt16LE)
    const raw_cm  = payload.object.distance / 10;
    const battery = payload.object.battery ?? null;
    const rssi    = payload.rxInfo?.[0]?.rssi ?? null;
    const snr     = payload.rxInfo?.[0]?.snr  ?? null;

    // Use ChirpStack event time; fall back to now if absent
    const timestamp = payload.time ? new Date(payload.time).getTime() : Date.now();

    // Read pond config to calculate derived water measurements
    const pondSnap = await db.collection("pond_registry").doc(pondId).get();
    const { depth = 0, sensorOffset = 0, area = 0 } = pondSnap.exists ? pondSnap.data() : {};

    const distance_m    = raw_cm / 100;
    const water_depth_m = (depth / 100) - distance_m;
    const volume_m3     = Math.round(water_depth_m * area * 10) / 10;

    const wh  = depth + sensorOffset - raw_cm;
    const pct = Math.min(100, Math.max(0, (wh / depth) * 100));

    const reading = { raw_cm, battery, rssi, snr, timestamp };

    await Promise.all([
      // last_reading for live dashboard
      db.collection("ponds").doc(pondId).set(
        { last_reading: { ...reading, updatedAt: FieldValue.serverTimestamp() } },
        { merge: true }
      ),
      // history — fields match what DailyChart and the live listener store
      db.collection("history").doc(pondId).collection("readings").add({
        time:          timestamp,
        dist:          +raw_cm.toFixed(1),
        wh:            +Math.max(0, wh).toFixed(2),
        pct,
        battery,
        rssi,
        snr,
        distance_m,
        water_depth_m,
        volume_m3,
        createdAt:     FieldValue.serverTimestamp(),
      }),
    ]);

    console.log(`pond=${pondId} raw_cm=${raw_cm} pct=${pct.toFixed(1)} wh=${wh} distance_m=${distance_m} volume_m3=${volume_m3} battery=${battery}%`);
    return res.status(200).send("OK");

  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).send("Internal error");
  }
});
