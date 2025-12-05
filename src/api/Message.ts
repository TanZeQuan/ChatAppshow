import api from './service';

export const getChatsForUser = async (userId: string) => {
  console.log("📞 getChatsForUser called with user_id:", userId);

  const formData = new FormData();
  formData.append("data", JSON.stringify({ user_id: userId }));

  try {
    const response = await api.post("/chats/read", formData, {
      headers: { "Content-Type": undefined }, // RN 必须这样
      transformResponse: [
        (data) => {
          try {
            // PHP warning / HTML → 去掉
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

    console.log("📩 Chats fetched:", response.data);
    return response.data;

  } catch (error: any) {
    console.error("❌ getChatsForUser failed:", error.message);
    throw error;
  }
};
