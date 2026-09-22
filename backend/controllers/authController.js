const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const { getJwtSecret } = require('../middleware/auth');

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role,
      full_name: user.full_name,
      branch_id: user.branch_id || null,
      can_manage_leaves: user.can_manage_leaves ? 1 : 0
    },
    getJwtSecret(),
    { expiresIn: '8h' }
  );
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Private (Manager & Cashier)
exports.register = async (req, res) => {
  let { username, password, full_name, role, salary, branch_id } = req.body;

  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ success: false, message: 'يرجى إدخال اسم الموظف' });
  }

  full_name = full_name.trim();

  // If username is not provided, generate from full_name or random
  let baseUsername = (username && username.trim()) ? username.trim() : full_name.replace(/\s+/g, '_');
  let finalPassword = (password && password.trim()) ? password.trim() : '123456';

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(finalPassword, salt);

    // Find unique username
    db.all('SELECT username FROM users WHERE username LIKE ?', [`${baseUsername}%`], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });

      let uniqueUsername = baseUsername;
      const existing = new Set((rows || []).map(r => r.username));
      if (existing.has(uniqueUsername)) {
        let counter = 2;
        while (existing.has(`${baseUsername}_${counter}`)) {
          counter++;
        }
        uniqueUsername = `${baseUsername}_${counter}`;
      }

      // Insert user
      db.run(
        'INSERT INTO users (username, password, full_name, role, salary, branch_id) VALUES (?, ?, ?, ?, ?, ?)',
        [uniqueUsername, hashedPassword, full_name, role || 'employee', Number(salary) || 0, branch_id ? Number(branch_id) : null],
        function(err) {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'فشل إضافة الموظف: ' + err.message
            });
          }

          res.status(201).json({
            success: true,
            message: 'تم إضافة الموظف بنجاح',
            user: {
              id: this.lastID,
              username: uniqueUsername,
              full_name,
              role: role || 'employee',
              salary: Number(salary) || 0,
              branch_id: branch_id ? Number(branch_id) : null
            }
          });
        }
      );
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
exports.login = async (req, res) => {
  let { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
  }
  if (!getJwtSecret()) {
    console.error('JWT_SECRET is not configured');
    return res.status(500).json({ success: false, message: 'Authentication is not configured' });
  }

  username = username.trim();
  password = password.trim();

  try {
    // Check if user exists by username OR full_name (case insensitive)
    db.get(
      'SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(?) OR LOWER(TRIM(full_name)) = LOWER(?)',
      [username, username],
      async (err, user) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Database error'
          });
        }

        if (!user) {
          return res.status(400).json({
            success: false,
            message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
          });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return res.status(400).json({
            success: false,
            message: 'Invalid credentials'
          });
        }

        // Generate token
        const token = generateToken(user);

        res.json({
          success: true,
          message: 'Login successful',
          token,
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            salary: user.salary
          }
        });
      }
    );
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @route   GET /api/auth/user
// @desc    Get current user
// @access  Private
exports.getCurrentUser = (req, res) => {
  db.get('SELECT id, username, full_name, role, salary, branch_id, can_manage_leaves, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error'
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  });
};

// @route   GET /api/auth/users
// @desc    Get all users with branch info (cashiers only see their branch)
// @access  Private
exports.getAllUsers = (req, res) => {
  let query = `
    SELECT u.id, u.username, u.full_name, u.role, u.salary, u.branch_id, u.can_manage_leaves,
           b.name as branch_name, u.created_at
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
  `;
  const params = [];

  // Cashier only sees staff of their active branch!
  if (req.user.role === 'cashier' && req.user.branch_id && !req.query.all) {
    query += ' WHERE u.branch_id = ?';
    params.push(req.user.branch_id);
  } else if (req.query.branch_id) {
    query += ' WHERE u.branch_id = ?';
    params.push(req.query.branch_id);
  }

  query += ' ORDER BY u.id DESC';

  db.all(query, params, (err, users) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    res.json({ success: true, users });
  });
};

