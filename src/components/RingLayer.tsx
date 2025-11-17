import React from 'react';
import Svg, { Circle, Text, G } from 'react-native-svg';
import { TIME_RINGS } from '@/utils/ringGeometry';
import { getRingOpacity } from '@/utils/lod';

interface RingLayerProps {
  zoom: number;
  screenWidth: number;
  screenHeight: number;
}

export default function RingLayer({ zoom, screenWidth, screenHeight }: RingLayerProps) {
  const opacity = getRingOpacity(zoom);
  const showLabels = zoom >= 0.5;
  
  return (
    <Svg
      width={screenWidth}
      height={screenHeight}
      style={{ position: 'absolute', pointerEvents: 'none' }}
    >
      <G>
        {TIME_RINGS.map((ring) => (
          <G key={ring.index}>
            {/* Outer ring circle */}
            <Circle
              cx={screenWidth / 2}
              cy={screenHeight / 2}
              r={ring.outerRadius * zoom}
              stroke={ring.color.replace('0.3', String(opacity))}
              strokeWidth={1 / zoom}
              fill="none"
            />
            
            {/* Ring label (only show at appropriate zoom) */}
            {showLabels && (
              <Text
                x={screenWidth / 2}
                y={screenHeight / 2 - ring.outerRadius * zoom - 10}
                fill={ring.color.replace('0.3', String(opacity * 2))}
                fontSize={12 / zoom}
                textAnchor="middle"
                opacity={opacity * 1.5}
              >
                {ring.label}
              </Text>
            )}
          </G>
        ))}
      </G>
    </Svg>
  );
}
