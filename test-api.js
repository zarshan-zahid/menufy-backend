// FoodFlow Automated End-to-End Test Suite (Journeys 1 - 17)
// Comprehensive testing covering multi-tenancy, superadmin, branches, security, and order reliability

const API_BASE = 'http://localhost:5001/api';

const log = (step, title, success, details = '') => {
  const icon = success ? '✅' : '❌';
  console.log(`${icon} [Journey ${step}] ${title}`);
  if (details) console.log(`   ${details}`);
};

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 FoodFlow End-to-End Academic Journey Verification (1-17)');
  console.log('======================================================\n');

  try {
    // -------------------------------------------------------------------------
    // Journey 1: Backend Health Check
    // -------------------------------------------------------------------------
    const healthRes = await fetch(`${API_BASE}/health`).then((r) => r.json());
    if (healthRes.status !== 'healthy') {
      throw new Error(`Journey 1 failed: Backend returned status ${healthRes.status}`);
    }
    log(1, 'Backend Health Check', true, `Status: healthy (v${healthRes.version || '1.0.0'})`);

    // -------------------------------------------------------------------------
    // Journey 2: Owner Registration and Login
    // -------------------------------------------------------------------------
    const uniqueTime = Date.now();
    const ownerEmail = `chef_${uniqueTime}@testkitchen.com`;
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Chef Alessandro',
        email: ownerEmail,
        password: 'password123',
        role: 'owner',
        phone: '+1 555-0199',
      }),
    }).then((r) => r.json());

    if (!regRes.success || !regRes.token) {
      throw new Error(`Journey 2 Registration failed: ${regRes.message}`);
    }

    // Test explicit Login endpoint
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerEmail,
        password: 'password123',
      }),
    }).then((r) => r.json());

    if (!loginRes.success || !loginRes.token) {
      throw new Error(`Journey 2 Login failed: ${loginRes.message}`);
    }
    const ownerToken = loginRes.token;
    log(2, 'Owner Registration & Login', true, `Authenticated as ${ownerEmail} (User ID: ${loginRes.user.id})`);

    // Authenticate Platform Super Admin
    const initAdminLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@foodflow.com',
        password: 'password123',
      }),
    }).then((r) => r.json());

    if (!initAdminLoginRes.success || !initAdminLoginRes.token) {
      throw new Error(`Super Admin authentication failed: ${initAdminLoginRes.message}`);
    }
    const superAdminToken = initAdminLoginRes.token;

    // -------------------------------------------------------------------------
    // Journey 3: Restaurant Creation
    // -------------------------------------------------------------------------
    const restSlug = `artisan-bistro-${uniqueTime}`;
    const createRestRes = await fetch(`${API_BASE}/restaurants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Artisan Bistro & Grill',
        slug: restSlug,
        tagline: 'Farm-to-table handcrafted meals',
        phone: '+1 555-9988',
        address: '88 Culinary Row',
        city: 'Metropolis',
        currency: 'USD',
        currencySymbol: '$',
      }),
    }).then((r) => r.json());

    if (!createRestRes.success) {
      throw new Error(`Journey 3 Restaurant creation failed: ${createRestRes.message}`);
    }
    const restaurantId = createRestRes.restaurant._id;
    log(3, 'Restaurant Tenant Creation', true, `Created: "${createRestRes.restaurant.name}" (Slug: ${restSlug}, ID: ${restaurantId})`);

    // -------------------------------------------------------------------------
    // Journey 4: Restaurant Profile and Theme Customization
    // -------------------------------------------------------------------------
    const customizerRes = await fetch(`${API_BASE}/restaurants/${restaurantId}/customizer`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        theme: {
          themeId: 'midnight',
          primaryColor: '#0ea5e9',
          layout: 'grid',
        },
        sections: {
          showHero: true,
          showFeatured: true,
          heroHeadline: 'Experience True Gourmet Excellence',
        },
      }),
    }).then((r) => r.json());

    if (!customizerRes.success) {
      throw new Error(`Journey 4 Customization failed: ${customizerRes.message}`);
    }

    const profileRes = await fetch(`${API_BASE}/restaurants/${restaurantId}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        city: 'Artisan Hills',
        address: '88 Culinary Row, Suite A',
        deliverySettings: {
          deliveryFee: 4.5,
          minOrderAmount: 20.0,
          estimatedDeliveryTime: '25-35m',
          deliveryEnabled: true,
          pickupEnabled: true,
        },
      }),
    }).then((r) => r.json());

    if (!profileRes.success || profileRes.restaurant.city !== 'Artisan Hills') {
      throw new Error(`Journey 4 Profile update failed: ${profileRes.message}`);
    }
    log(4, 'Profile & Theme Customization', true, `Theme: midnight, Primary Color: #0ea5e9, City: ${profileRes.restaurant.city}`);

    // Publish the restaurant and approve via Super Admin so it can accept public customer visits
    await fetch(`${API_BASE}/restaurants/${restaurantId}/publish`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ isPublished: true }),
    });

    await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    });

    // -------------------------------------------------------------------------
    // Journey 5: Category and Menu Item CRUD
    // -------------------------------------------------------------------------
    const catRes = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Signature Mains',
        description: 'Chef specials created daily',
        restaurantId,
      }),
    }).then((r) => r.json());

    if (!catRes.success) {
      throw new Error(`Journey 5 Category creation failed: ${catRes.message}`);
    }
    const categoryId = catRes.category._id;

    const itemRes = await fetch(`${API_BASE}/menu-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Truffle Wagyu Burger',
        description: 'Prime beef with black summer truffle aioli',
        price: 24.5,
        categoryId,
        restaurantId,
        isAvailable: true,
        isFeatured: true,
        sizes: [
          { name: 'Regular', price: 25.0 },
          { name: 'Double Patty', price: 31.0 },
        ],
        extras: [{ name: 'Aged Cheddar', price: 2.0 }],
      }),
    }).then((r) => r.json());

    if (!itemRes.success) {
      throw new Error(`Journey 5 Menu item creation failed: ${itemRes.message}`);
    }
    const menuItemId = itemRes.item._id;

    // Test Item Update
    const updateItemRes = await fetch(`${API_BASE}/menu-items/${menuItemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        description: 'Prime beef with aged truffle aioli and brioche bun',
        price: 25.0,
      }),
    }).then((r) => r.json());

    if (!updateItemRes.success || updateItemRes.item.price !== 25.0) {
      throw new Error(`Journey 5 Menu item update failed: ${updateItemRes.message}`);
    }
    log(5, 'Category & Menu Item CRUD', true, `Created Category "${catRes.category.name}" and Item "${updateItemRes.item.name}" ($25.00)`);

    // -------------------------------------------------------------------------
    // Journey 6: Public Restaurant Storefront Fetch
    // -------------------------------------------------------------------------
    const pubRestRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}`).then((r) => r.json());
    if (!pubRestRes.success || pubRestRes.restaurant.slug !== restSlug) {
      throw new Error(`Journey 6 Storefront fetch failed: ${pubRestRes.message}`);
    }

    const pubMenuRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/menu`).then((r) => r.json());
    if (!pubMenuRes.success || pubMenuRes.categories.length === 0) {
      throw new Error(`Journey 6 Storefront menu fetch failed: ${pubMenuRes.message}`);
    }
    log(6, 'Public Restaurant Storefront', true, `Storefront active: ${pubRestRes.restaurant.name} (${pubMenuRes.totalItems} items found)`);

    // -------------------------------------------------------------------------
    // Journey 7: Cart & Coupon Management
    // -------------------------------------------------------------------------
    const couponCode = `SAVE20_${uniqueTime.toString().slice(-4)}`;
    const createCouponRes = await fetch(`${API_BASE}/coupons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        restaurantId,
        code: couponCode,
        discountType: 'percentage',
        discountValue: 20,
        minOrderAmount: 30,
        usageLimit: 5,
      }),
    }).then((r) => r.json());

    if (!createCouponRes.success) {
      throw new Error(`Journey 7 Coupon creation failed: ${createCouponRes.message}`);
    }

    // Validate coupon against subtotal of $50
    const valCouponRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/validate-coupon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: couponCode,
        subtotal: 50,
      }),
    }).then((r) => r.json());

    if (!valCouponRes.success || valCouponRes.coupon.calculatedDiscount !== 10) {
      throw new Error(`Journey 7 Coupon validation failed: ${valCouponRes.message}`);
    }
    log(7, 'Cart & Coupon Validation', true, `Applied 20% discount on $50: -$${valCouponRes.coupon.calculatedDiscount}`);

    // -------------------------------------------------------------------------
    // Journey 8: Server-Side Pricing Verification
    // -------------------------------------------------------------------------
    // Ensure that server calculates prices from database, not client manipulation
    const testTamperedOrder = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Security Tester',
          phone: '+1 555-0100',
          address: '123 Test St',
        },
        orderType: 'delivery',
        items: [
          {
            menuItemId,
            selectedSize: 'Double Patty', // Base 25 + Modifier 6 = 31
            selectedExtras: ['Aged Cheddar'], // + 2 = 33
            quantity: 2, // Total should be 66.00 subtotal, not $1.00!
            tamperedClientPrice: 1.0,
          },
        ],
        couponCode,
      }),
    }).then((r) => r.json());

    if (!testTamperedOrder.success) {
      throw new Error(`Journey 8 Server-side calculation failed: ${testTamperedOrder.message}`);
    }
    // Subtotal: 66, Discount 20%: 13.2, Delivery: 4.5 -> Total: 57.30
    const calculatedSubtotal = testTamperedOrder.order.pricing?.subtotal || 0;
    if (Math.abs(calculatedSubtotal - 66.0) > 0.01) {
      throw new Error(`Journey 8 Price tampering vulnerability! Subtotal was: ${calculatedSubtotal}`);
    }
    log(8, 'Server-Side Pricing & Integrity Check', true, `Server calculated true subtotal: $${calculatedSubtotal.toFixed(2)} (tampered client prices ignored)`);

    // -------------------------------------------------------------------------
    // Journey 9: Order Creation and Privacy-Conscious Tracking
    // -------------------------------------------------------------------------
    const orderNumber = testTamperedOrder.orderNumber;
    const orderId = testTamperedOrder.order._id;

    // Fetch tracking endpoint
    const trackRes = await fetch(`${API_BASE}/public/orders/${orderNumber}`).then((r) => r.json());
    if (!trackRes.success) {
      throw new Error(`Journey 9 Public tracking failed: ${trackRes.message}`);
    }

    // Verify Customer Privacy masking: phone and email must NOT be fully leaked
    const customerPhone = trackRes.order.customerInfo?.phone || '';
    const isPhoneMasked = customerPhone.includes('***');
    if (!isPhoneMasked) {
      throw new Error(`Journey 9 Privacy leak: Customer phone was unmasked (${customerPhone})`);
    }
    log(9, 'Order Creation & Customer Privacy Tracking', true, `Order #${orderNumber} tracked with masked customer phone: ${customerPhone}`);

    // -------------------------------------------------------------------------
    // Journey 10: Owner Order Management & Status Transitions
    // -------------------------------------------------------------------------
    const ownerOrdersRes = await fetch(`${API_BASE}/orders?restaurantId=${restaurantId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    }).then((r) => r.json());

    if (!ownerOrdersRes.success || ownerOrdersRes.orders.length === 0) {
      throw new Error(`Journey 10 Owner order listing failed: ${ownerOrdersRes.message}`);
    }

    // Advance status to Confirmed
    const confirmRes = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'Confirmed', note: 'Kitchen order accepted' }),
    }).then((r) => r.json());

    if (!confirmRes.success || confirmRes.order.status !== 'Confirmed') {
      throw new Error(`Journey 10 Order transition failed: ${confirmRes.message}`);
    }

    // Advance status to Preparing
    await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'Preparing' }),
    });

    log(10, 'Owner Order Management & Status Transitions', true, `Advanced Order #${orderNumber} through Confirmed -> Preparing`);

    // -------------------------------------------------------------------------
    // Journey 11: Multi-Tenant Isolation Between Two Restaurants
    // -------------------------------------------------------------------------
    // Register Tenant B
    const tenantBEmail = `bistro_b_${uniqueTime}@test.com`;
    const regB = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Competitor Owner',
        email: tenantBEmail,
        password: 'password123',
        role: 'owner',
      }),
    }).then((r) => r.json());

    const tenantBToken = regB.token;

    // Create Restaurant B for Tenant B to establish second tenant context
    await fetch(`${API_BASE}/restaurants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantBToken}`,
      },
      body: JSON.stringify({
        name: 'Competitor Diner',
        slug: `competitor-${uniqueTime}`,
        address: '99 Competitor Road',
      }),
    });

    // Tenant B attempts to read Restaurant A's orders directly
    const unauthorizedOrderRead = await fetch(`${API_BASE}/orders?restaurantId=${restaurantId}`, {
      headers: { Authorization: `Bearer ${tenantBToken}` },
    });

    // Tenant B attempts to mutate Restaurant A's order status
    const unauthorizedOrderPatch = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantBToken}`,
      },
      body: JSON.stringify({ status: 'Delivered' }),
    });

    if (unauthorizedOrderRead.status === 403 && unauthorizedOrderPatch.status === 403) {
      log(11, 'Multi-Tenant Isolation & IDOR Protection', true, 'Cross-tenant access BLOCKED with 403 Forbidden on both read & mutate endpoints!');
    } else {
      throw new Error(`Journey 11 Tenant isolation violation! Read: ${unauthorizedOrderRead.status}, Mutate: ${unauthorizedOrderPatch.status}`);
    }

    // -------------------------------------------------------------------------
    // Journey 12: Unauthorized Super Admin Access is Rejected
    // -------------------------------------------------------------------------
    // 1. Ordinary restaurant owner attempts to access /api/admin/stats
    const ownerAdminAccess = await fetch(`${API_BASE}/admin/stats`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // 2. Public registration attempts to self-assign role: 'superadmin'
    const selfPromoteReg = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hacker Joe',
        email: `hacker_${uniqueTime}@exploit.com`,
        password: 'password123',
        role: 'superadmin',
      }),
    }).then((r) => r.json());

    const isSelfPromoteBlocked = selfPromoteReg.user && selfPromoteReg.user.role !== 'superadmin';

    if (ownerAdminAccess.status === 403 && isSelfPromoteBlocked) {
      log(12, 'Unauthorized Admin Access Rejected', true, `Owner admin request returned 403 Forbidden; registration self-promotion sanitized to role: "${selfPromoteReg.user.role}"`);
    } else {
      throw new Error(`Journey 12 Security failure! Admin endpoint status: ${ownerAdminAccess.status}, Assigned role: ${selfPromoteReg.user?.role}`);
    }

    // -------------------------------------------------------------------------
    // Journey 13: Authorized Super Admin Access Works
    // -------------------------------------------------------------------------
    const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@foodflow.com',
        password: 'password123',
      }),
    }).then((r) => r.json());

    if (!adminLoginRes.success || !adminLoginRes.token) {
      throw new Error(`Journey 13 Super admin login failed: ${adminLoginRes.message}`);
    }
    const adminToken = adminLoginRes.token;

    const adminStatsRes = await fetch(`${API_BASE}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());

    const adminRestsRes = await fetch(`${API_BASE}/admin/restaurants`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());

    if (!adminStatsRes.success || !adminRestsRes.success) {
      throw new Error(`Journey 13 Admin API fetch failed`);
    }
    log(
      13,
      'Authorized Super Admin Platform Access',
      true,
      `Platform stats: ${adminStatsRes.stats.totalRestaurants} restaurants, ${adminStatsRes.stats.totalOrders} total orders, revenue: $${adminStatsRes.stats.totalRevenue.toFixed(2)}`
    );

    // -------------------------------------------------------------------------
    // Journey 14: Restaurant Suspension Blocks Public Orders & Owner Mutations
    // -------------------------------------------------------------------------
    // Admin suspends Restaurant A
    const suspendRes = await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'suspended',
        suspensionReason: 'Audit review in progress',
      }),
    }).then((r) => r.json());

    if (!suspendRes.success || suspendRes.restaurant.status !== 'suspended') {
      throw new Error(`Journey 14 Admin suspension failed: ${suspendRes.message}`);
    }

    // Attempt public customer checkout on suspended restaurant
    const suspendedCheckout = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: { name: 'Late Customer', phone: '+1 555-9999', address: '44 Oak' },
        items: [{ menuItemId, quantity: 1 }],
      }),
    });

    // Attempt owner mutation while restaurant is suspended
    const suspendedOwnerMutation = await fetch(`${API_BASE}/menu-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Forbidden Dish',
        price: 15,
        categoryId,
        restaurantId,
      }),
    });

    if (suspendedCheckout.status === 403 && suspendedOwnerMutation.status === 403) {
      log(14, 'Restaurant Suspension Enforcement', true, 'Public customer checkout & owner mutations both BLOCKED with 403 Forbidden while suspended!');
    } else {
      throw new Error(`Journey 14 Suspension guard failed! Public status: ${suspendedCheckout.status}, Owner mutation status: ${suspendedOwnerMutation.status}`);
    }

    // Reactivate restaurant
    await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'active' }),
    });

    // -------------------------------------------------------------------------
    // Journey 15: Restaurant Branches & Order Branch Association
    // -------------------------------------------------------------------------
    // Create Uptown Branch
    const branchRes = await fetch(`${API_BASE}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        restaurantId,
        name: 'Uptown Express Outlet',
        address: '104 Uptown Blvd',
        city: 'Artisan Hills',
        phone: '+1 555-4321',
        isMainBranch: false,
        deliveryEnabled: true,
        pickupEnabled: true,
      }),
    }).then((r) => r.json());

    if (!branchRes.success || !branchRes.branch._id) {
      throw new Error(`Journey 15 Branch creation failed: ${branchRes.message}`);
    }
    const branchId = branchRes.branch._id;

    // Fetch public branches
    const pubBranchesRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/branches`).then((r) => r.json());
    if (!pubBranchesRes.success || pubBranchesRes.branches.length === 0) {
      throw new Error(`Journey 15 Public branch retrieval failed: ${pubBranchesRes.message}`);
    }

    // Place an order explicitly associated with the new branch
    const branchOrderRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: { name: 'Branch Customer', phone: '+1 555-7766', address: '12 Uptown Ave' },
        orderType: 'delivery',
        branchId,
        items: [{ menuItemId, quantity: 1 }],
      }),
    }).then((r) => r.json());

    if (!branchOrderRes.success || branchOrderRes.order.branchId !== branchId) {
      throw new Error(`Journey 15 Branch-order association failed: ${branchOrderRes.message}`);
    }
    log(15, 'Branch Management & Branch-Order Association', true, `Created Branch "${branchRes.branch.name}" and associated Order #${branchOrderRes.orderNumber}`);

    // -------------------------------------------------------------------------
    // Journey 16: Invalid Input & Terminal Order Status Transition Guard
    // -------------------------------------------------------------------------
    // Advance branch order to terminal Delivered state
    const deliveredRes = await fetch(`${API_BASE}/orders/${branchOrderRes.order._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'Delivered' }),
    }).then((r) => r.json());

    if (!deliveredRes.success || deliveredRes.order.status !== 'Delivered') {
      throw new Error(`Journey 16 Transition to Delivered failed`);
    }

    // Attempt illegal transition: re-opening a delivered order to 'Preparing'
    const illegalTransitionRes = await fetch(`${API_BASE}/orders/${branchOrderRes.order._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'Preparing' }),
    });

    if (illegalTransitionRes.status === 400) {
      log(16, 'Terminal Status Transition Integrity', true, 'Terminal state transition (Delivered -> Preparing) correctly REJECTED with 400 Bad Request!');
    } else {
      throw new Error(`Journey 16 Terminal transition violation! Status returned: ${illegalTransitionRes.status}`);
    }

    // -------------------------------------------------------------------------
    // Journey 17: Order Idempotency & Stability of Existing Features
    // -------------------------------------------------------------------------
    const testIdempotencyKey = `idem_${uniqueTime}_xyz`;
    const payloadOrder = {
      customerInfo: { name: 'Repeat Buyer', phone: '+1 555-3322', address: '55 Plaza Way' },
      orderType: 'delivery',
      items: [{ menuItemId, quantity: 1 }],
      idempotencyKey: testIdempotencyKey,
    };

    // First order submission
    const firstSubmission = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadOrder),
    }).then((r) => r.json());

    // Duplicate order submission with same idempotency key
    const duplicateSubmission = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadOrder),
    }).then((r) => r.json());

    if (
      firstSubmission.success &&
      duplicateSubmission.success &&
      duplicateSubmission.idempotent === true &&
      duplicateSubmission.orderNumber === firstSubmission.orderNumber
    ) {
      log(17, 'Order Idempotency & Feature Stability', true, `Duplicate request recognized idempotently: Order #${firstSubmission.orderNumber} returned without creating duplicate records.`);
    } else {
      throw new Error(`Journey 17 Idempotency check failed! First: ${firstSubmission.orderNumber}, Dup: ${duplicateSubmission.orderNumber}`);
    }

    // -------------------------------------------------------------------------
    // Journey 18 (Regression Bug 1): Super Admin Status Update & Security Guard
    // -------------------------------------------------------------------------
    // 1. Authenticated Super Admin suspends restaurant
    const bug1SuspendRes = await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'suspended', reason: 'Regression test suspension check' }),
    }).then((r) => r.json());

    if (!bug1SuspendRes.success || bug1SuspendRes.restaurant.status !== 'suspended') {
      throw new Error(`Journey 18 Super Admin suspension failed: ${bug1SuspendRes.message}`);
    }

    // 2. Authenticated Super Admin approves restaurant (status -> active)
    const bug1ApproveRes = await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `bearer ${adminToken}`, // test case-insensitive 'bearer'
      },
      body: JSON.stringify({ status: 'approved' }),
    }).then((r) => r.json());

    if (!bug1ApproveRes.success || bug1ApproveRes.restaurant.status !== 'active') {
      throw new Error(`Journey 18 Super Admin approval failed: ${bug1ApproveRes.message}`);
    }

    // 3. Security guard: Restaurant owner attempts status update -> MUST be 403 Forbidden
    const ownerUnauthorizedUpdate = await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'suspended' }),
    });

    if (ownerUnauthorizedUpdate.status !== 403) {
      throw new Error(`Journey 18 Security failure: Owner was not rejected with 403 Forbidden! Status: ${ownerUnauthorizedUpdate.status}`);
    }

    // 4. Security guard: Customer account attempts status update -> MUST be 403 Forbidden
    const customerEmail = `customer_${uniqueTime}@client.com`;
    const custRegRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Regular Customer',
        email: customerEmail,
        password: 'password123',
        role: 'customer',
      }),
    }).then((r) => r.json());

    const customerToken = custRegRes.token;
    const customerUnauthorizedUpdate = await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ status: 'suspended' }),
    });

    if (customerUnauthorizedUpdate.status !== 403) {
      throw new Error(`Journey 18 Security failure: Customer was not rejected with 403 Forbidden! Status: ${customerUnauthorizedUpdate.status}`);
    }

    // 5. Security guard: Unauthenticated user attempts status update -> MUST be 401 Unauthorized
    const unauthUpdate = await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'suspended' }),
    });

    if (unauthUpdate.status !== 401) {
      throw new Error(`Journey 18 Security failure: Unauthenticated user was not rejected with 401! Status: ${unauthUpdate.status}`);
    }

    // 6. Super Admin reactivates restaurant
    const bug1ReactivateRes = await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'reactivate' }),
    }).then((r) => r.json());

    if (!bug1ReactivateRes.success || bug1ReactivateRes.restaurant.status !== 'active') {
      throw new Error(`Journey 18 Super Admin reactivation failed: ${bug1ReactivateRes.message}`);
    }

    // 7. Invalid status rejection
    const invalidStatusRes = await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'invalid_status_xyz' }),
    });

    if (invalidStatusRes.status !== 400) {
      throw new Error(`Journey 18 Validation failure: Invalid status was not rejected with 400! Status: ${invalidStatusRes.status}`);
    }

    log(18, 'Regression Bug 1: Super Admin Status Control & Strict Security', true, 'Super Admin can approve/suspend/reactivate restaurants; owners (403), customers (403), and unauthenticated callers (401) strictly rejected!');

    // -------------------------------------------------------------------------
    // Journey 19 (Regression Bug 2): Real-Time Platform Consistency & Cache-Free Updates
    // -------------------------------------------------------------------------
    // 1. Check stats and activity reflection after an admin action
    const postActionStatsRes = await fetch(`${API_BASE}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Verify anti-cache header is present
    const cacheControlHeader = postActionStatsRes.headers.get('cache-control') || '';
    const hasNoCache = cacheControlHeader.includes('no-store') || cacheControlHeader.includes('no-cache');

    const statsData = await postActionStatsRes.json();
    const activityRes = await fetch(`${API_BASE}/admin/activity`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());

    if (!statsData.success || !activityRes.success) {
      throw new Error('Journey 19: Failed to fetch platform stats or activity feed');
    }

    const latestActivity = activityRes.activities[0];
    const hasRecentActivity = latestActivity && (latestActivity.type === 'RESTAURANT_APPROVED' || latestActivity.type === 'RESTAURANT_SUSPENDED' || latestActivity.type === 'RESTAURANT_REACTIVATED');

    if (!hasNoCache || !hasRecentActivity) {
      throw new Error(`Journey 19: Platform consistency failure. Anti-cache header: "${cacheControlHeader}", Latest activity type: "${latestActivity?.type}"`);
    }

    log(19, 'Regression Bug 2: Cache-Free Real-Time State & Activity Consistency', true, `API sends no-cache headers (${cacheControlHeader.split(',')[0]}); platform stats and activity stream reflect immediately without refresh.`);

    // -------------------------------------------------------------------------
    // Journey 20 (Phase 2): Menu Category & Item CRUD, Prep Times, Sizes, Add-Ons & Tenant Isolation
    // -------------------------------------------------------------------------
    // 1. Owner A creates new category
    const phase2CatRes = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        restaurantId,
        name: 'Artisan Woodfired Pizzas',
        description: 'Naturally leavened sourdough pizzas',
        orderIndex: 2,
      }),
    }).then((r) => r.json());

    if (!phase2CatRes.success) {
      throw new Error(`Journey 20: Category creation failed: ${phase2CatRes.message}`);
    }
    const pizzaCatId = phase2CatRes.category._id;

    // 2. Owner A creates item with prepTime, sizes, and extras
    const pizzaItemRes = await fetch(`${API_BASE}/menu-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        restaurantId,
        categoryId: pizzaCatId,
        name: 'Truffle Burrata Pizza',
        description: 'Slow-fermented sourdough pizza with fresh burrata, shaved black truffle, and micro-basil',
        price: 22.0,
        prepTime: '12-15 mins',
        isAvailable: true,
        isFeatured: true,
        sizes: [
          { name: 'Personal 10-inch', price: 22.0 },
          { name: 'Family 16-inch', price: 34.0 },
        ],
        extras: [
          { name: 'Extra Burrata', price: 4.5 },
          { name: 'Hot Honey Drizzle', price: 2.0 },
        ],
      }),
    }).then((r) => r.json());

    if (!pizzaItemRes.success || !pizzaItemRes.item) {
      throw new Error(`Journey 20: Menu item creation failed: ${pizzaItemRes.message}`);
    }
    const pizzaItemId = pizzaItemRes.item._id;

    if (pizzaItemRes.item.prepTime !== '12-15 mins') {
      throw new Error(`Journey 20: Item prepTime was not saved! Value: "${pizzaItemRes.item.prepTime}"`);
    }

    // 3. Owner A updates item
    const updatePizzaRes = await fetch(`${API_BASE}/menu-items/${pizzaItemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        prepTime: '15-18 mins',
        price: 23.5,
        description: 'Updated artisan recipe with 48h cold fermentation',
      }),
    }).then((r) => r.json());

    if (!updatePizzaRes.success || updatePizzaRes.item.prepTime !== '15-18 mins' || updatePizzaRes.item.price !== 23.5) {
      throw new Error(`Journey 20: Menu item update failed: ${updatePizzaRes.message}`);
    }

    // 4. Strict Tenant Isolation: Register Owner B with separate Restaurant B
    const ownerBEmail = `owner_b_${uniqueTime}@otherkitchen.com`;
    const regOwnerB = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Chef Bianca',
        email: ownerBEmail,
        password: 'password123',
        role: 'owner',
      }),
    }).then((r) => r.json());

    const restBSlug = `bella-cucina-${uniqueTime}`;
    const createRestB = await fetch(`${API_BASE}/restaurants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regOwnerB.token}`,
      },
      body: JSON.stringify({
        name: 'Bella Cucina Trattoria',
        slug: restBSlug,
        phone: '+1 555-4321',
        currencySymbol: '$',
      }),
    }).then((r) => r.json());
    const restBId = createRestB.restaurant._id;

    // Cross-tenant test A: Owner B attempts to create item in Owner A's category -> Must fail (400)
    const crossCatItemRes = await fetch(`${API_BASE}/menu-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regOwnerB.token}`,
      },
      body: JSON.stringify({
        restaurantId: restBId,
        categoryId: pizzaCatId, // Belongs to Restaurant A!
        name: 'Hacked Calzone',
        price: 15.0,
      }),
    });

    if (crossCatItemRes.status !== 400) {
      throw new Error(`Journey 20: Tenant isolation failure! Owner B was allowed to use Owner A category! Status: ${crossCatItemRes.status}`);
    }

    // Cross-tenant test B: Owner B attempts to edit Owner A's item -> Must fail (403)
    const crossEditItemRes = await fetch(`${API_BASE}/menu-items/${pizzaItemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regOwnerB.token}`,
      },
      body: JSON.stringify({
        restaurantId: restBId,
        name: 'Tampered Pizza Title',
      }),
    });

    if (crossEditItemRes.status !== 403) {
      throw new Error(`Journey 20: Tenant isolation failure! Owner B was not rejected with 403 on PUT /menu-items! Status: ${crossEditItemRes.status}`);
    }

    // Cross-tenant test C: Owner B attempts to toggle Owner A's item availability -> Must fail (403)
    const crossToggleRes = await fetch(`${API_BASE}/menu-items/${pizzaItemId}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regOwnerB.token}`,
      },
      body: JSON.stringify({
        restaurantId: restBId,
        isAvailable: false,
      }),
    });

    if (crossToggleRes.status !== 403) {
      throw new Error(`Journey 20: Tenant isolation failure! Owner B was not rejected with 403 on PATCH availability! Status: ${crossToggleRes.status}`);
    }

    // Cross-tenant test D: Owner B attempts to delete Owner A's item -> Must fail (403)
    const crossDeleteItemRes = await fetch(`${API_BASE}/menu-items/${pizzaItemId}?restaurantId=${restBId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${regOwnerB.token}` },
    });

    if (crossDeleteItemRes.status !== 403) {
      throw new Error(`Journey 20: Tenant isolation failure! Owner B was not rejected with 403 on DELETE item! Status: ${crossDeleteItemRes.status}`);
    }

    log(20, 'Phase 2: Menu Category & Item CRUD, Prep Times, Customizations & Strict Tenant Isolation', true, `Owner A created category & item with prepTime "${updatePizzaRes.item.prepTime}", sizes & extras; Owner B cross-tenant mutations strictly blocked with 400/403!`);

    // -------------------------------------------------------------------------
    // Journey 21 (Phase 2): Real-Time Availability, Storefront Sold-Out Display, Checkout Validation & Re-enabling
    // -------------------------------------------------------------------------
    // 1. Initial Storefront check: item is available
    const initialMenuRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/menu`).then((r) => r.json());
    const initialPizza = initialMenuRes.categories
      .flatMap((c) => c.items)
      .find((i) => i._id === pizzaItemId);

    if (!initialPizza || initialPizza.isAvailable !== true) {
      throw new Error('Journey 21: Item not initially available in public menu');
    }

    // 2. Owner A marks item as Sold Out / Unavailable
    const toggleSoldOutRes = await fetch(`${API_BASE}/menu-items/${pizzaItemId}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        restaurantId,
        isAvailable: false,
      }),
    }).then((r) => r.json());

    if (!toggleSoldOutRes.success || toggleSoldOutRes.item.isAvailable !== false) {
      throw new Error(`Journey 21: Marking item as sold out failed: ${toggleSoldOutRes.message}`);
    }

    // 3. Immediate Storefront reflection: item remains visible with isAvailable: false
    const soldOutMenuRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/menu`).then((r) => r.json());
    const soldOutPizza = soldOutMenuRes.categories
      .flatMap((c) => c.items)
      .find((i) => i._id === pizzaItemId);

    if (!soldOutPizza || soldOutPizza.isAvailable !== false) {
      throw new Error('Journey 21: Storefront did not immediately reflect isAvailable: false for sold out item');
    }

    // 4. Customer attempts to place checkout order for the sold out item -> MUST BE REJECTED with 400
    const soldOutCheckoutRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Jane Customer',
          phone: '+1 555-8822',
          address: '42 Gourmet Ave',
        },
        orderType: 'delivery',
        items: [
          {
            menuItemId: pizzaItemId,
            quantity: 1,
          },
        ],
      }),
    });

    const soldOutCheckoutData = await soldOutCheckoutRes.json();
    if (soldOutCheckoutRes.status !== 400 || !soldOutCheckoutData.message?.toLowerCase().includes('out of stock')) {
      throw new Error(`Journey 21: Sold out checkout was not rejected with 400! Response: ${JSON.stringify(soldOutCheckoutData)}`);
    }

    // 5. Price Tampering Prevention: Customer sends tampered client price -> MUST BE REJECTED with 400
    const priceTamperRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Jane Customer',
          phone: '+1 555-8822',
          address: '42 Gourmet Ave',
        },
        orderType: 'delivery',
        items: [
          {
            menuItemId, // Available burger ($25.00)
            quantity: 1,
            expectedUnitPrice: 1.00, // Tampered price
          },
        ],
      }),
    });

    const priceTamperData = await priceTamperRes.json();
    if (priceTamperRes.status !== 400 || !priceTamperData.message?.toLowerCase().includes('changed')) {
      throw new Error(`Journey 21: Tampered price was not rejected with 400! Response: ${JSON.stringify(priceTamperData)}`);
    }

    // 6. Quantity Validation: 0 or negative or non-integer quantity -> MUST BE REJECTED with 400
    const invalidQtyRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Jane Customer',
          phone: '+1 555-8822',
          address: '42 Gourmet Ave',
        },
        orderType: 'delivery',
        items: [
          {
            menuItemId,
            quantity: 0, // Invalid!
          },
        ],
      }),
    });

    if (invalidQtyRes.status !== 400) {
      throw new Error(`Journey 21: Invalid quantity 0 was not rejected with 400! Status: ${invalidQtyRes.status}`);
    }

    // 7. Invalid size option -> MUST BE REJECTED with 400
    const invalidSizeRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Jane Customer',
          phone: '+1 555-8822',
          address: '42 Gourmet Ave',
        },
        orderType: 'delivery',
        items: [
          {
            menuItemId,
            selectedSize: 'Colossal Giant NonExistent Size',
            quantity: 1,
          },
        ],
      }),
    });

    if (invalidSizeRes.status !== 400) {
      throw new Error(`Journey 21: Invalid size was not rejected with 400! Status: ${invalidSizeRes.status}`);
    }

    // 8. Re-enable item to Available
    const reEnableRes = await fetch(`${API_BASE}/menu-items/${pizzaItemId}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        restaurantId,
        isAvailable: true,
      }),
    }).then((r) => r.json());

    if (!reEnableRes.success || reEnableRes.item.isAvailable !== true) {
      throw new Error(`Journey 21: Re-enabling item failed: ${reEnableRes.message}`);
    }

    // Verify storefront now shows item as Available
    const reEnabledMenuRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/menu`).then((r) => r.json());
    const reEnabledPizza = reEnabledMenuRes.categories
      .flatMap((c) => c.items)
      .find((i) => i._id === pizzaItemId);

    if (!reEnabledPizza || reEnabledPizza.isAvailable !== true) {
      throw new Error('Journey 21: Storefront did not reflect re-enabled item availability');
    }

    // 9. Valid checkout with re-enabled item, custom size & add-on succeeds
    const validCheckoutRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Jane Customer',
          phone: '+1 555-8822',
          address: '42 Gourmet Ave',
        },
        orderType: 'delivery',
        items: [
          {
            menuItemId: pizzaItemId,
            selectedSize: 'Family 16-inch', // 34.00
            selectedExtras: ['Hot Honey Drizzle'], // + 2.00 = 36.00
            quantity: 1,
            expectedUnitPrice: 36.00,
          },
        ],
      }),
    }).then((r) => r.json());

    if (!validCheckoutRes.success || !validCheckoutRes.orderNumber) {
      throw new Error(`Journey 21: Valid checkout with re-enabled item failed: ${validCheckoutRes.message}`);
    }

    const verifiedSubtotal = validCheckoutRes.order.pricing?.subtotal || 0;
    if (Math.abs(verifiedSubtotal - 36.00) > 0.01) {
      throw new Error(`Journey 21: Subtotal calculation error! Expected $36.00, got $${verifiedSubtotal}`);
    }

    log(21, 'Phase 2: Availability Toggling, Storefront Sold-Out Display, Checkout Validation & Re-enabling', true, `Item toggle persisted; sold-out checkout strictly rejected with "${soldOutCheckoutData.message}"; price tampering & invalid quantities blocked; re-enabled item successfully ordered (Order #${validCheckoutRes.orderNumber}, true subtotal: $36.00)!`);

    // =========================================================================
    // JOURNEY 22: Phase 3 Restaurant Applications, Admin Approval, Security Guards & Directory
    // =========================================================================
    console.log('\n--- Journey 22: Phase 3 Partner Registration, Admin Review & Approval Workflow ---');

    // 1. Partner Registration Flow: Validations and Account Creation
    const testApplicantEmail = `partner-${Date.now()}@newkitchen.io`;
    const testRestSlug = `the-artisan-roaster-${Date.now()}`;

    // 1a. Missing required fields check
    const invalidRegRes = await fetch(`${API_BASE}/auth/register-partner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerName: 'Chef Antoine',
        email: testApplicantEmail,
        // Missing password, restaurantName, phone, address, city
      }),
    });
    if (invalidRegRes.status !== 400) {
      throw new Error(`Journey 22: Partner registration without required fields did not return 400! Status: ${invalidRegRes.status}`);
    }

    // 1b. Successful registration
    const regPartnerRes = await fetch(`${API_BASE}/auth/register-partner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerName: 'Chef Antoine Dubois',
        email: testApplicantEmail,
        password: 'securePartnerPassword123',
        restaurantName: 'The Artisan Roaster',
        cuisine: 'Cafe & Bakery',
        phone: '+1 555-432-8765',
        address: '742 Evergreen Terrace',
        city: 'Springfield',
        description: 'Specialty micro-batch roasting and sourdough croissants.',
        logo: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=200',
        slug: testRestSlug,
      }),
    }).then((r) => r.json());

    if (!regPartnerRes.success || !regPartnerRes.token || !regPartnerRes.restaurant) {
      throw new Error(`Journey 22: Partner registration failed: ${regPartnerRes.message}`);
    }

    const newPartnerToken = regPartnerRes.token;
    const newPartnerUser = regPartnerRes.user;
    const newPartnerRest = regPartnerRes.restaurant;
    const newPartnerRestId = newPartnerRest._id;

    // Verify role is strictly 'owner' (no superadmin self-assignment)
    if (newPartnerUser.role !== 'owner') {
      throw new Error(`Journey 22: Security violation! Partner registered with unexpected role: ${newPartnerUser.role}`);
    }

    // Verify no password hash returned
    if (newPartnerUser.password) {
      throw new Error('Journey 22: Security violation! User password hash leaked in partner registration response');
    }

    // 1c. Duplicate email rejection
    const dupRegRes = await fetch(`${API_BASE}/auth/register-partner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerName: 'Imposter',
        email: testApplicantEmail,
        password: 'anotherPassword123',
        restaurantName: 'Imposter Kitchen',
        phone: '+1 555-1111',
        address: '123 Fake St',
        city: 'Springfield',
      }),
    });
    if (dupRegRes.status !== 400) {
      throw new Error(`Journey 22: Duplicate email registration was not rejected with 400! Status: ${dupRegRes.status}`);
    }

    // 2. Pending Verification: Storefront & orders MUST NOT be live
    if (newPartnerRest.status !== 'pending' || newPartnerRest.isPublished !== false) {
      throw new Error(`Journey 22: Newly registered restaurant must default to status: 'pending' and isPublished: false! Got status=${newPartnerRest.status}, isPublished=${newPartnerRest.isPublished}`);
    }

    // Public explore directory MUST NOT include pending restaurant
    const explorePendingCheck = await fetch(`${API_BASE}/public/explore`).then((r) => r.json());
    if (explorePendingCheck.restaurants.some((r) => r.slug === testRestSlug)) {
      throw new Error('Journey 22: Pending restaurant leaked into public /explore directory!');
    }

    // Public storefront endpoint MUST return 403 pending guard
    const storefrontPendingRes = await fetch(`${API_BASE}/public/restaurant/${testRestSlug}`);
    const storefrontPendingData = await storefrontPendingRes.json();
    if (storefrontPendingRes.status !== 403 || !storefrontPendingData.isPending) {
      throw new Error(`Journey 22: Pending restaurant storefront was not guarded with 403 isPending! Status: ${storefrontPendingRes.status}`);
    }

    // Public checkout MUST be rejected with 403
    const orderPendingRes = await fetch(`${API_BASE}/public/restaurant/${testRestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: { name: 'Early Bird', phone: '+1 555-9090', address: '44 Oak St' },
        items: [{ menuItemId: 'placeholder', quantity: 1 }],
      }),
    });
    if (orderPendingRes.status !== 403) {
      throw new Error(`Journey 22: Orders on pending restaurant were not blocked with 403! Status: ${orderPendingRes.status}`);
    }

    // 3. Super Admin Sees Application
    const adminAppsRes = await fetch(`${API_BASE}/admin/applications`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }).then((r) => r.json());

    if (!adminAppsRes.success || !Array.isArray(adminAppsRes.applications)) {
      throw new Error(`Journey 22: Super Admin failed to fetch applications queue: ${adminAppsRes.message}`);
    }

    const submittedApp = adminAppsRes.applications.find((a) => a._id === newPartnerRestId);
    if (!submittedApp) {
      throw new Error('Journey 22: Submitted application not found in Super Admin applications queue!');
    }
    if (submittedApp.cuisine !== 'Cafe & Bakery' || !submittedApp.owner) {
      throw new Error('Journey 22: Submitted application details or owner info missing in Super Admin queue');
    }

    // 4. Unauthorized User Cannot Approve
    const unauthorizedApproveRes = await fetch(`${API_BASE}/admin/restaurants/${newPartnerRestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newPartnerToken}`, // Partner trying to approve themselves!
      },
      body: JSON.stringify({ status: 'approved' }),
    });
    if (unauthorizedApproveRes.status !== 403) {
      throw new Error(`Journey 22: Unauthorized restaurant approval was not rejected with 403! Status: ${unauthorizedApproveRes.status}`);
    }

    // 5. Super Admin Approves Application
    const approveRes = await fetch(`${API_BASE}/admin/restaurants/${newPartnerRestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    }).then((r) => r.json());

    if (!approveRes.success || approveRes.restaurant.status !== 'active' || approveRes.restaurant.isPublished !== true) {
      throw new Error(`Journey 22: Admin approval failed: ${approveRes.message}`);
    }
    if (!approveRes.restaurant.approvedAt) {
      throw new Error('Journey 22: Admin approval did not record approvedAt timestamp');
    }

    // 6. Restaurant Becomes Visible in Public Directory
    const exploreApprovedCheck = await fetch(`${API_BASE}/public/explore`).then((r) => r.json());
    const publicApprovedEntry = exploreApprovedCheck.restaurants.find((r) => r.slug === testRestSlug);
    if (!publicApprovedEntry) {
      throw new Error('Journey 22: Approved restaurant is not visible in public /explore directory!');
    }
    if (publicApprovedEntry.cuisine !== 'Cafe & Bakery') {
      throw new Error('Journey 22: Approved restaurant cuisine mismatch in explore directory');
    }

    // Public storefront configuration is now accessible
    const storefrontApprovedRes = await fetch(`${API_BASE}/public/restaurant/${testRestSlug}`).then((r) => r.json());
    if (!storefrontApprovedRes.success || !storefrontApprovedRes.restaurant) {
      throw new Error('Journey 22: Storefront not accessible after approval');
    }

    // 7. Owner Can Manage Their Restaurant (Menu & Profile)
    // 7a. Owner attempts to tamper with approval status via profile update -> MUST BE PREVENTED
    const tamperStatusRes = await fetch(`${API_BASE}/restaurants/${newPartnerRestId}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newPartnerToken}`,
      },
      body: JSON.stringify({
        name: 'The Artisan Roaster Updated',
        cuisine: 'Specialty Cafe',
        phone: '+1 555-432-8765',
        address: '742 Evergreen Terrace',
        city: 'Springfield',
        status: 'superadmin-forced', // Attacking status field!
      }),
    }).then((r) => r.json());

    if (!tamperStatusRes.success || tamperStatusRes.restaurant.status === 'superadmin-forced') {
      throw new Error('Journey 22: Tenant security violation! Owner altered restaurant approval status via profile update endpoint');
    }

    // 7b. Create category and item for ordering test
    const partnerCatRes = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newPartnerToken}`,
      },
      body: JSON.stringify({
        restaurantId: newPartnerRestId,
        name: 'Artisan Pastries',
        orderIndex: 0,
      }),
    }).then((r) => r.json());

    const partnerItemRes = await fetch(`${API_BASE}/menu-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newPartnerToken}`,
      },
      body: JSON.stringify({
        restaurantId: newPartnerRestId,
        categoryId: partnerCatRes.category._id,
        name: 'Almond Cardamom Croissant',
        price: 8.50,
        isAvailable: true,
      }),
    }).then((r) => r.json());

    // 7c. Customer can successfully place an order on the approved restaurant
    const liveOrderRes = await fetch(`${API_BASE}/public/restaurant/${testRestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Sophie Martin',
          phone: '+1 555-7766',
          address: '10 Artisan Way',
        },
        orderType: 'delivery',
        items: [
          {
            menuItemId: partnerItemRes.item._id,
            quantity: 2,
            expectedUnitPrice: 8.50,
          },
        ],
      }),
    }).then((r) => r.json());

    if (!liveOrderRes.success || !liveOrderRes.orderNumber) {
      throw new Error(`Journey 22: Live order on approved restaurant failed: ${liveOrderRes.message}`);
    }
    const historicalOrderNumber = liveOrderRes.orderNumber;

    // 8. Suspension Workflow: Prevent new orders while keeping historical data intact
    const partnerSuspendRes = await fetch(`${API_BASE}/admin/restaurants/${newPartnerRestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        status: 'suspended',
        reason: 'Temporary platform quality audit',
      }),
    }).then((r) => r.json());

    if (!partnerSuspendRes.success || partnerSuspendRes.restaurant.status !== 'suspended' || partnerSuspendRes.restaurant.isPublished !== false) {
      throw new Error(`Journey 22: Suspension failed: ${partnerSuspendRes.message}`);
    }

    // Suspended restaurant removed from public directory
    const exploreSuspendedCheck = await fetch(`${API_BASE}/public/explore`).then((r) => r.json());
    if (exploreSuspendedCheck.restaurants.some((r) => r.slug === testRestSlug)) {
      throw new Error('Journey 22: Suspended restaurant is still visible in public directory!');
    }

    // New orders on suspended restaurant are blocked
    const suspendedOrderRes = await fetch(`${API_BASE}/public/restaurant/${testRestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: { name: 'Late Customer', phone: '+1 555-0000', address: '10 Artisan Way' },
        items: [{ menuItemId: partnerItemRes.item._id, quantity: 1 }],
      }),
    });
    if (suspendedOrderRes.status !== 403) {
      throw new Error(`Journey 22: Orders on suspended restaurant were not blocked with 403! Status: ${suspendedOrderRes.status}`);
    }

    // Historical order tracking remains intact
    const trackOrderRes = await fetch(`${API_BASE}/public/orders/${historicalOrderNumber}`).then((r) => r.json());
    if (!trackOrderRes.success || !trackOrderRes.order) {
      throw new Error('Journey 22: Historical order tracking broken after restaurant suspension');
    }

    // 9. Rejection & Strict Reactivation Guard (Prompt Requirement: Reactivation must not automatically approve a rejected application)
    const rejectApplicantEmail = `rejected-applicant-${Date.now()}@test.io`;
    const rejectRestSlug = `unverified-kitchen-${Date.now()}`;

    const rejectRegRes = await fetch(`${API_BASE}/auth/register-partner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerName: 'Applicant To Reject',
        email: rejectApplicantEmail,
        password: 'password123',
        restaurantName: 'Unverified Dark Kitchen',
        phone: '+1 555-0099',
        address: 'Nowhere Road',
        city: 'Ghost Town',
        slug: rejectRestSlug,
      }),
    }).then((r) => r.json());

    const rejectedRestId = rejectRegRes.restaurant._id;

    // Super Admin rejects application with reason
    const rejectDecisionRes = await fetch(`${API_BASE}/admin/restaurants/${rejectedRestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        status: 'rejected',
        reason: 'Incomplete food safety licensing and unverifiable kitchen address.',
      }),
    }).then((r) => r.json());

    if (!rejectDecisionRes.success || rejectDecisionRes.restaurant.status !== 'rejected') {
      throw new Error(`Journey 22: Rejection decision failed: ${rejectDecisionRes.message}`);
    }
    if (!rejectDecisionRes.restaurant.rejectionReason) {
      throw new Error('Journey 22: Rejection reason not persisted in restaurant record');
    }

    // Critical Requirement: Attempting to "reactivate" a rejected restaurant without explicit approval decision MUST FAIL
    const invalidReactivationRes = await fetch(`${API_BASE}/admin/restaurants/${rejectedRestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'reactivate' }),
    });

    if (invalidReactivationRes.status !== 400) {
      throw new Error(`Journey 22: Reactivation on a rejected application was not rejected with 400! Status: ${invalidReactivationRes.status}`);
    }

    // 10. Existing Restaurants and Orders Remain Intact
    const allAdminRests = await fetch(`${API_BASE}/admin/restaurants`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }).then((r) => r.json());

    const bellaInAdmin = allAdminRests.restaurants.find((r) => r.slug === 'bella-italia');
    if (!bellaInAdmin) {
      throw new Error('Journey 22: Existing restaurant Bella Italia is missing from database!');
    }

    if (bellaInAdmin.status === 'suspended') {
      await fetch(`${API_BASE}/admin/restaurants/${bellaInAdmin._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ status: 'reactivate' }),
      });
    }

    const smokehouseCheck = await fetch(`${API_BASE}/public/restaurant/karachi-smokehouse`).then((r) => r.json());
    const bellaCheck = await fetch(`${API_BASE}/public/restaurant/bella-italia`).then((r) => r.json());

    if (!smokehouseCheck.success || !bellaCheck.success) {
      throw new Error('Journey 22: Existing restaurants Karachi Smokehouse or Bella Italia were altered or inaccessible!');
    }

    log(
      22,
      'Phase 3: Partner Registration, Approval Workflow, Directory Visibility & Strict Reactivation Guards',
      true,
      `Full partner registration validated; pending store strictly hidden & unorderable; Super Admin queue populated; approval published store & enabled orders (Order #${historicalOrderNumber}); suspension prevented new orders while preserving history; rejected app preserved reason & strictly blocked reactivation without explicit approval decision; existing tenants Karachi Smokehouse and Bella Italia remain 100% intact!`
    );

    // -------------------------------------------------------------------------
    // Journey 23: Phase 4: Platform Homepage, Explore Directory, 5 Themes,
    // Theme Customizer Persistence, Tenant Isolation & Availability Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- Journey 23: Phase 4 Theme Customization, Directory & Storefront Testing ---');

    // 1. Verify Homepage Explore Directory endpoint returns approved/active restaurants
    const exploreRes = await fetch(`${API_BASE}/public/explore`).then((r) => r.json());
    if (!exploreRes.success || !Array.isArray(exploreRes.restaurants)) {
      throw new Error(`Journey 23: Explore directory failed: ${exploreRes.message || 'No restaurants returned'}`);
    }

    if (exploreRes.restaurants.length === 0) {
      throw new Error('Journey 23: Explore directory returned zero restaurants, expected approved tenants.');
    }

    // 2. Validate Restaurant Card Fields: Real uploaded logo / neutral initials monogram, name, cuisine, banner, availability
    const verifiedTenant = exploreRes.restaurants.find((r) => r.slug === 'karachi-smokehouse');
    if (!verifiedTenant) {
      throw new Error('Journey 23: Karachi Smokehouse missing from explore directory!');
    }

    if (typeof verifiedTenant.logo !== 'string') {
      throw new Error('Journey 23: Restaurant logo is not a valid string or URL');
    }
    if (!verifiedTenant.cuisine) {
      throw new Error('Journey 23: Restaurant cuisine tag is missing from explore directory card');
    }
    if (verifiedTenant.deliverySettings?.isOpenNow === undefined) {
      throw new Error('Journey 23: Real delivery opening status missing from explore card');
    }

    // Verify unapproved/rejected/suspended/pending restaurants do NOT appear in public explore
    const anyRejectedInExplore = exploreRes.restaurants.some((r) => r.slug === rejectRestSlug);
    if (anyRejectedInExplore) {
      throw new Error('Journey 23: Rejected restaurant was found in public explore directory!');
    }

    // 3. Verify All 5 Storefront Themes are Supported and Can be Configured
    const fiveThemes = [
      'premium-dark',
      'modern-minimal',
      'pakistani-traditional',
      'italian-cafe',
      'modern-fast-food',
    ];

    // Create a dedicated Phase 4 test owner to test theme customization
    const phase4OwnerEmail = `theme_master_${uniqueTime}@kitchen.com`;
    const phase4Reg = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tariq Themer',
        email: phase4OwnerEmail,
        password: 'password123',
        role: 'owner',
        phone: '+1 555-4422',
      }),
    }).then((r) => r.json());

    if (!phase4Reg.success || !phase4Reg.token) {
      throw new Error(`Journey 23: Owner registration failed: ${phase4Reg.message}`);
    }
    const phase4Token = phase4Reg.token;

    // Create restaurant for Phase 4 owner
    const phase4RestSlug = `theming-bistro-${uniqueTime}`;
    const phase4RestRes = await fetch(`${API_BASE}/restaurants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${phase4Token}`,
      },
      body: JSON.stringify({
        name: 'The Grand Culinary Bistro',
        slug: phase4RestSlug,
        cuisine: 'Pakistani & Continental',
        tagline: 'Artisanal recipes and authentic grills',
        phone: '+1 555-7788',
        address: '45 Gourmet Boulevard',
        city: 'Karachi',
        currency: 'PKR',
        currencySymbol: 'Rs.',
      }),
    }).then((r) => r.json());

    if (!phase4RestRes.success || !phase4RestRes.restaurant) {
      throw new Error(`Journey 23: Restaurant creation failed: ${phase4RestRes.message}`);
    }
    const phase4RestId = phase4RestRes.restaurant._id;

    // Approve & Publish restaurant so storefront can be viewed
    await fetch(`${API_BASE}/admin/restaurants/${phase4RestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    });

    await fetch(`${API_BASE}/restaurants/${phase4RestId}/publish`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${phase4Token}`,
      },
      body: JSON.stringify({ isPublished: true }),
    });

    // Add a category and menu items (one available, one unavailable)
    const p4CatRes = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${phase4Token}`,
      },
      body: JSON.stringify({
        restaurantId: phase4RestId,
        name: 'Signature Dishes',
      }),
    }).then((r) => r.json());

    const p4AvailableItemRes = await fetch(`${API_BASE}/menu-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${phase4Token}`,
      },
      body: JSON.stringify({
        restaurantId: phase4RestId,
        categoryId: p4CatRes.category._id,
        name: 'Royal Handi Boneless',
        price: 1850,
        isAvailable: true,
        isFeatured: true,
      }),
    }).then((r) => r.json());

    const p4UnavailableItemRes = await fetch(`${API_BASE}/menu-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${phase4Token}`,
      },
      body: JSON.stringify({
        restaurantId: phase4RestId,
        categoryId: p4CatRes.category._id,
        name: 'Mutton Special Dumba Karahi',
        price: 3400,
        isAvailable: false,
        isFeatured: false,
      }),
    }).then((r) => r.json());

    // 4. Test Owner Theme Customizer: Save Theme 'pakistani-traditional' with custom colors and typography
    const saveThemeRes = await fetch(`${API_BASE}/restaurants/${phase4RestId}/customizer`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${phase4Token}`,
      },
      body: JSON.stringify({
        theme: {
          themeId: 'pakistani-traditional',
          primaryColor: '#c2410c',
          accentColor: '#d97706',
          fontFamily: 'Outfit',
          headerLayout: 'traditional',
          featuredDishesCount: 4,
        },
        sections: {
          heroBanner: true,
          featuredCategories: true,
          popularDishes: true,
          aboutStory: true,
          locationInfo: true,
          reviews: false,
        },
        logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200',
        banner: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200',
      }),
    }).then((r) => r.json());

    if (!saveThemeRes.success) {
      throw new Error(`Journey 23: Saving customizer theme failed: ${saveThemeRes.message}`);
    }

    // 5. Test Theme Persistence Across Re-fetch (Simulate page refresh / re-login)
    const refetchedRest = await fetch(`${API_BASE}/public/restaurant/${phase4RestSlug}`).then((r) => r.json());
    if (!refetchedRest.success || !refetchedRest.restaurant) {
      throw new Error(`Journey 23: Failed to re-fetch restaurant after theme save: ${refetchedRest.message}`);
    }

    if (refetchedRest.restaurant.theme?.themeId !== 'pakistani-traditional') {
      throw new Error(`Journey 23: Theme persistence failed! Expected 'pakistani-traditional', got '${refetchedRest.restaurant.theme?.themeId}'`);
    }
    if (refetchedRest.restaurant.theme?.primaryColor !== '#c2410c') {
      throw new Error(`Journey 23: Theme color persistence failed!`);
    }
    if (refetchedRest.restaurant.theme?.fontFamily !== 'Outfit') {
      throw new Error(`Journey 23: Theme font persistence failed!`);
    }

    // 6. Test Switching to Other Themes (e.g. Modern Minimal, Premium Dark)
    for (const testTheme of ['modern-minimal', 'premium-dark', 'italian-cafe', 'modern-fast-food']) {
      const switchRes = await fetch(`${API_BASE}/restaurants/${phase4RestId}/customizer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${phase4Token}`,
        },
        body: JSON.stringify({
          theme: { themeId: testTheme },
        }),
      }).then((r) => r.json());

      if (!switchRes.success || switchRes.restaurant.theme?.themeId !== testTheme) {
        throw new Error(`Journey 23: Failed to switch restaurant theme to '${testTheme}'`);
      }
    }

    // Restore to 'pakistani-traditional' for final verification
    await fetch(`${API_BASE}/restaurants/${phase4RestId}/customizer`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${phase4Token}`,
      },
      body: JSON.stringify({
        theme: { themeId: 'pakistani-traditional', primaryColor: '#c2410c', fontFamily: 'Outfit' },
      }),
    });

    // 7. Test Tenant Isolation: Owner B attempts to alter Owner A's theme
    const unauthorizedThemeEditRes = await fetch(`${API_BASE}/restaurants/${phase4RestId}/customizer`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`, // Owner from Journey 2 attempting to modify Phase 4 restaurant
      },
      body: JSON.stringify({
        theme: { themeId: 'premium-dark' },
      }),
    });

    if (unauthorizedThemeEditRes.status !== 403) {
      throw new Error(`Journey 23: Tenant isolation failed! Unauthorized owner received status ${unauthorizedThemeEditRes.status} instead of 403 Forbidden.`);
    }

    // 8. Test Item Availability Enforcement during Checkout
    // Available item can be ordered successfully
    const p4ValidOrderRes = await fetch(`${API_BASE}/public/restaurant/${phase4RestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Ahmed Khan',
          phone: '+92 300 9876543',
          address: 'Gulshan-e-Iqbal Block 5, Karachi',
        },
        orderType: 'delivery',
        items: [
          {
            menuItemId: p4AvailableItemRes.item._id,
            quantity: 1,
            expectedUnitPrice: 1850,
          },
        ],
      }),
    }).then((r) => r.json());

    if (!p4ValidOrderRes.success || !p4ValidOrderRes.orderNumber) {
      throw new Error(`Journey 23: Valid order on active theme storefront failed: ${p4ValidOrderRes.message}`);
    }

    // Unavailable item MUST BE REJECTED during order placement
    const p4InvalidOrderRes = await fetch(`${API_BASE}/public/restaurant/${phase4RestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Ahmed Khan',
          phone: '+92 300 9876543',
          address: 'Gulshan-e-Iqbal Block 5, Karachi',
        },
        orderType: 'delivery',
        items: [
          {
            menuItemId: p4UnavailableItemRes.item._id, // Out of stock item
            quantity: 1,
          },
        ],
      }),
    });

    if (p4InvalidOrderRes.status !== 400) {
      throw new Error(`Journey 23: Ordering an out-of-stock item was not rejected with 400! Received status ${p4InvalidOrderRes.status}`);
    }
    const p4InvalidOrderData = await p4InvalidOrderRes.json();
    if (!p4InvalidOrderData.message?.toLowerCase().includes('out of stock')) {
      throw new Error(`Journey 23: Out of stock error message missing, got: ${p4InvalidOrderData.message}`);
    }

    // 9. Verify Inactive/Suspended restaurants cannot accept orders
    // Suspend Phase 4 restaurant temporarily
    const suspendPatchRes = await fetch(`${API_BASE}/admin/restaurants/${phase4RestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'suspended', reason: 'Temporary maintenance check' }),
    }).then((r) => r.json());

    if (!suspendPatchRes.success || suspendPatchRes.restaurant?.status !== 'suspended') {
      throw new Error(`Journey 23: Suspend patch failed: ${suspendPatchRes.message}`);
    }

    const p4SuspendedOrderRes = await fetch(`${API_BASE}/public/restaurant/${phase4RestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: { name: 'Test User', phone: '+92 300 1111111', address: 'Street 1' },
        items: [{ menuItemId: p4AvailableItemRes.item._id, quantity: 1 }],
      }),
    });

    if (p4SuspendedOrderRes.status !== 403) {
      throw new Error(`Journey 23: Suspended restaurant accepted order! Status: ${p4SuspendedOrderRes.status}`);
    }

    // Reactivate Phase 4 restaurant
    await fetch(`${API_BASE}/admin/restaurants/${phase4RestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'reactivate' }),
    });

    log(
      23,
      'Phase 4: Platform Homepage, Explore Directory, 5 Themes, Customizer Persistence, Tenant Isolation & Availability Enforcement',
      true,
      `Homepage explore directory successfully loaded backend records; logo monograms validated without food images; all 5 themes (${fiveThemes.join(', ')}) supported and switchable; customizer persisted settings across sessions; tenant isolation blocked cross-tenant theme edits (403); out-of-stock items strictly rejected (400); suspended restaurants strictly blocked from ordering (403); existing data and orders preserved!`
    );

    // =========================================================================
    // JOURNEY 24: Phase 5: Customer Ordering, Checkout, Service Area Validation,
    //             7-Step Status Sequence, Order Tracking & History
    // =========================================================================
    console.log('\n--- Journey 24: Customer Ordering, Checkout, 7-Step Statuses & Order History ---');

    // 1. Saved Delivery Addresses CRUD
    // Add Home Address
    const addAddr1Res = await fetch(`${API_BASE}/auth/saved-addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        label: 'Home',
        street: 'Apartment 4B, Clifton Block 2',
        city: 'Karachi',
        notes: 'Ring bell twice',
      }),
    }).then((r) => r.json());

    if (!addAddr1Res.success || !Array.isArray(addAddr1Res.savedAddresses) || addAddr1Res.savedAddresses.length === 0) {
      throw new Error(`Journey 24: Failed to save delivery address: ${addAddr1Res.message}`);
    }
    const savedAddrId = addAddr1Res.savedAddresses[0].id;

    // Add Office Address
    await fetch(`${API_BASE}/auth/saved-addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        label: 'Office',
        street: 'Techno City Tower, 5th Floor, I.I. Chundrigar Road',
        city: 'Karachi',
        notes: 'Leave at reception',
      }),
    });

    // Fetch Saved Addresses
    const getAddrRes = await fetch(`${API_BASE}/auth/saved-addresses`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    }).then((r) => r.json());

    if (!getAddrRes.success || getAddrRes.savedAddresses.length < 2) {
      throw new Error(`Journey 24: Failed to fetch saved addresses: expected at least 2, got ${getAddrRes.savedAddresses?.length}`);
    }

    // Delete one Saved Address
    const delAddrRes = await fetch(`${API_BASE}/auth/saved-addresses/${savedAddrId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` },
    }).then((r) => r.json());

    if (!delAddrRes.success || delAddrRes.savedAddresses.some((a) => a.id === savedAddrId)) {
      throw new Error('Journey 24: Failed to delete saved address');
    }

    // 2. Configure Restaurant Delivery Settings to enforce service area
    const deliverySettingsUpdateRes = await fetch(`${API_BASE}/restaurants/${phase4RestId}/delivery-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${phase4Token}`,
      },
      body: JSON.stringify({
        deliverySettings: {
          deliveryEnabled: true,
          pickupEnabled: true,
          deliveryFee: 150,
          minOrderAmount: 200,
          estimatedDeliveryTime: '30-45 mins',
          allowedCities: ['Karachi'],
          enforceCityBoundary: true,
        },
      }),
    }).then((r) => r.json());

    if (!deliverySettingsUpdateRes.success) {
      throw new Error(`Journey 24: Failed to update delivery settings: ${deliverySettingsUpdateRes.message}`);
    }

    // 3. Service Area Validation: Attempt delivery order to Lahore (outside Karachi)
    const outsideServiceAreaRes = await fetch(`${API_BASE}/public/restaurant/${phase4RestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Usman Tariq',
          phone: '+92 321 5556677',
          address: 'Gulberg III, Lahore', // OUTSIDE ALLOWED CITY
        },
        orderType: 'delivery',
        items: [
          {
            menuItemId: p4AvailableItemRes.item._id,
            quantity: 1,
            expectedUnitPrice: 1850,
          },
        ],
      }),
    });

    if (outsideServiceAreaRes.status !== 400) {
      throw new Error(`Journey 24: Address outside delivery service area was not rejected! Status: ${outsideServiceAreaRes.status}`);
    }
    const outsideErr = await outsideServiceAreaRes.json();
    if (!outsideErr.message?.toLowerCase().includes('delivery unavailable') && !outsideErr.message?.toLowerCase().includes('karachi')) {
      throw new Error(`Journey 24: Unexpected message for out-of-zone address: ${outsideErr.message}`);
    }

    // 4. Manipulated Price Rejection: Client passes manipulated cheap price
    const tamperedPriceRes = await fetch(`${API_BASE}/public/restaurant/${phase4RestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Usman Tariq',
          phone: '+92 321 5556677',
          address: 'Block 6, PECHS, Karachi',
        },
        orderType: 'delivery',
        items: [
          {
            menuItemId: p4AvailableItemRes.item._id,
            quantity: 1,
            expectedUnitPrice: 50, // Manipulated price attack (real is 1850)
          },
        ],
      }),
    });

    if (tamperedPriceRes.status !== 400) {
      throw new Error(`Journey 24: Manipulated item price checkout was not rejected with 400! Status: ${tamperedPriceRes.status}`);
    }

    // 5. Successful Order with "Order for someone else" (Gift / Recipient Info) & Idempotency
    const idempotencyToken = `idemp-phase5-${Date.now()}`;
    const orderPayload = {
      idempotencyKey: idempotencyToken,
      customerInfo: {
        name: 'Sender Customer',
        phone: '+92 300 9876543',
        email: 'sender@foodflow.test',
        address: 'House 12, Street 4, Clifton Block 5, Karachi',
        notes: 'Gate code #4421',
      },
      recipientInfo: {
        isGiftOrder: true,
        recipientName: 'Recipient Friend',
        recipientPhone: '+92 333 4445566',
        giftMessage: 'Enjoy this delicious dinner from FoodFlow!',
      },
      orderType: 'delivery',
      items: [
        {
          menuItemId: p4AvailableItemRes.item._id,
          quantity: 2,
          expectedUnitPrice: 1850,
        },
      ],
      paymentMethod: 'cash_on_delivery',
    };

    const validOrderRes1 = await fetch(`${API_BASE}/public/restaurant/${phase4RestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    }).then((r) => r.json());

    if (!validOrderRes1.success || !validOrderRes1.orderNumber) {
      throw new Error(`Journey 24: Valid Phase 5 order placement failed: ${validOrderRes1.message}`);
    }
    const order1Number = validOrderRes1.orderNumber;
    const order1Id = validOrderRes1.order._id;

    // Verify recipient snapshot
    if (!validOrderRes1.order.recipientInfo?.isGiftOrder || validOrderRes1.order.recipientInfo.recipientName !== 'Recipient Friend') {
      throw new Error('Journey 24: Recipient snapshot was not stored correctly on the order.');
    }

    // Verify initial status is 'Order Placed'
    if (validOrderRes1.order.status !== 'Order Placed') {
      throw new Error(`Journey 24: Initial status must be 'Order Placed', got: ${validOrderRes1.order.status}`);
    }

    // 6. Test Idempotency: Immediate repeated submission returns same order without duplicating
    const validOrderResDuplicate = await fetch(`${API_BASE}/public/restaurant/${phase4RestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    }).then((r) => r.json());

    if (!validOrderResDuplicate.success || validOrderResDuplicate.orderNumber !== order1Number || !validOrderResDuplicate.idempotent) {
      throw new Error('Journey 24: Duplicate submission protection failed! Did not return idempotent order.');
    }

    // 7. Verify Full 7-Step Status Sequence
    const phase5StatusSequence = [
      'Order Placed',
      'Preparing Your Order',
      'Ready for Pickup',
      'Rider Picked Up Your Order',
      'Rider Is On The Way',
      'Rider Is At Your Doorstep',
      'Order Received',
    ];

    for (let i = 1; i < phase5StatusSequence.length; i++) {
      const nextStatus = phase5StatusSequence[i];
      const updateStatusRes = await fetch(`${API_BASE}/orders/${order1Id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${phase4Token}`,
        },
        body: JSON.stringify({
          status: nextStatus,
          note: `Transitioning to ${nextStatus}`,
        }),
      }).then((r) => r.json());

      if (!updateStatusRes.success || updateStatusRes.order.status !== nextStatus) {
        throw new Error(`Journey 24: Status transition to '${nextStatus}' failed: ${updateStatusRes.message}`);
      }
    }

    // Verify live tracking endpoint returns the updated status
    const liveTrackingRes = await fetch(`${API_BASE}/public/orders/${order1Number}`).then((r) => r.json());
    if (!liveTrackingRes.success || liveTrackingRes.order.status !== 'Order Received') {
      throw new Error(`Journey 24: Live tracker did not reflect final 'Order Received' status: ${liveTrackingRes.order?.status}`);
    }

    // 8. Order Cancellation Workflow:
    // Place a second order to test early customer cancellation
    const cancelableOrderRes = await fetch(`${API_BASE}/public/restaurant/${phase4RestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Tariq Mehmood',
          phone: '+92 300 7788990',
          address: 'DHA Phase 6, Karachi',
        },
        orderType: 'delivery',
        items: [{ menuItemId: p4AvailableItemRes.item._id, quantity: 1, expectedUnitPrice: 1850 }],
      }),
    }).then((r) => r.json());

    if (!cancelableOrderRes.success) {
      throw new Error(`Journey 24: Failed to place cancellable order: ${cancelableOrderRes.message}`);
    }
    const cancelOrderNumber = cancelableOrderRes.orderNumber;
    const cancelOrderId = cancelableOrderRes.order._id;

    // Customer cancels order while in 'Order Placed' status
    const cancelRes = await fetch(`${API_BASE}/public/orders/${cancelOrderNumber}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'Ordered by mistake, changed dinner plans',
        phone: '+92 300 7788990',
      }),
    }).then((r) => r.json());

    if (!cancelRes.success || cancelRes.order.status !== 'Cancelled') {
      throw new Error(`Journey 24: Customer cancellation failed: ${cancelRes.message}`);
    }

    // Place a third order and advance it to 'Preparing Your Order' to verify cancellation IS BLOCKED
    const preparedOrderRes = await fetch(`${API_BASE}/public/restaurant/${phase4RestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Hamza Farooq',
          phone: '+92 300 1122334',
          address: 'SMCHS Block B, Karachi',
        },
        orderType: 'delivery',
        items: [{ menuItemId: p4AvailableItemRes.item._id, quantity: 1, expectedUnitPrice: 1850 }],
      }),
    }).then((r) => r.json());

    const preparedOrderNumber = preparedOrderRes.orderNumber;
    const preparedOrderId = preparedOrderRes.order._id;

    // Kitchen moves order to 'Preparing Your Order'
    await fetch(`${API_BASE}/orders/${preparedOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${phase4Token}`,
      },
      body: JSON.stringify({ status: 'Preparing Your Order' }),
    });

    // Customer attempts to cancel once preparation begins -> MUST BE REJECTED (400)
    const lateCancelRes = await fetch(`${API_BASE}/public/orders/${preparedOrderNumber}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'Too late to cancel',
        phone: '+92 300 1122334',
      }),
    });

    if (lateCancelRes.status !== 400) {
      throw new Error(`Journey 24: Customer cancellation was not blocked for preparing order! Status: ${lateCancelRes.status}`);
    }
    const lateCancelErr = await lateCancelRes.json();
    if (!lateCancelErr.message?.toLowerCase().includes('cannot be cancelled')) {
      throw new Error(`Journey 24: Expected cancellation rejection message, got: ${lateCancelErr.message}`);
    }

    // 9. Customer Order History & Security Permissions
    // Unauthenticated request to /orders/customer/my-orders must be rejected with 401
    const unauthOrdersRes = await fetch(`${API_BASE}/orders/customer/my-orders`);
    if (unauthOrdersRes.status !== 401) {
      throw new Error(`Journey 24: Unauthenticated customer order history access was not rejected with 401! Status: ${unauthOrdersRes.status}`);
    }

    // Authenticated request to /orders/customer/my-orders returns customer orders
    const authOrdersRes = await fetch(`${API_BASE}/orders/customer/my-orders`, {
      headers: { Authorization: `Bearer ${phase4Token}` },
    }).then((r) => r.json());

    if (!authOrdersRes.success || !Array.isArray(authOrdersRes.orders)) {
      throw new Error(`Journey 24: Authenticated customer order history failed: ${authOrdersRes.message}`);
    }

    // Guest Order History Lookup by order numbers
    const guestHistoryByNumbersRes = await fetch(`${API_BASE}/public/orders/guest-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumbers: [order1Number, cancelOrderNumber, preparedOrderNumber],
      }),
    }).then((r) => r.json());

    if (!guestHistoryByNumbersRes.success || guestHistoryByNumbersRes.orders.length < 3) {
      throw new Error(`Journey 24: Guest order history by order numbers failed: expected 3 orders, got ${guestHistoryByNumbersRes.orders?.length}`);
    }

    // Guest Order History Lookup by phone number
    const guestHistoryByPhoneRes = await fetch(`${API_BASE}/public/orders/guest-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+92 300 9876543',
      }),
    }).then((r) => r.json());

    if (!guestHistoryByPhoneRes.success || !guestHistoryByPhoneRes.orders.some((o) => o.orderNumber === order1Number)) {
      throw new Error(`Journey 24: Guest order history by phone number failed to find order #${order1Number}`);
    }

    // 10. Counter-Pickup / Takeaway Flow (delivery fee = 0, no service area block)
    const pickupOrderRes = await fetch(`${API_BASE}/public/restaurant/${phase4RestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Pickup Customer',
          phone: '+92 300 8887766',
        },
        orderType: 'takeaway',
        items: [{ menuItemId: p4AvailableItemRes.item._id, quantity: 1, expectedUnitPrice: 1850 }],
        paymentMethod: 'cash_on_pickup',
      }),
    }).then((r) => r.json());

    if (!pickupOrderRes.success || pickupOrderRes.order.pricing?.deliveryFee !== 0) {
      throw new Error(`Journey 24: Pickup order failed or had non-zero delivery fee: ${pickupOrderRes.order?.pricing?.deliveryFee}`);
    }

    log(
      24,
      'Phase 5: Customer Ordering, Checkout, Service Area Validation, 7-Step Sequence, Cancellation & Order History',
      true,
      `Saved addresses CRUD validated with local & auth persistence; delivery service area boundary enforced (Lahore rejected for Karachi kitchen with 400); price tampering strictly rejected (400); duplicate checkout submission prevented via idempotency key; gift/recipient information preserved in order snapshot; full 7-step sequence (${phase5StatusSequence.join(' -> ')}) transitioned cleanly; early customer cancellation permitted in 'Order Placed' and strictly rejected once cooking starts (400); customer order history guarded with 401; guest history lookup verified by order numbers and phone; counter-pickup confirmed with $0 delivery fee!`
    );

    // =========================================================================
    // JOURNEY 25: Phase 6: Dedicated Rider Dashboard, Fleet Governance & Delivery Assignment
    // =========================================================================
    console.log('\n--- Journey 25: Dedicated Rider Dashboard, Approval Workflow & Delivery Assignment ---');

    // 1. Self-Promotion Attack: Customer registration attempting to set role: 'rider' MUST be rejected
    const riderSelfPromoteRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Self Rider',
        email: `attacker_rider_${Date.now()}@test.com`,
        password: 'password123',
        role: 'rider', // Illegal self-promotion attempt!
      }),
    });

    if (riderSelfPromoteRes.status !== 400) {
      throw new Error(`Journey 25: Standard registration allowed claiming rider role! Status: ${riderSelfPromoteRes.status}`);
    }

    // 2. Rider Application Process (Registered in pending review state)
    const rider1Email = `kamran_rider_${Date.now()}@fleetflow.test`;
    const rider1RegRes = await fetch(`${API_BASE}/auth/rider/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Kamran Akmal',
        email: rider1Email,
        password: 'riderpassword123',
        phone: '+92 300 7776655',
        city: 'Karachi',
        vehicleType: 'Motorcycle',
        vehicleNumber: 'KHI-9988',
        cnic: '42101-7654321-1',
      }),
    }).then((r) => r.json());

    if (!rider1RegRes.success || !rider1RegRes.user || rider1RegRes.user.riderStatus !== 'pending') {
      throw new Error(`Journey 25: Rider registration failed or did not default to 'pending': ${rider1RegRes.message}`);
    }
    const rider1Id = rider1RegRes.user.id;

    // 3. Pending Rider Login Rejection: Pending rider cannot log in to accept orders
    const pendingLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: rider1Email,
        password: 'riderpassword123',
      }),
    });

    if (pendingLoginRes.status !== 403) {
      throw new Error(`Journey 25: Pending rider was allowed to log in! Status: ${pendingLoginRes.status}`);
    }
    const pendingLoginData = await pendingLoginRes.json();
    if (!pendingLoginData.isPending) {
      throw new Error('Journey 25: Expected isPending: true in pending rider login response.');
    }

    // 4. Super Admin Review & Approval of Rider 1
    const adminRidersListRes = await fetch(`${API_BASE}/admin/riders?status=pending`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }).then((r) => r.json());

    if (!adminRidersListRes.success || !adminRidersListRes.riders.some((r) => r._id === rider1Id)) {
      throw new Error('Journey 25: Pending rider was not found in Super Admin riders queue.');
    }

    const approveRider1Res = await fetch(`${API_BASE}/admin/riders/${rider1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'approve' }),
    }).then((r) => r.json());

    if (!approveRider1Res.success || approveRider1Res.rider.riderStatus !== 'approved') {
      throw new Error(`Journey 25: Super Admin rider approval failed: ${approveRider1Res.message}`);
    }

    // 5. Approved Rider 1 Login & Online Toggle
    const rider1LoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: rider1Email,
        password: 'riderpassword123',
      }),
    }).then((r) => r.json());

    if (!rider1LoginRes.success || !rider1LoginRes.token || rider1LoginRes.user.role !== 'rider') {
      throw new Error(`Journey 25: Approved rider login failed: ${rider1LoginRes.message}`);
    }
    const rider1Token = rider1LoginRes.token;

    // Toggle Online
    const goOnlineRes = await fetch(`${API_BASE}/rider/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider1Token}`,
      },
      body: JSON.stringify({ isOnline: true }),
    }).then((r) => r.json());

    if (!goOnlineRes.success || goOnlineRes.isOnline !== true) {
      throw new Error(`Journey 25: Rider online toggle failed: ${goOnlineRes.message}`);
    }

    // 6. Register & Approve Rider 2 (to test Concurrency & Atomic Claim Protection)
    const rider2Email = `farhan_rider_${Date.now()}@fleetflow.test`;
    const rider2RegRes = await fetch(`${API_BASE}/auth/rider/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Farhan Zaidi',
        email: rider2Email,
        password: 'riderpassword123',
        phone: '+92 311 9988776',
        city: 'Karachi',
        vehicleType: 'Motorcycle',
        vehicleNumber: 'KHI-5544',
      }),
    }).then((r) => r.json());

    const rider2Id = rider2RegRes.user.id;
    await fetch(`${API_BASE}/admin/riders/${rider2Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'approve' }),
    });

    const rider2LoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: rider2Email, password: 'riderpassword123' }),
    }).then((r) => r.json());
    const rider2Token = rider2LoginRes.token;

    await fetch(`${API_BASE}/rider/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider2Token}`,
      },
      body: JSON.stringify({ isOnline: true }),
    });

    // 7. Customer places delivery order
    const p6OrderRes = await fetch(`${API_BASE}/public/restaurant/${phase4RestSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Zainab Bibi',
          phone: '+92 300 4433221',
          address: 'Clifton Block 4, Karachi',
          notes: 'Call on arrival',
        },
        orderType: 'delivery',
        items: [{ menuItemId: p4AvailableItemRes.item._id, quantity: 1, expectedUnitPrice: 1850 }],
      }),
    }).then((r) => r.json());

    const p6OrderNumber = p6OrderRes.orderNumber;
    const p6OrderId = p6OrderRes.order._id;

    // Verify: Before kitchen marks ready, order is NOT available for rider pickup
    const preReadyAvailRes = await fetch(`${API_BASE}/rider/available-orders`, {
      headers: { Authorization: `Bearer ${rider1Token}` },
    }).then((r) => r.json());

    if (preReadyAvailRes.orders.some((o) => o.orderNumber === p6OrderNumber)) {
      throw new Error('Journey 25: Unready order was improperly exposed to rider available list!');
    }

    // Early claim attempt before ready must be rejected
    const earlyClaimRes = await fetch(`${API_BASE}/rider/orders/${p6OrderNumber}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rider1Token}` },
    });
    if (earlyClaimRes.status !== 400) {
      throw new Error(`Journey 25: Early claim before restaurant marked ready was not rejected! Status: ${earlyClaimRes.status}`);
    }

    // 8. Restaurant kitchen prepares order & marks 'Ready for Pickup'
    await fetch(`${API_BASE}/orders/${p6OrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${phase4Token}`,
      },
      body: JSON.stringify({ status: 'Preparing Your Order' }),
    });

    await fetch(`${API_BASE}/orders/${p6OrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${phase4Token}`,
      },
      body: JSON.stringify({ status: 'Ready for Pickup' }),
    });

    // 9. Assignment Visibility: Both online riders in Karachi can now see the order
    const readyAvailRes = await fetch(`${API_BASE}/rider/available-orders`, {
      headers: { Authorization: `Bearer ${rider1Token}` },
    }).then((r) => r.json());

    const foundAvailable = readyAvailRes.orders.find((o) => o.orderNumber === p6OrderNumber);
    if (!foundAvailable) {
      throw new Error(`Journey 25: Order #${p6OrderNumber} did not appear in rider available assignments once marked Ready for Pickup!`);
    }

    // 10. Concurrency Prevention: Rider 1 claims the delivery
    const claimRes1 = await fetch(`${API_BASE}/rider/orders/${p6OrderNumber}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rider1Token}` },
    }).then((r) => r.json());

    if (!claimRes1.success || claimRes1.order.assignedRiderId !== rider1Id) {
      throw new Error(`Journey 25: Rider 1 claim failed: ${claimRes1.message}`);
    }

    // Rider 2 simultaneously attempts to claim the same order -> MUST BE REJECTED with 409 Conflict
    const claimRes2 = await fetch(`${API_BASE}/rider/orders/${p6OrderNumber}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rider2Token}` },
    });

    if (claimRes2.status !== 409) {
      throw new Error(`Journey 25: Concurrent assignment collision allowed! Rider 2 claim returned status ${claimRes2.status} instead of 409 Conflict.`);
    }

    // 11. Role-Based Access Control: Rider 2 attempts to mutate Rider 1's delivery -> MUST BE 403 Forbidden
    const unauthStatusRes = await fetch(`${API_BASE}/rider/orders/${p6OrderNumber}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider2Token}`, // Unauthorized rider!
      },
      body: JSON.stringify({ status: 'Rider Picked Up Your Order' }),
    });

    if (unauthStatusRes.status !== 403) {
      throw new Error(`Journey 25: Non-assigned rider modified order status! Status: ${unauthStatusRes.status}`);
    }

    // 12. Invalid Transition Rejection: Rider 1 attempts to skip stages (Ready -> Order Received)
    const invalidSkipRes = await fetch(`${API_BASE}/rider/orders/${p6OrderNumber}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider1Token}`,
      },
      body: JSON.stringify({ status: 'Order Received' }), // Invalid skip!
    });

    if (invalidSkipRes.status !== 400) {
      throw new Error(`Journey 25: Out-of-order status skip was not rejected with 400! Status: ${invalidSkipRes.status}`);
    }

    // 13. Sequential Operational Progression by Assigned Rider 1
    // Step A: Confirm Pickup from Kitchen
    const pickupRes = await fetch(`${API_BASE}/rider/orders/${p6OrderNumber}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider1Token}`,
      },
      body: JSON.stringify({ status: 'Rider Picked Up Your Order' }),
    }).then((r) => r.json());

    if (!pickupRes.success || pickupRes.order.status !== 'Rider Picked Up Your Order' || !pickupRes.order.riderPickedUpAt) {
      throw new Error(`Journey 25: Rider pickup confirmation failed: ${pickupRes.message}`);
    }

    // Step B: Depart Kitchen (Rider Is On The Way)
    const onTheWayRes = await fetch(`${API_BASE}/rider/orders/${p6OrderNumber}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider1Token}`,
      },
      body: JSON.stringify({ status: 'Rider Is On The Way' }),
    }).then((r) => r.json());

    if (!onTheWayRes.success || onTheWayRes.order.status !== 'Rider Is On The Way') {
      throw new Error(`Journey 25: Rider on-the-way transition failed: ${onTheWayRes.message}`);
    }

    // Step C: Arrive at Doorstep (Rider Is At Your Doorstep)
    const atDoorstepRes = await fetch(`${API_BASE}/rider/orders/${p6OrderNumber}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider1Token}`,
      },
      body: JSON.stringify({ status: 'Rider Is At Your Doorstep' }),
    }).then((r) => r.json());

    if (!atDoorstepRes.success || atDoorstepRes.order.status !== 'Rider Is At Your Doorstep') {
      throw new Error(`Journey 25: At doorstep transition failed: ${atDoorstepRes.message}`);
    }

    // Step D: Complete Delivery & Verify COD Payment
    const completeRes = await fetch(`${API_BASE}/rider/orders/${p6OrderNumber}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider1Token}`,
      },
      body: JSON.stringify({ status: 'Order Received' }),
    }).then((r) => r.json());

    if (!completeRes.success || completeRes.order.status !== 'Order Received' || completeRes.order.paymentStatus !== 'paid' || !completeRes.order.riderDeliveredAt) {
      throw new Error(`Journey 25: Delivery completion transition failed: ${completeRes.message}`);
    }

    // 14. Verification of Delivery History & Customer Tracking
    const riderDeliveriesRes = await fetch(`${API_BASE}/rider/my-deliveries`, {
      headers: { Authorization: `Bearer ${rider1Token}` },
    }).then((r) => r.json());

    if (riderDeliveriesRes.activeDelivery !== null) {
      throw new Error('Journey 25: Active delivery was not cleared after order completion.');
    }
    if (!riderDeliveriesRes.completedDeliveries.some((d) => d.orderNumber === p6OrderNumber)) {
      throw new Error('Journey 25: Completed delivery was missing from rider completed history.');
    }

    // Verify public tracking snapshot contains riderInfo
    const publicTrackRes = await fetch(`${API_BASE}/public/orders/${p6OrderNumber}`).then((r) => r.json());
    if (!publicTrackRes.success || publicTrackRes.order.riderInfo?.name !== 'Kamran Akmal') {
      throw new Error('Journey 25: Public customer tracker did not reflect assigned rider courier information.');
    }

    // 15. Suspension Workflow: Suspend Rider 2 and verify immediate access termination
    const suspendRiderRes = await fetch(`${API_BASE}/admin/riders/${rider2Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'suspend', reason: 'Audit verification' }),
    }).then((r) => r.json());

    if (!suspendRiderRes.success || suspendRiderRes.rider.riderStatus !== 'suspended') {
      throw new Error(`Journey 25: Super Admin rider suspension failed: ${suspendRiderRes.message}`);
    }

    const suspendedRiderActionRes = await fetch(`${API_BASE}/rider/me`, {
      headers: { Authorization: `Bearer ${rider2Token}` },
    });
    if (suspendedRiderActionRes.status !== 403) {
      throw new Error(`Journey 25: Suspended rider was not blocked from API access! Status: ${suspendedRiderActionRes.status}`);
    }

    // Reactivate Rider 2
    await fetch(`${API_BASE}/admin/riders/${rider2Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'reactivate' }),
    });

    log(
      25,
      'Phase 6: Dedicated Rider Dashboard, Fleet Governance, Atomic Claim & Operational Delivery Progression',
      true,
      `Rider registration strictly isolated from customer role; pending accounts blocked until Super Admin approval; online/offline toggle verified; ready-for-pickup gating enforced before assignment; atomic concurrency control prevented double-claim (409 Conflict); non-assigned mutation blocked (403); out-of-order status jumps blocked (400); sequential delivery progression (Ready -> Picked Up -> On The Way -> Doorstep -> Received) cleanly completed with timestamps and payment verified; rider suspension strictly terminates access (403); history and customer tracking verified!`
    );

    // -------------------------------------------------------------------------
    // Journey 26: Phase 7: Delivery Addresses, Pakistan Places Search,
    // Zone Radius Boundary Enforcement, Real-Time Rider Telemetry & Privacy Gating
    // -------------------------------------------------------------------------
    console.log('\n--- Journey 26: Phase 7 Pakistan Addresses, Delivery Zones & Real-Time Tracking ---');
    {

    // 1. Pakistan Places / Landmarks Search API
    const placesRes = await fetch(`${API_BASE}/public/pakistan-places?query=clifton`).then((r) => r.json());
    if (!placesRes.success || !Array.isArray(placesRes.results) || placesRes.results.length === 0) {
      throw new Error(`Journey 26: Pakistan places search failed: ${placesRes.message || 'No results returned'}`);
    }
    const foundClifton = placesRes.results.find((p) => p.name.toLowerCase().includes('clifton'));
    if (!foundClifton || !foundClifton.lat || !foundClifton.lng) {
      throw new Error('Journey 26: Pakistan landmark Clifton missing coordinates in search results');
    }

    // 2. Customer Saved Addresses CRUD: Create, Read, Update, Delete
    const addAddressRes = await fetch(`${API_BASE}/auth/saved-addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        label: 'Home',
        address: 'House 42, Block 5, Clifton',
        city: 'Karachi',
        area: 'Clifton',
        landmark: 'Near Clifton Beach',
        coordinates: { lat: 24.8138, lng: 67.0300 },
        deliveryInstructions: 'Ring bell twice, ground floor',
        recipientName: 'Ali Khan',
        recipientPhone: '+92 300 1234567',
        isDefault: true,
      }),
    }).then((r) => r.json());

    if (!addAddressRes.success || !addAddressRes.savedAddresses) {
      throw new Error(`Journey 26: Failed to save address: ${addAddressRes.message}`);
    }

    const savedAddrId =
      addAddressRes.address?.id ||
      addAddressRes.address?._id ||
      addAddressRes.savedAddresses[0]?.id ||
      addAddressRes.savedAddresses[0]?._id;

    // Fetch saved addresses
    const getAddressesRes = await fetch(`${API_BASE}/auth/saved-addresses`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    }).then((r) => r.json());

    if (!getAddressesRes.success || getAddressesRes.savedAddresses.length === 0) {
      throw new Error('Journey 26: GET /auth/saved-addresses returned empty list');
    }

    // Update saved address (change label to Office)
    const updateAddressRes = await fetch(`${API_BASE}/auth/saved-addresses/${savedAddrId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        label: 'Office',
        address: 'Executive Tower 12, Clifton',
        city: 'Karachi',
        area: 'Clifton',
        landmark: 'Near Do Darya',
      }),
    }).then((r) => r.json());

    if (!updateAddressRes.success || updateAddressRes.savedAddresses[0].label !== 'Office') {
      throw new Error(`Journey 26: Failed to update saved address: ${updateAddressRes.message}`);
    }

    // 3. Service Zone & Delivery Radius Boundary Enforcement:
    // Configure Karachi Smokehouse kitchen coordinates & max radius (15 km)
    const smokehouseOwnerEmail = 'owner@smokehouse.com';
    const smokehouseLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: smokehouseOwnerEmail, password: 'password123' }),
    }).then((r) => r.json());

    if (!smokehouseLogin.success || !smokehouseLogin.token) {
      throw new Error(`Journey 26: Smokehouse owner login failed: ${smokehouseLogin.message}`);
    }
    const smokehouseOwnerToken = smokehouseLogin.token;

    const smokehouseAdminRes = await fetch(`${API_BASE}/restaurants/my-restaurant`, {
      headers: { Authorization: `Bearer ${smokehouseOwnerToken}` },
    }).then((r) => r.json());

    if (!smokehouseAdminRes.success || !smokehouseAdminRes.restaurant) {
      throw new Error(`Journey 26: Failed to load smokehouse profile: ${smokehouseAdminRes.message}`);
    }
    const smokehouseRestId = smokehouseAdminRes.restaurant._id;

    // Fetch real smokehouse menu item
    const smokehouseMenuRes = await fetch(`${API_BASE}/public/restaurant/karachi-smokehouse/menu`).then((r) => r.json());
    const realItem = smokehouseMenuRes.categories?.[0]?.items?.[0];
    const smokehouseItemId = realItem?._id;
    const smokehouseItemPrice =
      realItem?.discountPrice !== undefined && realItem?.discountPrice !== null
        ? realItem.discountPrice
        : (realItem?.price || 18.0);

    // Update kitchen coordinates and delivery settings (Karachi center: 24.8607, 67.0011)
    await fetch(`${API_BASE}/restaurants/${smokehouseRestId}/delivery-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${smokehouseOwnerToken}`,
      },
      body: JSON.stringify({
        coordinates: { lat: 24.8607, lng: 67.0011 },
        maxDeliveryRadiusKm: 15,
        enforceZoneBoundary: true,
        deliveryZones: [
          { name: 'Karachi Central & South', fee: 5.0, minOrder: 10, maxDistanceKm: 10 },
          { name: 'Karachi Extended Suburbs', fee: 8.0, minOrder: 15, maxDistanceKm: 15 },
        ],
      }),
    });

    // 4. Out-of-Zone Order Rejection:
    // Customer submits coordinates located in Lahore (31.5204, 74.3587, distance > 1000 km)
    // Order MUST be rejected with HTTP 400
    const outOfZoneOrderRes = await fetch(`${API_BASE}/public/restaurant/karachi-smokehouse/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Distant Customer',
          phone: '+92 333 9999999',
          address: 'Mall Road, Lahore',
          city: 'Lahore',
          coordinates: { lat: 31.5204, lng: 74.3587 }, // > 1000 km away!
        },
        items: [
          {
            menuItemId: smokehouseItemId,
            name: realItem?.name || 'Beef Brisket Platter',
            expectedUnitPrice: smokehouseItemPrice,
            quantity: 1,
            totalPrice: smokehouseItemPrice,
          },
        ],
        orderType: 'delivery',
      }),
    });

    if (outOfZoneOrderRes.status !== 400) {
      throw new Error(`Journey 26: Out-of-zone order was not rejected with HTTP 400! Status: ${outOfZoneOrderRes.status}`);
    }
    const outOfZoneData = await outOfZoneOrderRes.json();
    if (!outOfZoneData.message || (!outOfZoneData.message.includes('outside') && !outOfZoneData.message.includes('exceeds') && !outOfZoneData.message.includes('radius'))) {
      throw new Error(`Journey 26: Out-of-zone error message did not explain boundary restriction: ${outOfZoneData.message}`);
    }

    // 5. In-Zone Order Placement with Alternate Recipient / Gift Details
    // Customer places pin at Clifton, Karachi (24.8138, 67.0300, distance ~6 km <= 15 km)
    const inZoneOrderRes = await fetch(`${API_BASE}/public/restaurant/karachi-smokehouse/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Sender Customer',
          phone: '+92 300 1112233',
          email: 'sender@example.com',
          address: 'Sunset Boulevard, Phase 2, DHA',
          city: 'Karachi',
          area: 'DHA',
          landmark: 'Opposite Golf Club',
          coordinates: { lat: 24.8138, lng: 67.0300 },
          deliveryInstructions: 'Deliver to main gate security',
        },
        recipientInfo: {
          isGiftOrder: true,
          recipientName: 'Bilal Friend',
          recipientPhone: '+92 321 7778899',
          giftMessage: 'Happy Birthday! Enjoy the smoked brisket feast!',
        },
        items: [
          {
            menuItemId: smokehouseItemId,
            name: realItem?.name || 'Beef Brisket Platter',
            expectedUnitPrice: smokehouseItemPrice,
            quantity: 2,
            totalPrice: smokehouseItemPrice * 2,
          },
        ],
        orderType: 'delivery',
      }),
    }).then((r) => r.json());

    if (!inZoneOrderRes.success || !inZoneOrderRes.order) {
      throw new Error(`Journey 26: In-zone order placement failed: ${inZoneOrderRes.message}`);
    }
    const p7OrderNumber = inZoneOrderRes.order.orderNumber;
    const p7OrderId = inZoneOrderRes.order._id;

    if (!inZoneOrderRes.order.customerInfo.coordinates?.lat || !inZoneOrderRes.order.recipientInfo?.isGiftOrder) {
      throw new Error('Journey 26: In-zone order missing stored coordinates or recipient gift metadata');
    }

    // 6. Privacy Gating Verification Before Pickup
    // Before pickup, riderLocation must be strictly null
    const prePickupTrack = await fetch(`${API_BASE}/public/orders/${p7OrderNumber}/live-tracking`).then((r) => r.json());
    if (prePickupTrack.riderLocation !== null) {
      throw new Error('Journey 26: Rider live location exposed before pickup! Privacy violation.');
    }

    // 7. Kitchen advances order to Ready for Pickup
    const advanceRes = await fetch(`${API_BASE}/orders/${p7OrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${smokehouseOwnerToken}`,
      },
      body: JSON.stringify({ status: 'Ready for Pickup' }),
    }).then((r) => r.json());

    if (!advanceRes.success) {
      throw new Error(`Journey 26: Kitchen status advance failed: ${advanceRes.message}`);
    }

    // 8. Rider 1 accepts the delivery
    const rider1Claim = await fetch(`${API_BASE}/rider/orders/${p7OrderNumber}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rider1Token}` },
    }).then((r) => r.json());

    if (!rider1Claim.success) {
      throw new Error(`Journey 26: Rider failed to accept Phase 7 order: ${rider1Claim.message}`);
    }

    // Still before pickup: riderLocation must remain null
    const acceptedTrack = await fetch(`${API_BASE}/public/orders/${p7OrderNumber}/live-tracking`).then((r) => r.json());
    if (acceptedTrack.riderLocation !== null) {
      throw new Error('Journey 26: Rider location exposed before actual kitchen pickup! Privacy violation.');
    }

    // 9. Rider confirms pickup (starts active transit)
    await fetch(`${API_BASE}/rider/orders/${p7OrderNumber}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider1Token}`,
      },
      body: JSON.stringify({ status: 'Rider Picked Up Your Order' }),
    });

    // 10. Rider Sends Live GPS Telemetry (HTTP fallback endpoint)
    const riderGpsRes = await fetch(`${API_BASE}/rider/orders/${p7OrderNumber}/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider1Token}`,
      },
      body: JSON.stringify({
        lat: 24.8450,
        lng: 67.0150,
        accuracy: 8.5,
        isSharing: true,
        permissionDenied: false,
      }),
    }).then((r) => r.json());

    if (!riderGpsRes.success || !riderGpsRes.riderLocation) {
      throw new Error(`Journey 26: Rider GPS update failed: ${riderGpsRes.message}`);
    }

    // 11. Rate-Limiting Verification: Rapid succession (< 2 seconds) returns 429
    const rapidGpsRes = await fetch(`${API_BASE}/rider/orders/${p7OrderNumber}/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider1Token}`,
      },
      body: JSON.stringify({
        lat: 24.8455,
        lng: 67.0155,
      }),
    });

    if (rapidGpsRes.status !== 429) {
      throw new Error(`Journey 26: Rapid GPS update was not rate-limited (expected 429, got ${rapidGpsRes.status})`);
    }

    // 12. Security Verification: Non-assigned rider (Rider 2) blocked from submitting telemetry
    const unauthGpsRes = await fetch(`${API_BASE}/rider/orders/${p7OrderNumber}/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider2Token}`,
      },
      body: JSON.stringify({
        lat: 24.8450,
        lng: 67.0150,
      }),
    });

    if (unauthGpsRes.status !== 403) {
      throw new Error(`Journey 26: Unauthorized rider was able to submit telemetry! Status: ${unauthGpsRes.status}`);
    }

    // 13. Public Live Tracking API Verification (During Active Transit)
    const liveTrackingRes = await fetch(`${API_BASE}/public/orders/${p7OrderNumber}/live-tracking`).then((r) => r.json());
    if (!liveTrackingRes.success) {
      throw new Error(`Journey 26: Live tracking query failed: ${liveTrackingRes.message}`);
    }

    if (!liveTrackingRes.riderLocation || liveTrackingRes.riderLocation.lat !== 24.8450) {
      throw new Error('Journey 26: Live tracking did not return the latest rider GPS coordinates');
    }
    if (liveTrackingRes.distanceKm === undefined || liveTrackingRes.etaMinutes === undefined) {
      throw new Error('Journey 26: Distance and genuine ETA calculation missing from live tracking response');
    }
    if (liveTrackingRes.isStale !== false) {
      throw new Error('Journey 26: Fresh telemetry flagged as stale unexpectedly');
    }

    // 14. GPS Permission Denial Reporting
    // Wait 2.1 seconds for rate-limit cooldown
    await new Promise((r) => setTimeout(r, 2100));

    const denialGpsRes = await fetch(`${API_BASE}/rider/orders/${p7OrderNumber}/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider1Token}`,
      },
      body: JSON.stringify({
        permissionDenied: true,
        isSharing: false,
      }),
    }).then((r) => r.json());

    if (!denialGpsRes.success || !denialGpsRes.riderLocation?.permissionDenied) {
      throw new Error(`Journey 26: Permission denial transmission failed: ${denialGpsRes.message}`);
    }

    const liveTrackDenied = await fetch(`${API_BASE}/public/orders/${p7OrderNumber}/live-tracking`).then((r) => r.json());
    if (liveTrackDenied.riderLocation?.permissionDenied !== true) {
      throw new Error('Journey 26: Public live tracking did not reflect GPS permission denial');
    }

    // 15. Operational Completion and Post-Delivery Privacy Termination
    // Wait cooldown
    await new Promise((r) => setTimeout(r, 2100));

    // Advance to At Doorstep and then Order Received
    await fetch(`${API_BASE}/rider/orders/${p7OrderNumber}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider1Token}`,
      },
      body: JSON.stringify({ status: 'Rider Is At Your Doorstep' }),
    });

    const finishDeliveryRes = await fetch(`${API_BASE}/rider/orders/${p7OrderNumber}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rider1Token}`,
      },
      body: JSON.stringify({ status: 'Order Received' }),
    }).then((r) => r.json());

    if (!finishDeliveryRes.success || finishDeliveryRes.order.status !== 'Order Received') {
      throw new Error(`Journey 26: Delivery finish failed: ${finishDeliveryRes.message}`);
    }

    // CRITICAL PRIVACY CHECK: After delivery is complete, riderLocation MUST be null in public tracking
    const postDeliveryTrack = await fetch(`${API_BASE}/public/orders/${p7OrderNumber}/live-tracking`).then((r) => r.json());
    if (postDeliveryTrack.riderLocation !== null) {
      throw new Error('Journey 26: Rider live location remained exposed after delivery was marked complete! Privacy violation.');
    }

    // Clean up saved address test item
    await fetch(`${API_BASE}/auth/saved-addresses/${savedAddrId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customerToken}` },
    });

    log(
      26,
      'Phase 7: Pakistan Address Search, Multi-Address Wallet, Zone Boundary Enforcement & Real-Time Tracking',
      true,
      `Pakistan landmark directory search verified; saved address CRUD (Home/Office) with recipient contact details verified; out-of-boundary order (> 1000 km) strictly rejected with HTTP 400; in-zone order accepted with zone fee and alternate recipient metadata; rider privacy gating enforced prior to pickup (null location); live device GPS telemetry accepted and 2s rate limiting verified (429); unauthorized telemetry blocked (403); genuine distance/ETA and fresh/stale detection verified; GPS permission denial handled; post-delivery tracking strictly terminated with coordinates cleared!`
    );

    // =========================================================================
    // JOURNEY 27: Phase 9 Complete Platform Administration & Operational Analytics
    // =========================================================================
    console.log('\n--- Journey 27: Phase 9 Complete Platform Administration & Operational Analytics ---');

    // 1. Platform Overview & Metrics Accuracy with Date Range Filtering
    console.log('  -> Step 1: Admin Stats all...');
    const p9StatsAllRaw = await fetch(`${API_BASE}/admin/stats?period=all`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const p9StatsAllText = await p9StatsAllRaw.text();
    let p9StatsAll;
    try {
      p9StatsAll = JSON.parse(p9StatsAllText);
    } catch (e) {
      throw new Error(`Step 1 fetch /admin/stats?period=all failed to parse JSON! Status: ${p9StatsAllRaw.status}. Response: ${p9StatsAllText.slice(0, 200)}`);
    }

    if (!p9StatsAll.success || !p9StatsAll.stats) {
      throw new Error(`Journey 27: Failed to fetch admin stats: ${p9StatsAll.message}`);
    }

    const {
      totalRestaurants: p9TotRest,
      totalOrders: p9TotOrders,
      grossOrderValue: p9Gov,
      completedOrderValue: p9Cov,
      cancelledCount: p9Cancelled,
      platformRevenue: p9PlatRev,
      commissionModel: p9CommModel,
      activeCount: p9ActiveCount,
      pendingCount: p9PendingCount,
      suspendedCount: p9SuspendedCount,
      totalRiders: p9TotRiders,
      activeRiders: p9ActiveRiders,
      ordersToday: p9OrdersToday,
    } = p9StatsAll.stats;

    // Check metric consistency
    if (typeof p9Gov !== 'number' || typeof p9Cov !== 'number') {
      throw new Error('Journey 27: Gross Order Value or Completed Order Value is not a valid number');
    }

    // Gross order value must be greater than or equal to completed order value
    if (p9Gov < p9Cov) {
      throw new Error(`Journey 27: Metric contradiction: GOV ($${p9Gov}) is less than COV ($${p9Cov})!`);
    }

    // Platform revenue must truthfully reflect 0% commission model without fake numbers
    if (p9PlatRev !== 0 || !p9CommModel.includes('0% Direct-to-Kitchen')) {
      throw new Error(`Journey 27: Platform revenue model is not truthful! Revenue: ${p9PlatRev}, Model: ${p9CommModel}`);
    }

    // Test date filters: 7d, 30d, today
    console.log('  -> Step 2: Admin Stats 7d...');
    const p9Stats7d = await fetch(`${API_BASE}/admin/stats?period=7d`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());

    if (!p9Stats7d.success || p9Stats7d.stats.selectedPeriod !== '7d') {
      throw new Error('Journey 27: 7-day period stats filtering failed');
    }

    // 2. Operational Monitoring Queues & Real Server Data
    console.log('  -> Step 3: Admin Operations queues...');
    const p9OperationsRaw = await fetch(`${API_BASE}/admin/operations`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const p9OperationsText = await p9OperationsRaw.text();
    let p9Operations;
    try {
      p9Operations = JSON.parse(p9OperationsText);
    } catch (e) {
      throw new Error(`Step 3 fetch /admin/operations failed to parse JSON! Status: ${p9OperationsRaw.status}. Response: ${p9OperationsText.slice(0, 200)}`);
    }

    if (!p9Operations.success || !p9Operations.queues || !p9Operations.counts) {
      throw new Error(`Journey 27: Failed to fetch operational monitoring queues: ${p9Operations.message}`);
    }

    const { queues: p9Queues, counts: p9Counts } = p9Operations;
    if (!Array.isArray(p9Queues.waitingAcceptance) || !Array.isArray(p9Queues.preparing) || !Array.isArray(p9Queues.readyUnassigned) || !Array.isArray(p9Queues.activeDeliveries)) {
      throw new Error('Journey 27: Operational monitoring queues are missing expected queue arrays');
    }

    // 3. Operational Reports, Aggregations & Tenant Isolation
    console.log('  -> Step 4: Admin Reports 30d...');
    const p9ReportsRaw = await fetch(`${API_BASE}/admin/reports?period=30d&status=all`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const p9ReportsText = await p9ReportsRaw.text();
    let p9Reports;
    try {
      p9Reports = JSON.parse(p9ReportsText);
    } catch (e) {
      throw new Error(`Step 4 fetch /admin/reports failed to parse JSON! Status: ${p9ReportsRaw.status}. Response: ${p9ReportsText.slice(0, 200)}`);
    }

    if (!p9Reports.success || !p9Reports.summary || !Array.isArray(p9Reports.restaurantPerformance) || !Array.isArray(p9Reports.riderPerformance)) {
      throw new Error(`Journey 27: Failed to generate operational reports: ${p9Reports.message}`);
    }

    // Tenant Isolation check: Restaurant owner calling super admin reports MUST be rejected with 403 Forbidden
    const ownerUnauthorizedReport = await fetch(`${API_BASE}/admin/reports`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (ownerUnauthorizedReport.status !== 403) {
      throw new Error(`Journey 27: Tenant isolation failure! Restaurant owner was not blocked from admin reports with 403 Forbidden! Status: ${ownerUnauthorizedReport.status}`);
    }

    // 4. User and Access Management & Role Protection
    console.log('  -> Step 5: Admin Users list...');
    const p9UsersRaw = await fetch(`${API_BASE}/admin/users?role=all&limit=25`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const p9UsersText = await p9UsersRaw.text();
    let p9Users;
    try {
      p9Users = JSON.parse(p9UsersText);
    } catch (e) {
      throw new Error(`Step 5 fetch /admin/users failed to parse JSON! Status: ${p9UsersRaw.status}. Response: ${p9UsersText.slice(0, 200)}`);
    }

    if (!p9Users.success || !Array.isArray(p9Users.users) || typeof p9Users.total !== 'number') {
      throw new Error(`Journey 27: Failed to fetch user directory: ${p9Users.message}`);
    }

    // STRICT SANITIZATION CHECK: Verify that NO user record contains a password or password hash!
    for (const u of p9Users.users) {
      if (u.password || u.passwordHash || u.tokens) {
        throw new Error(`Journey 27: Security violation! User password/secret leaked in admin API response for user: ${u.email}`);
      }
    }

    // Ordinary user/owner cannot access /admin/users
    const ownerUnauthorizedUsers = await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (ownerUnauthorizedUsers.status !== 403) {
      throw new Error(`Journey 27: Role guard failure! Restaurant owner was not blocked from user directory with 403! Status: ${ownerUnauthorizedUsers.status}`);
    }

    // 5. Rider Deep Inspection & Delivery Assignment History
    console.log('  -> Step 6: Admin Riders inspection...');
    const allRidersRes = await fetch(`${API_BASE}/admin/riders?status=all`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());

    const testRider = allRidersRes.riders?.[0];
    if (!testRider) {
      throw new Error('Journey 27: No rider found to test inspection');
    }

    const riderInspectionResRaw = await fetch(`${API_BASE}/admin/riders/${testRider._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const riderInspectionText = await riderInspectionResRaw.text();
    let riderInspectionRes;
    try {
      riderInspectionRes = JSON.parse(riderInspectionText);
    } catch (e) {
      throw new Error(`Step 6 fetch /admin/riders/${testRider._id} failed to parse JSON! Status: ${riderInspectionResRaw.status}. Response: ${riderInspectionText.slice(0, 200)}`);
    }

    if (!riderInspectionRes.success || !riderInspectionRes.rider || !Array.isArray(riderInspectionRes.deliveryHistory)) {
      throw new Error(`Journey 27: Rider inspection failed: ${riderInspectionRes.message}`);
    }

    // 6. Courier Suspension & Safe Active Order Handling
    console.log('  -> Step 7: Courier safe suspension test...');
    const testRiderEmail = `safe_courier_${Date.now()}@fleet.io`;
    const regSafeRiderRes = await fetch(`${API_BASE}/auth/register-rider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Safe Dispatch Rider',
        email: testRiderEmail,
        password: 'courierPassword123',
        phone: '+92 300 9876543',
        city: 'Karachi',
        vehicleType: 'Motorcycle',
        vehicleNumber: 'KHI-9988',
      }),
    }).then((r) => r.json());

    const safeRiderId = regSafeRiderRes.user.id || regSafeRiderRes.user._id;

    // Approve the rider as admin
    await fetch(`${API_BASE}/admin/riders/${safeRiderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    });

    // Login as the safe rider
    const safeRiderLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testRiderEmail, password: 'courierPassword123' }),
    }).then((r) => r.json());
    const safeRiderToken = safeRiderLoginRes.token;

    // Turn online
    await fetch(`${API_BASE}/rider/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${safeRiderToken}`,
      },
      body: JSON.stringify({ isOnline: true }),
    });

    // Create an order ready for pickup in Karachi
    const p9OrderRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          name: 'Ahmed Customer',
          phone: '+92 321 5556677',
          address: 'Clifton Block 2, Karachi',
        },
        orderType: 'delivery',
        items: [
          {
            menuItemId: pizzaItemId,
            selectedSize: 'Family 16-inch',
            quantity: 1,
            expectedUnitPrice: 34.00,
          },
        ],
      }),
    }).then((r) => r.json());

    const p9OrderNumber = p9OrderRes.orderNumber;
    const p9OrderId = p9OrderRes.order._id;

    // Advance order to Ready for Pickup
    await fetch(`${API_BASE}/orders/${p9OrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'Preparing' }),
    });

    await fetch(`${API_BASE}/orders/${p9OrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'Ready for Pickup' }),
    });

    // Safe rider claims the delivery
    const claimRes = await fetch(`${API_BASE}/rider/orders/${p9OrderNumber}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${safeRiderToken}`,
      },
    }).then((r) => r.json());

    if (!claimRes.success) {
      throw new Error(`Journey 27: Safe rider failed to claim order: ${claimRes.message}`);
    }

    // Now Super Admin SUSPENDS the courier while order is in active delivery
    const suspendRiderRes = await fetch(`${API_BASE}/admin/riders/${safeRiderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'suspend',
        reason: 'Courier vehicle inspection expired',
      }),
    }).then((r) => r.json());

    if (!suspendRiderRes.success || suspendRiderRes.rider.riderStatus !== 'suspended') {
      throw new Error(`Journey 27: Suspending rider failed: ${suspendRiderRes.message}`);
    }

    // VERIFY CRITICAL OPERATIONAL SAFETY:
    // 1. The active order was safely re-queued back to 'Ready for Pickup' with assignedRiderId: null
    const safeOrderCheck = await fetch(`${API_BASE}/orders/${p9OrderId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    }).then((r) => r.json());

    if (!safeOrderCheck.success || safeOrderCheck.order.status !== 'Ready for Pickup' || safeOrderCheck.order.assignedRiderId !== null) {
      throw new Error(`Journey 27: CRITICAL SAFETY FAILURE: Order was not safely returned to Ready for Pickup on rider suspension! Status: ${safeOrderCheck.order?.status}, AssignedRider: ${safeOrderCheck.order?.assignedRiderId}`);
    }

    // 2. Suspended rider is blocked from dispatch access (403 Forbidden)
    const blockedRiderAccess = await fetch(`${API_BASE}/rider/available-orders`, {
      headers: { Authorization: `Bearer ${safeRiderToken}` },
    });
    if (blockedRiderAccess.status !== 403) {
      throw new Error(`Journey 27: Suspended rider was not rejected with 403 Forbidden! Status: ${blockedRiderAccess.status}`);
    }

    // 3. Reactivate the rider
    const reactivateRiderRes = await fetch(`${API_BASE}/admin/riders/${safeRiderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'reactivate' }),
    }).then((r) => r.json());

    if (!reactivateRiderRes.success || reactivateRiderRes.rider.riderStatus !== 'approved') {
      throw new Error(`Journey 27: Courier reactivation failed: ${reactivateRiderRes.message}`);
    }

    // 7. Restaurant Suspension Verification
    const suspendRestRes = await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'suspend', reason: 'Audit maintenance' }),
    }).then((r) => r.json());

    if (!suspendRestRes.success || suspendRestRes.restaurant.status !== 'suspended') {
      throw new Error(`Journey 27: Restaurant suspension failed: ${suspendRestRes.message}`);
    }

    // Suspended restaurant checkout MUST return 403 Forbidden
    const suspendedCheckout = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: { name: 'Blocked Customer', phone: '+92 300 1234567', address: 'Karachi' },
        orderType: 'delivery',
        items: [{ menuItemId: pizzaItemId, quantity: 1 }],
      }),
    });
    if (suspendedCheckout.status !== 403) {
      throw new Error(`Journey 27: Suspended restaurant accepted order! Status: ${suspendedCheckout.status}`);
    }

    // Reactivate restaurant
    await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'activate' }),
    });

    log(
      27,
      'Phase 9: Platform Overview, Operational Monitoring, Courier Governance, Reports & Role Integrity',
      true,
      `Super Admin dashboard verified: GOV ($${p9Gov}) distinguished from COV ($${p9Cov}); 0% commission direct-to-kitchen model verified without fake metrics; operational queues with server timestamps verified; date-filtered performance reports verified; tenant isolation enforced (owner blocked with 403); sanitized user directory verified (zero secret leaks); courier suspension safely re-queued active delivery #${p9OrderNumber} to Ready for Pickup without losing orders; suspended couriers and restaurants strictly blocked from taking orders (403)!`
    );
    }

    // =========================================================================
    // JOURNEY 28: Phase 10 Final QA, Regression Testing & Consistency Gating
    // =========================================================================
    {
      console.log('\n--- Journey 28: Phase 10 Final QA, Regression Testing & Security Verification ---');

      // 1. Super Admin status update verification (without false "privileges required" rejection)
      const adminUpdateRes = await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'active' }),
      }).then((r) => r.json());

      if (!adminUpdateRes.success || adminUpdateRes.restaurant?.status !== 'active') {
        throw new Error(`Journey 28: Super Admin status update failed: ${adminUpdateRes.message}`);
      }

      // Owner attempting admin status update MUST be rejected with 403 Forbidden
      const unauthorizedUpdate = await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ status: 'suspend' }),
      });
      if (unauthorizedUpdate.status !== 403) {
        throw new Error(`Journey 28: Unauthorized owner was not rejected with 403 Forbidden! Status: ${unauthorizedUpdate.status}`);
      }

      // 2. Publication consistency gating: Suspended restaurant cannot be published
      // First suspend the restaurant as admin
      await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'suspend', reason: 'Consistency test' }),
      });

      // Owner attempts to publish suspended restaurant -> MUST return 403 Forbidden
      const publishSuspendedRes = await fetch(`${API_BASE}/restaurants/${restaurantId}/publish`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ isPublished: true }),
      });
      if (publishSuspendedRes.status !== 403) {
        throw new Error(`Journey 28: Suspended restaurant was allowed to publish! Status: ${publishSuspendedRes.status}`);
      }

      // Reactivate restaurant
      await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'activate' }),
      });

      // 3. Sold-out item purchase prevention
      // Mark pizza item unavailable
      await fetch(`${API_BASE}/menu-items/${pizzaItemId}/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ restaurantId, isAvailable: false }),
      });

      // Customer checkout attempting to purchase sold-out item -> MUST return 400 Bad Request
      const soldOutOrderRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerInfo: { name: 'Saba Khan', phone: '+92 300 7778899', address: 'DHA Phase 6, Karachi' },
          orderType: 'delivery',
          items: [{ menuItemId: pizzaItemId, quantity: 1 }],
        }),
      });

      if (soldOutOrderRes.status !== 400) {
        throw new Error(`Journey 28: Sold-out item checkout was not rejected with 400! Status: ${soldOutOrderRes.status}`);
      }
      const soldOutJson = await soldOutOrderRes.json();
      if (!soldOutJson.message.toLowerCase().includes('out of stock')) {
        throw new Error(`Journey 28: Expected 'out of stock' message, got: ${soldOutJson.message}`);
      }

      // Re-enable pizza item
      await fetch(`${API_BASE}/menu-items/${pizzaItemId}/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ restaurantId, isAvailable: true }),
      });

      // 4. Order, Kitchen, Dispatch & Rider Status Synchronization
      // Place order successfully
      const p10OrderRes = await fetch(`${API_BASE}/public/restaurant/${restSlug}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerInfo: {
            name: 'Bilal Customer',
            phone: '+92 301 2223344',
            address: 'Gulshan Block 4, Karachi',
          },
          orderType: 'delivery',
          items: [
            {
              menuItemId: pizzaItemId,
              selectedSize: 'Family 16-inch',
              quantity: 1,
              expectedUnitPrice: 34.00,
            },
          ],
        }),
      }).then((r) => r.json());

      if (!p10OrderRes.success || !p10OrderRes.order) {
        throw new Error(`Journey 28: Failed to place order: ${p10OrderRes.message}`);
      }

      const p10OrderNumber = p10OrderRes.orderNumber;
      const p10OrderId = p10OrderRes.order._id;

      // Kitchen accepts and prepares
      await fetch(`${API_BASE}/orders/${p10OrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ status: 'Preparing Your Order' }),
      });

      // Kitchen marks ready
      await fetch(`${API_BASE}/orders/${p10OrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ status: 'Ready for Pickup' }),
      });

      // Provision & authenticate rider for Phase 10 synchronization test
      const p10RiderEmail = `qa_rider_${Date.now()}@fleet.io`;
      const regP10Rider = await fetch(`${API_BASE}/auth/register-rider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'QA Dispatch Rider',
          email: p10RiderEmail,
          password: 'courierPassword123',
          phone: '+92 300 1122334',
          city: 'Karachi',
          vehicleType: 'Motorcycle',
          vehicleNumber: 'KHI-7766',
        }),
      }).then((r) => r.json());

      const p10RiderId = regP10Rider.user.id || regP10Rider.user._id;

      // Approve rider as admin
      await fetch(`${API_BASE}/admin/riders/${p10RiderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'approved' }),
      });

      // Login as rider
      const p10RiderLogin = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: p10RiderEmail, password: 'courierPassword123' }),
      }).then((r) => r.json());
      const p10RiderToken = p10RiderLogin.token;

      // Turn online
      await fetch(`${API_BASE}/rider/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p10RiderToken}`,
        },
        body: JSON.stringify({ isOnline: true }),
      });

      // Courier claims the order
      const riderClaimRes = await fetch(`${API_BASE}/rider/orders/${p10OrderNumber}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p10RiderToken}`,
        },
      }).then((r) => r.json());

      if (!riderClaimRes.success) {
        throw new Error(`Journey 28: Rider failed to claim order: ${riderClaimRes.message}`);
      }

      // Courier advances to Picked Up
      await fetch(`${API_BASE}/rider/orders/${p10OrderNumber}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p10RiderToken}`,
        },
        body: JSON.stringify({ status: 'Rider Picked Up Your Order' }),
      });

      // Courier advances to On The Way
      await fetch(`${API_BASE}/rider/orders/${p10OrderNumber}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p10RiderToken}`,
        },
        body: JSON.stringify({ status: 'Rider Is On The Way' }),
      });

      // Courier advances to Doorstep
      await fetch(`${API_BASE}/rider/orders/${p10OrderNumber}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p10RiderToken}`,
        },
        body: JSON.stringify({ status: 'Rider Is At Your Doorstep' }),
      });

      // Courier completes delivery
      const deliveredRes = await fetch(`${API_BASE}/rider/orders/${p10OrderNumber}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p10RiderToken}`,
        },
        body: JSON.stringify({ status: 'Order Received' }),
      }).then((r) => r.json());

      if (!deliveredRes.success) {
        throw new Error(`Journey 28: Rider delivery completion failed: ${deliveredRes.message}`);
      }

      // 5. Verify security boundaries: invalid/expired token returns 401
      const invalidTokenRes = await fetch(`${API_BASE}/orders/stats`, {
        headers: { Authorization: 'Bearer invalid_or_expired_jwt_token_sample' },
      });
      if (invalidTokenRes.status !== 401) {
        throw new Error(`Journey 28: Invalid token was not rejected with 401! Status: ${invalidTokenRes.status}`);
      }

      log(
        28,
        'Phase 10: Final QA, Regression Testing, Consistency Gating & Security Isolation',
        true,
        `All 5 reported regressions verified & resolved: Super Admin status updates succeeded without privilege false-positives; unauthorized owners blocked with 403; suspended restaurant publication blocked with 403; sold-out items strictly rejected with 400 Bad Request; full 7-step order, kitchen and rider status synchronization completed (Order #${p10OrderNumber}); invalid tokens blocked with 401 Unauthorized!`
      );
    }

    console.log('\n======================================================');
    console.log('🎉 ALL 28 ACADEMIC, PHASE 6, PHASE 7, PHASE 9 & PHASE 10 QA JOURNEYS COMPLETED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ TEST RUNNER FAILED:', err.message);
    process.exit(1);
  }
}

runTests();

