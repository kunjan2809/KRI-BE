const Category = require('../models/Category');
const Product = require('../models/Product');

// Get All Categories (Public API - No Authentication Required)
const getAllCategories = async (req, res) => {
  try {
    console.log('Fetching all categories');
    // Get all categories with product count
    const categories = await Category.find({})
      .populate('product_count')
      .sort({ name: 1 }); // Sort alphabetically by name
    
    res.json({
      success: true,
      data: {
        categories: categories,
        total_categories: categories.length
      }
    });
    
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

// Add New Category (Admin only)
const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }
    
    // Check if category with same name already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }
    
    // Create new category
    const category = new Category({
      name,
      description
    });
    
    await category.save();
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: {
        category: category
      }
    });
    
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category',
      error: error.message
    });
  }
};

// Edit Category (Admin only)
const editCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, description } = req.body;
    
    // Find category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // If name is being updated, check for duplicates
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ 
        name: name,
        _id: { $ne: categoryId }
      });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }
    }
    
    // Update only provided fields
    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    
    await category.save();
    
    res.json({
      success: true,
      message: 'Category updated successfully',
      data: {
        category: category
      }
    });
    
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating category',
      error: error.message
    });
  }
};

// Delete Category (Admin only) - Cascade delete all products in this category
const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    // Find category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Get count of products in this category
    const productCount = await Product.countDocuments({ 
      category_id: categoryId,
      deleted_at: null,
      status: { $ne: 'deleted' }
    });
    
    // Soft delete all products in this category
    await Product.updateMany(
      { category_id: categoryId },
      { 
        $set: { 
          deleted_at: new Date(),
          status: 'deleted'
        }
      }
    );
    
    // Delete the category
    await Category.findByIdAndDelete(categoryId);
    
    res.json({
      success: true,
      message: `Category deleted successfully. ${productCount} products were also deleted.`,
      data: {
        deleted_category: category.name,
        deleted_products_count: productCount
      }
    });
    
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
      error: error.message
    });
  }
};

module.exports = {
  getAllCategories,
  addCategory,
  editCategory,
  deleteCategory
};
