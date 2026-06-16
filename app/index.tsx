import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  FadeIn,
} from 'react-native-reanimated';


// Single letter that animates in from below with a fade
function AnimatedLetter({ letter, delay }: { letter: string; delay: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(40);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 600 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 600, easing: Easing.out(Easing.back(1.5)) }));
    scale.value = withDelay(delay, withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.5)) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return <Animated.Text style={[styles.titleLetter, style]}>{letter}</Animated.Text>;
}

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

export default function IntroScreen() {
  const underlineWidth = useSharedValue(0);
  const buttonScale = useSharedValue(0.8);

  // NOTE: Navigation to /privacy, /login, or /(tabs) is handled
  // exclusively by the root _layout.tsx auth guard to prevent race
  // conditions (especially on Android where navigator mounting is slower).
  // This intro screen only shows if the user is not yet redirected.


  useEffect(() => {
    // Animate the underline expanding after letters appear
    underlineWidth.value = withDelay(1200, withTiming(80, { duration: 800, easing: Easing.out(Easing.ease) }));
    // Button pop-in
    buttonScale.value = withDelay(1600, withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.2)) }));
  }, []);

  const underlineStyle = useAnimatedStyle(() => ({
    width: underlineWidth.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity: interpolate(buttonScale.value, [0.8, 1], [0, 1]),
  }));

  const letters = ['A', 'E', 'D', 'E'];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['#0C4A6E', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Background orbs */}
      <Orb color="#FFF" size={200} top="-5%" left="-10%" delay={0} />
      <Orb color="#BAE6FD" size={160} top="65%" left="70%" delay={1000} />
      <Orb color="#FFF" size={100} top="30%" left="75%" delay={2000} />
      <Orb color="#7DD3FC" size={80} top="80%" left="-5%" delay={500} />

      <SafeAreaView style={styles.content}>
        {/* Center: Animated AEDE Title */}
        <View style={styles.centerContent}>
          <Animated.Text entering={FadeIn.delay(200)} style={styles.eyebrow}>
            Welcome to
          </Animated.Text>

          {/* AEDE Animated Title */}
          <View style={styles.titleRow}>
            {letters.map((l, i) => (
              <AnimatedLetter key={i} letter={l} delay={300 + i * 150} />
            ))}
          </View>

          {/* Animated underline expanding */}
          <Animated.View style={[styles.titleUnderline, underlineStyle, { marginTop: 16 }]} />

          <Animated.Text entering={FadeIn.delay(1000).duration(800)} style={styles.subtitle}>
            your Katambay – AI
          </Animated.Text>
        </View>

        {/* Footer buttons */}
        <Animated.View style={[styles.footer, buttonStyle]}>
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.85}
            onPress={() => router.push('/signup')}
          >
            <Text style={styles.buttonText}>GET STARTED</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={styles.loginText}>
              Already have an Account?{' '}
              <Text style={styles.loginLink}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  titleLetter: {
    fontSize: 88,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 20,
  },
  titleUnderline: {
    height: 5,
    backgroundColor: '#38BDF8',
    borderRadius: 3,
    marginTop: 8,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 30,
    gap: 6,
  },
  pillIcon: { fontSize: 14 },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 30,
    gap: 18,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 8,
  },
  buttonText: {
    color: '#0369A1',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  loginText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '500',
  },
  loginLink: {
    fontWeight: '900',
    color: '#FFFFFF',
  },
  
});
