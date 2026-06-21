'use strict';
const supabase = require('../config/db');

async function requireAuth(req, res, next) {
  const token =
    req.cookies?.access_token ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  req.userId = user.id;
  req.user   = user;
  next();
}

module.exports = { requireAuth };
