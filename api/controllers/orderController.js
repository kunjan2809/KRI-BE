const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Product = require('../models/Product');
const ProductVariation = require('../models/ProductVariation');
const ShippingAddress = require('../models/ShippingAddress');
const Cart = require('../models/Cart');
const ReturnRequest = require('../models/ReturnRequest');

// 1. Place Order from Cart (Authenticated)
const placeOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cart_item_ids, shipping_address_id, payment_method = 'cod', discount_type, discount_rate } = req.body;

    // Validate required fields
    if (!cart_item_ids || !Array.isArray(cart_item_ids) || cart_item_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart item IDs are required and must be a non-empty array'
      });
    }

    if (!shipping_address_id) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address ID is required'
      });
    }

    // Validate payment method
    const validPaymentMethods = ['cod', 'paid', 'unpaid'];
    if (!validPaymentMethods.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: `Payment method must be one of: ${validPaymentMethods.join(', ')}`
      });
    }

    // Validate shipping address belongs to user and is not deleted
    const shippingAddress = await ShippingAddress.findOne({
      _id: shipping_address_id,
      user_id: userId,
      deleted_at: null
    });

    if (!shippingAddress) {
      return res.status(404).json({
        success: false,
        message: 'Shipping address not found or does not belong to you'
      });
    }

    // Get cart items for the user
    const cartItems = await Cart.find({
      _id: { $in: cart_item_ids },
      user_id: userId
    })
      .populate('product_id')
      .populate('variation_id');

    if (cartItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid cart items found'
      });
    }

    if (cartItems.length !== cart_item_ids.length) {
      return res.status(400).json({
        success: false,
        message: 'Some cart items were not found or do not belong to you'
      });
    }

    // Process each cart item and validate stock
    let totalAmount = 0;
    const orderItems = [];
    const productsToUpdate = [];
    const variationsToUpdate = [];

    for (const cartItem of cartItems) {
      const product = cartItem.product_id;
      const variation = cartItem.variation_id;

      // Validate product exists and is published
      if (!product || product.status !== 'published' || product.deleted_at) {
        return res.status(400).json({
          success: false,
          message: `Product ${product?.name || 'Unknown'} is not available`
        });
      }

      // Check stock availability
      let availableStock;
      let finalPrice;
      let productPriceSnapshot;

      if (variation) {
        // Validate variation exists and is active
        if (variation.status !== 'active' || variation.deleted_at) {
          return res.status(400).json({
            success: false,
            message: `Variation for product ${product.name} is not available`
          });
        }

        availableStock = variation.stock_quantity;
        productPriceSnapshot = variation.price;
        finalPrice = variation.price;

        // Check stock
        if (availableStock < cartItem.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name} (${variation.color} - ${variation.size}). Available: ${availableStock}, Requested: ${cartItem.quantity}`
          });
        }

        variationsToUpdate.push({
          variation,
          quantity: cartItem.quantity
        });
      } else {
        availableStock = product.stock_quantity;
        productPriceSnapshot = product.price;

        // Calculate final price with product discount
        finalPrice = product.price;
        if (product.discount_type === 'price') {
          finalPrice = Math.max(0, product.price - product.discount_rate);
        } else if (product.discount_type === 'percentage') {
          finalPrice = product.price * (1 - product.discount_rate / 100);
        }

        // Check stock
        if (availableStock < cartItem.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${cartItem.quantity}`
          });
        }

        productsToUpdate.push({
          product,
          quantity: cartItem.quantity
        });
      }

      const itemTotal = Math.round(finalPrice * cartItem.quantity * 100) / 100;
      totalAmount += itemTotal;

      // Prepare order item data
      orderItems.push({
        product_id: product._id,
        variation_id: variation ? variation._id : null,
        product_name_snapshot: product.name,
        product_price_snapshot: productPriceSnapshot,
        quantity: cartItem.quantity,
        price: itemTotal
      });
    }

    // Apply order-level discount if provided
    let finalTotalAmount = totalAmount;
    if (discount_type && discount_rate !== undefined) {
      if (discount_type === 'price') {
        finalTotalAmount = Math.max(0, totalAmount - discount_rate);
      } else if (discount_type === 'percentage') {
        finalTotalAmount = totalAmount * (1 - discount_rate / 100);
      }
      finalTotalAmount = Math.round(finalTotalAmount * 100) / 100;
    }

    // Set payment status based on payment method
    let paymentStatus = 'unpaid';
    if (payment_method === 'cod') {
      paymentStatus = 'cod';
    } else if (payment_method === 'paid') {
      paymentStatus = 'paid';
    }

    // Create order
    const order = new Order({
      user_id: userId,
      shipping_address_id,
      order_status: 'pending',
      payment_status: paymentStatus,
      total_amount: finalTotalAmount,
      discount_type: discount_type || null,
      discount_rate: discount_rate || 0
    });

    await order.save();

    // Create order items
    const savedOrderItems = await OrderItem.insertMany(
      orderItems.map(item => ({
        ...item,
        order_id: order._id
      }))
    );

    // Reduce stock quantities
    for (const { product, quantity } of productsToUpdate) {
      product.stock_quantity -= quantity;
      await product.save();
    }

    for (const { variation, quantity } of variationsToUpdate) {
      variation.stock_quantity -= quantity;
      await variation.save();
    }

    // Remove cart items
    await Cart.deleteMany({
      _id: { $in: cart_item_ids },
      user_id: userId
    });

    // Populate order for response
    const populatedOrder = await Order.findById(order._id)
      .populate('user_id', 'first_name last_name email mobile_number')
      .populate({
        path: 'shipping_address_id',
        select: 'full_name mobile_number address_line_1 address_line_2 landmark city state postal_code country is_default formatted_address'
      });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        order: populatedOrder,
        order_items: savedOrderItems
      }
    });

  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({
      success: false,
      message: 'Error placing order',
      error: error.message
    });
  }
};

