export type UserRole = 'WARGA' | 'PETUGAS' | 'OPERATOR' | 'KEPALA_DESA' | 'SUPER_ADMIN';

export const REPORT_STATUSES = [
  'Laporan diterima',
  'Sedang ditindaklanjuti',
  'Sedang dalam proses perbaikan',
  'Sudah diusulkan ke dinas terkait',
  'Menunggu tindak lanjut dinas',
  'Sudah diperbaiki atau ditangani',
  'Tidak dapat ditindaklanjuti',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const SERVICE_GROUPS = [
  'A. Pengaduan',
  'B. Bantuan',
  'C. Administrasi',
  'D. Aspirasi',
  'E. Konsultasi',
] as const;

export type ServiceGroup = (typeof SERVICE_GROUPS)[number];

export const EVIDENCE_TYPES = [
  'Foto sebelum perbaikan',
  'Foto proses',
  'Foto sesudah perbaikan',
  'Surat usulan ke dinas',
  'Bukti pengiriman surat',
  'Tanda terima',
  'Surat balasan dinas',
  'Dokumen pendukung lainnya',
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export type EvidenceVisibility = 'PUBLIK_WARGA' | 'INTERNAL_DESA';

export const FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'dropdown',
  'radio',
  'checkbox',
  'date',
  'photo',
  'pdf',
  'location',
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export interface SheetUser {
  ID_USER: string;
  USERNAME: string;
  NAMA_LENGKAP: string;
  EMAIL: string;
  NO_HP: string;
  PASSWORD_HASH: string;
  ROLE: UserRole;
  STATUS_AKUN: 'AKTIF' | 'MENUNGGU_VERIFIKASI' | 'NONAKTIF';
  KODE_VERIFIKASI?: string;
  RESET_TOKEN?: string;
  CREATED_AT: string;
}

export interface SheetWarga {
  ID_WARGA: string;
  ID_USER?: string;
  NAMA_LENGKAP: string;
  NIK_MASKED: string;
  NIK_HASH: string;
  KK_MASKED: string;
  TANGGAL_LAHIR: string; // YYYY-MM-DD
  ALAMAT: string;
  RT_RW: string;
  NO_HP: string;
  STATUS_VERIFIKASI: 'TERVERIFIKASI' | 'MENUNGGU_VERIFIKASI' | 'DITOLAK';
  CREATED_AT: string;
}

export interface SheetPetugas {
  ID_PETUGAS: string;
  ID_USER: string;
  NAMA_PETUGAS: string;
  JABATAN: string;
  BIDANG_TUGAS: string;
  NO_HP: string;
  STATUS: 'AKTIF' | 'NONAKTIF';
  CREATED_AT: string;
}

export interface SheetKategoriLayanan {
  ID_LAYANAN: string;
  KODE_LAYANAN: string;
  NAMA_LAYANAN: string;
  KATEGORI_GRUP: ServiceGroup;
  DESKRIPSI: string;
  IKON: string;
  PERSYARATAN_DOKUMEN: string;
  ID_PETUGAS_PJ: string;
  NAMA_PETUGAS_PJ: string;
  ALUR_STATUS: ReportStatus[];
  STATUS_AKTIF: boolean;
  URUTAN: number;
  CREATED_AT: string;
}

export interface SheetKonfigurasiForm {
  ID_FIELD: string;
  ID_LAYANAN: string;
  LABEL_PERTANYAAN: string;
  TIPE_ISIAN: FormFieldType;
  OPSI_PILIHAN: string[]; // For dropdown, radio, checkbox
  WAJIB: boolean;
  PLACEHOLDER: string;
  URUTAN: number;
}

export interface SheetLaporan {
  ID_LAPORAN: string; // e.g. SW-2026-000001
  ID_WARGA?: string;
  ID_USER_PELAPOR?: string;
  NAMA_PELAPOR: string;
  NO_HP_PELAPOR: string;
  TANGGAL_LAHIR_VERIFIKASI: string; // YYYY-MM-DD used for tracking identity verification
  NIK_MASKED_PELAPOR?: string;
  KODE_GRUP: ServiceGroup | 'GENERAL_INQUIRY';
  ID_LAYANAN: string;
  NAMA_LAYANAN: string;
  JUDUL_LAPORAN: string;
  MASALAH_UTAMA: string;
  URAIAN_MASALAH: string;
  LOKASI_ALAMAT: string;
  RT_RW: string;
  DATA_FORM_DINAMIS: Record<string, string | string[]>;
  STATUS_TERBARU: ReportStatus;
  ID_PETUGAS_TUGAS?: string;
  NAMA_PETUGAS_TUGAS?: string;
  ALASAN_TIDAK_DITINDAKLANJUTI?: string;
  DRIVE_FOLDER_NAME: string;
  DRIVE_FOLDER_URL: string;
  CREATED_AT: string;
  UPDATED_AT: string;
}

export interface SheetTindakLanjut {
  ID_UPDATE: string;
  ID_LAPORAN: string;
  TANGGAL_UPDATE: string;
  STATUS: ReportStatus;
  KETERANGAN: string;
  DINAS_TUJUAN: string;
  NOMOR_SURAT: string;
  PETUGAS: string;
  CREATED_AT: string;
}

export interface SheetBuktiDokumen {
  ID_BUKTI: string;
  ID_LAPORAN: string;
  ID_UPDATE: string;
  NAMA_FILE: string;
  MIME_TYPE: string;
  UKURAN_BYTES: number;
  JENIS_BUKTI: EvidenceType;
  DRIVE_FOLDER_SUB: string;
  DRIVE_FILE_ID: string;
  DRIVE_URL: string;
  TANGGAL_UPLOAD: string;
  DIUNGGAH_OLEH: string;
  VISIBILITAS: EvidenceVisibility;
  KETERANGAN?: string;
}

export interface SheetNotifikasi {
  ID_NOTIFIKASI: string;
  TARGET_USER_ID: string;
  TARGET_ROLE: UserRole | 'ALL';
  ID_LAPORAN?: string;
  JUDUL: string;
  PESAN: string;
  DIBACA: boolean;
  CREATED_AT: string;
}

export interface SheetPengumuman {
  ID_PENGUMUMAN: string;
  JUDUL: string;
  RINGKASAN: string;
  ISI: string;
  KATEGORI: 'Pelayanan' | 'Pembangunan' | 'Bantuan' | 'Jadwal Desa';
  TANGGAL_TERBIT: string;
  PENULIS: string;
  AKTIF: boolean;
}

export interface SheetPengaturan {
  KUNCI: string;
  NILAI: string;
  KETERANGAN: string;
}

export interface SheetLogAktivitas {
  ID_LOG: string;
  WAKTU: string;
  ID_USER: string;
  NAMA_PENGGUNA: string;
  ROLE: string;
  AKSI: string;
  ID_TERKAIT: string;
  DETAIL: string;
}

export interface SiwargaDatabase {
  USERS: SheetUser[];
  WARGA: SheetWarga[];
  PETUGAS: SheetPetugas[];
  LAPORAN: SheetLaporan[];
  KATEGORI_LAYANAN: SheetKategoriLayanan[];
  KONFIGURASI_FORM: SheetKonfigurasiForm[];
  TINDAK_LANJUT: SheetTindakLanjut[];
  BUKTI_DOKUMEN: SheetBuktiDokumen[];
  NOTIFIKASI: SheetNotifikasi[];
  PENGUMUMAN: SheetPengumuman[];
  PENGATURAN: SheetPengaturan[];
  LOG_AKTIVITAS: SheetLogAktivitas[];
}

export interface PublicUserSession {
  idUser: string;
  username: string;
  namaLengkap: string;
  role: UserRole;
  noHp: string;
  statusAkun: string;
  idWarga?: string;
  nikMasked?: string;
  tanggalLahir?: string;
  rtRw?: string;
  alamat?: string;
}

export interface ServiceWithForm extends SheetKategoriLayanan {
  fields: SheetKonfigurasiForm[];
}

export interface CitizenTrackingResponse {
  idLaporan: string;
  judulLaporan: string;
  namaLayanan: string;
  kodeGrup: string;
  statusTerbaru: ReportStatus;
  pesanKhususDinas: string | null;
  alasanPenolakan: string | null;
  tanggalLaporan: string;
  lokasiRingkas: string;
  petugasPenanggungJawab: string;
  riwayatTindakLanjut: Array<{
    idUpdate: string;
    tanggalUpdate: string;
    status: ReportStatus;
    keterangan: string;
    dinasTujuan: string;
    nomorSurat: string;
    petugas: string;
  }>;
  buktiPublik: Array<{
    idBukti: string;
    idUpdate: string;
    namaFile: string;
    mimeType: string;
    jenisBukti: EvidenceType;
    tanggalUpload: string;
  }>;
}

export interface AdminDashboardStats {
  totalLaporan: number;
  laporanBaru: number;
  menungguPenanganan: number;
  sedangDiproses: number;
  diusulkanKeDinas: number;
  selesai: number;
  tidakDapatDitindaklanjuti: number;
  totalWarga: number;
  totalPetugas: number;
  monthlyIncoming: Array<{ label: string; count: number }>;
  topCategories: Array<{ label: string; count: number }>;
  statusDistribution: Array<{ label: string; count: number }>;
  completedVsUnfinished: { selesai: number; belumSelesai: number };
}
