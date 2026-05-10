// ============================================================
// AI RAKSASA — Phase Handlers (Fase 0–5)
// Dipanggil oleh orchestrator, bisa juga standalone
// ============================================================

import { CONFIG } from './ai/config.js';
import { splitIntoChunks, compareReviews } from './ai/core.js';
import { logProgress, retryWithBackoff } from './utils.js';
import { trackPhase, trackChunkStatus } from './monitoring.js';
import {
  generateWithGroq, generateWithCerebras, generateWithTogether,
  generateWithFireworks, generateWithMistral,
  reviewWithGemini, reviewWithDeepSeek, reviewWithMistral,
  searchWithTavily, scanWithNvidia, testWithCloudflare
} from './ai/providers.js';
import {
  PROMPT_GENERATE,
  PROMPT_REVIEW_L1_GEMINI, PROMPT_REVIEW_L1_DEEPSEEK, PROMPT_REVIEW_L1_MISTRAL,
  PROMPT_REVIEW_L2_DEEPSEEK, PROMPT_REVIEW_L2_GEMINI, PROMPT_REVIEW_L2_MISTRAL,
  PROMPT_ASSEMBLER
} from './ai/prompts.js';

// ============================================================
// FASE 0: RISET
// ============================================================

export async function phaseResearch(message, sessionId) {
  trackPhase(sessionId, 'FASE 0', 'Riset dimulai');

  try {
    const results = await searchWithTavily(message, 5);

    const summary = results.slice(0, 3).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet || r.content?.slice(0, 150),
    }));

    trackPhase(sessionId, 'FASE 0', 'OK', {
      sourcesFound: results.length,
      topSources: summary.map(s => s.title),
    });

    return {
      success: true,
      sources: results,
      summary,
    };
  } catch (error) {
    trackPhase(sessionId, 'FASE 0', 'WARNING', { error: error.message });
    return {
      success: false,
      sources: [],
      summary: [],
      error: error.message,
    };
  }
}

// ============================================================
// FASE 1: GENERATE PARALEL
// ============================================================

export async function phaseGenerate(message, research, sessionId) {
  trackPhase(sessionId, 'FASE 1', 'Generate dimulai');

  const researchContext = research?.summary
    ? JSON.stringify(research.summary.slice(0, 3))
    : '';

  const draftPrompt = PROMPT_GENERATE
    .replace('{message}', message)
    .replace('{research}', researchContext);

  try {
    // Generate draf awal dengan Groq (tercepat)
    const draft = await retryWithBackoff(
      () => generateWithGroq(draftPrompt, '', CONFIG.MAX_OUTPUT_TOKENS_FAST),
      CONFIG.MAX_RETRIES,
      CONFIG.RETRY_DELAY_MS
    );

    // Split jadi potongan 500 baris
    const chunks = splitIntoChunks(draft);

    trackPhase(sessionId, 'FASE 1', `Draf selesai — ${chunks.length} potongan`);

    // Generate ulang tiap potongan dengan 5 AI (paralel per batch)
    const aiProviders = [
      { name: 'Groq', fn: generateWithGroq, model: 'llama-3.3-70b' },
      { name: 'Cerebras', fn: generateWithCerebras, model: 'llama3.3-70b' },
      { name: 'Together', fn: generateWithTogether, model: 'mixtral-8x22b' },
      { name: 'Fireworks', fn: generateWithFireworks, model: 'llama-v3p3-70b' },
      { name: 'Mistral', fn: generateWithMistral, model: 'mistral-large' },
    ];

    const generatedChunks = [];
    const batchSize = 3; // Proses 3 potongan paralel sekaligus

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (chunk, batchIndex) => {
        const globalIndex = i + batchIndex;
        const provider = aiProviders[globalIndex % aiProviders.length];

        try {
          const generated = await retryWithBackoff(
            () => provider.fn(
              PROMPT_GENERATE.replace('{message}', chunk.content).replace('{research}', ''),
              chunk.content,
              CONFIG.MAX_OUTPUT_TOKENS_FAST
            ),
            CONFIG.MAX_RETRIES,
            CONFIG.RETRY_DELAY_MS
          );

          trackChunkStatus(sessionId, chunk.id, 'OK', {
            provider: provider.name,
            baris: `${chunk.barisAwal}-${chunk.barisAkhir}`,
          });

          return {
            ...chunk,
            content: generated,
            generatedBy: provider.name,
            success: true,
          };
        } catch (error) {
          trackChunkStatus(sessionId, chunk.id, 'FALLBACK', {
            error: error.message,
            baris: `${chunk.barisAwal}-${chunk.barisAkhir}`,
          });

          return {
            ...chunk,
            generatedBy: 'fallback (draf asli)',
            success: false,
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          generatedChunks.push(result.value);
        }
      });

      trackPhase(sessionId, 'FASE 1', `Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} potongan`);
    }

    trackPhase(sessionId, 'FASE 1', 'OK', {
      totalChunks: generatedChunks.length,
      successful: generatedChunks.filter(c => c.success).length,
      fallback: generatedChunks.filter(c => !c.success).length,
    });

    return generatedChunks;
  } catch (error) {
    trackPhase(sessionId, 'FASE 1', 'ERROR', { error: error.message });
    throw error;
  }
}

