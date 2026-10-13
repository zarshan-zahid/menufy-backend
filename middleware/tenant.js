import { dbService } from '../services/dbStore.js';

/**
 * Tenant scoping middleware.
 * Verifies that the authenticated user owns or has authorization
 * over the specified restaurant (via req.params.restaurantId,
 * query.restaurantId, body.restaurantId, or finds the user's active restaurant).
 */
export const requireRestaurantAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required for tenant operations.',
      });
    }

    const requestedId =
      req.params.restaurantId ||
      req.query.restaurantId ||
      req.body.restaurantId;

    let restaurant;

    if (requestedId) {
      restaurant = await dbService.restaurants.findById(requestedId);
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: 'Restaurant not found.',
        });
      }

      // Check ownership or staff assignment
      const isOwner = String(restaurant.ownerId) === String(req.user._id || req.user.id);
      const isStaff =
        req.user.restaurantId &&
        String(req.user.restaurantId) === String(restaurant._id);

      if (!isOwner && !isStaff) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have permission to manage this restaurant.',
        });
      }
    } else {
      const userId = req.user._id || req.user.id;
      if (req.user.restaurantId) {
        restaurant = await dbService.restaurants.findById(req.user.restaurantId);
      }
      if (!restaurant) {
        restaurant = await dbService.restaurants.findOne({ ownerId: userId });
      }

      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: 'No restaurant associated with this user account.',
        });
      }
    }

    // Check suspension on mutating actions
    if (restaurant.status === 'suspended' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return res.status(403).json({
        success: false,
        message: 'This restaurant account is currently suspended. Modifications and new actions are disabled. Please contact platform administration.',
      });
    }

    // Attach validated tenant scope
    req.restaurant = restaurant;
    req.restaurantId = restaurant._id;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error verifying restaurant tenant permissions: ' + error.message,
    });
  }
};