// @route   GET /api/auth/branches
// @desc    Get all branches with shift timing and grace period
// @access  Private
exports.getBranches = (req, res) => {
  db.all('SELECT id, name, COALESCE(shift_start_time, "09:00") as shift_start_time, COALESCE(grace_period_minutes, 15) as grace_period_minutes, created_at FROM branches ORDER BY id', [], (err, branches) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    res.json({ success: true, branches });
  });
};

// @route   PUT /api/auth/user/:id/fingerprint
// @desc    Set fingerprint for user
// @access  Private (Manager)
exports.setFingerprint = (req, res) => {
  const { id } = req.params;
  const { fingerprint } = req.body;

  db.run(
    'UPDATE users SET fingerprint = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [fingerprint, id],
    function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      res.json({
        success: true,
        message: 'Fingerprint updated successfully'
      });
    }
  );
};

// @route   POST /api/auth/attendance/biometric
// @desc    Clock in/out using fingerprint
// @access  Public (for biometric device)
exports.biometricAttendance = (req, res) => {
  const { fingerprint } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toLocaleTimeString('en-US', { timeZone: 'Africa/Cairo' });

  db.get(
    'SELECT id, full_name, role FROM users WHERE fingerprint = ?',
    [fingerprint],
    (err, user) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Fingerprint not registered'
        });
      }

      // Check if already clocked in today
      db.get(
        'SELECT * FROM attendance WHERE user_id = ? AND date = ?',
        [user.id, today],
        (err, record) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Database error'
            });
          }

          if (!record) {
            // Clock in
            db.run(
              'INSERT INTO attendance (user_id, date, clock_in, status) VALUES (?, ?, ?, ?)',
              [user.id, today, now, 'present'],
              function(err) {
                if (err) {
                  return res.status(500).json({
                    success: false,
                    message: 'Failed to clock in'
                  });
                }

                res.json({
                  success: true,
                  message: 'Clocked in successfully',
                  user: {
                    id: user.id,
                    full_name: user.full_name,
                    role: user.role
                  },
                  action: 'clock_in',
                  time: now
                });
              }
            );
          } else if (!record.clock_out) {
            // Clock out
            db.run(
              'UPDATE attendance SET clock_out = ? WHERE id = ?',
              [now, record.id],
              function(err) {
                if (err) {
                  return res.status(500).json({
                    success: false,
                    message: 'Failed to clock out'
                  });
                }

                res.json({
                  success: true,
                  message: 'Clocked out successfully',
                  user: {
                    id: user.id,
                    full_name: user.full_name,
                    role: user.role
                  },
                  action: 'clock_out',
                  time: now
                });
              }
            );
          } else {
            res.json({
              success: false,
              message: 'Already clocked in and out for today'
            });
          }
        }
      );
    }
  );
};

// @route   GET /api/auth/attendance
// @desc    Get attendance records (All users with attendance status and branch info)
// @access  Private
exports.getAttendance = (req, res) => {
  const { date, branch_id } = req.query;
  const today = date || new Date().toISOString().split('T')[0];
  const isCashier = req.user.role === 'cashier';
  const cashierBranchId = branch_id || req.user.branch_id || null;

  let query = `
    SELECT u.id as user_id, u.full_name, u.role, u.branch_id as user_branch_id,
           ub.name as user_branch_name,
           a.id as attendance_id, a.clock_in, a.clock_out, a.branch_id as shift_branch_id,
           ab.name as shift_branch_name,
           CASE 
             WHEN a.clock_in IS NOT NULL THEN COALESCE(a.status, 'present')
             ELSE 'absent'
           END as status,
           a.date
    FROM users u
    LEFT JOIN branches ub ON u.branch_id = ub.id
    LEFT JOIN attendance a ON u.id = a.user_id AND a.date = ?
    LEFT JOIN branches ab ON a.branch_id = ab.id
  `;
  const params = [today];
  const conditions = [];

  // If Cashier is requesting, ONLY show staff currently clocked in or assigned to the cashier's active branch
  if (isCashier && cashierBranchId) {
    conditions.push(`(a.branch_id = ? OR (a.branch_id IS NULL AND u.branch_id = ?))`);
    params.push(cashierBranchId, cashierBranchId);
  }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(' AND ');
  }

  query += ` ORDER BY u.role DESC, u.full_name ASC`;

  db.all(query, params, (err, records) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error: ' + err.message
      });
    }

    res.json({
      success: true,
      attendance: records
    });
  });
};

