import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000
});

const configuredApiKey = import.meta.env.VITE_API_KEY;
if (configuredApiKey) {
  api.defaults.headers.common['x-api-key'] = configuredApiKey;
}

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

  postCaseAction: async (id, action, operatorId = 'ops_lead_priya') => {
    const res = await api.post(`/recovery-cases/${id}/action`, { action, operatorId });
    return res.data.data;
  },

  analyzeCase: async (id) => {
    const res = await api.post(`/recovery-cases/${id}/analyze`);
    return res.data.data;
  },

  runBatchSimulation: async (speed = 'FAST') => {
    const res = await api.post('/simulation/batch-run', { speed });
    return res.data.data;
  },

  getBatchStatus: async (batchId) => {
    const targetId = (batchId && batchId !== 'undefined' && batchId !== 'null') ? batchId : 'latest';
    const res = await api.get(`/simulation/batch/${targetId}/status`);
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
  },

  verifyAuditChain: async () => {
    const res = await api.get('/audit-logs/verify-chain');
    return res.data.data;
  }
};

