const Cart = require('../models/Cart');
const Product = require('../models/Product');
const ProductVariation = require('../models/ProductVariation');
const ProductImage = require('../models/ProductImage');
const ProductReview = require('../models/ProductReview');

// 1. Get Cart Items
const getCartItems = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all cart items for the user with populated product data
    const cartItems = await Cart.find({ user_id: userId })
      .populate({
        path: 'product_id',
        select: 'name sku price mrp discount_type discount_rate stock_quantity status',
        populate: {
          path: 'category_id',
          select: 'name'
        }
      })
      .populate('variation_id', 'color size price price_adjustment stock_quantity sku status')
      .sort({ added_at: -1 });

    // Calculate totals and format response with comprehensive product data
    const formattedCartItems = await Promise.all(
      cartItems.map(async (item) => {
        const product = item.product_id;
        
        // Skip if product is deleted or not published
        if (!product || product.status === 'deleted') {
          return null;
        }

        // Get comprehensive product data (same as productController)
        const [primaryImage, allImages, variations, reviewOverview] = await Promise.all([
          ProductImage.getPrimaryImage(product._id),
          ProductImage.getProductImages(product._id),
          ProductVariation.getProductVariations(product._id),
          ProductReview.getProductAverageRating(product._id)
        ]);

        // Calculate review overview
        const reviewData = reviewOverview.length > 0 ? reviewOverview[0] : { 
          averageRating: 0, 
          totalReviews: 0 
        };

        // Calculate final price
        let finalPrice = product.price;
        if (product.discount_type === 'price') {
          finalPrice = Math.max(0, product.price - product.discount_rate);
        } else if (product.discount_type === 'percentage') {
          finalPrice = product.price * (1 - product.discount_rate / 100);
        }

        // Apply variation price adjustment if exists
        if (item.variation_id && item.variation_id.price_adjustment) {
          finalPrice += item.variation_id.price_adjustment;
        }

        // Check stock availability
        const availableStock = item.variation_id 
          ? item.variation_id.stock_quantity 
          : product.stock_quantity;

        const itemTotal = finalPrice * item.quantity;

        return {
          id: item._id,
          product: {
            id: product._id,
            name: product.name,
            sku: product.sku,
            description: product.description,
            product_description: product.product_description,
            price: product.price,
            mrp: product.mrp,
            final_price: Math.round(finalPrice * 100) / 100,
            discount_type: product.discount_type,
            discount_rate: product.discount_rate,
            discount_amount: product.discount_type === 'price' ? product.discount_rate : (product.price * (product.discount_rate / 100)),
            stock_quantity: availableStock,
            in_stock: availableStock > 0,
            low_stock: availableStock > 0 && availableStock <= 10,
            weight: product.weight,
            status: product.status,
            featured: product.featured,
            category: product.category_id,
            primary_image: primaryImage || null,
            all_images: allImages || [],
            variations: variations || [],
            review_overview: {
              average_rating: reviewData.averageRating || 0,
              total_reviews: reviewData.totalReviews || 0
            },
            created_at: product.created_at,
            edited_at: product.edited_at
          },
          variation: item.variation_id ? {
            id: item.variation_id._id,
            color: item.variation_id.color,
            size: item.variation_id.size,
            price: item.variation_id.price,
            price_adjustment: item.variation_id.price_adjustment,
            stock_quantity: item.variation_id.stock_quantity,
            sku: item.variation_id.sku,
            status: item.variation_id.status
          } : null,
          quantity: item.quantity,
          item_total: Math.round(itemTotal * 100) / 100,
          added_at: item.added_at,
          updated_at: item.updated_at
        };
      })
    );

    // Filter out null items (deleted products)
    const validCartItems = formattedCartItems.filter(item => item !== null);

    // Calculate cart totals
    const cartTotal = validCartItems.reduce((sum, item) => sum + item.item_total, 0);
    const totalItems = validCartItems.reduce((sum, item) => sum + item.quantity, 0);

    res.json({
      success: true,
      data: {
        cart_items: validCartItems,
        cart_summary: {
          total_items: totalItems,
          cart_total: Math.round(cartTotal * 100) / 100,
          items_count: validCartItems.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cart items',
      error: error.message
    });
  }
};

