// app/api/upload/route.ts
import { put } from '@vercel/blob';
import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Tidak ada file yang diupload' }),
        { status: 400 }
      );
    }

    // Validasi ukuran file (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'File terlalu besar. Maksimal 20MB' }),
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Tentukan folder berdasarkan tipe file
    const isImage = file.type.startsWith('image/');
    const folder = isImage ? 'vision' : 'files';

    // Upload ke Vercel Blob
    const blob = await put(`\( {folder}/ \){Date.now()}-${file.name}`, buffer, {
      access: 'public',
      contentType: file.type,
    });

    // Baca content jika file teks / code
    let content = '';
    const isTextFile = 
      file.type.includes('text') || 
      file.name.endsWith('.ts') || 
      file.name.endsWith('.tsx') || 
      file.name.endsWith('.js') || 
      file.name.endsWith('.jsx') || 
      file.name.endsWith('.py') || 
      file.name.endsWith('.json') || 
      file.name.endsWith('.md') ||
      file.name.endsWith('.html') ||
      file.name.endsWith('.css');

    if (isTextFile) {
      content = buffer.toString('utf-8');
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: blob.url,
        name: file.name,
        type: file.type,
        size: file.size,
        content: isTextFile ? content : null,
        isImage: isImage,
        pathname: blob.pathname,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Upload Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Gagal mengupload file',
        message: error.message,
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
