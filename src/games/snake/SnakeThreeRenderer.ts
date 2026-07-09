import * as THREE from 'three';
import { ThreeBaseRenderer } from '../../shared/three/ThreeBaseRenderer.js';
import type { Direction } from '../../shared/engine/input.js';
import type { FoodVariant, Position, SnakeRenderState } from './snakeState.js';

const CELL_SIZE = 1;
const SEGMENT_RADIUS = 0.36;
const CONNECTOR_RADIUS = 0.34;
const HEAD_RADIUS = 0.52;
const BOARD_EXTRA = 1.8;
const CAMERA_HEIGHT = 5.6;
const CAMERA_DISTANCE = 7.4;
const CAMERA_LEAD = 3.2;
const CAMERA_LERP = 0.08;
const WRAP_SNAP_DISTANCE = 3;
const CONNECTOR_WRAP_DISTANCE = 2.2;
const HEAD_COLOR = 0x16a34a;
const HEAD_TOP_COLOR = 0x4ade80;
const BODY_COLOR = 0x22c55e;
const BOARD_COLOR = 0x10251c;
const WALL_COLOR = 0x1f3b2d;
const GRID_COLOR = 0x2dd47a;
const FOOD_COLORS: Record<FoodVariant, number> = {
  gray: 0xd1d5db,
  brown: 0x92400e,
  white: 0xf8fafc,
};
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export class SnakeThreeRenderer extends ThreeBaseRenderer<SnakeRenderState> {
  readonly continuousRender = true;

  private readonly segmentGeometry = new THREE.SphereGeometry(SEGMENT_RADIUS, 24, 16);
  private readonly connectorGeometry = new THREE.CylinderGeometry(
    CONNECTOR_RADIUS,
    CONNECTOR_RADIUS,
    1,
    18
  );
  private readonly headGeometry = new THREE.SphereGeometry(HEAD_RADIUS, 32, 20);
  private readonly eyeGeometry = new THREE.SphereGeometry(0.085, 12, 8);
  private readonly pupilGeometry = new THREE.SphereGeometry(0.035, 8, 6);
  private readonly tongueGeometry = new THREE.ConeGeometry(0.055, 0.42, 8);
  private readonly foodBodyGeometry = new THREE.SphereGeometry(0.34, 18, 12);
  private readonly foodEarGeometry = new THREE.SphereGeometry(0.12, 12, 8);
  private readonly foodEyeGeometry = new THREE.SphereGeometry(0.025, 8, 6);
  private readonly foodNoseGeometry = new THREE.SphereGeometry(0.045, 8, 6);
  private readonly foodTailGeometry = new THREE.TorusGeometry(0.2, 0.018, 8, 24, Math.PI * 1.25);
  private readonly headMaterial = new THREE.MeshStandardMaterial({
    color: HEAD_COLOR,
    roughness: 0.38,
    metalness: 0.04,
  });
  private readonly headTopMaterial = new THREE.MeshStandardMaterial({
    color: HEAD_TOP_COLOR,
    roughness: 0.28,
    metalness: 0.02,
  });
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({
    color: BODY_COLOR,
    roughness: 0.46,
  });
  private readonly eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.2,
  });
  private readonly pupilMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.25,
  });
  private readonly tongueMaterial = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    roughness: 0.35,
  });
  private readonly boardMaterial = new THREE.MeshStandardMaterial({
    color: BOARD_COLOR,
    roughness: 0.86,
  });
  private readonly wallMaterial = new THREE.MeshStandardMaterial({
    color: WALL_COLOR,
    roughness: 0.72,
  });
  private readonly gridMaterial = new THREE.LineBasicMaterial({
    color: GRID_COLOR,
    transparent: true,
    opacity: 0.18,
  });
  private readonly foodMaterials: Record<FoodVariant, THREE.MeshStandardMaterial> = {
    gray: new THREE.MeshStandardMaterial({ color: FOOD_COLORS.gray, roughness: 0.36 }),
    brown: new THREE.MeshStandardMaterial({ color: FOOD_COLORS.brown, roughness: 0.46 }),
    white: new THREE.MeshStandardMaterial({ color: FOOD_COLORS.white, roughness: 0.22 }),
  };
  private readonly foodInnerEarMaterial = new THREE.MeshStandardMaterial({
    color: 0xf9a8d4,
    roughness: 0.38,
  });
  private readonly foodBlackMaterial = new THREE.MeshStandardMaterial({ color: 0x111827 });
  private readonly snakeGroups: THREE.Group[] = [];
  private readonly connectorMeshes: THREE.Mesh[] = [];
  private readonly foodGroup = new THREE.Group();
  private readonly foodFurMeshes: THREE.Mesh[] = [];
  private readonly cameraLookAt = new THREE.Vector3();
  private readonly desiredCamera = new THREE.Vector3();
  private readonly desiredLookAt = new THREE.Vector3();
  private readonly tmpDirection = new THREE.Vector3(1, 0, 0);
  /** Reused scratch vector — never hold a reference across calls. */
  private readonly tmpVec = new THREE.Vector3();
  /** Pre-allocated camera height offset — never mutated. */
  private readonly cameraHeightVec = new THREE.Vector3(0, CAMERA_HEIGHT, 0);
  /** Pre-allocated lookAt height offset — never mutated. */
  private readonly lookAtHeightVec = new THREE.Vector3(0, 0.5, 0);
  private readonly boardGeometries: THREE.BufferGeometry[] = [];
  private boardGroup: THREE.Group | null = null;
  private gridSize = 25;
  /** True until the first updateCamera call — snaps camera instead of lerping. */
  private firstRender = true;

  constructor(container: HTMLElement) {
    super(container);
    this.setup();
  }

  protected setup(): void {
    this.three.shadowMap.enabled = true;
    this.three.shadowMap.type = THREE.PCFShadowMap;
    this.three.outputColorSpace = THREE.SRGBColorSpace;
    this.three.toneMapping = THREE.ACESFilmicToneMapping;
    this.three.toneMappingExposure = 1.05;

    this.scene.background = new THREE.Color(0x07130f);
    this.scene.fog = new THREE.Fog(0x07130f, 14, 36);
    this.scene.add(new THREE.HemisphereLight(0xd9fff0, 0x07130f, 1.15));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.35);
    keyLight.position.set(-4, 10, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 36;
    keyLight.shadow.camera.left = -18;
    keyLight.shadow.camera.right = 18;
    keyLight.shadow.camera.top = 18;
    keyLight.shadow.camera.bottom = -18;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x86efac, 1.1);
    rimLight.position.set(8, 4, -8);
    this.scene.add(rimLight);

    this.camera.position.set(-CAMERA_DISTANCE, CAMERA_HEIGHT, CAMERA_DISTANCE);
    this.camera.lookAt(0, 0, 0);

    this.foodGroup.name = 'snake-food';
    this.createFoodMouse();
    this.scene.add(this.foodGroup);
    this.createBoard(25);
  }

  protected updateObjects(state: SnakeRenderState): void {
    if (state.gridSize !== this.gridSize) {
      this.gridSize = state.gridSize;
      this.createBoard(state.gridSize);
    }

    this.syncSnakeGroups(state.snake.body);
    this.updateSnake(state);
    this.updateFood(state.food.position, state.food.variant);
    this.updateCamera(state);
  }

  reset(): void {
    this.firstRender = true;
    this.snakeGroups.forEach((g) => {
      g.userData.ready = false;
    });
    this.foodGroup.userData.ready = false;
  }

  override dispose(): void {
    [
      this.segmentGeometry,
      this.connectorGeometry,
      this.headGeometry,
      this.eyeGeometry,
      this.pupilGeometry,
      this.tongueGeometry,
      this.foodBodyGeometry,
      this.foodEarGeometry,
      this.foodEyeGeometry,
      this.foodNoseGeometry,
      this.foodTailGeometry,
    ].forEach((geometry) => geometry.dispose());
    [
      this.headMaterial,
      this.headTopMaterial,
      this.bodyMaterial,
      this.eyeMaterial,
      this.pupilMaterial,
      this.tongueMaterial,
      this.boardMaterial,
      this.wallMaterial,
      this.gridMaterial,
      this.foodInnerEarMaterial,
      this.foodBlackMaterial,
      ...Object.values(this.foodMaterials),
    ].forEach((material) => material.dispose());
    this.boardGeometries.forEach((geometry) => geometry.dispose());
    super.dispose();
  }

  private updateSnake(state: SnakeRenderState): void {
    const direction = this.directionVector(state.snake.direction);
    const headAngle = Math.atan2(direction.x, direction.z);

    state.snake.body.forEach((segment, index) => {
      const group = this.snakeGroups[index];
      const target = this.cellToWorld(segment, index === 0 ? HEAD_RADIUS : SEGMENT_RADIUS);
      this.placeGroup(group, target);
      group.rotation.y = index === 0 ? headAngle : group.rotation.y;
      group.scale.setScalar(Math.max(0.82, 1 - index * 0.009));
      group.visible = index === 0 || this.shouldShowBodyJoint(state.snake.body, index);
    });
    this.updateConnectors(state.snake.body);
  }

  private updateFood(position: Position, variant: FoodVariant): void {
    const target = this.cellToWorld(position, 0.36);
    this.placeGroup(this.foodGroup, target);
    const material = this.foodMaterials[variant];
    this.foodFurMeshes.forEach((mesh) => {
      mesh.material = material;
    });
    this.foodGroup.rotation.y += 0.018;
  }

  private updateCamera(state: SnakeRenderState): void {
    const head = this.cellToWorld(state.snake.body[0], HEAD_RADIUS);
    const direction = this.directionVector(state.snake.direction);
    this.desiredCamera
      .copy(head)
      .addScaledVector(direction, -CAMERA_DISTANCE)
      .add(this.cameraHeightVec);
    this.desiredLookAt.copy(head).addScaledVector(direction, CAMERA_LEAD).add(this.lookAtHeightVec);

    if (this.firstRender) {
      this.firstRender = false;
      this.camera.position.copy(this.desiredCamera);
      this.cameraLookAt.copy(this.desiredLookAt);
    } else {
      this.camera.position.lerp(this.desiredCamera, CAMERA_LERP);
      this.cameraLookAt.lerp(this.desiredLookAt, CAMERA_LERP * 1.4);
    }
    this.camera.lookAt(this.cameraLookAt);
  }

  private syncSnakeGroups(body: Position[]): void {
    while (this.snakeGroups.length < body.length) {
      const group = this.snakeGroups.length === 0 ? this.createHeadGroup() : this.createBodyGroup();
      this.scene.add(group);
      this.snakeGroups.push(group);
    }

    while (this.snakeGroups.length > body.length) {
      const group = this.snakeGroups.pop();
      if (group) this.scene.remove(group);
    }

    const connectorCount = Math.max(0, body.length - 1);
    while (this.connectorMeshes.length < connectorCount) {
      const connector = new THREE.Mesh(this.connectorGeometry, this.bodyMaterial);
      connector.name = 'snake-body-connector';
      connector.castShadow = true;
      connector.receiveShadow = true;
      this.scene.add(connector);
      this.connectorMeshes.push(connector);
    }

    while (this.connectorMeshes.length > connectorCount) {
      const connector = this.connectorMeshes.pop();
      if (connector) this.scene.remove(connector);
    }
  }

  private shouldShowBodyJoint(body: Position[], index: number): boolean {
    if (index === body.length - 1) return true;

    const previous = this.cellToWorld(body[index - 1], SEGMENT_RADIUS).clone();
    const current = this.cellToWorld(body[index], SEGMENT_RADIUS).clone();
    const next = this.cellToWorld(body[index + 1], SEGMENT_RADIUS).clone();

    if (
      previous.distanceTo(current) > CONNECTOR_WRAP_DISTANCE ||
      current.distanceTo(next) > CONNECTOR_WRAP_DISTANCE
    ) {
      return true;
    }

    const fromPrevious = previous.sub(current).normalize();
    const toNext = next.sub(current).normalize();
    return fromPrevious.dot(toNext) > -0.92;
  }

  private updateConnectors(body: Position[]): void {
    for (let i = 0; i < this.connectorMeshes.length; i++) {
      const connector = this.connectorMeshes[i];
      const from = this.cellToWorld(body[i], SEGMENT_RADIUS).clone();
      const to = this.cellToWorld(body[i + 1], SEGMENT_RADIUS).clone();
      const distance = from.distanceTo(to);

      if (distance <= 0.01 || distance > CONNECTOR_WRAP_DISTANCE) {
        connector.visible = false;
        continue;
      }

      connector.visible = true;
      connector.position.lerpVectors(from, to, 0.5);
      connector.scale.set(1, distance, 1);
      connector.quaternion.setFromUnitVectors(Y_AXIS, to.sub(from).normalize());
    }
  }

  private createHeadGroup(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'snake-head';

    const head = new THREE.Mesh(this.headGeometry, this.headMaterial);
    head.scale.set(0.95, 0.72, 1.2);
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    const crown = new THREE.Mesh(this.segmentGeometry, this.headTopMaterial);
    crown.position.set(0, 0.27, 0.08);
    crown.scale.set(0.64, 0.13, 0.52);
    crown.castShadow = true;
    group.add(crown);

    this.addEye(group, -0.22, 0.16, 0.46);
    this.addEye(group, 0.22, 0.16, 0.46);

    const tongue = new THREE.Mesh(this.tongueGeometry, this.tongueMaterial);
    tongue.position.set(0, -0.08, 0.78);
    tongue.rotation.x = Math.PI / 2;
    tongue.castShadow = true;
    group.add(tongue);

    return group;
  }

  private createBodyGroup(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'snake-body';

    const body = new THREE.Mesh(this.segmentGeometry, this.bodyMaterial);
    body.scale.set(1, 0.82, 1);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    return group;
  }

  private addEye(group: THREE.Group, x: number, y: number, z: number): void {
    const eye = new THREE.Mesh(this.eyeGeometry, this.eyeMaterial);
    eye.position.set(x, y, z);
    eye.castShadow = true;
    group.add(eye);

    const pupil = new THREE.Mesh(this.pupilGeometry, this.pupilMaterial);
    pupil.position.set(x, y - 0.008, z + 0.065);
    group.add(pupil);
  }

  private createFoodMouse(): void {
    const body = new THREE.Mesh(this.foodBodyGeometry, this.foodMaterials.gray);
    body.scale.set(1.1, 0.62, 1.35);
    body.castShadow = true;
    body.receiveShadow = true;
    this.foodGroup.add(body);
    this.foodFurMeshes.push(body);

    this.addFoodEar(-0.18, 0.25, 0.16);
    this.addFoodEar(0.18, 0.25, 0.16);

    const nose = new THREE.Mesh(this.foodNoseGeometry, this.foodInnerEarMaterial);
    nose.position.set(0, 0.05, 0.45);
    this.foodGroup.add(nose);

    this.addFoodEye(-0.12, 0.13, 0.34);
    this.addFoodEye(0.12, 0.13, 0.34);

    const tail = new THREE.Mesh(this.foodTailGeometry, this.foodMaterials.gray);
    tail.position.set(0, 0.02, -0.42);
    tail.rotation.set(Math.PI / 2, 0, Math.PI / 4);
    tail.castShadow = true;
    this.foodGroup.add(tail);
    this.foodFurMeshes.push(tail);
  }

  private addFoodEar(x: number, y: number, z: number): void {
    const ear = new THREE.Mesh(this.foodEarGeometry, this.foodMaterials.gray);
    ear.position.set(x, y, z);
    ear.scale.set(1, 0.8, 0.7);
    ear.castShadow = true;
    this.foodGroup.add(ear);
    this.foodFurMeshes.push(ear);

    const inner = new THREE.Mesh(this.foodEarGeometry, this.foodInnerEarMaterial);
    inner.position.set(x, y + 0.01, z + 0.025);
    inner.scale.set(0.48, 0.36, 0.32);
    this.foodGroup.add(inner);
  }

  private addFoodEye(x: number, y: number, z: number): void {
    const eye = new THREE.Mesh(this.foodEyeGeometry, this.foodBlackMaterial);
    eye.position.set(x, y, z);
    this.foodGroup.add(eye);
  }

  private createBoard(gridSize: number): void {
    if (this.boardGroup) {
      this.scene.remove(this.boardGroup);
      this.boardGeometries.forEach((g) => g.dispose());
      this.boardGeometries.length = 0;
    }

    const group = new THREE.Group();
    group.name = 'snake-board';
    const boardSize = gridSize + BOARD_EXTRA;

    const groundGeometry = new THREE.PlaneGeometry(boardSize, boardSize);
    this.boardGeometries.push(groundGeometry);
    const ground = new THREE.Mesh(groundGeometry, this.boardMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    const grid = new THREE.GridHelper(gridSize, gridSize, GRID_COLOR, GRID_COLOR);
    grid.position.y = 0.025;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.18;
      material.depthWrite = false;
    });
    group.add(grid);

    const wallGeometry = new THREE.BoxGeometry(boardSize, 0.55, 0.48);
    const sideWallGeometry = new THREE.BoxGeometry(0.48, 0.55, boardSize);
    this.boardGeometries.push(wallGeometry, sideWallGeometry);
    const half = boardSize / 2;
    const walls = [
      { geometry: wallGeometry, position: new THREE.Vector3(0, 0.28, -half) },
      { geometry: wallGeometry, position: new THREE.Vector3(0, 0.28, half) },
      { geometry: sideWallGeometry, position: new THREE.Vector3(-half, 0.28, 0) },
      { geometry: sideWallGeometry, position: new THREE.Vector3(half, 0.28, 0) },
    ];

    walls.forEach(({ geometry, position }) => {
      const wall = new THREE.Mesh(geometry, this.wallMaterial);
      wall.position.copy(position);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);
    });

    this.boardGroup = group;
    this.scene.add(group);
  }

  private placeGroup(group: THREE.Group, target: THREE.Vector3): void {
    if (!group.userData.ready || group.position.distanceTo(target) > WRAP_SNAP_DISTANCE) {
      group.userData.ready = true;
    }
    group.position.copy(target);
  }

  private cellToWorld(position: Position, height: number): THREE.Vector3 {
    const offset = (this.gridSize + 1) / 2;
    return this.tmpVec.set(
      (position.x - offset) * CELL_SIZE,
      height,
      (position.y - offset) * CELL_SIZE
    );
  }

  private directionVector(direction: Direction): THREE.Vector3 {
    switch (direction) {
      case 'up':
        return this.tmpDirection.set(0, 0, -1);
      case 'down':
        return this.tmpDirection.set(0, 0, 1);
      case 'left':
        return this.tmpDirection.set(-1, 0, 0);
      case 'right':
        return this.tmpDirection.set(1, 0, 0);
    }
  }
}
