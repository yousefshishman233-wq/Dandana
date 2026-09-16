const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { db, initializeDB } = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize database
initializeDB();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Socket.IO setup for real-time chat
const io = socketIo(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST']
  }
});

// Store io instance in app for use in controllers
app.set('io', io);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join chat room
  socket.on('joinChat', () => {
    socket.join('global_chat');
  });

  // Handle new message
  socket.on('sendMessage', (messageData) => {
    // Save to database
    const { sender_id, message, media_url, media_type, type } = messageData;
    const finalMediaType = media_type || 'text';
    const finalType = type || 'text';
    const finalMessage = message || (finalMediaType === 'audio' ? '🎤 رسالة صوتية' : '');
    const created_at = new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.run(
      'INSERT INTO messages (sender_id, message, media_url, media_type, type) VALUES (?, ?, ?, ?, ?)',
      [sender_id, finalMessage, media_url || null, finalMediaType, finalType],
      function(err) {
        if (err) {
          console.error('Error saving socket message:', err);
        }

        const msgId = this ? this.lastID : null;

        // Broadcast to all connected clients
        io.emit('newMessage', {
          id: msgId,
          sender_id,
          message: finalMessage,
          media_url: media_url || null,
          media_type: finalMediaType,
          type: finalType,
          created_at,
          full_name: messageData.full_name,
          role: messageData.role
        });
      }
    );
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Seed default manager account
const seedDefaultManager = () => {
  const defaultUsername = 'admin';
  const defaultPassword = 'admin123';

  db.get('SELECT id FROM users WHERE username = ?', [defaultUsername], async (err, user) => {
    if (err) {
      console.error('Seed error:', err);
      return;
    }

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(defaultPassword, salt);

      db.run(
        'INSERT INTO users (username, password, full_name, role, salary) VALUES (?, ?, ?, ?, ?)',
        [defaultUsername, hashedPassword, 'المدير', 'manager', 0],
        (err) => {
          if (err) {
            console.error('Failed to seed manager:', err);
          } else {
            console.log('Default manager account created: admin / admin123');
          }
        }
      );
    }
  });

  // Seed default products
  const defaultProducts = [
    { name: 'بوله واحدة', price: 20, stock: 0, unit: 'piece' },
    { name: 'بوله اتنين', price: 35, stock: 0, unit: 'piece' },
    { name: 'بوله تلاتة', price: 60, stock: 0, unit: 'piece' },
    { name: 'بوله أربعة', price: 75, stock: 0, unit: 'piece' },
    { name: 'نص كيلو', price: 110, stock: 0, unit: 'kg' },
    { name: 'بسكوته فاضية', price: 3, stock: 0, unit: 'piece' }
  ];

  defaultProducts.forEach(product => {
    db.get('SELECT id FROM products WHERE name = ?', [product.name], (err, existing) => {
      if (!existing) {
        db.run(
          'INSERT INTO products (name, price, stock, unit) VALUES (?, ?, ?, ?)',
          [product.name, product.price, product.stock, product.unit],
          (err) => {
            if (err) {
              console.error('Failed to seed product:', product.name, err);
            }
          }
        );
      }
    });
  });
};

// Run seed after database is initialized
setTimeout(seedDefaultManager, 1000);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/hr', require('./routes/hrRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/calendar', require('./routes/calendarRoutes'));
app.use('/api/expenses', require('./routes/expensesRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'دندنه server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Server error'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`دندنه backend server running on port ${PORT}`);
});

module.exports = { app, server, io };