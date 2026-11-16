import React, { useEffect, useState } from 'react';
import { PublicUserSession, ServiceWithForm, SheetPengumuman } from './shared/types';
import { apiFetch, clearAuth, getStoredToken, getStoredUser, isGasMode } from './lib/api';
import { Navbar, PublicRoute } from './components/Navbar';
import { CitizenHome, WizardEntryMode } from './components/CitizenHome';
import { ReportWizard } from './components/ReportWizard';
import { TrackReportView } from './components/TrackReportView';
import { AuthModal } from './components/AuthModal';
import { CitizenDashboard } from './components/CitizenDashboard';
import { AdminDashboard } from './components/AdminDashboard';

export default function App() {
  const [route, setRoute] = useState<PublicRoute>('home');
  const [wizardState, setWizardState] = useState<{
    open: boolean;
    mode: WizardEntryMode;
    preselected?: ServiceWithForm;
  }>({ open: false, mode: 'pengaduan' });

  const [trackPrefill, setTrackPrefill] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [user, setUser] = useState<PublicUserSession | null>(() => getStoredUser());
  const [services, setServices] = useState<ServiceWithForm[]>([]);
  const [announcements, setAnnouncements] = useState<SheetPengumuman[]>([]);

  const loadPublicData = async () => {
    if (!isGasMode()) return;
    try {
      const [svcRes, annRes] = await Promise.all([
        apiFetch<{ services: ServiceWithForm[] }>('/api/public/services'),
        apiFetch<{ announcements: SheetPengumuman[] }>('/api/public/announcements'),
      ]);
      setServices(svcRes.services);
      setAnnouncements(annRes.announcements);
    } catch (err) {
      console.error('Gagal memuat data publik WARGA AMPEL:', err);
    }
  };

  useEffect(() => {
    loadPublicData();
    if (isGasMode() && getStoredToken()) {
      apiFetch<{ user: PublicUserSession }>('/api/auth/me')
        .then((res) => setUser(res.user))
        .catch(() => {
          clearAuth();
          setUser(null);
        });
    }
  }, []);

  const handleNavigate = (nextRoute: PublicRoute) => {
    setWizardState((w) => ({ ...w, open: false }));
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartWizard = (mode: WizardEntryMode, preselected?: ServiceWithForm) => {
    setWizardState({ open: true, mode, preselected });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (authedUser: PublicUserSession) => {
    setUser(authedUser);
    setShowAuthModal(false);
    setWizardState((w) => ({ ...w, open: false }));
    if (authedUser.role === 'WARGA') {
      setRoute('citizen-dashboard');
    } else {
      setRoute('admin');
    }
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setRoute('home');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar
        activeRoute={route}
        onNavigate={handleNavigate}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      {!isGasMode() && (
        <div role="alert" className="bg-amber-50 border-b border-amber-300 text-amber-950 text-sm">
          <p className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
            Aplikasi belum terhubung ke Google Apps Script. Isi variabel GitHub <span className="font-mono">VITE_GAS_WEB_APP_URL</span> dengan alamat Web App yang berakhiran <span className="font-mono">/exec</span>, lalu jalankan ulang deploy. Untuk uji coba, tambahkan <span className="font-mono">?gasUrl=</span> pada alamat halaman.
          </p>
        </div>
      )}

      <div className="flex-1">
        {wizardState.open ? (
          <ReportWizard
            mode={wizardState.mode}
            services={services}
            preselectedService={wizardState.preselected}
            user={user}
            onCancel={() => setWizardState((w) => ({ ...w, open: false }))}
            onTrackTicket={(ticketId) => {
              setWizardState((w) => ({ ...w, open: false }));
              setTrackPrefill(ticketId);
              setRoute('track');
            }}
          />
        ) : route === 'track' ? (
          <TrackReportView key={trackPrefill} initialTicketId={trackPrefill} />
        ) : route === 'citizen-dashboard' && user ? (
          <CitizenDashboard
            user={user}
            onNewReport={() => handleStartWizard('pengaduan')}
          />
        ) : route === 'admin' && user && user.role !== 'WARGA' ? (
          <AdminDashboard
            user={user}
            onServicesChanged={loadPublicData}
          />
        ) : (
          <CitizenHome
            services={services}
            announcements={announcements}
            activeSection={
              route === 'services'
                ? 'services'
                : route === 'announcements'
                ? 'announcements'
                : 'home'
            }
            onStartWizard={handleStartWizard}
            onGoTrack={() => handleNavigate('track')}
            onGoAllAnnouncements={() => handleNavigate('announcements')}
          />
        )}
      </div>

      <footer className="bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
          <p>WARGA AMPEL — Sistem Informasi Pelayanan Warga Desa Ampel</p>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => handleNavigate('track')}
              className="hover:text-[#0F2942] font-medium cursor-pointer"
            >
              Cek Laporan
            </button>
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="hover:text-[#0F2942] font-medium cursor-pointer"
            >
              Portal Petugas &amp; Admin
            </button>
          </div>
        </div>
      </footer>

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}
