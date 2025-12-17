import { useChatStore } from '../store/chatStore';

const WS_URL = 'wss://ws.ngrok-free.dev';

type MessageCallback = (data: any) => void;

class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: WebSocket | null = null;
  private userId: string | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000;
  private messageCallbacks: MessageCallback[] = [];

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  // Connect and login
  connect(userId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.userId = userId;

      console.log('=== WebSocket Connecting ===');
      console.log('User ID:', userId);
      console.log('WS URL:', WS_URL);
      console.log('⏳ Creating WebSocket connection...');

      try {
        this.ws = new WebSocket(WS_URL);
        console.log('✅ WebSocket object created, waiting for connection...');
      } catch (error) {
        console.error('❌ Failed to create WebSocket:', error);
        reject(error);
        return;
      }

      this.ws.onopen = () => {
        console.log('✅ WebSocket connection opened successfully!');
        console.log('📤 Sending login message...');

        // Send login message
        this.sendLoginMessage();

        // Wait for login response
        const loginTimeout = setTimeout(() => {
          console.warn('Login response timeout');
          reject(new Error('Login timeout'));
        }, 5000);

        const tempHandler = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Login response:', data);

            if (data.message === 'Connected' && data.type === 1) {
              clearTimeout(loginTimeout);
              this.isConnected = true;
              this.reconnectAttempts = 0;
              console.log('✅ WebSocket logged in successfully');
              this.ws?.removeEventListener('message', tempHandler);
              resolve(true);
            } else if (data.type === 0) {
              clearTimeout(loginTimeout);
              console.error('❌ Login failed:', data.message);
              this.ws?.removeEventListener('message', tempHandler);
              reject(new Error(data.message || 'Login failed'));
            }
          } catch (error) {
            console.error('Error parsing login response:', error);
          }
        };

        this.ws?.addEventListener('message', tempHandler);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onerror = (error: any) => {
        // Extract useful info from error event
        console.error('❌ WebSocket error occurred');
        console.error('ReadyState:', error.target?.readyState);
        console.error('URL:', error.target?.url);

        // Don't reject here - wait for onclose to get the real error details
      };

      this.ws.onclose = (event) => {
        console.log('=== WebSocket Closed ===');
        console.log('Close Code:', event.code);
        console.log('Close Reason:', event.reason || '(no reason provided)');
        console.log('Was Clean:', event.wasClean);

        // Explain common close codes
        const closeCodeExplanations: Record<number, string> = {
          1000: 'Normal closure',
          1001: 'Going away (e.g., server going down or browser navigating away)',
          1002: 'Protocol error',
          1003: 'Unsupported data',
          1006: 'Abnormal closure (no close frame received) - Usually network/connection issue',
          1007: 'Invalid frame payload data',
          1008: 'Policy violation',
          1009: 'Message too big',
          1010: 'Missing extension',
          1011: 'Internal server error',
          1015: 'TLS handshake failed',
        };

        const explanation = closeCodeExplanations[event.code];
        if (explanation) {
          console.log('Explanation:', explanation);
        }

        // Common issues and solutions
        if (event.code === 1006) {
          console.log('🔍 Troubleshooting tips:');
          console.log('  - Check if backend WebSocket server is running');
          console.log('  - Verify ngrok tunnel is active: wss://ws.ngrok-free.dev');
          console.log('  - Check network connectivity');
          console.log('  - Ensure firewall allows WebSocket connections');
        }

        this.isConnected = false;

        // Reject the connection promise if this happens during initial connection
        if (event.code !== 1000) {
          reject(new Error(`WebSocket closed with code ${event.code}: ${explanation || event.reason || 'Unknown error'}`));
        }

        // Auto-reconnect if not a normal closure
        if (event.code !== 1000 && this.userId) {
          this.attemptReconnect();
        }
      };
    });
  }

  // Send login message
  private sendLoginMessage() {
    if (!this.ws || !this.userId) return;

    const loginMsg = {
      msg: 'login',
      user_id: this.userId
    };

    console.log('Sending login message:', loginMsg);
    this.ws.send(JSON.stringify(loginMsg));
  }

  // Handle incoming messages
  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);

      // 1. Connection status response (login success)
      if (data.message === 'Connected' && data.type === 1) {
        console.log('✅ Login successful');
        return;
      }

      // 2. Logout success response
      if (data.message === 'Disconnected' && data.type === 1) {
        console.log('✅ Logged out successfully');
        return;
      }

      // 3. Forward success response
      if (data.content === 'Success' && data.type === 1) {
        console.log('✅ Message forwarded successfully');
        return;
      }

      // 4. Forward failed response
      if (data.content === 'Failed.' && data.type === 0) {
        console.error('❌ Message forward failed');
        return;
      }

      // 5. Connection failed response
      if (data.type === 0 && data.message) {
        console.error('❌ Connection/operation failed:', data.message);
        return;
      }

      // 6. Incoming chat message
      // Backend sends: {type: 1, message: "Hello"}
      // This is a simple notification format - we should refresh messages from API
      if (data.type && data.message && !data.content) {
        console.log('📨 New message notification received');

        // Notify callbacks that a new message was received
        // The UI should refresh messages from API when this happens
        this.messageCallbacks.forEach(callback => callback(data));
        return;
      }

      // Notify callbacks for any other message types
      this.messageCallbacks.forEach(callback => callback(data));

    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  // Handle incoming chat message (DEPRECATED - backend sends minimal format)
  // This function is kept for backward compatibility but should not be called
  // with the current backend implementation
  private handleIncomingMessage(data: any) {
    console.log('Incoming message (legacy handler):', data);

    try {
      // Parse message if it's a JSON string
      let messageText = data.message;
      if (typeof messageText === 'string' && messageText.startsWith('{')) {
        try {
          const parsed = JSON.parse(messageText);
          messageText = parsed.message || messageText;
        } catch (e) {
          // Not JSON, use as is
        }
      }

      const chatId = data.chat_id;
      const senderId = data.sender;

      if (!chatId || !messageText) {
        console.warn('Missing chat_id or message in incoming data');
        return;
      }

      // Add message to chat store
      const chatStore = useChatStore.getState();

      // Create message object
      const newMessage = {
        id: data.message_id || String(Date.now()),
        text: messageText,
        createdAt: new Date().toISOString(),
        senderId: senderId,
        name: data.sender_name,
        avatar: data.sender_avatar,
      };

      // Get current messages for this chat
      const currentMessages = chatStore.chats[chatId] || [];

      // Check if message already exists (avoid duplicates)
      const messageExists = currentMessages.some(msg => msg.id === newMessage.id);

      if (!messageExists) {
        // Add message to store
        chatStore.setMessages(chatId, [...currentMessages, newMessage]);

        // Increment unread count if message is not from current user
        if (senderId !== this.userId) {
          chatStore.incrementUnread(chatId);
        }

        console.log('✅ Message added to chat store:', newMessage);
      } else {
        console.log('ℹ️ Message already exists, skipping');
      }
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  // Send forward message (after saving to database)
  sendForwardMessage({
    type,
    message,
    message_id,
    sender,
    receiver,
    chat_id
  }: {
    type: number;
    message: string;
    message_id: string;
    sender: string;
    receiver: string[];
    chat_id: string;
  }): boolean {
    if (!this.ws || !this.isConnected) {
      console.warn('WebSocket not connected, cannot send forward message');
      return false;
    }

    const forwardMsg = {
      msg: 'forward',
      type,
      message,
      message_id,
      sender,
      receiver,
      chat_id
    };

    console.log('Sending forward message:', forwardMsg);
    this.ws.send(JSON.stringify(forwardMsg));
    return true;
  }

  // Logout and disconnect
  logout(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.ws || !this.userId) {
        resolve(false);
        return;
      }

      const logoutMsg = {
        msg: 'logout',
        user_id: this.userId
      };

      console.log('Sending logout message:', logoutMsg);
      this.ws.send(JSON.stringify(logoutMsg));

      // Wait for logout response
      setTimeout(() => {
        this.disconnect();
        resolve(true);
      }, 1000);
    });
  }

  // Force disconnect
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    this.userId = null;
    this.reconnectAttempts = 0;
    console.log('WebSocket disconnected');
  }

  // Attempt reconnection
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId).catch((error) => {
          console.error('Reconnect failed:', error);
        });
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  // Add message callback
  addMessageCallback(callback: MessageCallback) {
    this.messageCallbacks.push(callback);
  }

  // Remove message callback
  removeMessageCallback(callback: MessageCallback) {
    this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
  }

  // Check connection status
  isWebSocketConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  // Get current user ID
  getCurrentUserId(): string | null {
    return this.userId;
  }
}

// Export singleton instance
export default WebSocketManager.getInstance();
