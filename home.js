'use strict';

// ── Category emoji map ────────────────────────────────────────────────────────

const EMOJI = {
  tops: '👕', bottoms: '👖', dresses: '👗', outerwear: '🧥',
  activewear: '🏋️', accessories: '🕶️', footwear: '👟', other: '🎽',
};

// ── Carousel sections: id matches DOM id="track-{id}", etc. ──────────────────

const effPrice = it => Number(it.price_per_day ?? it.sell_price ?? 0);

const SECTIONS = [
  {
    id:   'new',
    sort: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  },
  {
    id:   'premium',
    sort: (a, b) => effPrice(b) - effPrice(a),
  },
  {
    id:   'value',
    sort: (a, b) => effPrice(a) - effPrice(b),
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

function fmtPrice(n) {
  return Number(n).toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

function priceBlockHTML(item) {
  const type     = item.listing_type || 'rent';
  const showRent = type === 'rent' || type === 'both';
  const showSale = type === 'sale' || type === 'both';

  let html = '';
  if (showRent && item.price_per_day != null) {
    html += `<div class="cc-price">฿${fmtPrice(item.price_per_day)} <span>/ day</span></div>`;
  }
  if (showSale && item.sell_price != null) {
    html += `<div class="cc-price cc-price-sale">฿${fmtPrice(item.sell_price)} <span>to buy</span></div>`;
  }
  return html;
}

function actionsHTML(item) {
  const type     = item.listing_type || 'rent';
  const showRent = type === 'rent' || type === 'both';
  const showSale = type === 'sale' || type === 'both';
  const id       = esc(item.id);

  let html = '<div class="cc-actions">';
  if (showRent) {
    html += `<a class="cc-btn cc-btn-rent" href="/marketplace.html?item=${id}&action=rent">Rent Now</a>`;
  }
  if (showSale) {
    html += `<a class="cc-btn cc-btn-buy" href="/marketplace.html?item=${id}&action=buy">Buy Now</a>`;
  }
  html += '</div>';
  return html;
}

function cardHTML(item) {
  const img = item.image_url
    ? `<div class="cc-img"><img src="${esc(item.image_url)}" alt="${esc(item.item_name)}" loading="lazy" decoding="async"/></div>`
    : `<div class="cc-img-ph">${EMOJI[item.category] || '🎽'}</div>`;

  const brand = item.brand
    ? esc(item.brand)
    : '<span style="color:#444">—</span>';

  return `<article class="cc" role="listitem">
      <a class="cc-link" href="/marketplace.html?item=${esc(item.id)}" tabindex="0">
        ${img}
        <div class="cc-body">
          <div class="cc-meta">
            <span class="cc-tag">${esc(item.category)}</span>
            <span class="cc-size">${esc(item.size)}</span>
          </div>
          <div class="cc-name">${esc(item.item_name)}</div>
          <div class="cc-brand">${brand}</div>
          <div class="cc-price-wrap">${priceBlockHTML(item)}</div>
        </div>
      </a>
      ${actionsHTML(item)}
    </article>`;
}

// ── Hero — fill the background photo grid + price badges with real listings ──

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function glyphFor(category) {
  return EMOJI[category] || '🎽';
}

function populateHeroGrid(items) {
  const cells = [...document.querySelectorAll('.hero-grid-cell')];
  if (!cells.length || !items.length) return;

  // Draw from a re-shuffled bag so a small catalog still tiles the whole
  // wall without obvious repeats lining up column-to-column.
  let bag = [];
  const nextItem = () => {
    if (!bag.length) bag = shuffle(items);
    return bag.pop();
  };

  cells.forEach((cell, i) => {
    const item = nextItem();
    cell.innerHTML = '';

    if (item.image_url) {
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.loading = i < 8 ? 'eager' : 'lazy';
      img.addEventListener('load', () => cell.classList.add('has-img'));
      img.src = item.image_url;
      cell.appendChild(img);
    } else {
      // No photo on this listing — fall back to the category glyph
      const glyph = document.createElement('span');
      glyph.className = 'hero-grid-glyph';
      glyph.textContent = glyphFor(item.category);
      cell.appendChild(glyph);
      cell.classList.add('has-glyph');
    }
  });
}

// Build the { title, rent, buy } shown on a floating product badge
function heroBadgeData(item) {
  const type = item.listing_type || 'rent';
  return {
    title: item.item_name || '',
    href:  `/marketplace.html?item=${encodeURIComponent(item.id)}`,
    rent:  (type !== 'sale' && item.price_per_day != null) ? `฿${fmtPrice(item.price_per_day)}` : null,
    buy:   (type !== 'rent' && item.sell_price   != null) ? `฿${fmtPrice(item.sell_price)}`   : null,
  };
}

function populateHeroBadges(items) {
  const badges = [...document.querySelectorAll('.hero-price-badge')];
  if (!badges.length) return;

  // Prefer listings with a photo — the badge visually sits on a featured image
  const pool = shuffle(items.filter(it => it.image_url));
  const fallback = shuffle(items);

  badges.forEach((badge, i) => {
    const item = pool[i] || fallback[i];
    if (!item) return; // keep the static example content

    const d = heroBadgeData(item);
    const titleEl = badge.querySelector('.badge-title');
    const rentEl  = badge.querySelector('.badge-rent');
    const buyEl   = badge.querySelector('.badge-buy');

    if (badge.tagName === 'A') badge.href = d.href;
    if (titleEl) titleEl.textContent = d.title;

    if (rentEl) {
      rentEl.hidden = !d.rent;
      if (d.rent) rentEl.querySelector('.badge-num').textContent = d.rent;
    }
    if (buyEl) {
      buyEl.hidden = !d.buy;
      if (d.buy) buyEl.querySelector('.badge-num').textContent = d.buy;
    }
  });
}

// ── Featured collections grid (All / Hot Rentals / Buy Now) ──────────────────

function isRentable(it) {
  const t = it.listing_type || 'rent';
  return (t === 'rent' || t === 'both') && it.price_per_day != null;
}
function isBuyable(it) {
  const t = it.listing_type || 'rent';
  return (t === 'sale' || t === 'both') && it.sell_price != null;
}

function renderFeatured(items) {
  const grid = document.getElementById('fc-grid');
  if (!grid) return;

  const tabs   = [...document.querySelectorAll('.fc-tab')];
  const newest = [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  function view(filter) {
    let list = newest;
    if (filter === 'rent') list = newest.filter(isRentable);
    else if (filter === 'buy') list = newest.filter(isBuyable);
    list = list.slice(0, 8);

    grid.innerHTML = list.length
      ? list.map(cardHTML).join('')
      : `<div class="fc-empty">Nothing here yet. <a href="/marketplace.html">Browse the marketplace →</a></div>`;
  }

  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => {
      const on = t === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    view(tab.dataset.filter);
  }));

  view('all');
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

  // 3b. Fill the hero background grid + floating price badges
  populateHeroGrid(items);
  populateHeroBadges(items);

  // 3c. Featured collections grid (with All / Hot Rentals / Buy Now tabs)
  renderFeatured(items);

  // 4. Wire homepage search → marketplace (free-text query)
  const searchInput = document.getElementById('home-search-input');
  const searchBtn   = document.getElementById('home-search-btn');

  function goToMarketplace() {
    const q = (searchInput?.value || '').trim();
    window.location.href = '/marketplace.html' + (q ? '?q=' + encodeURIComponent(q) : '');
  }

  if (searchBtn)   searchBtn.addEventListener('click', goToMarketplace);
  if (searchInput) searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') goToMarketplace();
  });
}

