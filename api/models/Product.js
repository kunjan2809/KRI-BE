const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z0-9\-_]+$/, 'SKU can only contain uppercase letters, numbers, hyphens, and underscores']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  product_description: {
    type: String,
    required: [true, 'Product description (HTML) is required'],
    trim: true,
    description: 'Rich text HTML content from editor'
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative'],
    set: v => Math.round(v * 100) / 100 // Round to 2 decimal places
  },
  mrp: {
    type: Number,
    min: [0, 'MRP cannot be negative'],
    set: v => Math.round(v * 100) / 100 // Round to 2 decimal places
  },
  discount_type: {
    type: String,
    enum: {
      values: ['price', 'percentage', null],
      message: 'Discount type must be either "price", "percentage", or null'
    },
    default: null
  },
  discount_rate: {
    type: Number,
    min: [0, 'Discount rate cannot be negative'],
    validate: {
      validator: function(value) {
        if (this.discount_type === 'percentage' && value > 100) {
          return false;
        }
        return true;
      },
      message: 'Percentage discount cannot exceed 100%'
    },
    set: v => Math.round(v * 100) / 100 // Round to 2 decimal places
  },
  stock_quantity: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock quantity cannot be negative'],
    default: 0
  },
  weight: {
    type: Number,
    min: [0, 'Weight cannot be negative'],
    set: v => Math.round(v * 1000) / 1000 // Round to 3 decimal places
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'published', 'deleted'],
      message: 'Status must be either "draft", "published", or "deleted"'
    },
    default: 'draft'
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  deleted_at: {
    type: Date,
    default: null
  },
  featured: {
    type: Boolean,
    default: false,
    description: 'Whether the product is featured'
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'edited_at'
  }
});

// Indexes for better query performance
productSchema.index({ sku: 1 });
productSchema.index({ category_id: 1 });
productSchema.index({ status: 1 });
productSchema.index({ price: 1 });
productSchema.index({ deleted_at: 1 }); // Index for soft delete queries
productSchema.index({ featured: 1 }); // Index for featured products queries
productSchema.index({ created_at: -1 }); // Index for newest first sorting
productSchema.index({ name: 'text', description: 'text', product_description: 'text' }, {
  weights: {
    name: 10,           // Highest priority for product name
    description: 5,      // Medium priority for description
    product_description: 3 // Lower priority for rich text
  }
}); // Enhanced text search index with weights

// Virtual for final price after discount
productSchema.virtual('final_price').get(function() {
  if (!this.discount_type || !this.discount_rate) {
    return this.price;
  }
  
  if (this.discount_type === 'price') {
    return Math.max(0, this.price - this.discount_rate);
  } else if (this.discount_type === 'percentage') {
    return this.price * (1 - this.discount_rate / 100);
  }
  
  return this.price;
});

// Virtual for discount amount
productSchema.virtual('discount_amount').get(function() {
  if (!this.discount_type || !this.discount_rate) {
    return 0;
  }
  
  if (this.discount_type === 'price') {
    return this.discount_rate;
  } else if (this.discount_type === 'percentage') {
    return this.price * (this.discount_rate / 100);
  }
  
  return 0;
});

// Virtual for stock status
productSchema.virtual('in_stock').get(function() {
  return this.stock_quantity > 50;
});

// Virtual for low stock warning
productSchema.virtual('low_stock').get(function() {
  return this.stock_quantity >= 1 && this.stock_quantity <= 50;
});

// Virtual for out of stock status
productSchema.virtual('out_of_stock').get(function() {
  return this.stock_quantity === 0;
});

// Virtual for is deleted
productSchema.virtual('is_deleted').get(function() {
  return this.deleted_at !== null || this.status === 'deleted';
});

// Ensure virtual fields are serialized
productSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Product', productSchema); 