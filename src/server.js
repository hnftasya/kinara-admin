require('dotenv').config();
const express  = require('express');
const session  = require('express-session');
const helmet   = require('helmet');
const bcrypt   = require('bcryptjs');
const db       = require('./db/init');
const path     = require('path');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'kinara-local-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 60 * 1000  // 10 hours
  }
}));

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

/* ─────────────────────────── helpers ─────────────────────────── */
const requireAuth = (req, res, next) =>
  req.session.admin ? next() : res.status(401).json({ error: 'Sesi berakhir. Silakan login kembali.' });

const log = (type, id, action, details = '') =>
  db.prepare('INSERT INTO activity_logs(entity_type,entity_id,action,details) VALUES(?,?,?,?)').run(type, id, action, details);

function countActive(sessionId, excludeId = 0) {
  return db.prepare("SELECT COUNT(*) n FROM bookings WHERE class_session_id=? AND booking_status='Aktif' AND id<>?").get(sessionId, excludeId).n;
}

function countWaitlist(sessionId) {
  return db.prepare("SELECT COUNT(*) n FROM bookings WHERE class_session_id=? AND booking_status='Waitlist'").get(sessionId).n;
}

function coachConflict(row, excludeId = 0) {
  if (!row.scheduled_coach_id && !row.actual_coach_id) return false;
  const coachId = row.actual_coach_id || row.scheduled_coach_id;
  return !!db.prepare(`
    SELECT id FROM class_sessions
    WHERE id<>? AND class_date=?
      AND (scheduled_coach_id=? OR actual_coach_id=?)
      AND status<>'Unavailable'
      AND start_time < ? AND end_time > ?
    LIMIT 1
  `).get(excludeId, row.class_date, coachId, coachId, row.end_time, row.start_time);
}

function getSettings() {
  return db.prepare('SELECT * FROM studio_settings WHERE id=1').get() || {};
}

function jakartaNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
}

function jakartaToday() {
  return jakartaNow().toISOString().slice(0, 10).replace('T', '').slice(0, 10);
}

/* promote first waitlist entry after a slot opens */
function promoteWaitlist(sessionId) {
  const sess = db.prepare('SELECT * FROM class_sessions WHERE id=?').get(sessionId);
  if (!sess) return;
  const active = countActive(sessionId);
  if (active >= sess.capacity) return;
  const next = db.prepare("SELECT * FROM bookings WHERE class_session_id=? AND booking_status='Waitlist' ORDER BY waitlist_position ASC, id ASC LIMIT 1").get(sessionId);
  if (next) {
    db.prepare("UPDATE bookings SET booking_status='Aktif', waitlist_position=NULL WHERE id=?").run(next.id);
    log('booking', next.id, 'promoted_from_waitlist');
  }
}

/* ─────────────────────────── AUTH ─────────────────────────── */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM admins WHERE username=?').get(String(username || ''));
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash))
    return res.status(401).json({ error: 'Username atau password salah.' });
  req.session.admin = { id: user.id, username: user.username };
  res.json({ ok: true, username: user.username });
});
app.get('/api/auth/me', (req, res) => res.json({ authenticated: !!req.session.admin, username: req.session.admin?.username || '' }));
app.post('/api/auth/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
  const user = db.prepare('SELECT * FROM admins WHERE id=?').get(req.session.admin.id);
  if (!bcrypt.compareSync(String(current_password || ''), user.password_hash))
    return res.status(400).json({ error: 'Password saat ini salah.' });
  db.prepare('UPDATE admins SET password_hash=? WHERE id=?').run(bcrypt.hashSync(new_password, 12), user.id);
  res.json({ ok: true });
});

