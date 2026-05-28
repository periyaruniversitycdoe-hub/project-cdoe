import axios from 'axios';

const API_BASE = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const getAuthHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
});

export const fetchServices = () => axios.get(`${API_BASE}/email-services`, getAuthHeader());
export const fetchServiceById = (id) => axios.get(`${API_BASE}/email-services/${id}`, getAuthHeader());
export const createEmailService = (data) => axios.post(`${API_BASE}/email-services`, data, getAuthHeader());
export const updateEmailService = (id, data) => axios.put(`${API_BASE}/email-services/${id}`, data, getAuthHeader());
export const deleteEmailService = (id) => axios.delete(`${API_BASE}/email-services/${id}`, getAuthHeader());
export const toggleService = (id, is_active) => axios.patch(`${API_BASE}/email-services/${id}/status`, { is_active }, getAuthHeader());
export const fetchEmailLogs = () => axios.get(`${API_BASE}/dynamic-emails/logs`, getAuthHeader());
export const sendTestEmail = (payload) => axios.post(`${API_BASE}/dynamic-emails/send`, payload, getAuthHeader());
