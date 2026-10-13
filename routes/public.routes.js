import express from 'express';
import { dbService } from '../services/dbStore.js';
import {
  calculateDistanceKm,
  calculateEtaMinutes,
  searchPakistanPlaces,
  PAKISTAN_CITIES,
  getCityCoordinates,
} from '../utils/geo.js';
import { broadcastOrderStatus } from '../services/socketService.js';

const router = express.Router();

// Helper to check if restaurant is currently open based on openingHours
const getIsOpenNow = (openingHours) => {
  if (!openingHours) return true;
  if (openingHours.isOpen24Hours) return true;

  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = days[now.getDay()];

  if (openingHours.closedDays && openingHours.closedDays.includes(currentDay)) {
    return false;
  }

  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeNum = currentHours * 60 + currentMinutes;

  const [openH, openM] = (openingHours.openTime || '10:00').split(':').map(Number);
  const [closeH, closeM] = (openingHours.closeTime || '23:00').split(':').map(Number);

  const openTimeNum = openH * 60 + openM;
  const closeTimeNum = closeH * 60 + closeM;

  if (closeTimeNum > openTimeNum) {
    return currentTimeNum >= openTimeNum && currentTimeNum <= closeTimeNum;
  } else {
    // Crosses midnight
    return currentTimeNum >= openTimeNum || currentTimeNum <= closeTimeNum;
  }
};

// Pakistan Places, Cities and Neighborhood Search Directory
router.get('/pakistan-places', (req, res) => {
  try {
    const query = req.query.query || req.query.q || '';
    const city = req.query.city || '';
    const places = searchPakistanPlaces(query, city);
    return res.json({
      success: true,
      cities: Object.keys(PAKISTAN_CITIES),
      cityCoordinates: PAKISTAN_CITIES,
      places,
      results: places,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to search places: ' + error.message,
    });
  }
});

// Explore / Featured published restaurants
router.get('/explore', async (req, res) => {
  try {
    const all = await dbService.restaurants.find({ isPublished: true });
    // Public directory only includes active or approved restaurants (no pending, rejected, or suspended)
    const restaurants = all.filter(
      (r) => (r.status === 'active' || r.status === 'approved') && r.status !== 'pending' && r.status !== 'rejected' && r.status !== 'suspended'
    );
    return res.json({
      success: true,
      restaurants: restaurants.map((r) => ({
        _id: r._id,
        name: r.name,
        slug: r.slug,
        tagline: r.tagline,
        logo: r.logo || '',
        banner: r.banner,
        address: r.address,
        city: r.city || '',
        phone: r.phone || '',
        cuisine: r.cuisine || 'General',
        currencySymbol: r.currencySymbol,
        isFeatured: Boolean(r.isFeatured || r.sections?.showFeatured),
        theme: r.theme,
        deliverySettings: {
          deliveryFee: r.deliverySettings?.deliveryFee,
          estimatedDeliveryTime: r.deliverySettings?.estimatedDeliveryTime,
          minOrderAmount: r.deliverySettings?.minOrderAmount,
          isOpenNow: getIsOpenNow(r.deliverySettings?.openingHours),
        },
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to explore restaurants: ' + error.message,
    });
  }
});

// Get published restaurant website configuration by slug
router.get('/restaurant/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const cleanSlug = slug.toLowerCase().trim();

    const restaurant = await dbService.restaurants.findOne({ slug: cleanSlug });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: `Restaurant with URL slug '${cleanSlug}' was not found.`,
      });
    }

    // Critical check: pending, rejected, suspended or unpublished restaurants must not be accessible as active public ordering sites
    if (restaurant.status === 'pending') {
      return res.status(403).json({
        success: false,
        isPending: true,
        restaurantName: restaurant.name,
        message: 'This restaurant application is currently pending platform administration review.',
      });
    }

    if (restaurant.status === 'rejected') {
      return res.status(403).json({
        success: false,
        isRejected: true,
        restaurantName: restaurant.name,
        message: 'This restaurant application was not approved for publication.',
      });
    }

    if (restaurant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        isSuspended: true,
        restaurantName: restaurant.name,
        message: 'This restaurant website is currently suspended by platform administration.',
      });
    }

    if (!restaurant.isPublished || (restaurant.status !== 'active' && restaurant.status !== 'approved')) {
      return res.status(403).json({
        success: false,
        isPublished: false,
        restaurantName: restaurant.name,
        message: 'This restaurant website is currently unpublished or undergoing maintenance by its owner.',
      });
    }

    const isOpenNow = getIsOpenNow(restaurant.deliverySettings?.openingHours);
    const restObj = restaurant.toObject ? restaurant.toObject() : restaurant;

    return res.json({
      success: true,
      restaurant: {
        ...restObj,
        isOpenNow,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch restaurant details: ' + error.message,
    });
  }
});

