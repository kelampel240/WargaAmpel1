import React from 'react';
import { PublicUserSession } from '../shared/types';

export type PublicRoute =
  | 'home'
  | 'services'
  | 'track'
  | 'announcements'
  | 'citizen-dashboard'
  | 'admin';

interface NavbarProps {
  activeRoute: PublicRoute;
  onNavigate: (route: PublicRoute) => void;
  user: PublicUserSession | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeRoute,
  onNavigate,
  user,
  onOpenAuth,
  onLogout,
}) => {
  const isStaff = user && user.role !== 'WARGA';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="font-display text-xl font-extrabold tracking-tight text-[#0F2942] whitespace-nowrap shrink-0 cursor-pointer hover:text-[#0B6E4F] transition-colors"
        >
          WARGA AMPEL
        </button>

        {/* Zone 2: 4 concise single-line nav links */}
        <nav aria-label="Navigasi Utama" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeRoute === 'home'
                ? 'border-[#0B6E4F] text-[#0F2942] font-semibold'
                : 'border-transparent hover:text-[#0F2942]'
            }`}
          >
            Beranda
          </button>
          <button
            type="button"
            onClick={() => onNavigate('services')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeRoute === 'services'
                ? 'border-[#0B6E4F] text-[#0F2942] font-semibold'
                : 'border-transparent hover:text-[#0F2942]'
            }`}
          >
            Layanan
          </button>
          <button
            type="button"
            onClick={() => onNavigate('track')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeRoute === 'track'
                ? 'border-[#0B6E4F] text-[#0F2942] font-semibold'
                : 'border-transparent hover:text-[#0F2942]'
            }`}
          >
            Cek Laporan
          </button>
          <button
            type="button"
            onClick={() => onNavigate('announcements')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeRoute === 'announcements'
                ? 'border-[#0B6E4F] text-[#0F2942] font-semibold'
                : 'border-transparent hover:text-[#0F2942]'
            }`}
          >
            Pengumuman
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate(isStaff ? 'admin' : 'citizen-dashboard')}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#0F2942] rounded-lg hover:bg-[#173b5e] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isStaff ? 'Panel Petugas' : 'Akun Saya'}
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Keluar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#08553d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Masuk Akun
            </button>
          )}
        </div>
      </div>

      {/* Mobile compact secondary bar */}
      <nav
        aria-label="Navigasi Seluler"
        className="flex md:hidden items-center justify-around border-t border-slate-100 px-2 py-2 bg-white text-sm font-medium text-slate-700"
      >
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className={`px-2 py-1.5 rounded whitespace-nowrap shrink-0 ${
            activeRoute === 'home' ? 'text-[#0B6E4F] font-semibold bg-emerald-50' : ''
          }`}
        >
          Beranda
        </button>
        <button
          type="button"
          onClick={() => onNavigate('services')}
          className={`px-2 py-1.5 rounded whitespace-nowrap shrink-0 ${
            activeRoute === 'services' ? 'text-[#0B6E4F] font-semibold bg-emerald-50' : ''
          }`}
        >
          Layanan
        </button>
        <button
          type="button"
          onClick={() => onNavigate('track')}
          className={`px-2 py-1.5 rounded whitespace-nowrap shrink-0 ${
            activeRoute === 'track' ? 'text-[#0B6E4F] font-semibold bg-emerald-50' : ''
          }`}
        >
          Cek Laporan
        </button>
        <button
          type="button"
          onClick={() => onNavigate('announcements')}
          className={`px-2 py-1.5 rounded whitespace-nowrap shrink-0 ${
            activeRoute === 'announcements' ? 'text-[#0B6E4F] font-semibold bg-emerald-50' : ''
          }`}
        >
          Pengumuman
        </button>
      </nav>
    </header>
  );
};
