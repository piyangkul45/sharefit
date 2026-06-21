'use strict';
require('dotenv').config();

// Fail fast if secrets are missing
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`\nFATAL: Missing env vars: ${missing.join(', ')}`);
  console.error('Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file.\n');
  process.exit(1);
}

const express      = require('express');
const path         = require('path');
const cookieParser = require('cookie-parser');
const { applySecurityMiddleware } = require('./src/middleware/security');
const authRoutes   = require('./src/routes/authRoutes');

const app  = express();
const PORT = process.env.PORT || 3000;

// 1. Security headers (helmet + CORS) — must be first
applySecurityMiddleware(app);

// 2. Body parsing + cookie parsing
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// 3. Static files served from the project root
app.use(express.static(path.join(__dirname)));

// 4. Auth API
app.use('/api/auth', authRoutes);

// 5. Global error handler — never expose stack traces to the client
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

app.listen(PORT, () => {
  console.log(`\n  ShareFIT  →  http://localhost:${PORT}\n`);
});