// ── Category mega menu (text-only, SASOM-style) ─────────────────────────────

const CAT_MENU = {
  dresses: { label: 'Dresses', param: 'category=dresses', cols: {
    'Popular Brands': ['Reformation', 'Ganni', 'Realisation Par', 'Zara', 'COS'],
    'Best Sellers':   ['Slip dress', 'Midi dress', 'Party dress', 'Maxi dress'],
    'Picks by Type':  ['Cocktail', 'Wedding guest', 'Summer', 'Formal'],
  }},
  outerwear: { label: 'Outerwear', param: 'category=outerwear', cols: {
    'Popular Brands': ['Acne Studios', 'The Frankie Shop', 'Max Mara', 'Nanushka', 'Uniqlo'],
    'Best Sellers':   ['Tailored blazer', 'Wool coat', 'Trench coat', 'Leather jacket'],
    'Picks by Type':  ['Blazers', 'Coats', 'Trenches', 'Puffers'],
  }},
  tops: { label: 'Tops', param: 'category=tops', cols: {
    'Popular Brands': ['COS', 'Totême', 'Sézane', 'Ganni', '& Other Stories'],
    'Best Sellers':   ['Silk blouse', 'Knit top', 'Corset top', 'Oversized shirt'],
    'Picks by Type':  ['Blouses', 'Knitwear', 'Going out', 'Basics'],
  }},
  bottoms: { label: 'Bottoms', param: 'category=bottoms', cols: {
    'Popular Brands': ["Levi's", 'Agolde', 'Totême', 'Frame', 'The Row'],
    'Best Sellers':   ['Wide-leg trousers', 'Y2K jeans', 'Tailored trousers', 'Leather skirt'],
    'Picks by Type':  ['Jeans', 'Trousers', 'Skirts', 'Shorts'],
  }},
  footwear: { label: 'Footwear', param: 'category=footwear', cols: {
    'Popular Brands': ['The Row', 'Bottega Veneta', 'Manolo Blahnik', 'Dr. Martens', 'Reike Nen'],
    'Best Sellers':   ['Strappy heels', 'Knee boots', 'Ballet flats', 'Loafers'],
    'Picks by Type':  ['Heels', 'Boots', 'Flats', 'Sneakers'],
  }},
  accessories: { label: 'Accessories', param: 'category=accessories', cols: {
    'Popular Brands': ['Bottega Veneta', 'Jacquemus', 'Polène', 'Loewe', 'Celine'],
    'Best Sellers':   ['Shoulder bag', 'Statement earrings', 'Silk scarf', 'Sunglasses'],
    'Picks by Type':  ['Bags', 'Jewellery', 'Belts', 'Eyewear'],
  }},
  activewear: { label: 'Activewear', param: 'category=activewear', cols: {
    'Popular Brands': ['Alo Yoga', 'Lululemon', 'Nike', 'Adidas', 'Girlfriend Collective'],
    'Best Sellers':   ['Matching set', 'Bike shorts', 'Sports bra', 'Zip jacket'],
    'Picks by Type':  ['Sets', 'Leggings', 'Tops', 'Outerwear'],
  }},
  occasionwear: { label: 'Occasionwear', param: 'style=formal', cols: {
    'Popular Brands': ['Self-Portrait', 'ROTATE', 'Nadine Merabi', 'Needle & Thread', '16Arlington'],
    'Best Sellers':   ['Sequin gown', 'Feather dress', 'Two-piece set', 'Tuxedo dress'],
    'Picks by Type':  ['Black tie', 'Wedding guest', 'Gala', 'Cocktail'],
  }},
  vintage: { label: 'Vintage', param: 'style=vintage', cols: {
    'Popular Brands': ['Vintage Dior', 'Vintage Chanel', '90s Prada', 'Y2K Cavalli', "Levi's Vintage"],
    'Best Sellers':   ['Slip skirt', 'Leather trench', 'Band tee', 'Beaded bag'],
    'Picks by Type':  ['70s', '90s', 'Y2K', 'Archive'],
  }},
};

