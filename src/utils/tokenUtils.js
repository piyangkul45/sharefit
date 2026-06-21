'use strict';
const IS_PROD       = process.env.NODE_ENV === 'production';
const REFRESH_TTL_S = 7 * 24 * 60 * 60; // 7 days

function setAuthCookies(res, accessToken, refreshToken, expiresIn) {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'strict',
    maxAge:   (expiresIn || 3600) * 1000,
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'strict',
    maxAge:   REFRESH_TTL_S * 1000,
    path:     '/api/auth/refresh',
  });
}

function clearAuthCookies(res) {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
}

module.exports = { setAuthCookies, clearAuthCookies };
