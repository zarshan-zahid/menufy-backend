import express from 'express';
import { dbService } from '../services/dbStore.js';
import { protect, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply protect and requireSuperAdmin to all routes in this router
router.use(protect, requireSuperAdmin);

// Helper to parse date ranges consistently
const parseDateRange = (period = 'all', startDate, endDate) => {
  const now = new Date();
  let start = 0;
  let end = now.getTime();
  let label = 'All Time';

  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    end = now.getTime();
    label = 'Today';
  } else if (period === '7d') {
    start = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    end = now.getTime();
    label = 'Last 7 Days';
  } else if (period === '30d') {
    start = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    end = now.getTime();
    label = 'Last 30 Days';
  } else if (period === 'custom' && (startDate || endDate)) {
    if (startDate) {
      start = new Date(startDate).getTime();
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      end = e.getTime();
    }
    label = `Custom (${startDate || 'Start'} - ${endDate || 'Now'})`;
  }

  return { start, end, label };
};

// 1. Platform-wide high level statistics with date-filtering and accurate metrics
router.get('/stats', async (req, res) => {
  try {
    const { period = 'all', startDate, endDate } = req.query;
    const { start: filterStart, end: filterEnd, label: periodLabel } = parseDateRange(period, startDate, endDate);

    const [allRestaurants, allUsers, allOrders, recentActivities] = await Promise.all([
      dbService.restaurants.find({}),
      dbService.users.find({}),
      dbService.orders.find({}),
      dbService.activities.find(10),
    ]);

    let publishedCount = 0;
    let unpublishedCount = 0;
    let activeCount = 0;
    let suspendedCount = 0;
    let pendingCount = 0;
    let rejectedRestaurantsCount = 0;

    allRestaurants.forEach((r) => {
      if (r.isPublished) publishedCount++;
      else unpublishedCount++;

      if (r.status === 'pending') pendingCount++;
      else if (r.status === 'suspended') suspendedCount++;
      else if (r.status === 'rejected') rejectedRestaurantsCount++;
      else activeCount++;
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let ordersToday = 0;
    let ordersInPeriod = 0;
    let grossOrderValue = 0; // GOV: sum of all initiated orders in period
    let completedOrderValue = 0; // COV: sum of fulfilled/delivered orders in period
    let totalRevenue = 0; // backward compatible metric
    let orderCancelledCount = 0;
    let orderRejectedCount = 0;
    let deliveredCount = 0;

    allOrders.forEach((o) => {
      const orderTime = new Date(o.createdAt).getTime();
      const isToday = orderTime >= todayStart;
      const isInPeriod = orderTime >= filterStart && orderTime <= filterEnd;

      if (isToday) {
        ordersToday++;
      }

      if (isInPeriod) {
        ordersInPeriod++;
        const amount = Number(o.pricing?.total) || 0;
        grossOrderValue += amount;

        const isCancelled = o.status === 'Cancelled';
        const isRejected = o.status === 'Rejected';
        const isDelivered = o.status === 'Delivered' || o.status === 'Order Received';

        if (isCancelled) orderCancelledCount++;
        if (isRejected) orderRejectedCount++;
        if (isDelivered) {
          deliveredCount++;
          completedOrderValue += amount;
        }

        // Backward-compatible revenue definition (non-terminal failure)
        if (!isCancelled && !isRejected) {
          totalRevenue += amount;
        }
      }
    });

    let totalRiders = 0;
    let pendingRiders = 0;
    let activeRiders = 0;
    let suspendedRiders = 0;

    allUsers.forEach((u) => {
      if (u.role === 'rider') {
        totalRiders++;
        const s = u.riderStatus || 'pending';
        if (s === 'pending') pendingRiders++;
        else if (s === 'approved' || s === 'active') activeRiders++;
        else if (s === 'suspended') suspendedRiders++;
      }
    });

    const cancellationRate =
      ordersInPeriod > 0
        ? Math.round(((orderCancelledCount + orderRejectedCount) / ordersInPeriod) * 1000) / 10
        : 0;

    return res.json({
      success: true,
      stats: {
        totalUsers: allUsers.length,
        totalRestaurants: allRestaurants.length,
        pendingCount,
        activeCount,
        suspendedCount,
        rejectedCount: rejectedRestaurantsCount,
        rejectedRestaurantsCount,
        publishedCount,
        unpublishedCount,
        totalOrders: allOrders.length,
        ordersToday,
        ordersInPeriod,
        totalRevenue: Math.round(totalRevenue * 100) / 100, // backward compatible
        grossOrderValue: Math.round(grossOrderValue * 100) / 100,
        completedOrderValue: Math.round(completedOrderValue * 100) / 100,
        cancelledCount: orderCancelledCount,
        rejectedCountOrders: orderRejectedCount,
        orderCancelledCount,
        orderRejectedCount,
        deliveredCount,
        cancellationRate,
        platformRevenue: 0, // Truthful: FoodFlow operates on 0% direct-to-kitchen commission model
        commissionModel: '0% Direct-to-Kitchen Model',
        commissionRate: 0,
        selectedPeriod: period,
        periodLabel,
        totalRiders,
        pendingRiders,
        activeRiders,
        suspendedRiders,
        recentActivity: recentActivities || [],
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch superadmin platform stats: ' + error.message,
    });
  }
});

// Dedicated Applications endpoint for Super Admin
router.get('/applications', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    let restaurants = await dbService.restaurants.find({});

    if (status !== 'all') {
      restaurants = restaurants.filter((r) => (r.status || 'pending') === status);
    } else {
      restaurants = restaurants.filter((r) => r.status === 'pending' || r.status === 'rejected');
    }

    const applications = await Promise.all(
      restaurants.map(async (r) => {
        const owner = await dbService.users.findById(r.ownerId);
        return {
          ...r,
          owner: owner ? { id: owner._id, name: owner.name, email: owner.email, phone: owner.phone } : null,
        };
      })
    );

    return res.json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch partner applications: ' + error.message,
    });
  }
});

