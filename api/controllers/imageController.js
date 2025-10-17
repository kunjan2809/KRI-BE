const multer = require('multer');
const ProductImage = require('../models/ProductImage');
const ReviewImage = require('../models/ReviewImage');
const Product = require('../models/Product');
const ProductReview = require('../models/ProductReview');
const { storageConfigs, fileFilters, cloudinaryUtils } = require('../config/cloudinary');


// Create multer instances for different upload types using global config
const uploadProduct = multer({
    storage: storageConfigs.productImages,
    fileFilter: fileFilters.images,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

const uploadReview = multer({
    storage: storageConfigs.reviewImages,
    fileFilter: fileFilters.images,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// 1. Upload Product Image
const uploadProductImage = async (req, res) => {
    try {
        const { productId } = req.params;
        const { isPrimary } = req.body;

        // Validate productId
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Image file is required'
            });
        }

        // Get Cloudinary URL from uploaded file
        const cloudinaryUrl = req.file.path;

        // Create product image record
        const productImage = new ProductImage({
            product_id: productId,
            image_url: cloudinaryUrl,
            is_primary: isPrimary === 'true' || isPrimary === true
        });

        const savedProductImage = await productImage.save();

        res.status(201).json({
            success: true,
            message: 'Product image uploaded successfully',
            data: {
                image: {
                    _id: productImage._id,
                    product_id: productImage.product_id,
                    image_url: productImage.image_url,
                    is_primary: productImage.is_primary,
                    created_at: productImage.created_at
                }
            }
        });

    } catch (error) {
        console.error('Error uploading product image:', error);

        // Handle multer errors
        if (error instanceof multer.MulterError) {
            return res.status(400).json({
                success: false,
                message: 'File upload error',
                error: error.message
            });
        }

        // Handle file filter errors
        if (error.message === 'Only image files are allowed') {
            return res.status(400).json({
                success: false,
                message: 'Only image files are allowed'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error uploading product image',
            error: error.message
        });
    }
};

// 2. Upload Review Image
const uploadReviewImage = async (req, res) => {
    try {
        const { reviewId } = req.params;

        // Validate reviewId
        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message: 'Review ID is required'
            });
        }

        // Check if review exists
        const review = await ProductReview.findById(reviewId);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Image file is required'
            });
        }

        // Get Cloudinary URL from uploaded file
        const cloudinaryUrl = req.file.path;

        // Create review image record
        const reviewImage = new ReviewImage({
            review_id: reviewId,
            image_url: cloudinaryUrl
        });

        await reviewImage.save();

        res.status(201).json({
            success: true,
            message: 'Review image uploaded successfully',
            data: {
                image: {
                    _id: reviewImage._id,
                    review_id: reviewImage.review_id,
                    image_url: reviewImage.image_url,
                    created_at: reviewImage.created_at
                }
            }
        });

    } catch (error) {
        console.error('Error uploading review image:', error);

        // Handle multer errors
        if (error instanceof multer.MulterError) {
            return res.status(400).json({
                success: false,
                message: 'File upload error',
                error: error.message
            });
        }

        // Handle file filter errors
        if (error.message === 'Only image files are allowed') {
            return res.status(400).json({
                success: false,
                message: 'Only image files are allowed'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error uploading review image',
            error: error.message
        });
    }
};

// 3. Delete Product Image
const deleteProductImage = async (req, res) => {
    try {
        const { imageId } = req.params;

        // Validate imageId
        if (!imageId) {
            return res.status(400).json({
                success: false,
                message: 'Image ID is required'
            });
        }

        // Find the product image
        const productImage = await ProductImage.findById(imageId);
        if (!productImage) {
            return res.status(404).json({
                success: false,
                message: 'Product image not found'
            });
        }

        // Extract public ID from Cloudinary URL for deletion
        const cloudinaryUrl = productImage.image_url;
        const publicId = cloudinaryUtils.extractPublicId(cloudinaryUrl);

        // Delete the image from Cloudinary using global utility
        try {
            await cloudinaryUtils.deleteFile(publicId);
        } catch (cloudinaryError) {
            console.warn('Failed to delete image from Cloudinary:', cloudinaryError.message);
            // Continue with database deletion even if Cloudinary deletion fails
        }

        // Delete the database record
        await ProductImage.findByIdAndDelete(imageId);

        res.json({
            success: true,
            message: 'Product image deleted successfully',
            data: {
                deleted_image: {
                    _id: productImage._id,
                    product_id: productImage.product_id,
                    image_url: productImage.image_url,
                    is_primary: productImage.is_primary
                }
            }
        });

    } catch (error) {
        console.error('Error deleting product image:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting product image',
            error: error.message
        });
    }
};

