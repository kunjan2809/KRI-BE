const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: false // No edited_at for categories
  }
});

// Index for better query performance
categorySchema.index({ name: 1 });

// Virtual for product count (will be populated when needed)
categorySchema.virtual('product_count', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category_id',
  count: true
});

// Ensure virtual fields are serialized
categorySchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Category', categorySchema); 