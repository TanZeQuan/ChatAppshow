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

    const dataPayload = {
      name: params.name,
      user_id: params.user_id,
      image: params.image ?? "",
      group: params.group
    };

    formData.append("data", JSON.stringify(dataPayload));

    console.log("➡ Sending to backend (FormData JSON):", {
      name: params.name,
      user_id: params.user_id,
      image: params.image,
      groupCount: params.group.length,
      group: params.group
    });

    // ✅ Use same headers as successful Chat API
    const response = await api.post("/chats/group/new", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000, // 30 seconds
    });

    console.log("📩 Backend response:", response.data);

    // Handle response (check for error field)
    if (response.data?.error === true) {
      console.error("❌ Backend returned error:", response.data.message);
      return {
        error: true,
        message: response.data.message || "Group creation failed"
      };
    }

    return response.data;

  } catch (error: any) {
    console.error("❌ addGroup error:", error?.message);
    console.error("❌ Full error:", error);
    throw error;
  }
};
