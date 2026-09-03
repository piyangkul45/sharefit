# LoopWear

Peer-to-peer fashion platform where people list garments from their own closets and
others can **rent them by the day, buy them outright, or both**. Formerly branded
"ShareFIT" — the project is now **LoopWear** and every user-facing string, page
title, email copy, and asset should use that name.

## Platform model

LoopWear supports two transaction types per listing, chosen by the lister:

| `listing_type` | Meaning                     | Prices required        |
|----------------|-----------------------------|------------------------|
| `rent`         | Rental only                 | `price_per_day`        |
| `sale`         | Purchase only               | `sell_price`           |
| `both`         | Rentable **and** buyable     | `price_per_day` + `sell_price` |

- **Renting** is a fully transacted flow: the renter picks a date range in an
  inline calendar (booked dates + a 2-day turnaround buffer are greyed out),
  the server computes the total, re-checks conflicts, and writes a `rentals`
  row (`status = 'pending'`). Inclusive day count — same start/end = 1 day.
  (The older `bookings` table is legacy and no longer written to.)
- **Buying** is currently an *inquiry* flow, not a checkout: "Buy Now" opens a
  chat with the seller pre-filled with a purchase message (`/chat.html?...&draft=`).
  There is no orders/payments table yet — do not assume one exists.
- Browsing, prices, and action buttons everywhere must reflect `listing_type`:
  show "฿X / day" and/or "฿Y to buy", and render **Rent Now** / **Buy Now**
  accordingly.

## Tech stack

- **Backend:** Node.js + Express (`server.js`), plain CommonJS, `'use strict'`.
- **Auth & data:** Supabase (Postgres + Supabase Auth + Storage). No ORM — the
  `@supabase/supabase-js` query builder is used directly.
- **Frontend:** static HTML/CSS/vanilla JS served from the repo root by
  `express.static`. No framework, no build step, no bundler. Each page has a
  matching `<page>.js` file.
- **Security:** `helmet` (strict CSP — **no inline scripts**, JS must live in
  `.js` files), `cors` with credentials, `express-rate-limit` on auth routes.

## Commands

```bash
npm install
npm run setup     # generates .env with random JWT secrets (won't overwrite)
npm start         # node server.js  → http://localhost:3000
npm run dev       # nodemon
```

Then run `setup.sql` in the Supabase SQL editor (idempotent) to create tables,
RLS policies, the storage bucket, and helper functions. Required env vars:
`SUPABASE_URL`, `SUPABASE_ANON_KEY` (server refuses to boot without them);
see `.env.example`.

## Architecture

```
server.js                 Express app: security → parsers → static → /api/* routes → error handler
src/
  config/db.js            shared anon Supabase client (public reads)
  middleware/
    auth.js               requireAuth — validates the access_token cookie via supabase.auth.getUser
    security.js           helmet CSP, CORS, authLimiter / signupLimiter
  routes/                 thin route files, one per resource
  controllers/            all logic lives here
  utils/tokenUtils.js     sets/clears httpOnly auth cookies
```

### Auth flow

- Supabase Auth issues the tokens; we store `access_token` + `refresh_token` as
  **httpOnly cookies** (`setAuthCookies`). Email confirmation is enabled, so
  signup may return no session.
- Protected endpoints use `requireAuth`, which populates `req.userId`,
  `req.user`, `req.accessToken`.
- The frontend uses a `fetchWithRefresh` helper: on a 401 it POSTs
  `/api/auth/refresh` once and retries.

### Supabase client pattern (controllers)

- **Public reads** (browse listings, look up profiles): the shared `anonClient`
  from `config/db.js`.
- **User-scoped writes / reads** (create item, book, message): build a
  per-request client with the user's bearer token so **RLS policies apply**:

  ```js
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth:   { persistSession: false },
  });
  ```

- Never trust client-supplied prices/totals — recompute server-side.

## Data model (`setup.sql`)

- **`items`** — `user_id`, `item_name`, `brand`, `size`, `category`, `style`,
  `listing_type` (`rent` | `sale` | `both`, default `rent`),
  `price_per_day` (nullable; required for rent/both),
  `sell_price` (nullable; required for sale/both),
  `image_url`, `is_available`, `created_at`.
  CHECK constraints enforce that the price matching the listing type is present.
- **`rentals`** — `item_id`, `renter_id`, `start_date`, `end_date`, `days`,
  `daily_rate`, `total_price`, `status`
  (`pending`|`confirmed`|`active`|`completed`|`cancelled`). Two SECURITY DEFINER
  helpers: `get_item_rental_ranges(item_id)` (public — booked ranges only, no
  renter identity) and `check_rental_conflict(item_id, start, end, buffer)`
  (overlap incl. the turnaround buffer). RLS: renter **and** the item's owner
  can read a row. `BUFFER_DAYS = 2` is duplicated in `rentalController.js` and
  `marketplace.js` — keep them in sync.
- **`bookings`** — *legacy*, retained for old data; no longer written to. Had
  `check_booking_overlap`.
- **`messages`** — `sender_id`, `receiver_id`, `message_text` (1–1000 chars),
  `created_at`. Powers the buy inquiry + owner-contact chat.
