# Architecture --- Kinara Pilates Admin

> Dokumen arsitektur awal untuk aplikasi internal admin Kinara Pilates.
> Dokumen ini menjadi acuan implementasi dan dapat diperbarui ketika
> aturan operasional studio bertambah.

## 1. Tujuan Produk

Aplikasi web internal untuk satu admin studio Pilates untuk mengelola: -
Booking kelas berdasarkan tanggal dan jam. - Jadwal, ketersediaan,
kapasitas kelas, dan pergantian coach. - Data member dan paket sesi. -
Pembayaran, status reminder kelas, dan riwayat. - Pricelist, rekening
studio, serta notes pribadi admin.

Antarmuka mengikuti referensi visual: pastel pink, putih, aksen
mauve/rose, kartu ringkasan, tabel yang jelas, dan desain responsif.

## 2. Pengguna dan Akses

### Admin

Hanya admin yang menggunakan aplikasi. Login memakai username dan
password.

Persyaratan keamanan: - Password disimpan dalam bentuk hash, bukan teks
biasa. - Halaman dan API data operasional hanya dapat diakses setelah
login. - Sediakan logout dan sesi login yang kedaluwarsa. - Jangan
menaruh kredensial di kode frontend. - Untuk versi produksi, gunakan
HTTPS dan rahasia konfigurasi melalui environment variables.

## 3. Teknologi yang Disarankan

-   **Frontend:** HTML, CSS, JavaScript.
-   **Backend:** Node.js dengan Express untuk autentikasi, aturan
    bisnis, dan API.
-   **Database awal:** SQLite untuk instalasi sederhana/satu admin;
    pertimbangkan PostgreSQL jika aplikasi perlu diakses bersamaan dari
    beberapa perangkat atau berkembang lebih besar.
-   **Autentikasi:** sesi server dengan cookie aman atau mekanisme
    setara.
-   **Penyimpanan:** database permanen, bukan hanya `localStorage`.

Frontend tetap memakai HTML/CSS/JavaScript. Backend diperlukan agar
login, data permanen, dan validasi booking tidak hanya bergantung pada
browser.

## 4. Modul Utama

### 4.1 Dashboard

Menampilkan ringkasan berdasarkan tanggal yang dipilih atau tanggal hari
ini: - Booking kelas hari ini. - Jumlah kelas, member terdaftar, dan
slot tersisa. - Coach tersedia/tidak tersedia. - Total pembayaran
diterima, belum dibayar, dan berstatus waiting. - Reminder yang belum
dilakukan. - Peringatan kelas penuh, potensi bentrok, paket hampir
kedaluwarsa, dan perubahan coach.

Angka dashboard dihitung dari data utama di database, bukan dicatat
ulang secara terpisah.

### 4.2 Booking Kelas

Admin dapat: - Membuat, melihat, mengubah, membatalkan, dan melakukan
reschedule booking. - Memilih member, tanggal, jam, kelas, coach, dan
paket sesi yang digunakan. - Melihat jumlah peserta, kapasitas maksimum,
dan slot tersisa. - Melihat status kelas `Available`, `Full`, atau
`Unavailable`. - Melihat status coach `Available` atau `Unavailable`. -
Melihat status pembayaran dan reminder member.

Kapasitas kelas dapat diatur dan diubah admin; nilai contoh awal dapat
berupa 4, 7, atau 8 peserta, tetapi bukan nilai tetap yang dikunci di
kode.

### 4.3 Jadwal Coach

Tampilan jadwal dapat difilter per tanggal dan menampilkan: - Jam mulai
dan selesai. - Kelas dan coach yang dijadwalkan. - Coach aktual yang
mengajar. - Status ketersediaan. - Jumlah member dan slot tersisa. -
Notes admin.

Satu coach boleh mengajar beberapa kelas dalam sehari selama waktu kelas
tidak bertumpang tindih. Pemeriksaan menggunakan rentang waktu, bukan
hanya kesamaan jam mulai.

### 4.4 Member

Profil member menyimpan: - Nama dan informasi kontak yang diperlukan. -
Status member. - Daftar pembelian paket. - Sisa sesi setiap paket. -
Tanggal pembelian, aktivasi, dan kedaluwarsa paket. - Riwayat booking,
kehadiran, pembatalan, pembayaran, dan reminder.

### 4.5 Paket dan Pricelist

