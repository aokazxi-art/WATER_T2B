import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, doc, onSnapshot, getDocs,
  setDoc, updateDoc, deleteDoc, addDoc,
  query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { calcWaterHeight, calcWaterPercent, calcVolumeM3, getStatus } from '../utils/waterLevel';

const HISTORY_SIZE = 20;

const DEFAULT_FIELDS = {
  depth: 100, area: 10000, sensorOffset: 30,
  thresholdYellow: 70, thresholdRed: 80,
  deviceId: '', gatewayId: null, sensorModel: '',
};

const DEFAULT_PONDS = [
  { id: 1, name: 'Pond A', depth: 150, area: 120000, sensorOffset: 30, thresholdYellow: 70, thresholdRed: 80, deviceId: '', gatewayId: null },
  { id: 2, name: 'Pond B', depth: 120, area:  87500, sensorOffset: 30, thresholdYellow: 70, thresholdRed: 80, deviceId: '', gatewayId: null },
  { id: 3, name: 'Pond C', depth: 200, area: 200000, sensorOffset: 30, thresholdYellow: 65, thresholdRed: 75, deviceId: '', gatewayId: null },
  { id: 4, name: 'Pond D', depth: 180, area: 157500, sensorOffset: 30, thresholdYellow: 70, thresholdRed: 85, deviceId: '', gatewayId: null },
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

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
  addDoc(collection(db, 'history', `pond_${pondId}`, 'readings'), { ...entry, date: dateKey }).catch(() => {});
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
    const q = query(
      collection(db, 'history', `pond_${pondId}`, 'readings'),
      where('date', '==', dateKey)
    );
    const snapshot = await getDocs(q);
    const arr = snapshot.docs.map(d => d.data()).sort((a, b) => a.time - b.time);
    if (arr.length > 0) {
      try { localStorage.setItem(lsKey, JSON.stringify(arr)); } catch (_) {}
    }
    return arr;
  } catch (_) {}
  return [];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePondData() {
  const [ponds, setPonds]                     = useState(loadPonds);
  const [sensorDistances, setSensorDistances] = useState(loadSensorDistances);
  const [sensorMeta, setSensorMeta]           = useState(loadSensorMeta);
  const [histories, setHistories]             = useState(() =>
    Object.fromEntries(loadPonds().map(p => [p.id, []]))
  );
  const [isConnected, setIsConnected]         = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const pondsRef              = useRef(ponds);
  const lastReadingTimestamps = useRef({});

  // localStorage cache
  useEffect(() => { savePonds(ponds); pondsRef.current = ponds; }, [ponds]);
  useEffect(() => { saveSensorDistances(sensorDistances); }, [sensorDistances]);
  useEffect(() => { saveSensorMeta(sensorMeta); },           [sensorMeta]);

  // ── Network status ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handleOnline  = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Firestore ponds collection listener ────────────────────────────────────
  // Document ID: pond_{id}  ·  Fields: pond config + last_reading (sensor data)
  useEffect(() => {
    let initialized = false;

    const unsub = onSnapshot(collection(db, 'ponds'), snapshot => {
      setIsConnected(true);

      // Firestore ว่าง (เปิดครั้งแรก) → push ค่า default ขึ้นไป
      if (snapshot.empty && !initialized) {
        initialized = true;
        loadPonds().forEach(p => {
          setDoc(doc(db, 'ponds', `pond_${p.id}`), p).catch(() => {});
        });
        return;
      }
      initialized = true;

      // อัปเดต pond config (กรอง last_reading ออก)
      const fbPonds = snapshot.docs
        .map(d => {
          const { last_reading, ...config } = d.data();
          return { ...DEFAULT_FIELDS, ...config };
        })
        .filter(p => p.id != null)
        .sort((a, b) => a.id - b.id);

      if (fbPonds.length > 0) setPonds(fbPonds);

      // อัปเดต sensor readings (เฉพาะ doc ที่มี last_reading)
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') return;
        const data    = change.doc.data();
        const pondId  = data.id;
        const reading = data.last_reading;
        if (!reading || pondId == null) return;

        const dist       = reading.raw_cm;
        const receivedAt = reading.timestamp || Date.now();

        setSensorDistances(prev => ({ ...prev, [pondId]: dist }));
        setSensorMeta(prev => ({ ...prev, [pondId]: { timestamp: receivedAt, battery: reading.battery ?? null } }));

        // บันทึก history เฉพาะเมื่อ timestamp เปลี่ยน (reading ใหม่)
        if (reading.timestamp !== lastReadingTimestamps.current[pondId]) {
          lastReadingTimestamps.current[pondId] = reading.timestamp;

          const { last_reading: _lr, ...pondConfig } = data;
          const merged = { ...DEFAULT_FIELDS, ...pondConfig };
          const wh    = calcWaterHeight(dist, merged.depth, merged.sensorOffset);
          const pct   = calcWaterPercent(wh, merged.depth);
          const entry = {
            pct,
            time:    receivedAt,
            battery: reading.battery ?? null,
            dist:    +dist.toFixed(1),
            wh:      +Math.max(0, wh).toFixed(2),
          };
          appendDailyHistory(pondId, entry);
          setHistories(prev => {
            const arr = [...(prev[pondId] || []), entry];
            return { ...prev, [pondId]: arr.slice(-HISTORY_SIZE) };
          });
        }
      });
    });

    return () => unsub();
  }, []);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const updatePond = useCallback((id, updates) => {
    setPonds(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)); // optimistic
    updateDoc(doc(db, 'ponds', `pond_${id}`), updates).catch(() => {});
  }, []);

  const addPond = useCallback((name, deviceId = '', gatewayId = null) => {
    const newId   = Math.max(0, ...pondsRef.current.map(p => p.id)) + 1;
    const newPond = { ...DEFAULT_FIELDS, id: newId, name, deviceId, gatewayId };
    setPonds(prev => [...prev, newPond]); // optimistic
    setDoc(doc(db, 'ponds', `pond_${newId}`), newPond).catch(() => {});
  }, []);

  const removePond = useCallback((id) => {
    setPonds(prev => prev.filter(p => p.id !== id)); // optimistic
    deleteDoc(doc(db, 'ponds', `pond_${id}`)).catch(() => {});
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
