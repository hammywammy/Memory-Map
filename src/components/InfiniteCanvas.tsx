import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Line, vec, Points } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { TIME_RINGS, getTimeRingForDate } from '@/utils/ringGeometry';
import { CATEGORY_COLORS } from '@/types/memory';
import { useMemoryStore } from '@/stores/memoryStore';
import { layoutMemories } from '@/utils/memoryLayout';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;

// LOD thresholds
const LOD_DETAILED = 2.5;   // Show + sign
const LOD_CIRCLE = 0.5;     // Show circles  
const LOD_POINT = 0;        // Show points (batch rendered)

const RING_BASE_SIZES = [30, 22, 14, 9, 5, 2.5];

export default function InfiniteCanvas() {
  const memories = useMemoryStore(state => state.memories);
  
  // Pulse for distant memories
  const pulse = useSharedValue(0);
  
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sine) }),
      -1,
      true
    );
  }, []);
  
  const positionedMemories = useMemo(() => {
    const now = new Date();
    const positioned = layoutMemories(memories);
    
    return positioned.map((memory, index) => {
      const ring = getTimeRingForDate(memory.timestamp, now);
      const baseSize = RING_BASE_SIZES[ring.index];
      const sizeFactor = 0.5 + memory.significance;
      const finalSize = baseSize * sizeFactor;
      
      return {
        ...memory,
        worldX: memory.worldX,
        worldY: memory.worldY,
        ringIndex: ring.index,
        finalSize,
        phaseOffset: (index % 20) / 20,
      };
    });
  }, [memories]);
  
  console.log(`✨ ${positionedMemories.length} memories loaded`);
  
  // Camera
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const panContext = useSharedValue({ x: 0, y: 0 });

  // CRITICAL: Viewport culling - only render visible memories
  const visibleMemories = useDerivedValue(() => {
    const zoom = scale.value;
    const panX = translateX.value;
    const panY = translateY.value;
    
    // Calculate viewport bounds in world space
    const viewportLeft = (-W / 2 - panX) / zoom;
    const viewportRight = (W / 2 - panX) / zoom;
    const viewportTop = (-H / 2 - panY) / zoom;
    const viewportBottom = (H / 2 - panY) / zoom;
    
    // Add margin for smooth scrolling
    const margin = 500 / zoom;
    
    // Filter only visible memories
    return positionedMemories.filter(mem => {
      return !(
        mem.worldX < viewportLeft - margin ||
        mem.worldX > viewportRight + margin ||
        mem.worldY < viewportTop - margin ||
        mem.worldY > viewportBottom + margin
      );
    });
  }, [scale, translateX, translateY]);

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
            {/* Rings - simple, no blur */}
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
            
            {/* Memories - LOD based rendering */}
            {visibleMemories.value.map((memory) => {
              const color = CATEGORY_COLORS[memory.category];
              const cx = memory.worldX;
              const cy = memory.worldY;
              const size = memory.finalSize;
              
              // LOD 1: DETAILED - + sign (image placeholder)
              if (scale.value >= LOD_DETAILED) {
                const crossSize = size * 0.4;
                return (
                  <Group key={memory.id}>
                    {/* Circle */}
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={size}
                      color={color}
                      opacity={0.9}
                    />
                    {/* + sign */}
                    <Line
                      p1={vec(cx - crossSize, cy)}
                      p2={vec(cx + crossSize, cy)}
                      color="white"
                      strokeWidth={1.5}
                      opacity={0.9}
                    />
                    <Line
                      p1={vec(cx, cy - crossSize)}
                      p2={vec(cx, cy + crossSize)}
                      color="white"
                      strokeWidth={1.5}
                      opacity={0.9}
                    />
                  </Group>
                );
              }
              
              // LOD 2: CIRCLE - simple circles (no blur!)
              if (scale.value >= LOD_CIRCLE) {
                return (
                  <Circle
                    key={memory.id}
                    cx={cx}
                    cy={cy}
                    r={size}
                    color={color}
                    opacity={0.85}
                  />
                );
              }
              
              // LOD 3: POINT - tiny pulsing points
              const pulsePhase = (pulse.value + memory.phaseOffset) % 1;
              const pulseOpacity = 0.4 + pulsePhase * 0.5;
              
              return (
                <Circle
                  key={memory.id}
                  cx={cx}
                  cy={cy}
                  r={size * 0.8}
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
