const Lead = require('../models/Lead');

// Subscribe Email to Leads (Public API)
const subscribeEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate email field
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Check if email already exists
    const existingLead = await Lead.findOne({ email: email.toLowerCase().trim() });
    if (existingLead) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
    // Create new lead
    const lead = new Lead({
      email: email.toLowerCase().trim()
    });
    
    await lead.save();
    
    res.status(201).json({
      success: true,
      message: 'Email subscribed successfully',
      data: {
        email: lead.email,
        subscribed_at: lead.created_at
      }
    });
    
  } catch (error) {
    console.error('Error subscribing email:', error);
    
    // Handle duplicate key error (MongoDB unique constraint)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error subscribing email',
      error: error.message
    });
  }
};

module.exports = {
  subscribeEmail
};
