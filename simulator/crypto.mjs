// ============================================================
//  simulator/crypto.mjs
//  ฟังก์ชัน AES สำหรับ LoRaWAN: ECB block cipher, CMAC, FRM encryption
// ============================================================

import { createCipheriv } from "crypto";

// ────────────────────────────────────────────────────────────
//  AES-128-ECB — block cipher พื้นฐาน
// ────────────────────────────────────────────────────────────

/**
 * เข้ารหัส block 16 bytes ด้วย AES-128 โหมด ECB
 * ใช้เป็น building block ของ CMAC และ FRM encryption
 */
export function aesEcb(key, block) {
  const cipher = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block), cipher.final()]);
}

// ────────────────────────────────────────────────────────────
//  AES-CMAC — คำนวณ Message Integrity Code (MIC)
// ────────────────────────────────────────────────────────────

/**
 * คำนวณ AES-CMAC ของข้อมูล msg ด้วย key ที่กำหนด
 * LoRaWAN ใช้ค่านี้เป็น MIC โดยตัด 4 bytes แรก
 */
export function aesCmac(key, msg) {
  // สร้าง subkey k1, k2 จาก L = AES(key, 0^16)
  const shiftXor87 = (b) => {
    const out = Buffer.alloc(16);
    for (let i = 0; i < 15; i++) out[i] = ((b[i] << 1) | (b[i + 1] >> 7)) & 0xff;
    out[15] = (b[15] << 1) & 0xff;
    if (b[0] & 0x80) out[15] ^= 0x87; // polynomial reduction
    return out;
  };

  const L  = aesEcb(key, Buffer.alloc(16));
  const k1 = shiftXor87(L);
  const k2 = shiftXor87(k1);

  // แบ่ง msg เป็น block ขนาด 16 bytes
  const n        = Math.max(1, Math.ceil(msg.length / 16));
  const complete = msg.length > 0 && msg.length % 16 === 0;
  const lastRaw  = msg.slice((n - 1) * 16);

  // จัดการ block สุดท้าย: ถ้าไม่ครบให้ padding ด้วย 0x80...
  const mLast = Buffer.alloc(16);
  lastRaw.copy(mLast);
  if (!complete) mLast[lastRaw.length] = 0x80;
  const sub = complete ? k1 : k2;
  for (let i = 0; i < 16; i++) mLast[i] ^= sub[i];

  // CBC-MAC: XOR แต่ละ block แล้ว AES encrypt ไปเรื่อย ๆ
  let x = Buffer.alloc(16);
  for (let i = 0; i < n - 1; i++) {
    const bl = msg.slice(i * 16, (i + 1) * 16);
    for (let j = 0; j < 16; j++) x[j] ^= bl[j];
    x = aesEcb(key, x);
  }
  for (let i = 0; i < 16; i++) x[i] ^= mLast[i];
  return aesEcb(key, x);
}

// ────────────────────────────────────────────────────────────
//  FRM Payload Encryption — LoRaWAN spec §4.3.3
// ────────────────────────────────────────────────────────────

/**
 * เข้ารหัส payload ด้วย AppSKey โดยใช้ AES-CTR แบบ LoRaWAN
 * สร้าง keystream จาก block Ai แต่ละตัว แล้ว XOR กับ data
 */
export function encryptFRM(appKey, devAddrLE, fcnt, data) {
  const out    = Buffer.alloc(data.length);
  const blocks = Math.ceil(data.length / 16);

  for (let i = 0; i < blocks; i++) {
    // สร้าง block Ai ตาม spec: [0x01, 0,0,0,0,0, DevAddr(4), FCnt(4), 0, i+1]
    const ai = Buffer.alloc(16);
    ai[0] = 0x01;
    devAddrLE.copy(ai, 6);
    ai.writeUInt32LE(fcnt, 10);
    ai[15] = i + 1;

    const si = aesEcb(appKey, ai); // keystream block
    for (let j = 0; j < 16 && i * 16 + j < data.length; j++)
      out[i * 16 + j] = data[i * 16 + j] ^ si[j];
  }
  return out;
}
