/**
 * seed_70_employees.js
 * Creates 70 employees distributed across the 7 branches with password '1234',
 * varied roles and salaries, realistic attendance, advances, ice cream orders,
 * and realistic group chat messages.
 */
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'denden.db'), (err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
});

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function seed() {
  console.log('🚀 بدء إنشاء وتوزيع الـ 70 موظف والبيانات التشغيلية الكاملة...');

  // 1. Get branches
  const branches = await getAll('SELECT id, name FROM branches ORDER BY id ASC');
  if (branches.length === 0) {
    console.error('No branches found!');
    process.exit(1);
  }
  console.log(`📍 تم العثور على ${branches.length} فروع.`);

  // Hash password '1234'
  const hashedPassword = await bcrypt.hash('1234', 10);

  // 2. Define the 70 employees across roles
  // 14 cashiers, 14 fridge, 10 chefs, 10 hall, 8 drivers, 6 prep, 4 delivery, 4 general
  const employeeDefs = [];

  const rolesDistribution = [
    { role: 'cashier', prefixAr: 'كاشير', prefixEn: 'cashier', count: 14, minSal: 5500, maxSal: 6500 },
    { role: 'fridge', prefixAr: 'ثلاجة', prefixEn: 'fridge', count: 14, minSal: 4200, maxSal: 4900 },
    { role: 'chef', prefixAr: 'شيف', prefixEn: 'chef', count: 10, minSal: 5200, maxSal: 6000 },
    { role: 'hall', prefixAr: 'صالة', prefixEn: 'hall', count: 10, minSal: 3300, maxSal: 3800 },
    { role: 'driver', prefixAr: 'سائق', prefixEn: 'driver', count: 8, minSal: 4800, maxSal: 5500 },
    { role: 'prep', prefixAr: 'تحضير', prefixEn: 'prep', count: 6, minSal: 3600, maxSal: 4200 },
    { role: 'delivery', prefixAr: 'دليفري', prefixEn: 'delivery', count: 4, minSal: 3800, maxSal: 4500 },
    { role: 'employee', prefixAr: 'موظف عام', prefixEn: 'employee', count: 4, minSal: 3000, maxSal: 3500 },
  ];

  rolesDistribution.forEach(dist => {
    for (let i = 1; i <= dist.count; i++) {
      const step = dist.count > 1 ? (dist.maxSal - dist.minSal) / (dist.count - 1) : 0;
      const salary = Math.round(dist.minSal + step * (i - 1));
      employeeDefs.push({
        full_name: `${dist.prefixAr} ${i}`,
        username: `${dist.prefixEn}_${i}`,
        role: dist.role,
        salary: salary,
      });
    }
  });

  console.log(`📋 تم إعداد قائمة ${employeeDefs.length} موظف.`);

  // 3. Clean up any previous test generated employees (usernames starting with cashier_, fridge_, etc.)
  const usernames = employeeDefs.map(e => `'${e.username}'`).join(',');
  await runQuery(`DELETE FROM users WHERE username IN (${usernames})`);

  // 4. Insert each employee assigned evenly to the 7 branches
  const insertedEmployees = [];
  for (let idx = 0; idx < employeeDefs.length; idx++) {
    const emp = employeeDefs[idx];
    const branch = branches[idx % branches.length]; // 10 per branch

    const res = await runQuery(
      'INSERT INTO users (username, password, full_name, role, salary, branch_id) VALUES (?, ?, ?, ?, ?, ?)',
      [emp.username, hashedPassword, emp.full_name, emp.role, emp.salary, branch.id]
    );

    insertedEmployees.push({
      id: res.lastID,
      ...emp,
      branch_id: branch.id,
      branch_name: branch.name
    });
  }

  console.log(`✅ تم إدراج ${insertedEmployees.length} موظف بنجاح في قاعدة البيانات.`);

  // 5. Generate Attendance records across days for September 2026
  console.log('📅 جاري تسجيل سجلات الحضور والانصراف لشهر سبتمبر...');
  const daysToSeed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  let attendanceCount = 0;

  for (const emp of insertedEmployees) {
    // Each employee works between 10 to 14 days
    const workedDays = daysToSeed.filter((_, i) => (emp.id + i) % 7 !== 0);

    for (const day of workedDays) {
      const dateStr = `2026-09-${String(day).padStart(2, '0')}`;
      const inHour = 8 + (emp.id % 3);
      const inMin = (emp.id * 7) % 60;
      const outHour = 16 + (emp.id % 6);
      const outMin = (emp.id * 11) % 60;

      const clockIn = `${String(inHour).padStart(2, '0')}:${String(inMin).padStart(2, '0')}`;
      const clockOut = `${String(outHour).padStart(2, '0')}:${String(outMin).padStart(2, '0')}`;

      await runQuery(
        'INSERT INTO attendance (user_id, date, clock_in, clock_out, status, branch_id) VALUES (?, ?, ?, ?, ?, ?)',
        [emp.id, dateStr, clockIn, clockOut, 'present', emp.branch_id]
      );
      attendanceCount++;
    }
  }
  console.log(`✅ تم تسجيل ${attendanceCount} سجل حضور وانصراف.`);

  // 6. Generate Advances and Ice Cream orders
  console.log('💰 جاري تسجيل السلفيات ومسحوبات الآيس كريم...');
  let advancesCount = 0;
  let iceCreamCount = 0;

  for (let idx = 0; idx < insertedEmployees.length; idx++) {
    const emp = insertedEmployees[idx];

    // Every 2nd employee gets an advance
    if (idx % 2 === 0) {
      const advanceAmounts = [200, 300, 400, 500, 600, 750];
      const amount = advanceAmounts[idx % advanceAmounts.length];
      const day = 3 + (idx % 10);
      const dateStr = `2026-09-${String(day).padStart(2, '0')}`;
      const reasons = ['سلفة شخصية طارئة', 'مصاريف سفر', 'سلفة علاج', 'سلفة نصف الشهر'];
      const reason = reasons[idx % reasons.length];

      await runQuery(
        'INSERT INTO advances (user_id, amount, reason, date, is_paid_back, type, status) VALUES (?, ?, ?, ?, 0, ?, ?)',
        [emp.id, amount, reason, dateStr, 'advance', 'approved']
      );
      advancesCount++;
    }

    // Every 3rd employee has ice cream deduction
    if (idx % 3 === 0) {
      const iceAmounts = [35, 55, 75, 95, 120];
      const amount = iceAmounts[idx % iceAmounts.length];
      const day = 5 + (idx % 8);
      const dateStr = `2026-09-${String(day).padStart(2, '0')}`;

      await runQuery(
        'INSERT INTO advances (user_id, amount, reason, date, is_paid_back, type, status) VALUES (?, ?, ?, ?, 0, ?, ?)',
        [emp.id, amount, 'مسحوبات آيس كريم عائلية ومشروبات', dateStr, 'ice_cream', 'approved']
      );
      iceCreamCount++;
    }
  }
  console.log(`✅ تم تسجيل ${advancesCount} سلفة نقدية و ${iceCreamCount} خصم آيس كريم.`);

  // 7. Seed Group Chat Messages between the employees
  console.log('💬 جاري إنشاء محادثات واقعية في الشات الجماعي بين الموظفين والفروع...');
  const chatScripts = [
    { userIndex: 0, text: 'صباح الخير يا شباب، تم استلام وردية الصباح في فرع السنترال والماكينات شغالة تمام.' },
    { userIndex: 14, text: 'صباح الفل يا رجالة، تم فحص وتبريد جميع ثلاجات العرض ودرجات الحرارة مظبوطة.' },
    { userIndex: 28, text: 'جاهز 10 جالونات فانيليا وشوكولاتة ومانجو ومستعدين لطلبيات الفروع.' },
    { userIndex: 48, text: 'طالع بالعربية دلوقتي بخط سير (الجون - نادي المحافظة - نادي قارون) لتوزيع البضاعة.' },
    { userIndex: 1, text: 'تمام يا كابتن، في انتظارك في الفرع عشان نسجل الاستلام في المخزن.' },
    { userIndex: 38, text: 'تم تنظيف الصالة وتجهيز الطاولات واستقبال الزباين بفرع الحديقة الدولية.' },
    { userIndex: 2, text: 'يا شباب الإقبال عالي النهاردة على صنف النوتيلا واللوتس، ابعتولنا زيادة في الطلبية الجاية.' },
    { userIndex: 29, text: 'معلوم، الشيفات شغالين على دفعة لوتس ونوتيلا طازة وهتكون جاهزة خلال ساعة.' },
    { userIndex: 56, text: 'تم تحضير البسكوت والعلب والمعالق في قسم التحضير وتغليفها.' },
    { userIndex: 62, text: 'الدليفري شغال ومنتظمين في تسليم الطلبات الخارجية أونلاين.' },
    { userIndex: 3, text: 'تم تسجيل الحضور لكل طاقم العمل في الوردية بفرع نادي قارون.' },
    { userIndex: 15, text: 'الثلاجة الإضافية في فرع باغوص اتظبطت تمام والتبريد ممتاز.' },
    { userIndex: 49, text: 'وصلت فرع نادي المحافظة وتم تسليم طلبية المستلزمات والآيس كريم للكاشير.' },
    { userIndex: 4, text: 'تم الاستلام والفحص والتوقيع، الله ينور يا شباب.' },
    { userIndex: 39, text: 'الصالة ممتلئة بالكامل والخدمة سريعة والعملاء مبسوطين جداً من الجودة.' },
    { userIndex: 5, text: 'يا إدارة، تم تقفيل درج وردية النهار وتسليم العهدة لوردية المساء بدون أي عجز.' },
    { userIndex: 30, text: 'تم استلام وتجهيز خامات بكرة وطلب الفواكه الطازجة للخلطات.' },
    { userIndex: 63, text: 'تم إنهاء كل طلبات التوصيل لليوم والحمد لله كل التقييمات ممتازة.' },
    { userIndex: 6, text: 'مساء الخير للجميع، تم فتح وردية المساء في فرع الممشى السياحي ومستعدين.' },
    { userIndex: 50, text: 'العربية رجعت الجراج والمخزن المركزي مستقر وجاهز لصباح الغد.' },
    { userIndex: 7, text: 'عاش يا شباب دندنه، شغل عالي ومجهود محترم في كل الفروع!' }
  ];

  for (let i = 0; i < chatScripts.length; i++) {
    const item = chatScripts[i];
    const sender = insertedEmployees[item.userIndex % insertedEmployees.length];
    const minute = String(10 + i * 4).padStart(2, '0');
    const createdTime = `2026-09-15 14:${minute}:00`;

    await runQuery(
      'INSERT INTO messages (sender_id, message, created_at) VALUES (?, ?, ?)',
      [sender.id, item.text, createdTime]
    );
  }
  console.log(`✅ تم إضافة ${chatScripts.length} رسالة شات جماعي تفاعلية.`);

  console.log('\n======================================================');
  console.log('🎉 تم بنجاح إتمام كل متطلبات السيستم:');
  console.log('   - 70 موظف موزعين 10 لكل فرع على الـ 7 فروع.');
  console.log('   - باسورد موحد للجميع: 1234');
  console.log('   - تنوع الأدوار: كاشير، ثلاجة، شيف، صالة، سائق، تحضير، دليفري، موظف عام.');
  console.log('   - مرتبات متنوعة من 3000 إلى 6500 جنيه.');
  console.log('   - سجلات حضور وانصراف وسلفيات وخصومات آيس كريم وشات نشط.');
  console.log('======================================================\n');

  db.close();
}

seed().catch(err => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