function initCategoryNav() {
  const wrap = document.querySelector('.site-header');
  const nav  = document.getElementById('cat-nav');
  const mega = document.getElementById('cat-mega');
  if (!wrap || !nav || !mega) return;

  const links    = [...nav.querySelectorAll('.cat-link[data-cat]')];
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  let openKey = null;
  let closeTimer = null;

  function buildMega(key) {
    const data = CAT_MENU[key];
    if (!data) return;
    mega.innerHTML =
      `<a class="cat-mega-all" href="/marketplace.html?${data.param}">Shop all ${esc(data.label)} &rarr;</a>` +
      `<div class="cat-mega-inner">` +
      Object.entries(data.cols).map(([title, entries]) =>
        `<div class="mega-col"><h4>${esc(title)}</h4>` +
        entries.map(e =>
          `<a href="/marketplace.html?${data.param}&q=${encodeURIComponent(e)}">${esc(e)}</a>`
        ).join('') +
        `</div>`
      ).join('') +
      `</div>`;
  }

  function open(key) {
    clearTimeout(closeTimer);
    if (openKey === key) return;
    openKey = key;
    buildMega(key);
    wrap.classList.add('mega-open');
    links.forEach(a => {
      const on = a.dataset.cat === key;
      a.classList.toggle('is-open', on);
      a.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
  }

  function close() {
    openKey = null;
    wrap.classList.remove('mega-open');
    links.forEach(a => {
      a.classList.remove('is-open');
      a.setAttribute('aria-expanded', 'false');
    });
  }

  links.forEach(link => {
    const key = link.dataset.cat;

    if (key === 'all') {
      if (canHover) link.addEventListener('mouseenter', close);
      return;                       // "For You" just navigates
    }

    if (canHover) {
      link.addEventListener('mouseenter', () => open(key));
      link.addEventListener('focus', () => open(key));
    } else {
      link.addEventListener('click', (e) => {   // touch: first tap opens the menu
        e.preventDefault();
        if (openKey === key) close(); else open(key);
      });
    }
  });

  if (canHover) {
    wrap.addEventListener('mouseleave', () => {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(close, 180);
    });
    wrap.addEventListener('mouseenter', () => clearTimeout(closeTimer));
  }

  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openKey) close(); });
}

initCategoryNav();
init();
