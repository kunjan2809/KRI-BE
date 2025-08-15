const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Product = require('../models/Product');
const User = require('../models/User');
const ShippingAddress = require('../models/ShippingAddress');
const Delivery = require('../models/Delivery');

// 1. User Order Creation API (No login required)
const createOrder = async (req, res) => {
  try {
    const {
      customer_info, // { first_name, last_name, email, mobile_number }
      shipping_address_id,
      products // [{ product_id, quantity }]
    } = req.body;

    // Validate required fields
    if (!customer_info || !shipping_address_id || !products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer info, shipping address, and products are required'
      });
    }

    // Check if user exists with the provided email
    let user = await User.findOne({ email: customer_info.email });
    
    if (!user) {
      // Create new user if doesn't exist
      user = new User({
        first_name: customer_info.first_name,
        last_name: customer_info.last_name,
        email: customer_info.email,
        mobile_number: customer_info.mobile_number,
        password: 'temp_password_' + Math.random().toString(36).substring(2, 15), // Temporary password
        is_admin: false
      });
      await user.save();
    }

    // Validate shipping address exists
    const shippingAddress = await ShippingAddress.findById(shipping_address_id);
    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address not found'
      });
    }

    // Process products and calculate totals
    let totalAmount = 0;
    let orderDiscountType = null;
    let orderDiscountRate = 0;
    const orderItems = [];

    for (const item of products) {
      const product = await Product.findById(item.product_id);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product with ID ${item.product_id} not found`
        });
      }

      if (product.stock_quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ${product.name}. Available: ${product.stock_quantity}, Requested: ${item.quantity}`
        });
      }

      // Calculate item price with product discount
      let itemPrice = product.final_price;
      let itemDiscountType = product.discount_type;
      let itemDiscountRate = product.discount_rate;

      // Apply product discount if exists
      if (itemDiscountType && itemDiscountRate) {
        if (itemDiscountType === 'price') {
          itemPrice = Math.max(0, product.price - itemDiscountRate);
        } else if (itemDiscountType === 'percentage') {
          itemPrice = product.price * (1 - itemDiscountRate / 100);
        }
      }

      const itemTotal = itemPrice * item.quantity;
      totalAmount += itemTotal;

      // Store order item data
      orderItems.push({
        product_id: product._id,
        product_name_snapshot: product.name,
        product_price_snapshot: product.price,
        quantity: item.quantity,
        price: itemTotal
      });

      // Reduce stock quantity
      product.stock_quantity -= item.quantity;
      await product.save();
    }

    // Create order
    const order = new Order({
      user_id: user._id,
      shipping_address_id,
      order_status: 'draft',
      payment_status: 'unpaid',
      total_amount: totalAmount,
      discount_type: orderDiscountType,
      discount_rate: orderDiscountRate
    });

    await order.save();

    // Create order items
    const savedOrderItems = await OrderItem.insertMany(
      orderItems.map(item => ({
        ...item,
        order_id: order._id
      }))
    );

    // Populate order with related data including complete shipping address
    const populatedOrder = await Order.findById(order._id)
      .populate('user_id', 'first_name last_name email mobile_number')
      .populate({
        path: 'shipping_address_id',
        select: 'full_name mobile_number address_line_1 address_line_2 landmark city state postal_code country is_default formatted_address'
      })
      .populate({
        path: 'order_items',
        populate: {
          path: 'product_id',
          select: 'name sku description price discount_type discount_rate'
        }
      });

    res.status(201).json({
      success: true,
      message: 'Order created successfully as draft',
      data: {
        order: populatedOrder,
        order_items: savedOrderItems
      }
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
};

// 2. User Order History API (Login required)
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.userId; // From JWT token
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user_id: userId })
      .populate({
        path: 'shipping_address_id',
        select: 'full_name mobile_number address_line_1 address_line_2 landmark city state postal_code country is_default formatted_address'
      })
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Get order items and delivery info for each order
    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const orderItems = await OrderItem.find({ order_id: order._id })
          .populate('product_id', 'name sku description price');
        
        // Get delivery information if exists
        const delivery = await Delivery.findOne({ order_id: order._id })
          .populate('shipping_address_id');
        
        return {
          ...order.toObject(),
          order_items: orderItems,
          delivery: delivery || null
        };
      })
    );

    // Get total count for pagination
    const totalOrders = await Order.countDocuments({ user_id: userId });

    res.json({
      success: true,
      data: {
        orders: ordersWithDetails,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalOrders / limit),
          total_orders: totalOrders,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user orders',
      error: error.message
    });
  }
};

