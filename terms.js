'use strict';

// Consent version — bump when the policy text changes so a re-acceptance is required.
const CONSENT_VERSION = '2026-09-03';

const check      = document.getElementById('agree-check');
const label      = document.getElementById('agree-label');
const confirmBtn = document.getElementById('confirm-btn');

// ── Enable "ยืนยัน" only while the agreement box is checked ────────────────────

function syncButton() {
  confirmBtn.disabled = !check.checked;
  label.classList.toggle('checked', check.checked);
}

check.addEventListener('change', syncButton);
syncButton(); // handle browser-restored state on reload

// ── Confirm → record consent, then continue ──────────────────────────────────

function safeNext() {
  const next = new URLSearchParams(window.location.search).get('next');
  // same-origin absolute path only ("/x", never "//host" or "http://…")
  return next && /^\/(?!\/)/.test(next) ? next : '/';
}

confirmBtn.addEventListener('click', () => {
  if (!check.checked) return;

  try {
    localStorage.setItem('loopwear_consent', JSON.stringify({
      accepted: true,
      version:  CONSENT_VERSION,
      at:       new Date().toISOString(),
    }));
  } catch { /* storage unavailable — continue anyway */ }

  window.location.href = safeNext();
});
