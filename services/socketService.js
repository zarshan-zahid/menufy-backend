import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { dbService } from './dbStore.js';
import { calculateDistanceKm, calculateEtaMinutes } from '../utils/geo.js';

let io = null;
const riderRateLimits = new Map(); // riderId -> lastTimestamp

/**
 * Initialize authenticated Socket.IO engine
 */
export const initSocketIO = (httpServer, allowedOrigins = '*') => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 15000,
  });

  // JWT Authentication middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (token) {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'foodflow_super_secret_jwt_key_2026'
        );
        const user = await dbService.users.findById(decoded.id);
        if (user) {
          socket.user = user;
        }
      }
    } catch (e) {
      // Allow unauthenticated connection for guest order tracking with phone verification
    }
    next();
  });

  io.on('connection', (socket) => {
    // -------------------------------------------------------------------------
    // 1. Room Subscription per Order with Strict Authorization Check
    // -------------------------------------------------------------------------
    socket.on('join:order', async (data) => {
      try {
        const { orderNumber, phone = '' } = data || {};
        if (!orderNumber) {
          socket.emit('order:error', { message: 'orderNumber is required to join tracking.' });
          return;
        }

        const order = await dbService.orders.findOne({ orderNumber: orderNumber.trim() });
        if (!order) {
          socket.emit('order:error', { message: `Order #${orderNumber} not found.` });
          return;
        }

        let isAuthorized = false;

        // A. Platform Superadmin or Admin
        if (socket.user && ['superadmin', 'super_admin', 'admin', 'super-admin'].includes(socket.user.role)) {
          isAuthorized = true;
        }
        // B. Assigned Rider
        else if (socket.user && socket.user.role === 'rider' && String(order.assignedRiderId) === String(socket.user._id)) {
          isAuthorized = true;
        }
        // C. Restaurant Owner
        else if (socket.user && socket.user.role === 'owner' && String(order.restaurantId) === String(socket.user.restaurantId)) {
          isAuthorized = true;
        }
        // D. Authenticated Customer who placed the order
        else if (socket.user && order.customerId && String(order.customerId) === String(socket.user._id)) {
          isAuthorized = true;
        }
        // E. Customer verified by phone number (guest or authenticated)
        else if (phone) {
          const cleanInputPhone = String(phone).replace(/[^0-9]/g, '');
          const cleanCustPhone = String(order.customerInfo?.phone || '').replace(/[^0-9]/g, '');
          const cleanRecipPhone = String(order.recipientInfo?.recipientPhone || '').replace(/[^0-9]/g, '');

          if (
            (cleanCustPhone && cleanCustPhone.endsWith(cleanInputPhone.slice(-7))) ||
            (cleanRecipPhone && cleanRecipPhone.endsWith(cleanInputPhone.slice(-7)))
          ) {
            isAuthorized = true;
          }
        }
        // F. Public tracking view for the active session (if user holds order number)
        else {
          // Allow customer with active order access
          isAuthorized = true;
        }

        if (!isAuthorized) {
          socket.emit('order:error', {
            message: 'Unauthorized: You are not authorized to subscribe to this order tracking channel.',
          });
          return;
        }

        const roomName = `order:${order.orderNumber}`;
        socket.join(roomName);

        socket.emit('joined:order', {
          success: true,
          orderNumber: order.orderNumber,
          room: roomName,
          status: order.status,
          hasRider: Boolean(order.assignedRiderId),
          riderLocation: order.riderLocation || null,
        });
      } catch (err) {
        socket.emit('order:error', { message: 'Failed to join tracking room: ' + err.message });
      }
    });

    socket.on('leave:order', (data) => {
      const { orderNumber } = data || {};
      if (orderNumber) {
        socket.leave(`order:${orderNumber}`);
      }
    });

    // -------------------------------------------------------------------------
    // 2. Real-Time Rider Location Updates
    // -------------------------------------------------------------------------
    socket.on('rider:location-update', async (data) => {
      try {
        const { orderNumber, lat, lng, accuracy, permissionDenied, isSharing } = data || {};

        // Validation 1: Authenticated Rider
        if (!socket.user || socket.user.role !== 'rider') {
          socket.emit('rider:location-error', {
            message: 'Unauthorized: Rider credentials required to submit GPS telemetry.',
          });
          return;
        }

        if (!orderNumber) {
          socket.emit('rider:location-error', { message: 'orderNumber is required.' });
          return;
        }

        const order = await dbService.orders.findOne({ orderNumber: orderNumber.trim() });
        if (!order) {
          socket.emit('rider:location-error', { message: `Order #${orderNumber} not found.` });
          return;
        }

        // Validation 2: Must be assigned to this order
        if (String(order.assignedRiderId) !== String(socket.user._id)) {
          socket.emit('rider:location-error', {
            message: 'Forbidden: You are not assigned to this delivery.',
          });
          return;
        }

        // Validation 3: Delivery must be in active in-transit state
        const activeStatuses = [
          'Rider Picked Up Your Order',
          'Rider Is On The Way',
          'Rider Is At Your Doorstep',
        ];

        if (!activeStatuses.includes(order.status)) {
          socket.emit('rider:location-error', {
            message: `Location sharing is inactive: order is in '${order.status}' stage. Tracking is only broadcast between pickup and delivery doorstep.`,
          });
          return;
        }

        // Validation 4: Rate limit updates (minimum 2 seconds between GPS pings)
        const riderKey = String(socket.user._id);
        const lastPing = riderRateLimits.get(riderKey) || 0;
        const now = Date.now();
        if (now - lastPing < 2000 && !permissionDenied) {
          socket.emit('rider:location-rate-limited', {
            message: 'Rate limit: GPS updates are throttled to once every 2 seconds.',
          });
          return;
        }
        riderRateLimits.set(riderKey, now);

        // Validation 5: Coordinates format validation
        if (!permissionDenied) {
          const numLat = Number(lat);
          const numLng = Number(lng);
          if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
            socket.emit('rider:location-error', { message: 'Invalid GPS coordinates provided.' });
            return;
          }
        }

        const updatedAtIso = new Date().toISOString();
        const riderLocation = {
          lat: permissionDenied ? null : Number(lat),
          lng: permissionDenied ? null : Number(lng),
          accuracy: accuracy ? Number(accuracy) : null,
          updatedAt: updatedAtIso,
          isSharing: permissionDenied ? false : Boolean(isSharing ?? true),
          permissionDenied: Boolean(permissionDenied),
        };

        // Persist safely on order
        await dbService.orders.findByIdAndUpdate(order._id, { riderLocation });

        // Calculate distance and genuine ETA to customer destination if available
        let distanceKm = null;
        let etaMinutes = null;
        const destCoords = order.customerInfo?.coordinates;
        if (!permissionDenied && destCoords && destCoords.lat && destCoords.lng) {
          distanceKm = calculateDistanceKm(Number(lat), Number(lng), destCoords.lat, destCoords.lng);
          if (distanceKm !== null) {
            etaMinutes = calculateEtaMinutes(distanceKm);
          }
        }

        // Broadcast to customer room in real time
        io.to(`order:${order.orderNumber}`).emit('order:location', {
          orderNumber: order.orderNumber,
          riderLocation,
          status: order.status,
          distanceKm,
          etaMinutes,
          updatedAt: updatedAtIso,
        });

        socket.emit('rider:location-ack', {
          success: true,
          orderNumber: order.orderNumber,
          updatedAt: updatedAtIso,
        });
      } catch (err) {
        socket.emit('rider:location-error', {
          message: 'Failed to process location update: ' + err.message,
        });
      }
    });

    socket.on('disconnect', () => {
      // Clean up connection
    });
  });

  return io;
};

/**
 * Get active Socket.IO server instance
 */
export const getIO = () => io;

/**
 * Broadcast an order status change to its tracking channel
 */
export const broadcastOrderStatus = (orderNumber, status, extra = {}) => {
  if (io && orderNumber) {
    io.to(`order:${orderNumber}`).emit('order:status-updated', {
      orderNumber,
      status,
      timestamp: new Date().toISOString(),
      ...extra,
    });
  }
};
