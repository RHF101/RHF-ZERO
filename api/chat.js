// api/chat.js — RHF ZERO Chat Handler v3 (3D + Engine + Memory)

import { saveMessage, createChat } from './memory.js';

// Mapping mode → ekstensi file default
const MODE_EXT = {
  godot:  'gd',
  unity:  'cs',
  roblox: 'lua',
  unreal: 'cpp',
  '3d':   'html',
  serius: 'txt',
  scraper:'py',
  santai: 'txt',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, history, facts, image, uid, chatId } = req.body;
  if (!message && !image) return res.status(400).json({ error: 'Pesan kosong' });

  let response = null;

  let memoryText = '';
  if (history && history.length > 0) memoryText += '\n[CHAT]\n' + history.slice(-50).join('\n');
  if (facts && facts.length > 0) memoryText += '\n[FAKTA]\n' + facts.slice(-20).map(f => '- ' + f).join('\n');

  // ── DETEKTIF (Vision) ──
  if (mode === 'detektif' && image) {
    try {
      const parts = [{ text: message || 'Analisis gambar ini secara detail dan mendalam.' }];
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: image.replace(/^data:image\/\w+;base64,/, '') } });
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) }
      );
      const data = await r.json();
      response = data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (e) { console.error('[detektif]', e.message); }
  }

  // ── SERIUS ──
  if (!response && mode === 'serius') {
    const sp = `Kamu RHF ZERO, coding expert tingkat tinggi.
TULIS KODE SAJA tanpa penjelasan. Output dalam markdown code block. Kode LENGKAP dan production-ready.`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ── SCRAPER ──
  if (!response && mode === 'scraper') {
    const sp = `Kamu RHF ZERO, expert web scraping dan data extraction.
Tulis kode scraper LENGKAP (Python/Node.js). Gunakan library populer. Output KODE SAJA dalam markdown.`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ── 3D Three.js ──
  if (!response && mode === '3d') {
    const sp = `Kamu RHF ZERO, expert 3D graphics dengan Three.js.
Tugas: Buat scene Three.js LENGKAP dalam satu file HTML yang bisa langsung dijalankan di browser.
WAJIB:
1. Output HANYA kode HTML mentah dari <!DOCTYPE html> sampai </html>. TIDAK ADA markdown, TIDAK ADA teks lain.
2. CDN: Three.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
3. CDN: OrbitControls https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
4. Gunakan renderer.setAnimationLoop untuk animasi mulus.
5. OrbitControls untuk mouse rotate/zoom/pan.
6. Lighting dramatis: AmbientLight + DirectionalLight.
7. Canvas 100% viewport, responsive resize.
8. Karakter humanoid: Box+Sphere+Cylinder gabungan jadi grup.
9. Hujan: Points geometry particle system ribuan titik jatuh.
10. Tanah/map: PlaneGeometry horizontal.
11. Pohon: ConeGeometry(daun) + CylinderGeometry(batang).
12. Langit: SphereGeometry besar skybox atau fog.
13. JANGAN THREE.CapsuleGeometry (r128). Pakai CylinderGeometry+SphereGeometry.
14. Akses OrbitControls via THREE.OrbitControls setelah CDN load.
Buat scene semenarik dan sedetail mungkin.`;
    response = await callAI(message, sp, 8192, 0.3);
    if (response) {
      response = response.replace(/^```html\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'').trim();
      if (!response.toLowerCase().startsWith('<!doctype html') && !response.toLowerCase().startsWith('<html')) {
        const m = response.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
        if (m) response = m[0];
      }
    }
  }

  // ── GODOT ENGINE ──
  if (!response && mode === 'godot') {
    const sp = `Kamu RHF ZERO, Godot Engine 4 expert.
TUGAS: Generate file Godot 4 LENGKAP sesuai permintaan user.
ATURAN:
1. Output KODE SAJA dalam markdown code block dengan label bahasa tepat.
2. GDScript (.gd): \`\`\`gdscript
3. Scene (.tscn): \`\`\`tscn
4. Resource (.tres): \`\`\`tres  
5. Shader (.gdshader): \`\`\`glsl
6. Multi-file: gunakan header ## FILE: nama_file.ext di atas tiap blok.
7. Gunakan sintaks Godot 4: @export, @onready, extends Node3D, func _process(delta:float), signal, dll.
8. Kode LENGKAP, fungsional, siap paste ke Godot Editor.
9. Sertakan node hierarchy yang benar: Node3D, MeshInstance3D, CollisionShape3D, CharacterBody3D, dll.
10. Export variable dengan type hint. Signal yang relevan. Komentar di bagian penting.
11. Jika scene 3D: sertakan .tscn dengan node tree lengkap.
12. Jika ada physics: gunakan CharacterBody3D + move_and_slide() Godot 4 style.
Buat SEDETAIL dan SELENGKAP mungkin.`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ── UNITY ENGINE ──
  if (!response && mode === 'unity') {
    const sp = `Kamu RHF ZERO, Unity Engine expert (Unity 2022 LTS / Unity 6).
TUGAS: Generate file Unity LENGKAP sesuai permintaan user.
ATURAN:
1. Output KODE SAJA dalam markdown code block.
2. C# (.cs): \`\`\`csharp — satu class per blok, header // FILE: NamaFile.cs
3. Shader (.shader / .hlsl): \`\`\`hlsl
4. Build.cs / asmdef: \`\`\`json
5. WAJIB sertakan:
   - using UnityEngine; dan namespace lain yang dibutuhkan
   - [SerializeField] untuk inspector variables
   - [Header("...")] untuk grouping inspector
   - XML Summary comment untuk method public penting
   - Awake() / Start() / Update() / OnEnable() / OnDisable() sesuai kebutuhan
6. Gunakan modern Unity: New Input System, URP/HDRP jika relevan, Coroutine/UniTask, Events.
7. Physics: Rigidbody vs CharacterController pilih yang tepat. Layer collision setup.
8. UI: TextMeshProUGUI bukan Text lama. Canvas + EventSystem.
9. Kode harus COMPILE tanpa error. Tidak ada TODO palsu.
10. Satu file C# = satu namespace yang konsisten.
Buat SEDETAIL dan SELENGKAP mungkin, production Unity-ready.`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ── ROBLOX STUDIO ──
  if (!response && mode === 'roblox') {
    const sp = `Kamu RHF ZERO, Roblox Studio expert dengan Luau.
TUGAS: Generate script Roblox Studio LENGKAP sesuai permintaan user.
ATURAN:
1. Output KODE SAJA dalam markdown code block \`\`\`lua
2. Multi-script: header -- FILE: ScriptName [LocalScript/Script/ModuleScript]
3. WAJIB konteks placement jelas di komentar header.
4. Gunakan praktik modern Roblox/Luau:
   - game:GetService() untuk SEMUA service
   - Type annotation Luau jika relevan: local x: number = 0
   - RemoteEvent/RemoteFunction untuk Client-Server
   - BindableEvent untuk Server-Server
   - pcall/xpcall untuk error handling
5. UI: ScreenGui, Frame, TextLabel, TextButton di LocalScript
6. Physics modern: LinearVelocity, AngularVelocity, AssemblyLinearVelocity
7. Animasi: AnimationController, Humanoid:LoadAnimation(anim)
8. KEAMANAN: validasi SEMUA di server. Jangan percaya client.
9. Performance: task.wait() bukan wait(). task.spawn() bukan spawn(). task.delay() bukan delay().
10. Gunakan Attributes, CollectionService, InstanceNew pattern yang benar.
11. Header setiap file: -- // RHF ZERO: NamaScript // --
Buat SEDETAIL dan SELENGKAP mungkin, production Roblox-ready.`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ── UNREAL ENGINE 5 ──
  if (!response && mode === 'unreal') {
    const sp = `Kamu RHF ZERO, Unreal Engine 5 expert (C++ dan Blueprint).
TUGAS: Generate file Unreal Engine 5 LENGKAP sesuai permintaan user.
ATURAN:
1. Output KODE SAJA dalam markdown code block.
2. C++ Header: \`\`\`cpp — // FILE: NamaClass.h di atas
3. C++ Source: \`\`\`cpp — // FILE: NamaClass.cpp di atas
4. Blueprint pseudocode/desc: \`\`\`blueprint
5. Build.cs: \`\`\`csharp
6. WAJIB untuk setiap C++ class:
   - #pragma once di header
   - #include "CoreMinimal.h" dan include relevan
   - UCLASS(BlueprintType, Blueprintable) atau macro yang tepat
   - GENERATED_BODY() di dalam class
   - UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="...") untuk properties
   - UFUNCTION(BlueprintCallable, Category="...") untuk functions
   - Constructor, virtual void BeginPlay() override, virtual void Tick()
7. Naming: F=Struct, U=UObject, A=Actor, I=Interface, E=Enum
8. Gunakan TObjectPtr<>, TWeakObjectPtr<> untuk UObject references
9. UE_LOG(LogTemp, Warning, TEXT("...")) untuk logging
10. Enhanced Input System untuk input (bukan deprecated Input axis/action)
11. GAS (GameplayAbilitySystem) jika diminta
12. Modules: sertakan .Build.cs yang benar jika butuh module tambahan
Buat SEDETAIL dan SELENGKAP mungkin, Unreal Engine 5 ready.`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ── SANTAI (default) ──
  if (!response) {
    const sp = `Kamu RHF ZERO, asisten AI personal yang cerdas dan friendly.
${memoryText}
Jawab SINGKAT, natural, dan helpful. Maksimal 3-4 kalimat kecuali diminta lebih panjang.
Gunakan bahasa Indonesia santai. Boleh campuran bahasa jika konteksnya teknis.`;
    response = await callAI(message, sp, 600, 0.8);
  }

  if (!response) response = 'Maaf, semua AI provider sedang sibuk. Coba lagi dalam beberapa detik.';

  const format = detectFormat(response, mode);

  // ── Simpan ke Firebase ──
  if (uid && chatId) {
    try {
      await createChat(uid, chatId, { title: (message || 'Chat').substring(0, 40), mode: mode || 'santai' });
      await saveMessage(uid, chatId, { role: 'user', content: message || '[Gambar]', format: 'txt', mode: mode || 'santai' });
      await saveMessage(uid, chatId, { role: 'ai', content: response, format, mode: mode || 'santai' });
    } catch (memErr) {
      console.error('[chat.js] Memory save error:', memErr.message);
    }
  }

  return res.json({
    mode: mode || 'santai',
    response,
    format,
    ext: MODE_EXT[mode] || 'txt',
    simpan: {
      userMsg: (message || '[Gambar]').substring(0, 200),
      aiMsg: response.substring(0, 200),
      isFakta: /aku |saya |namaku |hobiku |ingat /i.test(message || '')
    }
  });
}

function detectFormat(response, mode) {
  if (['godot','unity','roblox','unreal'].includes(mode)) return 'code';
  const r = response;
  if (r.includes('<!DOCTYPE html') || r.includes('<!doctype html') || r.includes('<html')) return 'html';
  if (r.includes('<?php')) return 'php';
  if (r.includes('import ') && r.includes('def ')) return 'py';
  if (r.includes('def ') && r.includes('return ')) return 'py';
  if (r.includes('const ') || r.includes('function ') || r.includes('async ')) return 'js';
  if (r.includes('SELECT ') || r.includes('FROM ')) return 'sql';
  if (r.includes('```')) return 'code';
  return 'txt';
}

async function callAI(msg, sp, maxT, temp) {
  // GROQ
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role:'system', content:sp },{ role:'user', content:msg }], max_tokens:maxT, temperature:temp })
    });
    const d = await r.json();
    const t = d.choices?.[0]?.message?.content;
    if (t && t.length > 10) return t;
  } catch(e) { console.error('[callAI] Groq:', e.message); }

  // OPENROUTER
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer':'https://rhf-zero.vercel.app', 'X-Title':'RHF ZERO' },
      body: JSON.stringify({ model: 'nousresearch/hermes-3-llama-3.1-70b', messages: [{ role:'system', content:sp },{ role:'user', content:msg }], max_tokens:maxT, temperature:temp })
    });
    const d = await r.json();
    const t = d.choices?.[0]?.message?.content;
    if (t && t.length > 10) return t;
  } catch(e) { console.error('[callAI] OpenRouter:', e.message); }

  // GEMINI
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ contents:[{ parts:[{ text: sp+'\n\nUser: '+msg }] }] }) }
    );
    const d = await r.json();
    const t = d.candidates?.[0]?.content?.parts?.[0]?.text;
    if (t && t.length > 10) return t;
  } catch(e) { console.error('[callAI] Gemini:', e.message); }

  return null;
}
