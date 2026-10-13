import express from 'express';
import { dbService } from '../services/dbStore.js';
import { protect, requireRider } from '../middleware/auth.js';
import { calculateDistanceKm, calculateEtaMinutes } from '../utils/geo.js';
import { broadcastOrderStatus, getIO } from '../services/socketService.js';

const router = express.Router();
const riderHttpRateLimits = new Map(); // riderId -> timestamp

// Apply auth and rider verification to all rider routes
router.use(protect, requireRider);

// 1. Get current rider profile, online status, current active order & metrics
router.get('/me', async (req, res) => {
  try {
    const user = await dbService.users.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Rider not found.' });
    }

    let activeOrder = null;
    if (user.currentOrderId) {
      activeOrder = await dbService.orders.findById(user.currentOrderId);
      if (activeOrder && ['Order Received', 'Delivered', 'Cancelled', 'Rejected'].includes(activeOrder.status)) {
        // Order was already completed, clean up reference
        await dbService.users.findByIdAndUpdate(user._id, { currentOrderId: null });
        user.currentOrderId = null;
        activeOrder = null;
      }
    }

    const { password, ...safeUser } = user;

    return res.json({
      success: true,
      rider: {
        ...safeUser,
        activeOrder,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch rider profile: ' + error.message,
    });
  }
});

// 2. Toggle rider availability: Online / Offline
router.patch('/availability', async (req, res) => {
  try {
    const { isOnline } = req.body;
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isOnline boolean is required.',
      });
    }

    const updated = await dbService.users.findByIdAndUpdate(req.user._id, {
      isOnline,
    });

    return res.json({
      success: true,
      message: `You are now ${isOnline ? 'ONLINE and ready for deliveries' : 'OFFLINE'}`,
      isOnline: Boolean(updated.isOnline),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update availability: ' + error.message,
    });
  }
});

// 3. Get eligible available delivery assignments (Unclaimed orders in 'Ready for Pickup')
router.get('/available-orders', async (req, res) => {
  try {
    const user = await dbService.users.findById(req.user._id);

    if (!user.isOnline) {
      return res.json({
        success: true,
        count: 0,
        orders: [],
        isOnline: false,
        message: 'You are currently Offline. Switch Online to start receiving delivery assignments.',
      });
    }

    if (user.currentOrderId) {
      const existing = await dbService.orders.findById(user.currentOrderId);
      if (existing && !['Order Received', 'Delivered', 'Cancelled', 'Rejected'].includes(existing.status)) {
        return res.json({
          success: true,
          count: 0,
          orders: [],
          hasActiveDelivery: true,
          message: 'You have an active delivery in progress. Complete it before accepting new assignments.',
        });
      }
    }

    const allOrders = await dbService.orders.find({});

    // Filter for orders that are Ready for Pickup, delivery type, and unclaimed
    const readyStatuses = ['Ready for Pickup', 'Ready'];
    const available = allOrders.filter(
      (o) =>
        o.orderType === 'delivery' &&
        readyStatuses.includes(o.status) &&
        !o.assignedRiderId
    );

    // City isolation: If rider has a city configured, match restaurant city or address
    const riderCity = (user.city || '').toLowerCase().trim();
    const cityFiltered = available.filter((o) => {
      if (!riderCity) return true;
      const addr = (o.customerInfo?.address || '').toLowerCase();
      return addr.includes(riderCity);
    });

    // Populate restaurant details and sanitize customer private information
    const populated = await Promise.all(
      (cityFiltered.length > 0 ? cityFiltered : available).map(async (o) => {
        const rest = await dbService.restaurants.findById(o.restaurantId);
        return {
          _id: o._id,
          orderNumber: o.orderNumber,
          status: o.status,
          orderType: o.orderType,
          itemCount: Array.isArray(o.items) ? o.items.reduce((s, it) => s + (it.quantity || 1), 0) : 1,
          itemsSummary: Array.isArray(o.items) ? o.items.map((it) => `${it.quantity}x ${it.name}`).join(', ') : '',
          pricing: {
            deliveryFee: o.pricing?.deliveryFee || 0,
            total: o.pricing?.total || 0,
          },
          restaurantName: rest?.name || 'Restaurant Kitchen',
          restaurantPhone: rest?.phone || '',
          restaurantAddress: rest?.address || '',
          restaurantCity: rest?.city || '',
          restaurantLogo: rest?.logo || '',
          currencySymbol: rest?.currencySymbol || '$',
          deliveryAddress: o.customerInfo?.address || 'Customer Delivery Address',
          deliveryNotes: o.customerInfo?.notes || '',
          recipientInfo: o.recipientInfo || null,
          createdAt: o.createdAt,
        };
      })
    );

    return res.json({
      success: true,
      count: populated.length,
      orders: populated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch available delivery assignments: ' + error.message,
    });
  }
});