// ============================================================
// FASE 2: RETI-RETI LAPIS 1
// ============================================================

export async function phaseRetiRetiL1(chunks, sessionId) {
  trackPhase(sessionId, 'FASE 2', `Reti-Reti L1 — ${chunks.length} potongan × 3 AI`);

  const reviewProviders = [
    { name: 'Gemini', fn: reviewWithGemini, prompt: PROMPT_REVIEW_L1_GEMINI },
    { name: 'DeepSeek', fn: reviewWithDeepSeek, prompt: PROMPT_REVIEW_L1_DEEPSEEK },
    { name: 'Mistral', fn: reviewWithMistral, prompt: PROMPT_REVIEW_L1_MISTRAL },
  ];

  const reviewed = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Konteks overlap
    const context = {
      before: i > 0 ? chunks[i - 1].content.slice(-200) : '',
      after: i < chunks.length - 1 ? chunks[i + 1].content.slice(0, 200) : '',
      chunkIndex: i + 1,
      totalChunks: chunks.length,
    };

    // 3 AI review paralel
    const reviewPromises = reviewProviders.map(provider =>
      retryWithBackoff(
        () => provider.fn(provider.prompt, chunk.content, context),
        2,
        CONFIG.RETRY_DELAY_MS
      ).catch(error => ({
        errors: [],
        warnings: [],
        fixedCode: chunk.content,
        status: 'error',
        summary: `${provider.name} gagal: ${error.message}`,
      }))
    );

    const reviews = await Promise.all(reviewPromises);

    // Komparator voting
    const comparison = compareReviews(reviews);

    const status = comparison.status;
    const emoji = status === 'PASS' ? '✅' : status === 'REVISI' ? '🔧' : status === 'GAGAL' ? '❌' : '⚠️';

    trackChunkStatus(sessionId, chunk.id, status, {
      phase: 'L1',
      errors: comparison.confirmedErrors?.length || 0,
      conflicts: comparison.conflicts?.length || 0,
      summary: comparison.votingSummary,
    });

    reviewed.push({
      ...chunk,
      reviews,
      comparison,
      finalContent: comparison.finalCode,
      statusL1: status,
      conflictsL1: comparison.conflicts || [],
    });

    trackPhase(sessionId, 'FASE 2', `${emoji} P${i + 1}/${chunks.length}: ${status}`);
  }

  const passCount = reviewed.filter(c => c.statusL1 === 'PASS').length;
  const revisiCount = reviewed.filter(c => c.statusL1 === 'REVISI').length;
  const gagalCount = reviewed.filter(c => c.statusL1 === 'GAGAL').length;

  trackPhase(sessionId, 'FASE 2', 'OK', {
    pass: passCount,
    revisi: revisiCount,
    gagal: gagalCount,
  });

  return reviewed;
}

// ============================================================
// FASE 3: RETI-RETI LAPIS 2
// ============================================================

