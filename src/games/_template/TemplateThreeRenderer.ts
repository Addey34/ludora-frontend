import * as THREE from 'three';
import { ThreeBaseRenderer } from '../../shared/three/ThreeBaseRenderer.js';
import type { TemplatePosition, TemplateRenderState } from './templateState.js';

const PLAYER_COLOR = 0x38bdf8;
const TARGET_COLOR = 0xf59e0b;
const BOARD_COLOR = 0x111827;

export class TemplateThreeRenderer extends ThreeBaseRenderer<TemplateRenderState> {
  readonly continuousRender = true;

  private readonly playerGeometry = new THREE.BoxGeometry(0.72, 0.72, 0.72);
  private readonly targetGeometry = new THREE.SphereGeometry(0.38, 18, 12);
  private readonly boardGeometry = new THREE.PlaneGeometry(1, 1);
  private readonly playerMaterial = new THREE.MeshStandardMaterial({ color: PLAYER_COLOR });
  private readonly targetMaterial = new THREE.MeshStandardMaterial({ color: TARGET_COLOR });
  private readonly boardMaterial = new THREE.MeshStandardMaterial({
    color: BOARD_COLOR,
    roughness: 0.8,
  });
  private readonly player = new THREE.Mesh(this.playerGeometry, this.playerMaterial);
  private readonly target = new THREE.Mesh(this.targetGeometry, this.targetMaterial);
  private readonly board = new THREE.Mesh(this.boardGeometry, this.boardMaterial);
  private gridSize = 1;

  constructor(container: HTMLElement) {
    super(container);
    this.setup();
  }

  protected setup(): void {
    this.scene.background = new THREE.Color(0x020617);
    this.scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x020617, 1.3));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(4, 7, 5);
    this.scene.add(keyLight);

    this.board.rotation.x = -Math.PI / 2;
    this.board.position.y = -0.4;
    this.scene.add(this.board, this.target, this.player);

    this.camera.position.set(0, 7, 8);
    this.camera.lookAt(0, 0, 0);
  }

  protected updateObjects(state: TemplateRenderState): void {
    if (state.gridSize !== this.gridSize) {
      this.gridSize = state.gridSize;
      this.board.scale.set(state.gridSize, state.gridSize, 1);
    }

    this.placeCell(this.player, state.player, 0.2);
    this.placeCell(this.target, state.target, 0);
    this.target.rotation.y += 0.025;
  }

  override dispose(): void {
    [this.playerGeometry, this.targetGeometry, this.boardGeometry].forEach((geometry) =>
      geometry.dispose()
    );
    [this.playerMaterial, this.targetMaterial, this.boardMaterial].forEach((material) =>
      material.dispose()
    );
    super.dispose();
  }

  private placeCell(mesh: THREE.Mesh, position: TemplatePosition, height: number): void {
    const offset = (this.gridSize + 1) / 2;
    mesh.position.set(position.x - offset, height, position.y - offset);
  }
}
