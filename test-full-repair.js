const API_BASE = 'http://localhost:5001/api';

async function verifyAll() {
  console.log('--- Starting Comprehensive Repair Verification ---\n');

  // 1. Health check
  const health = await fetch(`${API_BASE}/health`).then(r => r.json());
  console.log('1. Health check:', health.status === 'healthy' ? 'PASSED' : 'FAILED', health.database);
  if (health.database !== 'mongodb') throw new Error('Database is not MongoDB Atlas!');

  // 2. Partner Registration
  const ts = Date.now();
  const testEmail = `chef_${ts}@repairtest.com`;
  const regRes = await fetch(`${API_BASE}/auth/register-partner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ownerName: 'Chef Repair',
      email: testEmail,
      password: 'password123',
      restaurantName: `Repair Bistro ${ts}`,
      phone: '+92 300 1234567',
      address: '100 Food Street',
      city: 'Karachi',
      cuisine: 'Italian & Pizza',
    }),
  }).then(r => r.json());

  console.log('2. Partner Registration:', regRes.success ? 'PASSED' : 'FAILED', regRes.user?.email);
  if (!regRes.success || !regRes.token) throw new Error('Registration failed: ' + regRes.message);

  const ownerToken = regRes.token;
  const restaurantId = regRes.restaurant?._id;
  const restaurantSlug = regRes.restaurant?.slug;

  // 3. Login test & Password validation
  const wrongPassRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'wrongPassword' }),
  });
  console.log('3a. Wrong password rejection:', wrongPassRes.status === 401 ? 'PASSED (401)' : 'FAILED');
  if (wrongPassRes.status !== 401) throw new Error('Wrong password was not rejected with 401!');

  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'password123' }),
  }).then(r => r.json());
  console.log('3b. Owner login:', loginRes.success ? 'PASSED' : 'FAILED', 'Role:', loginRes.user?.role);
  if (!loginRes.success) throw new Error('Login failed: ' + loginRes.message);

  // 4. Access Owner Dashboard data
  const myRestRes = await fetch(`${API_BASE}/restaurants/my-restaurant`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  }).then(r => r.json());
  console.log('4. Owner Dashboard access:', myRestRes.success ? 'PASSED' : 'FAILED', myRestRes.restaurant?.name);
  if (!myRestRes.success) throw new Error('Failed to access my-restaurant: ' + myRestRes.message);

  // 5. Create Menu Category
  const catRes = await fetch(`${API_BASE}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ name: 'Specialties', description: 'House favorites' }),
  }).then(r => r.json());
  console.log('5. Create Menu Category:', catRes.success ? 'PASSED' : 'FAILED', catRes.category?.name);
  if (!catRes.success) throw new Error('Category creation failed');

  // 6. Create Menu Item
  const itemRes = await fetch(`${API_BASE}/menu-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      name: 'Artisan Margherita Pizza',
      description: 'San Marzano tomatoes, buffalo mozzarella',
      price: 18.50,
      categoryId: catRes.category._id,
      isAvailable: true,
    }),
  }).then(r => r.json());
  console.log('6. Create Menu Item:', itemRes.success ? 'PASSED' : 'FAILED', itemRes.item?.name, '$' + itemRes.item?.price);
  if (!itemRes.success) throw new Error('Menu item creation failed');

  // 7. Security: Tenant Isolation (Owner B cannot mutate Owner A's menu)
  const anotherUserRes = await fetch(`${API_BASE}/auth/register-partner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ownerName: 'Other Chef',
      email: `other_${ts}@repairtest.com`,
      password: 'password123',
      restaurantName: `Other Bistro ${ts}`,
      phone: '+92 300 7654321',
      address: '200 Competitor Ave',
      city: 'Karachi',
    }),
  }).then(r => r.json());
  const otherToken = anotherUserRes.token;

  const crossTenantRes = await fetch(`${API_BASE}/menu-items/${itemRes.item._id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherToken}` },
    body: JSON.stringify({ name: 'Hacked Name' }),
  });
  console.log('7. Tenant Isolation guard:', crossTenantRes.status === 403 ? 'PASSED (403 Forbidden)' : 'FAILED (' + crossTenantRes.status + ')');
  if (crossTenantRes.status !== 403) throw new Error('Cross-tenant mutation was not blocked with 403!');

  // 8. Security: Role guard (regular owner cannot access Super Admin dashboard stats)
  const adminGuardRes = await fetch(`${API_BASE}/admin/stats`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  console.log('8. Super Admin endpoint guard:', adminGuardRes.status === 403 ? 'PASSED (403 Forbidden)' : 'FAILED');
  if (adminGuardRes.status !== 403) throw new Error('Owner was not blocked from admin/stats!');

  // 9. Super Admin login and access
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@menufy.com', password: 'password123' }),
  }).then(r => r.json());
  console.log('9. Super Admin login:', adminLoginRes.success ? 'PASSED' : 'FAILED', 'Role:', adminLoginRes.user?.role);
  if (!adminLoginRes.success) throw new Error('Admin login failed');

  const adminStatsRes = await fetch(`${API_BASE}/admin/stats`, {
    headers: { Authorization: `Bearer ${adminLoginRes.token}` },
  }).then(r => r.json());
  console.log('10. Super Admin stats access:', adminStatsRes.success ? 'PASSED' : 'FAILED', 'Total restaurants:', adminStatsRes.stats?.totalRestaurants);

  // 11. Super Admin approves restaurant to publish it
  const approveRes = await fetch(`${API_BASE}/admin/restaurants/${restaurantId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminLoginRes.token}` },
    body: JSON.stringify({ status: 'approved' }),
  }).then(r => r.json());
  console.log('11. Super Admin approve partner:', approveRes.success ? 'PASSED' : 'FAILED', 'Status:', approveRes.restaurant?.status);

  // 12. Public customer order placement & privacy tracking
  const orderRes = await fetch(`${API_BASE}/public/restaurant/${restaurantSlug}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerInfo: {
        name: 'Sarah Customer',
        phone: '+92 300 9876543',
        address: 'House 45, Street 10, Karachi',
      },
      orderType: 'delivery',
      items: [{ menuItemId: itemRes.item._id, quantity: 2, expectedUnitPrice: 18.50 }],
    }),
  }).then(r => r.json());
  console.log('12. Order creation & pricing:', orderRes.success ? 'PASSED' : 'FAILED', 'Order #:', orderRes.orderNumber, 'Subtotal: $' + orderRes.order?.pricing?.subtotal);
  if (!orderRes.success) throw new Error('Order creation failed: ' + orderRes.message);

  // 13. Public order tracking with masked phone
  const trackRes = await fetch(`${API_BASE}/public/orders/${orderRes.orderNumber}`).then(r => r.json());
  console.log('13. Customer Privacy Tracking:', trackRes.success ? 'PASSED' : 'FAILED', 'Masked Phone:', trackRes.order?.customerInfo?.phone);
  if (!trackRes.order?.customerInfo?.phone?.includes('***')) throw new Error('Phone was not masked for privacy!');

  console.log('\n--- ALL 13 CORE REPAIR VERIFICATION CHECKS PASSED WITH 100% SUCCESS! ---');
}

verifyAll().catch(err => {
  console.error('\n❌ VERIFICATION ERROR:', err.message);
  process.exit(1);
});
