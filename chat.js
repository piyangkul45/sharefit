'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

let currentUser      = null;
let currentPartnerId = null;
let lastCreatedAt    = null;        // ISO string — used for incremental polling
let pollTimer        = null;
const renderedIds    = new Set();   // prevents duplicate rendering

// ── DOM refs ──────────────────────────────────────────────────────────────────

const pageLoading    = document.getElementById('page-loading');
const convList       = document.getElementById('conv-list');
const placeholder    = document.getElementById('chat-placeholder');
const chatInner      = document.getElementById('chat-inner');
const chatLayout     = document.getElementById('chat-layout');
const messagesArea   = document.getElementById('messages-area');
const threadLoading  = document.getElementById('thread-loading');
const headerAvatar   = document.getElementById('header-avatar');
const headerName     = document.getElementById('header-partner-name');
const headerCtx      = document.getElementById('header-item-context');
const msgInput       = document.getElementById('msg-input');
const sendBtn        = document.getElementById('send-btn');
const sendError      = document.getElementById('send-error');
const backBtn        = document.getElementById('back-btn');

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function timeLabel(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function dateLabel(iso) {
  const d   = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name) {
  return (name || '?').slice(0, 2).toUpperCase();
}

async function fetchWithRefresh(url, options = {}) {
  let res = await fetch(url, { ...options, credentials: 'include' });
  if (res.status === 401) {
    const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (r.ok) res = await fetch(url, { ...options, credentials: 'include' });
  }
  return res;
}

// ── Auth guard ────────────────────────────────────────────────────────────────

async function init() {
  const res = await fetchWithRefresh('/api/auth/me').catch(() => null);
  if (!res || !res.ok) {
    window.location.replace('/auth/login.html?next=/chat.html' + window.location.search);
    return;
  }
  const { user } = await res.json();
  currentUser = user;
  document.getElementById('nav-dashboard').textContent = user.username;

  await loadConversations();
  pageLoading.style.display = 'none';

  // If URL has ?with=..., open that conversation immediately
  const params  = new URLSearchParams(window.location.search);
  const withId  = params.get('with');
  const iname   = params.get('iname') || '';
  const draft   = params.get('draft') || '';
  if (withId) openConversation(withId, null, iname, draft);
}

// ── Conversations list ────────────────────────────────────────────────────────

async function loadConversations() {
  const res = await fetchWithRefresh('/api/messages/conversations').catch(() => null);
  if (!res || !res.ok) return;
  const { conversations } = await res.json();
  renderConversations(conversations || []);
}

function renderConversations(conversations) {
  if (!conversations.length) {
    convList.innerHTML = `<div class="conv-empty">No conversations yet.<br>Contact an item owner from the <a href="/marketplace.html" style="color:var(--white)">marketplace</a>.</div>`;
    return;
  }
  convList.innerHTML = conversations.map(c => {
    const mine    = c.lastMessage.sender_id === currentUser.id;
    const preview = (mine ? 'You: ' : '') + c.lastMessage.message_text;
    const active  = c.partner.id === currentPartnerId ? ' active' : '';
    return `
      <div class="conv-item${active}" data-partner-id="${esc(c.partner.id)}" data-partner-name="${esc(c.partner.username)}">
        <div class="conv-avatar">${esc(initials(c.partner.username))}</div>
        <div class="conv-info">
          <div class="conv-name">@${esc(c.partner.username)}</div>
          <div class="conv-preview">${esc(preview.slice(0, 60))}</div>
        </div>
      </div>`;
  }).join('');
}

convList.addEventListener('click', (e) => {
  const item = e.target.closest('.conv-item');
  if (!item) return;
  openConversation(item.dataset.partnerId, item.dataset.partnerName, '');
});

// ── Open a conversation ───────────────────────────────────────────────────────

async function openConversation(partnerId, partnerName, itemName, draft = '') {
  if (currentPartnerId === partnerId) return;

  stopPolling();
  currentPartnerId = partnerId;
  lastCreatedAt    = null;
  renderedIds.clear();

  // Highlight active item in sidebar
  convList.querySelectorAll('.conv-item').forEach(el => {
    el.classList.toggle('active', el.dataset.partnerId === partnerId);
  });

  // Show chat panel
  placeholder.style.display = 'none';
  chatInner.classList.add('visible');
  chatLayout.classList.add('chat-open');

  // Clear messages area
  messagesArea.innerHTML = '';
  messagesArea.appendChild(threadLoading);
  threadLoading.style.display = 'flex';

  // Reset send state
  hideSendError();
  msgInput.value = '';
  sendBtn.disabled = true;

  // Set tentative header (real name comes from API)
  setHeader(partnerName || '…', itemName);

  // Fetch full conversation history
  const res = await fetchWithRefresh(`/api/messages/conversation/${encodeURIComponent(partnerId)}`).catch(() => null);
  threadLoading.style.display = 'none';

  if (!res || !res.ok) {
    messagesArea.innerHTML = `<div class="thread-empty"><span class="te-icon">⚠️</span><p>Could not load messages.</p></div>`;
    return;
  }

  const { messages, partner } = await res.json();

  // Update header with real username from API
  setHeader(partner.username, itemName);

  // Sync sidebar name if it was unknown before
  syncSidebarName(partnerId, partner.username);

  if (!messages.length) {
    messagesArea.innerHTML = `<div class="thread-empty"><span class="te-icon">💬</span><p>No messages yet. Say hello!</p></div>`;
  } else {
    appendMessages(messages);
  }

  msgInput.disabled = false;
  if (draft && !msgInput.value) {
    msgInput.value = draft;
    msgInput.dispatchEvent(new Event('input'));
  }
  msgInput.focus();
  startPolling();
}

function setHeader(username, itemName) {
  headerAvatar.textContent = initials(username);
  headerName.textContent   = '@' + username;
  if (itemName) {
    headerCtx.textContent  = 'Re: ' + itemName;
    headerCtx.style.display = '';
  } else {
    headerCtx.style.display = 'none';
  }
}

function syncSidebarName(partnerId, username) {
  const el = convList.querySelector(`[data-partner-id="${CSS.escape(partnerId)}"]`);
  if (el) {
    const nameEl = el.querySelector('.conv-name');
    if (nameEl) nameEl.textContent = '@' + username;
    el.dataset.partnerName = username;
  }
}

// ── Message rendering ─────────────────────────────────────────────────────────

function appendMessages(messages) {
  let lastDateLabel = null;

  // Remove empty-thread placeholder if present
  const empty = messagesArea.querySelector('.thread-empty');
  if (empty) empty.remove();

  for (const msg of messages) {
    if (renderedIds.has(msg.id)) continue;
    renderedIds.add(msg.id);

    // Date separator
    const dl = dateLabel(msg.created_at);
    if (dl !== lastDateLabel) {
      lastDateLabel = dl;
      const sep = document.createElement('div');
      sep.className   = 'date-sep';
      sep.textContent = dl;
      messagesArea.appendChild(sep);
    }

    // Bubble row
    const isMe  = msg.sender_id === currentUser.id;
    const row   = document.createElement('div');
    row.className = 'msg-row ' + (isMe ? 'me' : 'them');

    const bubble = document.createElement('div');
    bubble.className   = 'bubble';
    bubble.textContent = msg.message_text; // textContent — XSS safe

    const time   = document.createElement('div');
    time.className   = 'msg-time';
    time.textContent = timeLabel(msg.created_at);

    row.appendChild(bubble);
    row.appendChild(time);
    messagesArea.appendChild(row);

    // Track latest timestamp for incremental polling
    if (!lastCreatedAt || msg.created_at > lastCreatedAt) {
      lastCreatedAt = msg.created_at;
    }
  }

  scrollToBottom();
}

function scrollToBottom() {
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

// ── Polling ───────────────────────────────────────────────────────────────────

function startPolling() {
  stopPolling();
  pollTimer = setInterval(pollNewMessages, 2000);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function pollNewMessages() {
  if (!currentPartnerId || document.hidden) return;
  const since = lastCreatedAt ? `?since=${encodeURIComponent(lastCreatedAt)}` : '';
  const res = await fetchWithRefresh(
    `/api/messages/conversation/${encodeURIComponent(currentPartnerId)}${since}`
  ).catch(() => null);
  if (!res || !res.ok) return;
  const { messages } = await res.json();
  if (messages.length) appendMessages(messages);
}

document.addEventListener('visibilitychange', () => {
  if (currentPartnerId) {
    if (document.hidden) stopPolling();
    else { pollNewMessages(); startPolling(); }
  }
});

// ── Send message ──────────────────────────────────────────────────────────────

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !currentPartnerId) return;

  hideSendError();
  msgInput.value   = '';
  msgInput.style.height = '';
  sendBtn.disabled = true;

  try {
    const res = await fetchWithRefresh('/api/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ receiver_id: currentPartnerId, message_text: text }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      showSendError(json.error || 'Failed to send. Try again.');
      msgInput.value = text; // restore so user doesn't lose their message
    } else {
      // Immediately render the confirmed message (has real DB id)
      appendMessages([json.message]);
      // Refresh sidebar preview
      loadConversations();
    }
  } catch {
    showSendError('Network error. Check your connection.');
    msgInput.value = text;
  } finally {
    sendBtn.disabled = !msgInput.value.trim();
    msgInput.focus();
  }
}

function showSendError(msg) {
  sendError.textContent   = msg;
  sendError.style.display = 'block';
}
function hideSendError() {
  sendError.style.display = 'none';
}

// ── Input listeners ───────────────────────────────────────────────────────────

msgInput.addEventListener('input', () => {
  // Auto-resize textarea
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';
  sendBtn.disabled = !msgInput.value.trim();
});

msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

// ── Mobile back button ────────────────────────────────────────────────────────

backBtn.addEventListener('click', () => {
  stopPolling();
  currentPartnerId = null;
  chatInner.classList.remove('visible');
  chatLayout.classList.remove('chat-open');
  placeholder.style.display = '';
  convList.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
  loadConversations();
});

// ── Boot ──────────────────────────────────────────────────────────────────────

init();
