const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@libsql/client');
const path = require('path');

const TURSO_URL = 'libsql://dandana-yousefshishman233-wq.aws-us-west-2.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTAwOTE5OTQsImlkIjoiMDFhMGM5Y2ItMDQwMS03MzM0LThmNDktYTU3ZGY0ZDlhZDk3Iiwia2lkIjoiT0Z5UThkaEVheHllTllBWXZYRVhhUWRiak9IcUx6SjR1cWhsT0JMWmhHNCIsInJpZCI6IjMzMGQzNzI5LWRjMmEtNGZhZC1hZjBkLTc2ZGU2ZDJmZTU2OCJ9.6jKK_tr4jwPOJC90mwQDxAbJhfTshJ_OxwzJotrIQq8FmknsZ1T3X2pN-YBWyDW6iQ8lT-v0X5IVPK6M8cLmBw';

const DB_PATH = path.join('C:\\Users\\PanDa\\Desktop\\شيشمان\\backend', 'denden.db');

const localDb = new sqlite3.Database(DB_PATH);
const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    localDb.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS branches (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    shift_start_time TEXT DEFAULT '09:00',
    grace_period_minutes INTEGER DEFAULT 15,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    full_name   TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'employee',
    branch_id   INTEGER,
    fingerprint TEXT,
    salary      REAL DEFAULT 0,
    can_manage_leaves INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS attendance (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    date      TEXT NOT NULL,
    clock_in  TEXT,
    clock_out TEXT,
    branch_id INTEGER,
    status    TEXT DEFAULT 'present',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS advances (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    amount       REAL NOT NULL,
    reason       TEXT,
    date         TEXT NOT NULL,
    is_paid_back INTEGER DEFAULT 0,
    type         TEXT DEFAULT 'advance',
    status       TEXT DEFAULT 'approved',
    issued_by    INTEGER,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    price      REAL NOT NULL,
    stock      REAL DEFAULT 0,
    unit       TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    cashier_id   INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    discount     REAL DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity   REAL NOT NULL,
    price      REAL NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT UNIQUE NOT NULL,
    category      TEXT NOT NULL,
    unit          TEXT NOT NULL DEFAULT 'كيلو',
    current_stock REAL DEFAULT 0,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_audits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    branch_id  INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_audit_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id    INTEGER NOT NULL,
    item_name   TEXT NOT NULL,
    category    TEXT NOT NULL,
    counted_qty REAL NOT NULL,
    unit        TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS factory_orders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    branch_id  INTEGER,
    recipient  TEXT DEFAULT 'driver',
    status     TEXT DEFAULT 'pending',
    note       TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS factory_order_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL,
    item_name       TEXT NOT NULL,
    available_stock REAL DEFAULT 0,
    requested_qty   REAL NOT NULL,
    unit            TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS leaves (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    leave_type TEXT NOT NULL DEFAULT 'leave',
    start_date TEXT NOT NULL,
    end_date   TEXT NOT NULL,
    reason     TEXT,
    status     TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id  INTEGER NOT NULL,
    message    TEXT NOT NULL,
    type       TEXT DEFAULT 'text',
    media_url  TEXT,
    media_type TEXT DEFAULT 'text',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS salary_deductions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL,
    month_year        TEXT NOT NULL,
    advance_deduction REAL DEFAULT 0,
    order_commission  REAL DEFAULT 0,
    total_deduction   REAL DEFAULT 0,
    net_salary        REAL DEFAULT 0,
    calculated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS shift_expenses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    cashier_id INTEGER NOT NULL,
    amount     REAL NOT NULL,
    reason     TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS shift_sales (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    cashier_id INTEGER NOT NULL,
    amount     REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS carried_debts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    from_month TEXT NOT NULL,
    to_month   TEXT NOT NULL,
    amount     REAL NOT NULL,
    is_cleared INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    title      TEXT NOT NULL,
    message    TEXT NOT NULL,
    type       TEXT DEFAULT 'info',
    is_read    INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
];

const TABLES = [
  {
    name: 'branches',
    insert: (r) => ({
      sql: 'INSERT OR IGNORE INTO branches (id, name, shift_start_time, grace_period_minutes, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [r.id, r.name, r.shift_start_time || '09:00', r.grace_period_minutes || 15, r.created_at || new Date().toISOString()]
    })
  },
  {
    name: 'users',
    insert: (r) => ({
      sql: 'INSERT OR IGNORE INTO users (id, username, password, full_name, role, branch_id, fingerprint, salary, can_manage_leaves, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [r.id, r.username, r.password, r.full_name, r.role, r.branch_id || null, r.fingerprint || null, r.salary || 0, r.can_manage_leaves || 0, r.created_at || null, r.updated_at || null]
    })
  },
  {
    name: 'attendance',
    insert: (r) => ({
      sql: 'INSERT OR IGNORE INTO attendance (id, user_id, date, clock_in, clock_out, branch_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [r.id, r.user_id, r.date, r.clock_in || null, r.clock_out || null, r.branch_id || null, r.status || 'present']
    })
  },
  {
    name: 'advances',
    insert: (r) => ({
      sql: 'INSERT OR IGNORE INTO advances (id, user_id, amount, reason, date, is_paid_back, type, status, issued_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [r.id, r.user_id, r.amount, r.reason || null, r.date, r.is_paid_back || 0, r.type || 'advance', r.status || 'approved', r.issued_by || null, r.created_at || null]
    })
  },
  {
    name: 'products',
    insert: (r) => ({
      sql: 'INSERT OR IGNORE INTO products (id, name, price, stock, unit, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [r.id, r.name, r.price, r.stock || 0, r.unit, r.created_at || null]
    })
  },
  {
    name: 'orders',
    insert: (r) => ({
      sql: 'INSERT OR IGNORE INTO orders (id, cashier_id, total_amount, discount, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [r.id, r.cashier_id, r.total_amount, r.discount || 0, r.created_at || null]
    })
  },
  {
    name: 'order_items',
    insert: (r) => ({
      sql: 'INSERT OR IGNORE INTO order_items (id, order_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)',
      args: [r.id, r.order_id, r.product_id, r.quantity, r.price]
    })
  },
  {
    name: 'inventory_items',
    insert: (r) => ({
      sql: 'INSERT OR IGNORE INTO inventory_items (id, name, category, unit, current_stock, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [r.id, r.name, r.category, r.unit, r.current_stock || 0, r.updated_at || null]
    })
  },
  {
    name: 'leaves',
    insert: (r) => ({
      sql: 'INSERT OR IGNORE INTO leaves (id, user_id, leave_type, start_date, end_date, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [r.id, r.user_id, r.leave_type || 'leave', r.start_date, r.end_date || r.start_date, r.reason || null, r.status || 'pending', r.created_at || null]
    })
  },
  {
    name: 'messages',
    insert: (r) => ({
      sql: 'INSERT OR IGNORE INTO messages (id, sender_id, message, type, media_url, media_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [r.id, r.sender_id, r.message, r.type || 'text', r.media_url || null, r.media_type || 'text', r.created_at || null]
    })
  },
  {
    name: 'shift_expenses',
    insert: (r) => ({
      sql: 'INSERT OR IGNORE INTO shift_expenses (id, cashier_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [r.id, r.cashier_id, r.amount, r.reason, r.created_at || null]
    })
  },
  {
    name: 'shift_sales',
    insert: (r) => ({
      sql: 'INSERT OR IGNORE INTO shift_sales (id, cashier_id, amount, created_at) VALUES (?, ?, ?, ?)',
      args: [r.id, r.cashier_id, r.amount, r.created_at || null]
    })
  },
  {
    name: 'notifications',
    insert: (r) => ({
      sql: 'INSERT OR IGNORE INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [r.id, r.user_id || null, r.title, r.message, r.type || 'info', r.is_read || 0, r.created_at || null]
    })
  },
];

async function migrate() {
  console.log('=== Turso Migration Started ===\n');

  console.log('Step 1: Creating schema on Turso...');
  for (const sql of SCHEMA) {
    await turso.execute(sql);
  }
  console.log('Schema created OK.\n');

  console.log('Step 2: Migrating data...');
  for (const t of TABLES) {
    try {
      const rows = await getAll('SELECT * FROM ' + t.name);
      process.stdout.write('  ' + t.name + ' (' + rows.length + ' rows) ... ');
      let ok = 0, skip = 0;
      for (const row of rows) {
        try {
          const q = t.insert(row);
          await turso.execute(q);
          ok++;
        } catch (e) {
          if (e.message && e.message.includes('UNIQUE')) { skip++; }
          else { console.warn('\n    Row error:', e.message ? e.message.substring(0, 100) : e); }
        }
      }
      console.log('OK (' + ok + ' inserted, ' + skip + ' skipped)');
    } catch (e) {
      console.log('SKIP (table may not exist locally:', e.message ? e.message.substring(0, 60) : e, ')');
    }
  }

  console.log('\nStep 3: Verifying migration...');
  const userCount = await turso.execute('SELECT COUNT(*) as cnt FROM users');
  const branchCount = await turso.execute('SELECT COUNT(*) as cnt FROM branches');
  console.log('  Users on Turso:', userCount.rows[0].cnt);
  console.log('  Branches on Turso:', branchCount.rows[0].cnt);

  console.log('\n=== Migration Complete! ===');
  localDb.close();
  process.exit(0);
}

migrate().catch(e => {
  console.error('\nMigration FAILED:', e);
  process.exit(1);
});
