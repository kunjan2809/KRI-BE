const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  variation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductVariation',
    default: null,
    description: 'Optional product variation (size, color, etc.)'
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    default: 1
  }
}, {
  timestamps: {
    createdAt: 'added_at',
    updatedAt: 'updated_at'
  }
});

// Compound index to prevent duplicate cart items for same user, product, and variation
cartSchema.index({ user_id: 1, product_id: 1, variation_id: 1 }, { unique: true });

// Index for better query performance
cartSchema.index({ user_id: 1 });
cartSchema.index({ product_id: 1 });

// Virtual for cart item total price
cartSchema.virtual('item_total').get(function() {
  // This will be calculated in the controller using product price
  return this.quantity; // Placeholder - actual calculation in controller
});

// Ensure virtual fields are serialized
cartSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Cart', cartSchema);
