const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const inventoryController = require('../controllers/inventoryController');

// POS / Products routes
router.get('/products', auth, inventoryController.getProducts);
router.post('/products', auth, authorize('manager'), inventoryController.addProduct);
router.put('/products/:id', auth, authorize('manager'), inventoryController.updateProduct);
router.delete('/products/:id', auth, authorize('manager'), inventoryController.deleteProduct);

// Orders
router.get('/orders', auth, inventoryController.getOrders);
router.get('/orders/:id', auth, inventoryController.getOrderById);
router.post('/orders', auth, authorize('cashier', 'manager'), inventoryController.createOrder);

// ─── NEW: Inventory Audits & Factory Orders Routes ───
router.get('/audit-items', auth, inventoryController.getAuditItems);
router.post('/audit-items', auth, inventoryController.addAuditItem);
router.post('/audits', auth, inventoryController.saveInventoryAudit);
router.get('/audits', auth, inventoryController.getInventoryAudits);

router.post('/factory-orders', auth, inventoryController.createFactoryOrder);
router.get('/factory-orders', auth, inventoryController.getFactoryOrders);
router.put('/factory-orders/:id/status', auth, authorize('manager', 'driver'), inventoryController.updateFactoryOrderStatus);

module.exports = router;