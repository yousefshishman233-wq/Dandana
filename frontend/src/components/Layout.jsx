import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ALL_ROLES = [
  'manager', 'cashier', 'employee', 'chef', 'driver', 'accountant', 'prep', 'fridge', 'hall', 'delivery'
];

const NAV_ITEMS = [
  { name: 'لوحة التحكم',      href: '/',           icon: '🏠', roles: ALL_ROLES },
  { name: 'الحضور والانصراف', href: '/attendance',  icon: '📋', roles: ALL_ROLES },
  { name: 'الرواتب والسلف',   href: '/salary',      icon: '💰', roles: ALL_ROLES },
  { name: 'المخزن والطلبات',  href: '/inventory',   icon: '🍦', roles: ALL_ROLES },
  { name: 'الدردشة الجماعية', href: '/chat',        icon: '💬', roles: ALL_ROLES },
  { name: 'التقويم والإجازات',href: '/calendar',    icon: '📅', roles: ALL_ROLES },
  { name: 'إدارة الموظفين',   href: '/employees',   icon: '👥', roles: ['manager'] },
];

const ROLE_CONFIG = {
  manager: { label: 'مدير', badge: 'badge-manager', icon: '👑', color: '#FF4757' },
  cashier: { label: 'كاشير', badge: 'badge-cashier', icon: '🖐️', color: '#6C63FF' },
  chef: { label: 'شيفات', badge: 'badge-employee', icon: '🍳', color: '#FF9F43' },
  driver: { label: 'سائق', badge: 'badge-employee', icon: '🚗', color: '#54a0ff' },
  accountant: { label: 'محاسب', badge: 'badge-employee', icon: '📊', color: '#10ac84' },
  prep: { label: 'تحضير', badge: 'badge-employee', icon: '🔪', color: '#ee5253' },
  fridge: { label: 'ثلاجة', badge: 'badge-employee', icon: '❄️', color: '#00d2d3' },
  hall: { label: 'صالة', badge: 'badge-employee', icon: '🍽️', color: '#576574' },
  delivery: { label: 'دليفري', badge: 'badge-employee', icon: '🛵', color: '#ff9ff3' },
  employee: { label: 'موظف عام', badge: 'badge-employee', icon: '👷', color: '#00D4AA' },
};

const Clock = () => {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontFamily: 'Inter', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
      {time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
};

const Layout = ({ children }) => {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const filteredNav = NAV_ITEMS.filter(item => user && item.roles.includes(user.role));
  const roleConf = ROLE_CONFIG[user?.role] || ROLE_CONFIG.employee;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentPage = filteredNav.find(item => location.pathname === item.href);

  const SidebarContent = ({ expanded }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b"
        style={{ borderColor: 'var(--dark-border)' }}>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6C63FF, #FF6B9D)', boxShadow: '0 0 20px rgba(108,99,255,0.4)' }}>
          🍦
        </div>
        {expanded && (
          <div className="animate-fadeInUp">
            <h1 className="font-black text-xl text-gradient-primary leading-none">دندنه</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>نظام الإدارة</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              title={!expanded ? item.name : undefined}
              className={`nav-item ${isActive ? 'active' : ''} ${expanded ? '' : 'justify-center'}`}
              id={`nav-${item.href.replace('/', 'home').replace(/\//g, '-')}`}
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              {expanded && (
                <span className="text-sm font-medium animate-fadeInUp">{item.name}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--dark-border)' }}>
        <div className={`flex items-center gap-3 p-3 rounded-xl ${expanded ? '' : 'justify-center'}`}
          style={{ background: 'rgba(108,99,255,0.08)' }}>
          <div className="avatar w-9 h-9 text-sm flex-shrink-0"
            style={{ boxShadow: `0 0 12px ${roleConf.color}50` }}>
            {user?.full_name?.[0] || '?'}
          </div>
          {expanded && (
            <div className="flex-1 min-w-0 animate-fadeInUp">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {user?.full_name}
              </p>
              <span className={`text-xs ${roleConf.badge}`} style={{ fontSize: '10px' }}>
                {roleConf.icon} {roleConf.label}
              </span>
            </div>
          )}
          {expanded && (
            <button
              onClick={handleLogout}
              title="تسجيل الخروج"
              className="text-lg hover:scale-110 transition-transform"
              id="logout-btn"
            >
              🚪
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--dark)' }} dir="rtl">
      {/* Desktop Sidebar */}
      <div
        className="hidden lg:flex flex-col flex-shrink-0 transition-all duration-300 border-l"
        style={{
          width: sidebarExpanded ? '240px' : '72px',
          background: 'rgba(13,13,26,0.95)',
          borderColor: 'var(--dark-border)',
          backdropFilter: 'blur(20px)',
        }}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <SidebarContent expanded={sidebarExpanded} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 flex flex-col w-64 border-l"
            style={{ background: 'rgba(13,13,26,0.98)', borderColor: 'var(--dark-border)' }}>
            <SidebarContent expanded={true} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{
            background: 'rgba(13,13,26,0.8)',
            borderColor: 'var(--dark-border)',
            backdropFilter: 'blur(20px)',
          }}>
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'rgba(108,99,255,0.1)', color: 'var(--primary-light)' }}
              onClick={() => setMobileOpen(true)}
              id="mobile-menu-btn"
            >
              ☰
            </button>
            <div>
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                {currentPage?.icon} {currentPage?.name || 'دندنه'}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock />
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid var(--dark-border)' }}>
              <span className="text-sm">{roleConf.icon}</span>
              <span className="text-sm font-medium hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
                {user?.full_name}
              </span>
              <span className={roleConf.badge}>{roleConf.label}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6" style={{ background: 'var(--dark)' }}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;