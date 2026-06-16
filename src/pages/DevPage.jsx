import { useState, useRef } from 'react';
import { ref, set as fbSet } from 'firebase/database';
import { collection, query, where, getDocs, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { calcWaterHeight, calcVolumeM3 } from '../utils/waterLevel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function generateRandomWalk(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0).getTime();
  let pct = 30 + Math.random() * 40;
  let battery = 70 + Math.random() * 25;
  const entries = {};
  for (let i = 0; i < 96; i++) {
    const time = startOfDay + i * 15 * 60 * 1000;
    const drift = (50 - pct) * 0.015;
    pct = Math.max(5, Math.min(95, pct + (Math.random() - 0.5) * 5 + drift));
    battery = Math.max(5, battery - Math.random() * 0.15);
    entries[`g${i}`] = { pct: Math.round(pct * 10) / 10, time, battery: Math.round(battery) };
  }
  return entries;
}

// Parse "27/5/2026 15:25" → unix ms
function parseMilesightTime(str) {
  try {
    const [datePart, timePart = '0:0'] = str.trim().split(' ');
    const [d, m, y] = datePart.split('/').map(Number);
    const [h, mn] = timePart.split(':').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, h, mn, 0).getTime();
  } catch { return null; }
}

function parseCSVLine(line) {
  return line.split(',').map(v => v.trim().replace(/^"|"$/g, '').trim());
}

function parseImportCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { rows: [], parseErrors: ['ไฟล์ว่างหรือไม่มีข้อมูล'] };
  const rows = [];
  const parseErrors = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 5) { parseErrors.push(`แถว ${i + 1}: คอลัมน์ไม่ครบ (${cols.length})`); continue; }
    const [timeStr, distStr, , , battStr] = cols;
    const timestamp = parseMilesightTime(timeStr);
    if (!timestamp) { parseErrors.push(`แถว ${i + 1}: เวลาผิดรูปแบบ "${timeStr}"`); continue; }
    const distM = parseFloat(distStr);
    if (isNaN(distM)) { parseErrors.push(`แถว ${i + 1}: ระยะผิดรูปแบบ "${distStr}"`); continue; }
    const battery = parseInt(battStr);
    rows.push({
      timestamp,
      raw_cm: Math.round(distM * 1000) / 10,
      battery: isNaN(battery) ? null : battery,
      _timeStr: timeStr,
    });
  }
  return { rows, parseErrors };
}

// ── Shared style helpers ───────────────────────────────────────────────────────

const card = {
  background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
  padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
};

function btnStyle(color, disabled) {
  return {
    padding: '9px 0', borderRadius: 7, border: 'none', fontWeight: 600,
    fontSize: 13, color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? `${color}88` : color, transition: 'background .15s',
  };
}

