import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';
import { CATEGORY_COLORS, LifeCategory } from '@/types/memory';
import { LODConfig } from '@/utils/lod';

interface MemoryDotProps {
  worldX: number;
  worldY: number;
  category: LifeCategory;
  significance: number;
  size: number;
  lod: LODConfig;
  screenCenterX: number;
  screenCenterY: number;
  zoom: number;
}

export default function MemoryDot({
  worldX,
  worldY,
  category,
  significance,
  size,
  lod,
  screenCenterX,
  screenCenterY,
  zoom,
}: MemoryDotProps) {
  // Convert world coordinates to screen coordinates
  const screenX = screenCenterX + worldX * zoom;
  const screenY = screenCenterY + worldY * zoom;
  
  const color = CATEGORY_COLORS[category];
  const scaledSize = size * zoom;
  
  // LOD-based rendering
  if (lod.level === 'particle') {
    // Tiny shimmer particles for far zoom
    return (
      <Circle
        cx={screenX}
        cy={screenY}
        r={scaledSize}
        fill={color}
        opacity={0.6 + significance * 0.4}
      />
    );
  }
  
  if (lod.level === 'dot') {
    // Small dots
    return (
      <Circle
        cx={screenX}
        cy={screenY}
        r={scaledSize}
        fill={color}
        opacity={0.8}
      />
    );
  }
  
  if (lod.level === 'circle') {
    // Medium circles with optional glow
    return (
      <G>
        {lod.showGlow && (
          <Circle
            cx={screenX}
            cy={screenY}
            r={scaledSize * 1.3}
            fill={color}
            opacity={0.2}
          />
        )}
        <Circle
          cx={screenX}
          cy={screenY}
          r={scaledSize}
          fill={color}
          opacity={0.9}
        />
      </G>
    );
  }
  
  // Detailed view - larger with stroke
  return (
    <G>
      {lod.showGlow && (
        <Circle
          cx={screenX}
          cy={screenY}
          r={scaledSize * 1.4}
          fill={color}
          opacity={0.3}
        />
      )}
      <Circle
        cx={screenX}
        cy={screenY}
        r={scaledSize}
        fill={color}
        stroke={color}
        strokeWidth={2}
        opacity={0.95}
      />
      {/* Future: thumbnail image would go here */}
    </G>
  );
}
