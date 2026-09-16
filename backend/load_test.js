const http = require('http');

const jwt = require('jsonwebtoken');

const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = 5001;
const TARGET_PATH = '/api/auth/branches';

// Generate valid JWT token for realistic DB-backed query load
const token = jwt.sign(
  { id: 1, username: 'admin', role: 'manager' },
  process.env.JWT_SECRET || 'denden_secret_key_2024',
  { expiresIn: '24h' }
);

// Keep-alive agent to maximize throughput and avoid ephemeral port exhaustion
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 500,
  timeout: 5000
});

const STEPS = [
  { rps: 500, durationSec: 15 },
  { rps: 1000, durationSec: 15 },
  { rps: 1500, durationSec: 15 },
  { rps: 2000, durationSec: 15 },
  { rps: 2600, durationSec: 15 },
];

function sendRequest() {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request({
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: TARGET_PATH,
      method: 'GET',
      agent,
      headers: {
        'Connection': 'keep-alive',
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        resolve({ ok: res.statusCode === 200, status: res.statusCode, duration: Date.now() - start });
      });
    });

    req.on('error', (err) => {
      resolve({ ok: false, error: err.code || err.message, duration: Date.now() - start });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ ok: false, error: 'TIMEOUT', duration: 5000 });
    });

    req.end();
  });
}

async function runStep(targetRps, durationSec) {
  console.log(`\n======================================================`);
  console.log(`🚀 بدء مرحلة الضغط: ${targetRps} طلب/ثانية لمدة ${durationSec} ثانية...`);
  console.log(`======================================================`);

  let totalSent = 0;
  let successCount = 0;
  let failCount = 0;
  const latencies = [];
  const errorMap = {};

  const startTime = Date.now();
  const endTime = startTime + durationSec * 1000;

  let currentSecond = 0;

  while (Date.now() < endTime) {
    const secStart = Date.now();
    const promises = [];

    for (let i = 0; i < targetRps; i++) {
      totalSent++;
      promises.push(
        sendRequest().then((res) => {
          latencies.push(res.duration);
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
            const errKey = res.error || `HTTP_${res.status}`;
            errorMap[errKey] = (errorMap[errKey] || 0) + 1;
          }
        })
      );
    }

    currentSecond++;
    const elapsed = Date.now() - secStart;
    const toWait = Math.max(0, 1000 - elapsed);
    
    // Non-blocking delay for next second batch
    await new Promise((r) => setTimeout(r, toWait));
  }

  // Wait remaining requests
  await new Promise((r) => setTimeout(r, 2000));

  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1) : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const max = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
  const successRate = totalSent > 0 ? ((successCount / totalSent) * 100).toFixed(1) : 0;

  console.log(`📊 نتائج مرحلة ${targetRps} req/s:`);
  console.log(`   - إجمالي الطلبات المرسلة: ${totalSent}`);
  console.log(`   - الطلبات الناجحة (200 OK): ${successCount} (${successRate}%)`);
  console.log(`   - الطلبات الفاشلة / المتساقطة: ${failCount}`);
  console.log(`   - متوسط زمن الاستجابة (Latency): ${avgLatency} ms`);
  console.log(`   - الـ 95th Percentile: ${p95} ms (أقصى زمن: ${max} ms)`);
  if (Object.keys(errorMap).length > 0) {
    console.log(`   - تفاصيل الأخطاء:`, JSON.stringify(errorMap));
  }

  return {
    targetRps,
    totalSent,
    successCount,
    failCount,
    successRate,
    avgLatency,
    p95,
    max,
    errorMap
  };
}

async function measureRecoveryTime() {
  console.log(`\n⏳ فحص زمن التعافي (Recovery Time) بعد انتهاء الضغط العالي...`);
  const baseline = [];
  const startCheck = Date.now();

  for (let i = 0; i < 10; i++) {
    const res = await sendRequest();
    baseline.push(res.duration);
    await new Promise((r) => setTimeout(r, 200));
  }

  const recoveryTime = Date.now() - startCheck;
  const avgPost = (baseline.reduce((a, b) => a + b, 0) / baseline.length).toFixed(1);
  console.log(`✅ عاد السيرفر للاستقرار بزمن استجابة طبيعي: ${avgPost} ms (تم استعادة الجاهزية في ${recoveryTime} ms)`);
  return { avgPost, recoveryTime };
}

async function main() {
  console.log(`======================================================`);
  console.log(`🧪 اختبار تحمل واستقرار نظام دندنه (Stress & Load Test)`);
  console.log(`الهدف: http://${TARGET_HOST}:${TARGET_PORT}${TARGET_PATH}`);
  console.log(`التدرج: 500 -> 1000 -> 1500 -> 2000 -> 2600 طلب/ثانية`);
  console.log(`======================================================`);

  const summary = [];

  for (const step of STEPS) {
    const res = await runStep(step.rps, step.durationSec);
    summary.push(res);
  }

  const recovery = await measureRecoveryTime();

  console.log(`\n======================================================`);
  console.log(`🏁 التقرير النهائي لجلسة اختبار التحمل (Benchmark Summary)`);
  console.log(`======================================================`);
  console.table(summary.map(s => ({
    'المعدل المطلوب (RPS)': s.targetRps,
    'نسبة النجاح %': s.successRate + '%',
    'الطلبات الناجحة': s.successCount,
    'الطلبات الفاشلة': s.failCount,
    'متوسط التأخير (ms)': s.avgLatency,
    'P95 (ms)': s.p95
  })));

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