// @route   POST /api/auth/clock-in
// @desc    Clock in or Send Attendance Request for today with active branch & late detection
// @access  Private
exports.clockIn = (req, res) => {
  const userId = ['manager', 'cashier'].includes(req.user.role) && req.body.user_id
    ? Number(req.body.user_id) : req.user.id;
  const branchId = req.body.branch_id || req.user.branch_id || null;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' });

  // Determine base status: if created by employee himself (and not cashier/manager), status is 'pending'
  const isManagementCaller = ['manager', 'cashier'].includes(req.user.role);
  const baseTargetStatus = isManagementCaller ? 'present' : 'pending';

  const proceedWithClockIn = (finalStatus, isLate, delayMinutes, branchName, empName) => {
    // Update user's branch_id if passed
    if (branchId) {
      db.run('UPDATE users SET branch_id = ? WHERE id = ?', [branchId, userId]);
    }

    // If late, log instant notification for Manager
    if (isLate) {
      db.run(
        'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
        [
          userId,
          '⏰ تنبيه تأخير موظف',
          `الموظف (${empName}) سجل حضوره متأخراً بـ (${delayMinutes} دقيقة) في فرع (${branchName}) الساعة (${now}). تم تسجيل حالته: متأخر.`,
          'late_alert'
        ]
      );
      if (req.app.get('io')) {
        req.app.get('io').emit('lateAlert', {
          user_id: userId,
          user_name: empName,
          branch_name: branchName,
          time: now,
          delay_minutes: delayMinutes
        });
      }
    }

    db.get('SELECT * FROM attendance WHERE user_id = ? AND date = ? AND clock_out IS NULL', [userId, today], (err, record) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });

      if (record) {
        db.run(
          'UPDATE attendance SET clock_in = ?, status = ?, branch_id = COALESCE(?, branch_id) WHERE id = ?',
          [now, finalStatus, branchId, record.id],
          function(err) {
            if (err) return res.status(500).json({ success: false, message: 'Failed to update clock in' });
            let msg = 'تم تسجيل الحضور بالفرع بنجاح';
            if (isLate) msg = `⚠️ تم تسجيل الحضور بحالة (متأخر) بـ ${delayMinutes} دقيقة بعد انتهاء فترة السماح`;
            else if (finalStatus === 'pending') msg = '📩 تم إرسال طلب الحضور بنجاح لكاشير الفرع، بانتظار الموافقة!';
            res.json({ success: true, message: msg, clock_in: now, branch_id: branchId, status: finalStatus, is_late: isLate, delay_minutes: delayMinutes });
          }
        );
      } else {
        db.run(
          'INSERT INTO attendance (user_id, date, clock_in, status, branch_id) VALUES (?, ?, ?, ?, ?)',
          [userId, today, now, finalStatus, branchId],
          function(err) {
            if (err) return res.status(500).json({ success: false, message: 'Failed to clock in' });
            let msg = 'تم تسجيل الحضور بالفرع بنجاح';
            if (isLate) msg = `⚠️ تم تسجيل الحضور بحالة (متأخر) بـ ${delayMinutes} دقيقة بعد انتهاء فترة السماح`;
            else if (finalStatus === 'pending') msg = '📩 تم إرسال طلب الحضور بنجاح لكاشير الفرع، بانتظار الموافقة!';
            res.json({ success: true, message: msg, clock_in: now, branch_id: branchId, status: finalStatus, is_late: isLate, delay_minutes: delayMinutes });
          }
        );
      }
    });
  };

  db.get('SELECT id, role, full_name, username FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    const empName = user?.full_name || user?.username || 'الموظف';

    // Get branch timing info
    db.get('SELECT name, COALESCE(shift_start_time, "09:00") as shift_start_time, COALESCE(grace_period_minutes, 15) as grace_period_minutes FROM branches WHERE id = ?', [branchId], (err, branch) => {
      let isLate = false;
      let delayMinutes = 0;
      const branchName = branch?.name || 'الفرع';

      if (branch) {
        const [curH, curM] = now.split(':').map(Number);
        const [startH, startM] = (branch.shift_start_time || '09:00').split(':').map(Number);
        const curTotalMin = curH * 60 + curM;
        const allowedTotalMin = startH * 60 + startM + Number(branch.grace_period_minutes || 15);

        if (curTotalMin > allowedTotalMin) {
          isLate = true;
          delayMinutes = curTotalMin - (startH * 60 + startM);
        }
      }

      const finalStatus = isLate ? 'late' : baseTargetStatus;

      if (user && user.role === 'cashier' && branchId) {
        db.get(`
          SELECT u.username FROM attendance a
          JOIN users u ON a.user_id = u.id
          WHERE a.branch_id = ? AND a.date = ? AND a.clock_out IS NULL AND a.status = 'present' AND u.role = 'cashier' AND u.id != ?
        `, [branchId, today, userId], (err, row) => {
          if (err) return res.status(500).json({ success: false, message: 'Database error' });
          if (row) {
            return res.status(400).json({ success: false, message: `عذراً، لا يمكن تسجيل الحضور. الكاشير (${row.username}) متواجد حالياً بهذا الفرع.` });
          }
          proceedWithClockIn(finalStatus, isLate, delayMinutes, branchName, empName);
        });
      } else {
        proceedWithClockIn(finalStatus, isLate, delayMinutes, branchName, empName);
      }
    });
  });
};