// 2. Get All Orders for User (Authenticated)
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;

    const skip = (page - 1) * limit;
    const filterQuery = { user_id: userId };

    if (status) {
      filterQuery.order_status = status;
    }

    const orders = await Order.find(filterQuery)
      .populate({
        path: 'shipping_address_id',
        select: 'full_name mobile_number address_line_1 address_line_2 landmark city state postal_code country is_default formatted_address'
      })
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Get order items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const orderItems = await OrderItem.find({ order_id: order._id })
          .populate('product_id', 'name sku')
          .populate('variation_id', 'color size');

        return {
          ...order.toObject(),
          order_items: orderItems
        };
      })
    );

    const totalOrders = await Order.countDocuments(filterQuery);

    res.json({
      success: true,
      data: {
        orders: ordersWithItems,
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

// 3. Get Order Details (Authenticated)
const getOrderDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;

    // Find order and ensure it belongs to the user
    const order = await Order.findOne({
      _id: orderId,
      user_id: userId
    })
      .populate('user_id', 'first_name last_name email mobile_number')
      .populate({
        path: 'shipping_address_id',
        select: 'full_name mobile_number address_line_1 address_line_2 landmark city state postal_code country is_default formatted_address'
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get order items with product and variation details
    const orderItems = await OrderItem.find({ order_id: orderId })
      .populate('product_id', 'name sku description')
      .populate('variation_id', 'color size');

    res.json({
      success: true,
      data: {
        order: order.toObject(),
        order_items: orderItems
      }
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error fetching order details',
      error: error.message
    });
  }
};

// 4. Cancel Order (Authenticated - User can only cancel pending orders)
const cancelOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;

    // Find order and ensure it belongs to the user
    const order = await Order.findOne({
      _id: orderId,
      user_id: userId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order can be cancelled (only pending orders)
    if (order.order_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled. Current status: ${order.order_status}. Only pending orders can be cancelled.`
      });
    }

    // Get order items to restore stock
    const orderItems = await OrderItem.find({ order_id: orderId })
      .populate('product_id')
      .populate('variation_id');

    // Restore stock quantities
    for (const item of orderItems) {
      if (item.variation_id) {
        const variation = item.variation_id;
        variation.stock_quantity += item.quantity;
        await variation.save();
      } else if (item.product_id) {
        const product = item.product_id;
        product.stock_quantity += item.quantity;
        await product.save();
      }
    }

    // Update order status to cancelled
    order.order_status = 'cancelled';
    await order.save();

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: {
        order: order
      }
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error cancelling order',
      error: error.message
    });
  }
};

// 5. Update Order Status (Admin Only)
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { order_status } = req.body;

    // Validate order status
    const validStatuses = ['pending', 'shipped', 'cancelled', 'delivered', 'return'];
    if (!validStatuses.includes(order_status)) {
      return res.status(400).json({
        success: false,
        message: `Order status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // If cancelling, restore stock
    if (order_status === 'cancelled' && order.order_status !== 'cancelled') {
      const orderItems = await OrderItem.find({ order_id: orderId })
        .populate('product_id')
        .populate('variation_id');

      for (const item of orderItems) {
        if (item.variation_id) {
          const variation = item.variation_id;
          variation.stock_quantity += item.quantity;
          await variation.save();
        } else if (item.product_id) {
          const product = item.product_id;
          product.stock_quantity += item.quantity;
          await product.save();
        }
      }
    }

    // Update order status
    await order.updateStatus(order_status);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        order: order
      }
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating order status',
      error: error.message
    });
  }
};

// 6. Create Return Request (Authenticated)
const createReturnRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;
    const { order_item_id, reason, return_type, notes } = req.body;

    // Validate required fields
    if (!orderId || !order_item_id || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Order ID, order item ID, and reason are required'
      });
    }

    // Validate order belongs to user and is delivered
    const order = await Order.findOne({
      _id: orderId,
      user_id: userId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.order_status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Return can only be requested for delivered orders'
      });
    }

    // Validate order item belongs to the order
    const orderItem = await OrderItem.findOne({
      _id: order_item_id,
      order_id: orderId
    });

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found or does not belong to this order'
      });
    }

    // Check if return request already exists for this order item
    const existingReturn = await ReturnRequest.findOne({
      order_id: orderId,
      order_item_id: order_item_id,
      status: { $in: ['requested', 'approved'] }
    });

    if (existingReturn) {
      return res.status(400).json({
        success: false,
        message: 'A return request already exists for this order item'
      });
    }

    // Create return request
    const returnRequest = new ReturnRequest({
      user_id: userId,
      order_id: orderId,
      order_item_id: order_item_id,
      reason,
      return_type: return_type || 'Other',
      notes: notes || null,
      status: 'requested'
    });

    await returnRequest.save();

    // Update order status to 'return'
    if (order.order_status !== 'return') {
      order.order_status = 'return';
      await order.save();
    }

    // Populate return request for response
    const populatedReturn = await ReturnRequest.findById(returnRequest._id)
      .populate('order_id', 'order_number order_status total_amount')
      .populate('order_item_id', 'product_name_snapshot quantity price');

    res.status(201).json({
      success: true,
      message: 'Return request created successfully',
      data: {
        return_request: populatedReturn
      }
    });

  } catch (error) {
    console.error('Error creating return request:', error);
    
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
      message: 'Error creating return request',
      error: error.message
    });
  }
};

