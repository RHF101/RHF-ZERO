// api/generate.js — RHF ZERO v5 Multi-File Generator
// POST /api/generate  { message, engine, uid, chatId }
// Returns: { files:[{name,content,ext,size}], engine, total, description }

import { saveMessage, createChat } from './memory.js';

// ════════════════════════════════════════════════
// Engine configs
// ════════════════════════════════════════════════
const ENGINES = {

  godot: {
    label: 'Godot Engine 4',
    color: '#478cbf',
    extMap: { gdscript:'gd', tscn:'tscn', tres:'tres', gdshader:'gdshader', text:'gd' },
    prompt: `Kamu RHF ZERO, Godot Engine 4 expert kelas dunia.

TUGAS: Generate MULTIPLE FILE Godot 4 yang LENGKAP, siap di-copy ke Godot Editor.

OUTPUT FORMAT — hanya JSON ini, tidak ada teks lain:
{
  "files": [
    { "name": "player.gd", "type": "gdscript", "content": "...kode lengkap..." },
    { "name": "player.tscn", "type": "tscn", "content": "...scene lengkap..." },
    { "name": "game_manager.gd", "type": "gdscript", "content": "...kode lengkap..." }
  ],
  "description": "Penjelasan singkat apa yang dibuat"
}

ATURAN KONTEN:
- GDScript (.gd): Godot 4 syntax wajib. @export, @onready, extends Node3D/CharacterBody3D
- CharacterBody3D + move_and_slide() Godot 4 (tanpa parameter)
- Scene (.tscn): [gd_scene format=3 uid="uid://xxxx"] — format valid Godot 4
- Shader (.gdshader): sintaks Godot 4 shader
- Type hints: var speed: float = 5.0
- Signal dengan @signal decorator atau signal keyword
- Minimum 2 file per request
- Koordinat transform yang masuk akal
- Komentar di bagian penting
- TIDAK ADA Godot 3 syntax (move_and_slide(velocity) sudah deprecated)

OUTPUT HANYA JSON. Tidak ada penjelasan di luar JSON.`
  },

  unity: {
    label: 'Unity Engine',
    color: '#222c37',
    extMap: { csharp:'cs', shader:'shader', hlsl:'hlsl', json:'asmdef', text:'cs' },
    prompt: `Kamu RHF ZERO, Unity Engine expert (Unity 2022 LTS / Unity 6) kelas dunia.

TUGAS: Generate MULTIPLE FILE Unity yang LENGKAP, compile-ready.

OUTPUT FORMAT — hanya JSON ini, tidak ada teks lain:
{
  "files": [
    { "name": "PlayerController.cs", "type": "csharp", "content": "...C# lengkap..." },
    { "name": "HealthSystem.cs", "type": "csharp", "content": "...C# lengkap..." },
    { "name": "MyShader.shader", "type": "shader", "content": "...shader lengkap..." }
  ],
  "description": "Penjelasan singkat"
}

ATURAN KONTEN:
- using statements LENGKAP di atas setiap file
- namespace yang konsisten
- [SerializeField] private untuk semua inspector fields
- [Header("Kategori")] untuk grouping inspector
- XML Summary untuk semua public method
- New Input System (InputAction) jika ada input handling
- Rigidbody vs CharacterController sesuai konteks
- TextMeshProUGUI bukan Text lama
- Tidak ada TODO palsu, kode COMPILE tanpa error
- Minimum 2 C# file

OUTPUT HANYA JSON.`
  },

  roblox: {
    label: 'Roblox Studio',
    color: '#e2231a',
    extMap: { LocalScript:'lua', Script:'lua', ModuleScript:'lua', lua:'lua', text:'lua' },
    prompt: `Kamu RHF ZERO, Roblox Studio expert (Luau) kelas dunia.

TUGAS: Generate MULTIPLE SCRIPT Roblox yang LENGKAP, production-ready.

OUTPUT FORMAT — hanya JSON ini, tidak ada teks lain:
{
  "files": [
    { "name": "PlayerController", "type": "LocalScript", "content": "...script lengkap..." },
    { "name": "GameManager", "type": "Script", "content": "...script lengkap..." },
    { "name": "DataModule", "type": "ModuleScript", "content": "...module lengkap..." }
  ],
  "description": "Penjelasan singkat"
}

TYPE FIELD:
- "LocalScript" → client side, StarterPlayerScripts atau StarterGui
- "Script" → server side, ServerScriptService
- "ModuleScript" → shared module, ReplicatedStorage

ATURAN KONTEN:
- game:GetService() untuk SEMUA service
- task.wait(), task.spawn(), task.delay() — bukan yang lama
- pcall() untuk DataStore, HTTP request, operasi berisiko
- RemoteEvent/Function di ReplicatedStorage
- VALIDASI di server — jangan percaya client
- Type annotation Luau: local x: number = 0
- Header setiap file: -- [RHF ZERO] NamaScript (Type) --
- Minimum 2-3 script

OUTPUT HANYA JSON.`
  },

  unreal: {
    label: 'Unreal Engine 5',
    color: '#1d1d1d',
    extMap: { header:'h', source:'cpp', build:'cs', blueprint:'txt', text:'h' },
    prompt: `Kamu RHF ZERO, Unreal Engine 5 expert (C++) kelas dunia.

TUGAS: Generate MULTIPLE FILE UE5 yang LENGKAP, compile-ready.

OUTPUT FORMAT — hanya JSON ini, tidak ada teks lain:
{
  "files": [
    { "name": "AMyCharacter.h", "type": "header", "content": "...header lengkap..." },
    { "name": "AMyCharacter.cpp", "type": "source", "content": "...source lengkap..." },
    { "name": "MyGame.Build.cs", "type": "build", "content": "...Build.cs lengkap..." }
  ],
  "description": "Penjelasan singkat"
}

ATURAN KONTEN:
- Header: #pragma once, #include "CoreMinimal.h", UCLASS(), GENERATED_BODY()
- UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="X") untuk semua property
- UFUNCTION(BlueprintCallable, Category="X") untuk fungsi yang di-expose
- Naming: A=Actor, U=UObject, F=Struct, I=Interface, E=Enum
- TObjectPtr<> untuk UObject member references
- Enhanced Input System (UInputMappingContext, UInputAction, UEnhancedInputComponent)
- UE_LOG(LogTemp, Warning, TEXT("...")) untuk logging
- Constructor, BeginPlay(), Tick() yang lengkap
- Build.cs: PublicDependencyModuleNames yang benar
- SELALU pasangkan .h + .cpp
- Minimum 2 class (header + source)

OUTPUT HANYA JSON.`
  },

  threejs: {
    label: 'Three.js Web 3D',
    color: '#049ef4',
    extMap: { html:'html', javascript:'js', glsl:'glsl', css:'css', text:'js' },
    prompt: `Kamu RHF ZERO, Three.js Web 3D expert kelas dunia.

TUGAS: Generate MULTIPLE FILE Three.js yang LENGKAP, siap jalan di browser.

OUTPUT FORMAT — hanya JSON ini, tidak ada teks lain:
{
  "files": [
    { "name": "index.html", "type": "html", "content": "...HTML lengkap <!DOCTYPE html>...</html>..." },
    { "name": "main.js", "type": "javascript", "content": "...JS lengkap..." },
    { "name": "shader.glsl", "type": "glsl", "content": "...shader lengkap..." }
  ],
  "description": "Penjelasan singkat"
}

ATURAN KONTEN:
- CDN Three.js r128: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
- CDN OrbitControls: https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
- renderer.setAnimationLoop untuk loop animasi
- OrbitControls untuk mouse interaction
- Canvas 100% viewport + resize handler
- JANGAN CapsuleGeometry (tidak ada di r128)
- Karakter: Group dari Box+Sphere+Cylinder
- Hujan: Points geometry ribuan partikel
- Pohon: Cone(daun) + Cylinder(batang) dalam Group, posisi acak
- Tanah: PlaneGeometry besar, rotateX(-Math.PI/2)
- Langit: SphereGeometry besar dari dalam, atau fog
- Minimum: index.html + main.js

OUTPUT HANYA JSON.`
  }
};

