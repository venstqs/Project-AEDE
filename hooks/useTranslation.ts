import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../lib/i18n';

// Simple global event emitter for language changes
type Listener = (lang: string) => void;
const listeners: Set<Listener> = new Set();

export const changeGlobalLanguage = async (newLang: string) => {
  await AsyncStorage.setItem('@aede:language', newLang);
  listeners.forEach(listener => listener(newLang));
};

export function useTranslation() {
  const [language, setLanguage] = useState<keyof typeof translations>('English');

  useEffect(() => {
    const loadLang = async () => {
      const stored = await AsyncStorage.getItem('@aede:language');
      if (stored && translations[stored as keyof typeof translations]) {
        setLanguage(stored as keyof typeof translations);
      }
    };
    loadLang();

    const listener = (newLang: string) => {
      if (translations[newLang as keyof typeof translations]) {
        setLanguage(newLang as keyof typeof translations);
      }
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const t = useCallback((keyPath: string) => {
    const keys = keyPath.split('.');
    let current: any = translations[language];
    
    for (const key of keys) {
      if (current[key] === undefined) {
        // Fallback to English if translation is missing
        let fallback = translations['English'] as any;
        for (const k of keys) {
          if (!fallback || fallback[k] === undefined) return keyPath;
          fallback = fallback[k];
        }
        return fallback;
      }
      current = current[key];
    }
    
    return current;
  }, [language]);

  return { t, language };
}
