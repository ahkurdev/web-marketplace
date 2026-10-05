# LAPORAN PENGUJIAN QA & BUG HUNTING (PHASE 7)

**Task ID:** `t_42af6a7e`  
**Assignee:** `qa-reviewer`  
**Target:** Web Marketplace Backend (`server.ts`) & API Services  
**Tanggal Pengujian:** 2026-10-05  
**Reviewer / Gatekeeper:** `leaddeveloper`  
**Status:** `Awaiting Final Approval by Lead Developer`

---

## 1. Summary of Changes
- Eksekusi automated test suite `test_qa_suite.ts` mencakup 20 skenario pengujian komprehensif pada API Marketplace:
  1. Functional Verification (Health, Catalog CRUD, Cart, Checkout, Mock Payment).
  2. Cart & Checkout Edge Cases (Fractional quantity, deleted product orphans, price desync, stock deduction lifecycle).
  3. Security & Penetration Testing (OWASP Top 10: Auth bypass, RBAC escalation, IDOR, XSS, Rate limit spoofing, Idempotency).
  4. Concurrency & Race Condition (Flash sale overselling test).
- Total Uji: **20 Skenario** | **PASSED: 9** | **FAILED: 11** | **WARNING: 0**

---

## 2. Findings & Test Results

### A. Functional & Concurrency Tests [PASS]
- **TC-FUNC-01 [PASS]:** Health check endpoint `/health` aktif dan stabil (HTTP 200).
- **TC-FUNC-02 [PASS]:** Pembuatan produk baru dengan payload valid (HTTP 201).
- **TC-FUNC-03 [PASS]:** Pencarian dan filter katalog produk berdasarkan query parameter `q` (HTTP 200).
- **TC-FUNC-04 [PASS]:** Penambahan produk ke keranjang belanja (HTTP 200).
- **TC-FUNC-05 [PASS]:** Checkout keranjang belanja dan reservasi stok awal (HTTP 201).
- **TC-FUNC-06 [PASS]:** Pembayaran sukses mengubah status pesanan menjadi `PAID` dan merekam ref transaksi (HTTP 200).
- **TC-EDGE-02 [PASS]:** Penolakan nilai harga null/invalid pada pembuatan produk (HTTP 400).
- **TC-SEC-07 [PASS]:** Security headers (CSP, X-Content-Type-Options, X-Frame-Options, HSTS) terpasang.
- **TC-CONC-01 [PASS]:** Pencegahan overselling pada checkout concurrent untuk item stok tunggal.

### B. Security & Vulnerability Findings [FAIL]
1. **[CRITICAL] TC-SEC-02 - OWASP A01: Unauthenticated Admin Operations**
   - *Lokasi:* `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`
   - *Temuan:* Tidak ada validasi JWT atau RBAC. Anonymous caller dapat membuat produk, mengubah harga/stok, atau menghapus seluruh katalog.
2. **[CRITICAL] TC-SEC-03 - OWASP A01: Broken Access Control / Global Order Leakage**
   - *Lokasi:* `GET /api/orders`
   - *Temuan:* Pemanggilan tanpa parameter `userId` mengembalikan seluruh riwayat pesanan semua customer di database (leaking user ID, item, subtotal).
3. **[CRITICAL] TC-SEC-05 - OWASP A07: Arbitrary Identity Spoofing**
   - *Lokasi:* Global helper `getUserId()`
   - *Temuan:* Identitas user diambil mentah dari header `x-user-id` atau query `?userId=` tanpa verifikasi kriptografis JWT Bearer token.
4. **[CRITICAL] TC-EDGE-03 - Inventory Leak: Failed Payment Permanently Deducts Stock**
   - *Lokasi:* `POST /api/payments/pay` & `POST /api/orders/:id/cancel`
   - *Temuan:* Ketika pembayaran gagal (status `FAILED`), stok yang sudah didecrement saat checkout TIDAK direstore. Endpoint `/cancel` menolak pembatalan order berstatus `FAILED` (HTTP 400). Stok hilang permanen dari inventaris toko.
