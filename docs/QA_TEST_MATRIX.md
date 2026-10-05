# Matriks Pengujian QA & Standar Kualitas (Web Marketplace)
**Dokumen Referensi:** `[PHASE 3] Review QA Awal: Standar Kualitas & Kriteria Uji`  
**Task ID:** `t_5f9c9a60`  
**Penyusun:** `qa-reviewer`  
**Gatekeeper / Reviewer:** `leaddeveloper`  

---

## 1. Quality Standards & Quality Gates

| Gate | Kriteria Minimum | Alat Uji / Enforcement | Toleransi |
|---|---|---|---|
| **Static Analysis / Lint** | Zero ESLint errors/warnings, TypeScript strict mode (no implicit `any`) | `eslint`, `tsc --noEmit` | 0 error, 0 warning |
| **Unit Test Coverage** | Line coverage ≥ 85%, Branch coverage ≥ 80% | `vitest` / `jest` | Wajib untuk core business logic |
| **Integration Test** | 100% endpoint `/api/v1/*` tercover skenario positif & negatif | `supertest`, Test DB (SQLite memory) | 0 failure |
| **Security Audit** | 0 High/Critical vulnerabilities, OWASP Top 10 compliance | `npm audit`, OWASP ZAP, Trivy | 0 High/Critical |
| **E2E Golden Paths** | 100% pass pada alur kritis (Auth, Cart, Checkout, Admin) | `playwright` (headless) | Flakiness < 1% |
| **Performance SLA** | API P95 latency < 200ms; Next.js Lighthouse score ≥ 90 | K6 / Autocannon, Lighthouse CI | Max 250ms under standard load |

---

## 2. Matriks Pengujian Unit (Unit Test Matrix)

| ID | Modul / Komponen | Skenario Uji | Input Data / Kondisi | Ekspektasi Hasil | Level |
|---|---|---|---|---|---|
| **UT-AUTH-01** | `auth.service:hashPassword` | Hashing password dengan bcrypt | String password valid | Return salt rounds valid (min 10), hash tidak identik plain text | Unit |
| **UT-AUTH-02** | `auth.service:comparePassword` | Verifikasi password cocok | Plain text & valid bcrypt hash | Return `true` | Unit |
| **UT-AUTH-03** | `auth.service:comparePassword` | Verifikasi password salah | Plain text & salah hash | Return `false` | Unit |
| **UT-AUTH-04** | `auth.service:generateToken` | Generasi JWT token | Payload (userId, role) | Token JWT valid, berisikan claims userId, role, exp (1d/7d) | Unit |
| **UT-AUTH-05** | `auth.middleware:requireRole` | Guard RBAC role matching | User role `CUSTOMER`, required `ADMIN` | Throw `403 Forbidden` | Unit |
| **UT-AUTH-06** | `auth.middleware:requireRole` | Guard RBAC role matching | User role `ADMIN`, required `ADMIN` | Call `next()` | Unit |
| **UT-CAT-01** | `product.schema:validate` | Validasi input pembuatan produk | Price < 0 atau stock bukan integer negatif | Throw validation error (Zod) | Unit |
| **UT-CAT-02** | `product.service:filter` | Filter kategori dan search query | Category "Electronics", search "Laptop" | Query params tersanitasi, matching logic tepat | Unit |
| **UT-CART-01** | `cart.service:calculateItem` | Perhitungan subtotal item keranjang | Price: 50000, Quantity: 3 | Subtotal: 150000 | Unit |
| **UT-CART-02** | `cart.service:validateQuantity` | Validasi kuantitas tidak wajar | Quantity <= 0 atau bukan integer | Throw error kuantitas tidak valid | Unit |
| **UT-ORD-01** | `order.service:calculateTotal` | Kalkulasi total pesanan | Items array + shipping fee | Total amount sesuai penjumlahan matematis | Unit |
| **UT-ORD-02** | `order.schema:shippingAddress` | Validasi format alamat kirim | Alamat kosong / string < 10 karakter | Throw validation error | Unit |

