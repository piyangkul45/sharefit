'use strict';
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

function applySecurityMiddleware(app) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],          // no inline scripts — JS lives in .js files
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],      // blocks clickjacking
      },
    },
    crossOriginEmbedderPolicy: false,    // allow emoji rendering
  }));

  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
  app.use(cors({
    origin,
    credentials: true,                   // required for cookies
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }));
}

// 10 requests per 15 min per IP (login endpoint)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,          // only counts failures
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 5 signups per hour per IP
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many accounts created from this IP. Try again in 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { applySecurityMiddleware, authLimiter, signupLimiter };
