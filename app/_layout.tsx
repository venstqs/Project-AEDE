import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase, DatabaseService } from '../lib/supabase';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Where to redirect after session check resolves
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
  // Whether the splash overlay should still be shown
  const [showSplash, setShowSplash] = useState(true);
  // Prevent double-navigation
  const hasNavigated = useRef(false);
  // expo-router: navigator is ready once navigationState.key exists
  const navigationState = useRootNavigationState();

  // Step 1: Always show DPA first on every cold app start.
  // privacy.tsx checks the existing session after user agrees and routes to /login or /(tabs).
  useEffect(() => {
    const checkInitialState = async () => {
      try {
        // Sync any offline data as soon as the app starts
        DatabaseService.syncOfflineQueue();

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setRedirectTarget('/(tabs)');
        } else {
          const hasAgreed = await AsyncStorage.getItem('@aede:privacy_agreed');
          if (!hasAgreed) {
            setRedirectTarget('/privacy');
          } else {
            setRedirectTarget('/');
          }
        }
      } catch (e) {
        setRedirectTarget('/');
      }
    };
    
    checkInitialState();

    // Periodically try to sync offline queue every 2 minutes while app is running
    const syncInterval = setInterval(() => {
      DatabaseService.syncOfflineQueue();
    }, 120000);

    // Listen for sign-out events
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        hasNavigated.current = false;
        setShowSplash(true);
        setRedirectTarget('/login');
      }
    });

    return () => {
      clearInterval(syncInterval);
      listener.subscription.unsubscribe();
    };
  }, []);

  // Step 2: Once the navigator is mounted AND we know where to go, navigate
  useEffect(() => {
    if (
      navigationState?.key &&   // navigator is ready
      redirectTarget !== null && // we know the destination
      !hasNavigated.current       // haven't navigated yet
    ) {
      hasNavigated.current = true;
      router.replace(redirectTarget as any);
      // Hide splash after a short delay so the new screen renders first
      setTimeout(() => setShowSplash(false), 200);
    }
  }, [navigationState?.key, redirectTarget]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="privacy" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>

      {/* Splash overlay sits ON TOP of the Stack. Fades away once navigation fires. */}
      {showSplash && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LinearGradient
            colors={['#0C4A6E', '#0EA5E9', '#38BDF8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.splashCenter}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        </View>
      )}

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splashCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
