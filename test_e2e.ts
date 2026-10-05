import assert from 'node:assert/strict';
import http from 'node:http';
import { createMarketplaceApp } from './server.ts';

// Helper for HTTP requests
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
    const payload = options.body ? JSON.stringify(options.body) : null;

    const reqHeaders: Record<string, string> = {
      ...(options.headers || {}),
    };
    if (payload) {
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
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Marketplace E2E Tests ---');

  // Set rate limit for test: 50 requests per window
  const { server, store, rateLimiter } = createMarketplaceApp({ windowMs: 10_000, maxRequests: 50 });
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running on ${baseUrl}`);

  try {
    // 1. Health check
    console.log('[Test 1] Health check');
    const health = await request(baseUrl, '/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'healthy');

    // 2. Real-Time Streaming (SSE)
    console.log('[Test 2] Real-Time Streaming API (SSE)');
    const sseReceived: any[] = [];
    const sseUrl = new URL('/api/events/stream', baseUrl);
    const sseReq = http.request(sseUrl, { method: 'GET' }, (res) => {
      assert.equal(res.statusCode, 200);
      assert.match(res.headers['content-type'] || '', /text\/event-stream/);

      res.on('data', (chunk: Buffer) => {
        const lines = chunk.toString('utf-8').split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              sseReceived.push(JSON.parse(line.substring(6)));
            } catch {}
          }
        }
      });
    });
    sseReq.end();

    // Allow SSE connection to establish
    await new Promise((r) => setTimeout(r, 200));
    assert(sseReceived.length >= 1, 'Initial CONNECTED SSE event received');
    assert.equal(sseReceived[0].type, 'CONNECTED');

    // 3. Product CRUD
    console.log('[Test 3] Product CRUD');

    // Validation: missing name
    const invalidProd1 = await request(baseUrl, '/api/products', {
      method: 'POST',
      body: { price: 100, stock: 10 },
    });
    assert.equal(invalidProd1.status, 400);

    // Validation: negative price
    const invalidProd2 = await request(baseUrl, '/api/products', {
      method: 'POST',
      body: { name: 'Bad Item', price: -5, stock: 10 },
    });
    assert.equal(invalidProd2.status, 400);

    // Create Product A
    const prodA = await request(baseUrl, '/api/products', {
      method: 'POST',
      body: { name: 'Mechanical Keyboard', price: 120, stock: 15, description: 'RGB hot-swap' },
    });
    assert.equal(prodA.status, 201);
    const prodAId = prodA.body.data.id;
    assert.equal(prodA.body.data.name, 'Mechanical Keyboard');
    assert.equal(prodA.body.data.stock, 15);

    // Create Product B
    const prodB = await request(baseUrl, '/api/products', {
      method: 'POST',
      body: { name: 'Wireless Mouse', price: 60, stock: 5 },
    });
    assert.equal(prodB.status, 201);
    const prodBId = prodB.body.data.id;

    // List products
    const prodList = await request(baseUrl, '/api/products');
    assert.equal(prodList.status, 200);
    assert.equal(prodList.body.count, 2);

    // Filter products
    const prodSearch = await request(baseUrl, '/api/products?q=keyboard');
    assert.equal(prodSearch.status, 200);
    assert.equal(prodSearch.body.count, 1);
    assert.equal(prodSearch.body.data[0].id, prodAId);

    // Get Single Product
    const getProd = await request(baseUrl, `/api/products/${prodAId}`);
    assert.equal(getProd.status, 200);
    assert.equal(getProd.body.data.name, 'Mechanical Keyboard');

    // Update Product
    const updateProd = await request(baseUrl, `/api/products/${prodAId}`, {
      method: 'PUT',
      body: { price: 130, stock: 20 },
    });
    assert.equal(updateProd.status, 200);
    assert.equal(updateProd.body.data.price, 130);
    assert.equal(updateProd.body.data.stock, 20);

    // 4. Cart Management
    console.log('[Test 4] Cart Management');
    const userHeader = { 'x-user-id': 'user-123' };

    // Get empty cart
    const emptyCart = await request(baseUrl, '/api/cart', { headers: userHeader });
    assert.equal(emptyCart.status, 200);
    assert.equal(emptyCart.body.data.items.length, 0);

    // Add item to cart
    const addCart1 = await request(baseUrl, '/api/cart/items', {
      method: 'POST',
      headers: userHeader,
      body: { productId: prodAId, quantity: 2 },
    });
    assert.equal(addCart1.status, 200);
    assert.equal(addCart1.body.data.items.length, 1);
    assert.equal(addCart1.body.data.items[0].quantity, 2);

    // Add more of item A
    const addCart2 = await request(baseUrl, '/api/cart/items', {
      method: 'POST',
      headers: userHeader,
      body: { productId: prodAId, quantity: 1 },
    });
    assert.equal(addCart2.status, 200);
    assert.equal(addCart2.body.data.items[0].quantity, 3);

    // Add item B
    const addCart3 = await request(baseUrl, '/api/cart/items', {
      method: 'POST',
      headers: userHeader,
      body: { productId: prodBId, quantity: 2 },
    });
    assert.equal(addCart3.status, 200);
    assert.equal(addCart3.body.data.items.length, 2);

    // Exceed stock validation
    const exceedCart = await request(baseUrl, '/api/cart/items', {
      method: 'POST',
      headers: userHeader,
      body: { productId: prodBId, quantity: 100 },
    });
    assert.equal(exceedCart.status, 400);
    assert.equal(exceedCart.body.error, 'Insufficient Stock');

    // View cart
    const viewCart = await request(baseUrl, '/api/cart', { headers: userHeader });
    assert.equal(viewCart.status, 200);
    assert.equal(viewCart.body.data.totalItems, 5); // 3 of A + 2 of B
    assert.equal(viewCart.body.data.totalAmount, 3 * 130 + 2 * 60); // 390 + 120 = 510

    // Remove item B from cart
    const removeCartItem = await request(baseUrl, `/api/cart/items/${prodBId}`, {
      method: 'DELETE',
      headers: userHeader,
    });
    assert.equal(removeCartItem.status, 200);
    assert.equal(removeCartItem.body.data.items.length, 1);

    // Re-add item B for order checkout test
    await request(baseUrl, '/api/cart/items', {
      method: 'POST',
      headers: userHeader,
      body: { productId: prodBId, quantity: 1 },
    });

    // 5. Order Processing
    console.log('[Test 5] Order Processing & Stock Reservation');

    // Checkout cart (3 of Prod A @ $130, 1 of Prod B @ $60 -> Total: $450)
    const checkout = await request(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: userHeader,
    });
    assert.equal(checkout.status, 201);
    const order = checkout.body.data;
    assert.equal(order.status, 'PENDING');
    assert.equal(order.totalAmount, 450);
    assert.equal(order.items.length, 2);

    // Verify stock deducted
    const checkStockA = await request(baseUrl, `/api/products/${prodAId}`);
    assert.equal(checkStockA.body.data.stock, 20 - 3); // 17

    const checkStockB = await request(baseUrl, `/api/products/${prodBId}`);
    assert.equal(checkStockB.body.data.stock, 5 - 1); // 4

    // Verify cart cleared
    const postCheckoutCart = await request(baseUrl, '/api/cart', { headers: userHeader });
    assert.equal(postCheckoutCart.body.data.items.length, 0);

    // Get order detail
    const getOrder = await request(baseUrl, `/api/orders/${order.id}`);
    assert.equal(getOrder.status, 200);
    assert.equal(getOrder.body.data.id, order.id);

    // 6. Mock Payment Gateway
    console.log('[Test 6] Mock Payment Gateway');

    // Payment validation: amount mismatch
    const badAmountPay = await request(baseUrl, '/api/payments/pay', {
      method: 'POST',
      body: {
        orderId: order.id,
        amount: 200, // Should be 450
        paymentMethod: 'credit_card',
      },
    });
    assert.equal(badAmountPay.status, 400);

    // Successful payment
    const goodPay = await request(baseUrl, '/api/payments/pay', {
      method: 'POST',
      body: {
        orderId: order.id,
        amount: 450,
        paymentMethod: 'bank_transfer',
      },
    });
    assert.equal(goodPay.status, 200);
    assert.equal(goodPay.body.data.payment.status, 'SUCCESS');
    assert.equal(goodPay.body.data.order.status, 'PAID');
    assert.match(goodPay.body.data.payment.transactionRef, /^TXN-/);

    // Verify order status is PAID in store
    const checkPaidOrder = await request(baseUrl, `/api/orders/${order.id}`);
    assert.equal(checkPaidOrder.body.data.status, 'PAID');

    // Cannot pay already PAID order
    const repeatPay = await request(baseUrl, '/api/payments/pay', {
      method: 'POST',
      body: { orderId: order.id, amount: 450 },
    });
    assert.equal(repeatPay.status, 400);

    // 7. Order Cancellation & Stock Restoration
    console.log('[Test 7] Order Cancellation & Stock Restoration');
    // Add product to cart and checkout new order
    await request(baseUrl, '/api/cart/items', {
      method: 'POST',
      headers: userHeader,
      body: { productId: prodBId, quantity: 2 },
    });
    const order2Res = await request(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: userHeader,
    });
    const order2 = order2Res.body.data;
    assert.equal(order2.status, 'PENDING');

    // Stock for B was 4, now 2
    const checkStockBBeforeCancel = await request(baseUrl, `/api/products/${prodBId}`);
    assert.equal(checkStockBBeforeCancel.body.data.stock, 2);

    // Cancel order
    const cancelRes = await request(baseUrl, `/api/orders/${order2.id}/cancel`, { method: 'POST' });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.data.status, 'CANCELLED');

    // Stock for B restored to 4
    const checkStockBAfterCancel = await request(baseUrl, `/api/products/${prodBId}`);
    assert.equal(checkStockBAfterCancel.body.data.stock, 4);

    // 8. Delete Product
    console.log('[Test 8] Delete Product');
    const delProd = await request(baseUrl, `/api/products/${prodBId}`, { method: 'DELETE' });
    assert.equal(delProd.status, 200);

    const getDeleted = await request(baseUrl, `/api/products/${prodBId}`);
    assert.equal(getDeleted.status, 404);

    // 9. Verify SSE Streaming received all events
    console.log('[Test 9] Verify Real-Time SSE Events Stream');
    await new Promise((r) => setTimeout(r, 200));
    sseReq.destroy();

    const receivedTypes = sseReceived.map((e) => e.type);
    console.log('Received SSE event types:', receivedTypes);
    assert(receivedTypes.includes('CONNECTED'));
    assert(receivedTypes.includes('product_created'));
    assert(receivedTypes.includes('stock_changed'));
    assert(receivedTypes.includes('order_created'));
    assert(receivedTypes.includes('payment_success'));
    assert(receivedTypes.includes('order_paid'));
    assert(receivedTypes.includes('order_cancelled'));
    assert(receivedTypes.includes('product_deleted'));

    // 10. Rate Limiter Test
    console.log('[Test 10] Rate Limiter Enforcement');
    rateLimiter.reset();
    let hit429 = false;
    for (let i = 0; i < 60; i++) {
      const res = await request(baseUrl, '/api/products');
      if (res.status === 429) {
        hit429 = true;
        assert.equal(res.body.error, 'Too Many Requests');
        break;
      }
    }
    assert(hit429, 'Rate limiter successfully blocked requests with HTTP 429');

    console.log('--- ALL 10 TESTS PASSED SUCCESSFULLY ---');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
