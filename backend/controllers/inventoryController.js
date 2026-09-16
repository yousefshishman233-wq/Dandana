const { db } = require('../config/db');

// @route   GET /api/inventory/products
// @desc    Get all products (sales)
// @access  Private
exports.getProducts = (req, res) => {
  db.all('SELECT * FROM products ORDER BY name', [], (err, products) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    res.json({ success: true, products });
  });
};

// @route   POST /api/inventory/products
// @desc    Add a new product
// @access  Private (Manager)
exports.addProduct = (req, res) => {
  const { name, price, stock, unit } = req.body;
  db.run(
    'INSERT INTO products (name, price, stock, unit) VALUES (?, ?, ?, ?)',
    [name, price, stock || 0, unit || 'piece'],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Failed to add product' });
      res.status(201).json({
        success: true,
        message: 'Product added successfully',
        product: { id: this.lastID, name, price, stock: stock || 0, unit: unit || 'piece' }
      });
    }
  );
};

// @route   PUT /api/inventory/products/:id
// @desc    Update a product
// @access  Private (Manager)
exports.updateProduct = (req, res) => {
  const { id } = req.params;
  const { name, price, stock, unit } = req.body;
  db.run(
    'UPDATE products SET name = ?, price = ?, stock = ?, unit = ? WHERE id = ?',
    [name, price, stock, unit, id],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Failed to update product' });
      res.json({ success: true, message: 'Product updated successfully' });
    }
  );
};

// @route   DELETE /api/inventory/products/:id
// @desc    Delete a product
// @access  Private (Manager)
exports.deleteProduct = (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Failed to delete product' });
    res.json({ success: true, message: 'Product deleted successfully' });
  });
};

// @route   GET /api/inventory/orders
// @desc    Get all POS orders
// @access  Private
exports.getOrders = (req, res) => {
  db.all(
    `SELECT o.*, u.full_name as cashier_name FROM orders o 
     JOIN users u ON o.cashier_id = u.id 
     ORDER BY o.created_at DESC`,
    [],
    (err, orders) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      res.json({ success: true, orders });
    }
  );
};

// @route   GET /api/inventory/orders/:id
// @desc    Get single order with items
// @access  Private
exports.getOrderById = (req, res) => {
  const { id } = req.params;
  db.get(
    `SELECT o.*, u.full_name as cashier_name FROM orders o 
     JOIN users u ON o.cashier_id = u.id WHERE o.id = ?`,
    [id],
    (err, order) => {
      if (err || !order) return res.status(404).json({ success: false, message: 'Order not found' });

      db.all(
        `SELECT oi.*, p.name as product_name FROM order_items oi 
         JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`,
        [id],
        (err, items) => {
          if (err) return res.status(500).json({ success: false, message: 'Database error' });
          res.json({ success: true, order, items });
        }
      );
    }
  );
};

// @route   POST /api/inventory/orders
// @desc    Create a new order (by cashier)
// @access  Private (Cashier, Manager)
exports.createOrder = (req, res) => {
  const { items, discount = 0 } = req.body;
  const cashierId = req.user.id;

  const productIds = items.map(item => item.product_id);
  const placeholders = productIds.map(() => '?').join(',');

  db.all(
    `SELECT * FROM products WHERE id IN (${placeholders})`,
    productIds,
    (err, products) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });

      let totalAmount = 0;
      items.forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          totalAmount += product.price * item.quantity;
        }
      });

      totalAmount = totalAmount * 0.75;
      const finalTotal = totalAmount - discount;

      db.run(
        'INSERT INTO orders (cashier_id, total_amount, discount) VALUES (?, ?, ?)',
        [cashierId, finalTotal, discount],
        function(err) {
          if (err) return res.status(500).json({ success: false, message: 'Failed to create order' });
          const orderId = this.lastID;

          items.forEach(item => {
            const product = products.find(p => p.id === item.product_id);
            if (product) {
              db.run(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                [orderId, item.product_id, item.quantity, product.price]
              );
              db.run(
                'UPDATE products SET stock = stock - ? WHERE id = ?',
                [item.quantity, item.product_id]
              );
            }
          });

          res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: { id: orderId, cashier_id: cashierId, total_amount: finalTotal, discount }
          });
        }
      );
    }
  );
};

// ─── NEW: INVENTORY AUDIT (جرد المحل) & FACTORY ORDERS (طلبية المصنع) ───

// @route   GET /api/inventory/audit-items
// @desc    Get all inventory items (ice cream & supplies) for audit
// @access  Private
exports.getAuditItems = (req, res) => {
  db.all('SELECT * FROM inventory_items ORDER BY category DESC, name ASC', [], (err, items) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    res.json({ success: true, items });
  });
};

// @route   POST /api/inventory/audit-items
// @desc    Add a new inventory item permanently
// @access  Private
exports.addAuditItem = (req, res) => {
  const { name, category, unit } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'يرجى كتابة اسم الصنف' });
  }

  const cat = category || 'ice_cream';
  const u = unit && unit.trim() ? unit.trim() : (cat === 'ice_cream' ? 'جالون' : 'لفة');

  db.run(
    'INSERT INTO inventory_items (name, category, unit, current_stock) VALUES (?, ?, ?, 0)',
    [name.trim(), cat, u],
    function(err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE')) {
          return res.status(400).json({ success: false, message: 'هذا الصنف موجود بالفعل في الجرد' });
        }
        return res.status(500).json({ success: false, message: 'فشل إضافة الصنف: ' + err.message });
      }

      res.status(201).json({
        success: true,
        message: 'تمت إضافة الصنف بنجاح وبشكل دائم',
        item: {
          id: this.lastID,
          name: name.trim(),
          category: cat,
          unit: u,
          current_stock: 0
        }
      });
    }
  );
};

