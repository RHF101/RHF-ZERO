// ============================================================
// AI RAKSASA — Test Fixtures (Sample Data)
// ============================================================

// ============================================================
// SAMPLE CODE 500 BARIS
// ============================================================

export const SAMPLE_CODE_500 = `// Sample Express API - 500 baris
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// Database
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'myapp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '',
});

// Models
class User {
  static async findById(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  static async create({ name, email, password }) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
      [name, email, hashedPassword]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => \`\${key} = $\${i + 2}\`).join(', ');
    
    const result = await pool.query(
      \`UPDATE users SET \${setClause} WHERE id = $1 RETURNING *\`,
      [id, ...values]
    );
    return result.rows[0];
  }

  static async delete(id) {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return true;
  }

  static async list(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const result = await pool.query(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  }
}

// Middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token diperlukan' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token tidak valid' });
  }
};

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email sudah terdaftar' });
    }

    const user = await User.create({ name, email, password });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

    res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (error) {
    next(error);
  }
});

// User routes
app.get('/api/users/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    res.json({ id: user.id, name: user.name, email: user.email, created_at: user.created_at });
  } catch (error) {
    next(error);
  }
});

app.put('/api/users/me', authMiddleware, async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const user = await User.update(req.userId, { name, email });
    res.json({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    next(error);
  }
});

app.get('/api/users', authMiddleware, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const users = await User.list(page, limit);
    res.json({ users, page, limit });
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server berjalan di port \${PORT}\`);
});

module.exports = app;
`.repeat(1); // 1x untuk sample, ulangi untuk test volume

// ============================================================
// SAMPLE CODE 5000 BARIS (dibuat dari pengulangan)
// ============================================================

export const SAMPLE_CODE_5000 = Array(10).fill(SAMPLE_CODE_500).join('\n');

// ============================================================
// SAMPLE CODE BROKEN (untuk test deteksi error)
// ============================================================

export const SAMPLE_CODE_BROKEN = `
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * items[i].qty;  // Typo: "qty" harusnya "qty"
  }
  return total;  // Tidak ada error handling untuk items null
}

class ShoppingCart {
  constructor() {
    this.items = [];
    this.discount = 0;
  }

  addItem(item) {
    this.items.push(item);
  }

  removeItem(id) {
    this.items = this.items.filter(item => item.id !== id);
  }

  getTotal() {
    let total = 0;
    for (let i = 0; i <= this.items.length; i++) {  // BUG: harusnya i < this.items.length
      total += this.items[i].price;
    }
    return total - this.discount  // Missing semicolon, logic bisa negatif
  }

  applyDiscount(code) {  // Missing error handling untuk invalid code
    if (code === 'SAVE10') {
      this.discount = 10;
    } else if (code === 'SAVE20') {
      this.discount = 20;
    }
  }
}

// Missing export
`;

// ============================================================
// SAMPLE CHUNKS (untuk test splitter)
// ============================================================

export const SAMPLE_CHUNKS_INPUT = Array(200).fill(
  `function test_INDEX() {\n  console.log("Hello from function INDEX");\n  return true;\n}\n`
).map((line, i) => line.replace(/INDEX/g, i)).join('\n');

// ============================================================
// SAMPLE REVIEW RESULTS (untuk test comparator)
// ============================================================

export const SAMPLE_REVIEWS_ALL_PASS = [
  {
    errors: [],
    warnings: [],
    fixedCode: 'function hello() { return "world"; }',
    summary: 'No issues found',
    status: 'ok',
  },
  {
    errors: [],
    warnings: [],
    fixedCode: 'function hello() { return "world"; }',
    summary: 'Code looks clean',
    status: 'ok',
  },
  {
    errors: [],
    warnings: [],
    fixedCode: 'function hello() { return "world"; }',
    summary: 'All good',
    status: 'ok',
  },
];

export const SAMPLE_REVIEWS_WITH_CONFLICT = [
  {
    errors: ['Missing semicolon at line 3'],
    warnings: [],
    fixedCode: 'function hello() { return "world"; }',
    summary: 'Found 1 issue',
    status: 'ok',
  },
  {
    errors: [],
    warnings: [],
    fixedCode: 'function hello() { return "world"; }',
    summary: 'No issues',
    status: 'ok',
  },
  {
    errors: ['Variable naming could be better'],
    warnings: ['Function too short'],
    fixedCode: 'function hello() { return "world"; }',
    summary: 'Minor suggestions',
    status: 'ok',
  },
];

export const SAMPLE_REVIEWS_MAJOR_BUG = [
  {
    errors: ['Infinite loop detected at line 5'],
    warnings: ['Missing null check'],
    fixedCode: 'function fixed() { return true; }',
    summary: 'Critical bug found',
    status: 'ok',
  },
  {
    errors: ['Infinite loop detected at line 5', 'Null pointer at line 8'],
    warnings: [],
    fixedCode: 'function fixed() { return true; }',
    summary: 'Multiple bugs found',
    status: 'ok',
  },
  {
    errors: ['Infinite loop detected at line 5'],
    warnings: ['Missing error handling'],
    fixedCode: 'function fixed() { return true; }',
    summary: 'Critical bug confirmed',
    status: 'ok',
  },
];

// ============================================================
// SAMPLE API RESPONSES
// ============================================================

export const SAMPLE_GROQ_RESPONSE = {
  choices: [{
    message: {
      content: 'function hello() {\n  return "Hello World";\n}',
    },
  }],
};

export const SAMPLE_GEMINI_RESPONSE = {
  response: {
    text: () => '{"errors":[],"warnings":[],"fixedCode":"function hello() { return \\"Hello World\\"; }","summary":"No issues"}',
  },
};

export const SAMPLE_TAVILY_RESPONSE = {
  results: [
    { title: 'Express.js Documentation', url: 'https://expressjs.com', content: 'Express is a minimal web framework' },
    { title: 'Node.js Best Practices', url: 'https://nodejs.org', content: 'Best practices for Node.js development' },
  ],
};

// ============================================================
// SAMPLE SESSION DATA
// ============================================================

export const SAMPLE_SESSION = {
  sessionId: 'sess_test_123456',
  messages: [
    { user: 'Halo', ai: 'Halo! Ada yang bisa dibantu?', mode: 'santai' },
    { user: 'Buatkan fungsi sorting', ai: 'Berikut fungsi sorting...', mode: 'serius' },
  ],
};

// ============================================================
// SAMPLE METADATA
// ============================================================

export const SAMPLE_METADATA = {
  panjangCode: '1.234',
  jumlahBaris: '89',
  strukturValid: true,
  issuesDikembalikan: 0,
  scanKeamanan: '✅ Lolos',
  dicekOleh: 'Gemini + DeepSeek + Mistral (Reti-Reti Double Check)',
  waktuProses: '5 fase',
};

// ============================================================
// EXPORT ALL
// ============================================================

export default {
  SAMPLE_CODE_500,
  SAMPLE_CODE_5000,
  SAMPLE_CODE_BROKEN,
  SAMPLE_CHUNKS_INPUT,
  SAMPLE_REVIEWS_ALL_PASS,
  SAMPLE_REVIEWS_WITH_CONFLICT,
  SAMPLE_REVIEWS_MAJOR_BUG,
  SAMPLE_GROQ_RESPONSE,
  SAMPLE_GEMINI_RESPONSE,
  SAMPLE_TAVILY_RESPONSE,
  SAMPLE_SESSION,
  SAMPLE_METADATA,
};
