import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { getIsConnected } from '../config/db.js';
import User from '../models/User.js';
import Restaurant from '../models/Restaurant.js';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import Branch from '../models/Branch.js';
import Activity from '../models/Activity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'foodflow_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-file store structure
const defaultState = {
  users: [],
  restaurants: [],
  categories: [],
  menuItems: [],
  orders: [],
  coupons: [],
  branches: [],
  activities: [],
};

const loadFileDB = () => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultState, null, 2), 'utf-8');
      return { ...defaultState };
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.branches) parsed.branches = [];
    if (!parsed.activities) parsed.activities = [];
    return parsed;
  } catch (err) {
    console.error('Error reading DB file, recreating:', err.message);
    return { ...defaultState };
  }
};

const saveFileDB = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing DB file:', err.message);
  }
};

export const generateId = () => new mongoose.Types.ObjectId().toString();

export const getDB = () => loadFileDB();
export const updateDB = (updater) => {
  const current = loadFileDB();
  const next = updater(current);
  saveFileDB(next);
  return next;
};

/**
 * Universal Store Service that routes to Mongoose if connected,
 * or disk-backed JSON store with MongoDB query semantics.
 * All Mongoose queries return plain JS objects via .lean() or .toObject()
 * to ensure 100% compatibility with spreads, destructuring, and serialization.
 */
