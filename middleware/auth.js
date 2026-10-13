import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';
import { dbService } from '../services/dbStore.js';

const JWT_SECRET = process.env.JWT_SECRET || 'foodflow_super_secret_jwt_key_2026';

export const isSuperAdminRole = (role) => {
  if (!role) return false;
  if (Array.isArray(role)) {
    return role.some((r) => isSuperAdminRole(r));
  }
  if (typeof role !== 'string') return false;
  const normalized = role.toLowerCase().trim().replace(/[-_\s]/g, '');
  return (
    normalized === 'superadmin' ||
    normalized === 'superadministrator' ||
    normalized === 'admin' ||
    normalized === 'administrator' ||
    normalized === 'platformsuperadmin' ||
    normalized === 'platformadmin' ||
    normalized === 'platformsuperadministrator' ||
    normalized === 'platformadministrator' ||
    normalized === 'sysadmin' ||
    normalized === 'systemadmin' ||
    normalized === 'root'
  );
};

export const protect = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.match(/^Bearer\s+/i)) {
      token = authHeader.replace(/^Bearer\s+/i, '').trim();
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id || decoded._id || decoded.userId;
    const user = await dbService.users.findById(userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists.',
      });
    }

    const userObj = user.toObject ? user.toObject() : { ...user };
    if (!userObj.role && decoded.role) {
      userObj.role = decoded.role;
    }
    req.user = userObj;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token: ' + err.message,
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: role '${req.user?.role}' is not authorized to access this resource.`,
      });
    }
    next();
  };
};

export const requireSuperAdmin = (req, res, next) => {
  const role = req.user?.role || req.user?.roles;
  const isSuper = isSuperAdminRole(role) || req.user?.isAdmin === true || req.user?.isSuperAdmin === true;
  if (!req.user || !isSuper) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Platform super-administrator privileges required.',
    });
  }
  next();
};

export const requireRider = (req, res, next) => {
  if (!req.user || req.user.role !== 'rider') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Delivery rider privileges required.',
    });
  }

  const riderStatus = req.user.riderStatus || 'pending';
  if (riderStatus === 'pending') {
    return res.status(403).json({
      success: false,
      isPending: true,
      message: 'Your rider application is currently under review by platform administration.',
    });
  }
  if (riderStatus === 'suspended') {
    return res.status(403).json({
      success: false,
      isSuspended: true,
      message: 'Your rider account is currently suspended. Please contact platform administration.',
    });
  }
  if (riderStatus === 'rejected') {
    return res.status(403).json({
      success: false,
      isRejected: true,
      message: 'Your rider application has been rejected by platform administration.',
    });
  }
  if (riderStatus !== 'active' && riderStatus !== 'approved') {
    return res.status(403).json({
      success: false,
      message: 'Rider account is not active.',
    });
  }

  next();
};

export const generateToken = (userId, role = null) => {
  const payload = { id: String(userId) };
  if (role) payload.role = role;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};


