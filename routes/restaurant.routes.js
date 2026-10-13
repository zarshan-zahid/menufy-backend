import express from 'express';
import { dbService } from '../services/dbStore.js';
import { protect } from '../middleware/auth.js';
import { requireRestaurantAccess } from '../middleware/tenant.js';

const router = express.Router();

// Get restaurant associated with logged-in user
router.get('/my-restaurant', protect, async (req, res) => {
  try {
    let restaurant = null;
    if (req.user.restaurantId) {
      restaurant = await dbService.restaurants.findById(req.user.restaurantId);
    }
    if (!restaurant && req.user.role === 'owner') {
      restaurant = await dbService.restaurants.findOne({ ownerId: req.user._id });
    }

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'No restaurant found for this account. Create one to get started.',
      });
    }

    return res.json({
      success: true,
      restaurant,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch restaurant: ' + error.message,
    });
  }
});

// Create new restaurant (onboarding)
router.post('/', protect, async (req, res) => {
  try {
    const {
      name,
      slug,
      cuisine = 'General',
      tagline,
      description,
      phone,
      email,
      address,
      city,
      currency = 'USD',
      currencySymbol = '$',
      logo = '',
      banner = '',
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant name is required',
      });
    }

    const cleanSlug = (slug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    if (!cleanSlug) {
      return res.status(400).json({
        success: false,
        message: 'A valid URL slug is required',
      });
    }

    // Check slug uniqueness across all tenants
    const existing = await dbService.restaurants.findOne({ slug: cleanSlug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Slug '${cleanSlug}' is already taken. Please choose another name or slug.`,
      });
    }

    const newRestaurant = await dbService.restaurants.create({
      ownerId: req.user._id,
      name,
      slug: cleanSlug,
      cuisine: cuisine.trim(),
      tagline: tagline || 'Crafted with passion, delivered with speed',
      description: description || '',
      phone: phone || '+1 (555) 234-5678',
      email: email || req.user.email,
      address: address || '123 Gourmet Street, Food District',
      city: city || 'Food City',
      currency,
      currencySymbol,
      logo: logo || '',
      banner: banner || '',
      status: 'pending',
      isPublished: false,
    });

    // Record audit activity
    await dbService.activities.create({
      type: 'APPLICATION_SUBMITTED',
      restaurantId: newRestaurant._id,
      restaurantName: newRestaurant.name,
      slug: newRestaurant.slug,
      ownerEmail: req.user.email,
      message: `New partner application submitted for "${newRestaurant.name}".`,
    });

    // Update user's restaurant reference
    await dbService.users.findByIdAndUpdate(req.user._id, {
      restaurantId: newRestaurant._id,
    });

    // Create a default category
    await dbService.categories.create({
      restaurantId: newRestaurant._id,
      name: 'Main Dishes',
      orderIndex: 0,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Restaurant application created successfully! Status is pending Super Admin review.',
      restaurant: newRestaurant,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create restaurant: ' + error.message,
    });
  }
});

// Update Profile
router.put('/:restaurantId/profile', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const { name, tagline, description, logo, banner, phone, email, address, city, currency, currencySymbol, cuisine, deliverySettings } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (tagline !== undefined) updates.tagline = tagline;
    if (description !== undefined) updates.description = description;
    if (cuisine !== undefined) updates.cuisine = String(cuisine).trim();
    if (logo !== undefined) updates.logo = logo;
    if (banner !== undefined) updates.banner = banner;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (currency !== undefined) updates.currency = currency;
    if (currencySymbol !== undefined) updates.currencySymbol = currencySymbol;
    if (deliverySettings !== undefined) updates.deliverySettings = deliverySettings;

    const updated = await dbService.restaurants.findByIdAndUpdate(req.restaurantId, updates);

    return res.json({
      success: true,
      message: 'Restaurant profile updated successfully',
      restaurant: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update restaurant profile: ' + error.message,
    });
  }
});

// Update Website Customizer Settings (Theme & Homepage Sections)
router.put('/:restaurantId/customizer', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const { theme, sections, logo, banner } = req.body;

    const updates = {};
    if (theme) updates.theme = theme;
    if (sections) updates.sections = sections;
    if (logo !== undefined) updates.logo = logo;
    if (banner !== undefined) updates.banner = banner;

    const updated = await dbService.restaurants.findByIdAndUpdate(req.restaurantId, updates);

    return res.json({
      success: true,
      message: 'Website customizer settings saved successfully!',
      restaurant: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update customizer settings: ' + error.message,
    });
  }
});

// Update Delivery & Operating Settings
router.put('/:restaurantId/delivery-settings', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const { deliverySettings, coordinates } = req.body;

    if (!deliverySettings) {
      return res.status(400).json({
        success: false,
        message: 'deliverySettings object is required',
      });
    }

    const updatePayload = { deliverySettings };
    if (coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number') {
      updatePayload.coordinates = coordinates;
    }

    const updated = await dbService.restaurants.findByIdAndUpdate(req.restaurantId, updatePayload);

    return res.json({
      success: true,
      message: 'Delivery settings saved successfully!',
      restaurant: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update delivery settings: ' + error.message,
    });
  }
});

// Publish / Unpublish Action
router.patch('/:restaurantId/publish', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const { isPublished } = req.body;
    const targetState = isPublished !== undefined ? Boolean(isPublished) : !req.restaurant.isPublished;

    // Strict status consistency guards: only active/approved restaurants can be published
    if (targetState) {
      if (req.restaurant.status === 'suspended') {
        return res.status(403).json({
          success: false,
          isSuspended: true,
          message: 'Cannot publish a suspended restaurant. Contact platform administration for review.',
        });
      }
      if (req.restaurant.status === 'pending') {
        return res.status(403).json({
          success: false,
          isPending: true,
          message: 'Cannot publish while your partner application is pending platform administration approval.',
        });
      }
      if (req.restaurant.status === 'rejected') {
        return res.status(403).json({
          success: false,
          isRejected: true,
          message: 'Cannot publish a rejected restaurant application.',
        });
      }
    }

    const updated = await dbService.restaurants.findByIdAndUpdate(req.restaurantId, {
      isPublished: targetState,
    });

    return res.json({
      success: true,
      message: targetState
        ? 'Congratulations! Your restaurant website is now published live to the public!'
        : 'Your restaurant website is now unpublished and hidden from public ordering.',
      restaurant: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle publication status: ' + error.message,
    });
  }
});

export default router;
