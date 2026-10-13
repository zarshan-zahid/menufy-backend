import express from 'express';
import { dbService } from '../services/dbStore.js';
import { protect } from '../middleware/auth.js';
import { requireRestaurantAccess } from '../middleware/tenant.js';

const router = express.Router();

// List branches for restaurant
router.get('/', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const branches = await dbService.branches.find({ restaurantId: req.restaurantId });

    return res.json({
      success: true,
      count: branches.length,
      branches,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch branches: ' + error.message,
    });
  }
});

// Create new branch
router.post('/', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const {
      name,
      address,
      city,
      phone = '',
      email = '',
      openingHours = { openTime: '10:00', closeTime: '23:00', isOpen24Hours: false },
      deliveryEnabled = true,
      pickupEnabled = true,
      isMainBranch = false,
      isActive = true,
    } = req.body;

    if (!name || !address || !city) {
      return res.status(400).json({
        success: false,
        message: 'Branch name, address, and city are required.',
      });
    }

    // If marked as main branch, reset other branches' main branch status
    if (isMainBranch) {
      const existing = await dbService.branches.find({ restaurantId: req.restaurantId });
      for (const b of existing) {
        if (b.isMainBranch) {
          await dbService.branches.findByIdAndUpdate(b._id, { isMainBranch: false });
        }
      }
    }

    const branch = await dbService.branches.create({
      restaurantId: req.restaurantId,
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      phone: phone.trim(),
      email: email.trim(),
      openingHours,
      deliveryEnabled: Boolean(deliveryEnabled),
      pickupEnabled: Boolean(pickupEnabled),
      isMainBranch: Boolean(isMainBranch),
      isActive: Boolean(isActive),
    });

    return res.status(201).json({
      success: true,
      message: 'Branch created successfully',
      branch,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create branch: ' + error.message,
    });
  }
});

// Update branch
router.put('/:id', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const branch = await dbService.branches.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    // Verify tenant ownership
    if (String(branch.restaurantId) !== String(req.restaurantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Branch belongs to another restaurant.',
      });
    }

    const {
      name,
      address,
      city,
      phone,
      email,
      openingHours,
      deliveryEnabled,
      pickupEnabled,
      isMainBranch,
      isActive,
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (address !== undefined) updates.address = address.trim();
    if (city !== undefined) updates.city = city.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (email !== undefined) updates.email = email.trim();
    if (openingHours !== undefined) updates.openingHours = openingHours;
    if (deliveryEnabled !== undefined) updates.deliveryEnabled = Boolean(deliveryEnabled);
    if (pickupEnabled !== undefined) updates.pickupEnabled = Boolean(pickupEnabled);
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    if (isMainBranch) {
      updates.isMainBranch = true;
      const allBranches = await dbService.branches.find({ restaurantId: req.restaurantId });
      for (const b of allBranches) {
        if (String(b._id) !== String(req.params.id) && b.isMainBranch) {
          await dbService.branches.findByIdAndUpdate(b._id, { isMainBranch: false });
        }
      }
    } else if (isMainBranch === false) {
      updates.isMainBranch = false;
    }

    const updated = await dbService.branches.findByIdAndUpdate(req.params.id, updates);

    return res.json({
      success: true,
      message: 'Branch updated successfully',
      branch: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update branch: ' + error.message,
    });
  }
});

// Delete branch
router.delete('/:id', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const branch = await dbService.branches.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    if (String(branch.restaurantId) !== String(req.restaurantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Branch belongs to another restaurant.',
      });
    }

    await dbService.branches.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: 'Branch deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete branch: ' + error.message,
    });
  }
});

export default router;