Admin dapat mengelola nama paket, kode, jumlah sesi, harga, masa
berlaku, deskripsi, serta status aktif/nonaktif.

Satu member dapat membeli beberapa paket sekaligus. Setiap pembelian
menjadi catatan paket tersendiri sehingga kuota dan masa berlaku tidak
tercampur.

**Masa berlaku paket dimulai saat paket itu pertama kali digunakan**,
bukan saat pembelian. Paket yang belum pernah digunakan belum memiliki
tanggal aktivasi dan tanggal kedaluwarsa.

Saat booking dibuat, admin **memilih secara manual** paket member yang
akan digunakan. Sistem harus memastikan paket milik member tersebut,
masih berlaku, dan memiliki sesi yang tersedia.

### 4.6 Payment

Data pembayaran menyimpan member, paket/transaksi terkait, jumlah
tagihan, jumlah dibayar, tanggal, metode, status, dan catatan.

Status yang ditampilkan: - `Sudah Payment` - `Belum Payment` - `Waiting`

Dashboard menampilkan total pembayaran yang diterima dan jumlah tagihan
yang belum lunas. Definisi angka harus konsisten: - **Pembayaran
diterima:** jumlah uang yang benar-benar tercatat telah diterima. -
**Belum lunas:** sisa tagihan yang belum dibayar. - **Waiting:**
transaksi yang menunggu konfirmasi; tidak dihitung sebagai uang diterima
sebelum dikonfirmasi.

Sediakan pengaturan informasi rekening studio (nama bank, nama pemilik
rekening, nomor rekening) agar dapat ditampilkan untuk admin saat
mencatat atau mengingatkan pembayaran. Informasi rekening tidak ditanam
langsung di banyak bagian kode.

### 4.7 Reminder Kelas

Setiap booking member memiliki status reminder, misalnya
`Belum di-reminder` dan `Sudah di-reminder`, serta waktu reminder dan
catatan opsional.

Pada versi awal, status dapat diperbarui manual oleh admin. Integrasi
WhatsApp atau pengiriman otomatis bukan bagian dari versi awal kecuali
ditambahkan kemudian.

### 4.8 Notes Pribadi

Notes hanya untuk admin dan dapat dikaitkan dengan member, booking,
jadwal, atau coach. Notes bukan pengganti data status yang terstruktur.

## 5. Aturan Bisnis Penting

### 5.1 Kapasitas Kelas

-   Kapasitas maksimum ditentukan dari konfigurasi kelas/jadwal dan
    dapat diubah admin.
-   Slot tersisa = kapasitas maksimum dikurangi jumlah booking aktif
    yang menempati slot.
-   Booking baru ditolak jika kelas sudah penuh.
-   Booking yang dibatalkan tidak lagi memakai slot kelas.
-   Perubahan kapasitas tidak boleh membuat booking baru melewati batas;
    jika kapasitas diturunkan di bawah jumlah peserta yang sudah
    terdaftar, tampilkan peringatan dan jangan menghapus booking secara
    otomatis.

### 5.2 Bentrok Coach

-   Dua penugasan coach tidak boleh memiliki rentang waktu yang tumpang
    tindih.
-   Secara umum, dua kelas bentrok jika
    `waktu_mulai_A < waktu_selesai_B` dan
    `waktu_selesai_A > waktu_mulai_B`.
-   Booking/penugasan tidak dapat disimpan jika coach bentrok, kecuali
    admin terlebih dahulu mengubah penugasan sehingga valid.
-   Ketersediaan harus dihitung ulang saat booking dibuat, diubah, atau
    di-reschedule.

### 5.3 Pergantian Coach Mendadak

-   Simpan coach terjadwal dan coach aktual secara terpisah.
-   Jika berbeda, tampilkan penanda visual `Coach Diganti`.
-   Admin dapat menambahkan notes alasan/informasi pergantian.
-   Perubahan dicatat dalam riwayat agar pergantian tidak menghilangkan
    informasi coach awal.

### 5.4 Reschedule

-   Admin memilih tanggal tujuan dan sistem menampilkan slot yang masih
    tersedia beserta jam dan coach.
-   Sistem memeriksa kapasitas kelas, ketersediaan coach, validitas
    paket, dan aturan pembatalan sebelum menyimpan perubahan.
-   Perubahan tanggal/jam/coach dan alasan reschedule dicatat dalam
    riwayat.