---

## 3. Matriks Pengujian Integrasi (Integration Test Matrix)

### A. Autentikasi (`/api/v1/auth`)
| ID | Method & Endpoint | Kondisi Uji | Status Code | Respon yang Diharapkan |
|---|---|---|---|---|
| **IT-AUTH-01** | `POST /api/v1/auth/register` | Payload lengkap & email unik | `201 Created` | Object user tanpa `passwordHash` |
| **IT-AUTH-02** | `POST /api/v1/auth/register` | Email sudah terdaftar | `409 Conflict` | Error pesan "Email already registered" |
| **IT-AUTH-03** | `POST /api/v1/auth/register` | Payload tidak valid (password < 8 char, format email salah) | `400 Bad Request` | Field error detail |
| **IT-AUTH-04** | `POST /api/v1/auth/login` | Kredensial benar | `200 OK` | Access token JWT & info user |
| **IT-AUTH-05** | `POST /api/v1/auth/login` | Password salah atau email tidak terdaftar | `401 Unauthorized` | Pesan generic "Invalid credentials" |
| **IT-AUTH-06** | `GET /api/v1/auth/me` | Bearer token valid | `200 OK` | Profil user aktif |
| **IT-AUTH-07** | `GET /api/v1/auth/me` | Tanpa token / token kadaluarsa | `401 Unauthorized` | Pesan "Unauthorized / Token expired" |

### B. Katalog Produk (`/api/v1/products`)
| ID | Method & Endpoint | Kondisi Uji | Status Code | Respon yang Diharapkan |
|---|---|---|---|---|
| **IT-PROD-01** | `GET /api/v1/products` | Request list publik dengan pagination | `200 OK` | Array produk, metadata pagination (`page`, `limit`, `total`) |
| **IT-PROD-02** | `GET /api/v1/products?category=x`| Filter produk kategori tertentu | `200 OK` | Hanya item sesuai kategori |
| **IT-PROD-03** | `GET /api/v1/products/:id` | ID produk valid & ada | `200 OK` | Detail produk lengkap |
| **IT-PROD-04** | `GET /api/v1/products/:id` | ID produk tidak ditemukan | `404 Not Found` | Error "Product not found" |
| **IT-PROD-05** | `POST /api/v1/products` | User Admin dengan token valid | `201 Created` | Produk baru tersimpan di database |
| **IT-PROD-06** | `POST /api/v1/products` | User Customer (Non-Admin) | `403 Forbidden` | Akses ditolak |
| **IT-PROD-07** | `PUT /api/v1/products/:id` | Update data & stok oleh Admin | `200 OK` | Record produk terupdate |
| **IT-PROD-08** | `DELETE /api/v1/products/:id` | Soft delete produk oleh Admin | `200 OK` / `204 No Content` | Flag produk terarsip / terhapus |

### C. Keranjang Belanja (`/api/v1/cart`)
| ID | Method & Endpoint | Kondisi Uji | Status Code | Respon yang Diharapkan |
|---|---|---|---|---|
| **IT-CART-01** | `GET /api/v1/cart` | Ambil keranjang user terautentikasi | `200 OK` | List CartItem milik user saja |
| **IT-CART-02** | `POST /api/v1/cart/items` | Tambah produk stok mencukupi | `201 Created` | CartItem terbuat/kuantitas bertambah |
| **IT-CART-03** | `POST /api/v1/cart/items` | Tambah produk melebihi sisa stok | `400 Bad Request` | Pesan "Requested quantity exceeds available stock" |
| **IT-CART-04** | `PUT /api/v1/cart/items/:id` | Update kuantitas item milik sendiri | `200 OK` | Kuantitas terupdate, subtotal diperbarui |
| **IT-CART-05** | `PUT /api/v1/cart/items/:id` | Modifikasi item keranjang user lain (IDOR test) | `403 Forbidden` / `404 Not Found` | Akses ditolak |
| **IT-CART-06** | `DELETE /api/v1/cart/items/:id` | Hapus item dari keranjang sendiri | `200 OK` | Item dihapus dari keranjang |
| **IT-CART-07** | `DELETE /api/v1/cart` | Kosongkan seluruh keranjang user | `200 OK` | Seluruh CartItem milik user terhapus |

