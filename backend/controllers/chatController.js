const { db } = require('../config/db');

// @route   GET /api/chat/messages
// @desc    Get all messages (group chat)
// @access  Private
exports.getMessages = (req, res) => {
  db.all(
    `SELECT m.id, m.message, m.media_url, m.media_type, m.created_at, u.full_name, u.role, u.branch_id 
     FROM messages m JOIN users u ON m.sender_id = u.id 
     ORDER BY m.created_at ASC`,
    [],
    (err, messages) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Database error: ' + err.message
        });
      }

      res.json({
        success: true,
        messages
      });
    }
  );
};

// @route   POST /api/chat/messages
// @desc    Send a message (text, voice note, photo, video, mentions)
// @access  Private
exports.sendMessage = (req, res) => {
  const { message, media_url, media_type } = req.body;
  const senderId = req.user.id;
  const finalType = media_type || 'text';
  const finalMessage = message || '';

  if (!finalMessage.trim() && !media_url) {
    return res.status(400).json({
      success: false,
      message: 'لا يمكن إرسال رسالة فارغة'
    });
  }

  db.run(
    'INSERT INTO messages (sender_id, message, media_url, media_type) VALUES (?, ?, ?, ?)',
    [senderId, finalMessage, media_url || null, finalType],
    function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Failed to send message: ' + err.message
        });
      }

      // Get the full message with user info
      db.get(
        `SELECT m.id, m.message, m.media_url, m.media_type, m.created_at, u.full_name, u.role, u.branch_id 
         FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`,
        [this.lastID],
        (err, fullMessage) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Message sent but failed to retrieve'
            });
          }

          // Emit via socket.io
          if (req.app.get('io')) {
            req.app.get('io').to('global_chat').emit('newMessage', fullMessage);
          }

          res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: fullMessage
          });
        }
      );
    }
  );
};