
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
    if (this.ws.readyState !== 1) return;
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

    this.ws.send(JSON.stringify(message));
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
    this.onStatusChange('Connecting...');
    await this.setupPeerConnection();

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));

    // 处理缓冲的 ICE
    this.processBufferedCandidates();

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.sendSignal('answer', { sdp: answer }, this.targetUserId);
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
    // 1. 获取麦克风 (RN 写法)
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: false
    });
    this.localStream = stream;

    // 2. 创建连接
    this.peerConnection = new RTCPeerConnection(this.configuration);

    // 3. 添加轨道
    this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
    });

    // 4. 监听 ICE
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('candidate', { candidate: event.candidate }, this.targetUserId);
      }
    };

    // 5. 监听远端流 (自动播放，不需要 <audio> 标签)
    this.peerConnection.ontrack = (event) => {
      console.log('Remote stream added!', event);
      this.onStatusChange('Connected');
      // React Native WebRTC 接收到流后会自动从听筒/扬声器播放声音
    };

    this.peerConnection.onconnectionstatechange = () => {
       if (this.peerConnection && this.peerConnection.connectionState === 'connected') {
           this.onStatusChange('Connected');
       }
    };
  }

  async handleAnswer(data) {
    if (this.peerConnection && !this.peerConnection.currentRemoteDescription) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload.sdp));
        this.processBufferedCandidates();
    }
  }

  async handleCandidate(data) {
    const candidate = new RTCIceCandidate(data.payload.candidate);
    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      this.candidateQueue.push(candidate);
    } else {
      await this.peerConnection.addIceCandidate(candidate);
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
