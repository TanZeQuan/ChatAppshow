// src/services/P2PManager.ts
export class P2PManager {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;

  // 初始化本地媒体流
  async initLocalStream() {
    this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    return this.localStream;
  }

  // 为新成员创建连接 (作为 Offer 发起者)
  async createPeerConnection(remoteUserId: string, onRemoteStream: (stream: MediaStream) => void) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] 
    });

    // 添加本地轨道
    this.localStream?.getTracks().forEach(track => pc.addTrack(track, this.localStream!));

    // 监听对方轨道
    pc.ontrack = (event) => onRemoteStream(event.streams[0]);

    // 存储连接
    this.peers.set(remoteUserId, pc);
    return pc;
  }

  // 清理所有连接
  destroy() {
    this.peers.forEach(pc => pc.close());
    this.peers.clear();
    this.localStream?.getTracks().forEach(t => t.stop());
  }
}