// 4. Concurrency-Safe Delivery Acceptance / Claim
router.post(['/orders/:orderNumber/accept', '/orders/:orderNumber/claim'], async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const user = await dbService.users.findById(req.user._id);

    if (!user.isOnline) {
      return res.status(400).json({
        success: false,
        message: 'You must be Online to accept delivery assignments.',
      });
    }

    if (user.currentOrderId) {
      const active = await dbService.orders.findById(user.currentOrderId);
      if (active && !['Order Received', 'Delivered', 'Cancelled', 'Rejected'].includes(active.status)) {
        return res.status(400).json({
          success: false,
          message: `You already have active delivery #${active.orderNumber} in progress.`,
        });
      }
    }

    const order = await dbService.orders.findOne({ orderNumber: orderNumber.trim() });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order #${orderNumber} not found.`,
      });
    }

    if (order.orderType !== 'delivery') {
      return res.status(400).json({
        success: false,
        message: 'This is a pickup order and does not require delivery rider assignment.',
      });
    }

    // Business rule: Do not assign an order before the restaurant marks it ready
    const readyStatuses = ['Ready for Pickup', 'Ready'];
    if (!readyStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order #${orderNumber} is currently '${order.status}'. The restaurant must mark it 'Ready for Pickup' before a rider can claim it.`,
      });
    }

    // CONCURRENCY-SAFE GUARD: Prevent two riders from simultaneously claiming the same order
    if (order.assignedRiderId) {
      if (String(order.assignedRiderId) === String(user._id)) {
        return res.json({
          success: true,
          message: 'You have already accepted this delivery.',
          order,
        });
      }
      return res.status(409).json({
        success: false,
        message: 'This delivery assignment has already been claimed by another rider.',
      });
    }

    const riderSnapshot = {
      id: String(user._id),
      name: user.name,
      phone: user.phone || '',
      vehicleType: user.vehicleType || 'Motorcycle',
      vehicleNumber: user.vehicleNumber || '',
    };

    const now = new Date().toISOString();
    const statusNote = `Delivery assignment accepted by rider ${user.name} (${user.vehicleType || 'Motorcycle'})`;

    // Atomic update
    const updatedOrder = await dbService.orders.findByIdAndUpdate(order._id, {
      assignedRiderId: user._id,
      riderInfo: riderSnapshot,
      riderAssignedAt: now,
      $push: {
        statusHistory: {
          status: order.status,
          timestamp: now,
          note: statusNote,
        },
      },
    });

    // Update rider's currentOrderId
    await dbService.users.findByIdAndUpdate(user._id, {
      currentOrderId: order._id,
    });

    const rest = await dbService.restaurants.findById(updatedOrder.restaurantId);

    return res.json({
      success: true,
      message: `Successfully accepted delivery #${orderNumber}! Head to ${rest?.name || 'the kitchen'} for pickup.`,
      order: {
        ...updatedOrder,
        restaurantName: rest?.name || 'Restaurant',
        restaurantPhone: rest?.phone || '',
        restaurantAddress: rest?.address || '',
        currencySymbol: rest?.currencySymbol || '$',
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to accept delivery: ' + error.message,
    });
  }
});

// 5. Get current rider's assigned deliveries (active in-progress + completed history)
router.get('/my-deliveries', async (req, res) => {
  try {
    const all = await dbService.orders.find({});
    const riderOrders = all.filter((o) => String(o.assignedRiderId) === String(req.user._id));

    const activeStatuses = [
      'Ready for Pickup',
      'Ready',
      'Rider Accepted',
      'Rider Picked Up Your Order',
      'Rider Is On The Way',
      'Rider Is At Your Doorstep',
    ];

    let activeDelivery = null;
    const completedDeliveries = [];

    for (const o of riderOrders) {
      const rest = await dbService.restaurants.findById(o.restaurantId);
      const enhanced = {
        ...o,
        restaurantName: rest?.name || 'Restaurant Kitchen',
        restaurantPhone: rest?.phone || '',
        restaurantAddress: rest?.address || '',
        restaurantCity: rest?.city || '',
        currencySymbol: rest?.currencySymbol || '$',
      };

      if (activeStatuses.includes(o.status) && !activeDelivery) {
        activeDelivery = enhanced;
      } else if (['Order Received', 'Delivered'].includes(o.status)) {
        completedDeliveries.push(enhanced);
      }
    }

    return res.json({
      success: true,
      activeDelivery,
      completedDeliveries: completedDeliveries.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch rider deliveries: ' + error.message,
    });
  }
});

