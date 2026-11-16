/**
 * ============================================================================
 * WARGA AMPEL: BACKEND GOOGLE APPS SCRIPT (Code.gs)
 * ============================================================================
 * Penghubung antara frontend (GitHub Pages), Google Sheets (database), dan
 * Google Drive (berkas bukti). Jalankan setupAll() dari Setup.gs sekali saja.
 * ============================================================================
 */

var CONFIG = {
  // Biarkan kosong. setupAll() membuat spreadsheet dan folder, lalu menyimpan ID-nya
  // di Script Properties. Isi di sini hanya jika ingin memakai file yang sudah ada.
  SPREADSHEET_ID: '1rml3Rh-ss6Qtlk6VCkU8vqP2yL0Q9TJB7faLmlmHKqQ',
  ROOT_FOLDER_ID: '105o5hBhSGAUI_ckmVFADFTLbhqScmFIy',
  NAMA_DESA: 'Desa Ampel',
  TIMEZONE: 'Asia/Jakarta',
  SESSION_TTL_HOURS: 12,
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  ALLOWED_MIMES: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
};

var REPORT_STATUSES_ = [
  'Laporan diterima',
  'Sedang ditindaklanjuti',
  'Sedang dalam proses perbaikan',
  'Sudah diusulkan ke dinas terkait',
  'Menunggu tindak lanjut dinas',
  'Sudah diperbaiki atau ditangani',
  'Tidak dapat ditindaklanjuti'
];
var SERVICE_GROUPS_ = ['A. Pengaduan', 'B. Bantuan', 'C. Administrasi', 'D. Aspirasi', 'E. Konsultasi'];
var ANNOUNCEMENT_CATEGORIES_ = ['Pelayanan', 'Pembangunan', 'Bantuan', 'Jadwal Desa'];
var STAFF_ROLES_ = ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN'];
var SUBFOLDERS_ = ['01_LAPORAN_WARGA', '02_SURAT_ADMINISTRASI', '03_BUKTI_PENANGANAN', '04_SURAT_KE_DINAS', '05_DOKUMEN_PENDUKUNG'];
var DINAS_PROPOSAL_MESSAGE_ = 'Usulan telah disampaikan kepada dinas terkait. Saat ini pemerintah desa sedang menunggu tindak lanjut.';
var spreadsheetCache_ = null;

// ---------------------------------------------------------------------------
// ROUTING
// ---------------------------------------------------------------------------
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action || '';
  if (!action) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>WARGA AMPEL</title></head>' +
      '<body style="font-family:sans-serif;padding:24px"><h1>WARGA AMPEL - ' + CONFIG.NAMA_DESA + '</h1>' +
      '<p>Backend Google Apps Script aktif. Buka aplikasi web (GitHub Pages) untuk memakai layanan.</p></body></html>'
    );
  }
  try {
    if (action === 'ping') return jsonResponse_(ping_());
    if (action === 'getPublicServices') return jsonResponse_({ services: getActiveServices_() });
    if (action === 'getPublicAnnouncements') return jsonResponse_(getPublicAnnouncements_());
    throw new Error('Aksi GET tidak dikenali: ' + action);
  } catch (err) {
    return jsonResponse_({ error: messageOf_(err) });
  }
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    return jsonResponse_(dispatch_(String(body.action || ''), body.payload || {}, String(body.token || '')));
  } catch (err) {
    return jsonResponse_({ error: messageOf_(err) });
  }
}

function dispatch_(action, p, token) {
  switch (action) {
    case 'ping': return ping_();
    // Publik & pelaporan warga
    case 'getPublicServices':
    case 'getActiveServices': return { services: getActiveServices_() };
    case 'getPublicAnnouncements': return getPublicAnnouncements_();
    case 'submitReport': return submitReport_(p, token);
    case 'getReportStatus': return getReportStatus_(p.ticketId, p.tanggalLahir, p.last4Hp);
    case 'getDriveEvidence': return getDriveEvidence_(p, token);
    // Autentikasi & akun warga
    case 'authenticateUser': return authenticateUser_(p.username, p.password);
    case 'getAuthMe': return getAuthMe_(token);
    case 'registerCitizen': return registerCitizen_(p);
    case 'verifyCitizenAccount': return verifyCitizenAccount_(p);
    case 'resetPassword': return resetPassword_(p);
    case 'getCitizenDashboard': return getCitizenDashboard_(token);
    case 'markNotificationRead': return markNotificationRead_(p.idNotifikasi, token);
    // Admin, petugas, dan kepala desa
    case 'getAdminDashboard': return getAdminDashboard_(token);
    case 'getAllReports': return getAllReports_(p, token);
    case 'getReportDetail': return getReportDetail_(p.idLaporan, token);
    case 'saveFollowUp': return saveFollowUp_(p, token);
    case 'classifyReport': return classifyReport_(p, token);
    case 'uploadEvidence': return uploadEvidence_(p, token);
    case 'getAdminServices': return getAdminServices_(token);
    case 'createService': return createService_(p, token);
    case 'updateService': return updateService_(p, token);
    case 'deleteService': return deleteService_(p.idLayanan, token);
    case 'getWarga': return getWarga_(token);
    case 'verifyWarga': return verifyWarga_(p, token);
    case 'getPetugas': return getPetugas_(token);
    case 'createPetugas': return createPetugas_(p, token);
    case 'getDriveTree': return getDriveTree_(token);
    case 'getAnnouncements': return getAnnouncements_(token);
    case 'createAnnouncement': return createAnnouncement_(p, token);
    case 'deleteAnnouncement': return deleteAnnouncement_(p.idPengumuman, token);
    case 'getSettings': return getSettings_(token);
    case 'saveSettings': return saveSettings_(p, token);
    case 'getLogs': return getLogs_(token);
    case 'exportReportCsv': return exportReportCsv_(token);
    default: throw new Error('Aksi tidak dikenali: ' + action);
  }
}

// ---------------------------------------------------------------------------
// HELPER UMUM
// ---------------------------------------------------------------------------
function ping_() {
  return { ok: true, service: 'WARGA_AMPEL_GAS', desa: CONFIG.NAMA_DESA };
}
function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function messageOf_(err) {
  return (err && err.message) ? err.message : String(err);
}
function str_(v) {
  return (v === undefined || v === null) ? '' : String(v).trim();
}
function digitsOf_(v) {
  return String(v === undefined || v === null ? '' : v).replace(/\D/g, '');
}
// Nomor HP dibandingkan dalam bentuk "inti" (tanpa 0 di depan atau kode negara 62),
// sehingga 0812..., 812..., dan +62812... dianggap sama.
function canonicalPhone_(v) {
  var d = digitsOf_(v);
  if (d.indexOf('62') === 0) return d.slice(2);
  if (d.charAt(0) === '0') return d.slice(1);
  return d;
}
function isTrue_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE';
}
function parseJsonSafe_(val, fallback) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(String(val));
  } catch (err) {
    return fallback;
  }
}
function newId_(prefix) {
  return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + Utilities.getUuid().slice(0, 4).toUpperCase();
}
function randomSecret_(n) {
  return Utilities.getUuid().replace(/-/g, '').slice(0, n);
}
function bytesToHex_(bytes) {
  return bytes.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}
