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
const MIN_ZOOM = 0.05; // Zoom out further to see full universe
const MAX_ZOOM = 10;

// LOD: More intense, outer ring is MUCH smaller
const RING_DOT_SIZES = [
  30,  // Today: 5-10 photos
  22,  // This Week
  14,  // This Month
  9,   // This Quarter
  5,   // This Year
  2.5, // Years Ago - tiny particles!
];

export default function InfiniteCanvas() {
  const memories = useMemoryStore(state => state.memories);
  
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
  
  console.log(`📊 ${positionedMemories.length} memories across ${TIME_RINGS.length} rings`);
  
  // Gesture values
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  // Saved state
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const panContext = useSharedValue({ x: 0, y: 0 });

  // BATTLE-TESTED TRANSFORM ORDER
  // Key: translate TO focal point → scale → translate BACK → pan
  const transform = useDerivedValue(() => {
    return [
      // 1. Center on screen
      { translateX: W / 2 },
      { translateY: H / 2 },
      // 2. Apply pan
      { translateX: translateX.value },
      { translateY: translateY.value },
      // 3. Move TO focal point (pivot)
      { translateX: -focalX.value },
      { translateY: -focalY.value },
      // 4. Scale around focal point
      { scale: scale.value },
      // 5. Move BACK from focal point
      { translateX: focalX.value },
      { translateY: focalY.value },
    ];
  });

  // Pinch gesture - saves focal point and scales around it
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      savedScale.value = scale.value;
      // Save focal point relative to screen center
      focalX.value = e.focalX - W / 2;
      focalY.value = e.focalY - H / 2;
    })
    .onUpdate((e) => {
      // Just scale - transform handles the rest!
      scale.value = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, savedScale.value * e.scale)
      );
    });

  // Pan gesture - smooth and responsive
  const panGesture = Gesture.Pan()
    .onStart(() => {
      panContext.value = {
        x: translateX.value,
        y: translateY.value,
      };
    })
    .onUpdate((e) => {
      translateX.value = panContext.value.x + e.translationX;
      translateY.value = panContext.value.y + e.translationY;
    });

  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={combinedGesture}>
        <Canvas style={styles.canvas}>
          <Group transform={transform}>
            {/* Time rings - render ALL of them */}
            {TIME_RINGS.map((ring) => (
              <Circle
                key={`ring-${ring.index}`}
                cx={0}
                cy={0}
                r={ring.outerRadius}
                style="stroke"
                strokeWidth={2}
                color={ring.color}
                opacity={0.4}
              />
            ))}
            
            {/* Memory dots - scattered universe */}
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
                  opacity={0.85}
                />
              );
            })}
            
            {/* Center dot */}
            <Circle cx={0} cy={0} r={12} color="white" opacity={0.9} />
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
