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
let datesValid  = false; // booking modal: are the chosen dates usable?
let rcSelection = null;  // { start, end, days } from the rental calendar

// ── DOM refs — grid / filters ─────────────────────────────────────────────────

const grid        = document.getElementById('items-grid');
const loadingEl   = document.getElementById('loading-state');
const emptyEl     = document.getElementById('empty-state');
const countEl     = document.getElementById('result-count');
const searchInput = document.getElementById('search-input');
const catSelect   = document.getElementById('filter-category');
const sizeSelect  = document.getElementById('filter-size');
const styleSelect = document.getElementById('filter-style');
const typeSelect  = document.getElementById('filter-listing-type');
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
const modalBuy      = document.getElementById('modal-buy');
const modalBuyPrice = document.getElementById('modal-buy-price');
const agreeCheckout = document.getElementById('agree-terms-checkout');

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

// ── Rental date-range calendar ───────────────────────────────────────────────

function isoDate(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

class RentalCalendar {
  constructor(root, onChange) {
    this.root    = root;
    this.grid    = root.querySelector('#rc-grid');
    this.title   = root.querySelector('#rc-title');
    this.hint    = root.querySelector('#rc-hint');
    this.prevBtn = root.querySelector('#rc-prev');
    this.nextBtn = root.querySelector('#rc-next');
    this.onChange = onChange;

    this.blocked = new Set();  // 'YYYY-MM-DD' strings — booked + buffer days
    this.start   = null;
    this.end     = null;

    const t = new Date(); t.setHours(0, 0, 0, 0);
    this.today   = t;
    this.minMonth = new Date(t.getFullYear(), t.getMonth(), 1);
    this.maxMonth = new Date(t.getFullYear(), t.getMonth() + 12, 1); // book up to 1yr out
    this.view    = new Date(this.minMonth);

    this.prevBtn.addEventListener('click', () => this._shift(-1));
    this.nextBtn.addEventListener('click', () => this._shift(1));
    this.grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.rc-day');
      if (cell && !cell.classList.contains('rc-disabled') && !cell.classList.contains('rc-empty')) {
        this._pick(cell.dataset.d);
      }
    });
  }

  // ranges: [{ start_date, end_date }]  bufferDays: turnaround days blocked after
  reset(ranges, bufferDays) {
    this.blocked = new Set();
    const buf = Number(bufferDays) || 0;
    for (const r of ranges || []) {
      const s = new Date(r.start_date + 'T00:00:00');
      const e = new Date(r.end_date   + 'T00:00:00');
      e.setDate(e.getDate() + buf);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        this.blocked.add(isoDate(d));
      }
    }
    this.start = null;
    this.end   = null;
    this.view  = new Date(this.minMonth);
    this._setHint('Pick your start date', false);
    this._render();
    this._emit();
  }

  get days() {
    if (!this.start || !this.end) return 0;
    return Math.round((new Date(this.end) - new Date(this.start)) / 86_400_000) + 1;
  }

  _shift(dir) {
    const next = new Date(this.view.getFullYear(), this.view.getMonth() + dir, 1);
    if (next < this.minMonth || next > this.maxMonth) return;
    this.view = next;
    this._render();
  }

  _rangeHasBlocked(a, b) {
    for (let d = new Date(a + 'T00:00:00'); isoDate(d) <= b; d.setDate(d.getDate() + 1)) {
      if (this.blocked.has(isoDate(d))) return true;
    }
    return false;
  }

  _pick(dISO) {
    if (!this.start || (this.start && this.end)) {
      this.start = dISO;
      this.end   = null;
      this._setHint('Pick your return date', false);
    } else if (dISO < this.start) {
      this.start = dISO;
      this._setHint('Pick your return date', false);
    } else if (this._rangeHasBlocked(this.start, dISO)) {
      this._setHint('That range crosses booked dates — choose a shorter one.', true);
      this._render();
      return;
    } else {
      this.end = dISO;
      const n = this.days;
      this._setHint(`${n} day${n > 1 ? 's' : ''} selected`, false);
    }
    this._render();
    this._emit();
  }

  _setHint(msg, isErr) {
    this.hint.textContent = msg;
    this.hint.classList.toggle('rc-hint-err', !!isErr);
  }

  _emit() {
    this.onChange(
      this.start && this.end ? { start: this.start, end: this.end, days: this.days } : null
    );
  }

  _render() {
    const y = this.view.getFullYear();
    const m = this.view.getMonth();
    this.title.textContent = this.view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const firstDow    = (new Date(y, m, 1).getDay() + 6) % 7; // Mon = 0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDow; i++) cells.push('<div class="rc-day rc-empty"></div>');

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m, day);
      const s = isoDate(d);
      const cls = ['rc-day'];

      const isPast   = d < this.today;
      const isBooked = this.blocked.has(s);
      if (isPast || isBooked) cls.push('rc-disabled');
      if (isBooked) cls.push('rc-booked');

      if (s === this.start) { cls.push('rc-start'); if (!this.end) cls.push('rc-end'); }
      if (s === this.end)   cls.push('rc-end');
      if (this.start && this.end && s > this.start && s < this.end) cls.push('rc-inrange');

      cells.push(`<div class="${cls.join(' ')}" data-d="${s}">${day}</div>`);
    }

    this.grid.innerHTML = cells.join('');

    const cur = new Date(y, m, 1);
    this.prevBtn.disabled = cur <= this.minMonth;
    this.nextBtn.disabled = cur >= this.maxMonth;
  }
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
  if (typeSelect.value)  params.set('listing_type', typeSelect.value);

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

