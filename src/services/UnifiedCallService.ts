/**
 * UnifiedCallService.ts
 * 
 * 统一通话服务 - 支持私聊（单人）和群聊（多人 Mesh）
 * 
 * 架构说明：
 * - 单人模式：1 个 RTCPeerConnection
 * - 多人模式：N 个 RTCPeerConnection（Mesh 网络，每人之间都有独立连接）
 * 
 * 信令传输：
 * - offer: 必须通过 WebSocket (9501) 发送（因为被叫方还没连接 TCP）
 * - answer/candidate/end: 优先 TCP Socket (9502)，备用 WebSocket
 */

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { Emitter } from './EventEmitter';
import TcpSocketService from './TcpSocketService';

// ICE 服务器配置
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// 通话模式
export type CallMode = 'single' | 'group';

// Peer 连接信息
interface PeerInfo {
  pc: RTCPeerConnection;
  remoteStream: MediaStream | null;
  candidateQueue: RTCIceCandidate[];
}

// 回调类型
export type OnRemoteStreamCallback = (userId: string, stream: MediaStream) => void;
export type OnPeerLeftCallback = (userId: string) => void;
export type OnStatusChangeCallback = (status: string) => void;

export class UnifiedCallService {
  // WebSocket 引用（由 WebSocketManager 注入）
  public ws: WebSocket;
  public currentUserId: string;

  // 通话状态
  private mode: CallMode = 'single';
  private chatId: string | null = null;
  private callId: string | null = null;
  
  // 本地媒体流
  private localStream: MediaStream | null = null;
  
  // Peer 连接管理（支持多人）
  private peers: Map<string, PeerInfo> = new Map();
  
  // 单人模式兼容（主要用于来电处理）
  private targetUserId: string | null = null;
  private pendingOffer: any = null;

  // 回调
  public onStatusChange: OnStatusChangeCallback;
  public onRemoteStream: OnRemoteStreamCallback | null = null;
  public onPeerLeft: OnPeerLeftCallback | null = null;

  constructor(ws: WebSocket, currentUserId: string) {
    this.ws = ws;
    this.currentUserId = currentUserId;
    this.onStatusChange = (status: string) => Emitter.emit('callStatus', status);
  }

  // ==================== 公共方法 ====================

  /**
   * 获取当前 call_id
   */
  get currentCallId(): string | null {
    return this.callId;
  }

  /**
   * 获取当前 chat_id
   */
  get currentChatId(): string | null {
    return this.chatId;
  }

  /**
   * 获取本地媒体流
   */
  get getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * 获取远程媒体流（单人模式）
   */
  get remoteStream(): MediaStream | null {
    if (this.mode === 'single' && this.targetUserId) {
      return this.peers.get(this.targetUserId)?.remoteStream || null;
    }
    // 多人模式返回第一个远程流
    for (const peer of this.peers.values()) {
      if (peer.remoteStream) return peer.remoteStream;
    }
    return null;
  }

  /**
   * 初始化本地媒体流
   */
  async initLocalStream(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;
    
    console.log('🎤 [UnifiedCall] 请求麦克风权限...');
    this.localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    console.log('✅ [UnifiedCall] 麦克风权限获取成功');
    return this.localStream;
  }

  /**
   * 设置通话信息
   */
  setCallInfo(chatId: string, callId: string, mode: CallMode = 'single') {
    this.chatId = chatId;
    this.callId = callId;
    this.mode = mode;
    console.log(`🔧 [UnifiedCall] 设置通话信息: mode=${mode}, chatId=${chatId}, callId=${callId}`);
  }

  // ==================== 单人通话（私聊）====================

  /**
   * 发起单人通话（主叫方）
   */
  async startCall(targetUserId: string, userName: string, avatar: string, chatId?: string, callId?: string) {
    this.mode = 'single';
    this.targetUserId = targetUserId;
    this.chatId = chatId || null;
    this.callId = callId || null;
    
    console.log('[UnifiedCall] 发起单人通话:', { to: targetUserId, chatId, callId });
    this.onStatusChange('Calling...');
    Emitter.emit('startCall', targetUserId);

    await this.initLocalStream();
    const pc = await this.getOrCreatePeer(targetUserId);
    
    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);

