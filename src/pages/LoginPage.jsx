import { useState } from 'react';
import { login, saveSession } from '../auth/auth';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [shake,    setShake]    = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    const user = login(username, password);
    if (user) {
      saveSession(user);
      onLogin(user);
    } else {
      setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-5px)}
          80%{transform:translateX(5px)}
        }
      `}</style>

      <div style={{
        background: '#fff', borderRadius: 20, padding: '40px 36px',
        boxShadow: '0 8px 40px #0002', width: '100%', maxWidth: 380,
        animation: shake ? 'shake .45s ease' : 'none',
      }}>
        {/* Logo / title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #0ea5e9, #22c55e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', fontSize: 26,
          }}>💧</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Water Level Monitor</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8' }}>กรุณาเข้าสู่ระบบ</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Username */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>ชื่อผู้ใช้</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              placeholder="admin หรือ viewer"
              style={{
                padding: '10px 14px', borderRadius: 10,
                border: `1.5px solid ${error ? '#fca5a5' : '#e2e8f0'}`,
                fontSize: 14, outline: 'none', color: '#0f172a',
                transition: 'border-color .15s',
              }}
              onFocus={e => { if (!error) e.target.style.borderColor = '#38bdf8'; }}
              onBlur={e => { if (!error) e.target.style.borderColor = '#e2e8f0'; }}
            />
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>รหัสผ่าน</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 44px 10px 14px', borderRadius: 10,
                  border: `1.5px solid ${error ? '#fca5a5' : '#e2e8f0'}`,
                  fontSize: 14, outline: 'none', color: '#0f172a',
                  boxSizing: 'border-box', transition: 'border-color .15s',
                }}
                onFocus={e => { if (!error) e.target.style.borderColor = '#38bdf8'; }}
                onBlur={e => { if (!error) e.target.style.borderColor = '#e2e8f0'; }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 15, color: '#94a3b8', padding: 2,
                }}
              >{showPw ? '🙈' : '👁'}</button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              fontSize: 12, color: '#ef4444', background: '#fef2f2',
              border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px',
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            style={{
              marginTop: 4, padding: '12px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #0ea5e9, #22c55e)',
              color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
              transition: 'opacity .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '.88'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
}
