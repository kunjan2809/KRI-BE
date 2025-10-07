const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  }
}, {
  timestamps: {
    createdAt: 'added_at',
    updatedAt: 'updated_at'
  }
});

// Compound index to prevent duplicate wishlist items for same user and product
wishlistSchema.index({ user_id: 1, product_id: 1 }, { unique: true });

// Index for better query performance
wishlistSchema.index({ user_id: 1 });
wishlistSchema.index({ product_id: 1 });

module.exports = mongoose.model('Wishlist', wishlistSchema);
