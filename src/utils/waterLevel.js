// คำนวณความสูงของน้ำจากระยะที่เซ็นเซอร์วัดได้
// sensorOffset = ระยะห่างเซนเซอร์จากขอบบ่อ (ซม.)
export function calcWaterHeight(sensorDistance, pondDepth, sensorOffset) {
  return pondDepth + sensorOffset - sensorDistance;
}

// แปลงความสูงน้ำเป็น % เทียบกับความลึกบ่อ (clamp 0–100)
export function calcWaterPercent(waterHeight, pondDepth) {
  const pct = (waterHeight / pondDepth) * 100;
  return Math.min(100, Math.max(0, pct));
}

// คำนวณปริมาตรน้ำ (area หน่วย ซม², waterHeight หน่วย ซม → ลิตร)
export function calcVolumeLiters(area, waterHeight) {
  return (area * waterHeight) / 1000;
}

// แปลงลิตร → ตัน (น้ำ 1 ลิตร = 1 กก. = 0.001 ตัน)
export function calcVolumeTons(volumeLiters) {
  return volumeLiters / 1000;
}

// คืนสถานะ 'normal' | 'warning' | 'danger' จาก % และค่า threshold ที่ตั้งไว้
export function getStatus(pct, thresholdYellow, thresholdRed) {
  if (pct >= thresholdRed) return 'danger';
  if (pct >= thresholdYellow) return 'warning';
  return 'normal';
}

// คืนสีของสถานะ (เขียว / เหลือง / แดง / เทา)
export function getStatusColor(status) {
  if (status === 'danger')  return '#dc2626';
  if (status === 'warning') return '#d97706';
  if (status === 'loading') return '#94a3b8';
  return '#16a34a';
}