// 7. Get User Return Requests (Authenticated)
const getUserReturnRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;

    const skip = (page - 1) * limit;
    const filterQuery = { user_id: userId };

    if (status) {
      filterQuery.status = status;
    }

    const returnRequests = await ReturnRequest.find(filterQuery)
      .populate('order_id', 'order_number order_status total_amount created_at')
      .populate('order_item_id', 'product_name_snapshot quantity price')
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const totalReturns = await ReturnRequest.countDocuments(filterQuery);

    res.json({
      success: true,
      data: {
        return_requests: returnRequests,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalReturns / limit),
          total_returns: totalReturns,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching return requests:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching return requests',
      error: error.message
    });
  }
};

// 8. Get All Orders (Admin Only) - with filtering, sorting, pagination, and search
const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      order_status, // Filter by order status: pending, shipped, cancelled, delivered, return
      payment_status, // Filter by payment status: paid, cod, unpaid, refunded
      search, // Search by order_number, user name, user email
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build filter query
    let filterQuery = {};

    // Order status filter
    if (order_status) {
      const validStatuses = ['pending', 'shipped', 'cancelled', 'delivered', 'return'];
      if (validStatuses.includes(order_status)) {
        filterQuery.order_status = order_status;
      }
    }

    // Payment status filter
    if (payment_status) {
      const validPaymentStatuses = ['paid', 'cod', 'unpaid', 'refunded'];
      if (validPaymentStatuses.includes(payment_status)) {
        filterQuery.payment_status = payment_status;
      }
    }

    // Build sort object
    const sortObject = {};
    const validSortFields = ['created_at', 'total_amount', 'order_status', 'payment_status', 'order_number'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    sortObject[sortField] = sort_order === 'desc' ? -1 : 1;

    // Handle search functionality (order_number, user name, user email)
    let orders;
    let totalOrders;

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const isObjectId = search.match(/^[0-9a-fA-F]{24}$/);

      if (isObjectId) {
        // If search is ObjectId, search by user_id directly
        filterQuery.user_id = search;
        orders = await Order.find(filterQuery)
          .sort(sortObject)
          .limit(parseInt(limit))
          .skip(skip);
        totalOrders = await Order.countDocuments(filterQuery);
      } else {
        // Use aggregation to search in order_number and user fields (name, email)
        const aggregationPipeline = [
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $unwind: {
              path: '$user',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $match: {
              ...filterQuery,
              $or: [
                { order_number: searchRegex },
                { 'user.first_name': searchRegex },
                { 'user.last_name': searchRegex },
                { 'user.email': searchRegex }
              ]
            }
          },
          {
            $sort: sortObject
          },
          {
            $skip: skip
          },
          {
            $limit: parseInt(limit)
          }
        ];

        const countPipeline = [
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $unwind: {
              path: '$user',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $match: {
              ...filterQuery,
              $or: [
                { order_number: searchRegex },
                { 'user.first_name': searchRegex },
                { 'user.last_name': searchRegex },
                { 'user.email': searchRegex }
              ]
            }
          },
          {
            $count: 'total'
          }
        ];

        orders = await Order.aggregate(aggregationPipeline);
        const countResult = await Order.aggregate(countPipeline);
        totalOrders = countResult.length > 0 ? countResult[0].total : 0;

        // Convert aggregation results to Mongoose documents for population
        const orderIds = orders.map(order => order._id);
        orders = await Order.find({ _id: { $in: orderIds } })
          .sort(sortObject);
      }
    } else {
      // Regular query without search
      orders = await Order.find(filterQuery)
        .sort(sortObject)
        .limit(parseInt(limit))
        .skip(skip);

      totalOrders = await Order.countDocuments(filterQuery);
    }

    // Populate orders with user, shipping address, and order items
    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const orderObj = order.toObject ? order.toObject() : order;
        
        // Populate user
        const populatedOrder = await Order.findById(orderObj._id)
          .populate('user_id', 'first_name last_name email mobile_number profile_icon')
          .populate({
            path: 'shipping_address_id',
            select: 'full_name mobile_number address_line_1 address_line_2 landmark city state postal_code country is_default formatted_address'
          });

        if (!populatedOrder) {
          return null;
        }

        // Get order items
        const orderItems = await OrderItem.find({ order_id: orderObj._id })
          .populate('product_id', 'name sku')
          .populate('variation_id', 'color size');

        return {
          ...populatedOrder.toObject(),
          order_items: orderItems
        };
      })
    );

    // Filter out any null values (in case an order was deleted)
    const filteredOrders = ordersWithDetails.filter(order => order !== null);

    res.json({
      success: true,
      data: {
        orders: filteredOrders,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalOrders / limit),
          total_orders: totalOrders,
          limit: parseInt(limit)
        },
        filters: {
          order_status: order_status || null,
          payment_status: payment_status || null,
          search: search || null
        },
        sorting: {
          sort_by: sortField,
          sort_order: sort_order
        }
      }
    });

  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching all orders',
      error: error.message
    });
  }
};

// 9. Get Order Details by ID (Admin Only) - Admin can view any order
const getOrderDetailsAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find order (admin can view any order)
    const order = await Order.findById(orderId)
      .populate('user_id', 'first_name last_name email mobile_number profile_icon')
      .populate({
        path: 'shipping_address_id',
        select: 'full_name mobile_number address_line_1 address_line_2 landmark city state postal_code country is_default formatted_address'
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get order items with product and variation details
    const orderItems = await OrderItem.find({ order_id: orderId })
      .populate('product_id', 'name sku description')
      .populate('variation_id', 'color size');

    res.json({
      success: true,
      data: {
        order: order.toObject(),
        order_items: orderItems
      }
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error fetching order details',
      error: error.message
    });
  }
};

module.exports = {
  placeOrder,
  getUserOrders,
  getOrderDetails,
  cancelOrder,
  updateOrderStatus,
  createReturnRequest,
  getUserReturnRequests,
  getAllOrders,
  getOrderDetailsAdmin
};
