# Kinara Pilates Admin

Aplikasi admin studio bertema pastel pink/rose dengan HTML, CSS, JavaScript, Node.js + Express, dan SQLite.

## Fitur utama
- Login admin dengan sesi server dan database SQLite permanen.
- Dashboard ringkasan booking, member, pembayaran, dan reminder.
- CRUD member, pembelian paket, jadwal kelas, booking, pembayaran, pricelist, coach, jenis kelas, notes, dan rekening studio.
- Sisa slot kelas dihitung otomatis dari kapasitas dikurangi booking aktif; jumlah slot ditampilkan pada daftar jadwal dan pilihan booking.
- Sistem mencegah booking pada kelas penuh, booking ganda untuk member pada kelas yang sama, dan pemakaian sesi paket melebihi kuota yang tersisa setelah memperhitungkan booking aktif.
- Bentrok coach diperiksa berdasarkan rentang waktu ketika jadwal kelas dibuat atau diedit.
- Sesi paket berkurang satu kali saat kehadiran dikonfirmasi. Paket pertama kali digunakan pada saat kehadiran dan masa berlaku mulai dihitung saat itu.
- Pembatalan lebih dari 3 jam sebelum kelas tidak menghanguskan sesi; pembatalan tepat 3 jam atau kurang menghanguskan satu sesi. Booking yang dibatalkan melepas slot kelas.
- Data booking bisa diedit; sistem akan memvalidasi kapasitas dan kuota sebelum menyimpan.
- Layout responsif untuk desktop dan ponsel.

## Cara menjalankan (Windows / VS Code)
1. Install **Node.js 22 LTS** untuk menghindari masalah kompatibilitas native SQLite pada versi Node yang terlalu baru.
2. Ekstrak ZIP, lalu buka folder `kinara-admin` di VS Code.
3. Buka terminal pada folder tersebut. Salin `.env.example` menjadi `.env`, lalu atur `SESSION_SECRET` dan password admin.
4. Jalankan `npm.cmd install` dari PowerShell (atau `npm install` dari Command Prompt).
5. Jalankan `npm.cmd start` (atau `npm start` dari Command Prompt).
6. Buka `http://localhost:3000`.

## Login dan reset password
Jika database baru dan `.env` belum mengubah kredensial:
- Username: `asya`
- Password: `Kinara123!`

Jika password tidak cocok karena akun sudah pernah dibuat, hentikan server dengan `Ctrl+C`, periksa `.env`, lalu jalankan:

```powershell
npm.cmd run reset-admin
```

Perintah reset memakai `ADMIN_USERNAME` dan `ADMIN_PASSWORD` dari `.env`. Jika variabel password tidak diatur, password kembali ke `Kinara123!`. Jalankan server lagi dengan `npm.cmd start`. Reset ini tidak menghapus data member atau booking.

## Catatan operasional
- Database disimpan di `data/kinara.sqlite`. Jangan hapus file ini kecuali memang ingin menghapus seluruh data lokal. Backup file tersebut secara berkala.
- Booking tidak langsung mengurangi sesi; sesi berkurang saat kehadiran dikonfirmasi. Booking aktif akan memesan kuota sesi agar jumlah booking tidak melebihi sesi paket.
- Uji aturan operasional dengan data simulasi sebelum dipakai untuk transaksi sungguhan. Untuk akses dari perangkat lain, aplikasi perlu deployment aman dengan HTTPS dan penyimpanan sesi yang sesuai.
