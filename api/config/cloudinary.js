const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true // Use HTTPS
});

// Cloudinary utility functions
const cloudinaryUtils = {
    // Upload file to Cloudinary
    uploadFile: async (file, options = {}) => {
        try {
            const result = await cloudinary.uploader.upload(file, {
                resource_type: 'auto', // Automatically detect file type
                ...options
            });
            return result;
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            throw error;
        }
    },

    // Delete file from Cloudinary
    deleteFile: async (publicId, options = {}) => {
        try {
            const result = await cloudinary.uploader.destroy(publicId, {
                resource_type: 'auto',
                ...options
            });
            return result;
        } catch (error) {
            console.error('Cloudinary delete error:', error);
            throw error;
        }
    },

    // Extract public ID from Cloudinary URL
    extractPublicId: (url) => {
        if (!url) return null;
        const parts = url.split('/');
        const filename = parts[parts.length - 1];
        return filename.split('.')[0];
    },

    // Generate optimized URL with transformations
    getOptimizedUrl: (publicId, transformations = {}) => {
        return cloudinary.url(publicId, {
            quality: 'auto',
            fetch_format: 'auto',
            ...transformations
        });
    }
};

// Create Cloudinary storage configurations for different media types
const createCloudinaryStorage = (folder, resourceType = 'image', transformations = []) => {
    return new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: folder,
            resource_type: resourceType,
            allowed_formats: resourceType === 'image' 
                ? ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg']
                : resourceType === 'video'
                ? ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'mkv']
                : ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg', 'mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'mkv'],
            transformation: resourceType === 'image' 
                ? [
                    { width: 1200, height: 1200, crop: 'limit', quality: 'auto' },
                    { fetch_format: 'auto' },
                    ...transformations
                ]
                : resourceType === 'video'
                ? [
                    { quality: 'auto' },
                    { fetch_format: 'auto' },
                    ...transformations
                ]
                : []
        }
    });
};

// Predefined storage configurations for common use cases
const storageConfigs = {
    // Image storage configurations
    productImages: createCloudinaryStorage('ecommerce/products', 'image'),
    reviewImages: createCloudinaryStorage('ecommerce/reviews', 'image'),
    userAvatars: createCloudinaryStorage('ecommerce/users/avatars', 'image', [
        { width: 300, height: 300, crop: 'fill', gravity: 'face' }
    ]),
    categoryImages: createCloudinaryStorage('ecommerce/categories', 'image'),
    
    // Video storage configurations
    productVideos: createCloudinaryStorage('ecommerce/products/videos', 'video'),
    promotionalVideos: createCloudinaryStorage('ecommerce/promotions', 'video'),
    
    // Document storage configurations
    documents: createCloudinaryStorage('ecommerce/documents', 'raw'),
    
    // Generic configurations
    generalImages: createCloudinaryStorage('ecommerce/general', 'image'),
    generalVideos: createCloudinaryStorage('ecommerce/general', 'video')
};

// File filter configurations
const fileFilters = {
    images: (req, file, cb) => {
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'];
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        
        if (allowedExtensions.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },

    videos: (req, file, cb) => {
        const allowedExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv'];
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        
        if (allowedExtensions.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'), false);
        }
    },

    media: (req, file, cb) => {
        const allowedExtensions = [
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg',
            '.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv'
        ];
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        
        if (allowedExtensions.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error('Only image and video files are allowed'), false);
        }
    }
};

module.exports = {
    cloudinary,
    cloudinaryUtils,
    createCloudinaryStorage,
    storageConfigs,
    fileFilters
};
