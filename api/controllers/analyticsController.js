const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const OrderItem = require('../models/OrderItem');
const ProductImage = require('../models/ProductImage');
const ShippingAddress = require('../models/ShippingAddress');
const Delivery = require('../models/Delivery');

// Note: Ensure the following database indexes exist for optimal performance:
// - Order: { created_at: -1 }, { user_id: 1, created_at: -1 }
// - User: { created_at: -1 }
// - Product: { category_id: 1 }
// - OrderItem: { order_id: 1 }, { product_id: 1 }
// - Payment: { order_id: 1 }, { paid_at: -1 }

// Helper function to get date ranges
const getDateRanges = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Current month: 1st to current day
  const currentMonthStart = new Date(currentYear, currentMonth, 1);
  const currentMonthEnd = now;
  
  // Previous month: 1st to last day (handle January edge case)
  let previousMonthStart, previousMonthEnd;
  if (currentMonth === 0) {
    // January: previous month is December of previous year
    previousMonthStart = new Date(currentYear - 1, 11, 1);
    previousMonthEnd = new Date(currentYear - 1, 11, 31, 23, 59, 59, 999);
  } else {
    // Other months: previous month is current year, month - 1
    previousMonthStart = new Date(currentYear, currentMonth - 1, 1);
    previousMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
  }
  
  return {
    currentMonthStart,
    currentMonthEnd,
    previousMonthStart,
    previousMonthEnd
  };
};

// Helper function to get year date ranges
const getYearDateRanges = (year) => {
  // year is already validated as a number
  const targetYear = year;
  const previousYear = targetYear - 1;
  
  return {
    targetYearStart: new Date(targetYear, 0, 1),
    targetYearEnd: new Date(targetYear, 11, 31, 23, 59, 59, 999),
    previousYearStart: new Date(previousYear, 0, 1),
    previousYearEnd: new Date(previousYear, 11, 31, 23, 59, 59, 999)
  };
};

// 1. Order Analytics: Current month vs Previous month
const getOrderAnalytics = async (req, res) => {
  try {
    // Validate request
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }
    
    const { currentMonthStart, currentMonthEnd, previousMonthStart, previousMonthEnd } = getDateRanges();
    
    // Get current month orders and revenue
    const currentMonthOrders = await Order.find({
      created_at: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });
    
    const currentMonthRevenue = currentMonthOrders.reduce((sum, order) => sum + order.total_amount, 0);
    
    // Get previous month orders and revenue
    const previousMonthOrders = await Order.find({
      created_at: { $gte: previousMonthStart, $lte: previousMonthEnd }
    });
    
    const previousMonthRevenue = previousMonthOrders.reduce((sum, order) => sum + order.total_amount, 0);
    
    res.json({
      success: true,
      data: {
        current_month: {
          period: {
            start: currentMonthStart.toISOString(),
            end: currentMonthEnd.toISOString()
          },
          orders_count: currentMonthOrders.length,
          total_revenue: Math.round(currentMonthRevenue * 100) / 100
        },
        previous_month: {
          period: {
            start: previousMonthStart.toISOString(),
            end: previousMonthEnd.toISOString()
          },
          orders_count: previousMonthOrders.length,
          total_revenue: Math.round(previousMonthRevenue * 100) / 100
        }
      },
      message: 'Order analytics retrieved successfully'
    });
    
  } catch (error) {
    console.error('Error fetching order analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order analytics',
      error: error.message
    });
  }
};

