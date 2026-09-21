const { db } = require('../config/db');

// @route   GET /api/hr/advances
// @desc    Get all advances with user, branch, and issuer details
// @access  Private
exports.getAdvances = (req, res) => {
  const { userId, month, status, branchId } = req.query;
  const isManager = req.user.role === 'manager';
  const isCashier = req.user.role === 'cashier';

  let query = `
    SELECT a.*, 
           u.full_name as user_name, u.role as user_role, u.branch_id as user_branch_id,
           ub.name as user_branch_name,
           issuer.full_name as issuer_name, issuer.role as issuer_role,
           ib.name as issuer_branch_name
    FROM advances a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN branches ub ON u.branch_id = ub.id
    LEFT JOIN users issuer ON a.issued_by = issuer.id
    LEFT JOIN branches ib ON issuer.branch_id = ib.id
  `;
  const params = [];
  const conditions = [];

  if (userId) {
    if (req.user.role !== 'manager' && req.user.role !== 'cashier' &&
        Number(userId) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: 'غير مصرح بعرض سلف مستخدم آخر' });
    }
    conditions.push(`a.user_id = ?`);
    params.push(userId);
  }
  if (month) {
    conditions.push(`strftime('%Y-%m', a.date) = ?`);
    params.push(month);
  }
  if (status) {
    conditions.push(`(a.status = ? OR (a.status IS NULL AND ? = 'approved'))`);
    params.push(status, status);
  }
  if (branchId) {
    conditions.push(`u.branch_id = ?`);
    params.push(branchId);
  }

  // If Cashier without explicit userId or branch filter: show advances for cashier's branch or all
  if (isCashier && !userId && req.user.branch_id && !branchId) {
    conditions.push(`(u.branch_id = ? OR u.branch_id IS NULL)`);
    params.push(req.user.branch_id);
  } else if (isCashier && userId && req.user.branch_id) {
    conditions.push('(u.branch_id = ? OR a.user_id = ?)');
    params.push(req.user.branch_id, req.user.id);
  } else if (!isManager && !isCashier) {
    conditions.push('a.user_id = ?');
    params.push(req.user.id);
  }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(' AND ');
  }

  query += ` ORDER BY a.date DESC, a.id DESC`;

  db.all(query, params, (err, advances) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error: ' + err.message
      });
    }

    res.json({
      success: true,
      advances
    });
  });
};

// @route   POST /api/hr/advances | /api/hr/advance
// @desc    Request an advance (Employee -> pending, Manager/Cashier -> approved or for employee)
// @access  Private
exports.requestAdvance = (req, res) => {
  const { amount, reason, note, user_id, type } = req.body;
  const isManagerOrCashier = ['manager', 'cashier'].includes(req.user.role);
  const targetUserId = (isManagerOrCashier && user_id) ? user_id : req.user.id;
  const issuedBy = isManagerOrCashier ? req.user.id : null;
  const status = isManagerOrCashier ? 'approved' : 'pending';
  const today = new Date().toISOString().split('T')[0];
  const noteText = note || reason || (isManagerOrCashier ? 'سلفة صُرفت مباشرة' : 'طلب سلفة');
  const advanceType = type || 'advance';

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'مبلغ السلفة غير صالح' });
  }

  db.run(
    'INSERT INTO advances (user_id, amount, reason, date, type, status, issued_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [targetUserId, amount, noteText, today, advanceType, status, issuedBy],
    function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'فشل تسجيل طلب السلفة: ' + err.message
        });
      }

      const msg = isManagerOrCashier
        ? 'تم إضافة الخصم / السلفة بنجاح وتوثيق كاشير/مدير الشيفت الصارف'
        : 'تم إرسال طلب السلفة بنجاح ⏳ بانتظار موافقة وصرف كاشير الشيفت المتاح أو المدير';

      res.status(201).json({
        success: true,
        message: msg,
        advance: {
          id: this.lastID,
          user_id: targetUserId,
          amount,
          note: noteText,
          date: today,
          type: 'advance',
          status,
          issued_by: issuedBy
        }
      });
    }
  );
};

