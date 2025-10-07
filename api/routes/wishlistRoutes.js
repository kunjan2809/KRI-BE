const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { auth } = require('../middlewares/auth');

// All wishlist routes require user authentication (not admin)
router.use(auth('user'));

// 1. Get Wishlist Items
// GET /api/wishlist
router.get('/', wishlistController.getWishlistItems);

// 2. Add Item to Wishlist
// POST /api/wishlist/add
router.post('/add', wishlistController.addToWishlist);

// 3. Remove Item from Wishlist
// DELETE /api/wishlist/remove/:productId
router.delete('/remove/:productId', wishlistController.removeFromWishlist);

module.exports = router;
