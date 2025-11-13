const mongoose = require('mongoose');
const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
const Category = require('../models/Category');
const ProductReview = require('../models/ProductReview');
const ReviewImage = require('../models/ReviewImage');
const ProductVariation = require('../models/ProductVariation');
const Wishlist = require('../models/Wishlist');
const OrderItem = require('../models/OrderItem');
const Order = require('../models/Order');

// 1. Get All Products with Filters (Admin only)
const getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      stock_filters = [], // Array of stock filters: ['in_stock', 'low_stock', 'out_of_stock']
      status_filters = [], // Array of status filters: ['published', 'draft']
      search,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build filter query
    let filterQuery = {};
    
    // Exclude soft-deleted products
    filterQuery.$and = [
      { deleted_at: null },
      { status: { $ne: 'deleted' } }
    ];
    
    
    // Stock level filters
    if (stock_filters && stock_filters.length > 0) {
      const stockConditions = [];
      const tmpStockFilters = Array.isArray(stock_filters) ? stock_filters : [stock_filters];
      
      tmpStockFilters.forEach(filter => {
        switch (filter) {
          case 'in_stock':
            stockConditions.push({ stock_quantity: { $gt: 50 } });
            break;
          case 'low_stock':
            stockConditions.push({ stock_quantity: { $gte: 1, $lte: 50 } });
            break;
          case 'out_of_stock':
            stockConditions.push({ stock_quantity: 0 });
            break;
        }
      });
      
      if (stockConditions.length > 0) {
        filterQuery.$or = stockConditions;
      }
    }
    
    // Status filters
    if (status_filters && status_filters.length > 0) {
      filterQuery.status = { $in: status_filters };
    }
    
    // Search functionality (name, SKU, category - NOT description)
    if (search) {
      const searchConditions = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
      
      // Add category search if category_id is provided
      if (search.match(/^[0-9a-fA-F]{24}$/)) {
        // If search looks like ObjectId, search by category_id
        searchConditions.push({ category_id: search });
      }
      
      filterQuery.$or = searchConditions;
    }
    
    // Build sort object
    const sortObject = {};
    sortObject[sort_by] = sort_order === 'desc' ? -1 : 1;
    
    // Execute query with pagination
    const products = await Product.find(filterQuery)
      .populate('category_id', 'name')
      .sort(sortObject)
      .limit(parseInt(limit))
      .skip(skip);
    
    // Get comprehensive data for all products
    const productsWithFullData = await Promise.all(
      products.map(async (product) => {
        // Get all images for the product
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
        
        return {
          ...product.toObject(),
          primary_image: primaryImage || null,
          all_images: allImages || [],
          variations: variations || [],
          review_overview: {
            average_rating: reviewData.averageRating || 0,
            total_reviews: reviewData.totalReviews || 0
          }
        };
      })
    );
    
    // Get total count for pagination
    const totalProducts = await Product.countDocuments(filterQuery);
    
    res.json({
      success: true,
      data: {
        products: productsWithFullData,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalProducts / limit),
          total_products: totalProducts,
          limit: parseInt(limit)
        },
        filters: {
          stock_filters,
          status_filters,
          search
        },
        sorting: {
          sort_by,
          sort_order
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
};

// 2. Add New Product (Admin only)
const addProduct = async (req, res) => {
  try {
    const {
      name,
      sku,
      description,
      product_description,
      category_id,
      status,
      variations = [],
      pricing = {},
      stock_quantity,
      weight
    } = req.body;
    
    // Validate required fields
    if (!name || !sku || !description || !product_description || !category_id) {
      return res.status(400).json({
        success: false,
        message: 'Name, SKU, description, product description, and category are required'
      });
    }
    
    // Check if SKU already exists
    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product with this SKU already exists'
      });
    }
    
    // Validate category exists
    const category = await Category.findById(category_id);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Extract pricing information
    const { mrp, price, discount_type, discount_rate } = pricing;
    
    // Validate pricing - either variations or main pricing must be provided
    if (variations.length === 0 && !price) {
      return res.status(400).json({
        success: false,
        message: 'Either variations or main price must be provided'
      });
    }
    
    // Validate variations if provided
    if (variations.length > 0) {
      for (const variation of variations) {
        if (!variation.color || !variation.size || !variation.price) {
          return res.status(400).json({
            success: false,
            message: 'Each variation must have color, size, and price'
          });
        }
        
        // Check for duplicate variation SKUs (active variations only)
        if (variation.sku) {
          const existingVariation = await ProductVariation.findOne({ 
            sku: variation.sku,
            status: 'active',
            deleted_at: null
          });
          if (existingVariation) {
            return res.status(400).json({
              success: false,
              message: `Variation SKU '${variation.sku}' already exists`
            });
          }
        }
      }
    }
    
    // Create new product
    const product = new Product({
      name,
      sku,
      description,
      product_description,
      price: price || (variations.length > 0 ? Math.min(...variations.map(v => v.price)) : 0),
      mrp: mrp || null,
      discount_type: discount_type || null,
      discount_rate: discount_rate || null,
      stock_quantity: stock_quantity || 0,
      weight: weight || null,
      status: status || 'draft',
      category_id
    });
    
    await product.save();
    
    // Create variations if provided
    const createdVariations = [];
    if (variations.length > 0) {
      const variationPromises = variations.map(variationData => {
        const variation = new ProductVariation({
          product_id: product._id,
          color: variationData.color,
          size: variationData.size,
          price: variationData.price,
          stock_quantity: variationData.stock_quantity || 0,
          sku: variationData.sku || null,
          status: variationData.status || 'active'
        });
        
        return variation.save();
      });
      
      createdVariations.push(...await Promise.all(variationPromises));
    }
    
    // Populate category and get primary image
    const populatedProduct = await Product.findById(product._id)
      .populate('category_id', 'name');
    
    const primaryImage = await ProductImage.getPrimaryImage(product._id);
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        product: {
          ...populatedProduct.toObject(),
          primary_image: primaryImage || null
        },
        variations: createdVariations.length > 0 ? createdVariations : undefined
      }
    });
    
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
};

