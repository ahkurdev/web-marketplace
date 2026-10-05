# Web Marketplace — Tactical & Neural Gear

A full-stack, secure, and production-ready Web Marketplace platform engineered with Node.js, TypeScript, and native ES modules. Features a high-throughput REST API, real-time Server-Sent Events (SSE) streaming, atomic inventory checkout, AKCA cybersecurity hardening, and an interactive modern web UI.

---

## Architecture Overview

```
                      +-----------------------------+
                      |   Client Web Browser / UI   |
                      +--------------+--------------+
                                     |
               REST API & SSE Stream |  (HTTP / Port 3000)
                                     v
                 +-----------------------------------+
                 |    AKCA Multi-Layer WAF & Guard   |
                 |  - Security Headers (CSP, HSTS)   |
                 |  - XSS Entity Encoding Sanitizer  |
                 |  - SQLi & NoSQLi Pattern Checker  |
                 |  - Sliding-Window Rate Limiter    |
                 +-------------------+---------------+
                                     |
                                     v
                 +-----------------------------------+
                 |      Marketplace Core Engine      |
                 |  - Catalog & Search (/products)   |
                 |  - Cart Management (/cart)        |
                 |  - Atomic Checkout (/checkout)    |
                 |  - Real-Time EventBus (/stream)   |
                 +-----------------------------------+
```

---

## Key Features

- **Product Catalog & Search**: Instant filtering, sorting, stock inspection, and query-based search.
- **Cart & Atomic Checkout**: Real-time cart calculations, inventory reservation, and atomic checkout preventing overselling.
- **Real-Time Streaming API (SSE)**: Live server-sent events for instant stock updates, order notifications, and payment confirmations.
- **AKCA Cybersecurity Hardening**:
  - OWASP Top 10 mitigation suite.
  - Strict Content Security Policy (CSP), HSTS, and frame protections.
  - Active detection & prevention against SQL injection, NoSQL operator injection, and Prototype Pollution (`__proto__`).
  - IP-based sliding window rate limiter with HTTP 429 throttling.
- **Integrated Web Interface**: Sleek, responsive cyberpunk/dark-themed storefront with sliding cart drawer and checkout flow.
- **Comprehensive Test Suite**:
  - `test_e2e.ts`: 10 E2E integration test scenarios verifying all core business workflows.
  - `test_security.ts`: 18 automated AKCA vulnerability checks auditing offensive & defensive surfaces (Grade A+).

---

## Quick Start

### Prerequisites
- Node.js 20+ (Node.js 22 or 24 recommended)

### Running Locally
```bash
# Clone the repository
git clone https://github.com/ahkurdev/web-marketplace.git
cd web-marketplace

# Start the application server
npm start
# Server starts at http://localhost:3000
```

Open `http://localhost:3000` in your web browser to access the marketplace UI.

### Running Test Suites
```bash
# Run End-to-End Business Logic Tests (10/10 tests)
npm test

# Run AKCA Automated Security & Penetration Suite (18/18 checks)
npm run test:security
```

---

## API Reference

### Health & Streaming
- `GET /health` — Application health check and uptime.
- `GET /api/events/stream` — Real-time Server-Sent Events (SSE) feed.

### Products
- `GET /api/products` — Retrieve product catalog (supports `?search=` and `?category=`).
- `GET /api/products/:id` — Retrieve detailed product information.
- `POST /api/products` — Create a new product.
- `PUT /api/products/:id` — Update product details or stock.
- `DELETE /api/products/:id` — Remove a product.

### Cart
- `GET /api/cart` — Fetch active shopping cart.
- `POST /api/cart/items` — Add item to cart with quantity validation.
- `DELETE /api/cart/items/:id` — Remove item from cart.
- `DELETE /api/cart` — Clear cart.

### Orders & Payments
- `POST /api/checkout` — Checkout cart items, reserve inventory, and create order.
- `GET /api/orders` — List user order history.
- `GET /api/orders/:id` — Retrieve specific order details.
- `POST /api/payments` — Process mock payment gateway transaction.
- `POST /api/orders/:id/cancel` — Cancel order and automatically restore inventory stock.

---

## Project Documentation

Detailed specifications and architectural artifacts are available in the [`docs/`](docs/) directory:
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Comprehensive technical architecture specification.
- [`docs/openapi.yaml`](docs/openapi.yaml) — OpenAPI 3.0 API specification contract.
- [`docs/SECURITY_AUDIT_REPORT.md`](docs/SECURITY_AUDIT_REPORT.md) — AKCA cybersecurity audit results and mitigations.
- [`docs/QA_TEST_MATRIX.md`](docs/QA_TEST_MATRIX.md) — QA test matrix and quality gate standards.
- [`docs/KICKOFF_MINUTES.md`](docs/KICKOFF_MINUTES.md) — Sprint planning and architecture kick-off meeting minutes.
- [`prisma/schema.prisma`](prisma/schema.prisma) — Database schema definition.

---

## License

MIT License. Designed and maintained by **ahkurdev**.
