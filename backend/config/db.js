const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');
const sqlite3 = require('sqlite3').verbose();

const rawUrl = process.env.TURSO_DATABASE_URL || 'https://dandana-yousefshishman233-wq.aws-us-west-2.turso.io';
const TURSO_URL = rawUrl.replace(/^libsql:\/\//, 'https://');
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTAwOTE5OTQsImlkIjoiMDFhMGM5Y2ItMDQwMS03MzM0LThmNDktYTU3ZGY0ZDlhZDk3Iiwia2lkIjoiT0Z5UThkaEVheHllTllBWXZYRVhhUWRiak9IcUx6SjR1cWhsT0JMWmhHNCIsInJpZCI6IjMzMGQzNzI5LWRjMmEtNGZhZC1hZjBkLTc2ZGU2ZDJmZTU2OCJ9.6jKK_tr4jwPOJC90mwQDxAbJhfTshJ_OxwzJotrIQq8FmknsZ1T3X2pN-YBWyDW6iQ8lT-v0X5IVPK6M8cLmBw';

let db;

if (TURSO_URL && TURSO_TOKEN) {
  console.log('Connecting to Turso Cloud database at', TURSO_URL);
  const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  function toPlain(row) {
    if (!row) return null;
    return JSON.parse(JSON.stringify(row));
  }

  db = {
    isTurso: true,
    run(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      client.execute({ sql, args: params || [] })
        .then(res => {
          if (callback) {
            callback.call({
              lastID: res.lastInsertRowid !== undefined ? Number(res.lastInsertRowid) : 0,
              changes: res.rowsAffected || 0
            }, null);
          }
        })
        .catch(err => {
          console.error('Turso run error:', err.message, 'SQL:', sql);
          if (callback) callback(err);
        });
    },
    get(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      client.execute({ sql, args: params || [] })
        .then(res => {
          const row = res.rows && res.rows.length ? toPlain(res.rows[0]) : null;
          if (callback) callback(null, row);
        })
        .catch(err => {
          console.error('Turso get error:', err.message, 'SQL:', sql);
          if (callback) callback(err);
        });
    },
    all(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      client.execute({ sql, args: params || [] })
        .then(res => {
          const rows = (res.rows || []).map(r => toPlain(r));
          if (callback) callback(null, rows);
        })
        .catch(err => {
          console.error('Turso all error:', err.message, 'SQL:', sql);
          if (callback) callback(err);
        });
    },
    serialize(fn) { if (fn) fn(); },
    configure() {}
  };
} else {
  // Support writable DB in Serverless environments (like Vercel /tmp)
  let dbPath = path.join(__dirname, '..', 'denden.db');
  if (process.env.VERCEL) {
    const tmpDb = path.join('/tmp', 'denden.db');
    try {
      if (!fs.existsSync(tmpDb) && fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, tmpDb);
      }
      dbPath = tmpDb;
    } catch (e) {
      console.warn('Error copying DB to /tmp:', e);
    }
  }

  // Create local database connection
  const localDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to SQLite database at', dbPath);
  });
  localDb.configure('busyTimeout', 5000);
  localDb.serialize(() => {
    localDb.run('PRAGMA foreign_keys = ON');
    localDb.run('PRAGMA journal_mode = WAL');
  });
  db = localDb;
}

const BRANCHES = [
  'شارع السنترال',
  'نادي قارون',
  'نادي المحافظة',
  'الحديقة الدولية',
  'باغوص',
  'الجون',
  'الممشى السياحي'
];

