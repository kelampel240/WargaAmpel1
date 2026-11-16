/**
 * ============================================================================
 * WARGA AMPEL: SETUP (Setup.gs)
 * ============================================================================
 * Jalankan setupAll() SATU KALI dari editor Apps Script (pilih fungsi di
 * dropdown lalu klik Run, dan setujui izin Drive/Sheets saat diminta).
 *
 * Fungsi ini idempoten: aman dijalankan ulang. Tab, kolom, dan data awal yang
 * sudah ada tidak akan diduplikasi.
 * ============================================================================
 */

// Data awal layanan. Hanya dimasukkan bila tabel KATEGORI_LAYANAN masih kosong.
var SEED_SERVICES_ = [
  {
    id: 'LAY-A01', kode: 'A01', nama: 'Jalan rusak / berlubang', grup: 'A. Pengaduan',
    deskripsi: 'Laporkan jalan desa yang rusak, berlubang, atau retak.', ikon: 'road',
    persyaratan: 'Foto kondisi jalan (opsional)',
    fields: [
      { label: 'Jenis kerusakan', tipe: 'dropdown', opsi: ['Berlubang', 'Retak', 'Amblas', 'Lainnya'], wajib: true, placeholder: 'Pilih jenis kerusakan' },
      { label: 'Perkiraan panjang kerusakan (meter)', tipe: 'text', opsi: [], wajib: false, placeholder: 'Contoh: 5' }
    ]
  },
  {
    id: 'LAY-A02', kode: 'A02', nama: 'Sampah menumpuk', grup: 'A. Pengaduan',
    deskripsi: 'Laporkan tumpukan sampah di lingkungan desa.', ikon: 'trash',
    persyaratan: 'Opsional',
    fields: [
      { label: 'Lokasi titik sampah', tipe: 'text', opsi: [], wajib: true, placeholder: 'Contoh: depan SD, RT 02' },
      { label: 'Sudah berapa lama menumpuk?', tipe: 'dropdown', opsi: ['Kurang dari 1 hari', '1-3 hari', 'Lebih dari 3 hari'], wajib: true, placeholder: 'Pilih perkiraan' }
    ]
  },
  {
    id: 'LAY-A03', kode: 'A03', nama: 'Lampu jalan mati', grup: 'A. Pengaduan',
    deskripsi: 'Laporkan lampu penerangan jalan yang mati atau berkedip.', ikon: 'lamp',
    persyaratan: 'Opsional',
    fields: [
      { label: 'Nomor tiang lampu (jika ada)', tipe: 'text', opsi: [], wajib: false, placeholder: 'Contoh: LJ-12' }
    ]
  },
  {
    id: 'LAY-A04', kode: 'A04', nama: 'Saluran air tersumbat', grup: 'A. Pengaduan',
    deskripsi: 'Laporkan saluran air atau gorong-gorong yang tersumbat.', ikon: 'droplets',
    persyaratan: 'Opsional',
    fields: [
      { label: 'Jenis gangguan', tipe: 'dropdown', opsi: ['Meluap saat hujan', 'Bau tidak sedap', 'Air tidak mengalir'], wajib: true, placeholder: 'Pilih gangguan' }
    ]
  },
  {
    id: 'LAY-B01', kode: 'B01', nama: 'Bantuan sosial', grup: 'B. Bantuan',
    deskripsi: 'Ajukan permohonan bantuan sosial untuk keluarga Anda.', ikon: 'heart',
    persyaratan: 'Fotokopi KK dan KTP',
    fields: [
      { label: 'Jenis bantuan yang diajukan', tipe: 'dropdown', opsi: ['Bantuan pangan', 'Bantuan kesehatan', 'Bantuan pendidikan', 'Lainnya'], wajib: true, placeholder: 'Pilih jenis bantuan' },
      { label: 'Ringkasan kondisi keluarga', tipe: 'textarea', opsi: [], wajib: true, placeholder: 'Jelaskan kondisi singkat keluarga' }
    ]
  },
  {
    id: 'LAY-C01', kode: 'C01', nama: 'Surat keterangan domisili', grup: 'C. Administrasi',
    deskripsi: 'Permohonan surat keterangan domisili warga.', ikon: 'file-text',
    persyaratan: 'KTP dan KK',
    fields: [
      { label: 'Keperluan surat', tipe: 'text', opsi: [], wajib: true, placeholder: 'Contoh: melamar pekerjaan' }
    ]
  },
  {
    id: 'LAY-C02', kode: 'C02', nama: 'Surat keterangan usaha', grup: 'C. Administrasi',
    deskripsi: 'Permohonan surat keterangan usaha untuk UMKM warga.', ikon: 'store',
    persyaratan: 'KTP dan foto tempat usaha (opsional)',
    fields: [
      { label: 'Nama usaha', tipe: 'text', opsi: [], wajib: true, placeholder: 'Contoh: Warung Bu Sri' },
      { label: 'Jenis usaha', tipe: 'text', opsi: [], wajib: true, placeholder: 'Contoh: warung makan' }
    ]
  },
  {
    id: 'LAY-D01', kode: 'D01', nama: 'Usulan pembangunan', grup: 'D. Aspirasi',
    deskripsi: 'Sampaikan usulan pembangunan atau perbaikan fasilitas desa.', ikon: 'building',
    persyaratan: 'Opsional',
    fields: [
      { label: 'Usulan pembangunan', tipe: 'textarea', opsi: [], wajib: true, placeholder: 'Jelaskan usulan Anda' },
      { label: 'Manfaat untuk warga', tipe: 'textarea', opsi: [], wajib: false, placeholder: 'Siapa yang terbantu dan bagaimana' }
    ]
  },
  {
    id: 'LAY-E01', kode: 'E01', nama: 'Pertanyaan & konsultasi desa', grup: 'E. Konsultasi',
    deskripsi: 'Ajukan pertanyaan seputar layanan dan kegiatan desa.', ikon: 'message-circle',
    persyaratan: 'Opsional',
    fields: [
      { label: 'Topik pertanyaan', tipe: 'dropdown', opsi: ['Pelayanan desa', 'Pembangunan', 'Bantuan sosial', 'Lainnya'], wajib: false, placeholder: 'Pilih topik' }
    ]
  }
];