export async function phaseRetiRetiL2(chunksAfterL1, sessionId) {
  trackPhase(sessionId, 'FASE 3', `Reti-Reti L2 — ${chunksAfterL1.length} potongan × 3 AI (beda sudut)`);

  const verifyProviders = [
    { name: 'DeepSeek', fn: reviewWithDeepSeek, prompt: PROMPT_REVIEW_L2_DEEPSEEK },
    { name: 'Gemini', fn: reviewWithGemini, prompt: PROMPT_REVIEW_L2_GEMINI },
    { name: 'Mistral', fn: reviewWithMistral, prompt: PROMPT_REVIEW_L2_MISTRAL },
  ];

  const verified = [];

  for (let i = 0; i < chunksAfterL1.length; i++) {
    const chunk = chunksAfterL1[i];

    const l1Context = {
      before: i > 0 ? chunksAfterL1[i - 1].finalContent?.slice(-200) : '',
      after: i < chunksAfterL1.length - 1 ? chunksAfterL1[i + 1].finalContent?.slice(0, 200) : '',
      l1Findings: chunk.comparison,
      chunkIndex: i + 1,
      totalChunks: chunksAfterL1.length,
    };

    // 3 AI verifikasi paralel
    const verifyPromises = verifyProviders.map(provider =>
      retryWithBackoff(
        () => provider.fn(provider.prompt, chunk.finalContent, l1Context),
        2,
        CONFIG.RETRY_DELAY_MS
      ).catch(error => ({
        verified: false,
        newIssues: [`${provider.name} error: ${error.message}`],
        status: 'error',
      }))
    );

    const reviewsL2 = await Promise.all(verifyPromises);

    // Komparator L1 vs L2
    const comparison = compareL1vsL2(chunk.comparison, reviewsL2);

    const status = comparison.status;
    const emoji = status === 'FINAL' ? '✅' : status === 'REVISI_KECIL' ? '🔧' : status === 'UNRESOLVED' ? '⚠️' : '❌';

    trackChunkStatus(sessionId, chunk.id, status, {
      phase: 'L2',
      l1Status: chunk.statusL1,
      unresolved: comparison.unresolvedConflicts?.length || 0,
    });

    verified.push({
      ...chunk,
      reviewsL2,
      finalComparison: comparison,
      finalContent: comparison.finalCode,
      finalStatus: status,
      unresolvedConflicts: comparison.unresolvedConflicts || [],
    });

    trackPhase(sessionId, 'FASE 3', `${emoji} P${i + 1}/${chunksAfterL1.length}: ${status}`);
  }

  const finalCount = verified.filter(c => c.finalStatus === 'FINAL').length;
  const unresolvedCount = verified.filter(c => c.finalStatus === 'UNRESOLVED').length;

  trackPhase(sessionId, 'FASE 3', 'OK', {
    final: finalCount,
    unresolved: unresolvedCount,
  });

  return verified;
}

// ============================================================
// FASE 4: ASSEMBLY
// ============================================================

export async function phaseAssemble(chunks, sessionId) {
  trackPhase(sessionId, 'FASE 4', 'Assembly dimulai');

  // Metadata untuk AI Perakit
  const metadata = chunks.map(c => ({
    id: c.id,
    barisAwal: c.barisAwal,
    barisAkhir: c.barisAkhir,
    statusL1: c.statusL1,
    finalStatus: c.finalStatus,
    conflicts: c.unresolvedConflicts || [],
  }));

  const unresolvedChunks = chunks.filter(c => c.finalStatus === 'UNRESOLVED');

  // Panggil AI Perakit (analisis saja)
  let analysis = '';
  let returnedIssues = [];

  if (unresolvedChunks.length > 0) {
    trackPhase(sessionId, 'FASE 4', `${unresolvedChunks.length} potongan unresolved — AI Perakit menganalisis`);

    try {
      const assemblerPrompt = PROMPT_ASSEMBLER
        .replace('{metadata}', JSON.stringify(metadata))
        .replace('{chunkCount}', chunks.length);

      const result = await retryWithBackoff(
        () => reviewWithGemini(assemblerPrompt, '', {
          task: 'assembler',
          totalChunks: chunks.length,
        }),
        2,
        CONFIG.RETRY_DELAY_MS
      );

      analysis = result.summary || result.analysis || '';
      returnedIssues = result.issues || [];
    } catch (error) {
      trackPhase(sessionId, 'FASE 4', 'WARNING', {
        error: 'AI Perakit gagal, assembly tetap jalan',
      });
      analysis = 'AI Perakit gagal menganalisis. Assembly tetap dilakukan.';
    }
  } else {
    analysis = 'Semua potongan lolos double check. Assembly bersih.';
  }

  // Assembly fisik (gabung kode)
  const { assembleChunks } = await import('./ai/core.js');
  const assembledCode = assembleChunks(chunks.map(c => c.finalContent));

  trackPhase(sessionId, 'FASE 4', 'OK', {
    totalLines: assembledCode.split('\n').length,
    unresolvedReturned: returnedIssues.length,
  });

  return {
    code: assembledCode,
    analysis,
    returnedIssues,
    metadata,
  };
}

