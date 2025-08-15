const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { auth } = require('../middlewares/auth');

// All product routes require admin authentication
router.use(auth('admin'));

// 1. Get All Products with Filters
// GET /api/products/admin/all?page=1&limit=20&stock_filters[]=in_stock&stock_filters[]=low_stock&status_filters[]=published&search=iphone&sort_by=created_at&sort_order=desc
router.get('/admin/all', productController.getAllProducts);

// 2. Add New Product
// POST /api/products/admin/add
router.post('/admin/add', productController.addProduct);

// 3. Edit Existing Product
// PUT /api/products/admin/edit/:productId
router.put('/admin/edit/:productId', productController.editProduct);

// 4. Soft Delete Product
// DELETE /api/products/admin/delete/:productId
router.delete('/admin/delete/:productId', productController.softDeleteProduct);

// 5. View Product Details
// GET /api/products/admin/details/:productId
router.get('/admin/details/:productId', productController.getProductDetails);

// 6. Update Product Quantity
// PATCH /api/products/admin/quantity/:productId
router.patch('/admin/quantity/:productId', productController.updateProductQuantity);

// 7. Update Product Status
// PATCH /api/products/admin/status/:productId
router.patch('/admin/status/:productId', productController.updateProductStatus);

module.exports = router; 