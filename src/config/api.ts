// API Configuration
// Centralized configuration for API and WebSocket URLs

// API Base URL
export const API_BASE_URL = 'https://balkingly-hemitropic-lelah.ngrok-free.dev/api';

// WebSocket URL
export const WS_URL = 'wss://ws.ngrok-free.dev';

// Timeout settings
export const API_TIMEOUT = 10000; // 10 seconds
export const WS_LOGIN_TIMEOUT = 5000; // 5 seconds
export const WS_RECONNECT_DELAY = 3000; // 3 seconds
export const WS_MAX_RECONNECT_ATTEMPTS = 5;

// Debug mode
export const DEBUG_MODE = __DEV__; // true in development

// Log configuration
export const logConfig = (message: string, data?: any) => {
  if (DEBUG_MODE) {
    console.log(`[CONFIG] ${message}`, data || '');
  }
};

// Validate URLs on app start
export const validateConfig = () => {
  const errors: string[] = [];

  if (!API_BASE_URL) {
    errors.push('API_BASE_URL is not defined');
  }

  if (!WS_URL) {
    errors.push('WS_URL is not defined');
  }

  if (!WS_URL.startsWith('ws://') && !WS_URL.startsWith('wss://')) {
    errors.push('WS_URL must start with ws:// or wss://');
  }

  if (errors.length > 0) {
    console.error('[CONFIG] Configuration errors:', errors);
    return false;
  }

  console.log('[CONFIG] ✅ Configuration validated successfully');
  console.log('[CONFIG] API URL:', API_BASE_URL);
  console.log('[CONFIG] WebSocket URL:', WS_URL);
  return true;
};

export default {
  API_BASE_URL,
  WS_URL,
  API_TIMEOUT,
  WS_LOGIN_TIMEOUT,
  WS_RECONNECT_DELAY,
  WS_MAX_RECONNECT_ATTEMPTS,
  DEBUG_MODE,
  validateConfig,
};
