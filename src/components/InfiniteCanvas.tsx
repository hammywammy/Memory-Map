import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useDerivedValue,
  withDecay 
} from 'react-native-reanimated';
import { clamp } from '@/utils/viewport';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

export default function InfiniteCanvas() {
  // EVERYTHING on UI thread - NO useState!
  const camX = useSharedValue(0);
  const camY = useSharedValue(0);
  const camZoom = useSharedValue(1);
  
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const scale = useSharedValue(1);
  const focalX = useSharedValue(W / 2);
  const focalY = useSharedValue(H / 2);

  // Pan
  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
    })
    .onChange((e) => {
      offsetX.value = startX.value + e.translationX;
      offsetY.value = startY.value + e.translationY;
    })
    .onEnd((e) => {
      // Apply to camera
      camX.value -= offsetX.value / camZoom.value;
      camY.value -= offsetY.value / camZoom.value;
      
      // Add momentum
      offsetX.value = withDecay({ velocity: e.velocityX, deceleration: 0.998 });
      offsetY.value = withDecay({ velocity: e.velocityY, deceleration: 0.998 });
    });

  // Pinch
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = e.scale;
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onEnd(() => {
      const newZoom = clamp(camZoom.value * scale.value, MIN_ZOOM, MAX_ZOOM);
      
      // Zoom towards focal
      const wx = (focalX.value - W / 2) / camZoom.value + camX.value;
      const wy = (focalY.value - H / 2) / camZoom.value + camY.value;
      const ratio = newZoom / camZoom.value;
      
      camX.value = wx - (wx - camX.value) / ratio;
      camY.value = wy - (wy - camY.value) / ratio;
      camZoom.value = newZoom;
      
      scale.value = 1;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  // Reference square - calculated on UI thread
  const squareStyle = useAnimatedStyle(() => {
    const sx = (0 - camX.value) * camZoom.value + W / 2;
    const sy = (0 - camY.value) * camZoom.value + H / 2;
    const size = 100 * camZoom.value;
    
    return {
      position: 'absolute',
      left: sx - size / 2,
      top: sy - size / 2,
      width: size,
      height: size,
      opacity: size > 1 && size < 10000 ? 1 : 0,
    };
  });

  // Debug text - derived from shared values
  const debugZoom = useDerivedValue(() => camZoom.value.toFixed(2));
  const debugX = useDerivedValue(() => Math.round(camX.value));
  const debugY = useDerivedValue(() => Math.round(camY.value));

  return (
    <View style={styles.container}>
      <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
        <Animated.View style={[styles.canvas, animatedStyle]}>
          <Animated.View style={[styles.square, squareStyle]}>
            <Text style={styles.text}>Origin</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      
      <View style={styles.debug}>
        <Animated.Text style={styles.debugText}>
          Zoom: {debugZoom}x
        </Animated.Text>
        <Animated.Text style={styles.debugText}>
          Pos: ({debugX}, {debugY})
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  canvas: { flex: 1 },
  square: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { color: '#3B82F6', fontSize: 12, fontWeight: '600' },
  debug: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 12,
    borderRadius: 8,
  },
  debugText: { color: '#FFF', fontSize: 14, fontFamily: 'monospace', marginBottom: 2 },
});
