import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import './index.css';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const SalaryPage = lazy(() => import('./pages/SalaryPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));

const PageLoading = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="spinner" style={{ width: '36px', height: '36px', borderWidth: '3px' }} />
  </div>
);

const ProtectedRoute = ({ children, allowedRoles = null }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-animated">
        <div className="text-center animate-fadeInUp">
          <div className="spinner mx-auto mb-4" style={{ width: '50px', height: '50px', borderWidth: '4px' }} />
          <p style={{ color: 'var(--text-muted)' }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppContent() {
  return (
    <Router>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/attendance" element={<AttendancePage />} />
                    <Route path="/salary" element={<SalaryPage />} />
                    <Route path="/inventory" element={<ProtectedRoute allowedRoles={['manager', 'cashier']}><InventoryPage /></ProtectedRoute>} />
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/employees" element={<ProtectedRoute allowedRoles={['manager']}><EmployeesPage /></ProtectedRoute>} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="font-cairo" dir="rtl">
        <AppContent />
      </div>
    </AuthProvider>
  );
}

export default App;