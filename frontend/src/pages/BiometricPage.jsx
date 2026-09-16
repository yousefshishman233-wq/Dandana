import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PRODUCTS_PRICES = {
  'بوله واحدة': 20,
  'بوله اتنين': 35,
  'بوله تلاتة': 60,
  'بوله أربعة': 75,
  'نص كيلو': 110,
  'بسكوته فاضية': 3,
};

const PIN_LENGTH = 6;

const BiometricPage = () => {
  const [mode, setMode] = useState('fingerprint'); // 'fingerprint' | 'pin'
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState(0); // 0=idle 1=scanning 2=success 3=fail
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' | 'error' | 'info'
  const [recentActivity, setRecentActivity] = useState([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Simulate fingerprint scanning animation
  const handleFingerprintPress = useCallback(() => {
    if (scanning) return;
    setScanning(true);
    setScanPhase(1);
    setMessage('جاري التحقق من البصمة...');
    setMessageType('info');

    // Simulate biometric reading
    setTimeout(() => {
      setScanPhase(2);
      setMessage('تم التعرف! جاري تسجيل الحضور...');
      setMessageType('success');
      
      setTimeout(() => {
        setRecentActivity(prev => [{
          name: 'موظف تجريبي',
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          type: 'حضور',
          icon: '✅'
        }, ...prev.slice(0, 4)]);
        setScanPhase(0);
        setScanning(false);
        setMessage('');
      }, 2000);
    }, 2500);
  }, [scanning]);

  const handlePinKey = (key) => {
    if (pin.length < PIN_LENGTH) setPin(p => p + key);
  };

  const handlePinBackspace = () => setPin(p => p.slice(0, -1));

  const handlePinSubmit = async () => {
    if (!username.trim()) {
      setMessage('أدخل اسم المستخدم');
      setMessageType('error');
      return;
    }
    if (pin.length < 4) {
      setMessage('الكود لازم يكون 4 أرقام على الأقل');
      setMessageType('error');
      return;
    }
    setScanning(true);
    const result = await login(username, pin);
    if (result.success) {
      setMessage('تم تسجيل الدخول بنجاح ✅');
      setMessageType('success');
      setTimeout(() => navigate('/'), 1000);
    } else {
      setMessage(result.message || 'كلمة المرور غلط');
      setMessageType('error');
      setPin('');
      setScanning(false);
    }
  };

  const numKeys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="min-h-screen flex bg-animated" dir="rtl">
      {/* Left panel – Recent activity */}
      <div className="hidden lg:flex flex-col w-72 p-6 border-l"
        style={{ background: 'rgba(13,13,26,0.7)', borderColor: 'var(--dark-border)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: 'linear-gradient(135deg, #6C63FF, #FF6B9D)' }}>🍦</div>
          <div>
            <h1 className="font-black text-xl text-gradient-primary">دندنه</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>كاشير - البصمة</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
            📋 آخر التحركات
          </p>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
              لا يوجد نشاط بعد
            </p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-fadeInUp"
                  style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.15)' }}>
                  <span className="text-xl">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.type} • {a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto">
          <div className="p-4 rounded-2xl"
            style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--accent)' }}>⏰ الوقت الحالي</p>
            <p className="text-2xl font-black" style={{ color: 'var(--text-primary)', fontFamily: 'Inter' }}>
              {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-8 p-1 rounded-2xl" style={{ background: 'rgba(26,26,53,0.8)', border: '1px solid var(--dark-border)' }}>
          <button
            onClick={() => { setMode('fingerprint'); setMessage(''); setPin(''); }}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${mode === 'fingerprint' ? 'btn-primary text-white' : ''}`}
            style={mode !== 'fingerprint' ? { color: 'var(--text-secondary)' } : {}}
            id="mode-fingerprint"
          >
            🖐️ بصمة
          </button>
          <button
            onClick={() => { setMode('pin'); setMessage(''); setScanPhase(0); setScanning(false); }}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${mode === 'pin' ? 'btn-primary text-white' : ''}`}
            style={mode !== 'pin' ? { color: 'var(--text-secondary)' } : {}}
            id="mode-pin"
          >
            🔢 كود
          </button>
        </div>

        {mode === 'fingerprint' ? (
          /* Fingerprint UI */
          <div className="text-center animate-fadeInUp">
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              سجّل حضورك بالبصمة
            </h2>
            <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>
              اضغط على أيقونة البصمة لتسجيل الحضور أو الانصراف
            </p>

            {/* Fingerprint Button */}
            <div className="relative inline-flex items-center justify-center mb-8" onClick={handleFingerprintPress}>
              {/* Pulse rings */}
              {scanPhase === 1 && (
                <>
                  <div className="absolute inset-0 rounded-full animate-ping opacity-30"
                    style={{ background: 'rgba(108,99,255,0.5)', animationDuration: '1s' }} />
                  <div className="absolute inset-0 rounded-full animate-ping opacity-20"
                    style={{ background: 'rgba(108,99,255,0.3)', animationDuration: '1.5s', animationDelay: '0.3s' }} />
                </>
              )}
              {scanPhase === 2 && (
                <div className="absolute inset-0 rounded-full animate-ping opacity-40"
                  style={{ background: 'rgba(0,212,170,0.5)', animationDuration: '0.8s' }} />
              )}

              <button
                id="fingerprint-btn"
                className={`w-44 h-44 rounded-full flex flex-col items-center justify-center gap-3 transition-all duration-300 cursor-pointer select-none
                  ${scanPhase === 0 ? 'hover:scale-110' : ''}
                  ${scanPhase === 2 ? 'scale-110' : ''}
                `}
                style={{
                  background: scanPhase === 2
                    ? 'linear-gradient(135deg, #00D4AA, #00b894)'
                    : scanPhase === 3
                    ? 'linear-gradient(135deg, #FF4757, #FF6B9D)'
                    : 'linear-gradient(135deg, #6C63FF, #FF6B9D)',
                  boxShadow: scanPhase === 2
                    ? '0 0 60px rgba(0,212,170,0.5), 0 0 120px rgba(0,212,170,0.2)'
                    : '0 0 60px rgba(108,99,255,0.4), 0 0 120px rgba(108,99,255,0.2)',
                }}
              >
                <span className="text-5xl select-none">
                  {scanPhase === 1 ? '⚡' : scanPhase === 2 ? '✅' : scanPhase === 3 ? '❌' : '🖐️'}
                </span>
                <span className="text-white text-xs font-semibold">
                  {scanPhase === 0 ? 'اضغط هنا' : scanPhase === 1 ? 'جاري المسح...' : scanPhase === 2 ? 'تم!' : 'حاول مجدداً'}
                </span>
              </button>
            </div>

            {message && (
              <div className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium animate-scaleIn`}
                style={{
                  background: messageType === 'success' ? 'rgba(0,212,170,0.15)' : messageType === 'error' ? 'rgba(255,71,87,0.15)' : 'rgba(108,99,255,0.15)',
                  border: `1px solid ${messageType === 'success' ? 'rgba(0,212,170,0.3)' : messageType === 'error' ? 'rgba(255,71,87,0.3)' : 'rgba(108,99,255,0.3)'}`,
                  color: messageType === 'success' ? 'var(--accent)' : messageType === 'error' ? '#FF4757' : 'var(--primary-light)',
                }}>
                {message}
              </div>
            )}

            <p className="mt-8 text-xs" style={{ color: 'var(--text-muted)' }}>
              مشكلة في البصمة؟{' '}
              <button onClick={() => setMode('pin')} className="underline" style={{ color: 'var(--primary-light)' }}>
                استخدم الكود
              </button>
            </p>
          </div>
        ) : (
          /* PIN Pad UI */
          <div className="w-full max-w-sm animate-fadeInUp">
            <h2 className="text-2xl font-bold mb-2 text-center" style={{ color: 'var(--text-primary)' }}>
              تسجيل بالكود
            </h2>
            <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-muted)' }}>
              أدخل اسمك وكودك للدخول
            </p>

            <div className="mb-4">
              <input
                id="biometric-username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="input-dark"
                placeholder="اسم المستخدم"
              />
            </div>

            {/* PIN display */}
            <div className="flex justify-center gap-3 mb-6">
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
                  style={{
                    background: i < pin.length ? 'var(--gradient-primary)' : 'rgba(26,26,53,0.8)',
                    border: `2px solid ${i < pin.length ? 'var(--primary)' : 'var(--dark-border)'}`,
                    boxShadow: i < pin.length ? '0 0 10px rgba(108,99,255,0.3)' : 'none',
                  }}
                >
                  {i < pin.length && <span className="w-3 h-3 rounded-full bg-white" />}
                </div>
              ))}
            </div>

            {message && (
              <div className="mb-4 p-3 rounded-xl text-sm text-center"
                style={{
                  background: messageType === 'success' ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
                  color: messageType === 'success' ? 'var(--accent)' : '#FF4757',
                }}>
                {message}
              </div>
            )}

            {/* Number pad */}
            <div className="grid grid-cols-3 gap-3">
              {numKeys.map((key, i) => (
                <button
                  key={i}
                  id={key === '⌫' ? 'pin-backspace' : key === '' ? undefined : `pin-key-${key}`}
                  onClick={() => {
                    if (key === '⌫') handlePinBackspace();
                    else if (key !== '') handlePinKey(key);
                  }}
                  disabled={key === '' || scanning}
                  className={`h-16 rounded-2xl text-xl font-bold transition-all duration-150 ${
                    key === '' ? 'opacity-0 cursor-default' : 'hover:scale-105 active:scale-95'
                  }`}
                  style={{
                    background: key === '⌫' ? 'rgba(255,71,87,0.15)' : 'rgba(26,26,53,0.8)',
                    border: key === '⌫' ? '1px solid rgba(255,71,87,0.3)' : '1px solid var(--dark-border)',
                    color: key === '⌫' ? '#FF4757' : 'var(--text-primary)',
                  }}
                >
                  {key}
                </button>
              ))}
            </div>

            <button
              id="pin-submit"
              onClick={handlePinSubmit}
              disabled={scanning || pin.length < 4}
              className="btn-primary w-full mt-4 text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scanning ? 'جاري التحقق...' : 'دخول 🚀'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BiometricPage;