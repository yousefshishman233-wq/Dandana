const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const chatController = require('../controllers/chatController');

// Private routes
router.get('/messages', auth, chatController.getMessages);
router.post('/messages', auth, chatController.sendMessage);
router.post('/messages/:id/reactions', auth, chatController.toggleReaction);
router.delete('/messages/:id', auth, chatController.deleteMessage);

module.exports = router;