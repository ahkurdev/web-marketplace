'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/auth-context';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-emerald-600">
          Marketplace
        </Link>

        <nav className="flex items-center gap-6">
          <Link href="/" className="text-gray-600 hover:text-gray-900 font-medium text-sm">
            Katalog
          </Link>
          <Link href="/cart" className="text-gray-600 hover:text-gray-900 font-medium text-sm">
            Keranjang
          </Link>
          {user && (
            <Link href="/orders" className="text-gray-600 hover:text-gray-900 font-medium text-sm">
              Pesanan
            </Link>
          )}
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500 font-medium">
                {user.name} ({user.role})
              </span>
              <button
                onClick={logout}
                className="text-xs text-red-600 hover:text-red-700 font-semibold"
              >
                Keluar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/auth/login"
                className="text-sm font-medium text-gray-700 hover:text-emerald-600"
              >
                Masuk
              </Link>
              <Link
                href="/auth/register"
                className="text-sm font-medium px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Daftar
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};
