const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'kinara.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  status TEXT DEFAULT 'Aktif',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coaches (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS class_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  default_capacity INTEGER DEFAULT 7,
  duration_minutes INTEGER DEFAULT 60,
  active INTEGER DEFAULT 1,
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS class_sessions (
  id INTEGER PRIMARY KEY,
  class_type_id INTEGER,
  class_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  capacity INTEGER DEFAULT 7,
  scheduled_coach_id INTEGER,
  actual_coach_id INTEGER,
  coach_changed INTEGER DEFAULT 0,
  coach_change_note TEXT DEFAULT '',
  admin_notes TEXT DEFAULT '',
  status TEXT DEFAULT 'Available',
  FOREIGN KEY(class_type_id) REFERENCES class_types(id) ON DELETE SET NULL,
  FOREIGN KEY(scheduled_coach_id) REFERENCES coaches(id) ON DELETE SET NULL,
  FOREIGN KEY(actual_coach_id) REFERENCES coaches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT DEFAULT '',
  category TEXT DEFAULT 'regular',
  session_count INTEGER DEFAULT 1,
  price INTEGER DEFAULT 0,
  validity_days INTEGER DEFAULT 30,
  description TEXT DEFAULT '',
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS member_packages (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL,
  package_id INTEGER NOT NULL,
  purchase_date TEXT DEFAULT (date('now','localtime')),
  sessions_purchased INTEGER NOT NULL,
  sessions_remaining INTEGER NOT NULL,
  activation_date TEXT,
  expiry_date TEXT,
  status TEXT DEFAULT 'Belum Aktif',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY(package_id) REFERENCES packages(id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL,
  class_session_id INTEGER NOT NULL,
  member_package_id INTEGER,
  booking_status TEXT DEFAULT 'Aktif',
  attendance_status TEXT DEFAULT 'Belum Hadir',
  session_deducted INTEGER DEFAULT 0,
  payment_status TEXT DEFAULT 'Waiting',
  reminder_status TEXT DEFAULT 'Belum di-reminder',
  reminded_at TEXT,
  waitlist_position INTEGER,
  cancelled_at TEXT,
  cancellation_note TEXT DEFAULT '',
  cancellation_rule TEXT DEFAULT '',
  rescheduled_from_id INTEGER,
  admin_notes TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(member_id) REFERENCES members(id),
  FOREIGN KEY(class_session_id) REFERENCES class_sessions(id),
  FOREIGN KEY(member_package_id) REFERENCES member_packages(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL,
  member_package_id INTEGER,
  amount_due INTEGER DEFAULT 0,
  amount_paid INTEGER DEFAULT 0,
  payment_status TEXT DEFAULT 'Waiting',
  payment_method TEXT DEFAULT 'Transfer',
  paid_at TEXT DEFAULT '',
  reference_note TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY(member_package_id) REFERENCES member_packages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  related_to TEXT DEFAULT 'Umum',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS studio_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  studio_name TEXT DEFAULT 'Kinara Pilates',
  bank_name TEXT DEFAULT '',
  bank_account_name TEXT DEFAULT '',
  bank_account_number TEXT DEFAULT '',
  whatsapp_number TEXT DEFAULT '',
  booking_cutoff_hours INTEGER DEFAULT 24,
  cancel_forfeit_hours INTEGER DEFAULT 3
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY,
  entity_type TEXT,
  entity_id INTEGER,
  action TEXT,
  details TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings(class_session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_member ON bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON class_sessions(class_date);
CREATE INDEX IF NOT EXISTS idx_mp_member ON member_packages(member_id);
`);

/* ── live migrations for existing DBs ── */
const cols = (tbl) => db.pragma(`table_info(${tbl})`).map(c => c.name);
const addCol = (tbl, col, def) => {
  if (!cols(tbl).includes(col))
    db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def}`);
};
addCol('packages',   'category',          "TEXT DEFAULT 'regular'");
addCol('bookings',   'session_deducted',   'INTEGER DEFAULT 0');
addCol('bookings',   'waitlist_position',  'INTEGER');
addCol('bookings',   'cancellation_rule',  "TEXT DEFAULT ''");
addCol('bookings',   'rescheduled_from_id','INTEGER');
addCol('class_sessions', 'coach_changed',  'INTEGER DEFAULT 0');
addCol('members',    'email',              "TEXT DEFAULT ''");
addCol('coaches',    'phone',              "TEXT DEFAULT ''");
addCol('studio_settings', 'whatsapp_number',     "TEXT DEFAULT ''");
addCol('studio_settings', 'booking_cutoff_hours', 'INTEGER DEFAULT 24');
addCol('studio_settings', 'cancel_forfeit_hours', 'INTEGER DEFAULT 3');

// ── Jadwal rutin coach ──
db.exec(`
  CREATE TABLE IF NOT EXISTS coach_schedules (
    id INTEGER PRIMARY KEY,
    coach_id INTEGER NOT NULL,
    class_type_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    capacity INTEGER DEFAULT 7,
    active INTEGER DEFAULT 1,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
    FOREIGN KEY(class_type_id) REFERENCES class_types(id) ON DELETE CASCADE,

    CHECK(day_of_week BETWEEN 0 AND 6),
    CHECK(start_time < end_time)
  );

  CREATE INDEX IF NOT EXISTS idx_coach_schedules_day
  ON coach_schedules(day_of_week);

  CREATE INDEX IF NOT EXISTS idx_coach_schedules_coach
  ON coach_schedules(coach_id);
`);

/* ── seed default admin ── */
const username = process.env.ADMIN_USERNAME || 'asya';
const password = process.env.ADMIN_PASSWORD || 'Kinara123!';
if (!db.prepare('SELECT id FROM admins WHERE username=?').get(username)) {
  db.prepare('INSERT INTO admins(username,password_hash) VALUES(?,?)')
    .run(username, bcrypt.hashSync(password, 12));
}

db.prepare("INSERT OR IGNORE INTO studio_settings(id,studio_name) VALUES(1,'Kinara Pilates')").run();

/* ── seed sample packages if empty ── */
if (db.prepare('SELECT COUNT(*) n FROM packages').get().n === 0) {
  const ins = db.prepare('INSERT INTO packages(name,code,category,session_count,price,validity_days,description) VALUES(?,?,?,?,?,?,?)');
  [
    ['Single Session Reformer', 'REF-1',   'regular', 1,  180000, 30, '1 sesi Reformer'],
    ['Reformer 5x',             'REF-5',   'regular', 5,  850000, 60, '5 sesi Reformer'],
    ['Reformer 10x',            'REF-10',  'regular', 10,1600000, 90, '10 sesi Reformer'],
    ['Mat Pilates 1x',          'MAT-1',   'regular', 1,  100000, 30, '1 sesi Mat'],
    ['Mat Pilates 5x',          'MAT-5',   'regular', 5,  475000, 60, '5 sesi Mat'],
    ['Intro Offer 3x',          'INTRO',   'promo',   3,  399000, 30, 'Paket perkenalan member baru'],
    ['Payday Reformer 8x',      'PAY-REF', 'payday',  8, 1250000, 90, 'Paket Payday Reformer'],
    ['Payday Mat 8x',           'PAY-MAT', 'payday',  8,  700000, 90, 'Paket Payday Mat'],
  ].forEach(x => ins.run(...x));
}

module.exports = db;