// ============================================================================
// FUNGSI UTAMA
// ============================================================================
function setupAll() {
  var ss = ensureSpreadsheet_();
  var root = ensureRootFolder_();
  setupDatabase_(ss);
  setupDriveFolders_(root);
  ensureSessionSecret_();
  var admin = ensureAdminAccount_();

  var summary = {
    database: ss.getUrl(),
    folderDrive: root.getUrl(),
    adminUsername: admin.username,
    adminDibuatSekarang: admin.created,
    langkahBerikutnya: [
      '1. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.',
      '2. Salin URL yang berakhiran /exec ke GitHub Variable VITE_GAS_WEB_APP_URL.',
      '3. Jika kata sandi admin dibuat otomatis, cek Execution log, lalu jalankan gantiPasswordAdmin().'
    ]
  };
  if (admin.generatedPassword) {
    Logger.log('KATA SANDI ADMIN AWAL (username "' + admin.username + '"): ' + admin.generatedPassword);
    Logger.log('Catat kata sandi ini, lalu ganti dengan fungsi gantiPasswordAdmin().');
  }
  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

// Mengganti kata sandi admin. Ubah nilai SANDI_BARU, lalu jalankan fungsi ini dari editor.
function gantiPasswordAdmin() {
  var SANDI_BARU = 'GANTI_DENGAN_SANDI_KUAT';
  if (SANDI_BARU.indexOf('GANTI_') === 0 || SANDI_BARU.length < 8) {
    throw new Error('Ubah nilai SANDI_BARU di fungsi gantiPasswordAdmin() menjadi kata sandi minimal 8 karakter.');
  }
  var admin = findRecord_(readTable_('USERS').filter(function (u) {
    return str_(u.ROLE) === 'SUPER_ADMIN';
  }), 'STATUS_AKUN', 'AKTIF');
  if (!admin) throw new Error('Akun SUPER_ADMIN aktif tidak ditemukan. Jalankan setupAll() terlebih dahulu.');
  updateRow_('USERS', admin._row, { PASSWORD_HASH: hashPassword_(SANDI_BARU) });
  logActivity_(admin, 'GANTI_PASSWORD_ADMIN', admin.ID_USER, 'Kata sandi admin diganti dari editor Apps Script.');
  Logger.log('Kata sandi untuk "' + admin.USERNAME + '" sudah diganti.');
  return { ok: true, username: admin.USERNAME };
}

// Memeriksa konfigurasi. Hasilnya tampil di Execution log.
function cekKonfigurasi() {
  var hasil = {
    scriptProperties: {
      SPREADSHEET_ID: !!getScriptProp_('SPREADSHEET_ID'),
      ROOT_FOLDER_ID: !!getScriptProp_('ROOT_FOLDER_ID'),
      SESSION_SECRET: !!getScriptProp_('SESSION_SECRET')
    },
    tabLengkap: Object.keys(SCHEMA_).every(function (nama) {
      return !!getSpreadsheet_().getSheetByName(nama);
    }),
    jumlahLayanan: readTable_('KATEGORI_LAYANAN').length,
    jumlahAkunWarga: readTable_('USERS').filter(function (u) { return str_(u.ROLE) === 'WARGA'; }).length,
    jumlahAkunStaf: readTable_('USERS').filter(function (u) { return str_(u.ROLE) !== 'WARGA'; }).length
  };
  Logger.log(JSON.stringify(hasil, null, 2));
  return hasil;
}

// ============================================================================
// LANGKAH SETUP
// ============================================================================
function ensureSpreadsheet_() {
  var props = scriptProps_();
  var id = str_(CONFIG.SPREADSHEET_ID) || getScriptProp_('SPREADSHEET_ID');
  if (id) {
    props.setProperty('SPREADSHEET_ID', id);
    spreadsheetCache_ = SpreadsheetApp.openById(id);
    return spreadsheetCache_;
  }
  var ss = SpreadsheetApp.create('DATABASE_SIWARGA');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  spreadsheetCache_ = ss;
  return ss;
}

function ensureRootFolder_() {
  var props = scriptProps_();
  var id = str_(CONFIG.ROOT_FOLDER_ID) || getScriptProp_('ROOT_FOLDER_ID');
  var folder = id ? DriveApp.getFolderById(id) : DriveApp.createFolder('SIWARGA_DESA');
  folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  props.setProperty('ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function setupDatabase_(ss) {
  ss.setSpreadsheetTimeZone(CONFIG.TIMEZONE);
  // Spreadsheet baru punya satu tab kosong "Sheet1". Tab itu dipakai untuk USERS.
  if (!ss.getSheetByName('USERS')) {
    var first = ss.getSheets()[0];
    if (first && first.getLastRow() === 0 && /^Sheet/.test(first.getName())) first.setName('USERS');
  }
  Object.keys(SCHEMA_).forEach(function (nama) {
    var sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
    ensureHeaders_(sh, SCHEMA_[nama]);
  });
  seedDatabase_();
}

// Menambahkan header yang belum ada ke slot kosong (atau di akhir). Kolom lain tidak diubah.
// Kolom data diberi format teks agar nomor HP, kode, dan tanggal tidak diubah oleh Sheets.
function ensureHeaders_(sh, expected) {
  var lastCol = sh.getLastColumn();
  var current = lastCol > 0
    ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return str_(h); })
    : [];
  expected.forEach(function (h) {
    if (current.indexOf(h) !== -1) return;
    var idx = current.indexOf('');
    if (idx === -1) {
      idx = current.length;
      current.push('');
    }
    sh.getRange(1, idx + 1).setValue(h);
    current[idx] = h;
  });
  sh.getRange(1, 1, 1, current.length)
    .setFontWeight('bold')
    .setBackground('#0F2942')
    .setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  var dataRows = Math.max(sh.getMaxRows() - 1, 1);
  sh.getRange(2, 1, dataRows, current.length).setNumberFormat('@');
}

