import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5050/api',
});

export const sendEmail = async (emailData) => {
  try {
    const response = await api.post('/send-email', emailData);
    return response.data;
  } catch (error) {
    if (error.response) {
      // Server responded with an error (4xx or 5xx)
      throw error.response.data;
    } else if (error.request) {
      // Network error (no response)
      throw { success: false, message: 'Server unreachable. Please check your connection.' };
    } else {
      // Other error
      throw { success: false, message: 'An unexpected error occurred.' };
    }
  }
};
