const { db } = require('../config/db');

// @route   GET /api/calendar/leaves
// @desc    Get leave requests — manager sees all, employee sees own
// @access  Private
exports.getLeaves = (req, res) => {
  const { user_id } = req.query;
  db.get('SELECT can_manage_leaves FROM users WHERE id = ?', [req.user.id], (permissionErr, currentUser) => {
  if (permissionErr) return res.status(500).json({ success: false, message: 'Database error' });
  const isManagerOrDelegated = req.user.role === 'manager' || currentUser?.can_manage_leaves === 1;

  let query = `
    SELECT l.*, u.full_name, u.role,
           b.name as branch_name
    FROM leaves l
    JOIN users u ON l.user_id = u.id
    LEFT JOIN branches b ON u.branch_id = b.id
  `;
  const params = [];

  if (!isManagerOrDelegated) {
    // Employee/cashier see only their own
    query += ` WHERE l.user_id = ?`;
    params.push(req.user.id);
  } else if (user_id) {
    query += ` WHERE l.user_id = ?`;
    params.push(user_id);
  }

  query += ` ORDER BY l.created_at DESC`;

  db.all(query, params, (err, leaves) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    res.json({ success: true, leaves });
  });
  });
};

// @route   POST /api/calendar/leaves
// @desc    Request leave
// @access  Private
exports.requestLeave = (req, res) => {
  // Accept both 'type' and 'leave_type' from frontend
  const leave_type = req.body.leave_type || req.body.type || 'leave';
  const start_date = req.body.start_date;
  const end_date   = req.body.end_date || start_date;
  const reason     = req.body.reason || '';
  const userId     = req.user.id;

  if (!start_date) {
    return res.status(400).json({ success: false, message: 'start_date مطلوب' });
  }

  db.run(
    'INSERT INTO leaves (user_id, leave_type, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)',
    [userId, leave_type, start_date, end_date, reason],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'فشل تسجيل الطلب: ' + err.message });
      res.status(201).json({
        success: true,
        message: 'تم إرسال الطلب بنجاح',
        leave: { id: this.lastID, user_id: userId, leave_type, start_date, end_date, reason, status: 'pending' }
      });
    }
  );
};

// @route   PUT /api/calendar/leaves/:id/approve
// @desc    Approve or reject a leave request
// @access  Private (Manager)
exports.updateLeaveStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'الحالة يجب أن تكون approved أو rejected' });
  }

  db.run(
    'UPDATE leaves SET status = ? WHERE id = ?',
    [status, id],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ success: false, message: 'الطلب مش موجود' });
      res.json({ success: true, message: status === 'approved' ? 'تم قبول الطلب' : 'تم رفض الطلب' });
    }
  );
};

// @route   GET /api/calendar/events
// @access  Private
exports.getCalendarEvents = (req, res) => {
  const { year, month } = req.query;
  const isManager = req.user.role === 'manager';

  let query = `SELECT l.*, u.full_name FROM leaves l JOIN users u ON l.user_id = u.id`;
  const params = [];
  const conditions = [];

  if (!isManager) {
    conditions.push(`l.user_id = ?`);
    params.push(req.user.id);
  }
  if (year)  { conditions.push(`strftime('%Y', l.start_date) = ?`); params.push(year); }
  if (month) { conditions.push(`strftime('%m', l.start_date) = ?`); params.push(month.padStart(2, '0')); }

  if (conditions.length) query += ` WHERE ` + conditions.join(' AND ');
  query += ` ORDER BY l.start_date`;

  db.all(query, params, (err, events) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    res.json({ success: true, events });
  });
};

// @route   GET /api/calendar/annual-summary
// @access  Private (Manager)
exports.getAnnualSummary = (req, res) => {
  const currentYear = req.query.year || new Date().getFullYear().toString();
  db.all(
    `SELECT u.id, u.full_name, u.role,
     COUNT(l.id) as total_requests,
     SUM(CASE WHEN l.status='approved' THEN 1 ELSE 0 END) as approved_leaves,
     SUM(CASE WHEN l.status='pending'  THEN 1 ELSE 0 END) as pending_leaves,
     SUM(CASE WHEN l.status='rejected' THEN 1 ELSE 0 END) as rejected_leaves
     FROM users u
     LEFT JOIN leaves l ON u.id = l.user_id AND strftime('%Y', l.start_date) = ?
     GROUP BY u.id ORDER BY u.full_name`,
    [currentYear],
    (err, summary) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      res.json({ success: true, year: currentYear, summary });
    }
  );
};
