const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes for better query performance
leadSchema.index({ email: 1 });
leadSchema.index({ created_at: -1 });

// Ensure virtual fields are serialized
leadSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Lead', leadSchema);
