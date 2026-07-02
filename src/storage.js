
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function load(key, fallback) {
  try {
    var v = await AsyncStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch (e) { return fallback; }
}

export async function save(key, value) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
