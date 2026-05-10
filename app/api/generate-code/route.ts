// app/api/generate-code/route.ts
import { streamText, CoreMessage } from 'ai';
import { getBestModel } from '@/lib/providers';
import { z } from 'zod';

export const runtime = 'edge';
export const maxDuration = 60; // maksimal 60 detik

const requestSchema = z.object({
  prompt: z.string().min(10),
  context: z.string().optional(),
  files: z.array(z.object({
    name: z.string(),
    content: z.string(),
    language: z.string().optional(),
  })).optional(),
  requirements: z.array(z.string()).optional(),
});

// System Prompt Khusus Coding Super
const codingSystemPrompt = `
Kamu adalah **GwAI Coder** — AI Coding Super Intelligence level tertinggi.

Tugas kamu:
- Menghasilkan kode berkualitas sangat tinggi, bersih, rapi, scalable, dan production-ready.
- Selalu gunakan best practices, struktur folder yang baik, typing yang ketat (TypeScript), error handling, dan komentar yang membantu.
- Kode harus siap pakai, lengkap, dan minim bug.
- Support berbagai teknologi: Next.js, React, Tailwind, Node.js, Python, dll.

Aturan Penting:
- Tulis kode sepanjang yang diperlukan (bisa ribuan baris).
- Gunakan formatting yang sempurna (indentasi 2 spasi, spasi konsisten).
- Sertakan penjelasan singkat di bagian atas file.
- Jika ada beberapa file, pisahkan dengan jelas menggunakan markdown code block + nama file.
- Selalu prioritaskan kualitas, keamanan, dan maintainability.
- Cek ulang logic, edge cases, dan potensi error sebelum mengirim.

User akan memberikan instruksi coding. Jawablah dengan kode terbaik yang kamu bisa buat.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, context, files, requirements } = requestSchema.parse(body);

    const model = getBestModel('coding'); // Pakai model coding terbaik

    let userContent = `**Permintaan:**\n${prompt}\n\n`;

    if (context) {
      userContent += `**Konteks Tambahan:**\n${context}\n\n`;
    }

    if (files && files.length > 0) {
      userContent += `**File yang sudah ada:**\n`;
      files.forEach(file => {
        userContent += `- \( {file.name} ( \){file.language || 'unknown'})\n`;
      });
      userContent += `\n`;
    }

    if (requirements && requirements.length > 0) {
      userContent += `**Requirements:**\n${requirements.map(r => `- ${r}`).join('\n')}\n\n`;
    }

    const messages: CoreMessage[] = [
      { role: 'system', content: codingSystemPrompt },
      { role: 'user', content: userContent }
    ];

    const result = streamText({
      model,
      messages,
      temperature: 0.2,           // Rendah = lebih konsisten & akurat
      maxTokens: 32000,           // Maksimal token untuk code besar
      topP: 0.9,
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });

    return result.toDataStreamResponse({
      headers: {
        'x-generated-by': 'GwAI-Coder',
        'x-task': 'heavy-coding',
      },
    });

  } catch (error: any) {
    console.error('Generate Code Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Gagal generate code',
        message: error.message
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
