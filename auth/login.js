'use strict';

const form      = document.getElementById('login-form');
const errorBox  = document.getElementById('error-box');
const submitBtn = document.getElementById('submit-btn');
const pwToggle  = document.getElementById('pw-toggle');
const pwInput   = document.getElementById('password');

// Redirect if a valid session already exists
(async () => {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) window.location.replace('/dashboard.html');
  } catch { /* offline or not logged in — stay on page */ }
})();

// Show / hide password
pwToggle.addEventListener('click', () => {
  const hidden = pwInput.type === 'password';
  pwInput.type         = hidden ? 'text' : 'password';
  pwToggle.textContent = hidden ? 'Hide' : 'Show';
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add('show');
}

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.remove('show');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const email    = document.getElementById('email').value.trim();
  const password = pwInput.value;

  if (!email || !password) {
    showError('Please fill in all fields.');
    return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Logging in…';

  try {
    const res  = await fetch('/api/auth/login', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Login failed. Please try again.');
      return;
    }

    window.location.replace('/dashboard.html');
  } catch {
    showError('Network error. Check your connection and try again.');
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Log in';
  }
});
