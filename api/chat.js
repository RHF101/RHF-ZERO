// api/chat.js — RHF ZERO v5 Chat Handler
// Mode: santai | serius | detektif | scraper | 3d | godot | unity | roblox | unreal | search | pintar

import { saveMessage, createChat } from './memory.js';

// ── Ekstensi download default per mode ──
const MODE_EXT = {
  santai:'txt', serius:'txt', detektif:'txt', scraper:'py',
  '3d':'html', godot:'gd', unity:'cs', roblox:'lua', unreal:'cpp',
  search:'txt', pintar:'txt'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, history, image, uid, chatId } = req.body;
  if (!message && !image) return res.status(400).json({ error: 'Pesan kosong' });

  // Bangun konteks memori
  let memCtx = '';
  if (history?.length) memCtx = '\n[RIWAYAT CHAT TERAKHIR]\n' + history.slice(-30).join('\n');

  let response = null;

  // ════════════════════════════════════════════════
  // MODE: SEARCH — Google real-time search
  // ════════════════════════════════════════════════
  if (mode === 'search') {
    try {
      // Ambil hasil search dulu
      const srRes = await fetch(
        `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/api/search`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: message }) }
      );
      const srData = await srRes.json();
      const results = srData.results || [];

      // Format hasil ke teks konteks untuk AI
      let searchCtx = '';
      if (results.length > 0) {
        searchCtx = '\n[HASIL PENCARIAN INTERNET]\n' +
          results.slice(0, 5).map((r, i) => `${i+1}. ${r.title}\n   ${r.snippet}\n   Sumber: ${r.link}`).join('\n\n');
      }

      const sp = `Kamu RHF ZERO, asisten AI dengan akses internet real-time.
${searchCtx}

Berdasarkan hasil pencarian di atas, jawab pertanyaan user dengan:
- Ringkas informasi paling relevan
- Sebutkan sumber jika penting
- Gunakan bahasa Indonesia yang natural
- Jika ada angka/data spesifik, sebutkan dengan akurat
- Jika hasil search kosong, jawab dari pengetahuan kamu`;

      response = await callAI(message, sp, 2000, 0.4);

      // Tambahkan data search ke response
      if (results.length > 0) {
        const searchBlock = '\n\n---\n🔍 SUMBER:\n' +
          results.slice(0, 4).map(r => `• [${r.title}](${r.link})`).join('\n');
        response = (response || '') + searchBlock;
      }
    } catch (e) {
      console.error('[search mode]', e.message);
      response = await callAI(message, `Kamu RHF ZERO. Jawab pertanyaan ini sebaik mungkin dari pengetahuanmu:\n${message}`, 800, 0.5);
    }
  }

  // ════════════════════════════════════════════════
  // MODE: DETEKTIF — Vision (analisis gambar super akurat)
  // ════════════════════════════════════════════════
  if (!response && mode === 'detektif' && image) {
    try {
      const imgData = image.replace(/^data:image\/\w+;base64,/, '');
      const prompt  = message ||
        'Lakukan analisis SUPER LENGKAP gambar ini:\n' +
        '1. Baca SEMUA teks yang terlihat (OCR akurat)\n' +
        '2. Jika ada soal/pertanyaan → jawab dengan langkah detail\n' +
        '3. Jika ada rumus matematika → selesaikan step by step\n' +
        '4. Jika ada diagram/grafik → jelaskan data yang ditampilkan\n' +
        '5. Jika ada tabel → ekstrak semua data\n' +
        '6. Identifikasi semua objek, teks, dan konteks gambar\n' +
        'Pastikan akurasi 100%. Jangan lewatkan detail apapun.';

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inlineData: { mimeType: 'image/jpeg', data: imgData } }
              ]
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
          })
        }
      );
      const d = await r.json();
      response = d.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (e) {
      console.error('[detektif]', e.message);
    }
  }

  // Detektif tanpa gambar → analisis teks
  if (!response && mode === 'detektif' && !image) {
    const sp = `Kamu RHF ZERO, ahli analisis dan investigasi.
Analisis input berikut secara mendalam, cermat, dan komprehensif.
Identifikasi: pola, anomali, kesimpulan, dan rekomendasi.`;
    response = await callAI(message, sp, 3000, 0.3);
  }

  // ════════════════════════════════════════════════
  // MODE: PINTAR — Akademik super detail
  // ════════════════════════════════════════════════
  if (!response && mode === 'pintar') {
    const sp = `Kamu RHF ZERO, profesor AI yang sangat cerdas dan akurat. Kamu ahli di:
Matematika, Fisika, Kimia, Biologi, Sejarah, Geografi, Bahasa, Sastra, Ekonomi, Komputer.

ATURAN MENJAWAB:
1. Jawab dengan LANGKAH-LANGKAH DETAIL yang jelas dan terstruktur
2. Untuk matematika/sains: tunjukkan SETIAP LANGKAH perhitungan, jangan lewatkan
3. Pastikan jawaban 100% BENAR — kalkulasi ulang sebelum menjawab
4. Untuk soal cerita: identifikasi yang diketahui, ditanya, dan rumus yang dipakai
5. Gunakan notasi yang tepat (simbol, satuan, format)
6. Berikan PENJELASAN MENGAPA setiap langkah dilakukan
7. Di akhir, berikan kesimpulan yang jelas

CONTOH FORMAT MATEMATIKA:
Soal: 24 - 1 + 2 - 3 + 4
Langkah 1: 24 - 1 = 23
Langkah 2: 23 + 2 = 25
Langkah 3: 25 - 3 = 22
Langkah 4: 22 + 4 = 26
Jawaban: 26

Selalu cek ulang perhitunganmu sebelum menjawab!`;
    response = await callAI(message, sp, 4096, 0.1);
  }

  // ════════════════════════════════════════════════
  // MODE: SERIUS — Coding expert
  // ════════════════════════════════════════════════
  if (!response && mode === 'serius') {
    const sp = `Kamu RHF ZERO, coding expert tingkat senior.
TULIS KODE SAJA — tanpa preamble, tanpa penjelasan panjang.
Output kode dalam markdown code block sesuai bahasa.
Kode harus LENGKAP, production-ready, tidak ada TODO placeholder.
Sertakan komentar penting di dalam kode.`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ════════════════════════════════════════════════
  // MODE: SCRAPER
  // ════════════════════════════════════════════════
  if (!response && mode === 'scraper') {
    const sp = `Kamu RHF ZERO, expert web scraping dan data extraction.
Tulis kode scraper LENGKAP (Python/Node.js) siap dijalankan.
Gunakan library populer: requests+BeautifulSoup, selenium, puppeteer, cheerio, playwright.
Sertakan: error handling, rate limiting, retry logic, output ke CSV/JSON.
Output KODE SAJA dalam markdown code block.`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ════════════════════════════════════════════════
  // MODE: 3D — Three.js Web Scene
  // ════════════════════════════════════════════════
  if (!response && mode === '3d') {
    const sp = `Kamu RHF ZERO, expert 3D graphics dengan Three.js r128.

OUTPUT: HANYA kode HTML mentah <!DOCTYPE html> sampai </html>. Tidak ada markdown, tidak ada teks lain.

CDN WAJIB (jangan ubah):
- Three.js: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
- OrbitControls: https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js

WAJIB IMPLEMENTASI:
1. renderer.setAnimationLoop untuk loop animasi mulus
2. OrbitControls dengan mouse rotate/zoom/pan
3. AmbientLight + DirectionalLight + optional PointLight/SpotLight
4. Canvas 100% viewport (window.innerWidth x window.innerHeight) + window resize handler
5. Koordinat objek TEPAT: gunakan (x, y, z) yang masuk akal, objek tidak tumpang tindih
6. Scene LENGKAP sesuai deskripsi:
   - Karakter humanoid: Group dari BoxGeometry(kepala/badan) + CylinderGeometry(kaki/lengan)
   - JANGAN CapsuleGeometry (tidak ada di r128)
   - Hujan: Points dengan >2000 partikel, animasi jatuh, reset ke atas
   - Tanah: PlaneGeometry horizontal besar, rotateX(-Math.PI/2)
   - Pohon: ConeGeometry(daun hijau) di atas CylinderGeometry(batang coklat), posisi acak
   - Langit: SphereGeometry besar dari dalam, atau fog + background color
   - NPC/karakter tambahan: posisi berbeda dari player
   - Objek bergerak: animasi dalam loop
7. Fog untuk efek kedalaman
8. Shadow jika ada directional light (renderer.shadowMap.enabled = true)`;
    response = await callAI(message, sp, 8192, 0.25);
    if (response) {
      response = response.replace(/^```html\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'').trim();
      const m = response.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
      if (m) response = m[0];
    }
  }

  // ════════════════════════════════════════════════
  // MODE: GODOT 4
  // ════════════════════════════════════════════════
  if (!response && mode === 'godot') {
    const sp = `Kamu RHF ZERO, Godot Engine 4 expert.
Generate file Godot 4 LENGKAP. Output kode dalam markdown code block.

FORMAT MULTI-FILE:
\`\`\`gdscript
## FILE: player.gd
extends CharacterBody3D
...(kode lengkap)
\`\`\`
\`\`\`tscn
## FILE: player.tscn
[gd_scene format=3]
...(scene lengkap)
\`\`\`

WAJIB:
- Sintaks Godot 4: @export, @onready, extends, func _ready(), func _process(delta)
- CharacterBody3D + move_and_slide() untuk karakter (Godot 4 API)
- Type hints: var speed: float = 5.0
- Signal yang relevan
- Komentar di bagian kritis
- Jika ada 3D scene: sertakan node hierarchy lengkap di .tscn
- Koordinat/transform objek yang masuk akal
- JANGAN Godot 3 syntax`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ════════════════════════════════════════════════
  // MODE: UNITY
  // ════════════════════════════════════════════════
  if (!response && mode === 'unity') {
    const sp = `Kamu RHF ZERO, Unity Engine expert (Unity 2022 LTS / Unity 6).
Generate file Unity LENGKAP. Output dalam markdown code block.

FORMAT MULTI-FILE:
\`\`\`csharp
// FILE: PlayerController.cs
using UnityEngine;
...(kode lengkap)
\`\`\`

WAJIB:
- using statements lengkap di atas
- [SerializeField] private untuk inspector fields
- [Header("Kategori")] untuk grouping
- Summary XML comment untuk method public
- Awake/Start/Update/FixedUpdate sesuai kebutuhan
- New Input System jika ada input (InputAction, InputActionAsset)
- Rigidbody vs CharacterController sesuai konteks
- TextMeshProUGUI untuk UI text
- COMPILE READY — tidak ada error syntax
- Tidak ada TODO palsu`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ════════════════════════════════════════════════
  // MODE: ROBLOX
  // ════════════════════════════════════════════════
  if (!response && mode === 'roblox') {
    const sp = `Kamu RHF ZERO, Roblox Studio expert dengan Luau.
Generate script Roblox LENGKAP. Output dalam markdown code block \`\`\`lua

FORMAT MULTI-FILE:
\`\`\`lua
-- FILE: PlayerController [LocalScript - StarterPlayerScripts]
-- RHF ZERO v5
local Players = game:GetService("Players")
...(kode lengkap)
\`\`\`

WAJIB:
- Semua service via game:GetService()
- task.wait() bukan wait(), task.spawn() bukan spawn()
- pcall() untuk DataStore, HTTP, operasi berisiko
- RemoteEvent/Function di ReplicatedStorage untuk client-server
- Validasi input DI SERVER — jangan percaya client
- Type annotation Luau: local health: number = 100
- Header komentar tipe script: LocalScript/Script/ModuleScript + lokasi
- Modern Roblox API: ContextActionService, UserInputService, RunService`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ════════════════════════════════════════════════
  // MODE: UNREAL ENGINE 5
  // ════════════════════════════════════════════════
  if (!response && mode === 'unreal') {
    const sp = `Kamu RHF ZERO, Unreal Engine 5 expert (C++ + Blueprint).
Generate file UE5 LENGKAP. Output dalam markdown code block.

FORMAT:
\`\`\`cpp
// FILE: AMyCharacter.h
#pragma once
#include "CoreMinimal.h"
...(header lengkap)
\`\`\`
\`\`\`cpp
// FILE: AMyCharacter.cpp
#include "AMyCharacter.h"
...(source lengkap)
\`\`\`

WAJIB:
- Header: #pragma once, UCLASS(), GENERATED_BODY()
- UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Nama")
- UFUNCTION(BlueprintCallable, Category="Nama")
- Naming: A=Actor, U=UObject, F=Struct, I=Interface
- TObjectPtr<> untuk UObject references
- Enhanced Input System (UInputMappingContext, UInputAction)
- UE_LOG(LogTemp, Warning, TEXT("..."))
- Constructor: PrimaryActorTick.bCanEverTick = true
- BeginPlay() dan Tick() override yang benar`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ════════════════════════════════════════════════
  // MODE: SANTAI (default fallback)
  // ════════════════════════════════════════════════
  if (!response) {
    const sp = `Kamu RHF ZERO, asisten AI personal yang cerdas, friendly, dan helpful.
${memCtx}
Jawab SINGKAT dan natural. Maks 3-4 kalimat kecuali diminta lebih panjang.
Bahasa Indonesia santai, boleh campur bahasa teknis jika perlu.`;
    response = await callAI(message, sp, 800, 0.8);
  }

  if (!response) response = 'Maaf, semua AI provider sedang sibuk. Coba lagi dalam beberapa detik.';

  // ── Deteksi format ──
  const format = detectFormat(response, mode);

  // ── Simpan ke Firebase ──
  if (uid && chatId) {
    try {
      await createChat(uid, chatId, { title: (message||'Chat').substring(0,40), mode: mode||'santai' });
      await saveMessage(uid, chatId, { role:'user', content: message||'[Gambar]', format:'txt', mode: mode||'santai' });
      await saveMessage(uid, chatId, { role:'ai',   content: response, format, mode: mode||'santai' });
    } catch (e) { console.error('[chat] memory error:', e.message); }
  }

  return res.json({
    mode:     mode || 'santai',
    response,
    format,
    ext:      MODE_EXT[mode] || 'txt',
  });
}

// ── Format detector ──
function detectFormat(r, mode) {
  if (['godot','unity','roblox','unreal','serius','scraper'].includes(mode) && r.includes('```')) return 'code';
  if (r.includes('<!DOCTYPE html') || r.includes('<!doctype html')) return 'html';
  if (r.includes('<?php')) return 'php';
  if ((r.includes('def ') && r.includes('return ')) || (r.includes('import ') && r.includes('def '))) return 'py';
  if (r.includes('function ') && (r.includes('const ') || r.includes('var '))) return 'js';
  if (r.includes('```')) return 'code';
  return 'txt';
}

// ════════════════════════════════════════════════
// callAI — Waterfall: Groq → OpenRouter → Gemini
// ════════════════════════════════════════════════
async function callAI(msg, sp, maxT, temp) {
  // GROQ
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model:'llama-3.3-70b-versatile', messages:[{role:'system',content:sp},{role:'user',content:msg}], max_tokens:maxT, temperature:temp })
    });
    const d = await r.json();
    const t = d.choices?.[0]?.message?.content;
    if (t?.length > 10) return t;
  } catch(e) { console.error('[AI] Groq:', e.message); }

  // OPENROUTER
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer':'https://rhf-zero.vercel.app', 'X-Title':'RHF ZERO' },
      body: JSON.stringify({ model:'nousresearch/hermes-3-llama-3.1-70b', messages:[{role:'system',content:sp},{role:'user',content:msg}], max_tokens:maxT, temperature:temp })
    });
    const d = await r.json();
    const t = d.choices?.[0]?.message?.content;
    if (t?.length > 10) return t;
  } catch(e) { console.error('[AI] OpenRouter:', e.message); }

  // GEMINI fallback
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ contents:[{ parts:[{ text: sp+'\n\nUser: '+msg }] }], generationConfig:{maxOutputTokens:maxT,temperature:temp} }) }
    );
    const d = await r.json();
    const t = d.candidates?.[0]?.content?.parts?.[0]?.text;
    if (t?.length > 10) return t;
  } catch(e) { console.error('[AI] Gemini:', e.message); }

  return null;
}
