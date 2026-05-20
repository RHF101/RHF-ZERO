// api/generate.js — RHF ZERO Multi-File Generator v1
// POST /api/generate
// Input:  { message, engine, uid, chatId }
// Output: { files: [{name, content, type, ext, size}], engine, total }

import { saveMessage, createChat } from './memory.js';

// ════════════════════════════════════════════════════════
// Engine config: ekstensi, mime, system prompt
// ════════════════════════════════════════════════════════
const ENGINE_CONFIG = {

  godot: {
    label: 'Godot Engine 4',
    color: '#478cbf',
    files: ['.gd', '.tscn', '.tres', '.godot', '.gdshader'],
    systemPrompt: `Kamu RHF ZERO, Godot Engine 4 expert kelas dunia.

TUGAS: Generate MULTIPLE FILE Godot 4 yang LENGKAP dan siap dipakai.

FORMAT OUTPUT — WAJIB IKUTI:
Output HANYA JSON valid ini, TIDAK ADA teks lain di luar JSON:
{
  "files": [
    {
      "name": "nama_file.gd",
      "type": "gdscript",
      "content": "...isi file lengkap..."
    },
    {
      "name": "scene_utama.tscn",
      "type": "tscn",
      "content": "...isi tscn lengkap..."
    }
  ],
  "description": "Penjelasan singkat apa yang dibuat"
}

ATURAN KONTEN:
- GDScript (.gd): Godot 4 syntax WAJIB. @export, @onready, extends Node3D/Node2D/CharacterBody3D
- Scene (.tscn): Format teks Godot scene yang valid: [gd_scene format=3 uid="..." ...] 
- Resource (.tres): Format teks Godot resource yang valid
- Shader (.gdshader): GLSL-like Godot shader syntax
- Semua file harus LENGKAP, tidak ada TODO atau placeholder
- Godot 4 API: move_and_slide() tanpa argument, PhysicsServer3D, dll
- Sertakan signal, export variable, type hints Godot 4
- Minimum 2 file per request (misal: script + scene, atau controller + data)
- Jika diminta karakter: buat player.gd + player.tscn
- Jika diminta game system: buat semua file yang dibutuhkan

PENTING: Output HANYA JSON. Tidak ada penjelasan sebelum atau sesudah JSON.`,
    extMap: { gdscript: 'gd', tscn: 'tscn', tres: 'tres', gdshader: 'gdshader', text: 'gd' }
  },

  unity: {
    label: 'Unity Engine',
    color: '#222c37',
    files: ['.cs', '.unity', '.prefab', '.mat', '.shader', '.asmdef'],
    systemPrompt: `Kamu RHF ZERO, Unity Engine expert (Unity 2022 LTS / Unity 6) kelas dunia.

TUGAS: Generate MULTIPLE FILE Unity yang LENGKAP dan compile-ready.

FORMAT OUTPUT — WAJIB IKUTI:
Output HANYA JSON valid ini, TIDAK ADA teks lain:
{
  "files": [
    {
      "name": "NamaScript.cs",
      "type": "csharp",
      "content": "...isi C# lengkap..."
    },
    {
      "name": "NamaShader.shader",
      "type": "shader",
      "content": "...isi shader lengkap..."
    }
  ],
  "description": "Penjelasan singkat"
}

ATURAN KONTEN:
- C# (.cs): WAJIB ada using statements, namespace, class dengan MonoBehaviour/ScriptableObject
- WAJIB: [SerializeField], [Header("...")], XML Summary comment di method penting
- WAJIB: proper Awake/Start/Update/OnEnable/OnDisable sesuai kebutuhan
- Shader (.shader): ShaderLab syntax dengan Properties, SubShader, Pass
- Assembly Definition (.asmdef): JSON format Unity
- Kode harus COMPILE tanpa error di Unity 2022+
- Gunakan New Input System jika ada input handling
- TextMeshProUGUI untuk UI text, bukan Text lama
- Minimum 2 file (misal: PlayerController.cs + InputHandler.cs)

PENTING: Output HANYA JSON. Tidak ada teks di luar JSON.`,
    extMap: { csharp: 'cs', shader: 'shader', hlsl: 'hlsl', json: 'asmdef', text: 'cs' }
  },

  roblox: {
    label: 'Roblox Studio',
    color: '#e2231a',
    files: ['.lua', '.rbxm', '.rbxl'],
    systemPrompt: `Kamu RHF ZERO, Roblox Studio expert dengan Luau kelas dunia.

TUGAS: Generate MULTIPLE SCRIPT Roblox Studio yang LENGKAP dan production-ready.

FORMAT OUTPUT — WAJIB IKUTI:
Output HANYA JSON valid ini, TIDAK ADA teks lain:
{
  "files": [
    {
      "name": "PlayerController",
      "type": "LocalScript",
      "content": "...isi script lengkap..."
    },
    {
      "name": "GameManager",
      "type": "Script",
      "content": "...isi script lengkap..."
    },
    {
      "name": "DataModule",
      "type": "ModuleScript",
      "content": "...isi module lengkap..."
    }
  ],
  "description": "Penjelasan singkat"
}

ATURAN TYPE:
- "LocalScript" → berjalan di client, di StarterPlayerScripts/StarterGui
- "Script" → berjalan di server, di ServerScriptService  
- "ModuleScript" → module yang di-require, di ReplicatedStorage

ATURAN KONTEN:
- Semua service via game:GetService()
- task.wait(), task.spawn(), task.delay() — BUKAN wait/spawn/delay lama
- pcall() untuk operasi yang bisa error (DataStore, HTTP, dll)
- RemoteEvent/RemoteFunction di ReplicatedStorage untuk client-server
- KEAMANAN: validasi semua input di server
- Type annotation Luau: local health: number = 100
- Header komentar: -- [RHF ZERO] NamaScript (Type) --
- Minimum 2-3 script per request

PENTING: Output HANYA JSON. Tidak ada teks di luar JSON.`,
    extMap: { LocalScript: 'lua', Script: 'lua', ModuleScript: 'lua', lua: 'lua', text: 'lua' }
  },

  unreal: {
    label: 'Unreal Engine 5',
    color: '#1d1d1d',
    files: ['.h', '.cpp', '.cs', '.uplugin', '.uproject'],
    systemPrompt: `Kamu RHF ZERO, Unreal Engine 5 expert (C++ dan Blueprint) kelas dunia.

TUGAS: Generate MULTIPLE FILE Unreal Engine 5 yang LENGKAP dan compile-ready.

FORMAT OUTPUT — WAJIB IKUTI:
Output HANYA JSON valid ini, TIDAK ADA teks lain:
{
  "files": [
    {
      "name": "ANamaActor.h",
      "type": "header",
      "content": "...isi header lengkap..."
    },
    {
      "name": "ANamaActor.cpp",
      "type": "source",
      "content": "...isi source lengkap..."
    },
    {
      "name": "NamaModule.Build.cs",
      "type": "build",
      "content": "...isi Build.cs lengkap..."
    }
  ],
  "description": "Penjelasan singkat"
}

ATURAN KONTEN:
- Header (.h): #pragma once, #include "CoreMinimal.h", UCLASS/USTRUCT/UENUM macro, GENERATED_BODY()
- Source (.cpp): #include "NamaFile.h" + includes lain, implementasi semua method
- WAJIB UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="NamaKategori") untuk properties
- WAJIB UFUNCTION(BlueprintCallable, Category="NamaKategori") untuk method yang perlu di-expose
- Naming convention: A=Actor, U=UObject, F=Struct, I=Interface, E=Enum
- TObjectPtr<> untuk UObject references (UE5 modern)
- Enhanced Input System: UInputMappingContext, UInputAction (bukan deprecated)
- UE_LOG(LogTemp, Warning, TEXT("...")) untuk logging
- Build.cs: PublicDependencyModuleNames, PrivateDependencyModuleNames yang benar
- MINIMUM: pasangan .h + .cpp per class
- Constructor: ANama::ANama() { PrimaryActorTick.bCanEverTick = true; }
- BeginPlay: void ANama::BeginPlay() { Super::BeginPlay(); ... }

PENTING: Output HANYA JSON. Tidak ada teks di luar JSON.`,
    extMap: { header: 'h', source: 'cpp', build: 'cs', blueprint: 'txt', text: 'h' }
  },

  threejs: {
    label: 'Three.js Web 3D',
    color: '#049ef4',
    files: ['.html', '.js', '.glsl'],
    systemPrompt: `Kamu RHF ZERO, Three.js Web 3D expert kelas dunia.

TUGAS: Generate MULTIPLE FILE Three.js yang LENGKAP dan siap dijalankan.

FORMAT OUTPUT — WAJIB IKUTI:
Output HANYA JSON valid ini, TIDAK ADA teks lain:
{
  "files": [
    {
      "name": "index.html",
      "type": "html",
      "content": "...isi HTML lengkap dari <!DOCTYPE html> sampai </html>..."
    },
    {
      "name": "main.js",
      "type": "javascript",
      "content": "...isi JS lengkap..."
    },
    {
      "name": "shader.glsl",
      "type": "glsl",
      "content": "...isi shader lengkap..."
    }
  ],
  "description": "Penjelasan singkat"
}

ATURAN KONTEN:
- HTML: gunakan CDN Three.js r128: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
- OrbitControls CDN: https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
- Karakter: Box+Sphere+Cylinder gabungan dalam Group
- Hujan: Points geometry ribuan titik jatuh
- Tanah: PlaneGeometry horizontal
- Pohon: ConeGeometry(daun) + CylinderGeometry(batang)
- Langit: SphereGeometry skybox atau gradient background
- JANGAN CapsuleGeometry (tidak ada di r128)
- renderer.setAnimationLoop untuk animation loop
- canvas 100% viewport, event resize
- MINIMUM: index.html + main.js

PENTING: Output HANYA JSON. Tidak ada teks di luar JSON.`,
    extMap: { html: 'html', javascript: 'js', glsl: 'glsl', css: 'css', text: 'js' }
  }
};

