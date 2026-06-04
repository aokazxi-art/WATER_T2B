import { useState, useEffect, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { calcWaterHeight, calcWaterPercent, calcVolumeLiters, getStatus } from '../utils/waterLevel';

const HISTORY_SIZE = 20;

const DEFAULT_PONDS = [
  { id: 1, name: 'Pond A', depth: 150, width: 300, length: 400, thresholdYellow: 70, thresholdRed: 80 },
  { id: 2, name: 'Pond B', depth: 120, width: 250, length: 350, thresholdYellow: 70, thresholdRed: 80 },
  { id: 3, name: 'Pond C', depth: 200, width: 400, length: 500, thresholdYellow: 65, thresholdRed: 75 },
  { id: 4, name: 'Pond D', depth: 180, width: 350, length: 450, thresholdYellow: 70, thresholdRed: 85 },
];

function loadPonds() {
  try {
    const saved = localStorage.getItem('water_monitor_ponds');
    if (saved) return JSON.parse(saved);
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

  useEffect(() => {
    savePonds(ponds);
  }, [ponds]);

  useEffect(() => {
    saveSensorDistances(sensorDistances);
  }, [sensorDistances]);

  useEffect(() => {
    saveSensorMeta(sensorMeta);
  }, [sensorMeta]);

  useEffect(() => {
    const connectedRef = ref(db, '.info/connected');
    return onValue(connectedRef, snap => setIsConnected(snap.val() === true));
  }, []);

  // ดึงข้อมูลจาก Firebase real-time
  useEffect(() => {
    const unsubscribes = ponds.map(p => {
      const sensorRef = ref(db, `ponds/pond_${p.id}/last_reading`);
      return onValue(sensorRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const dist      = data.raw_cm;
        const receivedAt = Date.now(); // ใช้เวลาที่รับข้อมูลจริง ไม่ใช้ clock ของ sensor

        setSensorDistances(prev => ({ ...prev, [p.id]: dist }));
        setSensorMeta(prev => ({ ...prev, [p.id]: { timestamp: receivedAt, battery: data.battery ?? null } }));

        setHistories(prev => {
          const wh    = calcWaterHeight(dist, p.depth);
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
  }, []);

  const getPondState = useCallback((id) => {
    const pond = ponds.find(p => p.id === id);
    if (!pond) return null;
    const dist = sensorDistances[id];
    if (dist == null) return { pond, dist: null, waterHeight: null, pct: null, volume: null, status: 'loading', history: histories[id] || [] };
    const waterHeight = calcWaterHeight(dist, pond.depth);
    const pct = calcWaterPercent(waterHeight, pond.depth);
    const volume = calcVolumeLiters(pond.width, pond.length, waterHeight);
    const status = getStatus(pct, pond.thresholdYellow, pond.thresholdRed);
    return { pond, dist, waterHeight, pct, volume, status, history: histories[id] || [] };
  }, [ponds, sensorDistances, histories]);

  return { ponds, updatePond, getPondState, sensorMeta, isConnected };
}