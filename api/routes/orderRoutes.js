const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { auth } = require('../middlewares/auth');

// User routes (authenticated)
// 1. Place Order from Cart
// POST /api/orders/place
router.post('/place', auth('user'), orderController.placeOrder);

// 2. Get All Orders for User
// GET /api/orders
router.get('/', auth('user'), orderController.getUserOrders);

// 3. Get User Return Requests
// GET /api/orders/returns (must be before /:orderId route)
router.get('/returns', auth('user'), orderController.getUserReturnRequests);

// Admin routes (must be before /:orderId route to avoid conflicts)
// 4. Get All Orders (Admin only) - with filtering, sorting, pagination, and search
// GET /api/orders/admin/all?page=1&limit=20&order_status=pending&payment_status=paid&search=ORD-2024&sort_by=created_at&sort_order=desc
router.get('/admin/all', auth('admin'), orderController.getAllOrders);

// 4.5. Get Order Statistics by Status (Admin only)
// GET /api/orders/admin/statistics/order-status
router.get('/admin/statistics/order-status', auth('admin'), orderController.getOrderStatisticsByStatus);

// 5. Get Order Details by ID (Admin only) - Admin can view any order
// GET /api/orders/admin/:orderId
router.get('/admin/:orderId', auth('admin'), orderController.getOrderDetailsAdmin);

// 6. Update Order Status (Admin only)
// PATCH /api/orders/:orderId/status
router.patch('/:orderId/status', auth('admin'), orderController.updateOrderStatus);

// User routes (specific routes before parameterized routes)
// 7. Get Order Details
// GET /api/orders/:orderId
router.get('/:orderId', auth('user'), orderController.getOrderDetails);

// 8. Cancel Order
// PATCH /api/orders/:orderId/cancel
router.patch('/:orderId/cancel', auth('user'), orderController.cancelOrder);

// 9. Create Return Request
// POST /api/orders/:orderId/return
router.post('/:orderId/return', auth('user'), orderController.createReturnRequest);

module.exports = router; 