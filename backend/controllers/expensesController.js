const { db } = require('../config/db');

// @route   POST /api/expenses
// @desc    Add a shift expense
// @access  Private (Cashier)
exports.addExpense = (req, res) => {
  const { amount, reason } = req.body;
  const cashierId = req.user.id;

  if (!amount || !reason) {
    return res.status(400).json({ success: false, message: 'الرجاء إدخال المبلغ والسبب' });
  }

  db.run(
    'INSERT INTO shift_expenses (cashier_id, amount, reason) VALUES (?, ?, ?)',
    [cashierId, amount, reason],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      res.status(201).json({
        success: true,
        message: 'تم إضافة المصروف بنجاح',
        expense: {
          id: this.lastID,
          cashier_id: cashierId,
          amount,
          reason,
          created_at: new Date().toISOString()
        }
      });
    }
  );
};

// @route   POST /api/expenses/sales
// @desc    Add shift sales (Revenue)
// @access  Private (Cashier)
exports.addSales = (req, res) => {
  const { amount } = req.body;
  const cashierId = req.user.id;

  if (!amount) {
    return res.status(400).json({ success: false, message: 'الرجاء إدخال مبلغ المبيعات' });
  }

  db.run(
    'INSERT INTO shift_sales (cashier_id, amount) VALUES (?, ?)',
    [cashierId, amount],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      res.status(201).json({
        success: true,
        message: 'تم إضافة المبيعات بنجاح',
        sales: {
          id: this.lastID,
          cashier_id: cashierId,
          amount,
          created_at: new Date().toISOString()
        }
      });
    }
  );
};

// @route   GET /api/expenses/summary
// @desc    Get current shift summary (Sales vs Expenses for today for logged in cashier)
// @access  Private (Cashier)
exports.getShiftSummary = (req, res) => {
  const cashierId = req.user.id;
  
  // We'll get today's total manual sales and today's total expenses for this cashier
  const salesQuery = `
    SELECT SUM(amount) as total_sales
    FROM shift_sales 
    WHERE cashier_id = ? AND date(created_at, 'localtime') = date('now', 'localtime')
  `;

  const expensesQuery = `
    SELECT SUM(amount) as total_expenses
    FROM shift_expenses
    WHERE cashier_id = ? AND date(created_at, 'localtime') = date('now', 'localtime')
  `;

  const expensesListQuery = `
    SELECT * FROM shift_expenses
    WHERE cashier_id = ? AND date(created_at, 'localtime') = date('now', 'localtime')
    ORDER BY created_at DESC
  `;

  db.get(salesQuery, [cashierId], (err, salesRow) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    const totalSales = salesRow?.total_sales || 0;

    db.get(expensesQuery, [cashierId], (err, expensesRow) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      const totalExpenses = expensesRow?.total_expenses || 0;

      db.all(expensesListQuery, [cashierId], (err, expensesList) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });

        res.json({
          success: true,
          summary: {
            total_sales: totalSales,
            total_expenses: totalExpenses,
            net_drawer: totalSales - totalExpenses
          },
          expenses: expensesList || []
        });
      });
    });
  });
};
