import axios from 'axios';

// In production: point directly to backend (Vercel proxy doesn't handle POST/WebSocket well)
// In development: use /api (Vite proxy handles it)
const BASE = import.meta.env.VITE_BACKEND_URL
  ? `${import.meta.env.VITE_BACKEND_URL}/api`
  : '/api';

const API = axios.create({ baseURL: BASE });

// Auto-attach token
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('dandana_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// â”€â”€â”€ Auth â”€â”€â”€
export const authAPI = {
  login:               (username, password) => API.post('/auth/login', { username, password }),
  biometricAttendance: (fingerprint)        => API.post('/auth/attendance/biometric', { fingerprint }),
  getAllUsers:          ()                   => API.get('/auth/users'),
  getBranches:         ()                   => API.get('/auth/branches'),
  getAttendance:       (date, branchId)     => API.get(`/auth/attendance?date=${date || ''}${branchId ? `&branch_id=${branchId}` : ''}`),
  clockIn:             (userId, branchId)   => API.post('/auth/clock-in',  { user_id: userId, branch_id: branchId }),
  clockOut:            (userId)             => API.post('/auth/clock-out', { user_id: userId }),
  updateAttendanceStatus: (id, status)      => API.put(`/auth/attendance/${id}/status`, { status }),
  shiftTransfer:       (userId, newBranchId)=> API.post('/auth/shift-transfer', { user_id: userId, new_branch_id: newBranchId }),
  markAbsent:          (userId, date)       => API.post('/auth/mark-absent', { user_id: userId, date }),
  updateBranchShiftTiming: (branchId, data) => API.put(`/auth/branches/${branchId}/shift-timing`, data),
  toggleDelegatedLeave: (userId, canManage) => API.put(`/auth/users/${userId}/delegate-leaves`, { can_manage_leaves: canManage }),
  getNotifications:    ()                   => API.get('/auth/notifications'),
  markNotificationRead:(id)                 => API.put(`/auth/notifications/${id}/read`),
};

// â”€â”€â”€ HR (Salary & Advances) â”€â”€â”€
export const hrAPI = {
  getSalaryCalculation: (userId, monthYear) => API.get(`/hr/salary/${userId}?monthYear=${encodeURIComponent(monthYear)}`),
  getAllSalaries:        (monthYear)         => API.get(`/hr/salaries?month=${monthYear}`),
  getSalarySummary:      (monthYear)         => API.get(`/hr/salary-summary?month=${monthYear}`),
  addAdvance:           (userId, amount, note, type) => API.post('/hr/advance', { user_id: userId, amount, note, type }),
  getAdvances:          (userId, monthYear, status) => API.get(`/hr/advances${userId ? `/${userId}` : ''}?${monthYear ? `month=${monthYear}&` : ''}${status ? `status=${status}` : ''}`),
  updateAdvanceStatus:  (advanceId, status)  => API.put(`/hr/advances/${advanceId}/status`, { status }),
  adjustAdvances:       (userId, amount, reason) => API.post('/hr/adjust-advances', { user_id: userId, amount, reason }),
  adjustIceCream:       (userId, amount, reason) => API.post('/hr/adjust-ice-cream', { user_id: userId, amount, reason }),
  addIceCreamDeduction: (userId, items)     => API.post('/hr/ice-cream-order', { user_id: userId, items }),
  getIceCreamOrders:    (userId, monthYear) => API.get(`/hr/ice-cream-orders/${userId}?month=${monthYear}`),
  createUser:  (data)          => API.post('/auth/register', data),
  updateUser:  (userId, data)  => API.put(`/auth/users/${userId}`, data),
  deleteUser:  (userId)        => API.delete(`/auth/users/${userId}`),
};

// â”€â”€â”€ Inventory â”€â”€â”€
export const inventoryAPI = {
  getProducts:             ()             => API.get('/inventory/products'),
  updateProduct:           (id, data)     => API.put(`/inventory/products/${id}`, data),
  addProduct:              (data)         => API.post('/inventory/products', data),
  placeOrder:              (userId, items)=> API.post('/inventory/orders', { user_id: userId, items }),

  // Audit & Factory Orders
  getAuditItems:           ()                         => API.get('/inventory/audit-items'),
  addAuditItem:            (data)                     => API.post('/inventory/audit-items', data),
  saveAudit:               (items)                    => API.post('/inventory/audits', { items }),
  getAudits:               ()                         => API.get('/inventory/audits'),
  createFactoryOrder:      (items, note, recipient, branchId) => API.post('/inventory/factory-orders', { items, note, recipient, branch_id: branchId }),
  getFactoryOrders:        (recipient)                => API.get(`/inventory/factory-orders${recipient ? `?recipient=${recipient}` : ''}`),
  updateFactoryOrderStatus:(id, status)               => API.put(`/inventory/factory-orders/${id}/status`, { status }),
};

// â”€â”€â”€ Expenses â”€â”€â”€
export const expensesAPI = {
  addExpense:      (amount, reason) => API.post('/expenses', { amount, reason }),
  addShiftSales:   (amount)         => API.post('/expenses/sales', { amount }),
  getShiftSummary: ()               => API.get('/expenses/summary'),
};

// â”€â”€â”€ Chat â”€â”€â”€
export const chatAPI = {
  getMessages: ()                           => API.get('/chat/messages'),
  sendMessage: (message, mediaUrl, mediaType)=> API.post('/chat/messages', { message, media_url: mediaUrl, media_type: mediaType }),
};

// â”€â”€â”€ Calendar â”€â”€â”€ (all aliases point to correct endpoints)
export const calendarAPI = {
  getLeaves:    ()                   => API.get('/calendar/leaves'),
  requestLeave: (data)               => API.post('/calendar/leaves', data),
  approveLeave: (leaveId, status)    => API.put(`/calendar/leaves/${leaveId}/approve`, { status }),
};
