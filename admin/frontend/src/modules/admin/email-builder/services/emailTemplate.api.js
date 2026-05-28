import axios from 'axios';

const BASE_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/email-templates';

// Helper to get auth header
const getHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
        headers: {
            Authorization: `Bearer ${token}`
        }
    };
};

export const getTemplates = async () => {
    const res = await axios.get(BASE_URL, getHeaders());
    return res.data;
};

export const getTemplateById = async (id) => {
    const res = await axios.get(`${BASE_URL}/${id}`, getHeaders());
    return res.data;
};

export const createTemplate = async (data) => {
    const res = await axios.post(BASE_URL, data, getHeaders());
    return res.data;
};

export const updateTemplate = async (id, data) => {
    const res = await axios.put(`${BASE_URL}/${id}`, data, getHeaders());
    return res.data;
};

export const deleteTemplate = async (id) => {
    const res = await axios.delete(`${BASE_URL}/${id}`, getHeaders());
    return res.data;
};

export const getLivePreview = async (templateConfig) => {
    const res = await axios.post(`${BASE_URL}/preview`, { template_config: templateConfig }, getHeaders());
    return res.data;
};

export const sendTestEmail = async (targetEmail, templateConfig) => {
    const res = await axios.post(`${BASE_URL}/send-test`, { targetEmail, template_config: templateConfig }, getHeaders());
    return res.data;
};

export const uploadLogo = async (file) => {
    const formData = new FormData();
    formData.append('logo', file);
    
    const config = getHeaders();
    config.headers['Content-Type'] = 'multipart/form-data';
    
    const res = await axios.post(`${BASE_URL}/upload-logo`, formData, config);
    return res.data;
};

export const getCustomCategories = async () => {
    const res = await axios.get(`${BASE_URL}/categories/all`, getHeaders());
    return res.data;
};

export const addCustomCategory = async (typeName) => {
    const res = await axios.post(`${BASE_URL}/categories/add`, { type_name: typeName }, getHeaders());
    return res.data;
};
