// ============================================================
//  simulator/config.mjs
// ============================================================

export const GATEWAY_ID = "0101010101010101";

// Each entry must be registered in ChirpStack (ABP mode) with the
// same devEui, devAddr, nwkSKey, and appSKey.
// devEui here must also match DEV_EUI_MAP in functions/index.js.
// distanceMm = starting sensor-to-water distance (mm). The simulator drifts this
// value over time within [minMm, maxMm] to mimic a real pond filling/draining.
// Smaller distance = higher water level.
export const DEVICES = [
  {
    devEui:     "aabb000000000001",  // pond_1
    devAddr:    "11223301",
    nwkSKey:    "01010101010101010101010101010101",
    appSKey:    "02020202020202020202020202020202",
    distanceMm: 350,  // 35 cm sensor-to-water
    minMm:      300,  // 30 cm (high water)
    maxMm:      400,  // 40 cm (low water)
    battery:    85,
  },
  {
    devEui:     "aabb000000000002",  // pond_2
    devAddr:    "11223302",
    nwkSKey:    "03030303030303030303030303030303",
    appSKey:    "04040404040404040404040404040404",
    distanceMm: 450,  // 45 cm
    minMm:      400,  // 40 cm
    maxMm:      500,  // 50 cm
    battery:    90,
  },
  {
    devEui:     "aabb000000000003",  // pond_3
    devAddr:    "11223303",
    nwkSKey:    "05050505050505050505050505050505",
    appSKey:    "06060606060606060606060606060606",
    distanceMm: 800,  // 80 cm
    minMm:      750,  // 75 cm
    maxMm:      850,  // 85 cm
    battery:    75,
  },
  {
    devEui:     "aabb000000000004",  // pond_4
    devAddr:    "11223304",
    nwkSKey:    "07070707070707070707070707070707",
    appSKey:    "08080808080808080808080808080808",
    distanceMm: 200,  // 20 cm
    minMm:      150,  // 15 cm (high water)
    maxMm:      250,  // 25 cm (low water)
    battery:    60,
  },
];

// ── Simulation tuning ─────────────────────────────────────────────────────────
export const SIM = {
  driftMm:        15,    // max random step of the true water level per tick (mm)
  reversion:      0.05,  // pull back toward the mid of [minMm, maxMm] (0–1)
  noiseMm:        4,     // per-reading measurement noise added on top (mm)
  batteryDrain:   0.03,  // chance per tick that battery drops 1%
  batteryMin:     5,     // never report below this (%)
};

export const RF = {
  frequency:       923200000,  // 923.2 MHz (AS923)
  bandwidth:       125000,
  spreadingFactor: 7,
  codeRate:        "CR_4_5",
};