// Get active branches for restaurant storefront
router.get('/restaurant/:slug/branches', async (req, res) => {
  try {
    const { slug } = req.params;
    const cleanSlug = slug.toLowerCase().trim();

    const restaurant = await dbService.restaurants.findOne({ slug: cleanSlug });
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const branches = await dbService.branches.find({
      restaurantId: restaurant._id,
      isActive: true,
    });

    return res.json({
      success: true,
      count: branches.length,
      branches,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch restaurant branches: ' + error.message,
    });
  }
});

// Get menu categories and items for published restaurant
router.get('/restaurant/:slug/menu', async (req, res) => {
  try {
    const { slug } = req.params;
    const cleanSlug = slug.toLowerCase().trim();

    const restaurant = await dbService.restaurants.findOne({ slug: cleanSlug });

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    if (restaurant.status === 'pending') {
      return res.status(403).json({
        success: false,
        isPending: true,
        message: 'This restaurant is currently pending platform administration review.',
      });
    }

    if (restaurant.status === 'rejected') {
      return res.status(403).json({
        success: false,
        isRejected: true,
        message: 'This restaurant application was not approved for publication.',
      });
    }

    if (restaurant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        isSuspended: true,
        message: 'This restaurant is currently suspended.',
      });
    }

    if (!restaurant.isPublished || (restaurant.status !== 'active' && restaurant.status !== 'approved')) {
      return res.status(403).json({
        success: false,
        isPublished: false,
        message: 'Restaurant is not published',
      });
    }

    // Fetch active categories
    const allCategories = await dbService.categories.find({
      restaurantId: restaurant._id,
      isActive: true,
    });

    // Fetch menu items (including available and unavailable items for sold-out display)
    const allItems = await dbService.menuItems.find({
      restaurantId: restaurant._id,
    });

    // Group items by category
    const categorizedMenu = allCategories.map((cat) => {
      const items = allItems.filter((i) => String(i.categoryId) === String(cat._id));
      return {
        _id: cat._id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        orderIndex: cat.orderIndex,
        items,
      };
    });

    const featuredItems = allItems.filter((i) => i.isFeatured);

    return res.json({
      success: true,
      restaurantId: restaurant._id,
      categories: categorizedMenu,
      featuredItems,
      totalItems: allItems.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch restaurant menu: ' + error.message,
    });
  }
});

