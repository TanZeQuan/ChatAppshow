import { UnifiedCallService } from "./UnifiedCallService";
import { Emitter } from "./EventEmitter";

const WS_URL = "wss://ws.ngrok-free.dev"; // ⚠️ 请确保这个地址是有效的，ngrok 每次重启都会变

// 定义回调类型
type MessageCallback = (data: any) => void;
type ReadReceiptCallback = (data: { chatId: string; readerId: string }) => void;
type PresenceCallback = (data: { userId: string; isOnline: boolean }) => void;
type CallCallback = (data: any) => void;
type TypingIndicatorCallback = (data: { chatId: string; userId: string; isTyping: boolean }) => void;

class WebSocketManager {
  private static instance: WebSocketManager;

  public ws: WebSocket | null = null;
  public callService: UnifiedCallService | null = null;
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
  private typingIndicatorCallbacks: TypingIndicatorCallback[] = [];

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

  // ✅ 修复 1: 智能发送。如果正在连接中(State 0)，自动放入等待队列
  private safeSend(message: string) {
    if (!this.ws) {
      console.warn("⚠️ [WebSocket] Cannot send: WebSocket instance is null");
      return;
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(message);
      } catch (error) {
        console.error("❌ [WebSocket] Send failed:", error);
      }
    } else if (this.ws.readyState === WebSocket.CONNECTING) {
      // 关键修复：如果在连接中，监听一次 'open' 事件，连接成功后自动补发
      console.log("⏳ [WebSocket] Connection presumed in progress, queuing message...");
      const sendWhenOpen = () => {
        this.ws?.send(message);
        console.log("✅ [WebSocket] Queued message sent successfully");
      };
      this.ws.addEventListener('open', sendWhenOpen, { once: true });
    } else {
      console.warn("⚠️ [WebSocket] Cannot send. Socket State:", this.ws.readyState);
    }
  }

  // Connect + Login
  public connect(userId: string): Promise<boolean> {
    console.log('🔌 [WebSocket] connect() called for:', userId);

    if (this.isConnected && this.userId === userId) return Promise.resolve(true);
    // 如果已经在连接中且是同一个用户，避免重复创建
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING && this.userId === userId) {
      console.log('⏳ [WebSocket] Connection already connecting...');
      return new Promise((resolve) => {
        // 简单的等待逻辑，复用当前的连接过程
        const check = setInterval(() => {
          if (this.isConnected) { clearInterval(check); resolve(true); }
        }, 500);
      });
    }

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
        // 这里的 sendLoginMessage 会触发 safeSend，现在 safeSend 即使状态不稳定也很安全
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
    });
  }

  // ✅ 确保 UnifiedCallService 总是使用最新的 WebSocket 连接
  private initializeServices() {
    if (this.ws && this.userId) {
      if (!this.callService) {
        this.callService = new UnifiedCallService(this.ws, this.userId);
      } else {
        this.callService.ws = this.ws;
        this.callService.currentUserId = this.userId;
      }
    }
  }

  // 发起呼叫 (由 UI 触发)
  public startCall(
    targetUserId: string,
    userName: string,
    avatar: string,
    chatId?: string,
    callId?: string  // 新增 call_id 参数 (TCP 房间 ID)
  ) {
    if (this.callService) {
      this.callService.startCall(targetUserId, userName, avatar, chatId, callId);
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
        const payload = data.payload || {};
        const callMode = payload.call_mode || data.call_mode;

        if (this.callService && callMode !== 'group') {
          this.callService.handleSignal(normalizedData);
        }

        this.callCallbacks.forEach(cb => cb(normalizedData));
        return;
      }

      if (data.status === 1 && data.type && data.message && data.sender) {
        this.markUserOnline(data.sender);
        this.messageCallbacks.forEach((cb) => cb(data));
        return;
      }

      if (data.status === 1 && data.type === 'typing_signal' && data.chat_id && data.sender_id) {
        this.typingIndicatorCallbacks.forEach((cb) =>
          cb({
            chatId: data.chat_id,
            userId: data.sender_id,
            isTyping: data.is_typing,
          })
        );
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

  // ✅ 确保 receiver 是数组
  public sendCallSignal(payload: {
    type: "offer" | "answer" | "candidate" | "reject" | "end" | "JOIN_CALL" | "LEAVE_CALL" | "PEER_JOIN";
    receiver?: string[] | string;
    chat_id?: string;
    sender?: string;
    call_type?: 0 | 1;
    call_id?: string;
    call_mode?: 'group' | 'single';
    payload?: any;
  }): boolean {
    if (!this.ws) return false;
    // 注意：这里去掉了 !this.isConnected 判断，交给 safeSend 处理排队逻辑，提高成功率

    let receivers: string[] = [];
    if (Array.isArray(payload.receiver)) {
      receivers = payload.receiver;
    } else if (typeof payload.receiver === 'string') {
      receivers = [payload.receiver];
    }

    const msg = {
      msg: "call_signal",
      user_id: this.userId!,
      ...payload,
      receiver: receivers
    };

    console.log(`📤 [WebSocket] Sending signal (${payload.type}) to ${receivers.length} receivers`);
    this.safeSend(JSON.stringify(msg));
    return true;
  }

  public sendForwardMessage(payload: any): boolean {
    if (!this.ws) return false;
    const msg = { msg: "forward", user_id: this.userId!, ...payload };
    this.safeSend(JSON.stringify(msg));
    return true;
  }

  public sendReadSignal(payload: any): boolean {
    if (!this.ws) return false;
    const msg = { msg: "read_signal", user_id: this.userId!, ...payload };
    this.safeSend(JSON.stringify(msg));
    return true;
  }

  public sendTypingSignal(payload: { chat_id: string; receiver: string[]; is_typing: boolean }): boolean {
    if (!this.ws) return false;
    const msg = { msg: "typing_signal", user_id: this.userId!, ...payload };
    this.safeSend(JSON.stringify(msg));
    return true;
  }

  public disconnect() {
    console.log("🧹 [WebSocket] Performing full cleanup/disconnect...");

    // 1. 关闭物理连接
    if (this.ws) {
      // 移除所有监听器，防止关闭时的回调触发重连逻辑
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;

      this.ws.close(1000, "User logout / Switch account");
      this.ws = null;
    }

    // 2. 清理 WebRTC 服务 (关键！)
    if (this.callService) {
      if (typeof (this.callService as any).cleanup === 'function') {
        (this.callService as any).cleanup();
      }
      this.callService = null;
    }

    // 3. 重置所有状态变量
    this.isConnected = false;
    this.userId = null;
    this.reconnectAttempts = 0; // 重置重连次数

    // 4. 清理定时器
    this.cleanupLoginPromise();
    this.cleanupPresenceTracking();

    // 5. (可选) 如果你希望切换账号后，旧的UI回调也失效，可以清空回调数组
    // 但通常建议保留回调，因为 React 组件卸载时会自己 removeCallback
    // this.messageCallbacks = []; 
    // this.callCallbacks = [];

    console.log("✨ [WebSocket] Cleanup finished. Ready for new user.");
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
    console.log(`♻️ Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
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
  public addTypingIndicatorCallback(cb: TypingIndicatorCallback) { this.typingIndicatorCallbacks.push(cb); }
  public removeTypingIndicatorCallback(cb: TypingIndicatorCallback) { this.typingIndicatorCallbacks = this.typingIndicatorCallbacks.filter((x) => x !== cb); }
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