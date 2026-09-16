/**
 * seed_attendance.js - Inserts one full month of realistic dummy attendance data
 */
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(path.join(__dirname, "denden.db"), sqlite3.OPEN_READWRITE, (err) => {
  if (err) { console.error("DB Error:", err.message); process.exit(1); }
  console.log("Connected to database");
});

const YEAR = 2026;
const MONTH = 9;

function pad(n) { return String(n).padStart(2, "0"); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomTime(startH, startM, endH, endM) {
  const totalStart = startH * 60 + startM;
  const totalEnd = endH * 60 + endM;
  const t = randomInt(totalStart, totalEnd);
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

const daysInMonth = new Date(YEAR, MONTH, 0).getDate();

async function run() {
  const users = await new Promise((res, rej) => {
    db.all("SELECT id, full_name, role, branch_id FROM users WHERE role != 'manager'", [], (err, rows) => {
      if (err) rej(err); else res(rows);
    });
  });

  const branches = await new Promise((res, rej) => {
    db.all("SELECT id FROM branches", [], (err, rows) => {
      if (err) rej(err); else res(rows.map(r => r.id));
    });
  });

  if (users.length === 0) {
    console.log("No users found. Please add employees first.");
    db.close(); return;
  }
  console.log(`Found ${users.length} employees. Generating ${daysInMonth} days of attendance...`);

  await new Promise((res, rej) => {
    db.run("DELETE FROM attendance WHERE strftime('%Y-%m', date) = ?", [`${YEAR}-${pad(MONTH)}`],
      function(err) { if (err) rej(err); else res(); });
  });

  await new Promise((res, rej) => {
    db.run("DELETE FROM advances WHERE strftime('%Y-%m', date) = ?", [`${YEAR}-${pad(MONTH)}`],
      function(err) { if (err) rej(err); else res(); });
  });
  console.log("Cleared existing data for month");

  let insertedCount = 0;
  let advancesCount = 0;

  for (const user of users) {
    const branchId = user.branch_id || branches[0];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${YEAR}-${pad(MONTH)}-${pad(day)}`;
      const dayOfWeek = new Date(YEAR, MONTH - 1, day).getDay();

      if (dayOfWeek === 5 && Math.random() < 0.75) continue;
      if (Math.random() < 0.12) continue;

      let clockIn, clockOut;
      if (user.role === "cashier") {
        clockIn = randomTime(9, 0, 10, 30);
        clockOut = randomTime(17, 0, 22, 0);
      } else if (user.role === "driver" || user.role === "delivery") {
        clockIn = randomTime(10, 0, 12, 0);
        clockOut = randomTime(22, 0, 23, 30);
      } else {
        clockIn = randomTime(8, 0, 10, 0);
        clockOut = randomTime(16, 0, 21, 0);
      }

      const hasClockOut = Math.random() > 0.05 ? clockOut : null;

      await new Promise((res, rej) => {
        db.run(
          "INSERT INTO attendance (user_id, date, clock_in, clock_out, status, branch_id) VALUES (?, ?, ?, ?, 'present', ?)",
          [user.id, date, clockIn, hasClockOut, branchId],
          function(err) { if (err) rej(err); else res(); }
        );
      });
      insertedCount++;
    }

    const numAdvances = randomInt(0, 3);
    for (let i = 0; i < numAdvances; i++) {
      const day = randomInt(1, daysInMonth - 1);
      const date = `${YEAR}-${pad(MONTH)}-${pad(day)}`;
      const isIceCream = Math.random() < 0.35;
      const amount = isIceCream ? randomInt(1, 5) * 20 : randomInt(1, 10) * 50;
      const type = isIceCream ? "ice_cream" : "advance";
      const reason = isIceCream ? "مسحوبات آيس كريم" : "سلفة مباشرة";

      await new Promise((res, rej) => {
        db.run(
          "INSERT INTO advances (user_id, amount, reason, date, type, status) VALUES (?, ?, ?, ?, ?, 'approved')",
          [user.id, amount, reason, date, type],
          function(err) { if (err) rej(err); else res(); }
        );
      });
      advancesCount++;
    }
  }

  console.log(`\nDone!`);
  console.log(`  Attendance records inserted: ${insertedCount}`);
  console.log(`  Advance/deduction records: ${advancesCount}`);
  console.log(`\nSalary summary is ready to test!`);
  db.close();
}

run().catch(err => { console.error("Error:", err.message); db.close(); });
