import { WebRTCCallService } from "./CallService";
import { Emitter } from "./EventEmitter";

const WS_URL = "wss://ws.ngrok-free.dev"; // ⚠️ ngrok 每次重启可能会变

// Callback types
type MessageCallback = (data: any) => void;
type ReadReceiptCallback = (data: { chatId: string; readerId: string }) => void;
type PresenceCallback = (data: { userId: string; isOnline: boolean }) => void;
type CallCallback = (data: any) => void;
type TypingIndicatorCallback = (data: { chatId: string; userId: string; isTyping: boolean }) => void;

class WebSocketManager {
  private static instance: WebSocketManager;

  public ws: WebSocket | null = null;
  public callService: WebRTCCallService | null = null;
  private userId: string | null = null;

  private isConnected = false;

  // ===== Reconnect =====
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT = 6;
  private readonly BASE_RECONNECT_DELAY = 2000;

  // ===== Heartbeat =====
  private heartbeatTimer: any = null;
  private lastAliveAt = 0;
  private readonly HEARTBEAT_INTERVAL = 20000; // 20s
  private readonly HEARTBEAT_TIMEOUT = 45000; // 45s

  // ===== Callbacks =====
  private messageCallbacks: MessageCallback[] = [];
  private readReceiptCallbacks: ReadReceiptCallback[] = [];
  private presenceCallbacks: PresenceCallback[] = [];
  private callCallbacks: CallCallback[] = [];
  private typingCallbacks: TypingIndicatorCallback[] = [];

  // ===== Presence =====
  private onlineUsers = new Set<string>();
  private userTimers = new Map<string, NodeJS.Timeout>();
  private readonly OFFLINE_TIMEOUT = 20000;

  // ===== Login control =====
  private loginResolver: ((v: boolean) => void) | null = null;
  private loginTimeout: any = null;

  private constructor() { }

  static getInstance() {
    if (!this.instance) this.instance = new WebSocketManager();
    return this.instance;
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------
  public connect(userId: string): Promise<boolean> {
    if (this.isConnected && this.userId === userId) return Promise.resolve(true);

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return new Promise(resolve => {
        const t = setInterval(() => {
          if (this.isConnected) {
            clearInterval(t);
            resolve(true);
          }
        }, 300);
      });
    }

    this.disconnect();
    this.userId = userId;

    return new Promise((resolve) => {
      this.loginResolver = resolve;
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log("✅ [WS] Opened");
        this.startHeartbeat();
        this.sendLogin();

        this.loginTimeout = setTimeout(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.initializeServices();
            this.loginResolver?.(true);
            this.cleanupLogin();
          }
        }, 1200);
      };

      this.ws.onmessage = (e) => this.handleMessage(e);

      this.ws.onerror = () => {
        console.warn("⚠️ [WS] Error → force close");
        try { this.ws?.close(4001, "WS error"); } catch { }
      };

