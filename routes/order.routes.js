import express from 'express';
import { dbService } from '../services/dbStore.js';
import { protect } from '../middleware/auth.js';
import { requireRestaurantAccess } from '../middleware/tenant.js';

const router = express.Router();

// Get order stats for dashboard overview
router.get('/stats', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const orders = await dbService.orders.find({ restaurantId: req.restaurantId });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

    let totalRevenue = 0;
    let todayOrdersCount = 0;
    let todayRevenue = 0;
    let weekOrdersCount = 0;
    let weekRevenue = 0;
    let pendingCount = 0;
    let deliveredCount = 0;
    let inProgressCount = 0;

    orders.forEach((o) => {
      const orderTime = new Date(o.createdAt).getTime();
      const isToday = orderTime >= todayStart;
      const isThisWeek = orderTime >= weekStart;

      if (o.status !== 'Cancelled' && o.status !== 'Rejected') {
        totalRevenue += o.pricing?.total || 0;
        if (isToday) {
          todayRevenue += o.pricing?.total || 0;
        }
        if (isThisWeek) {
          weekRevenue += o.pricing?.total || 0;
        }
      }

      if (isToday) todayOrdersCount++;
      if (isThisWeek) weekOrdersCount++;

      if (o.status === 'Pending' || o.status === 'Order Placed') pendingCount++;
      else if (o.status === 'Delivered' || o.status === 'Order Received') deliveredCount++;
      else if (['Confirmed', 'Accepted', 'Preparing', 'Ready', 'Out for Delivery', 'Preparing Your Order', 'Ready for Pickup', 'Rider Picked Up Your Order', 'Rider Is On The Way', 'Rider Is At Your Doorstep'].includes(o.status)) {
        inProgressCount++;
      }
    });

    // Calculate popular products from actual order items
    const dishMap = {};
    orders.forEach((o) => {
      if (o.status !== 'Cancelled' && o.status !== 'Rejected' && Array.isArray(o.items)) {
        o.items.forEach((item) => {
          const key = item.name || 'Unknown Item';
          if (!dishMap[key]) {
            dishMap[key] = {
              name: key,
              orderCount: 0,
              quantitySold: 0,
              totalRevenue: 0,
              image: item.image || '',
            };
          }
          dishMap[key].orderCount += 1;
          dishMap[key].quantitySold += item.quantity || 1;
          dishMap[key].totalRevenue += item.totalPrice || ((item.unitPrice || item.basePrice || 0) * (item.quantity || 1));
        });
      }
    });

    const popularProducts = Object.values(dishMap)
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5)
      .map((p) => ({
        ...p,
        totalRevenue: Math.round(p.totalRevenue * 100) / 100,
      }));

    // Calculate 7-day sales trend
    const salesTrend = [];
    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const start = dayDate.getTime();
      const end = start + 24 * 60 * 60 * 1000;

      const dayOrders = orders.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= start && t < end && o.status !== 'Cancelled' && o.status !== 'Rejected';
      });

      const dayRev = dayOrders.reduce((sum, o) => sum + (o.pricing?.total || 0), 0);

      salesTrend.push({
        date: dayDate.toISOString().slice(0, 10),
        dayName: dayDate.toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: Math.round(dayRev * 100) / 100,
        ordersCount: dayOrders.length,
      });
    }

    const averageOrderValue =
      deliveredCount > 0
        ? Math.round((totalRevenue / deliveredCount) * 100) / 100
        : orders.length > 0
        ? Math.round((totalRevenue / orders.length) * 100) / 100
        : 0;

    return res.json({
      success: true,
      stats: {
        totalOrders: orders.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        todayOrdersCount,
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        weekOrdersCount,
        weekRevenue: Math.round(weekRevenue * 100) / 100,
        averageOrderValue,
        pendingCount,
        deliveredCount,
        completedCount: deliveredCount,
        inProgressCount,
        popularProducts,
        salesTrend,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order statistics: ' + error.message,
    });
  }
});

