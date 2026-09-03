'use strict';
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getItemRanges, createRental, getMyRentals } = require('../controllers/rentalController');

router.get('/item/:itemId', getItemRanges);            // public — booked date ranges
router.post('/',            requireAuth, createRental); // create a booking
router.get('/mine',         requireAuth, getMyRentals); // renter's own bookings

module.exports = router;