      this.ws.onclose = (e) => {
        console.warn(`🔌 [WS] Closed code=${e.code}`);
        this.isConnected = false;
        this.stopHeartbeat();
        this.cleanupLogin();
        if (this.userId) this.tryReconnect();
      };
    });
  }

  private tryReconnect() {
    if (this.reconnectAttempts >= this.MAX_RECONNECT) return;
    this.reconnectAttempts++;

    const delay = this.BASE_RECONNECT_DELAY * this.reconnectAttempts;
    console.log(`♻️ [WS] Reconnect ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.userId) this.connect(this.userId);
    }, delay);
  }

  // ---------------------------------------------------------------------------
  // Heartbeat
  // ---------------------------------------------------------------------------
  private startHeartbeat() {
    this.stopHeartbeat();
    this.lastAliveAt = Date.now();

    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      this.safeSend({ msg: "ping", ts: Date.now() });

      if (Date.now() - this.lastAliveAt > this.HEARTBEAT_TIMEOUT) {
        console.warn("⏰ [WS] Heartbeat timeout → reconnect");
        try { this.ws.close(4000, "Heartbeat timeout"); } catch { }
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------
  private safeSend(payload: any) {
    if (!this.ws) return;

    const msg = JSON.stringify(payload);

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else if (this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.addEventListener("open", () => this.ws?.send(msg), { once: true });
    }
  }

  private sendLogin() {
    if (!this.userId) return;
    this.safeSend({ msg: "login", user_id: this.userId });
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      this.lastAliveAt = Date.now();

      // ---- Call signals ----
      if (data.msg === "call_signal" || ["offer", "answer", "candidate", "reject", "end"].includes(data.type)) {
        this.callService?.handleSignal(data);
        this.callCallbacks.forEach(cb => cb(data));
        return;
      }

      // ---- Typing ----
      if (data.type === "typing_signal") {
        this.typingCallbacks.forEach(cb =>
          cb({ chatId: data.chat_id, userId: data.sender_id, isTyping: data.is_typing })
        );
        return;
      }

      // ---- Read receipt ----
      if (data.chat_id && data.reader_id) {
        this.markOnline(data.reader_id);
        this.readReceiptCallbacks.forEach(cb =>
          cb({ chatId: data.chat_id, readerId: data.reader_id })
        );
        return;
      }

      // ---- Chat message ----
      if (data.sender) {
        this.markOnline(data.sender);
        this.messageCallbacks.forEach(cb => cb(data));
      }
    } catch (e) {
      console.error("❌ [WS] Parse error", e);
    }
  }

  // ---------------------------------------------------------------------------
  // Presence
  // ---------------------------------------------------------------------------
  private markOnline(userId: string) {
    if (!userId || userId === this.userId) return;

    const wasOffline = !this.onlineUsers.has(userId);
    this.onlineUsers.add(userId);

    if (this.userTimers.has(userId)) clearTimeout(this.userTimers.get(userId)!);

    const t = setTimeout(() => this.markOffline(userId), this.OFFLINE_TIMEOUT);
    this.userTimers.set(userId, t);

    if (wasOffline) this.presenceCallbacks.forEach(cb => cb({ userId, isOnline: true }));
  }

  private markOffline(userId: string) {
    if (!this.onlineUsers.has(userId)) return;
    this.onlineUsers.delete(userId);
    this.userTimers.delete(userId);
    this.presenceCallbacks.forEach(cb => cb({ userId, isOnline: false }));
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  public disconnect() {
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      try { this.ws.close(1000, "Manual disconnect"); } catch { }
      this.ws = null;
    }

    this.callService?.cleanup?.();
    this.callService = null;

    this.isConnected = false;
    this.userId = null;
    this.reconnectAttempts = 0;

    this.cleanupLogin();
    this.onlineUsers.clear();
    this.userTimers.forEach(t => clearTimeout(t));
    this.userTimers.clear();
  }

  private cleanupLogin() {
    if (this.loginTimeout) {
      clearTimeout(this.loginTimeout);
      this.loginTimeout = null;
    }
    this.loginResolver = null;
  }

  private initializeServices() {
    if (!this.ws || !this.userId) return;
    if (!this.callService) {
      this.callService = new WebRTCCallService(this.ws, this.userId);
    } else {
      this.callService.ws = this.ws;
      this.callService.currentUserId = this.userId;
    }
  }

  // ---------------------------------------------------------------------------
  // Public APIs
  // ---------------------------------------------------------------------------
  public addMessageCallback(cb: MessageCallback) { this.messageCallbacks.push(cb); }
  public removeMessageCallback(cb: MessageCallback) {
    this.messageCallbacks = this.messageCallbacks.filter(x => x !== cb);
  }

  public addReadReceiptCallback(cb: ReadReceiptCallback) { this.readReceiptCallbacks.push(cb); }
  public removeReadReceiptCallback(cb: ReadReceiptCallback) {
    this.readReceiptCallbacks = this.readReceiptCallbacks.filter(x => x !== cb);
  }

  public addTypingIndicatorCallback(cb: TypingIndicatorCallback) { this.typingCallbacks.push(cb); }
  public removeTypingIndicatorCallback(cb: TypingIndicatorCallback) {
    this.typingCallbacks = this.typingCallbacks.filter(x => x !== cb);
  }

  public addCallCallback(cb: CallCallback) { this.callCallbacks.push(cb); }
  public removeCallCallback(cb: CallCallback) {
    this.callCallbacks = this.callCallbacks.filter(x => x !== cb);
  }

  public addPresenceCallback(cb: PresenceCallback) { this.presenceCallbacks.push(cb); }
  public removePresenceCallback(cb: PresenceCallback) {
    this.presenceCallbacks = this.presenceCallbacks.filter(x => x !== cb);
  }
  // ✅ ✅ ✅ 就是少了这个
  public isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }
  public isWebSocketConnected() {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export default WebSocketManager.getInstance();
export { Emitter };
