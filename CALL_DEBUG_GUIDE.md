# 📞 通话功能调试指南

## 🔍 发现的问题

### **问题 1: 接听电话后对方不知道已接听**
**原因**: 在 `CallScreen.tsx` 中，接听方点击"Answer"后，UI 立即变成"通话中"状态，但实际上 WebRTC 连接还没有建立完成。

### **问题 2: WebSocket 信令可能失败但没有日志**
**原因**: `sendSignal()` 函数在 WebSocket 未准备好时会静默失败，没有足够的调试信息。

### **问题 3: 对方没有收到 answer 的明确反馈**
**原因**: `handleAnswer()` 处理了 answer 信令，但没有更新状态告诉发起方"对方已接听"。

### **问题 4: 音频流传输可能有问题**
**可能原因**:
- 麦克风权限未正确请求（运行时）
- 音频轨道没有正确添加到 PeerConnection
- 远程音频流没有正确播放
- ICE 候选者交换失败

---

## ✅ 已实施的修复

### 1. **增强日志记录**
在以下关键函数中添加了详细的调试日志：

#### `answerCall()` - 接听电话
```typescript
✅ 现在会记录：
- 开始接听
- PeerConnection 设置完成
- 远程描述设置
- ICE 候选者处理
- Answer 信号发送
- WebSocket 状态
- 任何错误
```

#### `sendSignal()` - 发送信令
```typescript
✅ 现在会记录：
- 信令类型和接收者
- WebSocket 连接状态
- 实际发送的消息内容
- 发送成功确认
- 连接失败的错误
```

#### `setupPeerConnection()` - 建立连接
```typescript
✅ 现在会记录：
- 麦克风权限请求
- 本地音频轨道详情（kind, enabled, readyState）
- RTCPeerConnection 创建
- 轨道添加过程
- ICE 候选者生成
- 远程音频流接收
- 连接状态变化
- ICE 连接状态
```

#### `handleAnswer()` - 处理 answer 信令
```typescript
✅ 现在会记录：
- 收到的 answer
- 远程描述设置
- ICE 候选者处理
- 连接建立状态
- 状态更新为 "Call Accepted - Connecting..."
```

#### `handleCandidate()` - 处理 ICE 候选者
```typescript
✅ 现在会记录：
- ICE 候选者接收
- 是否需要排队
- ICE 候选者添加成功
```

---

## 🧪 如何测试和调试

### **步骤 1: 重新编译 APK**
```bash
npm run android
# 或者使用 EAS Build
eas build --platform android --profile preview
```

### **步骤 2: 启用 React Native 日志**
使用 `adb logcat` 查看日志：
```bash
adb logcat | grep -E "(CallService|WebSocket|WebRTC)"
```

或者在开发模式下打开 React Native Debugger。

### **步骤 3: 测试通话流程**

#### **A. 发起通话方（用户 A）**
1. 点击语音通话按钮
2. 查看日志，应该看到：
   ```
   📞 [CallService] Starting call...
   🎤 [CallService] Requesting microphone access...
   ✅ [CallService] Microphone access granted
   🎤 [CallService] Local stream tracks: [{"kind":"audio","enabled":true,"readyState":"live"}]
   🔗 [CallService] Creating RTCPeerConnection...
   ✅ [CallService] RTCPeerConnection created
   🎵 [CallService] Adding local tracks...
   ✅ [CallService] Local tracks added
   📤 [CallService] Sending signal: offer
   ✅ [CallService] Signal sent successfully
   🧊 [CallService] ICE candidate generated: ...
   ```

#### **B. 接听方（用户 B）**
1. 收到来电通知
2. 点击"Answer"按钮
3. 查看日志，应该看到：
   ```
   📞 [CallService] answerCall() - Starting to answer call
   🎤 [CallService] Requesting microphone access...
   ✅ [CallService] Microphone access granted
   🎤 [CallService] Local stream tracks: [{"kind":"audio","enabled":true,"readyState":"live"}]
   ✅ [CallService] Remote description set
   ✅ [CallService] Buffered candidates processed
   ✅ [CallService] Answer created and set as local description
   📤 [CallService] Sending answer signal to: xxx
   📤 [CallService] WebSocket readyState: 1
   ✅ [CallService] Answer signal sent
   🧊 [CallService] ICE candidate generated: ...
   ```

#### **C. 发起方收到 Answer**
用户 A 应该看到：
   ```
   📞 [CallService] handleAnswer() - Received answer from: xxx
   ✅ [CallService] Setting remote description (answer)
   ✅ [CallService] Remote description set
   ✅ [CallService] Answer processed - call should be connected
   🔗 [CallService] Connection state changed: connected
   🔊 [CallService] Remote track received!
   🔊 [CallService] Track details: {"kind":"audio","enabled":true,"readyState":"live","muted":false}
   ```

