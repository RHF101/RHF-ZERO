// ============================================================
// AI RAKSASA — 10 Provider AI Clients
// ============================================================

import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { CONFIG, API_KEYS, MODELS } from '../config.js';
import { logProgress, retryWithBackoff } from '../utils.js';

// ============================================================
// INISIALISASI CLIENT
// ============================================================

const groq = new Groq({ apiKey: API_KEYS.GROQ });

const geminiAI = new GoogleGenerativeAI(API_KEYS.GEMINI);
const geminiModel = geminiAI.getGenerativeModel({ model: MODELS.GEMINI });

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: API_KEYS.DEEPSEEK,
});

const mistral = new OpenAI({
  baseURL: 'https://api.mistral.ai/v1',
  apiKey: API_KEYS.MISTRAL,
});

const cerebras = new OpenAI({
  baseURL: 'https://api.cerebras.ai/v1',
  apiKey: API_KEYS.CEREBRAS,
});

const together = new OpenAI({
  baseURL: 'https://api.together.xyz/v1',
  apiKey: API_KEYS.TOGETHER,
});

const fireworks = new OpenAI({
  baseURL: 'https://api.fireworks.ai/inference/v1',
  apiKey: API_KEYS.FIREWORKS,
});

const nvidia = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: API_KEYS.NVIDIA,
});

// ============================================================
// GENERATE FUNCTIONS (FASE 1)
// ============================================================

export async function generateWithGroq(systemPrompt, userMessage, maxTokens) {
  logProgress('AI', 'Groq generate...');
  
  const response = await retryWithBackoff(
    () => groq.chat.completions.create({
      model: MODELS.GROQ,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: maxTokens || CONFIG.MAX_OUTPUT_TOKENS_FAST,
      temperature: 0.3,
    }),
    CONFIG.MAX_RETRIES,
    CONFIG.RETRY_DELAY_MS
  );
  
  return response.choices[0].message.content;
}

export async function generateWithCerebras(systemPrompt, userMessage, maxTokens) {
  logProgress('AI', 'Cerebras generate...');
  
  const response = await retryWithBackoff(
    () => cerebras.chat.completions.create({
      model: MODELS.CEREBRAS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: maxTokens || CONFIG.MAX_OUTPUT_TOKENS_FAST,
      temperature: 0.3,
    }),
    CONFIG.MAX_RETRIES,
    CONFIG.RETRY_DELAY_MS
  );
  
  return response.choices[0].message.content;
}

export async function generateWithTogether(systemPrompt, userMessage, maxTokens) {
  logProgress('AI', 'Together AI generate...');
  
  const response = await retryWithBackoff(
    () => together.chat.completions.create({
      model: MODELS.TOGETHER,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: maxTokens || CONFIG.MAX_OUTPUT_TOKENS_FAST,
      temperature: 0.3,
    }),
    CONFIG.MAX_RETRIES,
    CONFIG.RETRY_DELAY_MS
  );
  
  return response.choices[0].message.content;
}

export async function generateWithFireworks(systemPrompt, userMessage, maxTokens) {
  logProgress('AI', 'Fireworks generate...');
  
  const response = await retryWithBackoff(
    () => fireworks.chat.completions.create({
      model: MODELS.FIREWORKS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: maxTokens || CONFIG.MAX_OUTPUT_TOKENS_FAST,
      temperature: 0.3,
    }),
    CONFIG.MAX_RETRIES,
    CONFIG.RETRY_DELAY_MS
  );
  
  return response.choices[0].message.content;
}

export async function generateWithMistral(systemPrompt, userMessage, maxTokens) {
  logProgress('AI', 'Mistral generate...');
  
  const response = await retryWithBackoff(
    () => mistral.chat.completions.create({
      model: MODELS.MISTRAL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: maxTokens || CONFIG.MAX_OUTPUT_TOKENS_FAST,
      temperature: 0.3,
    }),
    CONFIG.MAX_RETRIES,
    CONFIG.RETRY_DELAY_MS
  );
  
  return response.choices[0].message.content;
}

// ============================================================
// REVIEW FUNCTIONS (FASE 2 & 3)
// ============================================================

export async function reviewWithGemini(prompt, code, context = {}) {
  logProgress('AI', 'Gemini review...');
  
  const fullPrompt = prompt
    .replace('{code}', code)
    .replace('{before}', context.before || '')
    .replace('{after}', context.after || '')
    .replace('{chunkIndex}', context.chunkIndex ?? '?')
    .replace('{totalChunks}', context.totalChunks ?? '?')
    .replace('{l1Findings}', context.l1Findings ? JSON.stringify(context.l1Findings) : '{}');
  
  try {
    const result = await retryWithBackoff(
      () => geminiModel.generateContent(fullPrompt),
      CONFIG.MAX_RETRIES,
      CONFIG.RETRY_DELAY_MS
    );
    
    const text = result.response.text();
    
    // Parse JSON dari output Gemini
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Fallback: bukan JSON, return mentah
    }
    
    return { errors: [], warnings: [], fixedCode: code, summary: text };
  } catch (error) {
    logProgress('AI', `Gemini error: ${error.message}`);
    return { errors: [], warnings: [], fixedCode: code, status: 'error', summary: error.message };
  }
}

