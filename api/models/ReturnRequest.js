const mongoose = require('mongoose');

const returnRequestSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order ID is required']
  },
  order_item_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrderItem',
    required: [true, 'Order item ID is required']
  },
  reason: {
    type: String,
    required: [true, 'Return reason is required'],
    trim: true,
    maxlength: [1000, 'Return reason cannot exceed 1000 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    enum: {
      values: [
        'Damaged',
        'Wrong item',
        'Size issue',
        'Quality issue',
        'Not as described',
        'Received late',
        'Changed mind',
        'Other'
      ],
      message: 'Notes must be one of the predefined values'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['requested', 'approved', 'rejected', 'picked-up', 'cancelled'],
      message: 'Return status must be one of: requested, approved, rejected, picked-up, cancelled'
    },
    default: 'requested'
  },
  resolved_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: false // No edited_at for return requests
  }
});

// Indexes for better query performance
returnRequestSchema.index({ user_id: 1 });
returnRequestSchema.index({ order_id: 1 });
returnRequestSchema.index({ order_item_id: 1 });
returnRequestSchema.index({ status: 1 });
returnRequestSchema.index({ created_at: -1 });

// Compound indexes
returnRequestSchema.index({ user_id: 1, status: 1 });
returnRequestSchema.index({ order_id: 1, status: 1 });

// Virtual for return status display
returnRequestSchema.virtual('status_display').get(function() {
  const statusMap = {
    'requested': 'Requested',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'picked-up': 'Picked Up',
    'cancelled': 'Cancelled'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for notes display
returnRequestSchema.virtual('notes_display').get(function() {
  return this.notes || 'Custom reason provided';
});

// Method to approve return request
returnRequestSchema.methods.approve = function() {
  this.status = 'approved';
  return this.save();
};

// Method to reject return request
returnRequestSchema.methods.reject = function() {
  this.status = 'rejected';
  this.resolved_at = new Date();
  return this.save();
};

// Method to mark as picked up
returnRequestSchema.methods.markPickedUp = function() {
  this.status = 'picked-up';
  this.resolved_at = new Date();
  return this.save();
};

// Method to cancel return request
returnRequestSchema.methods.cancel = function() {
  this.status = 'cancelled';
  this.resolved_at = new Date();
  return this.save();
};

// Static method to get return requests by user
returnRequestSchema.statics.getUserReturns = function(userId, limit = 10, skip = 0) {
  return this.find({ user_id: userId })
    .populate('order_id', 'order_status total_amount created_at')
    .populate('order_item_id', 'product_name_snapshot quantity price')
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get return requests by order
returnRequestSchema.statics.getOrderReturns = function(orderId) {
  return this.find({ order_id: orderId })
    .populate('order_item_id', 'product_name_snapshot quantity price')
    .sort({ created_at: 1 });
};

// Static method to get return requests by status
returnRequestSchema.statics.getReturnsByStatus = function(status, limit = 10, skip = 0) {
  return this.find({ status: status })
    .populate('order_id', 'order_status total_amount created_at')
    .populate('order_item_id', 'product_name_snapshot quantity price')
    .populate('user_id', 'first_name last_name email')
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get return statistics
returnRequestSchema.statics.getReturnStats = function(userId = null) {
  const match = userId ? { user_id: userId } : {};
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Ensure virtual fields are serialized
returnRequestSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('ReturnRequest', returnRequestSchema); 