const INITIAL_INVENTORY_ITEMS = [
  // أصناف الآيس كريم
  { name: 'شوكولاتة', category: 'ice_cream', unit: 'جالون' },
  { name: 'فانيليا', category: 'ice_cream', unit: 'جالون' },
  { name: 'مانجو', category: 'ice_cream', unit: 'جالون' },
  { name: 'فراولة', category: 'ice_cream', unit: 'جالون' },
  { name: 'توت أحمر', category: 'ice_cream', unit: 'جالون' },
  { name: 'توت أزرق', category: 'ice_cream', unit: 'جالون' },
  { name: 'هاواي', category: 'ice_cream', unit: 'جالون' },
  { name: 'أناناس', category: 'ice_cream', unit: 'جالون' },
  { name: 'بلح عسل', category: 'ice_cream', unit: 'جالون' },
  { name: 'تين شوكي', category: 'ice_cream', unit: 'جالون' },
  { name: 'جوافة', category: 'ice_cream', unit: 'جالون' },
  { name: 'موز', category: 'ice_cream', unit: 'جالون' },
  { name: 'يوسفي', category: 'ice_cream', unit: 'جالون' },
  { name: 'بطيخ', category: 'ice_cream', unit: 'جالون' },
  { name: 'نسكافيه', category: 'ice_cream', unit: 'جالون' },
  { name: 'نوتيلا', category: 'ice_cream', unit: 'جالون' },
  { name: 'فسدق', category: 'ice_cream', unit: 'جالون' },
  { name: 'بندق', category: 'ice_cream', unit: 'جالون' },
  { name: 'كراميل', category: 'ice_cream', unit: 'جالون' },
  { name: 'كيندر', category: 'ice_cream', unit: 'جالون' },
  { name: 'لوتس', category: 'ice_cream', unit: 'جالون' },
  { name: 'أوريو', category: 'ice_cream', unit: 'جالون' },
  { name: 'رافيلو', category: 'ice_cream', unit: 'جالون' },
  { name: 'زبادي رمان', category: 'ice_cream', unit: 'جالون' },

  // المستلزمات والعلب والأدوات
  { name: 'معالق آيس كريم', category: 'supplies', unit: 'باكيت' },
  { name: 'لفات علب 1 بولة', category: 'supplies', unit: 'لفة' },
  { name: 'لفات علب 2 بولة', category: 'supplies', unit: 'لفة' },
  { name: 'لفات علب 3 بولة', category: 'supplies', unit: 'لفة' },
  { name: 'لفات علب نص كيلو', category: 'supplies', unit: 'لفة' },
  { name: 'لفات علب كيلو', category: 'supplies', unit: 'لفة' },
  { name: 'لفات استرتش', category: 'supplies', unit: 'لفة' },
  { name: 'لفات بكر كاشير', category: 'supplies', unit: 'لفة' },
  { name: 'أكياس دندنه صغير', category: 'supplies', unit: 'باكيت' },
  { name: 'أكياس دندنه كبير', category: 'supplies', unit: 'باكيت' },
  { name: 'بارنيكة بسكوت', category: 'supplies', unit: 'بارنيكة' },
];

