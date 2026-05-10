// ============================================================
// AI RAKSASA — Monitoring
// Tracker API Call + Session Reporter
// ============================================================

import { CONFIG } from './ai/config.js';

// ============================================================
// STORE SEMENTARA (In-Memory)
// Untuk production, ganti dengan Firebase atau log file
// ============================================================

const sessionLogs = new Map();
const apiCallLogs = [];
const MAX_LOG_SIZE = 1000;

// ============================================================
// TRACK PHASE PROGRESS
// ============================================================

export function trackPhase(sessionId, phase, status, details = {}) {
  if (!sessionLogs.has(sessionId)) {
    sessionLogs.set(sessionId, {
      sessionId,
      startedAt: new Date().toISOString(),
      phases: [],
      apiCalls: 0,
      errors: 0,
    });
  }

  const session = sessionLogs.get(sessionId);
  
  session.phases.push({
    phase,
    status,
    timestamp: new Date().toISOString(),
    details,
  });

  // Log ke console
  const emoji = status === 'OK' ? '✅' : status === 'ERROR' ? '❌' : status === 'WARNING' ? '⚠️' : '📌';
  console.log(`  ${emoji} [${sessionId.slice(0, 8)}] ${phase}: ${status}`);
  
  if (Object.keys(details).length > 0) {
    console.log(`     ${JSON.stringify(details).slice(0, 120)}`);
  }
}

// ============================================================
// TRACK API CALL
// ============================================================

export function trackAPICall(provider, model, success, durationMs, errorMsg = null) {
  const log = {
    provider,
    model,
    success,
    durationMs,
    errorMsg,
    timestamp: new Date().toISOString(),
  };

  apiCallLogs.push(log);

  // Jaga ukuran log
  if (apiCallLogs.length > MAX_LOG_SIZE) {
    apiCallLogs.shift();
  }

  // Update session
  const sessionId = findActiveSession();
  if (sessionId && sessionLogs.has(sessionId)) {
    const session = sessionLogs.get(sessionId);
    session.apiCalls++;
    if (!success) session.errors++;
  }

  // Log ringkas
  const status = success ? '✅' : '❌';
  const duration = durationMs ? `${durationMs}ms` : 'N/A';
  console.log(`  ${status} API: ${provider}/${model} — ${duration}${errorMsg ? ' | ' + errorMsg : ''}`);
}

// ============================================================
// TRACK ERROR
// ============================================================

export function trackError(sessionId, phase, error) {
  if (sessionLogs.has(sessionId)) {
    const session = sessionLogs.get(sessionId);
    session.errors++;
    session.phases.push({
      phase,
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      details: { message: error.message, stack: error.stack?.slice(0, 300) },
    });
  }

  console.error(`  ❌ [${sessionId?.slice(0, 8) || '???'}] ${phase}: ${error.message}`);
}

// ============================================================
// TRACK CHUNK STATUS
// ============================================================

export function trackChunkStatus(sessionId, chunkId, status, details = {}) {
  if (!sessionLogs.has(sessionId)) return;

  const session = sessionLogs.get(sessionId);
  
  const existing = session.phases.find(
    p => p.phase === 'CHUNK' && p.details?.chunkId === chunkId
  );

  if (existing) {
    existing.status = status;
    existing.details = { ...existing.details, ...details };
  } else {
    session.phases.push({
      phase: 'CHUNK',
      status,
      timestamp: new Date().toISOString(),
      details: { chunkId, ...details },
    });
  }
}

// ============================================================
// GENERATE REPORT
// ============================================================

