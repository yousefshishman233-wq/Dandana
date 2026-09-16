import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { calendarAPI, authAPI } from '../services/api';

const DAYS_AR   = ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const LEAVE_TYPES = [
  { id: 'leave',      icon: '🌴', label: 'إجازة',       color: '#6C63FF', bg: 'rgba(108,99,255,0.15)' },
  { id: 'late',       icon: '⏰', label: 'تأخير',       color: '#FFB347', bg: 'rgba(255,179,71,0.15)'  },
  { id: 'permission', icon: '🚶', label: 'استئذان',     color: '#00D4AA', bg: 'rgba(0,212,170,0.15)'   },
  { id: 'sick',       icon: '🤒', label: 'مرض',        color: '#FF4757', bg: 'rgba(255,71,87,0.15)'   },
  { id: 'shift_swap', icon: '🔄', label: 'تبديل شيفت', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
];

const STATUS_CONFIG = {
  pending:  { label: 'معلق',  color: '#FFB347', bg: 'rgba(255,179,71,0.15)',  icon: '⏳' },
  approved: { label: 'موافق', color: '#00D4AA', bg: 'rgba(0,212,170,0.15)',   icon: '✅' },
  rejected: { label: 'مرفوض',color: '#FF4757', bg: 'rgba(255,71,87,0.15)',   icon: '❌' },
};

const CalendarPage = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leaves, setLeaves]           = useState([]);
  const [employees, setEmployees]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal]     = useState(false);
  const [leaveType, setLeaveType]     = useState('leave');
  const [reason, setReason]           = useState('');
  const [endDate, setEndDate]         = useState('');

  // Shift Swap Specific State
  const [currentShift, setCurrentShift] = useState('مسائي / بليل');
  const [targetShift, setTargetShift]   = useState('صباحي / الصبح');
  const [substituteEmpName, setSubstituteEmpName] = useState('');

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError]     = useState('');
  const [submitOk, setSubmitOk]           = useState(false);

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => { 
    fetchLeaves(); 
    fetchEmployees();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await calendarAPI.getLeaves();
      if (res.data.success) setLeaves(res.data.leaves || []);
    } catch (e) { console.error('fetchLeaves error:', e.response?.data || e.message); }
    setLoading(false);
  };

  const fetchEmployees = async () => {
    try {
      const res = await authAPI.getAllUsers();
      if (res.data.success) {
        setEmployees(res.data.users?.filter(u => u.id !== user?.id && u.role !== 'manager') || []);
      }
    } catch (e) { console.error(e); }
  };

  const handleApprove = async (leaveId, status) => {
    try {
      const res = await calendarAPI.approveLeave(leaveId, status);
      if (res.data.success) await fetchLeaves();
    } catch (e) { console.error('approve error:', e.response?.data || e.message); }
  };

  const handleSubmitLeave = async () => {
    if (!selectedDay) { setSubmitError('اختار اليوم من التقويم'); return; }
    
    let finalReason = reason.trim();
    if (leaveType === 'shift_swap') {
      finalReason = `🔄 تبديل شيفت: من [${currentShift}] إلى [${targetShift}]${substituteEmpName ? ` • البديل: ${substituteEmpName}` : ''}${reason.trim() ? ` • ملحوظة: ${reason.trim()}` : ''}`;
    } else if (!finalReason) {
      setSubmitError('من فضلك اكتب سبب الطلب'); 
      return;
    }

    setSubmitLoading(true);
    setSubmitError('');
    try {
      const start_date = `${year}-${String(month + 1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`;
      const end_date   = endDate || start_date;
      const res = await calendarAPI.requestLeave({
        leave_type: leaveType,
        start_date,
        end_date,
        reason: finalReason,
      });
      if (res.data.success) {
        setSubmitOk(true);
        setReason(''); 
        setEndDate('');
        setSubstituteEmpName('');
        setTimeout(() => { setSubmitOk(false); setShowModal(false); }, 1500);
        await fetchLeaves();
      } else {
        setSubmitError(res.data.message || 'حدث خطأ');
      }
    } catch (e) {
      setSubmitError(e.response?.data?.message || 'حدث خطأ في الإرسال');
    }
    setSubmitLoading(false);
  };

  // ─── Calendar grid ───
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calDays = [];
  for (let i = 0; i < firstDay; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d);

  const getDayLeaves = (day) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return leaves.filter(l => dateStr >= l.start_date && dateStr <= (l.end_date || l.start_date));
  };

  const today    = new Date();
  const isToday  = (d) => d && d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Manager sees all; employee/cashier see only own
  const visibleLeaves = user?.role === 'manager'
    ? leaves
    : leaves.filter(l => l.user_id === user?.id);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="animate-fadeInUp flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">📅 التقويم والإجازات وتبديل الشيفتات</h1>
          <p style={{ color:'var(--text-muted)' }} className="text-sm">قدم طلب إجازة، استئذان، أو طلب تبديل شيفت مع زملائك</p>
        </div>
        {user?.role !== 'manager' && (
          <button
            onClick={() => {
              setLeaveType('shift_swap');
              setSubmitError('');
              setShowModal(true);
            }}
            className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
            id="quick-shift-swap-btn"
          >
            <span>🔄</span> طلب تبديل شيفت
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Calendar ── */}
        <div className="lg:col-span-2 glass-card-static p-6 animate-fadeInUp delay-100">
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} id="prev-month"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all hover:scale-110"
              style={{ background:'rgba(108,99,255,0.15)', color:'var(--primary-light)' }}>‹</button>
            <h2 className="font-black text-xl" style={{ color:'var(--text-primary)' }}>
              {MONTHS_AR[month]} {year}
            </h2>
            <button onClick={nextMonth} id="next-month"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all hover:scale-110"
              style={{ background:'rgba(108,99,255,0.15)', color:'var(--primary-light)' }}>›</button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS_AR.map(d => (
              <div key={d} className="text-center text-xs font-semibold py-2" style={{ color:'var(--text-muted)' }}>{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {calDays.map((day, i) => {
              const dl = getDayLeaves(day);
              const hasPending  = dl.some(l => l.status === 'pending');
              const hasApproved = dl.some(l => l.status === 'approved');
              const isSelected  = selectedDay === day;
              const isTodayDay  = isToday(day);
              return (
                <button
                  key={i}
                  disabled={!day}
                  onClick={() => {
                    if (!day) return;
                    setSelectedDay(day);
                    if (user?.role !== 'manager') setShowModal(true);
                  }}
                  className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 ${day ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}`}
                  style={{
                    background: isSelected  ? 'var(--gradient-primary)' :
                                isTodayDay  ? 'rgba(0,212,170,0.2)' :
                                day         ? 'rgba(26,26,53,0.6)' : 'transparent',
                    border: isTodayDay  ? '2px solid rgba(0,212,170,0.5)' :
                            isSelected  ? 'none' :
                            day         ? '1px solid var(--dark-border)' : 'none',
                    color: isSelected ? 'white' : isTodayDay ? 'var(--accent)' : day ? 'var(--text-primary)' : 'transparent',
                    boxShadow: isSelected ? 'var(--shadow-glow)' : 'none',
                  }}
                  id={day ? `cal-day-${day}` : undefined}
                >
                  {day}
                  {dl.length > 0 && (
                    <div className="absolute bottom-1 flex gap-0.5">
                      {hasPending  && <div className="w-1.5 h-1.5 rounded-full" style={{ background:'#FFB347' }} />}
                      {hasApproved && <div className="w-1.5 h-1.5 rounded-full" style={{ background:'#00D4AA' }} />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs" style={{ borderColor:'var(--dark-border)' }}>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background:'#00D4AA' }} /><span style={{ color:'var(--text-muted)' }}>اليوم</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background:'#FFB347' }} /><span style={{ color:'var(--text-muted)' }}>طلب معلق</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background:'#00D4AA' }} /><span style={{ color:'var(--text-muted)' }}>موافق عليه</span></div>
          </div>
        </div>

        {/* ── Leaves list ── */}
        <div className="space-y-4">
          <div className="glass-card-static p-5 animate-fadeInUp delay-200">
            <h2 className="section-header">📋 قائمة الطلبات ({visibleLeaves.length})</h2>

            {loading ? (
              <div className="flex justify-center py-8"><div className="spinner" /></div>
            ) : visibleLeaves.length === 0 ? (
              <div className="text-center py-8 opacity-40">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm" style={{ color:'var(--text-muted)' }}>لا يوجد طلبات حالية</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto scroll-area">
                {visibleLeaves.map(leave => {
                  const lt = LEAVE_TYPES.find(t => t.id === leave.leave_type) || LEAVE_TYPES[0];
                  const sc = STATUS_CONFIG[leave.status] || STATUS_CONFIG.pending;
                  return (
                    <div key={leave.id} className="p-4 rounded-xl animate-fadeInUp"
                      style={{ background: lt.bg, border:`1px solid ${lt.color}30` }}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{lt.icon}</span>
                          <div>
                            <p className="text-sm font-semibold" style={{ color:'var(--text-primary)' }}>
                              {user?.role === 'manager' ? leave.full_name : lt.label}
                            </p>
                            <p className="text-xs" style={{ color:'var(--text-muted)', fontFamily:'Inter' }}>
                              {leave.start_date}
                              {leave.end_date && leave.end_date !== leave.start_date ? ` ← ${leave.end_date}` : ''}
                            </p>
                            {user?.role === 'manager' && (
                              <p className="text-xs mt-0.5 font-medium" style={{ color: lt.color }}>
                                {lt.icon} {lt.label}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold whitespace-nowrap"
                          style={{ background:sc.bg, color:sc.color }}>
                          {sc.icon} {sc.label}
                        </span>
                      </div>
                      {leave.reason && (
                        <p className="text-xs mb-2 leading-relaxed" style={{ color:'var(--text-secondary)', background:'rgba(0,0,0,0.2)', padding:'6px 10px', borderRadius:'8px' }}>
                          {leave.reason}
                        </p>
                      )}

                      {/* Manager or Delegated Manager approve/reject */}
                      {(user?.role === 'manager' || user?.can_manage_leaves === 1) && leave.status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleApprove(leave.id, 'approved')}
                            className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                            style={{ background:'rgba(0,212,170,0.2)', color:'var(--accent)', border:'1px solid rgba(0,212,170,0.3)' }}
                            id={`approve-leave-${leave.id}`}>✅ موافقة</button>
                          <button onClick={() => handleApprove(leave.id, 'rejected')}
                            className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                            style={{ background:'rgba(255,71,87,0.2)', color:'#FF4757', border:'1px solid rgba(255,71,87,0.3)' }}
                            id={`reject-leave-${leave.id}`}>❌ رفض</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {user?.role !== 'manager' && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setLeaveType('leave'); setShowModal(true); }} className="btn-primary flex-1 text-center text-sm" id="new-request-btn">
                  + طلب إجازة / عذر
                </button>
                <button onClick={() => { setLeaveType('shift_swap'); setShowModal(true); }} className="btn-secondary flex-1 text-center text-sm" id="new-swap-btn">
                  🔄 تبديل شيفت
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Request Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(0,0,0,0.75)', backdropFilter:'blur(10px)' }}>
          <div className="glass-card-static p-6 w-full max-w-md animate-scaleIn max-h-screen overflow-y-auto scroll-area">
            <h3 className="font-bold text-lg mb-1" style={{ color:'var(--text-primary)' }}>
              📝 {leaveType === 'shift_swap' ? '🔄 طلب تبديل شيفت' : 'تقديم طلب جديد'}
              {selectedDay && (
                <span className="text-sm font-normal mr-2" style={{ color:'var(--text-muted)' }}>
                  ({selectedDay} {MONTHS_AR[month]})
                </span>
              )}
            </h3>

            {submitOk && (
              <div className="mb-3 p-3 rounded-xl text-sm text-center"
                style={{ background:'rgba(0,212,170,0.15)', color:'var(--accent)', border:'1px solid rgba(0,212,170,0.3)' }}>
                ✅ تم إرسال الطلب بنجاح!
              </div>
            )}
            {submitError && (
              <div className="mb-3 p-3 rounded-xl text-sm text-center"
                style={{ background:'rgba(255,71,87,0.15)', color:'#FF4757', border:'1px solid rgba(255,71,87,0.3)' }}>
                ⚠️ {submitError}
              </div>
            )}

            {/* Type selector */}
            <div className="grid grid-cols-3 gap-1.5 mb-4">
              {LEAVE_TYPES.map(lt => (
                <button key={lt.id} onClick={() => setLeaveType(lt.id)}
                  className="py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1"
                  style={leaveType === lt.id
                    ? { background:lt.bg, color:lt.color, border:`1px solid ${lt.color}50` }
                    : { background:'rgba(26,26,53,0.6)', color:'var(--text-muted)', border:'1px solid var(--dark-border)' }}
                  id={`leave-type-${lt.id}`}>
                  <span>{lt.icon}</span>
                  <span>{lt.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {/* Dynamic inputs based on leaveType */}
              {leaveType === 'shift_swap' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color:'var(--text-secondary)' }}>الشيفت الحالي *</label>
                      <select value={currentShift} onChange={e => setCurrentShift(e.target.value)} className="input-dark">
                        <option value="مسائي / بليل">🌙 مسائي / بليل</option>
                        <option value="صباحي / الصبح">☀️ صباحي / الصبح</option>
                        <option value="شيفت وسط">🌆 شيفت وسط</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color:'var(--text-secondary)' }}>الشيفت المطلوب *</label>
                      <select value={targetShift} onChange={e => setTargetShift(e.target.value)} className="input-dark">
                        <option value="صباحي / الصبح">☀️ صباحي / الصبح</option>
                        <option value="مسائي / بليل">🌙 مسائي / بليل</option>
                        <option value="شيفت وسط">🌆 شيفت وسط</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color:'var(--text-secondary)' }}>
                      الموظف البديل (اختياري)
                    </label>
                    <select
                      value={substituteEmpName}
                      onChange={e => setSubstituteEmpName(e.target.value)}
                      className="input-dark"
                    >
                      <option value="">-- اختار البديل لو فيه حد --</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.full_name}>{e.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color:'var(--text-secondary)' }}>
                      ملاحظة / سبب التبديل
                    </label>
                    <textarea id="leave-reason" value={reason} onChange={e => setReason(e.target.value)}
                      placeholder="اكتب سبب طلب تبديل الشيفت..."
                      className="input-dark resize-none" rows={2} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color:'var(--text-secondary)' }}>
                      تاريخ الانتهاء (اختياري للإجازات)
                    </label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                      className="input-dark" id="end-date" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color:'var(--text-secondary)' }}>
                      السبب *
                    </label>
                    <textarea id="leave-reason" value={reason} onChange={e => setReason(e.target.value)}
                      placeholder="اكتب سبب الطلب بالتفصيل..."
                      className="input-dark resize-none" rows={3} />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={handleSubmitLeave}
                  disabled={submitLoading}
                  className="btn-primary flex-1 text-center disabled:opacity-50"
                  id="submit-leave">
                  {submitLoading ? '⏳ جاري الإرسال...' : '✅ إرسال الطلب'}
                </button>
                <button onClick={() => { setShowModal(false); setReason(''); setEndDate(''); setSubmitError(''); }}
                  className="btn-secondary flex-1 text-center" id="cancel-leave">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;