/* ─────────────────────────── DASHBOARD ─────────────────────────── */
app.get('/api/dashboard', requireAuth, (req, res) => {
  const date = req.query.date || jakartaToday();
  const sessions = db.prepare(`
    SELECT cs.*, ct.name class_name,
           c1.name scheduled_coach_name, c2.name actual_coach_name,
           (SELECT COUNT(*) FROM bookings b WHERE b.class_session_id=cs.id AND b.booking_status='Aktif') booked,
           (SELECT COUNT(*) FROM bookings b WHERE b.class_session_id=cs.id AND b.booking_status='Waitlist') waitlisted,
           MAX(cs.capacity - (SELECT COUNT(*) FROM bookings b WHERE b.class_session_id=cs.id AND b.booking_status='Aktif'), 0) slots_remaining,
           CASE
             WHEN cs.status='Unavailable' THEN 'Unavailable'
             WHEN (SELECT COUNT(*) FROM bookings b WHERE b.class_session_id=cs.id AND b.booking_status='Aktif') >= cs.capacity THEN 'Full'
             ELSE 'Available'
           END computed_status
    FROM class_sessions cs
    LEFT JOIN class_types ct ON ct.id = cs.class_type_id
    LEFT JOIN coaches c1 ON c1.id = cs.scheduled_coach_id
    LEFT JOIN coaches c2 ON c2.id = cs.actual_coach_id
    WHERE cs.class_date = ?
    ORDER BY cs.start_time
  `).all(date);

  const payments = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN payment_status='Sudah Payment' THEN amount_paid ELSE 0 END), 0) received,
      COALESCE(SUM(CASE WHEN payment_status='Belum Payment' THEN MAX(amount_due - amount_paid, 0) ELSE 0 END), 0) outstanding,
      SUM(CASE WHEN payment_status='Waiting' THEN 1 ELSE 0 END) waiting_count
    FROM payments
  `).get();

  const memberCount  = db.prepare("SELECT COUNT(*) n FROM members WHERE status='Aktif'").get().n;
  const bookingCount = db.prepare("SELECT COUNT(*) n FROM bookings WHERE booking_status='Aktif' AND class_session_id IN (SELECT id FROM class_sessions WHERE class_date=?)").get(date).n;
  const reminders    = db.prepare("SELECT COUNT(*) n FROM bookings WHERE booking_status='Aktif' AND reminder_status='Belum di-reminder' AND class_session_id IN (SELECT id FROM class_sessions WHERE class_date>=?)").get(date).n;

  // Expiring packages in 7 days
  const expiringPkgs = db.prepare(`
    SELECT mp.*, m.name member_name, p.name package_name
    FROM member_packages mp
    JOIN members m ON m.id = mp.member_id
    JOIN packages p ON p.id = mp.package_id
    WHERE mp.status = 'Aktif' AND mp.expiry_date IS NOT NULL
      AND mp.expiry_date BETWEEN date('now','localtime') AND date('now','localtime','+7 days')
    ORDER BY mp.expiry_date
  `).all();

  // Coach changes today
  const coachChanges = sessions.filter(s => s.coach_changed && s.actual_coach_id !== s.scheduled_coach_id);

  res.json({ date, sessions, memberCount, bookingCount, payments, reminders, expiringPkgs, coachChanges });
});

/* ─────────────────────────── LOOKUP (for forms) ─────────────────────────── */
app.get('/api/lookup', requireAuth, (req, res) => {
  res.json({
    members:        db.prepare("SELECT id, name, phone FROM members WHERE status='Aktif' ORDER BY name").all(),
    coaches:        db.prepare('SELECT id, name FROM coaches WHERE active=1 ORDER BY name').all(),
    classes:        db.prepare('SELECT id, name, default_capacity FROM class_types WHERE active=1 ORDER BY name').all(),
    packages:       db.prepare("SELECT id, name, code, category, session_count, price, validity_days FROM packages WHERE active=1 ORDER BY category, name").all(),
    memberPackages: db.prepare(`
      SELECT mp.id, mp.member_id, mp.sessions_remaining, mp.expiry_date, mp.activation_date,
             m.name member_name, p.name package_name, p.price, p.category
      FROM member_packages mp
      JOIN packages p ON p.id = mp.package_id
      JOIN members m ON m.id = mp.member_id
      WHERE mp.sessions_remaining > 0 AND mp.status NOT IN ('Habis','Kedaluwarsa')
        AND (mp.expiry_date IS NULL OR mp.expiry_date >= date('now','localtime'))
      ORDER BY m.name, mp.expiry_date
    `).all(),
    sessions: db.prepare(`
      SELECT cs.id, cs.class_date, cs.start_time, cs.end_time, cs.capacity,
             ct.name class_name, c.name coach_name,
             (SELECT COUNT(*) FROM bookings b WHERE b.class_session_id=cs.id AND b.booking_status='Aktif') booked,
             MAX(cs.capacity - (SELECT COUNT(*) FROM bookings b WHERE b.class_session_id=cs.id AND b.booking_status='Aktif'), 0) slots_remaining,
             CASE WHEN cs.status='Unavailable' THEN 'Unavailable'
                  WHEN (SELECT COUNT(*) FROM bookings b WHERE b.class_session_id=cs.id AND b.booking_status='Aktif') >= cs.capacity THEN 'Full'
                  ELSE 'Available' END status
      FROM class_sessions cs
      LEFT JOIN class_types ct ON ct.id = cs.class_type_id
      LEFT JOIN coaches c ON c.id = cs.scheduled_coach_id
      WHERE cs.status <> 'Unavailable'
      ORDER BY cs.class_date DESC, cs.start_time
    `).all()
  });
});

/* sessions by date */
app.get('/api/sessions-by-date', requireAuth, (req, res) => {
  const date = req.query.date;

  if (!date) {
    return res.status(400).json({ error: 'date wajib diisi' });
  }

  // Validasi tanggal
  const parsedDate = new Date(date + 'T00:00:00Z');

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    return res.status(400).json({ error: 'Tanggal tidak valid.' });
  }

  try {
    // Ambil jadwal rutin sesuai hari
    const schedules = db.prepare(`
      SELECT *
      FROM coach_schedules
      WHERE day_of_week = CAST(strftime('%w', ?) AS INTEGER)
        AND active = 1
      ORDER BY start_time
    `).all(date);

    const createSessions = db.transaction(() => {
      for (const schedule of schedules) {
        const startMinutes =
          Number(schedule.start_time.slice(0, 2)) * 60 +
          Number(schedule.start_time.slice(3, 5));

        const endMinutes =
          Number(schedule.end_time.slice(0, 2)) * 60 +
          Number(schedule.end_time.slice(3, 5));

        // Pecah jadwal menjadi sesi 1 jam
        for (
          let time = startMinutes;
          time + 60 <= endMinutes;
          time += 60
        ) {
          const start =
            `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;

          const nextTime = time + 60;

          const end =
            `${String(Math.floor(nextTime / 60)).padStart(2, '0')}:${String(nextTime % 60).padStart(2, '0')}`;

          // Cek duplikat
          const exists = db.prepare(`
            SELECT id
            FROM class_sessions
            WHERE class_date = ?
              AND class_type_id = ?
              AND scheduled_coach_id = ?
              AND start_time = ?
            LIMIT 1
          `).get(
            date,
            schedule.class_type_id,
            schedule.coach_id,
            start
          );

          if (exists) continue;

          // Cek bentrok dengan sesi coach lainnya
          const conflict = db.prepare(`
            SELECT id
            FROM class_sessions
            WHERE class_date = ?
              AND (scheduled_coach_id = ? OR actual_coach_id = ?)
              AND status <> 'Unavailable'
              AND start_time < ?
              AND end_time > ?
            LIMIT 1
          `).get(
            date,
            schedule.coach_id,
            schedule.coach_id,
            end,
            start
          );

          if (conflict) continue;

          // Simpan sesi otomatis
          db.prepare(`
            INSERT INTO class_sessions (
              class_type_id,
              class_date,
              start_time,
              end_time,
              capacity,
              scheduled_coach_id,
              actual_coach_id,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Available')
          `).run(
            schedule.class_type_id,
            date,
            start,
            end,
            schedule.capacity,
            schedule.coach_id,
            schedule.coach_id
          );
        }
      }
    });

    createSessions();

    // Tampilkan sesi pada tanggal yang dipilih
    const rows = db.prepare(`
      SELECT cs.id, cs.class_date, cs.start_time, cs.end_time,
             cs.capacity, ct.name class_name,
             c.name coach_name,
             (SELECT COUNT(*) FROM bookings b
              WHERE b.class_session_id = cs.id
              AND b.booking_status = 'Aktif') booked,
             (SELECT COUNT(*) FROM bookings b
              WHERE b.class_session_id = cs.id
              AND b.booking_status = 'Waitlist') waitlisted,
             MAX(
               cs.capacity - (
                 SELECT COUNT(*) FROM bookings b
                 WHERE b.class_session_id = cs.id
                 AND b.booking_status = 'Aktif'
               ), 0
             ) slots_remaining,
             CASE
               WHEN cs.status = 'Unavailable' THEN 'Unavailable'
               WHEN (
                 SELECT COUNT(*) FROM bookings b
                 WHERE b.class_session_id = cs.id
                 AND b.booking_status = 'Aktif'
               ) >= cs.capacity THEN 'Full'
               ELSE 'Available'
             END status
      FROM class_sessions cs
      LEFT JOIN class_types ct ON ct.id = cs.class_type_id
      LEFT JOIN coaches c ON c.id = cs.scheduled_coach_id
      WHERE cs.class_date = ?
      ORDER BY cs.start_time
    `).all(date);

    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
