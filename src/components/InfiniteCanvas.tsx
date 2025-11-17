import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, BlurMask, Line, vec } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { TIME_RINGS, getTimeRingForDate } from '@/utils/ringGeometry';
import { CATEGORY_COLORS } from '@/types/memory';
import { useMemoryStore } from '@/stores/memoryStore';
import { layoutMemories } from '@/utils/memoryLayout';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;

// LOD thresholds based on zoom level
const LOD_THRESHOLDS = {
  DETAILED: 2.5,  // Zoom > 2.5x → show + sign (will be image)
  CIRCLE: 0.8,    // Zoom > 0.8x → show circles with glow
  PULSE: 0,       // Zoom <= 0.8x → show pulsing stars
};

// Base sizes per ring
const RING_BASE_SIZES = [30, 22, 14, 9, 5, 2.5];

export default function InfiniteCanvas() {
  const memories = useMemoryStore(state => state.memories);
  
  // Global pulse for distant stars
  const pulse = useSharedValue(0);
  
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 2500,
        easing: Easing.inOut(Easing.sine),
      }),
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
      
      // Phase offset for organic pulsing
      const phaseOffset = (index % 20) / 20;
      
      return {
        ...memory,
        ringIndex: ring.index,
        baseSize,
        phaseOffset,
      };
    });
  }, [memories]);
  
  console.log(`✨ ${positionedMemories.length} memories`);
  
  // Gesture values
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  // Saved state
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
            {/* Time rings with subtle glow */}
            {TIME_RINGS.map((ring) => (
              <Group key={`ring-${ring.index}`}>
                {/* Ring glow */}
                <Circle
                  cx={0}
                  cy={0}
                  r={ring.outerRadius}
                  style="stroke"
                  strokeWidth={2}
                  color={ring.color}
                  opacity={0.12}
                >
                  <BlurMask blur={3} style="solid" />
                </Circle>
                {/* Ring line */}
                <Circle
                  cx={0}
                  cy={0}
                  r={ring.outerRadius}
                  style="stroke"
                  strokeWidth={1}
                  color={ring.color}
                  opacity={0.25}
                />
              </Group>
            ))}
            
            {/* Memory dots - LOD based on zoom */}
            {positionedMemories.map((memory) => {
              const color = CATEGORY_COLORS[memory.category];
              const sizeFactor = 0.5 + memory.significance;
              const finalSize = memory.baseSize * sizeFactor;
              
              const cx = memory.worldX;
              const cy = memory.worldY;
              
              // LOD Level 1: DETAILED - Show + sign (will be image)
              if (scale.value >= LOD_THRESHOLDS.DETAILED) {
                const crossSize = finalSize * 0.5;
                return (
                  <Group key={memory.id}>
                    {/* Outer glow */}
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={finalSize + 4}
                      color={color}
                      opacity={0.25}
                    >
                      <BlurMask blur={6} style="solid" />
                    </Circle>
                    {/* Circle */}
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={finalSize}
                      color={color}
                      opacity={0.9}
                    />
                    {/* + sign in middle (placeholder for image) */}
                    <Line
                      p1={vec(cx - crossSize, cy)}
                      p2={vec(cx + crossSize, cy)}
                      color="white"
                      strokeWidth={2}
                      opacity={0.8}
                    />
                    <Line
                      p1={vec(cx, cy - crossSize)}
                      p2={vec(cx, cy + crossSize)}
                      color="white"
                      strokeWidth={2}
                      opacity={0.8}
                    />
                  </Group>
                );
              }
              
              // LOD Level 2: CIRCLE - Show circles with glow
              if (scale.value >= LOD_THRESHOLDS.CIRCLE) {
                const glowSize = Math.max(2, finalSize * 0.3);
                return (
                  <Group key={memory.id}>
                    {/* Glow */}
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={finalSize + glowSize}
                      color={color}
                      opacity={0.2}
                    >
                      <BlurMask blur={glowSize} style="solid" />
                    </Circle>
                    {/* Circle */}
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={finalSize}
                      color={color}
                      opacity={0.85}
                    />
                  </Group>
                );
              }
              
              // LOD Level 3: PULSE - Distant star effect (NO circle, just glow pulse)
              // This is the optimization level - just a pulsing glow
              const pulsePhase = (pulse.value + memory.phaseOffset) % 1;
              const pulseOpacity = 0.3 + pulsePhase * 0.6; // 0.3 → 0.9
              const pulseSize = finalSize * (1 + pulsePhase * 0.5); // Grows slightly
              
              return (
                <Group key={memory.id}>
                  {/* Outer glow pulse */}
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={pulseSize * 3}
                    color={color}
                    opacity={pulseOpacity * 0.15}
                  >
                    <BlurMask blur={pulseSize * 2} style="solid" />
                  </Circle>
                  {/* Core star pulse - NO solid circle */}
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={pulseSize}
                    color={color}
                    opacity={pulseOpacity * 0.6}
                  >
                    <BlurMask blur={pulseSize} style="solid" />
                  </Circle>
                </Group>
              );
            })}
            
            {/* Center - You */}
            <Group>
              {/* Glow */}
              <Circle 
                cx={0} 
                cy={0} 
                r={18} 
                color="white" 
                opacity={0.25}
              >
                <BlurMask blur={8} style="solid" />
              </Circle>
              {/* Center dot */}
              <Circle 
                cx={0} 
                cy={0} 
                r={10} 
                color="white" 
                opacity={0.95}
              />
            </Group>
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
