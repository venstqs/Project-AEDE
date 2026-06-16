import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  SafeAreaView, Dimensions, Platform, Modal, TextInput, Image, Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { 
  ShieldCheck, 
  Thermometer, 
  Droplet, 
  ArrowRight,
  Zap, 
  Activity,
  Bell,
  MapPin,
  TrendingUp,
  TrendingDown,
  Wind,
  Layers,
  User,
  Heart,
  ChevronRight,
  Cpu,
  Search,
  X,
  Info,
  AlertTriangle,
  Target,
  CheckCircle2,
  Users,
  Award,
  Eye,
  Microscope,
  Stethoscope,
  BarChart2,
  Calendar,
  Satellite,
  Circle as CircleIcon,
  Sparkles,
  MessageSquare,
  BadgeCheck,
  Radio,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, G, Line, Path, Stop, LinearGradient as SvgGradient, Circle, Text as SvgText } from 'react-native-svg';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence, 
  Easing,
  ZoomIn,
  ZoomOut
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { HOME_DIRECTIVES, OFFICIAL_COMMUNITY_POSTS, BARANGAY_AI_METRICS, APP_COLORS } from '../../constants/appData';
import { OPENWEATHER_API_KEY } from '../../constants/env';
import { NAGA_BARANGAYS, MAP_RISK_COLORS, getColorForRisk, getRiskLabel, buildIotMetricsFromRisk } from '../../constants/nagaBarangays';
import { SINGAPORE_REGIONS } from '../../constants/singaporeRegions';
import { DatabaseService } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runInferenceModel } from '../../lib/predictiveEngine';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#0284C7',
  accent: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
  white: '#FFFFFF',
  slate: '#0F172A',
  slateLight: '#64748B',
  slateDark: '#0C4A6E',
  bg: '#F8FAFC',
  pink: APP_COLORS.pink,
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
  return { uri: imageName };
};

// -- Floating Decorative Element --
const BackgroundGlow = ({ color, size, top, left }: any) => {
  const opacity = useSharedValue(0.1);
  React.useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.15, { duration: 4000 }), withTiming(0.1, { duration: 4000 })), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ position: 'absolute', top, left, width: size, height: size, borderRadius: size/2, backgroundColor: color, filter: 'blur(60px)' }, style]} />;
};

function getProjectedRiskScore(barangay: any, forecastDay: number, dbCases: Record<string, { active: number; baseline: number }>): number {
  const baseMetrics = buildIotMetricsFromRisk(barangay);
  
  const brgyCases = dbCases[barangay.name] || { active: 0, baseline: 10 };
  const baseline = brgyCases.baseline || 10;

  const totalCityCases = Object.values(dbCases).reduce((sum, c) => sum + c.active, 0);
  const caseNow = totalCityCases > 0 
    ? brgyCases.active 
    : Math.round(barangay.riskScore * 28);

  const ndwi = parseFloat(baseMetrics.ndwi);
  const evi = parseFloat(baseMetrics.evi);

  const microTempOffset = -1.2 * evi + 0.8 * (1 - evi);
  const microHumidOffset = 10.0 * ndwi + 5.0 * evi;

  const baseTemp = 29.5 + microTempOffset;
  const baseHumid = Math.min(100, Math.max(40, 80 + microHumidOffset));

  const simulatedTemp = baseTemp + (forecastDay * 0.05);
  const simulatedHumid = Math.min(100, baseHumid + (forecastDay * 0.25));

  const inference = runInferenceModel({
    temperature: simulatedTemp,
    humidity: simulatedHumid,
    ndwi,
    evi,
    caseNow,
    baseline,
    verifiedReports: 0
  });

  const percent = parseFloat(inference.surgeProb);
  let score = percent / 100;

  if (score > 0.5) {
    score = Math.min(0.98, score + (forecastDay * 0.015));
  } else if (score < 0.35) {
    score = Math.max(0.02, score - (forecastDay * 0.008));
  } else {
    score = Math.min(0.75, score + (forecastDay * 0.003));
  }

  return score;
}

function formatInt(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}

const SEARCH_ROUTES = [
  { label: 'Risk Map', route: '/map', icon: MapPin },
  { label: 'AEDE AI Engine', route: '/report', icon: Cpu },
  { label: 'Community Feed', route: '/explore', icon: Layers },
  { label: 'Guardian Profile', route: '/profile', icon: User },
];

// -- Mock Data --
const getNotifications = (country: 'Philippines' | 'Singapore') => country === 'Singapore' ? [
  { id: '1', type: 'warning', title: 'High Risk Alert', body: 'Punggol & Woodlands show elevated vector breeding activity.', time: '2m ago' },
  { id: '2', type: 'info', title: 'System Ready', body: 'AEDE Predictive model synced successfully.', time: '1h ago' },
] : [
  { id: '1', type: 'warning', title: 'High Risk Alert', body: 'Dayangdang Zone 4 shows increased activity.', time: '2m ago' },
  { id: '2', type: 'info', title: 'System Ready', body: 'AEDE Predictive model synced successfully.', time: '1h ago' },
];

const REGIONAL_STATUS = [
  {
    id: '1', name: 'Dayangdang', zone: 'H3-81747', risk: 'High', highlighted: true,
    color: MAP_RISK_COLORS.high, trend: 'up' as const, change: '+18%',
    cases: [12, 18, 22, 30, 27, 35, 41], forecast: [44, 48, 51, 46, 42, 39, 37],
    humidity: 84, temp: 31.2,
    desc: 'Critical vector density in H3 Zone 81747. 14-day lead time indicates surge in T+12 days.',
  },
  {
    id: '2', name: 'Concepcion Pequeña', zone: 'H3-81510', risk: 'High', highlighted: true,
    color: MAP_RISK_COLORS.high, trend: 'up' as const, change: '+14%',
    cases: [9, 11, 14, 16, 18, 20, 22], forecast: [24, 26, 25, 23, 21, 20, 19],
    humidity: 86, temp: 31.0,
    desc: 'Elevated case drift. IoT nodes reporting sustained humidity above vector threshold.',
  },
  {
    id: '3', name: 'Lerma', zone: 'H3-81517', risk: 'High', highlighted: true,
    color: MAP_RISK_COLORS.high, trend: 'up' as const, change: '+11%',
    cases: [6, 8, 10, 12, 11, 13, 15], forecast: [16, 17, 16, 14, 13, 12, 11],
    humidity: 82, temp: 30.6,
    desc: 'High-risk zone on map. Field teams scheduled for container inspection sweep.',
  },
];

const HIGHLIGHTED_ANALYTICS = REGIONAL_STATUS.filter(r => r.highlighted);

const WEEK_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const OPERATION_METRICS = [
  { label: 'Barangays watched', value: '27', tone: COLORS.primary },
  { label: 'High priority', value: '3', tone: COLORS.danger },
  { label: 'Reports queued', value: '8', tone: COLORS.accent },
];

