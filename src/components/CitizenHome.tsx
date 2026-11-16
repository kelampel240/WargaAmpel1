import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  HandHeart,
  HelpCircle,
  Megaphone,
  SearchCheck,
} from 'lucide-react';
import { ServiceGroup, ServiceWithForm, SheetPengumuman } from '../shared/types';
import { formatTanggalIndo } from '../lib/api';
import balaiDesaImg from '../assets/images/desa_ampel_balai_1794843784317.jpg';

export type WizardEntryMode = 'pengaduan' | 'bantuan' | 'administrasi' | 'tidak-tahu';

interface CitizenHomeProps {
  services: ServiceWithForm[];
  announcements: SheetPengumuman[];
  onStartWizard: (mode: WizardEntryMode, preselectedService?: ServiceWithForm) => void;
  onGoTrack: () => void;
  onGoAllAnnouncements: () => void;
  activeSection?: 'home' | 'services' | 'announcements';
}

export const CitizenHome: React.FC<CitizenHomeProps> = ({
  services,
  announcements,
  onStartWizard,
  onGoTrack,
  onGoAllAnnouncements,
  activeSection = 'home',
}) => {
  const [imgError, setImgError] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ServiceGroup | 'ALL'>('ALL');

  const groups = Array.from(new Set(services.map((s) => s.KATEGORI_GRUP)));
  const filteredServices =
    selectedGroup === 'ALL'
      ? services
      : services.filter((s) => s.KATEGORI_GRUP === selectedGroup);

  if (activeSection === 'services') {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0F2942] text-balance">
            Daftar Layanan Warga Desa Ampel
          </h1>
          <p className="mt-2 text-base sm:text-lg text-slate-700 max-w-2xl">
            Pilih layanan yang Anda butuhkan. Jika ragu memilih kategori, Anda tetap bisa menekan tombol bantuan umum.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-8">
          <button
            type="button"
            onClick={() => setSelectedGroup('ALL')}
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedGroup === 'ALL'
                ? 'bg-[#0F2942] text-white border-[#0F2942]'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            Semua Layanan ({services.length})
          </button>
          {groups.map((grp) => (
            <button
              key={grp}
              type="button"
              onClick={() => setSelectedGroup(grp)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedGroup === grp
                  ? 'bg-[#0B6E4F] text-white border-[#0B6E4F]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {grp}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServices.map((svc) => (
            <div
              key={svc.ID_LAYANAN}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4 hover:border-[#0B6E4F] transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {svc.KATEGORI_GRUP} · PJ: {svc.NAMA_PETUGAS_PJ}
                </p>
                <h2 className="mt-1.5 font-display text-xl font-bold text-slate-900">
                  {svc.NAMA_LAYANAN}
                </h2>
                <p className="mt-2 text-base text-slate-700 leading-relaxed">
                  {svc.DESKRIPSI}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  Persyaratan: <span className="font-medium text-slate-800">{svc.PERSYARATAN_DOKUMEN || 'Opsional'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const mode: WizardEntryMode = svc.KATEGORI_GRUP.startsWith('B.')
                    ? 'bantuan'
                    : svc.KATEGORI_GRUP.startsWith('C.')
                    ? 'administrasi'
                    : 'pengaduan';
                  onStartWizard(mode, svc);
                }}
                className="w-full py-3 px-4 bg-[#0B6E4F] text-white text-base font-semibold rounded-lg hover:bg-[#08553d] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Ajukan Layanan Ini</span>
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (activeSection === 'announcements') {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0F2942] text-balance">
            Informasi &amp; Pengumuman Desa Ampel
          </h1>
          <p className="mt-2 text-base sm:text-lg text-slate-700">
            Kabar resmi pelayanan, jadwal bantuan sosial, dan kegiatan masyarakat dari Pemerintah Desa Ampel.
          </p>
        </div>

        <div className="space-y-5">
          {announcements.map((item) => (
            <article
              key={item.ID_PENGUMUMAN}
              className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="font-semibold text-[#0B6E4F]">{item.KATEGORI}</span>
                <span aria-hidden="true">·</span>
                <span>{formatTanggalIndo(item.TANGGAL_TERBIT)}</span>
                <span aria-hidden="true">·</span>
                <span>{item.PENULIS}</span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">
                {item.JUDUL}
              </h2>
              <p className="mt-3 text-base text-slate-700 leading-relaxed whitespace-pre-line">
                {item.ISI}
              </p>
            </article>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
      {/* Hero & 4 Giant Accessible Buttons */}
      <section aria-labelledby="hero-heading" className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-sm font-semibold text-[#0B6E4F] tracking-wide">
              Portal Resmi Pelayanan Warga · Pemerintah Desa Ampel
            </p>
            <h1
              id="hero-heading"
              className="mt-2 font-display text-4xl sm:text-5xl font-extrabold text-[#0F2942] tracking-tight text-balance"
            >
              WARGA AMPEL
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-slate-700 leading-relaxed max-w-2xl">
              Jangan bingung. Ceritakan kebutuhan atau masalah Anda. Pemerintah desa akan membantu menindaklanjutinya.
            </p>

            {/* Secondary Link Required by Spec */}
            <div className="mt-6">
              <button
                type="button"
                onClick={onGoTrack}
                className="inline-flex items-center gap-3 px-5 py-3 text-left text-base font-bold text-[#0F2942] bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                <SearchCheck className="w-6 h-6 text-[#0B6E4F] shrink-0" aria-hidden="true" />
                <span>SAYA SUDAH PERNAH MELAPOR – CEK LAPORAN SAYA</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            {!imgError ? (
              <div className="h-full min-h-[220px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={balaiDesaImg}
                  alt="Balai Desa Ampel tempat pelayanan warga desa"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="h-full min-h-[220px] rounded-xl border border-slate-200 bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
                <FileText className="w-10 h-10 text-[#0F2942] mb-2" aria-hidden="true" />
                <p className="font-display font-bold text-slate-800">Balai Desa Ampel</p>
                <p className="text-sm text-slate-600">Layanan Pengaduan, Bantuan &amp; Administrasi</p>
              </div>
            )}
          </div>
        </div>

        {/* 4 Giant Accessible Action Buttons */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <button
            type="button"
            onClick={() => onStartWizard('pengaduan')}
            className="group text-left p-6 sm:p-7 rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-[#0B6E4F] transition-colors flex items-start gap-5 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-xl bg-[#0B6E4F] text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-8 h-8" aria-hidden="true" />
            </div>
            <div>
              <span className="block font-display text-lg sm:text-xl font-extrabold text-[#0F2942]">
                SAYA INGIN MELAPORKAN MASALAH
              </span>
              <span className="mt-1.5 block text-base text-slate-700">
                Jalan rusak, sampah menumpuk, lampu jalan mati, saluran air tersumbat, atau gangguan lingkungan.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onStartWizard('bantuan')}
            className="group text-left p-6 sm:p-7 rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-[#0B6E4F] transition-colors flex items-start gap-5 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-xl bg-[#0F2942] text-white flex items-center justify-center shrink-0">
              <HandHeart className="w-8 h-8" aria-hidden="true" />
            </div>
            <div>
              <span className="block font-display text-lg sm:text-xl font-extrabold text-[#0F2942]">
                SAYA MEMBUTUHKAN BANTUAN
              </span>
              <span className="mt-1.5 block text-base text-slate-700">
                Bantuan sosial pangan, pendidikan anak sekolah, rujukan kesehatan, atau kondisi darurat keluarga.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onStartWizard('administrasi')}
            className="group text-left p-6 sm:p-7 rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-[#0B6E4F] transition-colors flex items-start gap-5 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-xl bg-amber-700 text-white flex items-center justify-center shrink-0">
              <FileText className="w-8 h-8" aria-hidden="true" />
            </div>
            <div>
              <span className="block font-display text-lg sm:text-xl font-extrabold text-[#0F2942]">
                SAYA INGIN MENGURUS SURAT ATAU LAYANAN
              </span>
              <span className="mt-1.5 block text-base text-slate-700">
                Surat domisili, surat keterangan usaha, surat tidak mampu, atau surat pengantar desa.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onStartWizard('tidak-tahu')}
            className="group text-left p-6 sm:p-7 rounded-xl border-2 border-slate-300 bg-white hover:bg-sky-50 hover:border-[#0F2942] transition-colors flex items-start gap-5 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0">
              <HelpCircle className="w-8 h-8" aria-hidden="true" />
            </div>
            <div>
              <span className="block font-display text-lg sm:text-xl font-extrabold text-[#0F2942]">
                SAYA TIDAK TAHU HARUS PILIH YANG MANA
              </span>
              <span className="mt-1.5 block text-base text-slate-700">
                Cukup ceritakan masalah atau pertanyaan Anda dengan bahasa sehari-hari. Petugas desa akan mengarahkan.
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Active Dynamic Services Preview */}
      <section aria-labelledby="layanan-aktif-heading">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <h2 id="layanan-aktif-heading" className="font-display text-2xl font-bold text-[#0F2942]">
              Layanan Desa yang Tersedia
            </h2>
            <p className="mt-1 text-base text-slate-700">
              Klik salah satu layanan di bawah untuk langsung mengisi formulir bertahap.
            </p>
          </div>
          <span className="text-sm font-medium text-slate-600 tabular-nums">
            {services.length} layanan aktif
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.slice(0, 6).map((svc) => (
            <button
              key={svc.ID_LAYANAN}
              type="button"
              onClick={() => {
                const mode: WizardEntryMode = svc.KATEGORI_GRUP.startsWith('B.')
                  ? 'bantuan'
                  : svc.KATEGORI_GRUP.startsWith('C.')
                  ? 'administrasi'
                  : 'pengaduan';
                onStartWizard(mode, svc);
              }}
              className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-[#0B6E4F] transition-colors flex flex-col justify-between gap-3 cursor-pointer"
            >
              <div>
                <span className="text-xs font-semibold text-slate-500">
                  {svc.KATEGORI_GRUP}
                </span>
                <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
                  {svc.NAMA_LAYANAN}
                </h3>
                <p className="mt-1 text-sm text-slate-700 line-clamp-2">
                  {svc.DESKRIPSI}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B6E4F]">
                Mulai ajukan <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Village Announcements */}
      <section aria-labelledby="pengumuman-heading" className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Megaphone className="w-6 h-6 text-[#0B6E4F]" aria-hidden="true" />
            <h2 id="pengumuman-heading" className="font-display text-2xl font-bold text-[#0F2942]">
              Pengumuman Resmi Desa
            </h2>
          </div>
          <button
            type="button"
            onClick={onGoAllAnnouncements}
            className="text-base font-semibold text-[#0B6E4F] hover:underline cursor-pointer"
          >
            Lihat semua pengumuman
          </button>
        </div>

        <div className="divide-y divide-slate-200">
          {announcements.slice(0, 3).map((item) => (
            <div key={item.ID_PENGUMUMAN} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="font-semibold text-[#0B6E4F]">{item.KATEGORI}</span>
                <span aria-hidden="true">·</span>
                <span>{formatTanggalIndo(item.TANGGAL_TERBIT)}</span>
              </div>
              <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
                {item.JUDUL}
              </h3>
              <p className="mt-1 text-base text-slate-700">
                {item.RINGKASAN}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};