/* member's available packages */
app.get('/api/member-packages-available', requireAuth, (req, res) => {
  const memberId = req.query.member_id;
  if (!memberId) return res.status(400).json({ error: 'member_id wajib diisi' });
  res.json(db.prepare(`
    SELECT mp.*, p.name package_name, p.category, p.price, p.validity_days, p.session_count
    FROM member_packages mp
    JOIN packages p ON p.id = mp.package_id
    WHERE mp.member_id = ? AND mp.sessions_remaining > 0
      AND mp.status NOT IN ('Habis','Kedaluwarsa')
      AND (mp.expiry_date IS NULL OR mp.expiry_date >= date('now','localtime'))
    ORDER BY mp.expiry_date ASC, mp.id ASC
  `).all(memberId));
});

/* bookings by session */
app.get('/api/session-bookings/:id', requireAuth, (req, res) => {
  res.json(db.prepare(`
    SELECT b.*, m.name member_name, m.phone member_phone,
           p.name package_name, p.category package_category
    FROM bookings b
    JOIN members m ON m.id = b.member_id
    LEFT JOIN member_packages mp ON mp.id = b.member_package_id
    LEFT JOIN packages p ON p.id = mp.package_id
    WHERE b.class_session_id = ?
    ORDER BY b.booking_status, b.waitlist_position, b.id
  `).all(req.params.id));
});

