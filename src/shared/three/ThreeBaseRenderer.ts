import * as THREE from 'three';
import type { IRenderer } from '../engine/IRenderer.js';

/**
 * Abstract base for all Three.js renderers.
 *
 * Handles: canvas creation + attachment, ResizeObserver, pixel-ratio, camera
 * aspect and dispose. A concrete renderer extends this and implements only
 * two methods:
 *   - `setup()` — add lights, build 3D objects, position the camera once.
 *   - `updateObjects(state)` — move/update objects every frame from the state.
 *
 * Usage:
 *   class SnakeThreeRenderer extends ThreeBaseRenderer<SnakeGameState> {
 *     constructor(container: HTMLElement) {
 *       super(container);
 *       this.setup();
 *     }
 *     protected setup() { ... }
 *     protected updateObjects(state) { ... }
 *   }
 */
export abstract class ThreeBaseRenderer<S> implements IRenderer<S> {
  protected readonly scene: THREE.Scene;
  protected readonly camera: THREE.PerspectiveCamera;
  protected readonly three: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(0, 0, 10);

    this.three = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.three.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const canvas = this.three.domElement;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    container.style.position = 'relative';
    container.appendChild(canvas);

    this.resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      if (rect.width > 0 && rect.height > 0) this.applySize(rect.width, rect.height);
    });
    this.resizeObserver.observe(container);

    const { width, height } = container.getBoundingClientRect();
    if (width > 0 && height > 0) this.applySize(width, height);
  }

  /** Add lights, create 3D objects, set camera position. Call from the subclass constructor after super(). */
  protected abstract setup(): void;

  /** Move/update 3D objects to match `state`. Called every frame by `render()`. */
  protected abstract updateObjects(state: S): void;

  render(state: S): void {
    this.updateObjects(state);
    this.three.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.applySize(width, height);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.three.dispose();
    this.three.domElement.remove();
  }

  /** Override to react to size changes after the camera/renderer have been updated. */
  protected onResize(_width: number, _height: number): void {}

  private applySize(width: number, height: number): void {
    this.three.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.onResize(width, height);
  }
}
