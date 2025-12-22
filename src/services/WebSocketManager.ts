import config from '../config/api';

const WS_URL = config.WS_URL;

type MessageCallback = (data: any) => void;

class WebSocketManager {
  private static instance: WebSocketManager;

  private ws: WebSocket | null = null;
  private userId: string | null = null;
  private isConnected = false;

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  private messageCallbacks: MessageCallback[] = [];
  private heartbeatTimer: any = null;

  // 👉 login Promise control
  private loginResolver: ((v: boolean) => void) | null = null;
  private loginRejecter: ((e: Error) => void) | null = null;
  private loginTimeoutTimer: any = null;

  private constructor() {}

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /* ===============================
     Connect + Login
  =============================== */
  connect(userId: string): Promise<boolean> {
    if (this.isConnected) {
      return Promise.resolve(true);
    }

    this.userId = userId;

    console.log('=== WebSocket CONNECT ===');
    console.log('User ID:', userId);
    console.log('WS URL:', WS_URL);

    return new Promise((resolve, reject) => {
      this.loginResolver = resolve;
      this.loginRejecter = reject;

      try {
        this.ws = new WebSocket(WS_URL);
      } catch (err) {
        reject(err as Error);
        return;
      }

      /* ---------- OPEN ---------- */
      this.ws.onopen = () => {
        console.log('✅ WS opened');
        this.sendLoginMessage();

        // ⏳ login timeout - 后端登录成功不发送响应，2秒内没收到失败消息就认为成功
        this.loginTimeoutTimer = setTimeout(() => {
          if (!this.isConnected) {
            console.log('✅ Login success (no error received)');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            this.loginResolver?.(true);
            this.cleanupLoginPromise();
          }
        }, 2000);
      };

      /* ---------- MESSAGE ---------- */
      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      /* ---------- ERROR ---------- */
      this.ws.onerror = () => {
        console.error('❌ WebSocket error');
      };

      /* ---------- CLOSE ---------- */
      this.ws.onclose = (event) => {
        console.log('🔌 WS closed:', event.code, event.reason);

        this.isConnected = false;
        this.stopHeartbeat();
        this.cleanupLoginPromise();

        if (event.code !== 1000 && this.userId) {
          this.attemptReconnect();
        }
      };
    });
  }

  /* ===============================
     Login
  =============================== */
  private sendLoginMessage() {
    if (!this.ws || !this.userId) return;

    const payload = {
      msg: 'login',
      user_id: this.userId,
    };

    console.log('📤 login →', payload);
    this.ws.send(JSON.stringify(payload));
  }

  /* ===============================
     Message Handler (SINGLE SOURCE)
  =============================== */
  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      // console.log('📨 WS message:', data);

      /* ---------- IGNORE HEARTBEAT ERROR ---------- */
      // 心跳消息后端不认识，返回错误，直接忽略
      if (data.status === 0 && data.message === 'Connection Establishing Failed.') {
        // console.log('⚠️ Heartbeat error (ignored)');
        return;
      }

      /* ---------- LOGIN SUCCESS (按文档) ---------- */
      if (!this.isConnected && data.type === 1 && data.message === 'Connected') {
        console.log('✅ Login success (from server)');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.loginResolver?.(true);
        this.cleanupLoginPromise();
        return;
      }

      /* ---------- LOGIN FAILED (按文档) ---------- */
      if (!this.isConnected && data.type === 0) {
        console.error('❌ Login failed:', data.message);
        this.loginRejecter?.(new Error(data.message || 'Login failed'));
        this.cleanupLoginPromise();
        return;
      }

      /* ---------- FORWARD ACK (按文档) ---------- */
      // 文档格式: {type: 1, content: "Success"}
      if (data.type === 1 && data.content === 'Success') {
        console.log('✅ Message forwarded (documented format)');
        return;
      }

      // 兼容实际后端格式: {status: 1, message: "Success"}
      if (data.status === 1 && data.message === 'Success') {
        console.log('✅ Message forwarded (backend format)');
        return;
      }

      /* ---------- INCOMING MESSAGE (按文档和实际) ---------- */
      // 文档格式: {type: 1, message: "..."}
      // 实际格式: {status: 1, type: 1, message: "..."}
      if (data.type && data.message && !data.content) {
        console.log('🔔 Incoming message detected, triggering callbacks');
        console.log('Message data:', data);
        console.log('Callbacks count:', this.messageCallbacks.length);
        this.messageCallbacks.forEach((cb, index) => {
          console.log(`Calling callback ${index + 1}`);
          cb(data);
        });
        return;
      }

      /* ---------- FALLBACK ---------- */
      console.log('⚠️ Message not handled by specific conditions, using fallback');
      console.log('Fallback data:', data);
      this.messageCallbacks.forEach(cb => cb(data));

    } catch (err) {
      console.error('❌ WS parse error', err);
    }
  }

  private cleanupLoginPromise() {
    if (this.loginTimeoutTimer) {
      clearTimeout(this.loginTimeoutTimer);
      this.loginTimeoutTimer = null;
    }
    this.loginResolver = null;
    this.loginRejecter = null;
  }

  /* ===============================
     Send Message
  =============================== */
  sendForwardMessage(payload: {
    type: number;
    message: string;
    message_id: string;
    sender: string;
    receiver: string[];
    chat_id: string;
  }): boolean {
    if (!this.ws || !this.isConnected) {
      console.warn('⚠️ WS not connected');
      return false;
    }

    const msg = {
      msg: 'forward',
      ...payload,
    };

    console.log('📤 forward →', msg);
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  /* ===============================
     Logout / Disconnect
  =============================== */
  logout() {
    if (!this.ws || !this.userId) return;

    this.ws.send(JSON.stringify({
      msg: 'logout',
      user_id: this.userId,
    }));

    this.disconnect();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnected = false;
    this.stopHeartbeat();
    this.userId = null;
    this.reconnectAttempts = 0;

    console.log('🔌 WS disconnected');
  }

  /* ===============================
     Reconnect
  =============================== */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnect reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(`🔄 Reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId).catch(() => {});
      }
    }, delay);
  }

  /* ===============================
     Callbacks
  =============================== */
  addMessageCallback(cb: MessageCallback) {
    this.messageCallbacks.push(cb);
  }

  removeMessageCallback(cb: MessageCallback) {
    this.messageCallbacks = this.messageCallbacks.filter(x => x !== cb);
  }

  isWebSocketConnected() {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /* ===============================
     Heartbeat (每20秒发送一次，防止后端30秒超时断开)
  =============================== */
  private startHeartbeat() {
    this.stopHeartbeat(); // 先清除旧的定时器

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.isConnected) {
        console.log('💓 Sending heartbeat');
        this.ws.send(JSON.stringify({ msg: 'ping' }));
      }
    }, 20000); // 每20秒发送一次
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export default WebSocketManager.getInstance();
