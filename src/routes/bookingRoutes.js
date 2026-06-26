'use strict';
const express = require('express');
const router  = express.Router();
const { requireAuth }                    = require('../middleware/auth');
const { createBooking, getMyBookings }   = require('../controllers/bookingController');

router.post('/',     requireAuth, createBooking);
router.get('/mine',  requireAuth, getMyBookings);

module.exports = router;
