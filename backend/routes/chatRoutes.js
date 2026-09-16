const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const chatController = require('../controllers/chatController');

// Private routes
router.get('/messages', auth, chatController.getMessages);
router.post('/messages', auth, chatController.sendMessage);

module.exports = router;