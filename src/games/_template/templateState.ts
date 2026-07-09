export interface TemplatePosition {
  x: number;
  y: number;
}

export interface TemplateGameState {
  gridSize: number;
  player: TemplatePosition;
  target: TemplatePosition;
  elapsedMs: number;
}

export interface TemplateRenderState extends TemplateGameState {
  progress: number;
}
