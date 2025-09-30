const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ProductImage = require('../models/ProductImage');
const ReviewImage = require('../models/ReviewImage');
const Product = require('../models/Product');
const ProductReview = require('../models/ProductReview');


// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Determine destination based on upload type
        const uploadType = req.uploadType; // Will be set by middleware
        const entityId = req.entityId; // Will be set by middleware

        if (uploadType === 'product') {
            const productPath = path.join(__dirname, '../../static/images/product', entityId);
            // Create product-specific directory if it doesn't exist
            if (!fs.existsSync(productPath)) {
                fs.mkdirSync(productPath, { recursive: true });
            }
            cb(null, productPath);
        } else if (uploadType === 'review') {
            const reviewPath = path.join(__dirname, '../../static/images/review', entityId);
            // Create review-specific directory if it doesn't exist
            if (!fs.existsSync(reviewPath)) {
                fs.mkdirSync(reviewPath, { recursive: true });
            }
            cb(null, reviewPath);
        } else {
            cb(new Error('Invalid upload type'), null);
        }
    },
    filename: function (req, file, cb) {
        // Generate filename: <timestamp>_<originalname>_<random4digitcode>
        const timestamp = Date.now();
        const originalName = path.parse(file.originalname).name;
        const randomCode = Math.floor(1000 + Math.random() * 9000); // 4-digit random code
        const extension = path.extname(file.originalname);

        const filename = `${timestamp}_${originalName}_${randomCode}${extension}`;
        cb(null, filename);
    }
});

// File filter to only allow image files
const fileFilter = (req, file, cb) => {
    // Check if file has image extension
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(fileExtension)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

// Create multer instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: Infinity // No file size limit as requested
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

        // Generate relative path for database storage
        const relativePath = `/static/images/product/${productId}/${req.file.filename}`;

        // Create product image record
        const productImage = new ProductImage({
            product_id: productId,
            image_url: relativePath,
            is_primary: isPrimary === 'true' || isPrimary === true
        });

        await productImage.save();

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

        // Generate relative path for database storage
        const relativePath = `/static/images/review/${reviewId}/${req.file.filename}`;

        // Create review image record
        const reviewImage = new ReviewImage({
            review_id: reviewId,
            image_url: relativePath
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

        // Get the full file path
        const fullPath = path.join(__dirname, '../..', productImage.image_url);

        // Delete the file from filesystem if it exists
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
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

// Middleware to set upload type and entity ID for multer
const setUploadContext = (uploadType) => {
    return (req, res, next) => {
        req.uploadType = uploadType;
        req.entityId = req.params[uploadType === 'product' ? 'productId' : 'reviewId'];
        next();
    };
};

module.exports = {
    uploadProductImage,
    uploadReviewImage,
    deleteProductImage,
    setUploadContext,
    upload
}; 