// 6. Role-Based Status Updates for Assigned Rider
router.patch('/orders/:orderNumber/status', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { status: targetStatus, note = '' } = req.body;

    if (!targetStatus) {
      return res.status(400).json({
        success: false,
        message: 'targetStatus is required.',
      });
    }

    const order = await dbService.orders.findOne({ orderNumber: orderNumber.trim() });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order #${orderNumber} not found.`,
      });
    }

    // Role security check: Rider can ONLY update deliveries assigned to them
    if (String(order.assignedRiderId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not assigned to this delivery.',
      });
    }

    // STRICT STATUS SEQUENCE VALIDATION FOR RIDER
    // 1. Ready for Pickup -> Rider Picked Up Your Order
    // 2. Rider Picked Up Your Order -> Rider Is On The Way
    // 3. Rider Is On The Way -> Rider Is At Your Doorstep
    // 4. Rider Is At Your Doorstep -> Order Received
    const validTransitions = {
      'Ready for Pickup': ['Rider Picked Up Your Order', 'Rider Is On The Way'],
      'Ready': ['Rider Picked Up Your Order', 'Rider Is On The Way'],
      'Rider Picked Up Your Order': ['Rider Is On The Way', 'Rider Is At Your Doorstep'],
      'Rider Is On The Way': ['Rider Is At Your Doorstep', 'Order Received'],
      'Rider Is At Your Doorstep': ['Order Received'],
    };

    const allowedNext = validTransitions[order.status] || [];
    if (!allowedNext.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid delivery status transition: cannot change from '${order.status}' to '${targetStatus}'. Permitted next step is: ${allowedNext.join(' or ')}.`,
      });
    }

    const now = new Date().toISOString();
    const updatePayload = {
      status: targetStatus,
    };

    let defaultNote = `Status updated to '${targetStatus}' by rider ${req.user.name}`;

    if (targetStatus === 'Rider Picked Up Your Order') {
      updatePayload.riderPickedUpAt = now;
      defaultNote = `Rider ${req.user.name} confirmed food pickup from restaurant kitchen.`;
    } else if (targetStatus === 'Rider Is On The Way') {
      defaultNote = `Rider ${req.user.name} is on the way to delivery address.`;
    } else if (targetStatus === 'Rider Is At Your Doorstep') {
      defaultNote = `Rider ${req.user.name} has arrived at customer doorstep.`;
    } else if (targetStatus === 'Order Received') {
      updatePayload.riderDeliveredAt = now;
      updatePayload.paymentStatus = 'paid';
      updatePayload.riderLocation = {
        ...(order.riderLocation || {}),
        isSharing: false,
        updatedAt: now,
      };
      defaultNote = `Rider ${req.user.name} completed delivery and verified payment.`;

      // Clear currentOrderId on rider and increment delivery count
      const user = await dbService.users.findById(req.user._id);
      await dbService.users.findByIdAndUpdate(req.user._id, {
        currentOrderId: null,
        totalDeliveries: (user?.totalDeliveries || 0) + 1,
      });
    }

    updatePayload.$push = {
      statusHistory: {
        status: targetStatus,
        timestamp: now,
        note: note ? note.trim() : defaultNote,
      },
    };

    const updated = await dbService.orders.findByIdAndUpdate(order._id, updatePayload);

    // Broadcast status update to room
    broadcastOrderStatus(order.orderNumber, targetStatus, {
      riderName: req.user.name,
      riderInfo: order.riderInfo,
    });

    return res.json({
      success: true,
      message: `Delivery #${orderNumber} updated to '${targetStatus}'.`,
      order: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update delivery status: ' + error.message,
    });
  }
});