// @route   PUT /api/auth/attendance/:id/status
// @desc    Approve or Reject employee clock-in request by Cashier or Manager
// @access  Private (Cashier or Manager)
exports.updateAttendanceStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'present' | 'rejected' | 'absent'
  const isManagerOrCashier = ['manager', 'cashier'].includes(req.user.role);

  if (!isManagerOrCashier) {
    return res.status(403).json({ success: false, message: 'مصرح للكاشير والمدير فقط بموافقة أو رفض طلبات الحضور' });
  }

  if (!['present', 'rejected', 'absent', 'late'].includes(status)) {
    return res.status(400).json({ success: false, message: 'حالة حضور غير صالحة' });
  }

  db.run(
    'UPDATE attendance SET status = ? WHERE id = ?',
    [status, id],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
      const msg = status === 'present'
        ? '✅ تم قبول طلب الحضور وتأكيد الموظف بالفرع بنجاح'
        : '❌ تم رفض طلب الحضور';
      res.json({ success: true, message: msg });
    }
  );
};

// @route   POST /api/auth/clock-out
// @desc    Clock out for today
// @access  Private
exports.clockOut = (req, res) => {
  const userId = ['manager', 'cashier'].includes(req.user.role) && req.body.user_id
    ? Number(req.body.user_id) : req.user.id;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' });

  // Find active attendance record for today that hasn't clocked out yet
  db.get('SELECT * FROM attendance WHERE user_id = ? AND date = ? AND clock_out IS NULL ORDER BY id DESC', [userId, today], (err, record) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    if (!record) {
      return db.get('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [userId, today], (err, anyRec) => {
        if (!anyRec) return res.json({ success: false, message: 'لم يتم تسجيل الحضور اليوم بعد' });
        return res.json({ success: false, message: 'تم تسجيل الانصراف بالفعل' });
      });
    }

    db.run(
      'UPDATE attendance SET clock_out = ? WHERE id = ?',
      [now, record.id],
      function(err) {
        if (err) return res.status(500).json({ success: false, message: 'Failed to clock out' });
        res.json({ success: true, message: 'تم تسجيل الانصراف بنجاح', clock_out: now });
      }
    );
  });
};

