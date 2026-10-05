// ponytail: In-memory store & rate limiter; migrate to PostgreSQL + Redis for multi-instance horizontal scaling
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { SECURE_HEADERS, inspectRequest, sanitizeXss } from './security.ts';
import { INDEX_HTML } from './index_html.ts';

// Types
export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  updatedAt: string;
}

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'CANCELLED' | 'FAILED';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  paymentMethod: string;
  status: 'SUCCESS' | 'FAILED';
  transactionRef: string;
  createdAt: string;
}

export interface MarketplaceEvent {
  id: string;
  type: string;
  data: unknown;
  timestamp: string;
}

export class MarketplaceStore {
  products = new Map<string, Product>();
  carts = new Map<string, Cart>();
  orders = new Map<string, Order>();
  payments = new Map<string, Payment>();
  eventBus = new EventEmitter();

  constructor(seed: boolean = false) {
    this.eventBus.setMaxListeners(100);
    if (seed) {
      this.seedDefaultProducts();
    }
  }

  seedDefaultProducts(): void {
    const now = new Date().toISOString();
    const defaults: Product[] = [
      {
        id: 'prod-cyberdeck-01',
        name: 'Neural Cyberdeck Mk IV',
        price: 750,
        stock: 12,
        description: 'Hardened dual-channel tactical cyberdeck with integrated biometric kill-switch.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod-headset-02',
        name: 'Quantum Acoustic Headset',
        price: 240,
        stock: 25,
        description: 'Zero-latency neural transducer with adaptive white-noise cancellation.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod-key-03',
        name: 'Hardware Security Key Obsidian',
        price: 95,
        stock: 50,
        description: 'FIDO2 / U2F cryptographic enclave encased in machined aerospace tungsten.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod-display-04',
        name: 'Ultra-Wide OLED Horizon 49"',
        price: 1200,
        stock: 8,
        description: '240Hz curved tactical command monitor with HDR2000 precision color reproduction.',
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const p of defaults) {
      this.products.set(p.id, p);
    }
  }

  emitEvent(type: string, data: unknown): void {
    const event: MarketplaceEvent = {
      id: randomUUID(),
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    this.eventBus.emit('event', event);
  }
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  private windowMs: number;
  private maxRequests: number;

  constructor(opts: RateLimitOptions = { windowMs: 60_000, maxRequests: 60 }) {
    this.windowMs = opts.windowMs;
    this.maxRequests = opts.maxRequests;
  }

  get limit(): number {
    return this.maxRequests;
  }

  check(key: string): { allowed: boolean; remaining: number; resetAfterMs: number } {
    const now = Date.now();
    let entry = this.hits.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + this.windowMs };
      this.hits.set(key, entry);
      return { allowed: true, remaining: this.maxRequests - 1, resetAfterMs: this.windowMs };
    }

    entry.count++;
    const remaining = Math.max(0, this.maxRequests - entry.count);
    const resetAfterMs = Math.max(0, entry.resetAt - now);

    if (entry.count > this.maxRequests) {
      return { allowed: false, remaining: 0, resetAfterMs };
    }

    return { allowed: true, remaining, resetAfterMs };
  }

  reset(): void {
    this.hits.clear();
  }
}

// Helpers
export function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  data: unknown,
  headers: Record<string, string> = {}
): void {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(payload)),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, Origin, X-Requested-With',
    ...SECURE_HEADERS,
    ...headers,
  });
  res.end(payload);
}

