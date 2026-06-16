import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Switch, Platform, Modal, TextInput, Share, Alert, KeyboardAvoidingView, Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  User, Settings, Shield, Award, Bell, LogOut, ChevronRight, BadgeCheck,
  Star, Activity, Edit3, Share2, Camera, X, CheckCircle2, Target, Zap, Map,
  TrendingUp, Flame, BookOpen, Navigation, Sparkles, Globe,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle as SvgCircle, G, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { DatabaseService, supabase } from '../../lib/supabase';
import { useTranslation, changeGlobalLanguage } from '../../hooks/useTranslation';


const COLORS = {
  primary: '#0EA5E9',
  secondary: '#0284C7',
  accent: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
  pink: '#EC4899',
  white: '#FFFFFF',
  slate: '#0F172A',
  slateLight: '#64748B',
  slateDark: '#0C4A6E',
  bg: '#F8FAFC',
};

const BADGES = [
  { id: '1', label: 'Sentinel', icon: Shield, color: COLORS.primary, bg: '#E0F2FE', type: 'level', target: 3 },
  { id: '2', label: 'Elite', icon: Star, color: COLORS.accent, bg: '#FEF3C7', type: 'level', target: 8 },
  { id: '3', label: 'Verified', icon: BadgeCheck, color: COLORS.success, bg: '#DCFCE7', type: 'level', target: 15 },
  { id: '4', label: 'Slayer', icon: Target, color: COLORS.danger, bg: '#FEE2E2', type: 'missions', target: 5 },
  { id: '5', label: 'Streak Master', icon: Flame, color: COLORS.pink, bg: '#FCE7F3', type: 'streak', target: 7 },
  { id: '6', label: 'RF Specialist', icon: Zap, color: '#8B5CF6', bg: '#EDE9FE', type: 'points', target: 1000 },
];

const BADGE_DESCRIPTIONS: Record<string, string> = {
  '1': 'Vanguard tier defender. Earned by demonstrating vigilance and reaching Level 3.',
  '2': 'High-performance sentinel. Awarded to active community coordinators who reach Level 8.',
  '3': 'Official validator. Reached at Level 15. Your reports carry high community priority and automatic verification.',
  '4': 'Active search & destroy champion. Unlocked by completing at least 5 field or community missions.',
  '5': 'Dengue-prevention streak master. Unlocked by maintaining your daily task checklist for 7+ consecutive days.',
  '6': 'Outbreak Prediction Specialist. Unlocked by accumulating 1,000+ total XP points on AEDE.'
};

const DAILY_QUESTS_POOL = [
  { id: 'daily_1', title: 'Empty pooled water in containers & flower pots', points_reward: 30, category: 'field' },
  { id: 'daily_2', title: 'Inspect outdoor rain gutters and search for stagnant pools', points_reward: 40, category: 'field' },
  { id: 'daily_3', title: 'Apply insect repellent (Self-protection shield)', points_reward: 20, category: 'intel' },
  { id: 'daily_4', title: 'Inspect local school perimeter containers', points_reward: 40, category: 'community' },
  { id: 'daily_5', title: 'Perform 4 O\'Clock container search-and-destroy', points_reward: 50, category: 'field' },
  { id: 'daily_6', title: 'Double check window screens for holes/mosquito entry', points_reward: 30, category: 'field' },
  { id: 'daily_7', title: 'Verify satellite-derived risk hotspot on map', points_reward: 30, category: 'intel' },
  { id: 'daily_8', title: 'Share official dengue warning to neighbors', points_reward: 25, category: 'community' },
  { id: 'daily_9', title: 'Use AI vision scanner to audit stagnant water puddle', points_reward: 50, category: 'intel' },
];

