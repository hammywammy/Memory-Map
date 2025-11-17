import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Line, vec } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { TIME_RINGS, getTimeRingForDate } from '@/utils/ringGeometry';
import { CATEGORY_COLORS } from '@/types/memory';
import { useMemoryStore } from '@/stores/memoryStore';
import { layoutMemories } from '@/utils/memoryLayout';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;

// LOD thresholds
const LOD_DETAILED = 2.5;
const LOD_CIRCLE = 0.5;

const RING_BASE_SIZES = [30, 22, 14, 9, 5, 2.5];

export default function InfiniteCanvas() {
  const memories = useMemoryStore(state => state.memories);
  
  // Pulse animation
  const pulse = useSharedValue(0);
  
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sine) }),
      -1,
      true
    );
  }, []);
  
  // Layout memories
  const positioned = useMemo(() => {
    const now = new Date();
    const laid = layoutMemories(memories);
    
    return laid.map((memory, index) => {
      const ring = getTimeRingForDate(memory.timestamp, now);
      const baseSize = RING_BASE_SIZES[ring.index];
      const sizeFactor = 0.5 + memory.significance;
      const finalSize = baseSize * sizeFactor;
      
      return {
        id: memory.id,
        x: memory.worldX,
        y: memory.worldY,
        category: memory.category,
        size: finalSize,
        phaseOffset: (index % 20) / 20,
      };
    });
  }, [memories]);
  
  console.log(`✨ Loaded ${positioned.length} memories`);
  
  // Camera
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const panContext = useSharedValue({ x: 0, y: 0 });

  // Transform
  const transform = useDerivedValue(() => {
    return [
      { translateX: W / 2 },
      { translateY: H / 2 },
      { translateX: translateX.value },
      { translateY: translateY.value },
      { translateX: -focalX.value },
      { translateY: -focalY.value },
      { scale: scale.value },
      { translateX: focalX.value },
      { translateY: focalY.value },
    ];
  });

  // Current LOD level
  const lodLevel = useDerivedValue(() => {
    if (scale.value >= LOD_DETAILED) return 'detailed';
    if (scale.value >= LOD_CIRCLE) return 'circle';
    return 'pulse';
  });

  // Pulse opacity
  const pulseOpacity = useDerivedValue(() => {
    return 0.4 + pulse.value * 0.5;
  });

  // Gestures
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      savedScale.value = scale.value;
      focalX.value = e.focalX - W / 2;
      focalY.value = e.focalY - H / 2;
    })
    .onUpdate((e) => {
      scale.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, savedScale.value * e.scale));
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      panContext.value = { x: translateX.value, y: translateY.value };
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
            {/* Rings */}
            {TIME_RINGS.map((ring) => (
              <Circle
                key={`ring-${ring.index}`}
                cx={0}
                cy={0}
                r={ring.outerRadius}
                style="stroke"
                strokeWidth={1}
                color={ring.color}
                opacity={0.25}
              />
            ))}
            
            {/* Memories */}
            {positioned.map((memory) => {
              const color = CATEGORY_COLORS[memory.category];
              
              // LOD: Detailed (+ sign)
              if (lodLevel.value === 'detailed') {
                const crossSize = memory.size * 0.4;
                return (
                  <Group key={memory.id}>
                    <Circle
                      cx={memory.x}
                      cy={memory.y}
                      r={memory.size}
                      color={color}
                      opacity={0.9}
                    />
                    <Line
                      p1={vec(memory.x - crossSize, memory.y)}
                      p2={vec(memory.x + crossSize, memory.y)}
                      color="white"
                      strokeWidth={1.5}
                      opacity={0.9}
                    />
                    <Line
                      p1={vec(memory.x, memory.y - crossSize)}
                      p2={vec(memory.x, memory.y + crossSize)}
                      color="white"
                      strokeWidth={1.5}
                      opacity={0.9}
                    />
                  </Group>
                );
              }
              
              // LOD: Circle
              if (lodLevel.value === 'circle') {
                return (
                  <Circle
                    key={memory.id}
                    cx={memory.x}
                    cy={memory.y}
                    r={memory.size}
                    color={color}
                    opacity={0.85}
                  />
                );
              }
              
              // LOD: Pulse
              return (
                <Circle
                  key={memory.id}
                  cx={memory.x}
                  cy={memory.y}
                  r={memory.size * 0.8}
                  color={color}
                  opacity={pulseOpacity}
                />
              );
            })}
            
            {/* Center */}
            <Circle cx={0} cy={0} r={10} color="white" opacity={0.95} />
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
