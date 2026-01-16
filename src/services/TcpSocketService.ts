/**
 * TcpSocketService.ts
 * 
 * TCP Socket 管理服务 (Port 9502)
 * 
 * ⚠️ 按需连接：
 * - 只在发起或接收通话时才连接
 * - 通话结束后立即断开
 * - 聊天、通知等功能使用 WebSocket (9501)
 * 
 * 通话流程：
 * 1. Caller: 获取 call_id -> 发送 call 命令
 * 2. Callee: 收到通知 -> 发送 accept 命令
 * 3. Both: 通过 signal 命令交换 SDP/ICE
 * 4. End: 发送 end 命令 -> 断开连接
 */

// TCP Socket URL
const TCP_SOCKET_URL = 'wss://tcps.ngrok-free.dev';

const TAG = '[TCP]';

// 消息类型
export type TcpMessageType = 'call' | 'accept' | 'signal' | 'end' | 'drop';

// TCP 信令类型 (仅用于 WebRTC 数据交换)
// 注意：reject/end 通过 WebSocket 发送，不在 TCP signal 中
export type SignalType = 'offer' | 'answer' | 'candidate';

// TCP 消息接口
export interface TcpMessage {
  msg: TcpMessageType;
  user_id: string;
  room_id: string;
  type?: SignalType;
  payload?: any;
}

// 服务器响应接口
export interface TcpServerMessage {
  msg: string;
  user_id?: string;
  room_id?: string;
  type?: SignalType;
  payload?: any;
  [key: string]: any;
}

// 回调类型
type MessageCallback = (data: TcpServerMessage) => void;
type ConnectionCallback = (connected: boolean) => void;

class TcpSocketService {
  private static instance: TcpSocketService;

  private ws: WebSocket | null = null;
  private userId: string | null = null;
  private roomId: string | null = null;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;

