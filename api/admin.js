// ============================================================
// RHF ZERO — api/admin.js
// Admin Panel API — CRUD Kode Akses + User Management
// ============================================================

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ============================================================
// INISIALISASI FIREBASE ADMIN
// ============================================================
function getDB() {
  if (getApps().length === 0) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '')
      .replace(/\\n/g, '\n')
      .replace(/"/g, '');

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'rhf-confrims',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
        privateKey: privateKey,
      }),
      projectId: process.env.FIREBASE_PROJECT_ID || 'rhf-confrims',
    });
  }
  return getFirestore();
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, password, data } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password diperlukan' });
  }

  // Verifikasi password dari ENV
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Password salah.' });
  }

  try {
    const db = getDB();

    switch (action) {

      // ============================================================
      // BUAT KODE AKSES
      // ============================================================
      case 'createCode': {
        const code = (data?.code || '').trim().toUpperCase();
        if (!code) return res.json({ success: false, error: 'Kode diperlukan.' });

        // Cek apakah kode sudah ada
        const existing = await db.collection('access_codes').doc(code).get();
        if (existing.exists) {
          return res.json({ success: false, error: 'Kode sudah ada.' });
        }

        const type = data?.type || 'trial';
        const duration = type === 'trial' ? (data?.duration || 3600) : null;
        const expiresAt = duration 
          ? new Date(Date.now() + duration * 1000) 
          : null;

        await db.collection('access_codes').doc(code).set({
          code: code,
          type: type,
          duration: duration || 0,
          active: true,
          used_by: null,
          created_at: FieldValue.serverTimestamp(),
          expires_at: expiresAt || null,
        });

        return res.json({ success: true, code: code });
      }

      // ============================================================
      // HAPUS / NONAKTIFKAN KODE
      // ============================================================
      case 'deleteCode': {
        const code = (data?.code || '').trim().toUpperCase();
        if (!code) return res.json({ success: false, error: 'Kode diperlukan.' });

        await db.collection('access_codes').doc(code).update({
          active: false,
        });

        return res.json({ success: true });
      }

      // ============================================================
      // LIST SEMUA KODE
      // ============================================================
      case 'listCodes': {
        const snapshot = await db.collection('access_codes')
          .orderBy('created_at', 'desc')
          .limit(100)
          .get();

        const codes = [];
        snapshot.forEach(doc => {
          const d = doc.data();
          codes.push({
            code: d.code,
            type: d.type,
            duration: d.duration,
            active: d.active,
            used_by: d.used_by || null,
            created_at: d.created_at?.toDate?.()?.toISOString() || null,
            expires_at: d.expires_at?.toDate?.()?.toISOString() || null,
          });
        });

        return res.json(codes);
      }

      // ============================================================
      // LIST SEMUA USER
      // ============================================================
      case 'listUsers': {
        const snapshot = await db.collection('users')
          .orderBy('createdAt', 'desc')
          .limit(100)
          .get();

        const users = [];
        snapshot.forEach(doc => {
          const d = doc.data();
          users.push({
            uid: doc.id,
            email: d.email || '',
            accessCode: d.accessCode || '',
            blocked: d.blocked || false,
            createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
          });
        });

        return res.json(users);
      }

      // ============================================================
      // BLOKIR USER
      // ============================================================
      case 'blockUser': {
        const uid = data?.uid;
        if (!uid) return res.json({ success: false, error: 'UID diperlukan.' });

        await db.collection('users').doc(uid).update({
          blocked: true,
        });

        return res.json({ success: true });
      }

      // ============================================================
      // BUKA BLOKIR USER
      // ============================================================
      case 'unblockUser': {
        const uid = data?.uid;
        if (!uid) return res.json({ success: false, error: 'UID diperlukan.' });

        await db.collection('users').doc(uid).update({
          blocked: false,
        });

        return res.json({ success: true });
      }

      // ============================================================
      // GANTI PASSWORD ADMIN
      // ============================================================
      case 'changePassword': {
        const newPassword = data?.newPassword;
        if (!newPassword || newPassword.length < 6) {
          return res.json({ success: false, error: 'Password minimal 6 karakter.' });
        }

        await db.collection('admin').doc('config').set({
          password: newPassword,
        }, { merge: true });

        return res.json({ success: true, message: 'Password berhasil diubah.' });
      }

      default:
        return res.status(400).json({ error: 'Action tidak dikenal.' });
    }

  } catch (error) {
    console.error('Admin API Error:', error.message);
    return res.status(500).json({ 
      error: 'Internal server error: ' + error.message 
    });
  }
}
