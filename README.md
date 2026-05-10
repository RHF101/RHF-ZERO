# RHF ZERO

# SuperAI

AI Chat dengan Multi-Model Pipeline — Next.js + Vercel

## Setup

### 1. Clone & Install
```bash
git clone https://github.com/username/superai.git
cd superai
npm install
```

### 2. Buat file `.env.local`
Isi semua API keys (lihat `.env.local` template yang sudah ada):
```
JWT_SECRET=random_string_panjang
ADMIN_EMAIL=email_kamu@gmail.com
ADMIN_PASSWORD=password_kuat
ADMIN_NAME=Nama Kamu
GROQ_API_KEY=...
GEMINI_API_KEY=...
MISTRAL_API_KEY=...
TOGETHER_API_KEY=...
OPENROUTER_API_KEY=...
```

### 3. Jalankan lokal
```bash
npm run dev
```
Buka http://localhost:3000

---

## Deploy ke Vercel

1. Push ke GitHub
2. Import repo di vercel.com
3. Tambahkan semua env variables di Vercel Dashboard → Settings → Environment Variables
4. Deploy!

---

## Struktur File

```
superai/
├── app/
│   ├── layout.tsx              # Root HTML layout
│   ├── globals.css             # Global styles & CSS variables
│   ├── page.tsx                # Login page
│   ├── chat/
│   │   └── page.tsx            # Chat page (protected)
│   └── api/
│       ├── auth/login/route.ts # POST /api/auth/login
│       ├── chat/route.ts       # POST /api/chat
│       └── code/route.ts       # POST /api/code (pipeline)
│
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx       # Form login
│   │   └── LoginForm.module.css
│   ├── chat/
│   │   ├── ChatWindow.tsx      # Layout utama chat
│   │   ├── ChatWindow.module.css
│   │   ├── Sidebar.tsx         # Daftar percakapan
│   │   ├── Sidebar.module.css
│   │   ├── MessageBubble.tsx   # Render pesan (markdown, code)
│   │   ├── MessageBubble.module.css
│   │   ├── InputBar.tsx        # Input + upload file
│   │   └── InputBar.module.css
│   └── ui/
│       ├── CodeBlock.tsx       # Syntax highlight + copy + download
│       └── CodeBlock.module.css
│
├── lib/
│   ├── ai/
│   │   ├── router.ts           # Deteksi mode: chat/code/vision
│   │   ├── groq.ts             # Groq API (chat cepat)
│   │   ├── gemini.ts           # Gemini API (vision + fallback)
│   │   ├── mistral.ts          # Mistral API (review code)
│   │   ├── openrouter.ts       # OpenRouter (DeepSeek Coder)
│   │   └── pipeline.ts         # Pipeline 3 AI: generate→review→validate
│   ├── memory/
│   │   └── store.ts            # In-memory conversation store
│   └── auth/
│       └── verify.ts           # JWT verification
│
├── .env.local                  # API keys (JANGAN di-commit!)
├── .gitignore
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## Fitur

- ✅ Login dengan email + password (JWT)
- ✅ Chat natural (Groq Llama — super cepat)
- ✅ Code pipeline: Generate → Review → Validate (3 AI berbeda)
- ✅ Vision: analisa gambar dengan Gemini
- ✅ Upload: gambar, PDF, file code
- ✅ Syntax highlighting dengan nomor baris
- ✅ Copy & download code langsung
- ✅ History percakapan per sesi
- ✅ Responsive (mobile + desktop)
- ✅ Fallback otomatis kalau satu AI error
- 
.
