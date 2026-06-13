import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 10000,
});

// Interceptor: anexa token automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('forja_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: se 401, limpa token
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('forja_token');
      localStorage.removeItem('forja-auth');
      localStorage.removeItem('forja_pessoa');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
