import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { Emitter } from './EventEmitter';

export class WebRTCCallService {
  ws: WebSocket;
  currentUserId: string;
  onStatusChange: (status: string) => void;
  onIncomingCall: (callerId: string) => void;
  peerConnection: RTCPeerConnection | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  targetUserId: string | null;
  candidateQueue: RTCIceCandidate[];
  configuration: { iceServers: { urls: string; }[]; };
  pendingOffer: any;
  currentCallId: string | null;
  currentChatId: string | null; // ✅ 新增：保存当前通话的 chat_id

  constructor(ws: WebSocket, currentUserId: string) {
    this.ws = ws;
    this.currentUserId = currentUserId;
    this.onStatusChange = (status: string) => Emitter.emit('callStatus', status);
    this.onIncomingCall = (caller: string) => Emitter.emit('incomingCall', caller);

    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.targetUserId = null;
    this.currentCallId = null;
    this.currentChatId = null; // ✅ 初始化
    this.candidateQueue = [];

    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }, // ✅ 新增备用 STUN 服务器
      ]
    };
  }

  // --- WebSocket Signal Handling ---
  handleSignal(data: any) {
    switch (data.type) {
      case 'offer':
        this.handleOffer(data);
        break;
      case 'answer':
        this.handleAnswer(data);
        break;
      case 'candidate':
        this.handleCandidate(data);
        break;
      case 'reject':
      case 'end':
        this.cleanup(true); // Skip sending signal back
        break;
    }
  }

  sendSignal(type: string, payload: any, receiverId: string, callType: number = 0) {
    console.log('📤 [CallService] sendSignal() called:', { type, receiverId, wsState: this.ws.readyState });

    if (this.ws.readyState !== 1) {
      console.error('❌ [CallService] WebSocket not ready! State:', this.ws.readyState);
      return;
    }

    // ✅ 统一信令格式，与群聊保持一致
    const message: any = {
      msg: 'call_signal',
      type: type,
      user_id: this.currentUserId,
      sender: this.currentUserId,  // ✅ 新增 sender 字段
      chat_id: this.currentChatId || '',  // ✅ 新增 chat_id 字段
      receiver: [receiverId],
      payload: {
        ...payload,
        call_mode: 'single'  // ✅ 标识为一对一通话
      }
    };

    // Add call_type for offer (0=Voice, 1=Video)
    if (type === 'offer') {
      message.call_type = callType;
    }

    console.log('📤 [CallService] Sending signal:', JSON.stringify(message));
    this.ws.send(JSON.stringify(message));
    console.log('✅ [CallService] Signal sent successfully');
  }

  // --- Call Initiation ---

  async startCall(targetUserId: string, userName: string, avatar: string, chatId?: string) {
    this.targetUserId = targetUserId;
    this.currentChatId = chatId || null;  // ✅ 保存 chat_id
    this.onStatusChange('Calling...');
    Emitter.emit('startCall', targetUserId);

    console.log('📞 [CallService] startCall - 发起呼叫:', {
      to: targetUserId,
      chatId: this.currentChatId
    });

    await this.setupPeerConnection();

    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);

    this.sendSignal('offer', { sdp: offer, userName, avatar }, targetUserId);
  }

  async handleOffer(data: any) {
    this.targetUserId = data.user_id || data.sender;
    this.pendingOffer = data.payload.sdp;
    this.currentChatId = data.chat_id || null;  // ✅ 保存来电的 chat_id
    this.currentCallId = data.call_id || null;  // ✅ 保存 call_id
    console.log('📞 [CallService] handleOffer - 来电信息:', {
      from: this.targetUserId,
      chatId: this.currentChatId,
      callId: this.currentCallId
    });
    if (this.targetUserId) {
      this.onIncomingCall(this.targetUserId);
    }
  }

  async answerCall() {
    console.log('📞 [CallService] answerCall() - Starting to answer call');
    this.onStatusChange('Connecting...');

    try {
      await this.setupPeerConnection();
      console.log('✅ [CallService] PeerConnection setup complete');

      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));
      console.log('✅ [CallService] Remote description set');

      this.processBufferedCandidates();
      console.log('✅ [CallService] Buffered candidates processed');

      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      console.log('✅ [CallService] Answer created and set as local description');

      console.log('📤 [CallService] Sending answer signal to:', this.targetUserId);
      console.log('📤 [CallService] WebSocket readyState:', this.ws.readyState);
      this.sendSignal('answer', { sdp: answer }, this.targetUserId!);
      console.log('✅ [CallService] Answer signal sent');
    } catch (error) {
      console.error('❌ [CallService] Error in answerCall:', error);
      throw error;
    }
  }

  rejectCall() {
    // Reject incoming call
    if (this.targetUserId && this.ws.readyState === 1) {
      this.sendSignal('reject', {}, this.targetUserId);
    }
    this.onStatusChange('Rejected');
    Emitter.emit('endCall');
    this.targetUserId = null;
    this.currentCallId = null;
    this.pendingOffer = null;
  }

  // --- WebRTC Setup ---

  async setupPeerConnection() {
    console.log('🔧 [CallService] setupPeerConnection() - Starting setup');

    try {
      console.log('🔧 [CallService] Requesting microphone access...');
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      this.localStream = stream;
      console.log('✅ [CallService] Microphone access granted');
      console.log('🔧 [CallService] Local stream tracks:', stream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState
      })));

      console.log('📡 [CallService] Creating RTCPeerConnection...');
      this.peerConnection = new RTCPeerConnection(this.configuration);
      console.log('✅ [CallService] RTCPeerConnection created');

      console.log('🔧🎤 [CallService] Adding local tracks to peer connection...');
      this.localStream.getTracks().forEach(track => {
        console.log('➕ Adding track:', track.kind, 'enabled:', track.enabled);
        this.peerConnection!.addTrack(track, this.localStream!);
      });
      console.log('✅ [CallService] Local tracks added');

      // Use type assertion to access addEventListener (it exists at runtime)
      const pc = this.peerConnection as any;

      pc.addEventListener('icecandidate', (event: any) => {
        if (event.candidate) {
          console.log('🧊 [CallService] ICE candidate generated:', event.candidate.candidate);
          this.sendSignal('candidate', { candidate: event.candidate }, this.targetUserId!);
        } else {
          console.log('🧊 [CallService] ICE gathering complete');
        }
      });

      pc.addEventListener('track', (event: any) => {
        console.log('📡 [CallService] Remote track received!');
        console.log('📡 [CallService] Track details:', {
          kind: event.track.kind,
          enabled: event.track.enabled,
          readyState: event.track.readyState,
          muted: event.track.muted
        });
        console.log('📡 [CallService] Streams:', event.streams.length);

        if (event.streams && event.streams[0]) {
          // ✅ Save remote stream for audio playback
          this.remoteStream = event.streams[0];
          console.log('✅ [CallService] Remote stream saved!');
          console.log('📡 [CallService] Remote stream tracks:', event.streams[0].getTracks().map((t: any) => ({
            kind: t.kind,
            enabled: t.enabled,
            readyState: t.readyState,
            muted: t.muted
          })));
          
          // ✅ In React Native WebRTC, audio tracks are automatically played
          // No need for explicit audio element attachment
          console.log('🔊 [CallService] Remote audio should now be playing automatically');
        }

        this.onStatusChange('Connected');
      });

      pc.addEventListener('connectionstatechange', () => {
        const state = this.peerConnection?.connectionState;
        console.log('📡 [CallService] Connection state changed:', state);
        if (this.peerConnection && state === 'connected') {
          this.onStatusChange('Connected');
        } else if (state === 'failed' || state === 'disconnected') {
          console.error('❌ [CallService] Connection failed/disconnected');
        }
      });

      pc.addEventListener('iceconnectionstatechange', () => {
        const iceState = this.peerConnection?.iceConnectionState;
        console.log('🧊 [CallService] ICE connection state:', iceState);
      });

      console.log('✅ [CallService] setupPeerConnection() complete');
    } catch (error) {
      console.error('❌ [CallService] Error in setupPeerConnection:', error);
      throw error;
    }
  }

  async handleAnswer(data: any) {
    console.log('📞 [CallService] handleAnswer() - 收到对方应答:', data.user_id);
    
    if (this.peerConnection && !this.peerConnection.remoteDescription) {
        console.log('✅ [CallService] 设置远程描述 (answer)');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload.sdp));
        
        this.processBufferedCandidates();
        console.log('✅ [CallService] Answer 处理完成');
        
        // 🔴 关键修改在这里！🔴
        // 之前可能是: this.onStatusChange('Call Accepted - Connecting...');
        // 必须改成: 'Connected'，这样 CallScreen 才会识别并开始计时
        this.onStatusChange('Connected'); 
        
    } else {
      console.warn('⚠️ [CallService] 无法处理 answer - 状态不对');
    }
  }

  async handleCandidate(data: any) {
    console.log('🧊 [CallService] handleCandidate() - Received ICE candidate');
    const candidate = new RTCIceCandidate(data.payload.candidate);

    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      console.log('⏳ [CallService] Queueing candidate (no remote description yet)');
      this.candidateQueue.push(candidate);
    } else {
      console.log('➕ [CallService] Adding ICE candidate');
      await this.peerConnection.addIceCandidate(candidate);
      console.log('✅ [CallService] ICE candidate added');
    }
  }

  processBufferedCandidates() {
    if (!this.peerConnection) return;
    while (this.candidateQueue.length > 0) {
      this.peerConnection.addIceCandidate(this.candidateQueue.shift()!);
    }
  }

  cleanup(skipSignal: boolean = false) {
    // Notify other user before cleanup (unless we're cleaning up because we received end/reject signal)
    if (!skipSignal && this.targetUserId && this.ws.readyState === 1) {
      this.sendSignal('end', {}, this.targetUserId);
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
        console.log('🔇 [CallService] Stopping remote stream');
        this.remoteStream.getTracks().forEach(t => t.stop());
        this.remoteStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.targetUserId = null;
    this.currentCallId = null;
    this.currentChatId = null;  // ✅ 清理 chatId
    this.pendingOffer = null;
    this.candidateQueue = [];  // ✅ 清理候选队列
    this.onStatusChange('Ended');
    Emitter.emit('endCall');
  }
}