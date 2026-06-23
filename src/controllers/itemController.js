'use strict';
const { createClient } = require('@supabase/supabase-js');

const ALLOWED_CATEGORIES  = ['tops','bottoms','dresses','outerwear','activewear','accessories','footwear','other'];
const ALLOWED_STYLES      = ['casual','formal','streetwear','bohemian','vintage','sporty','minimalist','party'];
const ALLOWED_SIZES       = ['XS','S','M','L','XL','XXL','ONE'];
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
    const { item_name, brand, size, category, style, price_per_day } = req.body;

    const missing = [];
    if (!item_name?.trim()) missing.push('item_name');
    if (!size)              missing.push('size');
    if (!category)          missing.push('category');
    if (!style)             missing.push('style');
    if (!price_per_day)     missing.push('price_per_day');

    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}.` });
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

    const price = parseFloat(price_per_day);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number.' });
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
        price_per_day: price,
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
      .select('id, item_name, brand, size, category, style, price_per_day, image_url, is_available, created_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) return next(error);

    return res.json({ items: data || [] });
  } catch (err) {
    next(err);
  }
}

module.exports = { createItem, getMyItems };
