// api/login.js — Vercel serverless function
// POST /api/login  → verify credentials, return a signed JWT.
// Logic mirrors server/webhook.mjs (local dev). Secrets come from Vercel env vars:
//   ADMIN_PASSWORD, VIEWER_PASSWORD, JWT_SECRET

import jwt from 'jsonwebtoken';

const USERS = {
  admin:  { password: process.env.ADMIN_PASSWORD,  role: 'admin',  displayName: 'ผู้ดูแลระบบ' },
  viewer: { password: process.env.VIEWER_PASSWORD, role: 'viewer', displayName: 'ผู้ชม' },
};

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRES = '8h';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username, password } = req.body ?? {};
  const key  = String(username ?? '').trim().toLowerCase();
  const user = USERS[key];

  if (!user || !user.password || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const payload = { username: key, role: user.role, displayName: user.displayName };
  const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  return res.json({ token, ...payload });
}
