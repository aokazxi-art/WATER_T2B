import { useState } from 'react';
import { login, saveSession } from '../auth/auth';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const user = await login(username, password);
    setLoading(false);
    if (user) { saveSession(user); onLogin(user); }
    else setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }

  const inputStyle = (hasError) => ({
    width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
    border: `1px solid ${hasError ? '#fca5a5' : '#d1d5db'}`,
    fontSize: 14, outline: 'none', color: '#111827', background: '#fff',
    transition: 'border-color .15s, box-shadow .15s',
  });

  function focusIn(e) {
    e.target.style.borderColor = '#0284c7';
    e.target.style.boxShadow   = '0 0 0 3px rgba(2,132,199,.12)';
  }
  function focusOut(e) {
    e.target.style.borderColor = error ? '#fca5a5' : '#d1d5db';
    e.target.style.boxShadow   = 'none';
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f1f5f9',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', width: 40, height: 40, borderRadius: 10,
            background: '#0284c7', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C12 2 4 9.5 4 15a8 8 0 0 0 16 0C20 9.5 12 2 12 2z"
                fill="white" opacity="0.9"/>
            </svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>Water Monitor</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>เข้าสู่ระบบเพื่อดำเนินการต่อ</div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '28px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,.07)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>ชื่อผู้ใช้</label>
              <input
                type="text" autoComplete="username"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                style={inputStyle(!!error)}
                onFocus={focusIn} onBlur={focusOut}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>รหัสผ่าน</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'} autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  style={{ ...inputStyle(!!error), paddingRight: 40 }}
                  onFocus={focusIn} onBlur={focusOut}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
                  display: 'flex', alignItems: 'center', padding: 2,
                }}>
                  {showPw ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                fontSize: 13, color: '#dc2626', background: '#fef2f2',
                border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px',
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              marginTop: 4, padding: '10px', borderRadius: 8, border: 'none',
              background: loading ? '#7ab8d8' : '#0284c7', color: '#fff', fontWeight: 600, fontSize: 14,
              cursor: loading ? 'default' : 'pointer', transition: 'background .12s',
            }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#0369a1'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#0284c7'; }}
            >{loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}</button>

          </form>
        </div>

      </div>
    </div>
  );
}
