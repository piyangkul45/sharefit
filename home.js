'use strict';

// ── Category emoji map ────────────────────────────────────────────────────────

const EMOJI = {
  tops: '👕', bottoms: '👖', dresses: '👗', outerwear: '🧥',
  activewear: '🏋️', accessories: '🕶️', footwear: '👟', other: '🎽',
};

// ── Carousel sections: id matches DOM id="track-{id}", etc. ──────────────────

const SECTIONS = [
  {
    id:   'new',
    sort: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  },
  {
    id:   'premium',
    sort: (a, b) => b.price_per_day - a.price_per_day,
  },
  {
    id:   'value',
    sort: (a, b) => a.price_per_day - b.price_per_day,
  },
];

// ── Skeleton placeholder HTML ─────────────────────────────────────────────────

const SKELETON_CARD = `
  <div class="sk" aria-hidden="true">
    <div class="sk-img"></div>
    <div class="sk-body">
      <div class="sk-line" style="width:38%"></div>
      <div class="sk-line" style="width:82%;margin-top:.4rem"></div>
      <div class="sk-line" style="width:56%;margin-top:.3rem"></div>
      <div class="sk-line" style="width:46%;margin-top:.6rem;height:.82rem"></div>
    </div>
  </div>`;
const SKELETONS = Array(8).fill(SKELETON_CARD).join('');

// ── Carousel class ────────────────────────────────────────────────────────────

class Carousel {
  constructor(id) {
    this.track    = document.getElementById('track-'    + id);
    this.shell    = document.getElementById('shell-'    + id);
    this.prevBtn  = document.getElementById('prev-'     + id);
    this.nextBtn  = document.getElementById('next-'     + id);
    this.progFill = document.getElementById('prog-'     + id);

    this.prevBtn.addEventListener('click', () => this._slide(-1));
    this.nextBtn.addEventListener('click', () => this._slide(1));
    this.track.addEventListener('scroll',  () => this._update(), { passive: true });
  }

  showSkeleton() {
    this.track.innerHTML = SKELETONS;
    this._update();
  }

  populate(items) {
    if (!items.length) {
      this.track.innerHTML = `<div class="carousel-empty">Nothing listed yet. <a href="/marketplace.html">Browse all →</a></div>`;
      this.prevBtn.classList.add('btn-edge');
      this.nextBtn.classList.add('btn-edge');
      const pw = this.progFill.parentElement;
      if (pw) pw.style.display = 'none';
      return;
    }
    this.track.innerHTML = items.map(cardHTML).join('');
    this._update();
  }

  _slide(dir) {
    this.track.scrollBy({ left: dir * this.track.clientWidth * 0.82, behavior: 'smooth' });
  }

  _update() {
    const { scrollLeft, scrollWidth, clientWidth } = this.track;
    const atStart = scrollLeft <= 4;
    const atEnd   = scrollLeft >= scrollWidth - clientWidth - 4;

    this.prevBtn.classList.toggle('btn-edge', atStart);
    this.nextBtn.classList.toggle('btn-edge', atEnd);
    this.shell.classList.toggle('past-start', !atStart);
    this.shell.classList.toggle('at-end',      atEnd);

    // Progress bar thumb
    if (scrollWidth <= clientWidth) {
      this.progFill.style.width = '100%';
      this.progFill.style.left  = '0';
      return;
    }
    const progress = scrollLeft / (scrollWidth - clientWidth);
    const barW     = Math.max(12, (clientWidth / scrollWidth) * 100);
    this.progFill.style.width = barW + '%';
    this.progFill.style.left  = (progress * (100 - barW)) + '%';
  }
}

// ── HTML helpers (XSS-safe) ───────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cardHTML(item) {
  const img = item.image_url
    ? `<div class="cc-img"><img src="${esc(item.image_url)}" alt="${esc(item.item_name)}" loading="lazy" decoding="async"/></div>`
    : `<div class="cc-img-ph">${EMOJI[item.category] || '🎽'}</div>`;

  const price = Number(item.price_per_day).toLocaleString('th-TH', { maximumFractionDigits: 0 });
  const brand = item.brand
    ? esc(item.brand)
    : '<span style="color:#444">—</span>';

  return `<a class="cc" href="/marketplace.html" role="listitem" tabindex="0">
      ${img}
      <div class="cc-body">
        <div class="cc-meta">
          <span class="cc-tag">${esc(item.category)}</span>
          <span class="cc-size">${esc(item.size)}</span>
        </div>
        <div class="cc-name">${esc(item.item_name)}</div>
        <div class="cc-brand">${brand}</div>
        <div class="cc-price">฿${price} <span>/ day</span></div>
      </div>
    </a>`;
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function init() {
  // 1. Build carousel instances and show skeletons immediately
  const carousels = SECTIONS.map(s => {
    const c = new Carousel(s.id);
    c.showSkeleton();
    return { sort: s.sort, carousel: c };
  });

  // 2. Fetch all items in one request
  let items = [];
  try {
    const res = await fetch('/api/items');
    if (res.ok) ({ items } = await res.json());
  } catch { /* API unreachable — show empty state */ }

  // 3. Populate each carousel with a different sorted view
  for (const { sort, carousel } of carousels) {
    const sorted = [...items].sort(sort).slice(0, 12);
    carousel.populate(sorted);
  }

  // 4. Wire homepage search → marketplace
  const searchInput = document.getElementById('home-search-input');
  const catSelect   = document.getElementById('home-search-cat');
  const styleSelect = document.getElementById('home-search-style');
  const searchBtn   = document.getElementById('home-search-btn');

  function goToMarketplace() {
    const params = new URLSearchParams();
    if (catSelect   && catSelect.value)   params.set('category', catSelect.value);
    if (styleSelect && styleSelect.value) params.set('style',    styleSelect.value);
    const qs = params.toString();
    window.location.href = '/marketplace.html' + (qs ? '?' + qs : '');
  }

  if (searchBtn)   searchBtn.addEventListener('click', goToMarketplace);
  if (searchInput) searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') goToMarketplace();
  });
}

init();