// 3. Edit Product (Admin only)
const editProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const updateData = req.body;
    
    // Find product and ensure it's not soft-deleted
    const product = await Product.findOne({ 
      _id: productId, 
      deleted_at: null, 
      status: { $ne: 'deleted' } 
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // If SKU is being updated, check for duplicates
    if (updateData.sku && updateData.sku !== product.sku) {
      const existingProduct = await Product.findOne({ 
        sku: updateData.sku,
        _id: { $ne: productId }
      });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Product with this SKU already exists'
        });
      }
    }
    
    // If category is being updated, validate it exists
    if (updateData.category_id) {
      const category = await Category.findById(updateData.category_id);
      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Category not found'
        });
      }
    }
    
    // Update only provided fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        product[key] = updateData[key];
      }
    });
    
    await product.save();
    
    // Populate category and get primary image
    const updatedProduct = await Product.findById(productId)
      .populate('category_id', 'name');
    
    const primaryImage = await ProductImage.getPrimaryImage(productId);
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: {
        product: {
          ...updatedProduct.toObject(),
          primary_image: primaryImage || null
        }
      }
    });
    
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
};

// 4. Soft Delete Product (Admin only)
const softDeleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Soft delete by setting deleted_at and status
    product.deleted_at = new Date();
    product.status = 'deleted';
    await product.save({ validateBeforeSave: false });
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
};

// 5. View Product Details (Admin only)
const getProductDetails = async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Find product and ensure it's not soft-deleted
    const product = await Product.findOne({ 
      _id: productId, 
      deleted_at: null, 
      status: { $ne: 'deleted' } 
    }).populate('category_id', 'name');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Get comprehensive product data
    const [productImages, variations, reviewSummary, reviewDetails, totalSold] = await Promise.all([
      ProductImage.getProductImages(productId),
      ProductVariation.getProductVariations(productId),
      ProductReview.getProductAverageRating(productId),
      ProductReview.getProductReviews(productId, 50, 0), // Get up to 50 reviews
      // Get total sold count for this product
      OrderItem.aggregate([
        {
          $lookup: {
            from: 'orders',
            localField: 'order_id',
            foreignField: '_id',
            as: 'order'
          }
        },
        {
          $unwind: '$order'
        },
        {
          $match: {
            product_id: product._id,
            'order.order_status': 'delivered'
          }
        },
        {
          $group: {
            _id: null,
            totalSold: { $sum: '$quantity' }
          }
        }
      ])
    ]);
    
    // Get images for all reviews
    const reviewIds = reviewDetails.map(review => review._id);
    const reviewImages = await ReviewImage.getReviewsImages(reviewIds);
    
    // Attach images to reviews
    const reviewsWithImages = reviewDetails.map(review => ({
      ...review.toObject(),
      images: reviewImages.filter(img => img.review_id.toString() === review._id.toString())
    }));
    
    // Prepare comprehensive review data
    const reviewData = reviewSummary.length > 0 ? reviewSummary[0] : { 
      averageRating: 0, 
      totalReviews: 0 
    };
    
    // Get total sold count
    const soldCount = totalSold.length > 0 ? totalSold[0].totalSold : 0;
    
    res.json({
      success: true,
      data: {
        product: {
          ...product.toObject(),
          images: productImages,
          variations: variations || [],
          sold: soldCount
        },
        reviews: {
          summary: {
            average_rating: reviewData.averageRating || 0,
            total_reviews: reviewData.totalReviews || 0
          },
          details: reviewsWithImages
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product details',
      error: error.message
    });
  }
};