// @route   POST /api/inventory/audits
// @desc    Save a shop inventory audit by employee
// @access  Private
exports.saveInventoryAudit = (req, res) => {
  const { items } = req.body; // array of { name, category, counted_qty, unit }
  const userId = req.user.id;
  const branchId = req.user.branch_id || null;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'لم يتم إدخال أصناف للجرد' });
  }

  db.run(
    'INSERT INTO inventory_audits (user_id, branch_id) VALUES (?, ?)',
    [userId, branchId],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'فشل تسجيل الجرد: ' + err.message });
      const auditId = this.lastID;

      items.forEach(item => {
        const qty = Number(item.counted_qty) || 0;
        // Insert item audit record
        db.run(
          'INSERT INTO inventory_audit_items (audit_id, item_name, category, counted_qty, unit) VALUES (?, ?, ?, ?, ?)',
          [auditId, item.name, item.category, qty, item.unit]
        );

        // Update current stock level in inventory_items
        db.run(
          'UPDATE inventory_items SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?',
          [qty, item.name]
        );
      });

      res.status(201).json({
        success: true,
        message: 'تم تسجيل جرد المحل بنجاح وتحديث كميات الأصناف الحالية',
        audit_id: auditId
      });
    }
  );
};

// @route   GET /api/inventory/audits
// @desc    Get inventory audits history
// @access  Private
exports.getInventoryAudits = (req, res) => {
  db.all(
    `SELECT ia.*, u.full_name as user_name, u.role as user_role, b.name as branch_name
     FROM inventory_audits ia
     JOIN users u ON ia.user_id = u.id
     LEFT JOIN branches b ON ia.branch_id = b.id
     ORDER BY ia.created_at DESC`,
    [],
    (err, audits) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      res.json({ success: true, audits });
    }
  );
};

// @route   POST /api/inventory/factory-orders
// @desc    Create a factory supply order (طلبية المصنع) linked to current shop stock & target recipient
// @access  Private
exports.createFactoryOrder = (req, res) => {
  const { items, note, recipient, branch_id } = req.body; // array of { item_name, available_stock, requested_qty, unit }
  const userId = req.user.id;
  const branchId = branch_id || req.user.branch_id || null;
  const targetRecipient = recipient || 'driver';

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'لم يتم تحديد أصناف للطلبية' });
  }

  db.run(
    'INSERT INTO factory_orders (user_id, branch_id, recipient, note, status) VALUES (?, ?, ?, ?, ?)',
    [userId, branchId, targetRecipient, note || '', 'pending'],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'فشل إرسال طلبية المصنع: ' + err.message });
      const orderId = this.lastID;

      items.forEach(item => {
        db.run(
          'INSERT INTO factory_order_items (order_id, item_name, available_stock, requested_qty, unit) VALUES (?, ?, ?, ?, ?)',
          [orderId, item.item_name, item.available_stock || 0, Number(item.requested_qty) || 0, item.unit || 'جالون']
        );
      });

      res.status(201).json({
        success: true,
        message: `تم إرسال طلبية المصنع بنجاح 🚀 وموجهة إلى: ${targetRecipient === 'driver' ? 'السائق' : 'المدير'}`,
        order_id: orderId
      });
    }
  );
};

// @route   GET /api/inventory/factory-orders
// @desc    Get factory supply orders history
// @access  Private
exports.getFactoryOrders = (req, res) => {
  const { recipient } = req.query;
  let query = `
    SELECT fo.*, u.full_name as user_name, u.role as user_role, b.name as branch_name
    FROM factory_orders fo
    JOIN users u ON fo.user_id = u.id
    LEFT JOIN branches b ON fo.branch_id = b.id
  `;
  const params = [];

  if (recipient) {
    query += ` WHERE fo.recipient = ?`;
    params.push(recipient);
  } else if (req.user.role === 'driver') {
    query += ` WHERE (fo.recipient = 'driver' OR fo.recipient IS NULL)`;
  }

  query += ` ORDER BY fo.created_at DESC`;

  db.all(query, params, (err, orders) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error: ' + err.message });

    const orderIds = orders.map(o => o.id);
    if (orderIds.length === 0) return res.json({ success: true, orders: [] });

    const placeholders = orderIds.map(() => '?').join(',');
    db.all(
      `SELECT * FROM factory_order_items WHERE order_id IN (${placeholders})`,
      orderIds,
      (err, allItems) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });

        const ordersWithItems = orders.map(o => ({
          ...o,
          items: allItems.filter(i => i.order_id === o.id)
        }));

        res.json({ success: true, orders: ordersWithItems });
      }
    );
  });
};

// @route   PUT /api/inventory/factory-orders/:id/status
// @desc    Update factory order status ('approved' | 'rejected' | 'delivered')
// @access  Private (Manager)
exports.updateFactoryOrderStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'approved', 'rejected', 'delivered'].includes(status)) {
    return res.status(400).json({ success: false, message: 'حالة غير صالحة' });
  }

  db.run(
    'UPDATE factory_orders SET status = ? WHERE id = ?',
    [status, id],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      res.json({ success: true, message: 'تم تحديث حالة طلبية المصنع بنجاح' });
    }
  );
};