// 2. List all restaurants with search, filters, owner details, orders & branches count
router.get('/restaurants', async (req, res) => {
  try {
    const { search = '', status = 'all', published = 'all', page = 1, limit = 500 } = req.query;

    let restaurants = await dbService.restaurants.find({});

    // Filter by status (active/approved, pending, suspended, rejected)
    if (status !== 'all') {
      if (status === 'active' || status === 'approved') {
        restaurants = restaurants.filter((r) => (r.status || 'active') === 'active' || r.status === 'approved');
      } else {
        restaurants = restaurants.filter((r) => (r.status || 'active') === status);
      }
    }

    // Filter by publication
    if (published !== 'all') {
      const isPub = published === 'true';
      restaurants = restaurants.filter((r) => Boolean(r.isPublished) === isPub);
    }

    // Populate owner info and metrics for each restaurant
    const populated = await Promise.all(
      restaurants.map(async (r) => {
        const owner = await dbService.users.findById(r.ownerId);
        const orders = await dbService.orders.find({ restaurantId: r._id });
        const branches = await dbService.branches.find({ restaurantId: r._id });

        let revenue = 0;
        orders.forEach((o) => {
          if (o.status !== 'Cancelled' && o.status !== 'Rejected') {
            revenue += o.pricing?.total || 0;
          }
        });

        return {
          ...r,
          owner: owner ? { name: owner.name, email: owner.email, phone: owner.phone } : null,
          totalOrders: orders.length,
          totalRevenue: Math.round(revenue * 100) / 100,
          branchCount: branches.length,
        };
      })
    );

    // Search by restaurant name, slug, city, cuisine, or owner details
    let filtered = populated;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = populated.filter((r) => {
        return (
          r.name?.toLowerCase().includes(q) ||
          r.slug?.toLowerCase().includes(q) ||
          r.city?.toLowerCase().includes(q) ||
          r.cuisine?.toLowerCase().includes(q) ||
          r.owner?.name?.toLowerCase().includes(q) ||
          r.owner?.email?.toLowerCase().includes(q) ||
          r.owner?.phone?.toLowerCase().includes(q)
        );
      });
    }

    const totalCount = filtered.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginated = filtered.slice(startIndex, startIndex + Number(limit));

    return res.json({
      success: true,
      total: totalCount,
      page: Number(page),
      limit: Number(limit),
      restaurants: paginated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch restaurants: ' + error.message,
    });
  }
});