// 2. User Analytics: Current month vs Previous month registrations
const getUserAnalytics = async (req, res) => {
  try {
    // Validate request
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }
    
    const { currentMonthStart, currentMonthEnd, previousMonthStart, previousMonthEnd } = getDateRanges();
    
    // Get current month user registrations
    const currentMonthUsers = await User.countDocuments({
      created_at: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });
    
    // Get previous month user registrations
    const previousMonthUsers = await User.countDocuments({
      created_at: { $gte: previousMonthStart, $lte: previousMonthEnd }
    });
    
    res.json({
      success: true,
      data: {
        current_month: {
          period: {
            start: currentMonthStart.toISOString(),
            end: currentMonthEnd.toISOString()
          },
          users_registered: currentMonthUsers
        },
        previous_month: {
          period: {
            start: previousMonthStart.toISOString(),
            end: previousMonthEnd.toISOString()
          },
          users_registered: previousMonthUsers
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user analytics',
      error: error.message
    });
  }
};

// 3. Category Order Analytics: Current month order counts by category
const getCategoryOrderAnalytics = async (req, res) => {
  try {
    // Validate request
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }
    
    const { currentMonthStart, currentMonthEnd } = getDateRanges();
    
    // Get all categories
    const categories = await Category.find().sort({ name: 1 });
    
    // Get current month orders
    const currentMonthOrders = await Order.find({
      created_at: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });
    
    // Get order items for current month orders
    const orderIds = currentMonthOrders.map(order => order._id);
    const orderItems = await OrderItem.find({ order_id: { $in: orderIds } });
    
    // Get products for order items to get categories
    const productIds = [...new Set(orderItems.map(item => item.product_id))];
    const products = await Product.find({ 
      _id: { $in: productIds },
      status: { $ne: 'deleted' } // Exclude deleted products
    });
    
    // Create product ID to category ID mapping
    const productCategoryMap = {};
    products.forEach(product => {
      productCategoryMap[product._id.toString()] = product.category_id.toString();
    });
    
    // Count orders per category
    const categoryOrderCounts = {};
    categories.forEach(category => {
      categoryOrderCounts[category._id.toString()] = 0;
    });
    
    // Count orders by category
    orderItems.forEach(item => {
      const categoryId = productCategoryMap[item.product_id.toString()];
      if (categoryId && categoryOrderCounts[categoryId] !== undefined) {
        categoryOrderCounts[categoryId]++;
      }
    });
    
    // Format response
    const categoryAnalytics = categories.map(category => ({
      category: {
        _id: category._id,
        name: category.name,
        description: category.description
      },
      order_count: categoryOrderCounts[category._id.toString()] || 0
    }));
    
    res.json({
      success: true,
      data: {
        period: {
          start: currentMonthStart.toISOString(),
          end: currentMonthEnd.toISOString()
        },
        categories: categoryAnalytics
      }
    });
    
  } catch (error) {
    console.error('Error fetching category order analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category order analytics',
      error: error.message
    });
  }
};

