const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { auth } = require('../middlewares/auth');

// Public route - no authentication required
// GET /api/category/all
router.get('/all', categoryController.getAllCategories);

// Admin-only routes - require admin authentication
// POST /api/category/add
router.post('/add', auth('admin'), categoryController.addCategory);

// PUT /api/category/edit/:categoryId
router.put('/edit/:categoryId', auth('admin'), categoryController.editCategory);

// DELETE /api/category/delete/:categoryId
router.delete('/delete/:categoryId', auth('admin'), categoryController.deleteCategory);

module.exports = router;
