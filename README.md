# WARGA AMPEL (SIWARGA Desa Ampel)

Portal pelayanan dan pengaduan warga Desa Ampel. Antarmuka React ditayangkan melalui GitHub Pages, backend memakai Google Apps Script (GAS), database diarahkan ke Google Sheets yang ditentukan, dan foto/bukti disimpan di folder Google Drive yang ditentukan. URL GAS, ID spreadsheet, dan ID folder Drive telah diisikan sesuai tautan integrasi yang diberikan.

## Fitur

- **Warga**: pengaduan, permohonan bantuan, layanan administrasi, aspirasi, konsultasi, serta opsi "saya tidak tahu" yang nantinya diklasifikasikan petugas.
- **Akun**: pendaftaran dengan kode verifikasi, login memakai nama pengguna atau nomor HP, dan reset kata sandi.
- **Pelacakan**: cek laporan memakai nomor tiket dan verifikasi tanggal lahir atau 4 digit terakhir HP pelapor.
- **Dashboard warga**: riwayat laporan, tindak lanjut, bukti publik, dan notifikasi.
- **Dashboard petugas dan admin**: daftar laporan dan filter, tindak lanjut yang hanya menambah riwayat, unggah bukti (publik atau internal), klasifikasi laporan umum, builder layanan dengan formulir dinamis, data warga, data petugas, pengumuman, statistik, ekspor CSV, pengaturan, dan log aktivitas.

## Struktur folder

```
src/                 Antarmuka React + TypeScript (Vite, Tailwind)
  components/        Wizard laporan, pelacakan, dashboard warga, dashboard admin
  lib/api.ts         Klien: mengirim permintaan ke Web App GAS
  lib/gasBridge.ts   Pemetaan rute REST ke aksi GAS
gas/                 Backend Google Apps Script
  Code.gs            Logika layanan (dispatch_, autentikasi, laporan, bukti)
  Setup.gs           Pembuatan spreadsheet, folder Drive, dan akun admin awal
  appsscript.json    Zona waktu, izin, dan akses Web App
tests/               Tes backend (GAS di-mock) dan tes keamanan serta konfigurasi
.github/workflows/   Build dan deploy otomatis ke GitHub Pages
```

## Pemasangan

Langkah 1 sampai 3 dilakukan sekali. Anda memerlukan akun Google dan akun GitHub.

### 1. Siapkan backend di Google Apps Script

