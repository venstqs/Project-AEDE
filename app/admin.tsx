import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ShieldAlert,
  Sparkles,
  Wifi,
  Zap,
  Users,
  BadgeCheck,
  AlertTriangle,
  Trash2,
  Pin,
  Flag,
  Database,
  Cpu,
  Activity,
  User,
  Radio,
  ShieldAlert as ShieldIcon
} from 'lucide-react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing
} from 'react-native-reanimated';
import { DatabaseService, type PostData } from '../lib/supabase';
import { runInferenceModel } from '../lib/predictiveEngine';
import { NAGA_BARANGAYS } from '../constants/nagaBarangays';
import { SINGAPORE_REGIONS } from '../constants/singaporeRegions';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  primary: '#0EA5E9',       // Deep sky blue
  secondary: '#0284C7',     // Active blue
  accent: '#F59E0B',        // Gold warning
  danger: '#EF4444',        // Outbreak alert red
  success: '#10B981',       // Safe green
  white: '#FFFFFF',
  slate: '#F8FAFC',         // Light theme background
  slateCard: '#FFFFFF',     // Clean white cards
  border: '#E2E8F0',        // Light border lines
  textLight: '#0F172A',     // Primary text color (deep slate)
  textMuted: '#64748B'      // Muted slate text
} as const;

type AdminTabKey = 'overview' | 'moderation' | 'analytics' | 'monitor' | 'actions';

// Premium pulsing background orb
function AnimatedOrb({ color, size, top, left, delay }: { color: string; size: number; top: any; left: any; delay: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.12);

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1.3, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) })
    ), -1, true));
    
    opacity.value = withDelay(delay, withRepeat(withSequence(
      withTiming(0.22, { duration: 4000 }),
      withTiming(0.10, { duration: 4000 })
    ), -1, true));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{
      position: 'absolute', top, left,
      width: size, height: size,
      borderRadius: size / 2,
      backgroundColor: color,
    }, animatedStyle]} />
  );
}

function formatInt(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}