// 3. Single restaurant inspection
router.get('/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await dbService.restaurants.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const [owner, branches, orders, categories, menuItems] = await Promise.all([
      dbService.users.findById(restaurant.ownerId),
      dbService.branches.find({ restaurantId: restaurant._id }),
      dbService.orders.find({ restaurantId: restaurant._id }),
      dbService.categories.find({ restaurantId: restaurant._id }),
      dbService.menuItems.find({ restaurantId: restaurant._id }),
    ]);

    let revenue = 0;
    orders.forEach((o) => {
      if (o.status !== 'Cancelled' && o.status !== 'Rejected') {
        revenue += o.pricing?.total || 0;
      }
    });

    return res.json({
      success: true,
      restaurant,
      owner: owner ? { id: owner._id, name: owner.name, email: owner.email, phone: owner.phone } : null,
      branches,
      metrics: {
        totalOrders: orders.length,
        totalRevenue: Math.round(revenue * 100) / 100,
        categoryCount: categories.length,
        dishCount: menuItems.length,
      },
      recentOrders: orders.slice(0, 10),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to inspect restaurant: ' + error.message,
    });
  }
});

// 4. Suspend, reactivate, approve, or reject restaurant
router.patch('/restaurants/:id/status', async (req, res) => {
  try {
    const { status, reason = '' } = req.body;

    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Status is required. Must be "approved", "rejected", "suspended", or "reactivate".',
      });
    }

    const cleanStatus = status.toLowerCase().trim();
    const allowedStatuses = ['active', 'suspended', 'suspend', 'approved', 'activate', 'reactivate', 'reject', 'rejected', 'approve'];

    if (!allowedStatuses.includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "approved", "rejected", "suspended", or "reactivate".',
      });
    }

    const restaurant = await dbService.restaurants.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const isApprove = cleanStatus === 'approved' || cleanStatus === 'approve';
    const isReject = cleanStatus === 'rejected' || cleanStatus === 'reject';
    const isSuspend = cleanStatus === 'suspended' || cleanStatus === 'suspend';
    const isReactivate = cleanStatus === 'reactivate' || cleanStatus === 'activate' || cleanStatus === 'active';

    // Critical security check: Reactivation must not automatically approve a previously rejected application
    if (isReactivate && restaurant.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reactivate a rejected application. You must explicitly approve the application.',
      });
    }

    let targetStatus = 'active';
    let updatePayload = {};
    let actionType = 'RESTAURANT_REACTIVATED';
    let actionVerb = 'reactivated';

    if (isApprove) {
      targetStatus = 'active';
      updatePayload = {
        status: 'active',
        isPublished: true,
        approvedAt: new Date().toISOString(),
        approvedBy: req.user._id,
        rejectionReason: '',
        suspensionReason: '',
      };
      actionType = 'APPLICATION_APPROVED';
      actionVerb = 'approved';
    } else if (isReject) {
      targetStatus = 'rejected';
      updatePayload = {
        status: 'rejected',
        isPublished: false,
        rejectedAt: new Date().toISOString(),
        rejectedBy: req.user._id,
        rejectionReason: reason ? reason.trim() : 'Application was not approved by platform administration.',
      };
      actionType = 'APPLICATION_REJECTED';
      actionVerb = 'rejected';
    } else if (isSuspend) {
      targetStatus = 'suspended';
      updatePayload = {
        status: 'suspended',
        isPublished: false,
        suspensionReason: reason ? reason.trim() : 'Account suspended by platform administration.',
      };
      actionType = 'RESTAURANT_SUSPENDED';
      actionVerb = 'suspended';
    } else if (isReactivate) {
      targetStatus = 'active';
      updatePayload = {
        status: 'active',
        isPublished: true,
        suspensionReason: '',
      };
      actionType = 'RESTAURANT_REACTIVATED';
      actionVerb = 'reactivated';
    }

    const updated = await dbService.restaurants.findByIdAndUpdate(req.params.id, updatePayload);

    // Record audit activity
    const activity = await dbService.activities.create({
      type: actionType,
      restaurantId: restaurant._id,
      restaurantName: restaurant.name,
      slug: restaurant.slug,
      reason: reason ? reason.trim() : '',
      adminEmail: req.user.email,
      message: isSuspend
        ? `Super Admin ${req.user.name} suspended "${restaurant.name}"${reason ? ` (${reason.trim()})` : ''}`
        : isReject
        ? `Super Admin ${req.user.name} rejected "${restaurant.name}" application${reason ? `: ${reason.trim()}` : ''}`
        : `Super Admin ${req.user.name} ${actionVerb} "${restaurant.name}"`,
    });

    return res.json({
      success: true,
      message: `Restaurant "${restaurant.name}" has been ${actionVerb}.`,
      restaurant: updated,
      activity,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update restaurant status: ' + error.message,
    });
  }
});

