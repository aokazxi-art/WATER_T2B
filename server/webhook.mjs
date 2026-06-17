// ============================================================
//  server/webhook.mjs
//  รับ uplink event จาก ChirpStack webhook → เขียนเข้า Firestore
//  รัน: node server/webhook.mjs
// ============================================================

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Load env from server/.env (not the root .env)
const _require = createRequire(import.meta.url);
const dotenv   = _require('dotenv');
dotenv.config({ path: join(__dirname, '.env') });

const jwt = (await import('jsonwebtoken')).default;

// ────────────────────────────────────────────────────────────
//  Firebase config
// ────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            'AIzaSyCI4NaqTuySWIsZHmNiMmgUet6ZWUkATis',
  authDomain:        't2bwater.firebaseapp.com',
  projectId:         't2bwater',
  storageBucket:     't2bwater.firebasestorage.app',
  messagingSenderId: '857659938393',
  appId:             '1:857659938393:web:d7c0b30e40a01f06a1c348',
};

const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);

// ────────────────────────────────────────────────────────────
//  Auth config (loaded from server/.env)
// ────────────────────────────────────────────────────────────

const USERS = {
  admin:  { password: process.env.ADMIN_PASSWORD,  role: 'admin',  displayName: 'ผู้ดูแลระบบ' },
  viewer: { password: process.env.VIEWER_PASSWORD, role: 'viewer', displayName: 'ผู้ชม' },
};

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRES = '8h';

// ────────────────────────────────────────────────────────────
//  config บ่อ: ความลึก (cm) และพื้นที่หน้าตัด (cm²)
// ────────────────────────────────────────────────────────────

const POND_CONFIG = {
  pond_1: { depth_cm: 200, area_cm2: 40000 },
};

function devEuiToPondId(devEui) {
  const map = { '0102030405060708': 'pond_1' };
  return map[devEui] ?? null;
}

// ────────────────────────────────────────────────────────────
//  Express
// ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Allow Vite dev server (port 5173) to call /api/* without CORS errors
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ────────────────────────────────────────────────────────────
//  POST /api/login
// ────────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { username, password } = req.body ?? {};
  const key  = String(username ?? '').trim().toLowerCase();
  const user = USERS[key];

  if (!user || !user.password || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const payload = { username: key, role: user.role, displayName: user.displayName };
  const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  return res.json({ token, ...payload });
});

// ────────────────────────────────────────────────────────────
//  GET /api/verify
// ────────────────────────────────────────────────────────────

app.get('/api/verify', (req, res) => {
  const auth = req.headers.authorization ?? '';
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
});

// ────────────────────────────────────────────────────────────
//  POST /webhook  — ChirpStack uplink
// ────────────────────────────────────────────────────────────

app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('📥 Received:', JSON.stringify(payload, null, 2));

    if (payload.data === undefined || payload.fPort === undefined) {
      return res.status(200).send('Not an uplink, skipped');
    }

    const devEui = payload.deviceInfo?.devEui;
    const pondId = devEuiToPondId(devEui);
    const config = POND_CONFIG[pondId];

    if (!config) {
      console.warn('⚠️  Unknown device:', devEui);
      return res.status(200).send('Unknown device');
    }

    const buf     = Buffer.from(payload.data, 'base64');
    const raw_cm  = buf.readUInt16BE(0);
    const battery = buf.readUInt8(2);

    await setDoc(doc(db, 'ponds', pondId), {
      last_reading: {
        raw_cm,
        battery,
        rssi:      payload.rxInfo?.[0]?.rssi ?? null,
        snr:       payload.rxInfo?.[0]?.snr  ?? null,
        timestamp: Date.now(),
        updatedAt: serverTimestamp(),
      },
    }, { merge: true });

    console.log(`✅ pond=${pondId}  raw=${raw_cm}cm  battery=${battery}%`);
    return res.status(200).send('OK');

  } catch (err) {
    console.error('❌ Webhook error:', err);
    return res.status(500).send('Internal error');
  }
});

// ────────────────────────────────────────────────────────────
//  Start server
// ────────────────────────────────────────────────────────────

app.listen(3002, () => {
  console.log('🚀 Webhook server running at http://localhost:3002');
});