### D. Checkout & Pesanan (`/api/v1/checkout`, `/api/v1/orders`)
| ID | Method & Endpoint | Kondisi Uji | Status Code | Respon yang Diharapkan |
|---|---|---|---|---|
| **IT-CHK-01** | `POST /api/v1/checkout` | Keranjang kosong | `400 Bad Request` | Error "Cart is empty" |
| **IT-CHK-02** | `POST /api/v1/checkout` | Valid cart, alamat valid, stok cukup | `201 Created` | Record Order & OrderItem terbuat, Cart dikosongkan, stok berkurang secara atomik |
| **IT-CHK-03** | `POST /api/v1/checkout` | Race condition checkout item stok 1 oleh 2 user serentak | 1x `201 Created`, 1x `409 Conflict` / `400` | Stock constraint tidak pernah menjadi negatif (`CHECK (stock >= 0)`) |
| **IT-ORD-01** | `GET /api/v1/orders` | Ambil daftar riwayat pesanan user | `200 OK` | Hanya daftar pesanan milik user bersangkutan |
| **IT-ORD-02** | `GET /api/v1/orders/:id` | Ambil detail order milik sendiri | `200 OK` | Detail pesanan dan item |
| **IT-ORD-03** | `GET /api/v1/orders/:id` | Akses order milik user lain oleh customer | `403 Forbidden` / `404 Not Found` | Proteksi IDOR berfungsi |
| **IT-ORD-04** | `GET /api/v1/orders/:id` | Akses order manapun oleh role Admin | `200 OK` | Admin diizinkan melihat semua order |

---

## 4. Matriks Pengujian Keamanan (Security Test Matrix - OWASP Top 10)

| Kategori OWASP | Skenario Pengujian | Metode & Payload | Kriteria Kelulusan |
|---|---|---|---|
| **A01: Broken Access Control** | IDOR pada endpoint `/api/v1/cart/items/:id` dan `/api/v1/orders/:id` | User A merequest/mengubah data milik User B dengan mengganti param ID | Respon `403` atau `404`; tidak ada kebocoran data milik user lain |
| **A01: Broken Access Control** | Privilege Escalation ke rute Admin (`POST /api/v1/products`) | Request dengan JWT ber-role `CUSTOMER` | Respon `403 Forbidden` tanpa exception stacktrace |
| **A02: Cryptographic Failures** | Data at rest & in transit | Verifikasi schema DB tidak menyimpan plain text password | Kolom `passwordHash` menggunakan bcrypt salt round ≥ 10; API response tidak pernah menyertakan `passwordHash` |
| **A03: Injection** | SQL / ORM Injection pada catalog search & filter | Injeksi parameter `search="'; DROP TABLE products; --"` atau boolean logic | Diterjemahkan sebagai string literal oleh Prisma ORM; zero injection |
| **A03: Injection (XSS)** | Cross-Site Scripting pada deskripsi produk dan alamat pengiriman | Payload `<script>alert(1)</script>` atau `<img src=x onerror=...>` | Sanitasi input pada backend & auto-escaping di React/Next.js UI |
| **A04: Insecure Design** | Negative quantity / price manipulation | Request `quantity: -5` atau `price: -100` saat add cart atau checkout | Validasi Zod menolak payload sebelum masuk layer database |
| **A05: Security Misconfiguration** | HTTP Header hardening & error disclosure | Inspect response header dan uncaught error | Header dilindungi Helmet (X-Content-Type-Options, CSP, HSTS); error response di environment production tidak memaparkan internal stacktrace |
| **A07: Identification & Auth Failures** | Brute force login prevention | 10x POST login salah dalam 1 menit | Rate limiting memblokir request berikutnya dengan `429 Too Many Requests` |
| **A08: Software & Data Integrity** | Concurrency race condition pada stok produk | Parallel checkout requests melebihi stok yang ada | Transaksi Prisma / atomic decrement mencegah over-selling (`stock` tidak pernah < 0) |

