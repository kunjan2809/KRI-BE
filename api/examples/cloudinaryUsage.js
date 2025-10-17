// Example usage of global Cloudinary configuration
// This file demonstrates how to use the global Cloudinary config for different purposes

const { storageConfigs, fileFilters, cloudinaryUtils, createCloudinaryStorage } = require('./config/cloudinary');
const multer = require('multer');

// Example 1: Using predefined storage configurations
const uploadUserAvatar = multer({
    storage: storageConfigs.userAvatars,
    fileFilter: fileFilters.images,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB for avatars
});

const uploadProductVideo = multer({
    storage: storageConfigs.productVideos,
    fileFilter: fileFilters.videos,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB for videos
});

// Example 2: Creating custom storage configuration
const customImageStorage = createCloudinaryStorage('custom/folder', 'image', [
    { width: 800, height: 600, crop: 'fill' }
]);

const uploadCustomImages = multer({
    storage: customImageStorage,
    fileFilter: fileFilters.images,
    limits: { fileSize: 15 * 1024 * 1024 }
});

// Example 3: Using Cloudinary utilities directly
const uploadFileDirectly = async (fileBuffer, options = {}) => {
    try {
        const result = await cloudinaryUtils.uploadFile(fileBuffer, {
            folder: 'custom/uploads',
            ...options
        });
        return result.secure_url;
    } catch (error) {
        console.error('Direct upload failed:', error);
        throw error;
    }
};

// Example 4: Getting optimized URLs
const getOptimizedImageUrl = (publicId, width = 300, height = 300) => {
    return cloudinaryUtils.getOptimizedUrl(publicId, {
        width: width,
        height: height,
        crop: 'fill',
        gravity: 'face'
    });
};

module.exports = {
    uploadUserAvatar,
    uploadProductVideo,
    uploadCustomImages,
    uploadFileDirectly,
    getOptimizedImageUrl
};
