const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./denden.db');

db.serialize(() => {
  // Step 1: Rename old table
  db.run('ALTER TABLE leaves RENAME TO leaves_old', (e) => {
    if (e) { console.log('rename err (ok if not exists):', e.message); }
    else console.log('Renamed leaves -> leaves_old');
  });

  // Step 2: Create new table WITHOUT the restrictive CHECK on leave_type
  const createSQL = [
    'CREATE TABLE IF NOT EXISTS leaves (',
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  user_id INTEGER NOT NULL,',
    '  leave_type TEXT NOT NULL DEFAULT \'leave\',',
    '  start_date TEXT NOT NULL,',
    '  end_date TEXT NOT NULL,',
    '  reason TEXT,',
    '  status TEXT CHECK(status IN (\'pending\', \'approved\', \'rejected\')) DEFAULT \'pending\',',
    '  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,',
    '  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
    ')'
  ].join('\n');

  db.run(createSQL, (e) => {
    if (e) console.log('create err:', e.message);
    else console.log('Created new leaves table without CHECK constraint');
  });

  // Step 3: Copy old data
  db.run('INSERT OR IGNORE INTO leaves SELECT * FROM leaves_old', (e) => {
    if (e) console.log('copy err (ok if empty):', e.message);
    else console.log('Copied old data to new table');
  });

  // Step 4: Drop old table
  db.run('DROP TABLE IF EXISTS leaves_old', (e) => {
    if (e) console.log('drop err:', e.message);
    else console.log('Dropped leaves_old');
  });

  // Step 5: Test insert with 'leave' type
  db.run(
    "INSERT INTO leaves (user_id, leave_type, start_date, end_date, reason) VALUES (1, 'leave', '2026-09-01', '2026-09-01', 'test')",
    function(e) {
      if (e) console.log('TEST INSERT FAILED:', e.message);
      else {
        console.log('TEST INSERT OK - id:', this.lastID);
        db.run('DELETE FROM leaves WHERE id = ?', [this.lastID]);
      }
      db.close();
      console.log('Done!');
    }
  );
});