// 3. Admin Orders API (Admin only with filters, pagination, search)
const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      payment_status,
      start_date,
      end_date,
      search,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    
    // Build filter query
    let filterQuery = {};
    
    if (status) {
      filterQuery.order_status = status;
    }
    
    if (payment_status) {
      filterQuery.payment_status = payment_status;
    }
    
    if (start_date || end_date) {
      filterQuery.created_at = {};
      if (start_date) {
        filterQuery.created_at.$gte = new Date(start_date);
      }
      if (end_date) {
        filterQuery.created_at.$lte = new Date(end_date);
      }
    }

    // Build search query - search in populated fields after population
    let searchQuery = {};
    if (search) {
      // First, find orders that match basic criteria
      searchQuery.$or = [
        { _id: { $regex: search, $options: 'i' } }
      ];
    }

    // Combine filters and search
    const finalQuery = { ...filterQuery, ...searchQuery };

    // Build sort object
    const sortObject = {};
    sortObject[sort_by] = sort_order === 'desc' ? -1 : 1;

    // Execute query with pagination
    const orders = await Order.find(finalQuery)
      .populate('user_id', 'first_name last_name email mobile_number')
      .populate({
        path: 'shipping_address_id',
        select: 'full_name mobile_number address_line_1 address_line_2 landmark city state postal_code country is_default formatted_address'
      })
      .sort(sortObject)
      .limit(parseInt(limit))
      .skip(skip);

    // Apply search filtering on populated data if search term exists
    let filteredOrders = orders;
    if (search) {
      filteredOrders = orders.filter(order => {
        const user = order.user_id;
        const address = order.shipping_address_id;
        
        return (
          order._id.toString().toLowerCase().includes(search.toLowerCase()) ||
          (user && (
            user.first_name.toLowerCase().includes(search.toLowerCase()) ||
            user.last_name.toLowerCase().includes(search.toLowerCase())
          )) ||
          (address && (
            address.city.toLowerCase().includes(search.toLowerCase()) ||
            address.state.toLowerCase().includes(search.toLowerCase()) ||
            address.address_line_1.toLowerCase().includes(search.toLowerCase())
          ))
        );
      });
    }

    // Get order items, product details, and delivery info for each order
    const ordersWithDetails = await Promise.all(
      filteredOrders.map(async (order) => {
        const orderItems = await OrderItem.find({ order_id: order._id })
          .populate('product_id', 'name sku description price discount_type discount_rate stock_quantity');
        
        // Get delivery information if exists
        const delivery = await Delivery.findOne({ order_id: order._id })
          .populate('shipping_address_id');
        
        return {
          ...order.toObject(),
          order_items: orderItems,
          delivery: delivery || null
        };
      })
    );

    // Get total count for pagination (after search filtering)
    const totalOrders = search ? filteredOrders.length : await Order.countDocuments(finalQuery);

    res.json({
      success: true,
      data: {
        orders: ordersWithDetails,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalOrders / limit),
          total_orders: totalOrders,
          limit: parseInt(limit)
        },
        filters: {
          status,
          payment_status,
          start_date,
          end_date,
          search
        },
        sorting: {
          sort_by,
          sort_order
        }
      }
    });

  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
};

// 4. Admin Get Order Details API (Admin only)
const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find the order with all related data
    const order = await Order.findById(orderId)
      .populate('user_id') // Get complete user data
      .populate('shipping_address_id'); // Get complete shipping address data

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get order items with complete product details
    const orderItems = await OrderItem.find({ order_id: orderId })
      .populate({
        path: 'product_id',
        select: 'name sku description price discount_type discount_rate stock_quantity color weight status category_id'
      });

    // Get delivery information if exists
    const delivery = await Delivery.findOne({ order_id: orderId });

    // Prepare response with all requested data
    const orderDetails = {
      // Order details
      order: {
        _id: order._id,
        order_status: order.order_status,
        delivered_at: order.delivered_at,
        payment_status: order.payment_status,
        discount_type: order.discount_type,
        discount_rate: order.discount_rate,
        total_amount: order.total_amount,
        created_at: order.created_at
      },
      // User details
      user: order.user_id,
      // Shipping address details
      shipping_address: order.shipping_address_id,
      // Order items with product details
      order_items: orderItems,
      // Delivery information (only requested fields)
      delivery: delivery ? {
        delivery_by: delivery.delivery_by,
        speed: delivery.speed,
        tracking_number: delivery.tracking_number
      } : null
    };

    res.json({
      success: true,
      data: orderDetails
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order details',
      error: error.message
    });
  }
};

// 5. Create or Update Delivery API (Admin only)
const createOrUpdateDelivery = async (req, res) => {
  try {
    const {
      delivery_id, // Optional - if provided, update existing record
      order_id,
      shipping_address_id,
      delivery_by,
      speed,
      tracking_number
    } = req.body;

    // Validate required fields
    if (!order_id || !shipping_address_id || !delivery_by || !speed || !tracking_number) {
      return res.status(400).json({
        success: false,
        message: 'Order ID, shipping address ID, delivery company, speed, and tracking number are required'
      });
    }

    // Validate order exists
    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Validate shipping address exists
    const shippingAddress = await ShippingAddress.findById(shipping_address_id);
    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address not found'
      });
    }

    let delivery;
    let isUpdate = false;

    if (delivery_id) {
      // Update existing delivery record
      delivery = await Delivery.findById(delivery_id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: 'Delivery record not found'
        });
      }
      
      // Update the fields
      delivery.order_id = order_id;
      delivery.shipping_address_id = shipping_address_id;
      delivery.delivery_by = delivery_by;
      delivery.speed = speed;
      delivery.tracking_number = tracking_number;
      
      isUpdate = true;
    } else {
      // Create new delivery record
      delivery = new Delivery({
        order_id,
        shipping_address_id,
        delivery_by,
        speed,
        tracking_number
      });
    }

    await delivery.save();

    // Populate the delivery record for response
    const populatedDelivery = await Delivery.findById(delivery._id)
      .populate('shipping_address_id');

    res.json({
      success: true,
      message: isUpdate ? 'Delivery updated successfully' : 'Delivery created successfully',
      data: {
        delivery: populatedDelivery
      }
    });

  } catch (error) {
    console.error('Error creating/updating delivery:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating/updating delivery',
      error: error.message
    });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getAllOrders,
  getOrderDetails,
  createOrUpdateDelivery
}; 