// @route   PUT /api/hr/advances/:id/status
// @desc    Approve or Reject an advance request by Cashier or Manager
// @access  Private (Manager or Cashier)
exports.updateAdvanceStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const isManagerOrCashier = ['manager', 'cashier'].includes(req.user.role);

  if (!isManagerOrCashier) {
    return res.status(403).json({ success: false, message: 'غير مصرح للكاشير والمدير فقط بالموافقة أو الرفض' });
  }

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'الحالة يجب أن تكون approved أو rejected' });
  }

  const issuedBy = req.user.id;

  db.run(
    'UPDATE advances SET status = ?, issued_by = ? WHERE id = ?',
    [status, issuedBy, id],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'خطأ في تصفية طلب السلفة: ' + err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: 'طلب السلفة غير موجود' });
      }

      const msg = status === 'approved'
        ? 'تمت الموافقة وصرف السلفة وتوثيق كاشير الشيفت الصارف بنجاح'
        : 'تم رفض طلب السلفة';

      res.json({
        success: true,
        message: msg
      });
    }
  );
};

// @route   GET /api/hr/advances/:userId
// @desc    Get advances for specific user with optional month & status filter
// @access  Private
exports.getAdvancesByUser = (req, res) => {
  const { userId } = req.params;
  if (req.user.role !== 'manager' && Number(userId) !== Number(req.user.id)) {
    return res.status(403).json({ success: false, message: 'غير مصرح بعرض سلف مستخدم آخر' });
  }
  const { month, status } = req.query;

  let query = `
    SELECT a.*, 
           u.full_name as user_name, u.role as user_role, u.branch_id as user_branch_id,
           ub.name as user_branch_name,
           issuer.full_name as issuer_name, issuer.role as issuer_role,
           ib.name as issuer_branch_name
    FROM advances a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN branches ub ON u.branch_id = ub.id
    LEFT JOIN users issuer ON a.issued_by = issuer.id
    LEFT JOIN branches ib ON issuer.branch_id = ib.id
    WHERE a.user_id = ?
  `;
  const params = [userId];

  if (month) {
    query += ` AND strftime('%Y-%m', a.date) = ?`;
    params.push(month);
  }
  if (status) {
    query += ` AND (a.status = ? OR (a.status IS NULL AND ? = 'approved'))`;
    params.push(status, status);
  }

  query += ` ORDER BY a.date DESC, a.id DESC`;

  db.all(query, params, (err, advances) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    res.json({ success: true, advances });
  });
};

// @route   PUT /api/hr/advances/:id/payback
// @desc    Mark advance as paid back
// @access  Private (Manager)
exports.paybackAdvance = (req, res) => {
  const { id } = req.params;

  db.run(
    'UPDATE advances SET is_paid_back = 1 WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update advance'
        });
      }

      res.json({
        success: true,
        message: 'Advance marked as paid back'
      });
    }
  );
};

