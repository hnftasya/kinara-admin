/* ================================================================
   Kinara Pilates Admin — Single Page App
   ================================================================ */

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const app = $('#app');
let currentUser = '';
let activePage  = 'dashboard';
let cache       = {};
let lookup      = {};
let _settings   = {};

/* ────────────────────────── NAV MENU ────────────────────────── */
const menus = [
  ['dashboard',      '📊', 'Dashboard'],
  ['sessions',       '🗓️',  'Jadwal Kelas'],
  ['bookings',       '📋', 'Booking'],
  ['members',        '👥', 'Member'],
  ['memberPackages', '📦', 'Paket Member'],
  ['payments',       '💳', 'Payment'],
  ['packages',       '🏷️',  'Pricelist'],
  ['coaches',        '🧘', 'Coach'],
  ['coachSchedules', '🕒', 'Jadwal Rutin Coach'],
  ['classes',        '📚', 'Jenis Kelas'],
  ['notes',          '📝', 'Notes Admin'],
  ['settings',       '⚙️',  'Pengaturan'],
];

/* ────────────────────────── COLUMN CONFIGS ────────────────────────── */
const configs = {
  sessions: {
    title: 'Jadwal Kelas', desc: 'Kelola jadwal, kapasitas, coach, dan status kelas.',
    endpoint: 'sessions',
    fields: [
      ['class_type_id','Jenis Kelas','select','classes'],
      ['class_date','Tanggal','date'],
      ['start_time','Jam Mulai','time'],
      ['end_time','Jam Selesai','time'],
      ['capacity','Kapasitas','number'],
      ['scheduled_coach_id','Coach Terjadwal','select','coaches'],
      ['actual_coach_id','Coach Aktual','select','coaches'],
      ['coach_change_note','Alasan Ganti Coach','textarea'],
      ['admin_notes','Catatan Admin','textarea'],
      ['status','Status','select-static',['Available','Unavailable']],
    ],
    cols: [['class_date','Tanggal'],['start_time','Jam'],['class_name','Kelas'],['scheduled_coach_name','Coach Terjadwal'],['actual_coach_name','Coach Aktual'],['booked','Terisi'],['slots_remaining','Sisa'],['capacity','Kapasitas'],['computed_status','Status']]
  },
  bookings: {
    title: 'Booking Kelas', desc: 'Kelola booking, kehadiran, reminder, dan pembatalan.',
    endpoint: 'bookings',
    fields: [
      ['member_id','Member','select','members'],
      ['class_session_id','Jadwal Kelas','select','sessions'],
      ['member_package_id','Paket Member','select','memberPackages'],
      ['payment_status','Status Pembayaran','select-static',['Sudah Payment','Belum Payment','Waiting']],
      ['reminder_status','Status Reminder','select-static',['Belum di-reminder','Sudah di-reminder']],
      ['admin_notes','Catatan','textarea'],
    ],
    cols: [['class_date','Tanggal'],['start_time','Jam'],['class_name','Kelas'],['member_name','Member'],['package_name','Paket'],['booking_status','Booking'],['attendance_status','Hadir'],['payment_status','Bayar'],['reminder_status','Reminder']]
  },
  members: {
    title: 'Data Member', desc: 'Kelola profil, kontak, dan status member.',
    endpoint: 'members',
    fields: [
      ['name','Nama Lengkap','text'],
      ['phone','No. HP / WhatsApp','tel'],
      ['email','Instagram','text'],
      ['status','Status','select-static',['Aktif','Nonaktif']],
      ['notes','Catatan','textarea'],
    ],
    cols: [['name','Nama Member'],['phone','HP'],['email','Instagram'],['status','Status']]
  },
  memberPackages: {
    title: 'Paket Member', desc: 'Catat pembelian paket dan pantau sisa sesi.',
    endpoint: 'memberPackages',
    fields: [
      ['member_id','Member','select','members'],
      ['package_id','Paket','select','packages'],
      ['purchase_date','Tanggal Beli','date'],
      ['sessions_purchased','Jumlah Sesi','number'],
      ['sessions_remaining','Sisa Sesi','number'],
      ['activation_date','Tanggal Aktivasi','date'],
      ['expiry_date','Tanggal Kedaluwarsa','date'],
      ['status','Status','select-static',['Belum Aktif','Aktif','Kedaluwarsa','Habis']],
      ['notes','Catatan','textarea'],
    ],
    cols: [['member_name','Member'],['package_name','Paket'],['category','Kategori'],['sessions_purchased','Total'],['sessions_remaining','Sisa'],['purchase_date','Tanggal Beli'],['expiry_date','Exp. Date'],['status','Status']]
  },
  payments: {
    title: 'Payment', desc: 'Rekap pembayaran dan status keuangan.',
    endpoint: 'payments',
    fields: [
      ['member_id','Member','select','members'],
      ['member_package_id','Paket Member','select','memberPackages'],
      ['amount_due','Total Tagihan (Rp)','number'],
      ['amount_paid','Jumlah Dibayar (Rp)','number'],
      ['payment_status','Status','select-static',['Sudah Payment','Belum Payment','Waiting']],
      ['payment_method','Metode','select-static',['Transfer','Cash','QRIS','Lainnya']],
      ['paid_at','Tanggal Bayar','date'],
      ['reference_note','Catatan','textarea'],
    ],
    cols: [['member_name','Member'],['package_name','Paket'],['amount_due','Tagihan'],['amount_paid','Dibayar'],['payment_status','Status'],['payment_method','Metode'],['paid_at','Tanggal']]
  },
  packages: {
    title: 'Pricelist Paket', desc: 'Kelola paket Regular, Promo, dan Payday.',
    endpoint: 'packages',
    fields: [
      ['name','Nama Paket','text'],
      ['code','Kode','text'],
      ['category','Kategori','select-static',['regular|Regular','promo|Promo 🎁','payday|Payday 💰']],
      ['session_count','Jumlah Sesi','number'],
      ['price','Harga (Rp)','number'],
      ['validity_days','Masa Berlaku (hari)','number'],
      ['description','Deskripsi','textarea'],
      ['active','Status','select-static',['1|Aktif','0|Nonaktif']],
    ],
    cols: [['name','Nama Paket'],['code','Kode'],['category','Kategori'],['session_count','Sesi'],['price','Harga'],['validity_days','Berlaku'],['active','Status']]
  },
  coaches: {
    title: 'Data Coach', desc: 'Kelola coach studio.',
    endpoint: 'coaches',
    fields: [
      ['name','Nama Coach','text'],
      ['phone','No. HP','tel'],
      ['active','Status','select-static',['1|Aktif','0|Nonaktif']],
      ['notes','Catatan','textarea'],
    ],
    cols: [['name','Nama Coach'],['phone','HP'],['active','Status']]
  },
  classes: {
    title: 'Jenis Kelas', desc: 'Kelola jenis kelas dan kapasitas default.',
    endpoint: 'classes',
    fields: [
      ['name','Nama Kelas','text'],
      ['default_capacity','Kapasitas Default','number'],
      ['duration_minutes','Durasi (menit)','number'],
      ['active','Status','select-static',['1|Aktif','0|Nonaktif']],
      ['notes','Catatan','textarea'],
    ],
    cols: [['name','Jenis Kelas'],['default_capacity','Kapasitas'],['duration_minutes','Durasi (mnt)'],['active','Status']]
  },
  coachSchedules: {
  title: 'Jadwal Rutin Coach',
  desc: 'Atur jadwal mingguan coach. Jadwal kelas akan dibuat otomatis.',
  endpoint: 'coach-schedules',
  fields: [
    ['coach_id', 'Nama Coach', 'select', 'coaches'],
    ['class_type_id', 'Jenis Kelas', 'select', 'classes'],
    ['day_of_week', 'Hari', 'select-static', [
      '0|Minggu',
      '1|Senin',
      '2|Selasa',
      '3|Rabu',
      '4|Kamis',
      '5|Jumat',
      '6|Sabtu'
    ]],
    ['start_time', 'Jam Mulai', 'time'],
    ['end_time', 'Jam Selesai', 'time'],
    ['capacity', 'Kapasitas', 'number'],
    ['active', 'Status', 'select-static', ['1|Aktif', '0|Nonaktif']],
    ['notes', 'Catatan', 'textarea'],
  ],
  cols: [
    ['coach_id', 'Coach'],
    ['class_type_id', 'Jenis Kelas'],
    ['day_of_week', 'Hari'],
    ['start_time', 'Mulai'],
    ['end_time', 'Selesai'],
    ['capacity', 'Kapasitas'],
    ['active', 'Status']
  ]
},
  notes: {
    title: 'Notes Admin', desc: 'Catatan operasional pribadi admin.',
    endpoint: 'notes',
    fields: [
      ['title','Judul','text'],
      ['body','Isi Catatan','textarea'],
      ['related_to','Kategori','select-static',['Umum','Member','Booking','Jadwal','Coach','Payment']],
    ],
    cols: [['title','Judul'],['body','Catatan'],['related_to','Kategori'],['created_at','Dibuat']]
  }
};

