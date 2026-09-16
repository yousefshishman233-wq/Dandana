import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  {
    id: 'employee',
    label: 'موظف',
    icon: '👷',
    desc: 'تلاجة أو صالة',
    color: 'from-emerald-500 to-teal-600',
    glow: 'rgba(0, 212, 170, 0.3)',
    border: 'border-emerald-500/30 hover:border-emerald-400/60',
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
    text: 'text-emerald-400',
  },
  {
    id: 'cashier',
    label: 'كاشير',
    icon: '🖐️',
    desc: 'تسجيل الدخول',
    color: 'from-violet-500 to-purple-600',
    glow: 'rgba(108, 99, 255, 0.3)',
    border: 'border-violet-500/30 hover:border-violet-400/60',
    bg: 'bg-violet-500/10 hover:bg-violet-500/20',
    text: 'text-violet-400',
  },
  {
    id: 'manager',
    label: 'مدير',
    icon: '👑',
    desc: 'صلاحيات كاملة',
    color: 'from-rose-500 to-pink-600',
    glow: 'rgba(255, 71, 87, 0.3)',
    border: 'border-rose-500/30 hover:border-rose-400/60',
    bg: 'bg-rose-500/10 hover:bg-rose-500/20',
    text: 'text-rose-400',
  },
];

const FloatingIceCream = ({ style, emoji, delay }) => (
  <div
    className="absolute text-4xl select-none pointer-events-none opacity-20"
    style={{ ...style, animation: `float ${6 + delay}s ease-in-out ${delay}s infinite` }}
  >
    {emoji}
  </div>
);

const LoginPage = () => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(username, password);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'اسم المستخدم أو كلمة المرور غلط');
    }
    setLoading(false);
  };

  const role = ROLES.find(r => r.id === selectedRole);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-animated">
      {/* Floating ice cream background */}
      <FloatingIceCream style={{ top: '8%', right: '10%' }} emoji="🍦" delay={0} />
      <FloatingIceCream style={{ top: '15%', left: '8%' }} emoji="🍧" delay={1.5} />
      <FloatingIceCream style={{ bottom: '20%', right: '5%' }} emoji="🍨" delay={3} />
      <FloatingIceCream style={{ bottom: '10%', left: '12%' }} emoji="🧁" delay={0.8} />
      <FloatingIceCream style={{ top: '50%', right: '3%' }} emoji="🍫" delay={2} />
      <FloatingIceCream style={{ top: '40%', left: '3%' }} emoji="🍓" delay={4} />

      {/* Glow orbs */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #6C63FF, transparent)' }} />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #FF6B9D, transparent)' }} />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Header */}
        <div className="text-center mb-8 animate-fadeInUp">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-4 relative"
            style={{ background: 'linear-gradient(135deg, #6C63FF, #FF6B9D)', boxShadow: '0 0 40px rgba(108,99,255,0.5)' }}>
            <span className="text-4xl">🍦</span>
            <div className="absolute inset-0 rounded-3xl animate-ping opacity-20"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #FF6B9D)' }} />
          </div>
          <h1 className="text-4xl font-black text-gradient-primary mb-1">دندنه</h1>
          <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
            نظام إدارة الموظفين والمواعيد
          </p>
        </div>

        {!selectedRole ? (
          /* Role Selection */
          <div className="glass-card p-8 animate-fadeInUp delay-200">
            <h2 className="text-center text-lg font-bold mb-6" style={{ color: 'var(--text-secondary)' }}>
              اختار دورك
            </h2>
            <div className="space-y-3">
              {ROLES.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => handleRoleSelect(r.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 text-right group animate-fadeInUp delay-${(i + 2) * 100}`}
                  style={{ animationDelay: `${(i + 2) * 0.1}s` }}
                  id={`role-btn-${r.id}`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-300 ${r.bg} ${r.border} border`}
                    style={{ boxShadow: `0 0 0 0 ${r.glow}` }}>
                    {r.icon}
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold text-lg ${r.text}`}>{r.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.desc}</p>
                  </div>
                  <span style={{ color: 'var(--text-muted)' }} className="group-hover:translate-x-1 transition-transform text-xl">←</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Login Form */
          <div className="glass-card p-8 animate-scaleIn">
            <button
              onClick={() => { setSelectedRole(null); setError(''); }}
              className="flex items-center gap-2 mb-6 text-sm transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span>→</span>
              <span>رجوع</span>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-gradient-to-br ${role.color}`}>
                {role.icon}
              </div>
              <div>
                <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                  تسجيل دخول {role.label}
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>أدخل بياناتك للدخول</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm flex items-center gap-2 animate-scaleIn"
                style={{ background: 'rgba(255,71,87,0.15)', border: '1px solid rgba(255,71,87,0.3)', color: '#FF6B9D' }}>
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  اسم المستخدم
                </label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">👤</span>
                  <input
                    id="username-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-dark pr-10"
                    placeholder="أدخل اسم المستخدم"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  كلمة المرور
                </label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
                  <input
                    id="password-input"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-dark pr-10 pl-10"
                    placeholder="أدخل كلمة المرور"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading}
                className="btn-primary w-full text-center mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="spinner w-5 h-5 border-2"></span>
                    جاري التحقق...
                  </span>
                ) : (
                  'تسجيل الدخول 🚀'
                )}
              </button>
            </form>

            <div className="mt-4 p-3 rounded-xl text-xs text-center space-y-1"
              style={{ background: 'rgba(108,99,255,0.08)', color: 'var(--text-muted)' }}>
              <p>💡 <strong className="text-white">كلمة المرور لجميع الحسابات:</strong> <span className="font-mono text-accent font-bold">1234</span></p>
              <p>حسابات الكاشير: <span className="text-primary-light font-mono">cashier_1</span> أو <span className="text-primary-light font-mono">محمد جمال</span></p>
              <p>حساب المدير: <span className="text-primary-light font-mono">admin</span></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;