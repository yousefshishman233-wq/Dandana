import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI, inventoryAPI, hrAPI, calendarAPI } from '../services/api';

const StatCard = ({ icon, label, value, sub, color, delay }) => (
  <div className={`glass-card p-6 animate-fadeInUp delay-${delay}`}>
    <div className="flex items-center justify-between mb-3">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
        style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
        {icon}
      </div>
      <div className="text-right">
        <p className="text-3xl font-black" style={{ color, fontFamily: 'Inter' }}>{value}</p>
        {sub && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
    <div className="progress-bar mt-3">
      <div className="progress-fill" style={{ width: '60%', background: `linear-gradient(90deg, ${color}, ${color}80)` }} />
    </div>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [products, setProducts] = useState([]);
  const [salaryData, setSalaryData] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [driverOrders, setDriverOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('صباح النور');
    else if (h < 17) setGreeting('مساء الخير');
    else setGreeting('مساء النور');
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [attRes, prodRes] = await Promise.allSettled([
        authAPI.getAttendance(today),
        inventoryAPI.getProducts(),
      ]);

      if (attRes.status === 'fulfilled' && attRes.value.data.success) {
        setAttendance(attRes.value.data.attendance || []);
      }
      if (prodRes.status === 'fulfilled' && prodRes.value.data.success) {
        setProducts(prodRes.value.data.products || []);
      }

      if (user) {
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        try {
          const salRes = await hrAPI.getSalaryCalculation(user.id, monthYear);
          if (salRes.data.success) setSalaryData(salRes.data.salary);
        } catch {}

        if (user.role === 'manager') {
          try {
            const leavesRes = await calendarAPI.getLeaves();
            if (leavesRes.data.success) {
              setLeaves(leavesRes.data.leaves?.filter(l => l.status === 'pending') || []);
            }
          } catch {}
        }

        if (user.role === 'driver') {
          try {
            const driverRes = await inventoryAPI.getFactoryOrders('driver');
            if (driverRes.data.success) {
              setDriverOrders(driverRes.data.orders || []);
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const todayAtt = attendance.filter(a => a.date === new Date().toISOString().split('T')[0]);
  const presentCount = todayAtt.filter(a => a.status === 'present').length;
  const absentCount = todayAtt.filter(a => a.status === 'absent').length;
  const lateCount = todayAtt.filter(a => a.status === 'late').length;

  const roleLabels = {
    manager: 'مدير',
    cashier: 'كاشير',
    chef: 'شيفات',
    driver: 'سائق',
    accountant: 'محاسب',
    prep: 'تحضير',
    fridge: 'ثلاجة',
    hall: 'صالة',
    delivery: 'دليفري',
    employee: 'موظف عام',
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-3" />
          <p style={{ color: 'var(--text-muted)' }}>جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Welcome Banner */}
      <div className="glass-card-static p-6 relative overflow-hidden animate-fadeInUp"
        style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(255,107,157,0.1))', border: '1px solid rgba(108,99,255,0.3)' }}>
        <div className="absolute top-0 left-0 w-full h-full opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle, #6C63FF 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{greeting} 👋</p>
            <h1 className="text-3xl font-black text-gradient-primary">{user?.full_name}</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="text-6xl opacity-60 animate-float hidden md:block">🍦</div>
        </div>
      </div>

      {/* Driver Dashboard Orders View */}
      {user?.role === 'driver' && (
        <div className="glass-card-static p-6 space-y-4 animate-fadeInUp"
          style={{ background: 'linear-gradient(135deg, rgba(0,212,170,0.15), rgba(108,99,255,0.1))', border: '1px solid rgba(0,212,170,0.4)' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚗</span>
              <div>
                <h2 className="font-bold text-lg text-primary">طلبيات التوصيل والنقل الموجهة إليك كـ (سائق) ({driverOrders.length})</h2>
                <p className="text-xs text-muted">طلبيات النواقص الموجهة من الفروع مباشرة للتوصيل والتنفيذ</p>
              </div>
            </div>
          </div>

          {driverOrders.length === 0 ? (
            <div className="p-6 rounded-xl text-center text-xs opacity-60 bg-dark/30">
              ✨ لا يوجد طلبيات توصيل معلقة موجهة إليك حالياً
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {driverOrders.map(order => (
                <div key={order.id} className="p-4 rounded-xl space-y-3 bg-dark-card border border-accent/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-sm text-accent">📍 فرع: {order.branch_name || 'فرع دندنه'}</span>
                      <p className="text-xs text-muted mt-1">👤 صاحب الطلب: {order.user_name} • 📅 {order.created_at}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{
                        background: order.status === 'delivered' ? 'rgba(108,99,255,0.2)' : 'rgba(255,179,71,0.2)',
                        color: order.status === 'delivered' ? 'var(--primary-light)' : 'var(--warning)'
                      }}>
                      {order.status === 'delivered' ? '🚚 تم التوصيل' : '⏳ جاري النقل والتوصيل'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-dark/50 text-xs space-y-1" style={{ border: '1px solid var(--dark-border)' }}>
                    <p className="font-bold text-text-secondary mb-1">📦 الأصناف والكميات المطلوبة:</p>
                    {order.items?.map(i => (
                      <div key={i.id} className="flex justify-between items-center text-accent">
                        <span>• {i.item_name}</span>
                        <span className="font-bold">{i.requested_qty} {i.unit}</span>
                      </div>
                    ))}
                    {order.note && <p className="text-xs text-warning mt-2 pt-1 border-t border-dark-border">📝 ملاحظة: {order.note}</p>}
                  </div>

                  {order.status !== 'delivered' && (
                    <button
                      onClick={async () => {
                        await inventoryAPI.updateFactoryOrderStatus(order.id, 'delivered');
                        fetchData();
                      }}
                      className="w-full py-2.5 rounded-xl font-bold text-xs btn-primary text-white shadow-lg transition transform hover:scale-[1.02]"
                    >
                      🚚 تأكيد الاستلام وتوصيل الطلبية للمحل
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      {user?.role === 'manager' ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="✅" label="حاضر اليوم" value={presentCount} sub={`من ${todayAtt.length} موظف`} color="#00D4AA" delay="100" />
          <StatCard icon="❌" label="غائب اليوم" value={absentCount} color="#FF4757" delay="200" />
          <StatCard icon="⏰" label="متأخر" value={lateCount} color="#FFB347" delay="300" />
          <StatCard icon="📋" label="طلبات الإجازة" value={leaves.length} sub="معلقة" color="#6C63FF" delay="400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-card p-6 animate-fadeInUp delay-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'rgba(0,212,170,0.15)' }}>💰</div>
              <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>راتبك هذا الشهر</p>
            </div>
            <p className="text-3xl font-black" style={{ color: 'var(--accent)', fontFamily: 'Inter' }}>
              {salaryData?.net_salary ?? '—'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>جنيه صافي بعد الخصومات</p>
          </div>
          <div className="glass-card p-6 animate-fadeInUp delay-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'rgba(255,179,71,0.15)' }}>💸</div>
              <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>إجمالي السلف</p>
            </div>
            <p className="text-3xl font-black" style={{ color: 'var(--warning)', fontFamily: 'Inter' }}>
              {salaryData?.total_advances ?? 0}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>جنيه مخصوم من الراتب</p>
          </div>
        </div>
      )}

      {/* Attendance Table */}
      {user?.role === 'manager' && (
        <div className="glass-card-static p-6 animate-fadeInUp delay-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-header mb-0">📋 حضور اليوم</h2>
            <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(108,99,255,0.15)', color: 'var(--primary-light)' }}>
              {todayAtt.length} موظف
            </span>
          </div>
          {todayAtt.length === 0 ? (
            <div className="text-center py-12 opacity-50">
              <p className="text-4xl mb-2">📭</p>
              <p style={{ color: 'var(--text-muted)' }}>لا يوجد بيانات حضور اليوم</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="dark-table">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>الدور</th>
                    <th>وقت الحضور</th>
                    <th>وقت الانصراف</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAtt.map((rec) => (
                    <tr key={rec.id}>
                      <td className="font-medium" style={{ color: 'var(--text-primary)' }}>{rec.full_name}</td>
                      <td><span className={`badge-${rec.role}`}>{roleLabels[rec.role] || rec.role}</span></td>
                      <td style={{ fontFamily: 'Inter' }}>{rec.clock_in || '—'}</td>
                      <td style={{ fontFamily: 'Inter' }}>{rec.clock_out || '—'}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium`}
                          style={{
                            background: rec.status === 'present' ? 'rgba(0,212,170,0.15)' :
                              rec.status === 'absent' ? 'rgba(255,71,87,0.15)' :
                              rec.status === 'late' ? 'rgba(255,179,71,0.15)' : 'rgba(108,99,255,0.15)',
                            color: rec.status === 'present' ? 'var(--accent)' :
                              rec.status === 'absent' ? '#FF4757' :
                              rec.status === 'late' ? 'var(--warning)' : 'var(--primary-light)',
                          }}>
                          {rec.status === 'present' ? '✅ حاضر' :
                           rec.status === 'absent' ? '❌ غائب' :
                           rec.status === 'late' ? '⏰ متأخر' : '🌴 إجازة'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Products + Pending Leaves */}
      <div className={`grid gap-6 ${user?.role === 'manager' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Products */}
        <div className="glass-card-static p-6 animate-fadeInUp delay-400">
          <h2 className="section-header">🍦 قائمة الأسعار</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto scroll-area">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl transition-colors"
                style={{ background: 'rgba(108,99,255,0.05)', border: '1px solid rgba(108,99,255,0.1)' }}>
                <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold" style={{ color: 'var(--accent)', fontFamily: 'Inter' }}>
                    {p.price} جنيه
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,179,71,0.15)', color: 'var(--warning)' }}>
                    خصم 25%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Leaves (Manager) */}
        {user?.role === 'manager' && (
          <div className="glass-card-static p-6 animate-fadeInUp delay-500">
            <h2 className="section-header">📅 طلبات الإجازة المعلقة</h2>
            {leaves.length === 0 ? (
              <div className="text-center py-8 opacity-50">
                <p className="text-3xl mb-2">✅</p>
                <p style={{ color: 'var(--text-muted)' }} className="text-sm">لا يوجد طلبات معلقة</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto scroll-area">
                {leaves.map((l) => (
                  <div key={l.id} className="p-4 rounded-xl border-r-4 animate-fadeInUp"
                    style={{ background: 'rgba(255,179,71,0.08)', borderRightColor: 'var(--warning)', border: '1px solid rgba(255,179,71,0.2)', borderRightWidth: '4px' }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{l.full_name}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{l.reason}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs" style={{ color: 'var(--warning)', fontFamily: 'Inter' }}>
                          {l.start_date}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>← {l.end_date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;