// Initialize database tables
const initializeDB = () => {
  db.serialize(() => {

    // Branches table
    db.run(`CREATE TABLE IF NOT EXISTS branches (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed branches
    BRANCHES.forEach(name => {
      db.run('INSERT OR IGNORE INTO branches (name) VALUES (?)', [name]);
    });

    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      full_name   TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'employee',
      branch_id   INTEGER,
      fingerprint TEXT,
      salary      REAL DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (branch_id) REFERENCES branches(id)
    )`);

    db.run(`ALTER TABLE users ADD COLUMN branch_id INTEGER REFERENCES branches(id)`, () => {});

    // Attendance table
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id  INTEGER NOT NULL,
      date     TEXT NOT NULL,
      clock_in TEXT,
      clock_out TEXT,
      status   TEXT CHECK(status IN ('present', 'absent', 'late', 'on_leave')) DEFAULT 'present',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Advances table
    db.run(`CREATE TABLE IF NOT EXISTS advances (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL,
      amount       REAL NOT NULL,
      reason       TEXT,
      date         TEXT NOT NULL,
      is_paid_back INTEGER DEFAULT 0,
      type         TEXT DEFAULT 'advance',
      status       TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
      issued_by    INTEGER,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (issued_by) REFERENCES users(id)
    )`);

    db.run(`ALTER TABLE advances ADD COLUMN type TEXT DEFAULT 'advance'`, () => {});
    db.run(`ALTER TABLE advances ADD COLUMN issued_by INTEGER REFERENCES users(id)`, () => {});
    db.run(`ALTER TABLE advances ADD COLUMN status TEXT DEFAULT 'approved'`, () => {});
    db.run(`ALTER TABLE advances ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {});

    // Products table
    db.run(`CREATE TABLE IF NOT EXISTS products (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      price      REAL NOT NULL,
      stock      REAL DEFAULT 0,
      unit       TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Orders table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id   INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      discount     REAL DEFAULT 0,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Order items table
    db.run(`CREATE TABLE IF NOT EXISTS order_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity   REAL NOT NULL,
      price      REAL NOT NULL,
      FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // ─── NEW: Inventory Audit & Factory Order Tables ───
    db.run(`CREATE TABLE IF NOT EXISTS inventory_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT UNIQUE NOT NULL,
      category      TEXT CHECK(category IN ('ice_cream', 'supplies')) NOT NULL,
      unit          TEXT NOT NULL DEFAULT 'كيلو',
      current_stock REAL DEFAULT 0,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed initial inventory items
    INITIAL_INVENTORY_ITEMS.forEach(item => {
      db.run('INSERT OR IGNORE INTO inventory_items (name, category, unit) VALUES (?, ?, ?)', [item.name, item.category, item.unit]);
    });

    // Inventory Audits History
    db.run(`CREATE TABLE IF NOT EXISTS inventory_audits (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      branch_id  INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Audit Item Records
    db.run(`CREATE TABLE IF NOT EXISTS inventory_audit_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id    INTEGER NOT NULL,
      item_name   TEXT NOT NULL,
      category    TEXT NOT NULL,
      counted_qty REAL NOT NULL,
      unit        TEXT NOT NULL,
      FOREIGN KEY (audit_id) REFERENCES inventory_audits(id) ON DELETE CASCADE
    )`);

    // Factory Orders (طلبية المصنع)
    db.run(`CREATE TABLE IF NOT EXISTS factory_orders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      branch_id  INTEGER,
      recipient  TEXT DEFAULT 'driver',
      status     TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'delivered')) DEFAULT 'pending',
      note       TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`ALTER TABLE attendance ADD COLUMN branch_id INTEGER REFERENCES branches(id)`, () => {});
    db.run(`ALTER TABLE factory_orders ADD COLUMN recipient TEXT DEFAULT 'driver'`, () => {});

    // Factory Order Item Items
    db.run(`CREATE TABLE IF NOT EXISTS factory_order_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id        INTEGER NOT NULL,
      item_name       TEXT NOT NULL,
      available_stock REAL DEFAULT 0,
      requested_qty   REAL NOT NULL,
      unit            TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES factory_orders(id) ON DELETE CASCADE
    )`);

    // Leaves table
    db.run(`CREATE TABLE IF NOT EXISTS leaves (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      leave_type TEXT NOT NULL DEFAULT 'leave',
      start_date TEXT NOT NULL,
      end_date   TEXT NOT NULL,
      reason     TEXT,
      status     TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Messages table
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id  INTEGER NOT NULL,
      message    TEXT NOT NULL,
      type       TEXT DEFAULT 'text',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Salary deductions tracking
    db.run(`CREATE TABLE IF NOT EXISTS salary_deductions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER NOT NULL,
      month_year        TEXT NOT NULL,
      advance_deduction REAL DEFAULT 0,
      order_commission  REAL DEFAULT 0,
      total_deduction   REAL DEFAULT 0,
      net_salary        REAL DEFAULT 0,
      calculated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Cashier Shift Expenses
    db.run(`CREATE TABLE IF NOT EXISTS shift_expenses (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id INTEGER NOT NULL,
      amount     REAL NOT NULL,
      reason     TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Cashier Shift Sales (Manual Entry)
    db.run(`CREATE TABLE IF NOT EXISTS shift_sales (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id INTEGER NOT NULL,
      amount     REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Schema extensions for new capabilities
    db.run(`ALTER TABLE branches ADD COLUMN shift_start_time TEXT DEFAULT '09:00'`, () => {});
    db.run(`ALTER TABLE branches ADD COLUMN grace_period_minutes INTEGER DEFAULT 15`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN can_manage_leaves INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE messages ADD COLUMN media_url TEXT`, () => {});
    db.run(`ALTER TABLE messages ADD COLUMN media_type TEXT DEFAULT 'text'`, () => {});

    // Carried Debts tracking across months
    db.run(`CREATE TABLE IF NOT EXISTS carried_debts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      from_month TEXT NOT NULL,
      to_month   TEXT NOT NULL,
      amount     REAL NOT NULL,
      is_cleared INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Notifications table (for late arrivals, approvals, alerts)
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER,
      title      TEXT NOT NULL,
      message    TEXT NOT NULL,
      type       TEXT DEFAULT 'info',
      is_read    INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run('CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date)');
    db.run('CREATE INDEX IF NOT EXISTS idx_advances_user_date ON advances(user_id, date)');
    db.run('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)');

    console.log('Database tables initialized successfully');
  });
};

module.exports = { db, initializeDB, BRANCHES };