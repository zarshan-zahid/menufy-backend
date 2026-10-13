import mongoose from 'mongoose';

const sizeOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
  },
  { _id: true }
);

const extraOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
  },
  { _id: true }
);

const menuItemSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    },
    price: {
      type: Number,
      required: [true, 'Base price is required'],
      min: 0,
    },
    discountPrice: {
      type: Number,
      default: null,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    prepTime: {
      type: String,
      default: '',
      trim: true,
    },
    orderIndex: {
      type: Number,
      default: 0,
    },
    sizes: {
      type: [sizeOptionSchema],
      default: [],
    },
    extras: {
      type: [extraOptionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('MenuItem', menuItemSchema);
