// src/services/api.js
import axios from 'axios';

const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL,
  withCredentials: true
});

// Attach JWT token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Optionally handle 401 or token refresh in a response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // E.g. logout or refresh token logic if status 401
    // ...
    return Promise.reject(error);
  }
);

export default api;