/* ─────────────────────────── UTILITIES ─────────────────────────── */
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function money(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function today()  { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()); }
function addDays(d, n) {
  const dt = new Date(d + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function prettyDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function prettyDateTime(d) {
  if (!d) return '—';
  return new Date(d.replace(' ','T')).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function longDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

async function api(url, opts = {}) {
  const r    = await fetch('/api' + url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, credentials: 'same-origin' });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/auth/login') { renderLogin(); throw Error('Silakan login kembali.'); }
  if (!r.ok) throw Error(data.error || 'Terjadi kesalahan.');
  return data;
}

function toast(msg, type = 'ok') {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ─────────────────────────── BADGE HELPERS ─────────────────────────── */
function badge(v) {
  let cls = 'pink';
  if (['Sudah Payment','Aktif','Hadir','Available','Selesai','Sudah di-reminder'].includes(v)) cls = 'green';
  if (['Belum Payment','Dibatalkan','Nonaktif','Unavailable','Full','Kedaluwarsa','Habis'].includes(v)) cls = 'red';
  if (['Waiting','Belum Aktif','Belum di-reminder','Belum Hadir'].includes(v)) cls = 'amber';
  if (['Waitlist'].includes(v)) cls = 'blue';
  return `<span class="badge ${cls}">${esc(v)}</span>`;
}
function catBadge(cat) {
  if (!cat) return '';
  const map = { regular: ['blue','Regular'], promo: ['pink','Promo 🎁'], payday: ['amber','Payday 💰'] };
  const [cls, label] = map[cat] || ['',''];
  return `<span class="badge ${cls}">${label}</span>`;
}

/* ─────────────────────────── BOOT ─────────────────────────── */
async function boot() {
  try {
    const me = await api('/auth/me');
    if (me.authenticated) { currentUser = me.username; await renderShell(); }
    else renderLogin();
  } catch (e) { renderLogin(); }
}

/* ─────────────────────────── LOGIN ─────────────────────────── */
function renderLogin() {
  app.innerHTML = `
    <div class="login-wrap">
      <section class="login-art">
        <div class="brand-script">Kinara<br>Pilates.</div>
        <p>Move with intention.<br>Manage your studio with ease.</p>
        <div style="margin-top:30px;color:#a45e78;font-size:12px;letter-spacing:2px">♡ &nbsp; YOUR SPACE TO GROW &nbsp; ♡</div>
      </section>
      <section class="login-card">
        <div class="brand" style="padding:0 0 22px">
          <div class="brand-mark">♡</div>
          <div>
            <div class="brand-name">Kinara Pilates</div>
            <div class="brand-caption">Studio Admin</div>
          </div>
        </div>
        <h2>Welcome back!</h2>
        <p class="sub">Masuk untuk mengelola aktivitas studio.</p>
        <form id="login-form">
          <div class="field">
            <label>USERNAME</label>
            <input name="username" autocomplete="username" placeholder="Masukkan username" required>
          </div>
          <div class="field">
            <label>PASSWORD</label>
            <input name="password" type="password" autocomplete="current-password" placeholder="Masukkan password" required>
          </div>
          <button class="btn btn-primary" style="width:100%;margin-top:5px" id="login-btn">Masuk ke Dashboard →</button>
          <p id="login-error" style="color:#d34b64;font-size:12px;margin-top:10px"></p>
        </form>
      </section>
    </div>`;
  $('#login-form').onsubmit = async e => {
    e.preventDefault();
    const btn = $('#login-btn');
    btn.disabled = true; btn.textContent = 'Memproses…';
    const fd = new FormData(e.target);
    try {
      const d = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }) });
      currentUser = d.username;
      await renderShell();
    } catch (err) {
      $('#login-error').textContent = err.message;
      btn.disabled = false; btn.textContent = 'Masuk ke Dashboard →';
    }
  };
}

