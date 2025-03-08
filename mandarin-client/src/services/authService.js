// src/services/authService.js
import { api } from './api';

const AUTH_KEY = 'authToken'; // Key in localStorage, if you're storing tokens client-side

export const authService = {
  async login(credentials) {
    // e.g., { username, password } or { email, password }
    const data = await api.post('/auth/login', credentials);
    if (data.token) {
      localStorage.setItem(AUTH_KEY, data.token);
    }
    return data;
  },

  async register(newUserData) {
    // e.g., { username, email, password, ... }
    const data = await api.post('/auth/register', newUserData);
    if (data.token) {
      localStorage.setItem(AUTH_KEY, data.token);
    }
    return data;
  },

  logout() {
    // Optionally call an endpoint to invalidate tokens on server
    // await api.post('/auth/logout', null, { token });
    localStorage.removeItem(AUTH_KEY);
  },

  getToken() {
    return localStorage.getItem(AUTH_KEY);
  },

  // Example: refresh token or check validity
  async refreshToken() {
    const token = localStorage.getItem(AUTH_KEY);
    if (!token) return null;
    const data = await api.post('/auth/refresh', null, { token });
    if (data.newToken) {
      localStorage.setItem(AUTH_KEY, data.newToken);
      return data.newToken;
    }
    return null;
  },
};
