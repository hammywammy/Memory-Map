import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue } from 'react-native-reanimated';
import { TIME_RINGS, getTimeRingForDate } from '@/utils/ringGeometry';
import { CATEGORY_COLORS } from '@/types/memory';
import { useMemoryStore } from '@/stores/memoryStore';
import { layoutMemories } from '@/utils/memoryLayout';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

// LOD: Base dot size per ring (outer rings = way more photos = smaller dots)
const RING_DOT_SIZES = [
  20,  // Today: 0-10 photos = large dots
  15,  // This Week: 10-50 photos = medium-large
  10,  // This Month: 50-200 photos = medium
  7,   // This Quarter: 200-500 photos = small
  5,   // This Year: 500-2000 photos = tiny
  3,   // Years Ago: 2000+ photos = particles
];

export default function SkiaTest() {
  console.log('🎨 SkiaTest rendering');
  
  // Get memories from store
  const memories = useMemoryStore(state => state.memories);
  
  // Layout memories once (expensive operation)
  const positionedMemories = useMemo(() => {
    const now = new Date();
    const positioned = layoutMemories(memories);
    
    // Add ring index and base size to each memory
    return positioned.map(memory => {
      const ring = getTimeRingForDate(memory.timestamp, now);
      const baseSize = RING_DOT_SIZES[ring.index];
      
      return {
        ...memory,
        ringIndex: ring.index,
        baseSize,
      };
    });
  }, [memories]);
  
  console.log(`📊 Rendering ${positionedMemories.length} memories`);
  
  // Camera state
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  
  // Saved gesture state
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const focalPointX = useSharedValue(0);
  const focalPointY = useSharedValue(0);

  // Create transform array using useDerivedValue
  const transform = useDerivedValue(() => {
    return [
      { translateX: W / 2 },
      { translateY: H / 2 },
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ];
  });

  // Pinch gesture - FIXED FOCAL POINT
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      
      // Save initial focal point
      focalPointX.value = e.focalX;
      focalPointY.value = e.focalY;
    })
    .onUpdate((e) => {
      // Calculate new scale
      const newScale = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, savedScale.value * e.scale)
      );
      
      // Calculate focal point in screen space (relative to screen center)
      const focalScreenX = focalPointX.value - W / 2;
      const focalScreenY = focalPointY.value - H / 2;
      
      // Convert focal point to world space BEFORE zoom
      const focalWorldX = (focalScreenX - savedTranslateX.value) / savedScale.value;
      const focalWorldY = (focalScreenY - savedTranslateY.value) / savedScale.value;
      
      // Calculate new translation to keep focal point fixed
      translateX.value = focalScreenX - focalWorldX * newScale;
      translateY.value = focalScreenY - focalWorldY * newScale;
      
      scale.value = newScale;
    });

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    });

  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={combinedGesture}>
        <Canvas style={styles.canvas}>
          <Group transform={transform}>
            {/* Render all time rings */}
            {TIME_RINGS.map((ring) => (
              <Circle
                key={ring.index}
                cx={0}
                cy={0}
                r={ring.outerRadius}
                style="stroke"
                strokeWidth={2}
                color={ring.color}
              />
            ))}
            
            {/* Render memory dots with LOD sizing */}
            {positionedMemories.map((memory) => {
              const color = CATEGORY_COLORS[memory.category];
              
              // Size = base size per ring * significance multiplier (0.5x - 1.5x)
              const sizeFactor = 0.5 + memory.significance;
              const finalSize = memory.baseSize * sizeFactor;
              
              return (
                <Circle
                  key={memory.id}
                  cx={memory.worldX}
                  cy={memory.worldY}
                  r={finalSize}
                  color={color}
                  opacity={0.8}
                />
              );
            })}
            
            {/* Center dot */}
            <Circle cx={0} cy={0} r={10} color="white" />
          </Group>
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  canvas: { flex: 1 },
});
