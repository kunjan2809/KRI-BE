const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { auth } = require('../middlewares/auth');

// All analytics routes require admin authentication
router.use(auth('admin'));

// 1. Order Analytics: Current month vs Previous month
// GET /api/analytics/orders
router.get('/orders', analyticsController.getOrderAnalytics);

// 2. User Analytics: Current month vs Previous month registrations
// GET /api/analytics/users
router.get('/users', analyticsController.getUserAnalytics);

// 3. Category Order Analytics: Current month order counts by category
// GET /api/analytics/categories
router.get('/categories', analyticsController.getCategoryOrderAnalytics);

// 4. Yearly Order Analytics: Monthly order counts for specified year vs previous year
// GET /api/analytics/yearly/:year
router.get('/yearly/:year', analyticsController.getYearlyOrderAnalytics);

// 5. Dashboard Summary: Latest 5 orders, products, and payments
// GET /api/analytics/dashboard
router.get('/dashboard', analyticsController.getDashboardSummary);

// 6. Monthly Revenue: Current month revenue breakdown
// GET /api/analytics/revenue
router.get('/revenue', analyticsController.getMonthlyRevenue);

module.exports = router; 