// ============================================================
// AI RAKSASA — Orchestrator Utama
// Mengatur seluruh alur: deteksi → generate → reti-reti → rakit → output
// ============================================================

import { CONFIG } from '../config.js';
import { detectIntent, splitIntoChunks, assembleChunks, compareReviews } from '../core.js';
import { logProgress, retryWithBackoff, estimateTokens } from '../utils.js';
import { trackPhase, generateReport } from '../monitoring.js';
import { 
  generateWithGroq, generateWithCerebras, generateWithTogether, 
  generateWithFireworks, generateWithMistral,
  reviewWithGemini, reviewWithDeepSeek, reviewWithMistral,
  searchWithTavily, scanWithNvidia, testWithCloudflare
} from './providers.js';
import {
  PROMPT_GENERATE, PROMPT_SANTAI,
  PROMPT_REVIEW_L1_GEMINI, PROMPT_REVIEW_L1_DEEPSEEK, PROMPT_REVIEW_L1_MISTRAL,
  PROMPT_REVIEW_L2_DEEPSEEK, PROMPT_REVIEW_L2_GEMINI, PROMPT_REVIEW_L2_MISTRAL,
  PROMPT_ASSEMBLER
} from './prompts.js';
import { saveConversation, saveCodeHistory, getContext } from '../memory.js';
import { formatResponse } from '../output.js';

// ============================================================
// ORCHESTRATOR CLASS
// ============================================================

