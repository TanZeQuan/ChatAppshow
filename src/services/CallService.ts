
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
  currentUserId: any;
  onStatusChange: (status: string) => void;
  onIncomingCall: (callerId: any) => void;
  peerConnection: RTCPeerConnection | null;
  localStream: MediaStream | null;
  targetUserId: any;
  candidateQueue: any[];
  configuration: { iceServers: { urls: string; }[]; };
  pendingOffer: any;

  constructor(ws, currentUserId) {
    this.ws = ws; // 您的 WebSocket 实例
    this.currentUserId = currentUserId;
    this.onStatusChange = (status) => Emitter.emit('callStatus', status); // 回调：用于更新UI文字
    this.onIncomingCall = (caller) => Emitter.emit('incomingCall', caller); // 回调：用于弹出接听界面

    this.peerConnection = null;
    this.localStream = null;
    this.targetUserId = null;
    this.candidateQueue = [];

    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };
  }

  // --- WebSocket 信令处理 (和 Web 一样) ---
  handleSignal(data) {
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

  sendSignal(type, payload, receiverId, callType = 0) {
    console.log('📤 [CallService] sendSignal() called:', { type, receiverId, wsState: this.ws.readyState });
    
    if (this.ws.readyState !== 1) {
      console.error('❌ [CallService] WebSocket not ready! State:', this.ws.readyState);
      return;
    }
    
    const message = {
      msg: 'call_signal',
      type: type,
      user_id: this.currentUserId,
      receiver: [receiverId],
      payload: payload
    };

    // Add call_type for offer (0=Voice, 1=Video)
    if (type === 'offer') {
      message.call_type = callType;
    }

    console.log('📤 [CallService] Sending signal:', JSON.stringify(message));
    this.ws.send(JSON.stringify(message));
    console.log('✅ [CallService] Signal sent successfully');
  }

  // --- 核心流程 ---

  async startCall(targetUserId) {
    this.targetUserId = targetUserId;
    this.onStatusChange('Calling...');
    Emitter.emit('startCall', targetUserId);

    await this.setupPeerConnection();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.sendSignal('offer', { sdp: offer }, targetUserId);
  }

  async handleOffer(data) {
    this.targetUserId = data.user_id;
    this.pendingOffer = data.payload.sdp;
    // 触发 UI 弹出接听框
    this.onIncomingCall(data.user_id);
  }

  async answerCall() {
    console.log('📞 [CallService] answerCall() - Starting to answer call');
    this.onStatusChange('Connecting...');
    
    try {
      await this.setupPeerConnection();
      console.log('✅ [CallService] PeerConnection setup complete');

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));
      console.log('✅ [CallService] Remote description set');

      // 处理缓冲的 ICE
      this.processBufferedCandidates();
      console.log('✅ [CallService] Buffered candidates processed');

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('✅ [CallService] Answer created and set as local description');

      console.log('📤 [CallService] Sending answer signal to:', this.targetUserId);
      console.log('📤 [CallService] WebSocket readyState:', this.ws.readyState);
      this.sendSignal('answer', { sdp: answer }, this.targetUserId);
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
    this.pendingOffer = null;
  }

  // --- WebRTC 封装 ---

  async setupPeerConnection() {
    console.log('🎤 [CallService] setupPeerConnection() - Starting setup');
    
    try {
      // 1. 获取麦克风 (RN 写法)
      console.log('🎤 [CallService] Requesting microphone access...');
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      this.localStream = stream;
      console.log('✅ [CallService] Microphone access granted');
      console.log('🎤 [CallService] Local stream tracks:', stream.getTracks().map(t => ({ 
        kind: t.kind, 
        enabled: t.enabled, 
        readyState: t.readyState 
      })));

      // 2. 创建连接
      console.log('🔗 [CallService] Creating RTCPeerConnection...');
      this.peerConnection = new RTCPeerConnection(this.configuration);
      console.log('✅ [CallService] RTCPeerConnection created');

      // 3. 添加轨道
      console.log('🎵 [CallService] Adding local tracks to peer connection...');
      this.localStream.getTracks().forEach(track => {
          console.log('➕ Adding track:', track.kind, 'enabled:', track.enabled);
          this.peerConnection.addTrack(track, this.localStream);
      });
      console.log('✅ [CallService] Local tracks added');

      // 4. 监听 ICE
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 [CallService] ICE candidate generated:', event.candidate.candidate);
          this.sendSignal('candidate', { candidate: event.candidate }, this.targetUserId);
        } else {
          console.log('🧊 [CallService] ICE gathering complete');
        }
      };

      // 5. 监听远端流 (自动播放，不需要 <audio> 标签)
      this.peerConnection.ontrack = (event) => {
        console.log('🔊 [CallService] Remote track received!');
        console.log('🔊 [CallService] Track details:', {
          kind: event.track.kind,
          enabled: event.track.enabled,
          readyState: event.track.readyState,
          muted: event.track.muted
        });
        console.log('🔊 [CallService] Streams:', event.streams.length);
        
        if (event.streams && event.streams[0]) {
          console.log('🔊 [CallService] Remote stream tracks:', event.streams[0].getTracks().map(t => ({
            kind: t.kind,
            enabled: t.enabled,
            readyState: t.readyState,
            muted: t.muted
          })));
        }
        
        this.onStatusChange('Connected');
        // React Native WebRTC 接收到流后会自动从听筒/扬声器播放声音
      };

      this.peerConnection.onconnectionstatechange = () => {
         const state = this.peerConnection?.connectionState;
         console.log('🔗 [CallService] Connection state changed:', state);
         if (this.peerConnection && state === 'connected') {
             this.onStatusChange('Connected');
         } else if (state === 'failed' || state === 'disconnected') {
             console.error('❌ [CallService] Connection failed/disconnected');
         }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        const iceState = this.peerConnection?.iceConnectionState;
        console.log('🧊 [CallService] ICE connection state:', iceState);
      };

      console.log('✅ [CallService] setupPeerConnection() complete');
    } catch (error) {
      console.error('❌ [CallService] Error in setupPeerConnection:', error);
      throw error;
    }
  }

  async handleAnswer(data) {
    console.log('📞 [CallService] handleAnswer() - Received answer from:', data.user_id);
    
    if (this.peerConnection && !this.peerConnection.currentRemoteDescription) {
        console.log('✅ [CallService] Setting remote description (answer)');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload.sdp));
        console.log('✅ [CallService] Remote description set');
        
        this.processBufferedCandidates();
        console.log('✅ [CallService] Answer processed - call should be connected');
        this.onStatusChange('Call Accepted - Connecting...');
    } else {
      console.warn('⚠️ [CallService] Cannot handle answer - peerConnection or remoteDescription issue');
    }
  }

  async handleCandidate(data) {
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
      // ... 同 Web 版逻辑
      if (!this.peerConnection) return;
      while(this.candidateQueue.length > 0) {
        this.peerConnection.addIceCandidate(this.candidateQueue.shift());
      }
  }

  cleanup(skipSignal = false) {
    // Notify other user before cleanup (unless we're cleaning up because we received end/reject signal)
    if (!skipSignal && this.targetUserId && this.ws.readyState === 1) {
      this.sendSignal('end', {}, this.targetUserId);
    }

    if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
        this.localStream = null;
    }
    if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
    }
    this.targetUserId = null;
    this.pendingOffer = null;
    this.onStatusChange('Ended');
    Emitter.emit('endCall');
  }
}
