const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order ID is required'],
    unique: true // One delivery record per order
  },
  delivery_by: {
    type: String,
    required: [true, 'Shipping company name is required'],
    trim: true,
    maxlength: [100, 'Shipping company name cannot exceed 100 characters']
  },
  speed: {
    type: String,
    required: [true, 'Delivery speed is required'],
    enum: {
      values: ['standard', 'normal', 'express', 'overnight', 'same_day', 'economy'],
      message: 'Delivery speed must be one of: standard, normal, express, overnight, same_day, economy'
    },
    default: 'standard'
  },
  tracking_number: {
    type: String,
    required: [true, 'Tracking number is required'],
    trim: true,
    maxlength: [100, 'Tracking number cannot exceed 100 characters'],
    unique: true // Each tracking number should be unique
  },
  shipping_address_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShippingAddress',
    required: [true, 'Shipping address ID is required']
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'edited_at'
  }
});

// Basic index for order_id
deliverySchema.index({ order_id: 1 });

module.exports = mongoose.model('Delivery', deliverySchema); 