function BarangayAnalyticsCard({ item, onPress }: { item: typeof REGIONAL_STATUS[0]; onPress: () => void }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPress={() => setExpanded(e => !e)}
      onLongPress={onPress}
      style={analyticsStyles.card}
    >
      {/* Header row */}
      <View style={analyticsStyles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={analyticsStyles.cardName}>{item.name}</Text>
          <Text style={analyticsStyles.zoneText}>{item.zone} · Sentinel Monitored Grid</Text>
        </View>
        <View style={analyticsStyles.rightHeaderCol}>
          <View style={[analyticsStyles.riskPill, { borderColor: item.color, borderWidth: 1, backgroundColor: item.color + '0C' }]}>
            <View style={[analyticsStyles.riskDot, { backgroundColor: item.color }]} />
            <Text style={[analyticsStyles.riskText, { color: item.color }]}>{item.risk.toUpperCase()}</Text>
          </View>
          <View style={analyticsStyles.changeRow}>
            {item.trend === 'up'
              ? <TrendingUp size={12} color={item.color} />
              : <TrendingDown size={12} color={COLORS.success} />}
            <Text style={[analyticsStyles.changeText, { color: item.trend === 'up' ? item.color : COLORS.success }]}>{item.change}</Text>
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View style={analyticsStyles.statsRow}>
        <View style={analyticsStyles.stat}>
          <Activity size={14} color={item.color} style={analyticsStyles.statIcon} />
          <View style={analyticsStyles.statContent}>
            <Text style={analyticsStyles.statVal}>{item.cases[item.cases.length - 1]}</Text>
            <Text style={analyticsStyles.statLbl}>Active Cases</Text>
          </View>
        </View>
        <View style={analyticsStyles.statDiv} />
        <View style={analyticsStyles.stat}>
          <Thermometer size={14} color={COLORS.primary} style={analyticsStyles.statIcon} />
          <View style={analyticsStyles.statContent}>
            <Text style={analyticsStyles.statVal}>{item.temp}°C</Text>
            <Text style={analyticsStyles.statLbl}>Temp</Text>
          </View>
        </View>
        <View style={analyticsStyles.statDiv} />
        <View style={analyticsStyles.stat}>
          <Droplet size={14} color={COLORS.primary} style={analyticsStyles.statIcon} />
          <View style={analyticsStyles.statContent}>
            <Text style={analyticsStyles.statVal}>{item.humidity}%</Text>
            <Text style={analyticsStyles.statLbl}>Humidity</Text>
          </View>
        </View>
      </View>

      <Text style={analyticsStyles.expandHint}>
        {expanded ? '▲ Tap to hide forecast chart' : '▼ Tap to view 14-day forecasts · Long-press for map'}
      </Text>

      {expanded && (
        <Animated.View entering={FadeInDown.duration(400)} style={analyticsStyles.expanded}>
          <Text style={analyticsStyles.descText}>{item.desc}</Text>
          <Text style={analyticsStyles.chartLabel}>PAST 7 DAYS VS. 7-DAY PREDICTIONS</Text>
          
          <View style={analyticsStyles.chartWrapper}>
            <Svg width={width - 80} height={110}>
              <Defs>
                <SvgGradient id={`gradLineBrgy-${item.name}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={item.color} stopOpacity="0.22" />
                  <Stop offset="1" stopColor={item.color} stopOpacity="0.0" />
                </SvgGradient>
              </Defs>
              
              {/* Draw Bezier Line Path */}
              {(() => {
                const points = [...item.cases, ...item.forecast];
                const chartMax = Math.max(...points, 10); // Ensure a reasonable baseline
                const paddingLeft = 25; // Space for Y-axis labels
                const paddingRight = 10;
                const chartWidth = width - 80 - paddingLeft - paddingRight;
                const chartHeight = 85;
                const paddingTop = 15;
                
                const getX = (idx: number) => paddingLeft + (chartWidth / (points.length - 1)) * idx;
                const getY = (val: number) => paddingTop + chartHeight - (val / chartMax) * chartHeight;

                // Path generator
                let pathStr = `M ${getX(0)},${getY(points[0])}`;
                let areaStr = `M ${getX(0)},${paddingTop + chartHeight} L ${getX(0)},${getY(points[0])}`;

                for (let i = 1; i < points.length; i++) {
                  const cpX1 = getX(i - 1) + (getX(i) - getX(i - 1)) / 2;
                  const cpY1 = getY(points[i - 1]);
                  const cpX2 = getX(i - 1) + (getX(i) - getX(i - 1)) / 2;
                  const cpY2 = getY(points[i]);
                  pathStr += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${getX(i)},${getY(points[i])}`;
                  areaStr += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${getX(i)},${getY(points[i])}`;
                }
                
                areaStr += ` L ${getX(points.length - 1)},${paddingTop + chartHeight} Z`;

                return (
                  <G>
                    {/* Y-Axis Labels & Horizontal Grid lines */}
                    {[0, chartMax / 2, chartMax].map((val) => {
                      const yPos = getY(val);
                      return (
                        <G key={val}>
                          <Line x1={paddingLeft} y1={yPos} x2={paddingLeft + chartWidth} y2={yPos} stroke="#F1F5F9" strokeWidth="1" />
                          <SvgText x={paddingLeft - 5} y={yPos + 4} fontSize="9" fill="#94A3B8" fontWeight="700" textAnchor="end">
                            {Math.round(val)}
                          </SvgText>
                        </G>
                      );
                    })}

                    {/* Area fill */}
                    <Path d={areaStr} fill={`url(#gradLineBrgy-${item.name})`} />
                    {/* Main stroke */}
                    <Path d={pathStr} fill="none" stroke={item.color} strokeWidth="3.5" strokeLinecap="round" />
                    
                    {/* Split line between observed and predicted */}
                    <Line 
                      x1={getX(6)} 
                      y1={paddingTop} 
                      x2={getX(6)} 
                      y2={paddingTop + chartHeight} 
                      stroke="#94A3B8" 
                      strokeWidth="1.5" 
                      strokeDasharray="4,4" 
                    />
                    
                    {/* Anchor dots */}
                    <Circle cx={getX(6)} cy={getY(points[6])} r="5" fill={item.color} stroke="#FFF" strokeWidth="2" />
                    <Circle cx={getX(points.length - 1)} cy={getY(points[points.length - 1])} r="5" fill={item.color} stroke="#FFF" strokeWidth="2" opacity="0.6" />
                  </G>
                );
              })()}
            </Svg>

            <View style={[analyticsStyles.axisRow, { marginLeft: 25 }]}>
              <Text style={analyticsStyles.axisText}>Past</Text>
              <Text style={[analyticsStyles.axisText, { fontWeight: '900', color: item.color }]}>NOW</Text>
              <Text style={analyticsStyles.axisText}>Future</Text>
            </View>
          </View>

          <View style={analyticsStyles.legendRow}>
            <View style={analyticsStyles.legendItem}>
              <View style={[analyticsStyles.legendDot, { backgroundColor: item.color }]} />
              <Text style={analyticsStyles.legendText}>Confirmed Cases</Text>
            </View>
            <View style={analyticsStyles.legendItem}>
              <View style={[analyticsStyles.legendDot, { backgroundColor: item.color, opacity: 0.4 }]} />
              <Text style={analyticsStyles.legendText}>Forecast Trend</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

const analyticsStyles = StyleSheet.create({
  card: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 16, 
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  cardTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center', 
    marginBottom: 16 
  },
  rightHeaderCol: {
    alignItems: 'flex-end',
    gap: 4
  },
  riskPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  riskDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3 
  },
  riskText: { 
    fontSize: 9, 
    fontWeight: '900', 
    letterSpacing: 0.8
  },
  cardName: { 
    fontSize: 18, 
    fontWeight: '900', 
    color: '#0F172A',
    letterSpacing: -0.2
  },
  zoneText: { 
    fontSize: 11, 
    color: '#64748B', 
    fontWeight: '600', 
    marginTop: 2 
  },
  changeRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 2 
  },
  changeText: { 
    fontSize: 11, 
    fontWeight: '800' 
  },
  statsRow: { 
    flexDirection: 'row', 
    backgroundColor: '#F8FAFC', 
    borderRadius: 18, 
    padding: 14, 
    justifyContent: 'space-around', 
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  stat: { 
    flexDirection: 'row',
    alignItems: 'center', 
    gap: 8,
    flex: 1,
    justifyContent: 'center'
  },
  statIcon: {
    opacity: 0.8
  },
  statContent: {
    alignItems: 'flex-start'
  },
  statVal: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: '#0F172A' 
  },
  statLbl: { 
    fontSize: 9, 
    fontWeight: '700', 
    color: '#64748B', 
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  statDiv: { 
    width: 1, 
    height: 24,
    backgroundColor: '#E2E8F0' 
  },
  expandHint: { 
    fontSize: 10, 
    fontWeight: '700', 
    color: '#94A3B8', 
    textAlign: 'center', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5,
    marginTop: 2
  },
  expanded: { 
    marginTop: 18, 
    paddingTop: 18, 
    borderTopWidth: 1, 
    borderTopColor: '#F1F5F9' 
  },
  descText: { 
    fontSize: 13, 
    fontWeight: '500', 
    color: '#475569', 
    marginBottom: 16, 
    lineHeight: 20 
  },
  chartLabel: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: '#94A3B8', 
    letterSpacing: 1, 
    marginBottom: 16,
    textAlign: 'center'
  },
  chartWrapper: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 12
  },
  barsRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    height: 90, 
    gap: 4,
    justifyContent: 'space-between'
  },
  barCol: { 
    alignItems: 'center', 
    flex: 1, 
    gap: 6 
  },
  barTrack: {
    height: 70,
    justifyContent: 'flex-end',
    width: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 5,
    overflow: 'hidden'
  },
  bar: { 
    width: '100%', 
    borderRadius: 5 
  },
  barNum: { 
    fontSize: 8, 
    fontWeight: '800', 
    color: '#0F172A',
    marginBottom: 2
  },
  barDay: { 
    fontSize: 9, 
    fontWeight: '700', 
    color: '#94A3B8' 
  },
  barSep: { 
    width: 1, 
    height: 85, 
    marginHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center'
  },
  dashedLine: {
    width: 1,
    height: '100%',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderStyle: 'dashed'
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B'
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 6,
  },
  axisText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
  },
});

