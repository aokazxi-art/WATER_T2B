// ============================================================
//  simulator/config.mjs
// ============================================================

export const GATEWAY_ID = "0101010101010101";

// Each entry must be registered in ChirpStack (ABP mode) with the
// same devEui, devAddr, nwkSKey, and appSKey.
// devEui here must also match DEV_EUI_MAP in functions/index.js.
export const DEVICES = [
  {
    devEui:     "aabb000000000001",  // pond_1
    devAddr:    "11223301",
    nwkSKey:    "01010101010101010101010101010101",
    appSKey:    "02020202020202020202020202020202",
    distanceMm: 1200,  // 120 cm sensor-to-water
    battery:    85,
  },
  {
    devEui:     "aabb000000000002",  // pond_2
    devAddr:    "11223302",
    nwkSKey:    "03030303030303030303030303030303",
    appSKey:    "04040404040404040404040404040404",
    distanceMm: 1500,  // 150 cm
    battery:    90,
  },
  {
    devEui:     "aabb000000000003",  // pond_3
    devAddr:    "11223303",
    nwkSKey:    "05050505050505050505050505050505",
    appSKey:    "06060606060606060606060606060606",
    distanceMm: 800,   // 80 cm
    battery:    75,
  },
  {
    devEui:     "aabb000000000004",  // pond_4
    devAddr:    "11223304",
    nwkSKey:    "07070707070707070707070707070707",
    appSKey:    "08080808080808080808080808080808",
    distanceMm: 2000,  // 200 cm
    battery:    60,
  },
];

export const RF = {
  frequency:       923200000,  // 923.2 MHz (AS923)
  bandwidth:       125000,
  spreadingFactor: 7,
  codeRate:        "CR_4_5",
};
