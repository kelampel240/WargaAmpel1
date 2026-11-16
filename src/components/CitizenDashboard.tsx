import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, FilePlus2, Landmark, Megaphone } from 'lucide-react';
import {
  CitizenTrackingResponse,
  PublicUserSession,
  SheetNotifikasi,
  SheetPengumuman,
} from '../shared/types';
import { apiFetch, formatTanggalIndo, getStatusVisual } from '../lib/api';
import { EvidenceOpenButton } from './EvidenceImage';

interface CitizenDashboardProps {
  user: PublicUserSession;
  onNewReport: () => void;
}

export const CitizenDashboard: React.FC<CitizenDashboardProps> = ({ user, onNewReport }) => {
  const [myReports, setMyReports] = useState<CitizenTrackingResponse[]>([]);
  const [notifications, setNotifications] = useState<SheetNotifikasi[]>([]);
  const [announcements, setAnnouncements] = useState<SheetPengumuman[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await apiFetch<{
        myReports: CitizenTrackingResponse[];
        notifications: SheetNotifikasi[];
        announcements: SheetPengumuman[];
      }>('/api/citizen/dashboard');
      setMyReports(res.myReports);
      setNotifications(res.notifications);
      setAnnouncements(res.announcements);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/api/citizen/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => (n.ID_NOTIFIKASI === id ? { ...n, DIBACA: true } : n)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal menandai notifikasi.');
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-600">
            Dashboard Warga · NIK {user.nikMasked || 'Terverifikasi'}
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[#0F2942]">
            Selamat datang, {user.namaLengkap}
          </h1>
          <p className="mt-1 text-base text-slate-700">
            {user.alamat || 'Desa Ampel'} · {user.rtRw || 'Wilayah Desa Ampel'}
          </p>
        </div>
        <button
          type="button"
          onClick={onNewReport}
          className="px-5 py-3.5 bg-[#0B6E4F] text-white text-base font-bold rounded-xl hover:bg-[#08553d] transition-colors flex items-center gap-2 cursor-pointer"
        >
          <FilePlus2 className="w-5 h-5" aria-hidden="true" />
          <span>Buat Laporan atau Permohonan Baru</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: My Reports */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold text-[#0F2942] mb-4">
            Riwayat Laporan &amp; Permohonan Saya ({myReports.length})
          </h2>

          {loadError && (
            <p role="alert" className="mb-4 p-3 text-sm text-rose-900 bg-rose-50 border border-rose-200 rounded-lg">
              {loadError}
            </p>
          )}

          {loading ? (
            <p className="text-base text-slate-600 py-6">Memuat laporan Anda...</p>
          ) : myReports.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50">
              <p className="text-base text-slate-700">Anda belum memiliki riwayat laporan.</p>
              <button
                type="button"
                onClick={onNewReport}
                className="mt-4 px-5 py-2.5 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg cursor-pointer"
              >
                Kirim Laporan Pertama
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myReports.map((rep) => {
                const vis = getStatusVisual(rep.statusTerbaru);
                const isOpen = expandedId === rep.idLaporan;
                return (
                  <div key={rep.idLaporan} className="border border-slate-200 rounded-xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                          {rep.idLaporan} · {formatTanggalIndo(rep.tanggalLaporan)} · {rep.namaLayanan}
                        </p>
                        <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
                          {rep.judulLaporan}
                        </h3>
                      </div>
                      <span className={`px-3 py-1 rounded-lg border text-xs font-bold ${vis.bgClass} ${vis.borderClass} ${vis.textClass}`}>
                        {rep.statusTerbaru}
                      </span>
                    </div>

                    {rep.pesanKhususDinas && (
                      <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-900 flex items-start gap-2">
                        <Landmark className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{rep.pesanKhususDinas}</span>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        {rep.riwayatTindakLanjut.length} catatan tindak lanjut · {rep.buktiPublik.length} bukti publik
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : rep.idLaporan)}
                        className="text-sm font-bold text-[#0B6E4F] hover:underline cursor-pointer"
                      >
                        {isOpen ? 'Tutup Rincian' : 'Lihat Riwayat & Bukti'}
                      </button>
                    </div>

                    {isOpen && (
                      <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                        {rep.riwayatTindakLanjut.map((upd) => (
                          <div key={upd.idUpdate} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                            <div className="flex justify-between font-semibold text-slate-900">
                              <span>{upd.status}</span>
                              <span className="font-mono text-xs text-slate-500">{upd.tanggalUpdate}</span>
                            </div>
                            <p className="mt-1 text-slate-700">{upd.keterangan}</p>
                          </div>
                        ))}
                        {rep.buktiPublik.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            {rep.buktiPublik.map((doc) => (
                              <div
                                key={doc.idBukti}
                                className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50"
                              >
                                <CheckCircle2 className="w-5 h-5 text-[#0B6E4F] shrink-0" aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{doc.jenisBukti}</p>
                                  <p className="text-xs text-slate-500 truncate">{doc.namaFile}</p>
                                </div>
                                <EvidenceOpenButton
                                  idBukti={doc.idBukti}
                                  label="Buka"
                                  className="px-3 py-1.5 text-sm font-semibold text-[#0B6E4F] border border-emerald-300 rounded-lg hover:bg-emerald-50"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Notifications + Announcements */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="font-display text-lg font-bold text-[#0F2942] flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-[#0B6E4F]" aria-hidden="true" />
              <span>Notifikasi untuk Anda</span>
            </h2>
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-600">Belum ada notifikasi baru.</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.ID_NOTIFIKASI}
                    className={`p-3.5 rounded-xl border ${
                      n.DIBACA ? 'bg-white border-slate-200' : 'bg-emerald-50/70 border-emerald-200'
                    }`}
                  >
                    <p className="font-semibold text-sm text-slate-900">{n.JUDUL}</p>
                    <p className="mt-1 text-sm text-slate-700">{n.PESAN}</p>
                    {!n.DIBACA && (
                      <button
                        type="button"
                        onClick={() => markRead(n.ID_NOTIFIKASI)}
                        className="mt-2 text-xs font-bold text-[#0B6E4F] hover:underline cursor-pointer"
                      >
                        Tandai sudah dibaca
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="font-display text-lg font-bold text-[#0F2942] flex items-center gap-2 mb-4">
              <Megaphone className="w-5 h-5 text-[#0F2942]" aria-hidden="true" />
              <span>Pengumuman Desa</span>
            </h2>
            <div className="space-y-3">
              {announcements.slice(0, 3).map((a) => (
                <div key={a.ID_PENGUMUMAN} className="pb-3 border-b border-slate-100 last:border-b-0 last:pb-0">
                  <p className="text-xs font-semibold text-[#0B6E4F]">{a.KATEGORI} · {formatTanggalIndo(a.TANGGAL_TERBIT)}</p>
                  <p className="mt-0.5 font-semibold text-sm text-slate-900">{a.JUDUL}</p>
                  <p className="mt-1 text-xs text-slate-600">{a.RINGKASAN}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};
