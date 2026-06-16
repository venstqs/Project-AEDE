import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { CheckCircle2, Circle, ShieldAlert } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Pulsing background orb (Matches Login/Signup Screens)
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

export default function PrivacyScreen() {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAgree = async () => {
    if (!agreed) return;
    setLoading(true);
    try {
      await AsyncStorage.setItem('@aede:privacy_agreed', new Date().toISOString());
      router.replace('/');
    } catch {
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['#0C4A6E', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Background orbs (Sync with Intro/Login Screens) */}
      <Orb color="#FFF" size={200} top="-5%" left="-10%" delay={0} />
      <Orb color="#BAE6FD" size={160} top="65%" left="70%" delay={1000} />
      <Orb color="#FFF" size={100} top="30%" left="75%" delay={2000} />
      <Orb color="#7DD3FC" size={80} top="80%" left="-5%" delay={500} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          
          <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.badgeContainer}>
                <ShieldAlert size={14} color="#0EA5E9" style={{ marginRight: 4 }} />
                <Text style={styles.badgeText}>REQUIRED CONSENT</Text>
              </View>
              <Text style={styles.headerTitle}>Data Privacy Agreement</Text>
              <Text style={styles.headerSubtitle}>
                Katambay-AI Dengue Surveillance Platform
              </Text>
              <Text style={styles.headerNotice}>
                Please review the data protection terms below. You must accept this agreement to proceed with registering your account.
              </Text>
            </View>

            {/* Scrollable Formal Legal Text */}
            <View style={styles.textContainer}>
              <ScrollView
                style={styles.scroll}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.scrollContent}
              >
                <Text style={styles.legalHeading}>DATA PRIVACY & PROTECTION POLICY</Text>
                <Text style={styles.legalMeta}>Last Updated: June 2026</Text>
                
                <Text style={styles.legalParagraph}>
                  This Data Privacy Agreement ("Agreement") governs the collection, storage, processing, and transmission of personal identifiers, meteorological metrics, and epidemiological data collected by the Katambay-AI Platform ("Platform") in coordination with the Naga City Local Government Unit (LGU), the Bicol Medical Center (BMC), and the Department of Health (DOH) Region V.
                </Text>

                <View style={styles.sectionHeaderContainer}>
                  <View style={styles.sectionIndicator} />
                  <Text style={styles.legalSectionTitle}>SECTION 1: CONSENT AND LEGAL COMPLIANCE</Text>
                </View>
                <Text style={styles.legalParagraph}>
                  By tapping "I Agree" below, you provide explicit, unequivocal, and voluntary consent to the processing of your personal data as outlined in this document. 
                </Text>
                <Text style={styles.legalParagraph}>
                  This processing is compliant with **Republic Act No. 10173**, otherwise known as the **Data Privacy Act of 2012 (DPA)** of the Republic of the Philippines. Under this Act, you possess the Right to be Informed, the Right to Access your records, the Right to Rectify inaccurate entries, and the Right to Request Erasure or blocking of your personal profile.
                </Text>
                <Text style={styles.legalParagraph}>
                  Additionally, in compliance with **Republic Act No. 11332** (Mandatory Reporting of Notifiable Diseases and Health Events of Public Health Concern Act), dengue fever vector surveillance and outbreak indicators are considered matters of public safety. Submitted reports may be utilized by authorized public health officials for rapid disease control.
                </Text>

                <View style={styles.sectionHeaderContainer}>
                  <View style={styles.sectionIndicator} />
                  <Text style={styles.legalSectionTitle}>SECTION 2: DATA CATEGORIES AND COLLECTION</Text>
                </View>
                <Text style={styles.legalParagraph}>
                  The Platform collects and logs the following information categories:
                </Text>
                <Text style={styles.legalBullet}>
                  • **User Account Registration:** Full name, email address, password hash, and user handle for profile authorization and security.
                </Text>
                <Text style={styles.legalBullet}>
                  • **Geographical Positioning:** Barangay-level location data is recorded when reporting a dengue breeding site, ensuring maps accurately isolate outbreaks.
                </Text>
                <Text style={styles.legalBullet}>
                  • **Media Records:** Images, photos, and video attachments voluntarily captured by you to substantiate vector breeding spots.
                </Text>
                <Text style={styles.legalBullet}>
                  • **Surveillance Reports:** Descriptive text of mosquito habitats, weather conditions, and community notices.
                </Text>

                <View style={styles.sectionHeaderContainer}>
                  <View style={styles.sectionIndicator} />
                  <Text style={styles.legalSectionTitle}>SECTION 3: PURPOSE AND DISCLOSURE OF DATA</Text>
                </View>
                <Text style={styles.legalParagraph}>
                  All collected records serve the following public health purposes:
                </Text>
                <Text style={styles.legalBullet}>
                  • Calibrating local predictive LSTM algorithms to calculate vector propagation probabilities.
                </Text>
                <Text style={styles.legalBullet}>
                  • Assisting Naga City sanitary inspectors and CDRRMO emergency teams in deploying localized fogging, larvicidal treatments, and community clean-up operations.
                </Text>
                <Text style={styles.legalBullet}>
                  • Rendering real-time maps showing color-coded risk indexes by barangay.
                </Text>
                <Text style={styles.legalParagraph}>
                  Katambay-AI does **not** sell, rent, or trade your personal data to commercial third parties. Data is stored on secure, encrypted Cloud Servers. Non-personally identifiable aggregate metrics may be shared with university researchers or public policy analysts.
                </Text>

                <View style={styles.sectionHeaderContainer}>
                  <View style={styles.sectionIndicator} />
                  <Text style={styles.legalSectionTitle}>SECTION 4: RESPONSIBILITIES AND SUSPENSION</Text>
                </View>
                <Text style={styles.legalParagraph}>
                  Users are strictly prohibited from submitting falsified reports, malicious entries, or uploading media containing personal identifiers of uninvolved individuals without explicit written consent. In compliance with **Republic Act No. 9003** (Ecological Solid Waste Management Act), reporting littering or stagnant water requires honest representations. False statements or spamming may result in account termination.
                </Text>

                <View style={styles.sectionHeaderContainer}>
                  <View style={styles.sectionIndicator} />
                  <Text style={styles.legalSectionTitle}>SECTION 5: CONTACT AND RECOURSE</Text>
                </View>
                <Text style={styles.legalParagraph}>
                  For queries regarding your rights, data erasure, or to report a privacy concern, you may contact our designated Data Protection Officer via email at: **privacy@katambay.gov.ph**.
                </Text>
              </ScrollView>
            </View>

            {/* Agreement Checkbox Row */}
            <TouchableOpacity
              style={[styles.checkboxRow, agreed && styles.checkboxRowActive]}
              onPress={() => setAgreed(!agreed)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed ? (
                  <CheckCircle2 size={16} color="#FFFFFF" />
                ) : (
                  <Circle size={16} color="#94A3B8" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>
                I have read, understood, and accept the terms of this Data Privacy Agreement in accordance with RA 10173.
              </Text>
            </TouchableOpacity>

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.agreeButton, !agreed && styles.agreeButtonDisabled]}
              onPress={handleAgree}
              disabled={!agreed || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.agreeButtonText}>SIGN UP</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
          
        </View>
      </SafeAreaView>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: '100%',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0369A1',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#0EA5E9',
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  headerNotice: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
    fontWeight: '500',
  },
  textContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  legalHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  legalMeta: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 6,
  },
  sectionIndicator: {
    width: 3,
    height: 12,
    backgroundColor: '#0EA5E9',
    borderRadius: 1.5,
    marginRight: 6,
  },
  legalSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  legalParagraph: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 10,
    textAlign: 'justify',
    fontWeight: '400',
  },
  legalBullet: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 8,
    paddingLeft: 8,
    fontWeight: '400',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkboxRowActive: {
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    lineHeight: 16,
  },
  agreeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  agreeButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  agreeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
