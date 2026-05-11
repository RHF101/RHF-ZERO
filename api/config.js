export const API_KEYS = {
  // 10 AI
  GROQ: process.env.GROQ_API_KEY || '',
  GEMINI: process.env.GEMINI_API_KEY || '',
  DEEPSEEK: process.env.DEEPSEEK_API_KEY || '',
  MISTRAL: process.env.MISTRAL_API_KEY || '',
  CEREBRAS: process.env.CEREBRAS_API_KEY || '',
  TOGETHER: process.env.TOGETHER_API_KEY || '',
  FIREWORKS: process.env.FIREWORKS_API_KEY || '',
  TAVILY: process.env.TAVILY_API_KEY || '',
  NVIDIA: process.env.NVIDIA_API_KEY || '',
  CLOUDFLARE: process.env.CLOUDFLARE_API_KEY || '',
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',

  // Firebase — rhf-confrims
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || '',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || '',
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || '',
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || '',
  FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
};
