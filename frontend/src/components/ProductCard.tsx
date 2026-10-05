import React from 'react';
import Link from 'next/link';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow transition-shadow flex flex-col justify-between">
      <div className="h-48 bg-gray-100 flex items-center justify-center text-gray-400">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm">Gambar Produk</span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
            {product.category}
          </span>
          <h3 className="font-semibold text-gray-900 mt-1 line-clamp-1">{product.title}</h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">Harga</div>
            <div className="font-bold text-gray-900">
              Rp {product.price.toLocaleString('id-ID')}
            </div>
          </div>
          <Link
            href={`/products/${product.id}`}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition"
          >
            Detail
          </Link>
        </div>
      </div>
    </div>
  );
};
