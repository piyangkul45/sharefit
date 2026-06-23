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
  const [meRes, itemsRes] = await Promise.all([
    fetchWithRefresh('/api/auth/me').catch(() => null),
    fetchWithRefresh('/api/items/mine').catch(() => null),
  ]);

  if (!meRes || !meRes.ok) {
    window.location.replace('/auth/login.html');
    return;
  }

  const { user } = await meRes.json();

  document.getElementById('username-display').textContent = user.username;
  document.getElementById('info-username').textContent    = user.username;
  document.getElementById('info-email').textContent       = user.email;

  const joined = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '—';
  document.getElementById('info-created').textContent = joined;

  if (itemsRes?.ok) {
    const { items } = await itemsRes.json();
    document.getElementById('stat-items').textContent = items.length;
  } else {
    document.getElementById('stat-items').textContent = '0';
  }

  loading.style.display  = 'none';
  content.style.display  = 'block';
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.replace('/auth/login.html');
});

init();
