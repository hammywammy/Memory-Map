export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export function worldToScreen(wx: number, wy: number, cam: Camera, sw: number, sh: number) {
  return [(wx - cam.x) * cam.zoom + sw / 2, (wy - cam.y) * cam.zoom + sh / 2];
}