  // 回调队列
  private messageCallbacks: MessageCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];

  // 重连控制
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 2000;

  // 消息队列（连接中时暂存）
  private pendingMessages: string[] = [];

  private constructor() {}

  public static getInstance(): TcpSocketService {
    if (!TcpSocketService.instance) {
      TcpSocketService.instance = new TcpSocketService();
    }
    return TcpSocketService.instance;
  }

  /**
   * 连接 TCP Socket
   */
  public connect(userId: string, roomId: string): Promise<boolean> {
    console.log(`${TAG} 连接 roomId:`, roomId);

    if (this.isConnected && this.roomId === roomId) {
      return Promise.resolve(true);
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.isConnected) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(this.isConnected);
        }, 10000);
      });
    }

    if (this.ws && this.roomId !== roomId) {
      this.disconnect();
    }

    this.userId = userId;
    this.roomId = roomId;
    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(TCP_SOCKET_URL);

        this.ws.onopen = () => {
          console.log(`${TAG} ✅ 连接成功`);
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.notifyConnectionChange(true);
          this.flushPendingMessages();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          console.log(`${TAG} 连接关闭 code:`, event.code);
          this.isConnected = false;
          this.isConnecting = false;
          this.notifyConnectionChange(false);
          if (event.code !== 1000 && this.roomId) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error(`${TAG} 错误:`, error);
          this.isConnecting = false;
          if (!this.isConnected) {
            reject(new Error('TCP Socket connection failed'));
          }
        };

      } catch (error) {
        console.error(`${TAG} 创建失败:`, error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * 断开 TCP Socket 连接
   */
  public disconnect(): void {
    console.log(`${TAG} 断开连接`);

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Call ended');
      }
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.userId = null;
    this.roomId = null;
    this.reconnectAttempts = 0;
    this.pendingMessages = [];
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data: TcpServerMessage = JSON.parse(event.data);
      // 显示完整的服务器响应，方便调试
      console.log(`${TAG} 收到:`, JSON.stringify(data));
      this.messageCallbacks.forEach(cb => cb(data));
    } catch (error) {
      console.error(`${TAG} 解析失败:`, error, event.data);
    }
  }

  /**
   * 安全发送消息
   */
  private safeSend(message: string): boolean {
    if (!this.ws) {
      return false;
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(message);
        return true;
      } catch (error) {
        console.error(`${TAG} 发送失败:`, error);
        return false;
      }
    } else if (this.ws.readyState === WebSocket.CONNECTING) {
      this.pendingMessages.push(message);
      return true;
    }
    return false;
  }

  /**
   * 发送待发消息
   */
  private flushPendingMessages(): void {
    if (this.pendingMessages.length > 0) {
      this.pendingMessages.forEach(msg => this.ws?.send(msg));
      this.pendingMessages = [];
    }
  }

  /**
   * 尝试重连
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    if (!this.userId || !this.roomId) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    console.log(`${TAG} 重连 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    setTimeout(() => {
      if (this.userId && this.roomId) {
        this.connect(this.userId, this.roomId).catch(() => {});
      }
    }, delay);
  }

  /**
   * 通知连接状态变化
   */
  private notifyConnectionChange(connected: boolean): void {
    this.connectionCallbacks.forEach(cb => cb(connected));
  }

  // ========== 通话命令 ==========

  /**
   * 发送 call 命令 (Caller 发起通话)
   */
  public sendCall(userId: string, roomId: string): boolean {
    const msg = { msg: 'call', user_id: userId, room_id: roomId };
    console.log(`${TAG} 发送:`, JSON.stringify(msg));
    return this.safeSend(JSON.stringify(msg));
  }

  /**
   * 发送 accept 命令 (Callee 接听)
   */
  public sendAccept(userId: string, roomId: string): boolean {
    const msg = { msg: 'accept', user_id: userId, room_id: roomId };
    console.log(`${TAG} 发送:`, JSON.stringify(msg));
    return this.safeSend(JSON.stringify(msg));
  }

  /**
   * 发送 signal 命令 (WebRTC 信令)
   */
  public sendSignal(userId: string, roomId: string, type: SignalType, payload: any): boolean {
    const msg = { msg: 'signal', user_id: userId, room_id: roomId, type, payload };
    console.log(`${TAG} 发送 signal:`, type);
    return this.safeSend(JSON.stringify(msg));
  }

  /**
   * 发送 end 命令 (结束整个通话 - Host 用)
   * 注意：根据 API 规范，end 不需要 user_id
   */
  public sendEnd(userId: string, roomId: string): boolean {
    const msg = { msg: 'end', room_id: roomId };
    console.log(`${TAG} 发送:`, JSON.stringify(msg));
    return this.safeSend(JSON.stringify(msg));
  }

  /**
   * 发送 drop 命令 (离开通话但不结束 - 群聊成员用)
   */
  public sendDrop(userId: string, roomId: string): boolean {
    const msg = { msg: 'drop', room_id: roomId, user_id: userId };
    console.log(`${TAG} 发送:`, JSON.stringify(msg));
    return this.safeSend(JSON.stringify(msg));
  }

  // ========== 回调管理 ==========

  public addMessageCallback(cb: MessageCallback): void {
    this.messageCallbacks.push(cb);
  }

  public removeMessageCallback(cb: MessageCallback): void {
    this.messageCallbacks = this.messageCallbacks.filter(x => x !== cb);
  }

  public addConnectionCallback(cb: ConnectionCallback): void {
    this.connectionCallbacks.push(cb);
  }

  public removeConnectionCallback(cb: ConnectionCallback): void {
    this.connectionCallbacks = this.connectionCallbacks.filter(x => x !== cb);
  }

  // ========== 状态查询 ==========

  public isSocketConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  public getCurrentRoomId(): string | null {
    return this.roomId;
  }

  public getCurrentUserId(): string | null {
    return this.userId;
  }
}

export default TcpSocketService.getInstance();

