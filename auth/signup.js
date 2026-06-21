'use strict';

const form        = document.getElementById('signup-form');
const errorBox    = document.getElementById('error-box');
const submitBtn   = document.getElementById('submit-btn');
const pwInput     = document.getElementById('password');
const pwToggle    = document.getElementById('pw-toggle');
const strengthBars  = document.getElementById('strength-bars');
const strengthLabel = document.getElementById('strength-label');

// Redirect if already logged in
(async () => {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) window.location.replace('/dashboard.html');
  } catch { /* not logged in */ }
})();

// ── Show / hide password ──────────────────────────────────────────
pwToggle.addEventListener('click', () => {
  const hidden = pwInput.type === 'password';
  pwInput.type         = hidden ? 'text' : 'password';
  pwToggle.textContent = hidden ? 'Hide' : 'Show';
});

// ── Password strength meter ───────────────────────────────────────
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

function calcStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8)          score++;
  if (/[A-Z]/.test(pw))       score++;
  if (/[0-9]/.test(pw))       score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0–4
}

pwInput.addEventListener('input', () => {
  const score = calcStrength(pwInput.value);
  // Remove all score classes then apply the current one
  strengthBars.className = 'strength-bars';
  if (score > 0) strengthBars.classList.add(`s${score}`);
  strengthLabel.textContent = STRENGTH_LABELS[score] || '';
});

// ── Error helpers ─────────────────────────────────────────────────
function showErrors(msgs) {
  if (Array.isArray(msgs) && msgs.length > 1) {
    errorBox.innerHTML = '<ul>' + msgs.map(m => `<li>${m}</li>`).join('') + '</ul>';
  } else {
    errorBox.textContent = Array.isArray(msgs) ? msgs[0] : msgs;
  }
  errorBox.classList.add('show');
}

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.remove('show');
}

// ── Form submit ───────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const username  = document.getElementById('username').value.trim();
  const email     = document.getElementById('email').value.trim();
  const password  = pwInput.value;
  const confirm   = document.getElementById('confirm-password').value;

  // Client-side sanity checks (server validates too)
  const localErrors = [];
  if (!username) localErrors.push('Username is required.');
  if (!email)    localErrors.push('Email is required.');
  if (!password) localErrors.push('Password is required.');
  if (password && password !== confirm) localErrors.push('Passwords do not match.');
  if (password && calcStrength(password) < 2) localErrors.push('Please choose a stronger password.');

  if (localErrors.length) { showErrors(localErrors); return; }

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Creating account…';

  try {
    const res  = await fetch('/api/auth/signup', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ username, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Server returns either { error } or { errors: [] }
      showErrors(data.errors || data.error || 'Sign up failed. Please try again.');
      return;
    }

    window.location.replace('/dashboard.html');
  } catch {
    showErrors('Network error. Check your connection and try again.');
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Create account';
  }
});