export class Orchestrator {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.progress = [];
  }

  // ==========================================================
  // ROUTER UTAMA
  // ==========================================================
  
  async handle(userMessage, options = {}) {
    const { files, forceMode } = options;
    
    logProgress('START', `Sesi: ${this.sessionId}`);
    
    // 1. DETEKSI INTENT
    const intent = forceMode || detectIntent(userMessage);
    
    if (intent === CONFIG.MODE_SANTAI) {
      return await this.handleSantai(userMessage);
    }
    
    return await this.handleSerius(userMessage, files);
  }

  // ==========================================================
  // MODE SANTAI
  // ==========================================================
  
  async handleSantai(message) {
    logProgress('MODE', 'Santai');
    
    const response = await generateWithGroq(
      PROMPT_SANTAI,
      message,
      CONFIG.MAX_OUTPUT_TOKENS_FAST
    );
    
    await saveConversation(this.sessionId, message, response, 'santai');
    
    return {
      mode: 'santai',
      response: response,
      metadata: null
    };
  }

  // ==========================================================
  // MODE SERIUS — FULL PIPELINE
  // ==========================================================
  
  async handleSerius(message, files) {
    logProgress('MODE', 'Serius — Full Pipeline');
    const startTime = Date.now();
    
    try {
      // FASE 0: Riset
      const research = await this.phaseResearch(message);
      
      // FASE 1: Generate
      const chunks = await this.phaseGenerate(message, research);
      
      // FASE 2: Reti-Reti Lapis 1
      const afterL1 = await this.phaseRetiRetiL1(chunks);
      
      // FASE 3: Reti-Reti Lapis 2
      const afterL2 = await this.phaseRetiRetiL2(afterL1);
      
      // FASE 4: Assembly
      const assembled = await this.phaseAssemble(afterL2);
      
      // FASE 5: Final Scan
      const scanResult = await this.phaseFinalScan(assembled.code);
      
      // Format output
      const result = await formatResponse(assembled, scanResult, this.progress);
      
      // Simpan ke memori
      await saveConversation(this.sessionId, message, result.response, 'serius');
      await saveCodeHistory(this.sessionId, assembled.code, this.progress);
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logProgress('DONE', `Selesai dalam ${elapsed} detik`);
      
      return result;
      
    } catch (error) {
      logProgress('ERROR', error.message);
      throw error;
    }
  }

  // ==========================================================
  // FASE 0: RISET
  // ==========================================================
  
  async phaseResearch(message) {
    logProgress('FASE 0', 'Riset');
    
    try {
      const result = await searchWithTavily(message);
      logProgress('FASE 0', `Ditemukan ${result.length} sumber`);
      return result;
    } catch (error) {
      logProgress('FASE 0', 'Gagal riset, lanjut tanpa riset');
      return [];
    }
  }

  // ==========================================================
  // FASE 1: GENERATE PARALEL
  // ==========================================================
  
  async phaseGenerate(message, research) {
    logProgress('FASE 1', 'Generate paralel dengan 5 AI');
    
    // Split kode jika user berikan file besar
    // Untuk generate dari prompt, kita buat draf dulu
    const draftPrompt = PROMPT_GENERATE
      .replace('{message}', message)
      .replace('{research}', JSON.stringify(research));
    
    // Generate draf awal dengan Groq (tercepat)
    const draft = await generateWithGroq(draftPrompt, '', CONFIG.MAX_OUTPUT_TOKENS_FAST);
    
    // Split draf jadi potongan 500 baris
    const chunks = splitIntoChunks(draft);
    logProgress('FASE 1', `${chunks.length} potongan dibuat`);
    
    // Generate ulang tiap potongan dengan 5 AI paralel
    const aiPool = [
      generateWithGroq,
      generateWithCerebras,
      generateWithTogether,
      generateWithFireworks,
      generateWithMistral
    ];
    
    const generatedChunks = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const aiIndex = i % aiPool.length;
      const ai = aiPool[aiIndex];
      
      try {
        const generated = await retryWithBackoff(
          () => ai(PROMPT_GENERATE, chunks[i].content, CONFIG.MAX_OUTPUT_TOKENS_FAST),
          CONFIG.MAX_RETRIES,
          CONFIG.RETRY_DELAY_MS
        );
        
        generatedChunks.push({
          id: chunks[i].id,
          barisAwal: chunks[i].barisAwal,
          barisAkhir: chunks[i].barisAkhir,
          content: generated,
          generatedBy: aiIndex
        });
        
        logProgress('FASE 1', `Potongan ${i + 1}/${chunks.length} selesai`);
      } catch (error) {
        // Kalau gagal, pakai draf asli
        generatedChunks.push({
          id: chunks[i].id,
          barisAwal: chunks[i].barisAwal,
          barisAkhir: chunks[i].barisAkhir,
          content: chunks[i].content,
          generatedBy: 'fallback'
        });
        
        logProgress('FASE 1', `Potongan ${i + 1} gagal, pakai draf`);
      }
    }
    
    return generatedChunks;
  }

  // ==========================================================
  // FASE 2: RETI-RETI LAPIS 1
  // ==========================================================
  
  async phaseRetiRetiL1(chunks) {
    logProgress('FASE 2', `Reti-Reti Lapis 1 — ${chunks.length} potongan × 3 AI`);
    
    const reviewed = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Konteks: potongan sebelum & sesudah
      const contextBefore = i > 0 ? chunks[i - 1].content.substring(chunks[i - 1].content.length - 200) : '';
      const contextAfter = i < chunks.length - 1 ? chunks[i + 1].content.substring(0, 200) : '';
      const context = { before: contextBefore, after: contextAfter, chunkIndex: i, totalChunks: chunks.length };
      
      // 3 AI paralel
      const [reviewGemini, reviewDeepSeek, reviewMistral] = await Promise.allSettled([
        reviewWithGemini(PROMPT_REVIEW_L1_GEMINI, chunk.content, context),
        reviewWithDeepSeek(PROMPT_REVIEW_L1_DEEPSEEK, chunk.content, context),
        reviewWithMistral(PROMPT_REVIEW_L1_MISTRAL, chunk.content, context),
      ]);
      
      // Komparator
      const reviews = [
        reviewGemini.status === 'fulfilled' ? reviewGemini.value : { errors: [], warnings: [], fixedCode: chunk.content, status: 'error' },
        reviewDeepSeek.status === 'fulfilled' ? reviewDeepSeek.value : { errors: [], warnings: [], fixedCode: chunk.content, status: 'error' },
        reviewMistral.status === 'fulfilled' ? reviewMistral.value : { errors: [], warnings: [], fixedCode: chunk.content, status: 'error' },
      ];
      
      const comparison = compareReviews(reviews);
      
      reviewed.push({
        ...chunk,
        reviews: reviews,
        comparison: comparison,
        finalContent: comparison.finalCode,
        status: comparison.status,
        conflicts: comparison.conflicts
      });
      
      logProgress('FASE 2', `Potongan ${i + 1}/${chunks.length} → ${comparison.status}`);
    }
    
    return reviewed;
  }

  // ==========================================================
  // FASE 3: RETI-RETI LAPIS 2
  // ==========================================================
  
  async phaseRetiRetiL2(chunksAfterL1) {
    logProgress('FASE 3', `Reti-Reti Lapis 2 — ${chunksAfterL1.length} potongan × 3 AI (beda sudut)`);
    
    const reviewed = [];
    
    for (let i = 0; i < chunksAfterL1.length; i++) {
      const chunk = chunksAfterL1[i];
      
      // Konteks dari L1
      const l1Context = {
        before: i > 0 ? chunksAfterL1[i - 1].finalContent?.substring(chunksAfterL1[i - 1].finalContent.length - 200) : '',
        after: i < chunksAfterL1.length - 1 ? chunksAfterL1[i + 1].finalContent?.substring(0, 200) : '',
        l1Findings: chunk.comparison,
        chunkIndex: i,
        totalChunks: chunksAfterL1.length
      };
      
      // 3 AI paralel (beda sudut)
      const [reviewDeepSeek, reviewGemini, reviewMistral] = await Promise.allSettled([
        reviewWithDeepSeek(PROMPT_REVIEW_L2_DEEPSEEK, chunk.finalContent, l1Context),
        reviewWithGemini(PROMPT_REVIEW_L2_GEMINI, chunk.finalContent, l1Context),
        reviewWithMistral(PROMPT_REVIEW_L2_MISTRAL, chunk.finalContent, l1Context),
      ]);
      
      const reviewsL2 = [
        reviewDeepSeek.status === 'fulfilled' ? reviewDeepSeek.value : { verified: true, newIssues: [], status: 'error' },
        reviewGemini.status === 'fulfilled' ? reviewGemini.value : { verified: true, newIssues: [], status: 'error' },
        reviewMistral.status === 'fulfilled' ? reviewMistral.value : { verified: true, newIssues: [], status: 'error' },
      ];
      
      // Komparator L1 vs L2
      const comparison = compareReviewsL1vsL2(chunk.comparison, reviewsL2);
      
      reviewed.push({
        ...chunk,
        reviewsL2: reviewsL2,
        finalComparison: comparison,
        finalContent: comparison.finalCode,
        finalStatus: comparison.status,
        unresolvedConflicts: comparison.unresolvedConflicts
      });
      
      logProgress('FASE 3', `Potongan ${i + 1}/${chunksAfterL1.length} → ${comparison.status}`);
    }
    
    return reviewed;
  }

  // ==========================================================
  // FASE 4: ASSEMBLY
  // ==========================================================
  
  async phaseAssemble(chunks) {
    logProgress('FASE 4', 'Assembly — Rakit + Analisis');
    
    // Siapkan metadata untuk AI Perakit
    const metadata = chunks.map(c => ({
      id: c.id,
      barisAwal: c.barisAwal,
      barisAkhir: c.barisAkhir,
      status: c.finalStatus,
      conflicts: c.unresolvedConflicts || []
    }));
    
    // Panggil AI Perakit (HANYA analisis, tidak ubah kode)
    const assemblerResult = await this.callAssemblerAI(metadata, chunks);
    
    // Assembly fisik (non-AI script)
    const assembledCode = assembleChunks(chunks.map(c => c.finalContent));
    
    return {
      code: assembledCode,
      analysis: assemblerResult.analysis,
      returnedIssues: assemblerResult.returnedIssues,
      metadata: metadata
    };
  }
  
  async callAssemblerAI(metadata, chunks) {
    logProgress('FASE 4', 'AI Perakit menganalisis...');
    
    // Panggil AI dengan prompt assembler
    const analysisPrompt = PROMPT_ASSEMBLER
      .replace('{metadata}', JSON.stringify(metadata))
      .replace('{chunkCount}', chunks.length);
    
    // Pakai Gemini (long context) untuk analisis
    const analysis = await reviewWithGemini(analysisPrompt, '', {
      task: 'assembler',
      totalChunks: chunks.length
    });
    
    return {
      analysis: analysis.analysis || '',
      returnedIssues: analysis.issues || []
    };
  }

  // ==========================================================
  // FASE 5: FINAL SCAN
  // ==========================================================
  
  async phaseFinalScan(code) {
    logProgress('FASE 5', 'Final Scan — Security + Version Check');
    
    const [nvidiaResult, tavilyResult] = await Promise.allSettled([
      scanWithNvidia(code),
      searchWithTavily('check latest versions of dependencies in: ' + code.substring(0, 500))
    ]);
    
    return {
      security: nvidiaResult.status === 'fulfilled' ? nvidiaResult.value : { error: 'Gagal scan' },
      versions: tavilyResult.status === 'fulfilled' ? tavilyResult.value : [],
      passed: nvidiaResult.status === 'fulfilled' && nvidiaResult.value?.safe !== false
    };
  }
}

