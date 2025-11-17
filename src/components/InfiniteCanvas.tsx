import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Camera, worldToScreen } from '@/utils/viewport';

const { width: W, height: H } = Dimensions.get('window');

export default function InfiniteCanvas() {
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);

  const pan = Gesture.Pan()
    .onUpdate((e) => { tx.value = e.translationX; ty.value = e.translationY; })
    .onEnd(() => {
      setCam({ ...cam, x: cam.x - tx.value / cam.zoom, y: cam.y - ty.value / cam.zoom });
      tx.value = 0; ty.value = 0;
    });

  const pinch = Gesture.Pinch()
    .onUpdate((e) => scale.value = e.scale)
    .onEnd(() => {
      setCam({ ...cam, zoom: cam.zoom * scale.value });
      scale.value = 1;
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  // Reference square at world origin
  const [sx, sy] = worldToScreen(0, 0, cam, W, H);
  const size = 100 * cam.zoom;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={Gesture.Race(pan, pinch)}>
        <Animated.View style={[styles.canvas, style]}>
          <View style={[styles.square, { left: sx - size/2, top: sy - size/2, width: size, height: size }]}>
            <Text style={styles.text}>Origin</Text>
          </View>
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
  square: { position: 'absolute', backgroundColor: 'rgba(59,130,246,0.2)', borderWidth: 2, borderColor: '#3B82F6', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  text: { color: '#3B82F6', fontSize: 12, fontWeight: '600' },
  debug: { position: 'absolute', top: 60, left: 20, backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, borderRadius: 8 },
  debugText: { color: '#FFF', fontSize: 14, fontFamily: 'monospace' },
});
