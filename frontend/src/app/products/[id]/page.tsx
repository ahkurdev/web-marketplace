'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Product } from '../../../types';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!id) return;
    apiClient<Product>(`/products/${id}`)
      .then((data) => setProduct(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setAdding(true);
    setMsg('');
    try {
      await apiClient('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: id, quantity }),
      });
      setMsg('Berhasil ditambahkan ke keranjang!');
    } catch (err: any) {
      setMsg(err.message || 'Gagal menambahkan ke keranjang');
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Memuat detail produk...</div>;
  if (!product) return <div className="text-center py-12 text-gray-500">Produk tidak ditemukan.</div>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 md:p-8 max-w-4xl mx-auto shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="h-72 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover rounded-lg" />
          ) : (
            <span>Foto Produk</span>
          )}
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              {product.category}
            </span>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">{product.title}</h1>
            <p className="text-3xl font-extrabold text-gray-900 mt-4">
              Rp {product.price.toLocaleString('id-ID')}
            </p>
            <div className="mt-2 text-sm text-gray-500">
              Stok: <span className="font-semibold">{product.stock} unit</span>
            </div>
            <p className="mt-4 text-gray-600 text-sm leading-relaxed">{product.description}</p>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-6">
            <div className="flex items-center gap-4 mb-4">
              <label className="text-sm font-medium text-gray-700">Jumlah:</label>
              <input
                type="number"
                min={1}
                max={product.stock}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-3 py-1.5 border border-gray-300 rounded text-sm text-center"
              />
            </div>

            {msg && (
              <div className="mb-4 text-sm font-medium text-emerald-600">{msg}</div>
            )}

            <button
              onClick={handleAddToCart}
              disabled={adding || product.stock < 1}
              className="w-full py-3 px-6 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 disabled:opacity-50 transition text-sm"
            >
              {adding ? 'Menambahkan...' : product.stock < 1 ? 'Stok Habis' : 'Tambah ke Keranjang'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
