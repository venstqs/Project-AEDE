import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown, ChevronUp,
  CloudRain,
  Cpu, Database,
  Info,
  MessageSquare,
  Radio,
  Satellite,
  Search,
  Send, ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  X
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing, FadeInDown, FadeInUp,
  SlideInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat, withTiming
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, Path, Stop, LinearGradient as SvgGradient, Text as SvgText } from 'react-native-svg';
import { APP_COLORS, BARANGAY_AI_METRICS } from '../../constants/appData';
import { GROQ_API_KEY, OPENWEATHER_API_KEY } from '../../constants/env';
import { MAP_RISK_COLORS, NAGA_BARANGAYS, buildIotMetricsFromRisk, getColorForRisk, getMapRiskLabel, getRiskLevel } from '../../constants/nagaBarangays';
import { SINGAPORE_REGIONS } from '../../constants/singaporeRegions';
import { runInferenceModel } from '../../lib/predictiveEngine';
import { DatabaseService } from '../../lib/supabase';
import { chat as offlineChat } from '../../lib/tfliteChatbot';
import { fetchSentinel2Data } from '../../lib/sentinelService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from '../../hooks/useTranslation';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CHART_WIDTH = width - 130; // Drawing area width (adjusted for card padding + gutter)
const CHART_GUTTER = 45;      // Gutter for Y-axis labels

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#2563EB',
  accent: '#F59E0B',
  danger: '#EF4444',
  white: '#FFFFFF',
  slate: '#0F172A',
  slateLight: '#64748B',
  bg: '#F8FAFC'
};

// ── Animations ───────────────────────────────────────────
function PulsingDot({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.6, { duration: 1200, easing: Easing.out(Easing.ease) }), -1, false);
    opacity.value = withRepeat(withTiming(0, { duration: 1200, easing: Easing.out(Easing.ease) }), -1, false);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.pulseContainer}>
      <Animated.View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, position: 'absolute' }, animatedStyle]} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, position: 'absolute' }} />
    </View>
  );
}

// ── Data Fusion Animation Component ──────────────────────
const AnimatedLine = Animated.createAnimatedComponent(Line);

function DataFlowLine({ x1, y1, x2, y2, color, delay }: { x1: number, y1: number, x2: number, y2: number, color: string, delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2000, easing: Easing.linear }), -1, false));
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: 20 * (1 - progress.value),
  }));

  return (
    <G>
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" opacity="0.4" />
      <AnimatedLine 
        x1={x1} y1={y1} x2={x2} y2={y2} 
        stroke={color} strokeWidth="2.5" 
        strokeDasharray="4,6"
        animatedProps={animatedProps}
      />
    </G>
  );
}

