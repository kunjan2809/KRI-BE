const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { auth } = require('../middlewares/auth');

// Public routes (no authentication required)
// 1. Get Product Reviews
// GET /api/reviews/product/:productId
// Returns all reviews for a product with images and metadata
router.get('/product/:productId', reviewController.getProductReviews);

// All other review routes require authentication (user or admin)
router.use(auth('user'));

// 2. Create Product Review
// POST /api/reviews/product/:productId
// Body: { "title": "string", "rating_description": "string", "rating": number(1-5), "order_id": "string" (optional) }
router.post('/product/:productId', reviewController.createProductReview);

// 3. Update Product Review
// PUT /api/reviews/:reviewId
// Body: { "title": "string", "rating_description": "string", "rating": number(1-5) }
router.put('/:reviewId', reviewController.updateProductReview);

// 4. Delete Product Review
// DELETE /api/reviews/:reviewId
// Deletes review and all associated images
router.delete('/:reviewId', reviewController.deleteProductReview);

// 5. Get User Reviews
// GET /api/reviews/user
// Returns all reviews by the authenticated user
router.get('/user', reviewController.getUserReviews);

module.exports = router;
