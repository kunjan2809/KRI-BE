const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  shipping_address_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShippingAddress',
    required: [true, 'Shipping address is required']
  },
  order_number: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    description: 'Human-readable order number (e.g., ORD-2024-00001)'
  },
  order_status: {
    type: String,
    enum: {
      values: ['pending', 'shipped', 'cancelled', 'delivered', 'return'],
      message: 'Order status must be one of: pending, shipped, cancelled, delivered, return'
    },
    default: 'pending'
  },
  delivered_at: {
    type: Date,
    default: null
  },
  payment_status: {
    type: String,
    enum: {
      values: ['paid', 'cod', 'unpaid', 'refunded'],
      message: 'Payment status must be one of: paid, cod, unpaid, refunded'
    },
    default: 'unpaid'
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
  total_amount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative'],
    set: v => Math.round(v * 100) / 100 // Round to 2 decimal places
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: false // No edited_at for orders
  }
});

// Indexes for better query performance
orderSchema.index({ user_id: 1 });
orderSchema.index({ order_status: 1 });
orderSchema.index({ payment_status: 1 });
orderSchema.index({ order_number: 1 });
orderSchema.index({ created_at: -1 });
orderSchema.index({ user_id: 1, created_at: -1 });

// Virtual for discount amount
orderSchema.virtual('discount_amount').get(function() {
  if (!this.discount_type || !this.discount_rate) {
    return 0;
  }
  
  if (this.discount_type === 'price') {
    return this.discount_rate;
  } else if (this.discount_type === 'percentage') {
    return this.total_amount * (this.discount_rate / 100);
  }
  
  return 0;
});

// Virtual for subtotal (before order-level discount)
orderSchema.virtual('subtotal').get(function() {
  if (!this.discount_type || !this.discount_rate) {
    return this.total_amount;
  }
  
  if (this.discount_type === 'price') {
    return this.total_amount + this.discount_rate;
  } else if (this.discount_type === 'percentage') {
    return this.total_amount / (1 - this.discount_rate / 100);
  }
  
  return this.total_amount;
});

// Virtual for order status display
orderSchema.virtual('status_display').get(function() {
  const statusMap = {
    'pending': 'Pending',
    'shipped': 'Shipped',
    'cancelled': 'Cancelled',
    'delivered': 'Delivered',
    'return': 'Return Requested'
  };
  return statusMap[this.order_status] || this.order_status;
});

// Virtual for payment status display
orderSchema.virtual('payment_status_display').get(function() {
  const statusMap = {
    'paid': 'Paid',
    'cod': 'Cash on Delivery',
    'unpaid': 'Unpaid',
    'refunded': 'Refunded'
  };
  return statusMap[this.payment_status] || this.payment_status;
});

// Static method to generate order number
orderSchema.statics.generateOrderNumber = async function() {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;
  
  // Find the latest order number for this year
  const latestOrder = await this.findOne({
    order_number: { $regex: `^${prefix}` }
  }).sort({ order_number: -1 });
  
  let sequence = 1;
  if (latestOrder && latestOrder.order_number) {
    const parts = latestOrder.order_number.split('-');
    if (parts.length === 3) {
      const lastSequence = parseInt(parts[2]);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }
  }
  
  // Format: ORD-YYYY-XXXXX (5 digits)
  return `${prefix}${sequence.toString().padStart(5, '0')}`;
};

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
  if (!this.order_number && this.isNew) {
    try {
      this.order_number = await this.constructor.generateOrderNumber();
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Method to update order status
orderSchema.methods.updateStatus = function(newStatus) {
  this.order_status = newStatus;
  
  if (newStatus === 'delivered') {
    this.delivered_at = new Date();
  }
  
  return this.save();
};

// Method to update payment status
orderSchema.methods.updatePaymentStatus = function(newStatus) {
  this.payment_status = newStatus;
  return this.save();
};

// Static method to get orders by user
orderSchema.statics.getUserOrders = function(userId, limit = 10, skip = 0) {
  return this.find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get orders by status
orderSchema.statics.getOrdersByStatus = function(status, limit = 10, skip = 0) {
  return this.find({ order_status: status })
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to clean up problematic order_id index (leftover from old schema)
// This can be called manually or will be called automatically on first error
orderSchema.statics.cleanupOrderIdIndex = async function() {
  try {
    if (!this.collection) {
      return false; // Collection not ready yet
    }
    const collection = this.collection;
    const indexes = await collection.indexes();
    const orderIdIndex = indexes.find(idx => idx.name === 'order_id_1');
    
    if (orderIdIndex) {
      console.log('Removing problematic order_id_1 index from orders collection...');
      await collection.dropIndex('order_id_1');
      console.log('Successfully removed order_id_1 index');
      return true;
    }
    return false;
  } catch (error) {
    // Ignore errors if index doesn't exist or can't be dropped
    if (error.code !== 27 && error.codeName !== 'IndexNotFound') {
      console.warn('Warning: Could not remove order_id_1 index:', error.message);
    }
    return false;
  }
};

// Ensure virtual fields are serialized
orderSchema.set('toJSON', {
  virtuals: true
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order; 