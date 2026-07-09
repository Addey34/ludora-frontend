export interface IRenderer<S> {
  /** Renderers with camera/object interpolation can opt into every-frame rendering. */
  readonly continuousRender?: boolean;
  render(state: S): void;
  /** Called when the game restarts — renderer may snap positions, camera, etc. */
  reset?(): void;
  resize?(width: number, height: number): void;
  dispose?(): void;
}
