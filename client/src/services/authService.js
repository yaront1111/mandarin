// src/services/authService.js
import api from './api';

const authService = {
  async login(email, password) {
    const response = await api.post('api/auth/login', { email, password });
    // server returns { success: true, data: { user, token, refreshToken } }
    const { token, refreshToken, user } = response.data.data;
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    return { user, token, refreshToken };
  },

  async register(formData) {
    // formData might contain email, password, birthDate, etc.
    const response = await api.post('api/auth/register', formData);
    const { user, token, refreshToken } = response.data.data;
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    return { user, token, refreshToken };
  },

  async getCurrentUser() {
    const response = await api.get('api/auth/me');
    // { success: true, data: { user: {...} } }
    return response.data.data.user;
  },

  async logout() {
    // optionally call your server endpoint /auth/logout
    // e.g. await api.post('/auth/logout');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }
};

export default authService;
