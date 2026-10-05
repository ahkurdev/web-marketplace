'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api-client';
import { CartItem } from '../../types';

export default function CartPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }
    if (user) {
      loadCart();
    }
  }, [user, authLoading]);

  const loadCart = async () => {
    try {
      const res = await apiClient<{ items: CartItem[]; subtotal: number }>('/cart');
      setItems(res.items || []);
      setSubtotal(res.subtotal || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (id: string, newQty: number) => {
    if (newQty < 1) return;
    try {
      await apiClient(`/cart/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity: newQty }),
      });
      loadCart();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await apiClient(`/cart/items/${id}`, { method: 'DELETE' });
      loadCart();
    } catch (err) {
      console.error(err);
    }
  };

  if (authLoading || loading) {
    return <div className="text-center py-12 text-gray-500">Memuat keranjang...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Keranjang Belanja</h1>

      {items.length === 0 ? (
        <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
          <p className="text-gray-500">Keranjang belanja Anda masih kosong.</p>
          <Link
            href="/"
            className="mt-4 inline-block px-4 py-2 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700"
          >
            Mulai Belanja
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white p-4 rounded-lg border border-gray-200 flex items-center justify-between"
              >
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.product?.title || 'Produk'}</h4>
                  <div className="text-sm text-gray-500">
                    Rp {(item.product?.price || 0).toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-gray-300 rounded">
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                      className="px-2.5 py-1 text-sm text-gray-600 hover:bg-gray-100"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                      className="px-2.5 py-1 text-sm text-gray-600 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => handleRemove(item.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 h-fit space-y-4">
            <h3 className="font-bold text-gray-900 border-b pb-3">Ringkasan Belanja</h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Harga</span>
              <span className="font-bold text-gray-900">
                Rp {subtotal.toLocaleString('id-ID')}
              </span>
            </div>

            <Link
              href="/checkout"
              className="block w-full py-2.5 bg-emerald-600 text-white font-semibold rounded text-center text-sm hover:bg-emerald-700 transition"
            >
              Lanjut ke Checkout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