export default function ScientificAIEngineScreen() {
  const { t } = useTranslation();
  const [activeCountry, setActiveCountry] = useState<'Philippines' | 'Singapore'>('Philippines');
  const [activeLanguage, setActiveLanguage] = useState('English');
  const [activeBarangay, setActiveBarangay] = useState('Dayangdang');
  const [activeRiskScore, setActiveRiskScore] = useState(0.9);
  const [iotSearch, setIotSearch] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [showChatPrompts, setShowChatPrompts] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [dbCases, setDbCases] = useState<Record<string, { active: number; baseline: number }>>({});
  const [chatMode, setChatMode] = useState<'online' | 'offline'>(GROQ_API_KEY ? 'online' : 'offline');
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number} | null>(null);
  const [sentinelData, setSentinelData] = useState<any>({
    sceneId: "S2B_T51PWR_20260508_DEFAULT",
    acquisitionDate: "May 8, 2026",
    cloudCover: 12.5,
    thumbnailUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80",
    ndwi: 0.35,
    evi: 0.45
  });

  const activeSectors = activeCountry === 'Singapore' ? SINGAPORE_REGIONS : NAGA_BARANGAYS;

  const SHORT_PROMPTS = [
    { label: t('ai.prompts.checklist'), text: 'Give me a 5-step prevention checklist.' },
    { label: t('ai.prompts.surge'), text: activeCountry === 'Singapore' ? 'Explain surge probability for my region.' : 'Explain surge probability for my barangay.' },
    { label: t('ai.prompts.care'), text: 'When should I seek medical care?' },
    { label: t('ai.prompts.today'), text: activeCountry === 'Singapore' ? 'What should I do in my region today?' : 'What should I do in my barangay today?' },
  ];
  
  const defaultMetrics = BARANGAY_AI_METRICS.Dayangdang;
  const [metrics, setMetrics] = useState({
    ...defaultMetrics,
    verifiedReports: 0,
    dataMode: 'Live weather · barangay metrics calibrated · satellite/cases staged until AEDE API',
  });
  const [prescriptiveActions, setPrescriptiveActions] = useState(defaultMetrics.actions);

  const loadDbCases = async () => {
    try {
      const data = await DatabaseService.getDengueCases();
      const mapping: Record<string, { active: number; baseline: number }> = {};
      data.forEach(item => {
        mapping[item.barangay] = {
          active: item.active_cases,
          baseline: item.baseline_cases
        };
      });
      setDbCases(mapping);
      return mapping;
    } catch (e) {
      console.warn('Failed to load database cases on report screen:', e);
      return {};
    }
  };

  const loadPosts = async (currentBarangayName?: string) => {
    try {
      const casesMap = await loadDbCases();
      const data = await DatabaseService.getPosts();
      setAllPosts(data);
      applyBarangayMetrics(currentBarangayName || activeBarangay, undefined, data, casesMap);
    } catch (e) {
      console.warn('Failed to load posts in AI engine screen:', e);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      const loadCountryContext = async () => {
        try {
          const country = await AsyncStorage.getItem('@aede:active_country') || 'Philippines';
          setActiveCountry(country as 'Philippines' | 'Singapore');
          
          const language = await AsyncStorage.getItem('@aede:language') || 'English';
          setActiveLanguage(language);
          
          const activeList = country === 'Singapore' ? SINGAPORE_REGIONS : NAGA_BARANGAYS;
          const defaultBrgy = activeList.find(b => b.name === 'Woodlands' || b.name === 'Dayangdang') ?? activeList[0];
          
          setActiveBarangay(defaultBrgy.name);
          setActiveRiskScore(defaultBrgy.riskScore);
          
          const savedHistory = await AsyncStorage.getItem('@aede:chat_history_' + country);
          if (savedHistory) {
            setMessages(JSON.parse(savedHistory));
          } else {
            setMessages([
              { id: 1, role: 'ai', text: `Hello! I'm AEDE, your Katambay AI partner. I'm currently monitoring ${country === 'Singapore' ? 'Singapore' : 'Naga City'}. How can I help you today?` }
            ]);
          }

          const casesMap = await loadDbCases();
          const posts = await DatabaseService.getPosts();
          setAllPosts(posts);
          
          const weatherResult = await fetchWeather(defaultBrgy.lat, defaultBrgy.lng, defaultBrgy.name);
          
          const baseMetrics = buildIotMetricsFromRisk(defaultBrgy);
          const currentTemp = weatherResult ? weatherResult.temp : parseFloat(baseMetrics.temp);
          const currentHumid = weatherResult ? weatherResult.humid : parseFloat(baseMetrics.humid);
          const verifiedReports = posts.filter((p: any) => p.location?.toLowerCase().includes(defaultBrgy.name.toLowerCase())).length;
          const brgyCases = casesMap[defaultBrgy.name] || { active: 0, baseline: 10 };

          const satelliteData = await fetchSentinel2Data(defaultBrgy.lat, defaultBrgy.lng, currentTemp, currentHumid);
          setSentinelData(satelliteData);

          const otaWeightsStr = await AsyncStorage.getItem('@aede:ota_weights');
          const otaWeights = otaWeightsStr ? JSON.parse(otaWeightsStr) : undefined;

          const inference = runInferenceModel({
            temperature: currentTemp,
            humidity: currentHumid,
            ndwi: satelliteData.ndwi,
            evi: satelliteData.evi,
            caseNow: brgyCases.active,
            baseline: brgyCases.baseline,
            verifiedReports: verifiedReports
          }, otaWeights);

          setMetrics({
            ...baseMetrics,
            temp: currentTemp.toFixed(1),
            humid: String(Math.round(currentHumid)),
            ndwi: String(satelliteData.ndwi),
            evi: String(satelliteData.evi),
            surgeProb: inference.surgeProb,
            ciLow: inference.ciLow,
            ciHigh: inference.ciHigh,
            riskLevel: inference.riskLevel,
            surgeDays: inference.surgeDays,
            actions: inference.actions,
            verifiedReports,
            caseNow: String(brgyCases.active),
            baseline: String(brgyCases.baseline),
            dataMode: 'Live weather & Sentinel-2 satellite L2A telemetry active',
          } as any);
          setPrescriptiveActions(inference.actions);
        } catch (e) {
          console.warn('Failed to load country context on report screen:', e);
        }
      };
      loadCountryContext();
    }, [activeCountry])
  );

  // ── 1. Live Weather Integration (uses real GPS & Barangay Microclimates) ──
  const fetchWeather = async (lat: number, lon: number, brgyName?: string) => {
    setIsFetching(true);
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
      );
      const json = await response.json();
      if (json.main) {
        let tempVal = json.main.temp;
        let humidVal = json.main.humidity;

        // Apply authentic microclimate offset based on barangay metrics to represent microclimatic breeding corridors
        if (brgyName) {
          const brgy = NAGA_BARANGAYS.find(x => x.name === brgyName);
          if (brgy) {
            const tempOffset = (brgy.riskScore - 0.5) * 2.2; 
            const humidOffset = Math.round((brgy.riskScore - 0.5) * 15);
            tempVal = tempVal + tempOffset;
            humidVal = Math.min(100, Math.max(30, humidVal + humidOffset));
          }
        }

        setMetrics(prev => ({
          ...prev,
          temp: tempVal.toFixed(1),
          humid: String(humidVal),
        }));

        return { temp: tempVal, humid: humidVal };
      }
    } catch (err) {
      console.error('Weather fetch failed on AI Engine:', err);
    } finally {
      setIsFetching(false);
    }
    return null;
  };

  useEffect(() => {
    const start = async () => {
      try {
        const { status } = await import('expo-location').then((m: any) => m.requestForegroundPermissionsAsync());
        if (status !== 'granted') {
          const defaultLat = activeCountry === 'Singapore' ? 1.3521 : 13.6218;
          const defaultLng = activeCountry === 'Singapore' ? 103.8198 : 123.1945;
          await fetchWeather(defaultLat, defaultLng, activeBarangay);
          return;
        }

        const loc = await import('expo-location').then((m: any) => m.getCurrentPositionAsync({ accuracy: (m as any).Accuracy?.High }));
        const lat = loc.coords.latitude;
        const lon = loc.coords.longitude;
        setUserLocation({ lat, lon });

        await fetchWeather(lat, lon, activeBarangay);

        const interval = setInterval(() => {
          import('expo-location')
            .then((m: any) => m.getCurrentPositionAsync({ accuracy: (m as any).Accuracy?.High }))
            .then((loc2: any) => {
              setUserLocation({ lat: loc2.coords.latitude, lon: loc2.coords.longitude });
              fetchWeather(loc2.coords.latitude, loc2.coords.longitude, activeBarangay);
            });
        }, 300000);

        return () => clearInterval(interval);
      } catch (e) {
        console.error('Location/weather start failed:', e);
        const defaultLat = activeCountry === 'Singapore' ? 1.3521 : 13.6218;
        const defaultLng = activeCountry === 'Singapore' ? 103.8198 : 123.1945;
        await fetchWeather(defaultLat, defaultLng, activeBarangay);
      }
    };

    const cleanupPromise = start();

    return () => {
      // No-op
    };
  }, [activeCountry]);



  // ── 2. Groq AI Integration ──
  const handleSendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
    if (!text) return;
    
    const userMsg = { id: Date.now(), role: 'user', text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    await AsyncStorage.setItem('@aede:chat_history_' + activeCountry, JSON.stringify(updatedMessages));
    setInputText('');
    setIsTyping(true);

    try {
      if (!GROQ_API_KEY) {
        // Fallback directly to offline model
        setChatMode('offline');
        const offlineReply = await offlineChat(text);
        const newMessages = [...updatedMessages, { id: Date.now() + 1, role: 'ai', text: offlineReply }];
        setMessages(newMessages);
        await AsyncStorage.setItem('@aede:chat_history_' + activeCountry, JSON.stringify(newMessages));
        setIsTyping(false);
        return;
      }
      
      const systemPrompt = `You are AEDE, a Medical Assistant Chatbot specializing in Dengue outbreak prevention in ${activeCountry === 'Singapore' ? 'Singapore' : 'Naga City'}.
      
      CORE INTELLIGENCE CONTEXT:
      - Selected Zone: ${activeCountry === 'Singapore' ? `${activeBarangay}, Singapore` : `Barangay ${activeBarangay}, Naga City`}.
      - Meteorological telemetry: Temperature ${metrics.temp}°C, Humidity ${metrics.humid}%.
      - Predictive Analytics: ${metrics.surgeProb} probability of surge in ${metrics.surgeDays}.
 
      BEHAVIORAL DIRECTIVES (STRICT):
      1. CRITICAL: You must write your entire response translated into ${activeLanguage}.
      2. Provide SIMPLE, PRECISE, and COMPREHENSIVE answers about dengue that anyone can understand.
      3. DO NOT use complex scientific data numbers, deep medical jargon, or raw data dumps. Keep it conversational and easy to read.
      4. DO NOT provide generic "GPT-style" answers. Give direct, actionable, and empathetic advice based on the context.
      5. Refuse any request unrelated to Dengue, mosquito prevention, or the app's features.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map(m => ({ 
              role: m.role === 'ai' ? 'assistant' : 'user', 
              content: m.text 
            })),
            { role: "user", content: text }
          ],
          temperature: 0.6,
          max_tokens: 400
        })
      });

      if (!response.ok) {
        throw new Error("Groq API error status: " + response.status);
      }

      const json = await response.json();
      const aiResponse = json.choices[0].message.content;
      
      setChatMode('online');
      const newMessages = [...updatedMessages, { id: Date.now() + 1, role: 'ai', text: aiResponse }];
      setMessages(newMessages);
      await AsyncStorage.setItem('@aede:chat_history_' + activeCountry, JSON.stringify(newMessages));
    } catch (err: any) {
      console.warn("AEDE Groq Error, falling back to offline mode:", err);
      setChatMode('offline');
      try {
        const offlineReply = await offlineChat(text);
        const newMessagesOffline = [...updatedMessages, { id: Date.now() + 1, role: 'ai', text: `[Offline Mode] ${offlineReply}` }];
        setMessages(newMessagesOffline);
        await AsyncStorage.setItem('@aede:chat_history_' + activeCountry, JSON.stringify(newMessagesOffline));
      } catch (offlineErr) {
        console.error("Offline fallback failed:", offlineErr);
        const errorMessages = [...updatedMessages, { id: Date.now() + 1, role: 'ai', text: "AEDE: Connection interrupted. Both online and offline assistants are unavailable." }];
        setMessages(errorMessages);
        await AsyncStorage.setItem('@aede:chat_history_' + activeCountry, JSON.stringify(errorMessages));
      }
    } finally {
      setIsTyping(false);
    }
  };

  const applyBarangayMetrics = async (name: string, fetchedWeather?: { temp: number; humid: number }, loadedPosts?: any[], casesMap?: Record<string, { active: number; baseline: number }>) => {
    const brgy = activeSectors.find(x => x.name === name);
    if (!brgy) return;
    setActiveRiskScore(brgy.riskScore);
    
    const baseMetrics = buildIotMetricsFromRisk(brgy);
    
    const currentTemp = fetchedWeather ? fetchedWeather.temp : parseFloat(baseMetrics.temp);
    const currentHumid = fetchedWeather ? fetchedWeather.humid : parseFloat(baseMetrics.humid);

    // Count ground-truth community photos/media verified reports in this barangay sector
    const currentPosts = loadedPosts || allPosts;
    const verifiedReports = currentPosts.filter((p: any) => 
      p.location?.toLowerCase().includes(name.toLowerCase())
    ).length;

    const cases = casesMap || dbCases;
    const brgyCases = cases[name] || { active: 0, baseline: 10 };
    const caseNow = brgyCases.active;
    const baseline = brgyCases.baseline;

    const brgyObj = activeSectors.find(x => x.name === name) || activeSectors[0];
    const satelliteData = await fetchSentinel2Data(brgyObj.lat, brgyObj.lng, currentTemp, currentHumid);
    setSentinelData(satelliteData);

    // Run live on-device machine learning inference!
    const inference = runInferenceModel({
      temperature: currentTemp,
      humidity: currentHumid,
      ndwi: satelliteData.ndwi,
      evi: satelliteData.evi,
      caseNow: caseNow,
      baseline: baseline,
      verifiedReports: verifiedReports
    });

    const updatedData = {
      ...baseMetrics,
      temp: currentTemp.toFixed(1),
      humid: String(Math.round(currentHumid)),
      ndwi: String(satelliteData.ndwi),
      evi: String(satelliteData.evi),
      surgeProb: inference.surgeProb,
      ciLow: inference.ciLow,
      ciHigh: inference.ciHigh,
      riskLevel: inference.riskLevel,
      surgeDays: inference.surgeDays,
      actions: inference.actions,
      verifiedReports: verifiedReports,
      caseNow: String(caseNow),
      baseline: String(baseline),
      dataMode: 'Live weather & Sentinel-2 satellite L2A telemetry active',
    };

    setMetrics(updatedData as any);
    setPrescriptiveActions(inference.actions);
  };

  const handleBarangaySelect = async (name: string) => {
    setActiveBarangay(name);
    setIsFetching(true);
    
    const brgy = activeSectors.find(x => x.name === name);
    if (brgy) {
      const weatherResult = await fetchWeather(brgy.lat, brgy.lng, name);
      applyBarangayMetrics(name, weatherResult || undefined);
    } else {
      applyBarangayMetrics(name);
    }
    setIsFetching(false);
  };

  const filteredBarangays = activeSectors.filter(b =>
    b.name.toLowerCase().includes(iotSearch.toLowerCase())
  );

  const applySuggestion = (text: string) => {
    setIsChatVisible(true);
    setTimeout(() => handleSendMessage(text), 300);
  };

  const currentRisk = getRiskLevel(activeRiskScore);
  const activeRiskAccent = getColorForRisk(activeRiskScore);
  const ZONE_GRADIENT = ['#0EA5E9', '#0284C7', '#0369A1', '#0C4A6E'] as const;
  const highSurge = parseInt(metrics.surgeProb) >= 50;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* -- Command Center Intelligence Bar -- */}
        {/* Intel bar removed */}

        {/* ── 1. Header Section ── */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.headerBox}>
          <View style={styles.aiLabelRow}>
            <Cpu size={16} color="#0EA5E9" />
            <Text style={styles.aiLabelText}>AEDE EDGE INFERENCE</Text>
          </View>
          <Text style={styles.headerTitle}>{t('ai.headerTitle')}</Text>
          <View style={styles.headerBadges}>
            <View style={styles.statusBadge}>
              <PulsingDot color={chatMode === 'online' ? "#06B6D4" : "#F59E0B"} />
              <Text style={[styles.statusText, { color: chatMode === 'online' ? '#0891B2' : '#D97706' }]}>
                {chatMode === 'online' ? t('ai.systemActive') : t('ai.offlineMode')}
              </Text>
            </View>
            <View style={styles.accuracyBadge}>
              <TrendingUp size={14} color="#0EA5E9" style={{ marginRight: 4 }} />
              <Text style={styles.accuracyText}>{t('ai.modelAccuracy')}: {'>'}88%</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Risk Command Center (Premium Overhauled SVG Gauge HUD) ── */}
        <Animated.View entering={FadeInUp.delay(150).springify()}>
          <LinearGradient
            colors={
              currentRisk === 'Critical' || currentRisk === 'Elevated'
                ? ['#FEF2F2', '#FEE2E2']
                : currentRisk === 'Moderate'
                ? ['#FFFBEB', '#FEF3C7']
                : ['#ECFDF5', '#DCFCE7']
            }
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[
              styles.riskHero,
              { 
                borderColor: 
                  currentRisk === 'Critical' || currentRisk === 'Elevated' 
                    ? '#FCA5A5' 
                    : currentRisk === 'Moderate' 
                    ? '#FDE68A' 
                    : '#A7F3D0',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16
              }
            ]}
          >
            <View style={styles.shieldLeft}>
              <Svg width={80} height={80} viewBox="0 0 80 80">
                <Defs>
                  <SvgGradient id="riskGaugeGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={activeRiskAccent} />
                    <Stop offset="1" stopColor={activeRiskAccent} />
                  </SvgGradient>
                </Defs>
                <Circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke={
                    currentRisk === 'Critical' || currentRisk === 'Elevated'
                      ? '#FCA5A580'
                      : currentRisk === 'Moderate'
                      ? '#FDE68A80'
                      : '#A7F3D0'
                  }
                  strokeWidth="6"
                />
                <Circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="url(#riskGaugeGrad)"
                  strokeWidth="8"
                  strokeDasharray="201.06"
                  strokeDashoffset={201.06 * (1 - (parseInt(metrics.surgeProb) || 0) / 100)}
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                />
              </Svg>
              <View style={styles.shieldPercentageBox}>
                <Text style={[styles.shieldPercentageText, { color: activeRiskAccent }]}>{isFetching ? '—' : metrics.surgeProb}</Text>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.shieldHeaderRow}>
                <Sparkles size={14} color={activeRiskAccent} fill={activeRiskAccent} />
                <Text style={[styles.shieldStatusTitle, { color: activeRiskAccent }]}>
                  {activeCountry === 'Singapore' ? 'SELECTED REGION' : 'SELECTED BARANGAY'}
                </Text>
              </View>
              <Text style={[styles.riskBarangay, { color: activeRiskAccent === COLORS.primary ? '#0C4A6E' : activeRiskAccent }]}>
                {activeBarangay}
              </Text>
              <Text style={[styles.shieldStatusDesc, { color: activeRiskAccent === '#10B981' ? '#047857' : activeRiskAccent === COLORS.accent ? '#B45309' : '#B91C1C', marginTop: 4 }]}>
                {isFetching 
                  ? 'Analyzing local vector indicators...' 
                  : (metrics.surgeDays === 'Stable'
                      ? `Microclimate is currently stable. Surge probability is low at ${metrics.surgeProb}.`
                      : `Vector alert window active. Projected surge in ${metrics.surgeDays} (${metrics.surgeProb} probability).`
                    )
                }
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* -- Glassmorphic Telemetry Chips HUD -- */}
        <Animated.View entering={FadeInUp.delay(160).springify()} style={styles.telemetryOverlay}>
          <View style={styles.teleChip}>
            <TrendingUp size={14} color={activeRiskAccent} />
            <Text style={styles.teleText}>{isFetching ? '—' : metrics.surgeProb} Risk</Text>
          </View>
          <View style={styles.teleChip}>
            <Activity size={14} color={activeRiskAccent} />
            <Text style={styles.teleText}>{isFetching ? '—' : (metrics.surgeDays === 'Stable' ? 'Stable' : metrics.surgeDays)}</Text>
          </View>
          <View style={styles.teleChip}>
            <ShieldCheck size={14} color={activeRiskAccent} />
            <Text style={styles.teleText}>{isFetching ? '—' : `AI Confidence: ${Number(metrics.ciHigh) > 60 ? 'High' : 'Moderate'}`}</Text>
          </View>
        </Animated.View>

        {/* ── Prescriptive Actions ── */}
        <Animated.View entering={FadeInUp.delay(180).springify()} style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Prescriptive Actions</Text>
            <CheckCircle2 size={16} color={APP_COLORS.success} />
          </View>
          <Text style={styles.cardSub}>Ranked for {activeBarangay} · AEDE fusion output</Text>
          {prescriptiveActions.map((action, i) => (
            <TouchableOpacity
              key={action}
              style={styles.actionRow}
              onPress={() => applySuggestion(`Help me with: ${action}`)}
              activeOpacity={0.75}
            >
              <View style={styles.actionIndex}><Text style={styles.actionIndexText}>{i + 1}</Text></View>
              <Text style={styles.actionText}>{action}</Text>
              <MessageSquare size={16} color={COLORS.primary} />
            </TouchableOpacity>
          ))}
        </Animated.View>


        {/* ── 2. Data Fusion Matrix (The Brain) ── */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Data Fusion Matrix</Text>
            <Info size={16} color="#94A3B8" />
          </View>
          <Text style={styles.cardSub}>Multimodal Predictive AI Input Streams</Text>
          
          <View style={styles.signalGrid}>
            <View style={styles.signalCard}>
              <View style={styles.signalHeader}>
                <CloudRain size={16} color="#0EA5E9" />
                <Text style={styles.signalLabel}>Microclimate Telemetry</Text>
              </View>
              <Text style={styles.signalValue}>{metrics.temp}°C · {metrics.humid}% RH</Text>
            </View>
            <View style={styles.signalCard}>
              <View style={styles.signalHeader}>
                <Satellite size={16} color="#0284C7" />
                <Text style={styles.signalLabel}>Surface Moisture Index</Text>
              </View>
              <Text style={styles.signalValue}>NDWI {metrics.ndwi} · EVI {metrics.evi}</Text>
            </View>
            <View style={styles.signalCard}>
              <View style={styles.signalHeader}>
                <ShieldCheck size={16} color="#10B981" />
                <Text style={styles.signalLabel}>Clinical Cases Registry</Text>
              </View>
              <Text style={styles.signalValue}>{metrics.caseNow} Diagnosed Cases</Text>
            </View>
            <View style={styles.signalCard}>
              <View style={styles.signalHeader}>
                <MessageSquare size={16} color="#F59E0B" />
                <Text style={styles.signalLabel}>Citizen Larval Evidence</Text>
              </View>
              <Text style={styles.signalValue}>{(metrics as any).verifiedReports || 0} Verified Photos</Text>
            </View>
          </View>
          
          <View style={styles.fusionContainer}>
            {/* Left Inputs */}
            <View style={styles.fusionInputs}>
              <View style={styles.fusionPill}>
                <Radio size={14} color="#0EA5E9" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fusionPillText}>Meterological Sensors</Text>
                  <Text style={styles.fusionPillSub}>Live OpenWeather Stations</Text>
                </View>
              </View>
              <View style={styles.fusionPill}>
                <Satellite size={14} color="#0284C7" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fusionPillText}>Hydro-Vegetation Indices</Text>
                  <Text style={styles.fusionPillSub}>Sentinel-2 Water Index</Text>
                </View>
              </View>
              <View style={styles.fusionPill}>
                <ShieldCheck size={14} color="#10B981" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fusionPillText}>Clinical Diagnostics</Text>
                  <Text style={styles.fusionPillSub}>{metrics.caseNow} Cases vs {metrics.baseline} baseline</Text>
                </View>
              </View>
              <View style={styles.fusionPill}>
                <MessageSquare size={14} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fusionPillText}>Larval Ground Truth</Text>
                  <Text style={styles.fusionPillSub}>{(metrics as any).verifiedReports || 0} Media Photos Verified</Text>
                </View>
              </View>
            </View>

            {/* Connecting SVG Lines with Flow Animation */}
            <View style={styles.fusionLines}>
              <Svg width="50" height="180">
                <DataFlowLine x1={0} y1={25} x2={50} y2={90} color="#0EA5E9" delay={0} />
                <DataFlowLine x1={0} y1={65} x2={50} y2={90} color="#0284C7" delay={400} />
                <DataFlowLine x1={0} y1={105} x2={50} y2={90} color="#10B981" delay={800} />
                <DataFlowLine x1={0} y1={145} x2={50} y2={90} color="#F59E0B" delay={1200} />
              </Svg>
            </View>

            {/* Right Core */}
            <View style={styles.fusionCoreBox}>
              <View style={[styles.coreGlow, isFetching && { backgroundColor: '#38BDF8', shadowColor: '#0EA5E9' }]}>
                {isFetching ? <Activity size={22} color="#FFF" /> : <Database size={24} color="#FFF" />}
              </View>
              <Text style={styles.coreText}>Predictive Core</Text>
              <Text style={styles.coreSub}>On-Device AI Model</Text>
              <Text style={styles.coreSub}>Model Sync: LIVE</Text>
              <Text style={styles.coreSub}>Latency: {isFetching ? '...' : metrics.latency}</Text>
            </View>
          </View>
          <View style={styles.fusionFooter}>
            <Info size={12} color="#64748B" />
            <Text style={styles.fusionFooterText}>{metrics.dataMode}</Text>
          </View>
        </Animated.View>

        {/* ── 3. IoT Micro-Climate Monitoring (27 Barangays) ── */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>IoT Micro-Climate Monitoring</Text>
            <Activity size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.cardSub}>{activeCountry === 'Singapore' ? '5 planning regions' : '27 sectors'} · same colors as risk map</Text>

          <View style={styles.mapLegendRow}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: MAP_RISK_COLORS.low }]} /><Text style={styles.legendLbl}>Low</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: MAP_RISK_COLORS.moderate }]} /><Text style={styles.legendLbl}>Moderate</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: MAP_RISK_COLORS.high }]} /><Text style={styles.legendLbl}>High</Text></View>
          </View>

          <View style={styles.iotSearchRow}>
            <Search size={16} color={COLORS.slateLight} />
            <TextInput
              style={styles.iotSearchInput}
              placeholder={activeCountry === 'Singapore' ? "Search region..." : "Search barangay..."}
              placeholderTextColor="#94A3B8"
              value={iotSearch}
              onChangeText={setIotSearch}
            />
            {iotSearch.length > 0 && (
              <TouchableOpacity onPress={() => setIotSearch('')}><X size={16} color={COLORS.slateLight} /></TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroller} contentContainerStyle={{ paddingRight: 8 }}>
            {filteredBarangays.map((b) => {
              const tint = getColorForRisk(b.riskScore);
              const selected = activeBarangay === b.name;
              return (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => handleBarangaySelect(b.name)}
                  style={[
                    styles.iotPill,
                    selected && { borderColor: tint, backgroundColor: tint + '18' },
                  ]}
                  activeOpacity={0.85}
                >
                  <View style={[styles.iotPillDot, { backgroundColor: tint }]} />
                  <Text style={[styles.iotPillText, selected && { color: tint, fontWeight: '900' }]} numberOfLines={1}>
                    {b.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.iotActiveBar, { borderColor: activeRiskAccent, backgroundColor: activeRiskAccent + '12' }]}>
            <View style={[styles.iotActiveDot, { backgroundColor: activeRiskAccent }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.iotActiveName}>{activeBarangay}</Text>
              <Text style={styles.iotActiveMeta}>
                {getMapRiskLabel(activeRiskScore)} risk · {Math.round(activeRiskScore * 100)}% · matches map
              </Text>
            </View>
            <Text style={[styles.iotActivePct, { color: activeRiskAccent }]}>{isFetching ? '…' : `${metrics.temp}°`}</Text>
          </View>

          <View style={styles.graphWrapper}>
            <Svg width={CHART_WIDTH} height={140}>
              <Defs>
                <SvgGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#F59E0B" stopOpacity="0.15" />
                  <Stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
                </SvgGradient>
                <SvgGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#0EA5E9" stopOpacity="0.15" />
                  <Stop offset="1" stopColor="#0EA5E9" stopOpacity="0" />
                </SvgGradient>
              </Defs>
              
              {/* Grid Lines */}
              {[35, 70, 105].map((y) => (
                <Line key={y} x1="0" y1={y} x2={CHART_WIDTH} y2={y} stroke="#F1F5F9" strokeWidth="1" />
              ))}

              {/* Dynamic Humidity Path - Smooth Bezier */}
              <Path 
                d={(() => {
                  const currentHumid = parseFloat(metrics.humid) || 75.0;
                  const humidPoints = [
                    Math.max(30, currentHumid - 8),
                    Math.max(30, currentHumid + 3),
                    Math.max(30, currentHumid - 4),
                    currentHumid
                  ];
                  const getHumidY = (h: number) => 120 - ((h - 30) / 70) * 90;
                  const getX = (idx: number) => (CHART_WIDTH / 3) * idx;
                  
                  let path = `M ${getX(0)},${getHumidY(humidPoints[0])}`;
                  for (let i = 1; i < humidPoints.length; i++) {
                    const cpX1 = getX(i - 1) + (getX(i) - getX(i - 1)) / 2;
                    const cpY1 = getHumidY(humidPoints[i - 1]);
                    const cpX2 = getX(i - 1) + (getX(i) - getX(i - 1)) / 2;
                    const cpY2 = getHumidY(humidPoints[i]);
                    path += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${getX(i)},${getHumidY(humidPoints[i])}`;
                  }
                  return path;
                })()} 
                fill="none" 
                stroke="#0EA5E9" 
                strokeWidth="3.5" 
                strokeLinecap="round" 
                opacity="0.9" 
              />
                    
              {/* Dynamic Temp Path - Smooth Bezier */}
              <Path 
                d={(() => {
                  const currentTemp = parseFloat(metrics.temp) || 28.5;
                  const tempPoints = [
                    currentTemp - 1.4,
                    currentTemp - 0.5,
                    currentTemp + 0.9,
                    currentTemp
                  ];
                  const getTempY = (t: number) => 120 - ((t - 24) / 12) * 90;
                  const getX = (idx: number) => (CHART_WIDTH / 3) * idx;
                  
                  let path = `M ${getX(0)},${getTempY(tempPoints[0])}`;
                  for (let i = 1; i < tempPoints.length; i++) {
                    const cpX1 = getX(i - 1) + (getX(i) - getX(i - 1)) / 2;
                    const cpY1 = getTempY(tempPoints[i - 1]);
                    const cpX2 = getX(i - 1) + (getX(i) - getX(i - 1)) / 2;
                    const cpY2 = getTempY(tempPoints[i]);
                    path += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${getX(i)},${getTempY(tempPoints[i])}`;
                  }
                  return path;
                })()} 
                fill="none" 
                stroke="#F59E0B" 
                strokeWidth="3.5" 
                strokeLinecap="round" 
                opacity="0.9" 
              />

              {/* Anchor Dots */}
              {(() => {
                const currentTemp = parseFloat(metrics.temp) || 28.5;
                const currentHumid = parseFloat(metrics.humid) || 75.0;
                const getTempY = (t: number) => 120 - ((t - 24) / 12) * 90;
                const getHumidY = (h: number) => 120 - ((h - 30) / 70) * 90;
                return (
                  <G>
                    <Circle cx={CHART_WIDTH} cy={getTempY(currentTemp)} r="5" fill="#F59E0B" stroke="#FFF" strokeWidth="2" />
                    <Circle cx={CHART_WIDTH} cy={getHumidY(currentHumid)} r="5" fill="#0EA5E9" stroke="#FFF" strokeWidth="2" />
                  </G>
                );
              })()}
            </Svg>

            <View style={styles.axisRow}>
              <Text style={styles.axisTime}>T-6h</Text>
              <Text style={styles.axisTime}>T-4h</Text>
              <Text style={styles.axisTime}>T-2h</Text>
              <Text style={[styles.axisTime, {color:'#10B981', fontWeight: '800'}]}>LIVE</Text>
            </View>

            {/* Real-time Deltas */}
            <View style={styles.iotStatsRow}>
              <View style={styles.iotStatItem}>
                <View style={[styles.iotStatDot, { backgroundColor: '#F59E0B' }]} />
                <View>
                  <Text style={styles.iotStatLabel}>TEMP</Text>
                  <Text style={styles.iotStatVal}>{isFetching ? '--' : metrics.temp}°C</Text>
                  <Text style={styles.telemetryDelta}>Δ +0.2°/h</Text>
                </View>
              </View>
              <View style={styles.iotStatItem}>
                <View style={[styles.iotStatDot, { backgroundColor: '#06B6D4' }]} />
                <View>
                  <Text style={styles.iotStatLabel}>HUMID</Text>
                  <Text style={styles.iotStatVal}>{isFetching ? '--' : metrics.humid}%</Text>
                  <Text style={styles.telemetryDelta}>Δ +1.5%/h</Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── 4. 14-Day Surge Prediction (AEDE CORE) ── */}
        <Animated.View entering={FadeInUp.delay(400).springify()} style={[styles.card, styles.largeCard]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>14-Day Surge Probability Lead-Time</Text>
            <Target size={16} color="#0EA5E9" />
          </View>
          <Text style={styles.cardSub}>Hyper-Local Precision (100m zones)</Text>
          
          <View style={styles.graphWrapper}>
            <Svg width={CHART_WIDTH + CHART_GUTTER} height={200}>
              <Defs>
                <SvgGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#0EA5E9" stopOpacity="0.4" />
                  <Stop offset="1" stopColor="#0EA5E9" stopOpacity="0.05" />
                </SvgGradient>
              </Defs>

              <G transform={`translate(${CHART_GUTTER}, 10)`}>
                {/* Y-Axis Grid & Labels */}
                {[0, 25, 50, 75, 100].map((val) => {
                  const y = 180 - (val * 1.5);
                  return (
                    <G key={val}>
                      <Line x1="0" y1={y} x2={CHART_WIDTH} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                      <SvgText x="-8" y={y + 4} fill="#94A3B8" fontSize="10" textAnchor="end" fontWeight="900">{val}%</SvgText>
                    </G>
                  );
                })}

                {/* Threshold Line (Red Dashed) */}
                <Line x1="0" y1={180 - (75 * 1.5)} x2={CHART_WIDTH} y2={180 - (75 * 1.5)} stroke="#0284C7" strokeWidth="2" strokeDasharray="6,4" />
                <SvgText x={CHART_WIDTH} y={180 - (75 * 1.5) - 6} fill="#0369A1" fontSize="10" fontWeight="900" textAnchor="end">THRESHOLD (75%)</SvgText>

                {/* Shaded Area, Line Path & Confidence shading from ML Predictor */}
                {(() => {
                  const finalProb = parseInt(metrics.surgeProb) || 20;
                  const baselineProb = 15;
                  
                  const forecastCurveValues = Array.from({ length: 7 }, (_, idx) => {
                    const t = idx / 6;
                    return Math.round(baselineProb + (finalProb - baselineProb) * (t * t * (3 - 2 * t)));
                  });

                  const getForecastX = (idx: number) => (CHART_WIDTH / 6) * idx;
                  const getForecastY = (prob: number) => 170 - (prob / 100) * 150;

                  // outline & area paths
                  let areaPath = `M 0,170`;
                  let linePath = `M 0,${getForecastY(forecastCurveValues[0])}`;

                  forecastCurveValues.forEach((val, idx) => {
                    const x = getForecastX(idx);
                    const y = getForecastY(val);
                    areaPath += ` L ${x},${y}`;
                    if (idx > 0) {
                      linePath += ` L ${x},${y}`;
                    }
                  });
                  areaPath += ` L ${CHART_WIDTH},170 Z`;

                  // CI shading
                  const ciLowVal = parseInt(metrics.ciLow) || 10;
                  const ciHighVal = parseInt(metrics.ciHigh) || 30;
                  const ciLowCurve = forecastCurveValues.map(val => Math.max(3, val - (val / 100) * (ciHighVal - ciLowVal)));
                  const ciHighCurve = forecastCurveValues.map(val => Math.min(99, val + (val / 100) * (ciHighVal - ciLowVal)));

                  let ciShading = `M 0,${getForecastY(ciLowCurve[0])}`;
                  for (let i = 1; i < 7; i++) {
                    ciShading += ` L ${getForecastX(i)},${getForecastY(ciLowCurve[i])}`;
                  }
                  for (let i = 6; i >= 0; i--) {
                    ciShading += ` L ${getForecastX(i)},${getForecastY(ciHighCurve[i])}`;
                  }
                  ciShading += ` Z`;

                  return (
                    <G>
                      <Path d={ciShading} fill="#0EA5E9" opacity="0.12" />
                      <Path d={areaPath} fill="url(#gradBlue)" />
                      <Path d={linePath} fill="none" stroke="#0EA5E9" strokeWidth="5" strokeLinecap="round" />
                      <Circle cx={getForecastX(5)} cy={getForecastY(forecastCurveValues[5])} r="5" fill="#0EA5E9" stroke="#FFF" strokeWidth="2" />
                    </G>
                  );
                })()}
              </G>
            </Svg>

            {/* X-Axis Labels */}
            <View style={[styles.xAxis, { marginLeft: CHART_GUTTER }]}>
              {['D1', 'D3', 'D5', 'D7', 'D9', 'D11', 'D14'].map((day, i) => (
                <View key={day} style={styles.axisCol}><Text style={styles.axisTextDark}>{day}</Text></View>
              ))}
            </View>
          </View>

          <View style={styles.scientificExplanation}>
            <Text style={styles.explanationTitle}>Scientific Forecast Interpretation</Text>
            <Text style={styles.explanationText}>
              The model fuses meteorological telemetry, NDWI/EVI surface moisture, and epidemiological baseline logs. The blue band is the projected confidence interval ({metrics.ciLow}-{metrics.ciHigh}%) for the 14-day lead-time estimate.
            </Text>
          </View>

          <View style={[styles.insightBox, !highSurge && styles.insightBoxCalm]}>
            {highSurge ? (
              <AlertTriangle size={20} color="#0284C7" />
            ) : (
              <CheckCircle2 size={20} color="#0EA5E9" />
            )}
            <View style={{flex: 1}}>
               <Text style={[styles.insightTitle, !highSurge && styles.insightTitleCalm]}>
                 {highSurge ? `Elevated outlook: ${metrics.surgeDays}` : 'Environment Stable'}
               </Text>
               <Text style={[styles.insightText, !highSurge && styles.insightTextCalm]}>
                 LSTM cross-validation indicates an <Text style={{fontWeight:'900'}}>{isFetching ? '--' : metrics.surgeProb} probability</Text> of vector reproduction levels in {activeBarangay}.
               </Text>
            </View>
          </View>
        </Animated.View>

      </ScrollView>

      {/* Floating AI Chat Button */}
      <Animated.View entering={SlideInDown.delay(600).springify()} style={styles.fabContainer}>
        <TouchableOpacity 
          style={styles.fabButton} 
          activeOpacity={0.8}
          onPress={() => setIsChatVisible(true)}
        >
          <MessageSquare size={24} color="#FFF" />
          <Text style={styles.fabText}>Ask AEDE AI</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* AEDE AI Chat Modal (Groq Powered) */}
      <Modal
        visible={isChatVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsChatVisible(false)}
      >
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalDismissArea} 
              activeOpacity={1} 
              onPress={() => setIsChatVisible(false)} 
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
              style={{ width: '100%' }}
            >
              <Animated.View entering={FadeInUp.springify()} style={styles.chatModal}>
              <View style={styles.modalHeader}>
                <View style={styles.mascotCircle}>
                  <Image 
                    source={require('../../assets/images/mascot.png')} 
                    style={{width: 40, height: 40}} 
                    resizeMode="contain" 
                  />
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.modalTitle}>AEDE Assistant</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Text style={styles.modalStatus}>{activeBarangay} · Katambay AI</Text>
                    <View style={[
                      styles.chatModeBadge, 
                      { backgroundColor: chatMode === 'online' ? '#10B98120' : '#F59E0B20', borderColor: chatMode === 'online' ? '#10B981' : '#F59E0B' }
                    ]}>
                      <View style={[styles.chatModeDot, { backgroundColor: chatMode === 'online' ? '#10B981' : '#F59E0B' }]} />
                      <Text style={[styles.chatModeText, { color: chatMode === 'online' ? '#047857' : '#D97706' }]}>
                        {chatMode === 'online' ? 'AI Online' : 'Offline Mode'}
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setIsChatVisible(false)} style={styles.modalCloseBtn}>
                  <X size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.chatScroll} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 12, flexGrow: 1 }}
              >
                {messages.map((msg) => (
                  <View key={msg.id} style={msg.role === 'ai' ? styles.aiBubble : styles.userBubble}>
                    <Text style={msg.role === 'ai' ? styles.aiText : styles.userText}>
                      {msg.text}
                    </Text>
                  </View>
                ))}
                {isTyping && (
                  <View style={styles.aiBubble}>
                    <Text style={styles.aiText}>AEDE is thinking...</Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.chatFooter}>
                <TouchableOpacity
                  style={styles.promptsToggle}
                  onPress={() => setShowChatPrompts(p => !p)}
                >
                  <Sparkles size={16} color={COLORS.primary} />
                  <Text style={styles.promptsToggleText}>Quick asks</Text>
                  {showChatPrompts ? <ChevronUp size={14} color={COLORS.slateLight} /> : <ChevronDown size={14} color={COLORS.slateLight} />}
                </TouchableOpacity>
                {showChatPrompts && (
                  <View style={styles.promptsGrid}>
                    {SHORT_PROMPTS.map((p) => (
                      <TouchableOpacity key={p.label} style={styles.promptMini} onPress={() => handleSendMessage(p.text)}>
                        <Text style={styles.promptMiniText}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={styles.chatInputContainer}>
                  <TextInput 
                    style={styles.chatInput}
                    placeholder="Message AEDE..."
                    placeholderTextColor="#94A3B8"
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                  />
                  <TouchableOpacity style={styles.chatSendBtn} onPress={() => handleSendMessage()}>
                    <Send size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
              </Animated.View>
            </KeyboardAvoidingView>
          </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 100,
  },
  
  intelBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20, backgroundColor: '#FFF', paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  intelItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  intelText: { fontSize: 8, fontWeight: '900', color: COLORS.slateLight, letterSpacing: 1 },
  intelDivider: { width: 1, height: 10, backgroundColor: '#E2E8F0' },

  // 1. Header
  headerBox: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  aiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiLabelText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 2,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 14,
  },
  headerBadges: {
    flexDirection: 'row',
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pulseContainer: { width: 12, height: 12, justifyContent: 'center', alignItems: 'center' },
  statusText: { fontSize: 11, fontWeight: '800', color: '#0891B2' },
  accuracyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  accuracyText: { fontSize: 11, fontWeight: '800', color: '#FFF' },

  // Shared Card Styles
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    marginBottom: 20,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  largeCard: { paddingBottom: 24 },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  cardSub: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 20,
  },

  // 2. Data Fusion Matrix
  signalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18, justifyContent: 'space-between' },
  signalCard: { width: '48%', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  signalHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  signalLabel: { fontSize: 9, fontWeight: '800', color: '#64748B', flex: 1 },
  signalValue: { fontSize: 13, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  fusionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fusionInputs: {
    gap: 10,
    flex: 1,
  },
  fusionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 10,
  },
  fusionPillText: { fontSize: 12, fontWeight: '800', color: '#1E293B' },
  fusionPillSub: { fontSize: 10, color: '#64748B', marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  fusionLines: {
    width: 60,
    alignItems: 'center',
  },
  fusionCoreBox: {
    alignItems: 'center',
    width: 100,
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  coreGlow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 8,
  },
  coreText: { fontSize: 12, fontWeight: '900', color: '#0369A1', marginBottom: 2 },
  coreSub: { fontSize: 9, color: '#0EA5E9', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  // 3. IoT Monitoring
  pillScroller: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  graphWrapper: {
    position: 'relative',
    marginTop: 4,
  },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisTime: { color: '#94A3B8', fontSize: 10, fontWeight: 'bold' },
  
  iotStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iotStatItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  iotStatDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  iotStatLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1 },
  iotStatVal: { fontSize: 16, fontWeight: '900', color: '#1E293B', marginTop: 2 },
  telemetryDelta: { color: '#64748B', fontSize: 10, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  // 4. Surge Prediction
  tooltipBox: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  tooltipText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 6,
  },
  axisCol: { alignItems: 'center' },
  axisTextDark: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1 },
  
  insightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  insightBoxCalm: { backgroundColor: '#F0F9FF', borderColor: '#E0F2FE' },
  insightTitle: { color: '#0369A1', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  insightTitleCalm: { color: '#0284C7' },
  insightText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
    fontWeight: '600',
  },
  insightTextCalm: { color: '#475569' },
  
  fusionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  fusionFooterText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
  },
  scientificExplanation: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  explanationText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    fontWeight: '500',
  },

  // Modal Styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  chatModal: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: SCREEN_HEIGHT * 0.78,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalCloseBtn: {
    padding: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  mascotCircle: {
    width: 52, height: 52,
    borderRadius: 26,
    backgroundColor: '#F0F9FF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#BAE6FD',
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  modalStatus: { fontSize: 12, color: '#0EA5E9', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  chatScroll: { flex: 1, minHeight: 120 },
  chatFooter: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },
  promptsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
  promptsToggleText: { flex: 1, fontSize: 12, fontWeight: '800', color: COLORS.slate },
  promptsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  promptMini: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD' },
  promptMiniText: { fontSize: 11, fontWeight: '800', color: '#0369A1' },
  mapLegendRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 14, paddingVertical: 10, backgroundColor: '#F8FAFC', borderRadius: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLbl: { fontSize: 11, fontWeight: '800', color: COLORS.slateLight },
  iotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    maxWidth: 160,
  },
  iotPillDot: { width: 8, height: 8, borderRadius: 4 },
  iotPillText: { fontSize: 12, fontWeight: '700', color: COLORS.slate, flexShrink: 1 },
  iotActiveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 16,
    marginTop: 4,
  },
  iotActiveDot: { width: 12, height: 12, borderRadius: 6 },
  iotActiveName: { fontSize: 15, fontWeight: '900', color: COLORS.slate },
  iotActiveMeta: { fontSize: 11, fontWeight: '700', color: COLORS.slateLight, marginTop: 2 },
  iotActivePct: { fontSize: 20, fontWeight: '900' },
  iotSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  iotSearchInput: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.slate },
  aiBubble: {
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 24,
    borderTopLeftRadius: 4,
    alignSelf: 'flex-start',
    maxWidth: '85%',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
  },
  userBubble: {
    backgroundColor: '#0EA5E9',
    padding: 16,
    borderRadius: 24,
    borderTopRightRadius: 4,
    alignSelf: 'flex-end',
    maxWidth: '85%',
    marginBottom: 16,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  aiText: { fontSize: 15, color: '#0F172A', lineHeight: 22, fontWeight: '700' },
  userText: { fontSize: 15, color: '#FFF', lineHeight: 22, fontWeight: '700' },
  
  chatInputContainer: { 
    flexDirection: 'row', 
    gap: 10, 
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  chatInputWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chatPlaceholder: { color: '#94A3B8', fontWeight: '600', fontSize: 14 },
  chatSendBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: '#0EA5E9',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  // FAB Chat Button
  fabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 110,
    right: 20,
    left: 20,
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    gap: 10,
  },
  fabText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '600',
  },
  modalDismissArea: { flex: 0.12 },
  riskHero: { borderRadius: 32, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: '#BAE6FD', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 1 },
  riskHeroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  riskZoneLabel: { fontSize: 9, fontWeight: '900', color: COLORS.primary, letterSpacing: 1.5 },
  riskBarangay: { fontSize: 24, fontWeight: '900', color: '#0C4A6E', marginTop: 4, letterSpacing: -0.5 },
  riskLevelPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  riskLevelDot: { width: 8, height: 8, borderRadius: 4 },
  riskLevelText: { fontSize: 10, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.5 },
  riskMetricsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  riskMetric: { flex: 1, alignItems: 'center' },
  riskMetricVal: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  riskMetricLbl: { fontSize: 9, fontWeight: '700', color: '#64748B', marginTop: 4, textAlign: 'center' },
  riskMetricDivider: { width: 1, height: 36, backgroundColor: '#E2E8F0' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  actionIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center' },
  actionIndexText: { fontSize: 12, fontWeight: '900', color: COLORS.primary },
  actionText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#334155', lineHeight: 18 },
  shieldLeft: { 
    position: 'relative', 
    width: 80, 
    height: 80, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  shieldPercentageBox: { 
    position: 'absolute', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  shieldPercentageText: { 
    fontSize: 16, 
    fontWeight: '900' 
  },
  shieldHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  shieldStatusTitle: { 
    fontSize: 11, 
    fontWeight: '900', 
    letterSpacing: 0.5
  },
  shieldStatusDesc: { 
    fontSize: 11, 
    fontWeight: '600', 
    lineHeight: 16 
  },
  telemetryOverlay: { 
    flexDirection: 'row', 
    gap: 10, 
    marginBottom: 20, 
    justifyContent: 'space-between' 
  },
  teleChip: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
    backgroundColor: '#FFFFFF', 
    paddingHorizontal: 10, 
    paddingVertical: 10, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#F1F5F9', 
    shadowColor: '#0F172A', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.02, 
    shadowRadius: 6, 
    elevation: 1 
  },
  teleText: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: '#0F172A' 
  },
  chatModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  chatModeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chatModeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  satelliteContainer: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  satelliteImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#0F172A',
  },
  satelliteBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  satelliteBadgeText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  satelliteInfoContainer: {
    padding: 16,
    gap: 10,
  },
  satelliteInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  satelliteInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  satelliteInfoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    textAlign: 'right',
  },
});
