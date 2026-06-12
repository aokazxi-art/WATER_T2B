// ============================================================
//  simulator/lorawan.mjs
//  Build a LoRaWAN PHY Frame (MHDR + MACPayload + MIC)
// ============================================================

import { aesCmac, encryptFRM } from "./crypto.mjs";

/**
 * Build a LoRaWAN uplink frame with correct MIC.
 * @param {number} fcnt         - Frame Counter
 * @param {number} fPort        - FPort (1 = application data)
 * @param {Buffer} plainPayload - Unencrypted application payload
 * @param {{ devAddr: string, nwkSKey: string, appSKey: string }} device
 * @returns {Buffer} Complete PHY frame ready to publish
 */
export function buildLoRaWANFrame(fcnt, fPort, plainPayload, device) {
  const nwkKey    = Buffer.from(device.nwkSKey, "hex");
  const appKey    = Buffer.from(device.appSKey, "hex");
  const devAddrLE = Buffer.from(device.devAddr, "hex").reverse(); // Little-Endian per spec

  const fcntBuf = Buffer.alloc(2);
  fcntBuf.writeUInt16LE(fcnt);

  const encPayload = encryptFRM(appKey, devAddrLE, fcnt, plainPayload);

  const body = Buffer.concat([
    Buffer.from([0x40]),   // MHDR: MType=010 (Unconfirmed Up), Major=00
    devAddrLE,             // DevAddr (4 bytes, LE)
    Buffer.from([0x00]),   // FCtrl: no ADR, no ACK, FOptsLen=0
    fcntBuf,               // FCnt (2 bytes, LE)
    Buffer.from([fPort]),  // FPort
    encPayload,            // FRMPayload (encrypted)
  ]);

  const b0 = Buffer.alloc(16);
  b0[0] = 0x49;
  devAddrLE.copy(b0, 6);
  b0.writeUInt32LE(fcnt, 10);
  b0[15] = body.length;

  const mic = aesCmac(nwkKey, Buffer.concat([b0, body])).slice(0, 4);
  return Buffer.concat([body, mic]);
}
