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

// LOD: Base dot size per ring - more intense scaling
const RING_DOT_SIZES = [
  25,  // Today: 5-10 photos
  18,  // This Week: 20-50 photos
  12,  // This Month: 100-200 photos
  8,   // This Quarter: 300-500 photos
  4,   // This Year: 1000-2000 photos
  2,   // Years Ago: 5000+ photos (particles)
];

export default function InfiniteCanvas() {
  const memories = useMemoryStore(state => state.memories);
  
  // Layout memories with LOD info
  const positionedMemories = useMemo(() => {
    const now = new Date();
    const positioned = layoutMemories(memories);
    
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
  
  // Camera values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  // Saved state for gestures
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Transform using proper order
  const transform = useDerivedValue(() => {
    return [
      { translateX: W / 2 },
      { translateY: H / 2 },
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ];
  });

  // FIXED: Pinch gesture with proper focal point math
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      // Calculate new scale
      const newScale = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, savedScale.value * e.scale)
      );
      
      // Focal point in screen space (relative to screen center)
      const focalX = e.focalX - W / 2;
      const focalY = e.focalY - H / 2;
      
      // The key: adjust translation to keep focal point fixed
      // Formula: newTranslate = focal - (focal - oldTranslate) * (newScale / oldScale)
      translateX.value = focalX - (focalX - savedTranslateX.value) * (newScale / savedScale.value);
      translateY.value = focalY - (focalY - savedTranslateY.value) * (newScale / savedScale.value);
      
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
            {/* Time rings */}
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
            
            {/* Memory dots with LOD */}
            {positionedMemories.map((memory) => {
              const color = CATEGORY_COLORS[memory.category];
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
