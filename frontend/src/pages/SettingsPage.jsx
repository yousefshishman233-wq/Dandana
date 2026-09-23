import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const SettingsPage = () => {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError('يرجى ملء جميع الحقول');
      return;
    }
    if (newPassword.trim().length < 4) {
      setError('كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل');
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setError('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.changePassword(oldPassword.trim(), newPassword.trim());
      if (res.data.success) {
        setSuccess('✅ تم تغيير كلمة المرور بنجاح!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(res.data.message || 'فشل تغيير كلمة المرور');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ، يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="mb-6 animate-fadeInUp">
        <h1 className="page-title">⚙️ الإعدادات</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>إدارة إعدادات الحساب</p>
      </div>

      {/* Profile Info */}
      <div className="glass-card p-6 mb-5 animate-fadeInUp">
        <div className="flex items-center gap-4">
          <div className="avatar w-14 h-14 text-2xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6C63FF, #FF6B9D)' }}>
            {user?.full_name?.[0] || '?'}
          </div>
          <div>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{user?.full_name}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              👑 مدير النظام • @{user?.username}
            </p>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="glass-card p-6 animate-fadeInUp delay-100">
        <h3 className="font-bold text-base mb-5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          🔐 تغيير كلمة المرور
        </h3>

        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm flex items-center gap-2 animate-scaleIn"
            style={{ background: 'rgba(255,71,87,0.15)', border: '1px solid rgba(255,71,87,0.3)', color: '#FF6B9D' }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-xl text-sm flex items-center gap-2 animate-scaleIn"
            style={{ background: 'rgba(0,212,170,0.15)', border: '1px solid rgba(0,212,170,0.3)', color: 'var(--accent)' }}>
            {success}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          {/* Old Password */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              كلمة المرور الحالية
            </label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="input-dark pr-10 pl-10 w-full"
                placeholder="أدخل كلمة المرور الحالية"
                required
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                {showOld ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              كلمة المرور الجديدة
            </label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">🔑</span>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-dark pr-10 pl-10 w-full"
                placeholder="أدخل كلمة المرور الجديدة"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                {showNew ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              تأكيد كلمة المرور الجديدة
            </label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">✅</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-dark pr-10 w-full"
                placeholder="أعد كتابة كلمة المرور الجديدة"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-center mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner w-4 h-4 border-2"></span>
                جاري الحفظ...
              </span>
            ) : (
              '💾 حفظ كلمة المرور الجديدة'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
