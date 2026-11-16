// Uji backend Google Apps Script (gas/Code.gs dan gas/Setup.gs).
// Kode GAS dijalankan di dalam vm dengan mock Sheets, Drive, Utilities, dan Lock.
// Tidak ada panggilan ke Google. Yang diuji: alur bisnis, kontrak respons, dan aturan akses.
// Mock meniru perilaku Sheets yang penting: sel berformat teks ('@') tidak diubah,
// sel biasa mengubah "08..." menjadi angka dan tanggal menjadi Date.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAS_DIR = path.resolve(HERE, '..', 'gas');
const SOURCES = {
  code: readFileSync(path.join(GAS_DIR, 'Code.gs'), 'utf8'),
  setup: readFileSync(path.join(GAS_DIR, 'Setup.gs'), 'utf8'),
};

const toSigned = (b) => (b > 127 ? b - 256 : b);
const toUnsigned = (b) => (b < 0 ? b + 256 : b);
const toBuffer = (v) => (Array.isArray(v) ? Buffer.from(v.map(toUnsigned)) : Buffer.from(String(v), 'utf8'));
const toSignedArray = (buf) => Array.from(buf, toSigned);
const TZ_OFFSET = { 'Asia/Jakarta': '+07:00' };

function formatDateInZone(date, tz, pattern) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(date.getTime()));
  const get = (type) => parts.find((p) => p.type === type).value;
  const tokens = {
    yyyy: get('year'),
    MM: get('month'),
    dd: get('day'),
    HH: get('hour'),
    mm: get('minute'),
    ss: get('second'),
    M: String(Number(get('month'))),
    d: String(Number(get('day'))),
  };
  return pattern.replace(/yyyy|MM|dd|HH|mm|ss|M|d/g, (t) => tokens[t]);
}

const iter = (list) => {
  let i = 0;
  return { hasNext: () => i < list.length, next: () => list[i++] };
};

function createGasEnvironment() {
  const state = { props: {}, logs: [], spreadsheets: new Map(), folders: new Map(), files: new Map(), seq: 0 };
  const sandbox = {};
  const ctx = vm.createContext(sandbox);
  const CtxDate = vm.runInContext('Date', ctx);
  const nextId = (prefix) => `${prefix}${String(++state.seq).padStart(6, '0')}`;

  // Sel teks ('@') menyimpan nilai apa adanya. Sel lain meniru auto-parse Sheets.
  function autoParse(value, tz) {
    if (typeof value !== 'string') return value;
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new CtxDate(`${value}T00:00:00${TZ_OFFSET[tz] || 'Z'}`);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value)) return new CtxDate(value);
    if (value === 'TRUE') return true;
    if (value === 'FALSE') return false;
    return value;
  }

  class Range {
    constructor(sheet, row, col, rows, cols) {
      Object.assign(this, { sheet, row, col, rows, cols });
    }
    cellsWith(fn) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) fn(this.row + r, this.col + c);
      }
    }
    getValues() {
      return Array.from({ length: this.rows }, (_, r) =>
        Array.from({ length: this.cols }, (_2, c) => {
          const cell = this.sheet.cells.get(`${this.row + r}:${this.col + c}`);
          return cell ? cell.v : '';
        })
      );
    }
    getValue() {
      return this.getValues()[0][0];
    }
    setValues(values) {
      values.forEach((line, r) => {
        line.forEach((value, c) => {
          const key = `${this.row + r}:${this.col + c}`;
          const prev = this.sheet.cells.get(key) || { v: '', f: '' };
          const stored = prev.f === '@' ? value : autoParse(value, this.sheet.ss.tz);
          this.sheet.cells.set(key, { v: stored, f: prev.f });
        });
      });
      return this;
    }
    setValue(value) {
      return this.setValues([[value]]);
    }
    setNumberFormat(format) {
      this.cellsWith((r, c) => {
        const key = `${r}:${c}`;
        const prev = this.sheet.cells.get(key) || { v: '', f: '' };
        this.sheet.cells.set(key, { v: prev.v, f: format });
      });
      return this;
    }
    setFontWeight() { return this; }
    setBackground() { return this; }
    setFontColor() { return this; }
  }

  class Sheet {
    constructor(name, ss) {
      this.name = name;
      this.ss = ss;
      this.cells = new Map();
    }
    getName() { return this.name; }
    setName(name) { this.name = name; return this; }
    getMaxRows() { return 1000; }
    getLastRow() { return this.extent(0); }
    getLastColumn() { return this.extent(1); }
    extent(axis) {
      let max = 0;
      for (const [key, cell] of this.cells) {
        if (cell.v === '' || cell.v === undefined) continue;
        const [r, c] = key.split(':').map(Number);
        max = Math.max(max, axis === 0 ? r : c);
      }
      return max;
    }
    getRange(row, col, rows = 1, cols = 1) {
      return new Range(this, row, col, rows, cols);
    }
    deleteRow(row) {
      const next = new Map();
      for (const [key, cell] of this.cells) {
        const [r, c] = key.split(':').map(Number);
        if (r === row) continue;
        next.set(`${r > row ? r - 1 : r}:${c}`, cell);
      }
      this.cells = next;
      return this;
    }
    setFrozenRows() { return this; }
  }

  class Spreadsheet {
    constructor(id, name) {
      Object.assign(this, { id, name, sheets: [], tz: 'UTC' });
    }
    getId() { return this.id; }
    getUrl() { return `https://docs.google.com/spreadsheets/d/${this.id}/edit`; }
    getSheetByName(name) { return this.sheets.find((s) => s.name === name) || null; }
    getSheets() { return this.sheets.slice(); }
    insertSheet(name) {
      const sheet = new Sheet(name, this);
      this.sheets.push(sheet);
      return sheet;
    }
    setSpreadsheetTimeZone(tz) { this.tz = tz; return this; }
  }

  class Blob {
    constructor(data, contentType, name) {
      this.bytes = Array.isArray(data) ? data.slice() : toSignedArray(Buffer.from(String(data), 'utf8'));
      this.contentType = contentType || 'application/octet-stream';
      this.name = name || '';
    }
    getBytes() { return this.bytes.slice(); }
    getDataAsString() { return toBuffer(this.bytes).toString('utf8'); }
    getName() { return this.name; }
    getContentType() { return this.contentType; }
  }

  class DriveFile {
    constructor(id, blob, parent) {
      Object.assign(this, { id, name: blob.getName(), mime: blob.getContentType(), bytes: blob.getBytes(), parent });
    }
    getId() { return this.id; }
    getName() { return this.name; }
    getUrl() { return `https://drive.google.com/file/d/${this.id}/view`; }
    getMimeType() { return this.mime; }
    getBlob() { return new Blob(this.bytes, this.mime, this.name); }
    setSharing(access, permission) { this.sharing = { access, permission }; return this; }
  }

  class Folder {
    constructor(id, name, parent) {
      Object.assign(this, { id, name, parent, folders: [], files: [], sharing: null });
    }
    getId() { return this.id; }
    getName() { return this.name; }
    getUrl() { return `https://drive.google.com/drive/folders/${this.id}`; }
    getFoldersByName(name) { return iter(this.folders.filter((f) => f.name === name)); }
    createFolder(name) {
      const folder = new Folder(nextId('fd'), name, this);
      this.folders.push(folder);
      state.folders.set(folder.id, folder);
      return folder;
    }
    createFile(blob) {
      const file = new DriveFile(nextId('fl'), blob, this);
      this.files.push(file);
      state.files.set(file.id, file);
      return file;
    }
    setSharing(access, permission) { this.sharing = { access, permission }; return this; }
  }

  const root = new Folder(nextId('fd'), 'My Drive', null);
  state.folders.set(root.id, root);

  const Logger = { log: (msg) => { state.logs.push(String(msg)); } };

  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (Object.prototype.hasOwnProperty.call(state.props, k) ? state.props[k] : null),
      setProperty: (k, v) => { state.props[k] = String(v); },
      setProperties: (obj) => { Object.assign(state.props, obj); },
      deleteProperty: (k) => { delete state.props[k]; },
    }),
  };

  const LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };

  const SpreadsheetApp = {
    create: (name) => {
      const ss = new Spreadsheet(nextId('ss'), name);
      ss.insertSheet('Sheet1');
      state.spreadsheets.set(ss.id, ss);
      return ss;
    },
    openById: (id) => {
      const ss = state.spreadsheets.get(id);
      if (!ss) throw new Error(`Spreadsheet tidak ditemukan: ${id}`);
      return ss;
    },
    getActiveSpreadsheet: () => null,
    flush: () => {},
  };

  const DriveApp = {
    Access: { PRIVATE: 'PRIVATE', ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
    Permission: { VIEW: 'VIEW', EDIT: 'EDIT' },
    createFolder: (name) => root.createFolder(name),
    getFolderById: (id) => {
      const folder = state.folders.get(id);
      if (!folder) throw new Error(`Folder Drive tidak ditemukan: ${id}`);
      return folder;
    },
    getFileById: (id) => {
      const file = state.files.get(id);
      if (!file) throw new Error(`File Drive tidak ditemukan: ${id}`);
      return file;
    },
  };

  const Utilities = {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    getUuid: () => crypto.randomUUID(),
    base64Encode: (v) => toBuffer(v).toString('base64'),
    base64EncodeWebSafe: (v) => toBuffer(v).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    base64Decode: (s) => toSignedArray(Buffer.from(String(s), 'base64')),
    base64DecodeWebSafe: (s) => toSignedArray(Buffer.from(String(s), 'base64')),
    computeDigest: (alg, v) => toSignedArray(crypto.createHash('sha256').update(toBuffer(v)).digest()),
    computeHmacSha256Signature: (v, key) =>
      toSignedArray(crypto.createHmac('sha256', toBuffer(key)).update(toBuffer(v)).digest()),
    newBlob: (data, contentType, name) => new Blob(data, contentType, name),
    formatDate: (date, tz, pattern) => formatDateInZone(date, tz, pattern),
  };

  const ContentService = {
    MimeType: { JSON: 'application/json', TEXT: 'text/plain' },
    createTextOutput: (text) => ({
      text: String(text),
      setMimeType() { return this; },
      getContent() { return this.text; },
    }),
  };

  const HtmlService = { createHtmlOutput: (html) => ({ getContent: () => String(html) }) };

  Object.assign(sandbox, {
    Logger, PropertiesService, LockService, SpreadsheetApp, DriveApp, Utilities, ContentService, HtmlService,
  });
  vm.runInContext(SOURCES.code, ctx, { filename: 'Code.gs' });
  vm.runInContext(SOURCES.setup, ctx, { filename: 'Setup.gs' });

  return { ctx, state, CtxDate, root };
}