// ════════════════════════════════════════════════════════
// MIME type per ekstensi
// ════════════════════════════════════════════════════════
const EXT_MIME = {
  gd: 'text/plain', tscn: 'text/plain', tres: 'text/plain', gdshader: 'text/plain',
  cs: 'text/plain', shader: 'text/plain', hlsl: 'text/plain', asmdef: 'application/json',
  lua: 'text/x-lua', rbxm: 'text/plain', rbxl: 'text/plain',
  h: 'text/plain', cpp: 'text/plain',
  html: 'text/html', js: 'text/javascript', glsl: 'text/plain', css: 'text/css',
  txt: 'text/plain', json: 'application/json',
};

// ════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, engine, uid, chatId } = req.body;
  if (!message) return res.status(400).json({ error: 'Message diperlukan' });
  if (!engine || !ENGINE_CONFIG[engine]) {
    return res.status(400).json({ error: `Engine tidak valid. Pilih: ${Object.keys(ENGINE_CONFIG).join(', ')}` });
  }

  const cfg = ENGINE_CONFIG[engine];

  let rawResponse = await callAI(message, cfg.systemPrompt, 8192, 0.2);

  if (!rawResponse) {
    return res.status(503).json({ error: 'Semua AI provider tidak tersedia. Coba lagi.' });
  }

  // ── Parse JSON response ──
  let parsed = null;
  try {
    // Bersihkan markdown fence jika ada
    const cleaned = rawResponse
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // Coba ekstrak JSON dari dalam teks
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*"files"[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (e2) {
      // Fallback: bungkus seluruh respons jadi 1 file
      const ext = Object.values(cfg.extMap)[0] || 'txt';
      parsed = {
        files: [{
          name: `output.${ext}`,
          type: 'text',
          content: rawResponse
        }],
        description: 'Generated by RHF ZERO'
      };
    }
  }

  if (!parsed || !Array.isArray(parsed.files)) {
    return res.status(500).json({ error: 'Format respons AI tidak valid', raw: rawResponse.substring(0, 500) });
  }

  // ── Enrich files dengan ext, size, mime ──
  const files = parsed.files.map((f, i) => {
    const fileExt = cfg.extMap[f.type] || cfg.extMap['text'] || 'txt';
    // Pastikan nama file punya ekstensi
    const hasExt = f.name && f.name.includes('.');
    const name = hasExt ? f.name : `${f.name || 'file_' + (i+1)}.${fileExt}`;
    const ext = name.split('.').pop().toLowerCase();
    return {
      name,
      type: f.type || 'text',
      content: f.content || '',
      ext,
      mime: EXT_MIME[ext] || 'text/plain',
      size: (f.content || '').length,
      sizeKb: ((f.content || '').length / 1024).toFixed(1),
    };
  });

  // ── Simpan ke Firebase (opsional) ──
  if (uid && chatId) {
    try {
      await createChat(uid, chatId, {
        title: `[${cfg.label}] ${message.substring(0, 35)}`,
        mode: engine
      });
      await saveMessage(uid, chatId, {
        role: 'user', content: message, format: 'txt', mode: engine
      });
      await saveMessage(uid, chatId, {
        role: 'ai',
        content: `[MULTI-FILE: ${files.length} file] ${parsed.description || ''}`,
        format: 'code',
        mode: engine
      });
    } catch (e) {
      console.error('[generate.js] Memory save error:', e.message);
    }
  }

  return res.json({
    ok: true,
    engine,
    engineLabel: cfg.label,
    engineColor: cfg.color,
    description: parsed.description || '',
    files,
    total: files.length,
    totalSizeKb: (files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1),
  });
}

// ════════════════════════════════════════════════════════
// callAI — Waterfall: Groq → OpenRouter → Gemini
// ════════════════════════════════════════════════════════
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
  } catch(e) { console.error('[generate] Groq:', e.message); }

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
  } catch(e) { console.error('[generate] OpenRouter:', e.message); }

  // GEMINI
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ contents:[{ parts:[{ text: sp+'\n\nUser: '+msg }] }] }) }
    );
    const d = await r.json();
    const t = d.candidates?.[0]?.content?.parts?.[0]?.text;
    if (t && t.length > 10) return t;
  } catch(e) { console.error('[generate] Gemini:', e.message); }

  return null;
}