export const dbService = {
  getIsConnected,

  // Users
  users: {
    async findOne(query) {
      if (getIsConnected()) return User.findOne(query).lean();
      const db = loadFileDB();
      return db.users.find((u) => {
        return Object.entries(query).every(([k, v]) => String(u[k]).toLowerCase() === String(v).toLowerCase());
      }) || null;
    },
    async findById(id) {
      if (getIsConnected()) return User.findById(id).select('-password').lean();
      const db = loadFileDB();
      const u = db.users.find((x) => String(x._id) === String(id));
      if (!u) return null;
      const { password, ...rest } = u;
      return rest;
    },
    async findByIdWithPassword(id) {
      if (getIsConnected()) return User.findById(id).lean();
      const db = loadFileDB();
      return db.users.find((x) => String(x._id) === String(id)) || null;
    },
    async create(userData) {
      if (getIsConnected()) {
        const u = new User(userData);
        const saved = await u.save();
        return saved.toObject ? saved.toObject() : saved;
      }
      const db = loadFileDB();
      const doc = {
        _id: generateId(),
        ...userData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.users.push(doc);
      saveFileDB(db);
      return doc;
    },
    async find(query = {}) {
      if (getIsConnected()) return User.find(query).select('-password').lean();
      const db = loadFileDB();
      return db.users
        .filter((u) => Object.entries(query).every(([k, v]) => String(u[k]) === String(v)))
        .map(({ password, ...rest }) => rest);
    },
    async countDocuments(query = {}) {
      if (getIsConnected()) return User.countDocuments(query);
      const db = loadFileDB();
      return db.users.filter((u) => Object.entries(query).every(([k, v]) => String(u[k]) === String(v))).length;
    },
    async findByIdAndUpdate(id, updates) {
      if (getIsConnected()) return User.findByIdAndUpdate(id, updates, { new: true }).select('-password').lean();
      let updatedDoc = null;
      updateDB((db) => {
        const idx = db.users.findIndex((x) => String(x._id) === String(id));
        if (idx !== -1) {
          db.users[idx] = { ...db.users[idx], ...updates, updatedAt: new Date().toISOString() };
          const { password, ...rest } = db.users[idx];
          updatedDoc = rest;
        }
        return db;
      });
      return updatedDoc;
    },
  },

  // Restaurants
  restaurants: {
    async find(query = {}) {
      if (getIsConnected()) return Restaurant.find(query).sort({ createdAt: -1 }).lean();
      const db = loadFileDB();
      return db.restaurants
        .filter((r) => Object.entries(query).every(([k, v]) => String(r[k]) === String(v)))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    async countDocuments(query = {}) {
      if (getIsConnected()) return Restaurant.countDocuments(query);
      const db = loadFileDB();
      return db.restaurants.filter((r) => Object.entries(query).every(([k, v]) => String(r[k]) === String(v))).length;
    },
    async findById(id) {
      if (getIsConnected()) return Restaurant.findById(id).lean();
      const db = loadFileDB();
      return db.restaurants.find((r) => String(r._id) === String(id)) || null;
    },
    async findOne(query) {
      if (getIsConnected()) return Restaurant.findOne(query).lean();
      const db = loadFileDB();
      return db.restaurants.find((r) => {
        return Object.entries(query).every(([k, v]) => String(r[k]) === String(v));
      }) || null;
    },
    async create(restData) {
      if (getIsConnected()) {
        const r = new Restaurant(restData);
        const saved = await r.save();
        return saved.toObject ? saved.toObject() : saved;
      }
      const db = loadFileDB();
      const doc = {
        _id: generateId(),
        isPublished: false,
        status: 'pending',
        cuisine: 'General',
        logo: '',
        banner: '',
        suspensionReason: '',
        rejectionReason: '',
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        theme: {
          themeId: 'ember',
          primaryColor: '#ea580c',
          secondaryColor: '#0f172a',
          accentColor: '#f59e0b',
          fontFamily: 'Inter',
          borderRadius: 'rounded-xl',
          bannerOverlay: true,
          layout: 'grid',
        },
        sections: {
          showHero: true,
          showFeatured: true,
          showCategories: true,
          showAbout: true,
          heroHeadline: 'Handcrafted Flavors Delivered Fresh',
          heroSubheadline: 'Browse our menu of chef-inspired specials, craft burgers, and signature dishes.',
          announcementText: 'Fresh meals delivered fast to your doorstep!',
        },
        deliverySettings: {
          deliveryEnabled: true,
          pickupEnabled: true,
          deliveryFee: 4.99,
          minOrderAmount: 15.0,
          estimatedDeliveryTime: '30-45 mins',
          estimatedPickupTime: '15-20 mins',
          taxRate: 5,
          openingHours: {
            openTime: '10:00',
            closeTime: '23:00',
            isOpen24Hours: false,
            closedDays: [],
          },
          deliveryZones: [
            { name: 'Downtown (Within 3km)', fee: 3.5, minOrder: 15 },
            { name: 'Midtown (3-7km)', fee: 5.5, minOrder: 20 },
            { name: 'Outskirts (7-12km)', fee: 8.0, minOrder: 30 },
          ],
        },
        ...restData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.restaurants.push(doc);
      saveFileDB(db);
      return doc;
    },
    async findByIdAndUpdate(id, updates) {
      if (getIsConnected()) return Restaurant.findByIdAndUpdate(id, updates, { new: true }).lean();
      let updatedDoc = null;
      updateDB((db) => {
        const idx = db.restaurants.findIndex((r) => String(r._id) === String(id));
        if (idx !== -1) {
          const cur = db.restaurants[idx];
          db.restaurants[idx] = {
            ...cur,
            ...updates,
            theme: updates.theme ? { ...cur.theme, ...updates.theme } : cur.theme,
            sections: updates.sections ? { ...cur.sections, ...updates.sections } : cur.sections,
            deliverySettings: updates.deliverySettings
              ? { ...cur.deliverySettings, ...updates.deliverySettings }
              : cur.deliverySettings,
            updatedAt: new Date().toISOString(),
          };
          updatedDoc = db.restaurants[idx];
        }
        return db;
      });
      return updatedDoc;
    },
  },

  // Categories
  categories: {
    async find(query = {}) {
      if (getIsConnected()) return Category.find(query).sort({ orderIndex: 1, createdAt: 1 }).lean();
      const db = loadFileDB();
      return db.categories
        .filter((c) => {
          return Object.entries(query).every(([k, v]) => String(c[k]) === String(v));
        })
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    },
    async findById(id) {
      if (getIsConnected()) return Category.findById(id).lean();
      const db = loadFileDB();
      return db.categories.find((c) => String(c._id) === String(id)) || null;
    },
    async findOne(query) {
      if (getIsConnected()) return Category.findOne(query).lean();
      const db = loadFileDB();
      return db.categories.find((c) => Object.entries(query).every(([k, v]) => String(c[k]) === String(v))) || null;
    },
    async create(data) {
      if (getIsConnected()) {
        const c = new Category(data);
        const saved = await c.save();
        return saved.toObject ? saved.toObject() : saved;
      }
      const db = loadFileDB();
      const doc = {
        _id: generateId(),
        slug: (data.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        orderIndex: 0,
        isActive: true,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.categories.push(doc);
      saveFileDB(db);
      return doc;
    },
    async findByIdAndUpdate(id, updates) {
      if (getIsConnected()) return Category.findByIdAndUpdate(id, updates, { new: true }).lean();
      let updatedDoc = null;
      updateDB((db) => {
        const idx = db.categories.findIndex((c) => String(c._id) === String(id));
        if (idx !== -1) {
          db.categories[idx] = { ...db.categories[idx], ...updates, updatedAt: new Date().toISOString() };
          updatedDoc = db.categories[idx];
        }
        return db;
      });
      return updatedDoc;
    },
    async findByIdAndDelete(id) {
      if (getIsConnected()) return Category.findByIdAndDelete(id).lean();
      let removed = null;
      updateDB((db) => {
        const idx = db.categories.findIndex((c) => String(c._id) === String(id));
        if (idx !== -1) {
          removed = db.categories.splice(idx, 1)[0];
        }
        return db;
      });
      return removed;
    },
  },

  // Menu Items
  menuItems: {
    async find(query = {}) {
      if (getIsConnected()) return MenuItem.find(query).sort({ orderIndex: 1, createdAt: -1 }).lean();
      const db = loadFileDB();
      return db.menuItems
        .filter((m) => {
          return Object.entries(query).every(([k, v]) => {
            if (typeof v === 'boolean') return m[k] === v;
            return String(m[k]) === String(v);
          });
        })
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    },
    async findById(id) {
      if (getIsConnected()) return MenuItem.findById(id).lean();
      const db = loadFileDB();
      return db.menuItems.find((m) => String(m._id) === String(id)) || null;
    },
    async findOne(query) {
      if (getIsConnected()) return MenuItem.findOne(query).lean();
      const db = loadFileDB();
      return db.menuItems.find((m) => Object.entries(query).every(([k, v]) => String(m[k]) === String(v))) || null;
    },
    async create(data) {
      if (getIsConnected()) {
        const m = new MenuItem(data);
        const saved = await m.save();
        return saved.toObject ? saved.toObject() : saved;
      }
      const db = loadFileDB();
      const doc = {
        _id: generateId(),
        isAvailable: true,
        isFeatured: false,
        orderIndex: 0,
        prepTime: '',
        sizes: [],
        extras: [],
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.menuItems.push(doc);
      saveFileDB(db);
      return doc;
    },
    async findByIdAndUpdate(id, updates) {
      if (getIsConnected()) return MenuItem.findByIdAndUpdate(id, updates, { new: true }).lean();
      let updatedDoc = null;
      updateDB((db) => {
        const idx = db.menuItems.findIndex((m) => String(m._id) === String(id));
        if (idx !== -1) {
          db.menuItems[idx] = { ...db.menuItems[idx], ...updates, updatedAt: new Date().toISOString() };
          updatedDoc = db.menuItems[idx];
        }
        return db;
      });
      return updatedDoc;
    },
    async findByIdAndDelete(id) {
      if (getIsConnected()) return MenuItem.findByIdAndDelete(id).lean();
      let removed = null;
      updateDB((db) => {
        const idx = db.menuItems.findIndex((m) => String(m._id) === String(id));
        if (idx !== -1) {
          removed = db.menuItems.splice(idx, 1)[0];
        }
        return db;
      });
      return removed;
    },
    async deleteMany(query) {
      if (getIsConnected()) return MenuItem.deleteMany(query);
      let count = 0;
      updateDB((db) => {
        db.menuItems = db.menuItems.filter((m) => {
          const match = Object.entries(query).every(([k, v]) => String(m[k]) === String(v));
          if (match) count++;
          return !match;
        });
        return db;
      });
      return { deletedCount: count };
    },
  },

  // Coupons
  coupons: {
    async find(query = {}) {
      if (getIsConnected()) return Coupon.find(query).sort({ createdAt: -1 }).lean();
      const db = loadFileDB();
      return db.coupons.filter((c) => {
        return Object.entries(query).every(([k, v]) => {
          if (typeof v === 'boolean') return c[k] === v;
          return String(c[k]) === String(v);
        });
      });
    },
    async findById(id) {
      if (getIsConnected()) return Coupon.findById(id).lean();
      const db = loadFileDB();
      return db.coupons.find((c) => String(c._id) === String(id)) || null;
    },
    async findOne(query) {
      if (getIsConnected()) return Coupon.findOne(query).lean();
      const db = loadFileDB();
      return db.coupons.find((c) => {
        return Object.entries(query).every(([k, v]) => {
          if (k === 'code') return String(c.code).toUpperCase() === String(v).toUpperCase();
          if (typeof v === 'boolean') return c[k] === v;
          return String(c[k]) === String(v);
        });
      }) || null;
    },
    async create(data) {
      if (getIsConnected()) {
        const c = new Coupon(data);
        const saved = await c.save();
        return saved.toObject ? saved.toObject() : saved;
      }
      const db = loadFileDB();
      const doc = {
        _id: generateId(),
        code: (data.code || '').toUpperCase().trim(),
        usageLimit: 100,
        usageCount: 0,
        isActive: true,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.coupons.push(doc);
      saveFileDB(db);
      return doc;
    },
    async findByIdAndUpdate(id, updates) {
      if (getIsConnected()) return Coupon.findByIdAndUpdate(id, updates, { new: true }).lean();
      let updatedDoc = null;
      updateDB((db) => {
        const idx = db.coupons.findIndex((c) => String(c._id) === String(id));
        if (idx !== -1) {
          db.coupons[idx] = { ...db.coupons[idx], ...updates, updatedAt: new Date().toISOString() };
          updatedDoc = db.coupons[idx];
        }
        return db;
      });
      return updatedDoc;
    },
    async findByIdAndDelete(id) {
      if (getIsConnected()) return Coupon.findByIdAndDelete(id).lean();
      let removed = null;
      updateDB((db) => {
        const idx = db.coupons.findIndex((c) => String(c._id) === String(id));
        if (idx !== -1) {
          removed = db.coupons.splice(idx, 1)[0];
        }
        return db;
      });
      return removed;
    },
  },

  // Orders
  orders: {
    async find(query = {}) {
      if (getIsConnected()) return Order.find(query).sort({ createdAt: -1 }).lean();
      const db = loadFileDB();
      return db.orders
        .filter((o) => {
          return Object.entries(query).every(([k, v]) => {
            if (typeof v === 'object' && v !== null && v.$gte) {
              return new Date(o[k]) >= new Date(v.$gte);
            }
            return String(o[k]) === String(v);
          });
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    async findById(id) {
      if (getIsConnected()) return Order.findById(id).lean();
      const db = loadFileDB();
      return db.orders.find((o) => String(o._id) === String(id)) || null;
    },
    async findOne(query) {
      if (getIsConnected()) return Order.findOne(query).lean();
      const db = loadFileDB();
      return db.orders.find((o) => Object.entries(query).every(([k, v]) => String(o[k]) === String(v))) || null;
    },
    async create(data) {
      if (getIsConnected()) {
        const o = new Order(data);
        const saved = await o.save();
        return saved.toObject ? saved.toObject() : saved;
      }
      const db = loadFileDB();
      const doc = {
        _id: generateId(),
        status: 'Pending',
        paymentStatus: 'pending',
        statusHistory: [
          { status: 'Pending', timestamp: new Date().toISOString(), note: 'Order placed by customer' },
        ],
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.orders.push(doc);
      saveFileDB(db);
      return doc;
    },
    async findByIdAndUpdate(id, updates) {
      if (getIsConnected()) return Order.findByIdAndUpdate(id, updates, { new: true }).lean();
      let updatedDoc = null;
      updateDB((db) => {
        const idx = db.orders.findIndex((o) => String(o._id) === String(id));
        if (idx !== -1) {
          let newHistory = db.orders[idx].statusHistory || [];
          if (updates.$push && updates.$push.statusHistory) {
            newHistory = [...newHistory, updates.$push.statusHistory];
          }
          const cleanUpdates = { ...updates };
          delete cleanUpdates.$push;

          db.orders[idx] = {
            ...db.orders[idx],
            ...cleanUpdates,
            statusHistory: newHistory,
            updatedAt: new Date().toISOString(),
          };
          updatedDoc = db.orders[idx];
        }
        return db;
      });
      return updatedDoc;
    },
    async countDocuments(query = {}) {
      if (getIsConnected()) return Order.countDocuments(query);
      const db = loadFileDB();
      return db.orders.filter((o) => Object.entries(query).every(([k, v]) => String(o[k]) === String(v))).length;
    },
  },

  // Branches
  branches: {
    async find(query = {}) {
      if (getIsConnected()) return Branch.find(query).sort({ createdAt: 1 }).lean();
      const db = loadFileDB();
      return (db.branches || [])
        .filter((b) => {
          return Object.entries(query).every(([k, v]) => {
            if (typeof v === 'boolean') return b[k] === v;
            return String(b[k]) === String(v);
          });
        })
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    },
    async findById(id) {
      if (getIsConnected()) return Branch.findById(id).lean();
      const db = loadFileDB();
      return (db.branches || []).find((b) => String(b._id) === String(id)) || null;
    },
    async findOne(query) {
      if (getIsConnected()) return Branch.findOne(query).lean();
      const db = loadFileDB();
      return (db.branches || []).find((b) => {
        return Object.entries(query).every(([k, v]) => {
          if (typeof v === 'boolean') return b[k] === v;
          return String(b[k]) === String(v);
        });
      }) || null;
    },
    async create(data) {
      if (getIsConnected()) {
        const b = new Branch(data);
        const saved = await b.save();
        return saved.toObject ? saved.toObject() : saved;
      }
      const db = loadFileDB();
      const doc = {
        _id: generateId(),
        deliveryEnabled: true,
        pickupEnabled: true,
        isMainBranch: false,
        isActive: true,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!db.branches) db.branches = [];
      db.branches.push(doc);
      saveFileDB(db);
      return doc;
    },
    async findByIdAndUpdate(id, updates) {
      if (getIsConnected()) return Branch.findByIdAndUpdate(id, updates, { new: true }).lean();
      let updatedDoc = null;
      updateDB((db) => {
        if (!db.branches) db.branches = [];
        const idx = db.branches.findIndex((b) => String(b._id) === String(id));
        if (idx !== -1) {
          db.branches[idx] = { ...db.branches[idx], ...updates, updatedAt: new Date().toISOString() };
          updatedDoc = db.branches[idx];
        }
        return db;
      });
      return updatedDoc;
    },
    async findByIdAndDelete(id) {
      if (getIsConnected()) return Branch.findByIdAndDelete(id).lean();
      let removed = null;
      updateDB((db) => {
        if (!db.branches) db.branches = [];
        const idx = db.branches.findIndex((b) => String(b._id) === String(id));
        if (idx !== -1) {
          removed = db.branches.splice(idx, 1)[0];
        }
        return db;
      });
      return removed;
    },
  },

  // Activities (Platform Audit Trail)
  activities: {
    async find(limit = 30) {
      if (getIsConnected()) {
        return Activity.find().sort({ timestamp: -1 }).limit(limit).lean();
      }
      const db = loadFileDB();
      return (db.activities || [])
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    },
    async create(data) {
      if (getIsConnected()) {
        const a = new Activity(data);
        const saved = await a.save();
        return saved.toObject ? saved.toObject() : saved;
      }
      const db = loadFileDB();
      if (!db.activities) db.activities = [];
      const doc = {
        _id: generateId(),
        timestamp: new Date().toISOString(),
        ...data,
      };
      db.activities.unshift(doc);
      if (db.activities.length > 200) db.activities.pop();
      saveFileDB(db);
      return doc;
    },
  },
};