// Pembungkus pemanggilan seperti frontend: POST text/plain berisi { action, payload, token }.
function createTestApi() {
  const env = createGasEnvironment();
  const call = (action, payload = {}, token = '') =>
    JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).getContent());
  const ok = (action, payload = {}, token = '') => {
    const r = call(action, payload, token);
    assert.equal(r.error, undefined, `${action} gagal: ${r.error}`);
    assertNoSecrets(r, action);
    return r;
  };
  const fail = (action, payload = {}, token = '', pattern) => {
    const r = call(action, payload, token);
    assert.ok(r.error, `${action} seharusnya gagal tetapi berhasil: ${JSON.stringify(r).slice(0, 200)}`);
    if (pattern) assert.match(r.error, pattern);
    return r.error;
  };
  return { ...env, call, ok, fail };
}

// Kunci yang tidak boleh pernah sampai ke browser.
const SECRET_KEYS = ['PASSWORD_HASH', 'KODE_VERIFIKASI', 'NIK_HASH', 'RESET_TOKEN', 'DRIVE_FILE_ID', 'DRIVE_URL'];
function assertNoSecrets(value, where) {
  const walk = (v, p) => {
    if (!v || typeof v !== 'object') return;
    for (const [k, inner] of Object.entries(v)) {
      if (SECRET_KEYS.includes(k)) {
        assert.ok(inner === '' || inner === undefined, `${where}: kunci rahasia ${k} bocor di ${p}`);
      }
      walk(inner, `${p}.${k}`);
    }
  };
  walk(value, where);
}

// Teks kecil yang tampak seperti gambar JPEG/PNG/PDF sungguhan (tanda magic bytes).
const jpegBytes = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(120, 7)]);
const pngBytes = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 3)]);
const pdfBytes = (text = 'surat') => Buffer.from(`%PDF-1.4\n% ${text}\n%%EOF\n`, 'utf8');
const dataUrl = (buf, mime) => `data:${mime};base64,${buf.toString('base64')}`;

// ============================================================================
// SATU KONTEKS UNTUK SEMUA TES (alur berurutan, seperti penggunaan nyata)
// ============================================================================
const T = createTestApi();
const state = {
  adminPassword: '',
  citizenToken: '',
  citizenUser: null,
  adminToken: '',
  operatorToken: '',
  ticketBudi: '',
  ticketGeneral: '',
  ticketSiti: '',
  ticketEvidence: '',
  serviceId: '',
  fieldIdJenis: '',
  fieldIdPanjang: '',
  citizenFollowUpId: '',
};
const BUDI_DOB = '1985-02-10';
const SITI_DOB = '1990-05-17';
const SITI_PASSWORD = 'RahasiaAman1';

// ============================================================================
// FLOW UJI (berurutan: setiap tes memakai hasil tes sebelumnya)
// ============================================================================

const ADMIN_AWAL = 'AdminUji2026';
const plain = (v) => JSON.parse(JSON.stringify(v));
const gasWebSafe = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
const tahunIni = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric' }).format(new Date());

// Membaca tabel mentah dari mock (nilai persis seperti tersimpan di sel).
function tabelMentah(nama) {
  const ss = T.state.spreadsheets.get(T.state.props.SPREADSHEET_ID);
  const sh = ss.getSheetByName(nama);
  const baris = sh.getLastRow();
  const kolom = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, kolom).getValues()[0];
  const data = baris > 1 ? sh.getRange(2, 1, baris - 1, kolom).getValues() : [];
  return data.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}
const jumlahBaris = (nama) => tabelMentah(nama).length;

