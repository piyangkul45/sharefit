'use strict';
const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const { requireAuth }                       = require('../middleware/auth');
const { createItem, getMyItems, getAllItems } = require('../controllers/itemController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
});

function handleUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'Image must be under 5 MB.'
      : err.message;
    return res.status(400).json({ error: msg });
  });
}

router.get('/',      getAllItems);
router.post('/',     requireAuth, handleUpload, createItem);
router.get('/mine',  requireAuth, getMyItems);

module.exports = router;