#### **D. 双方都应该看到**
   ```
   🔗 [CallService] Connection state changed: connected
   🧊 [CallService] ICE connection state: connected
   🔊 [CallService] Remote track received!
   ```

---

## ❌ 常见问题和解决方法

### **问题 A: WebSocket readyState 不是 1**
**日志显示**:
```
❌ [CallService] WebSocket not ready! State: 0 (or 2, 3)
```
**解决方法**:
- 检查 WebSocket 连接是否成功建立
- 确认 `WebSocketManager.connect(userId)` 已被调用
- 检查网络连接

### **问题 B: 没有麦克风权限**
**日志显示**:
```
❌ [CallService] Error in setupPeerConnection: Permission denied
```
**解决方法**:
1. 检查 `app.json` 中的权限配置（已确认 ✅）
2. 在设备上手动授予权限：设置 > 应用 > ChatApp > 权限 > 麦克风
3. 添加运行时权限请求（可选）

### **问题 C: 本地音频轨道状态异常**
**日志显示**:
```
🎤 [CallService] Local stream tracks: [{"kind":"audio","enabled":false,"readyState":"ended"}]
```
**解决方法**:
- 麦克风可能被其他应用占用
- 重启应用
- 检查设备麦克风硬件

### **问题 D: 远程音频流没有收到**
**日志显示**:
```
🔗 [CallService] Connection state changed: connected
(但没有看到 "🔊 Remote track received!")
```
**可能原因**:
- 对方的麦克风没有正确启动
- 对方的音频轨道没有添加到 PeerConnection
- ICE 候选者交换失败

**解决方法**:
- 检查双方的日志
- 确认双方都看到 `ICE connection state: connected`
- 尝试使用 TURN 服务器（而不仅仅是 STUN）

### **问题 E: ICE 连接失败**
**日志显示**:
```
🧊 [CallService] ICE connection state: failed
```
**解决方法**:
- 检查防火墙设置
- 考虑添加 TURN 服务器到 `configuration`：
```typescript
this.configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:your-turn-server.com:3478',
      username: 'username',
      credential: 'password'
    }
  ]
};
```

### **问题 F: 听不到声音但连接成功**
**日志显示**:
```
✅ 所有连接状态都是 connected
🔊 Remote track received!
(但是没有声音)
```
**可能原因**:
- 远程音频轨道被静音 (muted: true)
- 设备音量设置为 0
- React Native WebRTC 的音频路由问题

**解决方法**:
1. 检查远程轨道的 `muted` 状态
2. 检查设备音量
3. 尝试在 `ontrack` 中添加音频路由配置（如需要）

---

## 📱 权限配置（已确认 ✅）

### Android (`app.json`)
```json
"permissions": [
  "android.permission.RECORD_AUDIO",      // ✅ 麦克风
  "android.permission.MODIFY_AUDIO_SETTINGS", // ✅ 音频设置
  "android.permission.INTERNET",          // ✅ 网络
  "android.permission.ACCESS_NETWORK_STATE", // ✅ 网络状态
  "android.permission.BLUETOOTH",         // ✅ 蓝牙音频
  "android.permission.WAKE_LOCK"          // ✅ 保持唤醒
]
```

### WebRTC Plugin
```json
"plugins": [
  [
    "@config-plugins/react-native-webrtc",
    {
      "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone"
    }
  ]
]
```

---

## 🔧 下一步优化建议

1. **添加运行时权限请求**（Android 6.0+）
2. **添加音频路由控制**（扬声器/听筒切换）
3. **添加通话质量监控**（网络状态、丢包率）
4. **添加错误恢复机制**（自动重连）
5. **考虑添加 TURN 服务器**（提高连接成功率）
6. **添加通话时长显示**
7. **添加静音/取消静音按钮**

---

## 📝 测试清单

使用以下清单测试通话功能：

- [ ] 发起方可以成功发起通话
- [ ] 接听方收到来电通知
- [ ] 接听方点击"Answer"后，双方连接建立
- [ ] 发起方看到"Call Accepted - Connecting..."
- [ ] 双方看到"Connected"状态
- [ ] 发起方能听到接听方的声音
- [ ] 接听方能听到发起方的声音
- [ ] 日志中显示远程音频轨道已接收
- [ ] ICE 连接状态为"connected"
- [ ] 挂断功能正常工作
- [ ] 拒接功能正常工作

---

## 🐛 如何报告问题

如果通话仍然有问题，请收集以下信息：

1. **完整的日志输出**（从发起到结束）
2. **双方的用户 ID**
3. **测试环境**（WiFi / 4G / 5G）
4. **设备型号和 Android 版本**
5. **APK 版本**
6. **问题发生的具体步骤**

使用以下命令收集日志：
```bash
adb logcat -d > call_debug_log.txt
```

然后分享 `call_debug_log.txt` 文件。
