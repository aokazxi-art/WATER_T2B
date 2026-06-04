// เซ็นเซอร์ติดตั้งสูงกว่าขอบบ่อ 30 ซม.
const SENSOR_OFFSET = 30;

// คำนวณความสูงของน้ำจากระยะที่เซ็นเซอร์วัดได้
export function calcWaterHeight(sensorDistance, pondDepth) {
  return pondDepth + SENSOR_OFFSET - sensorDistance;
}

// แปลงความสูงน้ำเป็น % เทียบกับความลึกบ่อ (clamp 0–100)
export function calcWaterPercent(waterHeight, pondDepth) {
  const pct = (waterHeight / pondDepth) * 100;
  return Math.min(100, Math.max(0, pct));
}

// คำนวณปริมาตรน้ำในหน่วยลิตร (กว้าง × ยาว × สูง หน่วย ซม. → ลิตร)
export function calcVolumeLiters(width, length, waterHeight) {
  return (width * length * waterHeight) / 1000;
}

// คืนสถานะ 'normal' | 'warning' | 'danger' จาก % และค่า threshold ที่ตั้งไว้
export function getStatus(pct, thresholdYellow, thresholdRed) {
  if (pct >= thresholdRed) return 'danger';
  if (pct >= thresholdYellow) return 'warning';
  return 'normal';
}

// คืนสีของสถานะ (เขียว / เหลือง / แดง)
export function getStatusColor(status) {
  if (status === 'danger') return '#ef4444';
  if (status === 'warning') return '#f59e0b';
  return '#22c55e';
}