1. Buka [script.google.com](https://script.google.com), lalu pilih **Proyek baru**.
2. Di file `Code.gs` bawaan, hapus isinya dan salin seluruh isi `gas/Code.gs`.
3. Pilih **+ > Script**, beri nama `Setup`, lalu salin isi `gas/Setup.gs`.
4. Buka **Project Settings** (ikon gerigi), centang **Show "appsscript.json" manifest file in editor**, lalu salin isi `gas/appsscript.json` ke berkas `appsscript.json`.
5. Di **Project Settings > Script Properties** (opsional), tambahkan `ADMIN_AWAL_PASSWORD` berisi kata sandi awal admin, minimal 8 karakter. Jika tidak diisi, sandi acak dicatat sekali di log.
6. Pilih fungsi **`setupAll`** di toolbar lalu klik **Run**. Setup membuat spreadsheet `DATABASE_SIWARGA`, folder Drive `SIWARGA_DESA`, seluruh tabel, sembilan layanan contoh, dan akun admin dengan nama pengguna `admin`.
   - Saat pertama kali dijalankan, Google meminta izin untuk Spreadsheet dan Drive. Jika muncul peringatan "Google belum memverifikasi aplikasi", pilih **Advanced**, lalu lanjutkan. Ini skrip milik Anda sendiri.
   - Buka **Execution log** untuk melihat sandi admin jika dibuat otomatis.
7. Ganti sandi admin: ubah nilai `SANDI_BARU` di fungsi `gantiPasswordAdmin()` menjadi kata sandi yang kuat, jalankan fungsi itu, lalu hapus sandi tersebut dari kode.
8. Klik **Deploy > New deployment**, pilih tipe **Web app**, atur **Execute as: Me** dan **Who has access: Anyone**, lalu **Deploy**. Salin URL yang berakhiran `/exec`.

Setelah mengubah kode GAS, gunakan **Deploy > Manage deployments > Edit > New version** pada deployment yang sama. Dengan cara ini URL tidak berubah. Deployment baru akan menghasilkan URL baru.

### 2. Siapkan repositori GitHub

1. Buat repositori baru, lalu unggah seluruh isi folder ini. Workflow berjalan saat ada push ke branch `main`. Jika branch utama Anda bernama lain, ubah bagian `branches` di `.github/workflows/deploy-pages.yml`.
2. Buka **Settings > Pages**, lalu pada **Build and deployment > Source** pilih **GitHub Actions**. Langkah ini wajib sebelum deploy pertama.
3. Buka **Settings > Secrets and variables > Actions**, pilih tab **Variables**, lalu **New repository variable**:
   - Name: `VITE_GAS_WEB_APP_URL`
   - Value: URL `/exec` dari langkah 1.8
   
   Gunakan Variables, bukan Secrets. Nilai ini tidak rahasia, dan ia ditanam saat build.
4. Buka tab **Actions**, lalu jalankan workflow **Deploy GitHub Pages** (atau lakukan push ke `main`).
5. Situs terbit di `https://<username>.github.io/<nama-repositori>/`.

### 3. Masuk pertama kali

1. Buka situs, klik **Portal Petugas & Admin**, lalu masuk sebagai `admin` dengan sandi dari langkah 1.7.
2. Buka **Data Petugas**, lalu **Tambah Petugas**. Isi nama pengguna dan kata sandi awal jika petugas perlu akun login. Hanya Super Admin yang dapat menambah petugas.

## Menjalankan di komputer sendiri

```bash
npm ci
cp .env.example .env.local     # lalu isi VITE_GAS_WEB_APP_URL
npm run dev
```

Untuk uji coba tanpa `.env.local`, buka `http://localhost:5173/?gasUrl=<URL /exec>`. Alamat itu disimpan di browser.

Perintah pemeriksaan:

```bash
npm run lint     # pemeriksaan tipe TypeScript
npm test         # tes kontrak bridge, tes backend, dan tes keamanan
npm run build    # hasil ada di folder dist/
```

## Pemecahan masalah

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| Banner "Aplikasi belum terhubung" tampil | `VITE_GAS_WEB_APP_URL` belum diisi | Isi variabel di Settings > Variables, lalu jalankan ulang workflow |
| "Google Apps Script tidak mengembalikan data JSON" | Web App belum diberi akses Anyone, atau URL yang dipakai bukan `/exec` | Periksa deployment, lalu salin URL `/exec` ke variabel |
| Perubahan kode GAS belum terasa | Deployment masih memakai versi lama | Manage deployments > Edit > New version |
| Bukti tidak bisa dibuka | Akses ditolak, atau ukuran lebih dari 5 MB | Hanya JPG, PNG, dan PDF maksimal 5 MB yang diterima |
| `configure-pages` gagal saat deploy | Source Pages belum diatur ke GitHub Actions | Settings > Pages > Source: GitHub Actions |
| Peringatan ukuran chunk saat build | Gambar latar cukup besar | Tidak menghentikan build. Gambar bisa dikompres bila ingin lebih ringan |

## Keamanan dan batasan

- Kode verifikasi pendaftaran ditampilkan di layar, karena belum ada pengiriman SMS atau email.
- Reset kata sandi memakai tanggal lahir atau nomor HP. Keduanya relatif mudah ditebak, jadi untuk pemakaian resmi sebaiknya ditambah verifikasi yang lebih kuat.
- Kata sandi di-hash dengan SHA-256 dan salt, tanpa penguatan hash (key stretching). Belum ada pembatasan percobaan login.
- Mengganti `SESSION_SECRET` membuat semua sesi berakhir dan mengubah pencocokan NIK. Jangan ganti setelah data terisi.
- Lampiran dari warga bersifat `PUBLIK_WARGA`, sehingga pelapor dapat melihatnya lewat pelacakan. Bukti dari petugas memakai `INTERNAL_DESA` secara default.
- Berkas di Drive bersifat privat. Aplikasi menyajikannya lewat backend, sehingga tautan Drive tidak pernah dikirim ke browser.
- Web App berjalan sebagai pemilik skrip. Siapa pun yang punya akses edit ke proyek GAS dapat mengubah data. Batasi akses editor hanya untuk pengelola.
- Google Apps Script memiliki kuota harian. Untuk desa dengan beban layanan yang biasa, kuota ini umumnya cukup.
- Tes backend memakai lingkungan GAS tiruan (mock), bukan layanan Google sungguhan. Setelah pemasangan pertama, lakukan uji manual: login admin, kirim satu laporan, lalu cek di pelacakan.


## Tautan integrasi yang dipakai

- **Folder Google Drive untuk foto/bukti:** https://drive.google.com/drive/folders/105o5hBhSGAUI_ckmVFADFTLbhqScmFIy
- **Google Sheets untuk database:** https://docs.google.com/spreadsheets/d/1rml3Rh-ss6Qtlk6VCkU8vqP2yL0Q9TJB7faLmlmHKqQ/edit
- **Google Apps Script Web App:** https://script.google.com/macros/s/AKfycbxmODwRVjfGht162FycYsW_0MF0hno4ABgc9kojE093514SVGSZotdusr-fjHfGICLw/exec
- **Frontend:** GitHub Pages melalui workflow `.github/workflows/deploy-pages.yml`.

> Catatan keamanan: folder Drive tetap privat; akses file dilakukan melalui backend setelah pemeriksaan hak akses. Jangan mengubah folder menjadi publik hanya agar unggahan bekerja.
