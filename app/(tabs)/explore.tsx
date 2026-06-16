import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Eye,
  Filter,
  Heart,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Share2,
  ShieldAlert,
  User,
  X,
  BarChart2,
  Sparkles,
  Megaphone,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Shield,
  Star,
  Target,
  Flame,
  Zap,
  RefreshCw
} from 'lucide-react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Alert,
  Clipboard,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat, withSequence, withTiming
} from 'react-native-reanimated';
import { OFFICIAL_COMMUNITY_POSTS } from '../../constants/appData';
import { DatabaseService } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SINGAPORE_REGIONS } from '../../constants/singaporeRegions';
import { useTranslation } from '../../hooks/useTranslation';
import { runVisionScanner } from '../../lib/tfliteVision';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#2563EB',
  accent: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
  pink: '#EC4899',
  white: '#FFFFFF',
  slate: '#0F172A',
  slateLight: '#64748B',
  bg: '#F8FAFC',
};

const NAGA_LANDMARKS = [
  'Bicol Medical Center (BMC)',
  'Naga City General Hospital',
  'Bicol Access Health Centrum',
  'NICC Doctors Hospital',
  'Mother Seton Hospital',
  'SM City Naga',
  'Robinsons Place Naga',
  'Plaza Quince Martires',
  'Plaza Rizal',
  'Naga City Hall',
  'Magsaysay Avenue',
  'Dayangdang Zone 4',
  'Tabuco Market',
  'San Felipe',
  'Universidad de Santa Isabel',
  'Ateneo de Naga University'
];

const SG_LANDMARKS = [
  ...SINGAPORE_REGIONS.map(r => `${r.name}, Singapore`),
  'Singapore General Hospital (SGH)',
  'Tan Tock Seng Hospital (TTSH)',
  'Changi General Hospital (CGH)',
  'National University Hospital (NUH)',
  'Khoo Teck Puat Hospital (KTPH)',
  'Sengkang General Hospital (SKH)'
];

// ── Floating Decorative Element ──
const BackgroundGlow = ({ color, size, top, left }: any) => {
  const opacity = useSharedValue(0.1);
  React.useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.15, { duration: 4000 }), withTiming(0.1, { duration: 4000 })), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ position: 'absolute', top, left, width: size, height: size, borderRadius: size/2, backgroundColor: color, filter: 'blur(60px)' }, style]} />;
};

// -- Types ------------------------------------------------
type Post = {
  id: string;
  author: string;
  role: string;
  time: string;
  content: string;
  location: string;
  likes: number;
  comments: number;
  verified: boolean;
  type: 'alert' | 'update' | 'social';
  image?: string;
  isMisinfo?: boolean;
  isOfficial?: boolean;
  isLiked?: boolean;
  pinned?: boolean;
  status?: 'verified' | 'pending-review' | 'flagged';
  isPromo?: boolean;
};

const getAuthorBadges = (authorName: string) => {
  const name = authorName.toLowerCase().trim();
  if (name === 'maria santos') {
    return [
      { id: '1', icon: Shield, color: COLORS.primary },
      { id: '2', icon: Star, color: COLORS.accent },
      { id: '3', icon: BadgeCheck, color: COLORS.success },
      { id: '4', icon: Target, color: COLORS.danger },
      { id: '5', icon: Flame, color: COLORS.pink },
      { id: '6', icon: Zap, color: '#8B5CF6' }
    ];
  }
  if (name === 'ramon bautista') {
    return [
      { id: '1', icon: Shield, color: COLORS.primary },
      { id: '2', icon: Star, color: COLORS.accent },
      { id: '4', icon: Target, color: COLORS.danger },
      { id: '5', icon: Flame, color: COLORS.pink },
      { id: '6', icon: Zap, color: '#8B5CF6' }
    ];
  }
  if (name === 'wei ling tan') {
    return [
      { id: '1', icon: Shield, color: COLORS.primary },
      { id: '2', icon: Star, color: COLORS.accent },
      { id: '4', icon: Target, color: COLORS.danger },
      { id: '6', icon: Zap, color: '#8B5CF6' }
    ];
  }
  if (name === 'priya nair') {
    return [
      { id: '1', icon: Shield, color: COLORS.primary },
      { id: '2', icon: Star, color: COLORS.accent },
      { id: '4', icon: Target, color: COLORS.danger }
    ];
  }
  if (['juan dela cruz', 'bernard soriano', 'lorna navarro', 'david lim', 'emilio ramos', 'ana lopez'].includes(name)) {
    return [
      { id: '1', icon: Shield, color: COLORS.primary },
      { id: '4', icon: Target, color: COLORS.danger }
    ];
  }
  return [];
};

const getUserUnlockedBadges = (profile: any) => {
  if (!profile) return [];
  const badges = [];
  const points = profile.points || 0;
  const streak = profile.streak || 0;
  const completedMissionsCount = profile.completed_missions || 0;
  const level = Math.min(100, Math.floor(Math.pow(points / 100, 2/3)) + 1);

  if (level >= 3) badges.push({ id: '1', icon: Shield, color: COLORS.primary });
  if (level >= 8) badges.push({ id: '2', icon: Star, color: COLORS.accent });
  if (level >= 15) badges.push({ id: '3', icon: BadgeCheck, color: COLORS.success });
  if (completedMissionsCount >= 5) badges.push({ id: '4', icon: Target, color: COLORS.danger });
  if (streak >= 7) badges.push({ id: '5', icon: Flame, color: COLORS.pink });
  if (points >= 1000) badges.push({ id: '6', icon: Zap, color: '#8B5CF6' });
  return badges;
};

const resolvePostImage = (imageName: string | undefined) => {
  if (!imageName) return null;
  if (imageName === 'naga_dengue_cleanup') {
    return require('../../assets/images/naga_dengue_cleanup.png');
  }
  if (imageName === 'ovicidal_trap') {
    return require('../../assets/images/ovicidal_trap.png');
  }
  if (imageName === 'plaza_rizal_repellent') {
    return require('../../assets/images/plaza_rizal_repellent.png');
  }
  if (imageName === 'search_campaign_video_thumbnail') {
    return require('../../assets/images/search_campaign_video_thumbnail.png');
  }
  // Dynamic Web URL fallback
  return { uri: imageName };
};

type Comment = {
  id: string;
  author: string;
  role: string;
  content: string;
  time: string;
};

