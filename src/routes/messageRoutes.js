'use strict';
const express = require('express');
const router  = express.Router();
const { requireAuth }                                  = require('../middleware/auth');
const { sendMessage, getConversation, getConversations } = require('../controllers/messageController');

router.post('/',                        requireAuth, sendMessage);
router.get('/conversations',            requireAuth, getConversations);
router.get('/conversation/:partnerId',  requireAuth, getConversation);

module.exports = router;
