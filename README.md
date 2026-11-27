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
- Booking tidak langsung mengurangi sesi; sesi berkurang saat kehadiran dikonfirmasi. Booking aktif akan memesan kuota sesi agar jumlah booking tidak melebihi sesi paket.
- Uji aturan operasional dengan data simulasi sebelum dipakai untuk transaksi sungguhan. Untuk akses dari perangkat lain, aplikasi perlu deployment aman dengan HTTPS dan penyimpanan sesi yang sesuai.
