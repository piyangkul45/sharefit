'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI = {
  tops: '👕', bottoms: '👖', dresses: '👗', outerwear: '🧥',
  activewear: '🏋️', accessories: '🕶️', footwear: '👟', other: '🎽',
};

// ── State ─────────────────────────────────────────────────────────────────────

let allItems    = [];
let currentUser = null;  // populated if logged in
let activeItem  = null;  // item currently open in the modal

// ── DOM refs — grid / filters ─────────────────────────────────────────────────

const grid        = document.getElementById('items-grid');
const loadingEl   = document.getElementById('loading-state');
const emptyEl     = document.getElementById('empty-state');
const countEl     = document.getElementById('result-count');
const searchInput = document.getElementById('search-input');
const catSelect   = document.getElementById('filter-category');
const sizeSelect  = document.getElementById('filter-size');
const styleSelect = document.getElementById('filter-style');
const sortSelect  = document.getElementById('sort-select');

// ── DOM refs — booking modal ──────────────────────────────────────────────────

const overlay       = document.getElementById('modal-overlay');
const modal         = document.getElementById('booking-modal');
const modalClose    = document.getElementById('modal-close');
const modalImg      = document.getElementById('modal-img');
const modalEmoji    = document.getElementById('modal-emoji');
const modalName     = document.getElementById('modal-item-name');
const modalBrand    = document.getElementById('modal-item-brand');
const modalPpd      = document.getElementById('modal-item-ppd');
const modalStart    = document.getElementById('modal-start');
const modalEnd      = document.getElementById('modal-end');
const pricePreview  = document.getElementById('modal-price-preview');
const previewCalc   = document.getElementById('preview-calc');
const previewTotal  = document.getElementById('preview-total');
const modalAlert    = document.getElementById('modal-alert');
const confirmBtn    = document.getElementById('modal-confirm');
const confirmLabel  = document.getElementById('confirm-label');
const confirmSpinner= document.getElementById('confirm-spinner');
const successSection= document.getElementById('modal-success');
const formSection   = document.getElementById('modal-form-section');
const successDetail = document.getElementById('success-detail');

// ── Helpers ───────────────────────────────────────────────────────────────────

