export async function login(username, password) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
    });
    if (!res.ok) return null;
    return await res.json(); // { token, username, role, displayName }
  } catch {
    return null;
  }
}

export function saveSession(user) {
  sessionStorage.setItem('wm_auth', JSON.stringify(user));
}

export async function loadSession() {
  try {
    const s = sessionStorage.getItem('wm_auth');
    if (!s) return null;
    const stored = JSON.parse(s);
    if (!stored?.token) return null;
    const res = await fetch('/api/verify', {
      headers: { Authorization: `Bearer ${stored.token}` },
    });
    if (!res.ok) { clearSession(); return null; }
    const data = await res.json();
    return { token: stored.token, ...data };
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem('wm_auth');
}