---

## 5. Rencana Pengujian End-to-End (E2E Test Plan - Playwright)

### E2E-01: Alur Lengkap Pembeli (Happy Path User Journey)
1. **Registrasi Akun Baru:** Kunjungi `/register`, isi form nama, email baru, password. Verifikasi diarahkan ke dashboard/halaman utama.
2. **Katalog & Navigasi:** Kunjungi `/products`, terapkan filter kategori dan ketik kata kunci pada kolom pencarian.
3. **Detail Produk & Keranjang:** Klik salah satu produk, pastikan info stok akurat. Klik "Tambah ke Keranjang".
4. **Kelola Keranjang:** Buka modal/halaman `/cart`. Tambah kuantitas item, verifikasi subtotal dan grand total terkalkulasi akurat secara instan.
5. **Checkout:** Klik tombol Checkout, isi alamat pengiriman lengkap, konfirmasi pesanan.
6. **Verifikasi Pesanan:** Verifikasi pengalihan ke halaman invoice `/orders/:id` dengan status pending/success dan keranjang kembali bersih (0 items).

### E2E-02: Alur Penanganan Stok Habis & Edge Cases (Concurrency)
1. Buka 2 sesi browser independen (User A dan User B).
2. Produk X hanya memiliki sisa stok 1 unit.
3. Kedua user memasukkan Produk X ke keranjang masing-masing.
4. User A menyelesaikan checkout terlebih dahulu -> Sukses.
5. User B menekan checkout beberapa saat kemudian -> Tampil error informatif "Stok produk tidak mencukupi", pesanan dibatalkan tanpa error 500.

### E2E-03: Alur Administrator (Admin Catalog Management)
1. Login dengan akun Admin (`role: ADMIN`).
2. Masuk ke dashboard katalog `/admin/products`.
3. Tambah produk baru dengan foto, judul, harga, dan stok awal.
4. Buka tab incognito sebagai publik/customer -> Pastikan produk baru langsung tampil pada katalog.
5. Kembali ke admin dashboard, ubah harga dan stok produk tersebut.
6. Lakukan soft delete / hapus produk -> Pastikan produk tidak lagi muncul pada katalog publik.

---

## 6. Setup Lingkungan & Otomasi CI/CD Test Pipeline

```
GitHub Actions / Local Pre-Commit Hook:
  ├─ Phase 1: Linting & Typecheck (eslint, tsc)
  ├─ Phase 2: Unit Testing (vitest --coverage)
  ├─ Phase 3: Integration Testing (vitest + supertest + SQLite test DB)
  ├─ Phase 4: Security Scan (npm audit, OWASP dependency check)
  └─ Phase 5: E2E Regression Testing (playwright test)
```

---

## 7. Rekomendasi untuk Tim Pengembang
1. **Frontend (`eni-frontend`):** Pasang client-side validation schema (Zod) yang sinkron dengan backend, kelola state keranjang dengan optimistic updates yang rollback jika API mengembalikan kegagalan stok.
2. **Backend (`eni-backend`):** Pastikan pengurangan stok pada modul checkout dibungkus dalam `prisma.$transaction` dengan raw atomic check atau locking demi mencegah race condition.
3. **Cyber (`eni-cyber`):** Pasang `express-rate-limit` pada endpoint `/api/v1/auth/login` dan konfigurasi `helmet` middleware sebelum fase eksekusi API dimulai.

---

## 8. Status Review & Tanda Tangan
- **Review Status:** `Awaiting Final Approval by Lead Developer`
- **Tindak Lanjut:** Serahkan ke `leaddeveloper` untuk otorisasi formal sebelum sprint eksekusi Phase 4 & Phase 5 dimulai.