const EXT_MIME = {
  gd:'text/plain', tscn:'text/plain', tres:'text/plain', gdshader:'text/plain',
  cs:'text/plain', shader:'text/plain', hlsl:'text/plain',
  lua:'text/x-lua', h:'text/plain', cpp:'text/plain',
  html:'text/html', js:'text/javascript', glsl:'text/plain', css:'text/css',
  txt:'text/plain', json:'application/json',
};

// ════════════════════════════════════════════════
// Handler
// ════════════════════════════════════════════════
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, engine, uid, chatId } = req.body;
  if (!message) return res.status(400).json({ error: 'Message diperlukan' });
  if (!engine || !ENGINES[engine]) {
    return res.status(400).json({ error: `Engine tidak valid. Pilih: ${Object.keys(ENGINES).join(', ')}` });
  }

  const cfg = ENGINES[engine];
  const raw = await callAI(message, cfg.prompt, 8192, 0.2);
  if (!raw) return res.status(503).json({ error: 'AI tidak tersedia. Coba lagi.' });

  // Parse JSON dari respons
  let parsed = null;
  try {
    const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'').trim();
    parsed = JSON.parse(clean);
  } catch {
    try {
      const m = raw.match(/\{[\s\S]*"files"\s*:[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch {}
  }

  // Fallback jika JSON gagal
  if (!parsed?.files) {
    const ext = Object.values(cfg.extMap)[0] || 'txt';
    parsed = { files: [{ name: `output.${ext}`, type: 'text', content: raw }], description: 'Generated by RHF ZERO' };
  }

  // Enrich files
  const files = (parsed.files || []).map((f, i) => {
    const fileExt = cfg.extMap[f.type] || cfg.extMap.text || 'txt';
    const name    = (f.name || `file_${i+1}`).includes('.') ? f.name : `${f.name}.${fileExt}`;
    const ext     = name.split('.').pop().toLowerCase();
    return {
      name,
      type:   f.type || 'text',
      content: f.content || '',
      ext,
      mime:   EXT_MIME[ext] || 'text/plain',
      size:   (f.content || '').length,
      sizeKb: ((f.content || '').length / 1024).toFixed(1),
    };
  });

  // Simpan ke Firebase
  if (uid && chatId) {
    try {
      await createChat(uid, chatId, { title: `[${cfg.label}] ${message.substring(0,35)}`, mode: engine });
      await saveMessage(uid, chatId, { role:'user', content: message, format:'txt', mode: engine });
      await saveMessage(uid, chatId, { role:'ai', content: `[${files.length} file] ${parsed.description||''}`, format:'code', mode: engine });
    } catch (e) { console.error('[generate] memory:', e.message); }
  }

  return res.json({
    ok:           true,
    engine,
    engineLabel:  cfg.label,
    engineColor:  cfg.color,
    description:  parsed.description || '',
    files,
    total:        files.length,
    totalSizeKb:  (files.reduce((s,f) => s + f.size, 0) / 1024).toFixed(1),
  });
}

// ── callAI ──
async function callAI(msg, sp, maxT, temp) {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST', headers:{'Authorization':`Bearer ${process.env.GROQ_API_KEY}`,'Content-Type':'application/json'},
      body: JSON.stringify({ model:'llama-3.3-70b-versatile', messages:[{role:'system',content:sp},{role:'user',content:msg}], max_tokens:maxT, temperature:temp })
    });
    const d = await r.json(); const t = d.choices?.[0]?.message?.content; if (t?.length>10) return t;
  } catch(e){}
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:'POST', headers:{'Authorization':`Bearer ${process.env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':'https://rhf-zero.vercel.app','X-Title':'RHF ZERO'},
      body: JSON.stringify({ model:'nousresearch/hermes-3-llama-3.1-70b', messages:[{role:'system',content:sp},{role:'user',content:msg}], max_tokens:maxT, temperature:temp })
    });
    const d = await r.json(); const t = d.choices?.[0]?.message?.content; if (t?.length>10) return t;
  } catch(e){}
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ contents:[{parts:[{text:sp+'\n\nUser: '+msg}]}] }) }
    );
    const d = await r.json(); const t = d.candidates?.[0]?.content?.parts?.[0]?.text; if (t?.length>10) return t;
  } catch(e){}
  return null;
}
