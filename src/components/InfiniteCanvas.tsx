import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDecay,
  runOnJS,
} from 'react-native-reanimated';
import {
  Camera,
  worldToScreen,
  getVisibleBounds,
  isPointVisible,
  zoomTowards,
} from '@/utils/viewport';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Infinite Canvas Component
 * Architecture based on Miro/Figma/Excalidraw
 * 
 * Key optimizations:
 * 1. Gestures run on UI thread (Reanimated worklets)
 * 2. Viewport culling (only render visible objects)
 * 3. Smooth physics with withDecay
 * 4. Proper focal point zoom (like pinch-to-zoom apps)
 */
export default function InfiniteCanvas() {
  // Camera state (world space position + zoom)
  const [camera, setCamera] = useState<Camera>({
    x: 0,
    y: 0,
    zoom: 1,
  });

  // Gesture state (runs on UI thread for 60fps)
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const focalX = useSharedValue(SCREEN_WIDTH / 2);
  const focalY = useSharedValue(SCREEN_HEIGHT / 2);

  // Update camera from gesture (called from worklet)
  const updateCamera = (newCamera: Camera) => {
    setCamera(newCamera);
  };

  /**
   * Pan Gesture
   * Uses proper translation handling to avoid "coffee jitter"
   * Includes withDecay for natural momentum scrolling
   */
  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
    })
    .onUpdate((event) => {
      // Direct translation (no acceleration effect)
      offsetX.value = startX.value + event.translationX;
      offsetY.value = startY.value + event.translationY;
    })
    .onEnd((event) => {
      // Add momentum physics
      offsetX.value = withDecay({
        velocity: event.velocityX,
        deceleration: 0.998,
      });
      offsetY.value = withDecay({
        velocity: event.velocityY,
        deceleration: 0.998,
      });

      // Update React state
      runOnJS(updateCamera)({
        x: camera.x - offsetX.value / camera.zoom,
        y: camera.y - offsetY.value / camera.zoom,
        zoom: camera.zoom,
      });

      // Reset for next gesture
      startX.value = 0;
      startY.value = 0;
      offsetX.value = 0;
      offsetY.value = 0;
    });

  /**
   * Pinch Gesture
   * Zooms towards focal point (finger center)
   * Keeps the point under fingers stationary
   */
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    })
    .onEnd(() => {
      // Calculate zoom with focal point
      const zoomDelta = scale.value - 1;
      const newCamera = zoomTowards(
        camera,
        { x: focalX.value, y: focalY.value },
        zoomDelta,
        SCREEN_WIDTH,
        SCREEN_HEIGHT
      );

      runOnJS(updateCamera)(newCamera);

      // Reset
      savedScale.value = 1;
      scale.value = 1;
    });

  /**
   * Compose gestures
   * Pan and pinch can happen simultaneously
   */
  const composedGesture = Gesture.Race(panGesture, pinchGesture);

  /**
   * Animated style for canvas transform
   * Runs on UI thread for smooth 60fps
   */
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: offsetX.value },
        { translateY: offsetY.value },
        { scale: scale.value },
      ],
    };
  });

  /**
   * Viewport culling
   * Calculate visible bounds for performance
   */
  const visibleBounds = useMemo(
    () => getVisibleBounds(camera, SCREEN_WIDTH, SCREEN_HEIGHT),
    [camera]
  );

  /**
   * Reference square at world origin
   * Used to verify coordinate system is working
   */
  const referenceSquare = useMemo(() => {
    const worldPoint = { x: 0, y: 0 };
    
    // Viewport culling check
    if (!isPointVisible(worldPoint, visibleBounds)) {
      return null;
    }

    // Convert to screen coordinates
    const screenPoint = worldToScreen(
      { x: -50, y: -50 }, // Top-left corner
      camera,
      SCREEN_WIDTH,
      SCREEN_HEIGHT
    );
    const size = 100 * camera.zoom;

    return (
      <View
        key="reference"
        style={[
          styles.referenceSquare,
          {
            left: screenPoint.x,
            top: screenPoint.y,
            width: size,
            height: size,
          },
        ]}
      >
        <Text style={styles.referenceText}>Origin (0,0)</Text>
      </View>
    );
  }, [camera, visibleBounds]);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.canvas, animatedStyle]}>
          {/* Reference square */}
          {referenceSquare}
          
          {/* Future: Memory dots, rings, etc. */}
        </Animated.View>
      </GestureDetector>

      {/* Debug overlay */}
      <View style={styles.debugOverlay}>
        <Text style={styles.debugText}>Zoom: {camera.zoom.toFixed(2)}x</Text>
        <Text style={styles.debugText}>
          Pos: ({Math.round(camera.x)}, {Math.round(camera.y)})
        </Text>
        <Text style={styles.debugTextSmall}>
          Pan & Pinch to navigate
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  canvas: {
    flex: 1,
    position: 'relative',
  },
  referenceSquare: {
    position: 'absolute',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  referenceText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  debugOverlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  debugText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  debugTextSmall: {
    color: '#888',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 4,
  },
});