// 6. Update Product Quantity (Admin only)
const updateProductQuantity = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    
    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required (must be >= 0)'
      });
    }
    
    const product = await Product.findOne({ 
      _id: productId, 
      deleted_at: null, 
      status: { $ne: 'deleted' } 
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    product.stock_quantity = quantity;
    await product.save();
    
    res.json({
      success: true,
      message: 'Product quantity updated successfully',
      data: {
        product_id: productId,
        new_quantity: quantity
      }
    });
    
  } catch (error) {
    console.error('Error updating product quantity:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product quantity',
      error: error.message
    });
  }
};

// 7. Update Product Status (Admin only)
const updateProductStatus = async (req, res) => {
  try {
    const { productId } = req.params;
    const { status } = req.body;
    
    if (!status || !['draft', 'published'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (draft or published)'
      });
    }
    
    const product = await Product.findOne({ 
      _id: productId, 
      deleted_at: null, 
      status: { $ne: 'deleted' } 
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    product.status = status;
    await product.save();
    
    res.json({
      success: true,
      message: 'Product status updated successfully',
      data: {
        product_id: productId,
        new_status: status
      }
    });
    
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product status',
      error: error.message
    });
  }
};

// 8. Get Featured Products (Public API)
const getFeaturedProducts = async (req, res) => {
  try {
    const limit = 12; // Always return 12 products
    const { include_wishlist_status = false } = req.query;
    
    // Include wishlist status automatically when user is authenticated
    const userId = req.user?._id;
    const shouldIncludeWishlist = !!userId;
    
    // First, try to get featured products
    let products = await Product.find({
      featured: true,
      deleted_at: null,
      status: 'published'
    })
    .populate('category_id', 'name')
    .sort({ created_at: -1 })
    .limit(limit);
    
    // If we don't have enough featured products, fill with random published products
    if (products.length < limit) {
      const remainingCount = limit - products.length;
      const featuredProductIds = products.map(p => p._id);
      
      // Get random published products excluding already selected featured ones
      const randomProducts = await Product.aggregate([
        {
          $match: {
            _id: { $nin: featuredProductIds },
            deleted_at: null,
            status: 'published'
          }
        },
        { $sample: { size: remainingCount } }
      ]);
      
      // Populate category for random products
      const populatedRandomProducts = await Product.populate(randomProducts, {
        path: 'category_id',
        select: 'name'
      });
      
      // Combine featured and random products
      products = [...products, ...populatedRandomProducts];
    }
    
    // Get comprehensive data for all products
    const productsWithFullData = await Promise.all(
      products.map(async (product) => {
        // Get all images for the product
        const promises = [
          ProductImage.getPrimaryImage(product._id),
          ProductImage.getProductImages(product._id),
          ProductVariation.getProductVariations(product._id),
          ProductReview.getProductAverageRating(product._id)
        ];
        
        // Add wishlist status check if requested
        if (shouldIncludeWishlist) {
          promises.push(
            Wishlist.findOne({
              user_id: userId,
              product_id: product._id
            })
          );
        }
        
        const results = await Promise.all(promises);
        const [primaryImage, allImages, variations, reviewOverview, wishlistItem] = results;
        
        // Calculate review overview
        const reviewData = reviewOverview.length > 0 ? reviewOverview[0] : { 
          averageRating: 0, 
          totalReviews: 0 
        };
        
        const productData = {
          ...(product.toObject ? product.toObject() : product),
          primary_image: primaryImage || null,
          all_images: allImages || [],
          variations: variations || [],
          review_overview: {
            average_rating: reviewData.averageRating || 0,
            total_reviews: reviewData.totalReviews || 0
          }
        };
        
        // Add wishlist status if requested
        if (shouldIncludeWishlist) {
          productData.is_in_wishlist = !!wishlistItem;
        }
        
        return productData;
      })
    );
    
    res.json({
      success: true,
      data: {
        products: productsWithFullData,
        total_count: productsWithFullData.length,
        featured_count: productsWithFullData.filter(p => p.featured).length,
        random_count: productsWithFullData.filter(p => !p.featured).length
      }
    });
    
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching featured products',
      error: error.message
    });
  }
};

