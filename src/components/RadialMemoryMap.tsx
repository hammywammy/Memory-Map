import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';
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
  const minRadius = maxRadius * 0.15;
  
  const { ringPositions, timeRings } = useMemo(() => {
    if (memories.length === 0) return { ringPositions: [], timeRings: [] };
    
    const now = Date.now();
    const oldestTime = Math.min(...memories.map(m => m.timestamp.getTime()));
    const timeSpan = now - oldestTime;
    
    const positions = memories.map(memory => {
      const age = now - memory.timestamp.getTime();
      const normalizedAge = age / timeSpan;
      const radius = minRadius + (maxRadius - minRadius) * normalizedAge;
      
      const categories = Object.keys(CATEGORY_COLORS) as LifeCategory[];
      const categoryIndex = categories.indexOf(memory.category);
      const anglePerCategory = (Math.PI * 2) / categories.length;
      
      const baseAngle = categoryIndex * anglePerCategory;
      const angleVariation = (Math.random() - 0.5) * anglePerCategory * 0.8;
      const angle = baseAngle + angleVariation;
      
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const dotRadius = 2 + memory.significance * 6;
      
      return {
        x, y,
        radius: dotRadius,
        color: CATEGORY_COLORS[memory.category],
        memory,
      };
    });
    
    const rings = [];
    const ringCount = 5;
    for (let i = 1; i <= ringCount; i++) {
      const radius = minRadius + ((maxRadius - minRadius) / ringCount) * i;
      rings.push(radius);
    }
    
    return { ringPositions: positions, timeRings: rings };
  }, [memories, centerX, centerY, maxRadius, minRadius]);
  
  return (
    <Svg width={width} height={height} style={styles.svg}>
      <G opacity={0.15}>
        {timeRings.map((radius, i) => (
          <Circle
            key={`ring-${i}`}
            cx={centerX}
            cy={centerY}
            r={radius}
            stroke="#ffffff"
            strokeWidth={1}
            fill="none"
          />
        ))}
      </G>
      
      <G opacity={0.08}>
        {Object.keys(CATEGORY_COLORS).map((_, index) => {
          const categories = Object.keys(CATEGORY_COLORS);
          const angle = (index / categories.length) * Math.PI * 2;
          const x2 = centerX + Math.cos(angle) * maxRadius;
          const y2 = centerY + Math.sin(angle) * maxRadius;
          return (
            <Line
              key={`guide-${index}`}
              x1={centerX}
              y1={centerY}
              x2={x2}
              y2={y2}
              stroke="#ffffff"
              strokeWidth={1}
            />
          );
        })}
      </G>
      
      <G>
        {ringPositions.map((pos) => (
          <Circle
            key={pos.memory.id}
            cx={pos.x}
            cy={pos.y}
            r={pos.radius}
            fill={pos.color}
            opacity={0.7 + pos.memory.significance * 0.3}
          />
        ))}
      </G>
      
      <G>
        <Circle cx={centerX} cy={centerY} r={minRadius} stroke="#ffffff" strokeWidth={2} fill="none" opacity={0.3} />
        <Circle cx={centerX} cy={centerY} r={8} fill="#ffffff" />
      </G>
    </Svg>
  );
};

const styles = StyleSheet.create({
  svg: { backgroundColor: '#000' },
});

export default RadialMemoryMap;
