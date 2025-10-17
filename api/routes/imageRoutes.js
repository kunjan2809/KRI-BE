const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');
const { auth } = require('../middlewares/auth');

// All image routes require authentication (user or admin)
router.use(auth('user'));

// 1. Upload Product Image
// POST /api/images/product/:productId
// Body: multipart/form-data with 'image' file and 'isPrimary' boolean
router.post('/product/:productId', 
  imageController.uploadProduct.single('image'),
  imageController.uploadProductImage
);

// 3. Delete Product Image
// DELETE /api/images/product/:imageId
router.delete('/product/:imageId', imageController.deleteProductImage);

// 4. Update Product Image
// PUT /api/images/product/:imageId
router.put('/product/:imageId', 
  imageController.updateProductImage
);


// 2. Upload Review Image
// POST /api/images/review/:reviewId
// Body: multipart/form-data with 'image' file
router.post('/review/:reviewId',
  imageController.uploadReview.single('image'),
  imageController.uploadReviewImage
);

// 5. Delete Review Image
// DELETE /api/images/review/:imageId
router.delete('/review/:imageId', imageController.deleteReviewImage);


module.exports = router; 