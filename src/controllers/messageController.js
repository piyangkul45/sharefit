'use strict';
const { createClient } = require('@supabase/supabase-js');
const anonClient       = require('../config/db');

const UUID_RE    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LEN    = 1000;

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

async function profilesFor(ids) {
  if (!ids.length) return {};
  const { data } = await anonClient
    .from('profiles')
    .select('id, username')
    .in('id', ids);
  return Object.fromEntries((data || []).map(p => [p.id, p]));
}

// ── POST /api/messages ────────────────────────────────────────────────────────

async function sendMessage(req, res, next) {
  try {
    const sender_id    = req.userId;
    const receiver_id  = String(req.body.receiver_id || '');
    const message_text = String(req.body.message_text || '').trim();

    if (!UUID_RE.test(receiver_id)) {
      return res.status(400).json({ error: 'Invalid receiver_id.' });
    }
    if (receiver_id === sender_id) {
      return res.status(400).json({ error: 'Cannot send a message to yourself.' });
    }
    if (!message_text) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }
    if (message_text.length > MAX_LEN) {
      return res.status(400).json({ error: `Message too long (max ${MAX_LEN} characters).` });
    }

    const sb = getUserClient(req.accessToken);
    const { data, error } = await sb
      .from('messages')
      .insert({ sender_id, receiver_id, message_text })
      .select('id, sender_id, receiver_id, message_text, created_at')
      .single();

    if (error) return next(error);

    return res.status(201).json({ message: data });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/messages/conversation/:partnerId ─────────────────────────────────

async function getConversation(req, res, next) {
  try {
    const userId    = req.userId;
    const partnerId = req.params.partnerId;

    if (!UUID_RE.test(partnerId)) {
      return res.status(400).json({ error: 'Invalid partner ID.' });
    }

    const sb = getUserClient(req.accessToken);

    let query = sb
      .from('messages')
      .select('id, sender_id, receiver_id, message_text, created_at')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),` +
        `and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`
      )
      .order('created_at', { ascending: true })
      .limit(200);

    if (req.query.since) {
      query = query.gt('created_at', req.query.since);
    }

    const { data: messages, error } = await query;
    if (error) return next(error);

    const profileMap = await profilesFor([userId, partnerId]);

    return res.json({
      messages: messages || [],
      partner:  profileMap[partnerId] || { id: partnerId, username: 'Unknown' },
      me:       profileMap[userId]    || { id: userId,    username: 'Me' },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/messages/conversations ──────────────────────────────────────────

async function getConversations(req, res, next) {
  try {
    const userId = req.userId;
    const sb     = getUserClient(req.accessToken);

    const { data: messages, error } = await sb
      .from('messages')
      .select('id, sender_id, receiver_id, message_text, created_at')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return next(error);

    // Collapse into one entry per partner (first in list = most recent)
    const seen    = new Map();
    for (const msg of (messages || [])) {
      const pid = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      if (!seen.has(pid)) seen.set(pid, msg);
    }

    const partnerIds = [...seen.keys()];
    const profileMap = await profilesFor(partnerIds);

    const conversations = partnerIds.map(pid => ({
      partner:     profileMap[pid] || { id: pid, username: 'Unknown' },
      lastMessage: seen.get(pid),
    }));

    return res.json({ conversations });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendMessage, getConversation, getConversations };
