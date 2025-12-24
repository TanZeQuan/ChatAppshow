# 语音消息 "Invalid file format" 错误诊断

## 🔍 当前配置

### 录音格式设置 (ChatRoomScreen.tsx:391-414)
```typescript
const recordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
};
```

### 发送格式 (ChatRoomScreen.tsx:464-470)
```typescript
{
  sender: currentUserId,
  isreceive: receiver,
  chat_id: chatId,
  voice: {
    uri: "file:///path/to/recording.m4a",
    name: "recording-xxxxx.m4a",
    type: "audio/mp4"  // ✅ 标准 M4A MIME 类型
  }
}
```

### 后端期望格式（根据 API 文档）
```javascript
const formData = new FormData();
formData.append("data", JSON.stringify({
  sender: "IM123456",
  isreceive: ["IM789012"],
  chat_id: "IMC123456"
}));
formData.append("voice", audioBlob, "voice.opus");
```

---

## ❌ 可能的问题原因

### 1. 文件扩展名不匹配
- **当前发送**: `.m4a` 文件
- **API 示例**: `.opus` 文件
- **可能性**: 后端只接受特定扩展名（如 .opus, .mp3, .wav）

### 2. MIME 类型不被接受
- **当前发送**: `audio/mp4`
- **可能需要**: `audio/mpeg`, `audio/ogg`, `audio/wav`

### 3. FormData 结构问题
- **React Native 格式**:
  ```typescript
  formData.append("voice", {uri, name, type})
  ```
- **Web 格式**:
  ```javascript
  formData.append("voice", blob, "filename.ext")
  ```

### 4. 文件大小限制
- 录音质量设置可能产生较大文件
- 后端可能有文件大小限制

---

## 🔧 调试步骤

### 步骤 1: 查看控制台日志
录制并发送语音后，查看以下日志：

```
🎤 [Voice] Recording stopped, URI: file:///...
🎤 [Voice] File: xxxxx.m4a → MIME: audio/mp4
🎤 [Voice] Full URI: ...
🎤 [Voice] Platform: android/ios
🎤 [Voice] Extension: m4a
🎤 [Send Voice] Attaching voice file: {uri, name, type}
```

**记录以下信息**：
- [ ] 文件名和扩展名
- [ ] MIME 类型
- [ ] 文件 URI
- [ ] 平台（Android/iOS）

### 步骤 2: 检查后端日志
在后端查看：
- 接收到的文件信息
- 后端支持的文件格式列表
- 具体的错误原因

### 步骤 3: 测试不同的 MIME 类型

尝试修改 `stopRecording` 函数中的 MIME 类型：

```typescript
// 选项 1: 使用通用音频类型
let mimeType = 'audio/mpeg';

// 选项 2: 使用 AAC 特定类型
let mimeType = 'audio/aac';

// 选项 3: 使用 M4A 特定类型
let mimeType = 'audio/x-m4a';

// 选项 4: 使用 OGG
let mimeType = 'audio/ogg';
```

---

## 🎯 解决方案

### 方案 1: 询问后端支持的格式

**联系后端开发者，询问**：
1. 支持哪些音频文件格式？（.m4a, .mp3, .opus, .wav）
2. 支持哪些 MIME 类型？
3. 文件大小限制是多少？
4. FormData 的 voice 字段期望什么结构？

### 方案 2: 修改文件扩展名

如果后端只接受 .mp3，修改文件名：

```typescript
// In stopRecording function
const originalFilename = uri.split('/').pop() || 'voice.m4a';
const filename = 'voice.mp3'; // Force .mp3 extension
const mimeType = 'audio/mpeg';
```

### 方案 3: 使用音频转换

如果后端只接受特定格式（如 .opus），需要：
1. 安装音频转换库
2. 录制后转换格式
3. 再上传

```bash
npm install expo-av-audio-converter
```

### 方案 4: 降低音频质量

减小文件大小，避免超过限制：

```typescript
const recordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 22050,      // ✅ 降低采样率
    numberOfChannels: 1,     // ✅ 单声道
    bitRate: 64000,         // ✅ 降低比特率
  },
  // ...
};
```

---

## 📝 临时测试代码

添加以下代码来测试不同格式：

```typescript
// In stopRecording function, after getting URI
console.log('🎤 [Voice] Testing different formats...');

// Test 1: Original M4A
const test1 = {
  uri: uri,
  name: 'test.m4a',
  type: 'audio/mp4'
};

// Test 2: Force MP3 name
const test2 = {
  uri: uri,
  name: 'test.mp3',
  type: 'audio/mpeg'
};

// Test 3: Force OGG name
const test3 = {
  uri: uri,
  name: 'test.ogg',
  type: 'audio/ogg'
};

console.log('🎤 [Voice] Test 1 (M4A):', test1);
console.log('🎤 [Voice] Test 2 (MP3):', test2);
console.log('🎤 [Voice] Test 3 (OGG):', test3);

// Try sending with MP3 format
const result = await sendChatMessage({
  sender: currentUserId,
  isreceive: receiver,
  chat_id: chatId,
  voice: test2,  // ✅ Try MP3 format
});
```

---

## 🔍 快速检查清单

- [ ] 查看控制台日志，确认发送的文件名和 MIME 类型
- [ ] 检查后端日志，查看具体错误信息
- [ ] 确认后端支持的音频格式
- [ ] 确认文件大小是否超限
- [ ] 尝试发送图片，看是否也有同样问题（排除 FormData 结构问题）
- [ ] 尝试使用不同的 MIME 类型
- [ ] 尝试使用不同的文件扩展名

---

## 📞 下一步行动

**最重要的是联系后端开发者**，询问以下问题：

```
1. 后端 /chats/message/new 端点接受哪些音频格式？
   - 文件扩展名：.m4a / .mp3 / .opus / .wav ?
   - MIME 类型：audio/mp4 / audio/mpeg / audio/ogg / audio/wav ?

2. 文件大小限制是多少？

3. FormData 的 voice 字段期望的数据结构是什么？
   - React Native: {uri, name, type}
   - Web: Blob/File object

4. 能否提供一个成功上传语音的示例请求？
```

---

生成时间：2025-12-24
