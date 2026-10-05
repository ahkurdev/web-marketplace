'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api-client';
import { Order } from '../../types';

function OrdersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const success = searchParams.get('success');
  const orderId = searchParams.get('orderId');
  const { user, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }
    if (user) {
      apiClient<Order[]>('/orders')
        .then((data) => setOrders(Array.isArray(data) ? data : []))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [user, authLoading, router]);

  if (authLoading || (loading && user)) {
    return <div className="text-center py-12 text-gray-500">Memuat riwayat pesanan...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg">
          <h3 className="font-bold text-base">Pesanan Berhasil Dibuat!</h3>
          <p className="text-sm mt-1">
            Terima kasih! Pesanan Anda dengan ID{' '}
            <span className="font-mono font-semibold">{orderId || '-'}</span> sedang diproses.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Pesanan</h1>
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
        >
          &larr; Lanjut Belanja
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
          Belum ada riwayat pesanan.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white p-6 rounded-lg border border-gray-200 space-y-3">
              <div className="flex justify-between items-center text-sm border-b pb-3">
                <div>
                  <span className="text-gray-500">Order ID: </span>
                  <span className="font-mono font-semibold">{order.id}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  {order.status}
                </span>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <div>Alamat Pengiriman: {order.shippingAddress}</div>
                <div>Tanggal: {new Date(order.createdAt).toLocaleDateString('id-ID')}</div>
              </div>

              {order.items && order.items.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <div className="text-xs font-medium text-gray-500">Item Pesanan:</div>
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs text-gray-700">
                      <span>{item.product?.title || 'Produk'} &times; {item.quantity}</span>
                      <span>Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-sm text-gray-500">Total Pembayaran</span>
                <span className="font-bold text-gray-900 text-lg">
                  Rp {order.totalAmount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-500">Memuat...</div>}>
      <OrdersContent />
    </Suspense>
  );
}
