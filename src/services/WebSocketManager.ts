import { WebRTCCallService } from "./CallService";
import { Emitter } from "./EventEmitter";

const WS_URL = "wss://ws.ngrok-free.dev";

// 定义回调类型
type MessageCallback = (data: any) => void;
type ReadReceiptCallback = (data: { chatId: string; readerId: string }) => void;
type PresenceCallback = (data: { userId: string; isOnline: boolean }) => void;
type CallCallback = (data: any) => void;

class WebSocketManager {
  private static instance: WebSocketManager;

  public ws: WebSocket | null = null;
  public callService: WebRTCCallService | null = null;
  private userId: string | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  // 回调队列
  private messageCallbacks: MessageCallback[] = [];
  private readReceiptCallbacks: ReadReceiptCallback[] = [];
  private presenceCallbacks: PresenceCallback[] = [];
  private callCallbacks: CallCallback[] = [];

  // 在线状态追踪
  private onlineUsers: Set<string> = new Set();
  private userActivityTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly OFFLINE_TIMEOUT = 20000;

  // 登录控制
  private loginResolver: ((v: boolean) => void) | null = null;
  private loginRejecter: ((e: Error) => void) | null = null;
  private loginTimeoutTimer: any = null;

  private constructor() { }

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  private safeSend(message: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(message);
      } catch (error) {
        console.error("❌ [WebSocket] Send failed:", error);
      }
    } else {
      console.warn("⚠️ [WebSocket] Cannot send. Socket State:", this.ws?.readyState);
    }
  }

  // Connect + Login
  public connect(userId: string): Promise<boolean> {
    console.log('🔌 [WebSocket] connect() called for:', userId);

    if (this.isConnected && this.userId === userId) return Promise.resolve(true);
    if (this.userId && this.userId !== userId) this.disconnect();

    this.userId = userId;

    return new Promise((resolve, reject) => {
      this.loginResolver = resolve;
      this.loginRejecter = reject;

      try {
        this.ws = new WebSocket(WS_URL);
      } catch (err) {
        reject(err as Error);
        return;
      }

      this.ws.onopen = () => {
        console.log("✅ WebSocket opened");
        this.sendLoginMessage();

        this.loginTimeoutTimer = setTimeout(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            console.log("🚀 [WebSocket] Silent login presumed success");
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.initializeServices();
            this.loginResolver?.(true);
            this.cleanupLoginPromise();
          }
        }, 1500);
      };

      this.ws.onmessage = (event) => this.handleMessage(event);

      this.ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed code=${event.code}`);
        this.isConnected = false;
        this.cleanupLoginPromise();
        if (event.code !== 1000 && this.userId) this.attemptReconnect();
      };

      this.ws.onerror = (error) => console.error("❌ WebSocket error:", error);
    });
  }

  private initializeServices() {
    if (this.ws && this.userId) {
      if (!this.callService) {
        this.callService = new WebRTCCallService(this.ws, this.userId);
      }
    }
  }

  public startCall(
    targetUserId: string,
    userName: string,
    avatar: string
  ) {
    if (this.callService) {
      this.callService.startCall(targetUserId, userName, avatar);
    }
  }

  private sendLoginMessage() {
    if (!this.ws || !this.userId) return;
    const payload = { msg: "login", user_id: this.userId };
    this.safeSend(JSON.stringify(payload));
  }

  // ✅ 核心消息处理逻辑
  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      console.log("📨 [WebSocket] Received:", data);

      if (data.status === 0 && data.message === "Reconnected") {
        console.log("✅ Reconnected confirmed by server");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.initializeServices();
        this.loginResolver?.(true);
        this.cleanupLoginPromise();
        return;
      }

      const isCallSignal =
        data.msg === "call_signal" ||
        (data.type && ["offer", "answer", "candidate", "reject", "end", "JOIN_CALL", "LEAVE_CALL", "PEER_JOIN"].includes(data.type));

      if (isCallSignal) {
        console.log(`📞 Call signal routed:`, data.type);
        const normalizedData = { msg: "call_signal", ...data };

        // ✅ 提取 payload 里的 call_mode
        const payload = data.payload || {};
        const callMode = payload.call_mode; // 从 payload 里取！

        // ✅ 只有不是 'group' 的时候，才发给单聊服务
        if (this.callService && callMode !== 'group') {
          this.callService.handleSignal(normalizedData);
        }

        // 所有的信号依然发给 UI (群聊需要这个)
        this.callCallbacks.forEach(cb => cb(normalizedData));
        return;
      }

      if (data.status === 1 && data.type && data.message && data.sender) {
        this.markUserOnline(data.sender);
        this.messageCallbacks.forEach((cb) => cb(data));
        return;
      }

      if (data.status === 1 && data.chat_id && data.reader_id) {
        this.markUserOnline(data.reader_id);
        this.readReceiptCallbacks.forEach((cb) =>
          cb({ chatId: data.chat_id, readerId: data.reader_id })
        );
        return;
      }

      if (data.status === 1 && data.message === "Success") return;

      this.messageCallbacks.forEach((cb) => cb(data));
    } catch (err) {
      console.error("❌ WebSocket parse error", err);
    }
  }

  // ✅ 发送方法 (支持 call_mode)
  public sendCallSignal(payload: {
    type: "offer" | "answer" | "candidate" | "reject" | "end" | "JOIN_CALL" | "LEAVE_CALL" | "PEER_JOIN";
    receiver?: string[];
    chat_id?: string;
    sender?: string;
    call_type?: 0 | 1;
    call_id?: string;
    call_mode?: 'group' | 'single'; // ✅ 新增
    payload?: any;
  }): boolean {
    if (!this.ws || !this.isConnected) return false;

    const msg = {
      msg: "call_signal",
      user_id: this.userId!,
      ...payload
    };

    console.log(`📤 [WebSocket] Sending signal (${payload.type})`);
    this.safeSend(JSON.stringify(msg));
    return true;
  }

  public sendForwardMessage(payload: any): boolean {
    if (!this.ws || !this.isConnected) return false;
    const msg = { msg: "forward", user_id: this.userId!, ...payload };
    this.safeSend(JSON.stringify(msg));
    return true;
  }

  public sendReadSignal(payload: any): boolean {
    if (!this.ws || !this.isConnected) return false;
    const msg = { msg: "read_signal", user_id: this.userId!, ...payload };
    this.safeSend(JSON.stringify(msg));
    return true;
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    if (this.callService) {
      if (typeof (this.callService as any).cleanup === 'function') {
        (this.callService as any).cleanup();
      }
      this.callService = null;
    }
    this.isConnected = false;
    this.userId = null;
    this.cleanupLoginPromise();
    this.cleanupPresenceTracking();
  }

  private cleanupLoginPromise() {
    if (this.loginTimeoutTimer) {
      clearTimeout(this.loginTimeoutTimer);
      this.loginTimeoutTimer = null;
    }
    this.loginResolver = null;
    this.loginRejecter = null;
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    setTimeout(() => {
      if (this.userId) this.connect(this.userId).catch(() => { });
    }, delay);
  }

  // Callbacks & Presence ... (省略标准代码)
  public addCallCallback(cb: CallCallback) { this.callCallbacks.push(cb); }
  public removeCallCallback(cb: CallCallback) { this.callCallbacks = this.callCallbacks.filter((x) => x !== cb); }
  public addMessageCallback(cb: MessageCallback) { this.messageCallbacks.push(cb); }
  public removeMessageCallback(cb: MessageCallback) { this.messageCallbacks = this.messageCallbacks.filter((x) => x !== cb); }
  public addReadReceiptCallback(cb: ReadReceiptCallback) { this.readReceiptCallbacks.push(cb); }
  public removeReadReceiptCallback(cb: ReadReceiptCallback) { this.readReceiptCallbacks = this.readReceiptCallbacks.filter((x) => x !== cb); }
  public isUserOnline(userId: string): boolean { return this.onlineUsers.has(userId); }

  private markUserOnline(userId: string) {
    if (!userId || userId === this.userId) return;
    const wasOffline = !this.onlineUsers.has(userId);
    this.onlineUsers.add(userId);
    const existingTimer = this.userActivityTimers.get(userId);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
      this.markUserOffline(userId);
    }, this.OFFLINE_TIMEOUT);
    this.userActivityTimers.set(userId, timer);
    if (wasOffline) this.notifyPresenceChange(userId, true);
  }

  private markUserOffline(userId: string) {
    if (!this.onlineUsers.has(userId)) return;
    this.onlineUsers.delete(userId);
    this.userActivityTimers.delete(userId);
    this.notifyPresenceChange(userId, false);
  }

  private notifyPresenceChange(userId: string, isOnline: boolean) {
    this.presenceCallbacks.forEach((cb) => cb({ userId, isOnline }));
  }

  public addPresenceCallback(cb: PresenceCallback) { this.presenceCallbacks.push(cb); }
  public removePresenceCallback(cb: PresenceCallback) { this.presenceCallbacks = this.presenceCallbacks.filter((x) => x !== cb); }
  public isWebSocketConnected(): boolean { return this.isConnected && this.ws?.readyState === WebSocket.OPEN; }
  private cleanupPresenceTracking() {
    this.userActivityTimers.forEach((timer) => clearTimeout(timer));
    this.userActivityTimers.clear();
    this.onlineUsers.clear();
  }
}

export default WebSocketManager.getInstance();
export { Emitter };