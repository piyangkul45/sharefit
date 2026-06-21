'use strict';
const express = require('express');
const router  = express.Router();
const { authLimiter, signupLimiter } = require('../middleware/security');
const { requireAuth }                = require('../middleware/auth');
const { signup, login, refresh, logout, getMe } = require('../controllers/authController');

router.post('/signup',  signupLimiter, signup);
router.post('/login',   authLimiter,   login);
router.post('/refresh',                refresh);
router.post('/logout',                 logout);
router.get('/me',       requireAuth,   getMe);

module.exports = router;
