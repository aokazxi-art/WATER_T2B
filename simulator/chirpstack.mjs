// ============================================================
//  simulator/chirpstack.mjs
//  จำลองการส่งข้อมูล sensor ผ่าน MQTT → ChirpStack gateway
//  รัน: node simulator/chirpstack.mjs
// ============================================================

import mqtt from "mqtt";
import { GATEWAY_ID, RF } from "./config.mjs";
import { buildLoRaWANFrame } from "./lorawan.mjs";

// ────────────────────────────────────────────────────────────
//  ค่าข้อมูล sensor ที่จะส่ง — แก้ตรงนี้เพื่อทดสอบ
// ────────────────────────────────────────────────────────────

const SENSOR = {
  distance_cm: 120, // ระยะวัดน้ำ (หน่วย cm)
  battery_pct: 82,  // แบตเตอรี่ (%)
};

const INTERVAL_MS  = 5000; // ส่งทุก 5 วินาที
const MQTT_BROKER  = "mqtt://localhost:1883";
const FPORT        = 1;    // FPort 1 = application data

// ────────────────────────────────────────────────────────────
//  สร้าง payload และ publish ไปยัง ChirpStack
// ────────────────────────────────────────────────────────────

/** สร้าง payload 3 bytes: [distance_cm (2B BE), battery% (1B)] */
function buildPayload(distanceCm, batteryPct) {
  const buf = Buffer.alloc(3);
  buf.writeUInt16BE(distanceCm, 0);
  buf.writeUInt8(batteryPct, 2);
  return buf;
}

/** สร้าง ChirpStack gateway uplink event message */
function buildChirpStackMessage(phyFrame) {
  return {
    phyPayload: phyFrame.toString("base64"),
    txInfo: {
      frequency: RF.frequency,
      modulation: {
        lora: {
          bandwidth:       RF.bandwidth,
          spreadingFactor: RF.spreadingFactor,
          codeRate:        RF.codeRate,
        },
      },
    },
    rxInfo: {
      gatewayId: GATEWAY_ID,
      rssi:      -85,           // จำลอง: สัญญาณ dBm
      snr:        7.5,          // จำลอง: Signal-to-Noise ratio
      context:   "AAAAAAAAAA==",
    },
  };
}

// ────────────────────────────────────────────────────────────
//  MQTT — เชื่อมต่อและส่งข้อมูลซ้ำตาม INTERVAL_MS
// ────────────────────────────────────────────────────────────

const client = mqtt.connect(MQTT_BROKER);
let fcnt = 0; // Frame Counter เริ่มต้นที่ 0

client.on("connect", () => {
  console.log(`✅ Connected to ${MQTT_BROKER}`);

  setInterval(() => {
    const plain    = buildPayload(SENSOR.distance_cm, SENSOR.battery_pct);
    const phyFrame = buildLoRaWANFrame(fcnt, FPORT, plain);
    const message  = buildChirpStackMessage(phyFrame);
    const topic    = `as923/gateway/${GATEWAY_ID}/event/up`;

    client.publish(topic, JSON.stringify(message));
    console.log(`📡 fcnt=${fcnt}  distance_cm=${SENSOR.distance_cm}  battery=${SENSOR.battery_pct}%`);
    fcnt++;
  }, INTERVAL_MS);
});

client.on("error", (err) => console.error("❌ MQTT error:", err));
