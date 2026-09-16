const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./denden.db');
db.run("DELETE FROM users WHERE username = 'test_emp9'", function(e) {
  if(e) console.log('err:', e.message);
  else console.log('Deleted test employee rows:', this.changes);
  db.close();
});
