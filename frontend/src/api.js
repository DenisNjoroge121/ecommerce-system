import axios from 'axios';
import { useAuthStore } from './store/useAuthStore';

const API = axios.create({
  baseURL: 'https://ecommerce-system-21y5.onrender.com/api/',
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
