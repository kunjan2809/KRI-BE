const mongoose = require('mongoose');

const productVariationSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  color: {
    type: String,
    required: [true, 'Color is required'],
    trim: true,
    maxlength: [50, 'Color cannot exceed 50 characters']
  },
  size: {
    type: String,
    required: [true, 'Size is required'],
    trim: true,
    maxlength: [20, 'Size cannot exceed 20 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  stock_quantity: {
    type: Number,
    default: 0,
    min: [0, 'Stock quantity cannot be negative']
  },
  sku: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values but ensures uniqueness for non-null values
    trim: true,
    maxlength: [100, 'SKU cannot exceed 100 characters']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'deleted'],
    default: 'active'
  },
  deleted_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Compound index to ensure unique combination of product_id, color, and size (active variations only)
productVariationSchema.index({ 
  product_id: 1, 
  color: 1, 
  size: 1 
}, { 
  unique: true,
  partialFilterExpression: {
    status: 'active',
    deleted_at: null
  }
});

// Index for better query performance
productVariationSchema.index({ product_id: 1 });
productVariationSchema.index({ sku: 1 });
productVariationSchema.index({ status: 1 });
productVariationSchema.index({ deleted_at: 1 }); // Index for soft delete queries

// Virtual for variation identifier (combination of color and size)
productVariationSchema.virtual('variation_name').get(function() {
  return `${this.color} - ${this.size}`;
});

// Virtual for is deleted
productVariationSchema.virtual('is_deleted').get(function() {
  return this.deleted_at !== null || this.status === 'deleted';
});

// Ensure virtual fields are serialized
productVariationSchema.set('toJSON', {
  virtuals: true
});

// Static method to get variations by product ID
productVariationSchema.statics.getProductVariations = async function(productId) {
  return await this.find({ 
    product_id: productId, 
    status: 'active',
    deleted_at: null
  }).sort({ color: 1, size: 1 });
};

// Static method to get variation by product ID and attributes
productVariationSchema.statics.getVariationByAttributes = async function(productId, color, size) {
  return await this.findOne({ 
    product_id: productId, 
    color: color, 
    size: size,
    status: 'active',
    deleted_at: null
  });
};

// Static method to check if variation exists (active only)
productVariationSchema.statics.checkActiveVariationExists = async function(productId, color, size) {
  return await this.findOne({ 
    product_id: productId, 
    color: color, 
    size: size,
    status: 'active',
    deleted_at: null
  });
};

module.exports = mongoose.model('ProductVariation', productVariationSchema);
