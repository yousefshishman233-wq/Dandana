/**
 * db.js — Turso Cloud Database (libsql)
 *
 * Uses Turso when TURSO_DB_URL is set (production on Vercel),
 * falls back to local SQLite file for local development.
 *
 * Exposes a `db` object whose API is 100% compatible with the
 * sqlite3 callback-based API, so no other file needs changing.
 */

const { createClient } = require('@libsql/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// ── Connection ──────────────────────────────────────────────────────────────
let db;
let isTurso = false;

if (process.env.TURSO_DB_URL && process.env.TURSO_DB_TOKEN) {
  // ── TURSO (production) ──
  isTurso = true;
  const tursoClient = createClient({
    url: process.env.TURSO_DB_URL,
    authToken: process.env.TURSO_DB_TOKEN,
  });

  console.log('Connected to Turso cloud database');

  // sqlite3-compatible wrapper around @libsql/client
  db = {
    _client: tursoClient,

    // db.run(sql, [params], [callback])
    run(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      if (!Array.isArray(params)) params = params ? Object.values(params) : [];

      tursoClient.execute({ sql, args: params })
        .then(result => {
          if (callback) {
            callback.call(
              { lastID: Number(result.lastInsertRowid ?? 0), changes: result.rowsAffected ?? 0 },
              null
            );
          }
        })
        .catch(err => {
          console.error('[Turso run error]', sql.substring(0, 80), err.message);
          if (callback) callback.call({}, err);
        });
    },

    // db.get(sql, [params], callback)
    get(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      if (!Array.isArray(params)) params = params ? Object.values(params) : [];

      tursoClient.execute({ sql, args: params })
        .then(result => {
          const row = result.rows[0] ? Object.fromEntries(
            Object.entries(result.rows[0])
          ) : null;
          if (callback) callback(null, row);
        })
        .catch(err => {
          console.error('[Turso get error]', sql.substring(0, 80), err.message);
          if (callback) callback(err);
        });
    },

    // db.all(sql, [params], callback)
    all(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      if (!Array.isArray(params)) params = params ? Object.values(params) : [];

      tursoClient.execute({ sql, args: params })
        .then(result => {
          const rows = result.rows.map(r => Object.fromEntries(Object.entries(r)));
          if (callback) callback(null, rows);
        })
        .catch(err => {
          console.error('[Turso all error]', sql.substring(0, 80), err.message);
          if (callback) callback(err);
        });
    },

    // db.serialize — Turso is async so serialize is a no-op passthrough
    serialize(fn) { if (typeof fn === 'function') fn(); },

    // db.configure — no-op for compatibility
    configure() {},
  };

} else {
  // ── LOCAL SQLite (development) ──
  let dbPath = path.join(__dirname, '..', 'denden.db');

  // Support writable DB in Serverless environments (Vercel /tmp fallback)
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

  db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) console.error('SQLite connection error:', err.message);
    else console.log('Connected to local SQLite at', dbPath);
  });
  db.configure('busyTimeout', 5000);
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA journal_mode = WAL');
  });
}

// ── Branches seed data ───────────────────────────────────────────────────────
const BRANCHES = [
  'شارع السنترال',
  'نادي قارون',
  'نادي المحافظة',
  'الحديقة الدولية',
  'باغوص',
  'الجون',
  'الممشى السياحي'
];

// ── initializeDB — creates tables if missing ─────────────────────────────────
const initializeDB = () => {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      shift_start_time TEXT DEFAULT '09:00',
      grace_period_minutes INTEGER DEFAULT 15,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS users (
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
    )`,
    `CREATE TABLE IF NOT EXISTS attendance (
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
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL DEFAULT 0,
      stock REAL DEFAULT 0,
      unit TEXT DEFAULT 'piece',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id INTEGER REFERENCES users(id),
      total_amount REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id),
      product_id INTEGER REFERENCES products(id),
      quantity REAL DEFAULT 1,
      price REAL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS advances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      note TEXT,
      type TEXT DEFAULT 'advance',
      status TEXT DEFAULT 'approved',
      date TEXT,
      issued_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      leave_type TEXT DEFAULT 'leave',
      start_date TEXT NOT NULL,
      end_date TEXT,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER REFERENCES users(id),
      message TEXT,
      media_url TEXT,
      media_type TEXT DEFAULT 'text',
      type TEXT DEFAULT 'text',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      title TEXT,
      message TEXT,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'كيلو',
      current_stock REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS inventory_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      branch_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS inventory_audit_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL REFERENCES inventory_audits(id),
      item_name TEXT NOT NULL,
      category TEXT NOT NULL,
      counted_qty REAL NOT NULL,
      unit TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS factory_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      branch_id INTEGER,
      recipient TEXT DEFAULT 'driver',
      status TEXT DEFAULT 'pending',
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS factory_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES factory_orders(id),
      item_name TEXT NOT NULL,
      available_stock REAL DEFAULT 0,
      requested_qty REAL NOT NULL,
      unit TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS shift_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS shift_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ice_cream_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ice_cream_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES ice_cream_orders(id),
      product_name TEXT,
      quantity REAL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS salary_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      reason TEXT,
      type TEXT DEFAULT 'advance',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS carried_debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      from_month TEXT NOT NULL,
      to_month TEXT NOT NULL,
      amount REAL NOT NULL,
      is_cleared INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  if (isTurso) {
    // Turso: run DDL async, then seed branches
    (async () => {
      try {
        for (const sql of ddl) {
          await db._client.execute(sql);
        }
        // Seed branches
        for (const name of BRANCHES) {
          await db._client.execute({
            sql: 'INSERT OR IGNORE INTO branches (name) VALUES (?)',
            args: [name]
          });
        }
        console.log('Database tables initialized successfully (Turso)');
      } catch (e) {
        console.error('Turso initializeDB error:', e.message);
      }
    })();
  } else {
    // Local SQLite: use db.serialize
    db.serialize(() => {
      ddl.forEach(sql => db.run(sql));
      BRANCHES.forEach(name => {
        db.run('INSERT OR IGNORE INTO branches (name) VALUES (?)', [name]);
      });
      console.log('Database tables initialized successfully (SQLite)');
    });
  }
};

module.exports = { db, initializeDB, BRANCHES };