function isRentable(item) {
  const t = item.listing_type || 'rent';
  return (t === 'rent' || t === 'both') && item.price_per_day != null;
}

function isBuyable(item) {
  const t = item.listing_type || 'rent';
  return (t === 'sale' || t === 'both') && item.sell_price != null;
}

function priceRowHTML(item) {
  let h = '';
  if (isRentable(item)) {
    h += `<div class="card-price">฿${fmtPrice(item.price_per_day)} <span>/ day</span></div>`;
  }
  if (isBuyable(item)) {
    h += `<div class="card-price card-price-sale">฿${fmtPrice(item.sell_price)} <span>to buy</span></div>`;
  }
  return h;
}

function buyChatUrl(item) {
  const msg = `Hi! I'd like to buy "${item.item_name}" for ฿${fmtPrice(item.sell_price)}. Is it still available?`;
  return `/chat.html?with=${escAttr(item.user_id)}` +
         `&iname=${encodeURIComponent(item.item_name)}` +
         `&draft=${encodeURIComponent(msg)}`;
}

function cardHTML(item) {
  const imgSection = item.image_url
    ? `<div class="card-img"><img src="${escAttr(item.image_url)}" alt="${escAttr(item.item_name)}" loading="lazy" /></div>`
    : `<div class="card-img-placeholder">${CATEGORY_EMOJI[item.category] || '🎽'}</div>`;

  const brand   = item.brand ? escText(item.brand) : `<span class="no-brand">—</span>`;
  const isOwn   = currentUser && currentUser.id === item.user_id;
  const chatUrl = `/chat.html?with=${escAttr(item.user_id)}&iname=${encodeURIComponent(item.item_name)}`;

  let actions = '';
  if (isRentable(item)) {
    actions += `<button class="btn-rent" data-item-id="${escAttr(item.id)}">Rent Now</button>`;
  }
  if (isBuyable(item)) {
    actions += `<button class="btn-buy" data-item-id="${escAttr(item.id)}">Buy Now</button>`;
  }
  actions += `<button class="btn-contact" data-chat-url="${escAttr(chatUrl)}" ${isOwn ? 'disabled' : ''}>
            ${isOwn ? 'Your listing' : 'Contact Owner'}
          </button>`;

  return `
    <div class="card" data-card-id="${escAttr(item.id)}">
      ${imgSection}
      <div class="card-body">
        <div class="card-meta-row">
          <span class="card-tag">${escText(item.category)}</span>
          <span class="size-badge">${escText(item.size)}</span>
        </div>
        <div class="card-name">${escText(item.item_name)}</div>
        <div class="card-brand">${brand}</div>
        <div class="card-footer">
          ${priceRowHTML(item)}
        </div>
        <div class="card-actions">
          ${actions}
        </div>
      </div>
    </div>`;
}

