import React, { useRef, useEffect } from 'react';
import { StyleSheet, Dimensions, Platform } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useDerivedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Memory, CATEGORY_COLORS, LifeCategory } from '@/types/memory';
import { useForceDirectedLayout, useDynamicRings } from '@/utils/forceDirectedLayout';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

interface ZoomableRadialMapProps {
  memories: Memory[];
  width: number;
  height: number;
}

const ZoomableRadialMap: React.FC<ZoomableRadialMapProps> = ({ memories, width, height }) => {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) * 0.42;
  const minRadius = maxRadius * 0.12;
  
  // Zoom and pan state
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  
  // Container ref for mouse events
  const containerRef = useRef<any>(null);
  
  // Mouse wheel zoom for web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const delta = -e.deltaY / 1000;
      const newScale = Math.max(0.5, Math.min(scale.value * (1 + delta), 20));
      
      // Zoom toward mouse position
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const worldX = (mouseX - translateX.value) / scale.value;
        const worldY = (mouseY - translateY.value) / scale.value;
        
        translateX.value = mouseX - worldX * newScale;
        translateY.value = mouseY - worldY * newScale;
      }
      
      scale.value = newScale;
      savedScale.value = newScale;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    };
    
    const element = containerRef.current;
    if (element) {
      element.addEventListener('wheel', handleWheel, { passive: false });
      return () => element.removeEventListener('wheel', handleWheel);
    }
  }, []);
  
  // Middle mouse drag for web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1) { // Middle mouse button
        e.preventDefault();
        isDragging = true;
        startX = e.clientX - translateX.value;
        startY = e.clientY - translateY.value;
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      
      translateX.value = e.clientX - startX;
      translateY.value = e.clientY - startY;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        isDragging = false;
      }
    };
    
    const element = containerRef.current;
    if (element) {
      element.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        element.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, []);
  
  // Scale-dependent stroke widths for quality
  const dynamicStrokeWidth = useDerivedValue(() => {
    return Math.max(0.5, 2.5 / scale.value);
  });
  
  const dynamicRingStroke = useDerivedValue(() => {
    return Math.max(0.5, 1.5 / scale.value);
  });
  
  // Force-directed layout with collision detection
  const positions = useForceDirectedLayout(memories, centerX, centerY, maxRadius, minRadius);
  const dynamicRings = useDynamicRings(positions, centerX, centerY, minRadius, maxRadius);
  
  // Category guide lines
  const categoryGuides = React.useMemo(() => {
    const categories = Object.keys(CATEGORY_COLORS) as LifeCategory[];
    return categories.map((category, index) => {
      const anglePerCategory = (Math.PI * 2) / categories.length;
      const angle = index * anglePerCategory - Math.PI / 2;
      const startRadius = minRadius * 1.1;
      const endRadius = maxRadius * 1.05;
      
      const x1 = centerX + Math.cos(angle) * startRadius;
      const y1 = centerY + Math.sin(angle) * startRadius;
      const x2 = centerX + Math.cos(angle) * endRadius;
      const y2 = centerY + Math.sin(angle) * endRadius;
      
      return { x1, y1, x2, y2, color: CATEGORY_COLORS[category], category };
    });
  }, [centerX, centerY, minRadius, maxRadius]);
  
  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      scale.value = Math.max(0.5, Math.min(newScale, 10)); // Min 0.5x, max 10x zoom
      
      // Zoom toward focal point
      const adjustX = (event.focalX - width / 2) * (1 - event.scale);
      const adjustY = (event.focalY - height / 2) * (1 - event.scale);
      translateX.value = savedTranslateX.value + adjustX;
      translateY.value = savedTranslateY.value + adjustY;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      
      // Spring back if zoomed out too much
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      }
    });
  
  // Pan gesture for dragging
  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      // Only allow panning when zoomed in
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });
  
  // Double tap to reset zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });
  
  // Combine gestures
  const composedGestures = Gesture.Simultaneous(
    Gesture.Race(doubleTapGesture, pinchGesture),
    panGesture
  );
  
  // Animated style for zoom/pan
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });
  
  return (
    <GestureDetector gesture={composedGestures}>
      <Animated.View 
        ref={containerRef}
        style={[styles.container, animatedStyle]}
      >
        <Svg width={width} height={height} style={styles.svg}>
          <Defs>
            {/* Glow gradients for each category */}
            {Object.entries(CATEGORY_COLORS).map(([category, color]) => (
              <RadialGradient
                key={`gradient-${category}`}
                id={`glow-${category}`}
                cx="50%"
                cy="50%"
              >
                <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
                <Stop offset="50%" stopColor={color} stopOpacity="0.5" />
                <Stop offset="100%" stopColor={color} stopOpacity="0" />
              </RadialGradient>
            ))}
            
            {/* Center glow */}
            <RadialGradient id="center-glow" cx="50%" cy="50%">
              <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
              <Stop offset="50%" stopColor="#3B82F6" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          
          {/* Category guide lines (more visible) */}
          <G opacity={0.12}>
            {categoryGuides.map((guide, i) => (
              <Line
                key={`guide-${i}`}
                x1={guide.x1}
                y1={guide.y1}
                x2={guide.x2}
                y2={guide.y2}
                stroke={guide.color}
                strokeWidth={2}
              />
            ))}
          </G>
          
          {/* Dynamic time rings (MORE VISIBLE) */}
          <G>
            {dynamicRings.map((ring, i) => (
              <Circle
                key={`ring-${i}`}
                cx={centerX}
                cy={centerY}
                r={ring.radius}
                stroke="#ffffff"
                strokeWidth={i === dynamicRings.length - 1 ? 3 : 2}
                fill="none"
                opacity={0.15 + (i / dynamicRings.length) * 0.15}
              />
            ))}
          </G>
          
          {/* Memory dots with thick strokes and collision-free positioning */}
          <G>
            {positions.map((pos) => (
              <G key={pos.memory.id}>
                {/* Outer glow layer */}
                <Circle
                  cx={pos.x}
                  cy={pos.y}
                  r={pos.radius * 2.8}
                  fill={`url(#glow-${pos.memory.category})`}
                  opacity={pos.opacity * 0.25}
                />
                
                {/* Main dot with THICK stroke */}
                <Circle
                  cx={pos.x}
                  cy={pos.y}
                  r={pos.radius}
                  fill={pos.color}
                  stroke="#000"
                  strokeWidth={2.5}
                  opacity={pos.opacity}
                />
                
                {/* Inner stroke for depth */}
                <Circle
                  cx={pos.x}
                  cy={pos.y}
                  r={pos.radius - 1.5}
                  fill="none"
                  stroke={pos.color}
                  strokeWidth={1}
                  opacity={pos.opacity * 0.6}
                />
                
                {/* Highlight for significant moments */}
                {pos.memory.significance > 0.65 && (
                  <Circle
                    cx={pos.x}
                    cy={pos.y}
                    r={pos.radius * 0.35}
                    fill="#ffffff"
                    opacity={0.7}
                  />
                )}
              </G>
            ))}
          </G>
          
          {/* Center "You" indicator */}
          <G>
            {/* Outer glow */}
            <Circle
              cx={centerX}
              cy={centerY}
              r={minRadius * 1.4}
              fill="url(#center-glow)"
              opacity={0.12}
            />
            
            {/* Boundary ring with thick stroke */}
            <Circle
              cx={centerX}
              cy={centerY}
              r={minRadius}
              stroke="#3B82F6"
              strokeWidth={3}
              fill="none"
              opacity={0.3}
            />
            
            {/* Center dot */}
            <Circle
              cx={centerX}
              cy={centerY}
              r={12}
              fill="#3B82F6"
              stroke="#000"
              strokeWidth={2}
              opacity={0.95}
            />
            
            {/* Center highlight */}
            <Circle
              cx={centerX}
              cy={centerY}
              r={5}
              fill="#ffffff"
              opacity={0.8}
            />
          </G>
        </Svg>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    cursor: 'grab',
  },
  svg: {
    backgroundColor: '#000',
  },
});

export default ZoomableRadialMap;