// Validate coupon code against subtotal
router.post('/restaurant/:slug/validate-coupon', async (req, res) => {
  try {
    const { slug } = req.params;
    const { code, subtotal } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const restaurant = await dbService.restaurants.findOne({ slug: slug.toLowerCase().trim() });
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const coupon = await dbService.coupons.findOne({
      restaurantId: restaurant._id,
      code: code.toUpperCase().trim(),
      isActive: true,
    });

    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive coupon code',
      });
    }

    // Check expiry
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This coupon code has expired',
      });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'This coupon code usage limit has been reached',
      });
    }

    const orderSubtotal = Number(subtotal) || 0;

    // Check minimum order amount
    if (coupon.minOrderAmount && orderSubtotal < coupon.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Order subtotal must be at least ${restaurant.currencySymbol || '$'}${coupon.minOrderAmount} to use this coupon`,
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (orderSubtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else {
      discount = coupon.discountValue;
    }

    discount = Math.min(discount, orderSubtotal);
    discount = Math.round(discount * 100) / 100;

    return res.json({
      success: true,
      message: `Coupon '${coupon.code}' applied successfully!`,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        calculatedDiscount: discount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to validate coupon: ' + error.message,
    });
  }
});

// Checkout and place order (Server-Side Price Calculation & Validation)
router.post('/restaurant/:slug/orders', async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      customerInfo,
      recipientInfo = null,
      customerId = null,
      orderType = 'delivery',
      items = [],
      couponCode = null,
      paymentMethod = 'cash_on_delivery',
      branchId = null,
    } = req.body;

    const idempotencyKey =
      req.headers['x-idempotency-key'] || req.body.idempotencyKey || null;

    const restaurant = await dbService.restaurants.findOne({ slug: slug.toLowerCase().trim() });
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    if (restaurant.status === 'pending') {
      return res.status(403).json({
        success: false,
        isPending: true,
        message: 'This restaurant application is currently pending review and cannot accept orders.',
      });
    }

    if (restaurant.status === 'rejected') {
      return res.status(403).json({
        success: false,
        isRejected: true,
        message: 'This restaurant application has been rejected and cannot accept orders.',
      });
    }

    if (restaurant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        isSuspended: true,
        message: 'This restaurant is currently suspended by platform administration and cannot accept orders.',
      });
    }

    if (restaurant.status !== 'active' && restaurant.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'This restaurant is not currently active and cannot accept orders.',
      });
    }

    if (!restaurant.isPublished) {
      return res.status(403).json({
        success: false,
        message: 'This restaurant is currently unpublished and cannot accept orders.',
      });
    }

    // Check idempotency: prevent accidental duplicate order submission
    if (idempotencyKey) {
      const existing = await dbService.orders.findOne({
        restaurantId: restaurant._id,
        idempotencyKey,
      });
      if (existing) {
        return res.status(200).json({
          success: true,
          idempotent: true,
          message: 'Order already processed',
          orderNumber: existing.orderNumber,
          order: existing,
        });
      }
    }

    // Branch association if provided
    let verifiedBranchId = null;
    let verifiedBranchName = '';
    if (branchId) {
      const branch = await dbService.branches.findById(branchId);
      if (branch && String(branch.restaurantId) === String(restaurant._id) && branch.isActive) {
        verifiedBranchId = branch._id;
        verifiedBranchName = branch.name;
      }
    }

    // Validate customer details
    if (!customerInfo || !customerInfo.name || !customerInfo.phone) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and phone number are required to place an order.',
      });
    }

    if (orderType === 'delivery') {
      if (!restaurant.deliverySettings?.deliveryEnabled) {
        return res.status(400).json({
          success: false,
          message: 'Delivery is currently disabled for this restaurant. Please choose pickup.',
        });
      }
      if (!customerInfo.address || !customerInfo.address.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Delivery address is required for delivery orders.',
        });
      }

      // Validate delivery service area
      const addrLower = customerInfo.address.toLowerCase().trim();
      const restCity = (restaurant.city || '').toLowerCase().trim();
      const rawAllowed = (restaurant.deliverySettings?.allowedCities || []).map((c) => c.toLowerCase().trim());

      if (rawAllowed.length > 0) {
        const effectiveAllowed = restCity && !rawAllowed.includes(restCity)
          ? [...rawAllowed, restCity]
          : rawAllowed;
        const otherMajorCities = ['karachi', 'lahore', 'islamabad', 'rawalpindi', 'peshawar', 'faisalabad', 'multan', 'quetta'].filter((c) => !effectiveAllowed.includes(c));
        const mentionsOtherCity = otherMajorCities.some((c) => addrLower.includes(c));
        const inAllowedCity = effectiveAllowed.some((c) => addrLower.includes(c));

        if (mentionsOtherCity && !inAllowedCity) {
          return res.status(400).json({
            success: false,
            message: `Delivery unavailable: Selected destination is outside our active delivery zone. Delivery is only supported within ${effectiveAllowed.join(', ')}. Please choose pickup or enter an address in the delivery area.`,
          });
        }
      } else if (restaurant.city && restaurant.deliverySettings?.enforceCityBoundary) {
        const otherMajorCities = ['karachi', 'lahore', 'islamabad', 'rawalpindi', 'peshawar', 'faisalabad', 'multan', 'quetta'].filter((c) => c !== restCity);
        const mentionsOtherCity = otherMajorCities.some((c) => addrLower.includes(c));
        if (mentionsOtherCity && !addrLower.includes(restCity)) {
          return res.status(400).json({
            success: false,
            message: `Delivery unavailable: ${restaurant.name} only delivers within ${restaurant.city}. Your address appears to be outside our active service zone. Please select Pickup or enter an address in ${restaurant.city}.`,
          });
        }
      }

      // Coordinate and Service Radius Validation
      const destLat = customerInfo.coordinates?.lat !== undefined && customerInfo.coordinates?.lat !== null
        ? Number(customerInfo.coordinates.lat)
        : null;
      const destLng = customerInfo.coordinates?.lng !== undefined && customerInfo.coordinates?.lng !== null
        ? Number(customerInfo.coordinates.lng)
        : null;

      const restCoords = restaurant.coordinates || getCityCoordinates(restaurant.city || 'Karachi');
      const maxRadius = restaurant.deliverySettings?.maxDeliveryRadiusKm || 15;

      if (destLat !== null && destLng !== null && !isNaN(destLat) && !isNaN(destLng)) {
        const dist = calculateDistanceKm(restCoords.lat, restCoords.lng, destLat, destLng);
        if (dist !== null) {
          if (dist > maxRadius) {
            return res.status(400).json({
              success: false,
              message: `Delivery unavailable: Selected destination is ${dist.toFixed(1)} km away, which exceeds ${restaurant.name}'s maximum service radius of ${maxRadius} km. Please select Pickup or choose an address closer to the restaurant.`,
            });
          }

          const zones = restaurant.deliverySettings?.deliveryZones || [];
          if (zones.length > 0) {
            const maxZoneDist = Math.max(...zones.map((z) => z.maxDistanceKm || maxRadius));
            if (restaurant.deliverySettings?.enforceZoneBoundary && dist > maxZoneDist) {
              return res.status(400).json({
                success: false,
                message: `Delivery unavailable: Your address (${dist.toFixed(1)} km) is outside all configured delivery zones for ${restaurant.name} (max zone distance: ${maxZoneDist} km).`,
              });
            }
          }
        }
      }
    } else {
      if (!restaurant.deliverySettings?.pickupEnabled) {
        return res.status(400).json({
          success: false,
          message: 'Pickup is currently disabled for this restaurant.',
        });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty. Please add items before checking out.',
      });
    }

    // STRICT SERVER-SIDE PRICE AND ITEM VALIDATION
    let verifiedSubtotal = 0;
    const orderItems = [];

    for (const clientItem of items) {
      const itemId = clientItem.menuItemId || clientItem.foodItemId || clientItem._id || clientItem.id;
      const dbItem = await dbService.menuItems.findById(itemId);

      if (!dbItem) {
        return res.status(400).json({
          success: false,
          message: `Item not found or no longer available on menu.`,
        });
      }

      // Check tenant isolation: ensure item belongs to this restaurant
      if (String(dbItem.restaurantId) !== String(restaurant._id)) {
        return res.status(400).json({
          success: false,
          message: `Item '${dbItem.name}' belongs to a different restaurant and cannot be ordered here.`,
        });
      }

      // Validate item availability
      if (!dbItem.isAvailable) {
        return res.status(400).json({
          success: false,
          message: `Sorry, '${dbItem.name}' is currently out of stock.`,
        });
      }

      // Validate quantity: must be positive whole integer
      const rawQty = clientItem.quantity;
      const qty = Number(rawQty);
      if (rawQty === undefined || rawQty === null || isNaN(qty) || !Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for item '${dbItem.name}'. Quantity must be a positive whole number.`,
        });
      }

      // Determine verified base price from database
      let unitPrice = dbItem.discountPrice !== null && dbItem.discountPrice !== undefined
        ? dbItem.discountPrice
        : dbItem.price;

      // Handle selected size and validate against DB
      let verifiedSize = { name: '', price: 0 };
      const requestedSizeName = typeof clientItem.selectedSize === 'string'
        ? clientItem.selectedSize.trim()
        : clientItem.selectedSize?.name?.trim();

      if (requestedSizeName) {
        const matchingSize = (dbItem.sizes || []).find(
          (s) => s.name.toLowerCase() === requestedSizeName.toLowerCase()
        );
        if (!matchingSize) {
          return res.status(400).json({
            success: false,
            message: `Selected size '${requestedSizeName}' is not valid for '${dbItem.name}'.`,
          });
        }
        const sizePrice = matchingSize.price !== undefined ? matchingSize.price : (dbItem.price + (matchingSize.priceModifier || 0));
        verifiedSize = { name: matchingSize.name, price: sizePrice };
        unitPrice = sizePrice;
      }

      // Handle selected extras and validate against DB
      const verifiedExtras = [];
      if (Array.isArray(clientItem.selectedExtras) && clientItem.selectedExtras.length > 0) {
        for (const extra of clientItem.selectedExtras) {
          const extraName = (typeof extra === 'string' ? extra : extra?.name)?.trim();
          if (!extraName) continue;
          const matchingExtra = (dbItem.extras || []).find(
            (e) => e.name.toLowerCase() === extraName.toLowerCase()
          );
          if (!matchingExtra) {
            return res.status(400).json({
              success: false,
              message: `Selected add-on / extra '${extraName}' is not valid for '${dbItem.name}'.`,
            });
          }
          const extraPrice = matchingExtra.price !== undefined ? matchingExtra.price : (matchingExtra.priceModifier || 0);
          verifiedExtras.push({ name: matchingExtra.name, price: extraPrice });
          unitPrice += extraPrice;
        }
      }

      // Price verification: If client submitted an expected price, reject if it has changed
      const clientExpectedPrice = clientItem.expectedUnitPrice !== undefined
        ? Number(clientItem.expectedUnitPrice)
        : (clientItem.clientPrice !== undefined ? Number(clientItem.clientPrice) : undefined);

      if (clientExpectedPrice !== undefined && !isNaN(clientExpectedPrice)) {
        if (Math.abs(clientExpectedPrice - unitPrice) > 0.01) {
          return res.status(400).json({
            success: false,
            message: `The price for '${dbItem.name}' has changed (expected ${restaurant.currencySymbol || '$'}${clientExpectedPrice.toFixed(2)}, current is ${restaurant.currencySymbol || '$'}${unitPrice.toFixed(2)}). Please review your cart before checking out.`,
          });
        }
      }

      const itemTotal = Math.round(unitPrice * qty * 100) / 100;
      verifiedSubtotal += itemTotal;

      orderItems.push({
        menuItemId: dbItem._id,
        name: dbItem.name,
        image: dbItem.image || '',
        basePrice: dbItem.price,
        selectedSize: verifiedSize,
        selectedExtras: verifiedExtras,
        unitPrice,
        quantity: qty,
        totalPrice: itemTotal,
        specialInstructions: clientItem.specialInstructions || '',
      });
    }

    verifiedSubtotal = Math.round(verifiedSubtotal * 100) / 100;

    // Validate minimum order amount
    const minOrder = restaurant.deliverySettings?.minOrderAmount || 0;
    if (orderType === 'delivery' && verifiedSubtotal < minOrder) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount for delivery is ${restaurant.currencySymbol || '$'}${minOrder}. Your subtotal is ${restaurant.currencySymbol || '$'}${verifiedSubtotal}.`,
      });
    }

    // Coordinate and Zone-based Delivery Fee calculation
    let matchedZone = null;
    let validatedDistanceKm = null;
    const destLat = customerInfo.coordinates?.lat !== undefined && customerInfo.coordinates?.lat !== null
      ? Number(customerInfo.coordinates.lat)
      : null;
    const destLng = customerInfo.coordinates?.lng !== undefined && customerInfo.coordinates?.lng !== null
      ? Number(customerInfo.coordinates.lng)
      : null;
    const restCoords = restaurant.coordinates || getCityCoordinates(restaurant.city || 'Karachi');

    if (orderType === 'delivery' && destLat !== null && destLng !== null && !isNaN(destLat) && !isNaN(destLng)) {
      validatedDistanceKm = calculateDistanceKm(restCoords.lat, restCoords.lng, destLat, destLng);
      const zones = restaurant.deliverySettings?.deliveryZones || [];
      const eligible = zones.filter((z) => (z.maxDistanceKm ? validatedDistanceKm <= z.maxDistanceKm : true));
      if (eligible.length > 0) {
        matchedZone = eligible[0];
      }
    }

    // Delivery fee
    let deliveryFee = 0;
    if (orderType === 'delivery') {
      if (matchedZone && matchedZone.fee !== undefined) {
        deliveryFee = matchedZone.fee;
      } else {
        deliveryFee = restaurant.deliverySettings?.deliveryFee || 0;
      }
    }

    // Coupon calculation
    let discount = 0;
    let appliedCouponCode = null;

    if (couponCode) {
      const coupon = await dbService.coupons.findOne({
        restaurantId: restaurant._id,
        code: couponCode.toUpperCase().trim(),
        isActive: true,
      });

      if (coupon) {
        const isNotExpired = !coupon.expiresAt || new Date(coupon.expiresAt) >= new Date();
        const limitNotReached = !coupon.usageLimit || coupon.usageCount < coupon.usageLimit;
        const meetsMin = !coupon.minOrderAmount || verifiedSubtotal >= coupon.minOrderAmount;

        if (isNotExpired && limitNotReached && meetsMin) {
          if (coupon.discountType === 'percentage') {
            discount = (verifiedSubtotal * coupon.discountValue) / 100;
            if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
              discount = coupon.maxDiscountAmount;
            }
          } else {
            discount = coupon.discountValue;
          }
          discount = Math.min(discount, verifiedSubtotal);
          discount = Math.round(discount * 100) / 100;
          appliedCouponCode = coupon.code;

          // Increment coupon usage
          await dbService.coupons.findByIdAndUpdate(coupon._id, {
            usageCount: (coupon.usageCount || 0) + 1,
          });
        }
      }
    }

    // Calculate tax
    const taxRate = restaurant.deliverySettings?.taxRate || 0;
    const taxableAmount = Math.max(0, verifiedSubtotal - discount);
    const tax = Math.round(((taxableAmount * taxRate) / 100) * 100) / 100;

    // Final total generated on server
    const total = Math.max(0, Math.round((taxableAmount + deliveryFee + tax) * 100) / 100);

    // Generate unique order number (e.g. FF-202610-84321)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randStr = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `FF-${dateStr}-${randStr}`;

    const newOrder = await dbService.orders.create({
      orderNumber,
      restaurantId: restaurant._id,
      branchId: verifiedBranchId,
      branchName: verifiedBranchName,
      customerId: customerId || null,
      recipientInfo:
        recipientInfo && recipientInfo.isGiftOrder
          ? {
              isGiftOrder: true,
              recipientName: recipientInfo.recipientName?.trim() || '',
              recipientPhone: recipientInfo.recipientPhone?.trim() || '',
              giftMessage: recipientInfo.giftMessage?.trim() || '',
              notes: recipientInfo.notes?.trim() || '',
            }
          : null,
      idempotencyKey,
      customerInfo: {
        name: customerInfo.name.trim(),
        phone: customerInfo.phone.trim(),
        email: customerInfo.email?.trim() || '',
        address: customerInfo.address?.trim() || '',
        city: customerInfo.city?.trim() || restaurant.city || 'Karachi',
        area: customerInfo.area?.trim() || '',
        landmark: customerInfo.landmark?.trim() || '',
        coordinates: destLat !== null && destLng !== null ? { lat: destLat, lng: destLng } : null,
        notes: customerInfo.notes?.trim() || '',
        deliveryInstructions: customerInfo.deliveryInstructions?.trim() || customerInfo.notes?.trim() || '',
      },
      restaurantLocation: {
        name: restaurant.name,
        address: restaurant.address || '',
        city: restaurant.city || '',
        coordinates: restCoords,
      },
      deliveryZone: matchedZone
        ? { name: matchedZone.name, fee: matchedZone.fee, distanceKm: validatedDistanceKm }
        : (validatedDistanceKm ? { name: 'Standard Delivery Area', fee: deliveryFee, distanceKm: validatedDistanceKm } : null),
      orderType,
      items: orderItems,
      pricing: {
        subtotal: verifiedSubtotal,
        deliveryFee,
        discount,
        tax,
        total,
        couponCode: appliedCouponCode,
      },
      paymentMethod: orderType === 'delivery' ? 'cash_on_delivery' : 'cash_on_pickup',
      paymentStatus: 'pending',
      status: 'Order Placed',
      statusHistory: [
        {
          status: 'Order Placed',
          timestamp: new Date().toISOString(),
          note: `Order placed via website (${orderType}${verifiedBranchName ? ` - ${verifiedBranchName}` : ''})`,
        },
      ],
    });

    // Notify connected tracking subscribers
    broadcastOrderStatus(newOrder.orderNumber, 'Order Placed');

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      orderNumber: newOrder.orderNumber,
      order: newOrder,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to place order: ' + error.message,
    });
  }
});

