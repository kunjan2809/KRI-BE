const mongoose = require('mongoose');

const shippingAddressSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  full_name: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  mobile_number: {
    type: String,
    required: [true, 'Mobile number is required'],
    maxlength: [15, 'Mobile number cannot exceed 15 characters'],
    match: [/^[+]?[\d\s\-\(\)]+$/, 'Please enter a valid mobile number']
  },
  address_line_1: {
    type: String,
    required: [true, 'Address line 1 is required'],
    trim: true,
    maxlength: [200, 'Address line 1 cannot exceed 200 characters']
  },
  address_line_2: {
    type: String,
    trim: true,
    maxlength: [200, 'Address line 2 cannot exceed 200 characters']
  },
  landmark: {
    type: String,
    trim: true,
    maxlength: [100, 'Landmark cannot exceed 100 characters']
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    maxlength: [100, 'City cannot exceed 100 characters']
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
    maxlength: [100, 'State cannot exceed 100 characters']
  },
  postal_code: {
    type: String,
    required: [true, 'Postal code is required'],
    trim: true,
    maxlength: [20, 'Postal code cannot exceed 20 characters'],
    match: [/^[A-Z0-9\-\s]+$/i, 'Please enter a valid postal code']
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true,
    maxlength: [100, 'Country cannot exceed 100 characters']
  },
  is_default: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'edited_at'
  }
});

// Indexes for better query performance
shippingAddressSchema.index({ user_id: 1 });
shippingAddressSchema.index({ is_default: 1 });
shippingAddressSchema.index({ user_id: 1, is_default: 1 });

// Pre-save middleware to ensure only one default address per user
shippingAddressSchema.pre('save', async function(next) {
  if (this.is_default) {
    try {
      // Set all other addresses for this user to non-default
      await this.constructor.updateMany(
        { 
          user_id: this.user_id, 
          _id: { $ne: this._id } 
        },
        { is_default: false }
      );
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Virtual for formatted address
shippingAddressSchema.virtual('formatted_address').get(function() {
  let address = this.address_line_1;
  
  if (this.address_line_2) {
    address += `, ${this.address_line_2}`;
  }
  
  if (this.landmark) {
    address += `, ${this.landmark}`;
  }
  
  address += `, ${this.city}, ${this.state} ${this.postal_code}, ${this.country}`;
  
  return address;
});

// Static method to get default address for a user
shippingAddressSchema.statics.getDefaultAddress = function(userId) {
  return this.findOne({ user_id: userId, is_default: true });
};

// Static method to get all addresses for a user
shippingAddressSchema.statics.getUserAddresses = function(userId) {
  return this.find({ user_id: userId }).sort({ is_default: -1, created_at: 1 });
};

// Ensure virtual fields are serialized
shippingAddressSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('ShippingAddress', shippingAddressSchema); 