// 9. Add Product Variation (Admin only)
const addProductVariation = async (req, res) => {
  try {
    const { productId } = req.params;
    const { color, size, price, stock_quantity, sku, status } = req.body;
    
    // Validate required fields
    if (!color || !size || !price) {
      return res.status(400).json({
        success: false,
        message: 'Color, size, and price are required'
      });
    }
    
    // Validate price
    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price cannot be negative'
      });
    }
    
    // Validate stock quantity
    if (stock_quantity !== undefined && stock_quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock quantity cannot be negative'
      });
    }
    
    // Check if product exists and is not deleted
    const product = await Product.findOne({ 
      _id: productId, 
      deleted_at: null, 
      status: { $ne: 'deleted' } 
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check if variation with same color and size already exists (active only)
    const existingVariation = await ProductVariation.checkActiveVariationExists(
      productId, 
      color.trim(), 
      size.trim()
    );
    
    if (existingVariation) {
      return res.status(409).json({
        success: false,
        message: `Variation with color '${color}' and size '${size}' already exists for this product`
      });
    }
    
    // Check for duplicate SKU if provided (active variations only)
    if (sku) {
      const existingSku = await ProductVariation.findOne({ 
        sku: sku.trim(),
        status: 'active',
        deleted_at: null
      });
      if (existingSku) {
        return res.status(409).json({
          success: false,
          message: `SKU '${sku}' already exists`
        });
      }
    }
    
    // Create new variation
    const variation = new ProductVariation({
      product_id: productId,
      color: color.trim(),
      size: size.trim(),
      price: price,
      stock_quantity: stock_quantity || 0,
      sku: sku ? sku.trim() : null,
      status: status || 'active'
    });
    
    await variation.save();
    
    res.status(201).json({
      success: true,
      message: 'Product variation added successfully',
      data: {
        variation: variation.toObject()
      }
    });
    
  } catch (error) {
    console.error('Error adding product variation:', error);
    
    // Handle duplicate key error (MongoDB unique constraint)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Variation with this combination already exists'
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
      message: 'Error adding product variation',
      error: error.message
    });
  }
};

// 10. Edit Product Variation (Admin only)
const editProductVariation = async (req, res) => {
  try {
    const { productId, variationId } = req.params;
    const updateData = req.body;
    
    // Validate that at least one field is provided for update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one field must be provided for update'
      });
    }
    
    // Validate price if provided
    if (updateData.price !== undefined && updateData.price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price cannot be negative'
      });
    }
    
    // Validate stock quantity if provided
    if (updateData.stock_quantity !== undefined && updateData.stock_quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock quantity cannot be negative'
      });
    }
    
    // Check if product exists and is not deleted
    const product = await Product.findOne({ 
      _id: productId, 
      deleted_at: null, 
      status: { $ne: 'deleted' } 
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Find the variation and ensure it's not soft-deleted
    const variation = await ProductVariation.findOne({
      _id: variationId,
      product_id: productId,
      status: { $ne: 'deleted' },
      deleted_at: null
    });
    
    if (!variation) {
      return res.status(404).json({
        success: false,
        message: 'Product variation not found'
      });
    }
    
    // Check for duplicate color/size combination if being updated (active variations only)
    if (updateData.color || updateData.size) {
      const newColor = updateData.color ? updateData.color.trim() : variation.color;
      const newSize = updateData.size ? updateData.size.trim() : variation.size;
      
      const existingVariation = await ProductVariation.findOne({
        product_id: productId,
        color: newColor,
        size: newSize,
        _id: { $ne: variationId },
        status: 'active',
        deleted_at: null
      });
      
      if (existingVariation) {
        return res.status(409).json({
          success: false,
          message: `Variation with color '${newColor}' and size '${newSize}' already exists for this product`
        });
      }
    }
    
    // Check for duplicate SKU if being updated (active variations only)
    if (updateData.sku) {
      const existingSku = await ProductVariation.findOne({ 
        sku: updateData.sku.trim(),
        _id: { $ne: variationId },
        status: 'active',
        deleted_at: null
      });
      if (existingSku) {
        return res.status(409).json({
          success: false,
          message: `SKU '${updateData.sku}' already exists`
        });
      }
    }
    
    // Update only provided fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'color' || key === 'size' || key === 'sku') {
          variation[key] = updateData[key].trim();
        } else {
          variation[key] = updateData[key];
        }
      }
    });
    
    await variation.save();
    
    res.json({
      success: true,
      message: 'Product variation updated successfully',
      data: {
        variation: variation.toObject()
      }
    });
    
  } catch (error) {
    console.error('Error updating product variation:', error);
    
    // Handle duplicate key error (MongoDB unique constraint)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Variation with this combination already exists'
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
      message: 'Error updating product variation',
      error: error.message
    });
  }
};