// @route   POST /api/auth/shift-transfer
// @desc    Shift Transfer / التطبيق (Clock out from old branch & Clock in to new branch)
// @access  Private
exports.shiftTransfer = (req, res) => {
  const userId = ['manager', 'cashier'].includes(req.user.role) && req.body.user_id
    ? Number(req.body.user_id) : req.user.id;
  const newBranchId = req.body.new_branch_id;

  if (!newBranchId) {
    return res.status(400).json({ success: false, message: 'يرجى اختيار الفرع الجديد للتطبيق والانتقال إليه' });
  }

  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' });

  const proceedWithTransfer = () => {
    // 1. Clock out current active shift for today if open
    db.run(
      `UPDATE attendance SET clock_out = ? WHERE user_id = ? AND date = ? AND clock_out IS NULL`,
      [now, userId, today],
      function(err) {
        if (err) console.error('Error clocking out old shift:', err);

        // 2. Update user's active branch in users table
        db.run('UPDATE users SET branch_id = ? WHERE id = ?', [newBranchId, userId], function(err) {
          if (err) return res.status(500).json({ success: false, message: 'فشل تحديث فرع المستخدم' });

          // 3. Create new attendance record for the new branch (Application / Overtime shift)
          db.run(
            'INSERT INTO attendance (user_id, date, clock_in, status, branch_id) VALUES (?, ?, ?, ?, ?)',
            [userId, today, now, 'present', newBranchId],
            function(err) {
              if (err) return res.status(500).json({ success: false, message: 'فشل تسجيل حضور الشيفت الجديد' });

              db.get('SELECT name FROM branches WHERE id = ?', [newBranchId], (err, branch) => {
                const branchName = branch?.name || 'الفرع الجديد';
                res.json({
                  success: true,
                  message: `🔄 تم التطبيق والانتقال لـ (${branchName}) وتسجيل انصراف وحضور جديد بنجاح!`,
                  clock_in: now,
                  branch_id: newBranchId,
                  branch_name: branchName
                });
              });
            }
          );
        });
      }
    );
  };

  db.get('SELECT role FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });

    if (user && user.role === 'cashier') {
      db.get(`
        SELECT u.username FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.branch_id = ? AND a.date = ? AND a.clock_out IS NULL AND a.status = 'present' AND u.role = 'cashier' AND u.id != ?
      `, [newBranchId, today, userId], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        if (row) {
          return res.status(400).json({ success: false, message: `لا يمكن التطبيق لهذا الفرع، الكاشير (${row.username}) متواجد به حالياً.` });
        }
        proceedWithTransfer();
      });
    } else {
      proceedWithTransfer();
    }
  });
};

// @route   PUT /api/auth/users/:id
// @desc    Update user
// @access  Private (Manager)
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { full_name, role, salary, branch_id, password } = req.body;
  try {
    let query = 'UPDATE users SET full_name = ?, role = ?, salary = ?, branch_id = ?';
    let params = [full_name, role, Number(salary) || 0, branch_id ? Number(branch_id) : null];
    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password.trim(), salt);
      query += ', password = ?';
      params.push(hashed);
    }
    query += ' WHERE id = ?';
    params.push(id);
    db.run(query, params, function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      res.json({ success: true, message: 'تم تحديث بيانات الموظف بنجاح' });
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   DELETE /api/auth/users/:id
// @desc    Delete user
// @access  Private (Manager)
exports.deleteUser = (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    res.json({ success: true, message: 'User deleted successfully' });
  });
};

