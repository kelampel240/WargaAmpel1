import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  FolderOpen,
  Upload,
  X,
} from 'lucide-react';
import {
  EVIDENCE_TYPES,
  EvidenceType,
  EvidenceVisibility,
  REPORT_STATUSES,
  ReportStatus,
  ServiceWithForm,
  SheetBuktiDokumen,
  SheetLaporan,
  SheetPetugas,
  SheetTindakLanjut,
} from '../shared/types';
import { apiFetch, formatTanggalIndo, getStatusVisual, readFileAsBase64 } from '../lib/api';
import { EvidenceOpenButton } from './EvidenceImage';

interface ReportDetailModalProps {
  ticketId: string;
  initialFocus?: 'detail' | 'followup' | 'evidence';
  services: ServiceWithForm[];
  petugasList: SheetPetugas[];
  onClose: () => void;
  onUpdated: () => void;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  ticketId,
  initialFocus = 'detail',
  services,
  petugasList,
  onClose,
  onUpdated,
}) => {
  const [report, setReport] = useState<SheetLaporan | null>(null);
  const [followUps, setFollowUps] = useState<SheetTindakLanjut[]>([]);
  const [evidence, setEvidence] = useState<SheetBuktiDokumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Follow-up form state (append-only)
  const [status, setStatus] = useState<ReportStatus>('Sedang ditindaklanjuti');
  const [keterangan, setKeterangan] = useState('');
  const [tanggalTindakan, setTanggalTindakan] = useState(new Date().toISOString().slice(0, 10));
  const [dinasTujuan, setDinasTujuan] = useState('');
  const [nomorSurat, setNomorSurat] = useState('');

  // Evidence upload state
  const [jenisBukti, setJenisBukti] = useState<EvidenceType>('Foto proses');
  const [visibilitas, setVisibilitas] = useState<EvidenceVisibility>('PUBLIK_WARGA');
  const [filePayload, setFilePayload] = useState<{
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    base64: string;
  } | null>(null);

  // Classification state for GENERAL_INQUIRY
  const [classifyServiceId, setClassifyServiceId] = useState(services[0]?.ID_LAYANAN || '');
  const [classifyPetugasId, setClassifyPetugasId] = useState(petugasList[0]?.ID_PETUGAS || '');

  const [saving, setSaving] = useState(false);

  const loadDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{
        report: SheetLaporan;
        followUps: SheetTindakLanjut[];
        evidence: SheetBuktiDokumen[];
      }>(`/api/admin/reports/${encodeURIComponent(ticketId)}`);
      setReport(res.report);
      setFollowUps(res.followUps);
      setEvidence(res.evidence);
      setStatus(res.report.STATUS_TERBARU);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [ticketId]);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const f = e.target.files?.[0];
    if (!f) {
      setFilePayload(null);
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Ukuran file bukti maksimal 5 MB.');
      return;
    }
    try {
      setFilePayload(await readFileAsBase64(f));
    } catch (err) {
      setFilePayload(null);
      setError(err instanceof Error ? err.message : 'Gagal membaca file.');
    }
  };

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSaving(true);
    try {
      await apiFetch(`/api/admin/reports/${encodeURIComponent(ticketId)}/followup`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          keterangan,
          tanggalTindakan,
          dinasTujuan,
          nomorSurat,
          evidenceUpload: filePayload
            ? {
                ...filePayload,
                jenisBukti,
                visibilitas,
              }
            : null,
        }),
      });
      setKeterangan('');
      setDinasTujuan('');
      setNomorSurat('');
      setFilePayload(null);
      setSuccessMsg('Tindak lanjut baru berhasil ditambahkan ke riwayat (tanpa menimpa catatan lama).');
      await loadDetail();
      onUpdated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadEvidenceOnly = async () => {
    if (!filePayload) {
      setError('Pilih file bukti (JPG, PNG, atau PDF) terlebih dahulu.');
      return;
    }
    setError('');
    setSuccessMsg('');
    setSaving(true);
    try {
      await apiFetch(`/api/admin/reports/${encodeURIComponent(ticketId)}/evidence`, {
        method: 'POST',
        body: JSON.stringify({
          ...filePayload,
          jenisBukti,
          visibilitas,
          keterangan: keterangan.trim() || `Unggah dokumen ${jenisBukti}`,
        }),
      });
      setFilePayload(null);
      setSuccessMsg(`Bukti "${jenisBukti}" tersimpan ke Google Drive dan tercatat di BUKTI_DOKUMEN.`);
      await loadDetail();
      onUpdated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleClassify = async () => {
    setError('');
    setSaving(true);
    try {
      await apiFetch(`/api/admin/reports/${encodeURIComponent(ticketId)}/classify`, {
        method: 'POST',
        body: JSON.stringify({
          idLayanan: classifyServiceId,
          idPetugas: classifyPetugasId,
        }),
      });
      setSuccessMsg('Laporan umum berhasil diklasifikasikan dan ditugaskan ke petugas.');
      await loadDetail();
      onUpdated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-detail-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup rincian laporan"
          className="sticky top-0 float-right p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {loading || !report ? (
          <div className="py-12 text-center text-slate-600">
            {error ? <p className="text-rose-700 font-semibold">{error}</p> : 'Memuat rincian laporan...'}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Summary */}
            <div className="border-b border-slate-200 pb-5">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="font-mono font-bold text-[#0F2942]">{report.ID_LAPORAN}</span>
                <span aria-hidden="true">·</span>
                <span>{report.KODE_GRUP}</span>
                <span aria-hidden="true">·</span>
                <span>{formatTanggalIndo(report.CREATED_AT)}</span>
              </div>
              <h2 id="report-detail-title" className="mt-1 font-display text-2xl font-extrabold text-[#0F2942]">
                {report.JUDUL_LAPORAN}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {(() => {
                  const vis = getStatusVisual(report.STATUS_TERBARU);
                  return (
                    <span className={`px-3 py-1 rounded-lg border text-xs font-bold ${vis.bgClass} ${vis.borderClass} ${vis.textClass}`}>
                      {report.STATUS_TERBARU}
                    </span>
                  );
                })()}
                <span className="text-sm text-slate-600 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
                  <span className="font-mono text-xs">{report.DRIVE_FOLDER_URL}</span>
                </span>
              </div>
            </div>

            {error && (
              <div role="alert" className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-sm font-medium">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#0B6E4F] shrink-0" aria-hidden="true" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Citizen Info (Admin Only) & Dynamic Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-sm">
                <h3 className="font-display font-bold text-[#0F2942]">Informasi Pelapor &amp; Lokasi</h3>
                <p><span className="text-slate-600">Nama:</span> <strong className="text-slate-900">{report.NAMA_PELAPOR}</strong></p>
                <p><span className="text-slate-600">No. HP:</span> <span className="font-mono">{report.NO_HP_PELAPOR}</span></p>
                <p><span className="text-slate-600">NIK (Ter-mask):</span> <span className="font-mono">{report.NIK_MASKED_PELAPOR || 'Belum tertaut akun'}</span></p>
                <p><span className="text-slate-600">Alamat:</span> {report.LOKASI_ALAMAT} ({report.RT_RW})</p>
                <p><span className="text-slate-600">Petugas PJ:</span> <strong>{report.NAMA_PETUGAS_TUGAS || 'Belum ditugaskan'}</strong></p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-sm">
                <h3 className="font-display font-bold text-[#0F2942]">Uraian Masalah Warga</h3>
                <p className="text-slate-800 whitespace-pre-line">{report.URAIAN_MASALAH}</p>
                {Object.keys(report.DATA_FORM_DINAMIS || {}).length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-600 mb-1">Isian Formulir Layanan:</p>
                    {Object.entries(report.DATA_FORM_DINAMIS).map(([k, v]) => (
                      <p key={k} className="text-xs text-slate-800">
                        <span className="font-mono">{k}:</span> {Array.isArray(v) ? v.join(', ') : v}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Classify GENERAL_INQUIRY box */}
            {report.KODE_GRUP === 'GENERAL_INQUIRY' && (
              <div className="p-5 bg-sky-50 border border-sky-200 rounded-xl space-y-3">
                <h3 className="font-display font-bold text-[#0F2942]">
                  Klasifikasi Laporan Umum ("Saya Tidak Tahu")
                </h3>
                <p className="text-sm text-slate-700">
                  Arahkan laporan ini ke jenis layanan yang sesuai dan tugaskan petugas penanggung jawab.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={classifyServiceId}
                    onChange={(e) => setClassifyServiceId(e.target.value)}
                    aria-label="Pilih layanan tujuan klasifikasi"
                    className="px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {services.map((s) => (
                      <option key={s.ID_LAYANAN} value={s.ID_LAYANAN}>
                        {s.NAMA_LAYANAN} ({s.KATEGORI_GRUP})
                      </option>
                    ))}
                  </select>
                  <select
                    value={classifyPetugasId}
                    onChange={(e) => setClassifyPetugasId(e.target.value)}
                    aria-label="Pilih petugas penanggung jawab"
                    className="px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {petugasList.map((p) => (
                      <option key={p.ID_PETUGAS} value={p.ID_PETUGAS}>
                        {p.NAMA_PETUGAS} ({p.JABATAN})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleClassify}
                    className="px-4 py-2.5 bg-[#0F2942] text-white text-sm font-bold rounded-lg hover:bg-[#173b5e] cursor-pointer"
                  >
                    Simpan Klasifikasi &amp; Tugaskan
                  </button>
                </div>
              </div>
            )}

            {/* UPDATE TINDAK LANJUT DAN UPLOAD BUKTI (Section 10 Priority Module) */}
            <form
              onSubmit={handleSaveFollowUp}
              className={`p-5 sm:p-6 rounded-xl border-2 ${
                initialFocus === 'followup' || initialFocus === 'evidence'
                  ? 'border-[#0B6E4F] bg-emerald-50/30'
                  : 'border-slate-200 bg-white'
              } space-y-4`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-extrabold text-[#0F2942]">
                  UPDATE TINDAK LANJUT DAN UPLOAD BUKTI
                </h3>
                <span className="font-mono text-xs text-slate-600">Tiket: {report.ID_LAPORAN}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="upd-status" className="block text-sm font-semibold text-slate-900 mb-1">
                    Status Penanganan <span className="text-rose-700">*</span>
                  </label>
                  <select
                    id="upd-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ReportStatus)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {REPORT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="upd-tgl" className="block text-sm font-semibold text-slate-900 mb-1">
                    Tanggal Tindakan
                  </label>
                  <input
                    id="upd-tgl"
                    type="date"
                    value={tanggalTindakan}
                    onChange={(e) => setTanggalTindakan(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="upd-ket" className="block text-sm font-semibold text-slate-900 mb-1">
                  Keterangan Tindakan{' '}
                  {status === 'Tidak dapat ditindaklanjuti' && (
                    <span className="text-rose-700">(Wajib alasan tertulis jelas min. 15 karakter)</span>
                  )}
                </label>
                <textarea
                  id="upd-ket"
                  rows={3}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Jelaskan langkah yang dilakukan petugas (setiap simpan menambah baris baru di TINDAK_LANJUT)..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="upd-dinas" className="block text-sm font-semibold text-slate-900 mb-1">
                    Nama Dinas Tujuan {status === 'Sudah diusulkan ke dinas terkait' && <span className="text-rose-700">*</span>}
                  </label>
                  <input
                    id="upd-dinas"
                    type="text"
                    value={dinasTujuan}
                    onChange={(e) => setDinasTujuan(e.target.value)}
                    placeholder="Contoh: Dinas PUPR / Dinas Sosial Kabupaten"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="upd-surat" className="block text-sm font-semibold text-slate-900 mb-1">
                    Nomor Surat (jika tersedia)
                  </label>
                  <input
                    id="upd-surat"
                    type="text"
                    value={nomorSurat}
                    onChange={(e) => setNomorSurat(e.target.value)}
                    placeholder="Contoh: 600/145/DS-AMP/XI/2026"
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Evidence Upload Section */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <p className="text-sm font-bold text-[#0F2942] flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
                  <span>Unggah Foto atau Dokumen Bukti ke Google Drive (Opsional, JPG/PNG/PDF maks 5 MB)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ev-type" className="block text-xs font-semibold text-slate-700 mb-1">
                      Jenis Bukti
                    </label>
                    <select
                      id="ev-type"
                      value={jenisBukti}
                      onChange={(e) => setJenisBukti(e.target.value as EvidenceType)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      {EVIDENCE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ev-vis" className="block text-xs font-semibold text-slate-700 mb-1">
                      Visibilitas Akses Warga
                    </label>
                    <select
                      id="ev-vis"
                      value={visibilitas}
                      onChange={(e) => setVisibilitas(e.target.value as EvidenceVisibility)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="PUBLIK_WARGA">PUBLIK_WARGA (Dapat dilihat warga pelapor)</option>
                      <option value="INTERNAL_DESA">INTERNAL_DESA (Hanya internal petugas/admin)</option>
                    </select>
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleFilePick}
                  className="w-full text-sm text-slate-700"
                />
                {filePayload && (
                  <p className="text-xs font-semibold text-[#0B6E4F]">
                    File terpilih: {filePayload.fileName} ({Math.round(filePayload.sizeBytes / 1024)} KB)
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg hover:bg-[#08553d] disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Tindak Lanjut & Status'}
                </button>
                {filePayload && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleUploadEvidenceOnly}
                    className="px-4 py-2.5 bg-[#0F2942] text-white text-sm font-bold rounded-lg hover:bg-[#173b5e] disabled:opacity-60 cursor-pointer"
                  >
                    Unggah Bukti Saja (Tanpa Ubah Status)
                  </button>
                )}
              </div>
            </form>

            {/* History Timeline & Attached Evidence */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-display text-base font-bold text-[#0F2942] mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
                  <span>Riwayat Tindak Lanjut (TINDAK_LANJUT · {followUps.length})</span>
                </h3>
                <div className="space-y-3">
                  {followUps.map((f) => (
                    <div key={f.ID_UPDATE} className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 text-sm">
                      <div className="flex justify-between gap-2 font-semibold text-slate-900">
                        <span>{f.STATUS}</span>
                        <span className="font-mono text-xs text-slate-500">{f.TANGGAL_UPDATE}</span>
                      </div>
                      <p className="mt-1 text-slate-700">{f.KETERANGAN}</p>
                      <p className="mt-1.5 text-xs text-slate-500">
                        Petugas: {f.PETUGAS}
                        {f.DINAS_TUJUAN ? ` · Dinas: ${f.DINAS_TUJUAN}` : ''}
                        {f.NOMOR_SURAT ? ` · Surat: ${f.NOMOR_SURAT}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-display text-base font-bold text-[#0F2942] mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
                  <span>Daftar Dokumen Bukti (BUKTI_DOKUMEN · {evidence.length})</span>
                </h3>
                {evidence.length === 0 ? (
                  <p className="text-sm text-slate-600">Belum ada dokumen bukti yang diunggah.</p>
                ) : (
                  <div className="space-y-3">
                    {evidence.map((doc) => (
                      <div key={doc.ID_BUKTI} className="p-3.5 border border-slate-200 rounded-xl bg-white text-sm flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{doc.JENIS_BUKTI}</p>
                          <p className="text-xs text-slate-600 truncate">
                            {doc.NAMA_FILE} · {doc.VISIBILITAS}
                          </p>
                          <p className="font-mono text-[11px] text-slate-500 truncate">{doc.DRIVE_FOLDER_SUB}</p>
                        </div>
                        <EvidenceOpenButton
                          idBukti={doc.ID_BUKTI}
                          label="Buka"
                          className="px-3 py-1.5 text-xs font-bold text-[#0F2942] border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