// 11. Delete Product Variation (Admin only)
const deleteProductVariation = async (req, res) => {
  try {
    const { productId, variationId } = req.params;
    
    // Check if product exists and is not deleted
    const product = await Product.findOne({ 
      _id: productId, 
      deleted_at: null, 
      status: { $ne: 'deleted' } 
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Find the variation and ensure it's not already soft-deleted
    const variation = await ProductVariation.findOne({
      _id: variationId,
      product_id: productId,
      status: { $ne: 'deleted' },
      deleted_at: null
    });
    
    if (!variation) {
      return res.status(404).json({
        success: false,
        message: 'Product variation not found'
      });
    }
    
    // Soft delete by setting deleted_at and status
    variation.deleted_at = new Date();
    variation.status = 'deleted';
    await variation.save({ validateBeforeSave: false });
    
    res.json({
      success: true,
      message: 'Product variation deleted successfully',
      data: {
        deleted_variation: {
          id: variation._id,
          color: variation.color,
          size: variation.size,
          sku: variation.sku
        }
      }
    });
    
  } catch (error) {
    console.error('Error deleting product variation:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product variation',
      error: error.message
    });
  }
};

// 12. Toggle Featured Status (Admin only)
const toggleFeaturedStatus = async (req, res) => {
  try {
    const { productId } = req.params;
    const { featured } = req.body;
    
    // Validate featured field
    if (typeof featured !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Featured field must be a boolean value'
      });
    }
    
    // Find product and ensure it's not soft-deleted
    const product = await Product.findOne({ 
      _id: productId, 
      deleted_at: null, 
      status: { $ne: 'deleted' } 
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Update featured status
    product.featured = featured;
    await product.save();
    
    // Populate category and get primary image
    const updatedProduct = await Product.findById(productId)
      .populate('category_id', 'name');
    
    const primaryImage = await ProductImage.getPrimaryImage(productId);
    
    res.json({
      success: true,
      message: `Product ${featured ? 'added to' : 'removed from'} featured products successfully`,
      data: {
        product: {
          ...updatedProduct.toObject(),
          primary_image: primaryImage || null
        },
        featured_status: featured
      }
    });
    
  } catch (error) {
    console.error('Error toggling featured status:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling featured status',
      error: error.message
    });
  }
};