export function parseJsonBody(req: http.IncomingMessage, limitBytes = 1_048_576): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('Payload Too Large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const str = Buffer.concat(chunks).toString('utf-8');
        if (/"__proto__"\s*:|"constructor"\s*:|"prototype"\s*:/i.test(str)) {
          reject(new Error('Prototype pollution detected in payload'));
          return;
        }
        const parsed = JSON.parse(str);
        if (typeof parsed !== 'object' || parsed === null) {
          reject(new Error('Body must be a JSON object'));
          return;
        }
        resolve(parsed);
      } catch (err: any) {
        reject(new Error(err.message || 'Invalid JSON format'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

export function createMarketplaceApp(customRateLimit?: RateLimitOptions, seed: boolean = false) {
  const store = new MarketplaceStore(seed);
  const rateLimiter = new RateLimiter(customRateLimit || { windowMs: 60_000, maxRequests: 60 });

  const server = http.createServer(async (req, res) => {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, Origin, X-Requested-With',
        ...SECURE_HEADERS,
      });
      res.end();
      return;
    }

    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || '/', `http://${host}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    // 1. AKCA Early Request Guard (CSRF on mutation, SQLi in Query Params)
    const preCheck = inspectRequest(method, pathname, url.searchParams, req.headers as any);
    if (!preCheck.allowed) {
      sendJson(res, preCheck.statusCode || 400, {
        error: preCheck.error || 'Security Violation',
        message: preCheck.message,
      });
      return;
    }

    // 2. Rate Limiting (exclude health & sse from strict blocks)
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const rateCheck = rateLimiter.check(clientIp);

    res.setHeader('X-RateLimit-Limit', rateLimiter.limit.toString());
    res.setHeader('X-RateLimit-Remaining', rateCheck.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateCheck.resetAfterMs / 1000).toString());

    if (!rateCheck.allowed && pathname !== '/health') {
      sendJson(res, 429, {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfterMs: rateCheck.resetAfterMs,
      });
      return;
    }

    try {
      // 0. Health check
      if (pathname === '/health' && method === 'GET') {
        sendJson(res, 200, { status: 'healthy', uptime: process.uptime() });
        return;
      }

      // Serve Marketplace Frontend Web UI
      if ((pathname === '/' || pathname === '/index.html') && method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        });
        res.end(INDEX_HTML);
        return;
      }

      // 1. SSE Real-Time Streaming Endpoint
      if (pathname === '/api/events/stream' && method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          ...SECURE_HEADERS,
        });
        res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

        const listener = (event: MarketplaceEvent) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        store.eventBus.on('event', listener);

        const keepAliveTimer = setInterval(() => {
          res.write(': keepalive\n\n');
        }, 15000);

        req.on('close', () => {
          clearInterval(keepAliveTimer);
          store.eventBus.off('event', listener);
        });
        return;
      }

      // 2. Product CRUD
      // GET /api/products
      if (pathname === '/api/products' && method === 'GET') {
        const rawQ = url.searchParams.get('q');
        const q = rawQ ? (sanitizeXss(rawQ) as string).toLowerCase() : undefined;
        let list = Array.from(store.products.values());
        if (q) {
          list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
        }
        sendJson(res, 200, { data: list, count: list.length });
        return;
      }

      // POST /api/products
      if (pathname === '/api/products' && method === 'POST') {
        const rawBody = await parseJsonBody(req);
        const bodyCheck = inspectRequest(method, pathname, url.searchParams, req.headers as any, rawBody);
        if (!bodyCheck.allowed) {
          sendJson(res, bodyCheck.statusCode || 400, {
            error: bodyCheck.error || 'Security Violation',
            message: bodyCheck.message,
          });
          return;
        }

        const body = sanitizeXss(rawBody) as Record<string, any>;
        if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
          sendJson(res, 400, { error: 'Validation Error', message: 'Product name is required' });
          return;
        }
        if (typeof body.price !== 'number' || body.price <= 0) {
          sendJson(res, 400, { error: 'Validation Error', message: 'Price must be a positive number' });
          return;
        }
        if (typeof body.stock !== 'number' || body.stock < 0) {
          sendJson(res, 400, { error: 'Validation Error', message: 'Stock must be a non-negative number' });
          return;
        }

        const now = new Date().toISOString();
        const product: Product = {
          id: randomUUID(),
          name: body.name.trim(),
          price: body.price,
          stock: Math.floor(body.stock),
          description: typeof body.description === 'string' ? body.description.trim() : undefined,
          createdAt: now,
          updatedAt: now,
        };

        store.products.set(product.id, product);
        store.emitEvent('product_created', product);

        sendJson(res, 201, { data: product, message: 'Product created successfully' });
        return;
      }

      // Match /api/products/:id
      const productDetailMatch = pathname.match(/^\/api\/products\/([a-zA-Z0-9_-]+)$/);
      if (productDetailMatch) {
        const productId = productDetailMatch[1];
        const product = store.products.get(productId);

        if (method === 'GET') {
          if (!product) {
            sendJson(res, 404, { error: 'Not Found', message: `Product ${productId} not found` });
            return;
          }
          sendJson(res, 200, { data: product });
          return;
        }

        if (method === 'PUT') {
          if (!product) {
            sendJson(res, 404, { error: 'Not Found', message: `Product ${productId} not found` });
            return;
          }
          const rawBody = await parseJsonBody(req);
          const bodyCheck = inspectRequest(method, pathname, url.searchParams, req.headers as any, rawBody);
          if (!bodyCheck.allowed) {
            sendJson(res, bodyCheck.statusCode || 400, {
              error: bodyCheck.error || 'Security Violation',
              message: bodyCheck.message,
            });
            return;
          }
          const body = sanitizeXss(rawBody) as Record<string, any>;
          if (body.name !== undefined) {
            if (typeof body.name !== 'string' || body.name.trim() === '') {
              sendJson(res, 400, { error: 'Validation Error', message: 'Product name cannot be empty' });
              return;
            }
            product.name = body.name.trim();
          }
          if (body.price !== undefined) {
            if (typeof body.price !== 'number' || body.price <= 0) {
              sendJson(res, 400, { error: 'Validation Error', message: 'Price must be a positive number' });
              return;
            }
            product.price = body.price;
          }
          if (body.stock !== undefined) {
            if (typeof body.stock !== 'number' || body.stock < 0) {
              sendJson(res, 400, { error: 'Validation Error', message: 'Stock must be a non-negative number' });
              return;
            }
            product.stock = Math.floor(body.stock);
          }
          if (body.description !== undefined) {
            product.description = typeof body.description === 'string' ? body.description.trim() : undefined;
          }

          product.updatedAt = new Date().toISOString();
          store.products.set(productId, product);
          store.emitEvent('product_updated', product);

          sendJson(res, 200, { data: product, message: 'Product updated successfully' });
          return;
        }

        if (method === 'DELETE') {
          if (!product) {
            sendJson(res, 404, { error: 'Not Found', message: `Product ${productId} not found` });
            return;
          }
          store.products.delete(productId);
          store.emitEvent('product_deleted', { productId });
          sendJson(res, 200, { message: `Product ${productId} deleted successfully` });
          return;
        }
      }

      // 3. Cart Management
      const getUserId = () => {
        const headerUser = req.headers['x-user-id'];
        if (typeof headerUser === 'string' && headerUser.trim()) return headerUser.trim();
        const queryUser = url.searchParams.get('userId');
        if (queryUser && queryUser.trim()) return queryUser.trim();
        return 'default-user';
      };

      const formatCart = (cart: Cart) => {
        const totalAmount = cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        return { ...cart, totalAmount, totalItems };
      };

      // GET /api/cart
      if (pathname === '/api/cart' && method === 'GET') {
        const userId = getUserId();
        const cart = store.carts.get(userId) || { userId, items: [], updatedAt: new Date().toISOString() };
        sendJson(res, 200, { data: formatCart(cart) });
        return;
      }

      // POST /api/cart/items (Add or increment item)
      if (pathname === '/api/cart/items' && method === 'POST') {
        const userId = getUserId();
        const rawBody = await parseJsonBody(req);
        const bodyCheck = inspectRequest(method, pathname, url.searchParams, req.headers as any, rawBody);
        if (!bodyCheck.allowed) {
          sendJson(res, bodyCheck.statusCode || 400, {
            error: bodyCheck.error || 'Security Violation',
            message: bodyCheck.message,
          });
          return;
        }
        const body = sanitizeXss(rawBody) as Record<string, any>;
        const { productId, quantity = 1 } = body;

        if (!productId || typeof productId !== 'string') {
          sendJson(res, 400, { error: 'Validation Error', message: 'productId is required' });
          return;
        }
        if (typeof quantity !== 'number' || quantity <= 0) {
          sendJson(res, 400, { error: 'Validation Error', message: 'quantity must be positive' });
          return;
        }

        const product = store.products.get(productId);
        if (!product) {
          sendJson(res, 404, { error: 'Not Found', message: `Product ${productId} not found` });
          return;
        }

        let cart = store.carts.get(userId);
        if (!cart) {
          cart = { userId, items: [], updatedAt: new Date().toISOString() };
          store.carts.set(userId, cart);
        }

        const existingItem = cart.items.find((i) => i.productId === productId);
        const desiredQty = existingItem ? existingItem.quantity + quantity : quantity;

        if (desiredQty > product.stock) {
          sendJson(res, 400, {
            error: 'Insufficient Stock',
            message: `Requested quantity ${desiredQty} exceeds available stock ${product.stock}`,
          });
          return;
        }

        if (existingItem) {
          existingItem.quantity = desiredQty;
          existingItem.unitPrice = product.price;
        } else {
          cart.items.push({ productId, quantity: desiredQty, unitPrice: product.price });
        }
        cart.updatedAt = new Date().toISOString();

        sendJson(res, 200, { data: formatCart(cart), message: 'Item added to cart' });
        return;
      }

      // Match /api/cart/items/:productId (DELETE single item or update)
      const cartItemMatch = pathname.match(/^\/api\/cart\/items\/([a-zA-Z0-9_-]+)$/);
      if (cartItemMatch && method === 'DELETE') {
        const userId = getUserId();
        const productId = cartItemMatch[1];
        const cart = store.carts.get(userId);
        if (!cart) {
          sendJson(res, 404, { error: 'Not Found', message: 'Cart is empty' });
          return;
        }
        cart.items = cart.items.filter((i) => i.productId !== productId);
        cart.updatedAt = new Date().toISOString();
        sendJson(res, 200, { data: formatCart(cart), message: `Item ${productId} removed from cart` });
        return;
      }

      // DELETE /api/cart (Clear cart)
      if (pathname === '/api/cart' && method === 'DELETE') {
        const userId = getUserId();
        store.carts.delete(userId);
        sendJson(res, 200, { message: 'Cart cleared successfully' });
        return;
      }

      // 4. Order Processing
      // POST /api/orders/checkout
      if (pathname === '/api/orders/checkout' && method === 'POST') {
        const userId = getUserId();
        const cart = store.carts.get(userId);

        if (!cart || cart.items.length === 0) {
          sendJson(res, 400, { error: 'Empty Cart', message: 'Cannot checkout with an empty cart' });
          return;
        }

        for (const item of cart.items) {
          const product = store.products.get(item.productId);
          if (!product) {
            sendJson(res, 400, { error: 'Invalid Product', message: `Product ${item.productId} no longer exists` });
            return;
          }
          if (product.stock < item.quantity) {
            sendJson(res, 400, {
              error: 'Insufficient Stock',
              message: `Insufficient stock for product ${product.name}. Requested: ${item.quantity}, Available: ${product.stock}`,
            });
            return;
          }
        }

        const orderItems: OrderItem[] = [];
        let totalAmount = 0;

        for (const item of cart.items) {
          const product = store.products.get(item.productId)!;
          product.stock -= item.quantity;
          product.updatedAt = new Date().toISOString();
          store.products.set(product.id, product);

          const subtotal = product.price * item.quantity;
          totalAmount += subtotal;

          orderItems.push({
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPrice: product.price,
            subtotal,
          });

          store.emitEvent('stock_changed', { productId: product.id, remainingStock: product.stock });
        }

        const now = new Date().toISOString();
        const order: Order = {
          id: randomUUID(),
          userId,
          items: orderItems,
          totalAmount,
          status: 'PENDING',
          createdAt: now,
          updatedAt: now,
        };

        store.orders.set(order.id, order);
        store.carts.delete(userId);

        store.emitEvent('order_created', order);

        sendJson(res, 201, { data: order, message: 'Order created successfully' });
        return;
      }

      // GET /api/orders
      if (pathname === '/api/orders' && method === 'GET') {
        const userId = url.searchParams.get('userId');
        let list = Array.from(store.orders.values());
        if (userId) {
          list = list.filter((o) => o.userId === userId);
        }
        sendJson(res, 200, { data: list, count: list.length });
        return;
      }

      // GET /api/orders/:id
      const orderDetailMatch = pathname.match(/^\/api\/orders\/([a-zA-Z0-9_-]+)$/);
      if (orderDetailMatch && method === 'GET') {
        const orderId = orderDetailMatch[1];
        const order = store.orders.get(orderId);
        if (!order) {
          sendJson(res, 404, { error: 'Not Found', message: `Order ${orderId} not found` });
          return;
        }
        sendJson(res, 200, { data: order });
        return;
      }

      // POST /api/orders/:id/cancel
      const orderCancelMatch = pathname.match(/^\/api\/orders\/([a-zA-Z0-9_-]+)\/cancel$/);
      if (orderCancelMatch && method === 'POST') {
        const orderId = orderCancelMatch[1];
        const order = store.orders.get(orderId);
        if (!order) {
          sendJson(res, 404, { error: 'Not Found', message: `Order ${orderId} not found` });
          return;
        }

        if (order.status !== 'PENDING' && order.status !== 'PROCESSING') {
          sendJson(res, 400, {
            error: 'Invalid Operation',
            message: `Cannot cancel order with status ${order.status}`,
          });
          return;
        }

        for (const item of order.items) {
          const product = store.products.get(item.productId);
          if (product) {
            product.stock += item.quantity;
            product.updatedAt = new Date().toISOString();
            store.products.set(product.id, product);
            store.emitEvent('stock_changed', { productId: product.id, remainingStock: product.stock });
          }
        }

        order.status = 'CANCELLED';
        order.updatedAt = new Date().toISOString();
        store.orders.set(order.id, order);

        store.emitEvent('order_cancelled', order);

        sendJson(res, 200, { data: order, message: 'Order cancelled and stock restored' });
        return;
      }

      // 5. Mock Payment Gateway
      // POST /api/payments/pay
      if (pathname === '/api/payments/pay' && method === 'POST') {
        const rawBody = await parseJsonBody(req);
        const bodyCheck = inspectRequest(method, pathname, url.searchParams, req.headers as any, rawBody);
        if (!bodyCheck.allowed) {
          sendJson(res, bodyCheck.statusCode || 400, {
            error: bodyCheck.error || 'Security Violation',
            message: bodyCheck.message,
          });
          return;
        }
        const body = sanitizeXss(rawBody) as Record<string, any>;
        const { orderId, amount, paymentMethod = 'credit_card', simulateFailure = false } = body;

        if (!orderId || typeof orderId !== 'string') {
          sendJson(res, 400, { error: 'Validation Error', message: 'orderId is required' });
          return;
        }

        const order = store.orders.get(orderId);
        if (!order) {
          sendJson(res, 404, { error: 'Not Found', message: `Order ${orderId} not found` });
          return;
        }

        if (order.status !== 'PENDING') {
          sendJson(res, 400, {
            error: 'Invalid Order Status',
            message: `Order is already ${order.status}. Only PENDING orders can be paid.`,
          });
          return;
        }

        if (typeof amount !== 'number' || amount !== order.totalAmount) {
          sendJson(res, 400, {
            error: 'Payment Mismatch',
            message: `Payment amount (${amount}) does not match order total amount (${order.totalAmount})`,
          });
          return;
        }

        const now = new Date().toISOString();
        const paymentId = randomUUID();
        const isSuccess = !simulateFailure;

        const payment: Payment = {
          id: paymentId,
          orderId: order.id,
          amount,
          paymentMethod: String(paymentMethod),
          status: isSuccess ? 'SUCCESS' : 'FAILED',
          transactionRef: `TXN-${randomUUID().substring(0, 8).toUpperCase()}`,
          createdAt: now,
        };

        store.payments.set(payment.id, payment);

        if (isSuccess) {
          order.status = 'PAID';
          order.paymentId = payment.id;
          order.updatedAt = now;
          store.orders.set(order.id, order);

          store.emitEvent('payment_success', { payment, order });
          store.emitEvent('order_paid', order);

          sendJson(res, 200, {
            data: { payment, order },
            message: 'Payment processed successfully',
          });
        } else {
          order.status = 'FAILED';
          order.paymentId = payment.id;
          order.updatedAt = now;
          store.orders.set(order.id, order);

          store.emitEvent('payment_failed', { payment, order });

          sendJson(res, 402, {
            error: 'Payment Failed',
            data: { payment, order },
            message: 'Payment simulation indicated failure (insufficient funds / declined)',
          });
        }
        return;
      }

      // GET /api/payments/:id
      const paymentDetailMatch = pathname.match(/^\/api\/payments\/([a-zA-Z0-9_-]+)$/);
      if (paymentDetailMatch && method === 'GET') {
        const paymentId = paymentDetailMatch[1];
        const payment = store.payments.get(paymentId);
        if (!payment) {
          sendJson(res, 404, { error: 'Not Found', message: `Payment ${paymentId} not found` });
          return;
        }
        sendJson(res, 200, { data: payment });
        return;
      }

      // 404 Not Found fallback
      sendJson(res, 404, { error: 'Not Found', message: `Route ${method} ${pathname} not found` });
    } catch (err: any) {
      const isTooLarge = err.message === 'Payload Too Large';
      const isSecurity = err.message && (err.message.includes('Prototype pollution') || err.message.includes('Security'));
      const statusCode = isTooLarge ? 413 : (isSecurity ? 400 : 500);
      sendJson(res, statusCode, {
        error: isTooLarge ? 'Payload Too Large' : (isSecurity ? 'Security Violation' : 'Internal Server Error'),
        message: err.message || 'Unexpected server error',
      });
    }
  });

  return { server, store, rateLimiter };
}

// Server standalone execution
const isDirectRun = process.argv[1] && (
  fileURLToPath(import.meta.url).replace(/\\/g, '/') === process.argv[1].replace(/\\/g, '/') ||
  process.argv[1].endsWith('server.ts') && !process.argv[1].includes('test')
);

if (isDirectRun) {
  const PORT = Number(process.env.PORT) || 3000;
  const { server } = createMarketplaceApp(undefined, true);
  server.listen(PORT, () => {
    console.log(`Hardened marketplace backend listening on http://localhost:${PORT}`);
  });
}