// 4. Update Product Image
const updateProductImage = async (req, res) => {
    try {
        const { imageId } = req.params;
        console.log('=== UPDATE PRODUCT IMAGE DEBUG ===');
        console.log('Image ID:', imageId);
        console.log('Request method:', req.method);
        console.log('Request headers:', req.headers);
        console.log('Request body:', req.body);
        console.log('Request body type:', typeof req.body);
        console.log('Request body keys:', req.body ? Object.keys(req.body) : 'N/A');
        console.log('===================================');
        
        // Check if body exists and has the required field
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Request body is required and must be a valid JSON object',
                debug: {
                    bodyExists: !!req.body,
                    bodyType: typeof req.body,
                    bodyContent: req.body
                }
            });
        }

        const { is_primary } = req.body;

        // Validate imageId
        if (!imageId) {
            return res.status(400).json({
                success: false,
                message: 'Image ID is required'
            });
        }

        // Validate is_primary field
        if (typeof is_primary !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'is_primary must be a boolean value'
            });
        }

        // Find the product image
        const productImage = await ProductImage.findById(imageId);
        if (!productImage) {
            return res.status(404).json({
                success: false,
                message: 'Product image not found'
            });
        }

        // If setting as primary, unset other primary images for the same product
        if (is_primary) {
            await ProductImage.updateMany(
                { 
                    product_id: productImage.product_id, 
                    _id: { $ne: imageId } 
                },
                { is_primary: false }
            );
        }

        // Update the image
        productImage.is_primary = is_primary;
        await productImage.save();

        res.json({
            success: true,
            message: 'Product image updated successfully',
            data: {
                image: {
                    _id: productImage._id,
                    product_id: productImage.product_id,
                    image_url: productImage.image_url,
                    is_primary: productImage.is_primary,
                    created_at: productImage.created_at,
                    updated_at: productImage.updated_at
                }
            }
        });

    } catch (error) {
        console.error('Error updating product image:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating product image',
            error: error.message
        });
    }
};

// 5. Delete Review Image
const deleteReviewImage = async (req, res) => {
    try {
        const { imageId } = req.params;
        const userId = req.user.id; // From auth middleware

        // Validate imageId
        if (!imageId) {
            return res.status(400).json({
                success: false,
                message: 'Image ID is required'
            });
        }

        // Find the review image
        const reviewImage = await ReviewImage.findById(imageId).populate('review_id');
        if (!reviewImage) {
            return res.status(404).json({
                success: false,
                message: 'Review image not found'
            });
        }

        // Check if the user owns the review
        if (reviewImage.review_id.user_id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to delete this review image'
            });
        }

        // Delete from Cloudinary
        const publicId = cloudinaryUtils.extractPublicId(reviewImage.image_url);
        if (publicId) {
            await cloudinaryUtils.deleteFile(publicId, 'image');
        }

        // Delete from database
        await ReviewImage.findByIdAndDelete(imageId);

        res.json({
            success: true,
            message: 'Review image deleted successfully',
            data: {
                deleted_image_id: imageId,
                review_id: reviewImage.review_id._id
            }
        });

    } catch (error) {
        console.error('Error deleting review image:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting review image',
            error: error.message
        });
    }
};

module.exports = {
    uploadProductImage,
    uploadReviewImage,
    deleteProductImage,
    updateProductImage,
    deleteReviewImage,
    uploadProduct,
    uploadReview
}; 