// 13. Public Product Search with Filters and Sorting
const searchProducts = async (req, res) => {
  try {
    const {
      // Search parameters
      search,
      
      // Filter parameters
      min_price,
      max_price,
      color,
      size,
      category_id,
      
      // Sorting parameters
      newest_first,
      price_sort, // 'low_to_high' or 'high_to_low'
      highest_rated,
      
      // Pagination parameters
      page = 1,
      limit = 20,
      
    } = req.query;

    // Normalize color to array (support both string and array)
    let colorArray = [];
    if (color) {
      if (Array.isArray(color)) {
        colorArray = color.map(c => c.trim()).filter(c => c.length > 0);
      } else {
        colorArray = [color.trim()].filter(c => c.length > 0);
      }
    }

    // Check if user is authenticated - always include wishlist status for authenticated users
    const userId = req.user?._id;
    const shouldIncludeWishlist = !!userId;

    const skip = (page - 1) * limit;
    
    // Build base filter query (only published, non-deleted products)
    let filterQuery = {
      status: 'published',
      deleted_at: null
    };
    
    // Add price range filter
    if (min_price || max_price) {
      filterQuery.price = {};
      if (min_price) filterQuery.price.$gte = parseFloat(min_price);
      if (max_price) filterQuery.price.$lte = parseFloat(max_price);
    }
    
    // Add category filter
    if (category_id) {
      // Validate and convert category_id to ObjectId
      if (mongoose.Types.ObjectId.isValid(category_id)) {
        filterQuery.category_id = new mongoose.Types.ObjectId(category_id);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid category ID format'
        });
      }
    }
    
    // Build aggregation pipeline for complex filtering and sorting
    const pipeline = [
      // Stage 1: Match base filters
      { $match: filterQuery },
      
      // Stage 2: Lookup category for search and sorting
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      
      // Stage 3: Lookup variations for color/size filtering (active variations only)
      {
        $lookup: {
          from: 'productvariations',
          let: { productId: '$_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $and: [
                    { $eq: ['$product_id', '$$productId'] },
                    { $eq: ['$status', 'active'] },
                    { $eq: ['$deleted_at', null] }
                  ]
                }
              }
            }
          ],
          as: 'variations'
        }
      },
      
      // Stage 4: Lookup reviews for rating calculation
      {
        $lookup: {
          from: 'productreviews',
          localField: '_id',
          foreignField: 'product_id',
          as: 'reviews'
        }
      },
      
      // Stage 4.5: Lookup wishlist status if user is authenticated
      ...(shouldIncludeWishlist ? [{
        $lookup: {
          from: 'wishlists',
          let: { 
            productId: '$_id', 
            userId: userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(userId.toString())
          },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $and: [
                    { $eq: ['$product_id', '$$productId'] },
                    { $eq: ['$user_id', '$$userId'] }
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: 'wishlist_status'
        }
      }] : []),
      
      // Stage 5: Add computed fields
      {
        $addFields: {
          category_name: { $arrayElemAt: ['$category.name', 0] },
          average_rating: {
            $cond: {
              if: { $gt: [{ $size: '$reviews' }, 0] },
              then: { $avg: '$reviews.rating' },
              else: 0
            }
          },
          total_reviews: { $size: '$reviews' },
          available_colors: { $setUnion: ['$variations.color', []] },
          available_sizes: { $setUnion: ['$variations.size', []] },
          ...(shouldIncludeWishlist ? {
            is_in_wishlist: { $gt: [{ $size: '$wishlist_status' }, 0] }
          } : {})
        }
      },
      
      // Stage 6: Apply color filter if specified (supports multiple colors)
      ...(colorArray.length > 0 ? [{
        $match: {
          'variations.color': { $in: colorArray }
        }
      }] : []),
      
      // Stage 7: Apply size filter if specified (exact match)
      ...(size ? [{
        $match: {
          'variations.size': size.trim()
        }
      }] : []),
      
      // Stage 8: Apply text search if specified
      ...(search ? [{
        $match: {
          $or: [
            { name: { $regex: new RegExp(search, 'i') } },
            { description: { $regex: new RegExp(search, 'i') } },
            { category_name: { $regex: new RegExp(search, 'i') } }
          ]
        }
      }] : []),
      
      // Stage 9: Add search relevance score if search term provided
      ...(search ? [{
        $addFields: {
          searchScore: {
            $add: [
              // Exact name match gets highest score
              { $cond: [{ $regexMatch: { input: '$name', regex: new RegExp(`^${search}`, 'i') } }, 100, 0] },
              // Name contains search term
              { $cond: [{ $regexMatch: { input: '$name', regex: new RegExp(search, 'i') } }, 50, 0] },
              // Description contains search term
              { $cond: [{ $regexMatch: { input: '$description', regex: new RegExp(search, 'i') } }, 25, 0] },
              // Category name contains search term
              { $cond: [{ $regexMatch: { input: '$category_name', regex: new RegExp(search, 'i') } }, 10, 0] }
            ]
          }
        }
      }] : []),
      
      // Stage 10: Sort based on criteria
      {
        $sort: (() => {
          if (search) {
            // If searching, prioritize search relevance
            return { searchScore: -1, created_at: -1 };
          } else if (highest_rated) {
            return { average_rating: -1, total_reviews: -1 };
          } else if (price_sort === 'low_to_high') {
            return { price: 1 };
          } else if (price_sort === 'high_to_low') {
            return { price: -1 };
          } else if (newest_first) {
            return { created_at: -1 };
          } else {
            // Default: newest first
            return { created_at: -1 };
          }
        })()
      },
      
      // Stage 11: Pagination
      { $skip: skip },
      { $limit: parseInt(limit) },
      
      // Stage 12: Lookup primary image
      {
        $lookup: {
          from: 'productimages',
          let: { productId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$product_id', '$$productId'] }, { $eq: ['$is_primary', true] }] } } },
            { $limit: 1 }
          ],
          as: 'primary_image'
        }
      },
      
      // Stage 13: Project final fields
      {
        $project: {
          _id: 1,
          name: 1,
          sku: 1,
          description: 1,
          product_description: 1,
          price: 1,
          mrp: 1,
          discount_type: 1,
          discount_rate: 1,
          final_price: 1,
          discount_amount: 1,
          stock_quantity: 1,
          weight: 1,
          status: 1,
          featured: 1,
          in_stock: 1,
          low_stock: 1,
          created_at: 1,
          edited_at: 1,
          category_id: 1,
          category_name: 1,
          average_rating: 1,
          total_reviews: 1,
          available_colors: 1,
          available_sizes: 1,
          primary_image: { $arrayElemAt: ['$primary_image', 0] },
          variations: {
            $map: {
              input: '$variations',
              as: 'variation',
              in: {
                _id: '$$variation._id',
                color: '$$variation.color',
                size: '$$variation.size',
                price: '$$variation.price',
                stock_quantity: '$$variation.stock_quantity',
                sku: '$$variation.sku',
                status: '$$variation.status',
                created_at: '$$variation.created_at',
                updated_at: '$$variation.updated_at'
              }
            }
          },
          ...(search ? { searchScore: 1 } : {}),
          ...(shouldIncludeWishlist ? { is_in_wishlist: 1 } : {})
        }
      }
    ];
    
    // Execute aggregation pipeline
    const products = await Product.aggregate(pipeline);
    
    // Get total count for pagination (separate query for performance)
    const countPipeline = [
      { $match: filterQuery },
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $lookup: {
          from: 'productvariations',
          let: { productId: '$_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $and: [
                    { $eq: ['$product_id', '$$productId'] },
                    { $eq: ['$status', 'active'] },
                    { $eq: ['$deleted_at', null] }
                  ]
                }
              }
            }
          ],
          as: 'variations'
        }
      },
      {
        $addFields: {
          category_name: { $arrayElemAt: ['$category.name', 0] }
        }
      },
      ...(colorArray.length > 0 ? [{ $match: { 'variations.color': { $in: colorArray } } }] : []),
      ...(size ? [{ $match: { 'variations.size': size.trim() } }] : []),
      ...(search ? [{
        $match: {
          $or: [
            { name: { $regex: new RegExp(search, 'i') } },
            { description: { $regex: new RegExp(search, 'i') } },
            { category_name: { $regex: new RegExp(search, 'i') } }
          ]
        }
      }] : []),
      { $count: 'total' }
    ];
    
    const countResult = await Product.aggregate(countPipeline);
    const totalProducts = countResult.length > 0 ? countResult[0].total : 0;
    
    res.json({
      success: true,
      data: {
        products,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalProducts / limit),
          total_products: totalProducts,
          limit: parseInt(limit)
        },
        filters: {
          search,
          min_price,
          max_price,
          color: colorArray.length > 0 ? colorArray : (color || undefined),
          size,
          category_id
        },
        sorting: {
          newest_first,
          price_sort,
          highest_rated
        }
      }
    });
    
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching products',
      error: error.message
    });
  }
};

