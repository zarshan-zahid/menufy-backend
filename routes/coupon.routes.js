import express from 'express';
import { dbService } from '../services/dbStore.js';
import { protect } from '../middleware/auth.js';
import { requireRestaurantAccess } from '../middleware/tenant.js';

const router = express.Router();

// List coupons
router.get('/', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const coupons = await dbService.coupons.find({ restaurantId: req.restaurantId });

    return res.json({
      success: true,
      coupons,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch coupons: ' + error.message,
    });
  }
});

// Create coupon
router.post('/', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const {
      code,
      discountType = 'percentage',
      discountValue,
      minOrderAmount = 0,
      maxDiscountAmount = null,
      usageLimit = 100,
      expiresAt = null,
      isActive = true,
    } = req.body;

    if (!code || discountValue === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and discount value are required',
      });
    }

    const cleanCode = code.toUpperCase().trim();

    // Check code uniqueness within this restaurant
    const existing = await dbService.coupons.findOne({
      restaurantId: req.restaurantId,
      code: cleanCode,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Coupon code '${cleanCode}' already exists for this restaurant`,
      });
    }

    const coupon = await dbService.coupons.create({
      restaurantId: req.restaurantId,
      code: cleanCode,
      discountType,
      discountValue: Number(discountValue),
      minOrderAmount: Number(minOrderAmount) || 0,
      maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
      usageLimit: Number(usageLimit) || 100,
      usageCount: 0,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      isActive: Boolean(isActive),
    });

    return res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create coupon: ' + error.message,
    });
  }
});

// Update coupon
router.put('/:id', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const coupon = await dbService.coupons.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    if (String(coupon.restaurantId) !== String(req.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const {
      code,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      expiresAt,
      isActive,
    } = req.body;

    const updates = {};
    if (code !== undefined) updates.code = code.toUpperCase().trim();
    if (discountType !== undefined) updates.discountType = discountType;
    if (discountValue !== undefined) updates.discountValue = Number(discountValue);
    if (minOrderAmount !== undefined) updates.minOrderAmount = Number(minOrderAmount);
    if (maxDiscountAmount !== undefined) updates.maxDiscountAmount = maxDiscountAmount ? Number(maxDiscountAmount) : null;
    if (usageLimit !== undefined) updates.usageLimit = Number(usageLimit);
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt).toISOString() : null;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    const updated = await dbService.coupons.findByIdAndUpdate(req.params.id, updates);

    return res.json({
      success: true,
      message: 'Coupon updated successfully',
      coupon: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update coupon: ' + error.message,
    });
  }
});

// Delete coupon
router.delete('/:id', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const coupon = await dbService.coupons.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    if (String(coupon.restaurantId) !== String(req.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await dbService.coupons.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete coupon: ' + error.message,
    });
  }
});

export default router;
