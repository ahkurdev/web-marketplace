const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- RUNNING ARCHITECTURE VERIFICATION ---');

const baseDir = path.resolve(__dirname, '..');

// 1. Verify Prisma Schema
const prismaPath = path.join(baseDir, 'backend', 'prisma', 'schema.prisma');
assert(fs.existsSync(prismaPath), 'schema.prisma must exist');
const prismaContent = fs.readFileSync(prismaPath, 'utf8');

const requiredModels = [
  {
    name: 'User',
    fields: ['id', 'email', 'passwordHash', 'name', 'role', 'createdAt', 'updatedAt'],
  },
  {
    name: 'Product',
    fields: ['id', 'title', 'description', 'price', 'stock', 'category', 'imageUrl', 'createdAt', 'updatedAt'],
  },
  {
    name: 'CartItem',
    fields: ['id', 'userId', 'productId', 'quantity', 'createdAt', 'updatedAt'],
  },
  {
    name: 'Order',
    fields: ['id', 'userId', 'totalAmount', 'status', 'shippingAddress', 'createdAt', 'updatedAt'],
  },
  {
    name: 'OrderItem',
    fields: ['id', 'orderId', 'productId', 'price', 'quantity'],
  },
];

for (const m of requiredModels) {
  assert(prismaContent.includes(`model ${m.name}`), `Model ${m.name} missing in schema.prisma`);
  for (const field of m.fields) {
    const fieldRegex = new RegExp(`\\b${field}\\b`);
    assert(fieldRegex.test(prismaContent), `Field ${field} missing in ${m.name}`);
  }
}
console.log('✓ Prisma Schema: All 5 models and required fields verified');

// 2. Verify OpenAPI Spec
const openapiPath = path.join(baseDir, 'docs', 'openapi.yaml');
assert(fs.existsSync(openapiPath), 'openapi.yaml must exist');
const openapiContent = fs.readFileSync(openapiPath, 'utf8');

const requiredEndpoints = [
  '/auth/register',
  '/auth/login',
  '/auth/me',
  '/products',
  '/products/{id}',
  '/cart',
  '/cart/items',
  '/cart/items/{id}',
  '/checkout',
  '/orders',
  '/orders/{id}',
];

for (const ep of requiredEndpoints) {
  assert(openapiContent.includes(ep), `Endpoint ${ep} missing in openapi.yaml`);
}
console.log('✓ OpenAPI Spec: All endpoints (Auth, Catalog, Cart, Checkout) verified');

// 3. Verify Backend Skeleton
const requiredBackendFiles = [
  'package.json',
  'tsconfig.json',
  '.env.example',
  'src/app.ts',
  'src/server.ts',
  'src/routes/index.ts',
  'src/routes/auth.routes.ts',
  'src/routes/product.routes.ts',
  'src/routes/cart.routes.ts',
  'src/routes/order.routes.ts',
  'src/controllers/auth.controller.ts',
  'src/controllers/product.controller.ts',
  'src/controllers/cart.controller.ts',
  'src/controllers/order.controller.ts',
  'src/middlewares/auth.middleware.ts',
  'src/middlewares/error.middleware.ts',
  'src/middlewares/validation.middleware.ts',
  'src/config/index.ts',
  'src/types/index.ts',
];

for (const bf of requiredBackendFiles) {
  const p = path.join(baseDir, 'backend', bf);
  assert(fs.existsSync(p), `Backend file missing: ${bf}`);
}
console.log(`✓ Backend Skeleton: ${requiredBackendFiles.length} files verified`);

// 4. Verify Frontend Skeleton
const requiredFrontendFiles = [
  'package.json',
  'tsconfig.json',
  'tailwind.config.ts',
  'postcss.config.js',
  'next.config.js',
  '.env.example',
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/globals.css',
  'src/app/auth/login/page.tsx',
  'src/app/auth/register/page.tsx',
  'src/app/products/[id]/page.tsx',
  'src/app/cart/page.tsx',
  'src/app/checkout/page.tsx',
  'src/app/orders/page.tsx',
  'src/components/Navbar.tsx',
  'src/components/ProductCard.tsx',
  'src/lib/api-client.ts',
  'src/lib/auth-context.tsx',
  'src/types/index.ts',
];

for (const ff of requiredFrontendFiles) {
  const p = path.join(baseDir, 'frontend', ff);
  assert(fs.existsSync(p), `Frontend file missing: ${ff}`);
}
console.log(`✓ Frontend Skeleton: ${requiredFrontendFiles.length} files verified`);

console.log('--- ALL ARCHITECTURE VERIFICATION CHECKS PASSED ---');
