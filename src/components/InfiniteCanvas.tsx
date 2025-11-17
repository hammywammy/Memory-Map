import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Line, vec } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, useAnimatedReaction, runOnJS, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { ResumableZoom, useTransformationState } from 'react-native-zoom-toolkit';
import { TIME_RINGS, getTimeRingForDate } from '@/utils/ringGeometry';
import { CATEGORY_COLORS } from '@/types/memory';
import { useMemoryStore } from '@/stores/memoryStore';
import { layoutMemories } from '@/utils/memoryLayout';
import { calculateLOD, getRingOpacity, RENDER_BUDGETS } from '@/utils/lod';
import PerformanceTracker from '@/components/PerformanceTracker';

const { width: W, height: H } = Dimensions.get('window');
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

/**
 * Using react-native-zoom-toolkit for production-ready zoom behavior
 * This library handles all the focal point math correctly for Skia
 */

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
  
  // Get transformation state from zoom toolkit
  const { onUpdate, transform } = useTransformationState('resumable');
  
  // Track current zoom for LOD calculations
  const currentZoom = useSharedValue(1);
  const currentOffsetX = useSharedValue(0);
  const currentOffsetY = useSharedValue(0);
  
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

  // Calculate what to render based on current transform
  const renderData = useDerivedValue<RenderData>(() => {
    'worklet';
    
    const zoom = currentZoom.value;
    const offsetX = currentOffsetX.value;
    const offsetY = currentOffsetY.value;
    
    const worldWidth = W / zoom;
    const worldHeight = H / zoom;
    const padding = VIEWPORT_PADDING / zoom;
    
    const cameraCenterX = -offsetX / zoom;
    const cameraCenterY = -offsetY / zoom;
    
    const bounds = {
      minX: cameraCenterX - worldWidth / 2 - padding,
      maxX: cameraCenterX + worldWidth / 2 + padding,
      minY: cameraCenterY - worldHeight / 2 - padding,
      maxY: cameraCenterY + worldHeight / 2 + padding,
    };
    
    const visible = positionedMemories.filter(m => 
      m.worldX >= bounds.minX &&
      m.worldX <= bounds.maxX &&
      m.worldY >= bounds.minY &&
      m.worldY <= bounds.maxY
    );
    
    const simplified: PositionedMemoryWithLOD[] = [];
    const standard: PositionedMemoryWithLOD[] = [];
    const detailed: PositionedMemoryWithLOD[] = [];
    
    for (const memory of visible) {
      const lod = calculateLOD(memory.baseSize, zoom, memory.significance);
      
      if (lod.level === 'simplified' && simplified.length < RENDER_BUDGETS.simplified) {
        simplified.push(memory);
      } else if (lod.level === 'standard' && standard.length < RENDER_BUDGETS.standard) {
        standard.push(memory);
      } else if (lod.level === 'detailed' && detailed.length < RENDER_BUDGETS.detailed) {
        detailed.push(memory);
      }
    }
    
    return { simplified, standard, detailed, zoom };
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
      ringOpacity: getRingOpacity(currentZoom.value),
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

  // Enhanced transform that centers the canvas
  const canvasTransform = useDerivedValue(() => {
    'worklet';
    
    return [
      { translateX: W / 2 },
      { translateY: H / 2 },
      ...transform.value,
    ];
  });

  // Update callback from zoom toolkit
  const handleZoomUpdate = (state: any) => {
    'worklet';
    currentZoom.value = state.scale;
    currentOffsetX.value = state.translateX;
    currentOffsetY.value = state.translateY;
    onUpdate(state);
  };

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
      
      {/* ResumableZoom wraps the entire content */}
      <ResumableZoom
        minScale={1}
        maxScale={10}
        onUpdate={handleZoomUpdate}
      >
        <View style={StyleSheet.absoluteFill}>
          <Canvas style={StyleSheet.absoluteFill}>
            <Group transform={canvasTransform}>
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
        </View>
      </ResumableZoom>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