// List orders with search and filters (including branch filter)
router.get('/', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const { status, search, dateRange, branchId } = req.query;

    let orders = await dbService.orders.find({ restaurantId: req.restaurantId });

    // Status filter
    if (status && status !== 'all') {
      orders = orders.filter((o) => o.status.toLowerCase() === status.toLowerCase());
    }

    // Branch filter
    if (branchId && branchId !== 'all') {
      orders = orders.filter((o) => String(o.branchId) === String(branchId));
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let cutoff = 0;
      if (dateRange === 'today') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      } else if (dateRange === 'week') {
        cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      } else if (dateRange === 'month') {
        cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      }

      orders = orders.filter((o) => new Date(o.createdAt).getTime() >= cutoff);
    }

    // Search filter (orderNumber, customer name, phone)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      orders = orders.filter((o) => {
        return (
          o.orderNumber?.toLowerCase().includes(q) ||
          o.customerInfo?.name?.toLowerCase().includes(q) ||
          o.customerInfo?.phone?.toLowerCase().includes(q)
        );
      });
    }

    return res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders: ' + error.message,
    });
  }
});

// Customer authenticated order history endpoint
router.get('/customer/my-orders', protect, async (req, res) => {
  try {
    const all = await dbService.orders.find({});
    const customerOrders = all.filter(
      (o) =>
        String(o.customerId) === String(req.user._id) ||
        (o.customerInfo?.email && o.customerInfo.email.toLowerCase() === req.user.email.toLowerCase())
    );

    const populated = await Promise.all(
      customerOrders.map(async (o) => {
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
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customer orders: ' + error.message,
    });
  }
});

// Get single order details
router.get('/:id', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const order = await dbService.orders.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Tenant check
    if (String(order.restaurantId) !== String(req.restaurantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Order belongs to another restaurant',
      });
    }

    return res.json({
      success: true,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order: ' + error.message,
    });
  }
});

// Update order status (with history logging & rejection support)
router.patch('/:id/status', protect, requireRestaurantAccess, async (req, res) => {
  try {
    const { status, rejectionReason = '', note = '' } = req.body;

    const validStatuses = [
      'Order Placed',
      'Preparing Your Order',
      'Ready for Pickup',
      'Rider Picked Up Your Order',
      'Rider Is On The Way',
      'Rider Is At Your Doorstep',
      'Order Received',
      'Pending',
      'Confirmed',
      'Accepted',
      'Preparing',
      'Ready',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Rejected',
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid values: ${validStatuses.join(', ')}`,
      });
    }

    const order = await dbService.orders.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Tenant validation: owner/staff can ONLY update orders belonging to their restaurant
    if (String(order.restaurantId) !== String(req.restaurantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You cannot modify orders of another restaurant',
      });
    }

    // Terminal status protection: orders that are Delivered, Cancelled, or Rejected cannot be transitioned
    const terminalStatuses = ['Delivered', 'Order Received', 'Cancelled', 'Rejected'];
    if (terminalStatuses.includes(order.status) && status !== order.status) {
      return res.status(400).json({
        success: false,
        message: `Order #${order.orderNumber} is already in terminal state '${order.status}' and cannot be changed to '${status}'.`,
      });
    }

    const historyEntry = {
      status,
      timestamp: new Date().toISOString(),
      note: note || (status === 'Rejected' ? `Rejected: ${rejectionReason}` : `Status updated to ${status}`),
    };

    const updates = {
      status,
      $push: { statusHistory: historyEntry },
    };

    if (status === 'Rejected') {
      updates.rejectionReason = rejectionReason;
    }

    if (status === 'Delivered' || status === 'Order Received') {
      updates.paymentStatus = 'paid';
    }

    const updated = await dbService.orders.findByIdAndUpdate(req.params.id, updates);

    return res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status: ' + error.message,
    });
  }
});

export default router;
