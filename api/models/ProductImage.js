const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  image_url: {
    type: String,
    required: [true, 'Image URL is required'],
    trim: true,
    maxlength: [500, 'Image URL cannot exceed 500 characters']
  },
  alt_text: {
    type: String,
    trim: true,
    maxlength: [200, 'Alt text cannot exceed 200 characters'],
    default: ''
  },
  is_primary: {
    type: Boolean,
    default: false
  },
  sort_order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'edited_at' // Changed to match schemas.yaml
  }
});

// Indexes for better query performance
productImageSchema.index({ product_id: 1 });
productImageSchema.index({ is_primary: 1 });
productImageSchema.index({ sort_order: 1 });

// Compound index for product_id + is_primary
productImageSchema.index({ product_id: 1, is_primary: 1 });

// Pre-save middleware to ensure only one primary image per product
productImageSchema.pre('save', async function(next) {
  if (this.is_primary) {
    try {
      // Set all other images for this product to non-primary
      await this.constructor.updateMany(
        { 
          product_id: this.product_id, 
          _id: { $ne: this._id } 
        },
        { is_primary: false }
      );
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Static method to get primary image for a product
productImageSchema.statics.getPrimaryImage = function(productId) {
  return this.findOne({ product_id: productId, is_primary: true });
};

// Static method to get all images for a product
productImageSchema.statics.getProductImages = function(productId) {
  return this.find({ product_id: productId }).sort({ is_primary: -1, sort_order: 1, created_at: 1 });
};

module.exports = mongoose.model('ProductImage', productImageSchema); 