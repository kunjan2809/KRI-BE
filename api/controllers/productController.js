const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
const Category = require('../models/Category');
const ProductReview = require('../models/ProductReview');
const ReviewImage = require('../models/ReviewImage');
const ProductVariation = require('../models/ProductVariation');

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
      
      stock_filters.forEach(filter => {
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
      category_id,
      status,
      variations = [],
      pricing = {},
      stock_quantity,
      weight
    } = req.body;
    
    // Validate required fields
    if (!name || !sku || !description || !category_id) {
      return res.status(400).json({
        success: false,
        message: 'Name, SKU, description, and category are required'
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
        
        // Check for duplicate variation SKUs
        if (variation.sku) {
          const existingVariation = await ProductVariation.findOne({ sku: variation.sku });
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
          stock_quantity: variationData.stock || 0,
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
    await product.save();
    
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
    const [productImages, variations, reviewSummary, reviewDetails] = await Promise.all([
      ProductImage.getProductImages(productId),
      ProductVariation.getProductVariations(productId),
      ProductReview.getProductAverageRating(productId),
      ProductReview.getProductReviews(productId, 50, 0) // Get up to 50 reviews
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
    
    res.json({
      success: true,
      data: {
        product: {
          ...product.toObject(),
          images: productImages,
          variations: variations || []
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

// 9. Toggle Featured Status (Admin only)
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

module.exports = {
  getAllProducts,
  addProduct,
  editProduct,
  softDeleteProduct,
  getProductDetails,
  updateProductQuantity,
  updateProductStatus,
  getFeaturedProducts,
  toggleFeaturedStatus
}; 