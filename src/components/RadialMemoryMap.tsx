import React, { useMemo } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Path, Skia, useFont, Text as SkiaText } from '@shopify/react-native-skia';
import { Memory, CATEGORY_COLORS, LifeCategory } from '@/types/memory';

interface RadialMemoryMapProps {
  memories: Memory[];
  width: number;
  height: number;
}

const RadialMemoryMap: React.FC<RadialMemoryMapProps> = ({ memories, width, height }) => {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) * 0.45;
  const minRadius = maxRadius * 0.15; // Inner "you" circle
  
  // Calculate time-based positioning
  const { ringPositions, categoryArcs } = useMemo(() => {
    if (memories.length === 0) return { ringPositions: [], categoryArcs: [] };
    
    const now = Date.now();
    const oldestTime = Math.min(...memories.map(m => m.timestamp.getTime()));
    const timeSpan = now - oldestTime;
    
    // Position each memory in radial coordinates
    const positions = memories.map(memory => {
      const age = now - memory.timestamp.getTime();
      const normalizedAge = age / timeSpan;
      
      // Newer memories = inner rings, older = outer rings
      const radius = minRadius + (maxRadius - minRadius) * normalizedAge;
      
      // Angle based on category (divide 360° into category segments)
      const categories = Object.keys(CATEGORY_COLORS) as LifeCategory[];
      const categoryIndex = categories.indexOf(memory.category);
      const anglePerCategory = (Math.PI * 2) / categories.length;
      
      // Add some variation within category segment
      const baseAngle = categoryIndex * anglePerCategory;
      const angleVariation = (Math.random() - 0.5) * anglePerCategory * 0.8;
      const angle = baseAngle + angleVariation;
      
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      // Dot size based on significance
      const dotRadius = 2 + memory.significance * 6;
      
      return {
        x,
        y,
        radius: dotRadius,
        color: CATEGORY_COLORS[memory.category],
        memory,
      };
    });
    
    // Generate category arc paths
    const categories = Object.keys(CATEGORY_COLORS) as LifeCategory[];
    const arcs = categories.map((category, index) => {
      const anglePerCategory = (Math.PI * 2) / categories.length;
      const startAngle = index * anglePerCategory;
      const endAngle = startAngle + anglePerCategory;
      
      // Create arc path for visual guide
      const path = Skia.Path.Make();
      path.addArc(
        {
          x: centerX - maxRadius,
          y: centerY - maxRadius,
          width: maxRadius * 2,
          height: maxRadius * 2,
        },
        (startAngle * 180) / Math.PI,
        (anglePerCategory * 180) / Math.PI
      );
      
      return {
        path,
        color: CATEGORY_COLORS[category],
        category,
      };
    });
    
    return { ringPositions: positions, categoryArcs: arcs };
  }, [memories, centerX, centerY, maxRadius, minRadius]);
  
  // Draw concentric time rings
  const timeRings = useMemo(() => {
    const rings = [];
    const ringCount = 5;
    for (let i = 1; i <= ringCount; i++) {
      const radius = minRadius + ((maxRadius - minRadius) / ringCount) * i;
      rings.push(radius);
    }
    return rings;
  }, [minRadius, maxRadius]);
  
  return (
    <Canvas style={[styles.canvas, { width, height }]}>
      {/* Time rings */}
      <Group opacity={0.15}>
        {timeRings.map((radius, i) => (
          <Circle
            key={`ring-${i}`}
            cx={centerX}
            cy={centerY}
            r={radius}
            color="#ffffff"
            style="stroke"
            strokeWidth={1}
          />
        ))}
      </Group>
      
      {/* Category arc guides (subtle) */}
      <Group opacity={0.08}>
        {categoryArcs.map((arc, i) => (
          <Path
            key={`arc-${i}`}
            path={arc.path}
            color={arc.color}
            style="stroke"
            strokeWidth={2}
          />
        ))}
      </Group>
      
      {/* Memory dots */}
      <Group>
        {ringPositions.map((pos, i) => (
          <Circle
            key={pos.memory.id}
            cx={pos.x}
            cy={pos.y}
            r={pos.radius}
            color={pos.color}
            opacity={0.7 + pos.memory.significance * 0.3}
          />
        ))}
      </Group>
      
      {/* Center "You" indicator */}
      <Group>
        <Circle
          cx={centerX}
          cy={centerY}
          r={minRadius}
          color="#ffffff"
          style="stroke"
          strokeWidth={2}
          opacity={0.3}
        />
        <Circle
          cx={centerX}
          cy={centerY}
          r={8}
          color="#ffffff"
        />
      </Group>
    </Canvas>
  );
};

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: '#000',
  },
});

export default RadialMemoryMap;
