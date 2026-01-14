import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import WebSocketManager from './WebSocketManager';

// Google STUN 服务器配置
const iceConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class P2PManager {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;

  private userId: string;
  private chatId: string;
  private userName: string;
  private avatar: string;

  constructor(userId: string, chatId: string, userName: string, avatar: string) {
    this.userId = userId;
    this.chatId = chatId;
    this.userName = userName;
    this.avatar = avatar;
  }

  // 1. 初始化本地媒体流
  async initLocalStream(): Promise<MediaStream> {
    try {
      this.localStream = await mediaDevices.getUserMedia({
        video: false,
        audio: true
      });
      return this.localStream;
    } catch (error) {
      console.error("❌ [P2P] 无法获取麦克风权限:", error);
      throw error;
    }
  }

  // 2. 核心连接逻辑
  private async getOrCreatePeer(
    remoteUserId: string,
    onRemoteStream: (stream: MediaStream) => void
  ): Promise<RTCPeerConnection> {
    if (this.peers.has(remoteUserId)) {
      return this.peers.get(remoteUserId)!;
    }

    console.log(`🛠 [P2P] 为 ${remoteUserId} 创建新的 PeerConnection`);
    const pc = new RTCPeerConnection(iceConfig);

    // ✅ 使用 addTrack 添加流
    if (this.localStream) {
      const tracks = this.localStream.getTracks();
      tracks.forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // ✅ 监听远程流
    (pc as any).ontrack = (event: any) => {
      console.log(`📡 [P2P] 收到来自 ${remoteUserId} 的音频流`);
      if (event.streams && event.streams.length > 0) {
        onRemoteStream(event.streams[0]);
      }
    };

    // ✅ 监听并发送 ICE 候选 (标记为 group)
    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        WebSocketManager.sendCallSignal({
          type: 'candidate',
          chat_id: this.chatId,
          sender: this.userId,
          receiver: [remoteUserId],
          payload: {
            candidate: event.candidate,
            call_mode: 'group' // ✅ 移到 payload 里面
          }
        });
      }
    };

    this.peers.set(remoteUserId, pc);
    return pc;
  }

  // 3. 发起 Offer
  async makeOffer(remoteUserId: string, onRemoteStream: (stream: MediaStream) => void) {
    try {
      const pc = await this.getOrCreatePeer(remoteUserId, onRemoteStream);
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);

      console.log(`📤 [P2P] 发送 Offer 给: ${remoteUserId}`);
      WebSocketManager.sendCallSignal({
        type: 'offer',
        chat_id: this.chatId,
        sender: this.userId,
        receiver: [remoteUserId],
        call_type: 0,
        payload: {
          sdp: offer,
          call_mode: 'group', // ✅ 移到 payload 里面
          userName: this.userName,
          avatar: this.avatar,
        }
      });
    } catch (e) {
      console.error(`❌ [P2P] Make offer 失败:`, e);
    }
  }

  // 4. 处理 Offer 并回复 Answer
  async handleOffer(
    remoteUserId: string,
    sdp: any,
    callId: string,
    onRemoteStream: (stream: MediaStream) => void
  ) {
    try {
      const pc = await this.getOrCreatePeer(remoteUserId, onRemoteStream);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log(`📤 [P2P] 回复 Answer 给: ${remoteUserId}`);
      WebSocketManager.sendCallSignal({
        type: 'answer',
        chat_id: this.chatId,
        sender: this.userId,
        receiver: [remoteUserId],
        call_id: callId,
        payload: {
          sdp: answer,
          call_mode: 'group', // ✅ 移到 payload 里面
          userName: this.userName,
          avatar: this.avatar,
        }
      });
    } catch (e) {
      console.error(`❌ [P2P] Handle offer 失败:`, e);
    }
  }

  // 5. 处理 Answer
  async handleAnswer(remoteUserId: string, sdp: any) {
    try {
      const pc = this.peers.get(remoteUserId);
      if (pc) {
        console.log(`📥 [P2P] 设置 Remote Description (${remoteUserId})`);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    } catch (e) {
      console.error(`❌ [P2P] Handle answer 失败:`, e);
    }
  }

  // 6. 处理 Candidate
  async handleCandidate(remoteUserId: string, candidate: any) {
    try {
      const pc = this.peers.get(remoteUserId);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (e) {
      console.error(`❌ [P2P] Add candidate 失败:`, e);
    }
  }

  // 7. 移除成员
  removePeer(remoteUserId: string) {
    const pc = this.peers.get(remoteUserId);
    if (pc) {
      pc.close();
      this.peers.delete(remoteUserId);
      console.log(`🔌 [P2P] 断开连接: ${remoteUserId}`);
    }
  }

  // 8. 销毁实例
  destroy() {
    console.log('💥 [P2P] 销毁所有资源');
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
  }
}