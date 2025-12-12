import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
export const API_BASE_URL = 'https://balkingly-hemitropic-lelah.ngrok-free.dev/api';

// 创建 Axios 实例
const api = axios.create({
    baseURL: API_BASE_URL,   // 统一使用 config.ts 的 URL
    timeout: 10000,
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
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;