const generateMockComments = (postId: string, postContent: string, location: string, expectedCount = 0): Comment[] => {
  const isSG = location && location.toLowerCase().includes('singapore');
  
  const phNames = [
    { name: 'Juan dela Cruz', role: 'Guardian Cadet' },
    { name: 'Maria Santos', role: 'Guardian Elite' },
    { name: 'Jose Reyes', role: 'Guardian Cadet' },
    { name: 'Ana Lopez', role: 'Health Liaison' },
    { name: 'Pedro Ramos', role: 'Guardian Cadet' },
    { name: 'Luisa Garcia', role: 'Guardian Cadet' },
    { name: 'Ramon Bautista', role: 'Guardian Elite' },
    { name: 'Carmen Flores', role: 'Guardian Cadet' }
  ];

  const sgNames = [
    { name: 'Wei Ling Tan', role: 'Guardian Cadet' },
    { name: 'Ahmad Rashid', role: 'Guardian Cadet' },
    { name: 'Priya Nair', role: 'Guardian Elite' },
    { name: 'Jian Ming Lee', role: 'Guardian Cadet' },
    { name: 'Siti Yusof', role: 'Guardian Cadet' },
    { name: 'Rajan Krishnan', role: 'Guardian Cadet' }
  ];

  const pool = isSG ? sgNames : phNames;
  
  let hash = 0;
  for (let i = 0; i < postId.length; i++) {
    hash = postId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const numComments = expectedCount > 0 ? expectedCount : Math.abs(hash % 3) + 1;
  const commentsList: Comment[] = [];
  
  const phPhrases = [
    'Salamat sa pag-report! Dapat talaga malinis ito.',
    'Mag-ingat po kayo diyan sa area niyo.',
    'Sana maaksyunan agad ito ng Barangay Health Workers.',
    'Chineck ko din ang paso namin kanina, buti nalang malinis.',
    'Tama po, preventive measures muna bago lumala.',
    'Salamat sa alert! I-share ko po ito sa aming block.'
  ];

  const sgPhrases = [
    'Thanks for highlighting! Will do my Mozzie Wipeout today.',
    'Hope the Town Council acts on this corridor accumulation soon.',
    'Already checked my aircon tray after reading this. Safe!',
    'Stay safe everyone, dengue clusters are rising.',
    'Thanks for the report. Shared with my block neighbours.',
    'Good catch! We must keep Singapore safe from vector breeding.'
  ];

  const phrases = isSG ? sgPhrases : phPhrases;
  
  for (let j = 0; j < numComments; j++) {
    const nameIndex = Math.abs((hash + j * 7) % pool.length);
    const phraseIndex = Math.abs((hash + j * 13) % phrases.length);
    const timeIndex = Math.abs((hash + j * 3) % 4) + 1;
    
    commentsList.push({
      id: `${postId}-mock-${j}`,
      author: pool[nameIndex].name,
      role: pool[nameIndex].role,
      content: phrases[phraseIndex],
      time: `${timeIndex} ${timeIndex === 1 ? 'hour' : 'hours'} ago`
    });
  }
  
  return commentsList;
};

export default function ExploreScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState('All Posts');
  const [isPostModalVisible, setIsPostModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('Guardian Cadet');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isStatsModalVisible, setIsStatsModalVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{label: string, confidence: number, isHighRisk: boolean} | null>(null);

  // Simulated Video Player States
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [videoDuration, setVideoDuration] = useState<number>(90);

  const [activeCountry, setActiveCountry] = useState('Philippines');
  const [commentsState, setCommentsState] = useState<Record<string, Comment[]>>({});

  // Pure helper: filter by country, status, then pin-sort
  const filterAndSortPosts = useCallback((data: any[], profile: any, country: string) => {
    const filtered = data.filter((p: any) => {
      const isSGPost = p.location && p.location.toLowerCase().includes('singapore');
      const countryMatch = country === 'Singapore' ? isSGPost : !isSGPost;
      if (!countryMatch) return false;
      if (p.status === 'pending-review') return profile && p.author === profile.full_name;
      if (p.status === 'flagged') return false;
      return true;
    });
    const pinnedPosts = filtered.filter(p => p.pinned);
    const unpinnedPosts = filtered.filter(p => !p.pinned)
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
    return [...pinnedPosts, ...unpinnedPosts];
  }, []);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPosts = async () => {
    const profile = await DatabaseService.getLocalUserProfile();
    const country = await AsyncStorage.getItem('@aede:active_country') || 'Philippines';

    // PHASE 1: Stale-While-Revalidate — instantly render from local cache
    try {
      const cachedStr = await AsyncStorage.getItem('@aede:community_posts');
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (cached.length > 0) {
          setPosts(filterAndSortPosts(cached, profile, country));
          setLoading(false); // Unlock UI immediately
        }
      }
    } catch (_) { /* cache miss is fine */ }

    // PHASE 2: Background fetch from Supabase for fresh data
    try {
      const data = await DatabaseService.getPosts();
      setPosts(filterAndSortPosts(data, profile, country));
    } catch (e) {
      console.error('Background fetch failed:', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const profile = await DatabaseService.getLocalUserProfile();
      if (profile) {
        setUserName(profile.full_name || '');
        setUserRole(profile.role || 'Guardian Cadet');
        setUserProfile(profile);
      }
      const country = await AsyncStorage.getItem('@aede:active_country') || 'Philippines';
      setActiveCountry(country);
    } catch (err) {
      console.warn('Failed to load profile in Explore:', err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadPosts();
      loadUserProfile();
      DatabaseService.syncOfflineQueue();
    }, [])
  );

  // Simulated Video Player Progress Timer
  useEffect(() => {
    let interval: any = null;
    if (isVideoPlaying) {
      interval = setInterval(() => {
        setVideoProgress((prev) => {
          if (prev >= 100) {
            setIsVideoPlaying(false);
            return 0;
          }
          return prev + 1.5; // Tick progress forward
        });
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVideoPlaying]);

  const [postContent, setPostContent] = useState('');
  const [postLocation, setPostLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{id: string, type: string}[]>([]);

  const hashtag = activeCountry === 'Singapore' ? '#SGDataGuardian' : '#NagaDataGuardian';
  const displayCity = activeCountry === 'Singapore' ? 'Singapore' : 'Naga City';

  const handleLocationChange = (text: string) => {
    setPostLocation(text);
    if (text.length > 1) {
      const landmarks = activeCountry === 'Singapore' ? SG_LANDMARKS : NAGA_LANDMARKS;
      const filtered = landmarks.filter(l => 
        l.toLowerCase().includes(text.toLowerCase())
      );
      setLocationSuggestions(filtered);
    } else {
      setLocationSuggestions([]);
    }
  };

  const selectSuggestion = (name: string) => {
    setPostLocation(name);
    setLocationSuggestions([]);
  };

  const toggleLike = (id: string) => {
    const post = posts.find(p => p.id === id);
    if (post) {
      DatabaseService.toggleLikePost(id, !!post.isLiked);
    }
    setPosts(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 };
      }
      return p;
    }));
  };

  const handleShare = (post: Post) => {
    setSharePost(post);
    setIsShareModalVisible(true);
  };

  const handleReportPost = (id: string) => {
    Alert.alert('Report Post', 'Are you sure you want to report this post for review?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: () => Alert.alert('Reported', 'Thank you. Our moderators will review this post.') }
    ]);
  };

  const handleAddFile = async (type: string) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    };

    let result: ImagePicker.ImagePickerResult;
    if (type === 'Camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to capture evidence photos.');
        return;
      }
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery access is needed to attach evidence photos.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled && result.assets && result.assets[0]) {
      const uri = result.assets[0].uri;
      setSelectedImageUri(uri);
      setUploadedFiles([{ id: uri, type }]);
      
      // -- RUN AEDE VISION CNN SCANNER --
      setIsScanning(true);
      setScanResult(null);
      try {
        const analysis = await runVisionScanner(uri);
        setScanResult(analysis);
        setPostContent(prev => prev + `\n\n[AEDE Vision Analysis: ${analysis.label} (${analysis.confidence}%)]`);
      } catch (err) {
        console.warn('Vision scanner failed:', err);
      } finally {
        setIsScanning(false);
      }
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(uploadedFiles.filter(f => f.id !== id));
    setSelectedImageUri(null);
  };

  const addComment = () => {
    if (!commentPostId || !commentText.trim()) return;
    
    const authorName = userName || 'Anonymous Operator';
    const roleName = userRole || 'Guardian Cadet';
    
    const newComment: Comment = {
      id: `${commentPostId}-user-${Date.now()}`,
      author: authorName,
      role: roleName,
      content: commentText.trim(),
      time: 'Just now'
    };
    
    setCommentsState(prev => {
      const current = prev[commentPostId] || [];
      return { ...prev, [commentPostId]: [...current, newComment] };
    });

    setPosts(prev => prev.map(p => {
      if (p.id === commentPostId) {
        return { ...p, comments: p.comments + 1 };
      }
      return p;
    }));
    setCommentText('');
    Alert.alert('Comment posted', 'Your note was added to this discussion thread.');
  };

  const toggleSave = (id: string) => {
    setSavedPostIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const officialCount = posts.filter(p => p.isOfficial).length;

  const filteredPosts = useMemo(() => {
    let result = posts.filter(post => {
      const matchesSearch = post.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           post.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           post.location.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (activeFilter === 'All Posts') return true;
      if (activeFilter === 'Official News') return post.isOfficial || post.verified;
      if (activeFilter === 'My Reports') return post.status === 'pending-review';
      if (activeFilter === 'Saved') return savedPostIds.includes(post.id);
      return true;
    });

    result = [...result].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (sortBy === 'popular') return b.likes - a.likes;
      return 0;
    });

    return result;
  }, [posts, searchQuery, activeFilter, savedPostIds, sortBy]);

  const handleSubmitPost = async () => {
    if (!postContent.trim()) return;
    setIsSubmitting(true);
    try {
      // Upload image first if one was selected
      let imageUrl: string | undefined = undefined;
      if (selectedImageUri) {
        try {
          imageUrl = await DatabaseService.uploadPostImage(selectedImageUri);
        } catch (uploadErr) {
          console.warn('Image upload failed, posting without image:', uploadErr);
        }
      }
      const newPost = await DatabaseService.createPost(postContent, postLocation, userName, userRole, imageUrl);
      
      // Auto-badge if CNN flagged it as high risk
      if (scanResult?.isHighRisk) {
        (newPost as any).verified = true;
      }
      
      setPosts(prev => [newPost as any, ...prev]);
      setIsPostModalVisible(false);
      setPostContent('');
      setPostLocation('');
      setUploadedFiles([]);
      setSelectedImageUri(null);
      setScanResult(null);
      Alert.alert('Submitted', 'Your report is now pending verification before it appears as official intel.');
    } catch (e: any) {
      Alert.alert('Cooldown', e.message || 'Verification queue saved offline.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* -- Background Glows -- */}
      <BackgroundGlow color={COLORS.primary} size={300} top={-100} left={-100} />
      <BackgroundGlow color={COLORS.secondary} size={250} top={SCREEN_HEIGHT - 300} left={width - 150} />

      <View style={styles.headerContainer}>
        <LinearGradient colors={['#BAE6FD', '#E0F2FE']} style={styles.header}>
          {/* Background Decorative Shapes */}
          <View style={[styles.decorSquircle, { top: -30, right: -40, width: 130, height: 130, transform: [{ rotate: '15deg' }] }]} />
          <View style={[styles.decorSquircle, { bottom: -30, left: -20, width: 100, height: 100, borderRadius: 28, opacity: 0.15, transform: [{ rotate: '-35deg' }] }]} />
          <View style={[styles.decorSquircle, { top: 40, left: 140, width: 36, height: 36, borderRadius: 10, opacity: 0.08, transform: [{ rotate: '45deg' }] }]} />

          <SafeAreaView>
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <View>
                  <Text style={styles.headerTitle}>{t('feed.headerTitle')}</Text>
                  <Text style={styles.headerSub}>{t('feed.communityReports')}</Text>
                </View>
              </View>

              {/* -- NEW: Brand New Search Bar UI -- */}
              <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                  <Search size={18} color={COLORS.slateLight} />
                  <TextInput 
                    style={styles.searchInput} 
                    placeholder="Search reports..." 
                    placeholderTextColor={COLORS.slateLight}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <X size={16} color={COLORS.slateLight} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity style={styles.filterBtn} onPress={() => setIsFilterModalVisible(true)}>
                  <Filter size={18} color={COLORS.white} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.statsBtn} onPress={() => setIsStatsModalVisible(true)}>
                  <BarChart2 size={18} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      <View style={{ flex: 1 }}>

        {/* -- Filter Tabs + Refresh -- */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, flex: 1 }}>
            {['All Posts', 'Official News', 'My Reports'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterTab, activeFilter === filter && styles.filterTabActive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.filterTabText, activeFilter === filter && styles.filterTabTextActive]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => {
              setIsRefreshing(true);
              setLoading(true);
              loadPosts();
            }}
            disabled={isRefreshing}
          >
            <Animated.View style={isRefreshing ? { transform: [{ rotate: '360deg' }] } : undefined}>
              <RefreshCw size={18} color={isRefreshing ? COLORS.primary : COLORS.slateLight} />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* -- Feed (Virtualized FlatList for performance) -- */}
        <FlatList
          data={filteredPosts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.feedContent}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={7}
          removeClippedSubviews={true}
          ListHeaderComponent={
            activeFilter === 'All Posts' && searchQuery.length === 0 ? (
              <View style={styles.featuredCampaignsContainer}>
                <Text style={styles.featuredCampaignsTitle}>Active Health Campaigns</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={styles.featuredCampaignsScroll}
                >
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/report')}>
                    <Image 
                      source={require('../../assets/images/naga_dengue_cleanup.png')} 
                      style={styles.campaignCardImg} 
                      resizeMode="cover"
                    />
                    <View style={styles.campaignCardOverlay} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={styles.campaignCardTag}>CLEANUP SWEEP</Text>
                      <Text style={styles.campaignCardName}>Oplan Kulobong Campaign</Text>
                      <Text style={styles.campaignCardDesc}>Coordinated vector audit in Naga barangays</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/map')}>
                    <Image 
                      source={require('../../assets/images/ovicidal_trap.png')} 
                      style={styles.campaignCardImg} 
                      resizeMode="cover"
                    />
                    <View style={styles.campaignCardOverlay} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={styles.campaignCardTag}>VECTOR TRAP</Text>
                      <Text style={styles.campaignCardName}>Ovicidal Trap Deployment</Text>
                      <Text style={styles.campaignCardDesc}>Placing black larvicidal traps in school gardens</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/profile')}>
                    <Image 
                      source={require('../../assets/images/plaza_rizal_repellent.png')} 
                      style={styles.campaignCardImg} 
                      resizeMode="cover"
                    />
                    <View style={styles.campaignCardOverlay} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={styles.campaignCardTag}>AWARENESS DRIVE</Text>
                      <Text style={styles.campaignCardName}>Repellent Distribution</Text>
                      <Text style={styles.campaignCardDesc}>Distributing repellent sprays near Plaza Rizal</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 4 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/report')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1618967597143-ca6cf1e3260c?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={styles.campaignCardOverlay} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={styles.campaignCardTag}>FOGGING OPS</Text>
                      <Text style={styles.campaignCardName}>Chemical Vector Control</Text>
                      <Text style={styles.campaignCardDesc}>Targeted fogging in high-risk barangays</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 5 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/report')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={styles.campaignCardOverlay} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={styles.campaignCardTag}>EDUCATION</Text>
                      <Text style={styles.campaignCardName}>Dengue Awareness Week</Text>
                      <Text style={styles.campaignCardDesc}>School seminars on the DOH 4S Campaign</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 6 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/profile')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={styles.campaignCardOverlay} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={styles.campaignCardTag}>YOUTH DRIVE</Text>
                      <Text style={styles.campaignCardName}>Student Guardian Squad</Text>
                      <Text style={styles.campaignCardDesc}>USI & Ateneo de Naga student volunteers</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 7 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/report')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1581578017093-cd30fce4eeb7?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={styles.campaignCardOverlay} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={styles.campaignCardTag}>DRAINAGE</Text>
                      <Text style={styles.campaignCardName}>Storm Drain Clearance</Text>
                      <Text style={styles.campaignCardDesc}>Unclogging canals after heavy rainfall</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 8 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/map')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={[styles.campaignCardOverlay, { backgroundColor: '#7F1D1D', opacity: 0.5 }]} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={[styles.campaignCardTag, { color: '#FCA5A5' }]}>HOTSPOT ALERT</Text>
                      <Text style={styles.campaignCardName}>Dayangdang Zone 4</Text>
                      <Text style={styles.campaignCardDesc}>Elevated risk — active community response</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 9 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/report')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={styles.campaignCardOverlay} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={styles.campaignCardTag}>BARANGAY SWEEP</Text>
                      <Text style={styles.campaignCardName}>Door-to-Door Audit</Text>
                      <Text style={styles.campaignCardDesc}>Household container inspection by health workers</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 10 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/report')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={[styles.campaignCardOverlay, { backgroundColor: '#1E3A5F', opacity: 0.55 }]} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={[styles.campaignCardTag, { color: '#BAE6FD' }]}>HOSPITAL DRIVE</Text>
                      <Text style={styles.campaignCardName}>BMC Hydration Station</Text>
                      <Text style={styles.campaignCardDesc}>Free early dengue testing at Bicol Medical Center</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 11 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/report')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1544027993-37dbfe43562a?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={styles.campaignCardOverlay} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={styles.campaignCardTag}>MARKET CLEAN</Text>
                      <Text style={styles.campaignCardName}>Tabuco Market Sanitation</Text>
                      <Text style={styles.campaignCardDesc}>Weekly vendor area drainage clearance</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 12 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/report')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={[styles.campaignCardOverlay, { backgroundColor: '#14532D', opacity: 0.5 }]} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={[styles.campaignCardTag, { color: '#86EFAC' }]}>SCHOOL AUDIT</Text>
                      <Text style={styles.campaignCardName}>Weekly Container Log</Text>
                      <Text style={styles.campaignCardDesc}>CHED-mandated school safety inspection</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 13 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/map')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={[styles.campaignCardOverlay, { backgroundColor: '#0C4A6E', opacity: 0.55 }]} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={[styles.campaignCardTag, { color: '#7DD3FC' }]}>SG CAMPAIGN</Text>
                      <Text style={styles.campaignCardName}>NEA Mozzie Wipeout</Text>
                      <Text style={styles.campaignCardDesc}>Singapore weekly home inspection drive</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 14 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/report')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1526976780723-ac3d22b14be5?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={[styles.campaignCardOverlay, { backgroundColor: '#134E4A', opacity: 0.55 }]} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={[styles.campaignCardTag, { color: '#5EEAD4' }]}>WOLBACHIA</Text>
                      <Text style={styles.campaignCardName}>Project Wolbachia</Text>
                      <Text style={styles.campaignCardDesc}>NEA sterile mosquito release program SG</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 15 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/report')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={[styles.campaignCardOverlay, { backgroundColor: '#1E1B4B', opacity: 0.55 }]} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={styles.campaignCardTag}>DATA REPORT</Text>
                      <Text style={styles.campaignCardName}>DOH Region V Report</Text>
                      <Text style={styles.campaignCardDesc}>Bicol regional dengue surveillance data</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 16 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/report')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={[styles.campaignCardOverlay, { backgroundColor: '#0C4A6E', opacity: 0.5 }]} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={[styles.campaignCardTag, { color: '#38BDF8' }]}>SENSOR NODE</Text>
                      <Text style={styles.campaignCardName}>IoT Trap Deployment</Text>
                      <Text style={styles.campaignCardDesc}>Smart ovicidal sensors mapped on AEDE</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 17 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/map')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1508873696983-2df519f0397e?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={[styles.campaignCardOverlay, { backgroundColor: '#14532D', opacity: 0.45 }]} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={[styles.campaignCardTag, { color: '#86EFAC' }]}>TREE CANOPY</Text>
                      <Text style={styles.campaignCardName}>Green Habitat Control</Text>
                      <Text style={styles.campaignCardDesc}>Vegetation management in high-risk zones</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 18 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/report')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1541604193435-22419f56127e?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={[styles.campaignCardOverlay, { backgroundColor: '#831843', opacity: 0.5 }]} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={[styles.campaignCardTag, { color: '#FBCFE8' }]}>ELDER CARE</Text>
                      <Text style={styles.campaignCardName}>Senior Resident Support</Text>
                      <Text style={styles.campaignCardDesc}>Home visits for dengue prevention for seniors</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 19 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/profile')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={[styles.campaignCardOverlay, { backgroundColor: '#0EA5E9', opacity: 0.55 }]} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={[styles.campaignCardTag, { color: '#E0F2FE' }]}>BARANGAY CADET</Text>
                      <Text style={styles.campaignCardName}>Guardian Ranking Drive</Text>
                      <Text style={styles.campaignCardDesc}>Earn XP and climb the AEDE leaderboard</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card 20 */}
                  <TouchableOpacity style={styles.campaignCard} activeOpacity={0.9} onPress={() => router.push('/report')}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=400&q=80' }} style={styles.campaignCardImg} resizeMode="cover" />
                    <View style={[styles.campaignCardOverlay, { backgroundColor: '#1C1917', opacity: 0.55 }]} />
                    <View style={styles.campaignCardInfo}>
                      <Text style={[styles.campaignCardTag, { color: '#FDE68A' }]}>JOINT EFFORT</Text>
                      <Text style={styles.campaignCardName}>CDRRMO Field Ops</Text>
                      <Text style={styles.campaignCardDesc}>Multi-agency emergency response teams</Text>
                    </View>
                  </TouchableOpacity>

                  {/* PROMO PLACEHOLDER — tap to show Coming Soon */}
                  <TouchableOpacity 
                    style={[styles.campaignCard, { borderColor: '#0EA5E9', borderWidth: 2 }]} 
                    activeOpacity={0.85} 
                    onPress={() => Alert.alert('📢 Coming Soon!', 'The official AEDE promotional video and campaign materials will be available here soon. Stay tuned!')}
                  >
                    <View style={{ flex: 1, backgroundColor: '#0C4A6E', alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' }}>
                        <Text style={{ fontSize: 20 }}>▶</Text>
                      </View>
                      <Text style={{ color: '#7DD3FC', fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 }}>OFFICIAL PROMO</Text>
                      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900', textAlign: 'center', paddingHorizontal: 8 }}>AEDE Campaign Video</Text>
                      <Text style={{ color: '#BAE6FD', fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 4, paddingHorizontal: 8 }}>Promotional materials coming soon</Text>
                    </View>
                  </TouchableOpacity>

                </ScrollView>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyFeedContainer}>
              <MessageSquare size={36} color={COLORS.slateLight} style={{ opacity: 0.5, marginBottom: 8, alignSelf: 'center' }} />
              <Text style={styles.emptyFeedTitle}>No Community Postings</Text>
              <Text style={styles.emptyFeedSub}>No reports are currently pending or verified. Tap the floating button below to submit a citizen alert.</Text>
            </View>
          }
          renderItem={({ item: post }: { item: Post }) => (
            <Animated.View
              entering={FadeInDown.springify()}
              style={[
                styles.postCard,
                post.type === 'alert' && styles.postCardAlert,
                post.pinned && styles.postCardPinned,
              ]}
            >
              <View style={styles.postHeader}>
                <View style={styles.authorRow}>
                  <View style={styles.avatarSquircle}>
                    <User size={20} color={COLORS.primary} />
                  </View>
                  <View style={styles.authorTextCol}>
                    <View style={styles.authorTitleRow}>
                      <Text style={styles.authorName} numberOfLines={1}>{post.author}</Text>
                      {post.isOfficial && <BadgeCheck size={14} color={COLORS.primary} fill="#FFFFFF" style={{ marginLeft: 4 }} />}
                      {(() => {
                        const authorBadges = post.author === userName 
                          ? getUserUnlockedBadges(userProfile)
                          : getAuthorBadges(post.author);
                        return authorBadges.map((b) => (
                          <b.icon 
                            key={b.id} 
                            size={11} 
                            color={b.color} 
                            fill={b.id === '2' || b.id === '5' ? b.color : 'transparent'} 
                            style={{ marginLeft: 3 }} 
                          />
                        ));
                      })()}
                    </View>
                    <Text style={styles.authorRole} numberOfLines={1}>{post.role} · {post.time}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleReportPost(post.id)}><MoreHorizontal size={20} color={COLORS.slateLight} /></TouchableOpacity>
              </View>

              <View style={styles.badgesRow}>
                {post.pinned && (
                  <View style={styles.pinnedBadge}>
                    <CheckCircle2 size={10} color={COLORS.success} />
                    <Text style={styles.pinnedText}>PINNED</Text>
                  </View>
                )}
                {post.isPromo && (
                  <View style={styles.promoBadge}>
                    <Megaphone size={10} color={COLORS.white} />
                    <Text style={styles.promoText}>PROMOTIONAL</Text>
                  </View>
                )}
                {post.status === 'pending-review' && (
                  <View style={styles.pendingBadge}>
                    <Eye size={10} color={COLORS.accent} />
                    <Text style={styles.pendingText}>PENDING</Text>
                  </View>
                )}
                {post.isMisinfo && (
                  <View style={styles.misinfoBadge}>
                    <AlertTriangle size={10} color={COLORS.danger} />
                    <Text style={styles.misinfoText}>FLAGGED</Text>
                  </View>
                )}
              </View>

              {post.type === 'alert' && (
                <View style={styles.alertBanner}>
                  <AlertTriangle size={12} color={COLORS.secondary} />
                  <Text style={styles.alertBannerText}>HEALTH ADVISORY</Text>
                </View>
              )}
              <Text style={styles.postContent}>
                {post.content}{' '}
                <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{hashtag}</Text>
              </Text>

              {post.image && (() => {
                const resolved = resolvePostImage(post.image);
                if (!resolved) return null;
                const isVideoPost = post.isPromo && (post.content?.toLowerCase().includes('video') || post.type === 'alert');

                return (
                  <TouchableOpacity 
                    activeOpacity={isVideoPost ? 0.85 : 1}
                    onPress={() => {
                      if (isVideoPost) {
                        setVideoTitle(post.content?.substring(0, 45) + '...');
                        setActiveVideoUrl(post.image || null);
                        setVideoProgress(0);
                        setIsVideoPlaying(true);
                      }
                    }}
                    style={{ position: 'relative' }}
                    disabled={!isVideoPost}
                  >
                    <Image source={resolved} style={styles.postImage} resizeMode="cover" />
                    {isVideoPost && (
                      <View style={styles.playOverlay}>
                        <LinearGradient colors={['rgba(15, 23, 42, 0.4)', 'rgba(15, 23, 42, 0.6)']} style={styles.playOverlayGradient}>
                          <View style={styles.playCircle}>
                            <Play size={20} color={COLORS.white} fill={COLORS.white} style={{ marginLeft: 3 }} />
                          </View>
                          <Text style={styles.playText}>TAP TO WATCH CAMPAIGN VIDEO</Text>
                        </LinearGradient>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })()}

              <View style={styles.postMeta}>
                <View style={styles.locationTag}>
                  <MapPin size={12} color={COLORS.primary} />
                  <Text style={styles.locationText}>{post.location}</Text>
                </View>
              </View>

              <View style={styles.postActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
                  <Heart size={18} color={post.isLiked ? COLORS.primary : COLORS.slateLight} fill={post.isLiked ? COLORS.primary : 'transparent'} />
                  <Text style={[styles.actionCount, post.isLiked && { color: COLORS.primary }]}>{post.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setCommentPostId(post.id)}>
                  <MessageSquare size={18} color={COLORS.slateLight} />
                  <Text style={styles.actionCount}>{post.comments}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(post)}>
                  <Share2 size={18} color={COLORS.slateLight} />
                </TouchableOpacity>
                {post.isOfficial && (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => toggleSave(post.id)}>
                    <Eye size={18} color={savedPostIds.includes(post.id) ? COLORS.primary : COLORS.slateLight} />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          )}
        />

        {/* -- Floating Action Button -- */}
        <TouchableOpacity style={styles.fab} onPress={() => setIsPostModalVisible(true)}>
          <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.fabGradient}>
            <Plus size={24} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* -- Create Post Modal (Refined) -- */}
      <Modal visible={isPostModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={styles.createModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Intel Report</Text>
                <TouchableOpacity onPress={() => setIsPostModalVisible(false)}><X size={24} color={COLORS.slate} /></TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                <View style={styles.userPreview}>
                  <View style={styles.avatarCircle}>
                    <User size={20} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.previewName}>{userName}</Text>
                    <Text style={styles.previewRole}>{userRole} · {displayCity}</Text>
                  </View>
                </View>

                <TextInput
                  style={styles.contentInput}
                  placeholder="Describe the risk or situation..."
                  multiline
                  value={postContent}
                  onChangeText={setPostContent}
                  placeholderTextColor="#94A3B8"
                />

                <View style={styles.locationContainer}>
                  <View style={styles.locationRow}>
                    <MapPin size={16} color={COLORS.primary} />
                    <TextInput
                      style={styles.locationInput}
                      placeholder="Tagged Location (e.g. NICC)"
                      value={postLocation}
                      onChangeText={handleLocationChange}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {locationSuggestions.length > 0 && (
                    <View style={styles.suggestionList}>
                      {locationSuggestions.map((item) => (
                        <TouchableOpacity key={item} style={styles.suggestionItem} onPress={() => selectSuggestion(item)}>
                          <MapPin size={12} color={COLORS.slateLight} />
                          <Text style={styles.suggestionText}>{item}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* REFINED: Evidence & Files Section */}
                <View style={styles.mediaSection}>
                  <View style={styles.mediaHeader}>
                    <Text style={styles.mediaTitle}>Evidence & Files</Text>
                    <Text style={styles.fileCount}>{selectedImageUri ? '1 photo attached' : 'No files attached'}</Text>
                  </View>
                  
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filePreviewRow}>
                    <TouchableOpacity style={styles.addFileBtn} onPress={() => handleAddFile('Camera')}>
                      <Camera size={20} color={COLORS.primary} />
                      <Text style={styles.addFileText}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addFileBtn} onPress={() => handleAddFile('Gallery')}>
                      <ImageIcon size={20} color={COLORS.primary} />
                      <Text style={styles.addFileText}>Gallery</Text>
                    </TouchableOpacity>

                    {selectedImageUri && (
                      <View key="selected-img" style={styles.filePreviewCard}>
                        <Image 
                          source={{ uri: selectedImageUri }} 
                          style={{ width: '100%', height: '100%', borderRadius: 10 }} 
                          resizeMode="cover"
                        />
                        <TouchableOpacity style={styles.removeFileBtn} onPress={() => removeFile(selectedImageUri)}>
                          <X size={10} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </ScrollView>
                </View>

                {isSubmitting && (
                  <View style={styles.progressSection}>
                    <Text style={styles.progressLabel}>Uploading Report Data...</Text>
                    <View style={styles.progressBarBg}>
                      <Animated.View entering={FadeIn.duration(2000)} style={styles.progressBarFill} />
                    </View>
                  </View>
                )}

                <View style={styles.modalFooter}>
                  <TouchableOpacity style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} onPress={handleSubmitPost} disabled={isSubmitting}>
                    <Text style={styles.submitBtnText}>{isSubmitting ? 'TRANSMITTING...' : 'POST INTEL'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* -- AEDE Vision Scanner Modal -- */}
      <Modal visible={isScanning} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.85)' }]}>
          <View style={{ alignItems: 'center' }}>
            <Animated.View entering={FadeInDown} style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: 'rgba(14, 165, 233, 0.2)', borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
               <Eye size={40} color={COLORS.primary} />
               <Animated.View style={{ position: 'absolute', top: 0, width: '100%', height: 4, backgroundColor: COLORS.primary, shadowColor: COLORS.primary, shadowOpacity: 1, shadowRadius: 10, elevation: 10 }} />
            </Animated.View>
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#FFF', letterSpacing: 1 }}>AEDE VISION SCAN</Text>
            <Text style={{ fontSize: 12, color: COLORS.primary, marginTop: 4, fontWeight: '600' }}>ANALYZING VECTOR RISK...</Text>
          </View>
        </View>
      </Modal>

      {/* Filter modal */}
      <Modal visible={isFilterModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.createModal, { marginHorizontal: 24, borderRadius: 28, marginBottom: 'auto', marginTop: 'auto' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Feed filters</Text>
              <TouchableOpacity onPress={() => setIsFilterModalVisible(false)}><X size={24} color={COLORS.slate} /></TouchableOpacity>
            </View>
            <Text style={styles.filterModalLabel}>Sort by</Text>
            {(['recent', 'popular'] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.filterOption, sortBy === opt && styles.filterOptionActive]}
                onPress={() => setSortBy(opt)}
              >
                <Text style={[styles.filterOptionText, sortBy === opt && styles.filterOptionTextActive]}>
                  {opt === 'recent' ? 'Most recent (pinned first)' : 'Most liked'}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.submitBtn} onPress={() => setIsFilterModalVisible(false)}>
              <Text style={styles.submitBtnText}>APPLY</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Comments modal */}
      <Modal visible={!!commentPostId} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={[styles.createModal, { maxHeight: SCREEN_HEIGHT * 0.8 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Discussion</Text>
                <TouchableOpacity onPress={() => { setCommentPostId(null); setCommentText(''); }}><X size={24} color={COLORS.slate} /></TouchableOpacity>
              </View>
              
              <Text style={styles.commentHint}>Verified threads are moderated. Keep reports factual and location-specific.</Text>
              
              <ScrollView style={{ maxHeight: 220, marginBottom: 16 }} showsVerticalScrollIndicator={false}>
                {(() => {
                  if (!commentPostId) return null;
                  
                  let comments = commentsState[commentPostId];
                  if (!comments) {
                    const targetPost = posts.find(p => p.id === commentPostId);
                    comments = generateMockComments(commentPostId, targetPost?.content || '', targetPost?.location || '', targetPost?.comments || 0);
                    setCommentsState(prev => ({ ...prev, [commentPostId]: comments }));
                  }
                  
                  if (comments.length === 0) {
                    return (
                      <View style={{ padding: 24, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: COLORS.slateLight, fontWeight: '600' }}>No comments yet. Be the first to note!</Text>
                      </View>
                    );
                  }
                  
                  return comments.map((c: any) => (
                    <View key={c.id} style={styles.commentItem}>
                      <View style={styles.commentMeta}>
                        <View style={styles.commentAvatar}>
                          <User size={12} color={COLORS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.commentAuthor}>{c.author}</Text>
                          <Text style={styles.commentRole}>{c.role}</Text>
                        </View>
                        <Text style={styles.commentTime}>{c.time}</Text>
                      </View>
                      <Text style={styles.commentContent}>{c.content}</Text>
                    </View>
                  ));
                })()}
              </ScrollView>
              
              <View style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 }}>
                <TextInput
                  style={[styles.contentInput, { minHeight: 60, height: 60, marginBottom: 16, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 14 }]}
                  placeholder="Add a community note..."
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity style={styles.submitBtn} onPress={addComment}>
                  <Send size={18} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>POST COMMENT</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* -- Customized TikTok-Style Share Modal -- */}
      <Modal visible={isShareModalVisible} animationType="slide" transparent>
        <View style={styles.shareOverlay}>
          <TouchableOpacity 
            style={styles.shareBackdropDismiss} 
            activeOpacity={1} 
            onPress={() => setIsShareModalVisible(false)} 
          />
          <View style={styles.shareModalSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.shareHeader}>
              <Text style={styles.shareTitle}>Send to</Text>
              <TouchableOpacity onPress={() => setIsShareModalVisible(false)} style={styles.shareCloseBtn}>
                <X size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* Post Preview Card (Spotify/TikTok style) */}
            {sharePost && (
              <LinearGradient 
                colors={['#F0F9FF', '#FFFFFF']} 
                style={[
                  styles.sharePreviewCard,
                  sharePost.image ? { height: 320 } : { height: 180 }
                ]}
              >
                <View style={styles.sharePreviewHeader}>
                  <View style={styles.sharePreviewAvatarCircle}>
                    <User size={14} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sharePreviewAuthor} numberOfLines={1}>{sharePost.author}</Text>
                    <Text style={styles.sharePreviewRole} numberOfLines={1}>{sharePost.role} · {displayCity}</Text>
                  </View>
                  {sharePost.isOfficial && (
                    <View style={styles.sharePreviewBadge}>
                      <BadgeCheck size={10} color="#FFF" fill={COLORS.primary} />
                    </View>
                  )}
                </View>

                <ScrollView style={styles.sharePreviewScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.sharePreviewContent}>
                    {sharePost.content}{' '}
                    <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{hashtag}</Text>
                  </Text>
                </ScrollView>

                {sharePost.image && (() => {
                  const resolved = resolvePostImage(sharePost.image);
                  return resolved ? (
                    <Image source={resolved} style={styles.sharePreviewImage} resizeMode="cover" />
                  ) : null;
                })()}

                <View style={styles.sharePreviewFooter}>
                  <View style={styles.sharePreviewLocationTag}>
                    <MapPin size={10} color={COLORS.primary} />
                    <Text style={styles.sharePreviewLocationText} numberOfLines={1}>{sharePost.location}</Text>
                  </View>
                  <Text style={styles.sharePreviewBranding}>AEDE VECTOR INTEL</Text>
                </View>
              </LinearGradient>
            )}

            {/* Quick Share to Guardians Section */}
            <Text style={styles.sectionLabel}>Direct Share to Guardians</Text>
            <View style={styles.singleGuardianContainer}>
              <TouchableOpacity 
                style={styles.guardianContactCard}
                onPress={() => {
                  if (sharePost) {
                    const smsBody = `[AEDE Outbreak Alert] ${sharePost.author} reports from ${sharePost.location}: "${sharePost.content}"\n\n${hashtag}`;
                    Alert.alert(
                      'Submit Community Report',
                      'Select a destination channel to transmit this outbreak report:',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'LGU Guardians Hotline', 
                          onPress: () => {
                            Linking.openURL(`sms:911?body=${encodeURIComponent(smsBody)}`).catch(() => {
                              Alert.alert('Error', 'Unable to open SMS application.');
                            });
                          } 
                        },
                        { 
                          text: 'Custom Contact Number', 
                          onPress: () => {
                            Linking.openURL(`sms:?body=${encodeURIComponent(smsBody)}`).catch(() => {
                              Alert.alert('Error', 'Unable to open SMS application.');
                            });
                          } 
                        },
                      ]
                    );
                  }
                }}
              >
                <View style={[styles.guardianAvatarHorizontal, { backgroundColor: COLORS.primary }]}>
                  <User size={20} color="#FFF" />
                </View>
                <View style={styles.guardianContactInfo}>
                  <Text style={styles.guardianNameHorizontal}>Share to Guardians or Contacts</Text>
                  <Text style={styles.guardianRoleHorizontal}>Send vector alerts via SMS / Hotline</Text>
                  <Text style={styles.guardianContactNumber}>Emergency Dispatch Active</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Bottom Channels list */}
            <Text style={styles.sectionLabel}>Share via Channels</Text>
            <View style={styles.channelsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelsRow}>
                {/* Copy Link */}
                <TouchableOpacity 
                  style={styles.channelItem} 
                  onPress={() => {
                    const shareLink = activeCountry === 'Singapore' 
                      ? `https://katambay-ai.gov.sg/post/${sharePost ? sharePost.id : ''}`
                      : `https://katambay-ai.naga.gov.ph/post/${sharePost ? sharePost.id : ''}`;
                    if (Clipboard && Clipboard.setString) {
                      Clipboard.setString(shareLink);
                    }
                    Alert.alert('Link Copied', 'Community post link copied to clipboard successfully.');
                    setIsShareModalVisible(false);
                  }}
                >
                  <View style={[styles.channelIconCircle, { backgroundColor: '#F1F5F9' }]}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </Svg>
                  </View>
                  <Text style={styles.channelText}>Copy link</Text>
                </TouchableOpacity>

                {/* Facebook Stories */}
                <TouchableOpacity 
                  style={styles.channelItem}
                  onPress={() => {
                    if (sharePost) {
                      const shareText = `[AEDE Outbreak Alert] ${sharePost.author} reports from ${sharePost.location}: "${sharePost.content}"\n\n${hashtag}`;
                      const shareBaseUrl = activeCountry === 'Singapore' ? 'https://katambay-ai.gov.sg' : 'https://katambay-ai.naga.gov.ph';
                      const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${shareBaseUrl}&quote=${encodeURIComponent(shareText)}`;
                      setIsShareModalVisible(false);
                      Linking.openURL(fbUrl).catch(() => {
                        Linking.openURL('https://www.facebook.com');
                      });
                    }
                  }}
                >
                  <View style={[styles.channelIconCircle, { backgroundColor: '#1877F2' }]}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                    </Svg>
                  </View>
                  <Text style={styles.channelText}>Stories</Text>
                </TouchableOpacity>

                {/* WhatsApp */}
                <TouchableOpacity 
                  style={styles.channelItem}
                  onPress={() => {
                    if (sharePost) {
                      const shareText = `[AEDE Outbreak Alert] ${sharePost.author} reports from ${sharePost.location}: "${sharePost.content}"\n\n${hashtag}`;
                      const waUrl = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
                      setIsShareModalVisible(false);
                      Linking.openURL(waUrl).catch(() => {
                        Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`);
                      });
                    }
                  }}
                >
                  <View style={[styles.channelIconCircle, { backgroundColor: '#25D366' }]}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </Svg>
                  </View>
                  <Text style={styles.channelText}>WhatsApp</Text>
                </TouchableOpacity>

                {/* Instagram Stories */}
                <TouchableOpacity 
                  style={styles.channelItem}
                  onPress={() => {
                    if (sharePost) {
                      const shareText = `[AEDE Outbreak Alert] ${sharePost.author} reports from ${sharePost.location}: "${sharePost.content}"\n\n${hashtag}`;
                      if (Clipboard && Clipboard.setString) {
                        Clipboard.setString(shareText);
                      }
                    }
                    setIsShareModalVisible(false);
                    Linking.openURL('instagram://story-camera').catch(() => {
                      Linking.openURL('instagram://camera').catch(() => {
                        Linking.openURL('instagram://').catch(() => {
                          Linking.openURL('https://www.instagram.com');
                        });
                      });
                    });
                  }}
                >
                  <LinearGradient 
                    colors={['#F58529', '#DD2A7B', '#8134AF']} 
                    style={styles.channelIconCircle}
                  >
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <Path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <Path d="M17.5 6.5h.01" />
                    </Svg>
                  </LinearGradient>
                  <Text style={styles.channelText}>Stories</Text>
                </TouchableOpacity>

                {/* SMS */}
                <TouchableOpacity 
                  style={styles.channelItem}
                  onPress={() => {
                    if (sharePost) {
                      const shareText = `[AEDE Outbreak Alert] ${sharePost.author} reports from ${sharePost.location}: "${sharePost.content}"\n\n${hashtag}`;
                      setIsShareModalVisible(false);
                      Linking.openURL(`sms:?body=${encodeURIComponent(shareText)}`).catch(() => {
                        Alert.alert('Error', 'Unable to open SMS application.');
                      });
                    }
                  }}
                >
                  <View style={[styles.channelIconCircle, { backgroundColor: '#0EA5E9' }]}>
                    <Send size={18} color="#FFF" />
                  </View>
                  <Text style={styles.channelText}>SMS</Text>
                </TouchableOpacity>

                {/* More / Native Share */}
                <TouchableOpacity 
                  style={styles.channelItem}
                  onPress={async () => {
                    if (sharePost) {
                      setIsShareModalVisible(false);
                      try {
                        await Share.share({
                          message: `[AEDE Outbreak Alert] ${sharePost.author} reports from ${sharePost.location}: "${sharePost.content}"\n\n${hashtag}`,
                        });
                      } catch (err) {
                        console.log(err);
                      }
                    }
                  }}
                >
                  <View style={[styles.channelIconCircle, { backgroundColor: '#475569' }]}>
                    <Share2 size={18} color="#FFF" />
                  </View>
                  <Text style={styles.channelText}>More</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* -- Detailed Statistics Modal -- */}
      <Modal visible={isStatsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFillObject} 
            activeOpacity={1} 
            onPress={() => setIsStatsModalVisible(false)} 
          />
          <View style={styles.createModal}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BarChart2 size={22} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Vector Intel Summary</Text>
              </View>
              <TouchableOpacity onPress={() => setIsStatsModalVisible(false)}>
                <X size={24} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterModalLabel}>COMMUNITY ANALYTICS ({displayCity})</Text>
            
            <View style={styles.statsModalGrid}>
              <View style={styles.statsModalRow}>
                {/* Card 1: Verified Reports */}
                <View style={[styles.statsModalCard, { borderColor: '#BAE6FD', backgroundColor: '#F0F9FF' }]}>
                  <View style={[styles.statsIconSquircle, { backgroundColor: '#E0F2FE' }]}>
                    <BadgeCheck size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.statsModalVal}>{officialCount}</Text>
                  <Text style={styles.statsModalLabel}>Verified Intel</Text>
                </View>

                {/* Card 2: Active Alerts */}
                <View style={[styles.statsModalCard, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
                  <View style={[styles.statsIconSquircle, { backgroundColor: '#FEE2E2' }]}>
                    <ShieldAlert size={20} color={COLORS.danger} />
                  </View>
                  <Text style={styles.statsModalVal}>{posts.filter(p => p.type === 'alert').length}</Text>
                  <Text style={styles.statsModalLabel}>Active Alerts</Text>
                </View>
              </View>

              <View style={styles.statsModalRow}>
                {/* Card 3: Saved Bulletins */}
                <View style={[styles.statsModalCard, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
                  <View style={[styles.statsIconSquircle, { backgroundColor: '#FEF3C7' }]}>
                    <Heart size={20} color={COLORS.accent} fill={COLORS.accent} />
                  </View>
                  <Text style={styles.statsModalVal}>{savedPostIds.length}</Text>
                  <Text style={styles.statsModalLabel}>Saved Intel</Text>
                </View>

                {/* Card 4: Total Posts */}
                <View style={[styles.statsModalCard, { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }]}>
                  <View style={[styles.statsIconSquircle, { backgroundColor: '#E2E8F0' }]}>
                    <MessageSquare size={20} color={COLORS.slateLight} />
                  </View>
                  <Text style={styles.statsModalVal}>{posts.length}</Text>
                  <Text style={styles.statsModalLabel}>Total Posts</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={() => setIsStatsModalVisible(false)}>
              <Text style={styles.submitBtnText}>CLOSE SUMMARY</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* -- Simulated Video Player Modal -- */}
      <Modal visible={!!activeVideoUrl} animationType="fade" transparent>
        <View style={styles.videoModalOverlay}>
          <View style={styles.videoPlayerContainer}>
            <View style={styles.videoHeader}>
              <Text style={styles.videoTitleText} numberOfLines={1}>{videoTitle || 'AEDE Campaign Video'}</Text>
              <TouchableOpacity 
                style={styles.videoCloseBtn} 
                onPress={() => {
                  setIsVideoPlaying(false);
                  setActiveVideoUrl(null);
                  setVideoProgress(0);
                }}
              >
                <X size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.videoFrame}>
              {activeVideoUrl && (
                <Image 
                  source={resolvePostImage(activeVideoUrl) || { uri: activeVideoUrl }} 
                  style={styles.videoImage} 
                  resizeMode="cover" 
                />
              )}
              {!isVideoPlaying && (
                <View style={styles.videoPauseOverlay}>
                  <TouchableOpacity 
                    style={styles.videoBigPlayBtn}
                    onPress={() => setIsVideoPlaying(true)}
                  >
                    <Play size={32} color="#0EA5E9" fill="#0EA5E9" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Subtitles Overlay */}
              <View style={styles.subtitlesContainer}>
                <Text style={styles.subtitlesText}>
                  {(() => {
                    const elapsed = Math.floor((videoProgress / 100) * videoDuration);
                    if (elapsed < 5) return "[AEDE Team] Welcome to the AEDE Citizen Surveillance Program!";
                    if (elapsed < 12) return "[Narrator] In Singapore and Naga City, early vector detection is critical to control outbreak surges.";
                    if (elapsed < 20) return "[Narrator] Simply use our advanced AI Vision Scanner to identify potential larval breeding spots instantly.";
                    if (elapsed < 28) return "[Narrator] Keep your community safe: cover containers, clear gutters, and search-and-destroy!";
                    if (elapsed < 37) return "[Health Advisory] Always consult a health clinic immediately if a high fever persists for 3+ days.";
                    if (elapsed < 47) return "[Narrator] Win daily missions, earn points, unlock Sentinel badges, and climb the rankings!";
                    if (elapsed < 55) return "[AEDE Team] Together, we establish an unbreakable health shield across our neighborhoods.";
                    return "[AEDE Team] Katambay-AI and AEDE: Defending our community, together!";
                  })()}
                </Text>
              </View>
            </View>

            {/* Video Controls Bar */}
            <View style={styles.videoControls}>
              <TouchableOpacity 
                style={styles.videoControlBtn}
                onPress={() => setIsVideoPlaying(!isVideoPlaying)}
              >
                {isVideoPlaying ? (
                  <Pause size={18} color="#FFF" fill="#FFF" />
                ) : (
                  <Play size={18} color="#FFF" fill="#FFF" />
                )}
              </TouchableOpacity>

              <Text style={styles.videoTimeText}>
                {(() => {
                  const curr = Math.floor((videoProgress / 100) * videoDuration);
                  const pad = (n: number) => String(n).padStart(2, '0');
                  return `${Math.floor(curr / 60)}:${pad(curr % 60)}`;
                })()}
              </Text>

              {/* Progress Slider Track */}
              <View style={styles.videoProgressTrack}>
                <View style={[styles.videoProgressFill, { width: `${videoProgress}%` }]} />
              </View>

              <Text style={styles.videoTimeText}>
                {(() => {
                  const pad = (n: number) => String(n).padStart(2, '0');
                  return `${Math.floor(videoDuration / 60)}:${pad(videoDuration % 60)}`;
                })()}
              </Text>

              <TouchableOpacity 
                style={styles.videoControlBtn}
                onPress={() => setIsVideoMuted(!isVideoMuted)}
              >
                {isVideoMuted ? (
                  <VolumeX size={18} color="#FFF" />
                ) : (
                  <Volume2 size={18} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  headerContainer: {
    overflow: 'hidden',
  },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 44 : 48, 
    paddingBottom: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#BAE6FD', 
  },
  headerContent: {
    paddingHorizontal: 24,
  },
  decorSquircle: {
    position: 'absolute',
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    opacity: 0.25,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: COLORS.slate, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  headerProfile: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E0F2FE' },
  
  searchContainer: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, height: 50, borderWidth: 1, borderColor: '#BAE6FD' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '600', color: COLORS.slate },
  filterBtn: { width: 50, height: 50, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },

  filterContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingRight: 24 },
  filterTab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, marginRight: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  filterTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterTabText: { fontSize: 13, fontWeight: '800', color: COLORS.slateLight },
  filterTabTextActive: { color: '#FFF' },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },

  feedContent: { paddingHorizontal: 24, paddingBottom: 110 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarPill: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  authorTextCol: { flex: 1, minWidth: 0, paddingRight: 8 },
  authorName: { fontSize: 16, fontWeight: '800', color: COLORS.slate },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 4 },
  officialBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F9FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: '#BAE6FD' },
  officialBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.primary },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  pinnedText: { fontSize: 8, fontWeight: '900', color: COLORS.success },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  pendingText: { fontSize: 8, fontWeight: '900', color: COLORS.accent },
  misinfoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  misinfoText: { fontSize: 8, fontWeight: '900', color: COLORS.danger },
  authorRole: { fontSize: 11, fontWeight: '600', color: COLORS.slateLight, marginTop: 2 },
  
  postContent: { fontSize: 15, color: COLORS.slate, lineHeight: 24, fontWeight: '500', marginBottom: 16 },
  postMeta: { marginBottom: 16 },
  locationTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0F9FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignSelf: 'flex-start' },
  locationText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },

  postActions: { flexDirection: 'row', gap: 28, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionCount: { fontSize: 13, fontWeight: '800', color: COLORS.slateLight },

  fab: { position: 'absolute', bottom: 110, right: 24, width: 64, height: 64, borderRadius: 32 },
  fabGradient: { flex: 1, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  createModal: { backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 28, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: COLORS.slate },
  userPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  avatarCircle: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center' },
  previewName: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  previewRole: { fontSize: 13, fontWeight: '600', color: COLORS.slateLight },
  contentInput: { fontSize: 16, color: COLORS.slate, minHeight: 140, textAlignVertical: 'top', marginBottom: 24, fontWeight: '500' },
  locationContainer: { marginBottom: 28 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  locationInput: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.slate },
  suggestionList: { backgroundColor: '#FFF', borderRadius: 16, marginTop: 8, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  suggestionText: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  
  mediaSection: { marginBottom: 32 },
  mediaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  mediaTitle: { fontSize: 12, fontWeight: '900', color: COLORS.slateLight, letterSpacing: 1, textTransform: 'uppercase' },
  fileCount: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  filePreviewRow: { flexDirection: 'row', gap: 12, paddingBottom: 8 },
  addFileBtn: { width: 80, height: 80, backgroundColor: '#F8FAFC', borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1' },
  addFileText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  filePreviewCard: { width: 80, height: 80, backgroundColor: '#F1F5F9', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fileIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  removeFileBtn: { position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },

  progressSection: { marginBottom: 24 },
  progressLabel: { fontSize: 12, fontWeight: '800', color: COLORS.primary, marginBottom: 8 },
  progressBarBg: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary, width: '70%' },

  modalFooter: { width: '100%' },
  submitBtn: { backgroundColor: COLORS.primary, width: '100%', paddingVertical: 18, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: 16 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#94A3B8' },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 16, marginTop: 12 },
  statChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  statChipPrimary: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
  statChipText: { fontSize: 10, fontWeight: '800', color: COLORS.slate },
  postCard: { 
    flexDirection: 'column', 
    backgroundColor: '#FFF', 
    borderRadius: 20, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    padding: 20
  },
  postCardAlert: { borderColor: '#BAE6FD', backgroundColor: '#F8FBFF' },
  postCardPinned: { borderColor: '#7DD3FC' },
  avatarSquircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  authorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 12, alignSelf: 'flex-start' },
  alertBannerText: { fontSize: 10, fontWeight: '900', color: COLORS.secondary, letterSpacing: 0.5 },
  filterModalLabel: { fontSize: 12, fontWeight: '900', color: COLORS.slateLight, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  filterOption: { padding: 16, borderRadius: 16, backgroundColor: '#F8FAFC', marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  filterOptionActive: { backgroundColor: '#F0F9FF', borderColor: COLORS.primary },
  filterOptionText: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  filterOptionTextActive: { color: COLORS.primary },
  commentHint: { fontSize: 12, color: COLORS.slateLight, fontWeight: '600', marginBottom: 16, lineHeight: 18 },
  emptyFeedContainer: { padding: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderRadius: 28, borderWidth: 1, borderColor: '#F1F5F9', marginTop: 40 },
  emptyFeedTitle: { fontSize: 16, fontWeight: '900', color: COLORS.slate, marginTop: 12, textAlign: 'center' },
  emptyFeedSub: { fontSize: 12, color: COLORS.slateLight, fontWeight: '600', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  postImage: {
    width: '100%',
    height: 190,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featuredCampaignsContainer: {
    marginBottom: 24,
    marginTop: 8,
  },
  featuredCampaignsTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  featuredCampaignsScroll: {
    gap: 12,
    paddingBottom: 4,
  },
  campaignCard: {
    width: 240,
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  campaignCardImg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  campaignCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
    opacity: 0.45,
  },
  campaignCardInfo: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
    zIndex: 1,
  },
  campaignCardTag: {
    fontSize: 8,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.8,
  },
  campaignCardName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  campaignCardDesc: {
    fontSize: 10,
    color: '#E2E8F0',
    fontWeight: '600',
    marginTop: 2,
  },
  shareOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  shareBackdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  shareModalSheet: { 
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40, 
    borderTopRightRadius: 40, 
    paddingHorizontal: 24,
    paddingTop: 16, 
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sheetHandle: {
    width: 48,
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  shareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  shareTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  shareCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharePreviewCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  sharePreviewImage: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    marginTop: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  sharePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sharePreviewAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharePreviewAuthor: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  sharePreviewRole: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  sharePreviewBadge: {
    backgroundColor: '#0EA5E9',
    padding: 3,
    borderRadius: 6,
  },
  sharePreviewScroll: {
    flex: 1,
    marginVertical: 6,
  },
  sharePreviewContent: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    fontWeight: '500',
  },
  sharePreviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 10,
  },
  sharePreviewLocationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  sharePreviewLocationText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0EA5E9',
    maxWidth: 120,
  },
  sharePreviewBranding: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0284C7',
    letterSpacing: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  singleGuardianContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    marginBottom: 24,
    width: '100%',
  },
  guardianContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  guardianAvatarHorizontal: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  guardianInitials: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
  },
  guardianContactInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  guardianNameHorizontal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  guardianRoleHorizontal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  guardianContactNumber: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 3,
  },
  channelsContainer: {
    marginBottom: 10,
  },
  channelsRow: {
    gap: 18,
    paddingRight: 16,
  },
  channelItem: {
    alignItems: 'center',
    width: 64,
  },
  channelIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  channelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
  },
  statsBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  statsModalGrid: {
    gap: 12,
    marginBottom: 28,
  },
  statsModalRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statsModalCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statsIconSquircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statsModalVal: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  statsModalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textAlign: 'center',
  },
  commentItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  commentRole: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
  },
  commentTime: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  commentContent: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    fontWeight: '500',
    paddingLeft: 32,
  },
  // Promotional & Video Player Styles
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EC4899', // Beautiful pink background
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  promoText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    overflow: 'hidden',
  },
  playOverlayGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  playCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(14, 165, 233, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  playText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  videoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  videoPlayerContainer: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  videoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  videoTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 12,
  },
  videoCloseBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  videoFrame: {
    width: '100%',
    height: 240,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'stretch',
    position: 'relative',
  },
  videoImage: {
    width: '100%',
    height: '100%',
  },
  videoPauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBigPlayBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  subtitlesContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  subtitlesText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
  videoControls: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#0F172A',
    gap: 12,
  },
  videoControlBtn: {
    padding: 4,
  },
  videoTimeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  videoProgressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  videoProgressFill: {
    height: '100%',
    backgroundColor: '#0EA5E9',
  },
});
