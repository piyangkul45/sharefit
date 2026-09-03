'use strict';

const loading   = document.getElementById('loading');
const content   = document.getElementById('content');
const alert$    = document.getElementById('alert');
const form      = document.getElementById('list-form');
const submitBtn = document.getElementById('submit-btn');
const imageInput   = document.getElementById('image');
const previewWrap  = document.getElementById('preview-wrap');
const previewImg   = document.getElementById('preview-img');
const removeImgBtn = document.getElementById('remove-img');
const uploadZone   = document.getElementById('upload-zone');

// ── Auth check ────────────────────────────────────────────────────────────────

async function fetchWithRefresh(url, options = {}) {
  let res = await fetch(url, { ...options, credentials: 'include' });
  if (res.status === 401) {
    const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (r.ok) res = await fetch(url, { ...options, credentials: 'include' });
  }
  return res;
}

async function init() {
  const res = await fetchWithRefresh('/api/auth/me').catch(() => null);
  if (!res || !res.ok) {
    window.location.replace('/auth/login.html');
    return;
  }
  loading.style.display = 'none';
  content.style.display = 'block';
}

// ── Image preview ─────────────────────────────────────────────────────────────

function showPreview(file) {
  previewImg.src = URL.createObjectURL(file);
  previewWrap.style.display = 'block';
  uploadZone.style.display  = 'none';
}

function clearPreview() {
  previewImg.src = '';
  previewWrap.style.display = 'none';
  uploadZone.style.display  = 'block';
  imageInput.value = '';
}

imageInput.addEventListener('change', () => {
  if (imageInput.files[0]) showPreview(imageInput.files[0]);
});

removeImgBtn.addEventListener('click', clearPreview);

// ── Listing type toggle ───────────────────────────────────────────────────────

const listingType  = document.getElementById('listing_type');
const rentPriceRow  = document.getElementById('rent-price-row');
const salePriceRow  = document.getElementById('sale-price-row');

function syncPriceFields() {
  const type = listingType.value;
  rentPriceRow.hidden = type === 'sale';
  salePriceRow.hidden = type === 'rent';
}

listingType.addEventListener('change', syncPriceFields);
syncPriceFields();

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const dt = new DataTransfer();
    dt.items.add(file);
    imageInput.files = dt.files;
    showPreview(file);
  }
});

// ── Alert helpers ─────────────────────────────────────────────────────────────

function showAlert(msg, type = 'error') {
  alert$.textContent  = msg;
  alert$.className    = type;
  alert$.style.display = 'block';
  alert$.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert() { alert$.style.display = 'none'; }

// ── Form submission ───────────────────────────────────────────────────────────

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const item_name    = form.item_name.value.trim();
  const category     = form.category.value;
  const size         = form.size.value;
  const style        = form.style.value;
  const listing_type = form.listing_type.value;
  const price        = form.price_per_day.value;
  const sellPrice    = form.sell_price.value;

  const wantsRent = listing_type === 'rent' || listing_type === 'both';
  const wantsSale = listing_type === 'sale' || listing_type === 'both';

  if (!item_name) return showAlert('Please enter an item name.');
  if (!category)  return showAlert('Please select a category.');
  if (!size)      return showAlert('Please select a size.');
  if (!style)     return showAlert('Please select a style.');
  if (wantsRent && (!price || Number(price) <= 0)) return showAlert('Please enter a valid price per day.');
  if (wantsSale && (!sellPrice || Number(sellPrice) <= 0)) return showAlert('Please enter a valid sale price.');

  const body = new FormData(form);
  if (!wantsRent) body.delete('price_per_day');
  if (!wantsSale) body.delete('sell_price');

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Listing…';

  try {
    const res = await fetchWithRefresh('/api/items', { method: 'POST', body });

    if (res.ok) {
      showAlert('Your item has been listed!', 'success');
      setTimeout(() => window.location.replace('/dashboard.html'), 1200);
      return;
    }

    const json = await res.json().catch(() => ({}));
    showAlert(json.error || 'Something went wrong. Please try again.');
  } catch {
    showAlert('Network error. Please check your connection and try again.');
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = 'List item';
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.replace('/auth/login.html');
});

init();
