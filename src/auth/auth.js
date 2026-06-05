// ข้อมูล credentials ของ 2 roles
// รหัสถูก generate สุ่มอัตโนมัติ
export const USERS = {
  admin: {
    password:    'Kf8!qZ3m',
    role:        'admin',
    displayName: 'ผู้ดูแลระบบ',
  },
  viewer: {
    password:    'Rw5@jN7p',
    role:        'viewer',
    displayName: 'ผู้ชม',
  },
};

export function login(username, password) {
  const user = USERS[username.trim().toLowerCase()];
  if (!user || user.password !== password) return null;
  return { username: username.trim().toLowerCase(), role: user.role, displayName: user.displayName };
}

export function saveSession(user) {
  sessionStorage.setItem('wm_auth', JSON.stringify(user));
}

export function loadSession() {
  try {
    const s = sessionStorage.getItem('wm_auth');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function clearSession() {
  sessionStorage.removeItem('wm_auth');
}
