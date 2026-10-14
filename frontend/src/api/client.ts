import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to inject JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('itam_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to catch 401 and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('itam_access_token');
      localStorage.removeItem('itam_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