function logBoxStyle(isError) {
  return {
    padding: '10px 12px', borderRadius: 6, fontSize: 12, color: '#374151',
    background: isError ? '#fef2f2' : '#f0fdf4',
    border: `1px solid ${isError ? '#fecaca' : '#bbf7d0'}`,
    display: 'flex', flexDirection: 'column', gap: 3,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DevPage({ ponds, onBack }) {
  const yesterday = () => {
    const d = new Date(); d.setDate(d.getDate() - 1); return dayStr(d);
  };

  // Shared (Generate + Export)
  const [selectedPonds, setSelectedPonds] = useState(() => new Set(ponds.map(p => p.id)));
  const [targetDate,    setTargetDate]    = useState(yesterday);

  // Generate
  const [genStatus, setGenStatus] = useState(null);
  const [genLog,    setGenLog]    = useState([]);

  // Export
  const [exportStatus, setExportStatus] = useState(null);
  const [exportLog,    setExportLog]    = useState([]);

  // Import
  const [importPondId,     setImportPondId]     = useState(ponds[0]?.id ?? null);
  const [importRows,       setImportRows]       = useState(null);
  const [importFileName,   setImportFileName]   = useState('');
  const [importParseErrors,setImportParseErrors]= useState([]);
  const [importStatus,     setImportStatus]     = useState(null);
  const [importLog,        setImportLog]        = useState([]);
  const fileInputRef = useRef(null);

  const allSelected = selectedPonds.size === ponds.length;

  function togglePond(id) {
    setSelectedPonds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Generate ─────────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (genStatus === 'running' || selectedPonds.size === 0) return;
    setGenStatus('running'); setGenLog([]);
    const msgs = [];
    try {
      for (const pond of ponds) {
        if (!selectedPonds.has(pond.id)) continue;
        const entries = generateRandomWalk(targetDate);
        const pondId  = pond.id;
        await fbSet(ref(db, `pond_history/${pondId}/${targetDate}`), entries);
        const arr = Object.values(entries).sort((a, b) => a.time - b.time);
        try { localStorage.setItem(`water_daily_${pondId}_${targetDate}`, JSON.stringify(arr)); } catch (_) {}
        msgs.push(`✓ ${pond.name} — ${arr.length} entries`);
        setGenLog([...msgs]);
      }
      setGenStatus('done');
    } catch (err) {
      msgs.push(`✗ ${err.message}`);
      setGenLog([...msgs]);
      setGenStatus('error');
    }
  }

  // ── Export CSV (Milesight format) ─────────────────────────────────────────────
  async function handleExport() {
    if (exportStatus === 'running' || selectedPonds.size === 0) return;
    setExportStatus('running'); setExportLog([]);
    const msgs = [];
    try {
      const rows = ['Time,Distance/Level,Water_Depth,Volume,Battery'];

      for (const pond of ponds) {
        if (!selectedPonds.has(pond.id)) continue;

        const q    = query(
          collection(db, 'history', `pond_${pond.id}`, 'readings'),
          where('date', '==', targetDate),
        );
        const snap     = await getDocs(q);
        const readings = snap.docs.map(d => d.data()).sort((a, b) => a.timestamp - b.timestamp);

        for (const r of readings) {
          const dt      = new Date(r.timestamp);
          const timeStr = `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
          const distM   = (r.raw_cm / 100).toFixed(3);
          const wh      = calcWaterHeight(r.raw_cm, pond.depth, pond.sensorOffset ?? 30);
          const whM     = Math.max(0, wh / 100).toFixed(3);
          const vol     = Math.round(calcVolumeM3(pond.area, Math.max(0, wh)));
          const batt    = r.battery != null ? `${r.battery}%` : '';
          rows.push(`"${timeStr}","${distM} m","${whM} m","${vol} m³","${batt}"`);
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
      a.href = url; a.download = `water_data_${targetDate}.csv`; a.click();
      URL.revokeObjectURL(url);

      msgs.push(`รวม ${rows.length - 1} แถว → water_data_${targetDate}.csv`);
      setExportLog([...msgs]);
      setExportStatus('done');
    } catch (err) {
      msgs.push(`✗ ${err.message}`);
      setExportLog([...msgs]);
      setExportStatus('error');
    }
  }

  // ── Import CSV ────────────────────────────────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportStatus(null);
    setImportLog([]);
    const reader = new FileReader();
    reader.onload = ev => {
      const { rows, parseErrors } = parseImportCSV(ev.target.result);
      setImportRows(rows);
      setImportParseErrors(parseErrors);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function handleImport() {
    if (!importRows?.length || !importPondId || importStatus === 'running') return;
    setImportStatus('running'); setImportLog([]);
    const msgs = [];
    let success = 0, failed = 0;
    const BATCH = 500;

    for (let i = 0; i < importRows.length; i += BATCH) {
      const chunk = importRows.slice(i, i + BATCH);
      const batch = writeBatch(db);
      for (const row of chunk) {
        const d    = new Date(row.timestamp);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const ref  = doc(collection(db, 'history', `pond_${importPondId}`, 'readings'));
        batch.set(ref, {
          raw_cm:     row.raw_cm,
          battery:    row.battery,
          timestamp:  row.timestamp,
          date,
          importedAt: serverTimestamp(),
        });
      }
      try {
        await batch.commit();
        success += chunk.length;
      } catch (e) {
        failed += chunk.length;
        msgs.push(`✗ batch ล้มเหลว: ${e.message}`);
      }
      msgs.push(`อัปโหลด ${Math.min(i + BATCH, importRows.length)} / ${importRows.length} แถว`);
      setImportLog([...msgs]);
    }

    const summary = failed
      ? `เสร็จ — สำเร็จ ${success} แถว / ล้มเหลว ${failed} แถว`
      : `เสร็จ — นำเข้า ${success} แถว สำเร็จ`;
    msgs.push(summary);
    setImportLog([...msgs]);
    setImportStatus(failed ? 'error' : 'done');
  }

  function resetImport() {
    setImportRows(null); setImportFileName(''); setImportParseErrors([]);
    setImportStatus(null); setImportLog([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const importPond = ponds.find(p => p.id === importPondId);

  // ── Render ────────────────────────────────────────────────────────────────────
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
          display: 'flex', alignItems: 'center', gap: 4, background: 'none',
          border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          color: '#64748b', padding: '4px 0',
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

      <div style={{ maxWidth: 560, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Shared controls (date + pond) ── */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
            ตัวกรอง — ใช้ร่วมกันโดย Generate &amp; Export
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 5 }}>วันที่</label>
            <input
              type="date" value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              max={dayStr(new Date())}
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', outline: 'none', background: '#fff' }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span>บ่อ</span>
              <button
                onClick={() => setSelectedPonds(allSelected ? new Set() : new Set(ponds.map(p => p.id)))}
                style={{ fontSize: 11, color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}
              >
                {allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
              {ponds.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#0f172a', userSelect: 'none' }}>
                  <input type="checkbox" checked={selectedPonds.has(p.id)} onChange={() => togglePond(p.id)}
                    style={{ accentColor: '#0284c7', width: 14, height: 14, cursor: 'pointer' }} />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── Generate Test History ── */}
        <div style={card}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>Generate Test History</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>สร้างข้อมูลย้อนหลัง 96 จุด (ทุก 15 นาที) แบบ random walk ลง Firebase</div>
          </div>
          <button onClick={handleGenerate} disabled={genStatus === 'running' || selectedPonds.size === 0}
            style={btnStyle('#0284c7', genStatus === 'running' || selectedPonds.size === 0)}>
            {genStatus === 'running' ? 'กำลังสร้าง...' : 'Generate Test History'}
          </button>
          {genLog.length > 0 && (
            <div style={logBoxStyle(genStatus === 'error')}>
              {genLog.map((m, i) => <span key={i}>{m}</span>)}
              {genStatus === 'done' && <span style={{ marginTop: 4, fontWeight: 600, color: '#16a34a' }}>เสร็จแล้ว — เปิดหน้า Level History เพื่อดูข้อมูล</span>}
            </div>
          )}
        </div>

        {/* ── Export CSV ── */}
        <div style={card}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>Export CSV</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>ดาวน์โหลดข้อมูลจาก Firestore ในรูปแบบ Milesight Dashboard (Time, Distance/Level, Water_Depth, Volume, Battery)</div>
          </div>
          <button onClick={handleExport} disabled={exportStatus === 'running' || selectedPonds.size === 0}
            style={btnStyle('#65a30d', exportStatus === 'running' || selectedPonds.size === 0)}>
            {exportStatus === 'running' ? 'กำลัง Export...' : 'Export CSV'}
          </button>
          {exportLog.length > 0 && (
            <div style={logBoxStyle(exportStatus === 'error')}>
              {exportLog.map((m, i) => <span key={i}>{m}</span>)}
            </div>
          )}
        </div>

        {/* ── Import CSV ── */}
        <div style={card}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>Import CSV</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>นำเข้าไฟล์ CSV จาก Milesight Dashboard — คอลัมน์: Time, Distance/Level, Water_Depth, Volume, Battery</div>
          </div>

          {/* Pond picker */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 5 }}>บ่อปลายทาง</label>
            <select
              value={importPondId ?? ''}
              onChange={e => setImportPondId(Number(e.target.value))}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', outline: 'none', background: '#fff' }}
            >
              {ponds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* File picker */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 5 }}>ไฟล์ CSV</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 500, color: '#475569', background: '#f8fafc', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                เลือกไฟล์
              </button>
              <span style={{ fontSize: 12, color: importFileName ? '#0f172a' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {importFileName || 'ยังไม่ได้เลือกไฟล์'}
              </span>
              {importFileName && (
                <button onClick={resetImport} style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>ล้าง</button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
          </div>

          {/* Parse errors */}
          {importParseErrors.length > 0 && (
            <div style={logBoxStyle(true)}>
              <span style={{ fontWeight: 600, marginBottom: 2 }}>พบแถวที่ parse ไม่ได้ {importParseErrors.length} แถว (จะถูกข้าม):</span>
              {importParseErrors.slice(0, 5).map((e, i) => <span key={i}>{e}</span>)}
              {importParseErrors.length > 5 && <span>...และอีก {importParseErrors.length - 5} แถว</span>}
            </div>
          )}

          {/* Preview */}
          {importRows && importRows.length > 0 && importStatus !== 'done' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 6 }}>
                ตัวอย่าง 5 แถวแรก จากทั้งหมด <strong>{importRows.length}</strong> แถว
              </div>
              <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['เวลา (Time)', 'raw_cm', 'battery'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 5).map((r, i) => (
                      <tr key={i} style={{ borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ padding: '5px 10px', color: '#374151' }}>{r._timeStr}</td>
                        <td style={{ padding: '5px 10px', color: '#374151' }}>{r.raw_cm} cm</td>
                        <td style={{ padding: '5px 10px', color: '#374151' }}>{r.battery != null ? `${r.battery}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Confirm import button */}
          {importRows && importRows.length > 0 && importStatus !== 'done' && (
            <button
              onClick={handleImport}
              disabled={importStatus === 'running'}
              style={btnStyle('#7c3aed', importStatus === 'running')}
            >
              {importStatus === 'running'
                ? 'กำลัง Import...'
                : `Import ${importRows.length} แถว → ${importPond?.name ?? ''}`}
            </button>
          )}

          {/* Import log */}
          {importLog.length > 0 && (
            <div style={logBoxStyle(importStatus === 'error')}>
              {importLog.map((m, i) => <span key={i}>{m}</span>)}
              {importStatus === 'done' && (
                <span style={{ marginTop: 4, fontWeight: 600, color: '#16a34a' }}>
                  เปิดหน้า Level History เพื่อดูกราฟ
                </span>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
