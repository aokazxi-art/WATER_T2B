// ============================================================
//  simulator/chirpstack.mjs
//  Simulates 4 EM500-UDL sensors via MQTT → ChirpStack gateway
//  Run: node simulator/chirpstack.mjs
// ============================================================

import mqtt from "mqtt";
import { GATEWAY_ID, RF, DEVICES } from "./config.mjs";
import { buildLoRaWANFrame } from "./lorawan.mjs";

const INTERVAL_MS = 10000;          // send all 4 devices every 10 s
const MQTT_BROKER = "mqtt://localhost:1883";
const FPORT       = 1;

// ── Milesight EM500-UDL TLV payload ──────────────────────────────────────────
// Battery : channel=0x01, type=0x75, 1 byte uint8  (unit: %)
// Distance: channel=0x03, type=0x82, 2 bytes uint16LE (unit: mm)
//
// Example — distance=2450mm, battery=85%:
//   01 75 55   03 82 92 09
// ─────────────────────────────────────────────────────────────────────────────
function buildTLVPayload(distanceMm, batteryPct) {
  const buf = Buffer.alloc(7);
  buf[0] = 0x01; buf[1] = 0x75; buf[2] = batteryPct & 0xff;
  buf[3] = 0x03; buf[4] = 0x82;
  buf.writeUInt16LE(distanceMm, 5);
  return buf;
}

function buildGatewayMessage(phyFrame) {
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
      rssi:      -85,
      snr:        7.5,
      context:   "AAAAAAAAAA==",
    },
  };
}

// ── MQTT ──────────────────────────────────────────────────────────────────────

const client = mqtt.connect(MQTT_BROKER);
const fcnts  = new Array(DEVICES.length).fill(0);  // per-device frame counter
const topic  = `as923/gateway/${GATEWAY_ID}/event/up`;

client.on("connect", () => {
  console.log(`Connected to ${MQTT_BROKER}`);
  console.log(`Sending ${DEVICES.length} devices every ${INTERVAL_MS / 1000}s`);
  console.log(`Topic: ${topic}`);
  console.log("-".repeat(70));

  function tick() {
    DEVICES.forEach((device, i) => {
      const tlv      = buildTLVPayload(device.distanceMm, device.battery);
      const phyFrame = buildLoRaWANFrame(fcnts[i], FPORT, tlv, device);
      const message  = buildGatewayMessage(phyFrame);

      client.publish(topic, JSON.stringify(message));
      console.log(
        `[pond_${i + 1}]  devEui=${device.devEui}` +
        `  dist=${device.distanceMm}mm (${device.distanceMm / 10}cm)` +
        `  bat=${device.battery}%  fcnt=${fcnts[i]}` +
        `  payload=${tlv.toString("hex")}`
      );
      fcnts[i]++;
    });
    console.log("-".repeat(70));
  }

  tick();  // send immediately on connect, then repeat
  setInterval(tick, INTERVAL_MS);
});

client.on("error", (err) => console.error("MQTT error:", err));
