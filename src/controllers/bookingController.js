'use strict';
const { createClient } = require('@supabase/supabase-js');
const anonClient       = require('../config/db');

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

// ── POST /api/bookings ────────────────────────────────────────────────────────

async function createBooking(req, res, next) {
  try {
    const { item_id, start_date, end_date } = req.body;

    if (!item_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'item_id, start_date, and end_date are required.' });
    }

    // Validate date format (YYYY-MM-DD expected)
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
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
    if (end <= start) {
      return res.status(400).json({ error: 'End date must be after start date.' });
    }

    // Fetch item — price and availability (public read, anon client)
    const { data: item, error: itemErr } = await anonClient
      .from('items')
      .select('id, price_per_day, is_available')
      .eq('id', item_id)
      .single();

    if (itemErr || !item) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    if (!item.is_available) {
      return res.status(409).json({ error: 'This item is not currently available for rental.' });
    }

    // Check for overlapping confirmed/pending bookings via SECURITY DEFINER fn
    const { data: hasOverlap, error: overlapErr } = await anonClient.rpc(
      'check_booking_overlap',
      { p_item_id: item_id, p_start_date: start_date, p_end_date: end_date }
    );

    if (overlapErr) return next(overlapErr);
    if (hasOverlap) {
      return res.status(409).json({ error: 'This item is already booked for the selected dates. Please choose different dates.' });
    }

    // Calculate total price server-side (never trust the client's figure)
    const days        = Math.ceil((end - start) / 86_400_000);
    const total_price = Math.round(days * Number(item.price_per_day) * 100) / 100;

    // Insert using the user's scoped client so RLS insert policy fires
    const sb = getUserClient(req.accessToken);
    const { data: booking, error: insertErr } = await sb
      .from('bookings')
      .insert({
        user_id: req.userId,
        item_id,
        start_date,
        end_date,
        total_price,
        status: 'pending',
      })
      .select('id, start_date, end_date, total_price, status')
      .single();

    if (insertErr) return next(insertErr);

    return res.status(201).json({ message: 'Booking created successfully.', booking });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/bookings/mine ────────────────────────────────────────────────────

async function getMyBookings(req, res, next) {
  try {
    const sb = getUserClient(req.accessToken);

    const { data, error } = await sb
      .from('bookings')
      .select(`
        id, start_date, end_date, total_price, status, created_at,
        items ( id, item_name, brand, size, category, image_url )
      `)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) return next(error);

    return res.json({ bookings: data || [] });
  } catch (err) {
    next(err);
  }
}

module.exports = { createBooking, getMyBookings };