// 5. Recent platform audit activity
router.get('/activity', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 30;
    const activities = await dbService.activities.find(limit);

    return res.json({
      success: true,
      activities,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch platform activity: ' + error.message,
    });
  }
});

// 6. Dedicated Riders Fleet endpoint for Super Admin
router.get('/riders', async (req, res) => {
  try {
    const { status = 'all', city = 'all', search = '' } = req.query;
    let allUsers = await dbService.users.find({});
    let riders = allUsers.filter((u) => u.role === 'rider');

    if (status && status !== 'all') {
      riders = riders.filter((r) => (r.riderStatus || 'pending') === status);
    }

    if (city && city !== 'all') {
      const qCity = city.toLowerCase().trim();
      riders = riders.filter((r) => (r.city || '').toLowerCase().includes(qCity));
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      riders = riders.filter(
        (r) =>
          (r.name || '').toLowerCase().includes(q) ||
          (r.email || '').toLowerCase().includes(q) ||
          (r.phone || '').toLowerCase().includes(q) ||
          (r.vehicleNumber || '').toLowerCase().includes(q)
      );
    }

    const sanitized = riders.map((r) => {
      const { password, ...safe } = r;
      return safe;
    });

    return res.json({
      success: true,
      count: sanitized.length,
      riders: sanitized.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch riders: ' + error.message,
    });
  }
});