export async function reviewWithDeepSeek(prompt, code, context = {}) {
  logProgress('AI', 'DeepSeek review...');
  
  const fullPrompt = prompt
    .replace('{code}', code)
    .replace('{before}', context.before || '')
    .replace('{after}', context.after || '')
    .replace('{chunkIndex}', context.chunkIndex ?? '?')
    .replace('{totalChunks}', context.totalChunks ?? '?')
    .replace('{l1Findings}', context.l1Findings ? JSON.stringify(context.l1Findings) : '{}');
  
  try {
    const response = await retryWithBackoff(
      () => deepseek.chat.completions.create({
        model: MODELS.DEEPSEEK,
        messages: [
          { role: 'system', content: 'Output JSON hanya.' },
          { role: 'user', content: fullPrompt }
        ],
        max_tokens: CONFIG.MAX_OUTPUT_TOKENS_REVIEW,
        temperature: 0.2,
      }),
      CONFIG.MAX_RETRIES,
      CONFIG.RETRY_DELAY_MS
    );
    
    const text = response.choices[0].message.content;
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {}
    
    return { errors: [], warnings: [], fixedCode: code, summary: text };
  } catch (error) {
    logProgress('AI', `DeepSeek error: ${error.message}`);
    return { errors: [], warnings: [], fixedCode: code, status: 'error', summary: error.message };
  }
}

export async function reviewWithMistral(prompt, code, context = {}) {
  logProgress('AI', 'Mistral review...');
  
  const fullPrompt = prompt
    .replace('{code}', code)
    .replace('{before}', context.before || '')
    .replace('{after}', context.after || '')
    .replace('{chunkIndex}', context.chunkIndex ?? '?')
    .replace('{totalChunks}', context.totalChunks ?? '?')
    .replace('{l1Findings}', context.l1Findings ? JSON.stringify(context.l1Findings) : '{}');
  
  try {
    const response = await retryWithBackoff(
      () => mistral.chat.completions.create({
        model: MODELS.MISTRAL,
        messages: [
          { role: 'system', content: 'Output JSON hanya.' },
          { role: 'user', content: fullPrompt }
        ],
        max_tokens: CONFIG.MAX_OUTPUT_TOKENS_REVIEW,
        temperature: 0.2,
      }),
      CONFIG.MAX_RETRIES,
      CONFIG.RETRY_DELAY_MS
    );
    
    const text = response.choices[0].message.content;
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {}
    
    return { errors: [], warnings: [], fixedCode: code, summary: text };
  } catch (error) {
    logProgress('AI', `Mistral error: ${error.message}`);
    return { errors: [], warnings: [], fixedCode: code, status: 'error', summary: error.message };
  }
}

// ============================================================
// RISET (FASE 0)
// ============================================================

export async function searchWithTavily(query, maxResults = 5) {
  logProgress('AI', 'Tavily search...');
  
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: API_KEYS.TAVILY,
        query: query,
        max_results: maxResults,
        search_depth: 'advanced',
      }),
    });
    
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    logProgress('AI', `Tavily error: ${error.message}`);
    return [];
  }
}

// ============================================================
// FINAL SCAN (FASE 5)
// ============================================================

export async function scanWithNvidia(code) {
  logProgress('AI', 'NVIDIA NIM security scan...');
  
  try {
    const response = await retryWithBackoff(
      () => nvidia.chat.completions.create({
        model: MODELS.NVIDIA,
        messages: [
          {
            role: 'system',
            content: 'Kamu security scanner. Periksa kode ini untuk kerentanan keamanan. Output JSON: { "safe": true/false, "vulnerabilities": ["deskripsi"] }'
          },
          { role: 'user', content: code.substring(0, 4000) }
        ],
        max_tokens: 1024,
        temperature: 0.1,
      }),
      2,
      CONFIG.RETRY_DELAY_MS
    );
    
    const text = response.choices[0].message.content;
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {}
    
    return { safe: true, vulnerabilities: [] };
  } catch (error) {
    logProgress('AI', `NVIDIA error: ${error.message}`);
    return { safe: true, vulnerabilities: [], error: error.message };
  }
}

export async function testWithCloudflare(code) {
  logProgress('AI', 'Cloudflare edge test...');
  
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${API_KEYS.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3-8b-instruct`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEYS.CLOUDFLARE}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'Cek apakah kode ini bisa berjalan di edge (Cloudflare Workers). Output JSON: { "compatible": true/false, "issues": [] }'
            },
            { role: 'user', content: code.substring(0, 2000) }
          ]
        }),
      }
    );
    
    const data = await response.json();
    
    if (data.result?.response) {
      try {
        const jsonMatch = data.result.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      } catch (e) {}
    }
    
    return { compatible: true, issues: [] };
  } catch (error) {
    logProgress('AI', `Cloudflare error: ${error.message}`);
    return { compatible: true, issues: [], error: error.message };
  }
      }
