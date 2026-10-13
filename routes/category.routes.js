import express from 'express';
import { dbService } from '../services/dbStore.js';
import { protect } from '../middleware/auth.js';
import { requireRestaurantAccess } from '../middleware/tenant.js';

const router = express.Router();

// List categories for authenticated restaurant
router.get('/', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const categories = await dbService.categories.find({
      restaurantId: req.restaurantId,
    });

    return res.json({
      success: true,
      categories,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch categories: ' + error.message,
    });
  }
});

// Create category
router.post('/', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const { name, description = '', orderIndex = 0, isActive = true } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }

    const category = await dbService.categories.create({
      restaurantId: req.restaurantId,
      name,
      description,
      orderIndex: Number(orderIndex) || 0,
      isActive: Boolean(isActive),
    });

    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create category: ' + error.message,
    });
  }
});

// Update category
router.put('/:id', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const category = await dbService.categories.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Tenant check: must belong to current restaurant
    if (String(category.restaurantId) !== String(req.restaurantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Category belongs to another restaurant',
      });
    }

    const { name, description, orderIndex, isActive } = req.body;
    const updates = {};
    if (name !== undefined) {
      updates.name = name;
      updates.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    if (description !== undefined) updates.description = description;
    if (orderIndex !== undefined) updates.orderIndex = Number(orderIndex);
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    const updated = await dbService.categories.findByIdAndUpdate(req.params.id, updates);

    return res.json({
      success: true,
      message: 'Category updated successfully',
      category: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update category: ' + error.message,
    });
  }
});

// Delete category
router.delete('/:id', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const category = await dbService.categories.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    if (String(category.restaurantId) !== String(req.restaurantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Category belongs to another restaurant',
      });
    }

    // Delete associated menu items or let them be deleted
    await dbService.menuItems.deleteMany({
      categoryId: req.params.id,
      restaurantId: req.restaurantId,
    });

    await dbService.categories.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: 'Category and associated items deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete category: ' + error.message,
    });
  }
});

export default router;