// 14. Get Unique Colors and Sizes (Public API)
const getUniqueVariationOptions = async (req, res) => {
  try {
    const { category_id } = req.query;
    
    // Build base filter for variations (only from published, non-deleted products)
    let baseFilter = {};
    
    // If category_id is provided, filter by category
    if (category_id) {
      baseFilter['product.category_id'] = category_id;
    }
    
    // Get unique colors and sizes using aggregation
    const pipeline = [
      // Stage 1: Lookup products to filter by status and category
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      
      // Stage 2: Unwind product array
      { $unwind: '$product' },
      
      // Stage 3: Match only variations from published, non-deleted products and active variations
      {
        $match: {
          'product.status': 'published',
          'product.deleted_at': null,
          status: 'active',
          deleted_at: null,
          ...baseFilter
        }
      },
      
      // Stage 4: Group to get unique colors and sizes
      {
        $group: {
          _id: null,
          unique_colors: { $addToSet: '$color' },
          unique_sizes: { $addToSet: '$size' }
        }
      },
      
      // Stage 5: Project final result
      {
        $project: {
          _id: 0,
          colors: {
            $sortArray: {
              input: '$unique_colors',
              sortBy: 1
            }
          },
          sizes: {
            $sortArray: {
              input: '$unique_sizes',
              sortBy: 1
            }
          }
        }
      }
    ];
    
    const result = await ProductVariation.aggregate(pipeline);
    
    // If no variations found, return empty arrays
    const variationOptions = result.length > 0 ? result[0] : { colors: [], sizes: [] };
    
    res.json({
      success: true,
      data: {
        colors: variationOptions.colors,
        sizes: variationOptions.sizes,
        total_colors: variationOptions.colors.length,
        total_sizes: variationOptions.sizes.length,
        filters: {
          category_id: category_id || null
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching unique variation options:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unique variation options',
      error: error.message
    });
  }
};

// 14.5. Get Public Product Details (Public API)
const getPublicProductDetails = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user?._id; // Optional authentication for wishlist status
    
    // Find product - only published and not deleted for public access
    const product = await Product.findOne({ 
      _id: productId, 
      deleted_at: null, 
      status: 'published'
    }).populate('category_id', 'name');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not available'
      });
    }
    
    // Get comprehensive product data
    const promises = [
      ProductImage.getProductImages(productId),
      ProductVariation.getProductVariations(productId),
      ProductReview.getProductAverageRating(productId),
      // Get reviews with user details (including profile_icon)
      ProductReview.find({ product_id: productId })
        .populate('user_id', 'first_name last_name email profile_icon')
        .populate('order_id', 'order_number')
        .sort({ created_at: -1 })
        .limit(50),
      // Get total sold count for this product
      OrderItem.aggregate([
        {
          $lookup: {
            from: 'orders',
            localField: 'order_id',
            foreignField: '_id',
            as: 'order'
          }
        },
        {
          $unwind: '$order'
        },
        {
          $match: {
            product_id: new mongoose.Types.ObjectId(productId),
            'order.order_status': 'delivered'
          }
        },
        {
          $group: {
            _id: null,
            totalSold: { $sum: '$quantity' }
          }
        }
      ])
    ];

    // Add wishlist check if user is authenticated
    if (userId) {
      promises.push(
        Wishlist.findOne({ user_id: userId, product_id: productId })
      );
    }

    const results = await Promise.all(promises);
    const productImages = results[0];
    const variations = results[1];
    const reviewSummary = results[2];
    const reviewDetails = results[3];
    const totalSold = results[4];
    const wishlistItem = userId ? results[5] : null;
    
    // Get images for all reviews
    const reviewIds = reviewDetails.map(review => review._id);
    const reviewImages = await ReviewImage.getReviewsImages(reviewIds);
    
    // Attach images to reviews
    const reviewsWithImages = reviewDetails.map(review => ({
      ...review.toObject(),
      images: reviewImages.filter(img => img.review_id.toString() === review._id.toString())
    }));
    
    // Prepare comprehensive review data
    const reviewData = reviewSummary.length > 0 ? reviewSummary[0] : { 
      averageRating: 0, 
      totalReviews: 0 
    };
    
    // Get total sold count
    const soldCount = totalSold.length > 0 ? totalSold[0].totalSold : 0;
    
    // Build product response
    const productResponse = {
      ...product.toObject(),
      images: productImages,
      variations: variations || [],
      sold: soldCount
    };

    // Add wishlist status if user is authenticated
    if (userId) {
      productResponse.is_in_wishlist = !!wishlistItem;
    }
    
    res.json({
      success: true,
      data: {
        product: productResponse,
        reviews: {
          summary: {
            average_rating: reviewData.averageRating || 0,
            total_reviews: reviewData.totalReviews || 0
          },
          details: reviewsWithImages
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product details',
      error: error.message
    });
  }
};

