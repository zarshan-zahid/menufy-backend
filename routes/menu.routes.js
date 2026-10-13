import express from 'express';
import { dbService } from '../services/dbStore.js';
import { protect } from '../middleware/auth.js';
import { requireRestaurantAccess } from '../middleware/tenant.js';

const router = express.Router();

// List menu items for authenticated restaurant
router.get('/', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const filter = { restaurantId: req.restaurantId };
    if (req.query.categoryId) {
      filter.categoryId = req.query.categoryId;
    }

    const items = await dbService.menuItems.find(filter);

    return res.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch menu items: ' + error.message,
    });
  }
});

// Create menu item
router.post('/', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const {
      categoryId,
      name,
      description = '',
      image = '',
      price,
      discountPrice = null,
      isAvailable = true,
      isFeatured = false,
      prepTime = '',
      orderIndex = 0,
      sizes = [],
      extras = [],
    } = req.body;

    if (!name || price === undefined || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Item name, price, and category are required',
      });
    }

    // Verify category belongs to this restaurant
    const category = await dbService.categories.findById(categoryId);
    if (!category || String(category.restaurantId) !== String(req.restaurantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category for this restaurant',
      });
    }

    const newItem = await dbService.menuItems.create({
      restaurantId: req.restaurantId,
      categoryId,
      name: name.trim(),
      description: description.trim(),
      image:
        image ||
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      price: Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : null,
      isAvailable: Boolean(isAvailable),
      isFeatured: Boolean(isFeatured),
      prepTime: prepTime ? String(prepTime).trim() : '',
      orderIndex: Number(orderIndex) || 0,
      sizes: Array.isArray(sizes) ? sizes : [],
      extras: Array.isArray(extras) ? extras : [],
    });

    return res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      item: newItem,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create menu item: ' + error.message,
    });
  }
});

// Update menu item
router.put('/:id', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const item = await dbService.menuItems.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }

    // Tenant authorization check
    if (String(item.restaurantId) !== String(req.restaurantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Item belongs to another restaurant',
      });
    }

    const {
      categoryId,
      name,
      description,
      image,
      price,
      discountPrice,
      isAvailable,
      isFeatured,
      prepTime,
      orderIndex,
      sizes,
      extras,
    } = req.body;

    const updates = {};
    if (categoryId !== undefined) {
      // Validate category belongs to this tenant
      const category = await dbService.categories.findById(categoryId);
      if (!category || String(category.restaurantId) !== String(req.restaurantId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category for this restaurant',
        });
      }
      updates.categoryId = categoryId;
    }

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (image !== undefined) updates.image = image;
    if (price !== undefined) updates.price = Number(price);
    if (discountPrice !== undefined) updates.discountPrice = discountPrice ? Number(discountPrice) : null;
    if (isAvailable !== undefined) updates.isAvailable = Boolean(isAvailable);
    if (isFeatured !== undefined) updates.isFeatured = Boolean(isFeatured);
    if (prepTime !== undefined) updates.prepTime = String(prepTime).trim();
    if (orderIndex !== undefined) updates.orderIndex = Number(orderIndex);
    if (sizes !== undefined) updates.sizes = Array.isArray(sizes) ? sizes : [];
    if (extras !== undefined) updates.extras = Array.isArray(extras) ? extras : [];

    const updated = await dbService.menuItems.findByIdAndUpdate(req.params.id, updates);

    return res.json({
      success: true,
      message: 'Menu item updated successfully',
      item: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update menu item: ' + error.message,
    });
  }
});

// Toggle availability
router.patch('/:id/availability', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const item = await dbService.menuItems.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (String(item.restaurantId) !== String(req.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const newStatus = req.body.isAvailable !== undefined ? Boolean(req.body.isAvailable) : !item.isAvailable;
    const updated = await dbService.menuItems.findByIdAndUpdate(req.params.id, { isAvailable: newStatus });

    return res.json({
      success: true,
      message: `Item marked as ${newStatus ? 'Available' : 'Unavailable'}`,
      item: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update availability: ' + error.message,
    });
  }
});

// Toggle featured
router.patch('/:id/featured', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const item = await dbService.menuItems.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (String(item.restaurantId) !== String(req.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const newStatus = req.body.isFeatured !== undefined ? Boolean(req.body.isFeatured) : !item.isFeatured;
    const updated = await dbService.menuItems.findByIdAndUpdate(req.params.id, { isFeatured: newStatus });

    return res.json({
      success: true,
      message: `Item marked as ${newStatus ? 'Featured' : 'Standard'}`,
      item: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update featured state: ' + error.message,
    });
  }
});

// Delete menu item
router.delete('/:id', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const item = await dbService.menuItems.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (String(item.restaurantId) !== String(req.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await dbService.menuItems.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: 'Menu item deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete menu item: ' + error.message,
    });
  }
});

export default router;