// Mengubah satu sel langsung di mock (dipakai untuk menguji perubahan status/peran).
function ubahSel(nama, kunciKolom, nilaiKunci, kolom, nilai) {
  const ss = T.state.spreadsheets.get(T.state.props.SPREADSHEET_ID);
  const sh = ss.getSheetByName(nama);
  const baris = sh.getLastRow();
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idxKunci = header.indexOf(kunciKolom);
  const idxKolom = header.indexOf(kolom);
  for (let r = 2; r <= baris; r++) {
    if (String(sh.getRange(r, idxKunci + 1).getValue()) === String(nilaiKunci)) {
      sh.getRange(r, idxKolom + 1).setValue(nilai);
      return;
    }
  }
  throw new Error(`Baris ${nilaiKunci} tidak ditemukan di ${nama}`);
}

const BUDI = {
  nama: 'Budi Santoso', username: 'budi.santoso', password: 'PasswordBudi1',
  nik: '3201012502850001', kk: '3201010101010001', noHp: '081234567890',
  dob: BUDI_DOB, alamat: 'Jl. Melati No. 5, Ampel', rtRw: '02/03'
};
const SITI = {
  nama: 'Siti Aminah', username: 'siti_aminah', password: SITI_PASSWORD,
  nik: '3201014705900002', noHp: '6281298765432', dob: SITI_DOB,
  alamat: 'Jl. Kenanga No. 9, Ampel', rtRw: 'RT 04 RW 01'
};
const daftarBudi = (tambahan = {}) => ({
  namaLengkap: BUDI.nama, username: BUDI.username, password: BUDI.password, nik: BUDI.nik,
  kk: BUDI.kk, noHp: BUDI.noHp, tanggalLahir: BUDI.dob, alamat: BUDI.alamat, rtRw: BUDI.rtRw, ...tambahan
});
const LAPORAN_BUDI = () => ({
  namaPelapor: BUDI.nama, noHpPelapor: BUDI.noHp, tanggalLahir: BUDI.dob,
  idLayanan: 'LAY-A01', masalahUtama: 'Jalan rusak / berlubang',
  uraianMasalah: 'Jalan di depan balai desa berlubang besar dan membahayakan pengendara motor.',
  lokasiAlamat: 'Depan balai desa, Jl. Melati', rtRw: BUDI.rtRw,
  dataFormDinamis: { 'FLD-A01-1': 'Berlubang', 'FLD-A01-2': '5' },
  attachment: { fileName: 'jalan-rusak.jpg', mimeType: 'image/jpeg', base64: dataUrl(jpegBytes(), 'image/jpeg') }
});
const ANON_RINA = () => ({
  namaPelapor: 'Rina Wulandari', noHpPelapor: '0813 1111 2222', tanggalLahir: '1992-08-20',
  idLayanan: 'LAY-A02', masalahUtama: 'Sampah menumpuk',
  uraianMasalah: 'Tumpukan sampah di depan SD sudah berhari-hari dan mulai berbau.',
  lokasiAlamat: 'Depan SD Negeri Ampel 1', rtRw: 'RT 02 RW 03',
  dataFormDinamis: { 'FLD-A02-1': 'Depan SD, RT 02', 'FLD-A02-2': '1-3 hari' }
});

test('mock Sheets meniru auto-parse dan format teks (uji mock)', () => {
  const ss = T.ctx.SpreadsheetApp.create('uji-mock');
  const sh = ss.insertSheet('UJI');
  sh.getRange(1, 1).setValue('081234567890');
  assert.equal(sh.getRange(1, 1).getValue(), 81234567890, 'tanpa format teks, nol di depan hilang');
  sh.getRange(2, 1).setNumberFormat('@').setValue('081234567890');
  assert.equal(sh.getRange(2, 1).getValue(), '081234567890', 'dengan format teks, nilai utuh');
  sh.getRange(3, 1).setValue('1985-02-10');
  assert.ok(sh.getRange(3, 1).getValue() instanceof T.CtxDate, 'tanggal tanpa format teks menjadi Date');
});

test('setupAll membuat spreadsheet, folder Drive, dan akun admin', () => {
  T.state.props.ADMIN_AWAL_PASSWORD = ADMIN_AWAL;
  const hasil = plain(T.ctx.setupAll());
  assert.equal(hasil.adminUsername, 'admin');
  assert.equal(hasil.adminDibuatSekarang, true);
  assert.ok(T.state.props.SPREADSHEET_ID, 'ID spreadsheet harus tersimpan');
  assert.ok(T.state.props.ROOT_FOLDER_ID, 'ID folder harus tersimpan');
  assert.ok(T.state.props.SESSION_SECRET.length >= 32, 'rahasia sesi harus dibuat');
  assert.ok(!T.state.logs.some((l) => l.includes('KATA SANDI ADMIN AWAL')), 'kata sandi tidak dicatat bila sudah diset');
  const cek = plain(T.ctx.cekKonfigurasi());
  assert.equal(cek.tabLengkap, true);
  assert.equal(cek.jumlahLayanan, 9);
  assert.equal(cek.jumlahAkunStaf, 1);
  assert.equal(cek.jumlahAkunWarga, 0);
});

test('setupAll dijalankan ulang tidak menggandakan data dan tidak mengganti rahasia', () => {
  const rahasia = T.state.props.SESSION_SECRET;
  const layanan = jumlahBaris('KATEGORI_LAYANAN');
  const pengaturan = jumlahBaris('PENGATURAN');
  const hasil = plain(T.ctx.setupAll());
  assert.equal(hasil.adminDibuatSekarang, false);
  assert.equal(jumlahBaris('KATEGORI_LAYANAN'), layanan);
  assert.equal(jumlahBaris('PENGATURAN'), pengaturan);
  assert.equal(layanan, 9);
  assert.equal(T.state.props.SESSION_SECRET, rahasia);
});

test('katalog layanan dan pengumuman publik tersedia tanpa login', () => {
  assert.equal(T.ok('ping').service, 'WARGA_AMPEL_GAS');
  const pub = T.ok('getPublicServices');
  assert.equal(pub.services.length, 9);
  const jalan = pub.services.find((s) => s.ID_LAYANAN === 'LAY-A01');
  assert.equal(jalan.fields.length, 2);
  assert.equal(jalan.fields[0].ID_FIELD, 'FLD-A01-1');
  assert.equal(jalan.fields[0].WAJIB, true);
  assert.deepEqual(jalan.fields[0].OPSI_PILIHAN, ['Berlubang', 'Retak', 'Amblas', 'Lainnya']);
  const pengumuman = T.ok('getPublicAnnouncements');
  assert.ok(pengumuman.announcements.some((a) => a.ID_PENGUMUMAN === 'PGM-WELCOME'));
});

test('jalur GET, halaman dasar, dan aksi yang tidak dikenali', () => {
  const html = T.ctx.doGet({ parameter: {} }).getContent();
  assert.match(html, /WARGA AMPEL/);
  const viaGet = JSON.parse(T.ctx.doGet({ parameter: { action: 'getPublicServices' } }).getContent());
  assert.equal(viaGet.services.length, 9);
  assert.match(JSON.parse(T.ctx.doGet({ parameter: { action: 'hapusSemua' } }).getContent()).error, /Aksi GET tidak dikenali/);
  assert.match(T.fail('aksiNgawur'), /Aksi tidak dikenali/);
  assert.ok(JSON.parse(T.ctx.doPost({ postData: { contents: '{bukan-json' } }).getContent()).error, 'JSON rusak harus menghasilkan galat');
});