5. **[HIGH] TC-SEC-01 - OWASP A07: Rate Limiter Bypass via Header Spoofing**
   - *Lokasi:* `RateLimiter` IP resolution di `server.ts`
   - *Temuan:* IP klien dipercaya langsung dari header `X-Forwarded-For`. Attacker dapat merotasi IP palsu untuk membypass rate limit 60 req/min.
6. **[HIGH] TC-SEC-04 - OWASP A01: Order Detail IDOR**
   - *Lokasi:* `GET /api/orders/:id`
   - *Temuan:* Endpoint tidak memverifikasi kepemilikan order atau role admin. User mana pun dapat mengintip pesanan user lain jika mengetahui UUID order.
7. **[HIGH] TC-SEC-06 - OWASP A03: Stored XSS in Product Catalog**
   - *Lokasi:* `POST /api/products` & SSE `/api/events/stream`
   - *Temuan:* Karakter HTML dan tag script `<script>alert(1)</script>` disimpan mentah tanpa sanitasi, berpotensi dieksekusi pada browser customer.
8. **[HIGH] TC-SEC-08 - Violation of Mandate: Missing Idempotency-Key Support**
   - *Lokasi:* `POST /api/orders/checkout`
   - *Temuan:* Header `Idempotency-Key` diabaikan sama sekali. Request checkout berulang menghasilkan duplikasi pesanan dan pengurangan stok ganda.
9. **[HIGH] TC-EDGE-01 - Fractional / Float Quantity in Cart**
   - *Lokasi:* `POST /api/cart/items`
   - *Temuan:* Input `quantity: 1.5` diterima karena hanya divalidasi `quantity > 0` tanpa pengecekan integer (`Number.isInteger`), merusak stok fisik produk menjadi pecahan.
10. **[MEDIUM] TC-EDGE-04 - Orphaned Deleted Products in Cart**
    - *Lokasi:* `DELETE /api/products/:id` vs `POST /api/orders/checkout`
    - *Temuan:* Produk yang dihapus dari katalog tidak dibersihkan dari keranjang aktif customer, mengunci checkout customer selamanya sampai item dibersihkan manual.
11. **[MEDIUM] TC-EDGE-05 - Price Desync between Cart Display and Checkout**
    - *Lokasi:* `GET /api/cart` vs `POST /api/orders/checkout`
    - *Temuan:* Keranjang menyimpan snapshot `unitPrice` lama, sementara checkout menghitung ulang harga realtime dari produk. Total harga berubah tanpa konfirmasi transparan ke customer.

---

## 3. Recommendations untuk Tim Perbaikan (Lead Developer & Backend)
1. **Perbaikan Inventory Leak (High Priority):**
   - Pada `POST /api/payments/pay`, jika pembayaran gagal, kembalikan stok secara otomatis atau izinkan `POST /api/orders/:id/cancel` membatalkan pesanan berstatus `FAILED` untuk merestore stok.
2. **Implementasi Autentikasi & RBAC:**
   - Pasang middleware autentikasi JWT token Bearer.
   - Lindungi endpoint mutasi produk (`POST`, `PUT`, `DELETE` `/api/products`) khusus role `ADMIN`.
   - Pastikan `GET /api/orders` hanya mengembalikan pesanan milik user yang login (atau semua jika `ADMIN`).
   - Verifikasi kepemilikan pada `GET /api/orders/:id`.
3. **Idempotency-Key pada Checkout:**
   - Simpan `idempotencyKey` pada entitas `Order`. Jika key yang sama dikirim ulang, return order yang sudah dibuat sebelumnya tanpa menduplikasi order atau memotong stok kembali.
4. **Validasi Input Ketat:**
   - Gunakan `Number.isInteger(quantity) && quantity > 0` pada keranjang belanja.
   - Sanitasi input string (nama & deskripsi produk) dari tag HTML berbahaya untuk mencegah Stored XSS.
5. **Rate Limiting Hardening:**
   - Gunakan socket remote address atau validasi `X-Forwarded-For` hanya dari trusted reverse proxy.

---

## 4. Sign-off Status
`Awaiting Final Approval by Lead Developer`
