import mongoose from 'mongoose';

const orderItemExtraSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    basePrice: { type: Number, required: true },
    selectedSize: {
      name: { type: String, default: '' },
      price: { type: Number, default: 0 },
    },
    selectedExtras: {
      type: [orderItemExtraSchema],
      default: [],
    },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    totalPrice: { type: Number, required: true },
    specialInstructions: { type: String, default: '' },
  },
  { _id: true }
);

const orderStatusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    branchName: {
      type: String,
      default: '',
    },
    idempotencyKey: {
      type: String,
      default: null,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    customerInfo: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, trim: true, default: '' },
      address: { type: String, default: '' },
      city: { type: String, default: 'Karachi' },
      area: { type: String, default: '' },
      landmark: { type: String, default: '' },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
      notes: { type: String, default: '' },
      deliveryInstructions: { type: String, default: '' },
    },
    recipientInfo: {
      isGiftOrder: { type: Boolean, default: false },
      recipientName: { type: String, default: '' },
      recipientPhone: { type: String, default: '' },
      giftMessage: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
    deliveryZone: {
      name: { type: String, default: '' },
      fee: { type: Number, default: 0 },
      distanceKm: { type: Number, default: null },
    },
    restaurantLocation: {
      name: { type: String, default: '' },
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },
    orderType: {
      type: String,
      enum: ['delivery', 'pickup', 'takeaway', 'dine_in'],
      default: 'delivery',
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [val => val.length > 0, 'Order must contain at least one item'],
    },
    pricing: {
      subtotal: { type: Number, required: true },
      deliveryFee: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      total: { type: Number, required: true },
      couponCode: { type: String, default: null },
    },
    paymentMethod: {
      type: String,
      enum: ['cash_on_delivery', 'cash_on_pickup', 'card', 'online', 'cod'],
      default: 'cash_on_delivery',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'failed'],
      default: 'pending',
    },
    status: {
      type: String,
      enum: [
        'Order Placed',
        'Preparing Your Order',
        'Ready for Pickup',
        'Rider Accepted',
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
      ],
      default: 'Order Placed',
      index: true,
    },
    assignedRiderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    riderInfo: {
      id: { type: String, default: null },
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      vehicleType: { type: String, default: '' },
      vehicleNumber: { type: String, default: '' },
    },
    riderAssignedAt: {
      type: Date,
      default: null,
    },
    riderPickedUpAt: {
      type: Date,
      default: null,
    },
    riderDeliveredAt: {
      type: Date,
      default: null,
    },
    riderLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
      isSharing: { type: Boolean, default: false },
      permissionDenied: { type: Boolean, default: false },
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    statusHistory: {
      type: [orderStatusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Order', orderSchema);
