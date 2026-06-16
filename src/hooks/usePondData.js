import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, doc, onSnapshot, getDocs,
  setDoc, deleteDoc, addDoc,
  query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { calcWaterHeight, calcWaterPercent, calcVolumeM3, getStatus } from '../utils/waterLevel';

const HISTORY_SIZE = 20;
const REGISTRY = 'pond_registry'; // config บ่อ (แยกจาก sensor readings)

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
  const lsKey   = `water_daily_${pondId}_${dateKey}`;
  const isToday = dateKey === dayStr(new Date());

  // Past dates: return the cache immediately if non-empty
  if (!isToday) {
    try {
      const cached = localStorage.getItem(lsKey);
      if (cached) {
        const arr = JSON.parse(cached);
        if (arr.length > 0) return arr;
      }
    } catch (_) {}
  }

  // Today (always) or past with empty cache: fetch from Firestore
  try {
    const q    = query(collection(db, 'history', `pond_${pondId}`, 'readings'), where('date', '==', dateKey));
    const snap = await getDocs(q);
    const arr  = snap.docs.map(d => d.data()).sort((a, b) => a.time - b.time);
    if (arr.length > 0) {
      try { localStorage.setItem(lsKey, JSON.stringify(arr)); } catch (_) {}
      return arr;
    }
  } catch (_) {}

  // Firestore failed or returned empty → fall back to cache
  try {
    const cached = localStorage.getItem(lsKey);
    if (cached) {
      const arr = JSON.parse(cached);
      if (arr.length > 0) return arr;
    }
  } catch (_) {}
  return [];
}

export async function loadMonthDaysWithData(pondId, year, month) {
  try {
    const mm       = String(month + 1).padStart(2, '0');
    const startStr = `${year}-${mm}-01`;
    const endStr   = `${year}-${mm}-31`;
    const q    = query(
      collection(db, 'history', `pond_${pondId}`, 'readings'),
      where('date', '>=', startStr),
      where('date', '<=', endStr),
    );
    const snap = await getDocs(q);
    const days = new Set();
    snap.docs.forEach(d => {
      const dateStr = d.data().date;
      if (dateStr) {
        const day = parseInt(dateStr.split('-')[2], 10);
        if (!isNaN(day)) days.add(day);
      }
    });
    return days;
  } catch (_) {
    return new Set();
  }
}

