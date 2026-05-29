import { useState, useEffect, useRef, useCallback } from 'react';
import { calcWaterHeight, calcWaterPercent, calcVolumeLiters, getStatus, randomWalk } from '../utils/waterLevel';

const SENSOR_OFFSET = 30;
const HISTORY_SIZE = 20;
const UPDATE_INTERVAL = 3000;

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

function initSensorDistance(depth) {
  // Start at ~60% level
  const waterHeight = depth * 0.6;
  return depth + SENSOR_OFFSET - waterHeight;
}

export function usePondData() {
  const [ponds, setPonds] = useState(loadPonds);
  const [sensorDistances, setSensorDistances] = useState(() =>
    Object.fromEntries(loadPonds().map(p => [p.id, initSensorDistance(p.depth)]))
  );
  const [histories, setHistories] = useState(() =>
    Object.fromEntries(loadPonds().map(p => [p.id, []]))
  );

  // Save ponds to localStorage whenever they change
  useEffect(() => {
    savePonds(ponds);
  }, [ponds]);

  // Simulate sensor readings every 3s
  useEffect(() => {
    const timer = setInterval(() => {
      setSensorDistances(prev => {
        const next = { ...prev };
        ponds.forEach(p => {
          const minDist = SENSOR_OFFSET; // water at 100%
          const maxDist = p.depth + SENSOR_OFFSET; // water at 0%
          next[p.id] = randomWalk(prev[p.id] ?? initSensorDistance(p.depth), minDist, maxDist, 1.5);
        });
        return next;
      });
    }, UPDATE_INTERVAL);
    return () => clearInterval(timer);
  }, [ponds]);

  // Build history from sensor readings
  useEffect(() => {
    setHistories(prev => {
      const next = { ...prev };
      ponds.forEach(p => {
        const dist = sensorDistances[p.id];
        if (dist == null) return;
        const wh = calcWaterHeight(dist, p.depth);
        const pct = calcWaterPercent(wh, p.depth);
        const arr = [...(prev[p.id] || []), pct];
        next[p.id] = arr.slice(-HISTORY_SIZE);
      });
      return next;
    });
  }, [sensorDistances]);

  const updatePond = useCallback((id, updates) => {
    setPonds(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const setSensorDistance = useCallback((id, dist) => {
    setSensorDistances(prev => ({ ...prev, [id]: dist }));
  }, []);

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
