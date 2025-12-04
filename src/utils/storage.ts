import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  async set(key: string, value: any) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`AsyncStorage set error: ${err}`);
    }
  },

  async get(key: string, defaultValue: any = null) {
    try {
      const result = await AsyncStorage.getItem(key);
      return result ? JSON.parse(result) : defaultValue;
    } catch (err) {
      console.error(`AsyncStorage get error: ${err}`);
      return defaultValue;
    }
  },

  async remove(key: string) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (err) {
      console.error(`AsyncStorage remove error: ${err}`);
    }
  },
};
