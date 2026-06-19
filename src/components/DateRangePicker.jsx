import { useState, useEffect, useRef, useMemo } from 'react';

// ── ตัวเลือกช่วงวันที่ (date range picker) ────────────────────────────────────
// คลิกวันแรก = วันเริ่ม, คลิกวันที่สอง = วันสิ้นสุด (สลับให้อัตโนมัติถ้าเลือกย้อน)
// ปุ่ม preset ด้านซ้ายเลือกช่วงสำเร็จรูป · จุดใต้วัน = วันที่มีข้อมูล
//
// props:
//   value    : { start, end }  รูปแบบ 'YYYY-MM-DD'
//   onChange : ({ start, end }) => void   (เรียกเมื่อเลือกช่วงครบ)
//   accent   : สีเน้น (default น้ำเงิน)
//   loadDays : async (year, month) => Set<number>  คืนเลขวันที่มีข้อมูล (optional)

const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const SH  = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const DOW = ['อา','จ','อ','พ','พฤ','ศ','ส'];

// 'YYYY-MM-DD' → Date (สร้างแบบ local เลี่ยงปัญหา timezone ของ new Date(string))
function parse(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function strip(d)      { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function same(a, b)    { return a && b && a.getTime() === b.getTime(); }
function lohi(a, b)    { return a.getTime() <= b.getTime() ? [a, b] : [b, a]; }
function fmtShort(d)   { return `${d.getDate()} ${SH[d.getMonth()]}`; }
function fmtFull(d)    { return `${d.getDate()} ${SH[d.getMonth()]} ${d.getFullYear()+543}`; }

function fmtRange(s, e) {
  const a = parse(s), b = parse(e);
  if (!a || !b) return 'เลือกช่วงวัน';
  if (same(a, b)) return fmtFull(a);
  return `${fmtShort(a)} – ${fmtFull(b)}`;
}

export default function DateRangePicker({ value, onChange, accent = '#185FA5', loadDays }) {
  const today = useMemo(() => strip(new Date()), []);
  const [open, setOpen]   = useState(false);
  const [sel, setSel]     = useState({ start: parse(value.start), end: parse(value.end) });
  const [hover, setHover] = useState(null);
  const [view, setView]   = useState(() => {
    const base = parse(value.end) || today;
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const [daysData, setDaysData] = useState(() => new Set());
  const [panel, setPanel]       = useState('days');   // 'days' | 'years'
  const [yearBase, setYearBase] = useState(() => (parse(value.end) || today).getFullYear() - 6);
  const rootRef = useRef(null);

  // เปิด/ปิด popover — ตอนเปิดให้ sel + เดือนที่ดู ตรงกับ value ปัจจุบัน
  function toggleOpen() {
    setOpen(o => {
      if (!o) {
        const base = parse(value.end) || today;
        setSel({ start: parse(value.start), end: parse(value.end) });
        setView({ y: base.getFullYear(), m: base.getMonth() });
        setHover(null);
        setPanel('days');
      }
      return !o;
    });
  }

  // ปิด popover เมื่อคลิกนอกกรอบ
  useEffect(() => {
    if (!open) return;
    const onDocClick = e => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // โหลดวันที่มีข้อมูลของเดือนที่กำลังดู
  useEffect(() => {
    if (!open || !loadDays) return;
    let cancelled = false;
    loadDays(view.y, view.m).then(set => { if (!cancelled) setDaysData(set || new Set()); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, view.y, view.m, loadDays]);

  function commit(a, b) {
    const [lo, hi] = lohi(a, b);
    onChange({ start: toStr(lo), end: toStr(hi) });
    setSel({ start: lo, end: hi });
    setHover(null);
    setOpen(false);
  }

  function clickDay(d) {
    if (!sel.start || (sel.start && sel.end)) {
      setSel({ start: d, end: null });   // เริ่มเลือกใหม่
    } else {
      commit(sel.start, d);              // คลิกที่สอง → ปิดช่วง
    }
  }

  function setPreset(a, b) {
    setView({ y: b.getFullYear(), m: b.getMonth() });
    commit(a, b);
  }

  const presets = [
    ['วันนี้',        () => [today, today]],
    ['เมื่อวาน',      () => { const y = addDays(today, -1); return [y, y]; }],
    ['7 วันล่าสุด',   () => [addDays(today, -6), today]],
    ['30 วันล่าสุด',  () => [addDays(today, -29), today]],
    ['เดือนนี้',      () => [new Date(today.getFullYear(), today.getMonth(), 1), today]],
  ];

  function prevMonth() { setView(v => v.m === 0  ? { y: v.y-1, m: 11 } : { y: v.y, m: v.m-1 }); }
  function nextMonth() { setView(v => v.m === 11 ? { y: v.y+1, m: 0  } : { y: v.y, m: v.m+1 }); }

  // กดที่ชื่อเดือน-ปี → เปิดตารางเลือกปี (drill-up แบบ dashboard มืออาชีพ)
  function openYears() { setYearBase(view.y - 6); setPanel('years'); }
  function pickYear(y) { setView(v => ({ ...v, y })); setPanel('days'); }

  // สร้างช่องวันของเดือน
  const cells = useMemo(() => {
    const firstDay = new Date(view.y, view.m, 1).getDay();
    const dim      = new Date(view.y, view.m + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let d = 1; d <= dim; d++) arr.push(d);
    return arr;
  }, [view.y, view.m]);

  return (
    <div ref={rootRef} style={{ position:'relative', display:'inline-block' }}>
      {/* ปุ่มเปิดปฏิทิน — โชว์ช่วงที่เลือกอยู่ */}
      <button onClick={toggleOpen} style={{
        display:'flex', alignItems:'center', gap:8, padding:'7px 14px',
        borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
        border:`1.5px solid ${open ? accent : '#e2e8f0'}`,
        background: open ? `${accent}10` : '#f8fafc', color:'#475569',
        transition:'all .15s',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        {fmtRange(value.start, value.end)}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:50,
          background:'#fff', border:'1px solid #e2e8f0', borderRadius:14,
          boxShadow:'0 12px 40px rgba(15,30,53,.16)', display:'flex', overflow:'hidden',
        }}>
          {/* presets */}
          <div style={{ width:128, flexShrink:0, borderRight:'1px solid #f1f5f9',
            padding:'10px 8px', display:'flex', flexDirection:'column', gap:2 }}>
            {presets.map(([label, fn]) => (
              <button key={label} onClick={() => { const [a,b] = fn(); setPreset(a,b); }} style={{
                textAlign:'left', fontSize:12, fontWeight:500, padding:'8px 10px',
                border:'none', borderRadius:8, background:'transparent',
                color:'#64748b', cursor:'pointer', whiteSpace:'nowrap',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {label}
              </button>
            ))}
          </div>

          {/* calendar */}
          <div style={{ padding:'12px 14px', width:266 }}>

            {panel === 'years' ? (
              <>
                {/* ── ตารางเลือกปี ── */}
                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:8 }}>
                  <button onClick={() => setYearBase(b => b - 12)} style={navBtn} aria-label="ย้อน 12 ปี">‹</button>
                  <span style={{ flex:1, textAlign:'center', fontSize:13, fontWeight:700, color:'#0f172a' }}>
                    {yearBase + 543} – {yearBase + 11 + 543}
                  </span>
                  <button onClick={() => setYearBase(b => b + 12)} style={navBtn} aria-label="ถัดไป 12 ปี">›</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, padding:'4px 0' }}>
                  {Array.from({ length:12 }, (_, i) => yearBase + i).map(y => {
                    const future    = y > today.getFullYear();
                    const selectedY = y === view.y;
                    const thisYear  = y === today.getFullYear();
                    let bg = 'transparent', col = '#334155', bd = '1.5px solid transparent';
                    if (selectedY)      { bg = accent; col = '#fff'; }
                    else if (thisYear)  { bd = `1.5px solid ${accent}`; col = accent; }
                    if (future)         { col = '#e2e8f0'; }
                    return (
                      <button key={y} disabled={future} onClick={() => pickYear(y)}
                        style={{ height:46, borderRadius:8, padding:0, fontSize:13,
                          fontWeight: (thisYear || selectedY) ? 800 : 500,
                          cursor: future ? 'default' : 'pointer',
                          background:bg, color:col, border:bd, transition:'background .12s' }}>
                        {y + 543}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
            <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:8 }}>
              <button onClick={prevMonth} style={navBtn} aria-label="เดือนก่อนหน้า">‹</button>
              <button onClick={openYears} style={titleBtn} aria-label="เลือกปี">
                {MONTHS[view.m]} {view.y + 543}
              </button>
              <button onClick={nextMonth} style={navBtn} aria-label="เดือนถัดไป">›</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
              {DOW.map(d => (
                <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#94a3b8', padding:'2px 0' }}>{d}</div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={`e${i}`} />;
                const d        = strip(new Date(view.y, view.m, day));
                const future   = d > today;
                const isToday  = same(d, today);
                const isStart  = same(d, sel.start);
                const isEnd    = same(d, sel.end);
                const isEdge   = isStart || isEnd;
                const previewE = sel.end || hover;
                let inRange = false;
                if (sel.start && previewE) { const [lo,hi] = lohi(sel.start, previewE); inRange = d >= lo && d <= hi; }

                let bg = 'transparent', col = '#334155', bd = '1.5px solid transparent';
                if (inRange && !isEdge) { bg = `${accent}1f`; col = '#0C447C'; }
                if (isEdge)             { bg = accent; col = '#fff'; }
                if (future)             { col = '#e2e8f0'; }
                if (isToday && !isEdge) { bd = `1.5px solid ${accent}`; col = accent; }

                return (
                  <button key={day} disabled={future}
                    onClick={() => clickDay(d)}
                    onMouseEnter={() => { if (sel.start && !sel.end) setHover(d); }}
                    style={{
                      position:'relative', height:38, borderRadius:8, padding:0,
                      fontSize:13, fontWeight: isToday ? 800 : 500,
                      cursor: future ? 'default' : 'pointer',
                      background:bg, color:col, border:bd, transition:'background .12s',
                    }}>
                    {day}
                    {daysData.has(day) && !isEdge && (
                      <span style={{ position:'absolute', bottom:4, left:'50%', transform:'translateX(-50%)',
                        width:4, height:4, borderRadius:'50%',
                        background: inRange ? '#0C447C' : accent, opacity:0.7 }}/>
                    )}
                  </button>
                );
              })}
            </div>
              </>
            )}

            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10,
              paddingTop:10, borderTop:'1px solid #f1f5f9' }}>
              <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#94a3b8' }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:accent }}/>มีข้อมูล
              </span>
              <span style={{ marginLeft:'auto', fontSize:12, fontWeight:600, color:'#64748b' }}>
                {sel.start && !sel.end ? 'เลือกวันสิ้นสุด...' : fmtRange(value.start, value.end)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn = {
  background:'none', border:'none', cursor:'pointer',
  fontSize:18, color:'#475569', padding:'0 8px', lineHeight:1,
};

const titleBtn = {
  flex:1, textAlign:'center', fontSize:13, fontWeight:700, color:'#0f172a',
  background:'none', border:'none', cursor:'pointer', padding:'4px 0', borderRadius:6,
};
