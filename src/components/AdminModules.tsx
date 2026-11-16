import React, { useEffect, useState } from 'react';
import { Download, Folder, FolderOpen, Plus, Trash2 } from 'lucide-react';
import {
  AdminDashboardStats,
  SheetBuktiDokumen,
  SheetLogAktivitas,
  SheetPengaturan,
  SheetPengumuman,
  SheetPetugas,
  SheetWarga,
} from '../shared/types';
import { apiFetch, downloadCsvExport, formatTanggalIndo } from '../lib/api';
import { EvidenceOpenButton } from './EvidenceImage';

/** Pesan galat untuk aksi admin. Tidak tampil bila pesan kosong. */
const ErrorNote: React.FC<{ message: string }> = ({ message }) =>
  message ? (
    <p role="alert" className="p-3 text-sm text-rose-900 bg-rose-50 border border-rose-200 rounded-lg">
      {message}
    </p>
  ) : null;

const errorText = (err: unknown, fallback: string): string => (err instanceof Error ? err.message : fallback);

/* ============================================================================
 * DATA WARGA (MASKED NIK & KK + OPERATOR VERIFICATION)
 * ========================================================================== */
export const WargaManager: React.FC = () => {
  const [warga, setWarga] = useState<SheetWarga[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ warga: SheetWarga[] }>('/api/admin/warga');
      setWarga(res.warga);
    } catch (err) {
      setError(errorText(err, 'Gagal memuat data warga.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const verifyWarga = async (id: string, status: 'TERVERIFIKASI' | 'DITOLAK') => {
    setError('');
    try {
      await apiFetch(`/api/admin/warga/${encodeURIComponent(id)}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(errorText(err, 'Gagal memperbarui status verifikasi.'));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#0F2942]">Data Warga Desa Ampel</h2>
        <p className="text-sm text-slate-600">
          NIK dan nomor KK tersimpan dan ditampilkan dalam bentuk ter-mask sesuai kebijakan privasi.
        </p>
      </div>
      <ErrorNote message={error} />
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
              <th className="py-3 px-4">Nama Lengkap</th>
              <th className="py-3 px-4">NIK (Ter-mask)</th>
              <th className="py-3 px-4">KK (Ter-mask)</th>
              <th className="py-3 px-4">Alamat / RT-RW</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Verifikasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={6} className="py-6 text-center text-slate-500">Memuat data warga...</td></tr>
            ) : (
              warga.map((w) => (
                <tr key={w.ID_WARGA} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-slate-900">{w.NAMA_LENGKAP}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{w.NIK_MASKED}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{w.KK_MASKED}</td>
                  <td className="py-3 px-4 text-slate-700">{w.ALAMAT} ({w.RT_RW})</td>
                  <td className="py-3 px-4 font-semibold">{w.STATUS_VERIFIKASI}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {w.STATUS_VERIFIKASI !== 'TERVERIFIKASI' && (
                      <button
                        type="button"
                        onClick={() => verifyWarga(w.ID_WARGA, 'TERVERIFIKASI')}
                        className="px-3 py-1 text-xs font-bold bg-[#0B6E4F] text-white rounded-lg cursor-pointer"
                      >
                        Verifikasi
                      </button>
                    )}
                    {w.STATUS_VERIFIKASI !== 'DITOLAK' && (
                      <button
                        type="button"
                        onClick={() => verifyWarga(w.ID_WARGA, 'DITOLAK')}
                        className="px-3 py-1 text-xs font-semibold border border-slate-300 rounded-lg cursor-pointer"
                      >
                        Tolak
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ============================================================================
 * DATA PETUGAS
 * ========================================================================== */
export const PetugasManager: React.FC<{ onUpdated: () => void }> = ({ onUpdated }) => {
  const [petugas, setPetugas] = useState<SheetPetugas[]>([]);
  const [nama, setNama] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [bidang, setBidang] = useState('');
  const [noHp, setNoHp] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'PETUGAS' | 'OPERATOR' | 'KEPALA_DESA'>('PETUGAS');
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await apiFetch<{ petugas: SheetPetugas[] }>('/api/admin/petugas');
      setPetugas(res.petugas);
    } catch (err) {
      setError(errorText(err, 'Gagal memuat data petugas.'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      // Akun login opsional. Backend hanya mengizinkan Super Admin membuat akun.
      await apiFetch('/api/admin/petugas', {
        method: 'POST',
        body: JSON.stringify({
          namaPetugas: nama,
          jabatan,
          bidangTugas: bidang,
          noHp,
          username: username.trim(),
          password,
          role,
        }),
      });
    } catch (err) {
      setError(errorText(err, 'Gagal menyimpan data petugas.'));
      return;
    }
    setNama('');
    setJabatan('');
    setBidang('');
    setNoHp('');
    setUsername('');
    setPassword('');
    setRole('PETUGAS');
    setShowAdd(false);
    await load();
    onUpdated();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F2942]">Data Petugas Desa</h2>
          <p className="text-sm text-slate-600">Daftar perangkat desa dan petugas penanggung jawab layanan.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="px-4 py-2 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Tambah Petugas</span>
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="text"
            required
            placeholder="Nama Petugas"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            required
            placeholder="Jabatan"
            value={jabatan}
            onChange={(e) => setJabatan(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            placeholder="Bidang Tugas"
            value={bidang}
            onChange={(e) => setBidang(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="tel"
            placeholder="No. HP"
            value={noHp}
            onChange={(e) => setNoHp(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
          />
          <p className="sm:col-span-2 text-xs text-slate-600">
            Akun login bersifat opsional: isi nama pengguna dan kata sandi awal (minimal 8 karakter) bila petugas perlu masuk ke portal. Hanya Super Admin yang dapat membuat akun.
          </p>
          <input
            type="text"
            placeholder="Nama pengguna login (opsional)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Kata sandi awal (opsional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            aria-label="Peran akun login"
            className="px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="PETUGAS">Peran: Petugas</option>
            <option value="OPERATOR">Peran: Operator</option>
            <option value="KEPALA_DESA">Peran: Kepala Desa</option>
          </select>
          <div className="sm:col-span-2">
            <ErrorNote message={error} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="submit" className="px-4 py-2 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg cursor-pointer">
              Simpan Petugas
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
              <th className="py-3 px-4">Nama Petugas</th>
              <th className="py-3 px-4">Jabatan</th>
              <th className="py-3 px-4">Bidang Tugas</th>
              <th className="py-3 px-4">No. HP</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {petugas.map((p) => (
              <tr key={p.ID_PETUGAS} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-semibold text-slate-900">{p.NAMA_PETUGAS}</td>
                <td className="py-3 px-4 text-slate-700">{p.JABATAN}</td>
                <td className="py-3 px-4 text-slate-700">{p.BIDANG_TUGAS}</td>
                <td className="py-3 px-4 font-mono text-slate-700">{p.NO_HP}</td>
                <td className="py-3 px-4 font-semibold text-emerald-800">{p.STATUS}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ============================================================================
 * BUKTI PENANGANAN (GOOGLE DRIVE SIWARGA_DESA EXPLORER)
 * ========================================================================== */
export const BuktiDriveExplorer: React.FC = () => {
  const [tree, setTree] = useState<{
    rootFolder: string;
    subfolders: string[];
    ticketFolders: string[];
    evidence: SheetBuktiDokumen[];
  } | null>(null);

  useEffect(() => {
    apiFetch<{
      rootFolder: string;
      subfolders: string[];
      ticketFolders: string[];
      evidence: SheetBuktiDokumen[];
    }>('/api/admin/drive-tree').then(setTree);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#0F2942]">
          Bukti Penanganan &amp; Struktur Google Drive ({tree?.rootFolder || 'SIWARGA_DESA'})
        </h2>
        <p className="text-sm text-slate-600">
          Seluruh folder bersifat privat dan terorganisasi otomatis berdasarkan nomor tiket dan jenis dokumen.
        </p>
      </div>

      {tree && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-display font-bold text-base text-[#0F2942] flex items-center gap-2 mb-3">
              <FolderOpen className="w-5 h-5 text-[#0B6E4F]" aria-hidden="true" />
              <span>Struktur Folder Induk: {tree.rootFolder}/</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {tree.subfolders.map((sub) => (
                <div key={sub} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                    <Folder className="w-4 h-4 text-[#0F2942]" aria-hidden="true" />
                    <span className="truncate">{sub}</span>
                  </div>
                  {sub === '01_LAPORAN_WARGA' && (
                    <p className="mt-1.5 text-slate-600">
                      {tree.ticketFolders.length} folder tiket
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">ID Laporan</th>
                  <th className="py-3 px-4">Jenis Bukti</th>
                  <th className="py-3 px-4">Nama File</th>
                  <th className="py-3 px-4">Folder Drive</th>
                  <th className="py-3 px-4">Visibilitas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tree.evidence.map((doc) => (
                  <tr key={doc.ID_BUKTI} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-semibold text-[#0F2942]">{doc.ID_LAPORAN}</td>
                    <td className="py-3 px-4 text-slate-800">{doc.JENIS_BUKTI}</td>
                    <td className="py-3 px-4 text-slate-700">{doc.NAMA_FILE}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">{doc.DRIVE_FOLDER_SUB}</td>
                    <td className="py-3 px-4 text-xs font-semibold">{doc.VISIBILITAS}</td>
                    <td className="py-3 px-4 text-right">
                      <EvidenceOpenButton
                        idBukti={doc.ID_BUKTI}
                        label="Lihat"
                        className="px-3 py-1 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

/* ============================================================================
 * LAPORAN STATISTIK + EXPORT CSV
 * ========================================================================== */
export const StatistikExporter: React.FC<{ stats: AdminDashboardStats | null }> = ({ stats }) => {
  const [exportError, setExportError] = useState('');

  const handleExport = async () => {
    setExportError('');
    try {
      await downloadCsvExport();
    } catch (err) {
      setExportError(errorText(err, 'Gagal mengunduh laporan.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F2942]">Laporan Statistik &amp; Ekspor</h2>
          <p className="text-sm text-slate-600">Rekapitulasi kinerja penyelesaian laporan dan ekspor CSV.</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="px-4 py-2.5 bg-[#0F2942] text-white text-sm font-bold rounded-lg hover:bg-[#173b5e] flex items-center gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>Unduh Laporan (CSV)</span>
        </button>
      </div>

      <ErrorNote message={exportError} />

      {stats && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-4">Status Penanganan</th>
                <th className="py-3 px-4 text-right">Jumlah Laporan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {stats.statusDistribution.map((s) => (
                <tr key={s.label}>
                  <td className="py-3 px-4 font-medium text-slate-900">{s.label}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * PENGUMUMAN MANAGER
 * ========================================================================== */
export const AnnouncementsManager: React.FC = () => {
  const [items, setItems] = useState<SheetPengumuman[]>([]);
  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState<'Pelayanan' | 'Pembangunan' | 'Bantuan' | 'Jadwal Desa'>('Pelayanan');
  const [isi, setIsi] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await apiFetch<{ announcements: SheetPengumuman[] }>('/api/admin/announcements');
      setItems(res.announcements);
    } catch (err) {
      setError(errorText(err, 'Gagal memuat pengumuman.'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({ judul, kategori, isi }),
      });
      setJudul('');
      setIsi('');
      await load();
    } catch (err) {
      setError(errorText(err, 'Gagal menerbitkan pengumuman.'));
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await apiFetch(`/api/admin/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(errorText(err, 'Gagal menghapus pengumuman.'));
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold text-[#0F2942]">Kelola Pengumuman Desa</h2>
      <ErrorNote message={error} />

      <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input
            type="text"
            required
            placeholder="Judul Pengumuman"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            className="sm:col-span-2 px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
          />
          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value as typeof kategori)}
            className="px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="Pelayanan">Pelayanan</option>
            <option value="Bantuan">Bantuan</option>
            <option value="Pembangunan">Pembangunan</option>
            <option value="Jadwal Desa">Jadwal Desa</option>
          </select>
        </div>
        <textarea
          rows={3}
          required
          placeholder="Isi pengumuman untuk warga Desa Ampel..."
          value={isi}
          onChange={(e) => setIsi(e.target.value)}
          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
        />
        <button type="submit" className="px-4 py-2 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg cursor-pointer">
          Terbitkan Pengumuman
        </button>
      </form>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.ID_PENGUMUMAN} className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#0B6E4F]">
                {item.KATEGORI} · {formatTanggalIndo(item.TANGGAL_TERBIT)}
              </p>
              <h3 className="font-display text-lg font-bold text-slate-900 mt-1">{item.JUDUL}</h3>
              <p className="text-sm text-slate-700 mt-1">{item.ISI}</p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(item.ID_PENGUMUMAN)}
              aria-label={`Hapus pengumuman ${item.JUDUL}`}
              className="p-2 text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================================
 * PENGATURAN & PANDUAN INTEGRASI GAS / GOOGLE SHEETS / GOOGLE DRIVE
 * ========================================================================== */
export const SettingsAndGasGuide: React.FC = () => {
  const [settings, setSettings] = useState<SheetPengaturan[]>([]);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');
  const [pingResult, setPingResult] = useState('');

  useEffect(() => {
    apiFetch<{ settings: SheetPengaturan[] }>('/api/admin/settings')
      .then((r) => setSettings(r.settings))
      .catch((err: unknown) => setError(errorText(err, 'Gagal memuat pengaturan.')));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg('');
    setError('');
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings }),
      });
      setSavedMsg('Pengaturan berhasil disimpan.');
    } catch (err) {
      setError(errorText(err, 'Gagal menyimpan pengaturan.'));
    }
  };

  const handleTestGas = async () => {
    setPingResult('Menguji koneksi...');
    const url = settings.find((s) => s.KUNCI === 'GAS_WEB_APP_URL')?.NILAI || '';
    try {
      const res = await apiFetch<{ ok: boolean; status: number; preview: string }>('/api/admin/test-gas', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      setPingResult(`Terhubung (HTTP ${res.status}): ${res.preview}`);
    } catch (err) {
      setPingResult((err as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#0F2942]">
          Pengaturan &amp; Integrasi Google Sheets / Drive / Apps Script
        </h2>
        <p className="text-sm text-slate-600">
          Konfigurasi ID Spreadsheet, ID Folder Drive, dan URL Web App Google Apps Script.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <ErrorNote message={error} />
        {savedMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-sm font-medium text-emerald-950">
            {savedMsg}
          </div>
        )}
        <div className="space-y-3">
          {settings.map((item) => (
            <div key={item.KUNCI} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-4">
                <label className="font-mono text-xs font-bold text-[#0F2942] block">{item.KUNCI}</label>
                <span className="text-xs text-slate-500">{item.KETERANGAN}</span>
              </div>
              <div className="md:col-span-8">
                <input
                  type="text"
                  disabled={item.KUNCI === 'TICKET_COUNTER'}
                  value={item.NILAI}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev.map((s) => (s.KUNCI === item.KUNCI ? { ...s, NILAI: e.target.value } : s))
                    )
                  }
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg disabled:bg-slate-100"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="submit" className="px-5 py-2 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg cursor-pointer">
            Simpan Pengaturan
          </button>
          <button
            type="button"
            onClick={handleTestGas}
            className="px-4 py-2 bg-[#0F2942] text-white text-sm font-bold rounded-lg cursor-pointer"
          >
            Uji Koneksi Web App GAS
          </button>
          {pingResult && <span className="text-xs text-slate-700 font-mono">{pingResult}</span>}
        </div>
      </form>

      {/* Panduan pemasangan backend */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
        <h3 className="font-display text-lg font-bold text-[#0F2942]">Pemasangan Google Apps Script</h3>
        <p className="text-sm text-slate-700">
          Skrip backend ada di folder <span className="font-mono">gas/</span> pada repositori GitHub: <span className="font-mono">Code.gs</span>, <span className="font-mono">Setup.gs</span>, dan <span className="font-mono">appsscript.json</span>. Langkah pemasangan dan deployment lengkap ada di <span className="font-mono">README.md</span>.
        </p>
      </div>
    </div>
  );
};

/* ============================================================================
 * LOG AKTIVITAS (AUDIT TRAIL)
 * ========================================================================== */
export const ActivityLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<SheetLogAktivitas[]>([]);

  useEffect(() => {
    apiFetch<{ logs: SheetLogAktivitas[] }>('/api/admin/logs').then((r) => setLogs(r.logs));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#0F2942]">Log Aktivitas Sistem (LOG_AKTIVITAS)</h2>
        <p className="text-sm text-slate-600">Catatan audit trail seluruh aktivitas login, laporan, tindak lanjut, dan perubahan layanan.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
              <th className="py-3 px-4">Waktu</th>
              <th className="py-3 px-4">Pengguna</th>
              <th className="py-3 px-4">Peran</th>
              <th className="py-3 px-4">Aksi</th>
              <th className="py-3 px-4">ID Terkait</th>
              <th className="py-3 px-4">Rincian</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {logs.map((l) => (
              <tr key={l.ID_LOG} className="hover:bg-slate-50">
                <td className="py-2.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                  {new Date(l.WAKTU).toLocaleString('id-ID')}
                </td>
                <td className="py-2.5 px-4 font-semibold text-slate-900">{l.NAMA_PENGGUNA}</td>
                <td className="py-2.5 px-4 text-xs text-slate-600">{l.ROLE}</td>
                <td className="py-2.5 px-4 font-mono text-xs text-[#0F2942]">{l.AKSI}</td>
                <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{l.ID_TERKAIT}</td>
                <td className="py-2.5 px-4 text-slate-700">{l.DETAIL}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
