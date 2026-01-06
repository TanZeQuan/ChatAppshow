import config from "../config/api";
import { WebRTCCallService } from "./CallService";
import { Emitter } from "./EventEmitter";

// ✅ 新的 WebSocket URL
const WS_URL = "wss://ws.ngrok-free.dev";

type MessageCallback = (data: any) => void;
type ReadReceiptCallback = (data: { chatId: string; readerId: string }) => void;
type PresenceCallback = (data: { userId: string; isOnline: boolean }) => void;
// ✅ New: Definition for call signaling callback
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

  private messageCallbacks: MessageCallback[] = [];
  private readReceiptCallbacks: ReadReceiptCallback[] = [];
  private presenceCallbacks: PresenceCallback[] = [];
  // ✅ New: Array to store call callbacks
  private callCallbacks: CallCallback[] = [];

  // ✅ Online users tracking
  private onlineUsers: Set<string> = new Set();
  private userActivityTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly OFFLINE_TIMEOUT = 20000; 

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
    
    if (this.isConnected && this.userId !== userId) {
      this.disconnect();
    }

    if (this.isConnected && this.userId === userId) {
      return Promise.resolve(true);
    }

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
          if (!this.isConnected) {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.initializeCallService();
            this.loginResolver?.(true);
            this.cleanupLoginPromise();
          }
        }, 2000);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.cleanupLoginPromise();
        if (event.code !== 1000 && this.userId) {
          this.attemptReconnect();
        }
      };
    });
  }

  private initializeCallService() {
    if (this.ws && this.userId) {
      this.callService = new WebRTCCallService(this.ws, this.userId);
    }
  }

  public startCall(targetUserId: string) {
    if (this.callService) {
      this.callService.startCall(targetUserId);
    }
  }

  private sendLoginMessage() {
    if (!this.ws || !this.userId) return;
    const payload = { msg: "login", user_id: this.userId };
    this.ws.send(JSON.stringify(payload));
  }

  /* ===============================
      Message Handler
  =============================== */
  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      console.log("📨 [WebSocket] Received:", data);

      // ✅ Updated: Handle call signals for both CallService (1-on-1) and Group Calls
      if (data.msg === "call_signal") {
        console.log(`📞 Call signal received:`, data.type);
        // 1. Pass to existing 1-on-1 logic
        if (this.callService) {
          this.callService.handleSignal(data);
        }
        // 2. Pass to GroupCallScreen listeners
        this.callCallbacks.forEach(cb => cb(data));
        return;
      }

      if (data.status === 0 && data.message === "Reconnected") {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.initializeCallService();
        this.loginResolver?.(true);
        this.cleanupLoginPromise();
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

      this.messageCallbacks.forEach((cb) => cb(data));
    } catch (err) {
      console.error("❌ WebSocket parse error", err);
    }
  }

  /* ===============================
      Send Call Signal (Updated)
  =============================== */
  public sendCallSignal(payload: {
    // ✅ Updated type definition to include ALL needed types
    type: "JOIN_CALL" | "LEAVE_CALL" | "OFFER" | "ANSWER" | "CANDIDATE" | "offer" | "answer" | "candidate" | "reject" | "end";
    receiver?: string | string[];
    chat_id?: string;
    sender?: string;
    call_type?: 0 | 1;
    call_id?: string;
    payload?: any;
    sdp?: any;
    candidate?: any;
  }): boolean {
    if (!this.ws || !this.isConnected) {
      console.warn("⚠️ WebSocket not connected");
      return false;
    }

    const msg = {
      msg: "call_signal",
      user_id: this.userId!,
      ...payload
    };

    console.log(`📤 [WebSocket] Sending call_signal (${payload.type}):`, JSON.stringify(msg));
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  /* ===============================
      Callbacks (Implemented)
  =============================== */
  // ✅ Implemented: Add listener for group call signals
  public addCallCallback(cb: CallCallback) {
    this.callCallbacks.push(cb);
  }

  // ✅ Implemented: Remove listener
  public removeCallCallback(cb: CallCallback) {
    this.callCallbacks = this.callCallbacks.filter((x) => x !== cb);
  }

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

  /* ===============================
      Other Methods
  =============================== */
  public sendForwardMessage(payload: {
    type: number;
    message: string;
    message_id: string;
    sender: string;
    receiver: string[];
    chat_id: string;
  }): boolean {
    if (!this.ws || !this.isConnected) return false;
    const msg = {
      msg: "forward",
      user_id: this.userId!,
      ...payload
    };
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  public sendReadSignal(payload: {
    receiver: string[];
    chat_id: string;
  }): boolean {
    if (!this.ws || !this.isConnected) return false;
    const msg = {
      msg: "read_signal",
      user_id: this.userId!,
      ...payload
    };
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  public disconnect() {
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
      if (this.userId) {
        this.connect(this.userId).catch(() => {});
      }
    }, delay);
  }

  public isWebSocketConnected() {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

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
    if (wasOffline) {
      this.notifyPresenceChange(userId, true);
    }
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

  public addPresenceCallback(cb: PresenceCallback) {
    this.presenceCallbacks.push(cb);
  }

  public removePresenceCallback(cb: PresenceCallback) {
    this.presenceCallbacks = this.presenceCallbacks.filter((x) => x !== cb);
  }

  private cleanupPresenceTracking() {
    this.userActivityTimers.forEach((timer) => clearTimeout(timer));
    this.userActivityTimers.clear();
    this.onlineUsers.clear();
  }
}

export default WebSocketManager.getInstance();
export { Emitter };