- **`profiles`** — `id` (= `auth.users.id`), `username`, and Terms/Privacy
  consent: `tos_accepted`, `tos_accepted_at`, `tos_version`. Auto-created by the
  `handle_new_user` trigger, which copies `username` + consent fields from the
  signup's `raw_user_meta_data` (set via `options.data` in the auth controller).
  Needed because `auth.users` isn't queryable with a user JWT.
- **Storage:** `item-images` public bucket; server uploads to `${userId}/...`.

Allowed enum values live in `src/controllers/itemController.js`
(`ALLOWED_CATEGORIES`, `ALLOWED_STYLES`, `ALLOWED_SIZES`,
`ALLOWED_LISTING_TYPES`) and are mirrored in the HTML `<select>`s — keep them
in sync.

## API

| Method | Path                                   | Auth | Notes |
|--------|----------------------------------------|------|-------|
| POST   | `/api/auth/signup` `/login` `/refresh` `/logout` | mixed | rate-limited; `signup` requires `terms_accepted: true` and stores consent on the profile |
| GET    | `/api/auth/me`                         | ✔    | current user |
| GET    | `/api/items`                           | –    | public browse; filters: `category`, `size`, `style`, `listing_type` (`rent`→`in(rent,both)`, `sale`→`in(sale,both)`), `sort`, `order` |
| POST   | `/api/items`                           | ✔    | multipart (`multer` memory storage, 5 MB); creates a listing |
| GET    | `/api/items/mine`                      | ✔    | lister's own items |
| GET    | `/api/rentals/item/:itemId`            | –    | public; booked date ranges for a listing (+ `buffer_days`). Fails open to `[]` if the RPC errors |
| POST   | `/api/rentals`                         | ✔    | create a rental; server recomputes price + conflict check (incl. buffer) |
| GET    | `/api/rentals/mine`                    | ✔    | renter's own rentals (joins `items`) |
| POST   | `/api/messages`                        | ✔    | send message |
| GET    | `/api/messages/conversations`          | ✔    | inbox |
| GET    | `/api/messages/conversation/:partnerId`| ✔    | thread (supports `?since=`) |

CORS is restricted to `GET`/`POST` — no `PUT`/`PATCH`/`DELETE` endpoints exist.

## Frontend pages

| File | Purpose |
|------|---------|
| `index.html` / `home.js` | Homepage; three product carousels (new / premium / value). Cards link to `/marketplace.html?item=<id>` and carry **Rent Now** / **Buy Now** deep links (`&action=rent\|buy`). |
| `marketplace.html` / `marketplace.js` | Browse grid, filter bar (incl. listing-type filter), search, sort. Rent opens the booking modal; Buy routes to chat. Handles `?item=&action=` deep links. |
| `list-item.html` / `list-item.js` | Create a listing: pick listing type, enter day price and/or sale price, upload photo. |
| `chat.html` / `chat.js` | 1:1 messaging. Supports `?with=`, `?iname=`, `?draft=` (prefills composer — used by Buy Now). |
| `dashboard.html` / `dashboard.js` | Account info + listing count. |
| `auth/login.html`, `auth/signup.html` | Auth screens. |
| `terms.html` / `terms.js` | Standalone Terms & Privacy page (Thai/PDPA). Accordion sections (Privacy Policy, Terms of Service, Dispute Rules, Anti-Fraud Policy), required consent checkbox, "ยืนยัน" button disabled until checked. Records consent in `localStorage.loopwear_consent`; redirects to `?next=` (same-origin path only) or `/`. |
| `terms-modal.js` | Shared Terms accordion **modal**, injected on demand. Load it before a page's own script; any `<button>`/`<a data-open-terms[="privacy\|tos\|dispute\|fraud"]>` opens it (`window.LoopWearTerms.open()/.close()`). Section copy is mirrored from `terms.html` — keep in sync. Used by signup + the booking modal. |

### Terms consent gating

Register (`auth/signup`) and checkout (marketplace booking modal) both require a
consent checkbox — *"ฉันได้อ่านและยอมรับ ข้อตกลงการใช้งาน และ นโยบายความเป็นส่วนตัว"* —
with the submit / Confirm button disabled until it's ticked, and the terms links
opening the shared modal. On **register** the consent (`tos_accepted`,
`tos_accepted_at` = server time, `tos_version`, matching `TOS_VERSION` in
`authController.js` / `CONSENT_VERSION` in the JS) is persisted to `profiles` via
signup metadata + the `handle_new_user` trigger. Checkout consent is UI-gating
only (not stored).

## Conventions

- CommonJS, `'use strict'` at the top of every file.
- Controllers hold the logic; routes stay one-liner thin.
- Escape all user content before putting it in HTML — frontend files have local
  `esc` / `escText` / `escAttr` helpers; use them.
- Currency is Thai Baht (`฿`), formatted with `toLocaleString('th-TH', { maximumFractionDigits: 0 })`.
- Dark theme; CSS lives inline in each HTML file's `<style>` using the shared
  `--black / --white / --muted / --surface / --border / --card-bg / --success / --error` tokens.
- Keep the brand name **LoopWear** consistent across code, copy, and titles.