// ── Event delegation for card buttons ────────────────────────────────────────

grid.addEventListener('click', (e) => {
  const rentBtn    = e.target.closest('.btn-rent');
  const buyBtn     = e.target.closest('.btn-buy');
  const contactBtn = e.target.closest('.btn-contact');

  if (rentBtn) {
    const item = allItems.find(it => it.id === rentBtn.dataset.itemId);
    if (item) handleRent(item);
    return;
  }

  if (buyBtn) {
    const item = allItems.find(it => it.id === buyBtn.dataset.itemId);
    if (item) handleBuy(item);
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

function handleBuy(item) {
  if (!currentUser) {
    window.location.href = '/auth/login.html?next=/marketplace.html';
    return;
  }
  if (currentUser.id === item.user_id) return;  // can't buy your own listing
  window.location.href = buyChatUrl(item);
}

// ── Deep link from homepage carousel (?item=…&action=rent|buy) ────────────────

function handleDeepLink() {
  const p      = new URLSearchParams(window.location.search);
  const itemId = p.get('item');
  if (!itemId) return;

  const item = allItems.find(it => it.id === itemId);
  if (!item) return;

  const action = p.get('action');
  if (action === 'buy'  && isBuyable(item))  return handleBuy(item);
  if (action === 'rent' && isRentable(item)) return handleRent(item);

  const card = grid.querySelector(`[data-card-id="${CSS.escape(itemId)}"]`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('card-flash');
    setTimeout(() => card.classList.remove('card-flash'), 1600);
  }
}

// ── Modal open / close ────────────────────────────────────────────────────────

const rc = new RentalCalendar(document.getElementById('rc'), (sel) => {
  rcSelection = sel;
  updatePricePreview();
});

// Fetch the item's booked ranges from the 'rentals' table and grey them out
async function loadRentalRanges(itemId) {
  try {
    const res = await fetch(`/api/rentals/item/${encodeURIComponent(itemId)}`);
    if (!res.ok) return;
    const { ranges, buffer_days } = await res.json();
    if (activeItem && activeItem.id === itemId) {
      rc.reset(ranges || [], buffer_days ?? 2);
    }
  } catch { /* network issue — calendar stays open with nothing blocked */ }
}

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
  modalPpd.innerHTML     =
    `฿${fmtPrice(item.price_per_day)} <span>/ day</span>` +
    (isBuyable(item) ? ` &nbsp;·&nbsp; ฿${fmtPrice(item.sell_price)} <span>to buy</span>` : '');

  // Offer "buy it now" inside the rent modal for dual-listed items
  if (isBuyable(item)) {
    modalBuyPrice.textContent = `฿${fmtPrice(item.sell_price)}`;
    modalBuy.style.display = 'block';
  } else {
    modalBuy.style.display = 'none';
  }

  // Reset form
  hidePricePreview();
  hideAlert();
  datesValid  = false;
  rcSelection = null;
  agreeCheckout.checked = false;
  refreshConfirm();

  // Show today's calendar right away, then fill in booked dates
  rc.reset([], 2);
  loadRentalRanges(item.id);

  // Show form, hide success
  formSection.style.display  = '';
  successSection.style.display = 'none';

  overlay.classList.add('open');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  modal.focus();
}

function closeModal() {
  overlay.classList.remove('open');
  modal.classList.remove('open');
  document.body.style.overflow = '';
  activeItem = null;
}

// ── Confirm-button gate: valid dates AND terms accepted ──────────────────────

function refreshConfirm() {
  confirmBtn.disabled = !(datesValid && agreeCheckout.checked);
}

agreeCheckout.addEventListener('change', refreshConfirm);

// ── Calendar selection → live price preview ──────────────────────────────────

function updatePricePreview() {
  if (!activeItem || !rcSelection) {
    hidePricePreview();
    datesValid = false;
    refreshConfirm();
    return;
  }

  hideAlert();

  const days      = rcSelection.days;
  const rate      = Number(activeItem.price_per_day);
  const total     = Math.round(days * rate * 100) / 100;
  const daysLabel = days === 1 ? '1 day' : `${days} days`;

  previewCalc.textContent  = `฿${fmtPrice(rate)} × ${daysLabel}`;
  previewTotal.textContent = `฿${fmtPrice(total)}`;

  pricePreview.style.display = '';
  datesValid = true;
  refreshConfirm();
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
  if (!activeItem || !rcSelection) return;
  if (!agreeCheckout.checked) {
    showAlert('กรุณายอมรับข้อตกลงการใช้งานและนโยบายความเป็นส่วนตัว');
    return;
  }

  hideAlert();
  confirmBtn.disabled         = true;
  confirmSpinner.style.display = 'inline-block';
  confirmLabel.textContent    = 'Booking…';

  try {
    const res = await fetchWithRefresh('/api/rentals', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        item_id:    activeItem.id,
        start_date: rcSelection.start,
        end_date:   rcSelection.end,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      showAlert(json.error || 'Something went wrong. Please try again.');
      confirmSpinner.style.display = 'none';
      confirmLabel.textContent    = 'Confirm Booking';
      refreshConfirm();
      // A 409 usually means someone just booked — refresh the blocked dates
      if (res.status === 409) loadRentalRanges(activeItem.id);
      return;
    }

    // Success state
    const { rental } = json;
    const start  = new Date(rental.start_date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    const end    = new Date(rental.end_date).toLocaleDateString('en-GB',   { day:'numeric', month:'short', year:'numeric' });
    successDetail.innerHTML =
      `<span>${activeItem.item_name}</span>` +
      `<span>${start} → ${end}</span>` +
      `<span>${rental.days} day${rental.days > 1 ? 's' : ''} · Total ฿${fmtPrice(rental.total_price)}</span>`;

    formSection.style.display   = 'none';
    successSection.style.display = '';

    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 2200);

  } catch {
    showAlert('Network error. Please check your connection and try again.');
    confirmSpinner.style.display = 'none';
    confirmLabel.textContent    = 'Confirm Booking';
    refreshConfirm();
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', closeModal);

modal.addEventListener('click', (e) => e.stopPropagation());

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !modal.classList.contains('open')) return;
  // Let the terms modal handle Escape when it's stacked on top.
  const terms = document.getElementById('lw-terms-overlay');
  if (terms && terms.classList.contains('open')) return;
  closeModal();
});

confirmBtn.addEventListener('click', submitBooking);

modalBuy.addEventListener('click', (e) => {
  e.preventDefault();
  if (activeItem) handleBuy(activeItem);
});

// Filters
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applySearch, 250);
});
catSelect.addEventListener('change',   loadItems);
sizeSelect.addEventListener('change',  loadItems);
styleSelect.addEventListener('change', loadItems);
typeSelect.addEventListener('change',  loadItems);
sortSelect.addEventListener('change',  loadItems);

document.getElementById('clear-filters-btn').addEventListener('click', () => {
  searchInput.value  = '';
  catSelect.value    = '';
  sizeSelect.value   = '';
  styleSelect.value  = '';
  typeSelect.value   = '';
  sortSelect.value   = 'newest';
  loadItems();
});

// ── Init ──────────────────────────────────────────────────────────────────────

// Pre-set filters from URL params (e.g. links from homepage carousels)
(function applyURLParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('q'))        searchInput.value = p.get('q');
  if (p.get('category')) catSelect.value   = p.get('category');
  if (p.get('size'))     sizeSelect.value  = p.get('size');
  if (p.get('style'))    styleSelect.value = p.get('style');
  if (p.get('listing_type') === 'rent' || p.get('listing_type') === 'sale') {
    typeSelect.value = p.get('listing_type');
  }
  const sort = p.get('sort'), order = p.get('order');
  if (sort === 'price_per_day') {
    sortSelect.value = order === 'asc' ? 'price_asc' : 'price_desc';
  }
})();

// Resolve auth before handling deep links so "Rent/Buy Now" from the homepage
// doesn't bounce a logged-in user to the login page.
Promise.all([checkAuth(), loadItems()]).then(handleDeepLink);
