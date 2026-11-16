import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileUp,
  MapPin,
  SearchCheck,
  Send,
} from 'lucide-react';
import { PublicUserSession, ServiceWithForm } from '../shared/types';
import { apiFetch, readFileAsBase64 } from '../lib/api';
import { WizardEntryMode } from './CitizenHome';

interface ReportWizardProps {
  mode: WizardEntryMode;
  services: ServiceWithForm[];
  preselectedService?: ServiceWithForm;
  user: PublicUserSession | null;
  onCancel: () => void;
  onTrackTicket: (ticketId: string) => void;
}

const QUICK_PROBLEMS = [
  'Jalan rusak',
  'Sampah menumpuk',
  'Lampu jalan mati',
  'Saluran air tersumbat',
  'Gangguan keamanan',
  'Masalah lingkungan',
  'Lainnya',
];

export const ReportWizard: React.FC<ReportWizardProps> = ({
  mode,
  services,
  preselectedService,
  user,
  onCancel,
  onTrackTicket,
}) => {
  const isGeneral = mode === 'tidak-tahu';

  const groupServices = useMemo(() => {
    if (preselectedService) return services;
    if (mode === 'pengaduan') {
      return services.filter(
        (s) => s.KATEGORI_GRUP === 'A. Pengaduan' || s.KATEGORI_GRUP === 'D. Aspirasi'
      );
    }
    if (mode === 'bantuan') {
      return services.filter((s) => s.KATEGORI_GRUP === 'B. Bantuan');
    }
    if (mode === 'administrasi') {
      return services.filter(
        (s) => s.KATEGORI_GRUP === 'C. Administrasi' || s.KATEGORI_GRUP === 'E. Konsultasi'
      );
    }
    return services;
  }, [mode, preselectedService, services]);

  const [step, setStep] = useState<number>(isGeneral ? 2 : preselectedService ? 2 : 1);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    preselectedService?.ID_LAYANAN || groupServices[0]?.ID_LAYANAN || ''
  );
  const [masalahUtama, setMasalahUtama] = useState<string>(
    preselectedService?.NAMA_LAYANAN || (mode === 'pengaduan' ? 'Jalan rusak' : groupServices[0]?.NAMA_LAYANAN || 'Lainnya')
  );
  const [uraianMasalah, setUraianMasalah] = useState<string>(
    isGeneral ? 'Saya sedang mengalami masalah ' : ''
  );
  const [namaPelapor, setNamaPelapor] = useState<string>(user?.namaLengkap || '');
  const [noHpPelapor, setNoHpPelapor] = useState<string>(user?.noHp || '');
  const [tanggalLahir, setTanggalLahir] = useState<string>(user?.tanggalLahir || '');
  const [lokasiAlamat, setLokasiAlamat] = useState<string>(user?.alamat || '');
  const [rtRw, setRtRw] = useState<string>(user?.rtRw || '');
  const [dynamicValues, setDynamicValues] = useState<Record<string, string | string[]>>({});
  const [attachment, setAttachment] = useState<{
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    base64: string;
  } | null>(null);

  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [receipt, setReceipt] = useState<{
    ticketId: string;
    judulLaporan: string;
    namaLayanan: string;
    statusTerbaru: string;
    driveFolder: string;
  } | null>(null);

  const selectedService = useMemo(
    () => services.find((s) => s.ID_LAYANAN === selectedServiceId) || groupServices[0],
    [services, selectedServiceId, groupServices]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) {
      setAttachment(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran file maksimal 5 MB.');
      return;
    }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setError('Format file harus JPG, PNG, atau PDF.');
      return;
    }
    const parsed = await readFileAsBase64(file);
    setAttachment(parsed);
  };

  const validateCurrentStep = (): boolean => {
    setError('');
    if (step === 1) {
      if (!isGeneral && !selectedServiceId) {
        setError('Silakan pilih salah satu jenis layanan atau masalah.');
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (uraianMasalah.trim().length < 10) {
        setError('Ceritakan masalah atau kebutuhan Anda minimal 10 karakter.');
        return false;
      }
      if (namaPelapor.trim().length < 2) {
        setError('Nama lengkap pelapor wajib diisi.');
        return false;
      }
      if (noHpPelapor.replace(/\D/g, '').length < 8) {
        setError('Nomor HP / WhatsApp yang dapat dihubungi wajib diisi.');
        return false;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalLahir)) {
        setError('Tanggal lahir wajib diisi untuk verifikasi saat mengecek laporan nanti.');
        return false;
      }
      if (!isGeneral && selectedService) {
        for (const f of selectedService.fields) {
          if (!f.WAJIB) continue;
          const v = dynamicValues[f.ID_FIELD];
          if (!v || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && !v.trim())) {
            setError(`Pertanyaan "${f.LABEL_PERTANYAAN}" wajib diisi.`);
            return false;
          }
        }
      }
      return true;
    }
    if (step === 3) {
      if (lokasiAlamat.trim().length < 3) {
        setError('Alamat atau patokan lokasi masalah wajib diisi.');
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setStep((s) => Math.min(5, s + 1));
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        isGeneralInquiry: isGeneral,
        idLayanan: isGeneral ? 'GENERAL_INQUIRY' : selectedService?.ID_LAYANAN,
        kodeGrup: isGeneral ? 'GENERAL_INQUIRY' : selectedService?.KATEGORI_GRUP,
        namaLayanan: isGeneral ? 'Saya Tidak Tahu (Perlu Klasifikasi)' : selectedService?.NAMA_LAYANAN,
        masalahUtama: isGeneral ? 'Belum diklasifikasi' : masalahUtama,
        uraianMasalah: uraianMasalah.trim(),
        namaPelapor: namaPelapor.trim(),
        noHpPelapor: noHpPelapor.trim(),
        tanggalLahir,
        lokasiAlamat: lokasiAlamat.trim(),
        rtRw: rtRw.trim() || 'Desa Ampel',
        dataFormDinamis: dynamicValues,
        attachment,
      };
      const res = await apiFetch<{
        ticketId: string;
        report: {
          idLaporan: string;
          judulLaporan: string;
          namaLayanan: string;
          statusTerbaru: string;
          driveFolder: string;
        };
      }>('/api/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setReceipt({
        ticketId: res.ticketId,
        judulLaporan: res.report.judulLaporan,
        namaLayanan: res.report.namaLayanan,
        statusTerbaru: res.report.statusTerbaru,
        driveFolder: res.report.driveFolder,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white border-2 border-[#0B6E4F] rounded-2xl p-6 sm:p-10">
          <div className="flex items-center gap-3 text-[#0B6E4F]">
            <CheckCircle2 className="w-9 h-9 shrink-0" aria-hidden="true" />
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F2942]">
              Laporan Anda Berhasil Dikirim!
            </h1>
          </div>
          <p className="mt-3 text-base sm:text-lg text-slate-700">
            Simpan nomor tiket di bawah ini untuk memantau perkembangan penanganan dari Pemerintah Desa Ampel.
          </p>

          <div className="mt-6 p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
            <span className="text-sm font-semibold text-emerald-900">NOMOR TIKET LAPORAN ANDA</span>
            <p
              data-testid="submitted-ticket-id"
              className="mt-1 font-mono text-3xl sm:text-4xl font-bold text-[#0F2942] tabular-nums tracking-wider"
            >
              {receipt.ticketId}
            </p>
          </div>

          <dl className="mt-6 divide-y divide-slate-200 border-t border-b border-slate-200 text-base">
            <div className="py-3 flex flex-wrap justify-between gap-2">
              <dt className="text-slate-600">Ringkasan Laporan</dt>
              <dd className="font-semibold text-slate-900">{receipt.judulLaporan}</dd>
            </div>
            <div className="py-3 flex flex-wrap justify-between gap-2">
              <dt className="text-slate-600">Kategori / Layanan</dt>
              <dd className="font-semibold text-slate-900">{receipt.namaLayanan}</dd>
            </div>
            <div className="py-3 flex flex-wrap justify-between gap-2">
              <dt className="text-slate-600">Status Awal</dt>
              <dd className="font-semibold text-[#0B6E4F]">{receipt.statusTerbaru}</dd>
            </div>
            <div className="py-3 flex flex-wrap justify-between gap-2">
              <dt className="text-slate-600">Arsip Folder Bukti</dt>
              <dd className="font-mono text-sm text-slate-800">{receipt.driveFolder}</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onTrackTicket(receipt.ticketId)}
              className="flex-1 min-w-[200px] py-3.5 px-5 bg-[#0B6E4F] text-white text-base font-bold rounded-xl hover:bg-[#08553d] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <SearchCheck className="w-5 h-5" aria-hidden="true" />
              <span>Pantau Status Tiket Ini</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="py-3.5 px-5 bg-white border border-slate-300 text-slate-800 text-base font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-2 text-base font-semibold text-slate-700 hover:text-[#0F2942] mb-5 cursor-pointer"
      >
        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        <span>Kembali ke Halaman Utama</span>
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        {/* Step Progress Header */}
        <div className="border-b border-slate-200 pb-5 mb-6">
          <p className="text-sm font-semibold text-[#0B6E4F]">
            Langkah {step} dari 5 · Formulir Pelayanan Warga
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">
            {isGeneral
              ? 'Ceritakan Masalah Anda Tanpa Bingung'
              : mode === 'bantuan'
              ? 'Permohonan Bantuan Warga'
              : mode === 'administrasi'
              ? 'Pengurusan Surat & Administrasi Desa'
              : 'Pelaporan Masalah Desa'}
          </h1>
          <div className="mt-4 grid grid-cols-5 gap-2" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((num) => (
              <div
                key={num}
                className={`h-2 rounded-full ${
                  num <= step ? 'bg-[#0B6E4F]' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-base font-medium"
          >
            {error}
          </div>
        )}

        {/* STEP 1: Choose problem/service */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                {mode === 'pengaduan' ? '1. Apa masalah yang terjadi?' : '1. Layanan apa yang Anda perlukan?'}
              </h2>
              <p className="mt-1 text-base text-slate-700">
                Pilih satu pilihan yang paling mendekati keadaan Anda.
              </p>
            </div>

            {mode === 'pengaduan' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {QUICK_PROBLEMS.map((prob) => {
                  const matchedSvc = services.find((s) =>
                    s.NAMA_LAYANAN.toLowerCase().includes(prob.toLowerCase())
                  );
                  const active = masalahUtama === prob;
                  return (
                    <button
                      key={prob}
                      type="button"
                      onClick={() => {
                        setMasalahUtama(prob);
                        if (matchedSvc) setSelectedServiceId(matchedSvc.ID_LAYANAN);
                      }}
                      className={`p-4 text-left rounded-xl border-2 text-base font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'border-[#0B6E4F] bg-emerald-50 text-[#0F2942]'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                      }`}
                    >
                      {prob}
                    </button>
                  );
                })}
              </div>
            )}

            <div>
              <label htmlFor="select-service" className="block text-base font-semibold text-slate-900 mb-2">
                {mode === 'pengaduan' ? 'Atau pilih langsung dari daftar layanan:' : 'Pilih jenis layanan:'}
              </label>
              <select
                id="select-service"
                value={selectedServiceId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedServiceId(nextId);
                  const svc = services.find((s) => s.ID_LAYANAN === nextId);
                  if (svc) setMasalahUtama(svc.NAMA_LAYANAN);
                }}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-white text-slate-900"
              >
                {groupServices.map((svc) => (
                  <option key={svc.ID_LAYANAN} value={svc.ID_LAYANAN}>
                    {svc.NAMA_LAYANAN} ({svc.KATEGORI_GRUP})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* STEP 2: Describe problem + citizen identity + dynamic fields */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                2. Ceritakan masalah atau kebutuhan Anda
              </h2>
              <p className="mt-1 text-base text-slate-700">
                {isGeneral
                  ? 'Tuliskan dengan bahasa sehari-hari. Petugas desa akan membantu mengarahkan ke layanan yang tepat.'
                  : 'Jelaskan secara singkat agar petugas mudah memahami kondisi di lapangan.'}
              </p>
            </div>

            <div>
              <label htmlFor="uraian" className="block text-base font-semibold text-slate-900 mb-2">
                Uraian masalah / permohonan <span className="text-rose-700">*</span>
              </label>
              <textarea
                id="uraian"
                rows={4}
                value={uraianMasalah}
                onChange={(e) => setUraianMasalah(e.target.value)}
                placeholder="Ceritakan dengan bahasa sehari-hari..."
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-white text-slate-900"
              />
            </div>

            {/* Dynamic Service Builder Fields */}
            {!isGeneral && selectedService && selectedService.fields.length > 0 && (
              <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <p className="font-display text-base font-bold text-[#0F2942]">
                  Pertanyaan Tambahan: {selectedService.NAMA_LAYANAN}
                </p>
                {selectedService.fields.map((field) => {
                  const val = dynamicValues[field.ID_FIELD];
                  return (
                    <div key={field.ID_FIELD}>
                      <label className="block text-base font-semibold text-slate-900 mb-1.5">
                        {field.LABEL_PERTANYAAN}{' '}
                        {field.WAJIB ? (
                          <span className="text-rose-700">*</span>
                        ) : (
                          <span className="text-sm font-normal text-slate-500">(Opsional)</span>
                        )}
                      </label>

                      {(field.TIPE_ISIAN === 'text' || field.TIPE_ISIAN === 'location') && (
                        <input
                          type="text"
                          value={typeof val === 'string' ? val : ''}
                          placeholder={field.PLACEHOLDER || 'Ketik jawaban...'}
                          onChange={(e) =>
                            setDynamicValues((prev) => ({ ...prev, [field.ID_FIELD]: e.target.value }))
                          }
                          className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-white"
                        />
                      )}

                      {field.TIPE_ISIAN === 'textarea' && (
                        <textarea
                          rows={3}
                          value={typeof val === 'string' ? val : ''}
                          placeholder={field.PLACEHOLDER || 'Ketik jawaban...'}
                          onChange={(e) =>
                            setDynamicValues((prev) => ({ ...prev, [field.ID_FIELD]: e.target.value }))
                          }
                          className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-white"
                        />
                      )}

                      {field.TIPE_ISIAN === 'date' && (
                        <input
                          type="date"
                          value={typeof val === 'string' ? val : ''}
                          onChange={(e) =>
                            setDynamicValues((prev) => ({ ...prev, [field.ID_FIELD]: e.target.value }))
                          }
                          className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-white"
                        />
                      )}

                      {field.TIPE_ISIAN === 'dropdown' && (
                        <select
                          value={typeof val === 'string' ? val : ''}
                          onChange={(e) =>
                            setDynamicValues((prev) => ({ ...prev, [field.ID_FIELD]: e.target.value }))
                          }
                          className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-white"
                        >
                          <option value="">-- Pilih salah satu --</option>
                          {field.OPSI_PILIHAN.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {field.TIPE_ISIAN === 'radio' && (
                        <div className="space-y-2">
                          {field.OPSI_PILIHAN.map((opt) => (
                            <label key={opt} className="flex items-center gap-3 text-base cursor-pointer">
                              <input
                                type="radio"
                                name={field.ID_FIELD}
                                checked={val === opt}
                                onChange={() =>
                                  setDynamicValues((prev) => ({ ...prev, [field.ID_FIELD]: opt }))
                                }
                                className="w-5 h-5 accent-[#0B6E4F]"
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {field.TIPE_ISIAN === 'checkbox' && (
                        <div className="space-y-2">
                          {field.OPSI_PILIHAN.map((opt) => {
                            const arr = Array.isArray(val) ? val : [];
                            const checked = arr.includes(opt);
                            return (
                              <label key={opt} className="flex items-center gap-3 text-base cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const next = checked
                                      ? arr.filter((x) => x !== opt)
                                      : [...arr, opt];
                                    setDynamicValues((prev) => ({ ...prev, [field.ID_FIELD]: next }));
                                  }}
                                  className="w-5 h-5 accent-[#0B6E4F]"
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {(field.TIPE_ISIAN === 'photo' || field.TIPE_ISIAN === 'pdf') && (
                        <input
                          type="file"
                          accept={field.TIPE_ISIAN === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png'}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setDynamicValues((prev) => ({
                              ...prev,
                              [field.ID_FIELD]: `File terlampir: ${file.name}`,
                            }));
                            if (!attachment) {
                              const parsed = await readFileAsBase64(file);
                              setAttachment(parsed);
                            }
                          }}
                          className="w-full text-base"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <div>
                <label htmlFor="nama-pelapor" className="block text-base font-semibold text-slate-900 mb-1.5">
                  Nama Lengkap Anda <span className="text-rose-700">*</span>
                </label>
                <input
                  id="nama-pelapor"
                  type="text"
                  value={namaPelapor}
                  onChange={(e) => setNamaPelapor(e.target.value)}
                  placeholder="Contoh: Ibu Sri Wahyuni"
                  className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-white"
                />
              </div>
              <div>
                <label htmlFor="hp-pelapor" className="block text-base font-semibold text-slate-900 mb-1.5">
                  Nomor HP / WhatsApp <span className="text-rose-700">*</span>
                </label>
                <input
                  id="hp-pelapor"
                  type="tel"
                  value={noHpPelapor}
                  onChange={(e) => setNoHpPelapor(e.target.value)}
                  placeholder="0812..."
                  className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="dob-pelapor" className="block text-base font-semibold text-slate-900 mb-1.5">
                  Tanggal Lahir (untuk keamanan saat cek status laporan) <span className="text-rose-700">*</span>
                </label>
                <input
                  id="dob-pelapor"
                  type="date"
                  value={tanggalLahir}
                  onChange={(e) => setTanggalLahir(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Location */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <MapPin className="w-6 h-6 text-[#0B6E4F]" aria-hidden="true" />
              <h2 className="font-display text-xl font-bold text-slate-900">
                3. Di mana masalah atau lokasinya?
              </h2>
            </div>
            <p className="text-base text-slate-700">
              Tuliskan nama dusun, jalan, patokan tempat, serta RT/RW agar petugas tepat sasaran.
            </p>
            <div>
              <label htmlFor="alamat-lokasi" className="block text-base font-semibold text-slate-900 mb-2">
                Alamat / Patokan Lokasi <span className="text-rose-700">*</span>
              </label>
              <input
                id="alamat-lokasi"
                type="text"
                value={lokasiAlamat}
                onChange={(e) => setLokasiAlamat(e.target.value)}
                placeholder="Contoh: Depan Masjid Al-Ikhlas Dusun Krajan"
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-white"
              />
            </div>
            <div>
              <label htmlFor="rt-rw" className="block text-base font-semibold text-slate-900 mb-2">
                RT / RW (opsional)
              </label>
              <input
                id="rt-rw"
                type="text"
                value={rtRw}
                onChange={(e) => setRtRw(e.target.value)}
                placeholder="Contoh: RT 02 / RW 01"
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-white"
              />
            </div>
          </div>
        )}

        {/* STEP 4: Optional Photo / PDF upload */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <FileUp className="w-6 h-6 text-[#0B6E4F]" aria-hidden="true" />
              <h2 className="font-display text-xl font-bold text-slate-900">
                4. Unggah foto atau dokumen pendukung (opsional)
              </h2>
            </div>
            <p className="text-base text-slate-700">
              Jika tidak memiliki foto, Anda boleh langsung menekan tombol Lanjut ke ringkasan. Format yang diterima: JPG, PNG, atau PDF (maksimal 5 MB).
            </p>
            <div className="p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
              <label htmlFor="lampiran-file" className="block text-base font-semibold text-slate-900 mb-2">
                Pilih Foto atau Dokumen
              </label>
              <input
                id="lampiran-file"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleFileChange}
                className="w-full text-base text-slate-700"
              />
              {attachment && (
                <div className="mt-4 p-3 bg-white border border-emerald-200 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-900">
                    Siap diunggah: {attachment.fileName} ({Math.round(attachment.sizeBytes / 1024)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="text-sm font-semibold text-rose-700 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: Review and submit */}
        {step === 5 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-bold text-slate-900">
              5. Periksa kembali isian Anda sebelum dikirim
            </h2>
            <dl className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-slate-50 px-5 text-base">
              <div className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-slate-600">Kategori / Masalah</dt>
                <dd className="font-semibold text-slate-900">
                  {isGeneral ? 'Laporan Umum (Saya Tidak Tahu)' : `${selectedService?.NAMA_LAYANAN} (${masalahUtama})`}
                </dd>
              </div>
              <div className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-slate-600">Pelapor</dt>
                <dd className="font-semibold text-slate-900">{namaPelapor} · {noHpPelapor}</dd>
              </div>
              <div className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-slate-600">Lokasi</dt>
                <dd className="font-semibold text-slate-900">{lokasiAlamat} ({rtRw || 'Desa Ampel'})</dd>
              </div>
              <div className="py-3">
                <dt className="text-slate-600 mb-1">Cerita / Uraian Masalah</dt>
                <dd className="text-slate-900 bg-white p-3 rounded-lg border border-slate-200">{uraianMasalah}</dd>
              </div>
              <div className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-slate-600">Lampiran Foto/Dokumen</dt>
                <dd className="font-semibold text-slate-900">
                  {attachment ? attachment.fileName : 'Tidak ada lampiran'}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Footer navigation buttons */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between gap-4">
          {step > (isGeneral || preselectedService ? 2 : 1) ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="px-5 py-3 text-base font-semibold text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              <span>Sebelumnya</span>
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-3 text-base font-bold text-white bg-[#0B6E4F] rounded-xl hover:bg-[#08553d] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <span>Lanjut</span>
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="px-7 py-3.5 text-base font-bold text-white bg-[#0B6E4F] rounded-xl hover:bg-[#08553d] disabled:opacity-60 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-5 h-5" aria-hidden="true" />
              <span>{submitting ? 'Mengirim Laporan...' : 'Kirim Laporan Sekarang'}</span>
            </button>
          )}
        </div>
      </div>
    </main>
  );
};
