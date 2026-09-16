import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

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

const statusConfig = {
  present: { label: 'حاضر', color: 'var(--accent)', bg: 'rgba(0,212,170,0.12)', icon: '✅' },
  absent: { label: 'غائب', color: '#FF4757', bg: 'rgba(255,71,87,0.12)', icon: '❌' },
  late: { label: 'متأخر', color: 'var(--warning)', bg: 'rgba(255,179,71,0.12)', icon: '⏰' },
  on_leave: { label: 'إجازة', color: 'var(--primary-light)', bg: 'rgba(108,99,255,0.12)', icon: '🌴' },
};

const AttendancePage = () => {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(user?.branch_id || '');
  const [attendance, setAttendance] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);
  const [myRecord, setMyRecord] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  // Shift Transfer / التطبيق state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferBranchId, setTransferBranchId] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferMessage, setTransferMessage] = useState('');

  // Cashier Clock-In Modal state
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [clockInBranchId, setClockInBranchId] = useState('');
  const [clockInMessage, setClockInMessage] = useState('');

  // Manager Shift Timing Settings state
  const [showTimingModal, setShowTimingModal] = useState(false);
  const [selectedTimingBranch, setSelectedTimingBranch] = useState(null);
  const [timingStartTime, setTimingStartTime] = useState('09:00');
  const [timingGracePeriod, setTimingGracePeriod] = useState(15);
  const [timingLoading, setTimingLoading] = useState(false);
  const [timingMessage, setTimingMessage] = useState('');

  // Employee Clock-In Request state
  const [employeeBranchId, setEmployeeBranchId] = useState(user?.branch_id || '');
  const [reqMessage, setReqMessage] = useState('');

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate, activeBranchId]);

  const handleShiftTransfer = async () => {
    if (!transferBranchId) {
      setTransferMessage('⚠️ يرجى اختيار الفرع الجديد للتطبيق والانتقال إليه');
      return;
    }
    setTransferLoading(true);
    setTransferMessage('');
    try {
      const res = await authAPI.shiftTransfer(user.id, transferBranchId);
      if (res.data.success) {
        setTransferMessage(res.data.message || '✅ تم التطبيق والانتقال بنجاح!');
        setActiveBranchId(transferBranchId);
        setTimeout(() => {
          setShowTransferModal(false);
          setTransferMessage('');
        }, 1800);
        await fetchAttendance();
      }
    } catch (e) {
      setTransferMessage('⚠️ ' + (e.response?.data?.message || 'حدث خطأ أثناء نقل الشيفت'));
    }
    setTransferLoading(false);
  };

  const fetchBranches = async () => {
    try {
      const res = await authAPI.getBranches();
      if (res.data.success) setBranches(res.data.branches || []);
    } catch (e) { console.error(e); }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await authAPI.getAttendance(selectedDate, activeBranchId);
      if (res.data.success) {
        const data = res.data.attendance || [];
        setAttendance(data);
        if (user) {
          const mine = data.find(a => a.user_id === user.id);
          setMyRecord(mine || null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async (targetUserId, overrideBranchId) => {
    setClockLoading(true);
    try {
      const branchForClockIn = overrideBranchId || activeBranchId || user?.branch_id;
      const res = await authAPI.clockIn(targetUserId, branchForClockIn);
      if (res?.data?.message) {
        console.log(res.data.message);
      }
      await fetchAttendance();
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg) alert(msg);
      console.error(err);
    }
    setClockLoading(false);
  };

  // Cashier self clock-in with branch selection
  const handleCashierClockIn = async () => {
    if (!clockInBranchId) {
      setClockInMessage('⚠️ يرجى اختيار الفرع أولاً');
      return;
    }
    setClockLoading(true);
    setClockInMessage('');
    try {
      const res = await authAPI.clockIn(user.id, clockInBranchId);
      if (res.data.success) {
        setClockInMessage(res.data.message || '✅ تم تسجيل حضورك بنجاح!');
        // Auto-switch view to the selected branch
        setActiveBranchId(clockInBranchId);
        setTimeout(() => {
          setShowClockInModal(false);
          setClockInMessage('');
        }, 1500);
        await fetchAttendance();
      }
    } catch (e) {
      setClockInMessage('⚠️ ' + (e.response?.data?.message || 'حدث خطأ أثناء تسجيل الحضور'));
    }
    setClockLoading(false);
  };

  const handleClockOut = async (targetUserId) => {
    setClockLoading(true);
    try {
      await authAPI.clockOut(targetUserId);
      await fetchAttendance();
    } catch (err) { console.error(err); }
    setClockLoading(false);
  };

  const handleMarkAbsent = async (targetUserId) => {
    setClockLoading(true);
    try {
      await authAPI.markAbsent(targetUserId, selectedDate);
      await fetchAttendance();
    } catch (err) { console.error(err); }
    setClockLoading(false);
  };

  const handleSendEmployeeRequest = async () => {
    if (!employeeBranchId) {
      setReqMessage('⚠️ يرجى اختيار الفرع المتواجد فيه اليوم أولاً');
      return;
    }
    setClockLoading(true);
    setReqMessage('');
    try {
      const res = await authAPI.clockIn(user.id, employeeBranchId);
      if (res.data.success) {
        setReqMessage(res.data.message || '📩 تم إرسال طلب الحضور بنجاح بانتظار موافقة كاشير الفرع!');
        await fetchAttendance();
      }
    } catch (e) {
      setReqMessage('⚠️ ' + (e.response?.data?.message || 'فشل إرسال طلب الحضور'));
    }
    setClockLoading(false);
  };

  const handleApproveAttendance = async (attendanceId, targetStatus) => {
    setClockLoading(true);
    try {
      const res = await authAPI.updateAttendanceStatus(attendanceId, targetStatus);
      if (res.data.success) {
        await fetchAttendance();
      }
    } catch (e) { console.error(e); }
    setClockLoading(false);
  };

  const filtered = attendance.filter(a => {
    const matchName = a.full_name?.includes(searchText) || !searchText;
    const matchRole = filterRole === 'all' || a.role === filterRole;
    return matchName && matchRole;
  });

  const stats = {
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    late: attendance.filter(a => a.status === 'late').length,
    leave: attendance.filter(a => a.status === 'on_leave').length,
  };

  const handleSaveTiming = async () => {
    if (!selectedTimingBranch) return;
    setTimingLoading(true);
    setTimingMessage('');
    try {
      const res = await authAPI.updateBranchShiftTiming(selectedTimingBranch.id, {
        shift_start_time: timingStartTime,
        grace_period_minutes: Number(timingGracePeriod)
      });
      if (res.data.success) {
        setTimingMessage('✅ تم حفظ موعد الوردية وفترة السماح بنجاح!');
        await fetchBranches();
        setTimeout(() => {
          setShowTimingModal(false);
          setTimingMessage('');
        }, 1200);
      }
    } catch (e) {
      setTimingMessage('⚠️ ' + (e.response?.data?.message || 'فشل الحفظ'));
    }
    setTimingLoading(false);
  };

  const isManagement = user?.role === 'cashier' || user?.role === 'manager';
  const isCashier = user?.role === 'cashier';
  const isManager = user?.role === 'manager';

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="animate-fadeInUp flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">📋 الحضور والانصراف</h1>
          <p style={{ color: 'var(--text-muted)' }} className="text-sm">تتبع وتسجيل حضور وانصراف الموظفين بواسطة الكاشير والمدير لكل فرع</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {isManager && (
            <button
              onClick={() => {
                if (branches.length > 0) {
                  const b = branches[0];
                  setSelectedTimingBranch(b);
                  setTimingStartTime(b.shift_start_time || '09:00');
                  setTimingGracePeriod(b.grace_period_minutes !== undefined ? b.grace_period_minutes : 15);
                }
                setShowTimingModal(true);
              }}
              className="py-2.5 px-4 text-xs font-bold rounded-xl text-white shadow-lg flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #FF9F43, #EE5253)' }}
            >
              <span>⏱️</span> مواعيد الفروع وفترة السماح
            </button>
          )}

          {isManagement && (
            <button
              onClick={() => setShowTransferModal(true)}
              className="btn-primary py-2.5 px-5 text-xs font-bold flex items-center gap-2 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #FF6B9D)' }}
              id="overtime-transfer-btn"
            >
              <span>🔄</span> تسجيل تطبيق / شيفت إضافي بفرع آخر
            </button>
          )}
        </div>
      </div>

      {/* Cashier Current Location & Actions Banner */}
      {isCashier && (
        <div className="glass-card-static p-5 animate-fadeInUp"
          style={{ background: 'linear-gradient(135deg, rgba(0,212,170,0.15), rgba(108,99,255,0.12))', border: '2px solid rgba(0,212,170,0.4)' }}>

          {/* Current Location Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: 'rgba(0,212,170,0.2)', border: '2px solid rgba(0,212,170,0.5)' }}>
              📍
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-text-muted tracking-widest uppercase mb-0.5">تواجدي الحالي</p>
              <p className="text-2xl font-black text-accent leading-tight">{user?.branch_name || 'لم يُحدد فرع بعد'}</p>
              <p className="text-xs text-text-muted mt-0.5">أنت الكاشير المسؤول عن هذا الفرع</p>
            </div>
            <span className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5"
              style={{ background: 'rgba(0,212,170,0.2)', color: 'var(--accent)', border: '1px solid rgba(0,212,170,0.4)' }}>
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse inline-block" />
              نشط
            </span>
          </div>

          {/* 3 Action Buttons */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {/* ✅ Clock In */}
            <button
              onClick={() => { setClockInBranchId(''); setClockInMessage(''); setShowClockInModal(true); }}
              disabled={clockLoading}
              id="cashier-clockin-btn"
              className="py-3.5 px-2 rounded-2xl text-xs font-bold text-white flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #00D4AA, #00B894)' }}
            >
              <span className="text-2xl">✅</span>
              <span>تسجيل حضور</span>
            </button>

            {/* 🚪 Clock Out */}
            <button
              onClick={() => handleClockOut(user.id)}
              disabled={clockLoading}
              id="cashier-clockout-btn"
              className="py-3.5 px-2 rounded-2xl text-xs font-bold text-white flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #FF4757, #FF6B35)' }}
            >
              <span className="text-2xl">🚪</span>
              <span>تسجيل انصراف</span>
            </button>

            {/* ⚡ Part-time / Branch Transfer */}
            <button
              onClick={() => setShowTransferModal(true)}
              disabled={clockLoading}
              id="part-time-btn"
              className="py-3.5 px-2 rounded-2xl text-xs font-bold text-white flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #4FACFE)' }}
            >
              <span className="text-2xl">⚡</span>
              <span>بارت تايم</span>
            </button>
          </div>

          {/* Branch Filter Dropdown */}
          <div className="flex items-center gap-2 pt-3 border-t border-dark-border">
            <span className="text-xs font-semibold text-text-secondary whitespace-nowrap">📊 عرض حضور فرع:</span>
            <select
              value={activeBranchId}
              onChange={e => setActiveBranchId(e.target.value)}
              className="input-dark text-xs p-2 rounded-xl flex-1"
            >
              <option value="">كل الفروع</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Employee Info & Clock-In Request Banner */}
      {!isManagement && (
        <div className="glass-card-static p-6 space-y-4 animate-fadeInUp"
          style={{ background: 'linear-gradient(135deg, rgba(0,212,170,0.12), rgba(108,99,255,0.08))', border: '1px solid rgba(0,212,170,0.3)' }}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">📩</span>
            <div>
              <h2 className="font-bold text-lg text-primary">طلب تسجيل حضور بالفرع للشيفت</h2>
              <p className="text-xs text-muted">اختر الفرع المتواجد فيه اليوم وأرسل طلب الحضور لكاشير الفرع للاعتماد</p>
            </div>
          </div>

          {reqMessage && (
            <div className="p-3 rounded-xl text-xs font-bold text-center animate-scaleIn"
              style={{
                background: reqMessage.startsWith('📩') || reqMessage.startsWith('✅') ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
                color: reqMessage.startsWith('📩') || reqMessage.startsWith('✅') ? 'var(--accent)' : '#FF4757'
              }}>
              {reqMessage}
            </div>
          )}

          {myRecord?.status === 'pending' ? (
            <div className="p-4 rounded-xl text-center space-y-1 animate-pulse"
              style={{ background: 'rgba(255,179,71,0.15)', border: '1px solid rgba(255,179,71,0.4)' }}>
              <p className="font-bold text-warning text-sm">⏳ طلب حضورك معلق بالفرع ({myRecord?.shift_branch_name || 'الفرع المحدد'})</p>
              <p className="text-xs text-muted">تم إرسال الطلب الساعة {myRecord?.clock_in} وبانتظار موافقة واعتما كاشير الفرع حالياً.</p>
            </div>
          ) : myRecord?.status === 'present' ? (
            <div className="p-4 rounded-xl text-center space-y-1"
              style={{ background: 'rgba(0,212,170,0.15)', border: '1px solid rgba(0,212,170,0.3)' }}>
              <p className="font-bold text-accent text-sm">✅ تم اعتماد حضورك رسمياً بالفرع ({myRecord?.shift_branch_name || 'الفرع'}) الساعة {myRecord?.clock_in}</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-semibold mb-1 block text-text-secondary">اختر فرع الشيفت اليوم *</label>
                <select
                  value={employeeBranchId}
                  onChange={e => setEmployeeBranchId(e.target.value)}
                  className="input-dark w-full font-bold text-sm"
                  style={{ border: '1px solid var(--accent)' }}
                >
                  <option value="">-- اختر الفرع --</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>📍 {b.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSendEmployeeRequest}
                disabled={clockLoading || !employeeBranchId}
                className="btn-primary py-3 px-6 text-xs font-bold self-end flex items-center gap-2 shadow-lg"
              >
                <span>🚀</span> {clockLoading ? 'جاري إرسال الطلب...' : 'إرسال طلب الحضور للكاشير'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cashier Pending Requests Alert Banner */}
      {isManagement && (
        <>
          {attendance.filter(a => a.status === 'pending').length > 0 && (
            <div className="glass-card p-4 border border-warning/50 animate-pulse flex items-center justify-between flex-wrap gap-2"
              style={{ background: 'rgba(255,179,71,0.12)' }}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">📩</span>
                <div>
                  <p className="font-bold text-sm text-warning">
                    تنبيه: يوجد عدد ({attendance.filter(a => a.status === 'pending').length}) طلبات حضور معلقة من موظفي فرعك!
                  </p>
                  <p className="text-xs text-muted">راجع الجدول بالأسفل واضغط موافقة وتأكيد لتأكيد حضور الموظفين بالفرع.</p>
                </div>
              </div>
            </div>
          )}

          <div className="glass-card p-4 text-sm font-bold flex items-center justify-between border border-accent/40 animate-fadeInUp"
            style={{ background: 'rgba(108,99,255,0.1)', color: 'var(--text-primary)' }}>
            <span>👑 تحكم الحضور والانصراف: يمكنك الموافقة على طلبات الحضور وتسجيل الانصراف للموظفين مباشرة.</span>
          </div>
        </>
      )}

      {/* Stats (Manager) */}
      {user?.role === 'manager' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeInUp delay-100">
          {[
            { key: 'present', label: 'حاضر', icon: '✅', color: 'var(--accent)' },
            { key: 'absent', label: 'غائب', icon: '❌', color: '#FF4757' },
            { key: 'late', label: 'متأخر', icon: '⏰', color: 'var(--warning)' },
            { key: 'leave', label: 'إجازة', icon: '🌴', color: 'var(--primary-light)' },
          ].map(s => (
            <div key={s.key} className="glass-card p-4 text-center">
              <span className="text-3xl">{s.icon}</span>
              <p className="text-2xl font-black mt-2" style={{ color: s.color, fontFamily: 'Inter' }}>{stats[s.key]}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="glass-card-static p-4 flex flex-wrap gap-3 items-center animate-fadeInUp delay-200">
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="input-dark w-auto"
          id="date-filter"
          style={{ maxWidth: '180px' }}
        />
        <input
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="ابحث باسم الموظف..."
          className="input-dark flex-1"
          id="search-filter"
          style={{ minWidth: '160px' }}
        />
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="input-dark w-auto"
          id="role-filter"
          style={{ maxWidth: '140px' }}
        >
          <option value="all">كل الأدوار</option>
          <option value="chef">شيفات</option>
          <option value="driver">سائق</option>
          <option value="accountant">محاسب</option>
          <option value="prep">تحضير</option>
          <option value="fridge">ثلاجة</option>
          <option value="hall">صالة</option>
          <option value="delivery">دليفري</option>
          <option value="cashier">كاشير</option>
          <option value="employee">موظف عام</option>
          <option value="manager">مدير</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card-static p-6 animate-fadeInUp delay-300">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 opacity-50">
            <p className="text-4xl mb-3">📭</p>
            <p style={{ color: 'var(--text-muted)' }}>لا يوجد بيانات لهذا اليوم</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dark-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الاسم</th>
                  <th>الدور</th>
                  <th>وقت الحضور</th>
                  <th>وقت الانصراف</th>
                  <th>الساعات</th>
                  <th>الحالة</th>
                  {isManagement && <th>الإجراء (تسجيل)</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((rec, i) => {
                  const sc = statusConfig[rec.status] || statusConfig.absent;
                  const hours = rec.clock_in && rec.clock_out
                    ? (() => {
                        const [ih, im] = rec.clock_in.split(':').map(Number);
                        const [oh, om] = rec.clock_out.split(':').map(Number);
                        const diff = (oh * 60 + om) - (ih * 60 + im);
                        return diff > 0 ? `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')}` : '—';
                      })()
                    : '—';
                  return (
                    <tr key={rec.user_id}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'Inter' }}>{i + 1}</td>
                      <td className="font-semibold" style={{ color: 'var(--text-primary)' }}>{rec.full_name}</td>
                      <td><span className={`badge-${rec.role}`}>{roleLabels[rec.role] || rec.role}</span></td>
                      <td style={{ fontFamily: 'Inter', color: 'var(--accent)' }}>{rec.clock_in || '—'}</td>
                      <td style={{ fontFamily: 'Inter', color: '#FF4757' }}>{rec.clock_out || '—'}</td>
                      <td style={{ fontFamily: 'Inter', color: 'var(--text-secondary)' }}>{hours}</td>
                      <td>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold"
                          style={{ background: sc.bg, color: sc.color }}>
                          {sc.icon} {sc.label}
                        </span>
                      </td>
                      {isManagement && (
                        <td>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {rec.status === 'pending' && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => handleApproveAttendance(rec.attendance_id, 'present')}
                                  disabled={clockLoading}
                                  className="px-3 py-1 rounded-lg text-xs font-bold transition shadow-md"
                                  style={{ background: 'var(--accent)', color: '#000' }}
                                >
                                  ✅ موافقة وتأكيد
                                </button>
                                <button
                                  onClick={() => handleApproveAttendance(rec.attendance_id, 'rejected')}
                                  disabled={clockLoading}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold transition text-white shadow-sm"
                                  style={{ background: '#FF4757' }}
                                >
                                  ❌ رفض
                                </button>
                              </div>
                            )}

                            {rec.status !== 'pending' && !rec.clock_in && (
                              <>
                                <button
                                  onClick={() => handleClockIn(rec.user_id)}
                                  disabled={clockLoading}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-sm"
                                  style={{ background: 'var(--accent)', color: '#000' }}
                                >
                                  ✅ حضور
                                </button>
                                <button
                                  onClick={() => handleMarkAbsent(rec.user_id)}
                                  disabled={clockLoading}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold transition text-white shadow-sm"
                                  style={{ background: '#FF4757' }}
                                >
                                  ❌ غياب
                                </button>
                              </>
                            )}

                            {rec.status === 'absent' && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-red-400">❌ غائب</span>
                                <button
                                  onClick={() => handleClockIn(rec.user_id)}
                                  disabled={clockLoading}
                                  className="px-2 py-0.5 rounded text-xs border border-accent text-accent hover:bg-accent/10"
                                >
                                  تعديل لحضور
                                </button>
                              </div>
                            )}

                            {rec.clock_in && !rec.clock_out && (
                              <button
                                onClick={() => handleClockOut(rec.user_id)}
                                disabled={clockLoading}
                                className="px-3 py-1 rounded-lg text-xs font-bold transition text-white shadow-sm"
                                style={{ background: '#FF4757' }}
                              >
                                🚪 تسجيل انصراف
                              </button>
                            )}

                            {rec.clock_in && rec.clock_out && (
                              <span className="text-xs text-accent font-semibold">
                                ✅ يوم مكتمل
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Shift Transfer / التطبيق Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card-static p-6 rounded-3xl max-w-md w-full border border-primary/40 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b pb-3 border-dark-border">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔄</span>
                <div>
                  <h3 className="font-bold text-lg text-primary">خاصية التطبيق (شيفت إضافي)</h3>
                  <p className="text-xs text-muted">تسجيل انصراف آلي من الفرع الحالي وحضور جديد بالفرع المختار</p>
                </div>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-muted hover:text-white text-lg">✕</button>
            </div>

            {transferMessage && (
              <div className="p-3 rounded-xl text-xs font-bold text-center animate-scaleIn"
                style={{
                  background: transferMessage.startsWith('✅') || transferMessage.startsWith('🔄') ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
                  color: transferMessage.startsWith('✅') || transferMessage.startsWith('🔄') ? 'var(--accent)' : '#FF4757',
                  border: `1px solid ${transferMessage.startsWith('✅') || transferMessage.startsWith('🔄') ? 'rgba(0,212,170,0.3)' : 'rgba(255,71,87,0.3)'}`
                }}>
                {transferMessage}
              </div>
            )}

            <div>
              <p className="text-sm font-bold text-accent bg-accent/10 p-2 rounded-lg mb-3 border border-accent/20">
                📍 متواجد كاشير حالياً في: {user?.branch_name || 'غير محدد'}
              </p>
              <label className="text-xs font-semibold mb-1 block text-text-secondary">
                اختر الفرع الجديد للانتقال والتطبيق إليه *
              </label>
              <select
                value={transferBranchId}
                onChange={e => setTransferBranchId(e.target.value)}
                className="input-dark w-full font-bold text-sm p-3 rounded-xl"
                style={{ border: '1px solid var(--accent)', background: 'rgba(0,212,170,0.08)' }}
              >
                <option value="">-- اختر الفرع الجديد --</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>📍 {b.name}</option>
                ))}
              </select>
            </div>

            <div className="p-3 rounded-xl bg-dark/50 text-xs text-muted space-y-1" style={{ border: '1px solid var(--dark-border)' }}>
              <p className="font-bold text-accent">ℹ️ ماذا سيحدث عند تأكيد التطبيق؟</p>
              <p>1. سيتم تسجيل انصرافك آلياً من الفرع السابق في هذا الوقت.</p>
              <p>2. سيتم تسجيل حضورك الفوري بـ (الفرع الجديد).</p>
              <p>3. ستتحول شاشتك فوراً لموظفي الفرع الجديد لإدارة حضورهم وسلفهم.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleShiftTransfer}
                disabled={transferLoading || !transferBranchId}
                className="btn-primary flex-1 py-3 text-xs font-bold"
                id="confirm-shift-transfer-btn"
              >
                {transferLoading ? 'جاري نقل الشيفت والتطبيق...' : '⚡ تأكيد التطبيق والانتقال للفرع'}
              </button>
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-3 rounded-xl text-xs font-bold bg-dark-card border border-dark-border text-text-muted hover:text-white"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cashier Clock-In Branch Selection Modal */}
      {showClockInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card-static p-6 rounded-3xl max-w-md w-full border border-accent/40 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b pb-3 border-dark-border">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <div>
                  <h3 className="font-bold text-lg text-accent">تسجيل حضور بالفرع</h3>
                  <p className="text-xs text-muted">اختر الفرع اللي هتبدأ فيه شيفتك النهارده</p>
                </div>
              </div>
              <button onClick={() => setShowClockInModal(false)} className="text-muted hover:text-white text-lg">✕</button>
            </div>

            {clockInMessage && (
              <div className="p-3 rounded-xl text-xs font-bold text-center animate-scaleIn"
                style={{
                  background: clockInMessage.startsWith('✅') ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
                  color: clockInMessage.startsWith('✅') ? 'var(--accent)' : '#FF4757',
                  border: `1px solid ${clockInMessage.startsWith('✅') ? 'rgba(0,212,170,0.3)' : 'rgba(255,71,87,0.3)'}`
                }}>
                {clockInMessage}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold mb-2 block text-text-secondary">
                📍 أنت حالياً في أي فرع؟ *
              </label>
              <div className="grid grid-cols-1 gap-2">
                {branches.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setClockInBranchId(String(b.id))}
                    className={`p-3 rounded-xl text-sm font-bold text-right flex items-center gap-3 transition-all border ${String(clockInBranchId) === String(b.id) ? 'border-accent shadow-lg scale-[1.02]' : 'border-dark-border hover:border-accent/50'}`}
                    style={{
                      background: String(clockInBranchId) === String(b.id) ? 'rgba(0,212,170,0.15)' : 'rgba(26,26,53,0.6)',
                      color: String(clockInBranchId) === String(b.id) ? 'var(--accent)' : 'var(--text-secondary)'
                    }}
                  >
                    <span className="text-xl">{String(clockInBranchId) === String(b.id) ? '✅' : '📍'}</span>
                    <span>{b.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCashierClockIn}
                disabled={clockLoading || !clockInBranchId}
                className="btn-primary flex-1 py-3 text-xs font-bold"
                style={{ background: clockInBranchId ? 'linear-gradient(135deg, #00D4AA, #00B894)' : undefined }}
                id="confirm-cashier-clockin-btn"
              >
                {clockLoading ? 'جاري تسجيل الحضور...' : '✅ تأكيد الحضور وبدء الشيفت'}
              </button>
              <button
                onClick={() => setShowClockInModal(false)}
                className="px-4 py-3 rounded-xl text-xs font-bold bg-dark-card border border-dark-border text-text-muted hover:text-white"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Shift Timings Modal */}
      {showTimingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card-static p-6 rounded-3xl max-w-md w-full border border-orange-500/40 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b pb-3 border-dark-border">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⏱️</span>
                <div>
                  <h3 className="font-bold text-lg text-white">ضبط مواعيد الفروع وفترة السماح</h3>
                  <p className="text-xs text-text-muted">يتم حساب التأخير وإشعار الإدارة تلقائياً عند تجاوز فترة السماح</p>
                </div>
              </div>
              <button onClick={() => setShowTimingModal(false)} className="text-muted hover:text-white text-lg">✕</button>
            </div>

            {timingMessage && (
              <div className="p-3 rounded-xl text-xs font-bold text-center animate-scaleIn"
                style={{
                  background: timingMessage.startsWith('✅') ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
                  color: timingMessage.startsWith('✅') ? 'var(--accent)' : '#FF4757',
                  border: `1px solid ${timingMessage.startsWith('✅') ? 'rgba(0,212,170,0.3)' : 'rgba(255,71,87,0.3)'}`
                }}>
                {timingMessage}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold mb-2 block text-text-secondary">اختر الفرع للضبط:</label>
              <div className="grid grid-cols-2 gap-2">
                {branches.map(b => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedTimingBranch(b);
                      setTimingStartTime(b.shift_start_time || '09:00');
                      setTimingGracePeriod(b.grace_period_minutes !== undefined ? b.grace_period_minutes : 15);
                    }}
                    className={`p-2.5 rounded-xl text-xs font-bold transition-all border ${selectedTimingBranch?.id === b.id ? 'border-accent bg-accent/15 text-accent' : 'border-dark-border bg-dark/40 text-text-muted'}`}
                  >
                    📍 {b.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedTimingBranch && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-semibold mb-1 block text-text-secondary">وقت بدء الوردية (الشيفت):</label>
                  <input
                    type="time"
                    value={timingStartTime}
                    onChange={e => setTimingStartTime(e.target.value)}
                    className="input-dark w-full text-center font-bold text-base"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block text-text-secondary">فترة السماح بالدقائق (Grace Period):</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={timingGracePeriod}
                    onChange={e => setTimingGracePeriod(e.target.value)}
                    className="input-dark w-full text-center font-bold text-base"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    إذا حضر الموظف بعد <span className="text-accent font-mono">{timingStartTime}</span> بـ <span className="text-accent font-mono">{timingGracePeriod}</span> دقيقة، يسجل كـ (متأخر) ويصل تنبيه للإدارة.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveTiming}
                disabled={timingLoading || !selectedTimingBranch}
                className="btn-primary flex-1 py-3 text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, #FF9F43, #EE5253)' }}
              >
                {timingLoading ? 'جاري الحفظ...' : '💾 حفظ التوقيت للفرع'}
              </button>
              <button
                onClick={() => setShowTimingModal(false)}
                className="px-4 py-3 rounded-xl text-xs font-bold bg-dark-card border border-dark-border text-text-muted hover:text-white"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;