// ============================================================
//  simulator/chirpstack.mjs
//  Simulates 4 EM500-UDL sensors via MQTT → ChirpStack gateway
//  Run: node simulator/chirpstack.mjs
// ============================================================

import mqtt from "mqtt";
import { GATEWAY_ID, RF, DEVICES, SIM } from "./config.mjs";
import { buildLoRaWANFrame } from "./lorawan.mjs";

const INTERVAL_MS = 20000;          // send all 4 devices every 60 s
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

// ── Realistic water-level simulation ─────────────────────────────────────────
// Each device keeps a mutable "true" water level that drifts slowly over time
// (mean-reverting bounded random walk), so the dashboard sees gradual rises and
// falls instead of a flat line. A little measurement noise is added per reading.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const simState = DEVICES.map((d, i) => {
  const min = d.minMm ?? d.distanceMm - 200;
  const max = d.maxMm ?? d.distanceMm + 200;
  const start = clamp(d.distanceMm, min, max);
  if (start !== d.distanceMm) {
    console.warn(
      `[pond_${i + 1}] distanceMm=${d.distanceMm} is outside [${min}, ${max}] ` +
      `— clamped start to ${start}. Fix minMm/maxMm in config.mjs.`
    );
  }
  return { distanceMm: start, battery: d.battery };
});

function nextReading(i) {
  const device = DEVICES[i];
  const state  = simState[i];
  const min    = device.minMm ?? device.distanceMm - 200;
  const max    = device.maxMm ?? device.distanceMm + 200;
  const mid    = (min + max) / 2;

  // Random walk + gentle pull back toward the middle of the range
  const step = (Math.random() - 0.5) * 2 * SIM.driftMm;
  const pull = (mid - state.distanceMm) * SIM.reversion;
  state.distanceMm = clamp(Math.round(state.distanceMm + step + pull), min, max);

  // Slow, occasional battery drain
  if (Math.random() < SIM.batteryDrain) {
    state.battery = Math.max(SIM.batteryMin, state.battery - 1);
  }

  // Per-reading measurement noise (does not affect the underlying water level)
  const noise    = (Math.random() - 0.5) * 2 * SIM.noiseMm;
  const measured = clamp(Math.round(state.distanceMm + noise), min, max);

  return { distanceMm: measured, battery: state.battery };
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
      const { distanceMm, battery } = nextReading(i);
      const tlv      = buildTLVPayload(distanceMm, battery);
      const phyFrame = buildLoRaWANFrame(fcnts[i], FPORT, tlv, device);
      const message  = buildGatewayMessage(phyFrame);

      client.publish(topic, JSON.stringify(message));
      console.log(
        `[pond_${i + 1}]  devEui=${device.devEui}` +
        `  dist=${distanceMm}mm (${distanceMm / 10}cm)` +
        `  bat=${battery}%  fcnt=${fcnts[i]}` +
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
