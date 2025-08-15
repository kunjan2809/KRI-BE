const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { auth } = require('../middlewares/auth');

// 1. Public Order Creation API (No authentication required)
// Anyone can place an order by providing customer information
router.post('/create', orderController.createOrder);

// 2. User Order History API (Authentication required)
// Users must be logged in to view their order history
router.get('/user-orders', auth('user'), orderController.getUserOrders);

// 3. Admin Orders API (Admin authentication required)
// Only admins can access all orders with filters, pagination, and search
router.get('/admin/all', auth('admin'), orderController.getAllOrders);

// 4. Admin Get Order Details API (Admin authentication required)
// Only admins can get complete order details including user, shipping address, and delivery info
router.get('/admin/details/:orderId', auth('admin'), orderController.getOrderDetails);

// 5. Admin Create or Update Delivery API (Admin authentication required)
// Admins can create new delivery records or update existing ones
router.post('/admin/delivery', auth('admin'), orderController.createOrUpdateDelivery);

module.exports = router; 