import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, get, set as fbSet, update as fbUpdate, remove as fbRemove, push as fbPush } from 'firebase/database';
import { db } from '../firebase';
import { calcWaterHeight, calcWaterPercent, calcVolumeM3, getStatus } from '../utils/waterLevel';

const HISTORY_SIZE = 20;
const REGISTRY = 'pond_registry'; // source of truth ข้ามเครื่อง

// ค่า default ที่ใช้เติมฟิลด์ที่ขาดหายเมื่อ merge จาก Firebase
const DEFAULT_FIELDS = {
  depth: 100, area: 10000, sensorOffset: 30,
  thresholdYellow: 70, thresholdRed: 80,
  deviceId: '', gatewayId: null, sensorModel: '',
};

// area หน่วย ซม², depth หน่วย ซม., sensorOffset หน่วย ซม.
const DEFAULT_PONDS = [
  { id: 1, name: 'Pond A', depth: 150, area: 120000, sensorOffset: 30, thresholdYellow: 70, thresholdRed: 80, deviceId: '', gatewayId: null },
  { id: 2, name: 'Pond B', depth: 120, area:  87500, sensorOffset: 30, thresholdYellow: 70, thresholdRed: 80, deviceId: '', gatewayId: null },
  { id: 3, name: 'Pond C', depth: 200, area: 200000, sensorOffset: 30, thresholdYellow: 65, thresholdRed: 75, deviceId: '', gatewayId: null },
  { id: 4, name: 'Pond D', depth: 180, area: 157500, sensorOffset: 30, thresholdYellow: 70, thresholdRed: 85, deviceId: '', gatewayId: null },
];

// ─── localStorage helpers (cache สำหรับ offline) ─────────────────────────────

