import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import AttendancePage from './pages/AttendancePage';
import SalaryPage from './pages/SalaryPage';
import InventoryPage from './pages/InventoryPage';
import ChatPage from './pages/ChatPage';
import CalendarPage from './pages/CalendarPage';
import BiometricPage from './pages/BiometricPage';
import Layout from './components/Layout';
import './App.css';

// Protected route component
const ProtectedRoute = ({ children, allowedRoles = null }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center">جار التحميل...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppContent() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/biometric" element={<BiometricPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/salary" element={<SalaryPage />} />
                  <Route path="/inventory" element={
                    <ProtectedRoute allowedRoles={['manager', 'cashier']}>
                      <InventoryPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
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