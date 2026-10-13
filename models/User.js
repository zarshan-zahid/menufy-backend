import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    role: {
      type: String,
      enum: ['owner', 'staff', 'customer', 'rider', 'superadmin', 'super_admin', 'super-admin', 'admin', 'superadministrator'],
      default: 'owner',
      lowercase: true,
      trim: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    // Dedicated Delivery Fleet / Rider fields
    riderStatus: {
      type: String,
      enum: ['pending', 'approved', 'active', 'suspended', 'rejected'],
      default: 'pending',
    },
    vehicleType: {
      type: String,
      default: 'Motorcycle',
    },
    vehicleNumber: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    cnic: {
      type: String,
      default: '',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    currentOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    rating: {
      type: Number,
      default: 5.0,
    },
    totalDeliveries: {
      type: Number,
      default: 0,
    },
    // Customer Saved Delivery Addresses
    savedAddresses: {
      type: [
        new mongoose.Schema(
          {
            id: { type: String, default: '' },
            _id: { type: String, default: () => `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` },
            label: { type: String, default: 'Home' },
            customLabel: { type: String, default: '' },
            address: { type: String, required: true },
            street: { type: String, default: '' },
            city: { type: String, default: 'Karachi' },
            area: { type: String, default: '' },
            landmark: { type: String, default: '' },
            coordinates: {
              lat: { type: Number, default: null },
              lng: { type: Number, default: null },
            },
            notes: { type: String, default: '' },
            deliveryInstructions: { type: String, default: '' },
            recipientName: { type: String, default: '' },
            recipientPhone: { type: String, default: '' },
            isDefault: { type: Boolean, default: false },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving if modified and not already hashed
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    // Guard: Do not re-hash if already a bcrypt string ($2a$, $2b$, or $2y$)
    if (this.password && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(this.password)) {
      return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
