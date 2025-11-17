import { useMemo } from 'react';
import { Memory, LifeCategory, CATEGORY_COLORS } from '@/types/memory';

interface DotPosition {
  x: number;
  y: number;
  radius: number;
  color: string;
  memory: Memory;
  opacity: number;
  vx: number;
  vy: number;
}

/**
 * Force-directed layout algorithm to prevent dot overlap
 * Dots push each other away like magnets with same polarity
 */
export function useForceDirectedLayout(
  memories: Memory[],
  centerX: number,
  centerY: number,
  maxRadius: number,
  minRadius: number
) {
  return useMemo(() => {
    if (memories.length === 0) return [];

    const now = Date.now();
    const oldestTime = Math.min(...memories.map(m => m.timestamp.getTime()));
    const timeSpan = now - oldestTime;
    
    // Initial positioning (radial)
    const positions: DotPosition[] = memories.map((memory) => {
      const age = now - memory.timestamp.getTime();
      const normalizedAge = age / timeSpan;
      
      // Dynamic radius with easing
      const radiusProgress = Math.pow(normalizedAge, 0.85);
      const radius = minRadius + (maxRadius - minRadius) * radiusProgress;
      
      // Category-based angle
      const categories = Object.keys(CATEGORY_COLORS) as LifeCategory[];
      const categoryIndex = categories.indexOf(memory.category);
      const anglePerCategory = (Math.PI * 2) / categories.length;
      
      const baseAngle = categoryIndex * anglePerCategory - Math.PI / 2;
      const angleVariation = (Math.random() - 0.5) * anglePerCategory * 0.85;
      const angle = baseAngle + angleVariation;
      
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      // Dot size with better range
      const dotRadius = 2.5 + memory.significance * 10;
      
      // Opacity calculations
      const ageOpacity = 0.4 + (1 - normalizedAge) * 0.4;
      const significanceOpacity = 0.5 + memory.significance * 0.5;
      const opacity = Math.min(ageOpacity, significanceOpacity);
      
      return {
        x, y,
        radius: dotRadius,
        color: CATEGORY_COLORS[memory.category],
        memory,
        opacity,
        vx: 0,
        vy: 0,
      };
    });

    // Force-directed simulation to prevent overlaps
    const iterations = 50; // More iterations = better separation
    const repulsionStrength = 1.5; // How strongly dots push each other
    const damping = 0.8; // Friction to stabilize
    
    for (let iter = 0; iter < iterations; iter++) {
      // Calculate repulsion forces between all dot pairs
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dot1 = positions[i];
          const dot2 = positions[j];
          
          const dx = dot2.x - dot1.x;
          const dy = dot2.y - dot1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Minimum separation (sum of radii + padding for stroke)
          const minDistance = dot1.radius + dot2.radius + 6; // 6px for strokes + padding
          
          if (distance < minDistance && distance > 0) {
            // Calculate repulsion force
            const overlap = minDistance - distance;
            const force = (overlap / minDistance) * repulsionStrength;
            
            // Normalize direction
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Apply force (proportional to size - larger dots push harder)
            const mass1 = dot1.radius;
            const mass2 = dot2.radius;
            const totalMass = mass1 + mass2;
            
            dot1.vx -= nx * force * (mass2 / totalMass);
            dot1.vy -= ny * force * (mass2 / totalMass);
            dot2.vx += nx * force * (mass1 / totalMass);
            dot2.vy += ny * force * (mass1 / totalMass);
          }
        }
      }
      
      // Apply velocities with damping
      for (const dot of positions) {
        dot.x += dot.vx;
        dot.y += dot.vy;
        dot.vx *= damping;
        dot.vy *= damping;
        
        // Keep dots within bounds (with margin)
        const margin = dot.radius + 10;
        dot.x = Math.max(margin, Math.min(centerX * 2 - margin, dot.x));
        dot.y = Math.max(margin, Math.min(centerY * 2 - margin, dot.y));
      }
    }
    
    return positions;
  }, [memories, centerX, centerY, maxRadius, minRadius]);
}

/**
 * Generate dynamic ring positions based on actual dot density
 */
export function useDynamicRings(
  positions: DotPosition[],
  centerX: number,
  centerY: number,
  minRadius: number,
  maxRadius: number
) {
  return useMemo(() => {
    if (positions.length === 0) return [];
    
    // Calculate distance from center for each dot
    const distances = positions.map(pos => {
      const dx = pos.x - centerX;
      const dy = pos.y - centerY;
      return Math.sqrt(dx * dx + dy * dy);
    }).sort((a, b) => a - b);
    
    // Create rings at density-based intervals
    const rings: { radius: number; opacity: number; count: number }[] = [];
    const targetRingCount = 8;
    const dotsPerRing = Math.ceil(distances.length / targetRingCount);
    
    for (let i = 0; i < targetRingCount; i++) {
      const startIdx = i * dotsPerRing;
      const endIdx = Math.min((i + 1) * dotsPerRing, distances.length);
      
      if (startIdx < distances.length) {
        // Average distance for this ring
        const ringDistances = distances.slice(startIdx, endIdx);
        const avgDistance = ringDistances.reduce((a, b) => a + b, 0) / ringDistances.length;
        
        // Ensure ring is within bounds
        const radius = Math.max(minRadius, Math.min(maxRadius, avgDistance));
        const opacity = 0.02 + (i / targetRingCount) * 0.06;
        
        rings.push({
          radius,
          opacity,
          count: ringDistances.length,
        });
      }
    }
    
    return rings;
  }, [positions, centerX, centerY, minRadius, maxRadius]);
}
