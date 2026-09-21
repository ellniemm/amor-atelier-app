# AMOR ATELIEER — Aplikasi Keuangan & Pesanan

Web app mobile-friendly untuk mencatat keuangan (Pembukuan) dan pesanan (Order List),
langsung terhubung ke Google Sheets `AMOR_ATELIEER` yang sudah kamu pakai selama ini.
Dibuat dengan Next.js, siap deploy ke Vercel.

## Fitur

- **Ringkasan (Daily Report):** saldo saat ini, pemasukan/pengeluaran hari ini, grafik 7 hari terakhir, transaksi terbaru.
- **Daily Report ke Google Sheets:** setiap kali ada transaksi baru di Pembukuan, ringkasan hari itu (total masuk, total keluar, selisih, saldo akhir, jumlah transaksi) otomatis tersimpan/diperbarui ke tab **"Daily Report"** di spreadsheet kamu. Tab ini dibuat otomatis kalau belum ada. Ada juga tombol "Isi riwayat lama" untuk mengisi hari-hari sebelum fitur ini aktif, berdasarkan transaksi yang sudah ada di Pembukuan.
- **Pembukuan:** catat transaksi baru (Income/Outcome), saldo terhitung otomatis, langsung tersimpan ke tab `Pembukuan` di Google Sheets kamu.
- **Order List:** tambah & lihat pesanan, form otomatis menyesuaikan kolom apa pun yang ada di tab `Order List` kamu.
- **Login untuk 2 orang** (kamu & partner), masing-masing dengan username/password sendiri.
- Mobile-first, bisa langsung dipasang sebagai "Add to Home Screen" di HP.

---

## Cara Setup (langkah demi langkah)

### 1. Siapkan Google Service Account

Ini supaya aplikasi bisa baca/tulis ke Google Sheets kamu tanpa perlu login Google manual tiap saat.

1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat project baru (atau pakai yang sudah ada).
3. Buka **APIs & Services > Library**, cari **Google Sheets API**, klik **Enable**.
4. Buka **APIs & Services > Credentials** → **Create Credentials** → **Service Account**.
5. Isi nama bebas (misalnya `amor-atelier-app`), lanjut sampai selesai (role tidak perlu diisi).
6. Klik service account yang baru dibuat → tab **Keys** → **Add Key** → **Create new key** → pilih **JSON** → download.
7. Buka file JSON tersebut. Kamu akan butuh dua nilai:
   - `client_email` → ini untuk `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → ini untuk `GOOGLE_PRIVATE_KEY`

### 2. Share Google Sheet kamu ke Service Account

1. Buka spreadsheet `AMOR_ATELIEER` kamu di Google Sheets.
2. Klik **Share**, tempel email `client_email` dari langkah sebelumnya (bentuknya seperti `xxx@xxx.iam.gserviceaccount.com`).
3. Beri akses **Editor**.
4. Ambil **Spreadsheet ID** dari URL sheet kamu:
   `https://docs.google.com/spreadsheets/d/`**`INI_SPREADSHEET_ID_NYA`**`/edit`

### 3. Pastikan struktur sheet

- Tab **Pembukuan** harus punya baris header (baris 1) dengan nama-nama kolom seperti: `Tanggal`, `Nama`, `Keterangan`, `Nominal`, `Jenis`, `Saldo`, `Notes`.
  Nilai kolom **Jenis** harus persis `Income` atau `Outcome`. Urutan kolom bebas, aplikasi mencocokkan berdasarkan nama header (case-insensitive), bukan posisi kolom.
- Tab **Order List** bebas kolomnya apa saja — form pesanan di web otomatis menyesuaikan.
- Tab **Daily Report** tidak perlu kamu buat manual — aplikasi akan membuatnya sendiri (beserta header-nya) begitu transaksi pertama dicatat, atau begitu kamu klik "Isi riwayat lama" / "Sinkronkan hari ini" di halaman Ringkasan.

