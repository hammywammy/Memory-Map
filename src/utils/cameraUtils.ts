/**
 * Camera Utilities for Infinite Canvas
 * 
 * Based on proven patterns from:
 * - Steve Ruiz (tldraw creator): https://www.steveruiz.me/posts/zoom-ui
 * - Figma/Miro infinite canvas implementations
 * 
 * Core principle: When zooming, the point under the user's fingers
 * should remain stationary in world space.
 */

'worklet';

export interface Point {
  x: number;
  y: number;
}

export interface Camera {
  x: number;  // World X position
  y: number;  // World Y position
  zoom: number;  // Scale (1.0 = 100%)
}

/**
 * Convert screen coordinates to world coordinates
 * 
 * @param screenPoint - Point in screen space (pixels on device)
 * @param camera - Current camera state
 * @param screenWidth - Screen width in pixels
 * @param screenHeight - Screen height in pixels
 * @returns Point in world coordinates
 * 
 * Example:
 * - User taps center of 375px wide screen at zoom 2x
 * - Screen point: { x: 187.5, y: ? }
 * - If camera.x = 100, camera.zoom = 2
 * - World point: { x: 100 + (187.5 - 187.5) / 2, y: ... } = { x: 100, y: ... }
 */
export function screenToWorld(
  screenPoint: Point,
  camera: Camera,
  screenWidth: number,
  screenHeight: number
): Point {
  'worklet';
  
  // Remove screen center offset, divide by zoom, add camera position
  return {
    x: (screenPoint.x - screenWidth / 2) / camera.zoom + camera.x,
    y: (screenPoint.y - screenHeight / 2) / camera.zoom + camera.y,
  };
}

/**
 * Convert world coordinates to screen coordinates
 * 
 * @param worldPoint - Point in world space
 * @param camera - Current camera state  
 * @param screenWidth - Screen width in pixels
 * @param screenHeight - Screen height in pixels
 * @returns Point in screen coordinates
 */
export function worldToScreen(
  worldPoint: Point,
  camera: Camera,
  screenWidth: number,
  screenHeight: number
): Point {
  'worklet';
  
  return {
    x: (worldPoint.x - camera.x) * camera.zoom + screenWidth / 2,
    y: (worldPoint.y - camera.y) * camera.zoom + screenHeight / 2,
  };
}

/**
 * Zoom camera toward a specific point
 * 
 * This is the KEY function that makes zoom-to-focal-point work.
 * 
 * Algorithm:
 * 1. Find what world point is currently under the screen focal point
 * 2. Calculate new zoom level
 * 3. Find what world point WOULD BE under the screen focal point at new zoom
 * 4. Adjust camera position so the original world point stays under the focal point
 * 
 * @param camera - Current camera state
 * @param focalScreenPoint - Where user is pinching (screen coordinates)
 * @param deltaZoom - Change in zoom (positive = zoom in, negative = zoom out)
 * @param screenWidth - Screen width
 * @param screenHeight - Screen height
 * @returns New camera state
 */
export function zoomCameraToPoint(
  camera: Camera,
  focalScreenPoint: Point,
  deltaZoom: number,
  screenWidth: number,
  screenHeight: number
): Camera {
  'worklet';
  
  // Calculate new zoom level
  const newZoom = camera.zoom + deltaZoom;
  
  // Find the world point currently under the focal point
  const worldPointBefore = screenToWorld(
    focalScreenPoint,
    camera,
    screenWidth,
    screenHeight
  );
  
  // Find what world point WOULD BE under the focal point at new zoom
  // (if we didn't adjust camera position)
  const worldPointAfter = screenToWorld(
    focalScreenPoint,
    { ...camera, zoom: newZoom },
    screenWidth,
    screenHeight
  );
  
  // Adjust camera position to compensate for the difference
  // This keeps the original world point stationary under the fingers
  return {
    x: camera.x + (worldPointAfter.x - worldPointBefore.x),
    y: camera.y + (worldPointAfter.y - worldPointBefore.y),
    zoom: newZoom,
  };
}

/**
 * Pan camera by screen-space delta
 * 
 * @param camera - Current camera state
 * @param deltaX - Pan distance in screen pixels (right = positive)
 * @param deltaY - Pan distance in screen pixels (down = positive)
 * @returns New camera state
 */
export function panCamera(
  camera: Camera,
  deltaX: number,
  deltaY: number
): Camera {
  'worklet';
  
  // Divide by zoom to make pan feel consistent at all zoom levels
  return {
    x: camera.x - deltaX / camera.zoom,
    y: camera.y - deltaY / camera.zoom,
    zoom: camera.zoom,
  };
}

/**
 * Clamp zoom within bounds
 */
export function clampZoom(
  zoom: number,
  minZoom: number,
  maxZoom: number
): number {
  'worklet';
  return Math.max(minZoom, Math.min(maxZoom, zoom));
}

/**
 * Calculate transform array for Skia/RN rendering
 * 
 * IMPORTANT: Transform order matters!
 * This order ensures zoom happens around screen center, then camera moves the world
 */
export function getCameraTransform(
  camera: Camera,
  screenWidth: number,
  screenHeight: number
): Array<{ translateX?: number; translateY?: number; scale?: number }> {
  'worklet';
  
  return [
    // 1. Move origin to screen center
    { translateX: screenWidth / 2 },
    { translateY: screenHeight / 2 },
    
    // 2. Apply zoom (scales around the centered origin)
    { scale: camera.zoom },
    
    // 3. Move the world according to camera position
    { translateX: -camera.x * camera.zoom },
    { translateY: -camera.y * camera.zoom },
  ];
}
