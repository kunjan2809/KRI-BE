const mongoose = require('mongoose');

const reviewImageSchema = new mongoose.Schema({
  review_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductReview',
    required: [true, 'Review ID is required']
  },
  image_url: {
    type: String,
    required: [true, 'Image URL is required'],
    trim: true,
    maxlength: [500, 'Image URL cannot exceed 500 characters']
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: false // Only created_at as requested
  }
});

// Indexes for better query performance
reviewImageSchema.index({ review_id: 1 });

// Static method to get images by review
reviewImageSchema.statics.getReviewImages = function(reviewId) {
  return this.find({ review_id: reviewId }).sort({ created_at: 1 });
};

// Static method to get all images for multiple reviews
reviewImageSchema.statics.getReviewsImages = function(reviewIds) {
  return this.find({ review_id: { $in: reviewIds } }).sort({ review_id: 1, created_at: 1 });
};

module.exports = mongoose.model('ReviewImage', reviewImageSchema); 