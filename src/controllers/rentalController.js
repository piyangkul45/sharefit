'use strict';
const { createClient } = require('@supabase/supabase-js');
const anonClient       = require('../config/db');

// Turnaround/cleaning buffer blocked AFTER every rental before the item can
// be booked again. Mirrored in marketplace.js and check_rental_conflict().
const BUFFER_DAYS = 2;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getUserClient(accessToken) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth:   { persistSession: false },
    }
  );
}

// Inclusive day count: 2026-03-01 → 2026-03-01 is 1 day.
function inclusiveDays(startISO, endISO) {
  return Math.round((new Date(endISO) - new Date(startISO)) / 86_400_000) + 1;
}

// ── GET /api/rentals/item/:itemId ─────────────────────────────────────────────
// Public: the booked date ranges for a listing so the frontend can disable them.
// Uses a SECURITY DEFINER function so no renter identity is exposed.

async function getItemRanges(req, res, next) {
  try {
    const itemId = req.params.itemId;
    if (!UUID_RE.test(itemId)) {
      return res.status(400).json({ error: 'Invalid item id.' });
    }

    const { data, error } = await anonClient.rpc('get_item_rental_ranges', {
      p_item_id: itemId,
    });
    if (error) {
      // Fail open — the calendar just shows nothing blocked. The POST handler
      // still enforces conflicts authoritatively before any row is written.
      console.error('[rentals] range lookup failed:', error.message);
      return res.json({ ranges: [], buffer_days: BUFFER_DAYS });
    }

    return res.json({ ranges: data || [], buffer_days: BUFFER_DAYS });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/rentals ─────────────────────────────────────────────────────────
// Authenticated: create a rental booking in the 'rentals' table.

async function createRental(req, res, next) {
  try {
    const { item_id, start_date, end_date } = req.body;

    if (!item_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'item_id, start_date and end_date are required.' });
    }
    if (!UUID_RE.test(item_id)) {
      return res.status(400).json({ error: 'Invalid item id.' });
    }
    if (!ISO_DATE.test(start_date) || !ISO_DATE.test(end_date)) {
      return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format.' });
    }

    const start = new Date(start_date);
    const end   = new Date(end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date values.' });
    }
    if (start < today) {
      return res.status(400).json({ error: 'Start date cannot be in the past.' });
    }
    if (end < start) {
      return res.status(400).json({ error: 'End date must be on or after the start date.' });
    }

    // Item must exist, be rentable, and available
    const { data: item, error: itemErr } = await anonClient
      .from('items')
      .select('id, user_id, listing_type, price_per_day, is_available')
      .eq('id', item_id)
      .single();

    if (itemErr || !item) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    if (item.user_id === req.userId) {
      return res.status(400).json({ error: 'You cannot rent your own listing.' });
    }
    if (!['rent', 'both'].includes(item.listing_type) || item.price_per_day == null) {
      return res.status(400).json({ error: 'This item is not available for rent.' });
    }
    if (!item.is_available) {
      return res.status(409).json({ error: 'This item is not currently available for rental.' });
    }

    // Overlap check (incl. the turnaround buffer) via SECURITY DEFINER fn
    const { data: conflict, error: conflictErr } = await anonClient.rpc('check_rental_conflict', {
      p_item_id: item_id,
      p_start:   start_date,
      p_end:     end_date,
      p_buffer:  BUFFER_DAYS,
    });
    if (conflictErr) return next(conflictErr);
    if (conflict) {
      return res.status(409).json({
        error: `Those dates are unavailable — they overlap an existing booking or its ${BUFFER_DAYS}-day turnaround. Please choose another range.`,
      });
    }

    // Price is computed server-side — never trust the client figure
    const days       = inclusiveDays(start_date, end_date);
    const dailyRate   = Number(item.price_per_day);
    const totalPrice  = Math.round(days * dailyRate * 100) / 100;

    const sb = getUserClient(req.accessToken);
    const { data: rental, error: insertErr } = await sb
      .from('rentals')
      .insert({
        item_id,
        renter_id:   req.userId,
        start_date,
        end_date,
        days,
        daily_rate:  dailyRate,
        total_price: totalPrice,
        status:      'pending',
      })
      .select('id, start_date, end_date, days, daily_rate, total_price, status')
      .single();

    if (insertErr) return next(insertErr);

    return res.status(201).json({ message: 'Rental request created.', rental });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/rentals/mine ─────────────────────────────────────────────────────

async function getMyRentals(req, res, next) {
  try {
    const sb = getUserClient(req.accessToken);

    const { data, error } = await sb
      .from('rentals')
      .select(`
        id, start_date, end_date, days, daily_rate, total_price, status, created_at,
        items ( id, item_name, brand, size, category, image_url )
      `)
      .eq('renter_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) return next(error);

    return res.json({ rentals: data || [] });
  } catch (err) {
    next(err);
  }
}

module.exports = { getItemRanges, createRental, getMyRentals };