test('pendaftaran warga menolak data tidak valid tanpa menulis apa pun', () => {
  const dasar = daftarBudi();
  T.fail('registerCitizen', { ...dasar, password: 'pendek' }, '', /Kata sandi minimal 8/);
  T.fail('registerCitizen', { ...dasar, nik: '123' }, '', /NIK harus 16 digit/);
  T.fail('registerCitizen', { ...dasar, username: 'a b' }, '', /Nama pengguna 4-30/);
  T.fail('registerCitizen', { ...dasar, tanggalLahir: '1985-02-30' }, '', /Tanggal lahir tidak valid/);
  T.fail('registerCitizen', { ...dasar, tanggalLahir: '2999-01-01' }, '', /Tanggal lahir tidak valid/);
  T.fail('registerCitizen', { ...dasar, noHp: '12' }, '', /Nomor HP tidak valid/);
  assert.equal(jumlahBaris('USERS'), 1, 'pendaftaran yang gagal tidak boleh menambah akun');
});

test('pendaftaran Budi dan Siti berhasil, duplikat HP dan NIK ditolak', () => {
  const reg = T.ok('registerCitizen', daftarBudi());
  assert.match(reg.kodeVerifikasi, /^\d{6}$/);
  assert.equal(reg.username, BUDI.username);
  state.kodeBudi = reg.kodeVerifikasi;
  T.fail('registerCitizen', daftarBudi({ username: 'budi2' }), '', /Nomor HP sudah terdaftar/);
  T.fail('registerCitizen', daftarBudi({ noHp: '0899 0000 1111' }), '', /Nama pengguna sudah terdaftar/);
  T.fail('registerCitizen', daftarBudi({ username: 'budi3', noHp: '+62 812-3456-7890' }), '', /Nomor HP sudah terdaftar/);
  T.fail('registerCitizen', daftarBudi({ username: 'budi4', noHp: '081299999999' }), '', /NIK sudah terdaftar/);
  const siti = T.ok('registerCitizen', {
    namaLengkap: SITI.nama, username: SITI.username, password: SITI.password, nik: SITI.nik,
    noHp: SITI.noHp, tanggalLahir: SITI.dob, alamat: SITI.alamat, rtRw: SITI.rtRw
  });
  state.kodeSiti = siti.kodeVerifikasi;
  assert.equal(jumlahBaris('USERS'), 3, 'admin, Budi, dan Siti');
});

test('login ditolak sebelum verifikasi; kode salah dan kode benar diuji', () => {
  T.fail('authenticateUser', { username: BUDI.username, password: BUDI.password }, '', /Akun belum diverifikasi/);
  T.fail('verifyCitizenAccount', { username: BUDI.username, kodeVerifikasi: '000000' }, '', /Kode verifikasi tidak sesuai/);
  const v = T.ok('verifyCitizenAccount', { username: BUDI.username, kodeVerifikasi: state.kodeBudi });
  assert.ok(v.token);
  assert.equal(v.user.role, 'WARGA');
  assert.equal(v.user.statusAkun, 'AKTIF');
  assert.equal(v.user.tanggalLahir, BUDI.dob);
  assert.equal(v.user.nikMasked, '320101******0001');
  assert.equal(v.user.passwordHash, undefined);
  state.budiToken = v.token;
  state.budiUserId = v.user.idUser;
  T.fail('verifyCitizenAccount', { username: BUDI.username, kodeVerifikasi: state.kodeBudi }, '', /Kode verifikasi tidak sesuai/);
  const siti = T.ok('verifyCitizenAccount', { username: SITI.username, kodeVerifikasi: state.kodeSiti });
  state.sitiToken = siti.token;
  state.sitiUserId = siti.user.idUser;
});

test('login memakai nama pengguna atau nomor HP; pesan galat tidak membocorkan akun', () => {
  const dengan = T.ok('authenticateUser', { username: BUDI.username, password: BUDI.password });
  assert.ok(dengan.token);
  const denganHp = T.ok('authenticateUser', { username: '0812-3456-7890', password: BUDI.password });
  assert.equal(denganHp.user.username, BUDI.username);
  const salah = T.fail('authenticateUser', { username: BUDI.username, password: 'salah-sekali' }, '', /tidak sesuai/);
  const tidakAda = T.fail('authenticateUser', { username: 'tidak.ada', password: 'salah-sekali' }, '', /tidak sesuai/);
  assert.equal(salah, tidakAda, 'akun tidak ada dan sandi salah harus memberi pesan yang sama');
  T.fail('authenticateUser', { username: BUDI.username, password: '' }, '', /wajib diisi/);
  state.budiToken = dengan.token;
});

test('token sesi yang diubah, kedaluwarsa, atau kosong ditolak', () => {
  const token = state.budiToken;
  const sig = token.slice(token.lastIndexOf('.') + 1);
  const palsu = gasWebSafe(Buffer.from(JSON.stringify({ uid: state.budiUserId, role: 'SUPER_ADMIN', exp: Date.now() + 3600e3, jti: 'x' })));
  T.fail('getAuthMe', {}, `${palsu}.${sig}`, /Sesi login tidak valid/);
  const kedaluwarsa = gasWebSafe(Buffer.from(JSON.stringify({ uid: state.budiUserId, role: 'WARGA', exp: Date.now() - 1000, jti: 'y' })));
  const sigExp = gasWebSafe(crypto.createHmac('sha256', T.state.props.SESSION_SECRET).update(kedaluwarsa).digest());
  T.fail('getAuthMe', {}, `${kedaluwarsa}.${sigExp}`, /Sesi login telah berakhir/);
  T.fail('getAuthMe', {}, '', /Sesi login diperlukan/);
  T.fail('getAuthMe', {}, 'bukan-token', /Sesi login tidak valid/);
  assert.equal(T.ok('getAuthMe', {}, token).user.username, BUDI.username);
});

test('laporan warga berlogin tersimpan dengan nomor tiket SW-TAHUN-NNNNNN', () => {
  const res = T.ok('submitReport', LAPORAN_BUDI(), state.budiToken);
  assert.match(res.ticketId, new RegExp(`^SW-${tahunIni}-000001$`));
  assert.equal(res.status, 'Laporan diterima');
  assert.equal(res.report.namaLayanan, 'Jalan rusak / berlubang');
  assert.equal(res.report.driveFolder, `01_LAPORAN_WARGA/${res.ticketId}`);
  state.ticketBudi = res.ticketId;
});