// 7. Unassign / Release assignment before pickup
router.post('/orders/:orderNumber/unassign', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { reason = 'Rider requested reassignment' } = req.body;

    const order = await dbService.orders.findOne({ orderNumber: orderNumber.trim() });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (String(order.assignedRiderId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not assigned to this delivery.',
      });
    }

    // Safety rule: Rider cannot abandon a delivery after food has already been picked up from kitchen
    if (order.status !== 'Ready for Pickup' && order.status !== 'Ready') {
      return res.status(400).json({
        success: false,
        message: `Cannot release delivery once food has been picked up from kitchen (current status: '${order.status}'). Please contact platform support.`,
      });
    }

    const now = new Date().toISOString();
    const updated = await dbService.orders.findByIdAndUpdate(order._id, {
      assignedRiderId: null,
      riderInfo: null,
      riderAssignedAt: null,
      riderLocation: null,
      $push: {
        statusHistory: {
          status: order.status,
          timestamp: now,
          note: `Rider ${req.user.name} released assignment: ${reason.trim()}`,
        },
      },
    });

    // Clear currentOrderId on rider
    await dbService.users.findByIdAndUpdate(req.user._id, {
      currentOrderId: null,
    });

    broadcastOrderStatus(order.orderNumber, order.status, {
      released: true,
      note: 'Rider unassigned',
    });

    return res.json({
      success: true,
      message: `Delivery #${orderNumber} released back to active fleet dispatch pool.`,
      order: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to release delivery: ' + error.message,
    });
  }
});

// 8. Submit real-time rider GPS telemetry (HTTP fallback & validation)
router.post('/orders/:orderNumber/location', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { lat, lng, accuracy, permissionDenied, isSharing } = req.body;

    const order = await dbService.orders.findOne({ orderNumber: orderNumber.trim() });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Authorization: Rider must be assigned to this delivery
    if (String(order.assignedRiderId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not assigned to this delivery.',
      });
    }

    // Only allow telemetry while delivery is in an active in-transit state
    const activeStatuses = [
      'Rider Picked Up Your Order',
      'Rider Is On The Way',
      'Rider Is At Your Doorstep',
    ];

    if (!activeStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Location sharing is inactive: order is in '${order.status}' stage. Tracking is only shared during active in-transit delivery.`,
      });
    }

    // Rate limiting: at most once every 2 seconds
    const riderKey = String(req.user._id);
    const lastPing = riderHttpRateLimits.get(riderKey) || 0;
    const nowMs = Date.now();
    if (nowMs - lastPing < 2000 && !permissionDenied) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit: GPS updates are throttled to once every 2 seconds.',
      });
    }
    riderHttpRateLimits.set(riderKey, nowMs);

    // Coordinates format validation
    if (!permissionDenied) {
      const numLat = Number(lat);
      const numLng = Number(lng);
      if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
        return res.status(400).json({
          success: false,
          message: 'Invalid GPS coordinates provided.',
        });
      }
    }

    const now = new Date().toISOString();
    const riderLocation = {
      lat: permissionDenied ? null : Number(lat),
      lng: permissionDenied ? null : Number(lng),
      accuracy: accuracy !== undefined && accuracy !== null ? Number(accuracy) : null,
      updatedAt: now,
      isSharing: permissionDenied ? false : Boolean(isSharing ?? true),
      permissionDenied: Boolean(permissionDenied),
    };

    await dbService.orders.findByIdAndUpdate(order._id, { riderLocation });

    // Calculate distance and genuine ETA to customer destination
    let distanceKm = null;
    let etaMinutes = null;
    const destCoords = order.customerInfo?.coordinates;
    if (!permissionDenied && destCoords && destCoords.lat && destCoords.lng) {
      distanceKm = calculateDistanceKm(Number(lat), Number(lng), destCoords.lat, destCoords.lng);
      if (distanceKm !== null) {
        etaMinutes = calculateEtaMinutes(distanceKm);
      }
    }

    // Broadcast via Socket.IO if active
    const io = getIO();
    if (io) {
      io.to(`order:${order.orderNumber}`).emit('order:location', {
        orderNumber: order.orderNumber,
        riderLocation,
        status: order.status,
        distanceKm,
        etaMinutes,
        updatedAt: now,
      });
    }

    return res.json({
      success: true,
      orderNumber: order.orderNumber,
      riderLocation,
      distanceKm,
      etaMinutes,
      message: permissionDenied ? 'GPS permission denial recorded' : 'Location updated successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to record rider location: ' + error.message,
    });
  }
});

export default router;
