import React from 'react';
import { View, StyleSheet } from 'react-native';
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
    <View style={styles.container} pointerEvents="none">
      <Svg
        width={screenWidth}
        height={screenHeight}
        style={styles.svg}
      >
        <G>
          {TIME_RINGS.map((ring) => (
            <G key={ring.index}>
              {/* Outer ring circle - centered at origin */}
              <Circle
                cx={screenWidth / 2}
                cy={screenHeight / 2}
                r={ring.outerRadius}
                stroke={ring.color.replace('0.3', String(opacity))}
                strokeWidth={2}
                fill="none"
              />
              
              {/* Ring label (only show at appropriate zoom) */}
              {showLabels && (
                <Text
                  x={screenWidth / 2}
                  y={screenHeight / 2 - ring.outerRadius - 10}
                  fill={ring.color.replace('0.3', String(Math.min(1, opacity * 2)))}
                  fontSize={14}
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {ring.label}
                </Text>
              )}
            </G>
          ))}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
  },
});
