/**
 * UnifiedCallService.ts
 * * 统一通话服务 - 修复了 SDP 解析逻辑，增强了挂断时的容错性
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

// ✅ 必须包含免费的 Google STUN 服务器，否则跨网络无声
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export type CallMode = 'single' | 'group';

interface PeerInfo {
  pc: RTCPeerConnection;
  remoteStream: MediaStream | null;
  candidateQueue: RTCIceCandidate[];
}

export type OnRemoteStreamCallback = (userId: string, stream: MediaStream) => void;
export type OnPeerLeftCallback = (userId: string) => void;
export type OnStatusChangeCallback = (status: string) => void;

export class UnifiedCallService {
  public ws: WebSocket;
  public currentUserId: string;

  private mode: CallMode = 'single';
  private chatId: string | null = null;
  private callId: string | null = null;

  public localStream: MediaStream | null = null;
  private peers: Map<string, PeerInfo> = new Map();

  private targetUserId: string | null = null;
  private pendingOffer: any = null;

  public onStatusChange: OnStatusChangeCallback;
  public onRemoteStream: OnRemoteStreamCallback | null = null;
  public onPeerLeft: OnPeerLeftCallback | null = null;

  constructor(ws: WebSocket, currentUserId: string) {
    this.ws = ws;
    this.currentUserId = currentUserId;
    this.onStatusChange = (status: string) => Emitter.emit('callStatus', status);
  }

  // ==================== 公共方法 ====================

  get currentCallId(): string | null { return this.callId; }
  get currentChatId(): string | null { return this.chatId; }
  get getLocalStream(): MediaStream | null { return this.localStream; }

  get remoteStream(): MediaStream | null {
    if (this.mode === 'single' && this.targetUserId) {
      return this.peers.get(this.targetUserId)?.remoteStream || null;
    }
    for (const peer of this.peers.values()) {
      if (peer.remoteStream) return peer.remoteStream;
    }
    return null;
  }

  async initLocalStream(): Promise<MediaStream> {
    // 如果已有流且正常，直接返回
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0 && audioTracks[0].enabled) {
        return this.localStream;
      }
      // 轨道异常，重新获取
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    console.log('🎤 [UnifiedCall] 请求 getUserMedia...');
    try {
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      // 🔥 强制开启轨道 (防止某些设备默认静音)
      this.localStream.getAudioTracks().forEach(t => { 
          t.enabled = true; 
          console.log('🎤 本地麦克风轨道已启用');
      });
      
      return this.localStream;
    } catch (error) {
      console.error('❌ [UnifiedCall] 麦克风失败:', error);
      throw error;
    }
  }

  setCallInfo(chatId: string, callId: string, mode: CallMode = 'single') {
    this.chatId = chatId;
    this.callId = callId;
    this.mode = mode;
  }

  // ==================== 核心逻辑 ====================

  async startCall(targetUserId: string, userName: string, avatar: string, chatId?: string, callId?: string) {
    this.mode = 'single';
    this.targetUserId = targetUserId;
    this.chatId = chatId || null;
    this.callId = callId || null;

    this.onStatusChange('Calling...');
    Emitter.emit('startCall', targetUserId);

    await this.initLocalStream();
    const pc = await this.getOrCreatePeer(targetUserId);
    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);

    this.sendSignalViaWebSocket('offer', { sdp: offer, userName, avatar }, targetUserId);
  }

  handleOffer(data: any) {
    const senderId = data.user_id || data.sender;
    this.targetUserId = senderId;
    this.pendingOffer = data.payload?.sdp || data.payload;
    this.chatId = data.chat_id || null;
    this.callId = data.call_id || null;
    this.mode = data.payload?.call_mode === 'group' ? 'group' : 'single';
    Emitter.emit('incomingCall', senderId);
  }

  async answerCall() {
    if (!this.targetUserId || !this.pendingOffer) return;
    this.onStatusChange('Connecting...');
    await this.initLocalStream();
    const pc = await this.getOrCreatePeer(this.targetUserId);
    
    // 这里的 pendingOffer 可能是 { type, sdp } 也可以是 payload 本身，extractSDP 会处理
    const remoteSdp = this.extractSDP({ sdp: this.pendingOffer }, 'offer');
    if (remoteSdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(remoteSdp));
    }
    
    this.processBufferedCandidates(this.targetUserId);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.sendSignal('answer', { sdp: answer }, this.targetUserId);
  }

  rejectCall() {
    if (this.targetUserId) this.sendSignal('reject', {}, this.targetUserId);
    this.cleanup(true);
  }

  // 群聊 Mesh
  async makeOffer(remoteUserId: string) {
    await this.initLocalStream();
    const pc = await this.getOrCreatePeer(remoteUserId);
    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);
    this.sendSignal('offer', { sdp: offer }, remoteUserId);
  }

  async handleGroupOffer(senderId: string, sdp: any, callId?: string) {
    if (callId) this.callId = callId;
    await this.initLocalStream();
    const pc = await this.getOrCreatePeer(senderId);
    
    // 确保 sdp 是标准格式
    const validSdp = this.extractSDP({ sdp }, 'offer');
    if (!validSdp) return;

    await pc.setRemoteDescription(new RTCSessionDescription(validSdp));
    this.processBufferedCandidates(senderId);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.sendSignal('answer', { sdp: answer }, senderId);
  }

  // ==================== 信令处理 (核心修复点) ====================

  handleSignal(data: any) {
    const type = data.type;
    const senderId = data.sender || data.user_id;

    switch (type) {
      case 'offer':
        const incomingMode = data.payload?.call_mode || data.call_mode;
        if (incomingMode === 'group' && this.mode === 'group') {
          const offerSdp = this.extractSDP(data.payload, 'offer');
          if (offerSdp) this.handleGroupOffer(senderId, offerSdp, data.call_id);
        } else {
          this.handleOffer(data);
        }
        break;

      case 'answer':
        const answerSdp = this.extractSDP(data.payload, 'answer');
        if (answerSdp) {
          this.handleAnswer(senderId, answerSdp);
        } else {
          // 🔥🔥🔥 修复逻辑：如果是无效的 Answer (比如对方挂断发的空包)，忽略它，不要报错 🔥🔥🔥
          console.warn(`⚠️ [UnifiedCall] 收到无效 Answer (可能对方已挂断)，忽略此信号`);
        }
        break;

      case 'candidate':
        const candidate = this.extractCandidate(data.payload);
        if (candidate) {
            this.handleCandidate(senderId, candidate);
        } else {
            console.warn(`⚠️ [UnifiedCall] 收到无效 Candidate，忽略`);
        }
        break;

      case 'reject':
      case 'end':
        if (this.mode === 'single') this.cleanup(true, true);
        else this.removePeer(senderId);
        break;

      case 'LEAVE_CALL':
        this.removePeer(senderId);
        break;
    }
  }

  // 🔥🔥🔥 宽容的 SDP 提取器 🔥🔥🔥
  private extractSDP(payload: any, expectedType: 'offer' | 'answer'): { type: string, sdp: string } | null {
    if (!payload) return null;

    let sdpString: string | null = null;

    // 1. 标准结构: { sdp: { type: '...', sdp: '...' } }
    if (payload.sdp && typeof payload.sdp === 'object' && payload.sdp.sdp) {
        sdpString = payload.sdp.sdp;
    }
    // 2. 扁平结构: { type: '...', sdp: '...' }
    else if (payload.type === expectedType && payload.sdp && typeof payload.sdp === 'string') {
        sdpString = payload.sdp;
    }
    // 3. 只有 sdp 字符串: { sdp: "v=0..." }
    else if (payload.sdp && typeof payload.sdp === 'string') {
        sdpString = payload.sdp;
    }

    // 手动组装标准对象
    if (sdpString) {
        return {
            type: expectedType, // 强制修正类型
            sdp: sdpString
        };
    }

    return null;
  }

  // 🔥🔥🔥 宽容的 Candidate 提取器 🔥🔥🔥
  private extractCandidate(payload: any): any {
    if (!payload) return null;

    // 1. 标准结构
    if (payload.candidate && typeof payload.candidate === 'object') {
        return payload.candidate;
    }
    // 2. 直接结构
    if (payload.sdpMid && payload.candidate) {
        return payload;
    }
    
    return null;
  }

  private async handleAnswer(senderId: string, sdp: any) {
    const peerInfo = this.peers.get(senderId);
    if (!peerInfo) return;

    try {
      await peerInfo.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      this.processBufferedCandidates(senderId);
      if (this.mode === 'single') this.onStatusChange('Connected');
    } catch (error) {
      console.error(`❌ [UnifiedCall] setRemoteDescription 失败:`, error);
    }
  }

  private async handleCandidate(senderId: string, candidate: any) {
    const peerInfo = this.peers.get(senderId);
    if (!peerInfo) return;

    if (!peerInfo.pc.remoteDescription) {
      peerInfo.candidateQueue.push(new RTCIceCandidate(candidate));
    } else {
      try {
        await peerInfo.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('ICE add failed', e);
      }
    }
  }

  private processBufferedCandidates(userId: string) {
    const peerInfo = this.peers.get(userId);
    if (!peerInfo) return;
    while (peerInfo.candidateQueue.length > 0) {
      const c = peerInfo.candidateQueue.shift()!;
      peerInfo.pc.addIceCandidate(c).catch(e => console.warn(e));
    }
  }

  // ==================== Peer 管理 ====================

  private async getOrCreatePeer(remoteUserId: string): Promise<RTCPeerConnection> {
    const existing = this.peers.get(remoteUserId);
    if (existing) return existing.pc;

    if (!this.localStream) await this.initLocalStream();

    const pc = new RTCPeerConnection(ICE_CONFIG);

    this.localStream!.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream!);
    });

    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        this.sendSignal('candidate', { candidate: event.candidate }, remoteUserId);
      }
    };

    (pc as any).ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        const p = this.peers.get(remoteUserId);
        if (p) p.remoteStream = event.streams[0];
        
        // 🔥 强制开启远程流的声音 (双保险)
        event.streams[0].getAudioTracks().forEach((t: any) => t.enabled = true);
        
        this.onRemoteStream?.(remoteUserId, event.streams[0]);
        if (this.mode === 'single') this.onStatusChange('Connected');
      }
    };

    (pc as any).onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
         if (this.mode === 'group') this.removePeer(remoteUserId);
      }
    };

    this.peers.set(remoteUserId, { pc, remoteStream: null, candidateQueue: [] });
    return pc;
  }

  removePeer(userId: string) {
    const peerInfo = this.peers.get(userId);
    if (peerInfo) {
      peerInfo.pc.close();
      this.peers.delete(userId);
      this.onPeerLeft?.(userId);
    }
  }

  private sendSignal(type: string, payload: any, receiverId: string) {
    // 优先尝试 TCP
    const isTcpType = ['offer', 'answer', 'candidate'].includes(type);
    const canUseTcp = isTcpType && type !== 'offer' && this.callId && TcpSocketService.isSocketConnected();

    if (canUseTcp) {
      const success = TcpSocketService.sendSignal(
        this.currentUserId,
        this.callId!,
        type as any,
        { ...payload, receiver_id: receiverId, sender_id: this.currentUserId, chat_id: this.chatId || '' }
      );
      if (success) return;
    }
    this.sendSignalViaWebSocket(type, payload, receiverId);
  }

  private sendSignalViaWebSocket(type: string, payload: any, receiverId: string) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    const msg = {
      msg: 'call_signal', type, user_id: this.currentUserId, sender: this.currentUserId,
      chat_id: this.chatId || '', call_id: this.callId || '', receiver: [receiverId],
      payload: { ...payload, call_mode: this.mode, call_id: this.callId || '' }
    };
    this.ws.send(JSON.stringify(msg));
  }

  cleanup(skipSignal = false, skipEvents = false) {
    if (!skipSignal) {
        if (this.mode === 'single' && this.targetUserId) this.sendSignal('end', {}, this.targetUserId);
        else this.peers.forEach((_, pid) => this.sendSignal('end', {}, pid));
    }
    if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
        this.localStream = null;
    }
    this.peers.forEach(p => p.pc.close());
    this.peers.clear();
    this.targetUserId = null; this.callId = null; this.chatId = null;
    if (!skipEvents) {
        this.onStatusChange('Ended');
        Emitter.emit('endCall');
    }
  }

  destroy() { this.cleanup(true, true); }
}