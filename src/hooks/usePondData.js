import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, get, set as fbSet, update as fbUpdate } from 'firebase/database';
import { db } from '../firebase';
import { calcWaterHeight, calcWaterPercent, calcVolumeLiters, getStatus } from '../utils/waterLevel';

const HISTORY_SIZE = 20;

// area หน่วย ซม², depth หน่วย ซม., sensorOffset หน่วย ซม.
const DEFAULT_PONDS = [
  { id: 1, name: 'Pond A', depth: 150, area: 120000, sensorOffset: 30, thresholdYellow: 70, thresholdRed: 80, deviceId: '' },
  { id: 2, name: 'Pond B', depth: 120, area:  87500, sensorOffset: 30, thresholdYellow: 70, thresholdRed: 80, deviceId: '' },
  { id: 3, name: 'Pond C', depth: 200, area: 200000, sensorOffset: 30, thresholdYellow: 65, thresholdRed: 75, deviceId: '' },
  { id: 4, name: 'Pond D', depth: 180, area: 157500, sensorOffset: 30, thresholdYellow: 70, thresholdRed: 85, deviceId: '' },
];

function loadPonds() {
  try {
    const saved = localStorage.getItem('water_monitor_ponds');
    if (saved) {
      const ponds = JSON.parse(saved);
      // migrate format เก่า (width × length) → area
      return ponds.map(p => ({
        ...p,
        area: p.area ?? ((p.width ?? 300) * (p.length ?? 400)),
        sensorOffset: p.sensorOffset ?? 30,
        deviceId: p.deviceId ?? '',
      }));
    }
  } catch (_) {}
  return DEFAULT_PONDS;
}

function savePonds(ponds) {
  localStorage.setItem('water_monitor_ponds', JSON.stringify(ponds));
}

function loadSensorDistances() {
  try {
    const saved = localStorage.getItem('water_monitor_sensor_distances');
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return {};
}

function saveSensorDistances(distances) {
  localStorage.setItem('water_monitor_sensor_distances', JSON.stringify(distances));
}

function loadSensorMeta() {
  try {
    const saved = localStorage.getItem('water_monitor_sensor_meta');
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return {};
}

function saveSensorMeta(meta) {
  localStorage.setItem('water_monitor_sensor_meta', JSON.stringify(meta));
}

function dayStr(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function appendDailyHistory(pondId, entry) {
  const key = `water_daily_${pondId}_${dayStr()}`;
  try {
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.push(entry);
    localStorage.setItem(key, JSON.stringify(arr.slice(-500)));
  } catch (_) {}
}

export function loadDailyHistory(pondId, date) {
  const key = `water_daily_${pondId}_${dayStr(date)}`;
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (_) { return []; }
}

export function usePondData() {
  const [ponds, setPonds] = useState(loadPonds);
  const [sensorDistances, setSensorDistances] = useState(loadSensorDistances);
  const [sensorMeta, setSensorMeta] = useState(loadSensorMeta);
  const [histories, setHistories] = useState(() =>
    Object.fromEntries(loadPonds().map(p => [p.id, []]))
  );
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => { savePonds(ponds); }, [ponds]);
  useEffect(() => { saveSensorDistances(sensorDistances); }, [sensorDistances]);
  useEffect(() => { saveSensorMeta(sensorMeta); }, [sensorMeta]);

  // โหลด settings จาก Firebase ตอน mount (Firebase = source of truth ข้ามเครื่อง/เบราว์เซอร์)
  useEffect(() => {
    loadPonds().forEach(p => {
      get(ref(db, `ponds/pond_${p.id}/settings`))
        .then(snapshot => {
          const data = snapshot.val();
          if (data && typeof data === 'object') {
            setPonds(prev => prev.map(pond =>
              pond.id === p.id ? { ...pond, ...data, id: pond.id } : pond
            ));
          }
        })
        .catch(() => {}); // offline / ไม่มีข้อมูล → ใช้ localStorage ตามเดิม
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const connectedRef = ref(db, '.info/connected');
    return onValue(connectedRef, snap => setIsConnected(snap.val() === true));
  }, []);

  useEffect(() => {
    const unsubscribes = ponds.map(p => {
      const sensorRef = ref(db, `ponds/pond_${p.id}/last_reading`);
      return onValue(sensorRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const dist = data.raw_cm;
        const receivedAt = Date.now();

        setSensorDistances(prev => ({ ...prev, [p.id]: dist }));
        setSensorMeta(prev => ({ ...prev, [p.id]: { timestamp: receivedAt, battery: data.battery ?? null } }));

        setHistories(prev => {
          const wh    = calcWaterHeight(dist, p.depth, p.sensorOffset);
          const pct   = calcWaterPercent(wh, p.depth);
          const entry = { pct, time: receivedAt, battery: data.battery ?? null };
          appendDailyHistory(p.id, entry);
          const arr = [...(prev[p.id] || []), entry];
          return { ...prev, [p.id]: arr.slice(-HISTORY_SIZE) };
        });
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [ponds]);

  const updatePond = useCallback((id, updates) => {
    setPonds(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    // ใช้ update (merge) แทน set เพื่อรองรับ partial update เช่น { deviceId }
    fbUpdate(ref(db, `ponds/pond_${id}/settings`), updates).catch(() => {});
  }, []);

  // เพิ่มบ่อ + เซนเซอร์ใหม่ (id ถัดไปจาก max ปัจจุบัน)
  const addPond = useCallback((name, deviceId = '') => {
    setPonds(prev => {
      const newId = Math.max(0, ...prev.map(p => p.id)) + 1;
      const newPond = {
        id: newId, name, deviceId,
        depth: 100, area: 10000, sensorOffset: 30,
        thresholdYellow: 70, thresholdRed: 80,
      };
      fbSet(ref(db, `ponds/pond_${newId}/settings`), newPond).catch(() => {});
      return [...prev, newPond];
    });
  }, []);

  // ลบบ่อ + เซนเซอร์ (ล้าง state ย่อยที่เกี่ยวข้องด้วย)
  const removePond = useCallback((id) => {
    setPonds(prev => prev.filter(p => p.id !== id));
    setSensorDistances(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSensorMeta(prev =>      { const n = { ...prev }; delete n[id]; return n; });
    setHistories(prev =>       { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const getPondState = useCallback((id) => {
    const pond = ponds.find(p => p.id === id);
    if (!pond) return null;
    const dist = sensorDistances[id];
    if (dist == null) return { pond, dist: null, waterHeight: null, pct: null, volume: null, status: 'loading', history: histories[id] || [] };
    const waterHeight = calcWaterHeight(dist, pond.depth, pond.sensorOffset);
    const pct    = calcWaterPercent(waterHeight, pond.depth);
    const volume = calcVolumeLiters(pond.area, waterHeight);
    const status = getStatus(pct, pond.thresholdYellow, pond.thresholdRed);
    return { pond, dist, waterHeight, pct, volume, status, history: histories[id] || [] };
  }, [ponds, sensorDistances, histories]);

  return { ponds, updatePond, addPond, removePond, getPondState, sensorMeta, isConnected };
}