// ============================================================
// KOMPARATOR L1 VS L2
// ============================================================

function compareReviewsL1vsL2(l1Result, l2Reviews) {
  // l1Result: { status, conflicts, finalCode }
  // l2Reviews: [{ verified, newIssues }]
  
  const allL2Verified = l2Reviews.every(r => r.verified === true);
  const newIssuesFromL2 = l2Reviews.flatMap(r => r.newIssues || []);
  
  let status = 'FINAL';
  let finalCode = l1Result.finalCode;
  let unresolvedConflicts = [];
  
  if (l1Result.status === 'PASS' && allL2Verified) {
    // Double PASS → FINAL
    status = 'FINAL';
  } else if (l1Result.status === 'PASS' && !allL2Verified) {
    // L1 PASS, L2 nemu issues → revisi kecil
    status = 'REVISI_KECIL';
  } else if (l1Result.status === 'REVISI' && allL2Verified) {
    // L1 revisi, L2 OK → pakai revisi L1
    status = 'FINAL';
  } else if (l1Result.status === 'REVISI' && !allL2Verified) {
    // Keduanya nemu masalah → unresolved
    status = 'UNRESOLVED';
    unresolvedConflicts = [...(l1Result.conflicts || []), ...newIssuesFromL2];
  } else {
    status = 'GAGAL';
  }
  
  return {
    status,
    finalCode,
    unresolvedConflicts,
    l1Status: l1Result.status,
    l2Verified: allL2Verified
  };
}

// ============================================================
// EXPORT SINGLETON
// ============================================================

export function createOrchestrator(sessionId) {
  return new Orchestrator(sessionId);
}
