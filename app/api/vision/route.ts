// app/api/vision/route.ts
import { streamText } from 'ai';
import { getBestModel } from '@/lib/providers';
import { z } from 'zod';

export const runtime = 'edge';
export const maxDuration = 45;

const requestSchema = z.object({
  image: z.string().min(10), // base64 string
  mimeType: z.string().default('image/jpeg'),
  prompt: z.string().min(5),
  context: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, mimeType, prompt, context } = requestSchema.parse(body);

    // Gunakan model vision terbaik (Gemini sangat bagus untuk vision)
    const model = getBestModel('vision');

    const systemPrompt = `
Kamu adalah **GwAI Vision** — AI Vision Intelligence yang sangat tajam dan detail-oriented.

Tugasmu:
- Analisa gambar dengan sangat teliti
- Jelaskan apa yang kamu lihat secara lengkap tapi natural
- Jika ada teks di gambar, baca dan tulis semua teks tersebut
- Jika gambar berhubungan dengan coding (UI, screenshot code, diagram, dll), analisa dan berikan insight teknis
- Jawab sesuai konteks permintaan user

Gaya jawaban:
- Jujur dan detail
- Jika tidak yakin, katakan
- Jika gambar related ke coding, siap bantu generate atau improve code
`;

    let userContent: any = [
      { type: 'text', text: prompt }
    ];

    // Tambahkan image
    userContent.push({
      type: 'image',
      image: image,           // base64
      mimeType: mimeType,
    });

    if (context) {
      userContent.push({
        type: 'text',
        text: `Konteks tambahan: ${context}`
      });
    }

    const result = streamText({
      model,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
      temperature: 0.4,
      maxTokens: 12000,
    });

    return result.toDataStreamResponse({
      headers: {
        'x-task': 'vision-analysis',
        'x-model': 'vision',
      },
    });

  } catch (error: any) {
    console.error('Vision API Error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Gagal menganalisa gambar',
        message: error.message,
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
