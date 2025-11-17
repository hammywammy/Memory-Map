import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, BlurMask } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { TIME_RINGS, getTimeRingForDate } from '@/utils/ringGeometry';
import { CATEGORY_COLORS } from '@/types/memory';
import { useMemoryStore } from '@/stores/memoryStore';
import { layoutMemories } from '@/utils/memoryLayout';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;

// LOD system - size and rendering mode
const RING_CONFIG = [
  { size: 30, glow: 8, renderMode: 'circle' },   // Today
  { size: 22, glow: 6, renderMode: 'circle' },   // Week
  { size: 14, glow: 4, renderMode: 'circle' },   // Month
  { size: 9, glow: 3, renderMode: 'dot' },       // Quarter
  { size: 5, glow: 2, renderMode: 'dot' },       // Year
  { size: 2.5, glow: 0, renderMode: 'pulse' },   // Years Ago - distant stars!
];

export default function InfiniteCanvas() {
  const memories = useMemoryStore(state => state.memories);
  
  // Subtle pulse animation (slow, gentle)
  const globalPulse = useSharedValue(0);
  
  useEffect(() => {
    globalPulse.value = withRepeat(
      withTiming(1, {
        duration: 3000,
        easing: Easing.inOut(Easing.ease),
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
      const config = RING_CONFIG[ring.index];
      
      // Each memory gets a slight phase offset for more organic feel
      const phaseOffset = (index % 10) / 10;
      
      return {
        ...memory,
        ringIndex: ring.index,
        config,
        phaseOffset,
      };
    });
  }, [memories]);
  
  console.log(`✨ ${positionedMemories.length} memories in galaxy`);
  
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

  // Pulse value for animations
  const pulseOpacity = useDerivedValue(() => {
    // Subtle pulse between 0.6 and 1.0
    return 0.6 + globalPulse.value * 0.4;
  });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={combinedGesture}>
        <Canvas style={styles.canvas}>
          <Group transform={transform}>
            {/* Time rings with subtle glow */}
            {TIME_RINGS.map((ring, index) => (
              <Group key={`ring-${ring.index}`}>
                {/* Ring glow */}
                <Circle
                  cx={0}
                  cy={0}
                  r={ring.outerRadius}
                  style="stroke"
                  strokeWidth={3}
                  color={ring.color}
                  opacity={0.15}
                >
                  <BlurMask blur={4} style="solid" />
                </Circle>
                {/* Ring line */}
                <Circle
                  cx={0}
                  cy={0}
                  r={ring.outerRadius}
                  style="stroke"
                  strokeWidth={1.5}
                  color={ring.color}
                  opacity={0.3}
                />
              </Group>
            ))}
            
            {/* Memory dots - galaxy effect */}
            {positionedMemories.map((memory) => {
              const color = CATEGORY_COLORS[memory.category];
              const { config, phaseOffset } = memory;
              const sizeFactor = 0.5 + memory.significance;
              const baseSize = config.size * sizeFactor;
              
              // Three rendering modes based on ring
              if (config.renderMode === 'circle') {
                // Close memories - circles with subtle glow
                return (
                  <Group key={memory.id}>
                    {/* Glow layer */}
                    {config.glow > 0 && (
                      <Circle
                        cx={memory.worldX}
                        cy={memory.worldY}
                        r={baseSize + config.glow}
                        color={color}
                        opacity={0.2}
                      >
                        <BlurMask blur={config.glow} style="solid" />
                      </Circle>
                    )}
                    {/* Main circle */}
                    <Circle
                      cx={memory.worldX}
                      cy={memory.worldY}
                      r={baseSize}
                      color={color}
                      opacity={0.9}
                    />
                  </Group>
                );
              } else if (config.renderMode === 'dot') {
                // Medium distance - simple dots with tiny glow
                return (
                  <Group key={memory.id}>
                    {config.glow > 0 && (
                      <Circle
                        cx={memory.worldX}
                        cy={memory.worldY}
                        r={baseSize + config.glow}
                        color={color}
                        opacity={0.15}
                      >
                        <BlurMask blur={config.glow} style="solid" />
                      </Circle>
                    )}
                    <Circle
                      cx={memory.worldX}
                      cy={memory.worldY}
                      r={baseSize}
                      color={color}
                      opacity={0.85}
                    />
                  </Group>
                );
              } else {
                // Distant stars - pulsing particles (Years Ago ring)
                // Each star pulses at slightly different times for organic feel
                return (
                  <Circle
                    key={memory.id}
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={baseSize}
                    color={color}
                    opacity={pulseOpacity}
                  />
                );
              }
            })}
            
            {/* Center - You (with gentle pulse) */}
            <Group>
              {/* Glow */}
              <Circle 
                cx={0} 
                cy={0} 
                r={20} 
                color="white" 
                opacity={0.3}
              >
                <BlurMask blur={10} style="solid" />
              </Circle>
              {/* Center dot */}
              <Circle 
                cx={0} 
                cy={0} 
                r={12} 
                color="white" 
                opacity={pulseOpacity}
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