type Mission = {
  id: string;
  title: string;
  completed: boolean;
  points: number;
  route?: string;
  category: 'intel' | 'field' | 'community';
};

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [userName, setUserName] = useState('');
  const [userBio, setUserBio] = useState('');
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [preventionStreak, setPreventionStreak] = useState(0);
  const [weeklySites, setWeeklySites] = useState(0);
  const [missions, setMissions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [activeCountry, setActiveCountry] = useState('Philippines');
  const [currentUserUsername, setCurrentUserUsername] = useState('');
  const [secretTaps, setSecretTaps] = useState(0);
  const [dailyMissions, setDailyMissions] = useState<any[]>([]);
  const [userPoints, setUserPoints] = useState(0);

  // Badge Details Modal States
  const [selectedBadge, setSelectedBadge] = useState<any>(null);
  const [isBadgeModalVisible, setIsBadgeModalVisible] = useState(false);
  const [selectedBadgeUnlocked, setSelectedBadgeUnlocked] = useState(false);
  const [selectedBadgeRequirement, setSelectedBadgeRequirement] = useState('');

  const fetchProfileAndMissions = async () => {
    try {
      const profile = await DatabaseService.getLocalUserProfile();
      if (profile) {
        setUserName(profile.full_name || '');
        setUserBio(profile.bio || 'Dengue surveillance operator · Naga City Guardian');
        setUserRole(profile.role || '');
        setCurrentUserUsername(profile.username || '');
        
        // Level 1-100 Dynamic XP Calculation
        // XP_Required = (Level - 1)^1.5 * 100
        const totalPoints = profile.points || 0;
        const derivedLevel = Math.min(100, Math.floor(Math.pow(totalPoints / 100, 2/3)) + 1);
        const currentLevelBaseXP = Math.pow(derivedLevel - 1, 1.5) * 100;
        const nextLevelBaseXP = Math.pow(derivedLevel, 1.5) * 100;
        
        setLevel(derivedLevel);
        setXp(totalPoints - currentLevelBaseXP); // XP within current level
        setPreventionStreak(profile.streak || 0);
        setUserPoints(totalPoints);
      }
      
      const country = await AsyncStorage.getItem('@aede:active_country') || 'Philippines';
      setActiveCountry(country);

      // Load local daily quests
      const todayStr = new Date().toISOString().split('T')[0];
      const storedDaily = await AsyncStorage.getItem('@aede:daily_missions_state');
      let currentDaily = [];
      if (storedDaily) {
        const parsed = JSON.parse(storedDaily);
        if (parsed.date === todayStr) {
          currentDaily = parsed.missions;
        }
      }
      
      if (currentDaily.length === 0) {
        let seed = 0;
        for (let i = 0; i < todayStr.length; i++) {
          seed += todayStr.charCodeAt(i);
        }
        
        const selectedIndices = new Set<number>();
        while (selectedIndices.size < 3) {
          const idx = Math.abs((seed + selectedIndices.size * 17) % DAILY_QUESTS_POOL.length);
          selectedIndices.add(idx);
        }
        
        currentDaily = Array.from(selectedIndices).map(idx => ({
          ...DAILY_QUESTS_POOL[idx],
          completed: false
        }));
        
        await AsyncStorage.setItem('@aede:daily_missions_state', JSON.stringify({
          date: todayStr,
          missions: currentDaily
        }));
      }
      setDailyMissions(currentDaily);
      
      const dbMissions = await DatabaseService.getMissions();
      setMissions(dbMissions);
      
      const completedFields = dbMissions.filter((m: any) => m.completed).length;
      setWeeklySites(completedFields);

      const topProfiles = await DatabaseService.getLeaderboard();
      setLeaderboard(topProfiles);
    } catch (e) {
      console.warn('Failed to load profile/missions:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const completeDailyMission = async (id: string, points: number) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const updatedMissions = dailyMissions.map(m => {
        if (m.id === id) {
          return { ...m, completed: true };
        }
        return m;
      });
      setDailyMissions(updatedMissions);
      await AsyncStorage.setItem('@aede:daily_missions_state', JSON.stringify({
        date: todayStr,
        missions: updatedMissions
      }));

      const currentProfile = await DatabaseService.getLocalUserProfile();
      const newPoints = (currentProfile.points || 0) + points;
      const newMissionsCount = (currentProfile.completed_missions || 0) + 1;
      
      await DatabaseService.updateLocalUserProfile({
        points: newPoints,
        completed_missions: newMissionsCount
      });

      setUserPoints(newPoints);
      
      const derivedLevel = Math.min(100, Math.floor(Math.pow(newPoints / 100, 2/3)) + 1);
      const currentLevelBaseXP = Math.pow(derivedLevel - 1, 1.5) * 100;
      
      setLevel(derivedLevel);
      setXp(newPoints - currentLevelBaseXP);

      Alert.alert(
        '🎉 Quest Complete!', 
        `Outstanding job, Cadet! You earned +${points} XP.\nKeep doing your daily habits to protect the community.`,
        [{ text: 'Dismiss' }]
      );
    } catch (e) {
      console.warn('Failed to complete daily mission:', e);
    }
  };

  const handleBadgePress = (badge: any, isUnlocked: boolean, requirementText: string) => {
    setSelectedBadge(badge);
    setSelectedBadgeUnlocked(isUnlocked);
    setSelectedBadgeRequirement(requirementText);
    setIsBadgeModalVisible(true);
  };

  const handleSecretTap = async () => {
    const nextTaps = secretTaps + 1;
    if (nextTaps >= 5) {
      setSecretTaps(0);
      const newRole = userRole === 'LGU Administrator' ? 'Guardian Cadet' : 'LGU Administrator';
      setUserRole(newRole);
      
      try {
        const profileStr = await AsyncStorage.getItem('@aede:user_profile');
        if (profileStr) {
          const profile = JSON.parse(profileStr);
          profile.role = newRole;
          await AsyncStorage.setItem('@aede:user_profile', JSON.stringify(profile));
        }
        Alert.alert('Developer Mode', `Local role toggled to: ${newRole}. Refresh the app to update view access.`);
      } catch (e) {
        console.error(e);
      }
    } else {
      setSecretTaps(nextTaps);
    }
  };

  useEffect(() => {
    fetchProfileAndMissions();
  }, []);

  const completedMissions = missions.filter(m => m.completed).length;
  const consistency = missions.length > 0 ? Math.round((completedMissions / missions.length) * 100) : 0;
  const watchedZones = 3 + completedMissions;

  const toggleMission = (mission: any) => {
    if (mission.completed) return;
    const route = mission.route || (mission.title.toLowerCase().includes('map') ? '/map' : mission.title.toLowerCase().includes('ai') ? '/report' : '/explore');
    
    Alert.alert(
      'Complete this mission',
      'Open the linked screen to finish this task, or mark it done directly.',
      [
        { text: 'Go now', onPress: () => router.push(route as any) },
        { text: 'Mark done', onPress: () => completeMission(mission.id, mission.points_reward || 50) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const completeMission = async (id: string, points: number) => {
    try {
      await DatabaseService.completeMission(id, points);
      
      // Update local profile points
      const currentProfile = await DatabaseService.getLocalUserProfile();
      const newPoints = (currentProfile.points || 0) + points;
      const updatedProfile = await DatabaseService.updateLocalUserProfile({
        points: newPoints,
        completed_missions: (currentProfile.completed_missions || 0) + 1
      });
      
      if (updatedProfile) {
        const totalPoints = updatedProfile.points;
        const derivedLevel = Math.min(100, Math.floor(Math.pow(totalPoints / 100, 2/3)) + 1);
        const currentLevelBaseXP = Math.pow(derivedLevel - 1, 1.5) * 100;
        
        if (derivedLevel > level) {
          Alert.alert('Level Up!', `You reached Level ${derivedLevel}. Keep protecting the city.`);
        }
        setLevel(derivedLevel);
        setXp(totalPoints - currentLevelBaseXP);
      }
      
      // Re-fetch to sync
      await fetchProfileAndMissions();
    } catch (e) {
      console.error('Failed to complete mission:', e);
    }
  };

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isXPModalVisible, setIsXPModalVisible] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const [tempBio, setTempBio] = useState(userBio);
  const [notifications, setNotifications] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${userName}'s Katambay-AI Profile! Level ${level} Guardian · ${preventionStreak}-day prevention streak.`,
      });
    } catch (error: any) {
      Alert.alert(error.message);
    }
  };

  const saveProfile = () => {
    setUserName(tempName);
    setUserBio(tempBio);
    setIsEditModalVisible(false);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Return to the welcome screen?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Sign out', 
        style: 'destructive', 
        onPress: async () => {
          try {
            await supabase.auth.signOut();
            await AsyncStorage.removeItem('@aede:user_profile');
            await AsyncStorage.removeItem('@aede:privacy_agreed');
            router.replace('/');
          } catch (e) {
            console.error('Failed to sign out:', e);
          }
        } 
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <View style={styles.headerContainer}>
          <LinearGradient colors={['#BAE6FD', '#E0F2FE']} style={styles.headerBlue}>
            {/* Background Decorative Shapes */}
            <View style={[styles.decorSquircle, { top: -30, right: -40, width: 140, height: 140, transform: [{ rotate: '15deg' }] }]} />
            <View style={[styles.decorSquircle, { bottom: -40, left: -20, width: 110, height: 110, borderRadius: 28, opacity: 0.15, transform: [{ rotate: '-35deg' }] }]} />
            <View style={[styles.decorSquircle, { top: 60, left: 120, width: 44, height: 44, borderRadius: 12, opacity: 0.08, transform: [{ rotate: '45deg' }] }]} />

            <SafeAreaView>
              <View style={styles.topActions}>
                <TouchableOpacity style={styles.headerBtn} onPress={() => setIsEditModalVisible(true)}><Edit3 size={18} color={COLORS.slate} /></TouchableOpacity>
                <TouchableOpacity style={styles.headerBtn} onPress={handleShare}><Share2 size={18} color={COLORS.slate} /></TouchableOpacity>
              </View>

              <View style={styles.profileMain}>
                <View style={styles.headerContentRow}>
                  <View style={styles.avatarContainer}>
                    <View style={styles.avatarSquircle}>
                      <User size={38} color={COLORS.primary} />
                    </View>
                    <TouchableOpacity style={styles.editAvatarBtn} onPress={() => setIsEditModalVisible(true)}>
                      <Camera size={10} color="#FFF" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.headerLeftCol}>
                    <Text style={styles.userNameText} onPress={handleSecretTap}>{userName}</Text>
                    <Text style={styles.userBioText}>{userBio}</Text>
                    <View style={styles.rankPill}>
                      <Star size={10} color={COLORS.accent} fill={COLORS.accent} />
                      <Text style={styles.rankPillText}>{userRole || 'Guardian'} · Lv. {level}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>
        </View>

        <TouchableOpacity onPress={() => setIsXPModalVisible(true)} activeOpacity={0.8}>
          <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
            <View style={styles.progressHeader}>
              <Text style={styles.sectionTitle}>{t('profile.guardianLevel')}</Text>
              <Text style={styles.levelText}>Lv. {level}</Text>
            </View>
            <View style={styles.xpBarTrack}>
              <View style={[styles.xpBarFill, { width: `${Math.min(100, (xp / (Math.pow(level, 1.5) * 100 - Math.pow(level - 1, 1.5) * 100)) * 100)}%`, backgroundColor: COLORS.primary }]} />
            </View>
            <Text style={{ fontSize: 12, color: COLORS.slateLight, marginTop: 8, fontWeight: '500' }}>Tap to view XP & Leveling Guide</Text>
          </Animated.View>
        </TouchableOpacity>

        <Animated.View entering={FadeInDown.delay(150)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.shieldStrength')}</Text>
          <View style={styles.shieldCard}>
            <View style={styles.shieldLeft}>
              <View style={[styles.shieldIconSquircle, { backgroundColor: '#ECFDF5' }]}>
                <Shield size={32} color={COLORS.success} fill={COLORS.success} />
              </View>
            </View>
            <View style={styles.shieldRight}>
              <View style={styles.shieldHeaderRow}>
                <Sparkles size={14} color="#047857" fill="#047857" />
                <Text style={styles.shieldStatusTitle}>SHIELD STRENGTH: 75%</Text>
              </View>
              <View style={styles.shieldProgressTrack}>
                <View style={[styles.shieldProgressFill, { width: '75%', backgroundColor: COLORS.success }]} />
              </View>
              <Text style={styles.shieldStatusDesc}>Your preventive habits maintain a robust barrier, protecting your home perimeter.</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200)} style={styles.section}>
          <View style={styles.challengeCard}>
            <View style={styles.challengeIconBox}>
              <Target size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.challengeTitle}>{t('profile.challengeTitle')}</Text>
              <Text style={styles.challengeDesc}>{t('profile.challengeDesc')}</Text>
              <View style={styles.miniProgressTrack}>
                <View style={[styles.miniProgressFill, { width: `${(weeklySites / 3) * 100}%` }]} />
              </View>
              <Text style={styles.miniProgressText}>{weeklySites} of 3 completed · +200 XP reward on completion</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(250)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.lifestyleMetrics')}</Text>
          <View style={styles.lifestyleGrid}>
            <View style={styles.lifestyleCard}>
              <View style={[styles.squircleIconBox, { backgroundColor: '#FEF2F2' }]}>
                <Flame size={18} color={COLORS.danger} fill={COLORS.danger} />
              </View>
              <Text style={styles.lifestyleValue}>{preventionStreak} Days</Text>
              <Text style={styles.lifestyleLabel}>{t('profile.activeStreak')}</Text>
            </View>
            <View style={styles.lifestyleCard}>
              <View style={[styles.squircleIconBox, { backgroundColor: '#F0F9FF' }]}>
                <Map size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.lifestyleValue}>{watchedZones} Zones</Text>
              <Text style={styles.lifestyleLabel}>{t('profile.securedMap')}</Text>
            </View>
            <View style={styles.lifestyleCard}>
              <View style={[styles.squircleIconBox, { backgroundColor: '#ECFDF5' }]}>
                <TrendingUp size={18} color={COLORS.success} />
              </View>
              <Text style={styles.lifestyleValue}>{consistency}%</Text>
              <Text style={styles.lifestyleLabel}>{t('profile.consistency')}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(280)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.impactSummary')}</Text>
          <View style={styles.impactRow}>
            <View style={styles.impactCard}>
              <View style={[styles.squircleIconBox, { backgroundColor: '#F0F9FF', marginBottom: 8 }]}>
                <Activity size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.impactVal}>{completedMissions}</Text>
              <Text style={styles.impactLbl}>{t('profile.completedQuests')}</Text>
            </View>
            <View style={styles.impactCard}>
              <View style={[styles.squircleIconBox, { backgroundColor: '#FEF3C7', marginBottom: 8 }]}>
                <BookOpen size={18} color={COLORS.accent} />
              </View>
              <Text style={styles.impactVal}>{missions.filter(m => m.category === 'community').filter(m => m.completed).length}</Text>
              <Text style={styles.impactLbl}>{t('profile.healthAdvisories')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Daily Tasks Section */}
        <Animated.View entering={FadeInDown.delay(250)} style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>Daily Quests</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Flame size={12} color={COLORS.success} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.success }}>Streak: {preventionStreak}d</Text>
            </View>
          </View>
          <View style={styles.missionGroup}>
            {dailyMissions.map((mission) => (
              <TouchableOpacity 
                key={mission.id} 
                style={styles.missionItem} 
                onPress={() => {
                  if (!mission.completed) {
                    completeDailyMission(mission.id, mission.points_reward);
                  }
                }} 
                activeOpacity={0.75}
                disabled={mission.completed}
              >
                <View style={[styles.checkCircle, mission.completed && styles.checkCircleActive]}>
                  {mission.completed && <CheckCircle2 size={12} color="#FFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.missionText, mission.completed && styles.missionTextDone]}>{mission.title}</Text>
                  <View style={styles.missionMeta}>
                    <View style={[styles.categoryTag, { backgroundColor: mission.category === 'intel' ? '#F0F9FF' : mission.category === 'field' ? '#FDF2F8' : '#F0FDF4' }]}>
                      <Text style={[styles.categoryTagText, { color: mission.category === 'intel' ? COLORS.primary : mission.category === 'field' ? COLORS.pink : COLORS.success }]}>
                        {mission.category.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.xpRewardBadge}>
                  <Text style={styles.xpRewardText}>+{mission.points_reward} XP</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* LGU Command Desk Missions */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
          <Text style={styles.sectionTitle}>LGU Operations Desk</Text>
          <View style={styles.missionGroup}>
            {missions.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Target size={28} color={COLORS.primary} />
                </View>
                <Text style={styles.emptyTitle}>All Operations Synced</Text>
                <Text style={styles.emptySub}>No active daily missions deployed. Stand by for LGU command center radar notifications.</Text>
              </View>
            ) : (
              missions.map((mission) => (
                <TouchableOpacity key={mission.id} style={styles.missionItem} onPress={() => toggleMission(mission)} activeOpacity={0.75}>
                  <View style={[styles.checkCircle, mission.completed && styles.checkCircleActive]}>
                    {mission.completed && <CheckCircle2 size={12} color="#FFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.missionText, mission.completed && styles.missionTextDone]}>{mission.title}</Text>
                    <View style={styles.missionMeta}>
                      <View style={[styles.categoryTag, { backgroundColor: mission.category === 'intel' ? '#F0F9FF' : mission.category === 'field' ? '#FDF2F8' : '#F0FDF4' }]}>
                        <Text style={[styles.categoryTagText, { color: mission.category === 'intel' ? COLORS.primary : mission.category === 'field' ? COLORS.pink : COLORS.success }]}>
                          {mission.category.toUpperCase()}
                        </Text>
                      </View>
                      {!mission.completed && (
                        <View style={styles.missionRoute}>
                          <Navigation size={10} color={COLORS.primary} />
                          <Text style={styles.missionRouteText}>Start Action</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.xpRewardBadge}>
                    <Text style={styles.xpRewardText}>+{mission.points_reward || mission.points || 50} XP</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </Animated.View>

        {/* Badges System */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.sentinelBadges')}</Text>
          <View style={styles.badgeGrid}>
            {BADGES.map((badge) => {
              let isUnlocked = false;
              let requirementText = '';
              const completedMissionsCount = missions.filter(m => m.completed).length + dailyMissions.filter(m => m.completed).length;
              if (badge.type === 'level') {
                isUnlocked = level >= badge.target;
                requirementText = `Lv.${badge.target}`;
              } else if (badge.type === 'missions') {
                isUnlocked = completedMissionsCount >= badge.target;
                requirementText = `${badge.target} Quests`;
              } else if (badge.type === 'streak') {
                isUnlocked = preventionStreak >= badge.target;
                requirementText = `${badge.target}d Streak`;
              } else if (badge.type === 'points') {
                isUnlocked = userPoints >= badge.target;
                requirementText = `${badge.target} XP`;
              }
              return (
              <TouchableOpacity 
                key={badge.id} 
                style={[styles.badgeCard, { borderColor: badge.color + '33', opacity: isUnlocked ? 1 : 0.65 }]}
                onPress={() => handleBadgePress(badge, isUnlocked, requirementText)}
                activeOpacity={0.8}
              >
                <View style={[styles.badgeIconSquircle, { backgroundColor: isUnlocked ? badge.bg : '#F1F5F9' }]}>
                  <badge.icon size={22} color={isUnlocked ? badge.color : COLORS.slateLight} fill={isUnlocked && (badge.id === '2' || badge.id === '5') ? badge.color : 'transparent'} />
                </View>
                <Text style={[styles.badgeName, { color: COLORS.slate }]}>{badge.label}</Text>
                <Text style={[styles.badgeStatusText, !isUnlocked && { color: COLORS.slateLight }]}>{isUnlocked ? 'Unlocked' : requirementText}</Text>
              </TouchableOpacity>
            )})}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(450)} style={styles.section}>
          <View style={styles.leaderboardCard}>
            <View style={styles.lbHeader}>
              <View>
                <Text style={styles.lbTitle}>{t('profile.leaderboard')}</Text>
                <Text style={styles.lbSub}>{`Top active contributors in ${activeCountry === 'Singapore' ? 'Singapore' : 'Naga City'}`}</Text>
              </View>
              <Award size={18} color={COLORS.primary} />
            </View>
            {leaderboard.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
                <User size={18} color={COLORS.slateLight} style={{ opacity: 0.5, marginBottom: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.slate }}>No active guardians registered</Text>
                <Text style={{ fontSize: 10, color: COLORS.slateLight, fontWeight: '700', marginTop: 2 }}>Missions and points completed will sync here in real-time.</Text>
              </View>
            ) : (
              leaderboard.map((item, idx) => {
                const isSelf = item.username === currentUserUsername;
                return (
                  <View key={item.username || idx} style={[styles.lbRow, isSelf && styles.lbRowSelf]}>
                    <View style={[styles.lbRank, isSelf && { backgroundColor: COLORS.secondary }]}><Text style={[styles.lbRankText, isSelf && { color: '#FFF' }]}>#{idx + 1}</Text></View>
                    <View style={[styles.lbAvatar, { backgroundColor: COLORS.primary }]}><User size={12} color="#FFF" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lbName}>{item.full_name || item.username}</Text>
                      <Text style={styles.lbRoleText}>{item.role || 'Guardian'}</Text>
                    </View>
                    <Text style={styles.lbScore}>{item.points || 0} pts</Text>
                  </View>
                );
              })
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.guardianPreferences')}</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: '#F0F9FF' }]}><Bell size={18} color={COLORS.primary} /></View>
                <Text style={styles.settingText}>{t('profile.pushAlerts')}</Text>
              </View>
              <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: '#E2E8F0', true: '#BAE6FD' }} thumbColor={notifications ? COLORS.primary : '#F8FAFC'} />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: '#ECFDF5' }]}><Map size={18} color={COLORS.success} /></View>
                <Text style={styles.settingText}>{activeCountry === 'Singapore' ? 'Location-Calibrated Region Indexes' : t('profile.locationIndexes')}</Text>
              </View>
              <Switch value={locationEnabled} onValueChange={setLocationEnabled} trackColor={{ false: '#E2E8F0', true: '#BBF7D0' }} thumbColor={locationEnabled ? COLORS.success : '#F8FAFC'} />
            </View>
            <TouchableOpacity 
              style={styles.settingItem} 
              onPress={() => {
                const newCountry = activeCountry === 'Philippines' ? 'Singapore' : 'Philippines';
                Alert.alert(
                  'Switch Country Context',
                  `Switching to ${newCountry} will update all map layers and dynamic telemetry dashboards. Proceed?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Switch', 
                      onPress: async () => {
                        await AsyncStorage.setItem('@aede:active_country', newCountry);
                        setActiveCountry(newCountry);
                        await changeGlobalLanguage('English');
                        Alert.alert('Context Synced', `App environment set to ${newCountry}. Language reset to English.`);
                        fetchProfileAndMissions();
                      }
                    }
                  ]
                );
              }}
            >
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: '#F0F9FF' }]}><Map size={18} color={COLORS.primary} /></View>
                <Text style={styles.settingText}>{t('profile.activeCountry')}: {activeCountry}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.primary }}>{t('profile.switchCountry')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.settingItem} 
              onPress={() => {
                const options = activeCountry === 'Singapore' 
                  ? ['English', 'Malay', 'Mandarin'] 
                  : ['English', 'Tagalog'];
                
                Alert.alert(
                  'Select App Language',
                  `Choose a language for the application UI and Chatbot in ${activeCountry}`,
                  options.map(lang => ({
                    text: lang,
                    onPress: async () => {
                      await changeGlobalLanguage(lang);
                    }
                  })).concat([{ text: 'Cancel', style: 'cancel', onPress: () => {} } as any])
                );
              }}
            >
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: '#F3E8FF' }]}><Globe size={18} color="#8B5CF6" /></View>
                <Text style={styles.settingText}>{t('profile.assistantLanguage')}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#8B5CF6' }}>{t('profile.changeLanguage')}</Text>
            </TouchableOpacity>

            {(userRole === 'LGU Administrator' || userRole === 'Super Admin') && (
              <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/admin')}>
                <View style={styles.settingInfo}>
                  <View style={[styles.settingIcon, { backgroundColor: '#0F172A' }]}><Shield size={18} color="#FFF" /></View>
                  <Text style={styles.settingText}>{t('profile.adminDash')}</Text>
                </View>
                <ChevronRight size={18} color={COLORS.slateLight} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.settingItem, { borderBottomWidth: 0 }]} onPress={handleSignOut}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: '#FEF2F2' }]}><LogOut size={18} color={COLORS.danger} /></View>
                <Text style={[styles.settingText, { color: COLORS.danger }]}>{t('profile.signOut')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Footer removed */}
      </ScrollView>

      <Modal visible={isXPModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.editModal, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>XP & Leveling Guide</Text>
              <TouchableOpacity onPress={() => setIsXPModalVisible(false)}><X size={24} color={COLORS.slate} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 14, color: COLORS.slateLight, marginBottom: 16 }}>
                Complete daily missions and submit verified community reports to earn XP. 
                Below is the XP required to reach each Guardian tier.
              </Text>
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16 }}>
                {[...Array(10)].map((_, i) => {
                  const displayLevel = (i + 1) * 10;
                  const requiredXP = Math.floor(Math.pow(displayLevel - 1, 1.5) * 100);
                  return (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i === 9 ? 0 : 1, borderBottomColor: '#E2E8F0' }}>
                      <Text style={{ fontWeight: '700', color: COLORS.slateDark }}>Level {displayLevel}</Text>
                      <Text style={{ color: COLORS.primary, fontWeight: '600' }}>{requiredXP} XP</Text>
                    </View>
                  )
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={styles.editModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={() => setIsEditModalVisible(false)}><X size={24} color={COLORS.slate} /></TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Display Name</Text>
                <TextInput style={styles.textInput} value={tempName} onChangeText={setTempName} placeholder="Enter name" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]} value={tempBio} onChangeText={setTempBio} placeholder="Tell us about yourself" multiline />
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
                <CheckCircle2 size={20} color="#FFF" /><Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Badge Details Modal */}
      <Modal visible={isBadgeModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.editModal, { maxWidth: 320, padding: 24, alignItems: 'center' }]}>
            {selectedBadge && (
              <>
                <View style={[styles.badgeIconSquircle, { width: 72, height: 72, borderRadius: 20, backgroundColor: selectedBadgeUnlocked ? selectedBadge.bg : '#F1F5F9', marginBottom: 16, alignItems: 'center', justifyContent: 'center' }]}>
                  <selectedBadge.icon size={36} color={selectedBadgeUnlocked ? selectedBadge.color : COLORS.slateLight} fill={selectedBadgeUnlocked && (selectedBadge.id === '2' || selectedBadge.id === '5') ? selectedBadge.color : 'transparent'} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '900', color: COLORS.slate, marginBottom: 4 }}>{selectedBadge.label}</Text>
                <View style={{ backgroundColor: selectedBadgeUnlocked ? '#DCFCE7' : '#F1F5F9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 16 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: selectedBadgeUnlocked ? COLORS.success : COLORS.slateLight }}>
                    {selectedBadgeUnlocked ? 'UNLOCKED' : `LOCKED · Target: ${selectedBadgeRequirement}`}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: COLORS.slateLight, textAlign: 'center', lineHeight: 18, marginBottom: 24 }}>
                  {BADGE_DESCRIPTIONS[selectedBadge.id]}
                </Text>
                <TouchableOpacity style={[styles.saveBtn, { width: '100%', justifyContent: 'center', backgroundColor: selectedBadgeUnlocked ? selectedBadge.color : COLORS.slate }]} onPress={() => setIsBadgeModalVisible(false)}>
                  <Text style={styles.saveBtnText}>Close Details</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { paddingBottom: 130 },
  headerContainer: { marginBottom: 24 },
  headerBlue: { 
    paddingTop: Platform.OS === 'ios' ? 44 : 36, 
    paddingBottom: 28, 
    borderBottomLeftRadius: 36, 
    borderBottomRightRadius: 36, 
    borderBottomWidth: 1,
    borderBottomColor: '#BAE6FD',
  },
  decorSquircle: {
    position: 'absolute',
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    opacity: 0.25,
  },
  topActions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    gap: 10, 
    paddingHorizontal: 24, 
    marginBottom: 8 
  },
  headerBtn: { 
    width: 38, 
    height: 38, 
    borderRadius: 12, 
    backgroundColor: '#FFFFFF', 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  profileMain: { 
    paddingHorizontal: 24,
    alignItems: 'stretch'
  },
  headerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    justifyContent: 'flex-start'
  },
  headerLeftCol: {
    flex: 1,
    alignItems: 'flex-start'
  },
  avatarContainer: { 
    position: 'relative', 
  },
  avatarSquircle: { 
    width: 80, 
    height: 80, 
    borderRadius: 20, 
    backgroundColor: '#FFFFFF', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1.5,
    borderColor: '#E2E8F0'
  },
  editAvatarBtn: { 
    position: 'absolute', 
    bottom: -2, 
    right: -2, 
    backgroundColor: COLORS.slate, 
    width: 26, 
    height: 26, 
    borderRadius: 13, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 2, 
    borderColor: '#FFFFFF',
  },
  userNameText: { 
    fontSize: 20, 
    fontWeight: '900', 
    color: COLORS.secondary, 
    letterSpacing: -0.3,
    textAlign: 'left'
  },
  userBioText: { 
    fontSize: 11, 
    color: COLORS.slateLight, 
    marginTop: 4, 
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'left'
  },
  rankPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    backgroundColor: '#FFFFFF', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 10, 
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  rankPillText: { 
    fontSize: 9, 
    fontWeight: '800', 
    color: COLORS.primary 
  },
  section: { 
    paddingHorizontal: 24, 
    marginBottom: 28 
  },
  sectionTitle: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: COLORS.slate, 
    marginBottom: 12,
    letterSpacing: -0.2
  },
  progressHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  levelText: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: COLORS.primary 
  },
  xpBarTrack: { 
    height: 8, 
    backgroundColor: '#E2E8F0', 
    borderRadius: 4, 
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  xpBarFill: { 
    height: '100%', 
    borderRadius: 4 
  },
  xpSubText: { 
    fontSize: 9, 
    color: '#94A3B8', 
    fontWeight: '700', 
    marginTop: 5, 
    textAlign: 'right' 
  },
  challengeCard: { 
    padding: 16, 
    borderRadius: 20, 
    flexDirection: 'row', 
    gap: 12, 
    borderWidth: 1, 
    borderColor: '#E0F2FE',
    backgroundColor: '#F0F9FF',
  },
  challengeIconBox: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    backgroundColor: '#FFFFFF', 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  challengeTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: COLORS.slate 
  },
  challengeDesc: { 
    fontSize: 11, 
    color: COLORS.slateLight, 
    fontWeight: '600', 
    marginTop: 4, 
    lineHeight: 16 
  },
  miniProgressTrack: { 
    height: 6, 
    backgroundColor: 'rgba(14, 165, 233, 0.08)', 
    borderRadius: 3, 
    marginTop: 10, 
    overflow: 'hidden' 
  },
  miniProgressFill: { 
    height: '100%', 
    backgroundColor: COLORS.primary, 
    borderRadius: 3 
  },
  miniProgressText: { 
    fontSize: 9, 
    fontWeight: '700', 
    color: COLORS.primary, 
    marginTop: 5 
  },
  lifestyleGrid: { 
    flexDirection: 'row', 
    gap: 8 
  },
  lifestyleCard: { 
    flex: 1, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 12, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    alignItems: 'flex-start',
    gap: 8
  },
  squircleIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  lifestyleValue: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: COLORS.slate, 
  },
  lifestyleLabel: { 
    fontSize: 9, 
    fontWeight: '700', 
    color: COLORS.slateLight, 
  },
  impactRow: { 
    flexDirection: 'row', 
    gap: 10 
  },
  impactCard: { 
    flex: 1, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 14, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    alignItems: 'center', 
    gap: 4,
  },
  impactVal: { 
    fontSize: 20, 
    fontWeight: '900', 
    color: COLORS.slate 
  },
  impactLbl: { 
    fontSize: 10, 
    fontWeight: '700', 
    color: COLORS.slateLight, 
    textAlign: 'center' 
  },
  lguCard: { 
    borderRadius: 20, 
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lguGradient: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 16 
  },
  lguTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: '#FFFFFF' 
  },
  lguSub: { 
    fontSize: 10, 
    color: 'rgba(255,255,255,0.75)', 
    fontWeight: '600', 
    marginTop: 2 
  },
  missionGroup: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 20, 
    padding: 6, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
  },
  missionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F8FAFC' 
  },
  checkCircle: { 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    borderWidth: 2, 
    borderColor: '#CBD5E1', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  checkCircleActive: { 
    backgroundColor: COLORS.success, 
    borderColor: COLORS.success 
  },
  missionText: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: COLORS.slate,
    lineHeight: 18
  },
  missionTextDone: { 
    color: '#94A3B8', 
    textDecorationLine: 'line-through' 
  },
  missionMeta: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginTop: 6 
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 8,
    fontWeight: '900',
  },
  missionRoute: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 3 
  },
  missionRouteText: { 
    fontSize: 9, 
    fontWeight: '800', 
    color: COLORS.primary 
  },
  xpRewardBadge: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  xpRewardText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.success
  },
  badgeGrid: { 
    flexDirection: 'row', 
    gap: 10,
    justifyContent: 'space-between'
  },
  badgeCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6
  },
  badgeIconSquircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2
  },
  badgeName: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center'
  },
  badgeStatusText: {
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.slateLight,
    textTransform: 'uppercase'
  },
  settingsCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 20, 
    paddingHorizontal: 16, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
  },
  settingItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F8FAFC' 
  },
  settingInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10 
  },
  settingIcon: { 
    width: 36, 
    height: 36, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  settingText: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: COLORS.slate 
  },
  footer: { 
    alignItems: 'center', 
    paddingVertical: 16 
  },
  versionText: { 
    fontSize: 10, 
    fontWeight: '700', 
    color: '#94A3B8' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.4)', 
    justifyContent: 'flex-end' 
  },
  editModal: { 
    backgroundColor: '#FFFFFF', 
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28, 
    padding: 20, 
    paddingBottom: 36 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: '900', 
    color: COLORS.slate 
  },
  inputGroup: { 
    marginBottom: 16 
  },
  inputLabel: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: COLORS.slateLight, 
    marginBottom: 6 
  },
  textInput: { 
    backgroundColor: '#F8FAFC', 
    borderRadius: 12, 
    padding: 12, 
    fontSize: 14, 
    color: COLORS.slate, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    fontWeight: '600' 
  },
  saveBtn: { 
    backgroundColor: COLORS.primary, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    height: 48, 
    borderRadius: 14, 
    marginTop: 8 
  },
  saveBtnText: { 
    color: '#FFFFFF', 
    fontSize: 15, 
    fontWeight: '900' 
  },
  emptyState: { 
    paddingVertical: 28, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0F2FE'
  },
  emptyTitle: { 
    fontSize: 14, 
    fontWeight: '900', 
    color: COLORS.slate 
  },
  emptySub: { 
    fontSize: 11, 
    color: COLORS.slateLight, 
    fontWeight: '600', 
    textAlign: 'center', 
    marginTop: 4, 
    lineHeight: 16,
    paddingHorizontal: 20
  },
  shieldCard: {
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    backgroundColor: '#F0FDF4',
  },
  shieldLeft: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldIconSquircle: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldRight: {
    flex: 1,
    gap: 6,
  },
  shieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shieldStatusTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.8,
  },
  shieldProgressTrack: {
    height: 6,
    backgroundColor: '#DCFCE7',
    borderRadius: 3,
    overflow: 'hidden'
  },
  shieldProgressFill: {
    height: '100%',
    borderRadius: 3
  },
  shieldStatusDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
    lineHeight: 16,
    opacity: 0.85,
  },
  leaderboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lbHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  lbTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate,
    letterSpacing: -0.2,
  },
  lbSub: {
    fontSize: 11,
    color: COLORS.slateLight,
    fontWeight: '600',
    marginTop: 2,
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lbRowSelf: {
    backgroundColor: '#F8FAFC',
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderBottomWidth: 0,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lbRank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbRankText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.slate,
  },
  lbAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate,
  },
  lbRoleText: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.slateLight,
    marginTop: 1,
  },
  lbScore: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.slate,
  },
});
