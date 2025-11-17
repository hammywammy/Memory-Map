import { LifeCategory } from '@/types/memory';

/**
 * Time-based ring system
 * Each ring represents a time period, with exponentially increasing radius
 * OUTER RING IS MASSIVE for scattered universe feel
 */

export interface TimeRing {
  index: number;
  label: string;
  innerRadius: number;
  outerRadius: number;
  daysSpan: number;
  color: string;
}

// Define the time rings - OUTER RING IS HUGE
export const TIME_RINGS: TimeRing[] = [
  {
    index: 0,
    label: 'Today',
    innerRadius: 0,
    outerRadius: 150,
    daysSpan: 1,
    color: 'rgba(59, 130, 246, 0.3)', // blue
  },
  {
    index: 1,
    label: 'This Week',
    innerRadius: 150,
    outerRadius: 300,
    daysSpan: 7,
    color: 'rgba(139, 92, 246, 0.3)', // purple
  },
  {
    index: 2,
    label: 'This Month',
    innerRadius: 300,
    outerRadius: 550,
    daysSpan: 30,
    color: 'rgba(236, 72, 153, 0.3)', // pink
  },
  {
    index: 3,
    label: 'This Quarter',
    innerRadius: 550,
    outerRadius: 900,
    daysSpan: 90,
    color: 'rgba(245, 158, 11, 0.3)', // amber
  },
  {
    index: 4,
    label: 'This Year',
    innerRadius: 900,
    outerRadius: 1400,
    daysSpan: 365,
    color: 'rgba(16, 185, 129, 0.3)', // green
  },
  {
    index: 5,
    label: 'Years Ago',
    innerRadius: 1400,
    outerRadius: 3000, // MASSIVE outer ring! (was 2000)
    daysSpan: 365 * 10,
    color: 'rgba(99, 102, 241, 0.3)', // indigo
  },
];

// Category segments - dividing the circle into category wedges
export const CATEGORY_COUNT = 10;
export const ANGLE_PER_CATEGORY = (Math.PI * 2) / CATEGORY_COUNT;

export const CATEGORY_ORDER: LifeCategory[] = [
  'work',
  'love',
  'social',
  'family',
  'solo',
  'home',
  'fitness',
  'nightlife',
  'travel',
  'creation',
];

/**
 * Polar coordinate utilities
 */

export interface PolarCoord {
  radius: number;
  angle: number; // in radians
}

export interface CartesianCoord {
  x: number;
  y: number;
}

export function polarToCartesian(polar: PolarCoord): CartesianCoord {
  'worklet';
  return {
    x: polar.radius * Math.cos(polar.angle),
    y: polar.radius * Math.sin(polar.angle),
  };
}

export function cartesianToPolar(cart: CartesianCoord): PolarCoord {
  'worklet';
  return {
    radius: Math.sqrt(cart.x * cart.x + cart.y * cart.y),
    angle: Math.atan2(cart.y, cart.x),
  };
}

/**
 * Get the time ring for a given date
 */
export function getTimeRingForDate(date: Date, now: Date = new Date()): TimeRing {
  const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  
  for (const ring of TIME_RINGS) {
    if (daysDiff <= ring.daysSpan) {
      return ring;
    }
  }
  
  // Default to outermost ring
  return TIME_RINGS[TIME_RINGS.length - 1];
}

/**
 * Get category angle (starting angle for the category wedge)
 */
export function getCategoryAngle(category: LifeCategory): number {
  'worklet';
  const index = CATEGORY_ORDER.indexOf(category);
  return index * ANGLE_PER_CATEGORY;
}

/**
 * Calculate radius within a ring based on exact time position
 * Returns a value between ring's innerRadius and outerRadius
 */
export function getRadiusInRing(
  date: Date,
  ring: TimeRing,
  now: Date = new Date()
): number {
  const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  
  // Find previous ring's max days (or 0 for first ring)
  const prevRingDays = ring.index > 0 ? TIME_RINGS[ring.index - 1].daysSpan : 0;
  
  // Normalize position within this ring (0 to 1)
  const ringSpan = ring.daysSpan - prevRingDays;
  const positionInRing = Math.min(1, Math.max(0, (daysDiff - prevRingDays) / ringSpan));
  
  // Linear interpolation between inner and outer radius
  return ring.innerRadius + positionInRing * (ring.outerRadius - ring.innerRadius);
}

/**
 * Check if a point is within viewport bounds (with padding for culling)
 */
export function isInViewport(
  worldX: number,
  worldY: number,
  cameraX: number,
  cameraY: number,
  zoom: number,
  screenWidth: number,
  screenHeight: number,
  padding: number = 100
): boolean {
  'worklet';
  
  // Convert world coords to screen coords
  const screenX = (worldX - cameraX) * zoom + screenWidth / 2;
  const screenY = (worldY - cameraY) * zoom + screenHeight / 2;
  
  // Check if within padded viewport
  return (
    screenX >= -padding &&
    screenX <= screenWidth + padding &&
    screenY >= -padding &&
    screenY <= screenHeight + padding
  );
}
