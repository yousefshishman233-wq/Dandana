import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI, hrAPI } from '../services/api';

const BRANCHES = [
  { id: null, name: 'بدون فرع' },
];

const ROLE_LABELS = {
  employee: 'موظف عام',
  cashier: 'كاشير',
  manager: 'مدير',
  chef: 'شيفات',
  driver: 'سائق',
  accountant: 'محاسب',
  prep: 'تحضير',
  fridge: 'ثلاجة',
  hall: 'صالة',
  delivery: 'دليفري',
};

const ROLE_COLORS = {
  employee: 'var(--accent)',
  cashier: 'var(--primary-light)',
  manager: '#FF4757',
  chef: '#FF9F43',
  driver: '#54a0ff',
  accountant: '#10ac84',
  prep: '#ee5253',
  fridge: '#00d2d3',
  hall: '#576574',
  delivery: '#ff9ff3',
};

const emptyForm = { full_name: '', username: '', password: '', role: 'employee', salary: '', branch_id: '' };

const EmployeesPage = () => {
  const { user } = useAuth();
  const [employees, setEmployees]     = useState([]);
  const [branches,  setBranches]      = useState([]);
  const [loading,   setLoading]       = useState(true);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterRole,   setFilterRole]   = useState('');
  const [searchText,   setSearchText]   = useState('');

  // Modal state
  const [showModal,  setShowModal]    = useState(false);
  const [editMode,   setEditMode]     = useState(false);
  const [editId,     setEditId]       = useState(null);
  const [form,       setForm]         = useState(emptyForm);
  const [formError,  setFormError]    = useState('');
  const [formOk,     setFormOk]       = useState('');
  const [saving,     setSaving]       = useState(false);

  // Delete confirm
  const [deleteId,   setDeleteId]     = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, brRes] = await Promise.all([
        authAPI.getAllUsers(),
        authAPI.getBranches(),
      ]);
      if (empRes.data.success) setEmployees(empRes.data.users || []);
      if (brRes.data.success)  setBranches(brRes.data.branches || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditMode(false);
    setEditId(null);
    setFormError('');
    setFormOk('');
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setForm({
      full_name: emp.full_name || '',
      username:  emp.username  || '',
      password:  '',
      role:      emp.role      || 'employee',
      salary:    emp.salary    || '',
      branch_id: emp.branch_id || '',
    });
    setEditMode(true);
    setEditId(emp.id);
    setFormError('');
    setFormOk('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.full_name.trim()) { setFormError('الاسم بالكامل مطلوب'); return; }
    if (form.salary && isNaN(form.salary)) { setFormError('المرتب يجب أن يكون رقم صالح'); return; }

    const generatedUsername = form.username.trim() || form.full_name.trim().replace(/\s+/g, '_');
    const finalPassword = form.password ? form.password.trim() : (editMode ? undefined : '123456');

    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        username:  generatedUsername,
        role:      form.role || 'employee',
        salary:    Number(form.salary) || 0,
        branch_id: form.branch_id ? Number(form.branch_id) : null,
        ...(finalPassword ? { password: finalPassword } : {}),
      };

      let res;
      if (editMode) {
        res = await hrAPI.updateUser(editId, payload);
      } else {
        res = await hrAPI.createUser(payload);
      }

      if (res.data.success) {
        setFormOk(editMode ? '✅ تم تعديل بيانات الموظف بنجاح' : '✅ تم إضافة الموظف بنجاح');
        await fetchData();
        setTimeout(() => { setShowModal(false); setFormOk(''); }, 1500);
      } else {
        setFormError(res.data.message || 'حدث خطأ في إضافة الموظف');
      }
    } catch (e) {
      setFormError(e.response?.data?.message || 'حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      const res = await hrAPI.deleteUser(id);
      if (res.data.success) {
        setDeleteId(null);
        await fetchData();
      }
    } catch (e) { console.error(e); }
  };

  const filtered = employees.filter(e => {
    if (e.username === 'admin') return false; // only hide root admin
    const matchSearch = !searchText || e.full_name?.includes(searchText) || e.username?.includes(searchText);
    const matchBranch = !filterBranch || String(e.branch_id) === String(filterBranch);
    const matchRole   = !filterRole   || e.role === filterRole;
    return matchSearch && matchBranch && matchRole;
  });

  // Stats
  const total     = employees.filter(e => e.username !== 'admin').length;
  const perBranch = branches.map(b => ({
    ...b,
    count: employees.filter(e => String(e.branch_id) === String(b.id)).length,
  }));

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fadeInUp">
        <div>
          <h1 className="page-title">👥 إدارة الموظفين</h1>
          <p style={{ color:'var(--text-muted)' }} className="text-sm">إضافة وتعديل وحذف الموظفين وتحديد فروعهم</p>
        </div>
        <button onClick={openAdd} className="btn-primary px-6" id="add-employee-btn">
          + إضافة موظف جديد
        </button>
      </div>

      {/* Branch stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 animate-fadeInUp delay-100">
        {perBranch.map((b, i) => (
          <button key={b.id}
            onClick={() => setFilterBranch(filterBranch === String(b.id) ? '' : String(b.id))}
            className="glass-card p-4 text-center transition-all hover:scale-105"
            style={filterBranch === String(b.id)
              ? { border:'2px solid var(--primary-light)', background:'rgba(108,99,255,0.2)' }
              : {}}
            id={`branch-filter-${b.id}`}
          >
            <p className="text-2xl font-black" style={{ color:'var(--primary-light)', fontFamily:'Inter' }}>{b.count}</p>
            <p className="text-xs mt-1 leading-tight" style={{ color:'var(--text-muted)' }}>{b.name}</p>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="glass-card-static p-4 flex flex-wrap gap-3 items-center animate-fadeInUp delay-200">
        <input
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="ابحث بالاسم أو اليوزر..."
          className="input-dark flex-1"
          id="emp-search"
          style={{ minWidth:'160px' }}
        />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="input-dark w-auto" id="emp-role-filter" style={{ maxWidth:'140px' }}>
          <option value="">كل الأدوار</option>
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
        <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}
          className="input-dark w-auto" id="emp-branch-filter" style={{ maxWidth:'180px' }}>
          <option value="">كل الفروع</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <span className="text-sm" style={{ color:'var(--text-muted)' }}>
          {filtered.length} من {total} موظف
        </span>
      </div>

      {/* Employees table */}
      <div className="glass-card-static p-6 animate-fadeInUp delay-300">
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 opacity-40">
            <p className="text-4xl mb-3">👤</p>
            <p style={{ color:'var(--text-muted)' }}>لا يوجد موظفين</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dark-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الاسم</th>
                  <th>اليوزر</th>
                  <th>الدور</th>
                  <th>الفرع</th>
                  <th>المرتب</th>
                  <th>صلاحية الإجازات</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, i) => (
                  <tr key={emp.id}>
                    <td style={{ color:'var(--text-muted)', fontFamily:'Inter' }}>{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="avatar w-9 h-9 text-sm flex-shrink-0"
                          style={{ background:`linear-gradient(135deg, ${ROLE_COLORS[emp.role]}, ${ROLE_COLORS[emp.role]}80)` }}>
                          {emp.full_name?.[0] || '?'}
                        </div>
                        <span className="font-semibold" style={{ color:'var(--text-primary)' }}>{emp.full_name}</span>
                      </div>
                    </td>
                    <td style={{ color:'var(--text-muted)', fontFamily:'Inter' }}>{emp.username}</td>
                    <td>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ background:`${ROLE_COLORS[emp.role]}15`, color:ROLE_COLORS[emp.role] }}>
                        {ROLE_LABELS[emp.role] || emp.role}
                      </span>
                    </td>
                    <td>
                      {emp.branch_name ? (
                        <span className="px-3 py-1 rounded-full text-xs"
                          style={{ background:'rgba(108,99,255,0.15)', color:'var(--primary-light)' }}>
                          📍 {emp.branch_name}
                        </span>
                      ) : (
                        <span style={{ color:'var(--text-muted)' }} className="text-xs">—</span>
                      )}
                    </td>
                    <td>
                      <span className="font-bold" style={{ color:'var(--accent)', fontFamily:'Inter' }}>
                        {emp.salary?.toLocaleString()} جنيه
                      </span>
                    </td>
                    <td>
                      {emp.role !== 'manager' ? (
                        <button
                          onClick={async () => {
                            try {
                              const nextVal = emp.can_manage_leaves ? 0 : 1;
                              const res = await authAPI.toggleDelegatedLeave(emp.id, nextVal);
                              if (res.data.success) {
                                setEmployees(prev => prev.map(u => u.id === emp.id ? { ...u, can_manage_leaves: nextVal } : u));
                              }
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${emp.can_manage_leaves ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-gray-700/40 text-gray-400 border border-gray-600/30 hover:text-white'}`}
                          title="تفويض أو إلغاء صلاحية قبول/رفض إجازات الموظفين"
                        >
                          {emp.can_manage_leaves ? '🛡️ مفوض بإدارة الإجازات' : '➖ غير مفوض'}
                        </button>
                      ) : (
                        <span className="text-xs text-primary-light font-bold">👑 مدير النظام</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(emp)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                          style={{ background:'rgba(108,99,255,0.15)', color:'var(--primary-light)', border:'1px solid rgba(108,99,255,0.3)' }}
                          id={`edit-emp-${emp.id}`}>✏️ تعديل</button>
                        <button onClick={() => setDeleteId(emp.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                          style={{ background:'rgba(255,71,87,0.15)', color:'#FF4757', border:'1px solid rgba(255,71,87,0.3)' }}
                          id={`delete-emp-${emp.id}`}>🗑️ حذف</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(0,0,0,0.78)', backdropFilter:'blur(10px)' }}>
          <div className="glass-card-static p-6 w-full max-w-md animate-scaleIn max-h-screen overflow-y-auto scroll-area">
            <h3 className="font-bold text-xl mb-5" style={{ color:'var(--text-primary)' }}>
              {editMode ? '✏️ تعديل بيانات الموظف' : '➕ إضافة موظف جديد'}
            </h3>

            {formOk && (
              <div className="mb-4 p-3 rounded-xl text-sm text-center"
                style={{ background:'rgba(0,212,170,0.15)', color:'var(--accent)', border:'1px solid rgba(0,212,170,0.3)' }}>
                {formOk}
              </div>
            )}
            {formError && (
              <div className="mb-4 p-3 rounded-xl text-sm text-center"
                style={{ background:'rgba(255,71,87,0.15)', color:'#FF4757', border:'1px solid rgba(255,71,87,0.3)' }}>
                ⚠️ {formError}
              </div>
            )}

            <div className="space-y-4">
              {/* Full name */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color:'var(--text-secondary)' }}>اسم الموظف الكامل *</label>
                <input id="form-fullname" type="text" value={form.full_name}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(f => ({
                      ...f,
                      full_name: val,
                      username: !editMode && (!f.username || f.username === f.full_name.trim().replace(/\s+/g, '_')) ? val.trim().replace(/\s+/g, '_') : f.username
                    }));
                  }}
                  placeholder="مثال: أحمد محمد علي" className="input-dark" />
              </div>

              {/* Username */}
              <div>
                <label className="text-xs font-semibold mb-1 block flex justify-between" style={{ color:'var(--text-secondary)' }}>
                  <span>اسم المستخدم (اليوزر)</span>
                  <span className="text-muted text-[11px]">اختياري (يتم إنشاؤه تلقائياً)</span>
                </label>
                <input id="form-username" type="text" value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="يتم ملؤه آلياً إذا تركته فارغاً" className="input-dark" />
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-semibold mb-1 block flex justify-between" style={{ color:'var(--text-secondary)' }}>
                  <span>كلمة المرور (الباسورد)</span>
                  <span className="text-muted text-[11px]">{editMode ? 'اتركه فاضي لعدم التغيير' : 'الافتراضي: 123456'}</span>
                </label>
                <input id="form-password" type="password" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={editMode ? 'باسورد جديد (اختياري)' : '123456 (أو اكتب باسورد مخصص)'}
                  className="input-dark" style={{ direction:'ltr' }} />
              </div>

              {/* Role + Salary */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color:'var(--text-secondary)' }}>الدور *</label>
                  <select id="form-role" value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="input-dark">
                    <option value="chef">🍳 شيفات</option>
                    <option value="driver">🚗 سائق</option>
                    <option value="accountant">📊 محاسب</option>
                    <option value="prep">🔪 تحضير</option>
                    <option value="fridge">❄️ ثلاجة</option>
                    <option value="hall">🍽️ صالة</option>
                    <option value="delivery">🛵 دليفري</option>
                    <option value="cashier">🖐️ كاشير</option>
                    <option value="employee">👷 موظف عام</option>
                    <option value="manager">👑 مدير</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color:'var(--text-secondary)' }}>المرتب (جنيه)</label>
                  <input id="form-salary" type="number" value={form.salary}
                    onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                    placeholder="3000" className="input-dark" min="0" />
                </div>
              </div>

              {/* Branch */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color:'var(--text-secondary)' }}>الفرع</label>
                <select id="form-branch" value={form.branch_id}
                  onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
                  className="input-dark">
                  <option value="">— اختار الفرع —</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="btn-primary flex-1 text-center disabled:opacity-50"
                  id="save-employee-btn">
                  {saving ? '⏳ جاري الحفظ...' : editMode ? '💾 حفظ التعديلات' : '➕ إضافة الموظف'}
                </button>
                <button onClick={() => { setShowModal(false); setFormError(''); setFormOk(''); }}
                  className="btn-secondary flex-1 text-center" id="cancel-employee-btn">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(0,0,0,0.78)', backdropFilter:'blur(10px)' }}>
          <div className="glass-card-static p-6 w-full max-w-sm animate-scaleIn text-center">
            <p className="text-5xl mb-4">🗑️</p>
            <h3 className="font-bold text-lg mb-2" style={{ color:'var(--text-primary)' }}>حذف الموظف؟</h3>
            <p className="text-sm mb-6" style={{ color:'var(--text-muted)' }}>
              الإجراء ده مش هيتراجع — كل بيانات الموظف هتتمسح.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 py-3 rounded-xl font-bold transition-all hover:scale-105"
                style={{ background:'rgba(255,71,87,0.2)', color:'#FF4757', border:'1px solid rgba(255,71,87,0.4)' }}
                id="confirm-delete-btn">نعم، احذف</button>
              <button onClick={() => setDeleteId(null)}
                className="btn-secondary flex-1" id="cancel-delete-btn">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesPage;
