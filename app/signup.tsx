import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, Image, ScrollView, Modal } from 'react-native';
import { ArrowLeft, User, Mail, Lock, ArrowRight, ShieldCheck, CheckCircle2, Circle, ShieldAlert } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withSequence, withDelay, FadeInDown, FadeInUp } from 'react-native-reanimated';

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

import { DatabaseService } from '../lib/supabase';
import { Alert, ActivityIndicator } from 'react-native';



export default function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isPrivacyVisible, setIsPrivacyVisible] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<'Philippines' | 'Singapore'>('Philippines');

  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please fill in all details.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (!agreed) {
      Alert.alert('Consent Required', 'Please read and agree to the Data Privacy Act & Terms of Service to create an account.');
      return;
    }

    const finalEmail = email.includes('@') ? email.trim() : `${email.trim()}@katambay.aede.gov`;
    const username = email.includes('@') ? email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') : email.replace(/[^a-zA-Z0-9_]/g, '');

    setLoading(true);
    try {
      await DatabaseService.signUpUser(finalEmail, password, username, fullName, 'Guardian Cadet');
      // Set storage agreement immediately since they consented before signup
      await AsyncStorage.setItem('@aede:privacy_agreed', new Date().toISOString());
      await AsyncStorage.setItem('@aede:active_country', selectedCountry);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message || 'System failed to create record.');
    } finally {
      setLoading(false);
    }
  };


  const mascotFloat = useSharedValue(0);
  useEffect(() => {
    mascotFloat.value = withRepeat(withSequence(withTiming(-15, { duration: 2500, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })), -1, true);
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
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Mascot Bee Image */}
            <Animated.View entering={FadeInUp.duration(1000)} style={[styles.mascotContainer, mascotStyle]}>
              <Image 
                source={require('../assets/images/mascot.png')} 
                style={styles.mascot}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Signup Card */}
            <Animated.View entering={FadeInDown.duration(800)} style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.title}>Create</Text>
                <Text style={styles.titleAccent}>Account</Text>
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
                  <User color="#0EA5E9" size={20} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#94A3B8"
                    value={fullName}
                    onChangeText={setFullName}
                  />
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
                    keyboardType="email-address"
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

                <View style={styles.inputWrapper}>
                  <Lock color="#0EA5E9" size={20} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#94A3B8"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>

                {/* Privacy policy checkbox */}
                <TouchableOpacity
                  style={styles.privacyCheckboxRow}
                  onPress={() => setAgreed(!agreed)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.miniCheckbox, agreed && styles.miniCheckboxChecked]}>
                    {agreed ? (
                      <CheckCircle2 size={16} color="#FFFFFF" />
                    ) : (
                      <Circle size={16} color="#94A3B8" />
                    )}
                  </View>
                  <Text style={styles.privacyCheckboxLabel}>
                    I agree to the{' '}
                    <Text 
                      style={styles.privacyLink} 
                      onPress={(e) => {
                        e.stopPropagation();
                        setIsPrivacyVisible(true);
                      }}
                    >
                      Data Privacy Act & Terms
                    </Text>
                  </Text>
                </TouchableOpacity>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity style={styles.signupButton} onPress={handleSignup} disabled={loading}>
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Text style={styles.signupButtonText}>SIGN UP</Text>
                        <ArrowRight color="#FFF" size={20} style={{ marginLeft: 10 }} />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>

            <View style={styles.footer}>
              <TouchableOpacity onPress={() => router.replace('/login')}>
                <Text style={styles.loginText}>
                  Already have an account? <Text style={styles.loginLink}>Log In</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Privacy Policy Modal — Full-Screen Formal Style (matches privacy.tsx) */}
      <Modal
        visible={isPrivacyVisible}
        animationType="fade"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => setIsPrivacyVisible(false)}
      >
        <View style={styles.modalFullScreen}>
          {/* Same gradient as DPA / Login screens */}
          <LinearGradient
            colors={['#0C4A6E', '#0EA5E9', '#38BDF8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Background orbs */}
          <Animated.View style={[styles.modalOrb, { width: 200, height: 200, top: '-5%', left: '-10%', borderRadius: 100 }]} />
          <Animated.View style={[styles.modalOrb, { width: 160, height: 160, top: '65%', left: '70%', borderRadius: 80, backgroundColor: '#BAE6FD' }]} />

          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalInnerPad}>
              <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.modalCard}>
                {/* Header */}
                <View style={styles.modalCardHeader}>
                  <ShieldAlert size={28} color="#0EA5E9" style={{ marginBottom: 6 }} />
                  <Text style={styles.modalCardTitle}>DATA PRIVACY AGREEMENT</Text>
                  <Text style={styles.modalCardSubtitle}>Katambay-AI Dengue Surveillance Platform</Text>
                  <Text style={styles.modalCardNotice}>
                    Please read before creating your account. Tap "I READ & AGREE" at the bottom to confirm.
                  </Text>
                </View>

                {/* Legal scrollable text */}
                <View style={styles.modalTextContainer}>
                  <ScrollView
                    style={styles.modalScroll}
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{ paddingBottom: 8 }}
                  >
                    <Text style={styles.legalHeading}>DATA PRIVACY AND PROTECTION POLICY</Text>
                    <Text style={styles.legalMeta}>Last Updated: June 2026</Text>

                    <Text style={styles.legalParagraph}>
                      This Data Privacy Agreement ("Agreement") governs the collection, storage, processing, and transmission of personal identifiers, meteorological metrics, and epidemiological data collected by the Katambay-AI Platform in coordination with the Naga City Local Government Unit (LGU), the Bicol Medical Center (BMC), and the Department of Health (DOH) Region V.
                    </Text>

                    <Text style={styles.legalSectionTitle}>SECTION 1: CONSENT AND LEGAL COMPLIANCE</Text>
                    <Text style={styles.legalParagraph}>
                      By tapping "I Read & Agree" below, you provide explicit, unequivocal, and voluntary consent to the processing of your personal data as outlined in this document.
                    </Text>
                    <Text style={styles.legalParagraph}>
                      This processing is compliant with Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012 (DPA) of the Republic of the Philippines. Under this Act, you possess the Right to be Informed, the Right to Access your records, the Right to Rectify inaccurate entries, and the Right to Request Erasure or blocking of your personal profile.
                    </Text>
                    <Text style={styles.legalParagraph}>
                      Additionally, in compliance with Republic Act No. 11332 (Mandatory Reporting of Notifiable Diseases Act), dengue fever vector surveillance and outbreak indicators are considered matters of public safety. Submitted reports may be utilized by authorized public health officials for rapid disease control.
                    </Text>

                    <Text style={styles.legalSectionTitle}>SECTION 2: DATA CATEGORIES AND COLLECTION</Text>
                    <Text style={styles.legalParagraph}>The Platform collects and logs the following information categories:</Text>
                    <Text style={styles.legalBullet}>• User Account Registration: Full name, email address, password hash, and user handle for profile authorization and security.</Text>
                    <Text style={styles.legalBullet}>• Geographical Positioning: Barangay-level or planning region location data recorded when reporting a dengue breeding site.</Text>
                    <Text style={styles.legalBullet}>• Media Records: Images and photo attachments voluntarily captured to substantiate vector breeding spots.</Text>
                    <Text style={styles.legalBullet}>• Surveillance Reports: Descriptive text of mosquito habitats, weather conditions, and community notices.</Text>

                    <Text style={styles.legalSectionTitle}>SECTION 3: PURPOSE AND DISCLOSURE OF DATA</Text>
                    <Text style={styles.legalBullet}>• Calibrating local predictive LSTM algorithms to calculate vector propagation probabilities.</Text>
                    <Text style={styles.legalBullet}>• Assisting Naga City sanitary inspectors and CDRRMO emergency teams in deploying localized fogging and larvicidal treatments.</Text>
                    <Text style={styles.legalBullet}>• Rendering real-time maps showing color-coded risk indexes by barangay or planning region.</Text>
                    <Text style={styles.legalParagraph}>
                      Katambay-AI does not sell, rent, or trade your personal data to commercial third parties. Data is stored on secure, encrypted cloud servers.
                    </Text>

                    <Text style={styles.legalSectionTitle}>SECTION 4: RESPONSIBILITIES AND SUSPENSION</Text>
                    <Text style={styles.legalParagraph}>
                      Users are strictly prohibited from submitting falsified reports, malicious entries, or uploading media containing personal identifiers of uninvolved individuals without explicit consent. False statements or spamming may result in account termination.
                    </Text>

                    <Text style={styles.legalSectionTitle}>SECTION 5: CONTACT AND RECOURSE</Text>
                    <Text style={styles.legalParagraph}>
                      For queries regarding your rights, data erasure, or to report a privacy concern, contact our Data Protection Officer at: privacy@katambay.gov.ph
                    </Text>
                  </ScrollView>
                </View>

                {/* Agree checkbox */}
                <TouchableOpacity
                  style={styles.modalCheckRow}
                  onPress={() => setAgreed(!agreed)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.modalCheckbox, agreed && styles.modalCheckboxChecked]}>
                    {agreed ? <CheckCircle2 size={14} color="#FFF" /> : <Circle size={14} color="#94A3B8" />}
                  </View>
                  <Text style={styles.modalCheckLabel}>
                    I have read, understood, and accept these terms in accordance with RA 10173.
                  </Text>
                </TouchableOpacity>

                {/* CTA */}
                <TouchableOpacity
                  style={[styles.modalAgreeButton, !agreed && styles.modalAgreeButtonDisabled]}
                  onPress={() => {
                    if (!agreed) return;
                    setIsPrivacyVisible(false);
                  }}
                  disabled={!agreed}
                  activeOpacity={0.85}
                >
                  <ShieldCheck size={18} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.modalAgreeButtonText}>I READ &amp; AGREE</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  backButton: {
    padding: 20,
    zIndex: 10,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  mascotContainer: {
    marginBottom: -40,
    zIndex: 2,
    marginTop: 20,
  },
  mascot: {
    width: 150,
    height: 150,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    width: '100%',
    borderRadius: 40,
    padding: 35,
    paddingTop: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    marginBottom: 30,
  },
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
  form: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    height: 55,
    borderRadius: 18,
    marginBottom: 12,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#1E40AF',
    fontWeight: '600',
  },
  privacyCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 4,
    gap: 8,
  },
  miniCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  miniCheckboxChecked: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  privacyCheckboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  privacyLink: {
    color: '#0EA5E9',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: 15,
  },
  signupButton: {
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
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  footer: {
    marginTop: 30,
  },
  loginText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  loginLink: {
    fontWeight: '800',
    color: '#38BDF8',
  },
  // ── Full-screen DPA Modal (matches privacy.tsx) ──────────────────────────
  modalFullScreen: {
    flex: 1,
  },
  modalOrb: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  modalInnerPad: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    flex: 1,
    borderRadius: 32,
    padding: 22,
    shadowColor: '#0C4A6E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    justifyContent: 'space-between',
  },
  modalCardHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modalCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 1,
  },
  modalCardSubtitle: {
    fontSize: 11,
    color: '#0EA5E9',
    fontWeight: '800',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalCardNotice: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 15,
    fontWeight: '600',
  },
  modalTextContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  modalScroll: {
    flex: 1,
  },
  legalHeading: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 4,
  },
  legalMeta: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 12,
  },
  legalSectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0EA5E9',
    marginTop: 12,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  legalParagraph: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 8,
    textAlign: 'justify',
    fontWeight: '500',
  },
  legalBullet: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 6,
    paddingLeft: 6,
    fontWeight: '500',
  },
  modalCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    flexShrink: 0,
  },
  modalCheckboxChecked: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  modalCheckLabel: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    lineHeight: 15,
  },
  modalAgreeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    paddingVertical: 13,
    borderRadius: 22,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 6,
  },
  modalAgreeButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  modalAgreeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
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
});