// @route   GET /api/hr/salary/:userId
// @desc    Get salary calculation for a user
// @access  Private
exports.getSalaryCalculation = (req, res) => {
  const { userId } = req.params;
  if (req.user.role !== 'manager' && Number(userId) !== Number(req.user.id)) {
    return res.status(403).json({ success: false, message: 'غير مصرح بعرض راتب مستخدم آخر' });
  }
  const monthYear = req.query.monthYear || req.query.month;

  const now = new Date();
  const currentMonthYear = monthYear || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  db.get('SELECT id, full_name, salary FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // 1. Fetch attendance records for the user in the selected month
    db.all(
      `SELECT status, clock_in FROM attendance 
       WHERE user_id = ? AND strftime("%Y-%m", date) = ?`,
      [userId, currentMonthYear],
      (err, attRecords) => {
        let daysWorked = 0;
        let daysAbsent = 0;

        if (attRecords && attRecords.length > 0) {
          attRecords.forEach(rec => {
            if (rec.status === 'absent') {
              daysAbsent++;
            } else if (rec.clock_in || rec.status === 'present' || rec.status === 'late') {
              daysWorked++;
            }
          });
        }

        const baseSalary = user.salary || 0;
        const dailyRate = baseSalary > 0 ? baseSalary / 30 : 0;
        const earnedSalary = Math.round(daysWorked * dailyRate);

        // 2. Fetch approved advances & ice-cream deductions
        db.all(
          `SELECT 
             SUM(CASE WHEN (type = 'ice_cream' OR reason LIKE '%آيس كريم%') AND (status = 'approved' OR status IS NULL) THEN amount ELSE 0 END) as total_ice_cream,
             SUM(CASE WHEN (type = 'advance' OR type IS NULL) AND (reason NOT LIKE '%آيس كريم%' OR reason IS NULL) AND (status = 'approved' OR status IS NULL) THEN amount ELSE 0 END) as total_advances,
             SUM(CASE WHEN status = 'approved' OR status IS NULL THEN amount ELSE 0 END) as total
           FROM advances 
           WHERE user_id = ? AND strftime("%Y-%m", date) = ? AND is_paid_back = 0`,
          [userId, currentMonthYear],
          (err, advancesResult) => {
            const iceCreamDeduction = advancesResult?.[0]?.total_ice_cream || 0;
            const advancesDeduction = advancesResult?.[0]?.total_advances || 0;
            const totalDeductions = advancesResult?.[0]?.total || 0;

            const netBalance = earnedSalary - totalDeductions;
            const isPositive = netBalance >= 0;

            res.json({
              success: true,
              salary: {
                user_id: user.id,
                full_name: user.full_name,
                month_year: currentMonthYear,
                base_salary: baseSalary,
                days_worked: daysWorked,
                days_absent: daysAbsent,
                daily_rate: Math.round(dailyRate),
                earned_salary: earnedSalary,
                total_advances: advancesDeduction,
                ice_cream_deduction: iceCreamDeduction,
                total_deductions: totalDeductions,
                net_balance: netBalance,
                is_positive: isPositive
              }
            });
          }
        );
      }
    );
  });
};

// @route   GET /api/hr/attendance/stats
// @desc    Get attendance statistics
// @access  Private
exports.getAttendanceStats = (req, res) => {
  const monthYear = req.query.monthYear || req.query.month;
  const now = new Date();
  const currentMonthYear = monthYear || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  db.all(
    `SELECT a.*, u.full_name, u.role FROM attendance a 
     JOIN users u ON a.user_id = u.id 
     WHERE strftime("%Y-%m", a.date) = ? 
     ORDER BY u.full_name, a.date`,
    [currentMonthYear],
    (err, records) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      const stats = {};
      records.forEach(record => {
        const key = `${record.user_id}_${record.full_name}`;
        if (!stats[key]) {
          stats[key] = {
            user_id: record.user_id,
            full_name: record.full_name,
            role: record.role,
            total_days: 0,
            present_days: 0,
            absent_days: 0,
            late_days: 0,
            on_leave_days: 0,
            total_hours: 0
          };
        }

        stats[key].total_days++;
        if (record.status === 'present') stats[key].present_days++;
        if (record.status === 'absent') stats[key].absent_days++;
        if (record.status === 'late') stats[key].late_days++;
        if (record.status === 'on_leave') stats[key].on_leave_days++;

        if (record.clock_in && record.clock_out) {
          const [inH, inM] = record.clock_in.split(':').map(Number);
          const [outH, outM] = record.clock_out.split(':').map(Number);
          const hours = (outH - inH) + (outM - inM) / 60;
          stats[key].total_hours += hours;
        }
      });

      res.json({
        success: true,
        stats: Object.values(stats)
      });
    }
  );
};

// @route   GET /api/hr/salaries
// @desc    Get salary summaries for all employees
// @access  Private (Manager)
exports.getAllSalaries = (req, res) => {
  const { month } = req.query;
  const now = new Date();
  const currentMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  db.all('SELECT id, full_name, role, salary FROM users WHERE role != ?', ['manager'], (err, users) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    res.json({ success: true, users, month: currentMonth });
  });
};