export function generateReport(sessionId) {
  const session = sessionLogs.get(sessionId);

  if (!session) {
    return {
      error: 'Session tidak ditemukan',
      sessionId,
    };
  }

  const phases = session.phases;
  const totalPhases = phases.length;
  const errorPhases = phases.filter(p => p.status === 'ERROR');
  const warningPhases = phases.filter(p => p.status === 'WARNING');
  
  // Hitung durasi
  const startTime = new Date(session.startedAt).getTime();
  const endTime = phases.length > 0 
    ? new Date(phases[phases.length - 1].timestamp).getTime() 
    : startTime;
  const durationSeconds = ((endTime - startTime) / 1000).toFixed(1);

  // Ringkasan fase
  const phaseSummary = {};
  phases.forEach(p => {
    const key = p.phase;
    if (!phaseSummary[key]) {
      phaseSummary[key] = { count: 0, errors: 0, warnings: 0 };
    }
    phaseSummary[key].count++;
    if (p.status === 'ERROR') phaseSummary[key].errors++;
    if (p.status === 'WARNING') phaseSummary[key].warnings++;
  });

  return {
    sessionId: sessionId.slice(0, 12) + '...',
    startedAt: session.startedAt,
    durationSeconds,
    totalApiCalls: session.apiCalls,
    totalErrors: session.errors,
    totalPhases,
    errorPhases: errorPhases.length,
    warningPhases: warningPhases.length,
    successRate: totalPhases > 0 
      ? `${Math.round(((totalPhases - errorPhases.length) / totalPhases) * 100)}%` 
      : 'N/A',
    phaseSummary,
    lastError: errorPhases.length > 0 
      ? errorPhases[errorPhases.length - 1].details?.message?.slice(0, 100) 
      : null,
  };
}

// ============================================================
// GET API STATS
// ============================================================

export function getAPIStats() {
  const total = apiCallLogs.length;
  const successful = apiCallLogs.filter(l => l.success).length;
  const failed = total - successful;

  // Per provider
  const providerStats = {};
  apiCallLogs.forEach(log => {
    if (!providerStats[log.provider]) {
      providerStats[log.provider] = { total: 0, success: 0, failed: 0, totalDuration: 0 };
    }
    providerStats[log.provider].total++;
    if (log.success) {
      providerStats[log.provider].success++;
    } else {
      providerStats[log.provider].failed++;
    }
    providerStats[log.provider].totalDuration += log.durationMs || 0;
  });

  // Rata-rata durasi per provider
  Object.keys(providerStats).forEach(key => {
    const stat = providerStats[key];
    stat.avgDuration = stat.total > 0 ? Math.round(stat.totalDuration / stat.total) : 0;
  });

  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? `${Math.round((successful / total) * 100)}%` : 'N/A',
    providers: providerStats,
  };
}

// ============================================================
// GET ACTIVE SESSIONS
// ============================================================

export function getActiveSessions() {
  const sessions = [];
  
  sessionLogs.forEach((session, id) => {
    sessions.push({
      sessionId: id.slice(0, 12) + '...',
      startedAt: session.startedAt,
      phases: session.phases.length,
      apiCalls: session.apiCalls,
      errors: session.errors,
    });
  });

  return sessions;
}

// ============================================================
// CLEANUP OLD SESSIONS
// ============================================================

export function cleanupSessions(maxAgeMs = 3600000) {
  const now = Date.now();
  let cleaned = 0;

  sessionLogs.forEach((session, id) => {
    const age = now - new Date(session.startedAt).getTime();
    if (age > maxAgeMs) {
      sessionLogs.delete(id);
      cleaned++;
    }
  });

  if (cleaned > 0) {
    console.log(`  🧹 Cleanup: ${cleaned} sesi lama dihapus`);
  }

  return cleaned;
}

// ============================================================
// HELPER: Cari session aktif terakhir
// ============================================================

function findActiveSession() {
  let latest = null;
  let latestTime = 0;

  sessionLogs.forEach((session, id) => {
    const time = new Date(session.startedAt).getTime();
    if (time > latestTime) {
      latestTime = time;
      latest = id;
    }
  });

  return latest;
}

// ============================================================
// AUTO CLEANUP SETIAP 30 MENIT
// ============================================================

setInterval(() => {
  cleanupSessions(3600000); // 1 jam
}, 1800000); // 30 menit
