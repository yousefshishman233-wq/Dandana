import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FloatingIceCream = ({ style, emoji, delay }) => (
  <div
    className="absolute text-4xl select-none pointer-events-none opacity-20"
    style={{ ...style, animation: `float ${6 + delay}s ease-in-out ${delay}s infinite` }}
  >
    {emoji}
  </div>
);

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setError('');
    setLoading(true);
    const result = await login(username.trim(), password.trim());
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-animated" dir="rtl">
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
        <div className="text-center mb-6 animate-fadeInUp">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-3 relative"
            style={{ background: 'linear-gradient(135deg, #6C63FF, #FF6B9D)', boxShadow: '0 0 35px rgba(108,99,255,0.4)' }}>
            <span className="text-3xl">🍦</span>
            <div className="absolute inset-0 rounded-3xl animate-ping opacity-20"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #FF6B9D)' }} />
          </div>
          <h1 className="text-3xl font-black text-gradient-primary mb-1">دندنه</h1>
          <p style={{ color: 'var(--text-secondary)' }} className="text-xs">
            تسجيل الدخول إلى النظام
          </p>
        </div>

        {/* Login Form Card */}
        <div className="glass-card p-8 animate-scaleIn">
          <h2 className="text-lg font-bold mb-5 text-center" style={{ color: 'var(--text-primary)' }}>
            تسجيل الدخول
          </h2>

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
                  aria-label="Toggle password visibility"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-center mt-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner w-4 h-4 border-2"></span>
                  جاري تسجيل الدخول...
                </span>
              ) : (
                'تسجيل الدخول 🚀'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
