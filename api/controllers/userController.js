const User = require('../models/User');
const Order = require('../models/Order');

// 1. Get All Users with Order Statistics (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status_filter
    } = req.query;

    const skip = (page - 1) * limit;
    
    // Build filter query
    let filterQuery = {
      is_admin: false // Exclude admin users
    };
    
    // Status filter
    if (status_filter && ['active', 'banned'].includes(status_filter)) {
      filterQuery.status = status_filter;
    }
    
    // Search by name (combined first_name and last_name)
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filterQuery.$or = [
        { first_name: searchRegex },
        { last_name: searchRegex }
      ];
    }
    
    // Execute query with pagination
    const users = await User.find(filterQuery)
      .select('first_name last_name email mobile_number profile_icon status created_at')
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    // Get order statistics for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Get all orders for this user (excluding cancelled orders)
        const userOrders = await Order.find({
          user_id: user._id,
          order_status: { $ne: 'cancelled' }
        });
        
        // Get returned orders
        const returnedOrders = await Order.find({
          user_id: user._id,
          order_status: 'return'
        });
        
        // Calculate statistics
        const totalOrders = userOrders.length;
        const totalOrderValue = userOrders.reduce((sum, order) => sum + order.total_amount, 0);
        const returnedOrdersCount = returnedOrders.length;
        const returnedOrdersValue = returnedOrders.reduce((sum, order) => sum + order.total_amount, 0);
        
        return {
          ...user.toObject(),
          order_statistics: {
            total_orders: totalOrders,
            total_order_value: Math.round(totalOrderValue * 100) / 100, // Round to 2 decimal places
            returned_orders: returnedOrdersCount,
            returned_orders_value: Math.round(returnedOrdersValue * 100) / 100 // Round to 2 decimal places
          }
        };
      })
    );
    
    // Get total count for pagination
    const totalUsers = await User.countDocuments(filterQuery);
    
    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalUsers / limit),
          total_users: totalUsers,
          limit: parseInt(limit)
        },
        filters: {
          search,
          status_filter
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// 2. Change User Status (Admin only)
const changeUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    
    // Validate status
    if (!['active', 'banned'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "active" or "banned"'
      });
    }
    
    // Find user and ensure they exist and are not admin
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Cannot change status of admin users'
      });
    }
    
    // Update user status
    user.status = status;
    await user.save();
    
    res.json({
      success: true,
      message: `User status changed to ${status} successfully`,
      data: {
        user: {
          id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          status: user.status,
          updated_at: user.edited_at
        }
      }
    });
    
  } catch (error) {
    console.error('Error changing user status:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing user status',
      error: error.message
    });
  }
};

module.exports = {
  getAllUsers,
  changeUserStatus
}; 