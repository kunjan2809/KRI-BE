const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { auth } = require('../middlewares/auth');

// All cart routes require user authentication (not admin)
router.use(auth('user'));

// 1. Get Cart Items
// GET /api/cart
router.get('/', cartController.getCartItems);

// 2. Add Item to Cart
// POST /api/cart/add
router.post('/add', cartController.addToCart);

// 3. Update Cart Item Quantity
// PATCH /api/cart/update/:cartItemId
router.patch('/update/:cartItemId', cartController.updateCartItemQuantity);

// 4. Remove Item from Cart
// DELETE /api/cart/remove/:cartItemId
router.delete('/remove/:cartItemId', cartController.removeFromCart);

// 5. Clear Cart
// DELETE /api/cart/clear
router.delete('/clear', cartController.clearCart);

module.exports = router;
