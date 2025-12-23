import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import config from '../config/api';

export const API_BASE_URL = config.API_BASE_URL;

// Helper function: Ensure image URLs have full domain prefix
export const ensureFullImageUrl = (url: string | undefined | null): string => {
    if (!url) return '';

    // If already a full URL (starts with http:// or https://), return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    // Get domain without /api suffix for images
    // API_BASE_URL = 'https://balkingly-hemitropic-lelah.ngrok-free.dev/api'
    // We want: 'https://balkingly-hemitropic-lelah.ngrok-free.dev'
    const domainOnly = API_BASE_URL.replace(/\/api\/?$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;

    const fullUrl = `${domainOnly}${path}`;
    console.log(`🔗 [ensureFullImageUrl] ${url} → ${fullUrl}`);
    return fullUrl;
};

// 创建 Axios 实例
const api = axios.create({
    baseURL: API_BASE_URL,   // 统一使用 config.ts 的 URL
    timeout: config.API_TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
});

// 拦截器：统一加 token
api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            config.headers = config.headers || {};
            // @ts-ignore
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        // console.log(`[API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;
