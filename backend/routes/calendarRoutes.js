const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const c = require('../controllers/calendarController');

// GET leaves — manager sees all, employee sees own
router.get('/leaves', auth, c.getLeaves);

// POST leave request (both /leaves and /leave for compatibility)
router.post('/leaves', auth, c.requestLeave);
router.post('/leave',  auth, c.requestLeave);

// Middleware for manager or delegated leave manager
const authorizeLeaveManager = (req, res, next) => {
  if (req.user && (req.user.role === 'manager' || req.user.can_manage_leaves === 1)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'غير مصرح: هذه الصلاحية للمدير أو مفوض إدارة الإجازات فقط' });
};

// PUT approve/reject (both patterns)
router.put('/leaves/:id/approve', auth, authorizeLeaveManager, c.updateLeaveStatus);
router.put('/leave/:id',          auth, authorizeLeaveManager, c.updateLeaveStatus);
router.put('/leaves/:id',         auth, authorizeLeaveManager, c.updateLeaveStatus);

// Calendar events & annual summary
router.get('/events',         auth, c.getCalendarEvents);
router.get('/annual-summary', auth, authorizeLeaveManager, c.getAnnualSummary);

module.exports = router;