function setupDriveFolders_(root) {
  SUBFOLDERS_.forEach(function (nama) {
    getOrCreateSubfolder_(root, nama).setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  });
}

function ensureSessionSecret_() {
  var props = scriptProps_();
  if (!getScriptProp_('SESSION_SECRET')) {
    props.setProperty('SESSION_SECRET', Utilities.getUuid() + Utilities.getUuid() + randomSecret_(16));
  }
}

// Membuat akun SUPER_ADMIN bila belum ada. Kata sandi diambil dari Script Property
// ADMIN_AWAL_PASSWORD (minimal 8 karakter) atau dibuat acak lalu dicatat sekali di log.
function ensureAdminAccount_() {
  var users = readTable_('USERS');
  var sudahAda = users.filter(function (u) { return str_(u.ROLE) === 'SUPER_ADMIN'; });
  if (sudahAda.length > 0) {
    return { username: str_(sudahAda[0].USERNAME), created: false, generatedPassword: '' };
  }
  var sandi = getScriptProp_('ADMIN_AWAL_PASSWORD');
  var generated = false;
  if (sandi) {
    if (sandi.length < 8) throw new Error('ADMIN_AWAL_PASSWORD minimal 8 karakter.');
  } else {
    sandi = randomSecret_(16);
    generated = true;
  }
  var username = 'admin';
  if (findRecord_(users, 'USERNAME', username)) username = 'admin2';
  appendRecord_('USERS', {
    ID_USER: 'USR-ADMIN-01',
    USERNAME: username,
    NAMA_LENGKAP: 'Administrator Desa',
    EMAIL: '',
    NO_HP: '',
    PASSWORD_HASH: hashPassword_(sandi),
    ROLE: 'SUPER_ADMIN',
    STATUS_AKUN: 'AKTIF',
    KODE_VERIFIKASI: '',
    RESET_TOKEN: '',
    CREATED_AT: nowIso_()
  });
  return {
    username: username,
    created: true,
    generatedPassword: generated ? sandi : ''
  };
}