function escText(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function escAttr(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtPrice(n) {
  return Number(n).toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ── Token refresh helper ──────────────────────────────────────────────────────

async function fetchWithRefresh(url, options = {}) {
  let res = await fetch(url, { ...options, credentials: 'include' });
  if (res.status === 401) {
    const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (r.ok) res = await fetch(url, { ...options, credentials: 'include' });
  }
  return res;
}

// ── Auth state check (nav + booking gating) ───────────────────────────────────

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return;
    const { user } = await res.json();
    currentUser = user;
    document.getElementById('nav-auth').innerHTML =
      `<a href="/dashboard.html" class="nav-link">${escText(user.username)}</a>` +
      `<a href="/list-item.html" class="nav-link">List an item</a>`;
  } catch { /* not logged in — stay as guest */ }
}

// ── Fetch items from API ──────────────────────────────────────────────────────

async function loadItems() {
  const params = new URLSearchParams();
  if (catSelect.value)   params.set('category', catSelect.value);
  if (sizeSelect.value)  params.set('size',     sizeSelect.value);
  if (styleSelect.value) params.set('style',    styleSelect.value);

  const sortVal = sortSelect.value;
  if (sortVal === 'price_asc')  { params.set('sort', 'price_per_day'); params.set('order', 'asc'); }
  if (sortVal === 'price_desc') { params.set('sort', 'price_per_day'); params.set('order', 'desc'); }

  loadingEl.style.display = 'flex';
  grid.style.display      = 'none';
  emptyEl.style.display   = 'none';

  try {
    const res = await fetch(`/api/items?${params}`);
    if (!res.ok) throw new Error();
    const { items } = await res.json();
    allItems = items;
  } catch {
    allItems = [];
  }

  applySearch();
}

// ── Client-side search filter ─────────────────────────────────────────────────

function applySearch() {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = q
    ? allItems.filter(it =>
        it.item_name.toLowerCase().includes(q) ||
        (it.brand || '').toLowerCase().includes(q)
      )
    : allItems;
  render(filtered);
}

// ── Render cards ──────────────────────────────────────────────────────────────

function render(items) {
  loadingEl.style.display = 'none';
  countEl.textContent = items.length === 1 ? '1 item' : `${items.length} items`;

  if (items.length === 0) {
    grid.style.display    = 'none';
    emptyEl.style.display = 'flex';
    return;
  }

  emptyEl.style.display = 'none';
  grid.style.display    = 'grid';
  grid.innerHTML = items.map(cardHTML).join('');
}

function cardHTML(item) {
  const imgSection = item.image_url
    ? `<div class="card-img"><img src="${escAttr(item.image_url)}" alt="${escAttr(item.item_name)}" loading="lazy" /></div>`
    : `<div class="card-img-placeholder">${CATEGORY_EMOJI[item.category] || '🎽'}</div>`;

  const brand   = item.brand ? escText(item.brand) : `<span class="no-brand">—</span>`;
  const price   = fmtPrice(item.price_per_day);
  const isOwn   = currentUser && currentUser.id === item.user_id;
  const chatUrl = `/chat.html?with=${escAttr(item.user_id)}&iname=${encodeURIComponent(item.item_name)}`;

  return `
    <div class="card">
      ${imgSection}
      <div class="card-body">
        <div class="card-meta-row">
          <span class="card-tag">${escText(item.category)}</span>
          <span class="size-badge">${escText(item.size)}</span>
        </div>
        <div class="card-name">${escText(item.item_name)}</div>
        <div class="card-brand">${brand}</div>
        <div class="card-footer">
          <div class="card-price">฿${price} <span>/ day</span></div>
        </div>
        <div class="card-actions">
          <button class="btn-rent"    data-item-id="${escAttr(item.id)}">Rent Now</button>
          <button class="btn-contact" data-chat-url="${escAttr(chatUrl)}" ${isOwn ? 'disabled' : ''}>
            ${isOwn ? 'Your listing' : 'Contact Owner'}
          </button>
        </div>
      </div>
    </div>`;
}

// ── Event delegation for card buttons ────────────────────────────────────────

grid.addEventListener('click', (e) => {
  const rentBtn    = e.target.closest('.btn-rent');
  const contactBtn = e.target.closest('.btn-contact');

  if (rentBtn) {
    const item = allItems.find(it => it.id === rentBtn.dataset.itemId);
    if (item) handleRent(item);
    return;
  }

  if (contactBtn && !contactBtn.disabled) {
    if (!currentUser) {
      window.location.href = '/auth/login.html?next=/marketplace.html';
      return;
    }
    window.location.href = contactBtn.dataset.chatUrl;
  }
});

function handleRent(item) {
  if (!currentUser) {
    window.location.href = '/auth/login.html?next=/marketplace.html';
    return;
  }
  openModal(item);
}

// ── Modal open / close ────────────────────────────────────────────────────────

function openModal(item) {
  activeItem = item;

  // Populate item header
  if (item.image_url) {
    modalImg.src          = item.image_url;
    modalImg.alt          = item.item_name;
    modalImg.style.display = 'block';
    modalEmoji.textContent = '';
  } else {
    modalImg.style.display = 'none';
    modalEmoji.textContent = CATEGORY_EMOJI[item.category] || '🎽';
  }
  modalName.textContent  = item.item_name;
  modalBrand.textContent = item.brand || '—';
  modalPpd.innerHTML     = `฿${fmtPrice(item.price_per_day)} <span>/ day</span>`;

  // Reset form
  const today = todayISO();
  modalStart.value = '';
  modalEnd.value   = '';
  modalStart.min   = today;
  modalEnd.min     = today;
  hidePricePreview();
  hideAlert();
  confirmBtn.disabled = true;

  // Show form, hide success
  formSection.style.display  = '';
  successSection.style.display = 'none';

  overlay.classList.add('open');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  modalStart.focus();
}

function closeModal() {
  overlay.classList.remove('open');
  modal.classList.remove('open');
  document.body.style.overflow = '';
  activeItem = null;
}

// ── Date change → price preview ───────────────────────────────────────────────

function updatePricePreview() {
  if (!activeItem || !modalStart.value || !modalEnd.value) {
    hidePricePreview();
    confirmBtn.disabled = true;
    return;
  }

  const start = new Date(modalStart.value);
  const end   = new Date(modalEnd.value);

  if (end <= start) {
    hidePricePreview();
    showAlert('End date must be after start date.');
    confirmBtn.disabled = true;
    return;
  }

  hideAlert();

  const days        = Math.ceil((end - start) / 86_400_000);
  const total       = Math.round(days * Number(activeItem.price_per_day) * 100) / 100;
  const daysLabel   = days === 1 ? '1 day' : `${days} days`;

  previewCalc.textContent  = `฿${fmtPrice(activeItem.price_per_day)} × ${daysLabel}`;
  previewTotal.textContent = `฿${fmtPrice(total)}`;

  pricePreview.style.display = '';
  confirmBtn.disabled = false;
}

function hidePricePreview() {
  pricePreview.style.display = 'none';
}

// ── Alert helpers ─────────────────────────────────────────────────────────────

function showAlert(msg) {
  modalAlert.textContent    = msg;
  modalAlert.style.display  = 'block';
}

function hideAlert() {
  modalAlert.style.display = 'none';
}

// ── Booking submission ────────────────────────────────────────────────────────

async function submitBooking() {
  if (!activeItem || !modalStart.value || !modalEnd.value) return;

  hideAlert();
  confirmBtn.disabled         = true;
  confirmSpinner.style.display = 'inline-block';
  confirmLabel.textContent    = 'Booking…';

  try {
    const res = await fetchWithRefresh('/api/bookings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        item_id:    activeItem.id,
        start_date: modalStart.value,
        end_date:   modalEnd.value,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      showAlert(json.error || 'Something went wrong. Please try again.');
      confirmBtn.disabled         = false;
      confirmSpinner.style.display = 'none';
      confirmLabel.textContent    = 'Confirm Booking';
      return;
    }

    // Success state
    const { booking } = json;
    const start  = new Date(booking.start_date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    const end    = new Date(booking.end_date).toLocaleDateString('en-GB',   { day:'numeric', month:'short', year:'numeric' });
    successDetail.innerHTML =
      `<span>${activeItem.item_name}</span>` +
      `<span>${start} → ${end}</span>` +
      `<span>Total: ฿${fmtPrice(booking.total_price)}</span>`;

    formSection.style.display   = 'none';
    successSection.style.display = '';

    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 2200);

  } catch {
    showAlert('Network error. Please check your connection and try again.');
    confirmBtn.disabled         = false;
    confirmSpinner.style.display = 'none';
    confirmLabel.textContent    = 'Confirm Booking';
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', closeModal);

modal.addEventListener('click', (e) => e.stopPropagation());

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
});

modalStart.addEventListener('change', () => {
  // Ensure end date min tracks start date
  if (modalStart.value) modalEnd.min = modalStart.value;
  updatePricePreview();
});

modalEnd.addEventListener('change', updatePricePreview);

confirmBtn.addEventListener('click', submitBooking);

// Filters
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applySearch, 250);
});
catSelect.addEventListener('change',   loadItems);
sizeSelect.addEventListener('change',  loadItems);
styleSelect.addEventListener('change', loadItems);
sortSelect.addEventListener('change',  loadItems);

document.getElementById('clear-filters-btn').addEventListener('click', () => {
  searchInput.value  = '';
  catSelect.value    = '';
  sizeSelect.value   = '';
  styleSelect.value  = '';
  sortSelect.value   = 'newest';
  loadItems();
});

// ── Init ──────────────────────────────────────────────────────────────────────

// Pre-set filters from URL params (e.g. links from homepage carousels)
(function applyURLParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('category')) catSelect.value   = p.get('category');
  if (p.get('size'))     sizeSelect.value  = p.get('size');
  if (p.get('style'))    styleSelect.value = p.get('style');
  const sort = p.get('sort'), order = p.get('order');
  if (sort === 'price_per_day') {
    sortSelect.value = order === 'asc' ? 'price_asc' : 'price_desc';
  }
})();

checkAuth();
loadItems();