-   Perubahan dilakukan secara atomik agar slot lama dan slot baru tidak
    menghasilkan data ganda atau kapasitas berlebih.

### 5.5 Sesi Paket dan Kehadiran

-   Sesi berkurang satu kali saat member ditandai telah mengikuti kelas.
-   Sistem harus mencegah pengurangan ganda jika status kehadiran diedit
    atau permintaan dikirim ulang.
-   Saat paket pertama kali digunakan, sistem menetapkan tanggal
    aktivasi dan tanggal kedaluwarsa berdasarkan masa berlaku paket.
-   Paket tidak boleh digunakan jika belum aktif? Paket yang belum
    digunakan boleh dipilih untuk booking mendatang; masa berlaku baru
    dimulai ketika paket pertama kali benar-benar digunakan sesuai
    aturan studio.
-   Paket yang sudah kedaluwarsa atau tidak memiliki sisa sesi tidak
    dapat dipakai untuk kelas baru.

### 5.6 Pembatalan dan Batas 3 Jam

-   Pembatalan **lebih dari 3 jam sebelum kelas mulai:** sesi tidak
    hangus dan slot kelas dilepas.
-   Pembatalan **tepat 3 jam atau kurang sebelum kelas mulai:** satu
    sesi hangus dan slot kelas dilepas.
-   Sesi yang hangus tidak boleh dipotong dua kali.
-   Sistem menyimpan waktu pembatalan, aturan yang diterapkan, dan
    perubahan kuota dalam riwayat.
-   Jika pembatalan dilakukan setelah sesi sebelumnya terpotong karena
    kehadiran, sistem harus mencegah pemotongan kedua.

### 5.7 Payment dan Booking

-   Status pembayaran tidak otomatis menentukan kehadiran kelas.
-   Status reminder terpisah dari status pembayaran.
-   Riwayat transaksi dan perubahan status harus dipertahankan untuk
    audit sederhana.

## 6. Model Data / Entitas Database

Berikut rancangan entitas konseptual. Nama kolom final dapat disesuaikan
saat implementasi.

### `admins`

-   `id`
-   `username` (unik)
-   `password_hash`
-   `created_at`
-   `updated_at`

### `members`

-   `id`
-   `name`
-   `phone` (opsional)
-   `notes`
-   `status`
-   `created_at`
-   `updated_at`

### `coaches`

-   `id`
-   `name`
-   `active`
-   `notes`
-   `created_at`
-   `updated_at`

### `class_types`

-   `id`
-   `name`
-   `default_capacity` (dapat diubah)
-   `duration_minutes` (opsional)
-   `active`
-   `notes`

### `class_sessions`

Mewakili satu kelas terjadwal pada tanggal dan waktu tertentu. - `id` -
`class_type_id` - `class_date` - `start_time` - `end_time` -
`capacity` - `scheduled_coach_id` - `actual_coach_id` (boleh sama dengan
coach terjadwal) - `coach_changed` (boolean atau diturunkan dari
perbandingan ID) - `coach_change_note` - `admin_notes` - `status` -
`created_at` - `updated_at`

### `packages`

Definisi paket/pricelist. - `id` - `name` - `code` - `session_count` -
`price` - `validity_days` - `description` - `active` - `created_at` -
`updated_at`

### `member_packages`

Satu baris untuk setiap pembelian paket oleh member. - `id` -
`member_id` - `package_id` - `purchase_date` - `sessions_purchased` -
`sessions_remaining` - `activation_date` (kosong sampai pertama kali
digunakan) - `expiry_date` (ditetapkan saat aktivasi) - `status` -
`notes` - `created_at` - `updated_at`

### `bookings`

-   `id`
-   `member_id`
-   `class_session_id`
-   `member_package_id` (paket yang dipilih admin secara manual)
-   `booking_status`
-   `attendance_status`
-   `payment_status`
-   `reminder_status`
-   `reminded_at`
-   `cancelled_at`
-   `cancellation_note`
-   `rescheduled_from_booking_id` (opsional)
-   `admin_notes`
-   `created_at`
-   `updated_at`

### `payments`

-   `id`
-   `member_id`
-   `member_package_id` (opsional, sesuai transaksi)
-   `amount_due`
-   `amount_paid`
-   `payment_status`
-   `payment_method`
-   `paid_at`
-   `reference_note`
-   `created_at`
-   `updated_at`

