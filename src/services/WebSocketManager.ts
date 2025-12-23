import config from "../config/api";

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

    console.log("WebSocket CONNECT User ID:", userId);
    console.log("WebSocket CONNECT WS URL:", WS_URL);

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
        console.log("✅ WS opened");
        this.sendLoginMessage();

        // ⏳ login timeout - 后端登录成功不发送响应，2秒内没收到失败消息就认为成功
        this.loginTimeoutTimer = setTimeout(() => {
          if (!this.isConnected) {
            console.log("✅ Login success (no error received)");
            this.isConnected = true;
            this.reconnectAttempts = 0;
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
      this.ws.onerror = (error: any) => {
        console.error("❌ WebSocket error occurred");
        console.error("Error details:", error?.message || 'No error message available');
        console.error("Connection URL:", WS_URL);
        console.error("User ID:", this.userId);
        console.error("Is Connected:", this.isConnected);

        // Don't reject the promise here, let onclose handle it
        // This prevents duplicate error handling
      };

      /* ---------- CLOSE ---------- */
      this.ws.onclose = (event) => {
        console.warn("🔌 WebSocket closed");
        console.warn("Close code:", event.code);
        console.warn("Close reason:", event.reason || 'No reason provided');
        console.warn("Was clean:", event.wasClean);

        this.isConnected = false;
        this.cleanupLoginPromise();

        // If not a normal closure and user is set, attempt reconnect
        if (event.code !== 1000 && this.userId) {
          console.warn("Abnormal closure, will attempt reconnect...");
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
      msg: "login",
      user_id: this.userId,
    };

    this.ws.send(JSON.stringify(payload));
  }

  /* ===============================
     Message Handler (SINGLE SOURCE)
  =============================== */
  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      /* ---------- LOGIN SUCCESS (按文档) ---------- */
      if (
        !this.isConnected &&
        data.type === 1 &&
        data.message === "Connected"
      ) {
        console.log("✅ Login success (from server)");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.loginResolver?.(true);
        this.cleanupLoginPromise();
        return;
      }

      /* ---------- LOGIN FAILED (按文档) ---------- */
      if (!this.isConnected && data.type === 0) {
        console.error("❌ Login failed:", data.message);
        this.loginRejecter?.(new Error(data.message || "Login failed"));
        this.cleanupLoginPromise();
        return;
      }

      /* ---------- FORWARD ACK (按文档) ---------- */
      // 文档格式: {type: 1, content: "Success"}
      if (data.type === 1 && data.content === "Success") {
        // console.log("✅ Message forwarded (documented format)");
        // return;
      }

      // 兼容实际后端格式: {status: 1, message: "Success"}
      if (data.status === 1 && data.message === "Success") {
        // console.log("✅ Message forwarded (backend format)");
        return;
      }

      // 🔧 Fix: Check for exact "Success" message to avoid treating ACK as chat message
      if (data.type === 1 && data.message === "Success") {
        return;
      }

      /* ---------- INCOMING MESSAGE (按文档和实际) ---------- */
      // 后端消息格式: {type: 1, message: "...", status: 1, ...}
      // type 是数字: 1=文本, 2=图片等
      // 只要有 type 和 message 就是聊天消息
      if (data.type && data.message) {
        this.messageCallbacks.forEach((cb, index) => {
          cb(data);
        });
        return;
      }

      /* ---------- FALLBACK ---------- */
      this.messageCallbacks.forEach((cb) => cb(data));
    } catch (err) {
      console.error("❌ WS parse error", err);
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
    type: "chat";
    message: string;
    message_id: string;
    sender: string;
    receiver: string[];
    chat_id: string;
  }): boolean {
    if (!this.ws || !this.isConnected) {
      console.warn("⚠️ WS not connected");
      return false;
    }

    const msg = {
      msg: "forward",
      ...payload,
    };

    this.ws.send(JSON.stringify(msg));
    return true;
  }

  /* ===============================
     Logout / Disconnect
  =============================== */

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.isConnected = false;
    this.userId = null;
    this.reconnectAttempts = 0;

    console.log("🔌 WS disconnected");
  }

  /* ===============================
     Reconnect
  =============================== */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("❌ Max reconnect attempts reached. Please check your network connection.");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.warn(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.userId) {
        console.log(`Attempting to reconnect for user: ${this.userId}`);
        this.connect(this.userId).catch((error) => {
          console.error("Reconnect failed:", error.message);
        });
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
    const beforeLength = this.messageCallbacks.length;
    this.messageCallbacks = this.messageCallbacks.filter((x) => x !== cb);
    const afterLength = this.messageCallbacks.length;
  }

  isWebSocketConnected() {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  // Debug method to check callback count
  getCallbackCount() {
    return this.messageCallbacks.length;
  }
}

export default WebSocketManager.getInstance();