// 7. Update Rider Status (Approve, Reject, Suspend, Reactivate) with safe delivery handling
router.patch('/riders/:id/status', async (req, res) => {
  try {
    const { status, reason = '' } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status action is required (approve, reject, suspend, reactivate)',
      });
    }

    const rider = await dbService.users.findById(req.params.id);
    if (!rider || rider.role !== 'rider') {
      return res.status(404).json({
        success: false,
        message: 'Rider account not found.',
      });
    }

    const cleanStatus = status.toLowerCase().trim();
    const isApprove = cleanStatus === 'approved' || cleanStatus === 'approve' || cleanStatus === 'active';
    const isReject = cleanStatus === 'rejected' || cleanStatus === 'reject';
    const isSuspend = cleanStatus === 'suspended' || cleanStatus === 'suspend';
    const isReactivate = cleanStatus === 'reactivate' || cleanStatus === 'activate';

    // Cannot reactivate a rejected application without explicit approval
    if (isReactivate && rider.riderStatus === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reactivate a rejected rider application. You must explicitly approve the application.',
      });
    }

    let actionType = 'RIDER_APPROVED';
    let actionVerb = 'approved';
    const updatePayload = {};
    let reassignedOrders = [];

    if (isApprove) {
      actionType = 'RIDER_APPROVED';
      actionVerb = 'approved';
      updatePayload.riderStatus = 'approved';
      updatePayload.rejectionReason = '';
      updatePayload.suspensionReason = '';
    } else if (isReject) {
      actionType = 'RIDER_REJECTED';
      actionVerb = 'rejected';
      updatePayload.riderStatus = 'rejected';
      updatePayload.isOnline = false;
      updatePayload.currentOrderId = null;
      updatePayload.rejectionReason = reason ? reason.trim() : 'Application was not approved.';
    } else if (isSuspend) {
      actionType = 'RIDER_SUSPENDED';
      actionVerb = 'suspended';
      updatePayload.riderStatus = 'suspended';
      updatePayload.isOnline = false;
      updatePayload.currentOrderId = null;
      updatePayload.suspensionReason = reason ? reason.trim() : 'Account suspended by platform administration.';

      // CRITICAL OPERATIONAL SAFETY: Reassign any active deliveries safely instead of deleting or losing orders
      const allOrders = await dbService.orders.find({});
      const activeRiderOrders = allOrders.filter(
        (o) =>
          String(o.assignedRiderId) === String(rider._id) &&
          !['Delivered', 'Order Received', 'Cancelled', 'Rejected'].includes(o.status)
      );

      for (const order of activeRiderOrders) {
        const history = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
        history.push({
          status: 'Ready for Pickup',
          timestamp: new Date().toISOString(),
          note: `Delivery safely unassigned and re-queued to Ready for Pickup: Assigned rider ${rider.name} was suspended by platform administration.`,
        });

        await dbService.orders.findByIdAndUpdate(order._id, {
          assignedRiderId: null,
          status: 'Ready for Pickup',
          statusHistory: history,
        });

        reassignedOrders.push(order.orderNumber);

        // Audit log for this safe reassignment
        await dbService.activities.create({
          type: 'ORDER_REASSIGNED_RIDER_SUSPENDED',
          orderId: order._id,
          orderNumber: order.orderNumber,
          riderId: rider._id,
          riderName: rider.name,
          adminEmail: req.user.email,
          message: `Active order ${order.orderNumber} safely returned to Ready for Pickup queue due to rider ${rider.name} suspension.`,
        });
      }
    } else if (isReactivate) {
      actionType = 'RIDER_REACTIVATED';
      actionVerb = 'reactivated';
      updatePayload.riderStatus = 'approved';
      updatePayload.suspensionReason = '';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid status action. Must be approve, reject, suspend, or reactivate.',
      });
    }

    const updated = await dbService.users.findByIdAndUpdate(req.params.id, updatePayload);

    // Record audit activity
    await dbService.activities.create({
      type: actionType,
      riderId: rider._id,
      riderName: rider.name,
      riderEmail: rider.email,
      adminEmail: req.user.email,
      reason: reason ? reason.trim() : '',
      message: `Super Admin ${req.user.name} ${actionVerb} rider "${rider.name}" (${rider.email})${
        reason ? `: ${reason.trim()}` : ''
      }.${
        reassignedOrders.length > 0
          ? ` Safely re-queued ${reassignedOrders.length} active delivery (${reassignedOrders.join(', ')}) back to Ready for Pickup.`
          : ''
      }`,
    });

    const { password, ...safeUser } = updated;

    return res.json({
      success: true,
      message: `Rider "${rider.name}" has been ${actionVerb}.${
        reassignedOrders.length > 0
          ? ` ${reassignedOrders.length} active delivery was safely re-queued for pickup.`
          : ''
      }`,
      rider: safeUser,
      reassignedOrdersCount: reassignedOrders.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update rider status: ' + error.message,
    });
  }
});

// 8. Single Rider Deep Inspection & Delivery Assignment History
router.get('/riders/:id', async (req, res) => {
  try {
    const rider = await dbService.users.findById(req.params.id);
    if (!rider || rider.role !== 'rider') {
      return res.status(404).json({ success: false, message: 'Rider account not found.' });
    }

    const allOrders = await dbService.orders.find({});
    // Find all orders ever assigned to this rider
    const assignedOrders = allOrders.filter((o) => String(o.assignedRiderId) === String(rider._id));

    let completedCount = 0;
    let cancelledCount = 0;
    let activeCount = 0;
    let totalDeliveryEarnings = 0;

    const populatedOrders = await Promise.all(
      assignedOrders.map(async (o) => {
        const isCompleted = o.status === 'Delivered' || o.status === 'Order Received';
        const isCancelled = o.status === 'Cancelled' || o.status === 'Rejected';
        const isActive = !isCompleted && !isCancelled;

        if (isCompleted) {
          completedCount++;
          totalDeliveryEarnings += o.pricing?.deliveryFee || 0;
        } else if (isCancelled) {
          cancelledCount++;
        } else if (isActive) {
          activeCount++;
        }

        const restaurant = await dbService.restaurants.findById(o.restaurantId);
        return {
          _id: o._id,
          orderNumber: o.orderNumber,
          status: o.status,
          restaurantName: restaurant?.name || 'Restaurant Kitchen',
          restaurantAddress: restaurant?.address || '',
          customerAddress: o.customerInfo?.address || 'Customer Location',
          customerName: o.customerInfo?.name || 'Customer',
          customerPhone: o.customerInfo?.phone || '',
          deliveryFee: o.pricing?.deliveryFee || 0,
          total: o.pricing?.total || 0,
          createdAt: o.createdAt,
          rejectionReason: o.rejectionReason || '',
          cancellationReason: o.cancellationReason || '',
          statusHistory: o.statusHistory || [],
        };
      })
    );

    const { password, ...safeRider } = rider;

    return res.json({
      success: true,
      rider: safeRider,
      stats: {
        totalAssigned: assignedOrders.length,
        completedCount,
        cancelledCount,
        activeCount,
        completionRate:
          assignedOrders.length > 0
            ? Math.round((completedCount / assignedOrders.length) * 1000) / 10
            : 0,
        totalDeliveryEarnings: Math.round(totalDeliveryEarnings * 100) / 100,
      },
      deliveryHistory: populatedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to inspect rider: ' + error.message,
    });
  }
});

