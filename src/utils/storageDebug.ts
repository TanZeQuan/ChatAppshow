// Storage debugging utilities
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 检查 AsyncStorage 中所有存储的数据
 * 用于诊断 userId 残留问题
 */
export const debugStorage = async () => {
  console.log('🔍 ========== STORAGE DEBUG START ==========');

  try {
    // 1. 检查 user-storage
    const userStorage = await AsyncStorage.getItem('user-storage');
    console.log('📦 user-storage:', userStorage ? 'EXISTS' : 'EMPTY');
    if (userStorage) {
      try {
        const parsed = JSON.parse(userStorage);
        console.log('  - Content:', JSON.stringify(parsed, null, 2));
        if (parsed?.state?.user) {
          console.log('  - User ID:', parsed.state.user.id);
          console.log('  - User Name:', parsed.state.user.name);
        }
      } catch (e) {
        console.log('  - Raw:', userStorage);
      }
    }

    // 2. 检查 chat-storage
    const chatStorage = await AsyncStorage.getItem('chat-storage');
    console.log('📦 chat-storage:', chatStorage ? 'EXISTS' : 'EMPTY');
    if (chatStorage) {
      try {
        const parsed = JSON.parse(chatStorage);
        console.log('  - Chats count:', Object.keys(parsed.state?.chats || {}).length);
        console.log('  - ChatList count:', parsed.state?.chatList?.length || 0);

        // 显示前3个 chatList items 的 memberIds
        if (parsed.state?.chatList?.length > 0) {
          console.log('  - First 3 chatList items:');
          parsed.state.chatList.slice(0, 3).forEach((chat: any, i: number) => {
            console.log(`    [${i}] id: ${chat.id}, memberIds: ${JSON.stringify(chat.memberIds)}`);
          });
        }
      } catch (e) {
        console.log('  - Size:', chatStorage.length, 'chars');
      }
    }

    // 3. 检查 contact-storage
    const contactStorage = await AsyncStorage.getItem('contact-storage');
    console.log('📦 contact-storage:', contactStorage ? 'EXISTS' : 'EMPTY');
    if (contactStorage) {
      try {
        const parsed = JSON.parse(contactStorage);
        console.log('  - Contacts count:', parsed.state?.contacts?.length || 0);
      } catch (e) {
        console.log('  - Size:', contactStorage.length, 'chars');
      }
    }

    // 4. 列出所有 keys
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('🔑 All AsyncStorage keys:', allKeys);

  } catch (error) {
    console.error('❌ Storage debug error:', error);
  }

  console.log('🔍 ========== STORAGE DEBUG END ==========');
};

/**
 * 完全清空 AsyncStorage（慎用！）
 */
export const clearAllStorage = async () => {
  console.log('🗑️  [Storage] Clearing ALL AsyncStorage...');
  try {
    await AsyncStorage.clear();
    console.log('✅ [Storage] All storage cleared');

    // 验证
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('🔍 [Storage] Remaining keys:', allKeys.length === 0 ? 'NONE ✅' : allKeys);
  } catch (error) {
    console.error('❌ [Storage] Failed to clear:', error);
  }
};

/**
 * 只清除特定的 storage keys
 */
export const clearSpecificStorage = async (keys: string[]) => {
  console.log('🗑️  [Storage] Clearing specific keys:', keys);
  try {
    await AsyncStorage.multiRemove(keys);
    console.log('✅ [Storage] Keys cleared:', keys);
  } catch (error) {
    console.error('❌ [Storage] Failed to clear keys:', error);
  }
};
