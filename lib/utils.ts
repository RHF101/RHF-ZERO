// lib/utils.ts
import { CoreMessage } from 'ai';

/**
 * Estimasi jumlah token (sangat berguna untuk memory management)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough estimation: 1 token ≈ 4 characters (English + code)
  return Math.ceil(text.length / 4) + 10; // buffer
}

/**
 * Extract code blocks from markdown
 */
export function extractCodeBlocks(text: string): Array<{
  language: string;
  code: string;
  filename?: string;
}> {
  const codeBlockRegex = /```(?:(\w+))?\s*\n([\s\S]*?)```/g;
  const blocks: Array<{ language: string; code: string; filename?: string }> = [];
  
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const language = match[1] || 'plaintext';
    let code = match[2].trim();

    // Coba deteksi filename dari komentar pertama
    const firstLine = code.split('\n')[0];
    let filename: string | undefined;

    if (firstLine?.includes('filename:') || firstLine?.includes('file:')) {
      filename = firstLine.split(/[:=]/)[1]?.trim();
      code = code.split('\n').slice(1).join('\n').trim();
    }

    blocks.push({ language, code, filename });
  }

  return blocks;
}

/**
 * Format date untuk UI
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Deteksi tipe file berdasarkan extension
 */
export function getFileLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    yaml: 'yaml',
    yml: 'yaml',
  };

  return languageMap[ext || ''] || 'plaintext';
}

/**
 * Truncate teks dengan ellipsis
 */
export function truncate(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Sanitize input untuk keamanan
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .trim();
}

/**
 * Generate conversation title otomatis
 */
export function generateConversationTitle(prompt: string): string {
  const cleanPrompt = prompt.trim();
  
  if (cleanPrompt.length < 30) return cleanPrompt;
  
  // Ambil 4-6 kata pertama
  const words = cleanPrompt.split(' ').slice(0, 6);
  let title = words.join(' ');
  
  if (title.length > 45) {
    title = title.slice(0, 42) + '...';
  }
  
  return title;
}

/**
 * Cek apakah pesan mengandung permintaan coding
 */
export function isCodingRequest(message: string): boolean {
  const codingKeywords = [
    'buat', 'buatin', 'bikin', 'create', 'build', 'develop',
    'component', 'function', 'class', 'api', 'route', 'page',
    'fix', 'debug', 'refactor', 'improve', 'optimize',
    'nextjs', 'react', 'tailwind', 'typescript', 'python'
  ];
  
  const lowerMessage = message.toLowerCase();
  return codingKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Extract base64 dari data URL
 */
export function extractBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] || dataUrl;
}

export default {
  estimateTokens,
  extractCodeBlocks,
  formatDate,
  getFileLanguage,
  truncate,
  sanitizeInput,
  generateConversationTitle,
  isCodingRequest,
  extractBase64,
};