// 15. Get Product Suggestions (Public API)
const getProductSuggestions = async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Validate productId
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }
    
    // Find the product to get its category
    const product = await Product.findOne({
      _id: productId,
      deleted_at: null,
      status: 'published'
    }).populate('category_id', 'name');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const categoryId = product.category_id._id || product.category_id;
    const categoryName = product.category_id.name || 'Unknown';
    
    // Count available products in the same category (excluding the current product)
    const availableProductsCount = await Product.countDocuments({
      _id: { $ne: productId },
      category_id: categoryId,
      deleted_at: null,
      status: 'published'
    });
    
    // Check if there are any products available
    if (availableProductsCount === 0) {
      return res.json({
        success: true,
        data: {
          product_id: productId,
          category_id: categoryId,
          category_name: categoryName,
          suggestions: [],
          total_suggestions: 0,
          message: 'No similar products found in this category'
        }
      });
    }
    
    // Get up to 4 random products from the same category (excluding the current product)
    const limit = Math.min(4, availableProductsCount);
    const suggestedProducts = await Product.aggregate([
      {
        $match: {
          _id: { $ne: productId },
          category_id: categoryId,
          deleted_at: null,
          status: 'published'
        }
      },
      { $sample: { size: limit } }, // MongoDB's random sampling
      // Lookup category information
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $unwind: {
          path: '$category',
          preserveNullAndEmptyArrays: true
        }
      }
    ]);
    
    // Get comprehensive data for suggested products
    const userId = req.user?._id;
    const productsWithFullData = await Promise.all(
      suggestedProducts.map(async (suggestedProduct) => {
        // Convert ObjectId to string for methods that expect string IDs
        const suggestedProductId = suggestedProduct._id.toString();
        
        const lookups = [
          ProductImage.getPrimaryImage(suggestedProductId),
          ProductImage.getProductImages(suggestedProductId),
          ProductVariation.getProductVariations(suggestedProductId),
          ProductReview.getProductAverageRating(suggestedProductId)
        ];
        // If authenticated, also fetch wishlist status
        if (userId) {
          lookups.push(
            Wishlist.findOne({ user_id: userId, product_id: suggestedProductId })
          );
        }

        const results = await Promise.all(lookups);
        const [primaryImage, allImages, variations, reviewOverview, wishlistItem] = results;
        
        // Calculate review overview
        const reviewData = reviewOverview.length > 0 ? reviewOverview[0] : { 
          averageRating: 0, 
          totalReviews: 0 
        };
        
        return {
          ...suggestedProduct,
          primary_image: primaryImage || null,
          all_images: allImages || [],
          variations: variations || [],
          review_overview: {
            average_rating: reviewData.averageRating || 0,
            total_reviews: reviewData.totalReviews || 0
          },
          category: suggestedProduct.category || null,
          ...(userId ? { is_in_wishlist: !!wishlistItem } : {})
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        product_id: productId,
        category_id: categoryId,
        category_name: categoryName,
        suggestions: productsWithFullData,
        total_suggestions: productsWithFullData.length
      }
    });
    
  } catch (error) {
    console.error('Error fetching product suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product suggestions',
      error: error.message
    });
  }
};

module.exports = {
  getAllProducts,
  addProduct,
  editProduct,
  softDeleteProduct,
  getProductDetails,
  updateProductQuantity,
  updateProductStatus,
  getFeaturedProducts,
  addProductVariation,
  editProductVariation,
  deleteProductVariation,
  toggleFeaturedStatus,
  searchProducts,
  getUniqueVariationOptions,
  getProductSuggestions,
  getPublicProductDetails
}; 