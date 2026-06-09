// ============================================================
//  simulator/config.mjs
//  ค่า config ของ device LoRaWAN (ใช้ร่วมกันทุก module)
// ============================================================

export const GATEWAY_ID = "0101010101010101"; // Gateway EUI (hex 8 bytes)
export const DEV_ADDR   = "01020304";         // Device Address (hex 4 bytes)
export const NWK_S_KEY  = "01020304050607080102030405060708"; // Network Session Key
export const APP_S_KEY  = "01020304050607080102030405060708"; // Application Session Key

// ค่า RF สำหรับ AS923 band
export const RF = {
  frequency:      923200000, // 923.2 MHz
  bandwidth:      125000,    // 125 kHz
  spreadingFactor: 7,        // SF7
  codeRate:       "CR_4_5",
};