const GuardianOperations = ({ 
  onMapPress, 
  securedSites, 
  streakCount, 
  weeklyProgress 
}: { 
  onMapPress: () => void; 
  securedSites: number; 
  streakCount: number; 
  weeklyProgress: number; 
}) => {
  return (
    <View style={styles.opsContainer}>
      <View style={styles.opsHeader}>
        <View>
          <Text style={styles.opsTitle}>Guardian Operations</Text>
          <Text style={styles.opsSub}>Active duty status & impact</Text>
        </View>
        <TouchableOpacity style={styles.streakBadge} onPress={onMapPress}>
          <Zap size={14} color="#FFF" fill="#FFF" />
          <Text style={styles.streakText}>{streakCount} DAY STREAK</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.opsGrid}>
        <View style={styles.opsCard}>
          <View style={[styles.opsIconBox, { backgroundColor: '#F0F9FF' }]}>
            <ShieldCheck size={20} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.opsCardVal}>{securedSites}</Text>
            <Text style={styles.opsCardLbl}>Sites Secured</Text>
          </View>
        </View>
        <View style={styles.opsCard}>
          <View style={[styles.opsIconBox, { backgroundColor: '#F0FDF4' }]}>
            <Heart size={20} color={COLORS.success} />
          </View>
          <View>
            <Text style={styles.opsCardVal}>{formatInt(securedSites * 200)}</Text>
            <Text style={styles.opsCardLbl}>People Saved</Text>
          </View>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progInfo}>
          <Text style={styles.progLbl}>Weekly Mission Progress</Text>
          <Text style={styles.progVal}>{weeklyProgress}%</Text>
        </View>
        <View style={styles.progTrack}>
          <LinearGradient 
            colors={[COLORS.primary, COLORS.secondary]} 
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.progFill, { width: `${weeklyProgress}%` }]} 
          />
        </View>
      </View>

      <View style={styles.badgeStrip}>
        <Text style={styles.badgeStripLbl}>RECENT ACHIEVEMENTS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeScroll}>
          <View style={styles.miniBadge}><Award size={14} color={COLORS.accent} /><Text style={styles.miniBadgeText}>Sentinel</Text></View>
          <View style={styles.miniBadge}><Target size={14} color={COLORS.primary} /><Text style={styles.miniBadgeText}>Sharpshooter</Text></View>
          <View style={styles.miniBadge}><Users size={14} color={COLORS.secondary} /><Text style={styles.miniBadgeText}>Community Pillar</Text></View>
        </ScrollView>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const [activeCountry, setActiveCountry] = useState<'Philippines' | 'Singapore'>('Philippines');
  const [isNotifVisible, setIsNotifVisible] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [weather, setWeather] = useState({ temp: '29.4', humidity: '88', loading: true });
  const [directives, setDirectives] = useState(HOME_DIRECTIVES);
  const [posts, setPosts] = useState<any[]>([]);

  const [userName, setUserName] = useState('Adrian Xavier');
  const [userRole, setUserRole] = useState('Guardian Cadet');
  const [userLevel, setUserLevel] = useState(1);
  const [userPoints, setUserPoints] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [securedSites, setSecuredSites] = useState(0);
  const [weeklyProgress, setWeeklyProgress] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [currentUserUsername, setCurrentUserUsername] = useState('');

  const communityPreview = useMemo(() => {
    const isSG = activeCountry === 'Singapore';
    const filtered = posts.filter(p => {
      const isSGPost = p.location && p.location.toLowerCase().includes('singapore');
      return (isSG ? isSGPost : !isSGPost) && (p.pinned || p.type === 'alert' || p.isOfficial);
    });
    if (filtered.length === 0) {
      return isSG ? [
        {
          id: 'sg-mock-off-1',
          author: 'Singapore National Environment Agency (NEA)',
          content: 'Vector Alert: Punggol and Woodlands have been identified as high-risk zones. Residents are urged to perform the 5-step Mozzie Wipeout.',
          location: 'Punggol, Singapore',
          pinned: true,
          type: 'alert'
        },
        {
          id: 'sg-mock-off-2',
          author: 'Singapore Ministry of Health (MOH)',
          content: 'Clinical case numbers in Sengkang show minor elevations. Coordinated source reduction operations are underway.',
          location: 'Sengkang, Singapore',
          pinned: true,
          type: 'alert'
        }
      ] : OFFICIAL_COMMUNITY_POSTS.filter(p => p.pinned || p.type === 'alert').slice(0, 2);
    }
    return filtered.slice(0, 2);
  }, [posts, activeCountry]);
  
  // Dynamic clinical caseloads
  const [dbCases, setDbCases] = useState<Record<string, { active: number; baseline: number }>>({});

  const activeSectors = activeCountry === 'Singapore' ? SINGAPORE_REGIONS : NAGA_BARANGAYS;
  
  const highestRiskSector = useMemo(() => {
    let highest: any = null;
    let maxScore = -1;
    activeSectors.forEach(b => {
      const score = getProjectedRiskScore(b, 0, dbCases);
      if (score > maxScore) {
        maxScore = score;
        highest = { ...b, riskScore: score };
      }
    });
    return highest;
  }, [activeCountry, activeSectors, dbCases]);

  const surgeScore = highestRiskSector
    ? Math.round(highestRiskSector.riskScore * 100)
    : 84;

  const highRiskCount = activeSectors.filter((b: any) => getProjectedRiskScore(b, 0, dbCases) >= 0.7).length;

  const dynamicRegionalStatus = useMemo(() => {
    // Map each sector to the regional status structure using getProjectedRiskScore and buildIotMetricsFromRisk
    return activeSectors.map(b => {
      const currentScore = getProjectedRiskScore(b, 0, dbCases);
      const metrics = buildIotMetricsFromRisk({ ...b, riskScore: currentScore });
      const trend = currentScore >= 0.5 ? ('up' as const) : ('down' as const);
      
      const seed = b.name.length;
      const baseVal = Math.round(currentScore * 20) + 2;
      const cases = [
        Math.max(1, baseVal - 5),
        Math.max(1, baseVal - 3),
        Math.max(1, baseVal - 2),
        Math.max(1, baseVal + 1),
        Math.max(1, baseVal - 1),
        Math.max(1, baseVal + 2),
        baseVal
      ];
      
      const forecast = [
        baseVal + (trend === 'up' ? 2 : -1),
        baseVal + (trend === 'up' ? 4 : -2),
        baseVal + (trend === 'up' ? 5 : -3),
        baseVal + (trend === 'up' ? 3 : -2),
        baseVal + (trend === 'up' ? 2 : -1),
        baseVal,
        baseVal - 1
      ];

      return {
        id: b.id,
        name: b.name,
        zone: activeCountry === 'Singapore' ? `SG-${b.name.split(' ')[0].toUpperCase()}` : `H3-${81000 + (seed * 17) % 999}`,
        risk: getRiskLabel(currentScore),
        color: getColorForRisk(currentScore),
        trend,
        change: `${trend === 'up' ? '+' : '-'}${Math.round(currentScore * 15 + 5)}%`,
        cases,
        forecast,
        humidity: parseInt(metrics.humid) || 80,
        temp: parseFloat(metrics.temp) || 29.5,
        desc: activeCountry === 'Singapore'
          ? `Sustained breeding indices monitored in ${b.name}. Recommended container inspection sweep in high risk grids.`
          : `Critical vector density in ${b.name} sentinel grid. 14-day lead time indicates surge in T+12 days.`,
        highlighted: currentScore >= 0.4
      };
    })
    .sort((a, b) => b.cases[b.cases.length - 1] - a.cases[a.cases.length - 1]);
  }, [activeCountry, activeSectors, dbCases]);

  const HIGHLIGHTED_ANALYTICS = useMemo(() => {
    const list = dynamicRegionalStatus.filter((r: any) => r.highlighted);
    return list.length > 0 ? list.slice(0, 3) : dynamicRegionalStatus.slice(0, 3);
  }, [dynamicRegionalStatus]);

  const fetchDashboardData = async () => {
    try {
      const country = (await AsyncStorage.getItem('@aede:active_country') || 'Philippines') as 'Philippines' | 'Singapore';
      setActiveCountry(country);

      const profile = await DatabaseService.getLocalUserProfile();
      if (profile) {
        setUserName(profile.full_name || 'Adrian Xavier');
        setUserRole(profile.role || 'Guardian Cadet');
        const derivedLevel = Math.max(1, Math.floor((profile.points || 0) / 1000) + 1);
        setUserLevel(derivedLevel);
        setUserPoints(profile.points || 0);
        setStreakCount(profile.streak || 0);
        setSecuredSites(profile.completed_missions || 0);
        setCurrentUserUsername(profile.username || '');
      }

      // Fetch dynamic Supabase leaderboard
      const topProfiles = await DatabaseService.getLeaderboard();
      setLeaderboard(topProfiles);

      // Fetch dynamic community posts
      const dbPosts = await DatabaseService.getPosts();
      setPosts(dbPosts);

      // Fetch clinical cases
      const data = await DatabaseService.getDengueCases();
      const mapping: Record<string, { active: number; baseline: number }> = {};
      data.forEach(item => {
        mapping[item.barangay] = {
          active: item.active_cases,
          baseline: item.baseline_cases
        };
      });
      setDbCases(mapping);

      // Fetch missions to derive weekly progress
      const dbMissions = await DatabaseService.getMissions();
      if (dbMissions.length > 0) {
        const completed = dbMissions.filter(m => m.completed).length;
        setWeeklyProgress(Math.round((completed / dbMissions.length) * 100));
      } else {
        setWeeklyProgress(0);
      }

      // GPS Notice Pilot
      const warningShown = await AsyncStorage.getItem('@aede:gps_warning_shown');
      if (!warningShown) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          let shouldWarn = true;
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;
            const inNaga = lat >= 13.5 && lat <= 13.75 && lng >= 123.0 && lng <= 123.3;
            const inSingapore = lat >= 1.15 && lat <= 1.50 && lng >= 103.5 && lng <= 104.1;
            if (inNaga || inSingapore) {
              shouldWarn = false;
            }
          }
          
          if (shouldWarn) {
            Alert.alert(
              'Katambay-AI Pilot Notice', 
              'You are running the Katambay-AI pilot version. GPS indicates you are outside our primary testing zones. Data and regional maps are calibrated strictly for Naga City, Philippines and Singapore contexts only.'
            );
          }
        } catch (e) {
          Alert.alert(
            'Katambay-AI Pilot Notice', 
            'You are running the Katambay-AI pilot version. Data and regional maps are calibrated strictly for Naga City, Philippines and Singapore contexts only.'
          );
        }
        await AsyncStorage.setItem('@aede:gps_warning_shown', 'true');
      }
    } catch (err) {
      console.warn('Dashboard fetch failed:', err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000); // Refresh every 60s (was 10s — too aggressive for Supabase free tier)
    return () => clearInterval(interval);
  }, []);

  const openReport = () => router.push('/explore');

  const toggleDirective = async (id: string, route: string) => {
    const isCurrentlyDone = directives.find(d => d.id === id)?.done;
    if (!isCurrentlyDone) {
      // Award points when completed
      await DatabaseService.addPoints(15);
      router.push(route as any);
    }
    setDirectives(prev => prev.map(d => d.id === id ? { ...d, done: !d.done } : d));
  };

  // -- Live Weather Integration --
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const defaultLat = activeCountry === 'Singapore' ? 1.3521 : 13.6218;
        const defaultLng = activeCountry === 'Singapore' ? 103.8198 : 123.1945;
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${defaultLat}&lon=${defaultLng}&appid=${OPENWEATHER_API_KEY}&units=metric`);
        const json = await response.json();
        if (json.main) {
          setWeather({
            temp: json.main.temp.toFixed(1),
            humidity: json.main.humidity.toString(),
            loading: false
          });
        }
      } catch (err) {
        console.error("Weather fetch failed on Home:", err);
        setWeather(w => ({ ...w, loading: false }));
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 300000); // 5 mins
    return () => clearInterval(interval);
  }, [activeCountry]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* -- Background Glows -- */}
      <BackgroundGlow color={COLORS.primary} size={300} top={-100} left={-100} />
      <BackgroundGlow color={COLORS.secondary} size={250} top={SCREEN_HEIGHT / 2} left={width - 150} />

      <View style={styles.headerContainer}>
        <LinearGradient colors={['#BAE6FD', '#E0F2FE']} style={styles.header}>
          {/* Background Decorative Shapes */}
          <View style={[styles.decorSquircle, { top: -30, right: -40, width: 130, height: 130, transform: [{ rotate: '15deg' }] }]} />
          <View style={[styles.decorSquircle, { bottom: -30, left: -20, width: 100, height: 100, borderRadius: 28, opacity: 0.15, transform: [{ rotate: '-35deg' }] }]} />
          <View style={[styles.decorSquircle, { top: 40, left: 140, width: 36, height: 36, borderRadius: 10, opacity: 0.08, transform: [{ rotate: '45deg' }] }]} />

          <SafeAreaView>
            <View style={styles.headerContent}>
              <View style={styles.profileRow}>
                <TouchableOpacity style={styles.avatarPill} onPress={() => router.push('/profile')}>
                  <View style={styles.avatarCircle}>
                    <User size={20} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.welcomeText}>{activeCountry === 'Singapore' ? 'Hello' : 'Kamusta'}, {userName.split(' ')[0]}</Text>
                    <View style={styles.locationTag}>
                      <MapPin size={10} color={COLORS.primary} fill={COLORS.primary} />
                      <Text style={styles.locationText}>{userRole} · Lv. {userLevel}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
              
              <View style={styles.headerActions}>
                <View style={styles.countryHeaderBadge}>
                  <Text style={styles.countryFlagText}>{activeCountry === 'Singapore' ? '🇸🇬' : '🇵🇭'}</Text>
                  <Text style={styles.countryNameText}>{activeCountry === 'Singapore' ? 'SG' : 'PH'}</Text>
                </View>
                <TouchableOpacity style={styles.headerIconBtn} onPress={() => setIsNotifVisible(true)}>
                  <Bell size={20} color={COLORS.slate} />
                  <View style={styles.notifDot} />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      <View style={{ flex: 1 }}>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
        >

          {/* -- Campaign Banner (Visual campaign asset) -- */}
          <Animated.View entering={FadeInDown.duration(500).springify()} style={styles.campaignBannerContainer}>
            <View style={styles.campaignBannerCard}>
              <Image 
                source={require('../../assets/images/naga_dengue_cleanup.png')} 
                style={styles.campaignBannerImage} 
                resizeMode="cover"
              />
              <View style={styles.campaignBannerOverlay} />
              <View style={styles.campaignBannerContent}>
                <View style={styles.advisoryBadge}>
                  <Text style={styles.advisoryBadgeText}>
                    {highestRiskSector
                      ? `TARGET AREA: ${highestRiskSector.name.toUpperCase()}`
                      : `TARGET: SURVEILLANCE RADAR`}
                  </Text>
                </View>
                <View style={styles.campaignBannerHeader}>
                  <Sparkles size={12} color="#0284C7" fill="#0284C7" />
                  <Text style={styles.campaignBannerTag}>CITY-WIDE SOURCE REDUCTION CAMPAIGN</Text>
                </View>
                <Text style={styles.campaignBannerTitle}>Oplan Kulobong: Clear the Breeding Pools</Text>
                <Text style={styles.campaignBannerDesc}>
                  {highestRiskSector
                    ? `Our satellite telemetry indicates vector risk in ${highestRiskSector.name}. Empty pooled water and clear outdoor drains immediately.`
                    : `Cooperate with barangay health teams to audit residential plant saucers and open gutters across the city.`}
                </Text>
                <TouchableOpacity style={styles.campaignBannerBtn} onPress={() => router.push('/explore')}>
                  <Text style={styles.campaignBannerBtnText}>Report Breeding Risk</Text>
                  <ArrowRight size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* -- City pulse strip -- */}
          <TouchableOpacity style={styles.cityPulse} onPress={() => router.push('/map')} activeOpacity={0.9}>
            <View style={styles.cityPulseLeft}>
              <MapPin size={16} color={COLORS.primary} />
              <Text style={styles.cityPulseText}>{`${highRiskCount} high-risk zones · ${activeSectors.length} sectors monitored`}</Text>
            </View>
            <View style={styles.mapLegendMini}>
              <View style={[styles.mapLegendDot, { backgroundColor: MAP_RISK_COLORS.low }]} />
              <View style={[styles.mapLegendDot, { backgroundColor: MAP_RISK_COLORS.moderate }]} />
              <View style={[styles.mapLegendDot, { backgroundColor: MAP_RISK_COLORS.high }]} />
            </View>
            <ChevronRight size={18} color={COLORS.primary} />
          </TouchableOpacity>

          {/* -- Outbreak Command Hero HUD Card (Premium Overhaul) -- */}
          <Animated.View entering={FadeInUp.duration(800).springify()} style={styles.heroWrapper}>
            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View style={styles.statusPill}>
                  <Satellite size={12} color={COLORS.primary} />
                  <Text style={styles.statusPillText}>SATELLITE ORBIT RADAR</Text>
                </View>
                <Text style={styles.heroDate}>14-Day Vector Forecast</Text>
              </View>

              <View style={styles.shieldHUDContainer}>
                {/* Left SVG Gauge */}
                <View style={styles.shieldLeft}>
                  <Svg width={84} height={84} viewBox="0 0 80 80">
                    <Defs>
                      <SvgGradient id="heroGaugeGrad" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={COLORS.primary} />
                        <Stop offset="1" stopColor={COLORS.secondary} />
                      </SvgGradient>
                    </Defs>
                    <Circle
                      cx="40"
                      cy="40"
                      r="32"
                      fill="none"
                      stroke="#E2E8F0"
                      strokeWidth="5"
                    />
                    <Circle
                      cx="40"
                      cy="40"
                      r="32"
                      fill="none"
                      stroke="url(#heroGaugeGrad)"
                      strokeWidth="8"
                      strokeDasharray="201.06"
                      strokeDashoffset={201.06 * (1 - (surgeScore) / 100)}
                      strokeLinecap="round"
                      transform="rotate(-90 40 40)"
                    />
                  </Svg>
                  <View style={styles.shieldPercentageBox}>
                    <Text style={styles.shieldPercentageText}>{surgeScore}%</Text>
                  </View>
                </View>

                {/* Right Metadata */}
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <View style={styles.shieldHeaderRow}>
                    <Sparkles size={13} color={COLORS.primary} fill={COLORS.primary} />
                    <Text style={styles.shieldStatusTitle}>
                      {highestRiskSector && highestRiskSector.riskScore >= 0.75
                        ? 'CRITICAL OUTBREAK ALERT'
                        : highestRiskSector && highestRiskSector.riskScore >= 0.35
                        ? 'ELEVATED RISK STATUS'
                        : 'ROUTINE RADAR ACTIVE'}
                    </Text>
                  </View>
                  <Text style={styles.heroTitleName}>
                    {highestRiskSector ? highestRiskSector.name : 'All Monitored Sectors'}
                  </Text>
                  <Text style={styles.heroDescText}>
                    {highestRiskSector
                      ? activeCountry === 'Singapore'
                        ? `National vector data indicates elevated breeding triggers in ${highestRiskSector.name}. Vector mitigation response active.`
                        : `Larval density suite indicates elevated breeding triggers in ${highestRiskSector.name}. Coordinated container sweeps advised.`
                      : 'No critical outbreaks detected. Routine surveillance ongoing.'}
                  </Text>
                </View>
              </View>

              <View style={styles.heroFooter}>
                <View style={styles.warningBox}>
                  <Heart size={14} color={COLORS.primary} fill={COLORS.primary} />
                  <Text style={styles.warningText}>Coordinated City Response</Text>
                </View>
                <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/report')}>
                  <Text style={styles.actionBtnText}>Open AI Core</Text>
                  <ChevronRight size={16} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Premium telemetry pills below Hero */}
            <View style={styles.telemetryOverlay}>
              <View style={styles.teleChip}>
                <Thermometer size={14} color={COLORS.accent} />
                <Text style={styles.teleText}>{weather.temp}°C Temp</Text>
              </View>
              <View style={styles.teleChip}>
                <Droplet size={14} color={COLORS.primary} />
                <Text style={styles.teleText}>{weather.humidity}% Humid</Text>
              </View>
              <TouchableOpacity style={styles.teleChip} onPress={() => router.push('/map')}>
                <Wind size={14} color={COLORS.success} />
                <Text style={styles.teleText}>{`${activeSectors.length} monitored`}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* -- Predictive Analytics (highlighted barangays only) -- */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Predictive Outbreak Analytics</Text>
                <Text style={styles.sectionSub}>Grid Sentinel Monitored Outbreak Forecasts</Text>
              </View>
              <TouchableOpacity style={styles.highRiskPill} onPress={() => router.push('/map')}>
                <AlertTriangle size={13} color={MAP_RISK_COLORS.high} />
                <Text style={styles.highRiskPillText}>{HIGHLIGHTED_ANALYTICS.length} Flagged</Text>
              </TouchableOpacity>
            </View>
            {HIGHLIGHTED_ANALYTICS.map((item: any) => (
              <BarangayAnalyticsCard key={item.id} item={item} onPress={() => router.push('/map')} />
            ))}
          </View>

          {/* -- Prescriptive Mission Checklist (Cohesive Forest Gradient) -- */}
          <Animated.View entering={FadeInUp.duration(600).springify()}>
            <View style={styles.checklistCard}>
              <View style={styles.checklistHeader}>
                <View>
                  <Text style={styles.checklistTitle}>Daily Prevention Habit Shield</Text>
                  <Text style={styles.checklistSub}>{directives.filter(d => d.done).length} of {directives.length} completed today</Text>
                </View>
                <Award size={20} color="#10B981" fill="#10B981" />
              </View>
              {directives.map((item) => (
                <TouchableOpacity key={item.id} style={styles.checkItem} onPress={() => toggleDirective(item.id, item.route)} activeOpacity={0.8}>
                  {item.done ? (
                    <Animated.View entering={ZoomIn.duration(200)} exiting={ZoomOut.duration(150)} style={styles.checkIconActive}>
                      <CheckCircle2 size={14} color="#FFF" />
                    </Animated.View>
                  ) : (
                    <Animated.View entering={ZoomIn.duration(200)} exiting={ZoomOut.duration(150)} style={styles.checkIcon}>
                      <CircleIcon size={14} color="#10B981" />
                    </Animated.View>
                  )}
                  <Text style={[styles.checkText, item.done && styles.checkTextDone]}>{item.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* -- Verified community preview -- */}
          <View style={styles.communityPreview}>
            <View style={styles.lbHeader}>
              <View>
                <Text style={styles.lbTitle}>Verified Intel Feed</Text>
                <Text style={styles.lbSub}>Official advisories and verified citizen uploads</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/explore')}><Text style={styles.seeAllLb}>VIEW ALL FEED</Text></TouchableOpacity>
            </View>
            {communityPreview.map((post) => (
              <TouchableOpacity key={post.id} style={styles.previewCard} onPress={() => router.push('/explore')} activeOpacity={0.85}>
                <View style={styles.previewBadge}><BadgeCheck size={12} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewAuthor} numberOfLines={1}>{post.author}</Text>
                  <Text style={styles.previewBody} numberOfLines={2}>{post.content}</Text>
                </View>
                {post.image ? (
                  <Image 
                    source={resolvePostImage(post.image)} 
                    style={styles.previewImageThumbnail} 
                    resizeMode="cover"
                  />
                ) : null}
                <ChevronRight size={18} color={COLORS.slateLight} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            ))}
          </View>

          {/* -- Guardian Operations (lifestyle) -- */}
          <Animated.View entering={FadeInUp.delay(900).springify()}>
            <GuardianOperations 
              onMapPress={() => router.push('/map')} 
              securedSites={securedSites}
              streakCount={streakCount}
              weeklyProgress={weeklyProgress}
            />
          </Animated.View>

          {/* -- Leaderboard Teaser -- */}
          <View style={styles.leaderboardTeaser}>
            <View style={styles.lbHeader}>
              <View>
                <Text style={styles.lbTitle}>Active Guardian Rankings</Text>
                <Text style={styles.lbSub}>Top local contributors this week</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/profile')}><Text style={styles.seeAllLb}>YOUR RANK</Text></TouchableOpacity>
            </View>
            {leaderboard.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
                <User size={18} color={COLORS.slateLight} style={{ opacity: 0.5, marginBottom: 6, alignSelf: 'center' }} />
                <Text style={{ fontSize: 13, fontWeight: '900', color: COLORS.slate }}>Leaderboard is Empty</Text>
                <Text style={{ fontSize: 10, color: COLORS.slateLight, fontWeight: '700', marginTop: 2, textAlign: 'center' }}>No other guardians registered. Be the first contributor!</Text>
              </View>
            ) : (
              leaderboard.slice(0, 3).map((item, idx) => {
                const isSelf = item.username === currentUserUsername;
                return (
                  <View key={item.username} style={[styles.lbRow, isSelf && styles.lbRowSelf]}>
                    <View style={[styles.lbRank, isSelf && { backgroundColor: COLORS.secondary }]}><Text style={[styles.lbRankText, isSelf && { color: '#FFF' }]}>#{idx + 1}</Text></View>
                    <View style={[styles.lbAvatar, { backgroundColor: COLORS.primary }]}><User size={12} color="#FFF" /></View>
                    <Text style={styles.lbName}>{item.full_name || item.username}</Text>
                    <Text style={styles.lbScore}>{formatInt(item.points)} pts</Text>
                  </View>
                );
              })
            )}
          </View>

        </ScrollView>
      </View>

      <Modal visible={isNotifVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} onPress={() => setIsNotifVisible(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setIsNotifVisible(false)}><X size={24} color={COLORS.slateLight} /></TouchableOpacity>
            </View>
            {getNotifications(activeCountry).map(n => (
              <TouchableOpacity
                key={n.id}
                style={styles.notifItem}
                onPress={() => {
                  setIsNotifVisible(false);
                  router.push(n.type === 'warning' ? '/map' : '/report');
                }}
              >
                <View style={[styles.notifIcon, { backgroundColor: n.type === 'warning' ? '#FEF2F2' : '#F0F9FF' }]}>
                  {n.type === 'warning' ? <AlertTriangle size={18} color={MAP_RISK_COLORS.high} /> : <Info size={18} color={COLORS.primary} />}
                </View>
                <View style={{ flex: 1 }}><Text style={styles.notifTitle}>{n.title}</Text><Text style={styles.notifBody}>{n.body}</Text></View>
                <Text style={styles.notifTime}>{n.time}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  countryHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  decorSquircle: {
    position: 'absolute',
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    opacity: 0.25,
  },
  countryFlagText: {
    fontSize: 14,
  },
  countryNameText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#334155',
  },
  intelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    paddingVertical: 10,
    gap: 10,
  },
  intelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  intelText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
  intelDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#334155',
  },
  headerContainer: {
    overflow: 'hidden',
  },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 44 : 36, 
    paddingBottom: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: '#BAE6FD', 
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatarPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 10, borderWidth: 1, borderColor: '#BAE6FD' },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E0F2FE' },
  welcomeText: { fontSize: 14, fontWeight: '800', color: COLORS.slate, letterSpacing: -0.2 },
  locationTag: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  locationText: { fontSize: 9, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BAE6FD' },
  notifDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger, borderWidth: 2, borderColor: '#FFFFFF' },

  scrollContent: { paddingHorizontal: 24, paddingBottom: 120, paddingTop: 16 },

  missionBrief: { marginBottom: 20 },
  missionGradient: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, borderWidth: 1.5, borderColor: '#7DD3FC' },
  missionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  missionLabel: { fontSize: 9, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.8 },
  missionTask: { fontSize: 13, fontWeight: '700', color: COLORS.slate, marginTop: 2, letterSpacing: -0.1 },
  missionGo: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  missionGoText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  
  // Checklist Styles
  checklistCard: { 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 20, 
    borderWidth: 1.5, 
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4'
  },
  checklistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  checklistTitle: { fontSize: 16, fontWeight: '900', color: '#065F46', letterSpacing: -0.2 },
  checklistSub: { fontSize: 11, color: '#047857', fontWeight: '700', marginTop: 2, opacity: 0.85 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(16, 185, 129, 0.08)' },
  checkIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  checkIconActive: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  checkText: { fontSize: 13, fontWeight: '600', color: '#065F46', flex: 1 },
  checkTextDone: { color: '#10B981', opacity: 0.6, textDecorationLine: 'line-through', fontWeight: '500' },
  
  quickRow: { marginBottom: 20 },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
  cityPulse: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: '#BAE6FD' },
  cityPulseLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cityPulseText: { fontSize: 12, fontWeight: '800', color: COLORS.slate, flex: 1, letterSpacing: -0.1 },
  mapLegendMini: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  mapLegendDot: { width: 8, height: 8, borderRadius: 4 },
  quickChipText: { fontSize: 13, fontWeight: '800', color: COLORS.slate, letterSpacing: -0.1 },
  quickChipHint: { fontSize: 9, fontWeight: '700', color: COLORS.slateLight, marginTop: 1 },
  highRiskPill: { backgroundColor: '#FEF2F2', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#FECACA' },
  highRiskPillText: { fontSize: 11, fontWeight: '900', color: MAP_RISK_COLORS.high },
  communityPreview: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1.5, borderColor: '#E0F2FE' },
  previewCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  previewBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center' },
  previewAuthor: { fontSize: 12, fontWeight: '900', color: COLORS.primary, marginBottom: 2 },
  previewBody: { fontSize: 12, fontWeight: '600', color: COLORS.slateLight, lineHeight: 18 },
 
  heroWrapper: { marginBottom: 24 },
  heroCard: { 
    borderRadius: 28, 
    padding: 24, 
    borderWidth: 1.5, 
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF'
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E0F2FE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#BAE6FD' },
  statusPillText: { fontSize: 9, fontWeight: '900', color: '#0284C7', letterSpacing: 0.8 },
  heroDate: { fontSize: 10, color: COLORS.slateLight, fontWeight: '700' },
  mainScoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  scoreValue: { fontSize: 52, fontWeight: '900', color: COLORS.slate, letterSpacing: -2 },
  scoreLabel: { fontSize: 12, color: COLORS.slateLight, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroVisual: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BAE6FD' },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#BAE6FD' },
  warningBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warningText: { fontSize: 12, fontWeight: '800', color: COLORS.slate },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#BAE6FD' },
  actionBtnText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },
 
  telemetryOverlay: { flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'space-between' },
  teleChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  teleText: { fontSize: 12, fontWeight: '800', color: COLORS.slate },
 
  presenceContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32, paddingLeft: 8 },
  guardianStack: { flexDirection: 'row' },
  miniAvatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF' },
  moreAvatar: { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  moreText: { fontSize: 9, fontWeight: '800', color: COLORS.slateLight },
  presenceText: { fontSize: 12, fontWeight: '600', color: COLORS.slateLight },
 
  sectionHeader: { fontSize: 18, fontWeight: '900', color: COLORS.slate, marginBottom: 16, letterSpacing: -0.2 },
  featureGrid: { flexDirection: 'row', gap: 14, marginBottom: 32 },
  bigCard: { flex: 1.2, borderRadius: 24, padding: 20, height: 170, justifyContent: 'space-between', borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  cardIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E0F2FE' },
  cardTitle: { fontSize: 16, fontWeight: '900', color: COLORS.slate, marginBottom: 4, letterSpacing: -0.2 },
  cardSub: { fontSize: 11, color: COLORS.slateLight, fontWeight: '600', lineHeight: 16 },
  cornerArrow: { alignSelf: 'flex-end' },
  smallCardGrid: { flex: 0.8, gap: 14 },
  smallCard: { flex: 1, borderRadius: 20, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  smallIconCircle: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  smallCardText: { fontSize: 13, fontWeight: '800', color: COLORS.slate },
 
  hScroller: { overflow: 'visible', marginBottom: 32 },
  infoCard: { width: 180, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginRight: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  infoIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  infoTitle: { fontSize: 14, fontWeight: '800', color: COLORS.slate, marginBottom: 4, letterSpacing: -0.1 },
  infoDesc: { fontSize: 11, color: COLORS.slateLight, fontWeight: '600', lineHeight: 16 },
 
  sectionContainer: { marginBottom: 28 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.slate, letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, fontWeight: '700', color: COLORS.slateLight, marginTop: 2 },
  seeAllText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  regionalList: { gap: 12 },
  regionalItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  statusLine: { width: 4, height: 32, borderRadius: 2, marginRight: 16 },
  barangayName: { fontSize: 16, fontWeight: '800', color: COLORS.slate },
  barangayStatus: { fontSize: 12, fontWeight: '600', color: COLORS.slateLight, marginTop: 2 },
  miniGraphContainer: { marginHorizontal: 12 },
  trendBox: { alignItems: 'flex-end', gap: 4 },
  trendText: { fontSize: 11, fontWeight: '800' },
 
  searchOverlay: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'ios' ? 60 : 20 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.slate, fontWeight: '600' },
  searchList: { padding: 20 },
  searchItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  searchItemText: { fontSize: 15, color: COLORS.slate, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalDismiss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bottomSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: COLORS.slate, letterSpacing: -0.3 },
  notifItem: { flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  notifIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontSize: 14, fontWeight: '800', color: COLORS.slate },
  notifBody: { fontSize: 12, color: COLORS.slateLight, lineHeight: 18, marginTop: 2 },
  notifTime: { fontSize: 10, color: '#94A3B8', fontWeight: '700' },
   
  // Guardian Operations Styles
  opsContainer: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 28, borderWidth: 1, borderColor: '#F1F5F9' },
  opsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  opsTitle: { fontSize: 16, fontWeight: '900', color: COLORS.slate, letterSpacing: -0.2 },
  opsSub: { fontSize: 11, color: COLORS.slateLight, fontWeight: '600', marginTop: 2 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  streakText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF' },
  opsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  opsCard: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  opsIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  opsCardVal: { fontSize: 16, fontWeight: '900', color: COLORS.slate },
  opsCardLbl: { fontSize: 10, fontWeight: '700', color: COLORS.slateLight, marginTop: 1 },
  progressSection: { marginBottom: 16 },
  progInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progLbl: { fontSize: 12, fontWeight: '800', color: COLORS.slate },
  progVal: { fontSize: 12, fontWeight: '900', color: COLORS.primary },
  progTrack: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  progFill: { height: '100%', borderRadius: 4 },
  badgeStrip: { borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 14 },
  badgeStripLbl: { fontSize: 9, fontWeight: '900', color: COLORS.slateLight, letterSpacing: 0.8, marginBottom: 10 },
  badgeScroll: { flexDirection: 'row' },
  miniBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  miniBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.slate },
   
  // Leaderboard Teaser Styles
  leaderboardTeaser: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 28, borderWidth: 1.5, borderColor: '#E2E8F0' },
  lbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  lbTitle: { fontSize: 16, fontWeight: '900', color: COLORS.slate, letterSpacing: -0.2 },
  lbSub: { fontSize: 11, color: COLORS.slateLight, fontWeight: '600', marginTop: 2 },
  seeAllLb: { fontSize: 11, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.3 },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  lbRowSelf: { backgroundColor: '#FFFFFF', marginHorizontal: -10, paddingHorizontal: 10, borderRadius: 12, borderBottomWidth: 0, marginTop: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  lbRank: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  lbRankText: { fontSize: 9, fontWeight: '900', color: COLORS.slate },
  lbAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lbName: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.slate },
  lbScore: { fontSize: 12, fontWeight: '900', color: COLORS.slate },
  shieldHUDContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 20, 
    gap: 16 
  },
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
    fontSize: 18, 
    fontWeight: '900' 
  },
  shieldHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  shieldStatusTitle: { 
    fontSize: 12, 
    fontWeight: '900', 
    letterSpacing: 0.8
  },
  heroTitleName: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: COLORS.slate, 
    marginTop: 2 
  },
  heroDescText: { 
    fontSize: 13, 
    color: COLORS.slateDark, 
    fontWeight: '600', 
    lineHeight: 18, 
    marginTop: 4 
  },
  campaignBannerContainer: {
    marginBottom: 20,
  },
  campaignBannerCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 200,
  },
  campaignBannerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.25,
  },
  campaignBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F0F9FF',
    opacity: 0.75,
  },
  campaignBannerContent: {
    padding: 20,
    justifyContent: 'center',
    zIndex: 1,
  },
  campaignBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  campaignBannerTag: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0284C7',
    letterSpacing: 0.8,
  },
  campaignBannerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  campaignBannerDesc: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 14,
  },
  campaignBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  campaignBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  advisoryBadge: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  advisoryBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  previewImageThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginLeft: 8,
  },
});
