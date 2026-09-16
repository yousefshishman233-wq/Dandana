const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const expensesController = require('../controllers/expensesController');

// Cashier routes
router.post('/', auth, authorize('cashier', 'manager'), expensesController.addExpense);
router.post('/sales', auth, authorize('cashier', 'manager'), expensesController.addSales);
router.get('/summary', auth, authorize('cashier', 'manager'), expensesController.getShiftSummary);

module.exports = router;
