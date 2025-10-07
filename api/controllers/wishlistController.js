const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
const ProductVariation = require('../models/ProductVariation');
const ProductReview = require('../models/ProductReview');

// 1. Get Wishlist Items
const getWishlistItems = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all wishlist items for the user with populated product data
    const wishlistItems = await Wishlist.find({ user_id: userId })
      .populate({
        path: 'product_id',
        select: 'name sku price mrp discount_type discount_rate stock_quantity status',
        populate: {
          path: 'category_id',
          select: 'name'
        }
      })
      .sort({ added_at: -1 });

    // Format response with comprehensive product data
    const formattedWishlistItems = await Promise.all(
      wishlistItems
        .filter(item => item.product_id && item.product_id.status !== 'deleted')
        .map(async (item) => {
          const product = item.product_id;
          
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
              stock_quantity: product.stock_quantity,
              in_stock: product.stock_quantity > 0,
              low_stock: product.stock_quantity > 0 && product.stock_quantity <= 10,
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
            added_at: item.added_at
          };
        })
    );

    res.json({
      success: true,
      data: {
        wishlist_items: formattedWishlistItems,
        wishlist_summary: {
          items_count: formattedWishlistItems.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching wishlist items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching wishlist items',
      error: error.message
    });
  }
};

// 2. Add Item to Wishlist
const addToWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { product_id } = req.body;

    // Validate required fields
    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
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

    // Check if item already exists in wishlist
    const existingWishlistItem = await Wishlist.findOne({
      user_id: userId,
      product_id: product_id
    });

    if (existingWishlistItem) {
      return res.status(400).json({
        success: false,
        message: 'Product is already in your wishlist'
      });
    }

    // Create new wishlist item
    const wishlistItem = new Wishlist({
      user_id: userId,
      product_id: product_id
    });

    await wishlistItem.save();

    res.status(201).json({
      success: true,
      message: 'Item added to wishlist successfully',
      data: {
        wishlist_item: {
          id: wishlistItem._id,
          product_id: wishlistItem.product_id,
          added_at: wishlistItem.added_at
        }
      }
    });

  } catch (error) {
    console.error('Error adding item to wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding item to wishlist',
      error: error.message
    });
  }
};

// 3. Remove Item from Wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    // Find and delete wishlist item
    const wishlistItem = await Wishlist.findOneAndDelete({
      user_id: userId,
      product_id: productId
    });

    if (!wishlistItem) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in your wishlist'
      });
    }

    res.json({
      success: true,
      message: 'Item removed from wishlist successfully',
      data: {
        removed_item: {
          id: wishlistItem._id,
          product_id: wishlistItem.product_id
        }
      }
    });

  } catch (error) {
    console.error('Error removing item from wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing item from wishlist',
      error: error.message
    });
  }
};

module.exports = {
  getWishlistItems,
  addToWishlist,
  removeFromWishlist
};
