import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { ArrowLeft, Bell, AlertTriangle, Shield, CheckCircle2, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown } from 'react-native-reanimated';

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#0284C7',
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
  white: '#FFFFFF',
  slate: '#0F172A',
  slateLight: '#64748B',
  bg: '#F8FAFC',
};

const MOCK_NOTIFS = [
  {
    id: '1',
    title: 'Health Alert: Dayangdang',
    body: 'We noticed an increase in dengue-vector activity in your area. Please check your surroundings for stagnant water.',
    type: 'danger',
    time: '10m ago',
    icon: AlertTriangle,
  },
  {
    id: '2',
    title: 'Mission Accomplished! 🌟',
    body: 'You completed the "First Patrol" daily mission. +150 XP has been awarded to your Guardian Level.',
    type: 'success',
    time: '2h ago',
    icon: CheckCircle2,
  },
  {
    id: '3',
    title: 'New Community Report',
    body: 'A neighbor just reported an uncollected trash bin gathering water. Tap to view the area.',
    type: 'primary',
    time: '5h ago',
    icon: Shield,
  },
  {
    id: '4',
    title: 'Level Up Available',
    body: 'You are almost at Level 5! Complete 2 more daily habits to unlock the Sentinel Badge.',
    type: 'warning',
    time: '1d ago',
    icon: Bell,
  }
];

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={COLORS.slate} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {MOCK_NOTIFS.map((notif, index) => (
            <Animated.View 
              key={notif.id} 
              entering={FadeInDown.delay(index * 100).springify()}
              style={styles.notifCard}
            >
              <View style={[styles.iconBox, { backgroundColor: COLORS[notif.type as keyof typeof COLORS] + '15' }]}>
                <notif.icon size={20} color={COLORS[notif.type as keyof typeof COLORS]} />
              </View>
              <View style={styles.notifContent}>
                <View style={styles.notifHeader}>
                  <Text style={styles.notifTitle}>{notif.title}</Text>
                  <Text style={styles.notifTime}>{notif.time}</Text>
                </View>
                <Text style={styles.notifBody}>{notif.body}</Text>
              </View>
            </Animated.View>
          ))}

          {MOCK_NOTIFS.length === 0 && (
            <View style={styles.emptyState}>
              <Bell size={48} color={COLORS.slateLight} opacity={0.3} />
              <Text style={styles.emptyText}>All systems nominal. No alerts.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.slate },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20 },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  notifContent: { flex: 1 },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notifTitle: { fontSize: 15, fontWeight: '800', color: COLORS.slate, flex: 1, marginRight: 10 },
  notifTime: { fontSize: 11, fontWeight: '600', color: COLORS.slateLight },
  notifBody: { fontSize: 13, color: COLORS.slateLight, lineHeight: 18, fontWeight: '500' },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { fontSize: 15, fontWeight: '700', color: COLORS.slateLight, marginTop: 16 },
});
