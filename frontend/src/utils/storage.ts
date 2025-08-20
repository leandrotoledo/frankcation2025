import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class StorageService {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.clear();
      return Promise.resolve();
    }
    return AsyncStorage.clear();
  }
}

export const storage = new StorageService();
export default storage;