// ============================================================
// FASE 5: FINAL SCAN
// ============================================================

export async function phaseFinalScan(code, sessionId) {
  trackPhase(sessionId, 'FASE 5', 'Final Scan — Security + Version Check');

  const results = {};

  // NVIDIA Security Scan
  try {
    const nvidiaResult = await retryWithBackoff(
      () => scanWithNvidia(code),
      2,
      CONFIG.RETRY_DELAY_MS
    );
    results.security = nvidiaResult;
    trackPhase(sessionId, 'FASE 5', nvidiaResult.safe !== false ? 'Security OK' : 'Security WARNING', {
      vulnerabilities: nvidiaResult.vulnerabilities?.length || 0,
    });
  } catch (error) {
    results.security = { safe: true, error: error.message };
    trackPhase(sessionId, 'FASE 5', 'Security scan gagal — dilewati');
  }

  // Tavily Version Check
  try {
    const depCheck = await searchWithTavily(
      'check latest stable versions of npm packages used in: ' + code.slice(0, 300),
      3
    );
    results.versions = depCheck.slice(0, 3).map(r => ({
      title: r.title,
      url: r.url,
    }));
    trackPhase(sessionId, 'FASE 5', 'Version check OK', {
      sources: results.versions.length,
    });
  } catch (error) {
    results.versions = [];
    trackPhase(sessionId, 'FASE 5', 'Version check gagal — dilewati');
  }

  // Cloudflare Edge Test (kalau file kecil)
  if (code.length < 5000) {
    try {
      const edgeResult = await testWithCloudflare(code);
      results.edgeCompatible = edgeResult.compatible !== false;
      results.edgeIssues = edgeResult.issues || [];
    } catch (error) {
      results.edgeCompatible = null;
    }
  }

  return results;
}

// ============================================================
// KOMPARATOR L1 VS L2
// ============================================================

function compareL1vsL2(l1Result, l2Reviews) {
  const allL2Verified = l2Reviews.every(r => r.verified !== false);
  const newIssuesFromL2 = l2Reviews.flatMap(r => r.newIssues || []);
  const falseAlarms = l2Reviews.flatMap(r => r.falseAlarms || []);
  const securityIssues = l2Reviews.flatMap(r => r.securityIssues || []);

  let status = 'FINAL';
  let finalCode = l1Result.finalCode;
  const unresolvedConflicts = [];

  // Ambil conflicts dari L1 yang TIDAK false alarm
  const realConflicts = (l1Result.conflicts || []).filter(
    c => !falseAlarms.some(fa => fa.includes(c.slice(0, 30)))
  );

  if (l1Result.status === 'PASS' && allL2Verified && newIssuesFromL2.length === 0) {
    status = 'FINAL';
  } else if (l1Result.status === 'PASS' && !allL2Verified && newIssuesFromL2.length <= 2) {
    status = 'REVISI_KECIL';
    unresolvedConflicts.push(...newIssuesFromL2);
  } else if (l1Result.status === 'REVISI' && allL2Verified) {
    status = 'FINAL';
  } else if (l1Result.status === 'REVISI' && !allL2Verified) {
    if (realConflicts.length <= 3) {
      status = 'FINAL';
    } else {
      status = 'UNRESOLVED';
      unresolvedConflicts.push(...realConflicts, ...newIssuesFromL2);
    }
  } else if (l1Result.status === 'GAGAL') {
    status = 'UNRESOLVED';
    unresolvedConflicts.push(...realConflicts);
  }

  // Tambah security issues ke unresolved
  if (securityIssues.length > 0) {
    unresolvedConflicts.push(...securityIssues);
    if (status === 'FINAL') status = 'REVISI_KECIL';
  }

  return {
    status,
    finalCode,
    unresolvedConflicts,
    l1Status: l1Result.status,
    l2Verified: allL2Verified,
    falseAlarmsCount: falseAlarms.length,
    newIssuesCount: newIssuesFromL2.length,
  };
      }
