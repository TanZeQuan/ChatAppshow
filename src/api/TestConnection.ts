// eslint-disable-next-line import/no-duplicates
import api from './service';
// eslint-disable-next-line import/no-duplicates
import { API_BASE_URL } from './service';

/**
 * Test API connection
 * Use this in your app to verify the backend is reachable
 */
export const testAPIConnection = async () => {
  console.log('🔍 Testing API connection...');
  console.log('📍 API URL:', API_BASE_URL);

  try {
    // Test basic connectivity with a simple GET request
    const response = await api.get('/');
    console.log('✅ API is reachable!');
    console.log('   Status:', response.status);
    return {
      success: true,
      message: 'API is reachable',
      status: response.status,
    };
  } catch (error: any) {
    console.error('❌ API connection failed!');
    console.error('   Error:', error.message);
    console.error('   Error code:', error.code);

    if (error.message === 'Network Error') {
      return {
        success: false,
        message: 'Cannot reach the API server. Please check:\n' +
                 '1. Backend server is running\n' +
                 '2. Ngrok is running and URL is correct\n' +
                 '3. Your device has internet access\n' +
                 '4. Your device can reach the ngrok URL',
        error: 'NETWORK_ERROR',
      };
    }

    return {
      success: false,
      message: error.message,
      error: error.code,
    };
  }
};