test('input laporan yang salah ditolak dan tidak memakan nomor tiket', () => {
  const dasar = LAPORAN_BUDI();
  T.fail('submitReport', { ...dasar, namaPelapor: 'B' }, state.budiToken, /Nama pelapor minimal 2/);
  T.fail('submitReport', { ...dasar, dataFormDinamis: { 'FLD-A01-2': '5' } }, state.budiToken, /Pertanyaan "Jenis kerusakan" wajib diisi/);
  T.fail('submitReport', { ...dasar, dataFormDinamis: { 'FLD-A01-1': 'Gunung' } }, state.budiToken, /Pilihan untuk "Jenis kerusakan" tidak valid/);
  T.fail('submitReport', { ...dasar, idLayanan: 'LAY-XXX' }, state.budiToken, /Jenis layanan tidak tersedia/);
  T.fail('submitReport', { ...dasar, uraianMasalah: 'Pendek' }, state.budiToken, /minimal 10 karakter/);
  T.fail('submitReport', { ...dasar, attachment: { fileName: 'x.txt', mimeType: 'text/plain', base64: dataUrl(Buffer.from('teks'), 'text/plain') } }, state.budiToken, /Format file harus JPG, PNG, atau PDF/);
  T.fail('submitReport', { ...dasar, attachment: { fileName: 'palsu.png', mimeType: 'image/png', base64: Buffer.from('bukan gambar').toString('base64') } }, state.budiToken, /tidak dikenali/);
  const besar = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5 * 1024 * 1024)]);
  T.fail('submitReport', { ...dasar, attachment: { fileName: 'besar.jpg', mimeType: 'image/jpeg', base64: besar.toString('base64') } }, state.budiToken, /melebihi batas 5 MB/);
  const anon = T.ok('submitReport', ANON_RINA());
  assert.match(anon.ticketId, new RegExp(`^SW-${tahunIni}-000002$`), 'tiket berikutnya harus 000002');
  state.ticketAnon = anon.ticketId;
});

test('laporan umum (tidak tahu harus lapor ke mana) tersimpan tanpa layanan', () => {
  const res = T.ok('submitReport', {
    namaPelapor: 'Dodi Pratama', noHpPelapor: '081400001111', tanggalLahir: '1978-01-30',
    isGeneralInquiry: true,
    uraianMasalah: 'Air sumur di rumah saya keruh sejak dua minggu lalu, saya tidak tahu harus lapor ke mana.',
    lokasiAlamat: 'Dusun Krajan', rtRw: 'RT 01 RW 02', dataFormDinamis: {}
  });
  assert.match(res.ticketId, new RegExp(`^SW-${tahunIni}-000003$`));
  assert.equal(res.report.namaLayanan, 'Saya Tidak Tahu (Perlu Klasifikasi)');
  state.ticketGeneral = res.ticketId;
});

test('pelacakan tiket: verifikasi identitas wajib, hanya bukti publik yang tampil', () => {
  T.fail('getReportStatus', { ticketId: state.ticketAnon }, '', /Verifikasi identitas gagal/);
  T.fail('getReportStatus', { ticketId: state.ticketAnon, tanggalLahir: '1990-01-01', last4Hp: '0000' }, '', /Verifikasi identitas gagal/);
  T.fail('getReportStatus', { ticketId: `SW-${tahunIni}-999999`, last4Hp: '2222' }, '', /Nomor tiket tidak ditemukan/);
  const tr = T.ok('getReportStatus', { ticketId: state.ticketAnon.toLowerCase(), last4Hp: '2222' }).tracking;
  assert.equal(tr.idLaporan, state.ticketAnon);
  assert.equal(tr.statusTerbaru, 'Laporan diterima');
  assert.equal(tr.riwayatTindakLanjut.length, 1);
  assert.equal(tr.buktiPublik.length, 0);
  const trBudi = T.ok('getReportStatus', { ticketId: state.ticketBudi, tanggalLahir: BUDI.dob }).tracking;
  assert.equal(trBudi.buktiPublik.length, 1);
  assert.equal(trBudi.buktiPublik[0].namaFile, 'jalan-rusak.jpg');
  state.evidenceBudiId = trBudi.buktiPublik[0].idBukti;
});

test('dasbor warga: laporan sendiri, notifikasi, dan tanda sudah dibaca', () => {
  T.fail('getCitizenDashboard', {}, '', /Sesi login diperlukan/);
  const dash = T.ok('getCitizenDashboard', {}, state.budiToken);
  assert.equal(dash.myReports.length, 1);
  assert.equal(dash.myReports[0].idLaporan, state.ticketBudi);
  const notif = dash.notifications.find((n) => n.JUDUL === 'Laporan Anda diterima');
  assert.ok(notif, 'notifikasi penerimaan harus ada');
  assert.equal(notif.DIBACA, false);
  state.budiNotifId = notif.ID_NOTIFIKASI;
  assert.equal(T.ok('getCitizenDashboard', {}, state.sitiToken).myReports.length, 0);
  T.ok('markNotificationRead', { idNotifikasi: state.budiNotifId }, state.sitiToken);
  const masihBelum = T.ok('getCitizenDashboard', {}, state.budiToken).notifications.find((n) => n.ID_NOTIFIKASI === state.budiNotifId);
  assert.equal(masihBelum.DIBACA, false, 'pengguna lain tidak boleh menandai notifikasi ini');
  T.ok('markNotificationRead', { idNotifikasi: state.budiNotifId }, state.budiToken);
  const sudah = T.ok('getCitizenDashboard', {}, state.budiToken).notifications.find((n) => n.ID_NOTIFIKASI === state.budiNotifId);
  assert.equal(sudah.DIBACA, true);
});

test('akun petugas: admin membuat operator, akses dibatasi sesuai peran', () => {
  const adm = T.ok('authenticateUser', { username: 'admin', password: ADMIN_AWAL });
  assert.equal(adm.user.role, 'SUPER_ADMIN');
  state.adminToken = adm.token;
  T.ok('createPetugas', {
    namaPetugas: 'Operator Desa', jabatan: 'Operator Layanan', bidangTugas: 'Pelayanan Umum',
    noHp: '081500000001', username: 'operator1', password: 'OperatorDesa1', role: 'OPERATOR'
  }, state.adminToken);
  const op = T.ok('authenticateUser', { username: 'operator1', password: 'OperatorDesa1' });
  assert.equal(op.user.role, 'OPERATOR');
  state.operatorToken = op.token;
  T.fail('getAdminDashboard', {}, state.budiToken, /tidak memiliki hak akses/);
  T.fail('createPetugas', { namaPetugas: 'Petugas Uji' }, state.operatorToken, /tidak memiliki hak akses/);
  T.fail('getAllReports', {}, '', /Sesi login diperlukan/);
});

test('dasbor admin: statistik dan notifikasi untuk staf', () => {
  const dash = T.ok('getAdminDashboard', {}, state.operatorToken);
  const s = dash.stats;
  assert.equal(s.totalLaporan, 3);
  assert.equal(s.laporanBaru, 3);
  assert.equal(s.totalWarga, 2);
  assert.equal(s.totalPetugas, 2);
  assert.equal(s.monthlyIncoming.length, 6);
  assert.equal(s.monthlyIncoming[5].count, 3, 'bulan berjalan memuat 3 laporan');
  assert.equal(s.statusDistribution.length, 7);
  assert.equal(s.completedVsUnfinished.belumSelesai, 3);
  assert.equal(dash.notifications.filter((n) => n.TARGET_USER_ID === 'ALL_STAFF').length, 3, 'setiap laporan masuk memberi notifikasi staf');
});

