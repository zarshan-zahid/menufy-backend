import bcrypt from 'bcryptjs';
import User from '../models/User.js';

export const migrateLocalDataToMongoDB = async () => {
  try {
    const adminUser = await User.findOne({
      $or: [
        { email: 'admin@menufy.com' },
        { email: 'admin@foodflow.com' },
        { role: 'superadmin' },
      ],
    });

    if (!adminUser) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);
      await User.create({
        name: 'MenuFy Super Administrator',
        email: 'admin@menufy.com',
        password: hashedPassword,
        role: 'superadmin',
        phone: '+1 (555) 000-0001',
      });
      console.log('[Database] Created Super Admin account: admin@menufy.com');
    }
  } catch (err) {
    console.warn('[Database] Admin verification notice:', err.message);
  }
};
