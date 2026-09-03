'use strict';
const validator = require('validator');
const supabase  = require('../config/db');
const { setAuthCookies, clearAuthCookies } = require('../utils/tokenUtils');

const CRED_ERROR = { error: 'Invalid email or password.' };

// Bump when the Terms/Privacy copy changes materially (mirrors terms-modal.js).
const TOS_VERSION = '2026-09-03';

// ── Input validation ────────────────────────────────────────────────────────

function validateSignup(email, username, password) {
  const errors = [];

  if (!validator.isEmail(email))
    errors.push('Enter a valid email address.');

  const name = (username || '').trim();
  if (name.length < 3 || name.length > 30)
    errors.push('Username must be 3–30 characters.');
  if (name && !/^[a-zA-Z0-9_.\-]+$/.test(name))
    errors.push('Username may only contain letters, numbers, _, . and -');

  if (!password || password.length < 8)
    errors.push('Password must be at least 8 characters.');
  else {
    if (!/[A-Z]/.test(password)) errors.push('Password needs an uppercase letter.');
    if (!/[a-z]/.test(password)) errors.push('Password needs a lowercase letter.');
    if (!/[0-9]/.test(password)) errors.push('Password needs a number.');
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password needs a special character (!@#$ etc.).');
  }

  return errors;
}

// ── Signup ──────────────────────────────────────────────────────────────────

async function signup(req, res, next) {
  try {
    const rawEmail    = String(req.body.email    || '');
    const rawUsername = String(req.body.username || '').trim();
    const password    = String(req.body.password || '');
    const termsAccepted = req.body.terms_accepted === true || req.body.terms_accepted === 'true';

    const normEmail = validator.normalizeEmail(rawEmail) || rawEmail.toLowerCase();

    const errors = validateSignup(normEmail, rawUsername, password);
    if (!termsAccepted) errors.push('You must accept the Terms of Use and Privacy Policy.');
    if (errors.length) return res.status(400).json({ errors });

    const tosAcceptedAt = new Date().toISOString();

    const { data, error } = await supabase.auth.signUp({
      email:    normEmail,
      password,
      options:  { data: {
        username:        rawUsername,
        tos_accepted:    true,
        tos_accepted_at: tosAcceptedAt,
        tos_version:     TOS_VERSION,
      } },
    });

    if (error) {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        return res.status(409).json({ error: 'Email already registered.' });
      }
      return next(error);
    }

    // Email confirmation enabled — session is null until confirmed
    if (!data.session) {
      return res.status(201).json({
        message: 'Account created. Please check your email to confirm your account before logging in.',
        user: { id: data.user.id, email: normEmail, username: rawUsername },
      });
    }

    setAuthCookies(res, data.session.access_token, data.session.refresh_token, data.session.expires_in);

    return res.status(201).json({
      message: 'Account created successfully.',
      user: { id: data.user.id, email: normEmail, username: rawUsername },
    });
  } catch (err) {
    next(err);
  }
}

// ── Login ───────────────────────────────────────────────────────────────────

async function login(req, res, next) {
  try {
    const rawEmail = String(req.body.email    || '');
    const password = String(req.body.password || '');

    if (!validator.isEmail(rawEmail) || !password) {
      return res.status(400).json(CRED_ERROR);
    }

    const normEmail = validator.normalizeEmail(rawEmail);

    const { data, error } = await supabase.auth.signInWithPassword({
      email:    normEmail,
      password,
    });

    if (error || !data.session) {
      return res.status(401).json(CRED_ERROR);
    }

    setAuthCookies(res, data.session.access_token, data.session.refresh_token, data.session.expires_in);

    return res.json({
      message: 'Login successful.',
      user: {
        id:       data.user.id,
        email:    data.user.email,
        username: data.user.user_metadata?.username || '',
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── Refresh ─────────────────────────────────────────────────────────────────

async function refresh(req, res, next) {
  try {
    const raw = req.cookies?.refresh_token;
    if (!raw) return res.status(401).json({ error: 'No refresh token.' });

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: raw });

    if (error || !data.session) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    setAuthCookies(res, data.session.access_token, data.session.refresh_token, data.session.expires_in);
    return res.json({ message: 'Token refreshed.' });
  } catch (err) {
    next(err);
  }
}

// ── Logout ───────────────────────────────────────────────────────────────────

function logout(req, res) {
  clearAuthCookies(res);
  return res.json({ message: 'Logged out.' });
}

// ── Me (protected) ───────────────────────────────────────────────────────────

function getMe(req, res) {
  const { user } = req;
  return res.json({
    user: {
      id:         user.id,
      email:      user.email,
      username:   user.user_metadata?.username || '',
      created_at: user.created_at,
      last_login: user.last_sign_in_at,
    },
  });
}

module.exports = { signup, login, refresh, logout, getMe };
