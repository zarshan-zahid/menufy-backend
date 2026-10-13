import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import { dbService, generateId } from '../services/dbStore.js';

dotenv.config();

/**
 * Safe standalone script to provision or reset a super-admin account.
 * Uses environment variables if set:
 * ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
 * Defaults to:
 * admin@foodflow.com / password123
 */
export async function seedAdmin() {
  console.log('[Admin Provisioning] Connecting to database...');
  await connectDB();

  const name = process.env.ADMIN_NAME || 'Platform Administrator';
  const email = (process.env.ADMIN_EMAIL || 'admin@foodflow.com').toLowerCase().trim();
  const rawPassword = process.env.ADMIN_PASSWORD || 'password123';

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(rawPassword, salt);

  const existing = await dbService.users.findOne({ email });

  if (existing) {
    console.log(`[Admin Provisioning] User '${email}' already exists. Elevating role to superadmin...`);
    await dbService.users.findByIdAndUpdate(existing._id, {
      role: 'superadmin',
      password: hashedPassword,
    });
    console.log(`✅ Super-admin account updated successfully: ${email}`);
  } else {
    const adminUser = await dbService.users.create({
      _id: generateId(),
      name,
      email,
      password: hashedPassword,
      role: 'superadmin',
      phone: '+1 (555) 000-0001',
    });
    console.log(`✅ Super-admin account created successfully: ${email} (ID: ${adminUser._id})`);
  }

  // Record audit activity
  await dbService.activities.create({
    type: 'ADMIN_PROVISIONED',
    adminEmail: email,
    message: `Super administrator account provisioned: ${email}`,
  });

  console.log(`\n======================================================`);
  console.log(`👑 Super Admin Credentials:`);
  console.log(`📧 Email:    ${email}`);
  console.log(`🔑 Password: ${rawPassword}`);
  console.log(`🌐 Role:     superadmin`);
  console.log(`======================================================\n`);
}

// Allow direct CLI execution: node seedAdmin.js
if (process.argv[1] && process.argv[1].endsWith('seedAdmin.js')) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to provision super admin:', err);
      process.exit(1);
    });
}
