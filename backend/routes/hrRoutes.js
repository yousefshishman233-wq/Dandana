const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const hrController = require('../controllers/hrController');

// Private routes
router.get('/advances', auth, hrController.getAdvances);
router.get('/advances/:userId', auth, hrController.getAdvancesByUser);
router.post('/advance', auth, hrController.requestAdvance);
router.post('/advances', auth, hrController.requestAdvance);
router.put('/advances/:id/status', auth, hrController.updateAdvanceStatus);
router.put('/advances/:id/payback', auth, authorize('manager'), hrController.paybackAdvance);
router.get('/salary/:userId', auth, hrController.getSalaryCalculation);
router.get('/salaries', auth, authorize('manager'), hrController.getAllSalaries);
router.get('/salary-summary', auth, authorize('manager', 'cashier'), hrController.getSalarySummary);
router.post('/adjust-advances', auth, authorize('manager'), hrController.adjustAdvances);
router.post('/adjust-ice-cream', auth, authorize('manager'), hrController.adjustIceCream);
router.get('/attendance/stats', auth, authorize('manager'), hrController.getAttendanceStats);
router.post('/ice-cream-order', auth, hrController.addIceCreamOrder);
router.get('/ice-cream-orders/:userId', auth, hrController.getIceCreamOrders);

module.exports = router;