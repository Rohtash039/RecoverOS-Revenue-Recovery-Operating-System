import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000
});

export const RecoverOSAPI = {
  getDashboardSummary: async () => {
    const res = await api.get('/dashboard/summary');
    return res.data.data;
  },

  getRecoveryCases: async (params = {}) => {
    const res = await api.get('/recovery-cases', { params });
    return res.data.data;
  },

  getRecoveryCaseById: async (id) => {
    const res = await api.get(`/recovery-cases/${id}`);
    return res.data.data;
  },

  getWhyNotRetry: async (id) => {
    const res = await api.get(`/recovery-cases/${id}/why-not-retry`);
    return res.data.data;
  },

  postCaseAction: async (id, action) => {
    const res = await api.post(`/recovery-cases/${id}/action`, { action });
    return res.data.data;
  },

  analyzeCase: async (id) => {
    const res = await api.post(`/recovery-cases/${id}/analyze`);
    return res.data.data;
  },

  runBatchSimulation: async (speed = 'ANIMATED') => {
    const res = await api.post('/simulation/batch-run', { speed });
    return res.data.data;
  },

  getBatchStatus: async (batchId) => {
    const res = await api.get(`/simulation/batch/${batchId}/status`);
    return res.data.data;
  },

  resetSimulation: async (seed) => {
    const res = await api.post('/simulation/reset', { seed });
    return res.data;
  },

  getAuditLogs: async (params = {}) => {
    const res = await api.get('/audit-logs', { params });
    return res.data.data;
  },

  getAgentActivity: async (limit = 30) => {
    const res = await api.get('/audit-logs/activity', { params: { limit } });
    return res.data.data;
  }
};