// 4. Yearly Order Analytics: Monthly order counts for specified year vs previous year
const getYearlyOrderAnalytics = async (req, res) => {
  try {
    const { year } = req.params;
    
    // Validate year parameter
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({
        success: false,
        message: 'Year must be a valid number between 2020 and 2030'
      });
    }
    
    const { targetYearStart, targetYearEnd, previousYearStart, previousYearEnd } = getYearDateRanges(yearNum);
    
    // Get monthly order counts for target year
    const targetYearOrders = await Order.aggregate([
      {
        $match: {
          created_at: { $gte: targetYearStart, $lte: targetYearEnd }
        }
      },
      {
        $group: {
          _id: { $month: '$created_at' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Get monthly order counts for previous year
    const previousYearOrders = await Order.aggregate([
      {
        $match: {
          created_at: { $gte: previousYearStart, $lte: previousYearEnd }
        }
      },
      {
        $group: {
          _id: { $month: '$created_at' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Create monthly data arrays (January = 1, December = 12)
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const targetYearData = Array(12).fill(0);
    const previousYearData = Array(12).fill(0);
    
    targetYearOrders.forEach(item => {
      targetYearData[item._id - 1] = item.count;
    });
    
    previousYearOrders.forEach(item => {
      previousYearData[item._id - 1] = item.count;
    });
    
    // Format response
    const monthlyData = monthNames.map((month, index) => ({
      month: month,
      month_number: index + 1,
      target_year_count: targetYearData[index],
      previous_year_count: previousYearData[index]
    }));
    
    res.json({
      success: true,
      data: {
        target_year: parseInt(year),
        previous_year: parseInt(year) - 1,
        monthly_data: monthlyData
      }
    });
    
  } catch (error) {
    console.error('Error fetching yearly order analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching yearly order analytics',
      error: error.message
    });
  }
};

// 5. Dashboard Summary: Latest 5 orders, products, and payments
const getDashboardSummary = async (req, res) => {
  try {
    // Validate request
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }
    
    // Get latest 5 orders with full details
    const latestOrders = await Order.find()
      .populate('user_id', 'first_name last_name email')
      .populate('shipping_address_id')
      .sort({ created_at: -1 })
      .limit(5);
    
    // Get order items for all orders
    const orderIds = latestOrders.map(order => order._id);
    const orderItems = await OrderItem.find({ order_id: { $in: orderIds } });
    
    // Get delivery info for orders
    const deliveries = await Delivery.find({ order_id: { $in: orderIds } });
    
    // Attach order items and delivery to orders
    const ordersWithDetails = latestOrders.map(order => {
      const orderItemsForOrder = orderItems.filter(item => 
        item.order_id.toString() === order._id.toString()
      );
      const deliveryForOrder = deliveries.find(delivery => 
        delivery.order_id.toString() === order._id.toString()
      );
      
      return {
        ...order.toObject(),
        order_items: orderItemsForOrder,
        delivery: deliveryForOrder || null
      };
    });
    
    // Get latest 5 products with images
    const latestProducts = await Product.find({ status: { $ne: 'deleted' } })
      .populate('category_id', 'name')
      .sort({ created_at: -1 })
      .limit(5);
    
    // Get product images for all products
    const productIds = latestProducts.map(product => product._id);
    const productImages = await ProductImage.find({ product_id: { $in: productIds } });
    
    // Attach images to products
    const productsWithImages = latestProducts.map(product => {
      const imagesForProduct = productImages.filter(img => 
        img.product_id.toString() === product._id.toString()
      );
      
      return {
        ...product.toObject(),
        images: imagesForProduct
      };
    });
    
    // Get latest 5 payments (instead of invoices)
    // Since Payment model has no timestamps, we'll use a different approach
    let latestPayments = [];
    try {
      latestPayments = await Order.aggregate([
        {
          $lookup: {
            from: 'payments', // Collection name from Payment model
            localField: '_id',
            foreignField: 'order_id',
            as: 'payment'
          }
        },
        {
          $unwind: '$payment'
        },
        {
          $sort: { 'payment.paid_at': -1 } // Use paid_at instead of created_at
        },
        {
          $limit: 5
        },
        {
          $project: {
            order: {
              _id: '$_id',
              order_status: '$order_status',
              total_amount: '$total_amount',
              created_at: '$created_at'
            },
            payment: '$payment'
          }
        }
      ]);
    } catch (paymentError) {
      console.warn('Warning: Could not fetch payment data:', paymentError.message);
      // Continue without payment data
    }
    
    res.json({
      success: true,
      data: {
        latest_orders: ordersWithDetails,
        latest_products: productsWithImages,
        latest_payments: latestPayments
      }
    });
    
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard summary',
      error: error.message
    });
  }
};

// 6. Monthly Revenue: Current month revenue breakdown
const getMonthlyRevenue = async (req, res) => {
  try {
    // Validate request
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }
    
    const { currentMonthStart, currentMonthEnd } = getDateRanges();
    
    // Get current month orders
    const currentMonthOrders = await Order.find({
      created_at: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });
    
    // Calculate total orders and revenue
    const totalOrders = currentMonthOrders.length;
    const totalRevenue = currentMonthOrders.reduce((sum, order) => sum + order.total_amount, 0);
    
    // Get returned orders (status = 'return')
    const returnedOrders = currentMonthOrders.filter(order => order.order_status === 'return');
    const returnedOrdersCount = returnedOrders.length;
    const returnedOrdersRevenue = returnedOrders.reduce((sum, order) => sum + order.total_amount, 0);
    
    res.json({
      success: true,
      data: {
        period: {
          start: currentMonthStart.toISOString(),
          end: currentMonthEnd.toISOString()
        },
        total_orders: totalOrders,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        returned_orders: returnedOrdersCount,
        returned_orders_revenue: Math.round(returnedOrdersRevenue * 100) / 100
      }
    });
    
  } catch (error) {
    console.error('Error fetching monthly revenue:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly revenue',
      error: error.message
    });
  }
};

// 7. User Status Analytics: Total, Active, and Banned users count
const getUserStatusAnalytics = async (req, res) => {
  try {
    // Validate request
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }
    
    // Count total users (excluding admins - only regular users)
    const totalUsers = await User.countDocuments({
      is_admin: false
    });
    
    // Count active users (excluding admins)
    const activeUsers = await User.countDocuments({
      is_admin: false,
      status: 'active'
    });
    
    // Count banned users (excluding admins)
    const bannedUsers = await User.countDocuments({
      is_admin: false,
      status: 'banned'
    });
    
    res.json({
      success: true,
      data: {
        total_users: totalUsers,
        active_users: activeUsers,
        banned_users: bannedUsers
      }
    });
    
  } catch (error) {
    console.error('Error fetching user status analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user status analytics',
      error: error.message
    });
  }
};

module.exports = {
  getOrderAnalytics,
  getUserAnalytics,
  getCategoryOrderAnalytics,
  getYearlyOrderAnalytics,
  getDashboardSummary,
  getMonthlyRevenue,
  getUserStatusAnalytics
}; 