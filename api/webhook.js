// api/webhook.js — Vercel serverless function
// ChirpStack HTTP integration POSTs uplink events here.
// Local dev: keep using server/webhook.mjs instead.

import { getApps, initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

// ── Firebase init (guarded so warm instances don't re-init) ──────────────────

const firebaseConfig = {
  apiKey:            process.env.FIREBASE_API_KEY            ?? 'AIzaSyCI4NaqTuySWIsZHmNiMmgUet6ZWUkATis',
  authDomain:        't2bwater.firebaseapp.com',
  projectId:         process.env.FIREBASE_PROJECT_ID         ?? 't2bwater',
  storageBucket:     't2bwater.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? '857659938393',
  appId:             process.env.FIREBASE_APP_ID             ?? '1:857659938393:web:d7c0b30e40a01f06a1c348',
};

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);

// ── Device map: loaded once per cold start from pond_registry ────────────────
// Shape: { [devEui]: pondId }

let deviceMap = {};

const mapReady = getDocs(collection(db, 'pond_registry'))
  .then(snap => {
    snap.forEach(d => {
      const { deviceId, pondId } = d.data();
      if (deviceId && pondId) deviceMap[deviceId] = pondId;
    });
    console.log(`Loaded ${Object.keys(deviceMap).length} device(s) from pond_registry`);
  })
  .catch(err => console.error('Failed to load pond_registry:', err));

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    await mapReady;

    const payload = req.body;

    // Skip anything that isn't a data uplink
    if (!payload.deviceInfo || payload.fPort === undefined) {
      return res.status(200).send('Not an uplink, skipped');
    }

    const devEui = payload.deviceInfo.devEui;
    const pondId = deviceMap[devEui];

    if (!pondId) {
      console.warn('Unknown device:', devEui);
      return res.status(200).send('Unknown device');
    }

    const distance_mm = payload.object?.distance;  // mm, from ChirpStack codec
    const battery     = payload.object?.battery ?? null;
    const raw_cm      = distance_mm != null ? distance_mm / 10 : null;

    await setDoc(
      doc(db, 'ponds', pondId),
      {
        last_reading: {
          raw_cm,
          battery,
          rssi:      payload.rxInfo?.[0]?.rssi ?? null,
          snr:       payload.rxInfo?.[0]?.snr  ?? null,
          timestamp: Date.now(),
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true },
    );

    console.log(`pond=${pondId}  raw_cm=${raw_cm}  battery=${battery}`);
    return res.status(200).send('OK');

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).send('Internal error');
  }
}
