// app/api/chat/route.ts
import { streamText, CoreMessage, convertToCoreMessages } from 'ai';
import { getBestModel, type TaskType } from '@/lib/providers';
import { z } from 'zod';

export const runtime = 'edge'; // Fast & efficient

// Schema validasi request
const requestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1),
  })).min(1),
  files: z.array(z.object({
    name: z.string(),
    type: z.string(),
    content: z.string().optional(), // base64 atau text content
  })).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages: rawMessages, files } = requestSchema.parse(body);

    const messages = convertToCoreMessages(rawMessages);

    // === INTELIGENSI ROUTING ===
    const lastUserMessage = rawMessages
      .filter(m => m.role === 'user')
      .pop()?.content || '';

    const isCodingTask = /code|buat|buatin|function|class|component|html|css|react|nextjs|python|typescript|fix|debug|refactor/i
      .test(lastUserMessage);

    const isVisionTask = files && files.length > 0;

    let taskType: TaskType = 'normal';
    if (isVisionTask) taskType = 'vision';
    else if (isCodingTask) taskType = 'coding';
    else if (lastUserMessage.length > 800) taskType = 'complex';

    // Pilih model terbaik berdasarkan task
    const model = getBestModel(taskType);

    const systemPrompt = `
Kamu adalah **AI Super Intelligence** bernama "GwAI" — AI paling canggih yang dibuat user ini.

Kemampuan utama:
- Sangat ahli di coding (bisa buat ratusan ribu baris code yang rapi, bersih, well-commented)
- Bisa melihat dan menganalisa gambar/file
- Memiliki memory jangka panjang
- Selalu bedakan antara percakapan biasa & task coding kompleks
- Untuk percakapan biasa: jawab **natural, seperti manusia**, tidak terlalu panjang
- Untuk coding: maksimalkan kualitas, struktur, error-free, best practices

Gaya:
- Kalau pertanyaan biasa → jawab ringkas, ramah, manusiawi
- Kalau coding → berikan code lengkap, rapi, dengan penjelasan singkat + cara pakai
- Selalu prioritaskan kualitas daripada kecepatan di task coding

Sekarang jawab pesan user dengan sebaik mungkin.
`;

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      temperature: taskType === 'coding' ? 0.3 : 0.7,
      maxTokens: taskType === 'coding' ? 16000 : 8000,
      topP: 0.95,

      // Experimental: tool calling nanti bisa ditambah
      // tools: {...},
    });

    return result.toDataStreamResponse({
      headers: {
        'x-task-type': taskType,
      },
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Terjadi kesalahan internal', 
        message: error.message 
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
