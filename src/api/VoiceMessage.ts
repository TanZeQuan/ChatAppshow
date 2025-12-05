import { Alert } from 'react-native';
import api from './service';

export const sendVoiceMessageToApi = async (uri: string) => {
  console.log("🎤 sendVoiceMessageToApi called with URI:", uri);

  const formData = new FormData();
  formData.append("voice", {
    uri,
    name: "voice_message.opus",
    type: "audio/opus",
  } as any);

  try {
    const response = await api.post("/chats/voice/test", formData, {
      headers: { "Content-Type": undefined }, // RN 必须这样
      transformResponse: [
        (data) => {
          try {
            // 去掉 PHP warning / HTML，只保留 JSON
            const jsonMatch = data?.match(/\{[\s\S]*\}$/);
            const clean = jsonMatch ? jsonMatch[0] : data;
            return JSON.parse(clean);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) {
            console.error("❌ JSON parse failed:", data);
            return { error: true, message: "Invalid JSON from server", raw: data };
          }
        },
      ],
    });

    console.log("📩 Voice upload response:", response.data);

    if (response.data.error) {
      throw new Error(response.data.message || "Upload failed");
    }

    return response.data;

  } catch (error: any) {
    console.error("❌ sendVoiceMessageToApi failed:", error.message);
    Alert.alert(
      "上传失败",
      "语音消息上传失败，请稍后再试，错误详情已打印在控制台。"
    );
    throw error;
  }
};