// Customer order cancellation endpoint
router.patch('/orders/:orderNumber/cancel', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { reason = 'Cancelled by customer', phone = null } = req.body;

    const order = await dbService.orders.findOne({ orderNumber: orderNumber.trim() });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order #${orderNumber} not found.`,
      });
    }

    // Cancellation rule: Only permitted if order is in initial state ('Order Placed' or 'Pending')
    const cancellableStatuses = ['Order Placed', 'Pending'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order #${orderNumber} cannot be cancelled because its status is already '${order.status}'. The kitchen has already started preparing your food. Please contact the restaurant directly.`,
      });
    }

    // Optional phone validation for guest cancellation
    if (phone) {
      const cleanInput = String(phone).replace(/[^0-9]/g, '');
      const cleanOrderPhone = String(order.customerInfo?.phone || '').replace(/[^0-9]/g, '');
      if (cleanInput && cleanOrderPhone && !cleanOrderPhone.endsWith(cleanInput.slice(-7))) {
        return res.status(403).json({
          success: false,
          message: 'Phone number does not match this order reference.',
        });
      }
    }

    const cancelHistory = {
      status: 'Cancelled',
      timestamp: new Date().toISOString(),
      note: `Cancelled by customer: ${reason}`,
    };

    const updated = await dbService.orders.findByIdAndUpdate(order._id, {
      status: 'Cancelled',
      cancellationReason: reason,
      $push: { statusHistory: cancelHistory },
    });

    return res.json({
      success: true,
      message: `Order #${orderNumber} was successfully cancelled.`,
      order: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel order: ' + error.message,
    });
  }
});

