import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Text, Platform } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Camera, worldToScreen, clamp } from '@/utils/viewport';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

export default function InfiniteCanvas() {
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const focalX = useSharedValue(W / 2);
  const focalY = useSharedValue(H / 2);
  const isPinching = useSharedValue(false);

  const updateCamera = (newCam: Camera) => {
    setCam(newCam);
  };

  // Pan - only when NOT pinching
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      if (isPinching.value) return;
    })
    .onChange((e) => {
      if (isPinching.value) return;
      translateX.value += e.changeX;
      translateY.value += e.changeY;
    })
    .onEnd(() => {
      if (isPinching.value) return;
      
      const newX = cam.x - translateX.value / cam.zoom;
      const newY = cam.y - translateY.value / cam.zoom;
      
      runOnJS(updateCamera)({ x: newX, y: newY, zoom: cam.zoom });
      
      translateX.value = withTiming(0, { duration: 0 });
      translateY.value = withTiming(0, { duration: 0 });
    });

  // Pinch
  const pinch = Gesture.Pinch()
    .onBegin(() => {
      isPinching.value = true;
    })
    .onChange((e) => {
      scale.value = e.scale;
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onEnd(() => {
      const newZoom = clamp(cam.zoom * scale.value, MIN_ZOOM, MAX_ZOOM);
      
      // Zoom towards focal
      const wx = (focalX.value - W / 2) / cam.zoom + cam.x;
      const wy = (focalY.value - H / 2) / cam.zoom + cam.y;
      const ratio = newZoom / cam.zoom;
      
      runOnJS(updateCamera)({
        x: wx - (wx - cam.x) / ratio,
        y: wy - (wy - cam.y) / ratio,
        zoom: newZoom,
      });
      
      scale.value = withTiming(1, { duration: 0 });
      isPinching.value = false;
    })
    .onFinalize(() => {
      isPinching.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Reference square
  const [sx, sy] = worldToScreen(0, 0, cam, W, H);
  const size = 100 * cam.zoom;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={Gesture.Race(pinch, pan)}>
        <Animated.View style={[styles.canvas, animatedStyle]}>
          {size > 1 && size < 10000 && (
            <View style={[styles.square, { left: sx - size/2, top: sy - size/2, width: size, height: size }]}>
              <Text style={styles.text}>Origin</Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
      <View style={styles.debug}>
        <Text style={styles.debugText}>Zoom: {cam.zoom.toFixed(2)}x</Text>
        <Text style={styles.debugText}>Pos: ({cam.x.toFixed(0)}, {cam.y.toFixed(0)})</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  canvas: { flex: 1 },
  square: {
    position: 'absolute',
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