// 9. Operational Monitoring: Live order queues & delivery exceptions
router.get('/operations', async (req, res) => {
  try {
    const [allOrders, allRestaurants, allUsers] = await Promise.all([
      dbService.orders.find({}),
      dbService.restaurants.find({}),
      dbService.users.find({}),
    ]);

    const restMap = new Map(allRestaurants.map((r) => [String(r._id), r]));
    const riderMap = new Map(allUsers.filter((u) => u.role === 'rider').map((u) => [String(u._id), u]));

    const waitingAcceptance = [];
    const preparing = [];
    const readyUnassigned = [];
    const activeDeliveries = [];
    const cancelledOrRejected = [];
    const deliveryExceptions = [];

    const now = Date.now();

    for (const order of allOrders) {
      const rest = restMap.get(String(order.restaurantId));
      const rider = order.assignedRiderId ? riderMap.get(String(order.assignedRiderId)) : null;

      const orderItem = {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        orderType: order.orderType || 'delivery',
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        restaurantName: rest?.name || 'Restaurant',
        restaurantPhone: rest?.phone || '',
        restaurantAddress: rest?.address || '',
        customerName: order.customerInfo?.name || 'Customer',
        customerPhone: order.customerInfo?.phone || '',
        customerAddress: order.customerInfo?.address || '',
        total: order.pricing?.total || 0,
        deliveryFee: order.pricing?.deliveryFee || 0,
        assignedRider: rider ? { id: rider._id, name: rider.name, phone: rider.phone, vehicleType: rider.vehicleType } : null,
        rejectionReason: order.rejectionReason || '',
        cancellationReason: order.cancellationReason || '',
      };

      const orderAgeMinutes = (now - new Date(order.createdAt).getTime()) / (1000 * 60);

      // Categorize into real-time operational queues
      if (order.status === 'Pending' || order.status === 'Order Placed') {
        waitingAcceptance.push(orderItem);
      } else if (
        ['Confirmed', 'Accepted', 'Preparing', 'Preparing Your Order'].includes(order.status)
      ) {
        preparing.push(orderItem);
      } else if (
        (order.status === 'Ready for Pickup' || order.status === 'Ready') &&
        !order.assignedRiderId
      ) {
        readyUnassigned.push(orderItem);
      } else if (
        [
          'Rider Picked Up Your Order',
          'Rider Is On The Way',
          'Rider Is At Your Doorstep',
          'Out for Delivery',
        ].includes(order.status)
      ) {
        activeDeliveries.push(orderItem);

        // Operational exception: transit time > 45 minutes
        if (orderAgeMinutes > 45) {
          deliveryExceptions.push({
            ...orderItem,
            exceptionType: 'LONG_DELIVERY_TIME',
            elapsedMinutes: Math.round(orderAgeMinutes),
            message: `Active delivery in transit for ${Math.round(orderAgeMinutes)} mins (threshold: 45m).`,
          });
        }
      } else if (order.status === 'Cancelled' || order.status === 'Rejected') {
        cancelledOrRejected.push(orderItem);
      }
    }

    const sortByNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
    waitingAcceptance.sort(sortByNewest);
    preparing.sort(sortByNewest);
    readyUnassigned.sort(sortByNewest);
    activeDeliveries.sort(sortByNewest);
    cancelledOrRejected.sort(sortByNewest);
    deliveryExceptions.sort(sortByNewest);

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      counts: {
        waitingAcceptance: waitingAcceptance.length,
        preparing: preparing.length,
        readyUnassigned: readyUnassigned.length,
        activeDeliveries: activeDeliveries.length,
        cancelledOrRejected: cancelledOrRejected.length,
        deliveryExceptions: deliveryExceptions.length,
        totalActive: waitingAcceptance.length + preparing.length + readyUnassigned.length + activeDeliveries.length,
      },
      queues: {
        waitingAcceptance: waitingAcceptance.slice(0, 50),
        preparing: preparing.slice(0, 50),
        readyUnassigned: readyUnassigned.slice(0, 50),
        activeDeliveries: activeDeliveries.slice(0, 50),
        cancelledOrRejected: cancelledOrRejected.slice(0, 50),
        deliveryExceptions: deliveryExceptions.slice(0, 50),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch operational monitoring queues: ' + error.message,
    });
  }
});

