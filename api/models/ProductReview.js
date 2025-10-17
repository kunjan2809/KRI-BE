const mongoose = require('mongoose');

const productReviewSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  title: {
    type: String,
    required: [true, 'Review title is required'],
    trim: true,
    maxlength: [200, 'Review title cannot exceed 200 characters']
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    validate: {
      validator: function(value) {
        // Check if rating is an integer between 1 and 5
        return Number.isInteger(value) && value >= 1 && value <= 5;
      },
      message: 'Rating must be an integer between 1 and 5'
    }
  },
  rating_description: {
    type: String,
    required: [true, 'Rating description is required'],
    trim: true,
    maxlength: [1000, 'Rating description cannot exceed 1000 characters']
  },
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false, // Optional field
    default: null
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'edited_at'
  }
});

// Indexes for better query performance
productReviewSchema.index({ product_id: 1 });
productReviewSchema.index({ user_id: 1 });
productReviewSchema.index({ rating: 1 });
productReviewSchema.index({ created_at: -1 });

// Compound index to ensure one review per user per product
productReviewSchema.index({ product_id: 1, user_id: 1 }, { unique: true });

// Compound index for product + rating queries
productReviewSchema.index({ product_id: 1, rating: 1 });

// Compound index for user + created_at queries
productReviewSchema.index({ user_id: 1, created_at: -1 });

// Static method to get reviews by product
productReviewSchema.statics.getProductReviews = function(productId, limit = 10, skip = 0) {
  return this.find({ product_id: productId })
    .populate('user_id', 'first_name last_name')
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get reviews by user
productReviewSchema.statics.getUserReviews = function(userId, limit = 10, skip = 0) {
  return this.find({ user_id: userId })
    .populate('product_id', 'name sku')
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get average rating for a product
productReviewSchema.statics.getProductAverageRating = function(productId) {
  return this.aggregate([
    { $match: { product_id: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: null, averageRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } }
  ]);
};

// Static method to get rating distribution for a product
productReviewSchema.statics.getProductRatingDistribution = function(productId) {
  return this.aggregate([
    { $match: { product_id: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
};

module.exports = mongoose.model('ProductReview', productReviewSchema); 