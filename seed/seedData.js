import bcrypt from 'bcryptjs';
import { dbService, updateDB, generateId } from '../services/dbStore.js';
import { connectDB } from '../config/db.js';

export const seedDatabase = async () => {
  console.log('[Seed] Starting database seeding with rich demonstration tenants...');

  await connectDB();

  // Common password hash for test accounts
  const salt = await bcrypt.genSalt(10);
  const testPasswordHash = await bcrypt.hash('password123', salt);

  // 1. Users
  const users = [
    {
      _id: generateId(),
      name: 'Platform Super Administrator',
      email: 'admin@foodflow.com',
      password: testPasswordHash,
      role: 'superadmin',
      phone: '+1 (555) 000-0001',
    },
    {
      _id: generateId(),
      name: 'Zaid Smokehouse',
      email: 'owner@smokehouse.com',
      password: testPasswordHash,
      role: 'owner',
      phone: '+1 (555) 782-9901',
    },
    {
      _id: generateId(),
      name: 'Mario Rossi',
      email: 'owner@bellaitalia.com',
      password: testPasswordHash,
      role: 'owner',
      phone: '+1 (555) 349-1120',
    },
    {
      _id: generateId(),
      name: 'Chef Tariq Khan',
      email: 'owner@spiceandsizzle.com',
      password: testPasswordHash,
      role: 'owner',
      phone: '+1 (555) 902-4412',
    },
  ];

  // 2. Restaurants
  const smokehouseRestId = generateId();
  const bellaRestId = generateId();
  const spiceRestId = generateId();

  users[1].restaurantId = smokehouseRestId;
  users[2].restaurantId = bellaRestId;
  users[3].restaurantId = spiceRestId;

  const restaurants = [
    {
      _id: smokehouseRestId,
      ownerId: users[1]._id,
      name: 'Karachi Smokehouse',
      slug: 'karachi-smokehouse',
      tagline: 'Authentic Texas Pit BBQ meets Charcoal Smoke & Spice',
      description: 'Slow-smoked prime cuts, flame-kissed smash burgers, and house-made barbecue sauces prepared fresh daily.',
      logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
      banner: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1600&q=80',
      phone: '+1 (555) 782-9901',
      email: 'smokehouse@foodflow.io',
      address: 'Plot 45-C, Khayaban-e-Seher, Phase 6 DHA',
      currency: 'USD',
      currencySymbol: '$',
      isPublished: true,
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
        heroHeadline: 'Wood-Fired Smoke & Gourmet Craft Burgers',
        heroSubheadline: '12-hour low-and-slow prime meats, dripping cheeses, and signature sauces straight from the pit.',
        announcementText: '🔥 Enjoy 15% OFF your entire BBQ feast with code SMOKE15!',
      },
      deliverySettings: {
        deliveryEnabled: true,
        pickupEnabled: true,
        deliveryFee: 4.99,
        minOrderAmount: 18.0,
        estimatedDeliveryTime: '30-40 mins',
        estimatedPickupTime: '15-20 mins',
        taxRate: 5,
        openingHours: {
          openTime: '11:00',
          closeTime: '23:30',
          isOpen24Hours: false,
          closedDays: [],
        },
        deliveryZones: [
          { name: 'Zone A - DHA & Clifton (0-5 km)', fee: 3.5, minOrder: 18 },
          { name: 'Zone B - PECHS & Gulshan (5-10 km)', fee: 6.0, minOrder: 25 },
        ],
      },
    },
    {
      _id: bellaRestId,
      ownerId: users[2]._id,
      name: 'Bella Italia Trattoria',
      slug: 'bella-italia',
      tagline: 'Artisan Wood-Fired Neapolitan Pizza & Handcrafted Pasta',
      description: 'Bringing centuries of Italian culinary heritage with organic San Marzano tomatoes, fior di latte, and handcrafted dough.',
      logo: 'https://images.unsplash.com/photo-1579684947550-22e945225d9a?auto=format&fit=crop&w=300&q=80',
      banner: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1600&q=80',
      phone: '+1 (555) 349-1120',
      email: 'ciao@bellaitalia.com',
      address: '77 Piazza Roma, Little Italy',
      currency: 'USD',
      currencySymbol: '$',
      isPublished: true,
      theme: {
        themeId: 'emerald',
        primaryColor: '#059669',
        secondaryColor: '#064e3b',
        accentColor: '#10b981',
        fontFamily: 'Outfit',
        borderRadius: 'rounded-2xl',
        bannerOverlay: true,
        layout: 'grid',
      },
      sections: {
        showHero: true,
        showFeatured: true,
        showCategories: true,
        showAbout: true,
        heroHeadline: 'Authentic Italian Flavors Made by Master Pizzaiolos',
        heroSubheadline: 'Hand-stretched sourdough pizzas baked at 900°F in our stone wood-fired oven.',
        announcementText: '🍕 Get 10% off with coupon code BELLA10!',
      },
      deliverySettings: {
        deliveryEnabled: true,
        pickupEnabled: true,
        deliveryFee: 3.99,
        minOrderAmount: 20.0,
        estimatedDeliveryTime: '25-35 mins',
        estimatedPickupTime: '15 mins',
        taxRate: 6,
        openingHours: {
          openTime: '12:00',
          closeTime: '22:30',
          isOpen24Hours: false,
          closedDays: ['Monday'],
        },
        deliveryZones: [
          { name: 'Inner Circle (0-4 km)', fee: 3.99, minOrder: 20 },
          { name: 'Outer Circle (4-8 km)', fee: 5.99, minOrder: 30 },
        ],
      },
    },
    {
      _id: spiceRestId,
      ownerId: users[3]._id,
      name: 'Spice & Sizzle Bistro',
      slug: 'spice-and-sizzle',
      tagline: 'Royal Mughlai Karahis, Dum Biryanis & Tandoori Kebabs',
      description: 'Heirloom family recipes, freshly crushed spices, and succulent meats slow-cooked to perfection.',
      logo: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=300&q=80',
      banner: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1600&q=80',
      phone: '+1 (555) 902-4412',
      email: 'bistro@spiceandsizzle.com',
      address: '22 Food Street, Old City Quarter',
      currency: 'USD',
      currencySymbol: '$',
      isPublished: false, // Intentionally unpublished for testing requirement #1!
      theme: {
        themeId: 'sunset',
        primaryColor: '#dc2626',
        secondaryColor: '#450a0a',
        accentColor: '#f97316',
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
        heroHeadline: 'A Celebration of Heritage Spices',
        heroSubheadline: 'Authentic copper pot karahis and fragrant biryani.',
        announcementText: 'New menu coming soon!',
      },
      deliverySettings: {
        deliveryEnabled: true,
        pickupEnabled: true,
        deliveryFee: 4.5,
        minOrderAmount: 15.0,
        estimatedDeliveryTime: '35-50 mins',
        estimatedPickupTime: '20 mins',
        taxRate: 5,
        openingHours: {
          openTime: '13:00',
          closeTime: '01:00',
          isOpen24Hours: false,
          closedDays: [],
        },
      },
    },
  ];

  // 3. Categories for Smokehouse
  const catSmk1 = generateId();
  const catSmk2 = generateId();
  const catSmk3 = generateId();

  // Categories for Bella Italia
  const catBel1 = generateId();
  const catBel2 = generateId();

  const categories = [
    {
      _id: catSmk1,
      restaurantId: smokehouseRestId,
      name: 'Signature Pit Burgers',
      slug: 'signature-pit-burgers',
      description: 'Freshly ground Angus chuck patties grilled over mesquite wood',
      orderIndex: 0,
      isActive: true,
    },
    {
      _id: catSmk2,
      restaurantId: smokehouseRestId,
      name: 'Slow Smoked BBQ',
      slug: 'slow-smoked-bbq',
      description: 'Low and slow smoked prime cuts served with tangy pickles & house slaw',
      orderIndex: 1,
      isActive: true,
    },
    {
      _id: catSmk3,
      restaurantId: smokehouseRestId,
      name: 'Sides & Craft Beverages',
      slug: 'sides-and-craft-beverages',
      description: 'Crispy sides and chilled refreshing artisanal beverages',
      orderIndex: 2,
      isActive: true,
    },
    {
      _id: catBel1,
      restaurantId: bellaRestId,
      name: 'Neapolitan Pizzas',
      slug: 'neapolitan-pizzas',
      description: 'Hand-stretched dough fermented 48 hours and blistered in wood fire',
      orderIndex: 0,
      isActive: true,
    },
    {
      _id: catBel2,
      restaurantId: bellaRestId,
      name: 'Artisan Pastas',
      slug: 'artisan-pastas',
      description: 'Fresh semolina pastas prepared daily with Italian DOC cheeses',
      orderIndex: 1,
      isActive: true,
    },
  ];

  // 4. Menu Items with Sizes & Extras
  const menuItems = [
    // Smokehouse Burgers
    {
      _id: generateId(),
      restaurantId: smokehouseRestId,
      categoryId: catSmk1,
      name: 'The Pitmaster Brisket Burger',
      description: 'Double Angus beef patties layered with 12-hour pulled brisket, smoked gouda, crispy onion rings, and bourbon BBQ glaze on toasted brioche.',
      image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
      price: 15.99,
      discountPrice: 13.99,
      isAvailable: true,
      isFeatured: true,
      orderIndex: 0,
      sizes: [
        { name: 'Single Patty (6oz)', price: 13.99 },
        { name: 'Double Stack (12oz)', price: 17.99 },
        { name: 'Triple Beast (18oz)', price: 21.99 },
      ],
      extras: [
        { name: 'Extra Smoked Gouda', price: 1.75 },
        { name: 'Smoked Bacon Jam', price: 2.25 },
        { name: 'Crispy Jalapeños', price: 1.0 },
      ],
    },
    {
      _id: generateId(),
      restaurantId: smokehouseRestId,
      categoryId: catSmk1,
      name: 'Fiery Buttermilk Fried Chicken',
      description: '24-hour buttermilk brined crispy chicken thigh tossed in Nashville hot honey, dill pickles, and creamy garlic slaw.',
      image: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=600&q=80',
      price: 12.99,
      discountPrice: null,
      isAvailable: true,
      isFeatured: true,
      orderIndex: 1,
      sizes: [
        { name: 'Regular Spice', price: 12.99 },
        { name: 'Ghost Pepper Inferno', price: 13.99 },
      ],
      extras: [
        { name: 'Extra Hot Honey Dip', price: 1.5 },
        { name: 'Waffle Fries Side', price: 3.5 },
      ],
    },
    // Smokehouse BBQ
    {
      _id: generateId(),
      restaurantId: smokehouseRestId,
      categoryId: catSmk2,
      name: 'Texas Prime Beef Brisket Platter',
      description: 'Half-pound of USDA Prime brisket rubbed with coarse black pepper and smoked over oak for 14 hours. Served with Texas toast, pickles, and pickled red onions.',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
      price: 24.99,
      discountPrice: 21.99,
      isAvailable: true,
      isFeatured: true,
      orderIndex: 0,
      sizes: [
        { name: 'Half Pound (0.5 lb)', price: 21.99 },
        { name: 'Full Pound Feast (1 lb)', price: 39.99 },
      ],
      extras: [
        { name: 'Extra Pit Beans', price: 3.0 },
        { name: 'Creamy Jalapeño Cornbread', price: 2.5 },
      ],
    },
    {
      _id: generateId(),
      restaurantId: smokehouseRestId,
      categoryId: catSmk3,
      name: 'Truffle Parmesan Hand-Cut Fries',
      description: 'Crispy russet fries tossed in white truffle oil, freshly grated 24-month parmesan, and chopped fresh parsley.',
      image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
      price: 6.99,
      discountPrice: null,
      isAvailable: true,
      isFeatured: false,
      orderIndex: 0,
      sizes: [
        { name: 'Regular', price: 6.99 },
        { name: 'Large Bucket', price: 9.99 },
      ],
      extras: [
        { name: 'Truffle Aioli Dip', price: 1.25 },
        { name: 'Chipotle Mayo', price: 1.0 },
      ],
    },
    // Bella Italia
    {
      _id: generateId(),
      restaurantId: bellaRestId,
      categoryId: catBel1,
      name: 'Pizza Margherita D.O.P.',
      description: 'San Marzano tomatoes, Fior di Latte mozzarella, fresh sweet basil, and extra virgin olive oil on wood-fired crust.',
      image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80',
      price: 16.5,
      discountPrice: 14.5,
      isAvailable: true,
      isFeatured: true,
      orderIndex: 0,
      sizes: [
        { name: '12-inch Regular', price: 14.5 },
        { name: '16-inch Family', price: 21.0 },
      ],
      extras: [
        { name: 'Bufala Mozzarella upgrade', price: 2.5 },
        { name: 'Prosciutto di Parma', price: 3.5 },
      ],
    },
    {
      _id: generateId(),
      restaurantId: bellaRestId,
      categoryId: catBel2,
      name: 'Fettuccine Al Tartufo',
      description: 'Fresh egg fettuccine tossed in a rich black truffle and cultured butter sauce, topped with shaved Parmigiano Reggiano.',
      image: 'https://images.unsplash.com/photo-1621996346565-e3d5d62810f5?auto=format&fit=crop&w=600&q=80',
      price: 18.99,
      discountPrice: null,
      isAvailable: true,
      isFeatured: true,
      orderIndex: 0,
      sizes: [],
      extras: [
        { name: 'Extra Shaved Truffle', price: 4.0 },
        { name: 'Garlic Herb Focaccia', price: 2.5 },
      ],
    },
  ];

  // 5. Coupons
  const coupons = [
    {
      _id: generateId(),
      restaurantId: smokehouseRestId,
      code: 'SMOKE15',
      discountType: 'percentage',
      discountValue: 15,
      minOrderAmount: 20,
      maxDiscountAmount: 20,
      usageLimit: 500,
      usageCount: 4,
      isActive: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      _id: generateId(),
      restaurantId: smokehouseRestId,
      code: 'BURGER50',
      discountType: 'fixed',
      discountValue: 5,
      minOrderAmount: 25,
      maxDiscountAmount: null,
      usageLimit: 200,
      usageCount: 1,
      isActive: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      _id: generateId(),
      restaurantId: bellaRestId,
      code: 'BELLA10',
      discountType: 'percentage',
      discountValue: 10,
      minOrderAmount: 25,
      maxDiscountAmount: 15,
      usageLimit: 300,
      usageCount: 2,
      isActive: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  // 6. Initial Seed Orders for Smokehouse
  const orders = [
    {
      _id: generateId(),
      orderNumber: 'FF-202610-1001',
      restaurantId: smokehouseRestId,
      customerInfo: {
        name: 'Ahmed Malik',
        phone: '+1 (555) 441-2390',
        email: 'ahmed.malik@example.com',
        address: 'House 14, Street 9, Phase 5 DHA',
        notes: 'Please ring the front bell and leave on the porch.',
      },
      orderType: 'delivery',
      items: [
        {
          menuItemId: menuItems[0]._id,
          name: 'The Pitmaster Brisket Burger',
          image: menuItems[0].image,
          basePrice: 15.99,
          selectedSize: { name: 'Double Stack (12oz)', price: 17.99 },
          selectedExtras: [{ name: 'Extra Smoked Gouda', price: 1.75 }],
          unitPrice: 19.74,
          quantity: 2,
          totalPrice: 39.48,
          specialInstructions: 'Well done patties please',
        },
        {
          menuItemId: menuItems[3]._id,
          name: 'Truffle Parmesan Hand-Cut Fries',
          image: menuItems[3].image,
          basePrice: 6.99,
          selectedSize: { name: 'Regular', price: 6.99 },
          selectedExtras: [{ name: 'Truffle Aioli Dip', price: 1.25 }],
          unitPrice: 8.24,
          quantity: 1,
          totalPrice: 8.24,
          specialInstructions: '',
        },
      ],
      pricing: {
        subtotal: 47.72,
        deliveryFee: 4.99,
        discount: 7.16,
        tax: 2.03,
        total: 47.58,
        couponCode: 'SMOKE15',
      },
      paymentMethod: 'cash_on_delivery',
      paymentStatus: 'pending',
      status: 'Preparing',
      statusHistory: [
        { status: 'Pending', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), note: 'Customer placed order' },
        { status: 'Accepted', timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), note: 'Order accepted by kitchen' },
        { status: 'Preparing', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), note: 'In the pit smoker' },
      ],
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      _id: generateId(),
      orderNumber: 'FF-202610-1002',
      restaurantId: smokehouseRestId,
      customerInfo: {
        name: 'Sarah Jenkins',
        phone: '+1 (555) 882-1249',
        email: 'sarah.j@example.com',
        address: 'Apt 4B, Oceanview Heights',
        notes: '',
      },
      orderType: 'delivery',
      items: [
        {
          menuItemId: menuItems[1]._id,
          name: 'Fiery Buttermilk Fried Chicken',
          image: menuItems[1].image,
          basePrice: 12.99,
          selectedSize: { name: 'Regular Spice', price: 12.99 },
          selectedExtras: [],
          unitPrice: 12.99,
          quantity: 1,
          totalPrice: 12.99,
          specialInstructions: '',
        },
      ],
      pricing: {
        subtotal: 12.99,
        deliveryFee: 4.99,
        discount: 0,
        tax: 0.65,
        total: 18.63,
        couponCode: null,
      },
      paymentMethod: 'cash_on_delivery',
      paymentStatus: 'pending',
      status: 'Pending',
      statusHistory: [
        { status: 'Pending', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), note: 'Order placed by customer' },
      ],
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  ];

  // 6. Branches
  const branches = [
    {
      _id: generateId(),
      restaurantId: smokehouseRestId,
      name: 'Main DHA Phase 6 Branch',
      address: 'Plot 45-C, Khayaban-e-Seher, Phase 6 DHA',
      city: 'Karachi',
      phone: '+1 (555) 782-9901',
      email: 'dha@smokehouse.com',
      deliveryEnabled: true,
      pickupEnabled: true,
      isMainBranch: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      _id: generateId(),
      restaurantId: smokehouseRestId,
      name: 'Clifton Seaside Branch',
      address: 'Block 4, Marine Drive, Clifton',
      city: 'Karachi',
      phone: '+1 (555) 782-9902',
      email: 'clifton@smokehouse.com',
      deliveryEnabled: true,
      pickupEnabled: true,
      isMainBranch: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      _id: generateId(),
      restaurantId: bellaRestId,
      name: 'Central Piazza Branch',
      address: 'Via Della Spiga 14, Historic District',
      city: 'Food City',
      phone: '+1 (555) 349-1120',
      email: 'piazza@bellaitalia.com',
      deliveryEnabled: true,
      pickupEnabled: true,
      isMainBranch: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];

  // Associate seed orders with branches
  orders[0].branchId = branches[0]._id;
  orders[0].branchName = branches[0].name;
  orders[1].branchId = branches[0]._id;
  orders[1].branchName = branches[0].name;

  // 7. Platform Activity Audit Trail
  const activities = [
    {
      _id: generateId(),
      type: 'PLATFORM_INITIALIZED',
      adminEmail: 'admin@foodflow.com',
      message: 'FoodFlow multi-tenant platform initialized with core tenants',
      timestamp: new Date().toISOString(),
    },
    {
      _id: generateId(),
      type: 'RESTAURANT_PUBLISHED',
      restaurantId: smokehouseRestId,
      restaurantName: 'Karachi Smokehouse',
      slug: 'karachi-smokehouse',
      adminEmail: 'owner@smokehouse.com',
      message: 'Karachi Smokehouse published live to storefront',
      timestamp: new Date(Date.now() - 3600 * 1000).toISOString(),
    },
  ];

  // Save into persistent store
  updateDB(() => {
    return {
      users,
      restaurants,
      categories,
      menuItems,
      coupons,
      orders,
      branches,
      activities,
    };
  });

  console.log('[Seed] Database successfully seeded with 3 tenants + Super Admin:');
  console.log(' - Platform Super Admin -> admin@foodflow.com / password123');
  console.log(' - Karachi Smokehouse (slug: karachi-smokehouse) -> PUBLISHED (2 branches)');
  console.log('   Owner login: owner@smokehouse.com / password123');
  console.log(' - Bella Italia Trattoria (slug: bella-italia) -> PUBLISHED (1 branch)');
  console.log('   Owner login: owner@bellaitalia.com / password123');
  console.log(' - Spice & Sizzle Bistro (slug: spice-and-sizzle) -> UNPUBLISHED (test target)');
  console.log('   Owner login: owner@spiceandsizzle.com / password123');
};

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('seedData.js')) {
  seedDatabase().then(() => {
    console.log('[Seed] Complete.');
    process.exit(0);
  });
}