export function subscribeDailyHistory(pondId, date, onData) {
  const dateKey = dayStr(date);
  const lsKey   = `water_daily_${pondId}_${dateKey}`;
  try {
    const q     = query(collection(db, 'history', `pond_${pondId}`, 'readings'), where('date', '==', dateKey));
    const unsub = onSnapshot(q, snapshot => {
      const arr = snapshot.docs.map(d => d.data()).sort((a, b) => a.time - b.time);
      try { localStorage.setItem(lsKey, JSON.stringify(arr.slice(-500))); } catch (_) {}
      onData(arr);
    });
    return unsub;
  } catch (_) {
    loadDailyHistoryAsync(pondId, date).then(arr => onData(arr)).catch(() => {});
    return () => {};
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// การันตีว่า ponds จะมีบ่อครบตาม DEFAULT_PONDS เสมอ
function mergeWithDefaults(list) {
  const map = new Map(DEFAULT_PONDS.map(p => [p.id, { ...DEFAULT_FIELDS, ...p }]));
  list.forEach(p => { if (p.id != null) map.set(p.id, { ...map.get(p.id), ...p }); });
  return [...map.values()].sort((a, b) => a.id - b.id);
}

export function usePondData() {
  const [ponds, setPonds]                     = useState(() => mergeWithDefaults(loadPonds()));
  const [sensorDistances, setSensorDistances] = useState(loadSensorDistances);
  const [sensorMeta, setSensorMeta]           = useState(loadSensorMeta);
  const [histories, setHistories]             = useState(() =>
    Object.fromEntries(loadPonds().map(p => [p.id, []]))
  );
  const [isConnected, setIsConnected] = useState(
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
    const up   = () => setIsConnected(true);
    const down = () => setIsConnected(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // ── pond_registry: config บ่อ (source of truth ข้ามเครื่อง) ────────────────
  // Firestore is the source of truth. Every snapshot replaces local state via
  // mergeWithDefaults(fbPonds) where Firestore fields override the defaults,
  // so a remote edit always wins. localStorage is only seeded on first launch
  // (useState initial value) and is never re-applied on top of a Firestore
  // snapshot.
  useEffect(() => {
    let initialized = false;

    const unsub = onSnapshot(collection(db, REGISTRY), snapshot => {
      setIsConnected(true);

      // Build pond list from Firestore. Firestore fields override DEFAULT_FIELDS
      // (per-doc base) and DEFAULT_PONDS (per-id base inside mergeWithDefaults),
      // so a remote edit wins for every field it contains.
      const fbPonds = snapshot.docs
        .map(d => ({ ...DEFAULT_FIELDS, ...d.data() }))
        .filter(p => p.id != null);

      // Backfill any DEFAULT_PONDS that are missing from Firestore. We do this
      // once per session, and only after the SERVER has confirmed the snapshot
      // (not an offline-cache snapshot), so stale localStorage can't overwrite
      // fresh remote data. Backfilling per-id (instead of only when the whole
      // collection is empty) means a doc deleted by a write failure or never
      // created can self-heal on first connect.
      if (!initialized && !snapshot.metadata.fromCache) {
        initialized = true;
        const presentIds = new Set(fbPonds.map(p => p.id));
        DEFAULT_PONDS.forEach(p => {
          if (presentIds.has(p.id)) return;
          setDoc(doc(db, REGISTRY, String(p.id)), p)
            .catch(err => console.error('[pond_registry write failed]', { op: 'seed', id: p.id, err }));
        });
      }

      setPonds(mergeWithDefaults(fbPonds));
    }, err => {
      console.error('[pond_registry snapshot failed]', err);
    });

    return () => unsub();
  }, []);

  // ── ponds collection: sensor readings (เขียนโดย simulator) ────────────────
  // แต่ละ doc: ponds/pond_{id}  →  { last_reading: { raw_cm, timestamp, battery } }
  useEffect(() => {
    const unsubscribes = ponds.map(p =>
      onSnapshot(doc(db, 'ponds', `pond_${p.id}`), snapshot => {
        if (!snapshot.exists()) return;
        const reading = snapshot.data().last_reading;
        if (!reading) return;

        const dist       = reading.raw_cm;
        const receivedAt = reading.timestamp || Date.now();

        setSensorDistances(prev => ({ ...prev, [p.id]: dist }));
        setSensorMeta(prev => ({ ...prev, [p.id]: { timestamp: receivedAt, battery: reading.battery ?? null } }));

        if (reading.timestamp !== lastReadingTimestamps.current[p.id]) {
          lastReadingTimestamps.current[p.id] = reading.timestamp;

          const wh    = calcWaterHeight(dist, p.depth, p.sensorOffset);
          const pct   = calcWaterPercent(wh, p.depth);
          const vol   = calcVolumeM3(p.area, Math.max(0, wh));
          const entry = {
            pct,
            time:    receivedAt,
            battery: reading.battery ?? null,
            dist:    +dist.toFixed(1),
            wh:      +Math.max(0, wh).toFixed(2),
            volume:  +vol.toFixed(1),
          };
          appendDailyHistory(p.id, entry);
          setHistories(prev => {
            const arr = [...(prev[p.id] || []), entry];
            return { ...prev, [p.id]: arr.slice(-HISTORY_SIZE) };
          });
        }
      })
    );

    return () => unsubscribes.forEach(u => u());
  }, [ponds]);

  // ── CRUD (เขียนลง pond_registry → listener sync ทุกเครื่อง) ───────────────

  const updatePond = useCallback((id, updates) => {
    setPonds(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)); // optimistic
    // setDoc + merge upserts: if the pond_registry doc is missing (e.g. the
    // initial seed never ran), this creates it instead of throwing
    // "No document to update" and silently reverting the edit.
    setDoc(doc(db, REGISTRY, String(id)), { id, ...updates }, { merge: true })
      .catch(err => console.error('[pond_registry write failed]', { op: 'update', id, updates, err }));
  }, []);

  const addPond = useCallback((name, deviceId = '', gatewayId = null) => {
    const newId   = Math.max(0, ...pondsRef.current.map(p => p.id)) + 1;
    const newPond = { ...DEFAULT_FIELDS, id: newId, name, deviceId, gatewayId };
    setPonds(prev => [...prev, newPond]); // optimistic
    setDoc(doc(db, REGISTRY, String(newId)), newPond)
      .catch(err => console.error('[pond_registry write failed]', { op: 'add', id: newId, err }));
  }, []);

  const removePond = useCallback((id) => {
    setPonds(prev => prev.filter(p => p.id !== id)); // optimistic
    deleteDoc(doc(db, REGISTRY, String(id)))
      .catch(err => console.error('[pond_registry write failed]', { op: 'remove', id, err }));
    setSensorDistances(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSensorMeta(prev =>      { const n = { ...prev }; delete n[id]; return n; });
    setHistories(prev =>       { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const clearPondHistory = useCallback(async (id) => {
    // 1. ล้าง in-memory histories
    setHistories(prev => ({ ...prev, [id]: [] }));

    // 2. ล้าง localStorage daily history
    const prefix = `water_daily_${id}_`;
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k));

    // 3. ล้าง Firestore history subcollection (batch delete, max 500 ต่อ batch)
    try {
      const snap = await getDocs(collection(db, 'history', `pond_${id}`, 'readings'));
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (_) {}
  }, []);

  const getPondState = useCallback((id) => {
    const pond = ponds.find(p => p.id === id);
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

  return { ponds, updatePond, addPond, removePond, getPondState, sensorMeta, isConnected, clearPondHistory };
}