// Guest order history lookup endpoint (secure retrieval by order numbers and phone)
router.post('/orders/guest-history', async (req, res) => {
  try {
    const { orderNumbers = [], phone = '' } = req.body;

    if (!Array.isArray(orderNumbers) || orderNumbers.length === 0) {
      // Lookup by verified phone number
      if (phone && phone.trim().length >= 7) {
        const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
        const allOrders = await dbService.orders.find({});
        const matched = allOrders.filter((o) => {
          const oPhone = String(o.customerInfo?.phone || '').replace(/[^0-9]/g, '');
          return oPhone && oPhone.endsWith(cleanPhone.slice(-7));
        });

        const populated = await Promise.all(
          matched.slice(0, 50).map(async (o) => {
            const rest = await dbService.restaurants.findById(o.restaurantId);
            return {
              ...o,
              restaurantName: rest?.name || 'Restaurant',
              restaurantLogo: rest?.logo || '',
              restaurantSlug: rest?.slug || '',
              currencySymbol: rest?.currencySymbol || '$',
            };
          })
        );

        return res.json({
          success: true,
          orders: populated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Order numbers or a valid customer phone number are required for order history.',
      });
    }

    const foundOrders = [];
    for (const num of orderNumbers.slice(0, 30)) {
      if (typeof num === 'string' && num.trim()) {
        const o = await dbService.orders.findOne({ orderNumber: num.trim() });
        if (o) {
          const rest = await dbService.restaurants.findById(o.restaurantId);
          foundOrders.push({
            ...o,
            restaurantName: rest?.name || 'Restaurant',
            restaurantLogo: rest?.logo || '',
            restaurantSlug: rest?.slug || '',
            currencySymbol: rest?.currencySymbol || '$',
          });
        }
      }
    }

    return res.json({
      success: true,
      orders: foundOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order history: ' + error.message,
    });
  }
});

// Customer order tracking endpoint (sanitized for privacy with real-time telemetry)
router.get('/orders/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const order = await dbService.orders.findOne({ orderNumber: orderNumber.trim() });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order #${orderNumber} not found. Please check your order reference number.`,
      });
    }

    const restaurant = await dbService.restaurants.findById(order.restaurantId);

    // Sanitize customer contact details for public exposure
    const rawPhone = order.customerInfo?.phone || '';
    const maskedPhone =
      rawPhone.length > 5
        ? rawPhone.slice(0, 3) + '***' + rawPhone.slice(-2)
        : rawPhone;

    const rawEmail = order.customerInfo?.email || '';
    const maskedEmail = rawEmail.includes('@')
      ? rawEmail.replace(/^(.)(.*)(@.*)$/, '$1***$3')
      : rawEmail;

    // Privacy rule: Only reveal live rider coordinates while order is actively en-route
    const isDeliveryActive = [
      'Rider Picked Up Your Order',
      'Rider Is On The Way',
      'Rider Is At Your Doorstep',
    ].includes(order.status);

    let privacyRiderLocation = null;
    let distanceKm = null;
    let etaMinutes = null;

    if (isDeliveryActive && order.riderLocation) {
      const updatedAtMs = order.riderLocation.updatedAt ? new Date(order.riderLocation.updatedAt).getTime() : 0;
      const isStale = updatedAtMs > 0 ? Date.now() - updatedAtMs > 120000 : true; // 2 min threshold

      privacyRiderLocation = {
        lat: order.riderLocation.permissionDenied ? null : order.riderLocation.lat,
        lng: order.riderLocation.permissionDenied ? null : order.riderLocation.lng,
        accuracy: order.riderLocation.accuracy,
        updatedAt: order.riderLocation.updatedAt,
        isSharing: Boolean(order.riderLocation.isSharing),
        permissionDenied: Boolean(order.riderLocation.permissionDenied),
        isStale,
      };

      if (!order.riderLocation.permissionDenied && order.riderLocation.lat && order.customerInfo?.coordinates?.lat) {
        distanceKm = calculateDistanceKm(
          order.riderLocation.lat,
          order.riderLocation.lng,
          order.customerInfo.coordinates.lat,
          order.customerInfo.coordinates.lng
        );
        if (distanceKm !== null) {
          etaMinutes = calculateEtaMinutes(distanceKm);
        }
      }
    } else if (order.deliveryZone?.distanceKm) {
      distanceKm = order.deliveryZone.distanceKm;
      etaMinutes = calculateEtaMinutes(distanceKm);
    }

    const orderObj = order.toObject ? order.toObject() : order;
    const customerInfoObj = order.customerInfo?.toObject
      ? order.customerInfo.toObject()
      : (order.customerInfo || {});

    const sanitizedOrder = {
      ...orderObj,
      customerInfo: {
        ...customerInfoObj,
        phone: maskedPhone,
        email: maskedEmail,
      },
      riderLocation: privacyRiderLocation,
      distanceKm,
      etaMinutes,
    };

    const restCoords = restaurant?.coordinates || getCityCoordinates(restaurant?.city || 'Karachi');

    return res.json({
      success: true,
      order: sanitizedOrder,
      restaurant: restaurant
        ? {
            name: restaurant.name,
            phone: restaurant.phone,
            address: restaurant.address,
            city: restaurant.city,
            logo: restaurant.logo,
            currencySymbol: restaurant.currencySymbol,
            coordinates: restCoords,
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order status: ' + error.message,
    });
  }
});

