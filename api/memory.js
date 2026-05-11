// ============================================================
// AI RAKSASA — Memory System
// Firebase Firestore + Vector Search
// ============================================================

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { API_KEYS, CONFIG } from './config.js';
import { logProgress } from './utils.js';

// ============================================================
// INISIALISASI FIREBASE
// ============================================================

let db = null;

function getDB() {
  if (db) return db;

  if (
    !API_KEYS.FIREBASE_PROJECT_ID ||
    !API_KEYS.FIREBASE_CLIENT_EMAIL ||
    !API_KEYS.FIREBASE_PRIVATE_KEY
  ) {
    logProgress('MEMORY', 'Firebase tidak dikonfigurasi — memory disabled');
    return null;
  }

  try {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: API_KEYS.FIREBASE_PROJECT_ID,
          clientEmail: API_KEYS.FIREBASE_CLIENT_EMAIL,
          privateKey: API_KEYS.FIREBASE_PRIVATE_KEY,
        }),
        projectId: API_KEYS.FIREBASE_PROJECT_ID,
      });
    }

    db = getFirestore();
    logProgress('MEMORY', 'Firebase terhubung');
    return db;
  } catch (error) {
    logProgress('MEMORY', `Firebase gagal: ${error.message}`);
    return null;
  }
}

// ============================================================
// PERCAKAPAN
// ============================================================

export async function saveConversation(sessionId, userMessage, aiResponse, mode) {
  const database = getDB();
  if (!database) return null;

  try {
    const doc = {
      sessionId,
      userMessage: userMessage.substring(0, 5000),
      aiResponse: typeof aiResponse === 'string' ? aiResponse.substring(0, 10000) : JSON.stringify(aiResponse).substring(0, 10000),
      mode,
      timestamp: FieldValue.serverTimestamp(),
      messageLength: userMessage.length,
      responseLength: typeof aiResponse === 'string' ? aiResponse.length : JSON.stringify(aiResponse).length,
    };

    await database.collection('conversations').add(doc);
    logProgress('MEMORY', 'Percakapan tersimpan');
    return true;
  } catch (error) {
    logProgress('MEMORY', `Gagal simpan percakapan: ${error.message}`);
    return null;
  }
}

export async function getChatHistory(sessionId, limit = 50) {
  const database = getDB();
  if (!database) return [];

  try {
    const snapshot = await database
      .collection('conversations')
      .where('sessionId', '==', sessionId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const history = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      history.push({
        id: doc.id,
        user: data.userMessage,
        ai: data.aiResponse,
        mode: data.mode,
        timestamp: data.timestamp?.toDate?.() || new Date(),
      });
    });

    return history.reverse();
  } catch (error) {
    logProgress('MEMORY', `Gagal ambil history: ${error.message}`);
    return [];
  }
}

// ============================================================
// KODE HISTORY
// ============================================================

export async function saveCodeHistory(sessionId, code, progressData) {
  const database = getDB();
  if (!database) return null;

  try {
    const doc = {
      sessionId,
      code: code.substring(0, 500000), // Max 500KB per save
      codeLength: code.length,
      codeLines: code.split('\n').length,
      progress: JSON.stringify(progressData).substring(0, 10000),
      version: Date.now(),
      timestamp: FieldValue.serverTimestamp(),
    };

    await database.collection('code_history').add(doc);
    logProgress('MEMORY', `Kode tersimpan (${doc.codeLines} baris)`);
    return true;
  } catch (error) {
    logProgress('MEMORY', `Gagal simpan kode: ${error.message}`);
    return null;
  }
}

export async function getCodeHistory(sessionId, limit = 10) {
  const database = getDB();
  if (!database) return [];

  try {
    const snapshot = await database
      .collection('code_history')
      .where('sessionId', '==', sessionId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const history = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      history.push({
        id: doc.id,
        code: data.code,
        codeLength: data.codeLength,
        codeLines: data.codeLines,
        version: data.version,
        timestamp: data.timestamp?.toDate?.() || new Date(),
      });
    });

    return history;
  } catch (error) {
    logProgress('MEMORY', `Gagal ambil kode history: ${error.message}`);
    return [];
  }
}

