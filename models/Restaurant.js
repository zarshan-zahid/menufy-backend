import mongoose from 'mongoose';

const deliveryZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    fee: { type: Number, default: 0 },
    minOrder: { type: Number, default: 0 },
    maxDistanceKm: { type: Number, default: 10 },
    allowedAreas: { type: [String], default: [] },
  },
  { _id: true }
);

const restaurantSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Restaurant name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    tagline: {
      type: String,
      default: 'Delicious food crafted with love & tradition',
    },
    description: {
      type: String,
      default: '',
    },
    logo: {
      type: String,
      default: '',
    },
    banner: {
      type: String,
      default: '',
    },
    cuisine: {
      type: String,
      default: 'General',
      trim: true,
    },
    phone: {
      type: String,
      default: '+1 (555) 019-2834',
    },
    email: {
      type: String,
      default: 'contact@restaurant.com',
    },
    address: {
      type: String,
      default: '123 Gourmet Ave, Food City',
    },
    city: {
      type: String,
      default: 'Karachi',
    },
    coordinates: {
      lat: { type: Number, default: 24.8607 },
      lng: { type: Number, default: 67.0011 },
    },
    currency: {
      type: String,
      default: 'USD',
    },
    currencySymbol: {
      type: String,
      default: '$',
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'active', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },
    suspensionReason: {
      type: String,
      default: '',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Website Customizer Settings
    theme: {
      themeId: {
        type: String,
        default: 'ember', // 'ember' | 'midnight' | 'sunset' | 'sapphire' | 'emerald'
      },
      primaryColor: {
        type: String,
        default: '#ea580c',
      },
      secondaryColor: {
        type: String,
        default: '#0f172a',
      },
      accentColor: {
        type: String,
        default: '#f59e0b',
      },
      fontFamily: {
        type: String,
        default: 'Inter',
      },
      borderRadius: {
        type: String,
        default: 'rounded-xl',
      },
      bannerOverlay: {
        type: Boolean,
        default: true,
      },
      layout: {
        type: String,
        enum: ['grid', 'list'],
        default: 'grid',
      },
    },

    // Homepage Section Config
    sections: {
      showHero: { type: Boolean, default: true },
      showFeatured: { type: Boolean, default: true },
      showCategories: { type: Boolean, default: true },
      showAbout: { type: Boolean, default: true },
      heroHeadline: { type: String, default: 'Handcrafted Flavors Delivered Fresh' },
      heroSubheadline: { type: String, default: 'Browse our menu of chef-inspired specials, craft burgers, and signature dishes.' },
      announcementText: { type: String, default: 'Free delivery on orders over $30 with code FRESH30!' },
    },

    // Delivery & Operating Settings
    deliverySettings: {
      deliveryEnabled: { type: Boolean, default: true },
      pickupEnabled: { type: Boolean, default: true },
      deliveryFee: { type: Number, default: 4.99 },
      minOrderAmount: { type: Number, default: 15.0 },
      estimatedDeliveryTime: { type: String, default: '30-45 mins' },
      estimatedPickupTime: { type: String, default: '15-20 mins' },
      taxRate: { type: Number, default: 5 }, // 5%
      openingHours: {
        openTime: { type: String, default: '10:00' },
        closeTime: { type: String, default: '23:00' },
        isOpen24Hours: { type: Boolean, default: false },
        closedDays: { type: [String], default: [] },
      },
      deliveryZones: {
        type: [deliveryZoneSchema],
        default: [
          { name: 'Downtown / Inner City (Within 3km)', fee: 3.5, minOrder: 15, maxDistanceKm: 3 },
          { name: 'Midtown / Suburbs (3-7km)', fee: 5.5, minOrder: 20, maxDistanceKm: 7 },
          { name: 'Outer Metropolitan (7-12km)', fee: 8.0, minOrder: 30, maxDistanceKm: 12 },
        ],
      },
      maxDeliveryRadiusKm: { type: Number, default: 15 },
      enforceZoneBoundary: { type: Boolean, default: true },
      enforceCityBoundary: { type: Boolean, default: true },
      allowedCities: { type: [String], default: [] },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Restaurant', restaurantSchema);
