// lib/ai-providers.ts
import { createCerebras } from '@ai-sdk/cerebras';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createTogetherAI } from '@ai-sdk/together';
import { createFireworks } from '@ai-sdk/fireworks';
import { createDeepInfra } from '@ai-sdk/deepinfra';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';

export const providers = {
  cerebras: createCerebras({
    apiKey: process.env.CEREBRAS_API_KEY,
  }),
  groq: createGroq({
    apiKey: process.env.GROQ_API_KEY,
  }),
  mistral: createMistral({
    apiKey: process.env.MISTRAL_API_KEY,
  }),
  together: createTogetherAI({
    apiKey: process.env.TOGETHER_API_KEY,
  }),
  fireworks: createFireworks({
    apiKey: process.env.FIREWORKS_API_KEY,
  }),
  deepinfra: createDeepInfra({
    apiKey: process.env.DEEPINFRA_API_KEY,
  }),
  gemini: google({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  }),
  grok: xai({
    apiKey: process.env.GROQ_API_KEY || process.env.XAI_API_KEY, // fallback kalau ada
  }),
} as const;

export type TaskType = 'normal' | 'coding' | 'vision' | 'review' | 'complex' | 'fast';

export function getBestModel(task: TaskType) {
  switch (task) {
    case 'coding':
      // Model terbaik untuk coding (prioritas tinggi)
      return (
        providers.cerebras('cerebras/llama-4-405b') ||
        providers.fireworks('accounts/fireworks/models/deepseek-r1') ||
        providers.groq('qwen2.5-coder-32b') ||
        providers.deepinfra('Qwen/Qwen2.5-Coder-72B-Instruct') ||
        providers.grok('grok-4')
      );

    case 'vision':
      // Model vision terbaik
      return providers.gemini('gemini-2.0-flash-exp') || 
             providers.gemini('gemini-1.5-pro');

    case 'review':
      // Model untuk review & correction
      return providers.cerebras('cerebras/llama-4-405b') || 
             providers.grok('grok-4');

    case 'complex':
      // Untuk task sangat berat & reasoning panjang
      return providers.cerebras('cerebras/llama-4-405b') || 
             providers.grok('grok-4');

    case 'fast':
      // Untuk chat biasa yang butuh cepat
      return providers.groq('llama-4-405b') || 
             providers.cerebras('cerebras/llama-3.3-70b');

    default:
      // Normal chat
      return providers.groq('llama-4-405b') || 
             providers.cerebras('cerebras/llama-3.3-70b') ||
             providers.grok('grok-4');
  }
}

// Helper untuk mendapatkan semua provider yang aktif
export function getAvailableProviders() {
  return Object.keys(providers).filter(key => {
    // Cek apakah API key tersedia (optional)
    return true; // bisa ditambah validasi nanti
  });
}
