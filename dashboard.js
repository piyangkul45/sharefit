'use strict';

const loading = document.getElementById('loading');
const content = document.getElementById('content');

async function fetchWithRefresh(url, options = {}) {
  let res = await fetch(url, { ...options, credentials: 'include' });

  // If access token expired, try refreshing once
  if (res.status === 401) {
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST', credentials: 'include',
    });
    if (refreshRes.ok) {
      res = await fetch(url, { ...options, credentials: 'include' });
    }
  }
  return res;
}

async function init() {
  const res = await fetchWithRefresh('/api/auth/me').catch(() => null);

  if (!res || !res.ok) {
    window.location.replace('/auth/login.html');
    return;
  }

  const { user } = await res.json();

  document.getElementById('username-display').textContent = user.username;
  document.getElementById('info-username').textContent    = user.username;
  document.getElementById('info-email').textContent       = user.email;

  const joined = user.created_at
    ? new Date(user.created_at * 1000).toLocaleDateString('en-GB', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '—';
  document.getElementById('info-created').textContent = joined;

  loading.style.display  = 'none';
  content.style.display  = 'block';
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.replace('/auth/login.html');
});

init();