### 4. Setup project di komputer kamu

```bash
npm install
cp .env.local.example .env.local
```

Isi `.env.local`:

```
NEXTAUTH_SECRET=          # generate dengan: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

USER1_NAME=Adelweis
USER1_USERNAME=adelweis
USER1_PASSWORD_HASH=      # lihat langkah di bawah

USER2_NAME=Nama Partner
USER2_USERNAME=partner
USER2_PASSWORD_HASH=      # lihat langkah di bawah

GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=isi_spreadsheet_id_dari_langkah_2

SHEET_TAB_PEMBUKUAN=Pembukuan
SHEET_TAB_ORDERS=Order List
```

Catatan soal `GOOGLE_PRIVATE_KEY`: copy persis dari file JSON, termasuk `\n` di dalamnya —
biarkan sebagai teks satu baris dengan `\n` literal seperti itu, kode aplikasi yang akan menerjemahkannya.

### 5. Generate password untuk login

Untuk tiap user, jalankan:

```bash
npm run hash-password -- "password-pilihan-kamu"
```

Copy hasilnya (dimulai dengan `$2a$...`) ke `USER1_PASSWORD_HASH` atau `USER2_PASSWORD_HASH` di `.env.local`.

### 6. Coba jalankan lokal

```bash
npm run dev
```

Buka `http://localhost:3000`, login dengan username/password yang sudah kamu buat, dan pastikan data dari
Google Sheets muncul dengan benar.

### 7. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit: AMOR ATELIEER finance app"
git branch -M main
git remote add origin <url-repo-github-kamu>
git push -u origin main
```

### 8. Deploy ke Vercel

1. Buka [vercel.com](https://vercel.com/), **Add New Project**, pilih repo GitHub kamu.
2. Di bagian **Environment Variables**, masukkan semua variabel yang sama seperti di `.env.local` (kecuali `NEXTAUTH_URL`, isi dengan domain Vercel kamu nanti, contoh `https://amor-atelier.vercel.app`).
3. Klik **Deploy**.
4. Setelah selesai, buka domain Vercel-nya dari HP, login, dan tambahkan ke Home Screen biar terasa seperti aplikasi.

---

## Struktur Project (ringkas)

```
src/
  app/
    login/            → halaman login
    (app)/
      dashboard/       → Ringkasan / daily report
      pembukuan/       → catat & lihat transaksi
      orders/          → catat & lihat pesanan
    api/
      auth/            → NextAuth (login)
      pembukuan/       → GET & POST ke tab Pembukuan (juga trigger sync Daily Report)
      orders/          → GET & POST ke tab Order List
      report/          → data agregat untuk Ringkasan (saldo, grafik mingguan)
      daily-report/    → GET riwayat + POST untuk sinkron manual/backfill
  lib/
    googleSheets.js    → semua interaksi ke Google Sheets API
    auth.js            → konfigurasi login (2 user)
    reportData.js      → logika agregasi laporan harian/mingguan (untuk tampilan)
    dailyReport.js     → logika upsert & backfill ke tab Daily Report
```

## Catatan keamanan

- Login pakai sistem sederhana (2 akun tetap via env var) — cocok untuk tim kecil, bukan untuk publik.
- Service account hanya diberi akses ke spreadsheet yang kamu share secara eksplisit, tidak ke seluruh Google Drive kamu.
- Jangan commit file `.env.local` ke GitHub (sudah otomatis di-ignore lewat `.gitignore`).

## Kalau mau dikembangkan lagi

- Tambah kolom "Dicatat oleh" otomatis di Pembukuan (sudah ada `session.user.name`, tinggal disimpan ke kolom baru).
- Tambah filter/pencarian di halaman Pembukuan & Order List.
- Tambah grafik bulanan, bukan cuma 7 hari terakhir.
- Ubah status pesanan (Paid/Pending) langsung dari web tanpa buka Google Sheets.
