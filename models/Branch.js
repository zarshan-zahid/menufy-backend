import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Branch address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'Branch city is required'],
      trim: true,
    },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      default: '',
    },
    openingHours: {
      openTime: { type: String, default: '10:00' },
      closeTime: { type: String, default: '23:00' },
      isOpen24Hours: { type: Boolean, default: false },
    },
    deliveryEnabled: {
      type: Boolean,
      default: true,
    },
    pickupEnabled: {
      type: Boolean,
      default: true,
    },
    isMainBranch: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Branch', branchSchema);
