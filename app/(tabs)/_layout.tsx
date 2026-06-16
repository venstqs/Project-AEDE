import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Tabs, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { Home, Map as MapIcon, Bot, Users, User } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor
} from 'react-native-reanimated';

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#0284C7',
  inactive: '#94A3B8',
  white: '#FFFFFF',
  bg: '#F8FAFC',
};

import { useTranslation } from '../../hooks/useTranslation';

function TabItem({ state, descriptors, navigation, route, index }: any) {
  const isFocused = state.index === index;
  const options = descriptors[route.key].options;
  const { t } = useTranslation();

  const scale = useSharedValue(isFocused ? 1.2 : 1);
  const translateY = useSharedValue(isFocused ? -10 : 0);
  const opacity = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.15 : 1, { damping: 15, stiffness: 250 });
    translateY.value = withSpring(isFocused ? -10 : 0, { damping: 15, stiffness: 250 });
    opacity.value = withTiming(isFocused ? 1 : 0, { duration: 100 });
  }, [isFocused]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const animatedCircleStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: withSpring(isFocused ? 1 : 0.5) }],
  }));

  const getIcon = (color: string) => {
    const size = 24;
    switch (route.name) {
      case 'index':     return <Home size={size} color={color} />;
      case 'map':       return <MapIcon size={size} color={color} />;
      case 'report':    return <Bot size={size} color={color} />;
      case 'explore':   return <Users size={size} color={color} />;
      case 'profile':   return <User size={size} color={color} />;
      default: return <Home size={size} color={color} />;
    }
  };

  const onPress = () => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const getLabel = () => {
    if (route.name === 'index') return 'HOME';
    if (route.name === 'map') return t('tabs.map');
    if (route.name === 'report') return t('tabs.ai');
    if (route.name === 'explore') return t('tabs.feed');
    if (route.name === 'profile') return t('tabs.profile');
    return route.name.toUpperCase();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.tabItem}
    >
      <View style={styles.iconContainer}>
        {isFocused && (
          <Animated.View style={[styles.activeCircle, animatedCircleStyle]}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.secondary]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
        <Animated.View style={animatedIconStyle}>
          {getIcon(isFocused ? COLORS.white : COLORS.inactive)}
        </Animated.View>
      </View>
      <Text style={[
        styles.label,
        { color: isFocused ? COLORS.primary : COLORS.inactive }
      ]}>
        {getLabel().toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
}

import { LinearGradient } from 'expo-linear-gradient';

function CustomTabBar(props: any) {
  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.tabBar}>
        {props.state.routes.map((route: any, index: number) => (
          <TabItem
            key={route.key}
            {...props}
            route={route}
            index={index}
          />
        ))}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const demoMode = await AsyncStorage.getItem('@aede:demo_mode');
        if (demoMode === 'true') {
          setAuthChecked(true);
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.replace('/login');
          return;
        }
        setAuthChecked(true);
      } catch (err) {
        console.warn('Auth guard check failed:', err);
        router.replace('/login');
      }
    };
    checkAuth();
  }, []);

  if (!authChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 110,
          backgroundColor: 'transparent',
          elevation: 0,
          borderTopWidth: 0,
        }
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="report" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    height: 75,
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    height: '100%',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 20,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconContainer: {
    height: 30,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCircle: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    top: -25,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 3,
    borderColor: '#FFF',
    overflow: 'hidden'
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: 0.5,
  },
});
