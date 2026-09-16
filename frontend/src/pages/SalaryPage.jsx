import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { hrAPI, authAPI } from '../services/api';
import * as XLSX from 'xlsx';

const ICE_CREAM_PRODUCTS = [
  { name: 'بوله واحدة', price: 20 },
  { name: 'بوله اتنين', price: 35 },
  { name: 'بوله تلاتة', price: 60 },
  { name: 'بوله أربعة', price: 75 },
  { name: 'نص كيلو', price: 110 },
  { name: 'بسكوته فاضية', price: 3 },
];

const DISCOUNT = 0.25;

const ROLE_AR = {
  manager: '👑 مدير',
  cashier: '🖐️ كاشير',
  chef: '🍳 شيفات',
  driver: '🚗 سائق',
  accountant: '📊 محاسب',
  prep: '🔪 تحضير',
  fridge: '❄️ ثلاجة',
  hall: '🍽️ صالة',
  delivery: '🛵 دليفري',
  employee: '👷 موظف عام',
};

const SalaryPage = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [salaryData, setSalaryData] = useState(null);
  const [advances, setAdvances] = useState([]);
  const [pendingAdvances, setPendingAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'pending' | 'advance' | 'ice_cream'
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Advance modal state
  const [showAdvModal, setShowAdvModal] = useState(false);
  const [targetEmpId, setTargetEmpId] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advNote, setAdvNote] = useState('');
  const [advLoading, setAdvLoading] = useState(false);
  const [advError, setAdvError] = useState('');
  const [advSuccess, setAdvSuccess] = useState('');

  // Ice cream order modal state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [targetOrderEmpId, setTargetOrderEmpId] = useState('');
  const [orderItems, setOrderItems] = useState({});
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');

  const isManagerOrCashier = ['manager', 'cashier'].includes(user?.role);
  const isManager = user?.role === 'manager';

  const [activeTab, setActiveTab] = useState('management'); // 'management' | 'summary'
  const [salarySummary, setSalarySummary] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Manager Adjustment Modals State
  const [showAdjustAdvModal, setShowAdjustAdvModal] = useState(false);
  const [adjustAdvAmount, setAdjustAdvAmount] = useState('');
  const [adjustAdvReason, setAdjustAdvReason] = useState('');
  const [adjustAdvLoading, setAdjustAdvLoading] = useState(false);
  const [adjustAdvError, setAdjustAdvError] = useState('');

  const [showAdjustIceModal, setShowAdjustIceModal] = useState(false);
  const [adjustIceAmount, setAdjustIceAmount] = useState('');
  const [adjustIceReason, setAdjustIceReason] = useState('');
  const [adjustIceLoading, setAdjustIceLoading] = useState(false);
  const [adjustIceError, setAdjustIceError] = useState('');

  useEffect(() => {
    if (isManagerOrCashier) {
      fetchEmployees();
      fetchPendingAdvances();
    } else {
      loadMyData(user?.id);
    }
  }, [month, user?.role]);

  // Separate effect for summary tab - runs whenever tab switches to 'summary' or month changes
  useEffect(() => {
    if ((isManager || isManagerOrCashier) && activeTab === 'summary') {
      fetchSalarySummary();
    }
  }, [activeTab, month]);

  const fetchSalarySummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await hrAPI.getSalarySummary(month);
      if (res.data.success) {
        setSalarySummary(res.data.summary || []);
      } else {
        console.error('Summary failed:', res.data.message);
      }
    } catch (e) {
      console.error('Summary error:', e.response?.data || e.message);
    }
    setSummaryLoading(false);
  };

  const exportToExcel = () => {
    if (salarySummary.length === 0) return;
    const dataToExport = salarySummary.map(s => ({
      'الموظف': s.user_name,
      'الوظيفة': ROLE_AR[s.user_role] || s.user_role,
      'الفرع': s.branch_name || 'بدون فرع',
      'الراتب الأساسي': s.base_salary,
      'أيام العمل': s.days_worked,
      'الراتب المستحق (حسب الأيام)': s.calculated_salary,
      'إجمالي السلف': s.total_advances,
      'إجمالي الآيس كريم': s.total_ice_cream,
      'المديونية المرحلة': s.carried_debt || 0,
      'الصافي (له / عليه)': s.net_salary
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `رواتب ${month}`);
    XLSX.writeFile(workbook, `Salary_Summary_${month}.xlsx`);
  };

  const handleAdjustAdvance = async () => {
    if (!adjustAdvAmount || isNaN(adjustAdvAmount)) {
      setAdjustAdvError('يرجى كتابة مبلغ صحيح (سالب لإسقاط أو موجب لإضافة)');
      return;
    }
    setAdjustAdvLoading(true);
    setAdjustAdvError('');
    try {
      const res = await hrAPI.adjustAdvances(selectedEmp?.id, Number(adjustAdvAmount), adjustAdvReason);
      if (res.data.success) {
        setShowAdjustAdvModal(false);
        setAdjustAdvAmount('');
        setAdjustAdvReason('');
        await loadEmpData(selectedEmp?.id);
        if (activeTab === 'summary') fetchSalarySummary();
      } else {
        setAdjustAdvError(res.data.message || 'فشل التعديل');
      }
    } catch (e) {
      setAdjustAdvError(e.response?.data?.message || 'فشل الاتصال بالسيرفر');
    }
    setAdjustAdvLoading(false);
  };

  const handleAdjustIceCream = async () => {
    if (!adjustIceAmount || isNaN(adjustIceAmount)) {
      setAdjustIceError('يرجى كتابة مبلغ صحيح (سالب لإسقاط أو موجب لإضافة)');
      return;
    }
    setAdjustIceLoading(true);
    setAdjustIceError('');
    try {
      const res = await hrAPI.adjustIceCream(selectedEmp?.id, Number(adjustIceAmount), adjustIceReason);
      if (res.data.success) {
        setShowAdjustIceModal(false);
        setAdjustIceAmount('');
        setAdjustIceReason('');
        await loadEmpData(selectedEmp?.id);
        if (activeTab === 'summary') fetchSalarySummary();
      } else {
        setAdjustIceError(res.data.message || 'فشل التعديل');
      }
    } catch (e) {
      setAdjustIceError(e.response?.data?.message || 'فشل الاتصال بالسيرفر');
    }
    setAdjustIceLoading(false);
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await authAPI.getAllUsers();
      if (res.data.success) {
        let emps = res.data.users?.filter(u => u.role !== 'manager') || [];
        if (user?.role === 'cashier' && user?.branch_id) {
          emps = emps.filter(u => u.branch_id === user.branch_id || !u.branch_id);
        }
        setEmployees(emps);
        if (emps.length > 0) {
          const defaultEmp = selectedEmp ? emps.find(e => e.id === selectedEmp.id) || emps[0] : emps[0];
          setSelectedEmp(defaultEmp);
          setTargetEmpId(defaultEmp.id);
          setTargetOrderEmpId(defaultEmp.id);
          await loadEmpData(defaultEmp.id);
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchPendingAdvances = async () => {
    try {
      const res = await hrAPI.getAdvances(null, month, 'pending');
      if (res.data.success) {
        setPendingAdvances(res.data.advances || []);
      }
    } catch (e) { console.error(e); }
  };

  const loadMyData = async (uid) => {
    if (!uid) return;
    setLoading(true);
    await loadEmpData(uid);
    setLoading(false);
  };

  const loadEmpData = async (uid) => {
    try {
      const [salRes, advRes] = await Promise.allSettled([
        hrAPI.getSalaryCalculation(uid, month),
        hrAPI.getAdvances(uid, month),
      ]);
      if (salRes.status === 'fulfilled' && salRes.value.data.success) {
        setSalaryData(salRes.value.data.salary);
      }
      if (advRes.status === 'fulfilled' && advRes.value.data.success) {
        setAdvances(advRes.value.data.advances || []);
      }
    } catch (e) { console.error(e); }
  };

  const handleSelectEmp = async (emp) => {
    setSelectedEmp(emp);
    setTargetEmpId(emp.id);
    setTargetOrderEmpId(emp.id);
    setSalaryData(null);
    setAdvances([]);
    await loadEmpData(emp.id);
  };

  const handleAddAdvance = async () => {
    setAdvError('');
    setAdvSuccess('');
    if (!advAmount || isNaN(advAmount) || Number(advAmount) <= 0) {
      setAdvError('أدخل مبلغ سلفة صحيح');
      return;
    }
    const finalUserId = isManagerOrCashier ? (targetEmpId || selectedEmp?.id || user.id) : user.id;

    setAdvLoading(true);
    try {
      const res = await hrAPI.addAdvance(finalUserId, Number(advAmount), advNote);
      if (res.data.success) {
        setAdvSuccess(res.data.message || 'تم إرسال الطلب بنجاح');
        setAdvAmount('');
        setAdvNote('');
        setTimeout(() => {
          setShowAdvModal(false);
          setAdvSuccess('');
        }, 1200);
        if (isManagerOrCashier) {
          await fetchPendingAdvances();
        }
        await loadEmpData(selectedEmp?.id || user.id);
      } else {
        setAdvError(res.data.message || 'حدث خطأ في طلب السلفة');
      }
    } catch (e) {
      setAdvError(e.response?.data?.message || 'فشل الاتصال بالسيرفر');
    }
    setAdvLoading(false);
  };

  const handleUpdateAdvanceStatus = async (advanceId, newStatus) => {
    try {
      const res = await hrAPI.updateAdvanceStatus(advanceId, newStatus);
      if (res.data.success) {
        if (isManagerOrCashier) {
          await fetchPendingAdvances();
        }
        await loadEmpData(selectedEmp?.id || user.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleIceCreamOrder = async () => {
    setOrderError('');
    const items = Object.entries(orderItems)
      .filter(([, qty]) => qty > 0)
      .map(([name, qty]) => {
        const product = ICE_CREAM_PRODUCTS.find(p => p.name === name);
        return { name, qty, price: product.price, total: product.price * qty };
      });

    if (items.length === 0) {
      setOrderError('اختر صنف واحد على الأقل');
      return;
    }

    const finalUserId = isManagerOrCashier ? (targetOrderEmpId || selectedEmp?.id || user.id) : user.id;

    setOrderLoading(true);
    try {
      const res = await hrAPI.addIceCreamDeduction(finalUserId, items);
      if (res.data.success) {
        setOrderItems({});
        setShowOrderModal(false);
        await loadEmpData(selectedEmp?.id || user.id);
      } else {
        setOrderError(res.data.message || 'حدث خطأ في التسجيل');
      }
    } catch (e) {
      setOrderError(e.response?.data?.message || 'فشل الاتصال بالسيرفر');
    }
    setOrderLoading(false);
  };

  const orderTotal = Object.entries(orderItems).reduce((sum, [name, qty]) => {
    const p = ICE_CREAM_PRODUCTS.find(pr => pr.name === name);
    return sum + (p?.price || 0) * qty;
  }, 0);
  const orderAfterDiscount = orderTotal * (1 - DISCOUNT);

  const currentUser = isManagerOrCashier ? selectedEmp : user;
  const salBase = salaryData?.base_salary ?? (currentUser?.salary || 0);
  const daysWorked = salaryData?.days_worked ?? 0;
  const daysAbsent = salaryData?.days_absent ?? 0;
  const salEarned = salaryData?.earned_salary ?? salBase;
  const salAdvances = salaryData?.total_advances ?? 0;
  const salIceCream = salaryData?.ice_cream_deduction ?? 0;
  const salNet = salaryData?.net_balance ?? (salEarned - salAdvances - salIceCream);
  const isPositive = salNet >= 0;

  // Filtered advances for list
  const filteredAdvances = advances.filter(a => {
    const isIceCream = a.type === 'ice_cream' || a.reason?.includes('آيس كريم');
    if (filterType === 'pending') return a.status === 'pending';
    if (filterType === 'advance') return !isIceCream && (a.status === 'approved' || !a.status);
    if (filterType === 'ice_cream') return isIceCream;
    return true;
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="animate-fadeInUp">
        <h1 className="page-title">💰 الرواتب والسلف وتنسيق الكاشيرين</h1>
        <p style={{ color: 'var(--text-muted)' }} className="text-sm">
          تنسيق صرف السلف بين الشيفتات، الموافقة والتأكيد مع تحديد كاشير الشيفت الصارف باليوم والتاريخ
        </p>
      </div>

      {/* Tabs */}
      {isManager && (
        <div className="flex gap-2 p-1 glass-card-static rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('management')}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition whitespace-nowrap ${activeTab === 'management' ? 'bg-primary text-white shadow-lg' : 'text-text-muted hover:bg-white/5'}`}
          >
            👨‍💼 إدارة الموظفين والسلف
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition whitespace-nowrap ${activeTab === 'summary' ? 'bg-accent text-dark shadow-lg' : 'text-text-muted hover:bg-white/5'}`}
          >
            📊 الجرد الشامل للمرتبات
          </button>
        </div>
      )}

      {activeTab === 'management' ? (
        <>
          {/* Pending Advances Banner for Cashiers and Manager */}
          {isManagerOrCashier && (
        <div className="glass-card-static p-5 animate-fadeInUp"
          style={{ background: 'linear-gradient(135deg, rgba(255,179,71,0.15), rgba(108,99,255,0.1))', border: '1px solid rgba(255,179,71,0.4)' }}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⏳</span>
              <div>
                <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  طلبات السلف المعلقة في الشيفت والفرع ({pendingAdvances.length})
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  أي موظف بيطلب سلفة بتيجي لكاشير الشيفت المتاح حالياً في المحل للموافقة وصرف النقدية
                </p>
              </div>
            </div>
            {user?.branch_name && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(108,99,255,0.2)', color: 'var(--primary-light)' }}>
                📍 فرع: {user.branch_name}
              </span>
            )}
          </div>

          {pendingAdvances.length === 0 ? (
            <div className="p-4 rounded-xl text-center text-xs opacity-60" style={{ background: 'rgba(0,0,0,0.2)' }}>
              ✨ لا يوجد طلبات سلف معلقة تنتظر الموافقة والصرف حالياً
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto scroll-area">
              {pendingAdvances.map(adv => (
                <div key={adv.id} className="p-4 rounded-xl flex flex-col justify-between gap-3"
                  style={{ background: 'rgba(26,26,53,0.8)', border: '1px solid rgba(255,179,71,0.3)' }}>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        👤 {adv.user_name}
                      </span>
                      <span className="font-black text-lg" style={{ color: 'var(--warning)', fontFamily: 'Inter' }}>
                        {adv.amount} جنيه
                      </span>
                    </div>
                    <p className="text-xs text-muted mb-1">
                      📍 {adv.user_branch_name || 'بدون فرع'} • 📅 {adv.date} {adv.created_at ? `(${adv.created_at.split(' ')[1] || ''})` : ''}
                    </p>
                    {adv.reason && (
                      <p className="text-xs p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-secondary)' }}>
                        📝 {adv.reason}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--dark-border)' }}>
                    <button
                      onClick={() => handleUpdateAdvanceStatus(adv.id, 'approved')}
                      className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105"
                      style={{ background: 'rgba(0,212,170,0.2)', color: 'var(--accent)', border: '1px solid rgba(0,212,170,0.4)' }}
                    >
                      ✅ موافقة وصرف السلفة
                    </button>
                    <button
                      onClick={() => handleUpdateAdvanceStatus(adv.id, 'rejected')}
                      className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105"
                      style={{ background: 'rgba(255,71,87,0.2)', color: '#FF4757', border: '1px solid rgba(255,71,87,0.4)' }}
                    >
                      ❌ رفض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Month Picker */}
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fadeInUp delay-100">
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="input-dark w-auto"
            id="month-picker"
            style={{ maxWidth: '180px' }}
          />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>اختر الشهر لعرض البيانات</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {isManagerOrCashier ? (
            <>
              <button
                onClick={() => {
                  setTargetEmpId(selectedEmp?.id || '');
                  setAdvError(''); setAdvSuccess('');
                  setShowAdvModal(true);
                }}
                className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
                id="global-add-advance-btn"
              >
                <span>💸</span> صرف سلفة مباشرة
              </button>
              <button
                onClick={() => {
                  setTargetOrderEmpId(selectedEmp?.id || '');
                  setOrderError('');
                  setShowOrderModal(true);
                }}
                className="btn-secondary py-2 px-4 text-sm flex items-center gap-2"
                id="global-add-icecream-btn"
              >
                <span>🍦</span> تسجيل آيس كريم للموظف
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setAdvError(''); setAdvSuccess('');
                setShowAdvModal(true);
              }}
              className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
            >
              <span>💸</span> طلب سلفة من كاشير الشيفت
            </button>
          )}
        </div>
      </div>

      <div className={`grid gap-6 ${isManagerOrCashier ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {/* Employee List (Manager & Cashier) */}
        {isManagerOrCashier && (
          <div className="glass-card-static p-4 animate-fadeInUp delay-200">
            <h2 className="section-header">👥 الموظفون ({employees.length})</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto scroll-area">
              {employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => handleSelectEmp(emp)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-right transition-all duration-200 ${selectedEmp?.id === emp.id ? 'active' : ''}`}
                  style={selectedEmp?.id === emp.id
                    ? { background: 'rgba(108,99,255,0.2)', border: '1px solid rgba(108,99,255,0.4)' }
                    : { background: 'rgba(26,26,53,0.4)', border: '1px solid var(--dark-border)' }}
                  id={`emp-btn-${emp.id}`}
                >
                  <div className="avatar w-9 h-9 text-sm flex-shrink-0">{emp.full_name?.[0] || '?'}</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{emp.full_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {ROLE_AR[emp.role] || emp.role} {emp.branch_name ? `• ${emp.branch_name}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Salary Details */}
        <div className={`space-y-4 ${isManagerOrCashier ? 'lg:col-span-2' : ''}`}>
          {/* Salary Summary Card */}
          <div className="glass-card-static p-6 animate-fadeInUp delay-200"
            style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.15), rgba(0,212,170,0.08))', border: '1px solid rgba(108,99,255,0.3)' }}>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                💼 ملف {currentUser?.full_name || '—'}
              </h2>
              {isManagerOrCashier && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setTargetEmpId(selectedEmp?.id || '');
                      setAdvError(''); setAdvSuccess('');
                      setShowAdvModal(true);
                    }}
                    className="btn-primary py-1.5 px-3 text-xs"
                  >
                    + صرف سلفة
                  </button>
                  <button
                    onClick={() => {
                      setTargetOrderEmpId(selectedEmp?.id || '');
                      setOrderError('');
                      setShowOrderModal(true);
                    }}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    + آيس كريم
                  </button>
                  {isManager && (
                    <>
                      <button
                        onClick={() => {
                          setAdjustAdvError('');
                          setAdjustAdvAmount('');
                          setAdjustAdvReason('');
                          setShowAdjustAdvModal(true);
                        }}
                        className="py-1.5 px-3 text-xs font-bold rounded-xl text-white transition-all shadow-sm"
                        style={{ background: 'linear-gradient(135deg, #FF9F43, #EE5253)' }}
                        title="تعديل أو إسقاط سلفة"
                      >
                        ⚖️ تعديل/إسقاط سلفة
                      </button>
                      <button
                        onClick={() => {
                          setAdjustIceError('');
                          setAdjustIceAmount('');
                          setAdjustIceReason('');
                          setShowAdjustIceModal(true);
                        }}
                        className="py-1.5 px-3 text-xs font-bold rounded-xl text-white transition-all shadow-sm"
                        style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44569)' }}
                        title="تعديل أو إسقاط مسحوبات آيس كريم"
                      >
                        🍦 تعديل/إسقاط آيس كريم
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* 1. المرتب الأساسي */}
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.3)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>💼 1. المرتب الأساسي (الشهري المثبت)</p>
                <p className="font-black text-2xl" style={{ color: 'var(--primary-light)', fontFamily: 'Inter' }}>
                  {salBase.toLocaleString()} <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>جنيه/شهر</span>
                </p>
              </div>

              {/* 2. الفلوس اللي اشتغل بيها (مستحقات أيام الحضور) */}
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)' }}>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🏃 2. المستحق عن أيام العمل الفعلية</p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent/20 text-accent">
                    {daysWorked} يوم حضور ({daysAbsent} يوم غياب)
                  </span>
                </div>
                <p className="font-black text-2xl" style={{ color: 'var(--accent)', fontFamily: 'Inter' }}>
                  {salEarned.toLocaleString()} <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>جنيه</span>
                </p>
              </div>

              {/* 3. سلف الفلوس */}
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,179,71,0.1)', border: '1px solid rgba(255,179,71,0.3)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>💵 3. سلف الفلوس المسحوبة</p>
                <p className="font-black text-2xl" style={{ color: 'var(--warning)', fontFamily: 'Inter' }}>
                  {salAdvances.toLocaleString()} <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>جنيه</span>
                </p>
              </div>

              {/* 4. خصومات المنتجات والآيس كريم */}
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,107,157,0.1)', border: '1px solid rgba(255,107,157,0.3)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>🍦 4. خصم المنتجات والآيس كريم (25%)</p>
                <p className="font-black text-2xl" style={{ color: '#FF6B9D', fontFamily: 'Inter' }}>
                  {salIceCream.toLocaleString()} <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>جنيه</span>
                </p>
              </div>

              {/* 5. الرصيد النهائي المستحق أو المطلوب سداده */}
              <div className="sm:col-span-2 p-5 rounded-2xl border animate-scaleIn"
                style={{
                  background: isPositive ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
                  borderColor: isPositive ? 'rgba(0,212,170,0.4)' : 'rgba(255,71,87,0.4)'
                }}>
                <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
                  <span className="text-sm font-bold flex items-center gap-2" style={{ color: isPositive ? 'var(--accent)' : '#FF4757' }}>
                    <span>{isPositive ? '✅' : '⚠️'}</span>
                    {isPositive ? '5. الرصيد المستحق للموظف (له):' : '5. المطلوب سداده من الموظف (عليه):'}
                  </span>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full"
                    style={{
                      background: isPositive ? 'rgba(0,212,170,0.2)' : 'rgba(255,71,87,0.2)',
                      color: isPositive ? 'var(--accent)' : '#FF4757'
                    }}>
                    {isPositive ? 'رصيد دائن (له)' : 'رصيد مدين (عليه)'}
                  </span>
                </div>
                <p className="font-black text-3xl" style={{ color: isPositive ? 'var(--accent)' : '#FF4757', fontFamily: 'Inter' }}>
                  {Math.abs(salNet).toLocaleString()} <span className="text-base font-normal">جنيه</span>
                </p>
                <p className="text-xs mt-2 opacity-70">
                  معادلة الصافي = (مستحقات أيام العمل) - (سلف الفلوس) - (خصم منتجات وآيس كريم)
                </p>
              </div>
            </div>
          </div>

          {/* Advances & Deductions List */}
          <div className="glass-card-static p-6 animate-fadeInUp delay-300">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="section-header mb-0">📋 سجل الخصومات والسلف</h2>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${filterType === 'all' ? 'btn-primary text-white' : 'btn-secondary'}`}
                >
                  الكل ({advances.length})
                </button>
                <button
                  onClick={() => setFilterType('pending')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${filterType === 'pending' ? 'btn-primary text-white' : 'btn-secondary'}`}
                >
                  ⏳ معلقة ({advances.filter(a => a.status === 'pending').length})
                </button>
                <button
                  onClick={() => setFilterType('advance')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${filterType === 'advance' ? 'btn-primary text-white' : 'btn-secondary'}`}
                >
                  💵 سلف صُرفت
                </button>
                <button
                  onClick={() => setFilterType('ice_cream')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${filterType === 'ice_cream' ? 'btn-primary text-white' : 'btn-secondary'}`}
                >
                  🍦 خصم آيس كريم
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><div className="spinner" /></div>
            ) : filteredAdvances.length === 0 ? (
              <div className="text-center py-8 opacity-40">
                <p className="text-3xl mb-2">📄</p>
                <p style={{ color: 'var(--text-muted)' }} className="text-sm">لا يوجد خصومات أو سلف مطابقة هذا الشهر</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto scroll-area">
                {filteredAdvances.map((adv, i) => {
                  const isIceCream = adv.type === 'ice_cream' || adv.reason?.includes('آيس كريم');
                  const isPending = adv.status === 'pending';
                  const isRejected = adv.status === 'rejected';

                  const issuerLabel = adv.issuer_name
                    ? `صرفها وتأكد منها: ${adv.issuer_name} (${ROLE_AR[adv.issuer_role] || adv.issuer_role}${adv.issuer_branch_name ? ` - ${adv.issuer_branch_name}` : ''})`
                    : (isPending ? '⏳ بانتظار موافقة كاشير الشيفت المتاح في المحل أو المدير' : 'صرف مباشر');

                  return (
                    <div key={adv.id || i} className="p-4 rounded-xl animate-fadeInUp flex items-start justify-between gap-3"
                      style={{
                        background: isPending ? 'rgba(255,179,71,0.12)' : isRejected ? 'rgba(255,71,87,0.12)' : isIceCream ? 'rgba(255,107,157,0.08)' : 'rgba(0,212,170,0.08)',
                        border: `1px solid ${isPending ? 'rgba(255,179,71,0.4)' : isRejected ? 'rgba(255,71,87,0.4)' : isIceCream ? 'rgba(255,107,157,0.25)' : 'rgba(0,212,170,0.25)'}`
                      }}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">{isPending ? '⏳' : isRejected ? '❌' : isIceCream ? '🍦' : '💵'}</span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                              style={{
                                background: isPending ? 'rgba(255,179,71,0.25)' : isRejected ? 'rgba(255,71,87,0.25)' : isIceCream ? 'rgba(255,107,157,0.2)' : 'rgba(0,212,170,0.2)',
                                color: isPending ? '#FFB347' : isRejected ? '#FF4757' : isIceCream ? '#FF6B9D' : 'var(--accent)'
                              }}>
                              {isPending ? '⏳ طلب سلفة معلق' : isRejected ? '❌ طلب مرفوض' : isIceCream ? 'خصم آيس كريم' : 'سلفة مالية معتمدة'}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Inter' }}>
                              📅 {adv.date} {adv.created_at ? `(${adv.created_at.split(' ')[1] || ''})` : ''}
                            </span>
                          </div>

                          <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                            {adv.reason || adv.note || (isIceCream ? 'طلب آيس كريم' : 'سلفة')}
                          </p>

                          <p className="text-xs mt-1 font-medium"
                            style={{ color: adv.issuer_role === 'cashier' ? 'var(--primary-light)' : adv.issuer_role === 'manager' ? '#FF4757' : 'var(--text-muted)' }}>
                            💳 {issuerLabel}
                          </p>

                          {/* Quick action buttons for Cashier/Manager inside list if pending */}
                          {isPending && isManagerOrCashier && (
                            <div className="flex gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,179,71,0.2)' }}>
                              <button
                                onClick={() => handleUpdateAdvanceStatus(adv.id, 'approved')}
                                className="px-3 py-1 rounded-lg text-xs font-bold"
                                style={{ background: 'rgba(0,212,170,0.2)', color: 'var(--accent)', border: '1px solid rgba(0,212,170,0.4)' }}
                              >
                                ✅ موافقة وصرف
                              </button>
                              <button
                                onClick={() => handleUpdateAdvanceStatus(adv.id, 'rejected')}
                                className="px-3 py-1 rounded-lg text-xs font-bold"
                                style={{ background: 'rgba(255,71,87,0.2)', color: '#FF4757', border: '1px solid rgba(255,71,87,0.4)' }}
                              >
                                ❌ رفض
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-left flex-shrink-0">
                        <p className="font-black text-xl" style={{ color: isPending ? 'var(--warning)' : isRejected ? '#FF4757' : isIceCream ? '#FF6B9D' : 'var(--accent)', fontFamily: 'Inter' }}>
                          -{adv.amount?.toLocaleString()} جنيه
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ice Cream Order for Employees */}
          {!isManagerOrCashier && (
            <div className="glass-card-static p-6 animate-fadeInUp delay-400">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-header mb-0">🍦 طلب آيس كريم (خصم 25%)</h2>
                <button onClick={() => { setOrderError(''); setShowOrderModal(true); }} className="btn-secondary py-2 px-4 text-sm" id="order-btn">
                  اطلب الآن
                </button>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                بتاخد آيس كريم؟ هتتحسب تلقائي بخصم 25% وهتتخصم من مرتبك وتظهر مسؤول الصرف عند الكاشير والمدير.
              </p>
            </div>
          )}
        </div>
      </div>

        </>
      ) : (
        /* Summary Tab Content */
        <div className="glass-card-static p-6 space-y-4 animate-fadeInUp">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div>
              <h2 className="section-header mb-1">📊 الجرد الشامل للمرتبات والسلف ({month})</h2>
              <p className="text-sm text-text-muted">مراجعة رواتب الموظفين مع خصم أيام الغياب وإجمالي السلفيات ومسحوبات الآيس كريم.</p>
            </div>
            <button 
              onClick={exportToExcel}
              disabled={summaryLoading || salarySummary.length === 0}
              className="btn-accent px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
            >
              📥 تحميل كملف Excel (شيت)
            </button>
          </div>

          {summaryLoading ? (
            <div className="flex justify-center py-10"><div className="spinner" /></div>
          ) : salarySummary.length === 0 ? (
            <div className="text-center py-10 opacity-50">
              <p className="text-3xl mb-2">📄</p>
              <p className="text-sm">لا توجد بيانات متاحة لهذا الشهر</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm text-right whitespace-nowrap">
                <thead className="bg-dark/50 text-text-muted uppercase font-bold text-xs">
                  <tr>
                    <th className="p-4 border-b border-dark-border">الموظف</th>
                    <th className="p-4 border-b border-dark-border text-center">الوظيفة</th>
                    <th className="p-4 border-b border-dark-border text-center">الفرع</th>
                    <th className="p-4 border-b border-dark-border text-center">الراتب الأساسي</th>
                    <th className="p-4 border-b border-dark-border text-center">أيام العمل</th>
                    <th className="p-4 border-b border-dark-border text-center">الراتب المستحق</th>
                    <th className="p-4 border-b border-dark-border text-center text-error">إجمالي السلف</th>
                    <th className="p-4 border-b border-dark-border text-center text-error">آيس كريم</th>
                    <th className="p-4 border-b border-dark-border text-center text-warning">مديونية مرحلة</th>
                    <th className="p-4 border-b border-dark-border text-center text-accent">الصافي (نهائي)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {salarySummary.map((s, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">{s.user_name}</td>
                      <td className="p-4 text-center">{ROLE_AR[s.user_role] || s.user_role}</td>
                      <td className="p-4 text-center text-xs text-muted">{s.branch_name || '—'}</td>
                      <td className="p-4 text-center font-mono">{s.base_salary}</td>
                      <td className="p-4 text-center text-primary-light font-bold">{s.days_worked}</td>
                      <td className="p-4 text-center font-mono text-accent">{s.calculated_salary}</td>
                      <td className="p-4 text-center font-mono text-error">{s.total_advances}</td>
                      <td className="p-4 text-center font-mono text-error">{s.total_ice_cream}</td>
                      <td className="p-4 text-center font-mono text-warning font-bold">{s.carried_debt || 0}</td>
                      <td className="p-4 text-center font-mono text-accent font-bold bg-accent/5">{s.net_salary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Advance Modal */}
      {showAdvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card-static p-6 w-full max-w-sm animate-scaleIn">
            <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
              💸 {isManagerOrCashier ? 'صرف سلفة مباشرة للموظف' : 'طلب سلفة من كاشير الشيفت'}
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              {isManagerOrCashier
                ? 'سيتم خصم السلفة مباشرة من الموظف وتوثيق اسمك ككاشير/مدير صرّف المبلغ'
                : 'سيصل طلب السلفة لكاشير الشيفت المتواجد في المحل أو المدير للموافقة وتسليم المبلغ'}
            </p>

            {advSuccess && (
              <div className="mb-3 p-3 rounded-xl text-xs text-center font-bold"
                style={{ background: 'rgba(0,212,170,0.15)', color: 'var(--accent)', border: '1px solid rgba(0,212,170,0.3)' }}>
                ✅ {advSuccess}
              </div>
            )}
            {advError && (
              <div className="mb-3 p-3 rounded-xl text-xs text-center font-bold"
                style={{ background: 'rgba(255,71,87,0.15)', color: '#FF4757', border: '1px solid rgba(255,71,87,0.3)' }}>
                ⚠️ {advError}
              </div>
            )}

            <div className="space-y-3">
              {/* Employee selector for Cashiers/Managers */}
              {isManagerOrCashier && (
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>الموظف المستلم للسلفة *</label>
                  <select
                    value={targetEmpId}
                    onChange={e => setTargetEmpId(e.target.value)}
                    className="input-dark"
                    id="advance-target-emp"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({ROLE_AR[emp.role] || emp.role}) {emp.branch_name ? `- ${emp.branch_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>مبلغ السلفة المطلوب (جنيه) *</label>
                <input
                  id="advance-amount"
                  type="number"
                  value={advAmount}
                  onChange={e => setAdvAmount(e.target.value)}
                  placeholder="مثال: 150"
                  className="input-dark"
                  min="1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>ملاحظة / سبب السلفة</label>
                <input
                  id="advance-note"
                  type="text"
                  value={advNote}
                  onChange={e => setAdvNote(e.target.value)}
                  placeholder="مثال: سلفة طوارئ قبل الشيفت"
                  className="input-dark"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleAddAdvance} disabled={advLoading} className="btn-primary flex-1 text-center disabled:opacity-50" id="confirm-advance">
                  {advLoading ? 'جاري الصرف/الطلب...' : isManagerOrCashier ? 'تأكيد الصرف 💸' : 'إرسال الطلب لكاشير الشيفت 🚀'}
                </button>
                <button onClick={() => { setShowAdvModal(false); setAdvAmount(''); setAdvNote(''); setAdvError(''); setAdvSuccess(''); }} className="btn-secondary flex-1 text-center" id="cancel-advance">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ice Cream Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card-static p-6 w-full max-w-md animate-scaleIn">
            <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>🍦 طلب / تسجيل آيس كريم</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>خصم 25% تلقائي لكل أصناف المحل</p>

            {orderError && (
              <div className="mb-3 p-3 rounded-xl text-xs text-center"
                style={{ background: 'rgba(255,71,87,0.15)', color: '#FF4757', border: '1px solid rgba(255,71,87,0.3)' }}>
                ⚠️ {orderError}
              </div>
            )}

            <div className="space-y-3">
              {/* Employee selector for Cashiers/Managers */}
              {isManagerOrCashier && (
                <div className="mb-3">
                  <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>خصم الطلب على الموظف *</label>
                  <select
                    value={targetOrderEmpId}
                    onChange={e => setTargetOrderEmpId(e.target.value)}
                    className="input-dark"
                    id="order-target-emp"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({ROLE_AR[emp.role] || emp.role}) {emp.branch_name ? `- ${emp.branch_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto scroll-area">
                {ICE_CREAM_PRODUCTS.map(p => {
                  const qty = orderItems[p.name] || 0;
                  return (
                    <div key={p.name} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.15)' }}>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-xs" style={{ color: 'var(--text-muted)', textDecoration: 'line-through', fontFamily: 'Inter' }}>
                            {p.price} جنيه
                          </span>
                          <span className="text-xs font-bold" style={{ color: 'var(--accent)', fontFamily: 'Inter' }}>
                            {(p.price * (1 - DISCOUNT)).toFixed(0)} جنيه
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setOrderItems(o => ({ ...o, [p.name]: Math.max(0, (o[p.name] || 0) - 1) }))}
                          className="w-8 h-8 rounded-lg text-sm font-bold transition-colors"
                          style={{ background: 'rgba(255,71,87,0.15)', color: '#FF4757' }}>−</button>
                        <span className="w-6 text-center font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Inter' }}>{qty}</span>
                        <button onClick={() => setOrderItems(o => ({ ...o, [p.name]: (o[p.name] || 0) + 1 }))}
                          className="w-8 h-8 rounded-lg text-sm font-bold transition-colors"
                          style={{ background: 'rgba(0,212,170,0.15)', color: 'var(--accent)' }}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {orderTotal > 0 && (
                <div className="p-3 rounded-xl flex justify-between items-center"
                  style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)' }}>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>الإجمالي الخصم المستحق</span>
                  <span className="font-black text-xl" style={{ color: 'var(--accent)', fontFamily: 'Inter' }}>
                    {orderAfterDiscount.toFixed(0)} جنيه
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={handleIceCreamOrder} disabled={orderTotal === 0 || orderLoading} className="btn-success flex-1 text-center disabled:opacity-50" id="confirm-order">
                  {orderLoading ? 'جاري التسجيل...' : 'تأكيد وتسجيل الخصم 🍦'}
                </button>
                <button onClick={() => { setShowOrderModal(false); setOrderItems({}); setOrderError(''); }} className="btn-secondary flex-1 text-center" id="cancel-order">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Manager Adjust Advances Modal */}
      {showAdjustAdvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="glass-card-static p-6 w-full max-w-sm border border-warning/40 space-y-4 animate-scaleIn">
            <h3 className="font-bold text-lg text-white">⚖️ تعديل أو إسقاط سلفة</h3>
            <p className="text-xs text-text-muted">
              الموظف: <strong className="text-white">{selectedEmp?.full_name}</strong><br />
              💡 لإسقاط سلفة اكتب رقماً سالباً (مثال: <span className="font-mono text-accent">-200</span>). ولإضافة سلفة اكتب رقماً موجباً.
            </p>

            {adjustAdvError && (
              <div className="p-3 rounded-xl text-xs font-bold text-center bg-red-500/20 text-red-400 border border-red-500/30">
                ⚠️ {adjustAdvError}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold mb-1 block text-text-secondary">المبلغ (جنيه)</label>
              <input
                type="number"
                value={adjustAdvAmount}
                onChange={e => setAdjustAdvAmount(e.target.value)}
                placeholder="مثال: -250"
                className="input-dark w-full"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-text-secondary">السبب أو الملاحظة</label>
              <input
                type="text"
                value={adjustAdvReason}
                onChange={e => setAdjustAdvReason(e.target.value)}
                placeholder="إسقاط سلفة كحافز / تسوية..."
                className="input-dark w-full"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAdjustAdvance}
                disabled={adjustAdvLoading || !adjustAdvAmount}
                className="btn-primary flex-1 py-2.5 text-xs font-bold"
              >
                {adjustAdvLoading ? 'جاري الحفظ...' : 'تأكيد التعديل'}
              </button>
              <button
                onClick={() => setShowAdjustAdvModal(false)}
                className="btn-secondary px-4 py-2.5 text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Adjust Ice Cream Modal */}
      {showAdjustIceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="glass-card-static p-6 w-full max-w-sm border border-pink-500/40 space-y-4 animate-scaleIn">
            <h3 className="font-bold text-lg text-white">🍦 تعديل أو إسقاط مسحوبات آيس كريم</h3>
            <p className="text-xs text-text-muted">
              الموظف: <strong className="text-white">{selectedEmp?.full_name}</strong><br />
              💡 لإسقاط مسحوبات آيس كريم اكتب رقماً سالباً (مثال: <span className="font-mono text-accent">-150</span>).
            </p>

            {adjustIceError && (
              <div className="p-3 rounded-xl text-xs font-bold text-center bg-red-500/20 text-red-400 border border-red-500/30">
                ⚠️ {adjustIceError}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold mb-1 block text-text-secondary">المبلغ (جنيه)</label>
              <input
                type="number"
                value={adjustIceAmount}
                onChange={e => setAdjustIceAmount(e.target.value)}
                placeholder="مثال: -100"
                className="input-dark w-full"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-text-secondary">السبب أو الملاحظة</label>
              <input
                type="text"
                value={adjustIceReason}
                onChange={e => setAdjustIceReason(e.target.value)}
                placeholder="إسقاط خصم آيس كريم..."
                className="input-dark w-full"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAdjustIceCream}
                disabled={adjustIceLoading || !adjustIceAmount}
                className="btn-primary flex-1 py-2.5 text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44569)' }}
              >
                {adjustIceLoading ? 'جاري الحفظ...' : 'تأكيد التعديل'}
              </button>
              <button
                onClick={() => setShowAdjustIceModal(false)}
                className="btn-secondary px-4 py-2.5 text-xs font-bold"
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

export default SalaryPage;