function maskNik_(v) {
  var d = digitsOf_(v);
  if (d.length < 10) return '******';
  return d.slice(0, 6) + '******' + d.slice(-4);
}
function mimeFromName_(name) {
  var n = String(name || '').toLowerCase();
  if (n.slice(-4) === '.pdf') return 'application/pdf';
  if (n.slice(-4) === '.png') return 'image/png';
  return 'image/jpeg';
}
function safeFileName_(name) {
  return String(name || 'berkas').replace(/[\\\/:*?"<>|]/g, '_').slice(0, 120);
}
function toIso_(v) {
  return (v instanceof Date) ? v.toISOString() : str_(v);
}
function stripDataUrl_(b64) {
  var s = String(b64 || '');
  return s.indexOf(',') >= 0 ? s.split(',')[1] : s;
}

// ============================================================================
// SKEMA DATABASE (sumber kebenaran untuk Setup.gs dan semua akses tabel)
// Nama kolom harus persis sama dengan src/shared/types.ts di frontend.
// ============================================================================
var SCHEMA_ = {
  USERS: ['ID_USER', 'USERNAME', 'NAMA_LENGKAP', 'EMAIL', 'NO_HP', 'PASSWORD_HASH', 'ROLE', 'STATUS_AKUN', 'KODE_VERIFIKASI', 'RESET_TOKEN', 'CREATED_AT'],
  WARGA: ['ID_WARGA', 'ID_USER', 'NAMA_LENGKAP', 'NIK_MASKED', 'NIK_HASH', 'KK_MASKED', 'TANGGAL_LAHIR', 'ALAMAT', 'RT_RW', 'NO_HP', 'STATUS_VERIFIKASI', 'CREATED_AT'],
  PETUGAS: ['ID_PETUGAS', 'ID_USER', 'NAMA_PETUGAS', 'JABATAN', 'BIDANG_TUGAS', 'NO_HP', 'STATUS', 'CREATED_AT'],
  KATEGORI_LAYANAN: ['ID_LAYANAN', 'KODE_LAYANAN', 'NAMA_LAYANAN', 'KATEGORI_GRUP', 'DESKRIPSI', 'IKON', 'PERSYARATAN_DOKUMEN', 'ID_PETUGAS_PJ', 'NAMA_PETUGAS_PJ', 'ALUR_STATUS', 'STATUS_AKTIF', 'URUTAN', 'CREATED_AT'],
  KONFIGURASI_FORM: ['ID_FIELD', 'ID_LAYANAN', 'LABEL_PERTANYAAN', 'TIPE_ISIAN', 'OPSI_PILIHAN', 'WAJIB', 'PLACEHOLDER', 'URUTAN'],
  LAPORAN: ['ID_LAPORAN', 'ID_WARGA', 'ID_USER_PELAPOR', 'NAMA_PELAPOR', 'NO_HP_PELAPOR', 'TANGGAL_LAHIR_VERIFIKASI', 'NIK_MASKED_PELAPOR', 'KODE_GRUP', 'ID_LAYANAN', 'NAMA_LAYANAN', 'JUDUL_LAPORAN', 'MASALAH_UTAMA', 'URAIAN_MASALAH', 'LOKASI_ALAMAT', 'RT_RW', 'DATA_FORM_DINAMIS', 'STATUS_TERBARU', 'ID_PETUGAS_TUGAS', 'NAMA_PETUGAS_TUGAS', 'ALASAN_TIDAK_DITINDAKLANJUTI', 'DRIVE_FOLDER_NAME', 'DRIVE_FOLDER_URL', 'CREATED_AT', 'UPDATED_AT'],
  TINDAK_LANJUT: ['ID_UPDATE', 'ID_LAPORAN', 'TANGGAL_UPDATE', 'STATUS', 'KETERANGAN', 'DINAS_TUJUAN', 'NOMOR_SURAT', 'PETUGAS', 'CREATED_AT'],
  BUKTI_DOKUMEN: ['ID_BUKTI', 'ID_LAPORAN', 'ID_UPDATE', 'NAMA_FILE', 'MIME_TYPE', 'UKURAN_BYTES', 'JENIS_BUKTI', 'DRIVE_FOLDER_SUB', 'DRIVE_FILE_ID', 'DRIVE_URL', 'TANGGAL_UPLOAD', 'DIUNGGAH_OLEH', 'VISIBILITAS', 'KETERANGAN'],
  NOTIFIKASI: ['ID_NOTIFIKASI', 'TARGET_USER_ID', 'TARGET_ROLE', 'ID_LAPORAN', 'JUDUL', 'PESAN', 'DIBACA', 'CREATED_AT'],
  PENGUMUMAN: ['ID_PENGUMUMAN', 'JUDUL', 'RINGKASAN', 'ISI', 'KATEGORI', 'TANGGAL_TERBIT', 'PENULIS', 'AKTIF'],
  PENGATURAN: ['KUNCI', 'NILAI', 'KETERANGAN'],
  LOG_AKTIVITAS: ['ID_LOG', 'WAKTU', 'ID_USER', 'NAMA_PENGGUNA', 'ROLE', 'AKSI', 'ID_TERKAIT', 'DETAIL']
};

var EVIDENCE_TYPES_ = [
  'Foto sebelum perbaikan', 'Foto proses', 'Foto sesudah perbaikan', 'Surat usulan ke dinas',
  'Bukti pengiriman surat', 'Tanda terima', 'Surat balasan dinas', 'Dokumen pendukung lainnya'
];
var EVIDENCE_VISIBILITY_ = ['PUBLIK_WARGA', 'INTERNAL_DESA'];
var DEFAULT_EVIDENCE_TYPE_ = 'Dokumen pendukung lainnya';
var FORM_FIELD_TYPES_ = ['text', 'textarea', 'dropdown', 'radio', 'checkbox', 'date', 'photo', 'pdf', 'location'];
var CHOICE_FIELD_TYPES_ = ['dropdown', 'radio', 'checkbox'];
var WARGA_STATUS_ = ['TERVERIFIKASI', 'MENUNGGU_VERIFIKASI', 'DITOLAK'];
var BULAN_SINGKAT_ = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
var GENERAL_INQUIRY_ = 'GENERAL_INQUIRY';
var STATUS_DITERIMA_ = 'Laporan diterima';
var STATUS_DITINDAKLANJUTI_ = 'Sedang ditindaklanjuti';
var STATUS_PROSES_ = 'Sedang dalam proses perbaikan';
var STATUS_DINAS_USULAN_ = 'Sudah diusulkan ke dinas terkait';
var STATUS_DINAS_TUNGGU_ = 'Menunggu tindak lanjut dinas';
var STATUS_SELESAI_ = 'Sudah diperbaiki atau ditangani';
var STATUS_TIDAK_DAPAT_ = 'Tidak dapat ditindaklanjuti';

// ============================================================================
// AKSES PROPERTI SKRIP, SPREADSHEET, DAN DRIVE
// ============================================================================
function scriptProps_() {
  return PropertiesService.getScriptProperties();
}

function getScriptProp_(key) {
  return str_(scriptProps_().getProperty(key));
}

function getSpreadsheet_() {
  if (spreadsheetCache_) return spreadsheetCache_;
  var id = str_(CONFIG.SPREADSHEET_ID) || getScriptProp_('SPREADSHEET_ID');
  if (id) {
    spreadsheetCache_ = SpreadsheetApp.openById(id);
    return spreadsheetCache_;
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    spreadsheetCache_ = active;
    return active;
  }
  throw new Error('Database belum disiapkan. Jalankan fungsi setupAll() di editor Apps Script terlebih dahulu.');
}

function getSheet_(name) {
  var sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) {
    throw new Error('Tab "' + name + '" belum ada. Jalankan setupAll() di editor Apps Script.');
  }
  return sh;
}

function headersOf_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return [];
  return sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return str_(h);
  });
}

function getRootFolder_() {
  var id = str_(CONFIG.ROOT_FOLDER_ID) || getScriptProp_('ROOT_FOLDER_ID');
  if (!id) {
    throw new Error('Folder Google Drive belum disiapkan. Jalankan setupAll() di editor Apps Script terlebih dahulu.');
  }
  return DriveApp.getFolderById(id);
}

function getOrCreateSubfolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// Folder bukti per tiket: 01_LAPORAN_WARGA/<tiket> (lampiran warga) atau
// 03_BUKTI_PENANGANAN/<tiket> (bukti dari petugas). Selalu privat.
function getTicketFolder_(groupName, ticketId) {
  var root = getRootFolder_();
  var group = getOrCreateSubfolder_(root, groupName);
  var ticket = getOrCreateSubfolder_(group, ticketId);
  ticket.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  return ticket;
}

// ============================================================================
// AKSES TABEL (header-based: urutan kolom tidak bergantung pada posisi)
// ============================================================================
// Nilai dibaca apa adanya, kecuali tanggal (dinormalisasi ke yyyy-MM-dd bila
// tengah malam di zona waktu desa) dan teks TRUE/FALSE (dijadikan boolean).
function normalizeCell_(v) {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    var midnight = Utilities.formatDate(v, CONFIG.TIMEZONE, 'HH:mm:ss') === '00:00:00';
    return midnight ? Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy-MM-dd') : v.toISOString();
  }
  if (v === 'TRUE') return true;
  if (v === 'FALSE') return false;
  return v;
}

function readTable_(name) {
  var sh = getSheet_(name);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function (h) { return str_(h); });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var obj = { _row: r + 1 };
    var hasContent = false;
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      var v = normalizeCell_(values[r][c]);
      if (v !== '' && v !== null && v !== undefined) hasContent = true;
      obj[headers[c]] = v;
    }
    if (hasContent) rows.push(obj);
  }
  return rows;
}

function findRecord_(rows, key, value) {
  var target = str_(value);
  for (var i = 0; i < rows.length; i++) {
    if (str_(rows[i][key]) === target) return rows[i];
  }
  return null;
}

// Baris baru ditulis sebagai teks ('@') agar nomor HP dan tanggal tidak diubah Sheets.
function appendRecord_(name, record) {
  var sh = getSheet_(name);
  var headers = headersOf_(sh);
  var row = headers.map(function (h) {
    var v = record[h];
    return (v === undefined || v === null) ? '' : v;
  });
  var target = sh.getLastRow() + 1;
  sh.getRange(target, 1, 1, headers.length).setNumberFormat('@').setValues([row]);
  return target;
}

function updateRow_(name, rowNumber, changes) {
  var sh = getSheet_(name);
  var headers = headersOf_(sh);
  Object.keys(changes).forEach(function (key) {
    var col = headers.indexOf(key);
    if (col === -1) throw new Error('Kolom ' + key + ' tidak ada di tab ' + name + '.');
    sh.getRange(rowNumber, col + 1).setValue(changes[key]);
  });
}

function deleteRowsWhere_(name, key, value) {
  var sh = getSheet_(name);
  var targets = readTable_(name).filter(function (r) {
    return str_(r[key]) === str_(value);
  });
  targets.sort(function (a, b) { return b._row - a._row; });
  targets.forEach(function (r) { sh.deleteRow(r._row); });
  return targets.length;
}

// Operasi baca-ubah-tulis (nomor tiket, status, layanan) dijalankan di dalam kunci skrip.
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// WAKTU, PENGATURAN, DAN NOMOR TIKET
// ============================================================================
function nowIso_() {
  return new Date().toISOString();
}

function todayStr_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function isDateOnly_(v) {
  var s = str_(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function toDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var d = new Date(str_(v));
  return isNaN(d.getTime()) ? null : d;
}

function monthKey_(v) {
  var d = toDate_(v);
  return d ? Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM') : '';
}

function getSetting_(key, fallback) {
  var row = findRecord_(readTable_('PENGATURAN'), 'KUNCI', key);
  var val = row ? str_(row.NILAI) : '';
  return val || fallback;
}

function desaName_() {
  return getSetting_('NAMA_DESA', CONFIG.NAMA_DESA);
}

// Dipanggil di dalam withLock_(). Menghasilkan SW-YYYY-NNNNNN.
function nextTicketId_() {
  var rows = readTable_('PENGATURAN');
  var counter = findRecord_(rows, 'KUNCI', 'TICKET_COUNTER');
  var next = (counter ? (Number(counter.NILAI) || 0) : 0) + 1;
  if (counter) {
    updateRow_('PENGATURAN', counter._row, { NILAI: String(next) });
  } else {
    appendRecord_('PENGATURAN', {
      KUNCI: 'TICKET_COUNTER',
      NILAI: String(next),
      KETERANGAN: 'Penghitung nomor tiket (jangan diubah manual)'
    });
  }
  var year = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy');
  return 'SW-' + year + '-' + ('000000' + next).slice(-6);
}

// ============================================================================
// LOG AKTIVITAS DAN NOTIFIKASI
// ============================================================================
function logActivity_(actor, aksi, idTerkait, detail) {
  appendRecord_('LOG_AKTIVITAS', {
    ID_LOG: newId_('LOG'),
    WAKTU: nowIso_(),
    ID_USER: actor ? actor.ID_USER : 'PUBLIC',
    NAMA_PENGGUNA: actor ? (actor.NAMA_LENGKAP || 'Pengguna') : 'Warga',
    ROLE: actor ? actor.ROLE : 'WARGA',
    AKSI: aksi,
    ID_TERKAIT: str_(idTerkait),
    DETAIL: str_(detail)
  });
}

function addNotification_(targetUserId, targetRole, idLaporan, judul, pesan) {
  appendRecord_('NOTIFIKASI', {
    ID_NOTIFIKASI: newId_('NTF'),
    TARGET_USER_ID: str_(targetUserId),
    TARGET_ROLE: str_(targetRole),
    ID_LAPORAN: str_(idLaporan),
    JUDUL: str_(judul),
    PESAN: str_(pesan),
    DIBACA: false,
    CREATED_AT: nowIso_()
  });
}

// ============================================================================
// KATA SANDI, SESI (TOKEN DITANDATANGANI HMAC), DAN AUTENTIKASI
// ============================================================================
var SESSION_INVALID_ = 'Sesi login tidak valid. Silakan masuk kembali.';

function sha256Hex_(text) {
  return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text));
}

// Format tersimpan: "salt:hash". Salt acak per akun.
function hashPassword_(password) {
  var salt = randomSecret_(16);
  return salt + ':' + sha256Hex_(salt + ':' + String(password));
}

