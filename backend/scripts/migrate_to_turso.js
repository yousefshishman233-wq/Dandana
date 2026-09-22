/**
 * Migration Script: SQLite → Turso Cloud
 * Migrates all tables and data from local denden.db to Turso
 */

const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@libsql/client');
const path = require('path');

const TURSO_URL   = 'libsql://dandana-yousefshishman233-wq.aws-us-west-2.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTAwOTE5OTQsImlkIjoiMDFhMGM5Y2ItMDQwMS03MzM0LThmNDktYTU3ZGY0ZDlhZDk3Iiwia2lkIjoiT0Z5UThkaEVheHllTllBWXZYRVhhUWRiak9IcUx6SjR1cWhsT0JMWmhHNCIsInJpZCI6IjMzMGQzNzI5LWRjMmEtNGZhZC1hZjBkLTc2ZGU2ZDJmZTU2OCJ9.6jKK_tr4jwPOJC90mwQDxAbJhfTshJ_OxwzJotrIQq8FmknsZ1T3X2pN-YBWyDW6iQ8lT-v0X5IVPK6M8cLmBw';

const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
const localDb = new sqlite3.Database(path.join(__dirname, '..', 'denden.db'));

function localAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    localDb.all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

async function run(sql, args = []) {
  try {
    await turso.execute({ sql, args });
  } catch (e) {
    console.error('  ERROR:', e.message.substring(0, 120));
  }
}

async function migrate() {
  console.log('🚀 Starting migration to Turso...\n');

  // ── 1. Create all tables ─────────────────────────────────────────────────
  console.log('📋 Creating tables...');

  await run('PRAGMA foreign_keys = OFF');

  await run(`CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    shift_start_time TEXT DEFAULT '09:00',
    grace_period_minutes INTEGER DEFAULT 15,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    salary REAL DEFAULT 0,
    branch_id INTEGER REFERENCES branches(id),
    fingerprint TEXT,
    can_manage_leaves INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    clock_in TEXT,
    clock_out TEXT,
    status TEXT DEFAULT 'present',
    branch_id INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL DEFAULT 0,
    stock REAL DEFAULT 0,
    unit TEXT DEFAULT 'piece',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    total REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity REAL DEFAULT 1,
    price REAL DEFAULT 0
  )`);

  await run(`CREATE TABLE IF NOT EXISTS advances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount REAL NOT NULL,
    note TEXT,
    type TEXT DEFAULT 'advance',
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    amount REAL NOT NULL,
    reason TEXT,
    type TEXT DEFAULT 'expense',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    leave_type TEXT DEFAULT 'leave',
    start_date TEXT NOT NULL,
    end_date TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER REFERENCES users(id),
    message TEXT,
    media_url TEXT,
    media_type TEXT DEFAULT 'text',
    type TEXT DEFAULT 'text',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    title TEXT,
    body TEXT,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS audit_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT DEFAULT 'piece',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS audit_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER REFERENCES audits(id),
    item_id INTEGER REFERENCES audit_items(id),
    quantity REAL DEFAULT 0,
    notes TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS factory_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    recipient TEXT,
    branch_id INTEGER REFERENCES branches(id),
    note TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS factory_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES factory_orders(id),
    item_name TEXT,
    quantity REAL DEFAULT 0,
    unit TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS ice_cream_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS ice_cream_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES ice_cream_orders(id),
    product_name TEXT,
    quantity REAL DEFAULT 0
  )`);

  await run(`CREATE TABLE IF NOT EXISTS salary_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount REAL NOT NULL,
    reason TEXT,
    type TEXT DEFAULT 'advance',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('  ✅ All tables created\n');

  // ── 2. Migrate data table by table ───────────────────────────────────────
  const tables = [
    'branches', 'users', 'products', 'attendance',
    'advances', 'expenses', 'leaves', 'messages',
    'notifications', 'orders', 'order_items',
    'audit_items', 'audits', 'audit_entries',
    'factory_orders', 'factory_order_items',
    'ice_cream_orders', 'ice_cream_order_items',
    'salary_adjustments'
  ];

  for (const table of tables) {
    let rows;
    try {
      rows = await localAll(`SELECT * FROM ${table}`);
    } catch (e) {
      console.log(`  ⚠️  ${table}: table not found locally, skipping`);
      continue;
    }

    if (rows.length === 0) {
      console.log(`  ○  ${table}: empty`);
      continue;
    }

    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;

    let ok = 0, fail = 0;
    for (const row of rows) {
      const args = cols.map(c => {
        const v = row[c];
        if (v === null || v === undefined) return null;
        return v;
      });
      try {
        await turso.execute({ sql, args });
        ok++;
      } catch (e) {
        fail++;
        if (fail <= 2) console.error(`    ↳ row fail: ${e.message.substring(0, 100)}`);
      }
    }
    console.log(`  ✅ ${table}: ${ok} rows migrated${fail ? ` (${fail} skipped)` : ''}`);
  }

  console.log('\n🎉 Migration complete!');
  console.log('📊 Verifying...');

  const userCount = await turso.execute('SELECT COUNT(*) as c FROM users');
  const branchCount = await turso.execute('SELECT COUNT(*) as c FROM branches');
  console.log(`  Users in Turso: ${userCount.rows[0].c}`);
  console.log(`  Branches in Turso: ${branchCount.rows[0].c}`);

  localDb.close();
  process.exit(0);
}

migrate().catch(e => { console.error('FATAL:', e); process.exit(1); });
