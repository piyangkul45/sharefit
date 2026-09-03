'use strict';
const { createClient } = require('@supabase/supabase-js');
const anonClient       = require('../config/db');

const ALLOWED_CATEGORIES  = ['tops','bottoms','dresses','outerwear','activewear','accessories','footwear','other'];
const ALLOWED_STYLES      = ['casual','formal','streetwear','bohemian','vintage','sporty','minimalist','party'];
const ALLOWED_SIZES       = ['XS','S','M','L','XL','XXL','ONE'];
const ALLOWED_LISTING_TYPES = ['rent','sale','both'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg','image/png','image/webp'];

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

// ── POST /api/items ───────────────────────────────────────────────────────────

async function createItem(req, res, next) {
  try {
    const { item_name, brand, size, category, style, price_per_day, sell_price } = req.body;
    const listing_type = req.body.listing_type || 'rent';

    const wantsRent = listing_type === 'rent' || listing_type === 'both';
    const wantsSale = listing_type === 'sale' || listing_type === 'both';

    const missing = [];
    if (!item_name?.trim())            missing.push('item_name');
    if (!size)                         missing.push('size');
    if (!category)                     missing.push('category');
    if (!style)                        missing.push('style');
    if (wantsRent && !price_per_day)   missing.push('price_per_day');
    if (wantsSale && !sell_price)      missing.push('sell_price');

    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}.` });
    }

    if (!ALLOWED_LISTING_TYPES.includes(listing_type)) {
      return res.status(400).json({ error: 'Invalid listing type.' });
    }

    if (!ALLOWED_SIZES.includes(size)) {
      return res.status(400).json({ error: 'Invalid size.' });
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Invalid category.' });
    }

    if (!ALLOWED_STYLES.includes(style)) {
      return res.status(400).json({ error: 'Invalid style.' });
    }

    let price = null;
    if (wantsRent) {
      price = parseFloat(price_per_day);
      if (isNaN(price) || price <= 0) {
        return res.status(400).json({ error: 'Price must be a positive number.' });
      }
    }

    let salePrice = null;
    if (wantsSale) {
      salePrice = parseFloat(sell_price);
      if (isNaN(salePrice) || salePrice <= 0) {
        return res.status(400).json({ error: 'Sale price must be a positive number.' });
      }
    }

    const sb = getUserClient(req.accessToken);
    let image_url = null;

    if (req.file) {
      if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Image must be JPEG, PNG or WebP.' });
      }

      const ext      = req.file.originalname.split('.').pop().toLowerCase().replace(/jpeg/, 'jpg');
      const filePath = `${req.userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await sb.storage
        .from('item-images')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) return next(uploadError);

      const { data: { publicUrl } } = sb.storage
        .from('item-images')
        .getPublicUrl(filePath);

      image_url = publicUrl;
    }

    const { data, error } = await sb
      .from('items')
      .insert({
        user_id:       req.userId,
        item_name:     item_name.trim().slice(0, 120),
        brand:         brand?.trim().slice(0, 80) || null,
        size,
        category,
        style,
        listing_type,
        price_per_day: price,
        sell_price:    salePrice,
        image_url,
      })
      .select('id')
      .single();

    if (error) return next(error);

    return res.status(201).json({ message: 'Item listed successfully.', item: data });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/items/mine ───────────────────────────────────────────────────────

async function getMyItems(req, res, next) {
  try {
    const sb = getUserClient(req.accessToken);

    const { data, error } = await sb
      .from('items')
      .select('id, item_name, brand, size, category, style, listing_type, price_per_day, sell_price, image_url, is_available, created_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) return next(error);

    return res.json({ items: data || [] });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/items (public) ───────────────────────────────────────────────────

const ALLOWED_SORT_FIELDS = new Set(['created_at', 'price_per_day']);

async function getAllItems(req, res, next) {
  try {
    let query = anonClient
      .from('items')
      .select('id, user_id, item_name, brand, size, category, style, listing_type, price_per_day, sell_price, image_url, created_at')
      .eq('is_available', true);

    if (req.query.category && ALLOWED_CATEGORIES.includes(req.query.category)) {
      query = query.eq('category', req.query.category);
    }
    if (req.query.size && ALLOWED_SIZES.includes(req.query.size)) {
      query = query.eq('size', req.query.size);
    }
    if (req.query.style && ALLOWED_STYLES.includes(req.query.style)) {
      query = query.eq('style', req.query.style);
    }
    // listing_type filter: 'rent' → rentable items, 'sale' → items for purchase
    if (req.query.listing_type === 'rent') {
      query = query.in('listing_type', ['rent', 'both']);
    } else if (req.query.listing_type === 'sale') {
      query = query.in('listing_type', ['sale', 'both']);
    }

    const sortField = ALLOWED_SORT_FIELDS.has(req.query.sort) ? req.query.sort : 'created_at';
    const ascending = req.query.order === 'asc';
    query = query.order(sortField, { ascending });

    const { data, error } = await query;
    if (error) return next(error);

    return res.json({ items: data || [] });
  } catch (err) {
    next(err);
  }
}

module.exports = { createItem, getMyItems, getAllItems };
