import assert from 'node:assert/strict';
import http from 'node:http';
import { createMarketplaceApp } from './server.ts';

// HTTP Request Helper
function request(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const method = options.method || 'GET';
    const payload = options.body !== undefined ? JSON.stringify(options.body) : null;

    const reqHeaders: Record<string, string> = {
      ...(options.headers || {}),
    };
    if (payload !== null) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = String(Buffer.byteLength(payload));
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

export interface TestResult {
  category: string;
  testId: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  details: string;
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('PHASE 7: QA & PENETRATION BUG HUNTING SUITE');
  console.log('Target: Marketplace Backend (Node.js/TypeScript)');
  console.log('====================================================\n');

  const results: TestResult[] = [];

  const { server, store, rateLimiter } = createMarketplaceApp({ windowMs: 10_000, maxRequests: 100 });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Target running at: ${baseUrl}\n`);

  try {
    // ----------------------------------------------------
    // CATEGORY 1: FUNCTIONAL VERIFICATION
    // ----------------------------------------------------
    console.log('--- CATEGORY 1: FUNCTIONAL VERIFICATION ---');

    // 1.1 Health Check
    {
      const res = await request(baseUrl, '/health');
      if (res.status === 200 && res.body?.status === 'healthy') {
        results.push({
          category: 'Functional',
          testId: 'TC-FUNC-01',
          name: 'Health check endpoint returns 200 and healthy status',
          status: 'PASS',
          severity: 'INFO',
          details: `Status 200, uptime: ${res.body.uptime}s`,
        });
      } else {
        results.push({
          category: 'Functional',
          testId: 'TC-FUNC-01',
          name: 'Health check endpoint returns 200 and healthy status',
          status: 'FAIL',
          severity: 'HIGH',
          details: `Expected 200, got ${res.status}`,
        });
      }
    }

    // 1.2 Product CRUD
    let sampleProdId = '';
    {
      const createRes = await request(baseUrl, '/api/products', {
        method: 'POST',
        body: { name: 'Ergonomic Chair', price: 250, stock: 10, description: 'Lumbar support' },
      });
      if (createRes.status === 201 && createRes.body?.data?.id) {
        sampleProdId = createRes.body.data.id;
        results.push({
          category: 'Functional',
          testId: 'TC-FUNC-02',
          name: 'Product creation with valid payload',
          status: 'PASS',
          severity: 'INFO',
          details: `Created product ${sampleProdId} with stock 10`,
        });
      } else {
        results.push({
          category: 'Functional',
          testId: 'TC-FUNC-02',
          name: 'Product creation with valid payload',
          status: 'FAIL',
          severity: 'HIGH',
          details: `Failed to create product. Status: ${createRes.status}`,
        });
      }
    }

    // 1.3 Product Search / Filter
    {
      const filterRes = await request(baseUrl, '/api/products?q=ergonomic');
      if (filterRes.status === 200 && filterRes.body?.count === 1) {
        results.push({
          category: 'Functional',
          testId: 'TC-FUNC-03',
          name: 'Product search filtering by query parameter',
          status: 'PASS',
          severity: 'INFO',
          details: `Successfully filtered 1 product by query 'ergonomic'`,
        });
      } else {
        results.push({
          category: 'Functional',
          testId: 'TC-FUNC-03',
          name: 'Product search filtering by query parameter',
          status: 'FAIL',
          severity: 'MEDIUM',
          details: `Filter failed or count mismatch: ${filterRes.body?.count}`,
        });
      }
    }

    // 1.4 Cart Flow: Add item
    {
      const cartRes = await request(baseUrl, '/api/cart/items', {
        method: 'POST',
        headers: { 'x-user-id': 'user-qa-1' },
        body: { productId: sampleProdId, quantity: 2 },
      });
      if (cartRes.status === 200 && cartRes.body?.data?.items?.length === 1) {
        results.push({
          category: 'Functional',
          testId: 'TC-FUNC-04',
          name: 'Add item to shopping cart',
          status: 'PASS',
          severity: 'INFO',
          details: `Cart updated with 2 units of ${sampleProdId}`,
        });
      } else {
        results.push({
          category: 'Functional',
          testId: 'TC-FUNC-04',
          name: 'Add item to shopping cart',
          status: 'FAIL',
          severity: 'HIGH',
          details: `Status: ${cartRes.status}`,
        });
      }
    }

    // 1.5 Order Checkout Flow
    let orderId = '';
    {
      const checkoutRes = await request(baseUrl, '/api/orders/checkout', {
        method: 'POST',
        headers: { 'x-user-id': 'user-qa-1' },
      });
      if (checkoutRes.status === 201 && checkoutRes.body?.data?.id) {
        orderId = checkoutRes.body.data.id;
        const prod = store.products.get(sampleProdId);
        results.push({
          category: 'Functional',
          testId: 'TC-FUNC-05',
          name: 'Checkout cart and reserve stock',
          status: 'PASS',
          severity: 'INFO',
          details: `Order ${orderId} created. Stock deducted from 10 to ${prod?.stock}`,
        });
      } else {
        results.push({
          category: 'Functional',
          testId: 'TC-FUNC-05',
          name: 'Checkout cart and reserve stock',
          status: 'FAIL',
          severity: 'CRITICAL',
          details: `Checkout failed. Status: ${checkoutRes.status}`,
        });
      }
    }

    // 1.6 Payment Execution Flow
    {
      const payRes = await request(baseUrl, '/api/payments/pay', {
        method: 'POST',
        body: { orderId, amount: 500, paymentMethod: 'credit_card' },
      });
      if (payRes.status === 200 && payRes.body?.data?.order?.status === 'PAID') {
        results.push({
          category: 'Functional',
          testId: 'TC-FUNC-06',
          name: 'Payment processing transitions order to PAID',
          status: 'PASS',
          severity: 'INFO',
          details: `Payment success. Order marked PAID with txnRef ${payRes.body.data.payment.transactionRef}`,
        });
      } else {
        results.push({
          category: 'Functional',
          testId: 'TC-FUNC-06',
          name: 'Payment processing transitions order to PAID',
          status: 'FAIL',
          severity: 'HIGH',
          details: `Payment failed. Status: ${payRes.status}`,
        });
      }
    }

    // ----------------------------------------------------
    // CATEGORY 2: CART & CHECKOUT EDGE CASES / INVENTORY
    // ----------------------------------------------------
    console.log('--- CATEGORY 2: CART & CHECKOUT EDGE CASES ---');

    // 2.1 Float / Fractional Quantity Injection
    {
      const floatCart = await request(baseUrl, '/api/cart/items', {
        method: 'POST',
        headers: { 'x-user-id': 'user-qa-float' },
        body: { productId: sampleProdId, quantity: 1.5 },
      });
      if (floatCart.status === 200) {
        const item = floatCart.body?.data?.items?.find((i: any) => i.productId === sampleProdId);
        results.push({
          category: 'EdgeCases',
          testId: 'TC-EDGE-01',
          name: 'Acceptance of Fractional / Float Quantity in Cart',
          status: 'FAIL',
          severity: 'HIGH',
          details: `BUG FOUND: System accepted fractional quantity ${item?.quantity}. Allows ordering non-discrete physical goods (e.g. 1.5 chairs). Missing integer check.`,
        });
      } else {
        results.push({
          category: 'EdgeCases',
          testId: 'TC-EDGE-01',
          name: 'Acceptance of Fractional / Float Quantity in Cart',
          status: 'PASS',
          severity: 'INFO',
          details: `Rejected fractional quantity with status ${floatCart.status}`,
        });
      }
    }

    // 2.2 Numeric NaN Injection in Product Creation & Update
    {
      const nanProd = await request(baseUrl, '/api/products', {
        method: 'POST',
        body: { name: 'NaN Test Item', price: NaN, stock: 10 },
      });
      // In JSON, NaN serializes to null, but let's test null or direct update
      const nullPrice = await request(baseUrl, '/api/products', {
        method: 'POST',
        body: { name: 'Null Price Item', price: null, stock: 10 },
      });
      if (nullPrice.status === 201) {
        results.push({
          category: 'EdgeCases',
          testId: 'TC-EDGE-02',
          name: 'Null / Non-numeric Price Acceptance in Product Creation',
          status: 'FAIL',
          severity: 'MEDIUM',
          details: `BUG FOUND: Accepted null price in product creation.`,
        });
      } else {
        results.push({
          category: 'EdgeCases',
          testId: 'TC-EDGE-02',
          name: 'Null / Non-numeric Price Validation',
          status: 'PASS',
          severity: 'INFO',
          details: `Correctly rejected invalid price with status ${nullPrice.status}`,
        });
      }
    }

    // 2.3 CRITICAL INVENTORY LEAK: Failed Payment Locks Stock Permanently
    {
      // Create new product with stock 5
      const prodRes = await request(baseUrl, '/api/products', {
        method: 'POST',
        body: { name: 'Rare Limited Item', price: 100, stock: 5 },
      });
      const rareId = prodRes.body.data.id;

      // Add to cart & checkout 3 items
      await request(baseUrl, '/api/cart/items', {
        method: 'POST',
        headers: { 'x-user-id': 'victim-user' },
        body: { productId: rareId, quantity: 3 },
      });
      const checkoutRes = await request(baseUrl, '/api/orders/checkout', {
        method: 'POST',
        headers: { 'x-user-id': 'victim-user' },
      });
      const leakedOrderId = checkoutRes.body.data.id;
      const stockAfterCheckout = store.products.get(rareId)?.stock; // should be 2

      // Simulate Failed Payment
      const failPayRes = await request(baseUrl, '/api/payments/pay', {
        method: 'POST',
        body: { orderId: leakedOrderId, amount: 300, paymentMethod: 'credit_card', simulateFailure: true },
      });

      // Verify status is FAILED
      const orderAfterFail = store.orders.get(leakedOrderId);
      const stockAfterFail = store.products.get(rareId)?.stock;

      // Try to cancel FAILED order to recover stock
      const cancelAttempt = await request(baseUrl, `/api/orders/${leakedOrderId}/cancel`, {
        method: 'POST',
      });

      if (orderAfterFail?.status === 'FAILED' && stockAfterFail === 2 && cancelAttempt.status === 400) {
        results.push({
          category: 'EdgeCases',
          testId: 'TC-EDGE-03',
          name: 'Inventory Leak: Failed Payment Permanently Deducts Stock Without Recovery Mechanism',
          status: 'FAIL',
          severity: 'CRITICAL',
          details: `CRITICAL BUG: Stock was deducted from 5 to 2 during checkout. Payment failed (status FAILED), but stock was NEVER restored. Canceling FAILED order returns 400 ('Cannot cancel order with status FAILED'). Stock is permanently lost to merchant inventory!`,
        });
      } else {
        results.push({
          category: 'EdgeCases',
          testId: 'TC-EDGE-03',
          name: 'Inventory Leak: Failed Payment Stock Recovery',
          status: 'PASS',
          severity: 'INFO',
          details: `Stock properly restored on payment failure or cancellation.`,
        });
      }
    }

    // 2.4 Deleted Product in User Cart causes Permanent Checkout Lockout
    {
      const tempProd = await request(baseUrl, '/api/products', {
        method: 'POST',
        body: { name: 'Temporary Item', price: 50, stock: 5 },
      });
      const tempId = tempProd.body.data.id;

      await request(baseUrl, '/api/cart/items', {
        method: 'POST',
        headers: { 'x-user-id': 'cart-user-2' },
        body: { productId: tempId, quantity: 1 },
      });

      // Admin deletes product
      await request(baseUrl, `/api/products/${tempId}`, { method: 'DELETE' });

      // User tries to checkout
      const blockedCheckout = await request(baseUrl, '/api/orders/checkout', {
        method: 'POST',
        headers: { 'x-user-id': 'cart-user-2' },
      });

      // Check if cart is purged or still stuck with invalid product
      const userCart = store.carts.get('cart-user-2');
      if (blockedCheckout.status === 400 && userCart?.items?.some((i) => i.productId === tempId)) {
        results.push({
          category: 'EdgeCases',
          testId: 'TC-EDGE-04',
          name: 'Orphaned Deleted Products in Cart Block Future Checkout',
          status: 'FAIL',
          severity: 'MEDIUM',
          details: `BUG FOUND: Deleting a product does not evict it from active user carts. Checkout fails with 'Product no longer exists', but the orphaned item remains in the cart, preventing checkout until manual deletion.`,
        });
      } else {
        results.push({
          category: 'EdgeCases',
          testId: 'TC-EDGE-04',
          name: 'Orphaned Product Handling in Cart',
          status: 'PASS',
          severity: 'INFO',
          details: `Orphaned items cleaned gracefully.`,
        });
      }
    }

    // 2.5 Price Desynchronization between Cart Display and Checkout
    {
      const priceProd = await request(baseUrl, '/api/products', {
        method: 'POST',
        body: { name: 'Discount Item', price: 100, stock: 10 },
      });
      const pId = priceProd.body.data.id;

      await request(baseUrl, '/api/cart/items', {
        method: 'POST',
        headers: { 'x-user-id': 'price-user' },
        body: { productId: pId, quantity: 1 },
      });

      // Price changes in product catalog
      await request(baseUrl, `/api/products/${pId}`, {
        method: 'PUT',
        body: { price: 150 },
      });

      // View cart
      const viewCart = await request(baseUrl, '/api/cart', {
        headers: { 'x-user-id': 'price-user' },
      });
      // In cart: unitPrice is 100, totalAmount is 100
      // In checkout: totalAmount will be 150!
      const cartDisplayTotal = viewCart.body?.data?.totalAmount;

      const checkoutRes = await request(baseUrl, '/api/orders/checkout', {
        method: 'POST',
        headers: { 'x-user-id': 'price-user' },
      });
      const checkoutTotal = checkoutRes.body?.data?.totalAmount;

      if (cartDisplayTotal === 100 && checkoutTotal === 150) {
        results.push({
          category: 'EdgeCases',
          testId: 'TC-EDGE-05',
          name: 'Price Desync: Cart Display Total Discrepancy with Checkout Total',
          status: 'FAIL',
          severity: 'MEDIUM',
          details: `BUG FOUND: Cart displays cached unitPrice (100), but checkout computes against live product price (150). Customer sees price change without explicit re-confirmation or warning.`,
        });
      } else {
        results.push({
          category: 'EdgeCases',
          testId: 'TC-EDGE-05',
          name: 'Price Desync between Cart and Checkout',
          status: 'PASS',
          severity: 'INFO',
          details: `Prices synchronized.`,
        });
      }
    }

    // ----------------------------------------------------
    // CATEGORY 3: SECURITY & PENETRATION AUDIT (OWASP)
    // ----------------------------------------------------
    console.log('--- CATEGORY 3: SECURITY & PENETRATION AUDIT ---');

    // 3.1 Rate Limiter Spoofing / IP Bypass (X-Forwarded-For)
    {
      const testLimiterApp = createMarketplaceApp({ windowMs: 60_000, maxRequests: 2 });
      await new Promise<void>((r) => testLimiterApp.server.listen(0, r));
      const testPort = (testLimiterApp.server.address() as any).port;
      const testBase = `http://127.0.0.1:${testPort}`;

      // Exhaust limit
      await request(testBase, '/api/products', { headers: { 'x-forwarded-for': '203.0.113.1' } });
      await request(testBase, '/api/products', { headers: { 'x-forwarded-for': '203.0.113.1' } });
      const blocked = await request(testBase, '/api/products', { headers: { 'x-forwarded-for': '203.0.113.1' } });

      // Spoof next header
      const bypass = await request(testBase, '/api/products', { headers: { 'x-forwarded-for': '203.0.113.2' } });

      testLimiterApp.server.close();

      if (blocked.status === 429 && bypass.status === 200) {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-01',
          name: 'OWASP A07: Rate Limiter Bypass via Client-Controlled X-Forwarded-For Header',
          status: 'FAIL',
          severity: 'HIGH',
          details: `VULNERABILITY CONFIRMED: Rate limiter trusts untrusted client header 'X-Forwarded-For'. An attacker can rotate spoofed IP headers to completely circumvent rate limits and perform DoS or brute force.`,
        });
      } else {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-01',
          name: 'Rate Limiter Header Trust',
          status: 'PASS',
          severity: 'INFO',
          details: `Rate limiter resists header spoofing.`,
        });
      }
    }

    // 3.2 Broken Access Control: Unauthenticated Admin Operations
    {
      const unauthProdCreate = await request(baseUrl, '/api/products', {
        method: 'POST',
        body: { name: 'Hacked Product by Guest', price: 999, stock: 1 },
      });
      const unauthDelete = await request(baseUrl, `/api/products/${unauthProdCreate.body?.data?.id}`, {
        method: 'DELETE',
      });

      if (unauthProdCreate.status === 201 && unauthDelete.status === 200) {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-02',
          name: 'OWASP A01: Broken Access Control - Unauthenticated Admin Operations (Product Creation & Deletion)',
          status: 'FAIL',
          severity: 'CRITICAL',
          details: `CRITICAL VULNERABILITY: Product creation, modification, and deletion endpoints have ZERO authentication or RBAC guards. Any anonymous visitor can alter prices, stock, or purge the product database.`,
        });
      } else {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-02',
          name: 'RBAC Enforcement on Product Mutation',
          status: 'PASS',
          severity: 'INFO',
          details: `Admin endpoints require proper role authentication.`,
        });
      }
    }

    // 3.3 Broken Access Control / IDOR: Sensitive Order Data Leakage (GET /api/orders)
    {
      // An anonymous user requests GET /api/orders without any params
      const leakRes = await request(baseUrl, '/api/orders');
      if (leakRes.status === 200 && Array.isArray(leakRes.body?.data) && leakRes.body.data.length > 0) {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-03',
          name: 'OWASP A01: Broken Access Control / IDOR - Unauthenticated Global Order Leakage',
          status: 'FAIL',
          severity: 'CRITICAL',
          details: `CRITICAL VULNERABILITY: 'GET /api/orders' with no userId parameter exposes all orders across all customers in the system, leaking customer IDs, order amounts, and purchased products to anonymous callers.`,
        });
      } else {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-03',
          name: 'Order Listing Scoped by Authenticated Identity',
          status: 'PASS',
          severity: 'INFO',
          details: `Order list properly scoped.`,
        });
      }
    }

    // 3.4 IDOR: Order Details accessible by any user without ownership check
    {
      const orderDetailRes = await request(baseUrl, `/api/orders/${orderId}`, {
        headers: { 'x-user-id': 'unrelated-stranger' },
      });
      if (orderDetailRes.status === 200 && orderDetailRes.body?.data?.id === orderId) {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-04',
          name: 'OWASP A01: Broken Access Control - Order Detail IDOR (No Ownership Verification)',
          status: 'FAIL',
          severity: 'HIGH',
          details: `VULNERABILITY CONFIRMED: 'GET /api/orders/:id' does not verify whether the requesting user owns the order or possesses ADMIN privileges. Any user knowing or guessing an order UUID can view complete order details.`,
        });
      } else {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-04',
          name: 'Order Detail Ownership Verification',
          status: 'PASS',
          severity: 'INFO',
          details: `Access denied to non-owners.`,
        });
      }
    }

    // 3.5 Identity Spoofing via Arbitrary Request Header / Query Param
    {
      const spoofCart = await request(baseUrl, '/api/cart', {
        headers: { 'x-user-id': 'admin' },
      });
      if (spoofCart.status === 200 && spoofCart.body?.data?.userId === 'admin') {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-05',
          name: 'OWASP A07: Identification and Authentication Failure - Arbitrary Identity Spoofing',
          status: 'FAIL',
          severity: 'CRITICAL',
          details: `CRITICAL VULNERABILITY: Identity is derived directly from unauthenticated client headers ('x-user-id') or query strings ('?userId='). Missing cryptographic session validation (JWT Bearer tokens).`,
        });
      } else {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-05',
          name: 'Cryptographic Identity Verification',
          status: 'PASS',
          severity: 'INFO',
          details: `Identity verified cryptographically.`,
        });
      }
    }

    // 3.6 Stored XSS Payload Acceptance in Product Fields
    {
      const xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
      const xssProd = await request(baseUrl, '/api/products', {
        method: 'POST',
        body: { name: xssPayload, price: 99, stock: 5, description: xssPayload },
      });
      if (xssProd.status === 201 && xssProd.body?.data?.name === xssPayload) {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-06',
          name: 'OWASP A03: Injection - Stored Cross-Site Scripting (XSS) in Product Catalog',
          status: 'FAIL',
          severity: 'HIGH',
          details: `VULNERABILITY CONFIRMED: Server stores raw HTML tags and JavaScript event handlers in product name and description without sanitization. If rendered without strict escaping in frontend, leads to stored XSS execution.`,
        });
      } else {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-06',
          name: 'Input Sanitization against Stored XSS',
          status: 'PASS',
          severity: 'INFO',
          details: `HTML/Script tags sanitized or escaped.`,
        });
      }
    }

    // 3.7 Missing Security Headers (OWASP A05: Security Misconfiguration)
    {
      const rootRes = await request(baseUrl, '/health');
      const missingHeaders: string[] = [];
      if (!rootRes.headers['x-content-type-options']) missingHeaders.push('X-Content-Type-Options');
      if (!rootRes.headers['x-frame-options']) missingHeaders.push('X-Frame-Options');
      if (!rootRes.headers['content-security-policy']) missingHeaders.push('Content-Security-Policy');

      if (missingHeaders.length > 0) {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-07',
          name: 'OWASP A05: Security Misconfiguration - Missing Hardening Headers (Helmet)',
          status: 'WARN',
          severity: 'MEDIUM',
          details: `WARNING: Server does not emit standard security headers: ${missingHeaders.join(', ')}. Vulnerable to MIME sniffing and clickjacking.`,
        });
      } else {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-07',
          name: 'HTTP Security Headers Presence',
          status: 'PASS',
          severity: 'INFO',
          details: `All essential security headers present.`,
        });
      }
    }

    // 3.8 Missing Idempotency-Key Support (Engineering Mandate Violation)
    {
      const prodRes = await request(baseUrl, '/api/products', {
        method: 'POST',
        body: { name: 'Idempotent Test Item', price: 100, stock: 10 },
      });
      const pId = prodRes.body.data.id;

      // Add to cart
      await request(baseUrl, '/api/cart/items', {
        method: 'POST',
        headers: { 'x-user-id': 'idempotent-user' },
        body: { productId: pId, quantity: 1 },
      });

      // Send checkout with Idempotency-Key
      const chk1 = await request(baseUrl, '/api/orders/checkout', {
        method: 'POST',
        headers: {
          'x-user-id': 'idempotent-user',
          'Idempotency-Key': 'IDEM-KEY-99999',
        },
      });

      // Add to cart again
      await request(baseUrl, '/api/cart/items', {
        method: 'POST',
        headers: { 'x-user-id': 'idempotent-user' },
        body: { productId: pId, quantity: 1 },
      });

      // Send checkout with the SAME Idempotency-Key
      const chk2 = await request(baseUrl, '/api/orders/checkout', {
        method: 'POST',
        headers: {
          'x-user-id': 'idempotent-user',
          'Idempotency-Key': 'IDEM-KEY-99999',
        },
      });

      if (chk1.status === 201 && chk2.status === 201 && chk1.body.data.id !== chk2.body.data.id) {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-08',
          name: 'Violation of Mandate: Missing Idempotency-Key Support on Checkout Endpoint',
          status: 'FAIL',
          severity: 'HIGH',
          details: `SPEC VIOLATION: Endpoint created two distinct orders (${chk1.body.data.id} and ${chk2.body.data.id}) despite identical 'Idempotency-Key'. Duplicate orders occur on client retries.`,
        });
      } else {
        results.push({
          category: 'Security',
          testId: 'TC-SEC-08',
          name: 'Idempotency-Key Enforcement on Checkout',
          status: 'PASS',
          severity: 'INFO',
          details: `Idempotent checkout properly handled.`,
        });
      }
    }

    // ----------------------------------------------------
    // CATEGORY 4: CONCURRENCY & RACE CONDITIONS
    // ----------------------------------------------------
    console.log('--- CATEGORY 4: CONCURRENCY & RACE CONDITIONS ---');

    // 4.1 Race Condition: Concurrent Checkout Exceeding Available Stock
    {
      const flashProd = await request(baseUrl, '/api/products', {
        method: 'POST',
        body: { name: 'Flash Sale Console', price: 500, stock: 1 },
      });
      const flashId = flashProd.body.data.id;

      // User A and User B put the 1 available unit in their cart
      await request(baseUrl, '/api/cart/items', {
        method: 'POST',
        headers: { 'x-user-id': 'buyer-alice' },
        body: { productId: flashId, quantity: 1 },
      });
      await request(baseUrl, '/api/cart/items', {
        method: 'POST',
        headers: { 'x-user-id': 'buyer-bob' },
        body: { productId: flashId, quantity: 1 },
      });

      // Both fire checkout simultaneously
      const [resAlice, resBob] = await Promise.all([
        request(baseUrl, '/api/orders/checkout', {
          method: 'POST',
          headers: { 'x-user-id': 'buyer-alice' },
        }),
        request(baseUrl, '/api/orders/checkout', {
          method: 'POST',
          headers: { 'x-user-id': 'buyer-bob' },
        }),
      ]);

      const successCount = (resAlice.status === 201 ? 1 : 0) + (resBob.status === 201 ? 1 : 0);
      const remainingStock = store.products.get(flashId)?.stock;

      if (successCount === 1 && remainingStock === 0) {
        results.push({
          category: 'Concurrency',
          testId: 'TC-CONC-01',
          name: 'Concurrency: Single-Item Checkout Over-Selling Prevention',
          status: 'PASS',
          severity: 'INFO',
          details: `Synchronous event loop handled sequential checkouts correctly: 1 success (201), 1 rejected (400), final stock = 0.`,
        });
      } else {
        results.push({
          category: 'Concurrency',
          testId: 'TC-CONC-01',
          name: 'Concurrency: Single-Item Checkout Over-Selling Prevention',
          status: 'FAIL',
          severity: 'CRITICAL',
          details: `RACE CONDITION: ${successCount} orders succeeded for 1 stock item. Final stock: ${remainingStock}.`,
        });
      }
    }

  } finally {
    server.close();
  }

  // Summary Report
  console.log('\n====================================================');
  console.log('QA BUG HUNTING & PENETRATION AUDIT SUMMARY RESULTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;
  let warned = 0;

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅ PASS' : r.status === 'FAIL' ? '❌ FAIL' : '⚠️ WARN';
    console.log(`[${r.testId}] [${r.status}] [${r.severity}] ${r.name}`);
    console.log(`   Details: ${r.details}\n`);

    if (r.status === 'PASS') passed++;
    else if (r.status === 'FAIL') failed++;
    else warned++;
  }

  console.log('----------------------------------------------------');
  console.log(`Total Checks: ${results.length} | PASSED: ${passed} | FAILED: ${failed} | WARNINGS: ${warned}`);
  console.log('----------------------------------------------------');

  return results;
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
