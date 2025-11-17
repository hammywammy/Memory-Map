/**
 * Camera Utilities for Infinite Canvas - November 2025
 * 
 * Implements zoom-to-focal-point based on industry-proven patterns from:
 * - React Native Reanimated best practices (2024-2025)
 * - Figma/Miro infinite canvas implementations
 * - Mathematical formula verified across multiple implementations
 * 
 * CRITICAL FORMULA for zoom-to-focal-point:
 * ==========================================
 * When zooming, the point under the user's fingers should remain stationary.
 * 
 * Formula: newOffset = oldOffset + focal * (1 - newScale/oldScale)
 * 
 * Where:
 * - oldOffset: current camera position
 * - focal: focal point relative to screen center (focalX - screenWidth/2)
 * - newScale: target zoom level
 * - oldScale: current zoom level
 * 
 * This formula ensures the world point under the focal point stays fixed
 * as the zoom level changes.
 */

'worklet';

/**
 * Core zoom-to-focal-point implementation
 * 
 * This is the KEY function that makes proper pinch zoom work.
 * Called during pinch gesture updates.
 * 
 * @param currentOffset - Current camera offset (x or y)
 * @param currentScale - Current zoom level
 * @param newScale - New zoom level from pinch gesture
 * @param focalPoint - Where user is pinching (screen coordinates)
 * @param screenCenter - Half of screen dimension (width/2 or height/2)
 * @returns New camera offset that keeps focal point stationary
 * 
 * Example:
 * - User pinches at x=100 (left side of 375px screen)
 * - Screen center = 375/2 = 187.5
 * - Focal relative to center = 100 - 187.5 = -87.5
 * - Current zoom = 1.0, new zoom = 2.0
 * - Scale factor = 1 - 2.0/1.0 = -1.0
 * - Offset adjustment = -87.5 * -1.0 = 87.5
 * - Camera moves right by 87.5, keeping left side content centered under fingers
 */
export function calculateOffsetWithFocalPoint(
  currentOffset: number,
  currentScale: number,
  newScale: number,
  focalPoint: number,
  screenCenter: number
): number {
  'worklet';
  
  // Calculate focal point relative to screen center
  const focalRelativeToCenter = focalPoint - screenCenter;
  
  // Calculate scale factor (how much zoom changed)
  const scaleFactor = 1 - (newScale / currentScale);
  
  // Apply the industry-standard focal point compensation formula
  const newOffset = currentOffset + focalRelativeToCenter * scaleFactor;
  
  return newOffset;
}

/**
 * Pan camera - no compensation needed, direct translation
 * 
 * @param currentOffset - Current camera offset
 * @param translationDelta - How far user dragged (in screen pixels)
 * @returns New camera offset
 */
export function calculatePanOffset(
  currentOffset: number,
  translationDelta: number
): number {
  'worklet';
  
  // Direct translation - pan speed constant at all zoom levels
  // No division by zoom needed, feels responsive
  return currentOffset + translationDelta;
}

/**
 * Clamp zoom within bounds
 * 
 * @param zoom - Zoom level to clamp
 * @param minZoom - Minimum allowed zoom
 * @param maxZoom - Maximum allowed zoom
 * @returns Clamped zoom value
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
 * Example usage in gesture handlers:
 * 
 * ```typescript
 * const pinchGesture = Gesture.Pinch()
 *   .onStart((e) => {
 *     // Store starting state
 *     pinchContext.value = {
 *       offsetX: offsetX.value,
 *       offsetY: offsetY.value,
 *       scale: scale.value,
 *     };
 *   })
 *   .onUpdate((e) => {
 *     // Calculate new scale
 *     const newScale = clampZoom(
 *       pinchContext.value.scale * e.scale,
 *       MIN_ZOOM,
 *       MAX_ZOOM
 *     );
 *     
 *     // Calculate new offsets with focal point compensation
 *     offsetX.value = calculateOffsetWithFocalPoint(
 *       pinchContext.value.offsetX,
 *       pinchContext.value.scale,
 *       newScale,
 *       e.focalX,
 *       W / 2
 *     );
 *     
 *     offsetY.value = calculateOffsetWithFocalPoint(
 *       pinchContext.value.offsetY,
 *       pinchContext.value.scale,
 *       newScale,
 *       e.focalY,
 *       H / 2
 *     );
 *     
 *     scale.value = newScale;
 *   });
 * 
 * const panGesture = Gesture.Pan()
 *   .onStart(() => {
 *     panContext.value = { 
 *       offsetX: offsetX.value, 
 *       offsetY: offsetY.value 
 *     };
 *   })
 *   .onUpdate((e) => {
 *     // Direct translation
 *     offsetX.value = calculatePanOffset(
 *       panContext.value.offsetX,
 *       e.translationX
 *     );
 *     
 *     offsetY.value = calculatePanOffset(
 *       panContext.value.offsetY,
 *       e.translationY
 *     );
 *   });
 * ```
 */