// 10. Operational Reporting and Performance Analytics (Date-filtered & Tenant-isolated)
router.get('/reports', async (req, res) => {
  try {
    const { period = '30d', startDate, endDate, status = 'all' } = req.query;
    const { start: filterStart, end: filterEnd, label: periodLabel } = parseDateRange(period, startDate, endDate);

    const [allOrders, allRestaurants, allUsers] = await Promise.all([
      dbService.orders.find({}),
      dbService.restaurants.find({}),
      dbService.users.find({}),
    ]);

    const restMap = new Map(allRestaurants.map((r) => [String(r._id), r]));
    const riderMap = new Map(allUsers.filter((u) => u.role === 'rider').map((u) => [String(u._id), u]));

    // Filter orders by date range
    let filteredOrders = allOrders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= filterStart && t <= filterEnd;
    });

    // Optional status filter
    if (status !== 'all') {
      if (status === 'delivered' || status === 'completed') {
        filteredOrders = filteredOrders.filter(
          (o) => o.status === 'Delivered' || o.status === 'Order Received'
        );
      } else if (status === 'cancelled') {
        filteredOrders = filteredOrders.filter(
          (o) => o.status === 'Cancelled' || o.status === 'Rejected'
        );
      } else if (status === 'in-progress') {
        filteredOrders = filteredOrders.filter(
          (o) => !['Delivered', 'Order Received', 'Cancelled', 'Rejected'].includes(o.status)
        );
      }
    }

    let grossOrderValue = 0;
    let completedOrderValue = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;
    let rejectedCount = 0;

    const restStats = new Map();
    const riderStats = new Map();

    filteredOrders.forEach((o) => {
      const amount = Number(o.pricing?.total) || 0;
      grossOrderValue += amount;

      const isDelivered = o.status === 'Delivered' || o.status === 'Order Received';
      const isCancelled = o.status === 'Cancelled';
      const isRejected = o.status === 'Rejected';

      if (isDelivered) {
        deliveredCount++;
        completedOrderValue += amount;
      }
      if (isCancelled) cancelledCount++;
      if (isRejected) rejectedCount++;

      // Restaurant aggregation
      const rId = String(o.restaurantId);
      if (!restStats.has(rId)) {
        const rest = restMap.get(rId);
        restStats.set(rId, {
          restaurantId: rId,
          restaurantName: rest?.name || 'Unknown Restaurant',
          city: rest?.city || 'N/A',
          totalOrders: 0,
          grossOrderValue: 0,
          completedOrderValue: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
        });
      }
      const rStat = restStats.get(rId);
      rStat.totalOrders++;
      rStat.grossOrderValue += amount;
      if (isDelivered) {
        rStat.deliveredOrders++;
        rStat.completedOrderValue += amount;
      }
      if (isCancelled || isRejected) {
        rStat.cancelledOrders++;
      }

      // Rider aggregation
      if (o.assignedRiderId) {
        const riderId = String(o.assignedRiderId);
        if (!riderStats.has(riderId)) {
          const rider = riderMap.get(riderId);
          riderStats.set(riderId, {
            riderId,
            riderName: rider?.name || 'Unknown Rider',
            phone: rider?.phone || '',
            vehicleType: rider?.vehicleType || 'Motorcycle',
            city: rider?.city || 'N/A',
            totalAssigned: 0,
            completedDeliveries: 0,
            cancelledDeliveries: 0,
            totalDeliveryFee: 0,
          });
        }
        const rdStat = riderStats.get(riderId);
        rdStat.totalAssigned++;
        if (isDelivered) {
          rdStat.completedDeliveries++;
          rdStat.totalDeliveryFee += o.pricing?.deliveryFee || 0;
        }
        if (isCancelled || isRejected) {
          rdStat.cancelledDeliveries++;
        }
      }
    });

    const restaurantPerformance = Array.from(restStats.values())
      .map((r) => ({
        ...r,
        grossOrderValue: Math.round(r.grossOrderValue * 100) / 100,
        completedOrderValue: Math.round(r.completedOrderValue * 100) / 100,
        cancellationRate:
          r.totalOrders > 0
            ? Math.round((r.cancelledOrders / r.totalOrders) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.totalOrders - a.totalOrders);

    const riderPerformance = Array.from(riderStats.values())
      .map((rd) => ({
        ...rd,
        totalDeliveryFee: Math.round(rd.totalDeliveryFee * 100) / 100,
        completionRate:
          rd.totalAssigned > 0
            ? Math.round((rd.completedDeliveries / rd.totalAssigned) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.totalAssigned - a.totalAssigned);

    const cancellationRate =
      filteredOrders.length > 0
        ? Math.round(((cancelledCount + rejectedCount) / filteredOrders.length) * 1000) / 10
        : 0;

    return res.json({
      success: true,
      meta: {
        period,
        startDate: new Date(filterStart).toISOString(),
        endDate: new Date(filterEnd).toISOString(),
        periodLabel,
        generatedAt: new Date().toISOString(),
        tenantIsolation: 'Super Admin platform-wide overview. Individual restaurant owners can only access their own tenant reporting.',
        definitions: {
          grossOrderValue: 'Gross monetary volume of all initiated platform orders regardless of terminal status.',
          completedOrderValue: 'Net monetary volume of fulfilled and delivered orders only.',
          cancellationRate: 'Percentage of orders cancelled by customer or rejected by restaurant.',
          platformRevenue: 'Platform operates on a 0% commission direct-to-kitchen model.',
        },
      },
      summary: {
        totalOrders: filteredOrders.length,
        grossOrderValue: Math.round(grossOrderValue * 100) / 100,
        completedOrderValue: Math.round(completedOrderValue * 100) / 100,
        deliveredCount,
        cancelledCount,
        rejectedCount,
        cancellationRate,
        averageOrderValue:
          deliveredCount > 0
            ? Math.round((completedOrderValue / deliveredCount) * 100) / 100
            : 0,
        platformRevenue: 0.0,
        commissionModel: '0% Direct-to-Kitchen Model',
      },
      restaurantPerformance,
      riderPerformance,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate operational reports: ' + error.message,
    });
  }
});

// 11. User and Access Management: Search, filter, paginate, and sanitize
router.get('/users', async (req, res) => {
  try {
    const { role = 'all', search = '', page = 1, limit = 25 } = req.query;

    let users = await dbService.users.find({});

    // Filter by role
    if (role !== 'all') {
      const qRole = role.toLowerCase().trim();
      users = users.filter((u) => {
        const uRole = (u.role || '').toLowerCase().trim();
        if (qRole === 'superadmin') {
          return ['superadmin', 'super_admin', 'super-admin', 'admin'].includes(uRole);
        }
        if (qRole === 'owner') {
          return uRole === 'owner' || uRole === 'restaurant_owner';
        }
        return uRole === qRole;
      });
    }

    // Search by name, email, phone
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      users = users.filter(
        (u) =>
          (u.name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.phone || '').toLowerCase().includes(q)
      );
    }

    const totalCount = users.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginated = users.slice(startIndex, startIndex + Number(limit));

    // STRICT SANITIZATION: Never expose passwords, hashes, salts, or tokens in admin APIs!
    const sanitized = paginated.map((u) => {
      const { password, ...safe } = u;
      return safe;
    });

    return res.json({
      success: true,
      total: totalCount,
      page: Number(page),
      limit: Number(limit),
      users: sanitized.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch platform users: ' + error.message,
    });
  }
});

export default router;

