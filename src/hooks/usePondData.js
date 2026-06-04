import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { calcWaterHeight, calcWaterPercent, calcVolumeLiters, getStatus } from '../utils/waterLevel';

const SENSOR_OFFSET = 30;
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

export function usePondData() {
  const [ponds, setPonds] = useState(loadPonds);
  const [sensorDistances, setSensorDistances] = useState({});
  const [histories, setHistories] = useState(() =>
    Object.fromEntries(loadPonds().map(p => [p.id, []]))
  );

  useEffect(() => {
    savePonds(ponds);
  }, [ponds]);

  // ดึงข้อมูลจาก Firebase real-time
  useEffect(() => {
    const unsubscribes = ponds.map(p => {
      const sensorRef = ref(db, `ponds/pond_${p.id}/last_reading`);
      return onValue(sensorRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const dist = data.raw_cm; // ค่าระยะจากเซนเซอร์ (cm)

        setSensorDistances(prev => ({ ...prev, [p.id]: dist }));

        setHistories(prev => {
          const wh = calcWaterHeight(dist, p.depth);
          const pct = calcWaterPercent(wh, p.depth);
          const entry = { pct, time: data.timestamp ?? Date.now(), battery: data.battery ?? null };
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

  const setSensorDistance = useCallback((id, dist) => {
    setSensorDistances(prev => ({ ...prev, [id]: dist }));
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

  return { ponds, updatePond, setSensorDistance, getPondState };
}