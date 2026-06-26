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
const authRoutes    = require('./src/routes/authRoutes');
const itemRoutes    = require('./src/routes/itemRoutes');
const bookingRoutes  = require('./src/routes/bookingRoutes');
const messageRoutes  = require('./src/routes/messageRoutes');

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
app.use('/api/auth',  authRoutes);

// 5. Items API
app.use('/api/items',    itemRoutes);

// 6. Bookings API
app.use('/api/bookings',  bookingRoutes);

// 7. Messages API
app.use('/api/messages',  messageRoutes);

// 8. Global error handler — never expose stack traces to the client
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.message, err.cause?.message || '');
  if (err.cause?.code === 'ENOTFOUND' || err.message === 'fetch failed') {
    return res.status(503).json({ error: 'Cannot reach authentication service. Please try again later.' });
  }
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

app.listen(PORT, () => {
  console.log(`\n  ShareFIT  →  http://localhost:${PORT}\n`);
});
