const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order ID is required']
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Payment amount cannot be negative'],
    set: v => Math.round(v * 100) / 100 // Round to 2 decimal places
  },
  method: {
    type: String,
    required: [true, 'Payment method is required'],
    trim: true,
    maxlength: [50, 'Payment method cannot exceed 50 characters'],
    enum: {
      values: ['card', 'upi', 'netbanking', 'wallet', 'cod', 'bank_transfer'],
      message: 'Payment method must be one of: card, upi, netbanking, wallet, cod, bank_transfer'
    }
  },
  payment_reference_id: {
    type: String,
    required: [true, 'Payment reference ID is required'],
    trim: true,
    maxlength: [200, 'Payment reference ID cannot exceed 200 characters']
  },
  status: {
    type: String,
    enum: {
      values: ['success', 'failed', 'pending'],
      message: 'Payment status must be one of: success, failed, pending'
    },
    default: 'pending'
  },
  paid_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: false // No timestamps for payments
});

// Indexes for better query performance
paymentSchema.index({ order_id: 1 });
paymentSchema.index({ user_id: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ payment_reference_id: 1 });

// Compound indexes
paymentSchema.index({ order_id: 1, status: 1 });
paymentSchema.index({ user_id: 1, status: 1 });

// Virtual for payment status display
paymentSchema.virtual('status_display').get(function() {
  const statusMap = {
    'success': 'Successful',
    'failed': 'Failed',
    'pending': 'Pending'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for payment method display
paymentSchema.virtual('method_display').get(function() {
  const methodMap = {
    'card': 'Credit/Debit Card',
    'upi': 'UPI',
    'netbanking': 'Net Banking',
    'wallet': 'Digital Wallet',
    'cod': 'Cash on Delivery',
    'bank_transfer': 'Bank Transfer'
  };
  return methodMap[this.method] || this.method;
});

// Method to mark payment as successful
paymentSchema.methods.markSuccess = function() {
  this.status = 'success';
  this.paid_at = new Date();
  return this.save();
};

// Method to mark payment as failed
paymentSchema.methods.markFailed = function() {
  this.status = 'failed';
  return this.save();
};

// Static method to get payments by user
paymentSchema.statics.getUserPayments = function(userId, limit = 10, skip = 0) {
  return this.find({ user_id: userId })
    .populate('order_id', 'order_status total_amount')
    .sort({ paid_at: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get payments by order
paymentSchema.statics.getOrderPayments = function(orderId) {
  return this.find({ order_id: orderId })
    .sort({ paid_at: -1 });
};

// Static method to get payments by status
paymentSchema.statics.getPaymentsByStatus = function(status, limit = 10, skip = 0) {
  return this.find({ status: status })
    .populate('order_id', 'order_status total_amount')
    .populate('user_id', 'first_name last_name email')
    .sort({ paid_at: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get payment statistics
paymentSchema.statics.getPaymentStats = function(userId = null) {
  const match = userId ? { user_id: userId } : {};
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        total_amount: { $sum: '$amount' }
      }
    }
  ]);
};

// Ensure virtual fields are serialized
paymentSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Payment', paymentSchema); 