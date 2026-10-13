import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    message: {
      type: String,
      default: '',
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      default: null,
    },
    restaurantName: {
      type: String,
      default: '',
    },
    slug: {
      type: String,
      default: '',
    },
    ownerEmail: {
      type: String,
      default: '',
    },
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    riderName: {
      type: String,
      default: '',
    },
    riderEmail: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    actorRole: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

activitySchema.index({ timestamp: -1 });

export default mongoose.model('Activity', activitySchema);
