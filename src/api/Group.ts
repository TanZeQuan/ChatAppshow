import api from './service';

export interface GroupMember {
  user_id: string;
  isadmin: number; // 1 normal, 2 admin
}

export interface AddGroupParams {
  name: string;
  user_id: string;
  image?: string;
  group: GroupMember[];
}

export const addGroup = async (params: AddGroupParams) => {
  console.log("📞 addGroup called:", params);

  try {
    const formData = new FormData();

    formData.append(
      "data",
      JSON.stringify({
        name: params.name,
        user_id: params.user_id,
        image: params.image ?? "",
        group: params.group
      })
    );

    console.log("➡ Sending to backend (FormData JSON):", {
      name: params.name,
      user_id: params.user_id,
      image: params.image,
      groupCount: params.group.length
    });

    const response = await api.post("/chats/group/new", formData, {
      headers: { "Content-Type": undefined }, // React Native 必须这样写！
      transformResponse: [
        (data) => {
          try {
            // 清除 PHP warning / HTML
            const jsonMatch = data?.match(/\{[\s\S]*\}$/);
            const cleanJson = jsonMatch ? jsonMatch[0] : data;
            return JSON.parse(cleanJson);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) {
            console.log("❌ JSON parse failed:", data);
            return { error: true, message: "Invalid JSON", raw: data };
          }
        },
      ],
    });

    console.log("📩 Parsed backend response:", response.data);
    return response.data;

  } catch (error: any) {
    console.log("❌ addGroup error:", error?.message);
    throw error;
  }
};