function verifyPassword_(password, stored) {
  var parts = str_(stored).split(':');
  if (parts.length !== 2 || !parts[0]) return false;
  return sha256Hex_(parts[0] + ':' + String(password)) === parts[1];
}

// Kunci penandatanganan NIK (hash duplikat) memakai SESSION_SECRET agar tidak bisa
// diuji balik secara offline dari isi sheet.
function nikHash_(nik) {
  return bytesToHex_(Utilities.computeHmacSha256Signature(String(nik), getSessionSecret_()));
}

function getSessionSecret_() {
  var secret = getScriptProp_('SESSION_SECRET');
  if (!secret) throw new Error('SESSION_SECRET belum dibuat. Jalankan setupAll() di editor Apps Script.');
  return secret;
}

function safeEquals_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function createSessionToken_(user) {
  var body = Utilities.base64EncodeWebSafe(Utilities.newBlob(JSON.stringify({
    uid: user.ID_USER,
    role: user.ROLE,
    exp: Date.now() + CONFIG.SESSION_TTL_HOURS * 3600 * 1000,
    jti: randomSecret_(12)
  })).getBytes());
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, getSessionSecret_()));
  return body + '.' + sig;
}

function parseSessionToken_(token) {
  var raw = str_(token);
  var dot = raw.lastIndexOf('.');
  if (dot < 1) throw new Error(SESSION_INVALID_);
  var body = raw.slice(0, dot);
  var sig = raw.slice(dot + 1);
  var expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, getSessionSecret_()));
  if (!safeEquals_(expected, sig)) throw new Error(SESSION_INVALID_);
  var data = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(body)).getDataAsString());
  if (!data.exp || Date.now() > data.exp) {
    throw new Error('Sesi login telah berakhir. Silakan masuk kembali.');
  }
  return data;
}

// Peran dan status diambil ulang dari sheet USERS, sehingga perubahan peran
// atau penonaktifan akun langsung berlaku. Mengembalikan baris USERS (internal).
function requireUser_(token, roles) {
  if (!str_(token)) throw new Error('Sesi login diperlukan. Silakan masuk terlebih dahulu.');
  var data = parseSessionToken_(token);
  var user = findRecord_(readTable_('USERS'), 'ID_USER', data.uid);
  if (!user || user.STATUS_AKUN !== 'AKTIF') throw new Error('Akun tidak aktif. Silakan masuk kembali.');
  if (roles && roles.indexOf(user.ROLE) === -1) {
    throw new Error('Anda tidak memiliki hak akses untuk tindakan ini.');
  }
  return user;
}

function optionalUser_(token) {
  if (!str_(token)) return null;
  try {
    return requireUser_(token, null);
  } catch (err) {
    return null;
  }
}

// Bentuk yang aman dikirim ke browser: tanpa hash sandi dan tanpa kode verifikasi.
function sessionUser_(user) {
  var out = {
    idUser: str_(user.ID_USER),
    username: str_(user.USERNAME),
    namaLengkap: str_(user.NAMA_LENGKAP),
    role: str_(user.ROLE),
    noHp: str_(user.NO_HP),
    statusAkun: str_(user.STATUS_AKUN)
  };
  if (user.ROLE === 'WARGA') {
    var warga = findRecord_(readTable_('WARGA'), 'ID_USER', user.ID_USER);
    if (warga) {
      out.idWarga = str_(warga.ID_WARGA);
      out.nikMasked = str_(warga.NIK_MASKED);
      out.tanggalLahir = str_(warga.TANGGAL_LAHIR);
      out.rtRw = str_(warga.RT_RW);
      out.alamat = str_(warga.ALAMAT);
    }
  }
  return out;
}

function authenticateUser_(username, password) {
  var key = str_(username).toLowerCase();
  var digits = digitsOf_(username);
  if (!key || !password) throw new Error('Nama pengguna dan kata sandi wajib diisi.');
  var users = readTable_('USERS');
  var user = null;
  for (var i = 0; i < users.length; i++) {
    var byName = str_(users[i].USERNAME).toLowerCase() === key;
    var byPhone = digits.length >= 9 && canonicalPhone_(users[i].NO_HP) === canonicalPhone_(digits);
    if (byName || byPhone) {
      user = users[i];
      break;
    }
  }
  // Pesan sama untuk akun tidak ada dan kata sandi salah, agar tidak membocorkan akun terdaftar.
  if (!user || !verifyPassword_(password, user.PASSWORD_HASH)) {
    throw new Error('Nama pengguna atau kata sandi tidak sesuai.');
  }
  if (user.STATUS_AKUN === 'MENUNGGU_VERIFIKASI') {
    throw new Error('Akun belum diverifikasi. Selesaikan verifikasi dengan kode dari pendaftaran.');
  }
  if (user.STATUS_AKUN !== 'AKTIF') throw new Error('Akun tidak aktif. Hubungi operator desa.');
  logActivity_(user, 'LOGIN', user.ID_USER, 'Berhasil masuk ke portal WARGA AMPEL.');
  return { token: createSessionToken_(user), user: sessionUser_(user) };
}

function getAuthMe_(token) {
  return { user: sessionUser_(requireUser_(token, null)) };
}

