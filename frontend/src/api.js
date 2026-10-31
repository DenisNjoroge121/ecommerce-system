import axios from 'axios';
import { useAuthStore } from './store/useAuthStore';

// Automatically target localhost when running locally, or Render in production
const isLocal = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const baseURL = import.meta.env.VITE_API_BASE_URL || 
  (isLocal ? 'http://localhost:8000/api/' : 'https://ecommerce-system-21y5.onrender.com/api/');

const API = axios.create({
  baseURL,
});

// Interceptor to add auth token if present
API.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export default API;
