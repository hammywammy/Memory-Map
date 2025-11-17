import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Line, vec } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, useAnimatedReaction, runOnJS, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { TIME_RINGS, getTimeRingForDate } from '@/utils/ringGeometry';
import { CATEGORY_COLORS } from '@/types/memory';
import { useMemoryStore } from '@/stores/memoryStore';
import { layoutMemories } from '@/utils/memoryLayout';
import { calculateLOD, getRingOpacity, RENDER_BUDGETS } from '@/utils/lod';
import PerformanceTracker from '@/components/PerformanceTracker';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;
const VIEWPORT_PADDING = 200;

const RING_DOT_SIZES = [
  30,  // Today
  22,  // This Week
  14,  // This Month
  9,   // This Quarter
  5,   // This Year
  2.5, // Years Ago
];

interface PositionedMemoryWithLOD {
  id: string;
  worldX: number;
  worldY: number;
  baseSize: number;
  ringIndex: number;
  category: string;
  significance: number;
}

interface RenderData {
  simplified: PositionedMemoryWithLOD[];
  standard: PositionedMemoryWithLOD[];
  detailed: PositionedMemoryWithLOD[];
  zoom: number;
}

export default function InfiniteCanvas() {
  const memories = useMemoryStore(state => state.memories);
  
  // Separate state for each performance metric to avoid shared value access during render
  // This fixes the Reanimated strict mode warning about reading from 'value' during render
  const [visibleCount, setVisibleCount] = useState(0);
  const [simplifiedCount, setSimplifiedCount] = useState(0);
  const [standardCount, setStandardCount] = useState(0);
  const [detailedCount, setDetailedCount] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const positionedMemories = useMemo(() => {
    const now = new Date();
    const positioned = layoutMemories(memories);
    
    return positioned.map(memory => {
      const ring = getTimeRingForDate(memory.timestamp, now);
      const baseSize = RING_DOT_SIZES[ring.index];
      
      return {
        id: memory.id,
        worldX: memory.worldX,
        worldY: memory.worldY,
        baseSize,
        ringIndex: ring.index,
        category: memory.category,
        significance: memory.significance,
      };
    });
  }, [memories]);
  
  // Camera state (all on UI thread)
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const panContext = useSharedValue({ x: 0, y: 0 });

  // Pulsing animation for simplified dots
  const pulseAnim = useSharedValue(0);
  
  React.useEffect(() => {
    pulseAnim.value = withRepeat(
      withTiming(1, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, []);

  // Calculate what to render (runs on UI thread)
  const renderData = useDerivedValue<RenderData>(() => {
    'worklet';
    
    // Viewport bounds
    const worldWidth = W / scale.value;
    const worldHeight = H / scale.value;
    const cameraX = -translateX.value / scale.value;
    const cameraY = -translateY.value / scale.value;
    const padding = VIEWPORT_PADDING / scale.value;
    
    const bounds = {
      minX: cameraX - worldWidth / 2 - padding,
      maxX: cameraX + worldWidth / 2 + padding,
      minY: cameraY - worldHeight / 2 - padding,
      maxY: cameraY + worldHeight / 2 + padding,
    };
    
    // Filter visible
    const visible = positionedMemories.filter(m => 
      m.worldX >= bounds.minX &&
      m.worldX <= bounds.maxX &&
      m.worldY >= bounds.minY &&
      m.worldY <= bounds.maxY
    );
    
    // Categorize by LOD
    const simplified: PositionedMemoryWithLOD[] = [];
    const standard: PositionedMemoryWithLOD[] = [];
    const detailed: PositionedMemoryWithLOD[] = [];
    
    for (const memory of visible) {
      const lod = calculateLOD(memory.baseSize, scale.value, memory.significance);
      
      if (lod.level === 'simplified' && simplified.length < RENDER_BUDGETS.simplified) {
        simplified.push(memory);
      } else if (lod.level === 'standard' && standard.length < RENDER_BUDGETS.standard) {
        standard.push(memory);
      } else if (lod.level === 'detailed' && detailed.length < RENDER_BUDGETS.detailed) {
        detailed.push(memory);
      }
    }
    
    return { simplified, standard, detailed, zoom: scale.value };
  });

  // Update React state from UI thread (proper bridge crossing)
  // This approach avoids accessing .value during component render
  useAnimatedReaction(
    () => ({
      total: renderData.value.simplified.length + 
             renderData.value.standard.length + 
             renderData.value.detailed.length,
      simplified: renderData.value.simplified.length,
      standard: renderData.value.standard.length,
      detailed: renderData.value.detailed.length,
      zoom: renderData.value.zoom,
    }),
    (current, previous) => {
      'worklet';
      // Only update if values actually changed to reduce bridge traffic
      if (!previous || 
          current.total !== previous.total ||
          current.simplified !== previous.simplified ||
          current.standard !== previous.standard ||
          current.detailed !== previous.detailed ||
          Math.abs(current.zoom - previous.zoom) > 0.01) {
        
        runOnJS(setVisibleCount)(current.total);
        runOnJS(setSimplifiedCount)(current.simplified);
        runOnJS(setStandardCount)(current.standard);
        runOnJS(setDetailedCount)(current.detailed);
        runOnJS(setZoomLevel)(current.zoom);
      }
    }
  );

  // Camera transform
  const transform = useDerivedValue(() => {
    'worklet';
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
      <PerformanceTracker
        totalMemories={positionedMemories.length}
        visibleMemories={visibleCount}
        simplified={simplifiedCount}
        standard={standardCount}
        detailed={detailedCount}
        zoom={zoomLevel}
      />
      
      <GestureDetector gesture={combinedGesture}>
        <Canvas style={styles.canvas}>
          <Group transform={transform}>
            {/* TIME RINGS */}
            {TIME_RINGS.map((ring) => {
              const opacity = getRingOpacity(scale.value);
              return (
                <Circle
                  key={`ring-${ring.index}`}
                  cx={0}
                  cy={0}
                  r={ring.outerRadius}
                  style="stroke"
                  strokeWidth={2}
                  color={ring.color}
                  opacity={opacity}
                />
              );
            })}
            
            {/* SIMPLIFIED - Pulsing distant stars */}
            {renderData.value.simplified.map(memory => {
              const lod = calculateLOD(memory.baseSize, scale.value, memory.significance);
              const color = CATEGORY_COLORS[memory.category];
              
              // Pulsing glow
              const pulse = pulseAnim.value;
              const glowRadius = lod.renderSize * (1 + pulse * 1.5);
              const glowOpacity = 0.5 * (1 - pulse * 0.6);
              
              return (
                <Group key={memory.id}>
                  {/* Outer glow */}
                  <Circle
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={glowRadius}
                    color={color}
                    opacity={glowOpacity * 0.4}
                  />
                  {/* Inner glow */}
                  <Circle
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={lod.renderSize * (1 + pulse * 0.5)}
                    color={color}
                    opacity={glowOpacity * 0.7}
                  />
                  {/* Core */}
                  <Circle
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={lod.renderSize}
                    color={color}
                    opacity={0.9}
                  />
                </Group>
              );
            })}
            
            {/* STANDARD - Regular circles */}
            {renderData.value.standard.map(memory => {
              const lod = calculateLOD(memory.baseSize, scale.value, memory.significance);
              const color = CATEGORY_COLORS[memory.category];
              
              return (
                <Circle
                  key={memory.id}
                  cx={memory.worldX}
                  cy={memory.worldY}
                  r={lod.renderSize}
                  color={color}
                  opacity={0.85}
                />
              );
            })}
            
            {/* DETAILED - Circles with + sign */}
            {renderData.value.detailed.map(memory => {
              const lod = calculateLOD(memory.baseSize, scale.value, memory.significance);
              const color = CATEGORY_COLORS[memory.category];
              const plusSize = lod.renderSize * 0.4;
              const lineWidth = Math.max(2, lod.renderSize * 0.08);
              
              return (
                <Group key={memory.id}>
                  {/* Glow */}
                  {lod.shouldShowGlow && (
                    <Circle
                      cx={memory.worldX}
                      cy={memory.worldY}
                      r={lod.renderSize * 1.3}
                      color={color}
                      opacity={0.2}
                    />
                  )}
                  {/* Circle */}
                  <Circle
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={lod.renderSize}
                    color={color}
                    opacity={0.9}
                  />
                  {/* + sign */}
                  {lod.shouldShowPlus && (
                    <>
                      <Line
                        p1={vec(memory.worldX, memory.worldY - plusSize)}
                        p2={vec(memory.worldX, memory.worldY + plusSize)}
                        color="white"
                        strokeWidth={lineWidth}
                        opacity={0.9}
                      />
                      <Line
                        p1={vec(memory.worldX - plusSize, memory.worldY)}
                        p2={vec(memory.worldX + plusSize, memory.worldY)}
                        color="white"
                        strokeWidth={lineWidth}
                        opacity={0.9}
                      />
                    </>
                  )}
                </Group>
              );
            })}
            
            {/* CENTER DOT */}
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
