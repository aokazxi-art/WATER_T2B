import { useState } from 'react';
import { ref, set as fbSet } from 'firebase/database';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

function dayStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function generateRandomWalk(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0).getTime();

  let pct = 30 + Math.random() * 40; // start 30–70%
  let battery = 70 + Math.random() * 25; // start 70–95%
  const entries = {};

  for (let i = 0; i < 96; i++) {
    const time = startOfDay + i * 15 * 60 * 1000;

    // random walk with weak mean reversion toward 50%
    const drift = (50 - pct) * 0.015;
    pct = Math.max(5, Math.min(95, pct + (Math.random() - 0.5) * 5 + drift));

    // battery slowly drains
    battery = Math.max(5, battery - Math.random() * 0.15);

    entries[`g${i}`] = {
      pct:     Math.round(pct * 10) / 10,
      time,
      battery: Math.round(battery),
    };
  }
  return entries;
}

export default function DevPage({ ponds, onBack }) {
  const yesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dayStr(d);
  };

  const [selectedPonds, setSelectedPonds] = useState(() => new Set(ponds.map(p => p.id)));
  const [targetDate,    setTargetDate]    = useState(yesterday);
  const [status,        setStatus]        = useState(null); // null | 'running' | 'done' | 'error'
  const [log,           setLog]           = useState([]);
  const [exportStatus,  setExportStatus]  = useState(null);
  const [exportLog,     setExportLog]     = useState([]);

  function togglePond(id) {
    setSelectedPonds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const allSelected = selectedPonds.size === ponds.length;

  async function handleGenerate() {
    if (status === 'running' || selectedPonds.size === 0) return;
    setStatus('running');
    setLog([]);
    const msgs = [];

    try {
      for (const pond of ponds) {
        if (!selectedPonds.has(pond.id)) continue;

        const entries = generateRandomWalk(targetDate);
        const pondId  = pond.id;

        // write to Firebase
        await fbSet(ref(db, `pond_history/${pondId}/${targetDate}`), entries);

        // write to localStorage cache
        const arr = Object.values(entries).sort((a, b) => a.time - b.time);
        try {
          localStorage.setItem(`water_daily_${pondId}_${targetDate}`, JSON.stringify(arr));
        } catch (_) {}

        msgs.push(`✓ ${pond.name} — ${arr.length} entries`);
        setLog([...msgs]);
      }
      setStatus('done');
    } catch (err) {
      msgs.push(`✗ Error: ${err.message}`);
      setLog([...msgs]);
      setStatus('error');
    }
  }

  async function handleExport() {
    if (exportStatus === 'running' || selectedPonds.size === 0) return;
    setExportStatus('running');
    setExportLog([]);
    const msgs = [];

    try {
      const pad = n => String(n).padStart(2, '0');
      const rows = ['datetime,pond,raw_cm,water_pct,battery'];

      for (const pond of ponds) {
        if (!selectedPonds.has(pond.id)) continue;

        const q    = query(
          collection(db, 'history', `pond_${pond.id}`, 'readings'),
          where('date', '==', targetDate),
        );
        const snap     = await getDocs(q);
        const readings = snap.docs.map(d => d.data()).sort((a, b) => a.timestamp - b.timestamp);

        for (const r of readings) {
          const dt    = new Date(r.timestamp);
          const dtStr = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
          rows.push(`${dtStr},${pond.name},${r.raw_cm ?? ''},${r.pct ?? ''},${r.battery ?? ''}`);
        }

        msgs.push(`✓ ${pond.name} — ${readings.length} rows`);
        setExportLog([...msgs]);
      }

      if (rows.length === 1) {
        msgs.push('ไม่พบข้อมูลในวันที่นี้');
        setExportLog([...msgs]);
        setExportStatus('error');
        return;
      }

      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `water_data_${targetDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      msgs.push(`รวม ${rows.length - 1} แถว — บันทึกแล้ว water_data_${targetDate}.csv`);
      setExportLog([...msgs]);
      setExportStatus('done');
    } catch (err) {
      msgs.push(`✗ Error: ${err.message}`);
      setExportLog([...msgs]);
      setExportStatus('error');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>

      {/* Navbar */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 24px', height: 52,
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, color: '#64748b', padding: '4px 0',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          กลับ
        </button>
        <div style={{ width: 1, height: 18, background: '#e2e8f0' }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Dev Tools</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Admin only</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 520, margin: '0 auto', padding: 24 }}>
        <div style={{
          background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 20,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
              Generate Test History
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              สร้างข้อมูลย้อนหลัง 96 จุด (ทุก 15 นาที / 24 ชั่วโมง) แบบ random walk ลง Firebase
            </div>
          </div>

          {/* Date */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 5 }}>
              วันที่
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              max={dayStr(new Date())}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '7px 10px', borderRadius: 6,
                border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a',
                outline: 'none', background: '#fff',
              }}
            />
          </div>

          {/* Pond selector */}
          <div>
            <div style={{
              fontSize: 12, fontWeight: 500, color: '#475569',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 8,
            }}>
              <span>บ่อที่ต้องการ</span>
              <button
                onClick={() => setSelectedPonds(allSelected ? new Set() : new Set(ponds.map(p => p.id)))}
                style={{ fontSize: 11, color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}
              >
                {allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {ponds.map(pond => (
                <label key={pond.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#0f172a', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={selectedPonds.has(pond.id)}
                    onChange={() => togglePond(pond.id)}
                    style={{ accentColor: '#0284c7', width: 14, height: 14, cursor: 'pointer' }}
                  />
                  {pond.name}
                </label>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={status === 'running' || selectedPonds.size === 0}
            style={{
              padding: '9px 0', borderRadius: 7,
              background: (status === 'running' || selectedPonds.size === 0) ? '#7dd3fc' : '#0284c7',
              color: '#fff', border: 'none', fontWeight: 600, fontSize: 13,
              cursor: (status === 'running' || selectedPonds.size === 0) ? 'not-allowed' : 'pointer',
              transition: 'background .15s',
            }}
          >
            {status === 'running' ? 'กำลังสร้าง...' : 'Generate Test History'}
          </button>

          {/* Log output */}
          {log.length > 0 && (
            <div style={{
              padding: '10px 12px',
              background: status === 'error' ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${status === 'error' ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: 6, fontSize: 12, color: '#374151',
              display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              {log.map((m, i) => <span key={i}>{m}</span>)}
              {status === 'done' && (
                <span style={{ marginTop: 4, fontWeight: 600, color: '#16a34a' }}>
                  เสร็จแล้ว — เปิดหน้า Level History เพื่อดูข้อมูล
                </span>
              )}
            </div>
          )}

        </div>

        {/* ── Export CSV ────────────────────────────────────────── */}
        <div style={{
          background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 20,
          display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
              Export CSV
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              ดาวน์โหลดข้อมูล sensor จาก Firestore เป็นไฟล์ CSV ตามวันที่และบ่อที่เลือก
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={exportStatus === 'running' || selectedPonds.size === 0}
            style={{
              padding: '9px 0', borderRadius: 7,
              background: (exportStatus === 'running' || selectedPonds.size === 0) ? '#a3e635' : '#65a30d',
              color: '#fff', border: 'none', fontWeight: 600, fontSize: 13,
              cursor: (exportStatus === 'running' || selectedPonds.size === 0) ? 'not-allowed' : 'pointer',
              transition: 'background .15s',
            }}
          >
            {exportStatus === 'running' ? 'กำลังโหลด...' : 'Export CSV'}
          </button>

          {exportLog.length > 0 && (
            <div style={{
              padding: '10px 12px',
              background: exportStatus === 'error' ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${exportStatus === 'error' ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: 6, fontSize: 12, color: '#374151',
              display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              {exportLog.map((m, i) => <span key={i}>{m}</span>)}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