### `studio_settings`

-   `id`
-   `studio_name`
-   `bank_name`
-   `bank_account_name`
-   `bank_account_number`
-   pengaturan operasional lain yang diperlukan.

### `activity_logs`

-   `id`
-   `admin_id`
-   `entity_type`
-   `entity_id`
-   `action`
-   `before_data` (opsional)
-   `after_data` (opsional)
-   `created_at`

## 7. Relasi Utama

-   Satu member dapat memiliki banyak pembelian paket (`members` →
    `member_packages`).
-   Satu definisi paket dapat dibeli berkali-kali (`packages` →
    `member_packages`).
-   Satu member dapat memiliki banyak booking (`members` → `bookings`).
-   Satu kelas terjadwal dapat memiliki banyak booking hingga kapasitas
    maksimum (`class_sessions` → `bookings`).
-   Satu booking memilih satu paket member (`bookings` →
    `member_packages`).
-   Satu kelas memiliki coach terjadwal dan dapat memiliki coach aktual
    yang berbeda.
-   Satu pembelian paket dapat terkait dengan satu atau lebih catatan
    pembayaran jika pembayaran bertahap diaktifkan.

## 8. Alur Operasional Utama

### Membuat booking

1.  Admin memilih tanggal.
2.  Sistem menampilkan kelas, jam, coach, kapasitas, slot tersisa, dan
    status ketersediaan.
3.  Admin memilih member.
4.  Sistem menampilkan paket milik member yang dapat digunakan.
5.  Admin memilih paket secara manual.
6.  Backend memvalidasi kapasitas, bentrok coach, status kelas, dan
    kelayakan paket.
7.  Booking disimpan dan slot diperbarui.

### Menandai kehadiran

1.  Admin membuka daftar member pada kelas.
2.  Admin menandai member hadir.
3.  Sistem memastikan sesi belum pernah dipotong untuk booking tersebut.
4.  Jika ini penggunaan pertama paket, sistem menetapkan tanggal
    aktivasi dan kedaluwarsa.
5.  Sisa sesi berkurang satu dan perubahan dicatat.

### Membatalkan booking

1.  Admin membatalkan booking.
2.  Sistem menghitung selisih waktu terhadap jadwal kelas.
3.  Jika pembatalan lebih dari 3 jam sebelumnya, sesi tidak hangus.
4.  Jika tepat 3 jam atau kurang, sesi hangus satu kali.
5.  Slot kelas dilepas dan riwayat pembatalan disimpan.

### Reschedule

1.  Admin membuka booking dan memilih tanggal tujuan.
2.  Sistem menampilkan kelas yang memiliki slot, jam, dan coach yang
    tersedia.
3.  Admin memilih slot tujuan.
4.  Backend memvalidasi ulang seluruh aturan.
5.  Booking diperbarui atau riwayat perpindahan dibuat tanpa
    menggandakan penggunaan sesi.

### Mencatat pembayaran

1.  Admin membuka member atau pembelian paket.
2.  Admin memasukkan tagihan, jumlah diterima, status, tanggal, dan
    catatan.
3.  Dashboard menghitung ulang total diterima dan belum lunas.
4.  Status pembayaran dapat dilihat dari profil member dan daftar
    booking terkait.

## 9. Struktur Folder yang Disarankan

``` text
kinara-admin/
├── public/
│   ├── index.html
│   ├── login.html
│   ├── dashboard.html
│   ├── bookings.html
│   ├── schedule.html
│   ├── members.html
│   ├── payments.html
│   ├── pricelist.html
│   ├── notes.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── api.js
│       ├── auth.js
│       ├── dashboard.js
│       ├── bookings.js
│       ├── schedule.js
│       ├── members.js
│       ├── payments.js
│       └── pricelist.js
├── src/
│   ├── server.js
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── middleware/
│   ├── db/
│   │   ├── migrations/
│   │   └── seed.js
│   └── utils/
├── data/
│   └── .gitkeep
├── .env.example
├── .gitignore
├── package.json
└── architecture.md
```

Database asli dan file `.env` tidak boleh dimasukkan ke version control.
Folder `data/` harus memiliki izin akses yang sesuai jika digunakan
untuk database SQLite.

## 10. API Backend Konseptual