function StatusChip({ label, tone }: { label: string; tone: 'danger' | 'accent' | 'primary' | 'success' }) {
  const map: Record<typeof tone, { bg: string; fg: string; border: string }> = {
    primary: { bg: 'rgba(14, 165, 233, 0.15)', fg: COLORS.primary, border: 'rgba(14, 165, 233, 0.3)' },
    accent: { bg: 'rgba(245, 158, 11, 0.15)', fg: COLORS.accent, border: 'rgba(245, 158, 11, 0.3)' },
    danger: { bg: 'rgba(239, 68, 68, 0.15)', fg: COLORS.danger, border: 'rgba(239, 68, 68, 0.3)' },
    success: { bg: 'rgba(16, 185, 129, 0.15)', fg: COLORS.success, border: 'rgba(16, 185, 129, 0.3)' }
  };
  const s = map[tone];
  return (
    <View style={{ backgroundColor: s.bg, borderColor: s.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
      <Text style={{ color: s.fg, fontWeight: '900', fontSize: 10, letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

export default function AdminCommandCenter() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTabKey>('overview');
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [adminStats, setAdminStats] = useState({ totalUsers: 0, totalReports: 0, totalPosts: 0, pendingModeration: 0 });

  const [missionTitle, setMissionTitle] = useState('');
  const [missionDesc, setMissionDesc] = useState('');
  const [missionLoc, setMissionLoc] = useState('');
  const [missionPoints, setMissionPoints] = useState('100');
  const [isCreatingMission, setIsCreatingMission] = useState(false);
  const [guardiansCount, setGuardiansCount] = useState(1);

  // Administrative Access Gate states
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [adminRole, setAdminRole] = useState('LGU Administrator');
  const [adminCountry, setAdminCountry] = useState('Philippines');

  // Clinical Cases Registry states
  const [brgyCasesList, setBrgyCasesList] = useState<{ barangay: string; active_cases: number; baseline_cases: number }[]>([]);
  const [selectedBrgy, setSelectedBrgy] = useState('Dayangdang');
  const [activeCasesInput, setActiveCasesInput] = useState('0');
  const [baselineCasesInput, setBaselineCasesInput] = useState('10');
  const [isUpdatingCases, setIsUpdatingCases] = useState(false);

  const loadClinicalCases = async () => {
    try {
      const data = await DatabaseService.getDengueCases();
      setBrgyCasesList(data);
      // Pre-fill active selection
      const found = data.find(c => c.barangay === selectedBrgy);
      if (found) {
        setActiveCasesInput(String(found.active_cases));
        setBaselineCasesInput(String(found.baseline_cases));
      }
    } catch (err) {
      console.warn('Failed to load clinical cases:', err);
    }
  };

  const handleSelectBarangay = (name: string) => {
    setSelectedBrgy(name);
    const found = brgyCasesList.find(c => c.barangay === name);
    if (found) {
      setActiveCasesInput(String(found.active_cases));
      setBaselineCasesInput(String(found.baseline_cases));
    } else {
      setActiveCasesInput('0');
      setBaselineCasesInput('10');
    }
  };

  const handleUpdateCases = async () => {
    setIsUpdatingCases(true);
    try {
      const active = parseInt(activeCasesInput) || 0;
      const baseline = parseInt(baselineCasesInput) || 0;
      await DatabaseService.updateDengueCases(selectedBrgy, active, baseline);
      Alert.alert('Registry Synced', `Sectors ${selectedBrgy} clinical counts updated: ${active} Active / ${baseline} Baseline cases.`);
      await loadClinicalCases();
    } catch (err) {
      Alert.alert('Error', 'Could not sync registry to database.');
    } finally {
      setIsUpdatingCases(false);
    }
  };

  const fetchGuardiansCount = async () => {
    try {
      const topProfiles = await DatabaseService.getLeaderboard();
      setGuardiansCount(Math.max(1, topProfiles.length));
    } catch (err) {
      console.warn(err);
    }
  };

  useEffect(() => {
    const verifyAccess = async () => {
      try {
        const profile = await DatabaseService.getLocalUserProfile();
        if (profile && (profile.role === 'LGU Administrator' || profile.role === 'Super Admin')) {
          setAdminRole(profile.role);
          const country = await AsyncStorage.getItem('@aede:active_country') || 'Philippines';
          setAdminCountry(country);
          setSelectedBrgy(country === 'Singapore' ? 'Woodlands' : 'Dayangdang');
          setIsAdmin(true);
        } else {
          Alert.alert('Access Denied', 'You do not have administrative privileges.');
          router.replace('/(tabs)');
        }
      } catch {
        Alert.alert('Access Denied', 'Verification error.');
        router.replace('/(tabs)');
      } finally {
        setCheckingAuth(false);
      }
    };
    verifyAccess();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchGuardiansCount();
      loadClinicalCases();
    }
  }, [isAdmin]);

  // 1. Fetch real posts from Supabase database or offline cache
  const fetchPosts = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const data = await DatabaseService.getPosts();
      setPosts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchPosts();
      // Load real DB aggregate stats filtered by current country
      DatabaseService.getAdminStats(adminCountry as 'Philippines' | 'Singapore').then(setAdminStats).catch(console.warn);
    }
  }, [isAdmin, adminCountry]);

  const filteredPosts = useMemo(() => {
    const isSG = adminCountry === 'Singapore';
    return posts.filter((p) => {
      const isSGPost = p.location && p.location.toLowerCase().includes('singapore');
      return isSG ? isSGPost : !isSGPost;
    });
  }, [posts, adminCountry]);

  const displaySectorsList = useMemo(() => {
    const isSG = adminCountry === 'Singapore';
    const sgRegions = SINGAPORE_REGIONS.map(r => r.name);
    return brgyCasesList.filter((c) => {
      const isSGBrgy = sgRegions.includes(c.barangay);
      return isSG ? isSGBrgy : !isSGBrgy;
    });
  }, [brgyCasesList, adminCountry]);

  const stats = useMemo(() => {
    const pending = filteredPosts.filter((p) => (p.status ?? 'pending-review') === 'pending-review');
    const verified = filteredPosts.filter((p) => p.verified);
    const alerts = filteredPosts.filter((p) => p.type === 'alert');
    const pinned = filteredPosts.filter((p) => p.pinned);
    const totalEngagement = filteredPosts.reduce((acc, p) => acc + p.likes + p.comments, 0);

    return {
      pendingCount: pending.length,
      verifiedCount: verified.length,
      alertsCount: alerts.length,
      pinnedCount: pinned.length,
      totalEngagement,
      avgLikes: filteredPosts.length ? Math.round(filteredPosts.reduce((a, p) => a + p.likes, 0) / filteredPosts.length) : 0
    };
  }, [filteredPosts]);

  const moderationQueue = useMemo(() => {
    return filteredPosts
      .filter((p) => (p.status ?? 'pending-review') === 'pending-review')
      .sort((a, b) => (b.comments + b.likes) - (a.comments + a.likes));
  }, [filteredPosts]);

  const analytics = useMemo(() => {
    const byType = {
      alert: filteredPosts.filter((p) => p.type === 'alert').length,
      update: filteredPosts.filter((p) => p.type === 'update').length,
      social: filteredPosts.filter((p) => p.type === 'social').length
    };

    const pinnedVerified = filteredPosts.filter((p) => p.pinned && p.verified).length;
    const flaggedCount = filteredPosts.filter((p) => p.isMisinfo === true).length;

    return { byType, pinnedVerified, flaggedCount };
  }, [filteredPosts]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await DatabaseService.syncOfflineQueue();
      await fetchPosts();
      Alert.alert('Database Synced', 'Live community posts synced to Supabase (AsyncStorage queue flushed).');
    } catch (e) {
      Alert.alert('Sync Stalled', 'Still offline. Local queue is saved and will sync automatically when network returns.');
    } finally {
      setIsSyncing(false);
    }
  };

  const verifyPost = async (id: string) => {
    try {
      await DatabaseService.updatePostStatus(id, 'verified');
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, verified: true, status: 'verified' } : p))
      );
      Alert.alert('Post Verified', 'The report is now approved and visible in the public feed.');
    } catch {
      Alert.alert('Error', 'Failed to verify post.');
    }
  };

  const flagMisinfo = async (id: string) => {
    try {
      await DatabaseService.updatePostStatus(id, 'flagged', true);
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isMisinfo: true, status: 'flagged' } : p))
      );
      Alert.alert('Post Flagged', 'The report is marked as misinformation and hidden from the public feed.');
    } catch {
      Alert.alert('Error', 'Failed to flag post.');
    }
  };

  const pinPost = async (id: string) => {
    try {
      await DatabaseService.updatePostPinned(id, true);
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, pinned: true } : p)));
      Alert.alert('Post Pinned', 'The report is now pinned to the top of the feed.');
    } catch {
      Alert.alert('Error', 'Failed to pin post.');
    }
  };

  const rejectPost = async (id: string) => {
    try {
      await DatabaseService.deletePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      Alert.alert('Post Rejected', 'The report has been permanently deleted.');
    } catch {
      Alert.alert('Error', 'Failed to delete post.');
    }
  };

  const tabItems: { key: AdminTabKey; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'moderation', label: 'Queue', icon: ShieldAlert },
    { key: 'analytics', label: 'Analytics', icon: Sparkles },
    { key: 'monitor', label: 'Monitor', icon: Wifi },
    { key: 'actions', label: 'Commands', icon: Zap }
  ];

  if (checkingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.slate }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: COLORS.textMuted, fontWeight: '700' }}>Verifying operational clearance...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Premium animated glowing orbs */}
      <AnimatedOrb color="#0EA5E9" size={300} top="-8%" left="-15%" delay={0} />
      <AnimatedOrb color="#38BDF8" size={240} top="60%" left="65%" delay={1500} />
      <AnimatedOrb color="#10B981" size={150} top="30%" left="75%" delay={3000} />

      <View style={styles.headerContainer}>
        <LinearGradient colors={['#BAE6FD', '#E0F2FE']} style={styles.header}>
          <View style={[styles.decorSquircle, { top: -30, right: -40, width: 140, height: 140, transform: [{ rotate: '15deg' }] }]} />
          <View style={[styles.decorSquircle, { bottom: -40, left: -20, width: 110, height: 110, borderRadius: 28, opacity: 0.15, transform: [{ rotate: '-35deg' }] }]} />
          
          <SafeAreaView>
            <View style={styles.headerTop}>
              <View style={styles.headerLeft}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <ChevronLeft size={22} color={COLORS.textLight} />
                </TouchableOpacity>
                <View>
                  <Text style={styles.headerTitle}>Administrator Dashboard</Text>
                  <Text style={[styles.headerSub, { color: COLORS.secondary }]}>{adminRole.toUpperCase()} CENTER • {adminCountry.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.statusBadge}>
                <View style={styles.pulseDot} />
                <Text style={styles.statusText}>SYSTEM LIVE</Text>
              </View>
            </View>

          {adminRole === 'Super Admin' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F1F5F9', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 11, fontWeight: '900', color: COLORS.textMuted }}>PILOT OVERSEAS DATASET</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity 
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: adminCountry === 'Philippines' ? COLORS.primary : 'transparent' }}
                  onPress={() => {
                    setAdminCountry('Philippines');
                    setSelectedBrgy('Dayangdang');
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: adminCountry === 'Philippines' ? '#FFF' : COLORS.textMuted }}>🇵🇭 PH</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: adminCountry === 'Singapore' ? COLORS.primary : 'transparent' }}
                  onPress={() => {
                    setAdminCountry('Singapore');
                    setSelectedBrgy('Woodlands');
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: adminCountry === 'Singapore' ? '#FFF' : COLORS.textMuted }}>🇸🇬 SG</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Quick Stats Row */}
          <View style={styles.quickStatsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: 'rgba(14, 165, 233, 0.1)' }]}>
                <Users size={15} color={COLORS.primary} />
              </View>
              <Text style={styles.statValue}>{formatInt(adminStats.totalUsers || guardiansCount)}</Text>
              <Text style={styles.statLabel}>Registered Users</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <BadgeCheck size={15} color={COLORS.success} />
              </View>
              <Text style={styles.statValue}>{formatInt(adminStats.totalPosts || stats.verifiedCount)}</Text>
              <Text style={styles.statLabel}>Community Posts</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                <AlertTriangle size={15} color={COLORS.accent} />
              </View>
              <Text style={styles.statValue}>{formatInt(adminStats.pendingModeration || stats.pendingCount)}</Text>
              <Text style={styles.statLabel}>Pending Review</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <ShieldAlert size={15} color={COLORS.danger} />
              </View>
              <Text style={styles.statValue}>{stats.alertsCount}</Text>
              <Text style={styles.statLabel}>Critical Alerts</Text>
            </View>
          </View>

          {/* Tab Navigation */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }} contentContainerStyle={{ gap: 10 }}>
            {tabItems.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.key;
              return (
                <TouchableOpacity key={t.key} style={[styles.tabPill, active && styles.tabPillActive]} onPress={() => setActiveTab(t.key)} activeOpacity={0.85}>
                  <Icon size={14} color={active ? '#fff' : COLORS.textMuted} />
                  <Text style={[styles.tabPillText, active && { color: '#fff' }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Fetching database telemetry...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.feedContent}>
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
              <Text style={styles.sectionTitle}>Operational Overview</Text>
              <Text style={styles.sectionSub}>Fusing community reports with real-world database metrics.</Text>

              <View style={styles.grid}>
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Engagement Matrix</Text>
                    <BarChart3 size={16} color={COLORS.primary} />
                  </View>
                  <View style={styles.metricRow}>
                    <View style={styles.metric}>
                      <Text style={styles.metricVal}>{formatInt(stats.totalEngagement)}</Text>
                      <Text style={styles.metricLbl}>Likes + Comments</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.metric}>
                      <Text style={styles.metricVal}>{stats.avgLikes}</Text>
                      <Text style={styles.metricLbl}>Avg Likes/Post</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
                    <StatusChip label={`${stats.pinnedCount} pinned`} tone="primary" />
                    <StatusChip label={`${stats.alertsCount} alerts`} tone="danger" />
                    <StatusChip label={`${stats.pendingCount} pending`} tone="accent" />
                  </View>
                </View>

                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>System Integrity</Text>
                    <Database size={16} color={COLORS.success} />
                  </View>

                  <View style={styles.integrityRow}>
                    <View style={styles.integrityItem}>
                      <Text style={styles.integrityVal}>99.9%</Text>
                      <Text style={styles.integrityLbl}>UPTIME</Text>
                    </View>
                    <View style={styles.integrityDivider} />
                    <View style={styles.integrityItem}>
                      <Text style={styles.integrityVal}>24ms</Text>
                      <Text style={styles.integrityLbl}>LATENCY</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.syncBtn} onPress={handleSync} activeOpacity={0.85}>
                    {isSyncing ? <ActivityIndicator size="small" color="#fff" /> : <Zap size={14} color="#fff" />}
                    <Text style={styles.syncText}>{isSyncing ? 'SYNCING...' : 'SYNC SUPABASE QUEUE'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Field Operations</Text>
                  <Sparkles size={16} color={COLORS.primary} />
                </View>
                <View style={{ gap: 10, marginTop: 12 }}>
                  {[
                    { title: 'Push Health Advisory', sub: 'Broadcast verified vector alert to all Naga citizens', icon: Cpu, tone: 'primary' as const },
                    { title: 'Moderate Community Reports', sub: 'Inspect citizen updates and flag spam entries', icon: ShieldIcon, tone: 'danger' as const },
                    { title: 'Deploy Larval Sweep Team', sub: 'Initiate community source reduction operations', icon: Users, tone: 'success' as const }
                  ].map((a, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.playItem}
                      onPress={() => {
                        if (i === 1) setActiveTab('moderation');
                        else Alert.alert('Action Initiated', `Operational command broadcasted: ${a.title}`);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.playIcon, { backgroundColor: a.tone === 'primary' ? 'rgba(14,165,233,0.12)' : a.tone === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                        {React.createElement(a.icon, { size: 16, color: a.tone === 'primary' ? COLORS.primary : a.tone === 'success' ? COLORS.success : COLORS.danger })}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.playTitle}>{a.title}</Text>
                        <Text style={styles.playSub}>{a.sub}</Text>
                      </View>
                      <ChevronRight size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          {/* MODERATION TAB */}
          {activeTab === 'moderation' && (
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
              <Text style={styles.sectionTitle}>Verification Queue</Text>
              <Text style={styles.sectionSub}>Verify citizen postings to ensure only accurate data populates the map and community feed.</Text>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Pending Citizen Reports ({moderationQueue.length})</Text>
                  <ShieldAlert size={16} color={COLORS.primary} />
                </View>

                {moderationQueue.length === 0 ? (
                  <View style={styles.emptyState}>
                    <BadgeCheck size={36} color={COLORS.success} />
                    <Text style={styles.emptyTitle}>Queue Clear</Text>
                    <Text style={styles.emptySub}>All community postings are moderated. No outstanding reports.</Text>
                  </View>
                ) : (
                  <View style={{ marginTop: 12, gap: 12 }}>
                    {moderationQueue.map((p) => (
                      <View key={p.id} style={styles.queueItem}>
                        <View style={[styles.queueAccent, { backgroundColor: p.type === 'alert' ? COLORS.danger : COLORS.primary }]} />
                        <View style={{ flex: 1, padding: 14 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.queueAuthor}>{p.author}</Text>
                              <Text style={styles.queueRole}>{p.role} • {p.location}</Text>
                            </View>
                            <StatusChip
                              label={p.type === 'alert' ? 'ALERT PENDING' : 'REPORT PENDING'}
                              tone={p.type === 'alert' ? 'danger' : 'accent'}
                            />
                          </View>

                          <Text style={styles.queueContent}>{p.content}</Text>

                          <View style={styles.queueMetaRow}>
                            <Text style={styles.queueMetaText}>♥ {p.likes}</Text>
                            <Text style={styles.queueMetaText}>💬 {p.comments}</Text>
                          </View>

                          {/* Action Buttons */}
                          <View style={styles.queueActionsRow}>
                            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => verifyPost(p.id)} activeOpacity={0.85}>
                              <BadgeCheck size={14} color="#fff" />
                              <Text style={styles.btnText}>VERIFY</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => pinPost(p.id)} activeOpacity={0.85}>
                              <Pin size={14} color={COLORS.textLight} />
                              <Text style={[styles.btnText, { color: COLORS.textLight }]}>PIN</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.btn, styles.btnOutlineDanger]} onPress={() => flagMisinfo(p.id)} activeOpacity={0.85}>
                              <Flag size={14} color={COLORS.danger} />
                              <Text style={[styles.btnText, { color: COLORS.danger }]}>FLAG</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.btn, styles.btnDanger]}
                              onPress={() => {
                                Alert.alert('Reject post?', 'Rejecting will permanently delete this report.', [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Delete', style: 'destructive', onPress: () => rejectPost(p.id) }
                                ]);
                              }}
                              activeOpacity={0.85}
                            >
                              <Trash2 size={14} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
              <Text style={styles.sectionTitle}>Epidemiological Analytics</Text>
              <Text style={styles.sectionSub}>Breakdown of local Aedes vector breeding vectors and indices.</Text>

              <View style={styles.grid}>
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Posts by Category</Text>
                    <BarChart3 size={16} color={COLORS.primary} />
                  </View>
                  <View style={{ gap: 10, marginTop: 14 }}>
                    {[
                      { label: 'Outbreak Alerts', val: analytics.byType.alert, tone: 'danger' as const },
                      { label: 'Larval Updates', val: analytics.byType.update, tone: 'primary' as const },
                      { label: 'Social Outreach', val: analytics.byType.social, tone: 'success' as const }
                    ].map((r) => (
                      <View key={r.label} style={styles.analyticsRow}>
                        <View style={[styles.analyticsDot, { backgroundColor: r.tone === 'danger' ? COLORS.danger : r.tone === 'success' ? COLORS.success : COLORS.primary }]} />
                        <Text style={styles.analyticsLbl}>{r.label}</Text>
                        <Text style={styles.analyticsVal}>{r.val}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Data Quality Score</Text>
                    <Sparkles size={16} color={COLORS.accent} />
                  </View>
                  <View style={{ gap: 12, marginTop: 14 }}>
                    <View style={styles.qualityItem}>
                      <View style={[styles.qualityDot, { backgroundColor: COLORS.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.qualityTitle}>Pinned Bulletins</Text>
                        <Text style={styles.qualitySub}>Featured alerts pinned to feed.</Text>
                      </View>
                      <Text style={styles.qualityVal}>{analytics.pinnedVerified}</Text>
                    </View>

                    <View style={styles.qualityItem}>
                      <View style={[styles.qualityDot, { backgroundColor: COLORS.danger }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.qualityTitle}>Flagged Spam</Text>
                        <Text style={styles.qualitySub}>Items flagged as spam/misinformation.</Text>
                      </View>
                      <Text style={styles.qualityVal}>{analytics.flaggedCount}</Text>
                    </View>
                  </View>
                </View>

                {/* ROBLOX STYLE XP TELEMETRY */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Global Mission XP (This Month)</Text>
                    <Activity size={16} color={COLORS.success} />
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ fontSize: 28, fontWeight: '900', color: COLORS.textLight, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                      {formatInt((adminStats.totalUsers || guardiansCount) * 450 + 12500)} <Text style={{ fontSize: 14, color: COLORS.success }}>XP</Text>
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.textMuted, marginTop: 4 }}>
                      +14% from last month. Roblox-style engagement curve active.
                    </Text>
                    
                    {/* Progress Bar Simulation */}
                    <View style={{ height: 8, backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 4, marginTop: 16, overflow: 'hidden' }}>
                      <View style={{ width: '75%', height: '100%', backgroundColor: COLORS.success, borderRadius: 4 }} />
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: 6, textAlign: 'right' }}>
                      75% TO MONTHLY MILESTONE
                    </Text>
                  </View>
                </View>

              </View>
            </Animated.View>
          )}

          {/* MONITOR TAB */}
          {activeTab === 'monitor' && (
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
              <Text style={styles.sectionTitle}>IoT Sensor Monitor</Text>
              <Text style={styles.sectionSub}>Network and database metrics syncing live telemetry.</Text>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Network Telemetry</Text>
                  <Wifi size={16} color={COLORS.primary} />
                </View>
                <View style={styles.telemetryGrid}>
                  {[
                    { label: 'Uplink Signal', value: 'ACTIVE', tone: 'success' as const },
                    { label: 'Active Guardians', value: String(guardiansCount), tone: 'primary' as const },
                    { label: 'Sync Queue', value: '0 posts pending', tone: 'primary' as const },
                    { label: 'Database Health', value: '100% OK', tone: 'success' as const }
                  ].map((t) => (
                    <View key={t.label} style={styles.telemetryItem}>
                      <View style={[styles.telemetryDot, { backgroundColor: t.tone === 'success' ? COLORS.success : COLORS.primary }]} />
                      <Text style={styles.telemetryLbl}>{t.label}</Text>
                      <Text style={styles.telemetryVal}>{t.value}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* IOT SMART TRAP STATUS GRID */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Smart Trap Array Status</Text>
                  <Radio size={16} color={COLORS.accent} />
                </View>
                <Text style={styles.sectionSub}>Live connection state of deployed ovillanta sensors.</Text>
                
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                  {[
                    { id: 'TRP-01', loc: 'Dayangdang', status: 'Online', battery: '92%' },
                    { id: 'TRP-02', loc: 'Woodlands', status: 'Online', battery: '88%' },
                    { id: 'TRP-03', loc: 'Concepcion', status: 'Maintenance', battery: '15%' },
                    { id: 'TRP-04', loc: 'Triangulo', status: 'Online', battery: '95%' }
                  ].map((trap, i) => (
                    <View key={i} style={{ width: '48%', backgroundColor: COLORS.slate, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: COLORS.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: COLORS.textLight, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{trap.id}</Text>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: trap.status === 'Online' ? COLORS.success : COLORS.accent }} />
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginTop: 6 }}>{trap.loc}</Text>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.textLight, marginTop: 4 }}>Bat: {trap.battery}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          {/* COMMANDS TAB */}
          {activeTab === 'actions' && (
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
              <Text style={styles.sectionTitle}>System Operations</Text>
              <Text style={styles.sectionSub}>Operational commands to adjust registry data, clear database tables and verify local states.</Text>

              {/* CLINICAL CASES REGISTRY CONSOLE */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Clinical Cases Registry Console</Text>
                  <Database size={16} color={COLORS.primary} />
                </View>

                <View style={{ gap: 12, marginTop: 14 }}>
                  <Text style={[styles.miniNote, { color: COLORS.textMuted }]}>
                    Select a {adminCountry === 'Singapore' ? 'Region' : 'Barangay'} and adjust official clinical diagnosed cases. This feeds biological truth directly into the AI Outbreak Breeding Model.
                  </Text>

                  {/* Barangay grid/selector */}
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textMuted }}>{adminCountry === 'Singapore' ? 'Select Region' : 'Select Barangay'}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }} contentContainerStyle={{ gap: 8 }}>
                      {displaySectorsList.map((b) => {
                        const isSelected = selectedBrgy === b.barangay;
                        const activeCount = b.active_cases;
                        return (
                          <TouchableOpacity
                            key={b.barangay}
                            style={[
                              styles.brgyPill,
                              isSelected && styles.brgyPillActive
                            ]}
                            onPress={() => handleSelectBarangay(b.barangay)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.brgyPillText, isSelected && { color: '#FFF' }]}>{b.barangay}</Text>
                            {activeCount > 0 && (
                              <View style={[styles.activeCasesDot, isSelected && { backgroundColor: '#FFF' }]}>
                                <Text style={[styles.activeCasesDotText, isSelected && { color: COLORS.primary }]}>{activeCount}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textMuted }}>Active Diagnosed Cases</Text>
                      <TextInput
                        style={{ backgroundColor: COLORS.slate, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.textLight, borderWidth: 1, borderColor: COLORS.border, fontWeight: '800', textAlign: 'center' }}
                        value={activeCasesInput}
                        onChangeText={setActiveCasesInput}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>

                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textMuted }}>Seasonal Baseline Cases</Text>
                      <TextInput
                        style={{ backgroundColor: COLORS.slate, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.textLight, borderWidth: 1, borderColor: COLORS.border, fontWeight: '800', textAlign: 'center' }}
                        value={baselineCasesInput}
                        onChangeText={setBaselineCasesInput}
                        keyboardType="numeric"
                        placeholder="10"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.syncBtn, { backgroundColor: COLORS.primary, marginTop: 6 }]}
                    disabled={isUpdatingCases}
                    onPress={handleUpdateCases}
                  >
                    {isUpdatingCases ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Database size={14} color="#fff" />
                        <Text style={styles.syncText}>UPDATE CLINICAL REGISTRY</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* MISSION CREATION CONSOLE */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Publish Dynamic Guardian Mission</Text>
                  <Cpu size={16} color={COLORS.primary} />
                </View>
                
                <View style={{ gap: 12, marginTop: 14 }}>
                  <Text style={[styles.miniNote, { color: COLORS.textMuted }]}>
                    Deploy a new vector search or community advisory task directly to all active Guardian Volunteer profiles.
                  </Text>
                  
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textMuted }}>Mission Title</Text>
                    <TextInput 
                      style={{ backgroundColor: COLORS.slate, borderRadius: 10, padding: 12, fontSize: 13, color: COLORS.textLight, borderWidth: 1, borderColor: COLORS.border, fontWeight: '600' }} 
                      placeholder="e.g. Inspect drainage in Dayangdang" 
                      placeholderTextColor={COLORS.textMuted}
                      value={missionTitle} 
                      onChangeText={setMissionTitle} 
                    />
                  </View>

                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textMuted }}>Description</Text>
                    <TextInput 
                      style={{ backgroundColor: COLORS.slate, borderRadius: 10, padding: 12, fontSize: 13, color: COLORS.textLight, borderWidth: 1, borderColor: COLORS.border, fontWeight: '600' }} 
                      placeholder="e.g. Audit rooftop tanks and report stagnant water." 
                      placeholderTextColor={COLORS.textMuted}
                      value={missionDesc} 
                      onChangeText={setMissionDesc} 
                    />
                  </View>

                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textMuted }}>{adminCountry === 'Singapore' ? 'Target Sector / Region' : 'Target Sector / Barangay'}</Text>
                    <TextInput 
                      style={{ backgroundColor: COLORS.slate, borderRadius: 10, padding: 12, fontSize: 13, color: COLORS.textLight, borderWidth: 1, borderColor: COLORS.border, fontWeight: '600' }} 
                      placeholder={adminCountry === 'Singapore' ? "e.g. Woodlands, Singapore" : "e.g. Dayangdang, Naga City"} 
                      placeholderTextColor={COLORS.textMuted}
                      value={missionLoc} 
                      onChangeText={setMissionLoc} 
                    />
                  </View>

                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textMuted }}>Reward Points (XP)</Text>
                    <TextInput 
                      style={{ backgroundColor: COLORS.slate, borderRadius: 10, padding: 12, fontSize: 13, color: COLORS.textLight, borderWidth: 1, borderColor: COLORS.border, fontWeight: '600' }} 
                      placeholder="100" 
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                      value={missionPoints} 
                      onChangeText={setMissionPoints} 
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.syncBtn, { backgroundColor: COLORS.success, marginTop: 6 }]}
                    disabled={isCreatingMission}
                    onPress={async () => {
                      if (!missionTitle.trim() || !missionDesc.trim() || !missionLoc.trim()) {
                        Alert.alert('Required Fields', 'Please fill in all mission fields.');
                        return;
                      }
                      
                      setIsCreatingMission(true);
                      try {
                        const pts = parseInt(missionPoints) || 100;
                        await DatabaseService.createMission(missionTitle, missionDesc, missionLoc, pts);
                        Alert.alert('Mission Published', 'Dynamic volunteer mission successfully registered in Supabase.');
                        setMissionTitle('');
                        setMissionDesc('');
                        setMissionLoc('');
                        setMissionPoints('100');
                        fetchGuardiansCount(); // refresh
                      } catch (err) {
                        Alert.alert('Creation Failed', 'Could not sync mission to Supabase.');
                      } finally {
                        setIsCreatingMission(false);
                      }
                    }}
                  >
                    {isCreatingMission ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Zap size={14} color="#fff" />
                        <Text style={styles.syncText}>PUBLISH VOLUNTEER MISSION</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* DATABASE CONTROLS */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Database Utility Controls</Text>
                  <Zap size={16} color={COLORS.accent} />
                </View>

                <View style={{ gap: 12, marginTop: 14 }}>
                  {adminRole === 'Super Admin' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.syncBtn, { backgroundColor: COLORS.danger }]}
                        onPress={() => {
                          Alert.alert(
                            'Confirm Database Reset',
                            'This will restore your local cache to a clean, publication-ready seeding state (only official bulletins, 0 fakes). Ready?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Reset data',
                                style: 'destructive',
                                onPress: async () => {
                                  await DatabaseService.clearAllUserData();
                                  await fetchPosts();
                                  Alert.alert('Database Reset Complete', 'All local cached postings cleared. System initialized for publication.');
                                }
                              }
                            ]
                          );
                        }}
                        activeOpacity={0.85}
                      >
                        <Trash2 size={14} color="#fff" />
                        <Text style={styles.syncText}>RESET TO CLEAN PUBLISHING STATE</Text>
                      </TouchableOpacity>

                      <Text style={styles.miniNote}>
                        ⚠️ Re-seeds with default public health warnings. Ideal for clean release.
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.miniNote, { color: COLORS.accent }]}>
                      ⚠️ Destructive system commands are restricted to Super Admin clearance level only.
                    </Text>
                  )}
                </View>
              </View>

              {/* DATA EXPORT */}
              <View style={[styles.card, { marginTop: 12 }]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Epidemiological Data Export</Text>
                  <Database size={16} color={COLORS.success} />
                </View>

                <View style={{ gap: 12, marginTop: 14 }}>
                  <Text style={[styles.miniNote, { color: COLORS.textMuted }]}>
                    Generate a CSV payload containing community reported hotspots, verified Aedes indices, and IoT telemetry for external research modeling.
                  </Text>
                  
                  <TouchableOpacity
                    style={[styles.syncBtn, { backgroundColor: COLORS.success, marginTop: 6 }]}
                    onPress={() => {
                      Alert.alert('Export Complete', 'Registry Data exported successfully to standard local storage (CSV format).');
                    }}
                  >
                    <Database size={14} color="#fff" />
                    <Text style={styles.syncText}>EXPORT REGISTRY DATA (CSV)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.slate },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  headerContainer: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#BAE6FD',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden'
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: Platform.OS === 'ios' ? 44 : 36,
  },
  decorSquircle: {
    position: 'absolute',
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    opacity: 0.25,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textLight },
  headerSub: { fontSize: 9, fontWeight: '900', color: COLORS.primary, marginTop: 2, letterSpacing: 0.8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  statusText: { fontSize: 9, fontWeight: '900', color: COLORS.success, letterSpacing: 0.5 },
  quickStatsRow: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  statCard: { width: '48%', backgroundColor: COLORS.slateCard, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  statIconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statValue: { fontSize: 20, fontWeight: '900', color: COLORS.textLight },
  statLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginTop: 4, lineHeight: 14 },
  tabPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15, 23, 42, 0.03)', borderColor: COLORS.border, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  tabPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabPillText: { fontSize: 11, fontWeight: '900', color: COLORS.textMuted },
  feedContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 100 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.textLight },
  sectionSub: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, lineHeight: 16 },
  grid: { flexDirection: 'column', gap: 12 },
  card: { backgroundColor: COLORS.slateCard, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 13, fontWeight: '900', color: COLORS.textLight },
  metricRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  metric: { flex: 1 },
  metricVal: { fontSize: 18, fontWeight: '900', color: COLORS.textLight },
  metricLbl: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, marginTop: 4 },
  metricDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
  integrityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  integrityItem: { flex: 1 },
  integrityDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
  integrityVal: { fontSize: 18, fontWeight: '900', color: COLORS.textLight },
  integrityLbl: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, marginTop: 4 },
  syncBtn: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 10, borderRadius: 14 },
  syncText: { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  miniNote: { marginTop: 8, fontSize: 10, fontWeight: '600', color: COLORS.textMuted, lineHeight: 14 },
  playItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  playIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  playTitle: { fontSize: 13, fontWeight: '900', color: COLORS.textLight },
  playSub: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },
  emptyState: { paddingVertical: 32, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '900', color: COLORS.textLight },
  emptySub: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 20, lineHeight: 16 },
  queueItem: { flexDirection: 'row', backgroundColor: COLORS.slateCard, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  queueAccent: { width: 5 },
  queueAuthor: { fontSize: 13, fontWeight: '900', color: COLORS.textLight },
  queueRole: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },
  queueContent: { marginTop: 10, fontSize: 12, fontWeight: '600', color: COLORS.textLight, lineHeight: 16 },
  queueMetaRow: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' },
  queueMetaText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  queueActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  btn: { flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  btnText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  btnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  btnOutline: { backgroundColor: 'transparent', borderColor: COLORS.border },
  btnOutlineDanger: { backgroundColor: 'transparent', borderColor: 'rgba(239,68,68,0.2)' },
  btnDanger: { backgroundColor: COLORS.danger, borderColor: COLORS.danger, paddingHorizontal: 10, flex: 0, minWidth: 40 },
  analyticsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  analyticsDot: { width: 8, height: 8, borderRadius: 4 },
  analyticsLbl: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },
  analyticsVal: { fontSize: 12, fontWeight: '900', color: COLORS.textLight, marginLeft: 'auto' },
  qualityItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  qualityDot: { width: 8, height: 8, borderRadius: 4 },
  qualityTitle: { fontSize: 12, fontWeight: '900', color: COLORS.textLight },
  qualitySub: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },
  qualityVal: { fontSize: 16, fontWeight: '900', color: COLORS.textLight, marginLeft: 'auto' },
  telemetryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  telemetryItem: { width: '48%', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12, gap: 4 },
  telemetryDot: { width: 8, height: 8, borderRadius: 4 },
  telemetryLbl: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  telemetryVal: { fontSize: 14, fontWeight: '900', color: COLORS.textLight, marginTop: 2 },
  // Barangay Selectors for Clinical Cases Console
  brgyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  brgyPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  brgyPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  activeCasesDot: {
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  activeCasesDotText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
