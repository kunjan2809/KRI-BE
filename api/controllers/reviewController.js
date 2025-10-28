const ProductReview = require('../models/ProductReview');
const ReviewImage = require('../models/ReviewImage');
const Product = require('../models/Product');
const User = require('../models/User');

// 1. Get Product Reviews
const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;

        // Validate productId
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }

        // Check if product exists
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

        // Get all reviews for the product with user details
        const reviews = await ProductReview.find({ product_id: productId })
            .populate('user_id', 'first_name last_name email profile_icon')
            .populate('order_id', 'order_number')
            .sort({ created_at: -1 });

        // Get all review IDs
        const reviewIds = reviews.map(review => review._id);

        // Get all images for these reviews
        const reviewImages = await ReviewImage.getReviewsImages(reviewIds);

        // Attach images to reviews
        const reviewsWithImages = reviews.map(review => ({
            ...review.toObject(),
            images: reviewImages.filter(img => 
                img.review_id.toString() === review._id.toString()
            )
        }));

        // Get review summary statistics
        const [averageRating, ratingDistribution] = await Promise.all([
            ProductReview.getProductAverageRating(productId),
            ProductReview.getProductRatingDistribution(productId)
        ]);

        const reviewSummary = averageRating.length > 0 ? averageRating[0] : {
            averageRating: 0,
            totalReviews: 0
        };

        res.json({
            success: true,
            data: {
                product: {
                    _id: product._id,
                    name: product.name,
                    sku: product.sku
                },
                reviews: {
                    summary: {
                        average_rating: reviewSummary.averageRating || 0,
                        total_reviews: reviewSummary.totalReviews || 0,
                        rating_distribution: ratingDistribution
                    },
                    details: reviewsWithImages
                }
            }
        });

    } catch (error) {
        console.error('Error fetching product reviews:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching product reviews',
            error: error.message
        });
    }
};

// 2. Create Product Review
const createProductReview = async (req, res) => {
    try {
        const { productId } = req.params;
        const { title, rating_description, rating, order_id } = req.body;
        const userId = req.user.id; // From auth middleware

        // Validate required fields
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }

        if (!title || !rating_description || !rating) {
            return res.status(400).json({
                success: false,
                message: 'Title, rating description, and rating are required'
            });
        }

        // Validate rating
        if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be an integer between 1 and 5'
            });
        }

        // Check if product exists
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

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user already reviewed this product
        const existingReview = await ProductReview.findOne({
            product_id: productId,
            user_id: userId
        });

        if (existingReview) {
            return res.status(409).json({
                success: false,
                message: 'You have already reviewed this product'
            });
        }

        // Create new review
        const review = new ProductReview({
            product_id: productId,
            user_id: userId,
            title: title.trim(),
            rating_description: rating_description.trim(),
            rating: rating,
            order_id: order_id || null
        });

        await review.save();

        // Populate the review with user details
        await review.populate('user_id', 'first_name last_name email profile_icon');

        res.status(201).json({
            success: true,
            message: 'Product review created successfully',
            data: {
                review: {
                    _id: review._id,
                    product_id: review.product_id,
                    user_id: review.user_id,
                    title: review.title,
                    rating_description: review.rating_description,
                    rating: review.rating,
                    order_id: review.order_id,
                    created_at: review.created_at,
                    edited_at: review.edited_at
                }
            }
        });

    } catch (error) {
        console.error('Error creating product review:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating product review',
            error: error.message
        });
    }
};

// 3. Update Product Review
const updateProductReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { title, rating_description, rating } = req.body;
        const userId = req.user.id; // From auth middleware

        // Validate reviewId
        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message: 'Review ID is required'
            });
        }

        // Find the review and ensure it belongs to the user
        const review = await ProductReview.findOne({
            _id: reviewId,
            user_id: userId
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found or you are not authorized to edit this review'
            });
        }

        // Validate rating if provided
        if (rating !== undefined) {
            if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
                return res.status(400).json({
                    success: false,
                    message: 'Rating must be an integer between 1 and 5'
                });
            }
        }

        // Update fields if provided
        if (title !== undefined) {
            review.title = title.trim();
        }
        if (rating_description !== undefined) {
            review.rating_description = rating_description.trim();
        }
        if (rating !== undefined) {
            review.rating = rating;
        }

        await review.save();

        // Populate the review with user details
        await review.populate('user_id', 'first_name last_name email profile_icon');

        res.json({
            success: true,
            message: 'Product review updated successfully',
            data: {
                review: {
                    _id: review._id,
                    product_id: review.product_id,
                    user_id: review.user_id,
                    title: review.title,
                    rating_description: review.rating_description,
                    rating: review.rating,
                    order_id: review.order_id,
                    created_at: review.created_at,
                    edited_at: review.edited_at
                }
            }
        });

    } catch (error) {
        console.error('Error updating product review:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating product review',
            error: error.message
        });
    }
};

// 4. Delete Product Review
const deleteProductReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user.id; // From auth middleware

        // Validate reviewId
        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message: 'Review ID is required'
            });
        }

        // Find the review and ensure it belongs to the user
        const review = await ProductReview.findOne({
            _id: reviewId,
            user_id: userId
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found or you are not authorized to delete this review'
            });
        }

        // Get all images associated with this review
        const reviewImages = await ReviewImage.find({ review_id: reviewId });

        // Delete all review images from Cloudinary and database
        const { cloudinaryUtils } = require('../config/cloudinary');
        for (const image of reviewImages) {
            try {
                const publicId = cloudinaryUtils.extractPublicId(image.image_url);
                if (publicId) {
                    await cloudinaryUtils.deleteFile(publicId, 'image');
                }
                await ReviewImage.findByIdAndDelete(image._id);
            } catch (imageError) {
                console.error('Error deleting review image:', imageError);
                // Continue with other images even if one fails
            }
        }

        // Delete the review
        await ProductReview.findByIdAndDelete(reviewId);

        res.json({
            success: true,
            message: 'Product review and associated images deleted successfully',
            data: {
                deleted_review_id: reviewId,
                deleted_images_count: reviewImages.length
            }
        });

    } catch (error) {
        console.error('Error deleting product review:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting product review',
            error: error.message
        });
    }
};

// 5. Get User Reviews
const getUserReviews = async (req, res) => {
    try {
        const userId = req.user.id; // From auth middleware

        // Get user's reviews with product details
        const reviews = await ProductReview.find({ user_id: userId })
            .populate('product_id', 'name sku')
            .populate('order_id', 'order_number')
            .sort({ created_at: -1 });

        // Get all review IDs
        const reviewIds = reviews.map(review => review._id);

        // Get all images for these reviews
        const reviewImages = await ReviewImage.getReviewsImages(reviewIds);

        // Attach images to reviews
        const reviewsWithImages = reviews.map(review => ({
            ...review.toObject(),
            images: reviewImages.filter(img => 
                img.review_id.toString() === review._id.toString()
            )
        }));

        res.json({
            success: true,
            data: {
                reviews: reviewsWithImages
            }
        });

    } catch (error) {
        console.error('Error fetching user reviews:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user reviews',
            error: error.message
        });
    }
};

module.exports = {
    getProductReviews,
    createProductReview,
    updateProductReview,
    deleteProductReview,
    getUserReviews
};
