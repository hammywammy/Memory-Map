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
  
  const [visibleCount, setVisibleCount] = useState(0);
  const [simplifiedCount, setSimplifiedCount] = useState(0);
  const [standardCount, setStandardCount] = useState(0);
  const [detailedCount, setDetailedCount] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const [simplifiedMemories, setSimplifiedMemories] = useState<PositionedMemoryWithLOD[]>([]);
  const [standardMemories, setStandardMemories] = useState<PositionedMemoryWithLOD[]>([]);
  const [detailedMemories, setDetailedMemories] = useState<PositionedMemoryWithLOD[]>([]);
  const [ringOpacityValue, setRingOpacityValue] = useState(0.3);
  const [currentPulse, setCurrentPulse] = useState(0);
  
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
  
  // Camera model: offset (translation) + scale
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const scale = useSharedValue(1);
  
  // Gesture contexts
  const pinchContext = useSharedValue({ 
    offsetX: 0, 
    offsetY: 0, 
    scale: 1,
    focalX: 0,
    focalY: 0,
  });
  const panContext = useSharedValue({ offsetX: 0, offsetY: 0 });
  
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

  // Calculate what to render
  const renderData = useDerivedValue<RenderData>(() => {
    'worklet';
    
    // Calculate viewport bounds in world coordinates
    const worldWidth = W / scale.value;
    const worldHeight = H / scale.value;
    const padding = VIEWPORT_PADDING / scale.value;
    
    // Camera center in world coords
    const cameraCenterX = -offsetX.value / scale.value;
    const cameraCenterY = -offsetY.value / scale.value;
    
    const bounds = {
      minX: cameraCenterX - worldWidth / 2 - padding,
      maxX: cameraCenterX + worldWidth / 2 + padding,
      minY: cameraCenterY - worldHeight / 2 - padding,
      maxY: cameraCenterY + worldHeight / 2 + padding,
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

  useAnimatedReaction(
    () => pulseAnim.value,
    (pulse) => {
      'worklet';
      runOnJS(setCurrentPulse)(pulse);
    }
  );

  useAnimatedReaction(
    () => ({
      simplified: renderData.value.simplified,
      standard: renderData.value.standard,
      detailed: renderData.value.detailed,
      zoom: renderData.value.zoom,
      ringOpacity: getRingOpacity(scale.value),
    }),
    (current, previous) => {
      'worklet';
      
      const total = current.simplified.length + current.standard.length + current.detailed.length;
      
      if (!previous || 
          current.simplified.length !== previous.simplified.length ||
          current.standard.length !== previous.standard.length ||
          current.detailed.length !== previous.detailed.length ||
          Math.abs(current.zoom - previous.zoom) > 0.01) {
        
        runOnJS(setVisibleCount)(total);
        runOnJS(setSimplifiedCount)(current.simplified.length);
        runOnJS(setStandardCount)(current.standard.length);
        runOnJS(setDetailedCount)(current.detailed.length);
        runOnJS(setZoomLevel)(current.zoom);
        runOnJS(setRingOpacityValue)(current.ringOpacity);
        runOnJS(setSimplifiedMemories)(current.simplified);
        runOnJS(setStandardMemories)(current.standard);
        runOnJS(setDetailedMemories)(current.detailed);
      }
    }
  );

  // Transform: translate to center, scale, then apply offset
  const transform = useDerivedValue(() => {
    'worklet';
    
    return [
      { translateX: W / 2 },
      { translateY: H / 2 },
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ];
  });

  // ✅ CORRECT: Zoom to exact cursor position with focal point compensation
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      pinchContext.value = {
        offsetX: offsetX.value,
        offsetY: offsetY.value,
        scale: scale.value,
        focalX: e.focalX - W / 2,
        focalY: e.focalY - H / 2,
      };
    })
    .onUpdate((e) => {
      const newScale = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, pinchContext.value.scale * e.scale)
      );
      
      // Calculate focal point relative to screen center
      const focalX = e.focalX - W / 2;
      const focalY = e.focalY - H / 2;
      
      // Apply zoom with focal point compensation
      // Formula: newOffset = oldOffset + focal * (1 - newScale/oldScale)
      const scaleFactor = newScale / pinchContext.value.scale;
      
      offsetX.value = pinchContext.value.offsetX + focalX * (1 - scaleFactor);
      offsetY.value = pinchContext.value.offsetY + focalY * (1 - scaleFactor);
      scale.value = newScale;
    });

  // ✅ FIXED: Pan speed constant at all zoom levels (no division)
  const panGesture = Gesture.Pan()
    .onStart(() => {
      panContext.value = { 
        offsetX: offsetX.value, 
        offsetY: offsetY.value 
      };
    })
    .onUpdate((e) => {
      // Direct translation - feels fast and responsive
      offsetX.value = panContext.value.offsetX + e.translationX;
      offsetY.value = panContext.value.offsetY + e.translationY;
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
            {TIME_RINGS.map((ring) => (
              <Circle
                key={`ring-${ring.index}`}
                cx={0}
                cy={0}
                r={ring.outerRadius}
                style="stroke"
                strokeWidth={2}
                color={ring.color}
                opacity={ringOpacityValue}
              />
            ))}
            
            {simplifiedMemories.map(memory => {
              const lod = calculateLOD(memory.baseSize, zoomLevel, memory.significance);
              const color = CATEGORY_COLORS[memory.category];
              const pulse = currentPulse;
              const glowRadius = lod.renderSize * (1 + pulse * 1.5);
              const glowOpacity = 0.5 * (1 - pulse * 0.6);
              
              return (
                <Group key={memory.id}>
                  <Circle
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={glowRadius}
                    color={color}
                    opacity={glowOpacity * 0.4}
                  />
                  <Circle
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={lod.renderSize * (1 + pulse * 0.5)}
                    color={color}
                    opacity={glowOpacity * 0.7}
                  />
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
            
            {standardMemories.map(memory => {
              const lod = calculateLOD(memory.baseSize, zoomLevel, memory.significance);
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
            
            {detailedMemories.map(memory => {
              const lod = calculateLOD(memory.baseSize, zoomLevel, memory.significance);
              const color = CATEGORY_COLORS[memory.category];
              const plusSize = lod.renderSize * 0.4;
              const lineWidth = Math.max(2, lod.renderSize * 0.08);
              
              return (
                <Group key={memory.id}>
                  {lod.shouldShowGlow && (
                    <Circle
                      cx={memory.worldX}
                      cy={memory.worldY}
                      r={lod.renderSize * 1.3}
                      color={color}
                      opacity={0.2}
                    />
                  )}
                  <Circle
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={lod.renderSize}
                    color={color}
                    opacity={0.9}
                  />
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