/* bookings filtered */
app.get('/api/bookings-filtered', requireAuth, (req, res) => {
  const { date, member_id, status } = req.query;
  let sql = `
    SELECT b.*, m.name member_name, cs.class_date, cs.start_time, cs.end_time,
           ct.name class_name, c.name coach_name,
           p.name package_name, p.category package_category
    FROM bookings b
    JOIN members m ON m.id = b.member_id
    JOIN class_sessions cs ON cs.id = b.class_session_id
    LEFT JOIN class_types ct ON ct.id = cs.class_type_id
    LEFT JOIN coaches c ON c.id = cs.actual_coach_id
    LEFT JOIN member_packages mp ON mp.id = b.member_package_id
    LEFT JOIN packages p ON p.id = mp.package_id
    WHERE 1=1
  `;
  const params = [];
  if (date)      { sql += ' AND cs.class_date = ?'; params.push(date); }
  if (member_id) { sql += ' AND b.member_id = ?';   params.push(member_id); }
  if (status)    { sql += ' AND b.booking_status = ?'; params.push(status); }
  sql += ' ORDER BY cs.class_date DESC, cs.start_time, m.name';
  res.json(db.prepare(sql).all(...params));
});

/* ─────────────────────── GENERIC CRUD TABLE ROUTES ─────────────────────── */

/* ─────────────────────── COACH SCHEDULES ─────────────────────── */

function validateCoachSchedule(body, excludeId = 0) {
  const coachId = Number(body.coach_id);
  const classId = Number(body.class_type_id);
  const day = Number(body.day_of_week);
  const start = String(body.start_time || '');
  const end = String(body.end_time || '');

  if (!coachId || !classId) {
    throw new Error('Coach dan jenis kelas wajib dipilih.');
  }

  if (!Number.isInteger(day) || day < 0 || day > 6) {
    throw new Error('Hari tidak valid.');
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) ||
      start >= end) {
    throw new Error('Jam mulai dan selesai tidak valid.');
  }

  if (!Number.isInteger(Number(body.capacity)) || Number(body.capacity) < 1) {
    throw new Error('Kapasitas minimal 1.');
  }

  const coach = db.prepare(
    'SELECT id FROM coaches WHERE id=? AND active=1'
  ).get(coachId);

  const cls = db.prepare(
    'SELECT id FROM class_types WHERE id=? AND active=1'
  ).get(classId);

  if (!coach) throw new Error('Coach tidak ditemukan atau nonaktif.');
  if (!cls) throw new Error('Jenis kelas tidak ditemukan atau nonaktif.');

  const conflict = db.prepare(`
    SELECT cs.id
    FROM coach_schedules cs
    WHERE cs.coach_id = ?
      AND cs.day_of_week = ?
      AND cs.active = 1
      AND cs.id <> ?
      AND cs.start_time < ?
      AND cs.end_time > ?
    LIMIT 1
  `).get(coachId, day, excludeId, end, start);

  if (conflict) {
    throw new Error('Jadwal coach bentrok dengan jadwal rutin lainnya.');
  }

  return {
    coach_id: coachId,
    class_type_id: classId,
    day_of_week: day,
    start_time: start,
    end_time: end,
    capacity: Number(body.capacity),
    active: body.active === undefined ? 1 : Number(body.active) ? 1 : 0,
    notes: String(body.notes || '')
  };
}

