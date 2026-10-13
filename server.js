import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly locate and load backend/.env regardless of process cwd
const envCandidates = [
  path.resolve(__dirname, '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}
dotenv.config();

import { connectDB, getIsConnected } from './config/db.js';
import { getDB } from './services/dbStore.js';
import { seedDatabase } from './seed/seedData.js';
import { initSocketIO } from './services/socketService.js';

import authRoutes from './routes/auth.routes.js';
import restaurantRoutes from './routes/restaurant.routes.js';
import categoryRoutes from './routes/category.routes.js';
import menuRoutes from './routes/menu.routes.js';
import orderRoutes from './routes/order.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import publicRoutes from './routes/public.routes.js';
import adminRoutes from './routes/admin.routes.js';
import branchRoutes from './routes/branch.routes.js';
import riderRoutes from './routes/rider.routes.js';

const app = express();
const httpServer = http.createServer(app);

// Dynamic CORS configuration using environment variables
const frontendEnv = process.env.FRONTEND_URL || 'http://localhost:3004';
const allowedOrigins = frontendEnv
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

['http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'].forEach(o => {
  if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
});

const io = initSocketIO(httpServer, allowedOrigins);
const PORT = process.env.PORT || 5001;

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (tools, tests, mobile, curl)
    if (!origin) return callback(null, true);
    if (
      process.env.NODE_ENV !== 'production' ||
      allowedOrigins.includes(origin) ||
      allowedOrigins.includes('*') ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-idempotency-key',
    'X-Requested-With',
    'Cache-Control',
    'Pragma',
    'Expires',
    'Accept',
    'Origin',
  ],
};

// CORS middleware & preflight handler
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Prevent browser/client stale caching for dynamic API responses
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'MenuFy Multi-Tenant Restaurant Engine',
    version: '3.0.0',
    database: getIsConnected() ? 'mongodb' : 'disk_store',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/menu-items', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rider', riderRoutes);
app.use('/api/public', publicRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// Boot Server and auto-seed if needed
const startServer = async () => {
  try {
    await connectDB();

    // Running on clean database

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`\n======================================================`);
      console.log(`🚀 MenuFy MERN Backend is running on port ${PORT}`);
      console.log(`🔗 API Base: http://localhost:${PORT}/api`);
      console.log(`📡 Socket.IO Real-Time Dispatch Engine initialized`);
      console.log(`🗄️  Database Mode: ${getIsConnected() ? 'MongoDB Atlas (Connected)' : 'Local Disk Fallback'}`);
      console.log(`======================================================\n`);
    });
  } catch (error) {
    console.error('Failed to start MenuFy server:', error);
  }
};

startServer();
