import axios from 'axios';
import { useAuthStore } from '../store/auth.js';

// Base for all API calls. In dev/single-origin prod this stays '/api' (Vite proxy
// or nginx reverse-proxy). For a split deploy (frontend and backend on different
// hosts), set VITE_API_BASE_URL to the backend's absolute URL, e.g.
// https://api.fintrack.in/api
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Same-origin in dev thanks to the Vite proxy; credentials carry the refresh cookie.
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

// Attach the in-memory access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On a 401, try a one-time refresh, then replay the original request.
let refreshing = null;

// Shared one-time refresh, reused by both the axios interceptor and the raw
// fetch-based chat stream (which can't go through axios).
export const refreshAccessToken = async () => {
  refreshing =
    refreshing ||
    api.post('/auth/refresh').finally(() => {
      refreshing = null;
    });
  const { data } = await refreshing;
  const token = data?.data?.accessToken;
  if (token) useAuthStore.getState().setAccessToken(token);
  return token;
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;

    if (response?.status === 401 && !config._retry && !config.url.includes('/auth/')) {
      config._retry = true;
      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          config.headers.Authorization = `Bearer ${newToken}`;
          return api(config);
        }
      } catch {
        useAuthStore.getState().clear();
      }
    }
    return Promise.reject(error);
  }
);

// Unwraps the standardized { success, message, data } envelope.
const unwrap = (p) => p.then((r) => r.data.data);

export const authApi = {
  register: (body) => unwrap(api.post('/auth/register', body)),
  login: (body) => unwrap(api.post('/auth/login', body)),
  me: () => unwrap(api.get('/auth/me')),
  updateProfile: (body) => unwrap(api.patch('/auth/profile', body)),
  logout: () => api.post('/auth/logout'),
};

export const expenseApi = {
  list: (params) => unwrap(api.get('/expenses', { params })),
  create: (body) => unwrap(api.post('/expenses', body)),
  update: (id, body) => unwrap(api.put(`/expenses/${id}`, body)),
  remove: (id) => unwrap(api.delete(`/expenses/${id}`)),
  overview: (params) => unwrap(api.get('/expenses/overview', { params })),
  summary: (params) => unwrap(api.get('/expenses/summary', { params })),
  trends: () => unwrap(api.get('/expenses/trends')),
};

export const incomeApi = {
  list: (params) => unwrap(api.get('/income', { params })),
  create: (body) => unwrap(api.post('/income', body)),
  remove: (id) => unwrap(api.delete(`/income/${id}`)),
};

export const budgetApi = {
  list: (params) => unwrap(api.get('/budgets', { params })),
  status: (params) => unwrap(api.get('/budgets/status', { params })),
  create: (body) => unwrap(api.post('/budgets', body)),
  update: (id, body) => unwrap(api.put(`/budgets/${id}`, body)),
  remove: (id) => unwrap(api.delete(`/budgets/${id}`)),
};

export const subscriptionApi = {
  list: () => unwrap(api.get('/subscriptions')),
  upcoming: (params) => unwrap(api.get('/subscriptions/upcoming', { params })),
  create: (body) => unwrap(api.post('/subscriptions', body)),
  update: (id, body) => unwrap(api.put(`/subscriptions/${id}`, body)),
  remove: (id) => unwrap(api.delete(`/subscriptions/${id}`)),
};

export const aiApi = {
  insights: () => unwrap(api.get('/ai/insights')),
  healthScore: () => unwrap(api.get('/ai/health-score')),
  taxSuggestions: () => unwrap(api.get('/ai/tax-suggestions')),
  categorize: (text) => unwrap(api.post('/ai/categorize', { text })),
};

export const documentApi = {
  list: () => unwrap(api.get('/documents')),
  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    // Let axios set the multipart boundary itself.
    return unwrap(api.post('/documents/upload', form));
  },
  status: (id) => unwrap(api.get(`/documents/${id}/status`)),
  reprocess: (id) => unwrap(api.post(`/documents/${id}/reprocess`)),
};

export const notificationApi = {
  list: (params) => unwrap(api.get('/notifications', { params })),
  markRead: (id) => unwrap(api.put(`/notifications/${id}/read`)),
  markAllRead: () => unwrap(api.put('/notifications/read-all')),
  remove: (id) => unwrap(api.delete(`/notifications/${id}`)),
};

// Triggers a browser download from a blob response.
const downloadBlob = (data, filename) => {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const reportApi = {
  monthly: (params) => unwrap(api.get('/reports/monthly', { params })),
  downloadCsv: async (params) => {
    const { data } = await api.get('/reports/export/csv', { params, responseType: 'blob' });
    downloadBlob(data, 'fintrack-expenses.csv');
  },
  downloadPdf: async (params) => {
    const { data } = await api.get('/reports/export/pdf', { params, responseType: 'blob' });
    const name = `fintrack-report-${params.year}-${String(params.month).padStart(2, '0')}.pdf`;
    downloadBlob(data, name);
  },
};

export const splitApi = {
  groups: () => unwrap(api.get('/split/groups')),
  createGroup: (body) => unwrap(api.post('/split/groups', body)),
  group: (id) => unwrap(api.get(`/split/groups/${id}`)),
  updateGroup: (id, body) => unwrap(api.put(`/split/groups/${id}`, body)),
  removeGroup: (id) => unwrap(api.delete(`/split/groups/${id}`)),
  addMember: (id, body) => unwrap(api.post(`/split/groups/${id}/members`, body)),
  removeMember: (id, memberId) => unwrap(api.delete(`/split/groups/${id}/members/${memberId}`)),
  addExpense: (id, body) => unwrap(api.post(`/split/groups/${id}/expenses`, body)),
  removeExpense: (id, expenseId) => unwrap(api.delete(`/split/groups/${id}/expenses/${expenseId}`)),
  addSettlement: (id, body) => unwrap(api.post(`/split/groups/${id}/settlements`, body)),
  removeSettlement: (id, settlementId) =>
    unwrap(api.delete(`/split/groups/${id}/settlements/${settlementId}`)),
};

export const adminApi = {
  stats: () => unwrap(api.get('/admin/stats')),
  users: (params) => unwrap(api.get('/admin/users', { params })),
  user: (id) => unwrap(api.get(`/admin/users/${id}`)),
  togglePro: (id) => unwrap(api.put(`/admin/users/${id}/toggle-pro`)),
  setRole: (id, role) => unwrap(api.put(`/admin/users/${id}/role`, { role })),
  auditLogs: (params) => unwrap(api.get('/admin/audit-logs', { params })),
};
