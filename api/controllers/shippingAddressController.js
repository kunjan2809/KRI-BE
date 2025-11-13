const ShippingAddress = require('../models/ShippingAddress');

// 1. Create Shipping Address
const createAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      full_name,
      mobile_number,
      address_line_1,
      address_line_2,
      landmark,
      city,
      state,
      postal_code,
      country,
      is_default
    } = req.body;

    // Validate required fields
    if (!full_name || !mobile_number || !address_line_1 || !city || !state || !postal_code || !country) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields. Please provide: full_name, mobile_number, address_line_1, city, state, postal_code, and country'
      });
    }

    // Create new shipping address
    const shippingAddress = new ShippingAddress({
      user_id: userId,
      full_name,
      mobile_number,
      address_line_1,
      address_line_2: address_line_2 || undefined,
      landmark: landmark || undefined,
      city,
      state,
      postal_code,
      country,
      is_default: is_default || false
    });

    await shippingAddress.save();

    res.status(201).json({
      success: true,
      message: 'Shipping address created successfully',
      data: {
        address: shippingAddress
      }
    });

  } catch (error) {
    console.error('Error creating shipping address:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating shipping address',
      error: error.message
    });
  }
};

// 2. Get All Addresses for User
const getUserAddresses = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all non-deleted addresses for the user
    const addresses = await ShippingAddress.getUserAddresses(userId);

    res.json({
      success: true,
      data: {
        addresses: addresses,
        count: addresses.length
      }
    });

  } catch (error) {
    console.error('Error fetching user addresses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user addresses',
      error: error.message
    });
  }
};

// 3. Get Address by ID
const getAddressById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId } = req.params;

    // Find address by ID and ensure it belongs to the user and is not deleted
    const address = await ShippingAddress.findOne({
      _id: addressId,
      user_id: userId,
      deleted_at: null
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Shipping address not found'
      });
    }

    res.json({
      success: true,
      data: {
        address: address
      }
    });

  } catch (error) {
    console.error('Error fetching address:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error fetching address',
      error: error.message
    });
  }
};

// 4. Update Shipping Address
const updateAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId } = req.params;
    const {
      full_name,
      mobile_number,
      address_line_1,
      address_line_2,
      landmark,
      city,
      state,
      postal_code,
      country,
      is_default
    } = req.body;

    // Find address and ensure it belongs to the user and is not deleted
    const address = await ShippingAddress.findOne({
      _id: addressId,
      user_id: userId,
      deleted_at: null
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Shipping address not found'
      });
    }

    // Update fields if provided
    if (full_name !== undefined) address.full_name = full_name;
    if (mobile_number !== undefined) address.mobile_number = mobile_number;
    if (address_line_1 !== undefined) address.address_line_1 = address_line_1;
    if (address_line_2 !== undefined) address.address_line_2 = address_line_2;
    if (landmark !== undefined) address.landmark = landmark;
    if (city !== undefined) address.city = city;
    if (state !== undefined) address.state = state;
    if (postal_code !== undefined) address.postal_code = postal_code;
    if (country !== undefined) address.country = country;
    if (is_default !== undefined) address.is_default = is_default;

    await address.save();

    res.json({
      success: true,
      message: 'Shipping address updated successfully',
      data: {
        address: address
      }
    });

  } catch (error) {
    console.error('Error updating shipping address:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating shipping address',
      error: error.message
    });
  }
};

// 5. Delete Shipping Address (Soft Delete)
const deleteAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId } = req.params;

    // Find address and ensure it belongs to the user and is not already deleted
    const address = await ShippingAddress.findOne({
      _id: addressId,
      user_id: userId,
      deleted_at: null
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Shipping address not found'
      });
    }

    // Soft delete: set deleted_at timestamp
    address.deleted_at = new Date();
    // Also set is_default to false if it was the default address
    if (address.is_default) {
      address.is_default = false;
    }
    await address.save();

    res.json({
      success: true,
      message: 'Shipping address deleted successfully',
      data: {
        deleted_address: {
          id: address._id,
          full_name: address.full_name
        }
      }
    });

  } catch (error) {
    console.error('Error deleting shipping address:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error deleting shipping address',
      error: error.message
    });
  }
};

// 6. Get Default Address for User
const getDefaultAddress = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get default address for the user
    const address = await ShippingAddress.getDefaultAddress(userId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'No default address found'
      });
    }

    res.json({
      success: true,
      data: {
        address: address
      }
    });

  } catch (error) {
    console.error('Error fetching default address:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching default address',
      error: error.message
    });
  }
};

module.exports = {
  createAddress,
  getUserAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  getDefaultAddress
};

