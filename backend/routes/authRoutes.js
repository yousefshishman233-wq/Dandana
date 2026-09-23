const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const authController = require('../controllers/authController');

// Public routes
router.post('/login', authController.login);
router.post('/attendance/biometric', authController.biometricAttendance);

// Private routes (authenticated users)
router.get('/user', auth, authController.getCurrentUser);
router.get('/users', auth, authController.getAllUsers);
router.get('/branches', auth, authController.getBranches);
router.post('/register', auth, authorize('manager'), authController.register);
router.put('/users/:id', auth, authorize('manager'), authController.updateUser);
router.delete('/users/:id', auth, authorize('manager'), authController.deleteUser);
router.put('/user/:id/fingerprint', auth, authorize('manager'), authController.setFingerprint);
router.put('/branches/:id/shift-timing', auth, authorize('manager'), authController.updateBranchShiftTiming);
router.put('/users/:id/delegate-leaves', auth, authorize('manager'), authController.toggleDelegatedLeaveManager);
router.get('/notifications', auth, authController.getNotifications);
router.put('/notifications/:id/read', auth, authController.markNotificationRead);
router.get('/attendance', auth, authController.getAttendance);
router.post('/clock-in', auth, authController.clockIn);
router.post('/clock-out', auth, authController.clockOut);
router.put('/attendance/:id/status', auth, authorize('cashier', 'manager'), authController.updateAttendanceStatus);
router.post('/shift-transfer', auth, authController.shiftTransfer);
router.post('/mark-absent', auth, authorize('cashier', 'manager'), authController.markAbsent);
router.post('/change-password', auth, authorize('manager'), authController.changePassword);

module.exports = router;