// @route   POST /api/auth/mark-absent
// @desc    Mark an employee as absent
// @access  Private (Cashier, Manager)
exports.markAbsent = (req, res) => {
  const { user_id, date } = req.body;
  const targetUserId = user_id || req.user.id;
  const today = date || new Date().toISOString().split('T')[0];

  db.get('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [targetUserId, today], (err, record) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });

    if (record) {
      db.run('UPDATE attendance SET status = ?, clock_in = NULL, clock_out = NULL WHERE id = ?', ['absent', record.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'فشل تحديث الحالة' });
        res.json({ success: true, message: 'تم تسجيل غياب الموظف بنجاح' });
      });
    } else {
      db.run(
        'INSERT INTO attendance (user_id, date, status) VALUES (?, ?, ?)',
        [targetUserId, today, 'absent'],
        function(err) {
          if (err) return res.status(500).json({ success: false, message: 'فشل تسجيل الغياب' });
          res.json({ success: true, message: 'تم تسجيل غياب الموظف بنجاح' });
        }
      );
    }
  });
};

// @route   PUT /api/auth/branches/:id/shift-timing
// @desc    Update branch shift start time and grace period
// @access  Private (Manager)
exports.updateBranchShiftTiming = (req, res) => {
  const { id } = req.params;
  const { shift_start_time, grace_period_minutes } = req.body;

  if (!shift_start_time) {
    return res.status(400).json({ success: false, message: 'يرجى تحديد وقت بدء الوردية (مثال 09:00)' });
  }

  const grace = grace_period_minutes !== undefined ? Number(grace_period_minutes) : 15;

  db.run(
    'UPDATE branches SET shift_start_time = ?, grace_period_minutes = ? WHERE id = ?',
    [shift_start_time, grace, id],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
      res.json({
        success: true,
        message: 'تم تحديث مواعيد الوردية وفترة السماح للفرع بنجاح',
        branch: { id: Number(id), shift_start_time, grace_period_minutes: grace }
      });
    }
  );
};

// @route   PUT /api/auth/users/:id/delegate-leaves
// @desc    Delegate or revoke leave management permission for employee
// @access  Private (Manager)
exports.toggleDelegatedLeaveManager = (req, res) => {
  const { id } = req.params;
  const { can_manage_leaves } = req.body;

  const flag = can_manage_leaves ? 1 : 0;

  db.run('UPDATE users SET can_manage_leaves = ? WHERE id = ?', [flag, id], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    res.json({
      success: true,
      message: flag ? 'تم تفويض صلاحية إدارة وقبول الإجازات للموظف بنجاح' : 'تم إلغاء تفويض إدارة الإجازات',
      can_manage_leaves: flag
    });
  });
};

// @route   GET /api/auth/notifications
// @desc    Get system notifications (Late arrivals, approvals)
// @access  Private
exports.getNotifications = (req, res) => {
  const isManager = req.user.role === 'manager';
  let query = 'SELECT * FROM notifications';
  const params = [];

  if (!isManager) {
    query += ' WHERE user_id = ? OR user_id IS NULL';
    params.push(req.user.id);
  }

  query += ' ORDER BY created_at DESC LIMIT 50';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    res.json({ success: true, notifications: rows || [] });
  });
};

// @route   PUT /api/auth/notifications/:id/read
// @desc    Mark a notification as read
// @access  Private
exports.markNotificationRead = (req, res) => {
  const { id } = req.params;
  const query = req.user.role === 'manager'
    ? 'UPDATE notifications SET is_read = 1 WHERE id = ?'
    : 'UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR user_id IS NULL)';
  const params = req.user.role === 'manager' ? [id] : [id, req.user.id];
  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    res.json({ success: true, message: 'تم تحديث الإشعار' });
  });
};