// 2. Add Item to Cart
const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { product_id, quantity = 1, variation_id } = req.body;

    // Validate required fields
    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Validate quantity
    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    // Check if product exists and is published
    const product = await Product.findOne({
      _id: product_id,
      status: 'published',
      deleted_at: null
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not available'
      });
    }

    // Check variation if provided (active variations only)
    if (variation_id) {
      const variation = await ProductVariation.findOne({
        _id: variation_id,
        product_id: product_id,
        status: 'active',
        deleted_at: null
      });

      if (!variation) {
        return res.status(404).json({
          success: false,
          message: 'Product variation not found'
        });
      }

      // Check variation stock
      if (variation.stock_quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${variation.stock_quantity} items available in stock for this variation`
        });
      }
    } else {
      // Check product stock
      if (product.stock_quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock_quantity} items available in stock`
        });
      }
    }

    // Check if item already exists in cart
    const existingCartItem = await Cart.findOne({
      user_id: userId,
      product_id: product_id,
      variation_id: variation_id || null
    });

    if (existingCartItem) {
      // Update quantity
      const newQuantity = existingCartItem.quantity + quantity;
      const availableStock = variation_id 
        ? (await ProductVariation.findOne({ 
            _id: variation_id, 
            status: 'active', 
            deleted_at: null 
          })).stock_quantity
        : product.stock_quantity;

      if (newQuantity > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add ${quantity} more items. Only ${availableStock - existingCartItem.quantity} additional items available`
        });
      }

      existingCartItem.quantity = newQuantity;
      await existingCartItem.save();

      res.json({
        success: true,
        message: 'Cart item quantity updated successfully',
        data: {
          cart_item: {
            id: existingCartItem._id,
            product_id: existingCartItem.product_id,
            variation_id: existingCartItem.variation_id,
            quantity: existingCartItem.quantity,
            updated_at: existingCartItem.updated_at
          }
        }
      });
    } else {
      // Create new cart item
      const cartItem = new Cart({
        user_id: userId,
        product_id: product_id,
        variation_id: variation_id || null,
        quantity: quantity
      });

      await cartItem.save();

      res.status(201).json({
        success: true,
        message: 'Item added to cart successfully',
        data: {
          cart_item: {
            id: cartItem._id,
            product_id: cartItem.product_id,
            variation_id: cartItem.variation_id,
            quantity: cartItem.quantity,
            added_at: cartItem.added_at
          }
        }
      });
    }

  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding item to cart',
      error: error.message
    });
  }
};

// 3. Update Cart Item Quantity
const updateCartItemQuantity = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    // Validate quantity
    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    // Find cart item
    const cartItem = await Cart.findOne({
      _id: cartItemId,
      user_id: userId
    }).populate('product_id').populate('variation_id');

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    // Check stock availability
    const availableStock = cartItem.variation_id 
      ? cartItem.variation_id.stock_quantity
      : cartItem.product_id.stock_quantity;

    if (quantity > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} items available in stock`
      });
    }

    // Update quantity
    cartItem.quantity = quantity;
    await cartItem.save();

    res.json({
      success: true,
      message: 'Cart item quantity updated successfully',
      data: {
        cart_item: {
          id: cartItem._id,
          product_id: cartItem.product_id._id,
          variation_id: cartItem.variation_id?._id,
          quantity: cartItem.quantity,
          updated_at: cartItem.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Error updating cart item quantity:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating cart item quantity',
      error: error.message
    });
  }
};

// 4. Remove Item from Cart
const removeFromCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cartItemId } = req.params;

    // Find and delete cart item
    const cartItem = await Cart.findOneAndDelete({
      _id: cartItemId,
      user_id: userId
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: {
        removed_item: {
          id: cartItem._id,
          product_id: cartItem.product_id,
          variation_id: cartItem.variation_id
        }
      }
    });

  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing item from cart',
      error: error.message
    });
  }
};

// 5. Clear Cart
const clearCart = async (req, res) => {
  try {
    const userId = req.user._id;

    // Delete all cart items for the user
    const result = await Cart.deleteMany({ user_id: userId });

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: {
        deleted_items_count: result.deletedCount
      }
    });

  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing cart',
      error: error.message
    });
  }
};

module.exports = {
  getCartItems,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart
};