// @route   POST /api/hr/ice-cream-order
// @desc    Add ice cream order deduction — Manager or Cashier can specify user_id
// @access  Private
exports.addIceCreamOrder = (req, res) => {
  const { user_id, items } = req.body;
  const isManagerOrCashier = ['manager', 'cashier'].includes(req.user.role);
  const targetUserId = (isManagerOrCashier && user_id) ? user_id : req.user.id;
  const issuedBy = req.user.id;
  const status = 'approved';
  const today = new Date().toISOString().split('T')[0];

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'لم يتم تحديد أصناف' });
  }

  const totalOriginal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const totalAfterDiscount = totalOriginal * 0.75;
  const note = `آيس كريم: ${items.map(i => `${i.name}×${i.qty}`).join('، ')} (خصم 25%)`;

  db.run(
    'INSERT INTO advances (user_id, amount, reason, date, type, status, issued_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [targetUserId, totalAfterDiscount, note, today, 'ice_cream', status, issuedBy],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'فشل تسجيل الطلب: ' + err.message });
      res.status(201).json({
        success: true,
        message: 'تم تسجيل طلب الآيس كريم بنجاح وتوثيق مسؤول الصرف',
        order: { id: this.lastID, user_id: targetUserId, total: totalAfterDiscount, note, type: 'ice_cream', status, issued_by: issuedBy }
      });
    }
  );
};

// @route   GET /api/hr/ice-cream-orders/:userId
// @desc    Get ice cream orders for user
// @access  Private
exports.getIceCreamOrders = (req, res) => {
  const { userId } = req.params;
  if (req.user.role !== 'manager' && Number(userId) !== Number(req.user.id)) {
    return res.status(403).json({ success: false, message: 'غير مصرح بعرض طلبات مستخدم آخر' });
  }
  const { month } = req.query;

  let query = `
    SELECT a.*, 
           u.full_name as user_name, u.role as user_role, u.branch_id as user_branch_id,
           ub.name as user_branch_name,
           issuer.full_name as issuer_name, issuer.role as issuer_role,
           ib.name as issuer_branch_name
    FROM advances a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN branches ub ON u.branch_id = ub.id
    LEFT JOIN users issuer ON a.issued_by = issuer.id
    LEFT JOIN branches ib ON issuer.branch_id = ib.id
    WHERE a.user_id = ? AND (a.type = 'ice_cream' OR a.reason LIKE '%آيس كريم%')
  `;
  const params = [userId];

  if (month) {
    query += ` AND strftime('%Y-%m', a.date) = ?`;
    params.push(month);
  }

  query += ' ORDER BY a.date DESC, a.id DESC';

  db.all(query, params, (err, orders) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    res.json({ success: true, orders });
  });
};

// @route   POST /api/hr/adjust-advances
// @desc    Manager adjusts or waives advance deduction
// @access  Private (Manager)
exports.adjustAdvances = (req, res) => {
  const { user_id, amount, reason } = req.body;
  if (!user_id || amount === undefined || isNaN(amount)) {
    return res.status(400).json({ success: false, message: 'بيانات غير مكتملة' });
  }

  const today = new Date().toISOString().split('T')[0];
  const note = reason || 'تعديل/إسقاط رصيد سلف من قبل المدير';
  // If amount is negative, it reduces total advance balance
  db.run(
    'INSERT INTO advances (user_id, amount, reason, date, type, status, issued_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user_id, Number(amount), note, today, 'advance', 'approved', req.user.id],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
      res.json({
        success: true,
        message: Number(amount) < 0 ? 'تم إسقاط/تخفيض السلفة بنجاح' : 'تم إضافة تعديل السلفة بنجاح'
      });
    }
  );
};

