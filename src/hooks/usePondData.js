import { useState, useEffect, useRef, useCallback } from 'react';
import { calcWaterHeight, calcWaterPercent, calcVolumeLiters, getStatus, randomWalk } from '../utils/waterLevel';

const SENSOR_OFFSET = 30;   // ระยะออฟเซ็ตของเซ็นเซอร์เหนือขอบบ่อ (ซม.)
const HISTORY_SIZE = 20;    // เก็บประวัติ % ย้อนหลังสูงสุด 20 จุด
const UPDATE_INTERVAL = 3000; // อัปเดตค่าเซ็นเซอร์ทุก 3 วินาที

// ข้อมูลบ่อเริ่มต้นเมื่อยังไม่มีข้อมูลใน localStorage
const DEFAULT_PONDS = [
  { id: 1, name: 'Pond A', depth: 150, width: 300, length: 400, thresholdYellow: 70, thresholdRed: 80 },
  { id: 2, name: 'Pond B', depth: 120, width: 250, length: 350, thresholdYellow: 70, thresholdRed: 80 },
  { id: 3, name: 'Pond C', depth: 200, width: 400, length: 500, thresholdYellow: 65, thresholdRed: 75 },
  { id: 4, name: 'Pond D', depth: 180, width: 350, length: 450, thresholdYellow: 70, thresholdRed: 85 },
];

// โหลดข้อมูลบ่อจาก localStorage ถ้ามี ไม่งั้นใช้ค่าเริ่มต้น
function loadPonds() {
  try {
    const saved = localStorage.getItem('water_monitor_ponds');
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return DEFAULT_PONDS;
}

// บันทึกข้อมูลบ่อลง localStorage
function savePonds(ponds) {
  localStorage.setItem('water_monitor_ponds', JSON.stringify(ponds));
}

// คำนวณระยะเซ็นเซอร์เริ่มต้นให้ระดับน้ำอยู่ที่ ~60%
function initSensorDistance(depth) {
  const waterHeight = depth * 0.6;
  return depth + SENSOR_OFFSET - waterHeight;
}

export function usePondData() {
  // state รายการบ่อทั้งหมด
  const [ponds, setPonds] = useState(loadPonds);

  // state ระยะวัดของเซ็นเซอร์แต่ละบ่อ { [pondId]: distanceCm }
  const [sensorDistances, setSensorDistances] = useState(() =>
    Object.fromEntries(loadPonds().map(p => [p.id, initSensorDistance(p.depth)]))
  );

  // state ประวัติ % ระดับน้ำแต่ละบ่อ { [pondId]: number[] }
  const [histories, setHistories] = useState(() =>
    Object.fromEntries(loadPonds().map(p => [p.id, []]))
  );

  // บันทึกข้อมูลบ่อลง localStorage ทุกครั้งที่มีการเปลี่ยนแปลง
  useEffect(() => {
    savePonds(ponds);
  }, [ponds]);

  // จำลองการอ่านค่าเซ็นเซอร์ทุก 3 วินาที (random walk)
  useEffect(() => {
    const timer = setInterval(() => {
      setSensorDistances(prev => {
        const next = { ...prev };
        ponds.forEach(p => {
          const minDist = SENSOR_OFFSET;               // ระยะน้อยสุด = น้ำเต็ม 100%
          const maxDist = p.depth + SENSOR_OFFSET;     // ระยะมากสุด = น้ำว่าง 0%
          next[p.id] = randomWalk(prev[p.id] ?? initSensorDistance(p.depth), minDist, maxDist, 1.5);
        });
        return next;
      });
    }, UPDATE_INTERVAL);
    return () => clearInterval(timer); // ล้าง interval เมื่อ unmount
  }, [ponds]);

  // อัปเดตประวัติระดับน้ำทุกครั้งที่ค่าเซ็นเซอร์เปลี่ยน
  useEffect(() => {
    setHistories(prev => {
      const next = { ...prev };
      ponds.forEach(p => {
        const dist = sensorDistances[p.id];
        if (dist == null) return;
        const wh = calcWaterHeight(dist, p.depth);
        const pct = calcWaterPercent(wh, p.depth);
        const arr = [...(prev[p.id] || []), pct];
        next[p.id] = arr.slice(-HISTORY_SIZE); // เก็บแค่ HISTORY_SIZE จุดล่าสุด
      });
      return next;
    });
  }, [sensorDistances]);

  // อัปเดตข้อมูลบ่อโดย id (เช่น เปลี่ยนชื่อ / ขนาด / threshold)
  const updatePond = useCallback((id, updates) => {
    setPonds(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  // ตั้งค่าระยะเซ็นเซอร์ของบ่อโดยตรง (ใช้จาก slider จำลอง)
  const setSensorDistance = useCallback((id, dist) => {
    setSensorDistances(prev => ({ ...prev, [id]: dist }));
  }, []);

  // คืนข้อมูลสถานะสมบูรณ์ของบ่อ id หนึ่งๆ (คำนวณ pct, volume, status ฯลฯ)
  const getPondState = useCallback((id) => {
    const pond = ponds.find(p => p.id === id);
    if (!pond) return null;
    const dist = sensorDistances[id] ?? initSensorDistance(pond.depth);
    const waterHeight = calcWaterHeight(dist, pond.depth);
    const pct = calcWaterPercent(waterHeight, pond.depth);
    const volume = calcVolumeLiters(pond.width, pond.length, waterHeight);
    const status = getStatus(pct, pond.thresholdYellow, pond.thresholdRed);
    return { pond, dist, waterHeight, pct, volume, status, history: histories[id] || [] };
  }, [ponds, sensorDistances, histories]);

  return { ponds, updatePond, setSensorDistance, getPondState };
}