Contoh endpoint yang dapat dibuat: - `POST /api/auth/login` -
`POST /api/auth/logout` - `GET /api/dashboard?date=YYYY-MM-DD` -
`GET /api/class-sessions?date=YYYY-MM-DD` - `POST /api/class-sessions` -
`PATCH /api/class-sessions/:id` -
`GET /api/availability?date=YYYY-MM-DD` - `GET /api/members` -
`POST /api/members` - `GET /api/members/:id` - `GET /api/packages` -
`POST /api/member-packages` - `GET /api/bookings?date=YYYY-MM-DD` -
`POST /api/bookings` - `PATCH /api/bookings/:id` -
`POST /api/bookings/:id/cancel` - `POST /api/bookings/:id/reschedule` -
`POST /api/bookings/:id/attendance` -
`PATCH /api/bookings/:id/reminder` - `GET /api/payments` -
`POST /api/payments` - `GET /api/settings` - `PATCH /api/settings`

Seluruh endpoint operasional harus memerlukan autentikasi. Validasi
aturan bisnis dilakukan di backend, bukan hanya di frontend.

## 11. Validasi dan Integritas Data

-   Gunakan transaksi database untuk booking, reschedule, pembatalan,
    dan perubahan sesi.
-   Cegah kapasitas terlampaui meskipun dua tindakan dilakukan hampir
    bersamaan.
-   Cegah bentrok coach di backend.
-   Cegah pengurangan atau penghangusan sesi ganda dengan penanda
    pemakaian sesi per booking atau tabel ledger.
-   Gunakan foreign key dan indeks untuk relasi serta pencarian
    berdasarkan tanggal/member.
-   Simpan timestamp perubahan penting.
-   Gunakan zona waktu `Asia/Jakarta` untuk aturan tanggal dan jam
    studio.
-   Tampilkan pesan kesalahan yang jelas, misalnya kelas penuh, coach
    bentrok, paket kedaluwarsa, atau sesi tidak cukup.

## 12. Catatan Implementasi dan Keputusan yang Masih Terbuka

Keputusan yang sudah ditentukan: - Hanya satu admin yang menggunakan
aplikasi. - Stack frontend adalah HTML, CSS, dan JavaScript. - Database
harus menyimpan data secara permanen. - Jadwal dapat dilihat per
tanggal. - Kapasitas kelas dapat diubah admin. - Coach dapat mengajar
beberapa kelas jika waktunya tidak tumpang tindih. - Pergantian coach
ditandai dan memiliki notes. - Member memiliki status pembayaran dan
reminder kelas. - Member dapat membeli beberapa paket. - Masa berlaku
dimulai saat paket pertama kali digunakan. - Paket untuk setiap booking
dipilih manual oleh admin. - Pembatalan lebih dari 3 jam sebelum kelas
tidak menghanguskan sesi. - Pembatalan tepat 3 jam atau kurang sebelum
kelas menghanguskan satu sesi.

Hal yang perlu dikonfirmasi sebelum implementasi: - Apakah pembayaran
bisa dicicil atau selalu lunas sekaligus. - Apakah satu booking member
selalu memakai satu sesi. - Apakah sesi paket mulai digunakan saat
booking dibuat atau saat kehadiran dikonfirmasi. Rancangan ini
menggunakan saat kehadiran dikonfirmasi. - Apakah kelas memiliki durasi
tetap atau jam selesai selalu diatur per jadwal. - Apakah reminder cukup
dicatat manual atau perlu integrasi WhatsApp. - Apakah aplikasi hanya
berjalan di satu komputer atau harus dapat diakses dari beberapa
perangkat. - Apakah member boleh masuk daftar tunggu ketika kelas penuh.

## 13. Urutan Pengerjaan yang Disarankan

1.  Fondasi backend, database, login admin, dan pengaturan studio.
2.  Master data member, coach, jenis kelas, paket, dan pricelist.
3.  Jadwal per tanggal, kapasitas kelas, dan validasi bentrok coach.
4.  Booking, pembatalan, reschedule, dan pergantian coach.
5.  Paket member, aktivasi masa berlaku, kehadiran, dan ledger sesi.
6.  Payment, rekening studio, dan ringkasan keuangan.
7.  Status reminder, notes, dashboard, dan riwayat perubahan.
8.  Pengujian aturan bisnis, keamanan, tampilan responsif, dan backup
    database.
