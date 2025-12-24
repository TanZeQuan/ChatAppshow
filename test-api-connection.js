/**
 * API Connection Test Script
 *
 * Run this to verify your backend API is accessible
 * Usage: node test-api-connection.js
 */

const axios = require('axios');

const API_BASE_URL = 'https://balkingly-hemitropic-lelah.ngrok-free.dev/api';

async function testAPIConnection() {
  console.log('🔍 Testing API connection...');
  console.log('📍 API URL:', API_BASE_URL);
  console.log('');

  try {
    // Test 1: Basic connectivity
    console.log('Test 1: Testing basic connectivity...');
    const response = await axios.get(`${API_BASE_URL.replace('/api', '')}/`, {
      timeout: 10000,
      validateStatus: () => true, // Accept any status code
    });
    console.log('✅ Server is reachable!');
    console.log('   Status:', response.status);
    console.log('   Headers:', response.headers);
    console.log('');

    // Test 2: Test API endpoint
    console.log('Test 2: Testing API endpoint...');
    try {
      const apiTest = await axios.post(`${API_BASE_URL}/chats/read`,
        { data: JSON.stringify({ user_id: 'test' }) },
        {
          timeout: 10000,
          headers: { 'Content-Type': 'multipart/form-data' },
          validateStatus: () => true
        }
      );
      console.log('✅ API endpoint responded!');
      console.log('   Status:', apiTest.status);
      console.log('   Response:', apiTest.data);
    } catch (apiError) {
      console.log('⚠️  API endpoint error:', apiError.message);
    }
    console.log('');

    console.log('✅ Connection test complete!');
    console.log('');
    console.log('If you see this message, your API server is accessible.');
    console.log('If the app still has Network Error, the issue is likely:');
    console.log('  1. Mobile device cannot reach the ngrok URL');
    console.log('  2. Ngrok requires browser verification');
    console.log('  3. FormData configuration issue in React Native');

  } catch (error) {
    console.error('❌ Connection failed!');
    console.error('   Error:', error.message);
    console.error('');
    console.error('Possible reasons:');
    console.error('  1. Ngrok tunnel has expired (free tunnels expire)');
    console.error('  2. Backend server is not running');
    console.error('  3. URL is incorrect');
    console.error('  4. Network/firewall blocking the connection');
    console.error('');
    console.error('Solutions:');
    console.error('  1. Restart your ngrok tunnel: ngrok http 3000');
    console.error('  2. Update API_BASE_URL in src/config/api.ts');
    console.error('  3. Ensure backend server is running');
  }
}

testAPIConnection();