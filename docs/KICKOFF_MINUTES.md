# Kick-off Meeting Minutes: Web Marketplace Architecture & Sprint Planning

**Tanggal/Waktu:** 2026-10-03
**Moderator:** Project Manager (`project-manager`)
**Partisipan:** `leaddeveloper`, `eni-backend`, `eni-frontend`, `eni-cyber`, `qa-reviewer`

---

## 1. Tech Stack Keputusan Arsitektur
- **Frontend:** Next.js (TypeScript, App Router), Tailwind CSS, Lucide Icons, Zustand/React Context untuk state keranjang.
- **Backend:** Node.js (TypeScript), Express.js, Prisma ORM, SQLite (local development) / PostgreSQL ready.
- **Autentikasi & Otorisasi:** JWT (JSON Web Tokens), bcrypt untuk hashing password, RBAC (Role: `CUSTOMER`, `ADMIN`).
- **Komunikasi:** REST API JSON (`/api/v1/*`), OpenAPI / Swagger contract.

---

## 2. Modul & Spesifikasi Fitur

### A. Modul Autentikasi (`/api/v1/auth`)
- `POST /register`: Pendaftaran pengguna baru (email, password, nama).
- `POST /login`: Autentikasi credential, return JWT token.
- `GET /me`: Verifikasi profil pengguna aktif via Authorization header.
- Middleware auth: proteksi endpoint pelanggan & admin.

### B. Modul Katalog Produk (`/api/v1/products`)
- `GET /products`: Daftar produk dengan filter kategori, pencarian, dan pagination.
- `GET /products/:id`: Detail informasi produk, stok, dan harga.
- `POST /products`: Tambah produk baru (Admin only).
- `PUT /products/:id`: Update data produk & stok (Admin only).
- `DELETE /products/:id`: Soft delete / remove produk (Admin only).

### C. Modul Keranjang Belanja (`/api/v1/cart`)
- `GET /cart`: Ambil item keranjang aktif milik user.
- `POST /cart/items`: Tambahkan produk ke keranjang (cek ketersediaan stok).
- `PUT /cart/items/:id`: Ubah kuantitas produk.
- `DELETE /cart/items/:id`: Hapus produk dari keranjang.
- `DELETE /cart`: Kosongkan keranjang.

### D. Modul Checkout & Pesanan (`/api/v1/checkout`, `/api/v1/orders`)
- `POST /checkout`: Proses konversi keranjang menjadi pesanan, validasi alamat pengiriman dan kalkulasi total.
- `GET /orders`: Riwayat pesanan user.
- `GET /orders/:id`: Detail ringkasan pesanan & status pembayaran.

---

## 3. Pembagian Peran Tim & Matriks Tanggung Jawab

| Profil | Peran | Tanggung Jawab Utama |
|---|---|---|
| `leaddeveloper` | Arsitek Teknis & Lead | Skema database Prisma, spesifikasi API contract, struktur repositori & review teknis. |
| `eni-backend` | Backend Specialist | Implementasi API endpoint (Auth, Catalog, Cart, Checkout) sesuai spesifikasi Prisma/Express. |
| `eni-frontend` | Frontend Specialist | UI/UX Next.js & Tailwind untuk halaman Auth, Katalog, Keranjang, dan Checkout flow. |
| `eni-cyber` | Cyber Security | Audit keamanan OWASP, pengerasan auth/JWT, rate limiting, validasi input, sanitasi data. |
| `qa-reviewer` | Quality Assurance | Penyusunan test plan, verifikasi integrasi E2E, pengujian fungsional modul dan edge cases. |

---

## 4. Alur Dependensi Sprint (Task Graph)

```
[t_95ef1224] Kick-off & Architecture Decisions (Project Manager)
     │
     ▼
[Child 1] Schema & API Blueprint Setup (leaddeveloper)
     ├───► [Child 2] Backend Services Implementation (eni-backend)
     └───► [Child 3] Frontend Web Marketplace UI (eni-frontend)
                 │                   │
                 ├───────────────────┘
                 ▼
     [Child 4] Security Audit & Hardening (eni-cyber)
     [Child 5] E2E Integration QA & Test Validation (qa-reviewer)
```
