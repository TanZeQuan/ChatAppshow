import config from "../config/api";
import { WebRTCCallService } from "./CallService";
import { Emitter } from "./EventEmitter";


// ✅ 新的 WebSocket URL（根据文档）
const WS_URL = "wss://ws.ngrok-free.dev";

type MessageCallback = (data: any) => void;
type ReadReceiptCallback = (data: { chatId: string; readerId: string }) => void;

class WebSocketManager {
  private static instance: WebSocketManager;

  public ws: WebSocket | null = null;
  public callService: WebRTCCallService | null = null;
  private userId: string | null = null;
  private isConnected = false;

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  private messageCallbacks: MessageCallback[] = [];
  private readReceiptCallbacks: ReadReceiptCallback[] = [];

  // Login Promise control
  private loginResolver: ((v: boolean) => void) | null = null;
  private loginRejecter: ((e: Error) => void) | null = null;
  private loginTimeoutTimer: any = null;

  private constructor() {}

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /* ===============================
     Connect + Login
  =============================== */
  public connect(userId: string): Promise<boolean> {
    console.log('🔌 [WebSocket] connect() called');
    console.log('  - New userId:', userId);
    console.log('  - Current userId:', this.userId);
    console.log('  - isConnected:', this.isConnected);

    // If already connected but userId changed, disconnect first
    if (this.isConnected && this.userId !== userId) {
      console.warn('⚠️ [WebSocket] UserId changed! Disconnecting old connection...');
      this.disconnect();
    }

    // If already connected with same userId, return
    if (this.isConnected && this.userId === userId) {
      console.log('✅ [WebSocket] Already connected with same userId');
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
        console.log("✅ WebSocket opened");
        this.sendLoginMessage();

        // ⏳ Login timeout - 首次连接成功是静默的（2秒内没收到错误就算成功）
        this.loginTimeoutTimer = setTimeout(() => {
          if (!this.isConnected) {
            console.log("✅ Login success (silent - no response from server)");
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.initializeCallService();
            this.loginResolver?.(true);
            this.cleanupLoginPromise();
          }
        }, 2000);
      };

      /* ---------- MESSAGE ---------- */
      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      /* ---------- CLOSE ---------- */
      this.ws.onclose = (event) => {
        console.warn("🔌 WebSocket closed");
        console.warn("Close code:", event.code);
        console.warn("Close reason:", event.reason || 'No reason provided');

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

  private initializeCallService() {
    if (this.ws && this.userId) {
      this.callService = new WebRTCCallService(this.ws, this.userId);
      console.log('✅ [CallService] Initialized');
    } else {
      console.error('❌ [CallService] Failed to initialize: WebSocket or UserId is not available.');
    }
  }

  public startCall(targetUserId: string) {
    if (this.callService) {
      this.callService.startCall(targetUserId);
    } else {
      console.error("Cannot start call, CallService is not initialized.");
    }
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

    console.log("📤 [WebSocket] Sending login:", payload);
    this.ws.send(JSON.stringify(payload));
  }

  /* ===============================
     Message Handler (根据新文档)
  =============================== */
  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      console.log("📨 [WebSocket] Received:", data);

      if (data.msg === "call_signal") {
        console.log(`📞 Call signal received:`, data.type);
        if (this.callService) {
          this.callService.handleSignal(data);
        }
        return;
      }

      /* ---------- RECONNECTION SUCCESS ---------- */
      if (data.status === 0 && data.message === "Reconnected") {
        console.log("✅ Reconnected to WebSocket");
        if (!this.isConnected) {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.initializeCallService();
          this.loginResolver?.(true);
          this.cleanupLoginPromise();
        }
        return;
      }

      /* ---------- LOGIN FAILED ---------- */
      if (data.status === 1 && data.message && data.message.includes("Invalid")) {
        console.error("❌ Login failed:", data.message);
        this.loginRejecter?.(new Error(data.message));
        this.cleanupLoginPromise();
        return;
      }

      /* ---------- FORWARD/READ_SIGNAL ACK ---------- */
      if (data.status === 1 && data.message === "Success") {
        console.log("✅ Operation confirmed (forward/read_signal)");
        return;
      }

      /* ---------- INCOMING MESSAGE ---------- */
      // Format: {status: 1, type: 1, message: "...", chat_id: "...", sender: "..."}
      if (data.status === 1 && data.type && data.message && data.sender) {
        console.log(`📩 New message from ${data.sender} in chat ${data.chat_id}`);
        this.messageCallbacks.forEach((cb) => cb(data));
        return;
      }

      /* ---------- READ RECEIPT ---------- */
      // Format: {status: 1, chat_id: "...", reader_id: "..."}
      if (data.status === 1 && data.chat_id && data.reader_id) {
        console.log(`✔️ User ${data.reader_id} read messages in ${data.chat_id}`);
        this.readReceiptCallbacks.forEach((cb) =>
          cb({ chatId: data.chat_id, readerId: data.reader_id })
        );
        return;
      }

      /* ---------- FALLBACK ---------- */
      console.log("⚠️ Unhandled message:", data);
      this.messageCallbacks.forEach((cb) => cb(data));
    } catch (err) {
      console.error("❌ WebSocket parse error", err);
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
     Send Forward Message (根据新文档)
  =============================== */
  public sendForwardMessage(payload: {
    type: number; // ✅ 改为 number: 1=text, 2=voice, 3=files
    message: string;
    message_id: string; // ✅ Required for delivery tracking
    sender: string;
    receiver: string[];
    chat_id: string;
  }): boolean {
    if (!this.ws || !this.isConnected) {
      console.warn("⚠️ WebSocket not connected");
      return false;
    }

    const msg = {
      msg: "forward",
      user_id: this.userId!, // ✅ 新增：当前用户ID（用于日志）
      type: payload.type,
      message: payload.message,
      sender: payload.sender,
      receiver: payload.receiver,
      chat_id: payload.chat_id,
      message_id: payload.message_id, // ✅ Required
    };

    console.log("📤 [WebSocket] Sending forward:", msg);
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  /* ===============================
     Send Read Signal (新增)
  =============================== */
  public sendReadSignal(payload: {
    receiver: string[];
    chat_id: string;
  }): boolean {
    if (!this.ws || !this.isConnected) {
      console.warn("⚠️ WebSocket not connected");
      return false;
    }

    const msg = {
      msg: "read_signal",
      user_id: this.userId!,
      receiver: payload.receiver,
      chat_id: payload.chat_id,
    };

    console.log("📤 [WebSocket] Sending read_signal:", msg);
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  /* ===============================
     Send Call Signal (新增 - WebRTC)
  =============================== */
  public sendCallSignal(payload: {
    type: "offer" | "answer" | "candidate" | "reject" | "end";
    receiver: string[];
    call_type?: 0 | 1; // 0=Voice, 1=Video
    call_id?: string;
    payload?: any; // SDP or ICE candidate
  }): boolean {
    if (!this.ws || !this.isConnected) {
      console.warn("⚠️ WebSocket not connected");
      return false;
    }

    const msg = {
      msg: "call_signal",
      type: payload.type,
      user_id: this.userId!,
      receiver: payload.receiver,
      call_type: payload.call_type,
      call_id: payload.call_id,
      payload: payload.payload,
    };

    console.log("📤 [WebSocket] Sending call_signal:", msg);
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  /* ===============================
     Logout / Disconnect
  =============================== */
  public disconnect() {
    console.log('🔌 [WebSocket] disconnect() called');

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    if (this.callService) {
      this.callService.cleanup();
      this.callService = null;
    }

    this.isConnected = false;
    this.userId = null;
    this.reconnectAttempts = 0;

    console.log("✅ [WebSocket] Disconnected successfully");
  }

  /* ===============================
     Reconnect
  =============================== */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("❌ Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.warn(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId).catch((error) => {
          console.error("Reconnect failed:", error.message);
        });
      }
    }, delay);
  }

  /* ===============================
     Callbacks
  =============================== */
  public addMessageCallback(cb: MessageCallback) {
    this.messageCallbacks.push(cb);
  }

  public removeMessageCallback(cb: MessageCallback) {
    this.messageCallbacks = this.messageCallbacks.filter((x) => x !== cb);
  }

  public addReadReceiptCallback(cb: ReadReceiptCallback) {
    this.readReceiptCallbacks.push(cb);
  }

  public removeReadReceiptCallback(cb: ReadReceiptCallback) {
    this.readReceiptCallbacks = this.readReceiptCallbacks.filter((x) => x !== cb);
  }

  public isWebSocketConnected() {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  public getCallbackCount() {
    return {
      message: this.messageCallbacks.length,
      readReceipt: this.readReceiptCallbacks.length,
    };
  }
}

export default WebSocketManager.getInstance();
export { Emitter };