    // offer 必须通过 WebSocket 发送
    this.sendSignalViaWebSocket('offer', { sdp: offer, userName, avatar }, targetUserId);
  }

  /**
   * 处理来电 Offer（被叫方）
   */
  handleOffer(data: any) {
    const senderId = data.user_id || data.sender;
    this.targetUserId = senderId;
    this.pendingOffer = data.payload?.sdp || data.payload;
    this.chatId = data.chat_id || null;
    this.callId = data.call_id || null;
    
    // 根据 payload 判断模式
    this.mode = data.payload?.call_mode === 'group' ? 'group' : 'single';
    
    console.log('📞 [UnifiedCall] 收到来电:', { from: senderId, chatId: this.chatId, callId: this.callId, mode: this.mode });
    
    // 触发来电事件（UI 层处理）
    Emitter.emit('incomingCall', senderId);
  }

  /**
   * 接听来电（被叫方）
   */
  async answerCall() {
    if (!this.targetUserId || !this.pendingOffer) {
      console.error('❌ [UnifiedCall] 无法接听：缺少来电信息');
      return;
    }

    console.log('📞 [UnifiedCall] 接听来电');
    this.onStatusChange('Connecting...');

    await this.initLocalStream();
    const pc = await this.getOrCreatePeer(this.targetUserId);

    await pc.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));
    this.processBufferedCandidates(this.targetUserId);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // answer 优先 TCP，备用 WebSocket
    this.sendSignal('answer', { sdp: answer }, this.targetUserId);
    console.log('✅ [UnifiedCall] Answer 已发送');
  }

  /**
   * 拒绝来电
   */
  rejectCall() {
    if (this.targetUserId) {
      this.sendSignal('reject', {}, this.targetUserId);
    }
    this.cleanupLocal();
  }

  // ==================== 多人通话（群聊 Mesh）====================

  /**
   * 向指定用户发起 Offer（群聊用）
   */
  async makeOffer(remoteUserId: string) {
    console.log(`📤 [UnifiedCall] 向 ${remoteUserId} 发起 Offer`);
    
    await this.initLocalStream();
    const pc = await this.getOrCreatePeer(remoteUserId);
    
    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);
    
    this.sendSignal('offer', { sdp: offer }, remoteUserId);
  }

  /**
   * 处理群聊中的 Offer 并回复 Answer
   */
  async handleGroupOffer(senderId: string, sdp: any, callId?: string) {
    console.log(`📥 [UnifiedCall] 处理来自 ${senderId} 的 Offer`);
    
    if (callId && !this.callId) {
      this.callId = callId;
    }
    
    await this.initLocalStream();
    const pc = await this.getOrCreatePeer(senderId);
    
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.processBufferedCandidates(senderId);
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    this.sendSignal('answer', { sdp: answer }, senderId);
    console.log(`✅ [UnifiedCall] Answer 已发送给 ${senderId}`);
  }

  // ==================== 信令处理 ====================

  /**
   * 处理 WebSocket/TCP 收到的信令
   */
  handleSignal(data: any) {
    const type = data.type;
    const senderId = data.user_id || data.sender;
    
    console.log(`📡 [UnifiedCall] 处理信令: ${type} from ${senderId}`);

    switch (type) {
      case 'offer':
        // ✅ 根据 payload 中的 call_mode 判断，而不是依赖可能过时的 this.mode
        const incomingCallMode = data.payload?.call_mode || data.call_mode;
        if (incomingCallMode === 'group' && this.mode === 'group') {
          // 群聊模式：直接处理 offer 并回复 answer（只有当前已在群聊中）
          this.handleGroupOffer(senderId, data.payload?.sdp, data.call_id);
        } else {
          // 单人模式 或 新的来电：走 handleOffer 流程
          this.handleOffer(data);
        }
        break;
        
      case 'answer':
        this.handleAnswer(senderId, data.payload?.sdp);
        break;
        
      case 'candidate':
        this.handleCandidate(senderId, data.payload?.candidate);
        break;
        
      case 'reject':
      case 'end':
        this.handleEndSignal(senderId);
        break;
        
      case 'LEAVE_CALL':
        this.removePeer(senderId);
        break;
    }
  }

  /**
   * 处理 Answer
   */
  private async handleAnswer(senderId: string, sdp: any) {
    const peerInfo = this.peers.get(senderId);
    if (!peerInfo) {
      console.warn(`⚠️ [UnifiedCall] 收到 Answer 但找不到对应的 Peer: ${senderId}`);
      return;
    }

    console.log(`📥 [UnifiedCall] 设置 ${senderId} 的 Remote Description`);
    await peerInfo.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.processBufferedCandidates(senderId);
    
    // 单人模式：通知已连接
    if (this.mode === 'single') {
      this.onStatusChange('Connected');
    }
  }

  /**
   * 处理 ICE Candidate
   */
  private async handleCandidate(senderId: string, candidate: any) {
    const peerInfo = this.peers.get(senderId);
    
    if (!peerInfo || !peerInfo.pc.remoteDescription) {
      // 缓存 candidate，等待 remote description 设置后再添加
      if (peerInfo) {
        console.log(`⏳ [UnifiedCall] 缓存 ${senderId} 的 Candidate`);
        peerInfo.candidateQueue.push(new RTCIceCandidate(candidate));
      }
      return;
    }

    await peerInfo.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  /**
   * 处理结束信令
   */
  private handleEndSignal(senderId: string) {
    if (this.mode === 'single') {
      // 单人模式：清理所有资源
      this.cleanup(true, true);
    } else {
      // 多人模式：只移除该 peer
      this.removePeer(senderId);
    }
  }

  /**
   * 处理缓存的 Candidates
   */
  private processBufferedCandidates(userId: string) {
    const peerInfo = this.peers.get(userId);
    if (!peerInfo) return;
    
    while (peerInfo.candidateQueue.length > 0) {
      const candidate = peerInfo.candidateQueue.shift()!;
      peerInfo.pc.addIceCandidate(candidate).catch(e => {
        console.warn(`⚠️ [UnifiedCall] 添加 Candidate 失败:`, e);
      });
    }
  }

  // ==================== Peer 连接管理 ====================

  /**
   * 获取或创建 PeerConnection
   */
  private async getOrCreatePeer(remoteUserId: string): Promise<RTCPeerConnection> {
    const existing = this.peers.get(remoteUserId);
    if (existing) return existing.pc;

    console.log(`🛠️ [UnifiedCall] 为 ${remoteUserId} 创建 PeerConnection`);
    
    if (!this.localStream) {
      await this.initLocalStream();
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);

    // 添加本地音频轨道
    this.localStream!.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream!);
    });

    // 监听 ICE Candidate
    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        this.sendSignal('candidate', { candidate: event.candidate }, remoteUserId);
      }
    };

    // 监听远程媒体流
    (pc as any).ontrack = (event: any) => {
      console.log(`📡 [UnifiedCall] 收到 ${remoteUserId} 的远程音频流`);
      if (event.streams && event.streams[0]) {
        const peerInfo = this.peers.get(remoteUserId);
        if (peerInfo) {
          peerInfo.remoteStream = event.streams[0];
        }
        
        // 触发回调
        this.onRemoteStream?.(remoteUserId, event.streams[0]);
        
        // 单人模式：更新状态
        if (this.mode === 'single') {
          this.onStatusChange('Connected');
        }
      }
    };

    // 监听连接状态
    (pc as any).onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`📡 [UnifiedCall] ${remoteUserId} 连接状态: ${state}`);
      
      if (state === 'failed' || state === 'disconnected') {
        if (this.mode === 'group') {
          this.removePeer(remoteUserId);
        }
      }
    };

    // 保存 peer 信息
    this.peers.set(remoteUserId, {
      pc,
      remoteStream: null,
      candidateQueue: [],
    });

    return pc;
  }

  /**
   * 移除指定 Peer
   */
  removePeer(userId: string) {
    const peerInfo = this.peers.get(userId);
    if (peerInfo) {
      peerInfo.pc.close();
      this.peers.delete(userId);
      console.log(`🔌 [UnifiedCall] 断开与 ${userId} 的连接`);
      this.onPeerLeft?.(userId);
    }
  }

  // ==================== 信令发送 ====================

  /**
   * 发送信令（优先 TCP，备用 WebSocket）
   * 
   * TCP signal 只支持: offer | answer | candidate
   * reject / end 必须通过 WebSocket 发送
   */
  private sendSignal(type: string, payload: any, receiverId: string) {
    // TCP signal 只支持 WebRTC 数据交换 (offer/answer/candidate)
    // reject 和 end 必须通过 WebSocket 发送
    const isTcpSignalType = type === 'offer' || type === 'answer' || type === 'candidate';
    const canUseTcp = isTcpSignalType && type !== 'offer' && this.callId && TcpSocketService.isSocketConnected();

    if (canUseTcp) {
      console.log(`📤 [UnifiedCall] TCP 发送 ${type}`);
      const success = TcpSocketService.sendSignal(
        this.currentUserId,
        this.callId!,
        type as 'offer' | 'answer' | 'candidate',
        {
          ...payload,
          receiver_id: receiverId,
          sender_id: this.currentUserId,
          chat_id: this.chatId || '',
        }
      );
      if (success) return;
      console.warn('⚠️ [UnifiedCall] TCP 发送失败，降级到 WebSocket');
    }

    this.sendSignalViaWebSocket(type, payload, receiverId);
  }

  /**
   * 通过 WebSocket 发送信令
   */
  private sendSignalViaWebSocket(type: string, payload: any, receiverId: string) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ [UnifiedCall] WebSocket 未连接');
      return;
    }

    console.log(`📤 [UnifiedCall] WebSocket 发送 ${type}`);

    const message = {
      msg: 'call_signal',
      type: type,
      user_id: this.currentUserId,
      sender: this.currentUserId,
      chat_id: this.chatId || '',
      call_id: this.callId || '',
      receiver: [receiverId],
      payload: {
        ...payload,
        call_mode: this.mode,
        call_id: this.callId || '',
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  // ==================== 清理 ====================

  /**
   * 仅清理本地资源（不发信令）
   */
  private cleanupLocal() {
    this.targetUserId = null;
    this.pendingOffer = null;
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    
    this.peers.forEach(peerInfo => {
      peerInfo.pc.close();
    });
    this.peers.clear();
  }

  /**
   * 完整清理（结束通话）
   * @param skipSignal 是否跳过发送结束信令
   * @param skipEvents 是否跳过触发事件
   */
  cleanup(skipSignal: boolean = false, skipEvents: boolean = false) {
    console.log('🧹 [UnifiedCall] 清理通话资源');

    // 发送结束信令
    if (!skipSignal) {
      if (this.mode === 'single' && this.targetUserId) {
        this.sendSignal('end', {}, this.targetUserId);
      } else {
        // 多人模式：向所有 peer 发送结束信令
        this.peers.forEach((_, peerId) => {
          this.sendSignal('end', {}, peerId);
        });
      }
    }

    // 停止本地媒体流
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    // 关闭所有 peer 连接
    this.peers.forEach(peerInfo => {
      if (peerInfo.remoteStream) {
        peerInfo.remoteStream.getTracks().forEach(t => t.stop());
      }
      peerInfo.pc.close();
    });
    this.peers.clear();

    // 重置状态
    this.targetUserId = null;
    this.callId = null;
    this.chatId = null;
    this.pendingOffer = null;
    this.mode = 'single'; // ✅ 重置模式为默认的单人模式

    // 触发事件
    if (!skipEvents) {
      this.onStatusChange('Ended');
      Emitter.emit('endCall');
    }
  }

  /**
   * 销毁服务（群聊用）
   */
  destroy() {
    console.log('💥 [UnifiedCall] 销毁服务');
    this.cleanup(true, true);
  }
}