// @route   POST /api/hr/adjust-ice-cream
// @desc    Manager adjusts or waives ice cream deduction
// @access  Private (Manager)
exports.adjustIceCream = (req, res) => {
  const { user_id, amount, reason } = req.body;
  if (!user_id || amount === undefined || isNaN(amount)) {
    return res.status(400).json({ success: false, message: 'بيانات غير مكتملة' });
  }

  const today = new Date().toISOString().split('T')[0];
  const note = reason || 'تعديل/إسقاط مسحوبات آيس كريم من قبل المدير';
  db.run(
    'INSERT INTO advances (user_id, amount, reason, date, type, status, issued_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user_id, Number(amount), note, today, 'ice_cream', 'approved', req.user.id],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
      res.json({
        success: true,
        message: Number(amount) < 0 ? 'تم إسقاط/تخفيض مسحوبات الآيس كريم بنجاح' : 'تم إضافة تعديل الآيس كريم بنجاح'
      });
    }
  );
};

// @route   GET /api/hr/salary-summary
// @desc    Get comprehensive salary summary for all employees for a specific month
// @access  Private (Manager & Cashier for their own branch)
exports.getSalarySummary = (req, res) => {
  const { month } = req.query; // YYYY-MM
  if (!month) {
    return res.status(400).json({ success: false, message: 'يرجى تحديد الشهر (YYYY-MM)' });
  }

  const isCashier = req.user.role === 'cashier';
  const cashierBranchId = req.user.branch_id;

  let branchFilter = '';
  const params = [month, month, month];

  if (isCashier && cashierBranchId) {
    branchFilter = ' AND u.branch_id = ?';
    params.push(cashierBranchId);
  }

  const query = `
    SELECT 
      u.id as user_id,
      u.full_name as user_name,
      u.role as user_role,
      u.branch_id as user_branch_id,
      b.name as branch_name,
      u.salary as base_salary,
      COALESCE(att.days_worked, 0) as days_worked,
      COALESCE(adv.total_advances, 0) as total_advances,
      COALESCE(adv.total_ice_cream, 0) as total_ice_cream,
      COALESCE(cd.amount, 0) as carried_debt
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    LEFT JOIN (
      SELECT user_id, COUNT(DISTINCT date) as days_worked
      FROM attendance
      WHERE strftime('%Y-%m', date) = ? AND (status = 'present' OR status = 'late' OR clock_in IS NOT NULL)
      GROUP BY user_id
    ) att ON u.id = att.user_id
    LEFT JOIN (
      SELECT 
        user_id,
        SUM(CASE WHEN (type = 'advance' OR type IS NULL) AND (reason NOT LIKE '%آيس كريم%' OR reason IS NULL) THEN amount ELSE 0 END) as total_advances,
        SUM(CASE WHEN (type = 'ice_cream' OR reason LIKE '%آيس كريم%') THEN amount ELSE 0 END) as total_ice_cream
      FROM advances
      WHERE strftime('%Y-%m', date) = ? AND (status = 'approved' OR status IS NULL)
      GROUP BY user_id
    ) adv ON u.id = adv.user_id
    LEFT JOIN (
      SELECT user_id, SUM(amount) as amount
      FROM carried_debts
      WHERE to_month = ? AND is_cleared = 0
      GROUP BY user_id
    ) cd ON u.id = cd.user_id
    WHERE u.role != 'manager' ${branchFilter}
    ORDER BY u.role, u.full_name
  `;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error: ' + err.message });

    const summary = rows.map(row => {
      const baseSalary = row.base_salary || 0;
      const daysWorked = row.days_worked || 0;
      const calculatedSalary = (baseSalary / 30) * daysWorked;
      const carriedDebt = row.carried_debt || 0;
      const netSalary = calculatedSalary - row.total_advances - row.total_ice_cream - carriedDebt;
      return {
        ...row,
        calculated_salary: Math.round(calculatedSalary),
        total_advances: row.total_advances,
        total_ice_cream: row.total_ice_cream,
        carried_debt: carriedDebt,
        net_salary: Math.round(netSalary)
      };
    });

    res.json({ success: true, month, summary });
  });
};