function loadPonds() {
  try {
    const saved = localStorage.getItem('water_monitor_ponds');
    if (saved) {
      const ponds = JSON.parse(saved);
      return ponds.map(p => ({
        ...DEFAULT_FIELDS, ...p,
        area:         p.area ?? ((p.width ?? 300) * (p.length ?? 400)),
        sensorOffset: p.sensorOffset ?? 30,
        deviceId:     p.deviceId ?? '',
        gatewayId:    p.gatewayId ?? null,
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
    const s = localStorage.getItem('water_monitor_sensor_distances');
    if (s) return JSON.parse(s);
  } catch (_) {}
  return {};
}

function saveSensorDistances(d) {
  localStorage.setItem('water_monitor_sensor_distances', JSON.stringify(d));
}

function loadSensorMeta() {
  try {
    const s = localStorage.getItem('water_monitor_sensor_meta');
    if (s) return JSON.parse(s);
  } catch (_) {}
  return {};
}

function saveSensorMeta(m) {
  localStorage.setItem('water_monitor_sensor_meta', JSON.stringify(m));
}

// ─── Daily history ────────────────────────────────────────────────────────────

function dayStr(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function appendDailyHistory(pondId, entry) {
  const dateKey = dayStr();
  const lsKey = `water_daily_${pondId}_${dateKey}`;
  try {
    const arr = JSON.parse(localStorage.getItem(lsKey) || '[]');
    arr.push(entry);
    localStorage.setItem(lsKey, JSON.stringify(arr.slice(-500)));
  } catch (_) {}
  fbPush(ref(db, `pond_history/${pondId}/${dateKey}`), entry).catch(() => {});
}

export function loadDailyHistory(pondId, date) {
  const key = `water_daily_${pondId}_${dayStr(date)}`;
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch (_) { return []; }
}

export async function loadDailyHistoryAsync(pondId, date) {
  const dateKey = dayStr(date);
  const lsKey = `water_daily_${pondId}_${dateKey}`;
  try {
    const cached = localStorage.getItem(lsKey);
    if (cached) {
      const arr = JSON.parse(cached);
      if (arr.length > 0) return arr;
    }
  } catch (_) {}
  try {
    const snap = await get(ref(db, `pond_history/${pondId}/${dateKey}`));
    const data = snap.val();
    if (data && typeof data === 'object') {
      const arr = Object.values(data).sort((a, b) => a.time - b.time);
      try { localStorage.setItem(lsKey, JSON.stringify(arr)); } catch (_) {}
      return arr;
    }
  } catch (_) {}
  return [];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePondData() {
  const [ponds, setPonds]                 = useState(loadPonds);
  const [sensorDistances, setSensorDistances] = useState(loadSensorDistances);
  const [sensorMeta, setSensorMeta]       = useState(loadSensorMeta);
  const [histories, setHistories]         = useState(() =>
    Object.fromEntries(loadPonds().map(p => [p.id, []]))
  );
  const [isConnected, setIsConnected]     = useState(false);

  // localStorage cache — อัปเดตทุกครั้งที่ state เปลี่ยน
  useEffect(() => { savePonds(ponds); },             [ponds]);
  useEffect(() => { saveSensorDistances(sensorDistances); }, [sensorDistances]);
  useEffect(() => { saveSensorMeta(sensorMeta); },   [sensorMeta]);

  // ── Firebase connection status ──────────────────────────────────────────────
  useEffect(() => {
    const connRef = ref(db, '.info/connected');
    return onValue(connRef, snap => setIsConnected(snap.val() === true));
  }, []);

  // ── pond_registry: real-time listener (source of truth ข้ามเครื่อง) ─────────
  // ฟัง real-time ทุกครั้งที่ใครแก้ไข/เพิ่ม/ลบบ่อจากเครื่องใดก็ตาม
  useEffect(() => {
    const registryRef = ref(db, REGISTRY);
    const unsub = onValue(registryRef, snapshot => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        // Firebase มีข้อมูล → ใช้เป็น source of truth
        const fbPonds = Object.values(data)
          .map(p => ({ ...DEFAULT_FIELDS, ...p }))
          .sort((a, b) => a.id - b.id);
        setPonds(fbPonds);
      } else {
        // Firebase ว่าง (เปิดครั้งแรก) → push ข้อมูล local ขึ้นไป
        const localPonds = loadPonds();
        const batch = {};
        localPonds.forEach(p => { batch[p.id] = p; });
        fbUpdate(ref(db, REGISTRY), batch).catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  // ── Sensor data listener ────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribes = ponds.map(p => {
      const sensorRef = ref(db, `ponds/pond_${p.id}/last_reading`);
      return onValue(sensorRef, snapshot => {
        const data = snapshot.val();
        if (!data) return;

        const dist       = data.raw_cm;
        const receivedAt = Date.now();

        setSensorDistances(prev => ({ ...prev, [p.id]: dist }));
        setSensorMeta(prev => ({ ...prev, [p.id]: { timestamp: receivedAt, battery: data.battery ?? null } }));

        const wh    = calcWaterHeight(dist, p.depth, p.sensorOffset);
        const pct   = calcWaterPercent(wh, p.depth);
        const entry = { pct, time: receivedAt, battery: data.battery ?? null };
        appendDailyHistory(p.id, entry);

        setHistories(prev => {
          const arr = [...(prev[p.id] || []), entry];
          return { ...prev, [p.id]: arr.slice(-HISTORY_SIZE) };
        });
      });
    });
    return () => unsubscribes.forEach(u => u());
  }, [ponds]);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  // เขียนลง pond_registry → onValue listener จะ push กลับมาทุกเครื่องอัตโนมัติ
  const updatePond = useCallback((id, updates) => {
    setPonds(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)); // optimistic
    fbUpdate(ref(db, `${REGISTRY}/${id}`), updates).catch(() => {});
  }, []);

  const addPond = useCallback((name, deviceId = '', gatewayId = null) => {
    setPonds(prev => {
      const newId   = Math.max(0, ...prev.map(p => p.id)) + 1;
      const newPond = { ...DEFAULT_FIELDS, id: newId, name, deviceId, gatewayId };
      fbSet(ref(db, `${REGISTRY}/${newId}`), newPond).catch(() => {}); // listener จะ push กลับมา
      return [...prev, newPond]; // optimistic local update
    });
  }, []);

  const removePond = useCallback((id) => {
    setPonds(prev => prev.filter(p => p.id !== id)); // optimistic
    fbRemove(ref(db, `${REGISTRY}/${id}`)).catch(() => {}); // listener จะ sync กลับมา
    setSensorDistances(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSensorMeta(prev =>      { const n = { ...prev }; delete n[id]; return n; });
    setHistories(prev =>       { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const getPondState = useCallback((id) => {
    const pond    = ponds.find(p => p.id === id);
    if (!pond) return null;
    const battery = sensorMeta[id]?.battery ?? null;
    const dist    = sensorDistances[id];
    if (dist == null) return { pond, dist: null, waterHeight: null, pct: null, volume: null, status: 'loading', battery, history: histories[id] || [] };
    const waterHeight = calcWaterHeight(dist, pond.depth, pond.sensorOffset);
    const pct    = calcWaterPercent(waterHeight, pond.depth);
    const volume = calcVolumeM3(pond.area, waterHeight);
    const status = getStatus(pct, pond.thresholdYellow, pond.thresholdRed);
    return { pond, dist, waterHeight, pct, volume, status, battery, history: histories[id] || [] };
  }, [ponds, sensorDistances, sensorMeta, histories]);

  return { ponds, updatePond, addPond, removePond, getPondState, sensorMeta, isConnected };
}