// ============================================================================
// DATA AWAL (hanya bila tabel masih kosong, atau kunci pengaturan belum ada)
// ============================================================================
function seedDatabase_() {
  if (readTable_('PETUGAS').length === 0) {
    appendRecord_('PETUGAS', {
      ID_PETUGAS: 'PTG-001',
      ID_USER: '',
      NAMA_PETUGAS: 'Petugas Desa',
      JABATAN: 'Petugas Pelayanan',
      BIDANG_TUGAS: 'Pelayanan Umum',
      NO_HP: '',
      STATUS: 'AKTIF',
      CREATED_AT: nowIso_()
    });
  }

  if (readTable_('KATEGORI_LAYANAN').length === 0) {
    SEED_SERVICES_.forEach(function (s, idx) {
      appendRecord_('KATEGORI_LAYANAN', {
        ID_LAYANAN: s.id,
        KODE_LAYANAN: 'SRV-' + s.kode,
        NAMA_LAYANAN: s.nama,
        KATEGORI_GRUP: s.grup,
        DESKRIPSI: s.deskripsi,
        IKON: s.ikon,
        PERSYARATAN_DOKUMEN: s.persyaratan,
        ID_PETUGAS_PJ: 'PTG-001',
        NAMA_PETUGAS_PJ: 'Petugas Desa',
        ALUR_STATUS: JSON.stringify(REPORT_STATUSES_),
        STATUS_AKTIF: true,
        URUTAN: idx + 1,
        CREATED_AT: nowIso_()
      });
      s.fields.forEach(function (f, fIdx) {
        appendRecord_('KONFIGURASI_FORM', {
          ID_FIELD: 'FLD-' + s.kode + '-' + (fIdx + 1),
          ID_LAYANAN: s.id,
          LABEL_PERTANYAAN: f.label,
          TIPE_ISIAN: f.tipe,
          OPSI_PILIHAN: JSON.stringify(f.opsi || []),
          WAJIB: f.wajib === true,
          PLACEHOLDER: f.placeholder || '',
          URUTAN: fIdx + 1
        });
      });
    });
  }

  if (readTable_('PENGUMUMAN').length === 0) {
    appendRecord_('PENGUMUMAN', {
      ID_PENGUMUMAN: 'PGM-WELCOME',
      JUDUL: 'Selamat datang di portal WARGA AMPEL',
      RINGKASAN: 'Laporkan keluhan dan ajukan layanan desa secara online.',
      ISI: 'Silakan daftar akun warga, lalu ajukan laporan atau layanan desa. Nomor tiket bisa dipakai untuk memantau perkembangan laporan.',
      KATEGORI: 'Pelayanan',
      TANGGAL_TERBIT: todayStr_(),
      PENULIS: 'Admin Desa',
      AKTIF: true
    });
  }

  upsertSetting_('TICKET_COUNTER', '0', 'Penghitung nomor tiket (jangan diubah manual)');
  upsertSetting_('NAMA_DESA', CONFIG.NAMA_DESA, 'Nama desa yang tampil di portal');
}

function upsertSetting_(kunci, nilai, keterangan) {
  if (!findRecord_(readTable_('PENGATURAN'), 'KUNCI', kunci)) {
    appendRecord_('PENGATURAN', { KUNCI: kunci, NILAI: nilai, KETERANGAN: keterangan });
  }
}
