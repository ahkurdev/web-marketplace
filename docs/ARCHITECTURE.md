# SPESIFIKASI ARSITEKTUR WEB MARKETPLACE (PHASE 2)
**Author:** Lead Developer (`leaddeveloper`)
**Date:** 2026-10-05
**Task ID:** `t_e0b3f8a2`
**Verdict:** `[APPROVED - READY FOR EXECUTION]`

---

## 1. Executive Summary & Review Kick-Off (Phase 1)
Evaluasi terhadap hasil kick-off meeting (`KICKOFF_MINUTES.md` dari `t_95ef1224`):
- **Tech Stack Disetujui:**
  - Frontend: Next.js (TypeScript, App Router), Tailwind CSS.
  - Backend: Node.js (TypeScript), Express.js.
  - ORM & Database: Prisma ORM, SQLite untuk dev lokal, PostgreSQL-ready untuk target staging/prod.
  - Auth: JWT (Bearer token), bcrypt password hashing, Role-based Access Control (`CUSTOMER`, `ADMIN`).
- **Critical Technical Guardrails (Engineering Mandate):**
  1. Concurrency control pada modul Checkout: wajib transaksi database atomik dengan pengecekan stok (`stock >= quantity`).
  2. Idempotency: endpoint `POST /api/v1/checkout` wajib mendukung header `Idempotency-Key` untuk mencegah double-order akibat network retry.
  3. Format response terstandarisasi untuk semua endpoint REST (`success`, `data`, `error`).

---

## 2. Standar Arsitektur Database (Prisma ORM)

### 2.1 Skema Prisma (`schema.prisma`)
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  CUSTOMER
  ADMIN
}

enum OrderStatus {
  PENDING
  PAID
  CANCELLED
  COMPLETED
}