/* ─────────────────────────── APP SHELL ─────────────────────────── */
async function renderShell() {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <div class="brand-mark">♡</div>
          <div>
            <div class="brand-name">Kinara Pilates</div>
            <div class="brand-caption">Studio admin</div>
          </div>
        </div>
        <div class="nav-label">MENU UTAMA</div>
        <nav class="nav-list">
          ${menus.map(([id, icon, label]) => `
            <button class="nav-item ${activePage === id ? 'active' : ''}" data-page="${id}">
              <span class="nav-icon">${icon}</span>${label}
            </button>`).join('')}
        </nav>
        <div class="sidebar-bottom">
          <div class="admin-row">
            <div class="avatar">${esc((currentUser || 'A').slice(0, 1).toUpperCase())}</div>
            <div>
              <div class="admin-name">${esc(currentUser)}</div>
              <div class="admin-role">Studio Administrator</div>
            </div>
          </div>
          <button class="logout" id="logout">↪ &nbsp; Keluar dari akun</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="topbar-left">
            <button class="mobile-menu" id="mobile-menu">☰</button>
            <div>
              <div class="eyebrow">KINARA PILATES</div>
              <h1 id="top-title">Dashboard</h1>
            </div>
          </div>
          <div class="topbar-right">
            <div class="today-pill" id="header-date">♡ &nbsp; ${new Date().toLocaleDateString('id-ID',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}</div>
            <div class="avatar">${esc((currentUser || 'A').slice(0, 1).toUpperCase())}</div>
          </div>
        </header>
        <section class="content" id="content"></section>
      </main>
    </div>
    <div id="toast" class="toast"></div>`;

  $$('[data-page]').forEach(b => b.onclick = () => go(b.dataset.page));
  $('#logout').onclick = async () => { await api('/auth/logout', { method: 'POST' }); currentUser = ''; renderLogin(); };
  $('#mobile-menu').onclick = () => $('#sidebar').classList.toggle('open');
  document.addEventListener('click', e => {
    if (window.innerWidth <= 760 && $('#sidebar')?.classList.contains('open') && !e.target.closest('.sidebar') && !e.target.closest('.mobile-menu')) {
      $('#sidebar').classList.remove('open');
    }
  });
  await renderPage();
}

async function go(page) {
  activePage = page;
  $$('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('#sidebar')?.classList.remove('open');
  const title = menus.find(m => m[0] === page)?.[2] || '';
  if ($('#top-title')) $('#top-title').textContent = title;
  await renderPage();
}

async function loadLookup() {
  lookup = await api('/lookup');
}

async function renderPage() {
  const c = $('#content');
  if (!c) return;
  try {
    if (activePage === 'dashboard') { await renderDashboard(c); return; }
    if (activePage === 'settings')  { await renderSettings(c);  return; }
    await loadLookup();
    if (activePage === 'bookings')  { await renderBookingsPage(c); return; }
    if (activePage === 'sessions')  { await renderSessionsPage(c); return; }
    if (activePage === 'coachSchedules') {
  await renderCoachSchedulesPage(c);
  return;
}
    await renderTablePage(c, configs[activePage]);
  } catch (e) {
    c.innerHTML = `<div class="panel panel-pad"><p style="color:#c43f56">${esc(e.message)}</p><button class="btn btn-soft" onclick="renderPage()">Coba lagi</button></div>`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════ */
async function renderDashboard(c, selectedDate = today()) {
  const [d, notes] = await Promise.all([
    api('/dashboard?date=' + encodeURIComponent(selectedDate)),
    api('/notes')
  ]);
  const rp       = await api('/payments');
  const received = rp
  .filter(x =>
    x.payment_status === 'Sudah Payment' &&
    String(x.paid_at || '').slice(0, 10) === selectedDate
  )
  .reduce((s, x) => s + Number(x.amount_paid || 0), 0);
  const due      = rp.filter(x => x.payment_status === 'Belum Payment').reduce((s, x) => s + Math.max(0, Number(x.amount_due || 0) - Number(x.amount_paid || 0)), 0);
  const waiting  = rp.filter(x => x.payment_status === 'Waiting').length;

  c.innerHTML = `
    <div class="welcome-banner">
      <h2>Haii, ${esc(currentUser)}! ♡</h2>
      <p>Selamat datang di panel admin Kinara Pilates.</p>
    </div>

    <div class="toolbar" style="justify-content:space-between; margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn btn-soft btn-sm" id="dash-prev">◀ Kemarin</button>
        <strong id="dash-date-label">${longDate(selectedDate)}</strong>
        <button class="btn btn-soft btn-sm" id="dash-next">Besok ▶</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="date" id="dash-date" value="${selectedDate}" style="padding:7px 11px;border:1px solid #f3d4df;border-radius:11px;background:#fffafd;color:#392b31;outline:none">
        <button class="btn btn-soft btn-sm" id="dash-today">Hari Ini</button>
      </div>
    </div>

    <!-- Alerts -->
    <div id="dash-alerts">
      ${d.expiringPkgs?.length ? `<div class="notice" style="margin-bottom:10px"><span class="notice-icon">⚠️</span><div><strong>${d.expiringPkgs.length} paket hampir kadaluwarsa (7 hari)</strong><p>${d.expiringPkgs.map(p => `${esc(p.member_name)} — ${esc(p.package_name)} (exp: ${prettyDate(p.expiry_date)})`).join(', ')}</p></div></div>` : ''}
      ${d.coachChanges?.length ? `<div class="notice" style="margin-bottom:10px;border-color:#fde68a;background:#fffdf0"><span class="notice-icon">🔄</span><div><strong>${d.coachChanges.length} pergantian coach hari ini</strong><p>${d.coachChanges.map(s => `${esc(s.class_name)} ${s.start_time}: ${esc(s.scheduled_coach_name||'?')} → ${esc(s.actual_coach_name||'?')}`).join(', ')}</p></div></div>` : ''}
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-top">Booking Hari Ini <span class="stat-icon">📋</span></div><div class="stat-value">${d.bookingCount}</div><div class="stat-foot">Booking aktif tanggal ini</div></div>
      <div class="stat-card"><div class="stat-top">Member Aktif <span class="stat-icon">👥</span></div><div class="stat-value">${d.memberCount}</div><div class="stat-foot">Total member aktif</div></div>
      <div class="stat-card"><div class="stat-top">Payment Diterima <span class="stat-icon">💰</span></div><div class="stat-value" style="font-size:19px">${money(received)}</div><div class="stat-foot">Sudah dikonfirmasi</div></div>
      <div class="stat-card"><div class="stat-top">Belum Lunas <span class="stat-icon">📌</span></div><div class="stat-value" style="font-size:19px">${money(due)}</div><div class="stat-foot">${waiting} transaksi waiting</div></div>
    </div>

    <div class="two-col">
      <div>
        <div class="section-head">
          <div><h2>Jadwal Kelas</h2><p>${longDate(selectedDate)}</p></div>
          <button class="btn btn-soft btn-sm" id="all-sessions">Lihat semua →</button>
        </div>
        <div class="panel panel-pad">
          <div class="schedule-list">
            ${d.sessions.length ? d.sessions.map(s => `
              <div class="schedule-item">
                <div class="schedule-time">${s.start_time}<div class="schedule-sub">${s.end_time}</div></div>
                <div>
                  <div class="schedule-title">${esc(s.class_name||'Kelas')} ${s.coach_changed ? '<span class="badge amber">🔄 Coach Diganti</span>' : ''}</div>
                  <div class="schedule-sub">Coach: ${esc(s.actual_coach_name||s.scheduled_coach_name||'—')} · ${s.booked}/${s.capacity} peserta${s.waitlisted ? ' · '+s.waitlisted+' waitlist' : ''}</div>
                  <div class="slot-track"><div class="slot-fill" style="width:${Math.min(100, s.booked/Math.max(1,s.capacity)*100)}%"></div></div>
                </div>
                <span class="badge ${s.booked>=s.capacity?'red':'green'}">${s.booked>=s.capacity?'Full':s.computed_status}</span>
              </div>`).join('') : '<div class="empty">Tidak ada jadwal kelas pada tanggal ini.</div>'}
          </div>
        </div>
      </div>
      <div>
        <div class="section-head"><div><h2>Perlu Diperhatikan</h2><p>Pengingat operasional</p></div></div>
        <div class="panel panel-pad">
          <div class="notice-list">
            <div class="notice"><span class="notice-icon">🔔</span><div><strong>${d.reminders} reminder belum dilakukan</strong><p>Periksa booking aktif dan tandai reminder setelah menghubungi member.</p></div></div>
            <div class="notice"><span class="notice-icon">💳</span><div><strong>${waiting} payment waiting konfirmasi</strong><p>Konfirmasi dahulu sebelum mencatat sebagai uang diterima.</p></div></div>
            ${d.expiringPkgs?.length ? `<div class="notice"><span class="notice-icon">📦</span><div><strong>${d.expiringPkgs.length} paket hampir kadaluwarsa</strong><p>Ingatkan member untuk segera menggunakan sesi.</p></div></div>` : ''}
          </div>
        </div>

        <div class="section-head" style="margin-top:18px"><div><h2>Notes Terbaru</h2></div><button class="btn btn-soft btn-sm" id="manage-notes">Kelola →</button></div>
        <div class="panel panel-pad">
          <div class="notice-list">
            ${notes.length ? [...notes].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,4).map(n=>`
              <div class="notice"><span class="notice-icon">📝</span><div><strong>${esc(n.title)}</strong><p style="white-space:pre-wrap">${esc(n.body)}</p></div></div>`).join('')
            : '<div class="empty">Belum ada notes.</div>'}
          </div>
        </div>
      </div>
    </div>
    <div class="footer-note">Made with ♡ for Kinara Pilates</div>`;

  /* Date navigation */
  $('#dash-date').addEventListener('change', e => updateDashDate(e.target.value));
  $('#dash-prev').onclick  = () => updateDashDate(addDays(selectedDate, -1));
  $('#dash-next').onclick  = () => updateDashDate(addDays(selectedDate,  +1));
  $('#dash-today').onclick = () => updateDashDate(today());
  $('#all-sessions').onclick  = () => go('sessions');
  $('#manage-notes').onclick  = () => go('notes');

  function updateDashDate(d) {
    const dateInput = $('#dash-date');
    if (dateInput) dateInput.value = d;
    renderDashboard(c, d);
    const label = new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    $('#header-date').textContent = '♡  ' + label;
  }
}

/* ─────────── JADWAL RUTIN COACH (MULTI INPUT) ─────────── */

async function renderCoachSchedulesPage(c) {
  const schedules = await api('/coach-schedules');

  const dayNames = [
    'Minggu', 'Senin', 'Selasa', 'Rabu',
    'Kamis', 'Jumat', 'Sabtu'
  ];

  const coachOptions = (lookup.coaches || [])
    .map(x => `<option value="${x.id}">${esc(x.name)}</option>`)
    .join('');

  const classOptions = (lookup.classes || [])
    .map(x => `<option value="${x.id}" data-cap="${x.default_capacity || 7}">
      ${esc(x.name)}
    </option>`)
    .join('');

  c.innerHTML = `
    <div class="page-intro">
      <h2>Jadwal Rutin Coach</h2>
      <p>Pilih coach satu kali, lalu masukkan semua jadwal mengajarnya.</p>
    </div>

    <div class="panel panel-pad">
      <form id="coach-schedule-form">

        <div class="field" style="max-width:400px;margin-bottom:20px">
          <label>NAMA COACH *</label>
          <select name="coach_id" required>
            <option value="">Pilih Coach...</option>
            ${coachOptions}
          </select>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
          <h3 style="margin:0;color:#713149">Daftar Jadwal Mengajar</h3>
          <button type="button" class="btn btn-soft btn-sm" id="add-coach-schedule">
            ＋ Tambah Jadwal
          </button>
        </div>

        <div id="coach-schedule-rows"></div>

        <p class="helper" style="margin:12px 0">
          Setiap rentang waktu akan otomatis dibagi menjadi sesi berdurasi 1 jam.
        </p>

        <p id="coach-schedule-error" style="color:#c43f56"></p>

        <button type="submit" class="btn btn-primary" id="save-coach-schedules">
          Simpan Semua Jadwal ♡
        </button>
      </form>
    </div>

    <div class="page-intro" style="margin-top:28px">
      <h2>Jadwal yang Sudah Tersimpan</h2>
      <p>Daftar jadwal rutin seluruh coach.</p>
    </div>

    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Coach</th>
              <th>Jenis Kelas</th>
              <th>Hari</th>
              <th>Jam</th>
              <th>Kapasitas</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${
              schedules.length
                ? schedules.map(s => `
                  <tr>
                    <td><span class="td-main">${esc(s.coach_name)}</span></td>
                    <td>${esc(s.class_name)}</td>
                    <td>${dayNames[Number(s.day_of_week)]}</td>
                    <td>${esc(s.start_time)}–${esc(s.end_time)}</td>
                    <td>${s.capacity}</td>
                    <td>${badge(Number(s.active) ? 'Aktif' : 'Nonaktif')}</td>
                    <td>
                      <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        data-delete-schedule="${s.id}">
                        Hapus
                      </button>
                    </td>
                  </tr>
                `).join('')
                : '<tr><td colspan="7" class="empty">Belum ada jadwal rutin.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  const rowsContainer = c.querySelector('#coach-schedule-rows');

  function addScheduleRow() {
    const row = document.createElement('div');
    row.className = 'panel-pad';
    row.style.cssText =
      'border:1px solid #f3d4df;border-radius:14px;margin-bottom:12px;background:#fffafd';

    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <strong style="color:#713149">Jadwal Baru</strong>
        <button type="button" class="btn btn-danger btn-sm remove-schedule">
          Hapus Baris
        </button>
      </div>

      <div class="form-grid">

        <div class="field">
          <label>JENIS KELAS *</label>
          <select name="class_type_id" required>
            <option value="">Pilih kelas...</option>
            ${classOptions}
          </select>
        </div>

        <div class="field">
          <label>HARI *</label>
          <select name="day_of_week" required>
            <option value="">Pilih hari...</option>
            ${dayNames.map((day, i) =>
              `<option value="${i}">${day}</option>`
            ).join('')}
          </select>
        </div>

        <div class="field">
          <label>JAM MULAI *</label>
          <input name="start_time" type="time" required>
        </div>

        <div class="field">
          <label>JAM SELESAI *</label>
          <input name="end_time" type="time" required>
        </div>

        <div class="field">
          <label>KAPASITAS *</label>
          <input name="capacity" type="number" min="1" value="7" required>
        </div>

        <div class="field">
          <label>CATATAN</label>
          <input name="notes" type="text" placeholder="Opsional">
        </div>

      </div>
    `;

    row.querySelector('.remove-schedule').onclick = () => row.remove();

    const classSelect = row.querySelector('[name="class_type_id"]');
    classSelect.addEventListener('change', () => {
      const selected = classSelect.options[classSelect.selectedIndex];
      const capacity = selected.dataset.cap;

      if (capacity) {
        row.querySelector('[name="capacity"]').value = capacity;
      }
    });

    rowsContainer.appendChild(row);
  }

  // Baris pertama otomatis tersedia
  addScheduleRow();

  c.querySelector('#add-coach-schedule').onclick = addScheduleRow;

  // Simpan semua jadwal sekaligus
  c.querySelector('#coach-schedule-form').onsubmit = async e => {
    e.preventDefault();

    const form = e.target;
    const errorEl = c.querySelector('#coach-schedule-error');
    const saveButton = c.querySelector('#save-coach-schedules');

    errorEl.textContent = '';

    const coachId = Number(form.querySelector('[name="coach_id"]').value);

    const scheduleRows = [...rowsContainer.children];

    const data = scheduleRows.map(row => ({
      class_type_id: Number(row.querySelector('[name="class_type_id"]').value),
      day_of_week: Number(row.querySelector('[name="day_of_week"]').value),
      start_time: row.querySelector('[name="start_time"]').value,
      end_time: row.querySelector('[name="end_time"]').value,
      capacity: Number(row.querySelector('[name="capacity"]').value),
      active: 1,
      notes: row.querySelector('[name="notes"]').value.trim()
    }));

    if (!coachId) {
      errorEl.textContent = 'Pilih nama coach terlebih dahulu.';
      return;
    }

    if (data.some(x =>
      !x.class_type_id ||
      !x.start_time ||
      !x.end_time ||
      !Number.isInteger(x.capacity) ||
      x.capacity < 1
    )) {
      errorEl.textContent = 'Lengkapi semua data jadwal terlebih dahulu.';
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Menyimpan...';

    try {
      const result = await api('/coach-schedules/bulk', {
        method: 'POST',
        body: JSON.stringify({
          coach_id: coachId,
          schedules: data
        })
      });

      toast(`${result.count} jadwal berhasil disimpan ♡`);
      await renderCoachSchedulesPage(c);

    } catch (err) {
      errorEl.textContent = err.message;
      saveButton.disabled = false;
      saveButton.textContent = 'Simpan Semua Jadwal ♡';
    }
  };

  // Hapus jadwal yang sudah tersimpan
  c.querySelectorAll('[data-delete-schedule]').forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.deleteSchedule;

      if (!confirm('Yakin ingin menghapus jadwal rutin ini?')) return;

      try {
        await api('/coach-schedules/' + id, {
          method: 'DELETE'
        });

        toast('Jadwal rutin berhasil dihapus.');
        await renderCoachSchedulesPage(c);

      } catch (err) {
        toast(err.message, 'err');
      }
    };
  });
}

/* ═══════════════════════════════════════════════════════════════
   SESSIONS PAGE (enhanced with detail panel + coach change)
═══════════════════════════════════════════════════════════════ */
async function renderSessionsPage(c) {
  let sessionDate = today();
  const cfg = configs.sessions;

  async function draw() {
    const [sessions, coaches, classTypes] = await Promise.all([
      api('/sessions-by-date?date=' + sessionDate),
      api('/coaches'),
      api('/classes'),
    ]);

    const dateLabel = longDate(sessionDate);
    c.innerHTML = `
      <div class="page-intro"><h2>${cfg.title}</h2><p>${cfg.desc}</p></div>
      <div class="toolbar" style="margin-bottom:16px">
        <button class="btn btn-soft btn-sm" id="s-prev">◀</button>
        <input type="date" id="s-date" value="${sessionDate}" style="padding:7px 11px;border:1px solid #f3d4df;border-radius:11px;background:#fffafd;color:#392b31">
        <button class="btn btn-soft btn-sm" id="s-next">▶</button>
        <strong>${dateLabel}</strong>
        <button class="btn btn-soft btn-sm" id="s-today">Hari Ini</button>
        <span style="flex:1"></span>
      </div>

      <div id="sessions-grid" style="display:grid;gap:12px">
        ${sessions.length ? sessions.map(s => renderSessionCard(s, coaches)).join('') : '<div class="panel panel-pad empty">Tidak ada jadwal kelas pada tanggal ini.</div>'}
      </div>
      <div class="footer-note">Klik sesi untuk melihat daftar peserta dan aksi.</div>`;

    /* date navigation */
    $('#s-date').onchange = e => { sessionDate = e.target.value; draw(); };
    $('#s-prev').onclick  = () => { sessionDate = addDays(sessionDate, -1); draw(); };
    $('#s-next').onclick  = () => { sessionDate = addDays(sessionDate,  +1); draw(); };
    $('#s-today').onclick = () => { sessionDate = today(); draw(); };

    /* session card clicks */
    $$('.session-card-btn').forEach(btn => {
      const id = btn.dataset.id;
      btn.onclick = () => openSessionDetail(id, coaches, classTypes, draw);
    });
    $$('.session-edit-btn').forEach(btn => {
      const id = btn.dataset.id;
      btn.onclick = e => { e.stopPropagation(); openSessionModal(sessions.find(s=>s.id==id), coaches, classTypes, sessionDate, draw); };
    });
  }
  await draw();
}

function renderSessionCard(s, coaches=[]) {
  const fill    = s.booked / Math.max(1, s.capacity);
  const fillPct = Math.min(100, fill * 100);
  const isCoachChanged = s.coach_changed && s.actual_coach_id && s.actual_coach_id !== s.scheduled_coach_id;
  return `
    <div class="panel" style="cursor:pointer" >
      <div class="panel-pad session-card-btn" data-id="${s.id}" style="display:grid;grid-template-columns:80px 1fr auto;gap:14px;align-items:center">
        <div class="schedule-time" style="text-align:center">
          <div style="font-size:18px;font-weight:700;color:#9b4967">${s.start_time}</div>
          <div class="schedule-sub">– ${s.end_time}</div>
        </div>
        <div>
          <div class="schedule-title">${esc(s.class_name||'Kelas')} ${isCoachChanged ? '<span class="badge amber">🔄 Coach Diganti</span>' : ''}</div>
          <div class="schedule-sub" style="margin-top:4px">Coach: <strong>${esc(s.coach_name||'Belum ditentukan')}</strong></div>
          <div style="margin-top:8px">
            <div class="slot-track" style="max-width:200px"><div class="slot-fill" style="width:${fillPct}%"></div></div>
            <div class="schedule-sub" style="margin-top:4px">${s.booked}/${s.capacity} peserta${s.waitlisted ? ` · ${s.waitlisted} waitlist` : ''}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <span class="badge ${s.booked>=s.capacity?'red':s.status==='Unavailable'?'red':'green'}">${s.booked>=s.capacity?'Full':s.status}</span>
          <button class="btn btn-soft btn-sm session-edit-btn" data-id="${s.id}">✏️ Edit</button>
        </div>
      </div>
    </div>`;
}

async function openSessionDetail(sessionId, coaches, classTypes, redraw) {
  const bookings = await api('/session-bookings/' + sessionId);
  const sess = (await api('/sessions-by-date?date=' + (bookings[0]?.class_date || today()))).find(s => s.id == sessionId)
    || (await api('/sessions')).find(s => s.id == sessionId);

  const html = `
    <div class="modal-backdrop" id="sess-detail-modal">
      <div class="modal" style="max-width:700px">
        <div class="modal-head">
          <h3>${esc(sess?.class_name||'Sesi')} — ${prettyDate(sess?.class_date)} ${sess?.start_time||''}</h3>
          <button class="modal-close" id="close-sess-detail">×</button>
        </div>
        <div class="modal-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin-bottom:16px;font-size:13px">
            <div><span class="muted">Jam:</span> ${sess?.start_time||'—'} – ${sess?.end_time||'—'}</div>
            <div><span class="muted">Kapasitas:</span> ${sess?.capacity||'—'}</div>
            <div><span class="muted">Coach Terjadwal:</span> ${esc(sess?.scheduled_coach_name||'—')}</div>
            <div><span class="muted">Coach Aktual:</span> ${esc(sess?.actual_coach_name||sess?.scheduled_coach_name||'—')}</div>
            <div><span class="muted">Terisi:</span> ${sess?.booked||0} / ${sess?.capacity||0}</div>
            <div><span class="muted">Waitlist:</span> ${sess?.waitlisted||0}</div>
          </div>
          ${sess?.coach_change_note ? `<div class="notice" style="margin-bottom:12px"><span class="notice-icon">🔄</span><div><strong>Alasan Ganti Coach:</strong> ${esc(sess.coach_change_note)}</div></div>` : ''}
          <h4 style="margin:0 0 8px;color:#713149">Daftar Peserta (${bookings.filter(b=>b.booking_status==='Aktif').length}/${sess?.capacity||0})</h4>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Member</th><th>Paket</th><th>Booking</th><th>Hadir</th><th>Bayar</th><th>Reminder</th><th>Aksi</th></tr></thead>
              <tbody>
                ${bookings.length ? bookings.map(b => `
                  <tr>
                    <td><span class="td-main">${esc(b.member_name)}</span>${b.member_phone ? `<br><span class="muted">${esc(b.member_phone)}</span>` : ''}</td>
                    <td class="muted" style="font-size:11px">${esc(b.package_name||'—')} ${catBadge(b.package_category)}</td>
                    <td>${badge(b.booking_status)}${b.waitlist_position ? `<br><span class="muted" style="font-size:11px">#${b.waitlist_position}</span>` : ''}</td>
                    <td>${badge(b.attendance_status)}</td>
                    <td>${badge(b.payment_status)}</td>
                    <td>${badge(b.reminder_status)}</td>
                    <td>
                      <div class="row-actions" style="flex-wrap:wrap;gap:4px">
                        ${b.booking_status === 'Aktif' && b.attendance_status !== 'Hadir' ? `<button class="btn btn-soft btn-sm" data-action="attend" data-bid="${b.id}">✓ Hadir</button>` : ''}
                        ${b.booking_status === 'Aktif' && b.reminder_status !== 'Sudah di-reminder' ? `<button class="btn btn-soft btn-sm" data-action="remind" data-bid="${b.id}">📢 Reminder</button>` : ''}
                        ${b.booking_status === 'Aktif' ? `<button class="btn btn-danger btn-sm" data-action="cancel" data-bid="${b.id}">✗ Batal</button>` : ''}
                      </div>
                    </td>
                  </tr>`).join('') : '<tr><td colspan="7" class="empty">Belum ada booking untuk sesi ini.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  const modal = document.getElementById('sess-detail-modal');
  document.getElementById('close-sess-detail').onclick = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };

  /* action buttons */
  modal.querySelectorAll('[data-action]').forEach(btn => {
    btn.onclick = async () => {
      const bid = btn.dataset.bid;
      try {
        if (btn.dataset.action === 'attend') {
          if (!confirm('Tandai member sudah hadir? Sesi paket akan dikurangi.')) return;
          await api('/bookings/' + bid, { method: 'PATCH', body: JSON.stringify({ attendance_status: 'Hadir' }) });
          toast('Member ditandai hadir ✓');
        } else if (btn.dataset.action === 'remind') {
          await api('/bookings/' + bid, { method: 'PATCH', body: JSON.stringify({ reminder_status: 'Sudah di-reminder' }) });
          toast('Reminder tercatat ✓');
        } else if (btn.dataset.action === 'cancel') {
          const note = prompt('Alasan pembatalan (opsional):') ?? '';
          if (!confirm('Batalkan booking ini? Periksa aturan 3 jam.')) return;
          await api('/bookings/' + bid + '/cancel', { method: 'POST', body: JSON.stringify({ note }) });
          toast('Booking dibatalkan');
        }
        modal.remove();
        await redraw();
      } catch (e) { toast(e.message, 'err'); }
    };
  });
}

function openSessionModal(row, coaches, classTypes, defaultDate, redraw) {
  const isEdit = !!row;
  const html = `
    <div class="modal-backdrop" id="sess-modal">
      <div class="modal">
        <div class="modal-head">
          <h3>${isEdit ? 'Edit Sesi Kelas' : 'Tambah Sesi Kelas'}</h3>
          <button class="modal-close" id="close-sess-modal">×</button>
        </div>
        <div class="modal-body">
          <form class="form-grid" id="sess-form">
            <div class="field">
              <label>JENIS KELAS *</label>
              <select name="class_type_id" required>
                <option value="">Pilih kelas…</option>
                ${classTypes.filter(ct=>ct.active).map(ct=>`<option value="${ct.id}" ${row?.class_type_id==ct.id?'selected':''} data-cap="${ct.default_capacity}">${esc(ct.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>TANGGAL *</label>
              <input name="class_date" type="date" value="${row?.class_date||defaultDate}" required>
            </div>
            <div class="field">
              <label>JAM MULAI *</label>
              <input name="start_time" type="time" value="${row?.start_time||''}" required>
            </div>
            <div class="field">
              <label>JAM SELESAI *</label>
              <input name="end_time" type="time" value="${row?.end_time||''}" required>
            </div>
            <div class="field">
              <label>KAPASITAS</label>
              <input name="capacity" type="number" min="1" value="${row?.capacity||7}">
            </div>
            <div class="field">
              <label>STATUS</label>
              <select name="status">
                <option ${row?.status==='Available'||!row?'selected':''}>Available</option>
                <option ${row?.status==='Unavailable'?'selected':''}>Unavailable</option>
              </select>
            </div>
            <div class="field">
              <label>COACH TERJADWAL</label>
              <select name="scheduled_coach_id">
                <option value="">Belum ditentukan</option>
                ${coaches.filter(c=>c.active).map(c=>`<option value="${c.id}" ${row?.scheduled_coach_id==c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>COACH AKTUAL</label>
              <select name="actual_coach_id" id="actualCoachSel">
                <option value="">Sama dengan terjadwal</option>
                ${coaches.filter(c=>c.active).map(c=>`<option value="${c.id}" ${row?.actual_coach_id==c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field full" id="change-note-field" style="${row?.coach_changed?'':'display:none'}">
              <label>ALASAN GANTI COACH</label>
              <textarea name="coach_change_note" rows="2">${esc(row?.coach_change_note||'')}</textarea>
            </div>
            <div class="field full">
              <label>CATATAN ADMIN</label>
              <textarea name="admin_notes" rows="2">${esc(row?.admin_notes||'')}</textarea>
            </div>
            <p class="helper full" id="sess-error" style="color:#c43f56"></p>
            <div class="modal-actions full">
              <button type="button" class="btn btn-soft cancel">Batal</button>
              <button type="submit" class="btn btn-primary">Simpan</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  const modal = document.getElementById('sess-modal');
  const closeModal = () => modal.remove();
  document.getElementById('close-sess-modal').onclick = closeModal;
  modal.querySelector('.cancel').onclick = closeModal;
  modal.onclick = e => { if (e.target === modal) closeModal(); };

  /* Auto end_time from start_time + 60 min */
  modal.querySelector('[name="start_time"]').addEventListener('change', function() {
    const [h, m] = this.value.split(':').map(Number);
    const end = `${String(Math.floor((h*60+m+60)/60)%24).padStart(2,'0')}:${String((h*60+m+60)%60).padStart(2,'0')}`;
    modal.querySelector('[name="end_time"]').value = end;
  });

  /* Auto capacity from class type */
  modal.querySelector('[name="class_type_id"]').addEventListener('change', function() {
    const cap = this.options[this.selectedIndex]?.dataset?.cap;
    if (cap && !isEdit) modal.querySelector('[name="capacity"]').value = cap;
  });

  /* Show coach change note */
  modal.querySelector('[name="actual_coach_id"]').addEventListener('change', function() {
    const sched = modal.querySelector('[name="scheduled_coach_id"]').value;
    document.getElementById('change-note-field').style.display = (this.value && this.value !== sched) ? 'flex' : 'none';
  });

  modal.querySelector('#sess-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      class_type_id:     Number(fd.get('class_type_id')) || null,
      class_date:        fd.get('class_date'),
      start_time:        fd.get('start_time'),
      end_time:          fd.get('end_time'),
      capacity:          Number(fd.get('capacity')) || 7,
      scheduled_coach_id: fd.get('scheduled_coach_id') ? Number(fd.get('scheduled_coach_id')) : null,
      actual_coach_id:   fd.get('actual_coach_id') ? Number(fd.get('actual_coach_id')) : null,
      coach_change_note: fd.get('coach_change_note') || '',
      admin_notes:       fd.get('admin_notes') || '',
      status:            fd.get('status'),
    };
    const errEl = document.getElementById('sess-error');
    try {
      if (isEdit) await api('/sessions/' + row.id, { method: 'PATCH', body: JSON.stringify(payload) });
      else        await api('/sessions', { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      toast('Sesi berhasil disimpan ♡');
      await redraw();
    } catch (err) { errEl.textContent = err.message; }
  };
}

/* ═══════════════════════════════════════════════════════════════
   BOOKINGS PAGE (with date filter, cancel, reschedule, attend)
═══════════════════════════════════════════════════════════════ */
async function renderBookingsPage(c) {
  let bkDate   = today();
  let bkStatus = '';
  let bkSearch = '';

  async function draw() {
    const params = new URLSearchParams({ date: bkDate });
    if (bkStatus) params.set('status', bkStatus);
    const rows = await api('/bookings-filtered?' + params.toString());
    const filtered = bkSearch ? rows.filter(r =>
      (r.member_name||'').toLowerCase().includes(bkSearch.toLowerCase()) ||
      (r.class_name||'').toLowerCase().includes(bkSearch.toLowerCase())
    ) : rows;

    c.innerHTML = `
      <div class="page-intro"><h2>Booking Kelas</h2><p>Kelola booking, kehadiran, reminder, dan pembatalan member.</p></div>

      <div class="toolbar" style="margin-bottom:16px">
        <button class="btn btn-soft btn-sm" id="bk-prev">◀</button>
        <input type="date" id="bk-date" value="${bkDate}" style="padding:7px 11px;border:1px solid #f3d4df;border-radius:11px;background:#fffafd;color:#392b31">
        <button class="btn btn-soft btn-sm" id="bk-next">▶</button>
        <button class="btn btn-soft btn-sm" id="bk-today">Hari Ini</button>
        <select id="bk-status" style="padding:7px 11px;border:1px solid #f3d4df;border-radius:11px;background:#fffafd;color:#392b31">
          <option value="">Semua Status</option>
          <option value="Aktif" ${bkStatus==='Aktif'?'selected':''}>Aktif</option>
          <option value="Waitlist" ${bkStatus==='Waitlist'?'selected':''}>Waitlist</option>
          <option value="Selesai" ${bkStatus==='Selesai'?'selected':''}>Selesai</option>
          <option value="Dibatalkan" ${bkStatus==='Dibatalkan'?'selected':''}>Dibatalkan</option>
        </select>
        <input id="bk-search" placeholder="🔍 Cari member / kelas…" value="${esc(bkSearch)}" style="padding:7px 11px;border:1px solid #f3d4df;border-radius:11px;background:#fffafd;color:#392b31;min-width:180px">
        <span class="helper">${filtered.length} booking</span>
        <span style="flex:1"></span>
        <button class="btn btn-primary" id="add-booking">＋ Booking Baru</button>
      </div>

      <div class="panel">
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Tanggal</th><th>Jam</th><th>Kelas</th><th>Member</th><th>Paket</th>
              <th>Status</th><th>Hadir</th><th>Bayar</th><th>Reminder</th><th>Aksi</th>
            </tr></thead>
            <tbody>
              ${filtered.length ? filtered.map(b => `
                <tr>
                  <td>${prettyDate(b.class_date)}</td>
                  <td>${b.start_time||'—'}</td>
                  <td>${esc(b.class_name||'—')}</td>
                  <td><span class="td-main">${esc(b.member_name)}</span></td>
                  <td style="font-size:11px">${esc(b.package_name||'—')} ${catBadge(b.package_category)}</td>
                  <td>${badge(b.booking_status)}${b.waitlist_position?`<br><span class="muted">#${b.waitlist_position}</span>`:''}</td>
                  <td>${badge(b.attendance_status)}</td>
                  <td>${badge(b.payment_status)}</td>
                  <td>${badge(b.reminder_status)}</td>
                  <td>
                    <div class="row-actions" style="flex-wrap:wrap;gap:4px">
                      ${b.booking_status==='Aktif'&&b.attendance_status!=='Hadir'?`<button class="btn btn-soft btn-sm" data-action="attend" data-bid="${b.id}">✓ Hadir</button>`:''}
                      ${b.booking_status==='Aktif'&&b.reminder_status!=='Sudah di-reminder'?`<button class="btn btn-soft btn-sm" data-action="remind" data-bid="${b.id}">📢</button>`:''}
                      ${b.booking_status==='Aktif'?`<button class="btn btn-soft btn-sm" data-action="reschedule" data-bid="${b.id}">↺</button>`:''}
                      ${b.booking_status==='Aktif'?`<button class="btn btn-danger btn-sm" data-action="cancel" data-bid="${b.id}">✗</button>`:''}
                    </div>
                  </td>
                </tr>`).join('')
              : '<tr><td colspan="10" class="empty">Tidak ada booking untuk filter ini.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;

    /* Date nav */
    $('#bk-date').onchange = e => { bkDate = e.target.value; draw(); };
    $('#bk-prev').onclick  = () => { bkDate = addDays(bkDate, -1); draw(); };
    $('#bk-next').onclick  = () => { bkDate = addDays(bkDate,  1); draw(); };
    $('#bk-today').onclick = () => { bkDate = today(); draw(); };
    $('#bk-status').onchange = e => { bkStatus = e.target.value; draw(); };
    $('#bk-search').oninput  = e => { bkSearch = e.target.value; draw(); };
    $('#add-booking').onclick = () => openBookingForm(draw);

    /* Action buttons */
    $$('[data-action]').forEach(btn => {
      btn.onclick = async () => {
        const bid = btn.dataset.bid;
        try {
          if (btn.dataset.action === 'attend') {
            if (!confirm('Tandai member sudah hadir? Sesi paket akan dikurangi.')) return;
            await api('/bookings/' + bid, { method: 'PATCH', body: JSON.stringify({ attendance_status: 'Hadir' }) });
            toast('Member ditandai hadir ✓');
          } else if (btn.dataset.action === 'remind') {
            await api('/bookings/' + bid, { method: 'PATCH', body: JSON.stringify({ reminder_status: 'Sudah di-reminder' }) });
            toast('Reminder tercatat ✓');
          } else if (btn.dataset.action === 'cancel') {
            const note = prompt('Alasan pembatalan (opsional):') ?? '';
            if (!confirm('Batalkan booking? Jika < 3 jam, sesi paket hangus.')) return;
            const r = await api('/bookings/' + bid + '/cancel', { method: 'POST', body: JSON.stringify({ note }) });
            toast(r.rule === 'forfeit' ? 'Booking dibatalkan. 1 sesi hangus (< 3 jam).' : 'Booking dibatalkan. Sesi tidak hangus.');
          } else if (btn.dataset.action === 'reschedule') {
            openRescheduleModal(bid, draw);
            return;
          }
          draw();
        } catch (e) { toast(e.message, 'err'); }
      };
    });
  }
  await draw();
}

/* New Booking Form */
async function openBookingForm(redraw) {
  await loadLookup();
  const html = `
    <div class="modal-backdrop" id="bk-modal">
      <div class="modal" style="max-width:580px">
        <div class="modal-head">
          <h3>Booking Baru</h3>
          <button class="modal-close" id="close-bk-modal">×</button>
        </div>
        <div class="modal-body">
          <form class="form-grid" id="bk-form">
            <div class="field">
              <label>TANGGAL KELAS *</label>
              <input name="class_date" type="date" value="${today()}" required>
            </div>
            <div class="field">
              <label>JADWAL KELAS *</label>
              <select name="class_session_id" id="bk-session-sel" required>
                <option value="">Pilih tanggal dulu…</option>
              </select>
            </div>
            <div class="field full">
              <label>MEMBER *</label>
              <select name="member_id" id="bk-member-sel" required>
                <option value="">Pilih member…</option>
                ${(lookup.members||[]).map(m=>`<option value="${m.id}">${esc(m.name)}${m.phone?' — '+m.phone:''}</option>`).join('')}
              </select>
            </div>
            <div class="field full">
              <label>PAKET YANG DIGUNAKAN *</label>
              <select name="member_package_id" id="bk-pkg-sel" required>
                <option value="">Pilih member dulu…</option>
              </select>
            </div>
            <div class="field full">
              <label>STATUS PEMBAYARAN</label>
              <select name="payment_status">
                <option>Belum Payment</option>
                <option>Sudah Payment</option>
                <option selected>Waiting</option>
              </select>
            </div>
            <div class="field full">
              <label>CATATAN ADMIN</label>
              <textarea name="admin_notes" rows="2"></textarea>
            </div>
            <div id="bk-info" class="full helper" style="color:#9b4967"></div>
            <p class="helper full" id="bk-error" style="color:#c43f56"></p>
            <div class="modal-actions full">
              <button type="button" class="btn btn-soft cancel">Batal</button>
              <button type="submit" class="btn btn-primary">Buat Booking</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const modal = document.getElementById('bk-modal');
  const close  = () => modal.remove();
  document.getElementById('close-bk-modal').onclick = close;
  modal.querySelector('.cancel').onclick = close;
  modal.onclick = e => { if (e.target === modal) close(); };

  /* Load sessions on date change */
  const dateInput = modal.querySelector('[name="class_date"]');
  const sessSel   = modal.querySelector('#bk-session-sel');
  const memberSel = modal.querySelector('#bk-member-sel');
  const pkgSel    = modal.querySelector('#bk-pkg-sel');
  const infoDiv   = modal.querySelector('#bk-info');

  async function loadSessions() {
    sessSel.innerHTML = '<option>Memuat…</option>';
    try {
      const ss = await api('/sessions-by-date?date=' + dateInput.value);
      sessSel.innerHTML = '<option value="">Pilih jadwal…</option>' +
        ss.filter(s=>s.status!=='Unavailable').map(s=>
          `<option value="${s.id}">
  ${s.start_time}–${s.end_time} · ${esc(s.class_name)}
  · Coach ${esc(s.coach_name || '—')}
  · ${s.slots_remaining} slot${s.slots_remaining<=0?' (Waitlist)':''}
</option>`
        ).join('');
      sessSel.onchange = () => {
        const sel = ss.find(s=>s.id==sessSel.value);
        infoDiv.textContent = sel ? `Kapasitas: ${sel.capacity}, Terisi: ${sel.booked}, Sisa: ${sel.slots_remaining}${sel.waitlisted?' | Waitlist: '+sel.waitlisted:''}${sel.slots_remaining<=0?' ⚠️ Kelas penuh, akan masuk waitlist':''}` : '';
      };
    } catch { sessSel.innerHTML = '<option value="">Gagal memuat</option>'; }
  }
  dateInput.addEventListener('change', loadSessions);
  loadSessions();

  async function loadPkgs() {
    const mid = memberSel.value;
    pkgSel.innerHTML = '<option value="">Memuat…</option>';
    if (!mid) { pkgSel.innerHTML = '<option value="">Pilih member dulu</option>'; return; }
    try {
      const pkgs = await api('/member-packages-available?member_id=' + mid);
      pkgSel.innerHTML = '<option value="">Pilih paket…</option>' +
        pkgs.map(p=>
          `<option value="${p.id}">[${p.category||'regular'}] ${esc(p.package_name)} · ${p.sessions_remaining} sesi${p.expiry_date?' · exp '+prettyDate(p.expiry_date):(p.activation_date?'':' · belum aktif')}</option>`
        ).join('');
      if (!pkgs.length) pkgSel.innerHTML = '<option value="">⚠️ Tidak ada paket aktif</option>';
    } catch { pkgSel.innerHTML = '<option value="">Gagal memuat</option>'; }
  }
  memberSel.addEventListener('change', loadPkgs);

  modal.querySelector('#bk-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      class_session_id: Number(fd.get('class_session_id')),
      member_id:        Number(fd.get('member_id')),
      member_package_id: Number(fd.get('member_package_id')) || null,
      payment_status:   fd.get('payment_status'),
      admin_notes:      fd.get('admin_notes') || '',
    };
    const errEl = modal.querySelector('#bk-error');
    try {
      const result = await api('/bookings', { method: 'POST', body: JSON.stringify(payload) });
      close();
      toast(result.booking_status === 'Waitlist' ? `Masuk waitlist posisi #${result.waitlist_position}` : 'Booking berhasil dibuat ♡');
      await redraw();
    } catch (err) { errEl.textContent = err.message; }
  };
}

/* Reschedule modal */
async function openRescheduleModal(bookingId, redraw) {
  const html = `
    <div class="modal-backdrop" id="rs-modal">
      <div class="modal">
        <div class="modal-head">
          <h3>Reschedule Booking</h3>
          <button class="modal-close" id="close-rs">×</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>TANGGAL BARU</label>
            <input type="date" id="rs-date" value="${addDays(today(), 1)}">
          </div>
          <div class="field">
            <label>JADWAL TUJUAN</label>
            <select id="rs-sess"><option value="">Pilih tanggal dulu…</option></select>
          </div>
          <div class="field full">
            <label>CATATAN</label>
            <input type="text" id="rs-note" placeholder="Alasan reschedule (opsional)">
          </div>
          <p id="rs-error" style="color:#c43f56;font-size:12px"></p>
          <div class="modal-actions">
            <button type="button" class="btn btn-soft cancel">Batal</button>
            <button type="button" class="btn btn-primary" id="rs-submit">Simpan Reschedule</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const modal = document.getElementById('rs-modal');
  const close  = () => modal.remove();
  document.getElementById('close-rs').onclick = close;
  modal.querySelector('.cancel').onclick = close;
  modal.onclick = e => { if (e.target === modal) close(); };

  async function loadRsSessions() {
    const d = document.getElementById('rs-date').value;
    const sel = document.getElementById('rs-sess');
    sel.innerHTML = '<option>Memuat…</option>';
    try {
      const ss = await api('/sessions-by-date?date=' + d);
      const avail = ss.filter(s=>s.status!=='Unavailable');
      sel.innerHTML = '<option value="">Pilih jadwal…</option>' +
        avail.map(s=>`<option value="${s.id}">${s.start_time}–${s.end_time} · ${esc(s.class_name)} · ${s.slots_remaining} slot</option>`).join('');
      if (!avail.length) sel.innerHTML = '<option value="">Tidak ada jadwal tersedia</option>';
    } catch { sel.innerHTML = '<option value="">Gagal memuat</option>'; }
  }
  document.getElementById('rs-date').addEventListener('change', loadRsSessions);
  loadRsSessions();

  document.getElementById('rs-submit').onclick = async () => {
    const payload = {
      new_session_id: Number(document.getElementById('rs-sess').value),
      note: document.getElementById('rs-note').value,
    };
    if (!payload.new_session_id) { document.getElementById('rs-error').textContent = 'Pilih jadwal tujuan.'; return; }
    try {
      await api('/bookings/' + bookingId + '/reschedule', { method: 'POST', body: JSON.stringify(payload) });
      close();
      toast('Reschedule berhasil ✓');
      await redraw();
    } catch (e) { document.getElementById('rs-error').textContent = e.message; }
  };
}

/* ═══════════════════════════════════════════════════════════════
   GENERIC TABLE PAGE
═══════════════════════════════════════════════════════════════ */
async function renderTablePage(c, cfg) {
  if (!cfg) { c.innerHTML = '<div class="panel panel-pad">Halaman belum tersedia.</div>'; return; }
  const rows = await api('/' + cfg.endpoint);
  cache[cfg.endpoint] = rows;

  const paymentTotal = cfg.endpoint === 'payments'
    ? rows.filter(x=>x.payment_status==='Sudah Payment').reduce((s,x)=>s+Number(x.amount_paid||0),0) : 0;

  c.innerHTML = `
    <div class="page-intro"><h2>${cfg.title}</h2><p>${cfg.desc}</p></div>
    ${cfg.endpoint==='payments' ? `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-top">Total Pembayaran Diterima</div><div class="stat-value" style="font-size:19px">${money(paymentTotal)}</div><div class="stat-foot">Akumulasi sudah dikonfirmasi</div></div>
        <div class="stat-card"><div class="stat-top">Belum Lunas</div><div class="stat-value" style="font-size:19px">${money(rows.filter(x=>x.payment_status==='Belum Payment').reduce((s,x)=>s+Math.max(0,Number(x.amount_due||0)-Number(x.amount_paid||0)),0))}</div><div class="stat-foot">Total outstanding</div></div>
        <div class="stat-card"><div class="stat-top">Waiting</div><div class="stat-value">${rows.filter(x=>x.payment_status==='Waiting').length}</div><div class="stat-foot">Menunggu konfirmasi</div></div>
      </div>` : ''}
    ${cfg.endpoint==='packages' ? `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn btn-soft btn-sm filter-cat" data-cat="">Semua</button>
        <button class="btn btn-soft btn-sm filter-cat" data-cat="regular">Regular</button>
        <button class="btn btn-soft btn-sm filter-cat" data-cat="promo">Promo 🎁</button>
        <button class="btn btn-soft btn-sm filter-cat" data-cat="payday">Payday 💰</button>
      </div>` : ''}
    <div class="panel">
      <div class="panel-pad">
        <div class="toolbar">
          <input id="search-table" placeholder="⌕ Cari data…">
          <span class="helper" id="row-count">${rows.length} data</span>
          <span style="flex:1"></span>
          <button class="btn btn-primary" id="add-row">＋ Tambah ${cfg.title}</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>${cfg.cols.map(col=>`<th>${col[1]}</th>`).join('')}<th>Aksi</th></tr></thead>
          <tbody id="table-body"></tbody>
        </table>
      </div>
    </div>
    <div class="footer-note">Data tersimpan di database lokal Kinara.</div>`;

  let catFilter = '';
  const draw = (q = '') => {
    let filtered = rows.filter(r => cfg.cols.some(([k]) => labelValue(cfg.endpoint, r, k).toLowerCase().includes(q.toLowerCase())));
    if (catFilter) filtered = filtered.filter(r => r.category === catFilter);
    $('#row-count').textContent = `${filtered.length} data`;
    $('#table-body').innerHTML = filtered.length ? filtered.map(r => `
      <tr>
        ${cfg.cols.map(([k]) => {
          const v = labelValue(cfg.endpoint, r, k);
          const isBadge = ['payment_status','booking_status','attendance_status','reminder_status','status','computed_status'].includes(k);
          const isCat   = k === 'category';
          return `<td>${k==='name'||k==='title'?`<span class="td-main">${esc(v)}</span>`:isBadge?badge(v):isCat?catBadge(r.category):esc(v)}</td>`;
        }).join('')}
        <td><div class="row-actions"><button class="btn btn-soft btn-sm" data-edit="${r.id}">Edit</button><button class="btn btn-danger btn-sm" data-delete="${r.id}">Hapus</button></div></td>
      </tr>`).join('')
    : `<tr><td class="empty" colspan="${cfg.cols.length+1}">Belum ada data.</td></tr>`;
    $$('[data-edit]').forEach(b => b.onclick = () => openForm(cfg, rows.find(r => r.id == b.dataset.edit)));
    $$('[data-delete]').forEach(b => b.onclick = () => deleteRow(cfg, b.dataset.delete));
  };

  draw();
  $('#search-table').oninput = e => draw(e.target.value);
  $('#add-row').onclick = () => openForm(cfg);
  $$('.filter-cat').forEach(b => b.onclick = () => { catFilter = b.dataset.cat; $$('.filter-cat').forEach(x=>x.classList.remove('active')); b.classList.add('active'); draw($('#search-table').value); });
}

/* ─────────── label helpers ─────────── */
function labelValue(resource, row, key) {
  const v = row[key];
  if (v === null || v === undefined || v === '') return '—';
  if (['amount_due','amount_paid','price'].includes(key)) return money(v);
  if (key === 'class_type_id') return row.class_name || lookup.classes?.find(x=>x.id===v)?.name || `Kelas #${v}`;
  if (key === 'class_name')    return esc(v);
  if (key === 'booked')        return `${v||0} member`;
  if (key === 'waitlisted')    return `${v||0}`;
  if (key === 'slots_remaining') return `${v??'—'} slot`;
  if (key === 'computed_status' || (key==='status'&&row.computed_status)) return row.computed_status||v;
  if (key === 'scheduled_coach_id'||key==='actual_coach_id') return lookup.coaches?.find(x=>x.id===v)?.name||'—';
  if (key === 'scheduled_coach_name'||key==='actual_coach_name') return v||'—';
  if (key === 'member_id')     return row.member_name || lookup.members?.find(x=>x.id===v)?.name||`Member #${v}`;
  if (key === 'member_name')   return v;
  if (key === 'package_name')  return v||'—';
  if (key === 'category')      return v ? { regular:'Regular', promo:'Promo', payday:'Payday' }[v]||v : '—';
  if (key === 'package_id')    return lookup.packages?.find(x=>x.id===v)?.name||`Paket #${v}`;
  if (key === 'member_package_id') {
    const p = lookup.memberPackages?.find(x=>x.id===v);
    return row.package_name ? `${row.package_name} (${row.sessions_remaining??p?.sessions_remaining??'—'} sesi)` : p ? `${p.package_name} (${p.sessions_remaining} sesi)` : '—';
  }
  if (key === 'class_session_id') {
    if (row.class_date) return `${row.class_date} · ${row.start_time||''} · ${row.class_name||''}`;
    const s = lookup.sessions?.find(x=>x.id===v);
    return s ? `${s.class_date} · ${s.start_time} · ${s.class_name}` : `Jadwal #${v}`;
  }
  if (key === 'active') return Number(v) ? 'Aktif' : 'Nonaktif';
  if (key.endsWith('_date')||key==='paid_at') return prettyDate(v);
  if (key==='created_at'||key==='reminded_at') return prettyDateTime(v);
  if (['body','notes','admin_notes','description','reference_note','coach_change_note'].includes(key))
    return String(v).length > 50 ? String(v).slice(0,50)+'…' : v;
  if (key === 'coach_id')
  return lookup.coaches?.find(x => x.id == v)?.name || '—';

if (key === 'class_type_id')
  return lookup.classes?.find(x => x.id == v)?.name || '—';

if (key === 'day_of_week')
  return ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][Number(v)] || '—';
  return String(v);
}

/* ─────────── generic form modal ─────────── */
function optionsFor(field) {
  const [key,,type,source] = field;
  if (type === 'select-static') {
    return source.map(s => { const [v,t] = s.includes('|') ? s.split('|') : [s,s]; return `<option value="${esc(v)}">${esc(t)}</option>`; }).join('');
  }
  const data = lookup[source] || [];
  return data.map(o => {
    let text = o.name || '';
    if (source === 'memberPackages') text = `${o.member_name||''} — ${o.package_name} · ${o.sessions_remaining} sesi${o.expiry_date?' · exp '+prettyDate(o.expiry_date):''}`;
    if (source === 'sessions')       text = `${o.class_date} · ${o.start_time}–${o.end_time} · ${o.class_name||''} · ${o.slots_remaining} slot`;
    return `<option value="${o.id}">${esc(text)}</option>`;
  }).join('');
}

function openForm(cfg, row = null) {
  const isEdit = !!row;
  const fields = cfg.fields.map(f => {
    const [key, label, type, source] = f;
    const value = row?.[key] ?? (
      key==='capacity'?7:key==='sessions_purchased'||key==='sessions_remaining'?1:
      key==='payment_status'?'Waiting':key==='booking_status'?'Aktif':
      key==='attendance_status'?'Belum Hadir':key==='reminder_status'?'Belum di-reminder':
      key==='status'&&cfg.endpoint==='members'?'Aktif':
      key==='purchase_date'||key==='class_date'?today():
      key==='active'?1:key==='category'?'regular':''
    );
    let ctrl;
    if (type==='select'||type==='select-static')
      ctrl = `<select name="${key}" ${['member_id','class_session_id','class_type_id','name','title'].includes(key)?'required':''}><option value="">Pilih ${label.toLowerCase()}</option>${optionsFor(f)}</select>`;
    else if (type==='textarea')
      ctrl = `<textarea name="${key}" rows="3">${esc(value)}</textarea>`;
    else
      ctrl = `<input name="${key}" type="${type}" value="${esc(value)}" ${['name','title','class_date','start_time','end_time'].includes(key)?'required':''} ${type==='number'?'min="0"':''}>`;
    return `<div class="field ${type==='textarea'?'full':''}">${type!=='textarea'?`<label>${label.toUpperCase()}</label>`:`<label>${label.toUpperCase()}</label>`}${ctrl}</div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3>${isEdit?'Edit':'Tambah'} ${cfg.title}</h3>
        <button class="modal-close" type="button">×</button>
      </div>
      <div class="modal-body">
        <form id="record-form"><div class="form-grid">${fields}</div>
          <p class="helper" id="form-err" style="color:#c43f56"></p>
          <div class="modal-actions">
            <button type="button" class="btn btn-soft cancel">Batal</button>
            <button type="submit" class="btn btn-primary">Simpan Data</button>
          </div>
        </form>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.querySelector('.cancel').onclick       = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };

  /* Pre-fill selects */
  cfg.fields.forEach(f => {
    if (row && row[f[0]] !== undefined) {
      const el = modal.querySelector(`[name="${f[0]}"]`);
      if (el) el.value = row[f[0]];
    }
  });

  /* member_id → filter memberPackages */
  const memberSel  = modal.querySelector('[name="member_id"]');
  const bkPkgSel   = modal.querySelector('[name="member_package_id"]');
  if (memberSel && bkPkgSel) {
    const filter = () => {
      const mid = memberSel.value;
      const cur = bkPkgSel.value;
      bkPkgSel.innerHTML = `<option value="">Pilih paket</option>${optionsFor(['member_package_id','Paket','select','memberPackages'])}`;
      Array.from(bkPkgSel.options).forEach(o => {
        if (o.value) {
          const p = lookup.memberPackages?.find(x=>String(x.id)===o.value);
          o.hidden = !!mid && p && String(p.member_id) !== String(mid);
        }
      });
      bkPkgSel.value = cur;
    };
    memberSel.addEventListener('change', filter);
    filter();
  }
/* Payment: otomatis isi harga dari Pricelist */
const paymentPkgSel = cfg.endpoint === 'payments'
  ? modal.querySelector('[name="member_package_id"]')
  : null;

const amountDueInput = cfg.endpoint === 'payments'
  ? modal.querySelector('[name="amount_due"]')
  : null;

if (paymentPkgSel && amountDueInput) {
  paymentPkgSel.addEventListener('change', () => {
    const selectedPackage = lookup.memberPackages?.find(
      p => String(p.id) === paymentPkgSel.value
    );

    if (selectedPackage) {
      amountDueInput.value = Number(selectedPackage.price || 0);
    } else {
      amountDueInput.value = '';
    }
  });
}
  /* package_id → auto-fill session counts */
  const pkgSel = modal.querySelector('[name="package_id"]');
  if (pkgSel) {
    pkgSel.addEventListener('change', () => {
      const pk = lookup.packages?.find(p=>String(p.id)===pkgSel.value);
      if (pk && !isEdit) {
        const sp = modal.querySelector('[name="sessions_purchased"]');
        const sr = modal.querySelector('[name="sessions_remaining"]');
        if (sp) sp.value = pk.session_count;
        if (sr) sr.value = pk.session_count;
      }
    });
  }

  /* Submit */
  modal.querySelector('#record-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {};
    const numFields = ['class_type_id',,'class_session_id','member_package_id','package_id','sessions_purchased','sessions_remaining','session_count','price','validity_days','default_capacity','duration_minutes','amount_due','amount_paid','active', 'coach_id', 'day_of_week','scheduled_coach_id','actual_coach_id','capacity','member_id'];
    cfg.fields.forEach(f => {
      const v = fd.get(f[0]);
      if (v !== null && v !== '') payload[f[0]] = numFields.includes(f[0]) ? Number(v) : v;
      else if (['scheduled_coach_id','actual_coach_id','member_package_id'].includes(f[0])) payload[f[0]] = null;
    });
    const errEl = document.getElementById('form-err');
    try {
      await api('/' + cfg.endpoint + (isEdit ? '/' + row.id : ''), { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      modal.remove();
      toast('Data berhasil disimpan ♡');
      await renderPage();
    } catch (err) { errEl.textContent = err.message; }
  };
}

async function deleteRow(cfg, id) {
  if (!confirm('Yakin ingin menghapus data ini? Tindakan tidak dapat dibatalkan.')) return;
  try {
    await api('/' + cfg.endpoint + '/' + id, { method: 'DELETE' });
    toast('Data berhasil dihapus');
    await renderPage();
  } catch (e) { toast(e.message, 'err'); }
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS PAGE
═══════════════════════════════════════════════════════════════ */
async function renderSettings(c) {
  _settings = await api('/settings');
  c.innerHTML = `
    <div class="page-intro"><h2>Pengaturan Studio</h2><p>Kelola identitas studio, rekening bank, dan aturan operasional.</p></div>

    <div class="panel settings-card">
      <div class="panel-pad">
        <div class="brand" style="padding:0 0 20px">
          <div class="brand-mark">♡</div>
          <div>
            <div class="brand-name">Info Kinara</div>
            <div class="brand-caption">Studio & rekening</div>
          </div>
        </div>
        <form id="settings-form" class="form-grid">
          <div class="field full"><label>NAMA STUDIO</label><input name="studio_name" value="${esc(_settings.studio_name)}" required></div>
          <div class="field"><label>NAMA BANK</label><input name="bank_name" value="${esc(_settings.bank_name||'')}" placeholder="BCA, BRI, dll."></div>
          <div class="field"><label>NAMA PEMILIK REKENING</label><input name="bank_account_name" value="${esc(_settings.bank_account_name||'')}" placeholder="Nama pemilik"></div>
          <div class="field full"><label>NOMOR REKENING</label><input name="bank_account_number" value="${esc(_settings.bank_account_number||'')}" placeholder="Nomor rekening"></div>
          <div class="field"><label>NO. WHATSAPP STUDIO</label><input name="whatsapp_number" value="${esc(_settings.whatsapp_number||'')}" placeholder="08xxxxxxxxxx"></div>
          <div class="field"><label>BATAS BOOKING (JAM SEBELUM KELAS)</label><input type="number" name="booking_cutoff_hours" value="${_settings.booking_cutoff_hours||24}" min="0"></div>
          <div class="field"><label>BATAS CANCEL TANPA HANGUS SESI (JAM)</label><input type="number" name="cancel_forfeit_hours" value="${_settings.cancel_forfeit_hours||3}" min="0"></div>
          <p class="helper full">Pembatalan lebih dari <strong>${_settings.cancel_forfeit_hours||3} jam</strong> sebelum kelas = sesi tidak hangus. Pembatalan ≤ ${_settings.cancel_forfeit_hours||3} jam = 1 sesi hangus.</p>
          <p class="helper full" id="settings-err" style="color:#c43f56"></p>
          <div class="modal-actions full">
            <button class="btn btn-primary" type="submit">Simpan Pengaturan</button>
          </div>
        </form>
      </div>
    </div>

    <div class="panel settings-card" style="margin-top:16px">
      <div class="panel-pad">
        <h3 style="margin:0 0 12px;color:#713149;font-family:'Playfair Display',serif">Ganti Password Admin</h3>
        <form id="pwd-form" class="form-grid">
          <div class="field"><label>PASSWORD SAAT INI</label><input type="password" name="current_password" required></div>
          <div class="field"><label>PASSWORD BARU (min. 6 karakter)</label><input type="password" name="new_password" minlength="6" required></div>
          <p class="helper full" id="pwd-err" style="color:#c43f56"></p>
          <div class="modal-actions full"><button class="btn btn-primary" type="submit">Ganti Password</button></div>
        </form>
      </div>
    </div>

    <div class="panel settings-card" style="margin-top:16px">
      <div class="panel-pad">
        <h3 style="margin:0 0 8px;color:#713149;font-family:'Playfair Display',serif">Info Rekening (Preview)</h3>
        <div class="notice">
          <span class="notice-icon">🏦</span>
          <div>
            <strong>${esc(_settings.bank_name||'—')} · ${esc(_settings.bank_account_name||'—')}</strong>
            <p>No. Rek: <strong>${esc(_settings.bank_account_number||'—')}</strong></p>
          </div>
        </div>
        <p class="helper" style="margin-top:10px">Kinara Pilates Admin · Data tersimpan lokal. Jangan bagikan file database atau .env.</p>
      </div>
    </div>`;

  $('#settings-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    payload.booking_cutoff_hours = Number(payload.booking_cutoff_hours);
    payload.cancel_forfeit_hours = Number(payload.cancel_forfeit_hours);
    try { await api('/settings', { method: 'PATCH', body: JSON.stringify(payload) }); toast('Pengaturan disimpan ♡'); renderSettings(c); }
    catch (err) { $('#settings-err').textContent = err.message; }
  };

  $('#pwd-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: fd.get('current_password'), new_password: fd.get('new_password') }) });
      toast('Password berhasil diubah ♡');
      e.target.reset();
    } catch (err) { $('#pwd-err').textContent = err.message; }
  };
}

/* ─── START ─── */
boot();