// ============================================================================
// PENDAFTARAN WARGA, VERIFIKASI, DAN RESET KATA SANDI
// ============================================================================
function registerCitizen_(p) {
  var nama = str_(p.namaLengkap);
  var username = str_(p.username || p.noHp).toLowerCase();
  var password = String(p.password || '');
  var nik = digitsOf_(p.nik);
  var kk = digitsOf_(p.kk);
  var noHp = digitsOf_(p.noHp);
  var dob = str_(p.tanggalLahir);
  var alamat = str_(p.alamat);
  var rtRw = str_(p.rtRw) || desaName_();

  if (nama.length < 3) throw new Error('Nama lengkap minimal 3 karakter.');
  if (!/^[a-z0-9._]{4,30}$/.test(username)) {
    throw new Error('Nama pengguna 4-30 karakter (huruf kecil, angka, titik, atau garis bawah).');
  }
  if (password.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
  if (nik.length !== 16) throw new Error('NIK harus 16 digit angka.');
  if (kk && kk.length !== 16) throw new Error('No. KK harus 16 digit angka, atau dikosongkan.');
  if (noHp.length < 9 || noHp.length > 15) throw new Error('Nomor HP tidak valid (9-15 digit).');
  if (!isDateOnly_(dob) || dob > todayStr_()) throw new Error('Tanggal lahir tidak valid.');
  if (alamat.length < 3) throw new Error('Alamat wajib diisi.');

  return withLock_(function () {
    var users = readTable_('USERS');
    if (findRecord_(users, 'USERNAME', username)) throw new Error('Nama pengguna sudah terdaftar.');
    var canonical = canonicalPhone_(noHp);
    for (var i = 0; i < users.length; i++) {
      if (canonicalPhone_(users[i].NO_HP) === canonical) {
        throw new Error('Nomor HP sudah terdaftar. Gunakan nomor lain atau masuk ke akun yang ada.');
      }
    }
    var hash = nikHash_(nik);
    if (findRecord_(readTable_('WARGA'), 'NIK_HASH', hash)) {
      throw new Error('NIK sudah terdaftar. Hubungi operator desa jika ini keliru.');
    }
    var idUser = newId_('USR');
    var idWarga = newId_('WRG');
    var kode = String(100000 + Math.floor(Math.random() * 900000));
    var now = nowIso_();
    appendRecord_('USERS', {
      ID_USER: idUser,
      USERNAME: username,
      NAMA_LENGKAP: nama,
      EMAIL: str_(p.email),
      NO_HP: noHp,
      PASSWORD_HASH: hashPassword_(password),
      ROLE: 'WARGA',
      STATUS_AKUN: 'MENUNGGU_VERIFIKASI',
      KODE_VERIFIKASI: kode,
      RESET_TOKEN: '',
      CREATED_AT: now
    });
    appendRecord_('WARGA', {
      ID_WARGA: idWarga,
      ID_USER: idUser,
      NAMA_LENGKAP: nama,
      NIK_MASKED: maskNik_(nik),
      NIK_HASH: hash,
      KK_MASKED: kk ? maskNik_(kk) : '',
      TANGGAL_LAHIR: dob,
      ALAMAT: alamat,
      RT_RW: rtRw,
      NO_HP: noHp,
      STATUS_VERIFIKASI: 'MENUNGGU_VERIFIKASI',
      CREATED_AT: now
    });
    logActivity_({ ID_USER: idUser, NAMA_LENGKAP: nama, ROLE: 'WARGA' }, 'REGISTER_WARGA', idUser, 'Pendaftaran akun warga baru.');
    return {
      message: 'Akun berhasil dibuat. Masukkan kode verifikasi untuk mengaktifkan akun.',
      username: username,
      kodeVerifikasi: kode
    };
  });
}

function verifyCitizenAccount_(p) {
  var username = str_(p.username).toLowerCase();
  var kode = str_(p.kodeVerifikasi || p.kode);
  if (!username || !kode) throw new Error('Nama pengguna dan kode verifikasi wajib diisi.');
  return withLock_(function () {
    var user = findRecord_(readTable_('USERS'), 'USERNAME', username);
    if (!user) throw new Error('Akun tidak ditemukan.');
    var stored = str_(user.KODE_VERIFIKASI);
    if (!stored || stored !== kode) throw new Error('Kode verifikasi tidak sesuai.');
    updateRow_('USERS', user._row, { STATUS_AKUN: 'AKTIF', KODE_VERIFIKASI: '' });
    user.STATUS_AKUN = 'AKTIF';
    logActivity_(user, 'VERIFIKASI_AKUN', user.ID_USER, 'Akun warga diaktifkan dengan kode verifikasi.');
    return { token: createSessionToken_(user), user: sessionUser_(user) };
  });
}

// Verifikasi reset: tanggal lahir (data warga) atau nomor HP yang terdaftar di akun.
function resetPassword_(p) {
  var username = str_(p.username).toLowerCase();
  var newPassword = String(p.newPassword || '');
  var dob = str_(p.tanggalLahir);
  var hp = digitsOf_(p.noHp);
  if (!username) throw new Error('Nama pengguna wajib diisi.');
  if (newPassword.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
  return withLock_(function () {
    var user = findRecord_(readTable_('USERS'), 'USERNAME', username);
    if (!user) throw new Error('Nama pengguna tidak ditemukan.');
    var warga = findRecord_(readTable_('WARGA'), 'ID_USER', user.ID_USER);
    var dobMatch = !!dob && !!warga && str_(warga.TANGGAL_LAHIR) === dob;
    var hpMatch = hp.length >= 9 && canonicalPhone_(user.NO_HP) === canonicalPhone_(hp);
    if (!dobMatch && !hpMatch) {
      throw new Error('Tanggal lahir atau nomor HP tidak cocok dengan akun terdaftar.');
    }
    updateRow_('USERS', user._row, { PASSWORD_HASH: hashPassword_(newPassword) });
    logActivity_(user, 'RESET_PASSWORD', user.ID_USER, 'Kata sandi diperbarui melalui verifikasi data diri.');
    return { ok: true, message: 'Kata sandi berhasil diperbarui. Silakan masuk kembali.' };
  });
}

// ============================================================================
// UNGGAH BERKAS (LAMPIRAN) DAN BUKTI
// ============================================================================
// Ukuran dan tipe dicek dari isi berkas (magic bytes), bukan hanya dari nama/MIME yang dikirim browser.
function sniffMime_(bytes) {
  if (bytes.length >= 3 && bytes[0] === -1 && bytes[1] === -40 && bytes[2] === -1) return 'image/jpeg';
  if (bytes.length >= 4 && bytes[0] === -119 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return 'image/png';
  if (bytes.length >= 4 && bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70) return 'application/pdf';
  return '';
}

function extensionFor_(mime) {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  return 'jpg';
}

function prepareUpload_(fileName, mimeType, base64) {
  var declared = str_(mimeType).toLowerCase();
  if (CONFIG.ALLOWED_MIMES.indexOf(declared) === -1) throw new Error('Format file harus JPG, PNG, atau PDF.');
  var clean = stripDataUrl_(base64);
  if (!clean) throw new Error('Berkas kosong.');
  var bytes = Utilities.base64Decode(clean);
  if (bytes.length === 0) throw new Error('Berkas kosong.');
  if (bytes.length > CONFIG.MAX_FILE_SIZE_BYTES) throw new Error('Ukuran file melebihi batas 5 MB.');
  var mime = sniffMime_(bytes);
  if (!mime) throw new Error('Isi berkas tidak dikenali sebagai JPG, PNG, atau PDF.');
  var name = safeFileName_(fileName);
  if (!name || name.indexOf('.') === -1) name = 'berkas.' + extensionFor_(mime);
  return { bytes: bytes, mime: mime, name: name };
}

function storeUpload_(folder, prepared) {
  var file = folder.createFile(Utilities.newBlob(prepared.bytes, prepared.mime, prepared.name));
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  return file;
}

function recordEvidence_(params) {
  var idBukti = newId_('BKT');
  appendRecord_('BUKTI_DOKUMEN', {
    ID_BUKTI: idBukti,
    ID_LAPORAN: params.idLaporan,
    ID_UPDATE: str_(params.idUpdate),
    NAMA_FILE: params.file.getName(),
    MIME_TYPE: params.mime,
    UKURAN_BYTES: params.size,
    JENIS_BUKTI: params.jenis,
    DRIVE_FOLDER_SUB: params.folderSub,
    DRIVE_FILE_ID: params.file.getId(),
    DRIVE_URL: params.file.getUrl(),
    TANGGAL_UPLOAD: nowIso_(),
    DIUNGGAH_OLEH: params.uploader,
    VISIBILITAS: params.visibilitas,
    KETERANGAN: str_(params.keterangan)
  });
  return idBukti;
}

// Bentuk bukti yang aman ke browser: ID Drive dan URL tidak dikirim (akses lewat getDriveEvidence).
function publicEvidence_(b) {
  return {
    ID_BUKTI: str_(b.ID_BUKTI),
    ID_LAPORAN: str_(b.ID_LAPORAN),
    ID_UPDATE: str_(b.ID_UPDATE),
    NAMA_FILE: str_(b.NAMA_FILE),
    MIME_TYPE: str_(b.MIME_TYPE),
    UKURAN_BYTES: Number(b.UKURAN_BYTES) || 0,
    JENIS_BUKTI: str_(b.JENIS_BUKTI),
    DRIVE_FOLDER_SUB: str_(b.DRIVE_FOLDER_SUB),
    DRIVE_FILE_ID: '',
    DRIVE_URL: '',
    TANGGAL_UPLOAD: str_(b.TANGGAL_UPLOAD),
    DIUNGGAH_OLEH: str_(b.DIUNGGAH_OLEH),
    VISIBILITAS: str_(b.VISIBILITAS),
    KETERANGAN: str_(b.KETERANGAN)
  };
}

// ============================================================================
// PELAPORAN WARGA
// ============================================================================
// Isian dinamis disimpan sebagai { "Label pertanyaan": nilai } agar mudah dibaca di sheet dan CSV.
function buildAnswers_(idLayanan, values) {
  var input = (values && typeof values === 'object') ? values : {};
  var fields = readTable_('KONFIGURASI_FORM')
    .filter(function (f) { return str_(f.ID_LAYANAN) === idLayanan; })
    .sort(function (a, b) { return (Number(a.URUTAN) || 0) - (Number(b.URUTAN) || 0); });
  var answers = {};
  fields.forEach(function (f) {
    var label = str_(f.LABEL_PERTANYAAN);
    var type = str_(f.TIPE_ISIAN);
    var parsed = parseJsonSafe_(f.OPSI_PILIHAN, []);
    var options = Array.isArray(parsed) ? parsed.map(function (o) { return str_(o); }) : [];
    var raw = input[str_(f.ID_FIELD)];
    var value;
    if (type === 'checkbox') {
      var list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      value = list.map(function (x) { return str_(x); }).filter(function (x) {
        return x && (options.length === 0 || options.indexOf(x) !== -1);
      });
    } else {
      value = str_(raw);
      if (value && CHOICE_FIELD_TYPES_.indexOf(type) !== -1 && options.length && options.indexOf(value) === -1) {
        throw new Error('Pilihan untuk "' + label + '" tidak valid.');
      }
    }
    var empty = Array.isArray(value) ? value.length === 0 : value === '';
    if (isTrue_(f.WAJIB) && empty) throw new Error('Pertanyaan "' + label + '" wajib diisi.');
    if (!empty) answers[label] = value;
  });
  return answers;
}

function submitReport_(p, token) {
  var sessionUser = optionalUser_(token);
  var nama = str_(p.namaPelapor);
  var noHp = digitsOf_(p.noHpPelapor);
  var dob = str_(p.tanggalLahir);
  var uraian = str_(p.uraianMasalah);
  var alamat = str_(p.lokasiAlamat);
  var rtRw = str_(p.rtRw) || desaName_();
  var isGeneral = p.isGeneralInquiry === true || str_(p.idLayanan) === GENERAL_INQUIRY_;

  if (nama.length < 2) throw new Error('Nama pelapor minimal 2 karakter.');
  if (noHp.length < 9 || noHp.length > 15) throw new Error('Nomor HP pelapor tidak valid (9-15 digit).');
  if (!isDateOnly_(dob) || dob > todayStr_()) throw new Error('Tanggal lahir pelapor tidak valid.');
  if (uraian.length < 10) throw new Error('Uraian masalah minimal 10 karakter.');
  if (alamat.length < 3) throw new Error('Alamat atau patokan lokasi wajib diisi.');

  // Layanan dan isian selalu diambil dari sheet, bukan dari klaim browser.
  var svc = null;
  if (!isGeneral) {
    svc = findRecord_(readTable_('KATEGORI_LAYANAN'), 'ID_LAYANAN', p.idLayanan);
    if (!svc || !isTrue_(svc.STATUS_AKTIF)) {
      throw new Error('Jenis layanan tidak tersedia. Muat ulang halaman lalu pilih layanan lain.');
    }
  }
  var answers = buildAnswers_(isGeneral ? GENERAL_INQUIRY_ : str_(p.idLayanan), p.dataFormDinamis);
  var attachment = (p.attachment && str_(p.attachment.base64))
    ? prepareUpload_(p.attachment.fileName, p.attachment.mimeType, p.attachment.base64)
    : null;

  var identitas = sessionUser ? findRecord_(readTable_('WARGA'), 'ID_USER', sessionUser.ID_USER) : null;
  var ticketId = withLock_(nextTicketId_);
  var now = nowIso_();
  var folderName = '01_LAPORAN_WARGA/' + ticketId;
  var folder = getTicketFolder_('01_LAPORAN_WARGA', ticketId);

  var kodeGrup = isGeneral ? GENERAL_INQUIRY_ : str_(svc.KATEGORI_GRUP);
  var namaLayanan = isGeneral ? 'Saya Tidak Tahu (Perlu Klasifikasi)' : str_(svc.NAMA_LAYANAN);
  var masalah = isGeneral ? 'Belum diklasifikasi' : (str_(p.masalahUtama) || namaLayanan);
  var judul = str_(p.judulLaporan) || (isGeneral ? 'Laporan Umum Warga' : masalah + ' — ' + rtRw);

  appendRecord_('LAPORAN', {
    ID_LAPORAN: ticketId,
    ID_WARGA: identitas ? str_(identitas.ID_WARGA) : '',
    ID_USER_PELAPOR: sessionUser ? str_(sessionUser.ID_USER) : '',
    NAMA_PELAPOR: nama,
    NO_HP_PELAPOR: noHp,
    TANGGAL_LAHIR_VERIFIKASI: dob,
    NIK_MASKED_PELAPOR: identitas ? str_(identitas.NIK_MASKED) : '',
    KODE_GRUP: kodeGrup,
    ID_LAYANAN: isGeneral ? GENERAL_INQUIRY_ : str_(svc.ID_LAYANAN),
    NAMA_LAYANAN: namaLayanan,
    JUDUL_LAPORAN: judul,
    MASALAH_UTAMA: masalah,
    URAIAN_MASALAH: uraian,
    LOKASI_ALAMAT: alamat,
    RT_RW: rtRw,
    DATA_FORM_DINAMIS: JSON.stringify(answers),
    STATUS_TERBARU: STATUS_DITERIMA_,
    ID_PETUGAS_TUGAS: '',
    NAMA_PETUGAS_TUGAS: '',
    ALASAN_TIDAK_DITINDAKLANJUTI: '',
    DRIVE_FOLDER_NAME: folderName,
    DRIVE_FOLDER_URL: folder.getUrl(),
    CREATED_AT: now,
    UPDATED_AT: now
  });

  var updId = newId_('UPD');
  appendRecord_('TINDAK_LANJUT', {
    ID_UPDATE: updId,
    ID_LAPORAN: ticketId,
    TANGGAL_UPDATE: todayStr_(),
    STATUS: STATUS_DITERIMA_,
    KETERANGAN: isGeneral
      ? 'Laporan umum diterima. Menunggu klasifikasi operator desa.'
      : 'Laporan telah diterima dan dicatat.',
    DINAS_TUJUAN: '',
    NOMOR_SURAT: '',
    PETUGAS: 'Sistem WARGA AMPEL',
    CREATED_AT: now
  });

  if (attachment) {
    var file = storeUpload_(folder, attachment);
    recordEvidence_({
      idLaporan: ticketId,
      idUpdate: updId,
      file: file,
      size: attachment.bytes.length,
      mime: attachment.mime,
      jenis: attachment.mime === 'application/pdf' ? DEFAULT_EVIDENCE_TYPE_ : 'Foto sebelum perbaikan',
      uploader: nama,
      visibilitas: 'PUBLIK_WARGA',
      keterangan: 'Lampiran dari pelapor saat membuat laporan.',
      folderSub: folderName
    });
  }

  addNotification_('ALL_STAFF', 'OPERATOR', ticketId, 'Laporan baru ' + ticketId, judul);
  if (sessionUser) {
    addNotification_(sessionUser.ID_USER, 'WARGA', ticketId, 'Laporan Anda diterima',
      'Laporan ' + ticketId + ' sudah tercatat dan menunggu penanganan.');
  }
  logActivity_(sessionUser, 'SUBMIT_REPORT', ticketId, 'Laporan warga baru dibuat.');

  return {
    ticketId: ticketId,
    report: {
      idLaporan: ticketId,
      judulLaporan: judul,
      namaLayanan: namaLayanan,
      statusTerbaru: STATUS_DITERIMA_,
      driveFolder: folderName
    },
    status: STATUS_DITERIMA_,
    createdAt: now
  };
}

// ============================================================================
// PELACAKAN WARGA (VERIFIKASI IDENTITAS PELAPOR)
// ============================================================================
function plainRow_(row) {
  var out = {};
  Object.keys(row).forEach(function (k) {
    if (k !== '_row') out[k] = row[k];
  });
  return out;
}

function verifyReportOwner_(report, tanggalLahir, last4Hp) {
  var dob = str_(tanggalLahir);
  var last4 = digitsOf_(last4Hp).slice(-4);
  var dobOk = !!dob && str_(report.TANGGAL_LAHIR_VERIFIKASI) === dob;
  var hpOk = last4.length === 4 && digitsOf_(report.NO_HP_PELAPOR).slice(-4) === last4;
  if (!dobOk && !hpOk) {
    throw new Error('Verifikasi identitas gagal. Pastikan tanggal lahir atau 4 digit terakhir no. HP sesuai.');
  }
}

function getReportStatus_(ticketId, tanggalLahir, last4Hp) {
  var id = str_(ticketId).toUpperCase();
  if (!id) throw new Error('Nomor tiket wajib diisi.');
  var report = findRecord_(readTable_('LAPORAN'), 'ID_LAPORAN', id);
  if (!report) throw new Error('Nomor tiket tidak ditemukan.');
  verifyReportOwner_(report, tanggalLahir, last4Hp);
  return { tracking: buildTracking_(report, readTable_('TINDAK_LANJUT'), readTable_('BUKTI_DOKUMEN')) };
}

// Ringkasan laporan untuk warga: hanya riwayat tindak lanjut dan bukti berstatus PUBLIK_WARGA.
function buildTracking_(report, followUpsAll, buktiAll) {
  var id = str_(report.ID_LAPORAN);
  var status = str_(report.STATUS_TERBARU);
  var riwayat = followUpsAll
    .filter(function (f) { return str_(f.ID_LAPORAN) === id; })
    .sort(function (a, b) { return str_(a.CREATED_AT).localeCompare(str_(b.CREATED_AT)); })
    .map(function (f) {
      return {
        idUpdate: str_(f.ID_UPDATE),
        tanggalUpdate: str_(f.TANGGAL_UPDATE),
        status: str_(f.STATUS),
        keterangan: str_(f.KETERANGAN),
        dinasTujuan: str_(f.DINAS_TUJUAN),
        nomorSurat: str_(f.NOMOR_SURAT),
        petugas: str_(f.PETUGAS)
      };
    });
  var bukti = buktiAll
    .filter(function (b) { return str_(b.ID_LAPORAN) === id && str_(b.VISIBILITAS) === 'PUBLIK_WARGA'; })
    .sort(function (a, b) { return str_(a.TANGGAL_UPLOAD).localeCompare(str_(b.TANGGAL_UPLOAD)); })
    .map(function (b) {
      return {
        idBukti: str_(b.ID_BUKTI),
        idUpdate: str_(b.ID_UPDATE),
        namaFile: str_(b.NAMA_FILE),
        mimeType: str_(b.MIME_TYPE),
        jenisBukti: str_(b.JENIS_BUKTI),
        tanggalUpload: str_(b.TANGGAL_UPLOAD)
      };
    });
  var alasan = null;
  if (status === STATUS_TIDAK_DAPAT_) {
    var lastNote = riwayat.length ? riwayat[riwayat.length - 1].keterangan : '';
    alasan = str_(report.ALASAN_TIDAK_DITINDAKLANJUTI) || lastNote || null;
  }
  return {
    idLaporan: id,
    judulLaporan: str_(report.JUDUL_LAPORAN),
    namaLayanan: str_(report.NAMA_LAYANAN),
    kodeGrup: str_(report.KODE_GRUP),
    statusTerbaru: status,
    pesanKhususDinas: (status === STATUS_DINAS_USULAN_ || status === STATUS_DINAS_TUNGGU_) ? DINAS_PROPOSAL_MESSAGE_ : null,
    alasanPenolakan: alasan,
    tanggalLaporan: str_(report.CREATED_AT),
    lokasiRingkas: (str_(report.RT_RW) || 'Desa') + ', ' + desaName_(),
    petugasPenanggungJawab: str_(report.NAMA_PETUGAS_TUGAS) || 'Belum ditugaskan',
    riwayatTindakLanjut: riwayat,
    buktiPublik: bukti
  };
}

// ============================================================================
// DASBOR WARGA DAN NOTIFIKASI
// ============================================================================
function getCitizenDashboard_(token) {
  var actor = requireUser_(token, null);
  var followUps = readTable_('TINDAK_LANJUT');
  var bukti = readTable_('BUKTI_DOKUMEN');
  var myReports = readTable_('LAPORAN')
    .filter(function (r) { return str_(r.ID_USER_PELAPOR) === str_(actor.ID_USER); })
    .sort(function (a, b) { return str_(b.CREATED_AT).localeCompare(str_(a.CREATED_AT)); })
    .map(function (r) { return buildTracking_(r, followUps, bukti); });
  var notifications = readTable_('NOTIFIKASI')
    .filter(function (n) { return str_(n.TARGET_USER_ID) === str_(actor.ID_USER); })
    .sort(function (a, b) { return str_(b.CREATED_AT).localeCompare(str_(a.CREATED_AT)); })
    .slice(0, 50)
    .map(plainRow_);
  return {
    myReports: myReports,
    notifications: notifications,
    announcements: publicAnnouncements_()
  };
}

function markNotificationRead_(idNotifikasi, token) {
  var actor = requireUser_(token, null);
  return withLock_(function () {
    var row = findRecord_(readTable_('NOTIFIKASI'), 'ID_NOTIFIKASI', idNotifikasi);
    if (row && str_(row.TARGET_USER_ID) === str_(actor.ID_USER)) {
      updateRow_('NOTIFIKASI', row._row, { DIBACA: true });
    }
    return { ok: true };
  });
}

// ============================================================================
// ADMIN & PETUGAS: DASBOR, DAFTAR LAPORAN, TINDAK LANJUT, KLASIFIKASI
// ============================================================================
function reportOut_(r) {
  var out = plainRow_(r);
  out.DATA_FORM_DINAMIS = parseJsonSafe_(r.DATA_FORM_DINAMIS, {});
  return out;
}

function monthlyIncoming_(reports) {
  var nowKey = monthKey_(new Date());
  var y = Number(nowKey.slice(0, 4));
  var m = Number(nowKey.slice(5, 7)) - 1;
  var months = [];
  for (var i = 5; i >= 0; i--) {
    var idx = y * 12 + m - i;
    var yy = Math.floor(idx / 12);
    var mm = idx - yy * 12;
    months.push({
      key: yy + '-' + ('0' + (mm + 1)).slice(-2),
      label: BULAN_SINGKAT_[mm] + ' ' + yy
    });
  }
  return months.map(function (mo) {
    return {
      label: mo.label,
      count: reports.filter(function (r) { return monthKey_(r.CREATED_AT) === mo.key; }).length
    };
  });
}

function topCategories_(reports) {
  var counts = {};
  reports.forEach(function (r) {
    var label = str_(r.KODE_GRUP) === GENERAL_INQUIRY_
      ? 'Belum diklasifikasi'
      : (str_(r.NAMA_LAYANAN) || 'Lainnya');
    counts[label] = (counts[label] || 0) + 1;
  });
  return Object.keys(counts)
    .map(function (k) { return { label: k, count: counts[k] }; })
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, 6);
}

function getAdminDashboard_(token) {
  var actor = requireUser_(token, STAFF_ROLES_);
  var reports = readTable_('LAPORAN');
  var total = reports.length;
  var countStatus = function (status) {
    return reports.filter(function (r) { return str_(r.STATUS_TERBARU) === status; }).length;
  };
  var selesai = countStatus(STATUS_SELESAI_);
  return {
    stats: {
      totalLaporan: total,
      laporanBaru: countStatus(STATUS_DITERIMA_),
      menungguPenanganan: countStatus(STATUS_DITERIMA_) + countStatus(STATUS_DITINDAKLANJUTI_),
      sedangDiproses: countStatus(STATUS_PROSES_),
      diusulkanKeDinas: countStatus(STATUS_DINAS_USULAN_) + countStatus(STATUS_DINAS_TUNGGU_),
      selesai: selesai,
      tidakDapatDitindaklanjuti: countStatus(STATUS_TIDAK_DAPAT_),
      totalWarga: readTable_('WARGA').length,
      totalPetugas: readTable_('PETUGAS').filter(function (x) { return str_(x.STATUS) === 'AKTIF'; }).length,
      monthlyIncoming: monthlyIncoming_(reports),
      topCategories: topCategories_(reports),
      statusDistribution: REPORT_STATUSES_.map(function (s) {
        return { label: s, count: countStatus(s) };
      }),
      completedVsUnfinished: { selesai: selesai, belumSelesai: total - selesai }
    },
    notifications: staffNotifications_(actor)
  };
}

// Notifikasi staf: laporan masuk (ALL_STAFF) dan notifikasi pribadi. Tanpa status baca per orang.
function staffNotifications_(actor) {
  return readTable_('NOTIFIKASI')
    .filter(function (n) {
      var target = str_(n.TARGET_USER_ID);
      return target === 'ALL_STAFF' || target === str_(actor.ID_USER);
    })
    .sort(function (a, b) { return str_(b.CREATED_AT).localeCompare(str_(a.CREATED_AT)); })
    .slice(0, 20)
    .map(plainRow_);
}

function getAllReports_(filters, token) {
  requireUser_(token, STAFF_ROLES_);
  var f = filters || {};
  var group = str_(f.group);
  var status = str_(f.status);
  var q = str_(f.search).toLowerCase();
  var reports = readTable_('LAPORAN').filter(function (r) {
    if (group && str_(r.KODE_GRUP) !== group) return false;
    if (status && str_(r.STATUS_TERBARU) !== status) return false;
    if (q) {
      var hay = [r.ID_LAPORAN, r.JUDUL_LAPORAN, r.NAMA_PELAPOR, r.NAMA_LAYANAN]
        .map(function (x) { return str_(x).toLowerCase(); })
        .join(' | ');
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
  reports.sort(function (a, b) { return str_(b.CREATED_AT).localeCompare(str_(a.CREATED_AT)); });
  return { reports: reports.map(reportOut_) };
}

function reportDetailData_(idLaporan) {
  var id = str_(idLaporan).toUpperCase();
  var report = findRecord_(readTable_('LAPORAN'), 'ID_LAPORAN', id);
  if (!report) throw new Error('Laporan tidak ditemukan.');
  var followUps = readTable_('TINDAK_LANJUT')
    .filter(function (f) { return str_(f.ID_LAPORAN) === id; })
    .sort(function (a, b) { return str_(a.CREATED_AT).localeCompare(str_(b.CREATED_AT)); })
    .map(plainRow_);
  var evidence = readTable_('BUKTI_DOKUMEN')
    .filter(function (b) { return str_(b.ID_LAPORAN) === id; })
    .sort(function (a, b) { return str_(a.TANGGAL_UPLOAD).localeCompare(str_(b.TANGGAL_UPLOAD)); })
    .map(publicEvidence_);
  return { report: reportOut_(report), followUps: followUps, evidence: evidence };
}

function getReportDetail_(idLaporan, token) {
  requireUser_(token, STAFF_ROLES_);
  return reportDetailData_(idLaporan);
}

// Petugas penanggung jawab: dipilih dari PETUGAS bila ada, jika tidak pakai PJ layanan.
function resolvePetugasPj_(idPetugas, svc) {
  var id = str_(idPetugas);
  if (id) {
    var pet = findRecord_(readTable_('PETUGAS'), 'ID_PETUGAS', id);
    if (!pet || str_(pet.STATUS) !== 'AKTIF') {
      throw new Error('Petugas yang dipilih tidak ditemukan atau nonaktif.');
    }
    return { id: str_(pet.ID_PETUGAS), nama: str_(pet.NAMA_PETUGAS) };
  }
  return { id: str_(svc.ID_PETUGAS_PJ), nama: str_(svc.NAMA_PETUGAS_PJ) || 'Petugas Desa' };
}

function saveFollowUp_(p, token) {
  var actor = requireUser_(token, STAFF_ROLES_);
  var id = str_(p.idLaporan).toUpperCase();
  var status = str_(p.status);
  var keterangan = str_(p.keterangan);
  if (!id) throw new Error('Nomor laporan wajib diisi.');
  if (REPORT_STATUSES_.indexOf(status) === -1) throw new Error('Status laporan tidak valid.');
  if (keterangan.length < 5) throw new Error('Keterangan tindak lanjut minimal 5 karakter.');
  if (status === STATUS_TIDAK_DAPAT_ && keterangan.length < 15) {
    throw new Error('Alasan tertulis wajib diisi (minimal 15 karakter) saat memilih Tidak dapat ditindaklanjuti.');
  }
  if (!findRecord_(readTable_('LAPORAN'), 'ID_LAPORAN', id)) throw new Error('Laporan tidak ditemukan.');

  var tanggal = isDateOnly_(p.tanggalTindakan) ? str_(p.tanggalTindakan) : todayStr_();
  var updId = newId_('UPD');
  var now = nowIso_();

  // Berkas lampiran diunggah di luar kunci agar kunci tidak ditahan lama.
  var stored = null;
  var ev = p.evidenceUpload;
  if (ev && str_(ev.base64)) {
    var prepared = prepareUpload_(ev.fileName, ev.mimeType, ev.base64);
    var folder = getTicketFolder_('03_BUKTI_PENANGANAN', id);
    stored = {
      prepared: prepared,
      file: storeUpload_(folder, prepared),
      jenis: EVIDENCE_TYPES_.indexOf(str_(ev.jenisBukti)) !== -1 ? str_(ev.jenisBukti) : DEFAULT_EVIDENCE_TYPE_,
      visibilitas: EVIDENCE_VISIBILITY_.indexOf(str_(ev.visibilitas)) !== -1 ? str_(ev.visibilitas) : 'INTERNAL_DESA'
    };
  }

  withLock_(function () {
    var report = findRecord_(readTable_('LAPORAN'), 'ID_LAPORAN', id);
    if (!report) throw new Error('Laporan tidak ditemukan.');
    appendRecord_('TINDAK_LANJUT', {
      ID_UPDATE: updId,
      ID_LAPORAN: id,
      TANGGAL_UPDATE: tanggal,
      STATUS: status,
      KETERANGAN: keterangan,
      DINAS_TUJUAN: str_(p.dinasTujuan),
      NOMOR_SURAT: str_(p.nomorSurat),
      PETUGAS: str_(actor.NAMA_LENGKAP),
      CREATED_AT: now
    });
    var changes = { STATUS_TERBARU: status, UPDATED_AT: now };
    if (status === STATUS_TIDAK_DAPAT_) changes.ALASAN_TIDAK_DITINDAKLANJUTI = keterangan;
    updateRow_('LAPORAN', report._row, changes);
    if (stored) {
      recordEvidence_({
        idLaporan: id,
        idUpdate: updId,
        file: stored.file,
        size: stored.prepared.bytes.length,
        mime: stored.prepared.mime,
        jenis: stored.jenis,
        uploader: str_(actor.NAMA_LENGKAP),
        visibilitas: stored.visibilitas,
        keterangan: 'Lampiran tindak lanjut.',
        folderSub: '03_BUKTI_PENANGANAN/' + id
      });
    }
    if (str_(report.ID_USER_PELAPOR)) {
      addNotification_(report.ID_USER_PELAPOR, 'WARGA', id, 'Status laporan ' + id + ' diperbarui',
        'Status terbaru: ' + status + '.');
    }
    logActivity_(actor, 'SAVE_FOLLOWUP', id, 'Status diubah ke ' + status);
  });

  var detail = reportDetailData_(id);
  detail.ok = true;
  detail.idUpdate = updId;
  return detail;
}

function classifyReport_(p, token) {
  var actor = requireUser_(token, ['OPERATOR', 'SUPER_ADMIN', 'KEPALA_DESA']);
  var id = str_(p.idLaporan).toUpperCase();
  var idLayanan = str_(p.idLayanan);
  if (!id || !idLayanan) throw new Error('Laporan dan layanan tujuan wajib dipilih.');
  return withLock_(function () {
    var report = findRecord_(readTable_('LAPORAN'), 'ID_LAPORAN', id);
    if (!report) throw new Error('Laporan tidak ditemukan.');
    var svc = findRecord_(readTable_('KATEGORI_LAYANAN'), 'ID_LAYANAN', idLayanan);
    if (!svc || !isTrue_(svc.STATUS_AKTIF)) throw new Error('Layanan tujuan tidak ditemukan atau nonaktif.');
    var pj = resolvePetugasPj_(p.idPetugas, svc);
    var now = nowIso_();
    var catatan = str_(p.catatan);
    updateRow_('LAPORAN', report._row, {
      KODE_GRUP: str_(svc.KATEGORI_GRUP),
      ID_LAYANAN: str_(svc.ID_LAYANAN),
      NAMA_LAYANAN: str_(svc.NAMA_LAYANAN),
      STATUS_TERBARU: STATUS_DITINDAKLANJUTI_,
      ID_PETUGAS_TUGAS: pj.id,
      NAMA_PETUGAS_TUGAS: pj.nama,
      UPDATED_AT: now
    });
    appendRecord_('TINDAK_LANJUT', {
      ID_UPDATE: newId_('UPD'),
      ID_LAPORAN: id,
      TANGGAL_UPDATE: todayStr_(),
      STATUS: STATUS_DITINDAKLANJUTI_,
      KETERANGAN: 'Laporan diklasifikasikan ke layanan "' + str_(svc.NAMA_LAYANAN) + '" (' +
        str_(svc.KATEGORI_GRUP) + ').' + (catatan ? ' ' + catatan : ''),
      DINAS_TUJUAN: '',
      NOMOR_SURAT: '',
      PETUGAS: str_(actor.NAMA_LENGKAP),
      CREATED_AT: now
    });
    if (str_(report.ID_USER_PELAPOR)) {
      addNotification_(report.ID_USER_PELAPOR, 'WARGA', id, 'Laporan Anda sedang ditindaklanjuti',
        'Laporan ' + id + ' sudah diklasifikasikan dan ditangani oleh ' + pj.nama + '.');
    }
    logActivity_(actor, 'CLASSIFY_REPORT', id, 'Diklasifikasi ke ' + str_(svc.NAMA_LAYANAN));
    return reportDetailData_(id);
  });
}

// ============================================================================
// BUKTI PENANGANAN: UNGGAH (PETUGAS) DAN AKSES (PETUGAS, WARGA PEMILIK, ATAU VERIFIKASI TIKET)
// ============================================================================
function uploadEvidence_(p, token) {
  var actor = requireUser_(token, STAFF_ROLES_);
  var id = str_(p.idLaporan).toUpperCase();
  if (!findRecord_(readTable_('LAPORAN'), 'ID_LAPORAN', id)) throw new Error('Laporan tidak ditemukan.');
  var prepared = prepareUpload_(p.fileName, p.mimeType, p.base64);
  var jenis = EVIDENCE_TYPES_.indexOf(str_(p.jenisBukti)) !== -1 ? str_(p.jenisBukti) : DEFAULT_EVIDENCE_TYPE_;
  var visibilitas = EVIDENCE_VISIBILITY_.indexOf(str_(p.visibilitas)) !== -1 ? str_(p.visibilitas) : 'INTERNAL_DESA';
  var folder = getTicketFolder_('03_BUKTI_PENANGANAN', id);
  var file = storeUpload_(folder, prepared);
  var idBukti = recordEvidence_({
    idLaporan: id,
    idUpdate: '',
    file: file,
    size: prepared.bytes.length,
    mime: prepared.mime,
    jenis: jenis,
    uploader: str_(actor.NAMA_LENGKAP),
    visibilitas: visibilitas,
    keterangan: str_(p.keterangan),
    folderSub: '03_BUKTI_PENANGANAN/' + id
  });
  logActivity_(actor, 'UPLOAD_EVIDENCE', id, 'Unggah ' + file.getName() + ' (' + jenis + ')');
  return {
    ok: true,
    bukti: publicEvidence_(findRecord_(readTable_('BUKTI_DOKUMEN'), 'ID_BUKTI', idBukti))
  };
}

// Aturan akses bukti:
// 1. Petugas (semua peran staf): semua bukti.
// 2. Warga pemilik laporan yang sedang login: bukti berstatus PUBLIK_WARGA.
// 3. Tanpa login: wajib nomor tiket yang sama + verifikasi tanggal lahir/HP, dan bukti PUBLIK_WARGA.
function getDriveEvidence_(p, token) {
  var bukti = findRecord_(readTable_('BUKTI_DOKUMEN'), 'ID_BUKTI', str_(p.idBukti));
  if (!bukti) throw new Error('Bukti tidak ditemukan.');
  var report = findRecord_(readTable_('LAPORAN'), 'ID_LAPORAN', str_(bukti.ID_LAPORAN));
  var publik = str_(bukti.VISIBILITAS) === 'PUBLIK_WARGA';
  var actor = optionalUser_(token);
  var allowed = !!actor && STAFF_ROLES_.indexOf(actor.ROLE) !== -1;
  if (!allowed && actor && report && publik && str_(report.ID_USER_PELAPOR) === str_(actor.ID_USER)) {
    allowed = true;
  }
  if (!allowed) {
    if (!report || !publik) throw new Error('Bukti ini hanya dapat dilihat oleh petugas desa.');
    if (str_(p.ticketId).toUpperCase() !== str_(bukti.ID_LAPORAN)) {
      throw new Error('Nomor tiket tidak sesuai dengan bukti ini.');
    }
    verifyReportOwner_(report, p.tanggalLahir, p.last4Hp);
  }
  var file = DriveApp.getFileById(str_(bukti.DRIVE_FILE_ID));
  return {
    fileName: str_(bukti.NAMA_FILE),
    mimeType: str_(bukti.MIME_TYPE) || file.getMimeType(),
    base64: Utilities.base64Encode(file.getBlob().getBytes())
  };
}

// ============================================================================
// LAYANAN (SERVICE BUILDER)
// ============================================================================
var STAFF_LOGIN_ROLES_ = ['PETUGAS', 'OPERATOR', 'KEPALA_DESA'];
var RESERVED_SETTING_KEYS_ = ['TICKET_COUNTER'];

function formatFieldOut_(f) {
  var parsed = parseJsonSafe_(f.OPSI_PILIHAN, []);
  return {
    ID_FIELD: str_(f.ID_FIELD),
    ID_LAYANAN: str_(f.ID_LAYANAN),
    LABEL_PERTANYAAN: str_(f.LABEL_PERTANYAAN),
    TIPE_ISIAN: str_(f.TIPE_ISIAN),
    OPSI_PILIHAN: Array.isArray(parsed) ? parsed : [],
    WAJIB: isTrue_(f.WAJIB),
    PLACEHOLDER: str_(f.PLACEHOLDER),
    URUTAN: Number(f.URUTAN) || 1
  };
}

function serviceOut_(s, fields) {
  return {
    ID_LAYANAN: str_(s.ID_LAYANAN),
    KODE_LAYANAN: str_(s.KODE_LAYANAN),
    NAMA_LAYANAN: str_(s.NAMA_LAYANAN),
    KATEGORI_GRUP: str_(s.KATEGORI_GRUP),
    DESKRIPSI: str_(s.DESKRIPSI),
    IKON: str_(s.IKON) || 'file-text',
    PERSYARATAN_DOKUMEN: str_(s.PERSYARATAN_DOKUMEN),
    ID_PETUGAS_PJ: str_(s.ID_PETUGAS_PJ),
    NAMA_PETUGAS_PJ: str_(s.NAMA_PETUGAS_PJ),
    ALUR_STATUS: parseJsonSafe_(s.ALUR_STATUS, REPORT_STATUSES_.slice()),
    STATUS_AKTIF: isTrue_(s.STATUS_AKTIF),
    URUTAN: Number(s.URUTAN) || 1,
    CREATED_AT: str_(s.CREATED_AT),
    fields: fields
  };
}

function servicesWithFields_(onlyActive) {
  var forms = readTable_('KONFIGURASI_FORM');
  return readTable_('KATEGORI_LAYANAN')
    .filter(function (s) { return !onlyActive || isTrue_(s.STATUS_AKTIF); })
    .sort(function (a, b) { return (Number(a.URUTAN) || 0) - (Number(b.URUTAN) || 0); })
    .map(function (s) {
      var fields = forms
        .filter(function (f) { return str_(f.ID_LAYANAN) === str_(s.ID_LAYANAN); })
        .sort(function (a, b) { return (Number(a.URUTAN) || 0) - (Number(b.URUTAN) || 0); })
        .map(formatFieldOut_);
      return serviceOut_(s, fields);
    });
}

function getActiveServices_() {
  return servicesWithFields_(true);
}

function getAdminServices_(token) {
  requireUser_(token, STAFF_ROLES_);
  return { services: servicesWithFields_(false) };
}

function normalizeOptions_(list) {
  if (!Array.isArray(list)) return [];
  var seen = {};
  return list.map(function (o) { return str_(o); }).filter(function (o) {
    if (!o || seen[o]) return false;
    seen[o] = true;
    return true;
  });
}

function validateFieldDefs_(fields) {
  if (fields.length > 30) throw new Error('Maksimal 30 pertanyaan per layanan.');
  fields.forEach(function (f, idx) {
    var label = str_(f && f.LABEL_PERTANYAAN);
    var type = str_(f && f.TIPE_ISIAN);
    if (label.length < 2) throw new Error('Pertanyaan ke-' + (idx + 1) + ' belum diisi.');
    if (FORM_FIELD_TYPES_.indexOf(type) === -1) throw new Error('Tipe isian "' + type + '" tidak dikenal.');
    if (CHOICE_FIELD_TYPES_.indexOf(type) !== -1 && normalizeOptions_(f.OPSI_PILIHAN).length === 0) {
      throw new Error('Pertanyaan "' + label + '" memerlukan pilihan jawaban.');
    }
  });
}

function createService_(p, token) {
  var actor = requireUser_(token, ['SUPER_ADMIN', 'OPERATOR']);
  var nama = str_(p.namaLayanan);
  if (nama.length < 3) throw new Error('Nama layanan minimal 3 karakter.');
  var grup = SERVICE_GROUPS_.indexOf(str_(p.kategoriGrup)) !== -1 ? str_(p.kategoriGrup) : SERVICE_GROUPS_[0];
  var fields = Array.isArray(p.fields) ? p.fields : [];
  validateFieldDefs_(fields);
  return withLock_(function () {
    var pj = resolvePetugasPj_(p.idPetugasPj, { ID_PETUGAS_PJ: '', NAMA_PETUGAS_PJ: '' });
    var urutan = readTable_('KATEGORI_LAYANAN').reduce(function (m, s) {
      return Math.max(m, Number(s.URUTAN) || 0);
    }, 0) + 1;
    var idLayanan = newId_('LAY');
    appendRecord_('KATEGORI_LAYANAN', {
      ID_LAYANAN: idLayanan,
      KODE_LAYANAN: 'SRV-' + ('000' + Math.floor(Math.random() * 1000)).slice(-3),
      NAMA_LAYANAN: nama,
      KATEGORI_GRUP: grup,
      DESKRIPSI: str_(p.deskripsi),
      IKON: str_(p.ikon) || 'file-text',
      PERSYARATAN_DOKUMEN: str_(p.persyaratanDokumen) || 'Opsional',
      ID_PETUGAS_PJ: pj.id,
      NAMA_PETUGAS_PJ: pj.nama,
      ALUR_STATUS: JSON.stringify(REPORT_STATUSES_),
      STATUS_AKTIF: p.statusAktif !== false,
      URUTAN: urutan,
      CREATED_AT: nowIso_()
    });
    fields.forEach(function (f, idx) {
      appendRecord_('KONFIGURASI_FORM', {
        ID_FIELD: newId_('FLD'),
        ID_LAYANAN: idLayanan,
        LABEL_PERTANYAAN: str_(f.LABEL_PERTANYAAN),
        TIPE_ISIAN: str_(f.TIPE_ISIAN),
        OPSI_PILIHAN: JSON.stringify(normalizeOptions_(f.OPSI_PILIHAN)),
        WAJIB: f.WAJIB === true,
        PLACEHOLDER: str_(f.PLACEHOLDER),
        URUTAN: idx + 1
      });
    });
    logActivity_(actor, 'CREATE_SERVICE', idLayanan, 'Menambahkan layanan ' + nama);
    return { ok: true, idLayanan: idLayanan };
  });
}

function updateService_(p, token) {
  var actor = requireUser_(token, ['SUPER_ADMIN', 'OPERATOR']);
  var id = str_(p.idLayanan);
  return withLock_(function () {
    var svc = findRecord_(readTable_('KATEGORI_LAYANAN'), 'ID_LAYANAN', id);
    if (!svc) throw new Error('Layanan tidak ditemukan.');
    var changes = {};
    if (p.namaLayanan !== undefined) {
      var nama = str_(p.namaLayanan);
      if (nama.length < 3) throw new Error('Nama layanan minimal 3 karakter.');
      changes.NAMA_LAYANAN = nama;
    }
    if (p.kategoriGrup !== undefined) {
      if (SERVICE_GROUPS_.indexOf(str_(p.kategoriGrup)) === -1) throw new Error('Kategori grup tidak valid.');
      changes.KATEGORI_GRUP = str_(p.kategoriGrup);
    }
    if (p.deskripsi !== undefined) changes.DESKRIPSI = str_(p.deskripsi);
    if (p.ikon !== undefined) changes.IKON = str_(p.ikon) || 'file-text';
    if (p.persyaratanDokumen !== undefined) changes.PERSYARATAN_DOKUMEN = str_(p.persyaratanDokumen) || 'Opsional';
    if (p.idPetugasPj !== undefined) {
      var pj = resolvePetugasPj_(p.idPetugasPj, { ID_PETUGAS_PJ: '', NAMA_PETUGAS_PJ: '' });
      changes.ID_PETUGAS_PJ = pj.id;
      changes.NAMA_PETUGAS_PJ = pj.nama;
    }
    if (p.statusAktif !== undefined) {
      changes.STATUS_AKTIF = p.statusAktif === true || str_(p.statusAktif) === 'true';
    }
    if (Object.keys(changes).length === 0) return { ok: true };
    updateRow_('KATEGORI_LAYANAN', svc._row, changes);
    logActivity_(actor, 'UPDATE_SERVICE', id, 'Memperbarui layanan ' + id);
    return { ok: true };
  });
}

function deleteService_(idLayanan, token) {
  var actor = requireUser_(token, ['SUPER_ADMIN']);
  var id = str_(idLayanan);
  return withLock_(function () {
    var svc = findRecord_(readTable_('KATEGORI_LAYANAN'), 'ID_LAYANAN', id);
    if (!svc) throw new Error('Layanan tidak ditemukan.');
    var dipakai = readTable_('LAPORAN').some(function (r) { return str_(r.ID_LAYANAN) === id; });
    if (dipakai) {
      throw new Error('Layanan sudah dipakai laporan warga. Nonaktifkan saja agar tidak tampil di portal.');
    }
    deleteRowsWhere_('KONFIGURASI_FORM', 'ID_LAYANAN', id);
    getSheet_('KATEGORI_LAYANAN').deleteRow(svc._row);
    logActivity_(actor, 'DELETE_SERVICE', id, 'Menghapus layanan ' + str_(svc.NAMA_LAYANAN));
    return { ok: true };
  });
}

// ============================================================================
// WARGA, PETUGAS, DRIVE, PENGUMUMAN, PENGATURAN, LOG, DAN EKSPOR
// ============================================================================
function getWarga_(token) {
  requireUser_(token, STAFF_ROLES_);
  return {
    warga: readTable_('WARGA').map(function (w) {
      var out = plainRow_(w);
      delete out.NIK_HASH;
      return out;
    })
  };
}

function verifyWarga_(p, token) {
  var actor = requireUser_(token, ['OPERATOR', 'SUPER_ADMIN', 'KEPALA_DESA']);
  var status = str_(p.statusVerifikasi || p.status);
  if (WARGA_STATUS_.indexOf(status) === -1) throw new Error('Status verifikasi tidak valid.');
  var id = str_(p.idWarga);
  return withLock_(function () {
    var row = findRecord_(readTable_('WARGA'), 'ID_WARGA', id);
    if (!row) throw new Error('Data warga tidak ditemukan.');
    updateRow_('WARGA', row._row, { STATUS_VERIFIKASI: status });
    logActivity_(actor, 'VERIFIKASI_WARGA', id, 'Status verifikasi: ' + status);
    return { ok: true };
  });
}

function getPetugas_(token) {
  requireUser_(token, STAFF_ROLES_);
  return { petugas: readTable_('PETUGAS').map(plainRow_) };
}

// Petugas bisa dibuat tanpa akun (hanya data). Bila username dan password diisi, akun login ikut dibuat.
function createPetugas_(p, token) {
  var actor = requireUser_(token, ['SUPER_ADMIN']);
  var nama = str_(p.namaPetugas);
  if (nama.length < 3) throw new Error('Nama petugas minimal 3 karakter.');
  var username = str_(p.username).toLowerCase();
  var password = String(p.password || '');
  var role = STAFF_LOGIN_ROLES_.indexOf(str_(p.role)) !== -1 ? str_(p.role) : 'PETUGAS';
  var noHp = digitsOf_(p.noHp);
  return withLock_(function () {
    var idUser = '';
    if (username) {
      if (!/^[a-z0-9._]{4,30}$/.test(username)) {
        throw new Error('Nama pengguna petugas 4-30 karakter (huruf kecil, angka, titik, atau garis bawah).');
      }
      if (password.length < 8) throw new Error('Kata sandi petugas minimal 8 karakter.');
      if (findRecord_(readTable_('USERS'), 'USERNAME', username)) throw new Error('Nama pengguna sudah dipakai.');
      idUser = newId_('USR');
      appendRecord_('USERS', {
        ID_USER: idUser,
        USERNAME: username,
        NAMA_LENGKAP: nama,
        EMAIL: '',
        NO_HP: noHp,
        PASSWORD_HASH: hashPassword_(password),
        ROLE: role,
        STATUS_AKUN: 'AKTIF',
        KODE_VERIFIKASI: '',
        RESET_TOKEN: '',
        CREATED_AT: nowIso_()
      });
    }
    var idPetugas = newId_('PTG');
    appendRecord_('PETUGAS', {
      ID_PETUGAS: idPetugas,
      ID_USER: idUser,
      NAMA_PETUGAS: nama,
      JABATAN: str_(p.jabatan) || 'Petugas Desa',
      BIDANG_TUGAS: str_(p.bidangTugas) || 'Pelayanan Umum',
      NO_HP: noHp,
      STATUS: 'AKTIF',
      CREATED_AT: nowIso_()
    });
    logActivity_(actor, 'CREATE_PETUGAS', idPetugas, 'Menambah petugas ' + nama + (idUser ? ' (akun ' + username + ')' : ''));
    return { ok: true, idPetugas: idPetugas };
  });
}

function getDriveTree_(token) {
  requireUser_(token, STAFF_ROLES_);
  var root = getRootFolder_();
  var ticketFolders = readTable_('LAPORAN').map(function (r) { return str_(r.ID_LAPORAN); }).sort().reverse();
  return {
    rootFolder: root.getName(),
    subfolders: SUBFOLDERS_.slice(),
    ticketFolders: ticketFolders,
    evidence: readTable_('BUKTI_DOKUMEN').map(publicEvidence_)
  };
}

function publicAnnouncements_() {
  return readTable_('PENGUMUMAN')
    .filter(function (a) { return isTrue_(a.AKTIF); })
    .sort(function (a, b) { return str_(b.TANGGAL_TERBIT).localeCompare(str_(a.TANGGAL_TERBIT)); })
    .map(plainRow_);
}

function getPublicAnnouncements_() {
  return { announcements: publicAnnouncements_() };
}

function getAnnouncements_(token) {
  requireUser_(token, STAFF_ROLES_);
  return {
    announcements: readTable_('PENGUMUMAN')
      .sort(function (a, b) { return str_(b.TANGGAL_TERBIT).localeCompare(str_(a.TANGGAL_TERBIT)); })
      .map(plainRow_)
  };
}

function createAnnouncement_(p, token) {
  var actor = requireUser_(token, ['SUPER_ADMIN', 'OPERATOR']);
  var judul = str_(p.judul);
  var isi = str_(p.isi);
  if (judul.length < 3) throw new Error('Judul pengumuman minimal 3 karakter.');
  if (isi.length < 3) throw new Error('Isi pengumuman minimal 3 karakter.');
  var kategori = ANNOUNCEMENT_CATEGORIES_.indexOf(str_(p.kategori)) !== -1
    ? str_(p.kategori)
    : ANNOUNCEMENT_CATEGORIES_[0];
  var id = newId_('PGM');
  appendRecord_('PENGUMUMAN', {
    ID_PENGUMUMAN: id,
    JUDUL: judul,
    RINGKASAN: isi.slice(0, 140),
    ISI: isi,
    KATEGORI: kategori,
    TANGGAL_TERBIT: todayStr_(),
    PENULIS: str_(actor.NAMA_LENGKAP),
    AKTIF: true
  });
  logActivity_(actor, 'CREATE_ANNOUNCEMENT', id, judul);
  return { ok: true, idPengumuman: id };
}

function deleteAnnouncement_(idPengumuman, token) {
  var actor = requireUser_(token, ['SUPER_ADMIN', 'OPERATOR']);
  var id = str_(idPengumuman);
  return withLock_(function () {
    var n = deleteRowsWhere_('PENGUMUMAN', 'ID_PENGUMUMAN', id);
    if (n > 0) logActivity_(actor, 'DELETE_ANNOUNCEMENT', id, 'Menghapus pengumuman.');
    return { ok: true };
  });
}

function settingsOut_() {
  return readTable_('PENGATURAN')
    .filter(function (s) { return RESERVED_SETTING_KEYS_.indexOf(str_(s.KUNCI)) === -1; })
    .map(plainRow_);
}

function getSettings_(token) {
  requireUser_(token, STAFF_ROLES_);
  return { settings: settingsOut_() };
}

function saveSettings_(p, token) {
  var actor = requireUser_(token, ['SUPER_ADMIN']);
  var items = Array.isArray(p.settings) ? p.settings : [];
  withLock_(function () {
    items.forEach(function (item) {
      var key = str_(item && item.KUNCI);
      if (!key || key.length > 60 || RESERVED_SETTING_KEYS_.indexOf(key) !== -1) return;
      var value = String(item.NILAI === undefined || item.NILAI === null ? '' : item.NILAI).slice(0, 500);
      var row = findRecord_(readTable_('PENGATURAN'), 'KUNCI', key);
      if (row) {
        updateRow_('PENGATURAN', row._row, {
          NILAI: value,
          KETERANGAN: str_(item.KETERANGAN) || str_(row.KETERANGAN)
        });
      } else {
        appendRecord_('PENGATURAN', { KUNCI: key, NILAI: value, KETERANGAN: str_(item.KETERANGAN) });
      }
    });
    logActivity_(actor, 'UPDATE_SETTINGS', 'PENGATURAN', 'Memperbarui pengaturan sistem.');
  });
  return { ok: true, settings: settingsOut_() };
}

function getLogs_(token) {
  requireUser_(token, ['SUPER_ADMIN', 'KEPALA_DESA', 'OPERATOR']);
  return {
    logs: readTable_('LOG_AKTIVITAS')
      .sort(function (a, b) { return str_(b.WAKTU).localeCompare(str_(a.WAKTU)); })
      .slice(0, 200)
      .map(plainRow_)
  };
}

// Sel CSV diberi tanda kutip dan awalan ' bila diawali =, +, -, atau @ (mencegah formula di Excel).
function csvCell_(v) {
  var s = (v === undefined || v === null) ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

function exportReportCsv_(token) {
  var actor = requireUser_(token, STAFF_ROLES_);
  var reports = readTable_('LAPORAN').sort(function (a, b) {
    return str_(b.CREATED_AT).localeCompare(str_(a.CREATED_AT));
  });
  var headers = ['ID_LAPORAN', 'TANGGAL', 'KODE_GRUP', 'NAMA_LAYANAN', 'JUDUL_LAPORAN', 'NAMA_PELAPOR', 'RT_RW', 'STATUS_TERBARU', 'PETUGAS_TUGAS'];
  var lines = [headers.map(csvCell_).join(',')];
  reports.forEach(function (r) {
    lines.push([
      r.ID_LAPORAN, r.CREATED_AT, r.KODE_GRUP, r.NAMA_LAYANAN, r.JUDUL_LAPORAN,
      r.NAMA_PELAPOR, r.RT_RW, r.STATUS_TERBARU, r.NAMA_PETUGAS_TUGAS
    ].map(csvCell_).join(','));
  });
  logActivity_(actor, 'EXPORT_CSV', 'LAPORAN', 'Ekspor ' + reports.length + ' baris laporan.');
  return {
    csv: '﻿' + lines.join('\r\n'),
    filename: 'LAPORAN_WARGA_AMPEL_' + todayStr_() + '.csv',
    total: reports.length
  };
}
