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

  // ✅ 核心修复 1: 确保 WebRTCCallService 总是使用最新的 WebSocket 连接
  private initializeServices() {
    if (this.ws && this.userId) {
      if (!this.callService) {
        // 第一次创建
        this.callService = new WebRTCCallService(this.ws, this.userId);
      } else {
        // ✅ 关键：如果已经存在，必须更新它的 WebSocket 引用！
        // 否则重连后，CallService 依然拿着旧的断开的 ws 实例，发不出 offer
        this.callService.ws = this.ws;
        this.callService.currentUserId = this.userId;
      }
    }
  }

  // 发起呼叫 (由 UI 触发)
  public startCall(
    targetUserId: string,
    userName: string,
    avatar: string
  ) {
    if (this.callService) {
      // 确保 CallService 将这些信息放入 payload
      this.callService.startCall(targetUserId, userName, avatar);
    } else {
      console.warn("⚠️ CallService not initialized, cannot start call");
    }
  }

  private sendLoginMessage() {
    if (!this.ws || !this.userId) return;
    const payload = { msg: "login", user_id: this.userId };
    this.safeSend(JSON.stringify(payload));
  }

  // ✅ 消息分发逻辑
  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      console.log("📨 [WebSocket] Received:", data);

      if (data.status === 0 && data.message === "Reconnected") {
        console.log("✅ Reconnected confirmed by server");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.initializeServices(); // 这里会更新 CallService 的 socket
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

        // 提取 call_mode (优先从 payload 取，兼容性好)
        const payload = data.payload || {};
        const callMode = payload.call_mode || data.call_mode;

        // ✅ 只有明确不是 group 时，才让单聊服务处理
        // 这样可以防止单聊服务处理群聊信号导致的报错
        if (this.callService && callMode !== 'group') {
          this.callService.handleSignal(normalizedData);
        }

        // 无论单聊群聊，都发给 UI 层 (App.tsx / GroupCallScreen)
        // App.tsx 会根据 type='offer' 且 call_mode!='group' 来决定是否弹窗
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

  // ✅ 核心修复 2: 确保 receiver 是数组，防止服务器丢弃
  public sendCallSignal(payload: {
    type: "offer" | "answer" | "candidate" | "reject" | "end" | "JOIN_CALL" | "LEAVE_CALL" | "PEER_JOIN";
    receiver?: string[] | string; // 允许传入字符串，但发送时转为数组
    chat_id?: string;
    sender?: string;
    call_type?: 0 | 1;
    call_id?: string;
    call_mode?: 'group' | 'single';
    payload?: any;
  }): boolean {
    if (!this.ws || !this.isConnected) return false;

    // 1. 规范化 receiver
    let receivers: string[] = [];
    if (Array.isArray(payload.receiver)) {
      receivers = payload.receiver;
    } else if (typeof payload.receiver === 'string') {
      receivers = [payload.receiver];
    }

    // 2. 构造消息
    const msg = {
      msg: "call_signal",
      user_id: this.userId!,
      ...payload,
      receiver: receivers // 强制覆盖为数组
    };

    console.log(`📤 [WebSocket] Sending signal (${payload.type}) to ${receivers.length} receivers`);
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

  // Callbacks ...
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