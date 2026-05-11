// ============================================================
// RHF ZERO — api/memory.js
// Firebase Firestore — Simpan & Ambil Chat + Chat Rooms
// Tanpa login manual, pakai UID dari Anonymous Auth
// ============================================================

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

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
// CHAT ROOMS (CRUD)
// ============================================================

// Buat chat room baru
export async function createChatRoom(uid, namaOtomatis) {
  const db = getDB();
  try {
    const docRef = await db.collection('users').doc(uid).collection('chats').add({
      nama: namaOtomatis || 'Chat Baru',
      dibuat: FieldValue.serverTimestamp(),
      diubah: FieldValue.serverTimestamp(),
      jumlahPesan: 0,
      pesanTerakhir: '',
    });
    return { success: true, chatId: docRef.id, nama: namaOtomatis || 'Chat Baru' };
  } catch (error) {
    console.error('createChatRoom error:', error.message);
    return { success: false, error: error.message };
  }
}

// Ambil semua chat rooms user
export async function getChatRooms(uid) {
  const db = getDB();
  try {
    const snapshot = await db
      .collection('users').doc(uid)
      .collection('chats')
      .orderBy('diubah', 'desc')
      .limit(50)
      .get();

    const rooms = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      rooms.push({
        chatId: doc.id,
        nama: data.nama || 'Chat Baru',
        dibuat: data.dibuat?.toDate?.()?.toISOString() || null,
        diubah: data.diubah?.toDate?.()?.toISOString() || null,
        jumlahPesan: data.jumlahPesan || 0,
        pesanTerakhir: (data.pesanTerakhir || '').substring(0, 100),
      });
    });
    return { success: true, rooms };
  } catch (error) {
    console.error('getChatRooms error:', error.message);
    return { success: false, rooms: [], error: error.message };
  }
}

// Ubah nama chat room
export async function renameChatRoom(uid, chatId, namaBaru) {
  const db = getDB();
  try {
    await db.collection('users').doc(uid).collection('chats').doc(chatId).update({
      nama: namaBaru.substring(0, 100),
      diubah: FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('renameChatRoom error:', error.message);
    return { success: false, error: error.message };
  }
}

// Hapus chat room
export async function deleteChatRoom(uid, chatId) {
  const db = getDB();
  try {
    // Hapus semua pesan dulu
    const messagesSnapshot = await db
      .collection('users').doc(uid)
      .collection('chats').doc(chatId)
      .collection('messages')
      .get();

    const batch = db.batch();
    messagesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Hapus chat room
    await db.collection('users').doc(uid).collection('chats').doc(chatId).delete();

    return { success: true };
  } catch (error) {
    console.error('deleteChatRoom error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================
// PESAN (MESSAGES)
// ============================================================

// Simpan pesan ke chat room
export async function saveMessage(uid, chatId, role, content, mode, metadata = null) {
  const db = getDB();
  try {
    // Simpan pesan
    await db
      .collection('users').doc(uid)
      .collection('chats').doc(chatId)
      .collection('messages')
      .add({
        role: role, // 'user' atau 'ai'
        content: typeof content === 'string' ? content : JSON.stringify(content),
        mode: mode || 'santai',
        metadata: metadata || null,
        timestamp: FieldValue.serverTimestamp(),
      });

    // Update chat room
    const chatRef = db.collection('users').doc(uid).collection('chats').doc(chatId);
    await chatRef.update({
      pesanTerakhir: typeof content === 'string' ? content.substring(0, 200) : '[Kode]',
      diubah: FieldValue.serverTimestamp(),
      jumlahPesan: FieldValue.increment(1),
    });

    // Auto-rename kalau ini pesan user pertama
    const chatDoc = await chatRef.get();
    const chatData = chatDoc.data();
    if (chatData && chatData.jumlahPesan <= 2 && role === 'user') {
      const namaOtomatis = content.substring(0, 50).replace(/\n/g, ' ').trim();
      await chatRef.update({ nama: namaOtomatis || 'Chat Baru' });
    }

    return { success: true };
  } catch (error) {
    console.error('saveMessage error:', error.message);
    return { success: false, error: error.message };
  }
}

// Ambil semua pesan dari chat room
export async function getMessages(uid, chatId, limit = 100) {
  const db = getDB();
  try {
    const snapshot = await db
      .collection('users').doc(uid)
      .collection('chats').doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(limit)
      .get();

    const messages = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        role: data.role,
        content: data.content,
        mode: data.mode,
        metadata: data.metadata,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
      });
    });
    return { success: true, messages };
  } catch (error) {
    console.error('getMessages error:', error.message);
    return { success: false, messages: [], error: error.message };
  }
}

// Ambil pesan terakhir dari chat room (untuk preview)
export async function getLastMessages(uid, chatId, limit = 5) {
  const db = getDB();
  try {
    const snapshot = await db
      .collection('users').doc(uid)
      .collection('chats').doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const messages = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        role: data.role,
        content: (data.content || '').substring(0, 200),
        timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
      });
    });
    return { success: true, messages: messages.reverse() };
  } catch (error) {
    console.error('getLastMessages error:', error.message);
    return { success: false, messages: [], error: error.message };
  }
}

// ============================================================
// HANDLER UNTUK ENDPOINT /api/memory
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, uid, chatId, data } = req.body;

  if (!uid) {
    return res.status(400).json({ error: 'UID diperlukan' });
  }

  try {
    switch (action) {
      // --- CHAT ROOMS ---
      case 'createChat': {
        const result = await createChatRoom(uid, data?.nama);
        return res.json(result);
      }
      case 'getChats': {
        const result = await getChatRooms(uid);
        return res.json(result);
      }
      case 'renameChat': {
        if (!chatId) return res.status(400).json({ error: 'chatId diperlukan' });
        const result = await renameChatRoom(uid, chatId, data?.nama);
        return res.json(result);
      }
      case 'deleteChat': {
        if (!chatId) return res.status(400).json({ error: 'chatId diperlukan' });
        const result = await deleteChatRoom(uid, chatId);
        return res.json(result);
      }

      // --- MESSAGES ---
      case 'saveMessage': {
        if (!chatId) return res.status(400).json({ error: 'chatId diperlukan' });
        const result = await saveMessage(uid, chatId, data?.role, data?.content, data?.mode, data?.metadata);
        return res.json(result);
      }
      case 'getMessages': {
        if (!chatId) return res.status(400).json({ error: 'chatId diperlukan' });
        const result = await getMessages(uid, chatId, data?.limit || 100);
        return res.json(result);
      }
      case 'getLastMessages': {
        if (!chatId) return res.status(400).json({ error: 'chatId diperlukan' });
        const result = await getLastMessages(uid, chatId, data?.limit || 5);
        return res.json(result);
      }

      default:
        return res.status(400).json({ error: 'Action tidak dikenal' });
    }
  } catch (error) {
    console.error('Memory handler error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