// ============================================================
// KONTEKS SESI (Session Context)
// ============================================================

export async function getContext(sessionId) {
  const database = getDB();
  if (!database) return { recentMessages: [], recentCode: null };

  try {
    // Ambil 10 percakapan terakhir
    const chatSnapshot = await database
      .collection('conversations')
      .where('sessionId', '==', sessionId)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const recentMessages = [];
    chatSnapshot.forEach(doc => {
      const data = doc.data();
      recentMessages.push({
        user: data.userMessage?.substring(0, 200),
        ai: data.aiResponse?.substring(0, 200),
        mode: data.mode,
      });
    });

    // Ambil kode terakhir
    const codeSnapshot = await database
      .collection('code_history')
      .where('sessionId', '==', sessionId)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    let recentCode = null;
    codeSnapshot.forEach(doc => {
      const data = doc.data();
      recentCode = {
        codePreview: data.code?.substring(0, 1000),
        codeLength: data.codeLength,
        codeLines: data.codeLines,
        version: data.version,
      };
    });

    return {
      recentMessages: recentMessages.reverse(),
      recentCode,
    };
  } catch (error) {
    logProgress('MEMORY', `Gagal ambil konteks: ${error.message}`);
    return { recentMessages: [], recentCode: null };
  }
}

// ============================================================
// VECTOR SEARCH (Sederhana — Firebase tidak punya native vector)
// Simpan embedding sebagai array di Firestore
// ============================================================

export async function saveEmbedding(sessionId, text, embedding) {
  const database = getDB();
  if (!database || !embedding) return null;

  try {
    await database.collection('embeddings').add({
      sessionId,
      text: text.substring(0, 500),
      embedding: embedding.slice(0, CONFIG.VECTOR_DIMENSIONS),
      timestamp: FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    logProgress('MEMORY', `Gagal simpan embedding: ${error.message}`);
    return null;
  }
}

export async function searchSimilar(queryEmbedding, limit = 10) {
  const database = getDB();
  if (!database || !queryEmbedding) return [];

  try {
    // Ambil semua embedding (untuk production pakai Pinecone/Weaviate)
    const snapshot = await database
      .collection('embeddings')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const results = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.embedding && Array.isArray(data.embedding)) {
        const similarity = cosineSimilarity(queryEmbedding, data.embedding);
        results.push({
          id: doc.id,
          text: data.text,
          similarity,
          timestamp: data.timestamp?.toDate?.() || new Date(),
        });
      }
    });

    // Urutkan berdasarkan similarity
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  } catch (error) {
    logProgress('MEMORY', `Gagal search similar: ${error.message}`);
    return [];
  }
}

// ============================================================
// COSINE SIMILARITY
// ============================================================

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================

export async function getSession(sessionId) {
  const database = getDB();
  if (!database) return null;

  try {
    const doc = await database.collection('sessions').doc(sessionId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function saveSession(sessionId, data = {}) {
  const database = getDB();
  if (!database) return null;

  try {
    await database.collection('sessions').doc(sessionId).set({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (error) {
    return null;
  }
}

// ============================================================
// CLEANUP OLD DATA
// ============================================================

export async function cleanupOldData(daysOld = 30) {
  const database = getDB();
  if (!database) return null;

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    // Hapus percakapan lama
    const oldChats = await database
      .collection('conversations')
      .where('timestamp', '<', Timestamp.fromDate(cutoff))
      .get();

    let deletedCount = 0;
    const batch = database.batch();
    oldChats.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    await batch.commit();
    logProgress('MEMORY', `Cleanup: ${deletedCount} data lama dihapus`);
    return deletedCount;
  } catch (error) {
    logProgress('MEMORY', `Cleanup gagal: ${error.message}`);
    return null;
  }
      }