test('daftar laporan: filter, pencarian, dan nomor HP tetap berawalan 0', () => {
  const semua = T.ok('getAllReports', {}, state.operatorToken).reports;
  assert.equal(semua.length, 3);
  const anon = semua.find((r) => r.ID_LAPORAN === state.ticketAnon);
  assert.equal(anon.NO_HP_PELAPOR, '081311112222');
  assert.equal(anon.TANGGAL_LAHIR_VERIFIKASI, '1992-08-20');
  assert.equal(T.ok('getAllReports', { status: 'Laporan diterima' }, state.operatorToken).reports.length, 3);
  assert.equal(T.ok('getAllReports', { group: 'A. Pengaduan' }, state.operatorToken).reports.length, 2);
  const cari = T.ok('getAllReports', { search: 'JALAN' }, state.operatorToken).reports;
  assert.equal(cari.length, 1);
  assert.equal(cari[0].ID_LAPORAN, state.ticketBudi);
  T.fail('getReportDetail', { idLaporan: 'SW-0000-000000' }, state.operatorToken, /Laporan tidak ditemukan/);
  const det = T.ok('getReportDetail', { idLaporan: state.ticketBudi }, state.operatorToken);
  assert.equal(det.followUps.length, 1);
  assert.equal(det.evidence.length, 1);
});

test('klasifikasi laporan umum oleh operator, bukan oleh warga', () => {
  T.fail('classifyReport', { idLaporan: state.ticketGeneral, idLayanan: 'LAY-A02' }, state.budiToken, /tidak memiliki hak akses/);
  T.fail('classifyReport', { idLaporan: state.ticketGeneral, idLayanan: 'LAY-ZZZ' }, state.operatorToken, /Layanan tujuan tidak ditemukan/);
  const cls = T.ok('classifyReport', {
    idLaporan: state.ticketGeneral, idLayanan: 'LAY-A02', catatan: 'Sumur warga keruh, ditangani seksi pelayanan.'
  }, state.operatorToken);
  assert.equal(cls.report.STATUS_TERBARU, 'Sedang ditindaklanjuti');
  assert.equal(cls.report.KODE_GRUP, 'A. Pengaduan');
  assert.equal(cls.report.NAMA_LAYANAN, 'Sampah menumpuk');
  assert.equal(cls.report.NAMA_PETUGAS_TUGAS, 'Petugas Desa');
  assert.equal(cls.followUps.length, 2);
});

test('tindak lanjut: validasi alasan penolakan, status usulan dinas, dan bukti penanganan', () => {
  T.fail('saveFollowUp', { idLaporan: state.ticketBudi, status: 'Tidak dapat ditindaklanjuti', keterangan: 'Terlalu pendek' }, state.operatorToken, /minimal 15 karakter/);
  T.fail('saveFollowUp', { idLaporan: state.ticketBudi, status: 'Status ngawur', keterangan: 'Keterangan yang cukup panjang' }, state.operatorToken, /Status laporan tidak valid/);
  T.fail('saveFollowUp', { idLaporan: state.ticketBudi, status: 'Sedang dalam proses perbaikan', keterangan: 'a' }, state.operatorToken, /minimal 5 karakter/);
  T.fail('saveFollowUp', { idLaporan: state.ticketBudi, status: 'Sedang dalam proses perbaikan', keterangan: 'Keterangan cukup' }, state.budiToken, /tidak memiliki hak akses/);
  const fu = T.ok('saveFollowUp', {
    idLaporan: state.ticketBudi, status: 'Sudah diusulkan ke dinas terkait',
    keterangan: 'Usulan perbaikan jalan dikirim ke Dinas PUPR Kabupaten.',
    dinasTujuan: 'Dinas PUPR', nomorSurat: '001/DS/XI/2026', tanggalTindakan: '2026-11-16'
  }, state.operatorToken);
  assert.equal(fu.ok, true);
  assert.equal(fu.report.STATUS_TERBARU, 'Sudah diusulkan ke dinas terkait');
  assert.equal(fu.followUps.length, 2);
  const proses = T.ok('saveFollowUp', {
    idLaporan: state.ticketBudi, status: 'Sedang dalam proses perbaikan', keterangan: 'Petugas sudah turun ke lokasi jalan.',
    evidenceUpload: {
      fileName: 'foto-proses.png', mimeType: 'image/png', base64: dataUrl(pngBytes(), 'image/png'),
      jenisBukti: 'Foto proses', visibilitas: 'PUBLIK_WARGA'
    }
  }, state.operatorToken);
  assert.equal(proses.evidence.length, 2);
  const baru = proses.evidence.find((b) => b.JENIS_BUKTI === 'Foto proses');
  assert.equal(baru.VISIBILITAS, 'PUBLIK_WARGA');
  assert.equal(baru.DRIVE_FILE_ID, '');
  state.evidenceProsesId = baru.ID_BUKTI;
});

test('pelacakan dan notifikasi warga mengikuti tindak lanjut', () => {
  const tr = T.ok('getReportStatus', { ticketId: state.ticketBudi, tanggalLahir: BUDI.dob }).tracking;
  assert.equal(tr.statusTerbaru, 'Sedang dalam proses perbaikan');
  assert.equal(tr.riwayatTindakLanjut.length, 3);
  assert.equal(tr.buktiPublik.length, 2, 'foto awal dan foto proses sama-sama publik');
  assert.equal(tr.pesanKhususDinas, null);
  const dash = T.ok('getCitizenDashboard', {}, state.budiToken);
  assert.ok(dash.notifications.some((n) => String(n.JUDUL).indexOf('diperbarui') !== -1), 'warga diberi tahu status baru');
  assert.equal(dash.myReports[0].idLaporan, state.ticketBudi);
});

test('alasan tidak dapat ditindaklanjuti tampil di pelacakan warga', () => {
  const alasan = 'Lokasi berada di luar wilayah administrasi desa.';
  const fu = T.ok('saveFollowUp', { idLaporan: state.ticketAnon, status: 'Tidak dapat ditindaklanjuti', keterangan: alasan }, state.operatorToken);
  assert.equal(fu.report.ALASAN_TIDAK_DITINDAKLANJUTI, alasan);
  const tr = T.ok('getReportStatus', { ticketId: state.ticketAnon, last4Hp: '2222' }).tracking;
  assert.equal(tr.statusTerbaru, 'Tidak dapat ditindaklanjuti');
  assert.equal(tr.alasanPenolakan, alasan);
});

test('unggah bukti penanganan: visibilitas internal, default aman bila tidak diisi', () => {
  T.fail('uploadEvidence', { idLaporan: state.ticketAnon, fileName: 'x.txt', mimeType: 'text/plain', base64: dataUrl(Buffer.from('x'), 'text/plain') }, state.operatorToken, /Format file/);
  T.fail('uploadEvidence', { idLaporan: state.ticketAnon, fileName: 'surat.pdf', mimeType: 'application/pdf', base64: dataUrl(pdfBytes('x'), 'application/pdf') }, state.budiToken, /tidak memiliki hak akses/);
  const up = T.ok('uploadEvidence', {
    idLaporan: state.ticketAnon, fileName: 'surat-dinas.pdf', mimeType: 'application/pdf',
    base64: dataUrl(pdfBytes('internal'), 'application/pdf'), jenisBukti: 'Surat usulan ke dinas',
    visibilitas: 'INTERNAL_DESA', keterangan: 'Draf internal'
  }, state.operatorToken);
  assert.equal(up.bukti.VISIBILITAS, 'INTERNAL_DESA');
  assert.equal(up.bukti.DRIVE_FILE_ID, '');
  state.evidenceInternalId = up.bukti.ID_BUKTI;
  const tanpaVis = T.ok('uploadEvidence', {
    idLaporan: state.ticketAnon, fileName: 'catatan', mimeType: 'application/pdf',
    base64: dataUrl(pdfBytes('catatan'), 'application/pdf'), visibilitas: 'LAINNYA'
  }, state.operatorToken);
  assert.equal(tanpaVis.bukti.VISIBILITAS, 'INTERNAL_DESA');
  assert.equal(tanpaVis.bukti.JENIS_BUKTI, 'Dokumen pendukung lainnya');
  assert.equal(tanpaVis.bukti.NAMA_FILE, 'berkas.pdf');
  assert.equal(T.ok('getReportStatus', { ticketId: state.ticketAnon, last4Hp: '2222' }).tracking.buktiPublik.length, 0, 'bukti internal tidak tampil ke warga');
});

