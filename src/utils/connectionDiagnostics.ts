// Connection Diagnostics Tool
// Use this to test WebSocket and API connectivity

import config from '../config/api';
import axios from 'axios';

export interface DiagnosticResult {
  test: string;
  status: 'success' | 'failed' | 'warning';
  message: string;
  details?: any;
  timestamp: string;
}

/**
 * Test WebSocket connection
 */
export const testWebSocketConnection = (userId: string = 'TEST_USER'): Promise<DiagnosticResult> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let ws: WebSocket | null = null;

    const timeout = setTimeout(() => {
      if (ws) {
        ws.close();
      }
      resolve({
        test: 'WebSocket Connection',
        status: 'failed',
        message: 'Connection timeout after 10 seconds',
        details: {
          url: config.WS_URL,
          duration: Date.now() - startTime,
        },
        timestamp: new Date().toISOString(),
      });
    }, 10000);

    try {
      console.log('[DIAGNOSTIC] Testing WebSocket connection...');
      console.log('[DIAGNOSTIC] URL:', config.WS_URL);

      ws = new WebSocket(config.WS_URL);

      ws.onopen = () => {
        console.log('[DIAGNOSTIC] ✅ WebSocket opened');

        // Send login message
        const loginMsg = {
          msg: 'login',
          user_id: userId,
        };
        ws?.send(JSON.stringify(loginMsg));
        console.log('[DIAGNOSTIC] Login message sent:', loginMsg);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        console.log('[DIAGNOSTIC] Message received:', event.data);

        try {
          const data = JSON.parse(event.data);

          if (data.type === 1 && data.message === 'Connected') {
            ws?.close();
            resolve({
              test: 'WebSocket Connection',
              status: 'success',
              message: 'WebSocket connected and authenticated successfully',
              details: {
                url: config.WS_URL,
                response: data,
                duration: Date.now() - startTime,
              },
              timestamp: new Date().toISOString(),
            });
          } else if (data.type === 0) {
            ws?.close();
            resolve({
              test: 'WebSocket Connection',
              status: 'failed',
              message: `Authentication failed: ${data.message}`,
              details: {
                url: config.WS_URL,
                response: data,
                duration: Date.now() - startTime,
              },
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('[DIAGNOSTIC] Error parsing message:', error);
        }
      };

      ws.onerror = (error: any) => {
        clearTimeout(timeout);
        console.error('[DIAGNOSTIC] ❌ WebSocket error:', error);

        resolve({
          test: 'WebSocket Connection',
          status: 'failed',
          message: 'WebSocket connection error',
          details: {
            url: config.WS_URL,
            error: error.message || 'Unknown error',
            readyState: ws?.readyState,
            duration: Date.now() - startTime,
          },
          timestamp: new Date().toISOString(),
        });
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        console.log('[DIAGNOSTIC] WebSocket closed, code:', event.code);

        if (event.code !== 1000) {
          resolve({
            test: 'WebSocket Connection',
            status: 'failed',
            message: `WebSocket closed abnormally (code: ${event.code})`,
            details: {
              url: config.WS_URL,
              code: event.code,
              reason: event.reason || 'No reason provided',
              wasClean: event.wasClean,
              duration: Date.now() - startTime,
            },
            timestamp: new Date().toISOString(),
          });
        }
      };
    } catch (error: any) {
      clearTimeout(timeout);
      console.error('[DIAGNOSTIC] ❌ Failed to create WebSocket:', error);

      resolve({
        test: 'WebSocket Connection',
        status: 'failed',
        message: 'Failed to create WebSocket connection',
        details: {
          url: config.WS_URL,
          error: error.message,
          duration: Date.now() - startTime,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });
};

/**
 * Test API connection
 */
export const testAPIConnection = async (): Promise<DiagnosticResult> => {
  const startTime = Date.now();

  try {
    console.log('[DIAGNOSTIC] Testing API connection...');
    console.log('[DIAGNOSTIC] URL:', config.API_BASE_URL);

    // Try to make a simple request (we'll test the base URL)
    const response = await axios.get(config.API_BASE_URL.replace('/api', ''), {
      timeout: 5000,
    });

    return {
      test: 'API Connection',
      status: 'success',
      message: 'API server is reachable',
      details: {
        url: config.API_BASE_URL,
        statusCode: response.status,
        duration: Date.now() - startTime,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('[DIAGNOSTIC] ❌ API connection failed:', error);

    let message = 'Failed to connect to API server';
    if (error.code === 'ECONNABORTED') {
      message = 'API connection timeout';
    } else if (error.code === 'ERR_NETWORK') {
      message = 'Network error - cannot reach API server';
    } else if (error.response) {
      message = `API returned error: ${error.response.status}`;
    }

    return {
      test: 'API Connection',
      status: 'failed',
      message,
      details: {
        url: config.API_BASE_URL,
        error: error.message,
        code: error.code,
        duration: Date.now() - startTime,
      },
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Run all diagnostics
 */
export const runAllDiagnostics = async (userId?: string): Promise<DiagnosticResult[]> => {
  console.log('[DIAGNOSTIC] ========================================');
  console.log('[DIAGNOSTIC] Running Connection Diagnostics');
  console.log('[DIAGNOSTIC] ========================================');

  const results: DiagnosticResult[] = [];

  // Test API
  const apiResult = await testAPIConnection();
  results.push(apiResult);

  // Test WebSocket
  const wsResult = await testWebSocketConnection(userId || 'DIAGNOSTIC_USER');
  results.push(wsResult);

  console.log('[DIAGNOSTIC] ========================================');
  console.log('[DIAGNOSTIC] Diagnostic Results:');
  results.forEach((result) => {
    const icon = result.status === 'success' ? '✅' : '❌';
    console.log(`[DIAGNOSTIC] ${icon} ${result.test}: ${result.message}`);
  });
  console.log('[DIAGNOSTIC] ========================================');

  return results;
};

/**
 * Format diagnostic results for display
 */
export const formatDiagnosticResults = (results: DiagnosticResult[]): string => {
  let output = '📊 Connection Diagnostic Report\n';
  output += '================================\n\n';

  results.forEach((result, index) => {
    const icon = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    output += `${index + 1}. ${result.test}\n`;
    output += `   Status: ${icon} ${result.status.toUpperCase()}\n`;
    output += `   Message: ${result.message}\n`;
    output += `   Time: ${result.timestamp}\n`;

    if (result.details) {
      output += `   Details:\n`;
      Object.entries(result.details).forEach(([key, value]) => {
        output += `     - ${key}: ${JSON.stringify(value)}\n`;
      });
    }
    output += '\n';
  });

  return output;
};
