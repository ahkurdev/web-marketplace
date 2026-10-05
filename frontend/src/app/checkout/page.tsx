'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api-client';
import { CartItem, Order } from '../../types';

const COURIER_OPTIONS = [
  { id: 'JNE Reguler', name: 'JNE Reguler (2-3 hari)', cost: 15000 },
  { id: 'SiCepat Express', name: 'SiCepat Express (1-2 hari)', cost: 18000 },
  { id: 'J&T Express', name: 'J&T Express (2-3 hari)', cost: 16000 },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [cartLoading, setCartLoading] = useState(true);
  const [shippingAddress, setShippingAddress] = useState('');
  const [selectedCourierId, setSelectedCourierId] = useState(COURIER_OPTIONS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      apiClient<{ items: CartItem[]; subtotal: number }>('/cart')
        .then((res) => {
          setCartItems(res.items || []);
          setSubtotal(res.subtotal || 0);
        })
        .catch((err) => {
          console.error(err);
          setError('Gagal memuat keranjang.');
        })
        .finally(() => setCartLoading(false));
    }
  }, [user, authLoading, router]);

  const selectedCourier =
    COURIER_OPTIONS.find((c) => c.id === selectedCourierId) || COURIER_OPTIONS[0];
  const shippingCost = selectedCourier.cost;
  const grandTotal = subtotal + shippingCost;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingAddress.trim()) {
      setError('Alamat pengiriman wajib diisi.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const fullAddress = `${shippingAddress.trim()} (Kurir: ${selectedCourier.name} - Rp ${shippingCost.toLocaleString('id-ID')})`;
      const order = await apiClient<Order>('/checkout', {
        method: 'POST',
        body: JSON.stringify({ shippingAddress: fullAddress }),
      });
      router.push(`/orders?success=true&orderId=${order.id}`);
    } catch (err: any) {
      setError(err.message || 'Checkout gagal, periksa keranjang Anda.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || (cartLoading && user)) {
    return <div className="text-center py-12 text-gray-500">Memuat data checkout...</div>;
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-md mx-auto bg-white p-8 rounded-lg border border-gray-200 text-center shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Keranjang Belanja Kosong</h2>
        <p className="text-sm text-gray-500 mb-6">
          Tambahkan barang ke keranjang terlebih dahulu sebelum melanjutkan checkout.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700 transition"
        >
          Lihat Katalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Konfirmasi Pesanan & Checkout</h1>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleCheckout} id="checkout-form" className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Informasi Pengiriman</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700">Alamat Lengkap Pengiriman</label>
              <textarea
                required
                rows={3}
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                placeholder="Nama Penerima, No. Telepon, Alamat lengkap (Jalan, RT/RW, Kecamatan, Kota, Kode Pos)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Pilihan Kurir & Layanan</label>
              <select
                value={selectedCourierId}
                onChange={(e) => setSelectedCourierId(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
              >
                {COURIER_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - Rp {c.cost.toLocaleString('id-ID')}
                  </option>
                ))}
              </select>
            </div>
          </form>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 border-b pb-2 text-sm">Rincian Item yang Dipesan</h3>
            <div className="divide-y divide-gray-100">
              {cartItems.map((item) => (
                <div key={item.id} className="py-2.5 flex justify-between items-center text-sm">
                  <div>
                    <div className="font-medium text-gray-800">{item.product?.title || 'Produk'}</div>
                    <div className="text-xs text-gray-500">
                      {item.quantity} &times; Rp {(item.product?.price || 0).toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div className="font-semibold text-gray-900">
                    Rp {((item.product?.price || 0) * item.quantity).toLocaleString('id-ID')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm h-fit space-y-4">
          <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Ringkasan Pesanan</h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal Produk</span>
              <span>Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Biaya Ongkos Kirim</span>
              <span>Rp {shippingCost.toLocaleString('id-ID')}</span>
            </div>
            <div className="border-t pt-3 flex justify-between font-bold text-base text-gray-900">
              <span>Total Pembayaran</span>
              <span className="text-emerald-600">Rp {grandTotal.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <button
            type="submit"
            form="checkout-form"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 disabled:opacity-50 transition text-sm shadow-sm"
          >
            {loading ? 'Memproses Pesanan...' : `Konfirmasi & Bayar (Rp ${grandTotal.toLocaleString('id-ID')})`}
          </button>

          <Link
            href="/cart"
            className="block text-center text-xs text-gray-500 hover:text-gray-700 mt-2"
          >
            &larr; Kembali ke Keranjang Belanja
          </Link>
        </div>
      </div>
    </div>
  );
}