test('akses bukti: petugas, pemilik, tamu dengan tiket dan verifikasi, dan pihak lain', () => {
  const isi = (ev) => Buffer.from(ev.base64, 'base64');
  const internal = T.ok('getDriveEvidence', { idBukti: state.evidenceInternalId }, state.operatorToken);
  assert.equal(internal.fileName, 'surat-dinas.pdf');
  assert.equal(internal.mimeType, 'application/pdf');
  assert.ok(isi(internal).equals(pdfBytes('internal')), 'isi berkas harus sama dengan yang diunggah');
  const milikBudi = T.ok('getDriveEvidence', { idBukti: state.evidenceBudiId }, state.budiToken);
  assert.ok(isi(milikBudi).equals(jpegBytes()));
  const tamu = T.ok('getDriveEvidence', { idBukti: state.evidenceBudiId, ticketId: state.ticketBudi, tanggalLahir: BUDI.dob });
  assert.ok(isi(tamu).equals(jpegBytes()));
  T.fail('getDriveEvidence', { idBukti: state.evidenceInternalId }, '', /hanya dapat dilihat oleh petugas desa/);
  T.fail('getDriveEvidence', { idBukti: state.evidenceInternalId, ticketId: state.ticketAnon, last4Hp: '2222' }, state.budiToken, /hanya dapat dilihat oleh petugas desa/);
  T.fail('getDriveEvidence', { idBukti: state.evidenceBudiId, ticketId: state.ticketAnon, tanggalLahir: BUDI.dob }, '', /Nomor tiket tidak sesuai/);
  T.fail('getDriveEvidence', { idBukti: state.evidenceBudiId, ticketId: state.ticketBudi, tanggalLahir: '1990-01-01' }, '', /Verifikasi identitas gagal/);
  T.fail('getDriveEvidence', { idBukti: state.evidenceBudiId }, '', /Nomor tiket tidak sesuai/);
  T.fail('getDriveEvidence', { idBukti: 'BKT-TIDAK-ADA' }, '', /Bukti tidak ditemukan/);
});

test('pohon Drive: folder bukti privat dan ID Drive tidak keluar ke browser', () => {
  const tree = T.ok('getDriveTree', {}, state.operatorToken);
  assert.deepEqual(tree.subfolders, ['01_LAPORAN_WARGA', '02_SURAT_ADMINISTRASI', '03_BUKTI_PENANGANAN', '04_SURAT_KE_DINAS', '05_DOKUMEN_PENDUKUNG']);
  for (const t of [state.ticketBudi, state.ticketAnon, state.ticketGeneral]) {
    assert.ok(tree.ticketFolders.includes(t), `folder ${t} harus terdaftar`);
  }
  assert.ok(tree.evidence.length >= 3);
  T.fail('getDriveTree', {}, state.budiToken, /tidak memiliki hak akses/);
  const folder = [...T.state.folders.values()].find((f) => f.name === state.ticketBudi);
  assert.equal(folder.sharing.access, 'PRIVATE', 'folder bukti harus privat');
  const file = [...T.state.files.values()].find((f) => f.parent === folder);
  assert.equal(file.sharing.access, 'PRIVATE', 'berkas bukti harus privat');
});

test('kelola layanan: validasi isian, aktif dan nonaktif, hapus sesuai aturan', () => {
  T.fail('createService', { namaLayanan: 'Layanan Uji', fields: [] }, state.sitiToken, /tidak memiliki hak akses/);
  T.fail('createService', { namaLayanan: 'Ui', fields: [] }, state.operatorToken, /Nama layanan minimal 3/);
  T.fail('createService', { namaLayanan: 'Layanan Uji', fields: [{ LABEL_PERTANYAAN: 'Pilih', TIPE_ISIAN: 'dropdown', OPSI_PILIHAN: [] }] }, state.operatorToken, /memerlukan pilihan jawaban/);
  T.fail('createService', { namaLayanan: 'Layanan Uji', fields: [{ LABEL_PERTANYAAN: 'x', TIPE_ISIAN: 'text' }] }, state.operatorToken, /belum diisi/);
  T.fail('createService', { namaLayanan: 'Layanan Uji', fields: [{ LABEL_PERTANYAAN: 'Topik', TIPE_ISIAN: 'slider' }] }, state.operatorToken, /Tipe isian "slider" tidak dikenal/);
  const baru = T.ok('createService', {
    namaLayanan: 'Layanan Uji Coba', kategoriGrup: 'D. Aspirasi', deskripsi: 'Layanan untuk pengujian.',
    ikon: 'file-text', persyaratanDokumen: 'Opsional', idPetugasPj: 'PTG-001', statusAktif: true,
    fields: [{ LABEL_PERTANYAAN: 'Topik', TIPE_ISIAN: 'radio', OPSI_PILIHAN: ['Satu', 'Dua', 'Satu'], WAJIB: true, PLACEHOLDER: '' }]
  }, state.operatorToken);
  state.layananUjiId = baru.idLayanan;
  const pub = T.ok('getPublicServices').services;
  assert.equal(pub.length, 10);
  const item = pub.find((s) => s.ID_LAYANAN === baru.idLayanan);
  assert.deepEqual(item.fields[0].OPSI_PILIHAN, ['Satu', 'Dua'], 'pilihan ganda harus dihapus duplikatnya');
  T.ok('updateService', { idLayanan: baru.idLayanan, statusAktif: false }, state.operatorToken);
  assert.equal(T.ok('getPublicServices').services.length, 9, 'layanan nonaktif tidak tampil di portal');
  assert.equal(T.ok('getAdminServices', {}, state.operatorToken).services.length, 10, 'petugas tetap melihat layanan nonaktif');
  T.fail('deleteService', { idLayanan: 'LAY-A01' }, state.adminToken, /sudah dipakai laporan/);
  T.fail('deleteService', { idLayanan: baru.idLayanan }, state.operatorToken, /tidak memiliki hak akses/);
  T.ok('deleteService', { idLayanan: baru.idLayanan }, state.adminToken);
  assert.equal(T.ok('getAdminServices', {}, state.operatorToken).services.length, 9);
  assert.equal(tabelMentah('KONFIGURASI_FORM').filter((f) => f.ID_LAYANAN === baru.idLayanan).length, 0, 'isian layanan ikut terhapus');
});

