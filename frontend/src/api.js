import axios from 'axios';
import { useAuthStore } from './store/useAuthStore';

// Automatically target localhost when running locally, or Render in production
const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const isLocal = 
  hostname === 'localhost' || 
  hostname === '127.0.0.1' || 
  hostname === '[::1]' ||
  hostname.startsWith('192.168.') ||
  hostname.startsWith('10.') ||
  hostname.startsWith('172.');

export const BACKEND_BASE = isLocal 
  ? `http://${hostname}:8000` 
  : 'https://ecommerce-system-21y5.onrender.com';

const baseURL = import.meta.env.VITE_API_BASE_URL || `${BACKEND_BASE}/api/`;

export function getMediaUrl(imagePath) {
  if (!imagePath) return '';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${BACKEND_BASE}${cleanPath}`;
}

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
