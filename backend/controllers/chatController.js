const { db } = require('../config/db');

const ALLOWED_REACTIONS = new Set(['👍', '❤️', '😂', '😮', '😢', '🙏']);

// @route   GET /api/chat/messages
// @desc    Get all messages (group chat)
// @access  Private
exports.getMessages = (req, res) => {
  db.all(
    `SELECT m.id, m.sender_id, m.message, m.type, m.media_url, m.media_type,
            m.created_at, m.deleted_for_everyone_at, u.full_name, u.role, u.branch_id
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     LEFT JOIN message_hidden h ON h.message_id = m.id AND h.user_id = ?
     WHERE h.message_id IS NULL
     ORDER BY m.created_at ASC`,
    [req.user.id],
    (err, messages) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Database error: ' + err.message
        });
      }

      if (messages.length === 0) return res.json({ success: true, messages });

      const ids = messages.map(message => message.id);
      db.all(
        `SELECT r.message_id, r.reaction, COUNT(*) AS count,
                SUM(CASE WHEN r.user_id = ? THEN 1 ELSE 0 END) AS reacted
         FROM message_reactions r
         WHERE r.message_id IN (${ids.map(() => '?').join(',')})
         GROUP BY r.message_id, r.reaction`,
        [req.user.id, ...ids],
        (reactionErr, reactions) => {
          if (reactionErr) {
            return res.status(500).json({
              success: false,
              message: 'Database error: ' + reactionErr.message
            });
          }

          const grouped = new Map();
          reactions.forEach(row => {
            if (!grouped.has(row.message_id)) grouped.set(row.message_id, []);
            grouped.get(row.message_id).push({
              reaction: row.reaction,
              count: Number(row.count),
              reacted: Number(row.reacted) > 0
            });
          });

          res.json({
            success: true,
            messages: messages.map(message => ({
              ...message,
              deleted_for_everyone: Boolean(message.deleted_for_everyone_at),
              message: message.deleted_for_everyone_at ? 'تم حذف هذه الرسالة' : message.message,
              media_url: message.deleted_for_everyone_at ? null : message.media_url,
              media_type: message.deleted_for_everyone_at ? 'text' : message.media_type,
              reactions: grouped.get(message.id) || []
            }))
          });
        }
      );
    }
  );
};

// @route   POST /api/chat/messages
// @desc    Send a message (text, voice note, photo, video, mentions)
// @access  Private
exports.sendMessage = (req, res) => {
  const { message, media_url, media_type, type } = req.body;
  const senderId = req.user.id;
  const finalType = media_type || 'text';
  const finalMessage = message || '';
  const messageType = ['text', 'leave', 'late', 'absence'].includes(type) ? type : 'text';

  if (!finalMessage.trim() && !media_url) {
    return res.status(400).json({
      success: false,
      message: 'لا يمكن إرسال رسالة فارغة'
    });
  }

  db.run(
    'INSERT INTO messages (sender_id, message, type, media_url, media_type) VALUES (?, ?, ?, ?, ?)',
    [senderId, finalMessage, messageType, media_url || null, finalType],
    function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Failed to send message: ' + err.message
        });
      }

      // Get the full message with user info
      db.get(
        `SELECT m.id, m.sender_id, m.message, m.type, m.media_url, m.media_type,
                m.created_at, u.full_name, u.role, u.branch_id
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

const findMessage = (messageId, callback) => {
  db.get('SELECT id, sender_id, deleted_for_everyone_at FROM messages WHERE id = ?', [messageId], callback);
};

const parseMessageId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

exports.toggleReaction = (req, res) => {
  const messageId = parseMessageId(req.params.id);
  const { reaction } = req.body;
  if (!messageId || !ALLOWED_REACTIONS.has(reaction)) {
    return res.status(400).json({ success: false, message: 'Invalid message or reaction' });
  }

  findMessage(messageId, (err, message) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    if (message.deleted_for_everyone_at) {
      return res.status(409).json({ success: false, message: 'Cannot react to a deleted message' });
    }

    db.get(
      'SELECT 1 AS present FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?',
      [messageId, req.user.id, reaction],
      (lookupErr, existing) => {
        if (lookupErr) return res.status(500).json({ success: false, message: 'Database error: ' + lookupErr.message });

        const query = existing
          ? 'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?'
          : 'INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)';
        db.run(query, [messageId, req.user.id, reaction], runErr => {
          if (runErr) return res.status(500).json({ success: false, message: 'Database error: ' + runErr.message });
          res.json({ success: true, active: !existing });
        });
      }
    );
  });
};

exports.deleteMessage = (req, res) => {
  const messageId = parseMessageId(req.params.id);
  const { scope } = req.body;
  if (!messageId || !['self', 'everyone'].includes(scope)) {
    return res.status(400).json({ success: false, message: 'Invalid message or delete scope' });
  }

  findMessage(messageId, (err, message) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

    if (scope === 'everyone') {
      if (Number(message.sender_id) !== Number(req.user.id) && req.user.role !== 'manager') {
        return res.status(403).json({ success: false, message: 'Only the sender or a manager can delete for everyone' });
      }

      db.run(
        `UPDATE messages
         SET message = 'تم حذف هذه الرسالة', media_url = NULL, media_type = 'text',
             deleted_for_everyone_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [messageId],
        runErr => {
          if (runErr) return res.status(500).json({ success: false, message: 'Database error: ' + runErr.message });
          res.json({ success: true, scope });
        }
      );
      return;
    }

    db.run(
      'INSERT OR IGNORE INTO message_hidden (message_id, user_id) VALUES (?, ?)',
      [messageId, req.user.id],
      runErr => {
        if (runErr) return res.status(500).json({ success: false, message: 'Database error: ' + runErr.message });
        res.json({ success: true, scope });
      }
    );
  });
};