test('pengumuman: terbit, tampil di publik, lalu dihapus', () => {
  T.fail('createAnnouncement', { judul: 'Uji', isi: 'Isi uji' }, state.sitiToken, /tidak memiliki hak akses/);
  T.fail('createAnnouncement', { judul: 'Ui', isi: 'isi pengumuman' }, state.operatorToken, /Judul pengumuman minimal 3/);
  const pg = T.ok('createAnnouncement', {
    judul: 'Posyandu Bulan Ini', kategori: 'Jadwal Desa',
    isi: 'Posyandu dilaksanakan hari Kamis di balai desa pukul 08.00 WIB. '.repeat(4)
  }, state.operatorToken);
  const item = T.ok('getPublicAnnouncements').announcements.find((a) => a.ID_PENGUMUMAN === pg.idPengumuman);
  assert.ok(item, 'pengumuman baru harus tampil');
  assert.ok(item.RINGKASAN.length <= 140, 'ringkasan dipotong 140 karakter');
  assert.equal(item.KATEGORI, 'Jadwal Desa');
  T.ok('deleteAnnouncement', { idPengumuman: pg.idPengumuman }, state.operatorToken);
  assert.equal(T.ok('getPublicAnnouncements').announcements.some((a) => a.ID_PENGUMUMAN === pg.idPengumuman), false);
});

test('pengaturan: hanya super admin, dan kunci nomor tiket tidak bisa diubah', () => {
  T.fail('saveSettings', { settings: [] }, state.operatorToken, /tidak memiliki hak akses/);
  T.fail('getSettings', {}, '', /Sesi login diperlukan/);
  const awal = T.ok('getSettings', {}, state.operatorToken).settings;
  assert.ok(awal.some((s) => s.KUNCI === 'NAMA_DESA'));
  assert.equal(awal.some((s) => s.KUNCI === 'TICKET_COUNTER'), false);
  const hasil = T.ok('saveSettings', {
    settings: [
      { KUNCI: 'NAMA_DESA', NILAI: 'Desa Ampel', KETERANGAN: 'Nama desa yang tampil di portal' },
      { KUNCI: 'TICKET_COUNTER', NILAI: '999' },
      { KUNCI: 'KONTAK_DESA', NILAI: '0812-0000-0000', KETERANGAN: 'Nomor kontak kantor desa' }
    ]
  }, state.adminToken);
  assert.equal(hasil.settings.find((s) => s.KUNCI === 'KONTAK_DESA').NILAI, '0812-0000-0000');
  assert.equal(hasil.settings.some((s) => s.KUNCI === 'TICKET_COUNTER'), false);
  assert.equal(tabelMentah('PENGATURAN').find((s) => s.KUNCI === 'TICKET_COUNTER').NILAI, '3');
});

test('log aktivitas hanya untuk super admin, kepala desa, dan operator', () => {
  T.fail('getLogs', {}, state.budiToken, /tidak memiliki hak akses/);
  const logs = T.ok('getLogs', {}, state.adminToken).logs;
  assert.ok(logs.some((l) => l.AKSI === 'LOGIN'));
  assert.ok(logs.some((l) => l.AKSI === 'SUBMIT_REPORT'));
  assert.ok(logs.length <= 200);
});

test('ekspor CSV: BOM, pelindung rumus di Excel, dan hanya untuk staf', () => {
  T.fail('exportReportCsv', {}, state.budiToken, /tidak memiliki hak akses/);
  const sisip = T.ok('submitReport', {
    ...ANON_RINA(), namaPelapor: 'Eko Prasetyo', judulLaporan: '=HYPERLINK("http://contoh.test")',
    idLayanan: 'LAY-A03', dataFormDinamis: { 'FLD-A03-1': 'LJ-12' }
  });
  assert.match(sisip.ticketId, new RegExp(`^SW-${tahunIni}-000004$`));
  const csv = T.ok('exportReportCsv', {}, state.operatorToken);
  assert.equal(csv.csv.charCodeAt(0), 0xfeff, 'berkas harus diawali BOM agar huruf Indonesia benar');
  assert.match(csv.csv, /^﻿"ID_LAPORAN","TANGGAL"/);
  assert.equal(csv.total, 4);
  assert.ok(csv.csv.includes('"\'=HYPERLINK(""http://contoh.test"")"'), 'rumus harus diawali apostrof');
  assert.match(csv.filename, /^LAPORAN_WARGA_AMPEL_\d{4}-\d{2}-\d{2}\.csv$/);
});

test('verifikasi warga oleh operator: nilai valid, dan alias status diterima', () => {
  T.fail('getWarga', {}, state.budiToken, /tidak memiliki hak akses/);
  const daftar = T.ok('getWarga', {}, state.operatorToken).warga;
  assert.equal(daftar.length, 2);
  const budi = daftar.find((w) => w.NAMA_LENGKAP === BUDI.nama);
  assert.equal(budi.NIK_MASKED, '320101******0001');
  assert.equal(budi.NIK_HASH, undefined);
  T.fail('verifyWarga', { idWarga: budi.ID_WARGA, statusVerifikasi: 'SALAH' }, state.operatorToken, /Status verifikasi tidak valid/);
  T.ok('verifyWarga', { idWarga: budi.ID_WARGA, status: 'TERVERIFIKASI' }, state.operatorToken);
  const sesudah = T.ok('getWarga', {}, state.operatorToken).warga.find((w) => w.ID_WARGA === budi.ID_WARGA);
  assert.equal(sesudah.STATUS_VERIFIKASI, 'TERVERIFIKASI');
});

test('reset kata sandi memerlukan tanggal lahir atau nomor HP yang cocok', () => {
  T.fail('resetPassword', { username: BUDI.username, newPassword: 'PasswordBaru2', tanggalLahir: '1999-01-01' }, '', /tidak cocok/);
  T.fail('resetPassword', { username: BUDI.username, newPassword: 'pendek' }, '', /minimal 8 karakter/);
  T.fail('resetPassword', { username: 'tidak.ada', newPassword: 'PasswordBaru2', tanggalLahir: BUDI.dob }, '', /tidak ditemukan/);
  assert.equal(T.ok('resetPassword', { username: BUDI.username, newPassword: 'PasswordBaru2', noHp: '0812 3456 7890' }).ok, true);
  T.fail('authenticateUser', { username: BUDI.username, password: BUDI.password }, '', /tidak sesuai/);
  assert.ok(T.ok('authenticateUser', { username: BUDI.username, password: 'PasswordBaru2' }).token);
});

test('status dan peran diambil ulang dari sheet pada setiap permintaan', () => {
  ubahSel('USERS', 'ID_USER', state.budiUserId, 'STATUS_AKUN', 'NONAKTIF');
  T.fail('getAuthMe', {}, state.budiToken, /Akun tidak aktif/);
  T.fail('authenticateUser', { username: BUDI.username, password: 'PasswordBaru2' }, '', /Akun tidak aktif/);
  ubahSel('USERS', 'ID_USER', state.budiUserId, 'STATUS_AKUN', 'AKTIF');
  assert.equal(T.ok('getAuthMe', {}, state.budiToken).user.username, BUDI.username);
  const opId = tabelMentah('USERS').find((u) => u.USERNAME === 'operator1').ID_USER;
  ubahSel('USERS', 'ID_USER', opId, 'ROLE', 'WARGA');
  T.fail('getAdminDashboard', {}, state.operatorToken, /tidak memiliki hak akses/);
  ubahSel('USERS', 'ID_USER', opId, 'ROLE', 'OPERATOR');
  assert.ok(T.ok('getAdminDashboard', {}, state.operatorToken).stats);
});
