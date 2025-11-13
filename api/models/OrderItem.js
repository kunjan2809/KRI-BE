const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order ID is required']
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
  product_name_snapshot: {
    type: String,
    required: [true, 'Product name snapshot is required'],
    trim: true,
    maxlength: [200, 'Product name snapshot cannot exceed 200 characters']
  },
  product_price_snapshot: {
    type: Number,
    required: [true, 'Product price snapshot is required'],
    min: [0, 'Product price snapshot cannot be negative'],
    set: v => Math.round(v * 100) / 100 // Round to 2 decimal places
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    max: [999, 'Quantity cannot exceed 999']
  },
  price: {
    type: Number,
    required: [true, 'Final price is required'],
    min: [0, 'Final price cannot be negative'],
    set: v => Math.round(v * 100) / 100 // Round to 2 decimal places
  }
}, {
  timestamps: false // No timestamps for order items
});

// Indexes for better query performance
orderItemSchema.index({ order_id: 1 });
orderItemSchema.index({ product_id: 1 });
orderItemSchema.index({ variation_id: 1 });
orderItemSchema.index({ order_id: 1, product_id: 1 });

// Virtual for total item value
orderItemSchema.virtual('total_value').get(function() {
  return this.price * this.quantity;
});

// Virtual for item discount
orderItemSchema.virtual('item_discount').get(function() {
  const expectedPrice = this.product_price_snapshot * this.quantity;
  return Math.max(0, expectedPrice - this.price);
});

// Virtual for discount percentage
orderItemSchema.virtual('discount_percentage').get(function() {
  const expectedPrice = this.product_price_snapshot * this.quantity;
  if (expectedPrice === 0) return 0;
  return ((expectedPrice - this.price) / expectedPrice) * 100;
});

// Static method to get order items by order
orderItemSchema.statics.getOrderItems = function(orderId) {
  return this.find({ order_id: orderId })
    .populate('product_id', 'name sku')
    .sort({ _id: 1 });
};

// Static method to get order items by product
orderItemSchema.statics.getProductOrderItems = function(productId, limit = 10, skip = 0) {
  return this.find({ product_id: productId })
    .populate('order_id', 'order_status payment_status created_at')
    .sort({ _id: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to calculate order total
orderItemSchema.statics.calculateOrderTotal = function(orderId) {
  return this.aggregate([
    { $match: { order_id: new mongoose.Types.ObjectId(orderId) } },
    { $group: { _id: null, total: { $sum: '$price' } } }
  ]);
};

// Ensure virtual fields are serialized
orderItemSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('OrderItem', orderItemSchema); 