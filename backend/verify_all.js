const http = require('http');

function req(options, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data || '{}') });
        } catch(e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function runCompleteSystemCheck() {
  console.log('======================================================');
  console.log('🔍 فحص شامل واختبار حي لكل وظائف وأزرار النظام...');
  console.log('======================================================\n');

  const report = [];
  function check(name, ok, details) {
    report.push({ name, ok, details });
    console.log((ok ? '✅' : '❌') + ' ' + name + ': ' + (details || ''));
  }

  // 1. Manager Login
  let mgrToken = '';
  const rAdmin = await req({ hostname: 'localhost', port: 5001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { username: 'admin', password: 'admin123' });
  mgrToken = rAdmin.data.token;
  check('تسجيل دخول المدير (admin)', rAdmin.status === 200 && !!mgrToken, rAdmin.data.message);

  // 2. Cashier 1 Login with password 1234
  let csh1Token = '';
  const rCsh1 = await req({ hostname: 'localhost', port: 5001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { username: 'cashier_1', password: '1234' });
  csh1Token = rCsh1.data.token;
  check('تسجيل دخول كاشير 1 (بباسورد 1234)', rCsh1.status === 200 && !!csh1Token, 'User: ' + rCsh1.data.user?.full_name + ', Role: ' + rCsh1.data.user?.role);

  // 3. Chef 1 Login with password 1234
  const rChef = await req({ hostname: 'localhost', port: 5001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { username: 'chef_1', password: '1234' });
  check('تسجيل دخول شيف 1 (بباسورد 1234)', rChef.status === 200, 'User: ' + rChef.data.user?.full_name);

  // 4. Driver 1 Login with password 1234
  const rDriver = await req({ hostname: 'localhost', port: 5001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { username: 'driver_1', password: '1234' });
  check('تسجيل دخول سائق 1 (بباسورد 1234)', rDriver.status === 200, 'User: ' + rDriver.data.user?.full_name);

  // 5. Fridge 1 Login with password 1234
  const rFridge = await req({ hostname: 'localhost', port: 5001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { username: 'fridge_1', password: '1234' });
  check('تسجيل دخول ثلاجة 1 (بباسورد 1234)', rFridge.status === 200, 'User: ' + rFridge.data.user?.full_name);

  // 6. Employees Count
  const rUsers = await req({ hostname: 'localhost', port: 5001, path: '/api/auth/users', method: 'GET', headers: { 'Authorization': 'Bearer ' + mgrToken } });
  const totalEmployees = rUsers.data.users?.length || 0;
  check('قائمة إدارة الموظفين', rUsers.status === 200 && totalEmployees >= 70, 'إجمالي الموظفين: ' + totalEmployees);

  // 7. Branches check
  const rBranches = await req({ hostname: 'localhost', port: 5001, path: '/api/auth/branches', method: 'GET', headers: { 'Authorization': 'Bearer ' + mgrToken } });
  check('فحص الفروع المسجلة', rBranches.status === 200 && rBranches.data.branches?.length === 7, 'عدد الفروع: ' + rBranches.data.branches?.length);

  // 8. Attendance Records check
  const rAtt = await req({ hostname: 'localhost', port: 5001, path: '/api/auth/attendance?date=2026-09-10', method: 'GET', headers: { 'Authorization': 'Bearer ' + mgrToken } });
  check('جدول الحضور والانصراف بالفرع', rAtt.status === 200, 'سجلات تاريخ محدد: ' + rAtt.data.attendance?.length);

  // 9. Clock-In (تسجيل حضور للكاشير)
  const rClockIn = await req({ hostname: 'localhost', port: 5001, path: '/api/auth/clock-in', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + csh1Token } }, {
    branch_id: 1
  });
  check('زر تسجيل حضور الكاشير', rClockIn.status === 200, rClockIn.data.message);

  // 10. Clock-Out (تسجيل انصراف)
  const rClockOut = await req({ hostname: 'localhost', port: 5001, path: '/api/auth/clock-out', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + csh1Token } }, {});
  check('زر تسجيل انصراف الكاشير', rClockOut.status === 200, rClockOut.data.message);

  // 11. Shift Transfer (التطبيق / بارت تايم)
  const rTransfer = await req({ hostname: 'localhost', port: 5001, path: '/api/auth/shift-transfer', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + csh1Token } }, {
    new_branch_id: 5
  });
  check('زر التطبيق والبارت تايم لفرع آخر', rTransfer.status === 200, rTransfer.data.message);

  // 12. Comprehensive Salary Summary (الجرد الشامل للمرتبات لشهر سبتمبر)
  const rSalSummary = await req({ hostname: 'localhost', port: 5001, path: '/api/hr/salary-summary?month=2026-09', method: 'GET', headers: { 'Authorization': 'Bearer ' + mgrToken } });
  const sampleSal = rSalSummary.data.summary?.[0];
  check('شاشة الجرد الشامل للمرتبات (بيانات الإكسل)', rSalSummary.status === 200 && rSalSummary.data.summary?.length >= 70, 'الموظفين المدرجين: ' + rSalSummary.data.summary?.length + ', نموذج: ' + sampleSal?.user_name + ' (أيام: ' + sampleSal?.days_worked + ', سلف: ' + sampleSal?.total_advances + ', آيس كريم: ' + sampleSal?.total_ice_cream + ', صافي: ' + sampleSal?.net_salary + ')');

  // 13. Advances Listing & Management
  const rAdv = await req({ hostname: 'localhost', port: 5001, path: '/api/hr/advances', method: 'GET', headers: { 'Authorization': 'Bearer ' + mgrToken } });
  check('سجلات السلفيات والخصومات', rAdv.status === 200, 'إجمالي السلف والمسحوبات: ' + rAdv.data.advances?.length);

  // 14. Group Chat Messages
  const rChat = await req({ hostname: 'localhost', port: 5001, path: '/api/chat/messages', method: 'GET', headers: { 'Authorization': 'Bearer ' + mgrToken } });
  check('شاشة الدردشة الجماعية (الشات)', rChat.status === 200 && rChat.data.messages?.length > 0, 'عدد الرسائل المتبادلة: ' + rChat.data.messages?.length);

  // 15. Send a live chat message
  const rSendMsg = await req({ hostname: 'localhost', port: 5001, path: '/api/chat/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + csh1Token } }, {
    message: 'تم فحص النظام وجاهزية الفرع بنجاح 100%'
  });
  check('إرسال رسالة جديدة في الشات', rSendMsg.status === 200 || rSendMsg.status === 201, 'تم الحفظ في قاعدة البيانات وبثها للمستخدمين');

  // 16. Inventory & Products
  const rProd = await req({ hostname: 'localhost', port: 5001, path: '/api/inventory/products', method: 'GET', headers: { 'Authorization': 'Bearer ' + mgrToken } });
  check('المخزن وقائمة المنتجات', rProd.status === 200, 'عدد الأصناف: ' + rProd.data.products?.length);

  // 17. Leaves & Calendar
  const rLeaves = await req({ hostname: 'localhost', port: 5001, path: '/api/calendar/leaves', method: 'GET', headers: { 'Authorization': 'Bearer ' + mgrToken } });
  check('التقويم والإجازات', rLeaves.status === 200, 'الخدمة تعمل وتستقبل الطلبات');

  console.log('\n======================================================');
  const allPassed = report.every(r => r.ok);
  if (allPassed) {
    console.log('🎉 النتيجة النهائية: تم اجتياز جميع الفحوصات بنجاح بنسبة 100% (' + report.length + ' من ' + report.length + ')!');
  } else {
    console.log('⚠️ يوجد فحوصات غير ناجحة:');
    report.filter(r => !r.ok).forEach(r => console.log(' - ' + r.name + ': ' + r.details));
  }
  console.log('======================================================\n');
}

runCompleteSystemCheck().catch(console.error);