model User {
  id           String      @id @default(uuid())
  email        String      @unique
  passwordHash String
  name         String
  role         String      @default("CUSTOMER") // CUSTOMER | ADMIN
  cartItems    CartItem[]
  orders       Order[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@index([email])
}

model Product {
  id          String      @id @default(uuid())
  title       String
  description String
  price       Float
  stock       Int         @default(0)
  category    String
  imageUrl    String?
  cartItems   CartItem[]
  orderItems  OrderItem[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([category])
  @@index([title])
}

model CartItem {
  id        String   @id @default(uuid())
  userId    String
  productId String
  quantity  Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([userId, productId])
  @@index([userId])
}

model Order {
  id              String      @id @default(uuid())
  userId          String
  totalAmount     Float
  status          String      @default("PENDING") // PENDING, PAID, CANCELLED, COMPLETED
  shippingAddress String
  idempotencyKey  String?     @unique
  orderItems      OrderItem[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([userId])
  @@index([status])
}

model OrderItem {
  id        String   @id @default(uuid())
  orderId   String
  productId String
  price     Float
  quantity  Int

  order   Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@index([orderId])
}
```

### 2.2 Rules Integritas & Transaksi:
1. **Pencegahan Stok Negatif (Atomic Decrement):**
   - Pemotongan stok saat checkout harus dieksekusi di dalam transaksi Prisma (`prisma.$transaction`).
   - Setiap pengurangan stok wajib memverifikasi `stock >= requested_quantity` sebelum committed.
2. **Composite Uniqueness:**
   - Tabel `CartItem` memiliki constraint `@@unique([userId, productId])` agar duplikasi item keranjang otomatis menjadi update kuantitas.
3. **Foreign Key Restraints:**
   - Hapus user menghapus cart item (`onDelete: Cascade`), namun order masa lalu dipertahankan (`onDelete: Restrict`).

---

## 3. Desain API Kontrak (REST API Contract)

### 3.1 Standard Response Envelopes
- **Success (200 / 201):**
  ```json
  {
    "success": true,
    "data": {}
  }
  ```
- **Error (400 / 401 / 403 / 404 / 409 / 422 / 500):**
  ```json
  {
    "success": false,
    "error": {
      "code": "BAD_REQUEST",
      "message": "Human readable explanation",
      "details": []
    }
  }
  ```

### 3.2 Katalog Endpoint

| Method | Endpoint | Auth | Deskripsi | Request Body / Query Params |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Register user baru | `{ email, password, name }` |
| `POST` | `/api/v1/auth/login` | Public | Login & dapatkan token | `{ email, password }` |
| `GET` | `/api/v1/auth/me` | Bearer | Info user saat ini | Header `Authorization: Bearer <jwt>` |
| `GET` | `/api/v1/products` | Public | List produk | Query: `category`, `search`, `page`, `limit` |
| `GET` | `/api/v1/products/:id` | Public | Detail produk | - |
| `POST` | `/api/v1/products` | Admin | Buat produk baru | `{ title, description, price, stock, category, imageUrl }` |
| `PUT` | `/api/v1/products/:id` | Admin | Update produk & stok | `{ title?, description?, price?, stock?, category?, imageUrl? }` |
| `DELETE` | `/api/v1/products/:id` | Admin | Hapus produk | - |
| `GET` | `/api/v1/cart` | Customer | Ambil item keranjang | Header `Authorization: Bearer <jwt>` |
| `POST` | `/api/v1/cart/items` | Customer | Tambah item ke keranjang | `{ productId, quantity }` |
| `PUT` | `/api/v1/cart/items/:id` | Customer | Update kuantitas item | `{ quantity }` |
| `DELETE` | `/api/v1/cart/items/:id` | Customer | Hapus item dari keranjang| - |
| `DELETE` | `/api/v1/cart` | Customer | Kosongkan keranjang | - |
| `POST` | `/api/v1/checkout` | Customer | Checkout keranjang | Header `Idempotency-Key: <uuid>`, Body: `{ shippingAddress }` |
| `GET` | `/api/v1/orders` | Customer | Riwayat pesanan user | Header `Authorization: Bearer <jwt>` |
| `GET` | `/api/v1/orders/:id` | Customer | Detail pesanan | Header `Authorization: Bearer <jwt>` |

---

## 4. Arsitektur UI (Frontend Standard)

### 4.1 Struktur Direktori (Next.js App Router)
```text
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (shop)/
│   │   ├── page.tsx (Home / Catalog Hero)
│   │   ├── products/
│   │   │   └── [id]/page.tsx (Detail Produk)
│   ├── cart/page.tsx
│   ├── checkout/page.tsx
│   ├── orders/
│   │   ├── page.tsx (Order History)
│   │   └── [id]/page.tsx (Order Detail)
│   └── layout.tsx
├── components/
│   ├── ui/ (Button, Input, Card, Modal, Badge)
│   ├── layout/ (Navbar, Footer, CartDrawer)
│   └── shop/ (ProductCard, ProductGrid, FilterBar, OrderSummary)
├── context/ / store/ (CartContext atau Zustand useCartStore)
├── lib/ (api-client.ts, auth.ts, utils.ts)
└── types/ (api.ts, product.ts, order.ts)
```

### 4.2 Prinsip Rendering & State:
1. **Server vs Client Components:**
   - Server Components untuk halaman katalog (`/products`) guna optimasi SEO dan initial data load.
   - Client Components (`'use client'`) untuk form input (Login, Register, Checkout), Cart Drawer, dan kontrol quantity.
2. **State Management Keranjang:**
   - Keranjang disinkronisasi ke REST API backend untuk user yang sudah login (`GET/POST /api/v1/cart`).
   - Local storage fallback untuk guest browsing sebelum login.
3. **Resilience & UX:**
   - Loading skeletons untuk product grid dan order detail.
   - Penanganan error network dan feedback toast notifikasi.

---

## 5. Security & Cyber Requirements (eni-cyber)
1. **Password Hashing:** `bcrypt` minimal 10 salt rounds.
2. **JWT Security:** Expire 24h, sign menggunakan secret kuat dari environment variable (`JWT_SECRET`).
3. **CORS & Headers:** Konfigurasi helmet, CORS whitelist domain frontend.
4. **Input Validation:** Validasi schema menggunakan Zod/Joi pada seluruh request body di backend controller.
5. **Rate Limiting:** Terapkan rate limiter pada endpoint auth (`/api/v1/auth/*`) dan checkout (`/api/v1/checkout`).

---

## 6. QA & Testing Matrix (qa-reviewer)
1. **Unit & API Testing:**
   - Registrasi user valid, email duplikat (expect 409).
   - Login credential salah (expect 401).
   - Add to cart produk dengan stok cukup vs habis (expect 400 jika stok habis).
   - Checkout atomik: pastikan stok berkurang sesuai kuantitas order.
   - Concurrency checkout: 2 request bersamaan untuk stok terakhir harus menghasilkan 1 sukses dan 1 reject (out-of-stock).
2. **E2E Testing:**
   - Full flow: Register -> Login -> Browse Product -> Add to Cart -> Adjust Quantity -> Checkout -> Order History.

---

## 7. Gatekeeper Approval
- **Status:** `[APPROVED - READY FOR EXECUTION]`
- **Instruksi Eksekusi:** Tim engineering (`eni-backend`, `eni-frontend`, `eni-cyber`, `qa-reviewer`) diinstruksikan untuk memulai eksekusi sprint implementasi berpedoman penuh pada spesifikasi ini.
