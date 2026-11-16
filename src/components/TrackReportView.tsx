import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Landmark,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { CitizenTrackingResponse } from '../shared/types';
import { apiFetch, formatTanggalIndo, getStatusVisual } from '../lib/api';
import type { EvidenceVerifier } from '../lib/api';
import { EvidenceImage, EvidenceOpenButton } from './EvidenceImage';

interface TrackReportViewProps {
  initialTicketId?: string;
}

export const TrackReportView: React.FC<TrackReportViewProps> = ({ initialTicketId = '' }) => {
  const [ticketId, setTicketId] = useState(initialTicketId);
  const [verifyMode, setVerifyMode] = useState<'dob' | 'hp'>('dob');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [last4Hp, setLast4Hp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState<CitizenTrackingResponse | null>(null);
  // Verifikasi yang dipakai saat pencarian berhasil, dipakai ulang untuk membuka bukti.
  const [verifier, setVerifier] = useState<EvidenceVerifier>({});

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTracking(null);
    if (!ticketId.trim()) {
      setError('Masukkan nomor tiket laporan Anda (contoh: SW-2026-000001).');
      return;
    }
    if (verifyMode === 'dob' && !tanggalLahir) {
      setError('Masukkan tanggal lahir pelapor untuk verifikasi.');
      return;
    }
    if (verifyMode === 'hp' && last4Hp.replace(/\D/g, '').length < 4) {
      setError('Masukkan 4 digit terakhir nomor HP pelapor.');
      return;
    }

    const verifierInput: EvidenceVerifier = {
      ticketId: ticketId.trim(),
      tanggalLahir: verifyMode === 'dob' ? tanggalLahir : '',
      last4Hp: verifyMode === 'hp' ? last4Hp : '',
    };
    setLoading(true);
    try {
      const res = await apiFetch<{ tracking: CitizenTrackingResponse }>('/api/reports/track', {
        method: 'POST',
        body: JSON.stringify(verifierInput),
      });
      setTracking(res.tracking);
      setVerifier(verifierInput);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <h1 className="font-display text-3xl font-extrabold text-[#0F2942]">
          Cek Perkembangan Laporan
        </h1>
        <p className="mt-2 text-base text-slate-700">
          Masukkan nomor tiket laporan beserta verifikasi identitas pelapor. Demi privasi, data pribadi pelapor tidak ditampilkan secara terbuka.
        </p>

        <form onSubmit={handleSearch} className="mt-6 space-y-5">
          <div>
            <label htmlFor="track-ticket" className="block text-base font-semibold text-slate-900 mb-1.5">
              Nomor Tiket Laporan
            </label>
            <input
              id="track-ticket"
              type="text"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="Contoh: SW-2026-000001"
              className="w-full px-4 py-3 text-base font-mono border border-slate-300 rounded-xl bg-white"
            />
          </div>

          <div>
            <span className="block text-base font-semibold text-slate-900 mb-2">
              Pilih Metode Verifikasi Identitas
            </span>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setVerifyMode('dob')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                  verifyMode === 'dob' ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-600'
                }`}
              >
                Tanggal Lahir
              </button>
              <button
                type="button"
                onClick={() => setVerifyMode('hp')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                  verifyMode === 'hp' ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-600'
                }`}
              >
                4 Digit Terakhir No. HP
              </button>
            </div>
          </div>

          {verifyMode === 'dob' ? (
            <div>
              <label htmlFor="track-dob" className="block text-base font-semibold text-slate-900 mb-1.5">
                Tanggal Lahir Pelapor
              </label>
              <input
                id="track-dob"
                type="date"
                value={tanggalLahir}
                onChange={(e) => setTanggalLahir(e.target.value)}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-white"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="track-hp" className="block text-base font-semibold text-slate-900 mb-1.5">
                4 Digit Terakhir Nomor HP Terdaftar
              </label>
              <input
                id="track-hp"
                type="text"
                maxLength={4}
                value={last4Hp}
                onChange={(e) => setLast4Hp(e.target.value.replace(/\D/g, ''))}
                placeholder="Contoh: 7801"
                className="w-full px-4 py-3 text-base font-mono border border-slate-300 rounded-xl bg-white"
              />
            </div>
          )}

          {error && (
            <div role="alert" className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-base font-medium flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3.5 bg-[#0B6E4F] text-white text-base font-bold rounded-xl hover:bg-[#08553d] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Search className="w-5 h-5" aria-hidden="true" />
            <span>{loading ? 'Memeriksa...' : 'Cek Perkembangan Laporan'}</span>
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-200 flex items-center gap-2 text-sm text-slate-600">
          <ShieldCheck className="w-4 h-4 text-[#0B6E4F] shrink-0" aria-hidden="true" />
          <span>Data pelapor hanya dipakai untuk verifikasi. Simpan nomor tiket Anda untuk memantau perkembangan laporan.</span>
        </div>
      </div>

      {/* Tracking Result */}
      {tracking && (
        <section aria-label="Hasil Pelacakan Laporan" className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="font-mono text-sm font-semibold text-slate-600 tabular-nums">
                {tracking.idLaporan} · {formatTanggalIndo(tracking.tanggalLaporan)}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-[#0F2942]">
                {tracking.judulLaporan}
              </h2>
              <p className="mt-1 text-base text-slate-700">
                {tracking.namaLayanan} · {tracking.lokasiRingkas}
              </p>
            </div>
            {(() => {
              const vis = getStatusVisual(tracking.statusTerbaru);
              return (
                <div className={`px-4 py-2 rounded-lg border ${vis.bgClass} ${vis.borderClass} ${vis.textClass} font-bold text-sm flex items-center gap-2`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{tracking.statusTerbaru}</span>
                </div>
              );
            })()}
          </div>

          {tracking.pesanKhususDinas && (
            <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-3">
              <Landmark className="w-6 h-6 text-indigo-800 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-display font-bold text-indigo-950">Informasi Pengusulan ke Dinas</p>
                <p className="mt-1 text-base text-indigo-900">{tracking.pesanKhususDinas}</p>
              </div>
            </div>
          )}

          {tracking.alasanPenolakan && (
            <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl">
              <p className="font-display font-bold text-rose-950">Keterangan Penolakan / Kendala</p>
              <p className="mt-1 text-base text-rose-900">{tracking.alasanPenolakan}</p>
            </div>
          )}

          <div>
            <h3 className="font-display text-lg font-bold text-[#0F2942] mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#0B6E4F]" aria-hidden="true" />
              <span>Riwayat Tindak Lanjut Petugas</span>
            </h3>
            <ol className="space-y-4">
              {tracking.riwayatTindakLanjut.map((item) => (
                <li
                  key={item.idUpdate}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                    <span className="font-bold text-[#0F2942]">{item.status}</span>
                    <span className="font-mono tabular-nums">{item.tanggalUpdate} · {item.petugas}</span>
                  </div>
                  <p className="mt-2 text-base text-slate-800">{item.keterangan}</p>
                  {(item.dinasTujuan || item.nomorSurat) && (
                    <p className="mt-2 text-sm text-indigo-900 font-medium">
                      {item.dinasTujuan && <span>Dinas tujuan: {item.dinasTujuan}</span>}
                      {item.dinasTujuan && item.nomorSurat && ' · '}
                      {item.nomorSurat && <span className="font-mono">No. Surat: {item.nomorSurat}</span>}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h3 className="font-display text-lg font-bold text-[#0F2942] mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0B6E4F]" aria-hidden="true" />
              <span>Bukti Penanganan untuk Warga ({tracking.buktiPublik.length})</span>
            </h3>
            {tracking.buktiPublik.length === 0 ? (
              <p className="text-base text-slate-600">
                Belum ada foto atau dokumen bukti publik yang dilampirkan.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tracking.buktiPublik.map((doc) => (
                  <div key={doc.idBukti} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <EvidenceImage
                      idBukti={doc.idBukti}
                      namaFile={doc.namaFile}
                      mimeType={doc.mimeType}
                      verifier={verifier}
                      className="h-48"
                    />
                    <div className="p-4 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{doc.jenisBukti}</p>
                        <p className="text-xs text-slate-600">{formatTanggalIndo(doc.tanggalUpload)}</p>
                      </div>
                      <EvidenceOpenButton
                        idBukti={doc.idBukti}
                        label="Lihat File"
                        verifier={verifier}
                        className="px-3 py-1.5 text-sm font-semibold text-[#0B6E4F] border border-emerald-300 rounded-lg hover:bg-emerald-50 whitespace-nowrap"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
};
