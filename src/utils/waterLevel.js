// Sensor is mounted 30 cm above pond rim
const SENSOR_OFFSET = 30;

export function calcWaterHeight(sensorDistance, pondDepth) {
  return pondDepth + SENSOR_OFFSET - sensorDistance;
}

export function calcWaterPercent(waterHeight, pondDepth) {
  const pct = (waterHeight / pondDepth) * 100;
  return Math.min(100, Math.max(0, pct));
}

export function calcVolumeLiters(width, length, waterHeight) {
  return (width * length * waterHeight) / 1000;
}

export function getStatus(pct, thresholdYellow, thresholdRed) {
  if (pct >= thresholdRed) return 'danger';
  if (pct >= thresholdYellow) return 'warning';
  return 'normal';
}

export function getStatusColor(status) {
  if (status === 'danger') return '#ef4444';
  if (status === 'warning') return '#f59e0b';
  return '#22c55e';
}

// Random walk for simulation
export function randomWalk(current, min, max, step = 2) {
  const delta = (Math.random() - 0.5) * 2 * step;
  return Math.min(max, Math.max(min, current + delta));
}
