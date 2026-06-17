// api/verify.js — Vercel serverless function
// GET /api/verify  → validate the Bearer token, return the user claims.
// Logic mirrors server/webhook.mjs (local dev). Secret comes from Vercel env var:
//   JWT_SECRET

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default function handler(req, res) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return res.json({
      username:    payload.username,
      role:        payload.role,
      displayName: payload.displayName,
    });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
