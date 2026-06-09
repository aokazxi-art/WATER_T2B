// ============================================================
//  simulator/lorawan.mjs
//  สร้าง LoRaWAN PHY Frame (MHDR + MACPayload + MIC)
// ============================================================

import { DEV_ADDR, NWK_S_KEY, APP_S_KEY } from "./config.mjs";
import { aesCmac, encryptFRM }             from "./crypto.mjs";

/**
 * สร้าง LoRaWAN uplink frame พร้อม MIC ครบสมบูรณ์
 * @param {number} fcnt         - Frame Counter
 * @param {number} fPort        - FPort (1 = application data)
 * @param {Buffer} plainPayload - ข้อมูลดิบก่อนเข้ารหัส
 * @returns {Buffer} PHY frame พร้อมส่ง
 */
export function buildLoRaWANFrame(fcnt, fPort, plainPayload) {
  const nwkKey    = Buffer.from(NWK_S_KEY, "hex");
  const appKey    = Buffer.from(APP_S_KEY, "hex");
  const devAddrLE = Buffer.from(DEV_ADDR, "hex").reverse(); // Little-Endian ตาม spec

  const fcntBuf = Buffer.alloc(2);
  fcntBuf.writeUInt16LE(fcnt);

  // เข้ารหัส payload ด้วย AppSKey
  const encPayload = encryptFRM(appKey, devAddrLE, fcnt, plainPayload);

  // ประกอบ MHDR + FHDR + FPort + FRMPayload
  const body = Buffer.concat([
    Buffer.from([0x40]),  // MHDR: MType=010 (Unconfirmed Up), Major=00
    devAddrLE,            // DevAddr (4 bytes, LE)
    Buffer.from([0x00]),  // FCtrl: no ADR, no ACK, FOptsLen=0
    fcntBuf,              // FCnt (2 bytes, LE)
    Buffer.from([fPort]), // FPort
    encPayload,           // FRMPayload (encrypted)
  ]);

  // คำนวณ MIC: CMAC ของ B0 || body โดยใช้ NwkSKey
  const b0 = Buffer.alloc(16);
  b0[0] = 0x49; // ตาม LoRaWAN spec MIC block header
  devAddrLE.copy(b0, 6);
  b0.writeUInt32LE(fcnt, 10);
  b0[15] = body.length;

  const mic = aesCmac(nwkKey, Buffer.concat([b0, body])).slice(0, 4);
  return Buffer.concat([body, mic]);
}
