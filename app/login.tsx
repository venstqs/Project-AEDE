import * as Device from 'expo-device';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, Lock, Mail } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DatabaseService } from '../lib/supabase';

// Pulsing background orb
function Orb({ color, size, top, left, delay }: any) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.15);

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1.3, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) })
    ), -1, true));
    opacity.value = withDelay(delay, withRepeat(withSequence(
      withTiming(0.3, { duration: 3000 }),
      withTiming(0.1, { duration: 3000 })
    ), -1, true));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{
      position: 'absolute', top, left,
      width: size, height: size,
      borderRadius: size / 2,
      backgroundColor: color,
    }, style]} />
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<'Philippines' | 'Singapore'>('Philippines');

  useEffect(() => {
    setDeviceName(Device.deviceName ?? 'Guardian');
  }, []);

  const firstName = (() => {
    if (!deviceName) return 'Guardian';
    const apostrophe = deviceName.indexOf("'");
    if (apostrophe > 0) return deviceName.slice(0, apostrophe);
    const words = deviceName.trim().split(' ');
    const brands = ['samsung', 'pixel', 'oneplus', 'xiaomi', 'oppo', 'realme', 'iphone', 'ipad', 'android'];
    if (!brands.includes(words[0].toLowerCase())) return words[0];
    return 'Guardian';
  })();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter your email and password.');
      return;
    }

    const finalEmail = email.includes('@') ? email.trim() : `${email.trim()}@katambay.aede.gov`;

    setLoading(true);
    try {
      await DatabaseService.signInUser(finalEmail, password);
      await AsyncStorage.setItem('@aede:active_country', selectedCountry);
      await AsyncStorage.setItem('@aede:demo_mode', 'false');
      router.replace('/(tabs)');
    } catch (e: any) {
      const errMsg = e.message || '';
      if (errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('failed to fetch')) {
        Alert.alert(
          'Connection Issue',
          'A network error occurred. Please check your internet connection and try again.'
        );
      } else {
        Alert.alert('Sign-In Failed', errMsg || 'System failed to authenticate credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter Email', 'Please enter your email address above, then tap Forgot Password.');
      return;
    }
    try {
      const { supabase: sb } = await import('../lib/supabase');
      await sb.auth.resetPasswordForEmail(email.trim());
      Alert.alert('Reset Email Sent', 'Check your inbox for a password reset link.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send reset email.');
    }
  };


  const mascotFloat = useSharedValue(0);
  useEffect(() => {
    mascotFloat.value = withRepeat(withSequence(
      withTiming(-16, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })
    ), -1, true);
  }, []);

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: mascotFloat.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['#0C4A6E', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Background orbs (Sync with Intro Screen) */}
      <Orb color="#FFF" size={200} top="-5%" left="-10%" delay={0} />
      <Orb color="#BAE6FD" size={160} top="65%" left="70%" delay={1000} />
      <Orb color="#FFF" size={100} top="30%" left="75%" delay={2000} />
      <Orb color="#7DD3FC" size={80} top="80%" left="-5%" delay={500} />

      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color="#FFFFFF" size={28} />
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Animated.View entering={FadeInUp.delay(200).duration(900)} style={[styles.mascotWrapper, mascotStyle]}>
            <Image
              source={require('../assets/images/mascot.png')}
              style={styles.mascot}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Login Card */}
          <Animated.View entering={FadeInDown.delay(400).duration(900)} style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Welcome back,</Text>
              <Text style={styles.titleAccent}>{firstName}! 👋</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.countrySelectorWrapper}>
                <Text style={styles.countryLabel}>Pilot Country Context</Text>
                <View style={styles.countrySegmentContainer}>
                  <TouchableOpacity 
                    style={[styles.countrySegmentButton, selectedCountry === 'Philippines' && styles.countrySegmentActive]}
                    onPress={() => setSelectedCountry('Philippines')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.countrySegmentText, selectedCountry === 'Philippines' && styles.countrySegmentActiveText]}>🇵🇭 Philippines</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.countrySegmentButton, selectedCountry === 'Singapore' && styles.countrySegmentActive]}
                    onPress={() => setSelectedCountry('Singapore')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.countrySegmentText, selectedCountry === 'Singapore' && styles.countrySegmentActiveText]}>🇸🇬 Singapore</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <Mail color="#0EA5E9" size={20} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email or Username"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Lock color="#0EA5E9" size={20} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.loginButton} onPress={() => handleLogin()} activeOpacity={0.85} disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>LOG IN</Text>
                    <ArrowRight color="#FFF" size={20} style={{ marginLeft: 10 }} />
                  </>
                )}
              </TouchableOpacity>

            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(700).duration(800)} style={styles.footer}>
            <TouchableOpacity onPress={() => router.replace('/signup')}>
              <Text style={styles.signUpText}>
                Don&apos;t have an account?{' '}
                <Text style={styles.signUpLink}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  backButton: { padding: 20, zIndex: 10 },
  keyboardView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  mascotWrapper: {
    marginBottom: -45,
    zIndex: 3,
  },
  mascot: {
    width: 180,
    height: 180,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    width: '100%',
    borderRadius: 40,
    padding: 32,
    paddingTop: 65,
    shadowColor: '#0C4A6E',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 12,
  },
  header: { marginBottom: 28 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#475569',
    lineHeight: 34,
  },
  titleAccent: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0EA5E9',
    lineHeight: 38,
  },
  form: { width: '100%' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    height: 55,
    borderRadius: 18,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -4,
  },
  forgotPasswordText: {
    color: '#0EA5E9',
    fontSize: 12,
    fontWeight: '700',
  },
  loginButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 35,
    backgroundColor: '#0EA5E9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  footer: {
    marginTop: 28,
    alignItems: 'center',
  },
  signUpText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '500',
  },
  signUpLink: {
    fontWeight: '900',
    color: '#FFFFFF',
  },
  fastTrackDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  fastTrackTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94A3B8',
    marginHorizontal: 12,
    letterSpacing: 1.5,
  },
  fastTrackRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  fastTrackBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  fastTrackText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  countrySelectorWrapper: {
    marginBottom: 20,
  },
  countryLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countrySegmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  countrySegmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  countrySegmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  countrySegmentText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  countrySegmentActiveText: {
    color: '#0EA5E9',
  },
  demoButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 35,
    borderWidth: 1.5,
    borderColor: '#0EA5E9',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  demoButtonText: {
    color: '#0EA5E9',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
