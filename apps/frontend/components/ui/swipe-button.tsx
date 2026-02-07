/**
 * SwipeButton — slide-to-confirm using react-native-gesture-handler + reanimated.
 * User must drag the thumb from left to right to trigger `onSwipeComplete`.
 */
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  interpolateColor,
  Extrapolation,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '@/constants/theme';

const THUMB_SIZE = 52;
const BUTTON_HEIGHT = 60;
const CONTAINER_PADDING = 4;

interface SwipeButtonProps {
  /** Label shown inside button */
  label?: string;
  /** Secondary text (right side) */
  subLabel?: string;
  /** Called when user completes the swipe */
  onSwipeComplete: () => void;
  /** Overall width – defaults to screen width minus padding */
  width?: number;
}

export default function SwipeButton({
  label = 'Slide to Confirm',
  subLabel,
  onSwipeComplete,
  width,
}: SwipeButtonProps) {
  const containerWidth = width ?? Dimensions.get('window').width - 48;
  const maxTranslateX = containerWidth - THUMB_SIZE - CONTAINER_PADDING * 2;

  const translateX = useSharedValue(0);
  const completed = useSharedValue(false);

  const triggerComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSwipeComplete();
  };

  const triggerTick = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (completed.value) return;
      const clamped = Math.min(Math.max(0, e.translationX), maxTranslateX);
      translateX.value = clamped;

      // Haptic tick at 50% mark
      if (clamped > maxTranslateX * 0.5 && clamped < maxTranslateX * 0.55) {
        runOnJS(triggerTick)();
      }
    })
    .onEnd(() => {
      if (completed.value) return;
      if (translateX.value > maxTranslateX * 0.85) {
        // Complete!
        translateX.value = withSpring(maxTranslateX, { damping: 20, stiffness: 200 });
        completed.value = true;
        runOnJS(triggerComplete)();
      } else {
        // Snap back
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, maxTranslateX * 0.6], [1, 0], Extrapolation.CLAMP),
  }));

  const bgStyle = useAnimatedStyle(() => {
    const bg = interpolateColor(
      translateX.value,
      [0, maxTranslateX],
      [C.primary, '#6BFF3A'],
    );
    return { backgroundColor: bg };
  });

  const arrowStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [0, maxTranslateX],
      [0, 360],
      Extrapolation.CLAMP,
    );
    return { transform: [{ rotate: `${rotate}deg` }] };
  });

  return (
    <Animated.View style={[styles.container, { width: containerWidth }, bgStyle]}>
      {/* Label centered */}
      <Animated.View style={[styles.labelWrap, labelStyle]}>
        <Text style={styles.label}>{label}</Text>
        {subLabel ? <Text style={styles.subLabel}>{subLabel}</Text> : null}
      </Animated.View>

      {/* Chevron hints */}
      <Animated.View style={[styles.chevrons, labelStyle]} pointerEvents="none">
        <MaterialIcons name="chevron-right" size={16} color={C.primaryDark + '40'} />
        <MaterialIcons name="chevron-right" size={16} color={C.primaryDark + '60'} />
        <MaterialIcons name="chevron-right" size={16} color={C.primaryDark + '80'} />
      </Animated.View>

      {/* Draggable thumb */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <Animated.View style={arrowStyle}>
            <MaterialIcons name="arrow-forward" size={24} color={C.primaryDark} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: BUTTON_HEIGHT,
    borderRadius: R.full,
    padding: CONTAINER_PADDING,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  labelWrap: {
    position: 'absolute',
    left: THUMB_SIZE + 16,
    right: 16,
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: C.primaryDark,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: C.primaryDark + 'AA',
    marginTop: 1,
  },
  chevrons: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
});