// Dedicated Live Tracking Telemetry Endpoint
router.get('/orders/:orderNumber/live-tracking', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = await dbService.orders.findOne({ orderNumber: orderNumber.trim() });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const restaurant = await dbService.restaurants.findById(order.restaurantId);
    const restCoords = restaurant?.coordinates || getCityCoordinates(restaurant?.city || 'Karachi');

    const isDeliveryActive = [
      'Rider Picked Up Your Order',
      'Rider Is On The Way',
      'Rider Is At Your Doorstep',
    ].includes(order.status);

    let riderLocation = null;
    let distanceKm = null;
    let etaMinutes = null;

    if (isDeliveryActive && order.riderLocation) {
      const updatedAtMs = order.riderLocation.updatedAt ? new Date(order.riderLocation.updatedAt).getTime() : 0;
      const isStale = updatedAtMs > 0 ? Date.now() - updatedAtMs > 120000 : true;

      riderLocation = {
        lat: order.riderLocation.permissionDenied ? null : order.riderLocation.lat,
        lng: order.riderLocation.permissionDenied ? null : order.riderLocation.lng,
        accuracy: order.riderLocation.accuracy,
        updatedAt: order.riderLocation.updatedAt,
        isSharing: Boolean(order.riderLocation.isSharing),
        permissionDenied: Boolean(order.riderLocation.permissionDenied),
        isStale,
      };

      if (!order.riderLocation.permissionDenied && order.riderLocation.lat && order.customerInfo?.coordinates?.lat) {
        distanceKm = calculateDistanceKm(
          order.riderLocation.lat,
          order.riderLocation.lng,
          order.customerInfo.coordinates.lat,
          order.customerInfo.coordinates.lng
        );
        if (distanceKm !== null) {
          etaMinutes = calculateEtaMinutes(distanceKm);
        }
      }
    }

    return res.json({
      success: true,
      orderNumber: order.orderNumber,
      status: order.status,
      orderType: order.orderType,
      isDeliveryActive,
      restaurant: {
        name: restaurant?.name || 'Restaurant',
        address: restaurant?.address || '',
        city: restaurant?.city || '',
        coordinates: restCoords,
      },
      destination: {
        address: order.customerInfo?.address || '',
        city: order.customerInfo?.city || '',
        area: order.customerInfo?.area || '',
        landmark: order.customerInfo?.landmark || '',
        coordinates: order.customerInfo?.coordinates || null,
        deliveryInstructions: order.customerInfo?.deliveryInstructions || '',
      },
      assignedRider: order.riderInfo?.name ? order.riderInfo : null,
      riderLocation,
      isStale: riderLocation ? Boolean(riderLocation.isStale) : false,
      distanceKm,
      etaMinutes,
      statusHistory: order.statusHistory || [],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch live tracking telemetry: ' + error.message,
    });
  }
});

export default router;
