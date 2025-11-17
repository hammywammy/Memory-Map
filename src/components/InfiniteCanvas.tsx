import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, Platform } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { Camera, worldToScreen, clamp } from '@/utils/viewport';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

export default function InfiniteCanvas() {
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  
  // Gesture state
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Update camera (called from worklet)
  const updateCam = (newCam: Camera) => setCam(newCam);

  // Pan gesture
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd(() => {
      runOnJS(updateCam)({
        x: cam.x - tx.value / cam.zoom,
        y: cam.y - ty.value / cam.zoom,
        zoom: cam.zoom,
      });
      tx.value = 0;
      ty.value = 0;
    });

  // Pinch gesture with clamping
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = cam.zoom;
      scale.value = 1;
    })
    .onUpdate((e) => {
      scale.value = e.scale;
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onEnd(() => {
      const newZoom = clamp(startScale.value * scale.value, MIN_ZOOM, MAX_ZOOM);
      
      // Zoom towards focal point
      const worldX = focalX.value;
      const worldY = focalY.value;
      const wx = (worldX - W / 2) / cam.zoom + cam.x;
      const wy = (worldY - H / 2) / cam.zoom + cam.y;
      const ratio = newZoom / cam.zoom;
      
      runOnJS(updateCam)({
        x: wx - (wx - cam.x) / ratio,
        y: wy - (wy - cam.y) / ratio,
        zoom: newZoom,
      });
      
      scale.value = 1;
      startScale.value = 1;
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  // Web: Wheel zoom + MMB pan
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      const newZoom = clamp(cam.zoom * (1 + delta), MIN_ZOOM, MAX_ZOOM);
      
      // Zoom towards mouse
      const wx = (e.clientX - W / 2) / cam.zoom + cam.x;
      const wy = (e.clientY - H / 2) / cam.zoom + cam.y;
      const ratio = newZoom / cam.zoom;
      
      setCam({
        x: wx - (wx - cam.x) / ratio,
        y: wy - (wy - cam.y) / ratio,
        zoom: newZoom,
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1) { // MMB
        e.preventDefault();
        isPanning = true;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        setCam({
          ...cam,
          x: cam.x - dx / cam.zoom,
          y: cam.y - dy / cam.zoom,
        });
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) isPanning = false;
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [cam]);

  // Reference square
  const [sx, sy] = worldToScreen(0, 0, cam, W, H);
  const size = 100 * cam.zoom;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
        <Animated.View style={[styles.canvas, style]}>
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
        <Text style={styles.hint}>Mobile: Pan/Pinch | Web: Scroll/MMB</Text>
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
  hint: { color: '#666', fontSize: 10, marginTop: 4 },
});