// SIMPAN BANYAK JADWAL SEKALIGUS
app.post('/api/coach-schedules/bulk', requireAuth, (req, res) => {
  try {
    const coachId = Number(req.body.coach_id);
    const schedules = req.body.schedules;

    if (!coachId) {
      throw new Error('Pilih coach terlebih dahulu.');
    }

    if (!Array.isArray(schedules) || schedules.length === 0) {
      throw new Error('Tambahkan minimal satu jadwal.');
    }

    const saveAll = db.transaction(() => {
      const insertedIds = [];

      for (const item of schedules) {
        const data = validateCoachSchedule({
          ...item,
          coach_id: coachId
        });

        const result = db.prepare(`
          INSERT INTO coach_schedules (
            coach_id, class_type_id, day_of_week,
            start_time, end_time, capacity, active, notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          data.coach_id,
          data.class_type_id,
          data.day_of_week,
          data.start_time,
          data.end_time,
          data.capacity,
          data.active,
          data.notes
        );

        log('coach_schedule', result.lastInsertRowid, 'create');
        insertedIds.push(Number(result.lastInsertRowid));
      }

      return insertedIds;
    });

    const ids = saveAll();

    res.json({
      ok: true,
      count: ids.length,
      ids
    });

  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// LIST jadwal rutin
app.get('/api/coach-schedules', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT cs.*,
           c.name coach_name,
           ct.name class_name
    FROM coach_schedules cs
    JOIN coaches c ON c.id = cs.coach_id
    JOIN class_types ct ON ct.id = cs.class_type_id
    ORDER BY cs.day_of_week, cs.start_time, c.name
  `).all();

  res.json(rows);
});

// CREATE jadwal rutin
app.post('/api/coach-schedules', requireAuth, (req, res) => {
  try {
    const data = validateCoachSchedule(req.body || {});

    const result = db.prepare(`
      INSERT INTO coach_schedules
      (coach_id, class_type_id, day_of_week, start_time,
       end_time, capacity, active, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.coach_id,
      data.class_type_id,
      data.day_of_week,
      data.start_time,
      data.end_time,
      data.capacity,
      data.active,
      data.notes
    );

    log('coach_schedule', result.lastInsertRowid, 'create');

    res.json(
      db.prepare('SELECT * FROM coach_schedules WHERE id=?')
        .get(result.lastInsertRowid)
    );
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// UPDATE jadwal rutin
app.patch('/api/coach-schedules/:id', requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare(
      'SELECT * FROM coach_schedules WHERE id=?'
    ).get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Jadwal rutin tidak ditemukan.' });
    }

    const data = validateCoachSchedule(
      { ...existing, ...(req.body || {}) },
      id
    );

    db.prepare(`
      UPDATE coach_schedules
      SET coach_id=?, class_type_id=?, day_of_week=?,
          start_time=?, end_time=?, capacity=?, active=?, notes=?
      WHERE id=?
    `).run(
      data.coach_id,
      data.class_type_id,
      data.day_of_week,
      data.start_time,
      data.end_time,
      data.capacity,
      data.active,
      data.notes,
      id
    );

    log('coach_schedule', id, 'update');

    res.json(
      db.prepare('SELECT * FROM coach_schedules WHERE id=?').get(id)
    );
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE jadwal rutin
app.delete('/api/coach-schedules/:id', requireAuth, (req, res) => {
  const result = db.prepare(
    'DELETE FROM coach_schedules WHERE id=?'
  ).run(Number(req.params.id));

  if (!result.changes) {
    return res.status(404).json({ error: 'Jadwal rutin tidak ditemukan.' });
  }

  log('coach_schedule', Number(req.params.id), 'delete');
  res.json({ ok: true });
});

const tables = {
  members:        { table: 'members',        fields: ['name','phone','email','status','notes'] },
  coaches:        { table: 'coaches',        fields: ['name','phone','active','notes'] },
  classes:        { table: 'class_types',    fields: ['name','default_capacity','duration_minutes','active','notes'] },
  sessions:       { table: 'class_sessions', fields: ['class_type_id','class_date','start_time','end_time','capacity','scheduled_coach_id','actual_coach_id','coach_changed','coach_change_note','admin_notes','status'] },
  packages:       { table: 'packages',       fields: ['name','code','category','session_count','price','validity_days','description','active'] },
  memberPackages: { table: 'member_packages',fields: ['member_id','package_id','purchase_date','sessions_purchased','sessions_remaining','activation_date','expiry_date','status','notes'] },
  bookings:       { table: 'bookings',       fields: ['member_id','class_session_id','member_package_id','booking_status','attendance_status','payment_status','reminder_status','admin_notes'] },
  payments:       { table: 'payments',       fields: ['member_id','member_package_id','amount_due','amount_paid','payment_status','payment_method','paid_at','reference_note'] },
  notes:          { table: 'notes',          fields: ['title','body','related_to'] }
};

function listResource(resource) {
  if (resource === 'sessions') return db.prepare(`
    SELECT cs.*, ct.name class_name, c1.name scheduled_coach_name, c2.name actual_coach_name,
           (SELECT COUNT(*) FROM bookings b WHERE b.class_session_id=cs.id AND b.booking_status='Aktif') booked,
           (SELECT COUNT(*) FROM bookings b WHERE b.class_session_id=cs.id AND b.booking_status='Waitlist') waitlisted,
           MAX(cs.capacity - (SELECT COUNT(*) FROM bookings b WHERE b.class_session_id=cs.id AND b.booking_status='Aktif'), 0) slots_remaining,
           CASE WHEN cs.status='Unavailable' THEN 'Unavailable'
                WHEN (SELECT COUNT(*) FROM bookings b WHERE b.class_session_id=cs.id AND b.booking_status='Aktif') >= cs.capacity THEN 'Full'
                ELSE 'Available' END computed_status
    FROM class_sessions cs
    LEFT JOIN class_types ct ON ct.id = cs.class_type_id
    LEFT JOIN coaches c1 ON c1.id = cs.scheduled_coach_id
    LEFT JOIN coaches c2 ON c2.id = cs.actual_coach_id
    ORDER BY cs.class_date DESC, cs.start_time
  `).all();

  if (resource === 'bookings') return db.prepare(`
    SELECT b.*, m.name member_name, cs.class_date, cs.start_time, cs.end_time, ct.name class_name,
           c.name coach_name, p.name package_name, p.category package_category,
           mp.sessions_remaining
    FROM bookings b
    JOIN members m ON m.id = b.member_id
    JOIN class_sessions cs ON cs.id = b.class_session_id
    LEFT JOIN class_types ct ON ct.id = cs.class_type_id
    LEFT JOIN coaches c ON c.id = cs.actual_coach_id
    LEFT JOIN member_packages mp ON mp.id = b.member_package_id
    LEFT JOIN packages p ON p.id = mp.package_id
    ORDER BY cs.class_date DESC, cs.start_time, m.name
  `).all();

  if (resource === 'memberPackages') return db.prepare(`
    SELECT mp.*, m.name member_name, p.name package_name, p.price, p.category, p.session_count, p.validity_days
    FROM member_packages mp
    JOIN members m ON m.id = mp.member_id
    JOIN packages p ON p.id = mp.package_id
    ORDER BY mp.id DESC
  `).all();

  if (resource === 'payments') return db.prepare(`
    SELECT py.*, m.name member_name, p.name package_name
    FROM payments py
    JOIN members m ON m.id = py.member_id
    LEFT JOIN member_packages mp ON mp.id = py.member_package_id
    LEFT JOIN packages p ON p.id = mp.package_id
    ORDER BY py.id DESC
  `).all();

  return db.prepare(`SELECT * FROM ${tables[resource].table} ORDER BY id DESC`).all();
}

for (const [resource, config] of Object.entries(tables)) {
  /* LIST */
  app.get('/api/' + resource, requireAuth, (req, res) => res.json(listResource(resource)));

  /* CREATE */
  app.post('/api/' + resource, requireAuth, (req, res) => {
    const body = req.body || {};
    try {
      /* sessions validation */
      if (resource === 'sessions') {
        if (!body.class_date || !body.start_time || !body.end_time) throw new Error('Tanggal, jam mulai, dan jam selesai wajib diisi.');
        if (body.end_time <= body.start_time) throw new Error('Jam selesai harus setelah jam mulai.');
        if (!body.capacity || Number(body.capacity) < 1) throw new Error('Kapasitas minimal 1.');
        if (coachConflict(body)) throw new Error('Coach sudah dijadwalkan di kelas lain pada waktu yang sama.');
        body.coach_changed = (body.actual_coach_id && body.actual_coach_id !== body.scheduled_coach_id) ? 1 : 0;
      }

      /* memberPackages validation */
      if (resource === 'memberPackages') {
        const pack = db.prepare('SELECT * FROM packages WHERE id=? AND active=1').get(body.package_id);
        if (!pack) throw new Error('Pilih paket aktif yang valid.');
        body.sessions_purchased = Number(body.sessions_purchased || pack.session_count);
        body.sessions_remaining = body.sessions_remaining !== undefined && body.sessions_remaining !== '' ? Number(body.sessions_remaining) : body.sessions_purchased;
      }

      /* bookings validation */
      if (resource === 'bookings') {
        const settings = getSettings();
        const cls = db.prepare('SELECT * FROM class_sessions WHERE id=?').get(body.class_session_id);
        if (!cls || cls.status === 'Unavailable') throw new Error('Jadwal kelas tidak tersedia.');

        // H-1 cutoff check
        const cutoffHours = settings.booking_cutoff_hours || 24;
        const classTime = new Date(`${cls.class_date}T${cls.start_time}:00+07:00`);
        const now = new Date();
        if ((classTime - now) < cutoffHours * 3600 * 1000)
          throw new Error(`Booking hanya bisa dilakukan minimal ${cutoffHours} jam sebelum kelas.`);

        if (db.prepare("SELECT id FROM bookings WHERE member_id=? AND class_session_id=? AND booking_status IN ('Aktif','Waitlist')").get(body.member_id, cls.id))
          throw new Error('Member sudah terdaftar di kelas ini.');

        if (body.member_package_id) {
          const mp = db.prepare('SELECT * FROM member_packages WHERE id=? AND member_id=?').get(body.member_package_id, body.member_id);
          if (!mp) throw new Error('Paket tidak sesuai dengan member.');
          if (mp.sessions_remaining < 1) throw new Error('Sesi paket sudah habis.');
          if (mp.expiry_date && mp.expiry_date < cls.class_date) throw new Error('Paket sudah kedaluwarsa.');
        }

        const active = countActive(cls.id);
        if (active >= cls.capacity) {
          // Add to waitlist
          const wlPos = countWaitlist(cls.id) + 1;
          body.booking_status   = 'Waitlist';
          body.waitlist_position = wlPos;
        } else {
          body.booking_status = body.booking_status || 'Aktif';
        }
      }

      const values = config.fields.map(f => (body[f] === undefined || body[f] === '') ? null : body[f]);
      const info   = db.prepare(`INSERT INTO ${config.table} (${config.fields.join(',')}) VALUES (${config.fields.map(() => '?').join(',')})`).run(...values);
      log(resource, info.lastInsertRowid, 'create');
      res.json(db.prepare(`SELECT * FROM ${config.table} WHERE id=?`).get(info.lastInsertRowid));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  /* UPDATE */
  app.patch('/api/' + resource + '/:id', requireAuth, (req, res) => {
    const id       = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM ${config.table} WHERE id=?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    const merged = { ...existing, ...(req.body || {}) };
    try {
      if (resource === 'sessions') {
        if (coachConflict(merged, id)) throw new Error('Coach sudah dijadwalkan di kelas lain pada waktu yang sama.');
        const activeCount = countActive(id);
        if (Number(merged.capacity) < activeCount) throw new Error(`Kapasitas tidak boleh kurang dari ${activeCount} booking aktif yang sudah ada.`);
        merged.coach_changed = (merged.actual_coach_id && merged.actual_coach_id !== merged.scheduled_coach_id) ? 1 : 0;
      }

      if (resource === 'bookings') {
        const cls = db.prepare('SELECT * FROM class_sessions WHERE id=?').get(merged.class_session_id);
        if (!cls) throw new Error('Jadwal kelas tidak ditemukan.');

        const tx = db.transaction(() => {
          /* Mark attendance → deduct session */
          if (merged.attendance_status === 'Hadir' && existing.attendance_status !== 'Hadir' && !existing.session_deducted) {
            if (merged.member_package_id) {
              const mp = db.prepare('SELECT * FROM member_packages WHERE id=?').get(merged.member_package_id);
              if (!mp || mp.sessions_remaining < 1) throw new Error('Sesi paket tidak mencukupi.');
              if (mp.expiry_date && mp.expiry_date < cls.class_date) throw new Error('Paket sudah kedaluwarsa.');
              const validity = db.prepare('SELECT validity_days FROM packages WHERE id=?').get(mp.package_id)?.validity_days || 30;
              const expiry = mp.expiry_date || (() => {
                const d = new Date(cls.class_date + 'T00:00:00+07:00');
                d.setDate(d.getDate() + validity);
                return d.toISOString().slice(0, 10);
              })();
              db.prepare(`UPDATE member_packages SET
                sessions_remaining = sessions_remaining - 1,
                activation_date = COALESCE(activation_date, ?),
                expiry_date = COALESCE(expiry_date, ?),
                status = CASE WHEN sessions_remaining - 1 <= 0 THEN 'Habis' ELSE 'Aktif' END
                WHERE id=?`).run(cls.class_date, expiry, mp.id);
              merged.session_deducted = 1;
            }
            merged.booking_status = 'Selesai';
            merged.attendance_status = 'Hadir';
          }

          /* Undo attendance → restore session */
          if (merged.attendance_status !== 'Hadir' && existing.attendance_status === 'Hadir' && existing.session_deducted) {
            if (existing.member_package_id) {
              db.prepare("UPDATE member_packages SET sessions_remaining = MIN(sessions_purchased, sessions_remaining + 1), status = 'Aktif' WHERE id=?").run(existing.member_package_id);
              merged.session_deducted = 0;
            }
            if (merged.booking_status === 'Selesai') merged.booking_status = 'Aktif';
          }

          /* cancellation via patch */
          if (merged.booking_status === 'Dibatalkan' && existing.booking_status !== 'Dibatalkan') {
            if (existing.attendance_status !== 'Hadir' && !existing.session_deducted && existing.member_package_id) {
              const startDt  = new Date(`${cls.class_date}T${cls.start_time}:00+07:00`);
              const hoursDiff = (startDt - new Date()) / 3600000;
              const settings  = getSettings();
              const forfeitH  = settings.cancel_forfeit_hours ?? 3;
              if (hoursDiff <= forfeitH) {
                db.prepare("UPDATE member_packages SET sessions_remaining = MAX(0, sessions_remaining - 1), status = CASE WHEN sessions_remaining - 1 <= 0 THEN 'Habis' ELSE status END WHERE id=?").run(existing.member_package_id);
                merged.cancellation_rule = 'forfeit';
              } else {
                merged.cancellation_rule = 'no_forfeit';
              }
            }
            merged.cancelled_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
            setTimeout(() => promoteWaitlist(existing.class_session_id), 50);
          }

          /* reminder */
          if (merged.reminder_status === 'Sudah di-reminder' && existing.reminder_status !== 'Sudah di-reminder')
            merged.reminded_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

          const sets = config.fields.map(f => `${f}=?`).join(',');
          db.prepare(`UPDATE ${config.table} SET ${sets} WHERE id=?`).run(...config.fields.map(f => merged[f] ?? null), id);
        });
        tx();
      } else {
        const sets = config.fields.map(f => `${f}=?`).join(',');
        db.prepare(`UPDATE ${config.table} SET ${sets} WHERE id=?`).run(...config.fields.map(f => merged[f] ?? null), id);
      }

      log(resource, id, 'update');
      res.json(db.prepare(`SELECT * FROM ${config.table} WHERE id=?`).get(id));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  /* DELETE */
  app.delete('/api/' + resource + '/:id', requireAuth, (req, res) => {
    try {
      const info = db.prepare(`DELETE FROM ${config.table} WHERE id=?`).run(Number(req.params.id));
      if (!info.changes) return res.status(404).json({ error: 'Data tidak ditemukan.' });
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: 'Data tidak dapat dihapus karena masih digunakan data lain.' }); }
  });
}

/* ─────────────────────── SPECIAL BOOKING ACTIONS ─────────────────────── */

/* Cancel with 3h rule */
app.post('/api/bookings/:id/cancel', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { note } = req.body || {};
  try {
    const tx = db.transaction(() => {
      const b   = db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
      if (!b) throw new Error('Booking tidak ditemukan.');
      if (b.booking_status === 'Dibatalkan') throw new Error('Booking sudah dibatalkan.');

      const cls = db.prepare('SELECT * FROM class_sessions WHERE id=?').get(b.class_session_id);
      const settings  = getSettings();
      const forfeitH  = settings.cancel_forfeit_hours ?? 3;
      const startDt   = new Date(`${cls.class_date}T${cls.start_time}:00+07:00`);
      const hoursDiff = (startDt - new Date()) / 3600000;

      let rule = 'no_forfeit';
      if (b.attendance_status !== 'Hadir' && !b.session_deducted && b.member_package_id) {
        if (hoursDiff <= forfeitH) {
          rule = 'forfeit';
          db.prepare("UPDATE member_packages SET sessions_remaining = MAX(0, sessions_remaining - 1), status = CASE WHEN sessions_remaining - 1 <= 0 THEN 'Habis' ELSE status END WHERE id=?").run(b.member_package_id);
        }
      }

      db.prepare(`UPDATE bookings SET booking_status='Dibatalkan', attendance_status='Dibatalkan',
        cancelled_at=datetime('now','localtime'), cancellation_note=?, cancellation_rule=? WHERE id=?`)
        .run(note || '', rule, id);
      log('booking', id, 'cancel', rule);
      promoteWaitlist(b.class_session_id);
      return { rule };
    });
    const result = tx();
    res.json({ ok: true, ...result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* Reschedule */
app.post('/api/bookings/:id/reschedule', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { new_session_id, note } = req.body || {};
  if (!new_session_id) return res.status(400).json({ error: 'new_session_id wajib diisi.' });
  try {
    const tx = db.transaction(() => {
      const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
      if (!b) throw new Error('Booking tidak ditemukan.');
      if (b.booking_status === 'Dibatalkan') throw new Error('Booking sudah dibatalkan.');

      const newSess = db.prepare('SELECT * FROM class_sessions WHERE id=?').get(new_session_id);
      if (!newSess) throw new Error('Jadwal tujuan tidak ditemukan.');
      if (newSess.status === 'Unavailable') throw new Error('Jadwal tujuan tidak tersedia.');
      if (Number(new_session_id) === b.class_session_id) throw new Error('Jadwal tujuan sama dengan jadwal saat ini.');

      // Check H-1 cutoff for new session
      const settings = getSettings();
      const cutoffH  = settings.booking_cutoff_hours || 24;
      const classTime = new Date(`${newSess.class_date}T${newSess.start_time}:00+07:00`);
      if ((classTime - new Date()) < cutoffH * 3600 * 1000)
        throw new Error(`Reschedule hanya bisa ke kelas minimal ${cutoffH} jam ke depan.`);

      // Check duplicate
      if (db.prepare("SELECT id FROM bookings WHERE member_id=? AND class_session_id=? AND booking_status IN ('Aktif','Waitlist')").get(b.member_id, new_session_id))
        throw new Error('Member sudah terdaftar di jadwal tujuan.');

      // Check capacity / put in waitlist
      const active = countActive(new_session_id);
      const newStatus = active >= newSess.capacity ? 'Waitlist' : 'Aktif';
      const wlPos    = newStatus === 'Waitlist' ? countWaitlist(new_session_id) + 1 : null;

      // Cancel old booking without forfeit
      db.prepare(`UPDATE bookings SET booking_status='Dibatalkan', attendance_status='Dibatalkan',
        cancelled_at=datetime('now','localtime'), cancellation_note=?, cancellation_rule='reschedule' WHERE id=?`)
        .run(`Reschedule ke ${newSess.class_date} ${newSess.start_time}`, id);

      promoteWaitlist(b.class_session_id);

      // Create new booking
      const newId = db.prepare(`INSERT INTO bookings
        (member_id, class_session_id, member_package_id, booking_status, payment_status,
         reminder_status, rescheduled_from_id, waitlist_position, admin_notes)
        VALUES (?,?,?,?,?,?,?,?,?)`
      ).run(
        b.member_id, new_session_id, b.member_package_id, newStatus,
        b.payment_status, b.reminder_status, id, wlPos,
        note || `Reschedule dari booking #${id}`
      ).lastInsertRowid;

      log('booking', id, 'reschedule', `-> ${newId}`);
      return { new_booking_id: newId, status: newStatus };
    });
    res.json({ ok: true, ...tx() });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ─────────────────────── SETTINGS ─────────────────────── */
app.get('/api/settings', requireAuth, (req, res) => res.json(getSettings()));
app.patch('/api/settings', requireAuth, (req, res) => {
  const { studio_name, bank_name, bank_account_name, bank_account_number, whatsapp_number, booking_cutoff_hours, cancel_forfeit_hours } = req.body;
  db.prepare(`UPDATE studio_settings SET
    studio_name=COALESCE(?,studio_name), bank_name=COALESCE(?,bank_name),
    bank_account_name=COALESCE(?,bank_account_name), bank_account_number=COALESCE(?,bank_account_number),
    whatsapp_number=COALESCE(?,whatsapp_number), booking_cutoff_hours=COALESCE(?,booking_cutoff_hours),
    cancel_forfeit_hours=COALESCE(?,cancel_forfeit_hours) WHERE id=1`
  ).run(
    studio_name || null, bank_name || null, bank_account_name || null,
    bank_account_number || null, whatsapp_number || null,
    booking_cutoff_hours || null, cancel_forfeit_hours || null
  );
  res.json(getSettings());
});

/* ─────────────────────── SPA FALLBACK ─────────────────────── */
app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Kinara Admin berjalan di http://localhost:${port}`));
