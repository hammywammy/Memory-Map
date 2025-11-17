import { Memory } from '@/types/memory';
import {
  getTimeRingForDate,
  getCategoryAngle,
  getRadiusInRing,
  polarToCartesian,
  ANGLE_PER_CATEGORY,
  PolarCoord,
} from './ringGeometry';

export interface PositionedMemory extends Memory {
  worldX: number;
  worldY: number;
  polar: PolarCoord;
}

/**
 * Layout memories in polar coordinate space
 * Uses Fibonacci spiral within each ring-category segment to avoid overlaps
 */
export function layoutMemories(memories: Memory[]): PositionedMemory[] {
  const now = new Date();
  const positioned: PositionedMemory[] = [];
  
  // Group memories by ring and category for organized placement
  const groups = new Map<string, Memory[]>();
  
  for (const memory of memories) {
    const ring = getTimeRingForDate(memory.timestamp, now);
    const categoryAngle = getCategoryAngle(memory.category);
    const key = `${ring.index}-${memory.category}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(memory);
  }
  
  // Layout each group using Fibonacci spiral
  for (const [key, groupMemories] of groups) {
    const [ringIndex, category] = key.split('-');
    const ring = getTimeRingForDate(groupMemories[0].timestamp, now);
    const categoryBaseAngle = getCategoryAngle(groupMemories[0].category);
    
    // Sort by timestamp within group
    groupMemories.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Fibonacci spiral parameters
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
    
    for (let i = 0; i < groupMemories.length; i++) {
      const memory = groupMemories[i];
      
      // Calculate base radius from time
      const baseRadius = getRadiusInRing(memory.timestamp, ring, now);
      
      // Fibonacci spiral: radius grows with sqrt, angle increases by golden angle
      const spiralRadius = baseRadius + Math.sqrt(i) * 5;
      const spiralAngle = categoryBaseAngle + (i * goldenAngle) % ANGLE_PER_CATEGORY;
      
      // Add slight randomness to avoid perfect grid
      const angleJitter = (Math.random() - 0.5) * 0.1;
      const radiusJitter = (Math.random() - 0.5) * 10;
      
      const polar: PolarCoord = {
        radius: spiralRadius + radiusJitter,
        angle: spiralAngle + angleJitter,
      };
      
      // Convert to cartesian world coordinates
      const cart = polarToCartesian(polar);
      
      positioned.push({
        ...memory,
        worldX: cart.x,
        worldY: cart.y,
        polar,
      });
    }
  }
  
  return positioned;
}

/**
 * Simple collision detection for memory circles
 * Returns true if two memories overlap
 */
export function checkCollision(
  m1: PositionedMemory,
  m2: PositionedMemory,
  size1: number,
  size2: number
): boolean {
  const dx = m1.worldX - m2.worldX;
  const dy = m1.worldY - m2.worldY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const minDistance = (size1 + size2) / 2 + 2; // +2 for padding
  
  return distance < minDistance;
}

/**
 * Adjust memory positions to resolve collisions (optional refinement step)
 * This is computationally expensive, so only run on small subsets
 */
export function resolveCollisions(
  memories: PositionedMemory[],
  maxIterations: number = 5
): PositionedMemory[] {
  const result = [...memories];
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let hadCollision = false;
    
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const m1 = result[i];
        const m2 = result[j];
        
        // Simple fixed size for collision check
        if (checkCollision(m1, m2, 20, 20)) {
          hadCollision = true;
          
          // Push apart along the line connecting them
          const dx = m1.worldX - m2.worldX;
          const dy = m1.worldY - m2.worldY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            const overlap = 22 - distance; // 20 + 2 padding - distance
            const pushX = (dx / distance) * overlap * 0.5;
            const pushY = (dy / distance) * overlap * 0.5;
            
            m1.worldX += pushX;
            m1.worldY += pushY;
            m2.worldX -= pushX;
            m2.worldY -= pushY;
          }
        }
      }
    }
    
    if (!hadCollision) break;
  }
  
  return result;
}
