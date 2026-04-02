import * as THREE from 'three';

/** Manhattan distance (px) before touch pan counts as drag, not tap. */
const TOUCH_MOVE_THRESHOLD_PX = 5;

/** Max XY offset vs clusterSize; disk for labels = this × CLOUD_ARTIST_DISK_FR (must match buildClusters). */
const CLOUD_INNER_RADIUS_FACTOR = 0.78;
/** Random disk stays inside fog, not on outer rim (fraction of inner radius). */
const CLOUD_ARTIST_DISK_FR = 0.62;
/** Depth spread vs spreadZ base (stay inside volume). */
const CLOUD_ARTIST_Z_FR = 0.68;

/** Target spacing ≈ (volume / n)^(1/3); lower = tighter packing. */
const CLOUD_LABEL_PACK_FR = 0.52;
/** Clamp min separation to [floor, cap] × clusterSize (world units). */
const CLOUD_LABEL_MIN_SEP_FLOOR_FR = 0.052;
const CLOUD_LABEL_MIN_SEP_CAP_FR = 0.22;
/** Multiply minDist when a full pass fails to place all points. */
const CLOUD_LABEL_MIN_RELAX = 0.9;
const CLOUD_LABEL_MAX_PLACE_ROUNDS = 120;
const CLOUD_LABEL_MAX_ATTEMPTS_PER_POINT = 8000;

function sampleUniformInCloudCylinder(
  diskRadius: number,
  spreadZHalf: number,
  target: THREE.Vector3
): void {
  const theta = Math.random() * Math.PI * 2;
  const r = diskRadius * Math.sqrt(Math.random());
  const z = (Math.random() * 2 - 1) * spreadZHalf;
  target.set(Math.cos(theta) * r, Math.sin(theta) * r, z);
}

function tryPlaceCloudLabels(
  count: number,
  diskRadius: number,
  spreadZHalf: number,
  minDist: number,
  maxAttemptsPerPoint: number
): THREE.Vector3[] | null {
  if (count <= 0) {
    return [];
  }

  const positions: THREE.Vector3[] = [];
  const cellMap = new Map<string, number[]>();
  const minDistSq = minDist * minDist;
  const scratch = new THREE.Vector3();

  const cellKey = (x: number, y: number, z: number) =>
    `${Math.floor(x / minDist)},${Math.floor(y / minDist)},${Math.floor(z / minDist)}`;

  const tooCloseToExisting = (p: THREE.Vector3): boolean => {
    const ix = Math.floor(p.x / minDist);
    const iy = Math.floor(p.y / minDist);
    const iz = Math.floor(p.z / minDist);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = cellMap.get(cellKey(ix + dx, iy + dy, iz + dz));
          if (!bucket) {
            continue;
          }
          for (const j of bucket) {
            if (positions[j].distanceToSquared(p) < minDistSq - 1e-10) {
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  for (let i = 0; i < count; i++) {
    let placed = false;
    for (let attempt = 0; attempt < maxAttemptsPerPoint; attempt++) {
      sampleUniformInCloudCylinder(diskRadius, spreadZHalf, scratch);
      if (!tooCloseToExisting(scratch)) {
        const idx = positions.length;
        positions.push(new THREE.Vector3().copy(scratch));
        const key = cellKey(scratch.x, scratch.y, scratch.z);
        let list = cellMap.get(key);
        if (!list) {
          list = [];
          cellMap.set(key, list);
        }
        list.push(idx);
        placed = true;
        break;
      }
    }
    if (!placed) {
      return null;
    }
  }

  return positions;
}

/**
 * Uniform samples in a cylinder (disk × z) with minimum 3D separation; relaxes spacing until all fit.
 */
function sampleCloudLabelPositionsWithMinSep(
  count: number,
  diskRadius: number,
  spreadZHalf: number,
  clusterSize: number
): THREE.Vector3[] {
  if (count <= 0) {
    return [];
  }

  const cylVolume = Math.PI * diskRadius * diskRadius * (2 * spreadZHalf);
  let minDist = CLOUD_LABEL_PACK_FR * Math.pow(cylVolume / Math.max(count, 1), 1 / 3);
  minDist = Math.max(
    clusterSize * CLOUD_LABEL_MIN_SEP_FLOOR_FR,
    Math.min(clusterSize * CLOUD_LABEL_MIN_SEP_CAP_FR, minDist)
  );

  for (let round = 0; round < CLOUD_LABEL_MAX_PLACE_ROUNDS; round++) {
    const maxAp = CLOUD_LABEL_MAX_ATTEMPTS_PER_POINT + round * 400;
    const placed = tryPlaceCloudLabels(count, diskRadius, spreadZHalf, minDist, maxAp);
    if (placed) {
      return placed;
    }
    minDist *= CLOUD_LABEL_MIN_RELAX;
  }

  // Hard cap: micro-separation so rejection succeeds with very high attempt budget.
  const floorD = Math.max(clusterSize * 1e-4, minDist * 0.25);
  let last = tryPlaceCloudLabels(count, diskRadius, spreadZHalf, floorD, 120_000);
  if (last) {
    return last;
  }
  last = tryPlaceCloudLabels(count, diskRadius, spreadZHalf, clusterSize * 1e-5, 200_000);
  if (last) {
    return last;
  }

  const fallback: THREE.Vector3[] = [];
  const s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    sampleUniformInCloudCylinder(diskRadius, spreadZHalf, s);
    fallback.push(new THREE.Vector3().copy(s));
  }
  return fallback;
}

/** sessionStorage key: set before opening `/?artist=`, read on home cloud init to focus camera. */
export const UNIVERSE_FOCUS_ARTIST_STORAGE_KEY = 'focusArtist';

export type SceneArtist = {
  name: string;
  publicSlug: string;
  genreCode: string;
  genreLabel?: { ru: string; en: string };
  headerImages?: string[];
  /** Hex (e.g. 0x4d80ff); overrides palette for cluster tint (hero / custom). */
  clusterColor?: number;
};

type ClusterConfig = {
  genreCode: string;
  center: THREE.Vector3;
  color: THREE.Color;
  artists: SceneArtist[];
};

type ClusterLabelRef = {
  sprite: THREE.Sprite;
  center: THREE.Vector3;
};

export class Universe3D {
  private containerEl: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private cloudGroups: THREE.Group[] = [];
  private clusterLabels: ClusterLabelRef[] = [];

  private clock = new THREE.Clock();
  private animationId: number | null = null;

  private targetZ = 2;
  private minCameraZ = 0.5;
  private maxCameraZ = 6;
  private targetX = 0;
  private targetY = 0;

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private clickableNodes: THREE.Object3D[] = [];
  private uiLayer!: HTMLElement;
  private activeCard: HTMLElement | null = null;
  /** Mesh the card is tied to; position is reprojected on resize and each frame. */
  private cardAnchorObject: THREE.Object3D | null = null;
  private onPlayArtist?: (artist: SceneArtist) => boolean | Promise<boolean>;
  private onNavigateToArtist?: (publicSlug: string) => void;
  private useContainerSize = false;
  private resizeObserver: ResizeObserver | null = null;
  private attachedWindowClick = false;
  /** Hero embed: larger cloud + closer camera for artist profile strip. */
  private isHeroPreview = false;
  private clusterColorOption?: number;
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastPinchDistance = 0;
  private lastPinchCenterX = 0;
  private lastPinchCenterY = 0;
  private lastMoveTime = 0;

  private touchStartX = 0;
  private touchStartY = 0;
  /** True after movement exceeds threshold (single-finger pan). */
  private touchPanCommitted = false;
  /** True if two-finger pinch occurred in this gesture. */
  private touchHadPinch = false;
  private heroTime = 0;

  private tempVec3 = new THREE.Vector3();
  private labelTextureCache = new Map<string, THREE.CanvasTexture>();
  private lastLabelUpdateCameraX = Number.NaN;
  private lastLabelUpdateCameraY = Number.NaN;
  private lastLabelUpdateCameraZ = Number.NaN;

  constructor(
    container: HTMLElement,
    artists: SceneArtist[] = [],
    options?: {
      onPlayArtist?: (artist: SceneArtist) => boolean | Promise<boolean>;
      onNavigateToArtist?: (publicSlug: string) => void;
      clusterColor?: number;
      disableCameraControls?: boolean;
      embedInContainer?: boolean;
      isHeroPreview?: boolean;
    }
  ) {
    this.containerEl = container;
    this.clusterColorOption = options?.clusterColor;
    this.useContainerSize = options?.embedInContainer === true;
    this.isHeroPreview = options?.isHeroPreview === true;

    this.scene = new THREE.Scene();
    if (this.isHeroPreview) {
      this.targetX = 0;
      this.targetY = 0;
    }

    const sizeW = this.useContainerSize ? Math.max(1, container.clientWidth) : window.innerWidth;
    const sizeH = this.useContainerSize ? Math.max(1, container.clientHeight) : window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(70, sizeW / sizeH, 0.1, 1000);
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0, 2);

    if (options?.isHeroPreview) {
      this.camera.position.z = 0.92;
      this.targetZ = 0.92;
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(sizeW, sizeH);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    canvas.style.webkitUserSelect = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent');
    container.appendChild(canvas);

    const ui = document.createElement('div');
    ui.className = 'universe3d-ui-layer';
    container.appendChild(ui);
    this.uiLayer = ui;
    this.onPlayArtist = options?.onPlayArtist;
    this.onNavigateToArtist = options?.onNavigateToArtist;

    const clusters = this.buildClusters(artists);
    const focusSlug = sessionStorage.getItem(UNIVERSE_FOCUS_ARTIST_STORAGE_KEY);
    let biggestCluster: ClusterConfig | null = null;
    for (const cluster of clusters) {
      if (!biggestCluster || cluster.artists.length > biggestCluster.artists.length) {
        biggestCluster = cluster;
      }
    }

    if (clusters.length > 0) {
      const zValues = clusters.map((c) => c.center.z);
      const minZ = Math.min(...zValues);
      const maxZ = Math.max(...zValues);
      const padding = 10;

      this.minCameraZ = Math.min(minZ - padding, 0.5);
      this.maxCameraZ = maxZ + padding;
      this.targetZ = THREE.MathUtils.clamp(this.targetZ, this.minCameraZ, this.maxCameraZ);
    }

    this.cloudGroups = clusters.map((cluster) =>
      this.createCloud(cluster.color, cluster.center, cluster.artists)
    );
    if (focusSlug) {
      requestAnimationFrame(() => {
        this.focusOnArtist(focusSlug);
        sessionStorage.removeItem(UNIVERSE_FOCUS_ARTIST_STORAGE_KEY);
      });
    } else if (biggestCluster) {
      const targetGroup = this.cloudGroups.find(
        (group) => group.position.distanceTo(biggestCluster!.center) < 0.001
      );
      if (targetGroup) {
        requestAnimationFrame(() => {
          this.focusOnObject(targetGroup);
        });
      }
    }
    this.cloudGroups.forEach((group) => this.scene.add(group));

    this.clusterLabels = clusters.map((cluster) => {
      const labelText = this.getClusterLabelText(cluster);
      const sprite = this.createClusterLabel(labelText);
      sprite.position.set(cluster.center.x, cluster.center.y + 2.2, cluster.center.z);
      this.scene.add(sprite);
      return {
        sprite,
        center: cluster.center.clone(),
      };
    });

    if (this.isHeroPreview) {
      const heroCloudScale = 1.8;
      this.cloudGroups.forEach((group) => group.scale.multiplyScalar(heroCloudScale));
    }

    if (options?.disableCameraControls !== true) {
      this.initControls();
    }

    if (options?.isHeroPreview !== true) {
      window.addEventListener('click', this.onClick);
      this.attachedWindowClick = true;
    }

    window.addEventListener('resize', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);

    if (this.useContainerSize) {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(container);
    }

    this.animate();
  }

  focusOnArtist(slug: string) {
    const normalized = slug.trim();
    if (!normalized) return;

    const target = this.clickableNodes.find(
      (obj) => (obj.userData as SceneArtist | undefined)?.publicSlug === normalized
    );

    if (!target) return;

    this.focusOnObject(target);
  }

  private buildClusters(artists: SceneArtist[]): ClusterConfig[] {
    const grouped = new Map<string, SceneArtist[]>();

    artists.forEach((artist) => {
      const genreCode = artist.genreCode || 'other';
      const bucket = grouped.get(genreCode) ?? [];
      bucket.push(artist);
      grouped.set(genreCode, bucket);
    });

    const genreCodes = Array.from(grouped.keys());
    const count = genreCodes.length || 1;

    const clusterSizes = genreCodes.map((code) => {
      const artistsCount = (grouped.get(code) ?? []).length;
      return Math.sqrt(Math.max(4, artistsCount) / 4);
    });
    const maxClusterSize = Math.max(...clusterSizes);
    const maxSpiralRadius = CLOUD_INNER_RADIUS_FACTOR * CLOUD_ARTIST_DISK_FR * maxClusterSize;
    const minChordBetweenClusters = 2 * maxSpiralRadius + 6;
    const palette = [0x4d80ff, 0xff8a47, 0x53d8a2, 0xb086ff, 0xf2cd5d, 0x5ec9f5];
    const externalColor = artists[0]?.clusterColor ?? this.clusterColorOption;
    const depthRange = 40;
    const getZ = () => (this.isHeroPreview ? 0 : (Math.random() - 0.5) * depthRange);

    if (count === 1) {
      return [
        {
          genreCode: genreCodes[0] ?? 'other',
          center: new THREE.Vector3(0, 0, getZ()),
          color: new THREE.Color(externalColor ?? palette[0]),
          artists: grouped.get(genreCodes[0] ?? 'other') ?? [],
        },
      ];
    }

    if (count === 2) {
      const spacing = maxSpiralRadius * 2.2;
      return genreCodes.map((genreCode, index) => ({
        genreCode,
        center: new THREE.Vector3(index === 0 ? -spacing : spacing, 0, getZ()),
        color: new THREE.Color(externalColor ?? palette[index % palette.length]),
        artists: grouped.get(genreCode) ?? [],
      }));
    }

    if (count === 3) {
      const spacing = maxSpiralRadius * 2.2;
      return genreCodes.map((genreCode, index) => ({
        genreCode,
        center: new THREE.Vector3(
          (index - 1) * spacing,
          index === 1 ? spacing * 0.5 : -spacing * 0.5,
          getZ()
        ),
        color: new THREE.Color(externalColor ?? palette[index % palette.length]),
        artists: grouped.get(genreCode) ?? [],
      }));
    }

    const radius = minChordBetweenClusters / (2 * Math.sin(Math.PI / count));

    return genreCodes.map((genreCode, index) => {
      const angle = (index / count) * Math.PI * 2;
      return {
        genreCode,
        center: new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.6, getZ()),
        color: new THREE.Color(externalColor ?? palette[index % palette.length]),
        artists: grouped.get(genreCode) ?? [],
      };
    });
  }

  private createClusterLabel(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '700 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4.5, 1.2, 1);
    return sprite;
  }

  private getClusterLabelText(cluster: ClusterConfig): string {
    const langKey = document.documentElement.lang?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
    const fromArtist = cluster.artists.find((a) => a.genreLabel)?.genreLabel?.[langKey];
    return fromArtist || cluster.genreCode;
  }

  private createMaterial(color: THREE.Color, offset: number) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        u_time: { value: offset },
        u_color: { value: color },
        u_distort: {
          value: new THREE.Vector2(0.8 + Math.random() * 0.6, 0.8 + Math.random() * 0.6),
        },
        u_seed: { value: Math.random() * 10 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;

        varying vec2 vUv;
        uniform float u_time;
        uniform vec3 u_color;
        uniform vec2 u_distort;
        uniform float u_seed;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);

          float a = hash(i);
          float b = hash(i + vec2(1.0,0.0));
          float c = hash(i + vec2(0.0,1.0));
          float d = hash(i + vec2(1.0,1.0));

          vec2 u = f * f * (3.0 - 2.0 * f);

          return mix(a,b,u.x) +
                 (c - a)*u.y*(1.0-u.x) +
                 (d - b)*u.x*u.y;
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 uv = vUv * 2.0 - 1.0;
          uv.x *= u_distort.x;
          uv.y *= u_distort.y;

          float warp =
            sin(uv.x * 3.0 + u_seed) * 0.1 +
            sin(uv.y * 4.0 - u_seed) * 0.1;
          float distortion = fbm(uv * 2.5 + u_seed);
          float d = length(uv + warp * 0.5 + distortion * 0.3);
          float shape = smoothstep(1.2, 0.2, d);
          float core = smoothstep(0.4, 0.0, d);
          core = pow(core, 1.8);
          float edgeFade = 1.0 - smoothstep(0.35, 0.75, length(vUv - 0.5));
          shape *= edgeFade;

          vec2 flow = uv * 2.0;
          flow += vec2(u_time * 0.03, u_time * 0.02);

          float n = fbm(flow);

          float density = shape * n;
          density += shape * 0.25;
          float holes = smoothstep(0.4, 0.7, n);
          density *= (1.0 - holes * 0.6);
          float coreNoise = fbm(uv * 3.0 + u_seed * 2.0);
          core *= mix(0.7, 1.2, coreNoise);
          vec3 colorA = u_color;
          vec3 colorB = u_color * 0.5 + vec3(0.2, 0.1, 0.3);
          vec3 color = mix(colorA, colorB, n);
          color *= density;
          vec3 coreColor = mix(u_color, vec3(1.0), 0.3);
          color = mix(color, coreColor, core * 0.6);

          gl_FragColor = vec4(color, density * 0.6);
        }
      `,
    });
  }

  private truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;

    const ellipsis = '…';
    let truncated = text;

    while (truncated.length > 0) {
      truncated = truncated.slice(0, -1);
      const candidate = `${truncated}${ellipsis}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        return candidate;
      }
    }

    // Если помещается только сама ellipsis, а не добавка после среза — вернем ее.
    if (ctx.measureText(ellipsis).width <= maxWidth) return ellipsis;
    return '';
  }

  private splitTextToLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    return lines;
  }

  private createArtistLabelSprite(name: string): THREE.Sprite {
    let texture = this.labelTextureCache.get(name);
    if (!texture) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;

      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      const maxWidth = canvas.width - 20;
      const lines = this.splitTextToLines(ctx, name, maxWidth);

      let displayLines: string[];
      if (lines.length <= 2) {
        displayLines = lines;
      } else {
        const firstLine = lines[0] ?? '';
        let secondLine = lines[1] ?? '';

        while (ctx.measureText(`${secondLine}…`).width > maxWidth && secondLine.length > 0) {
          secondLine = secondLine.slice(0, -1);
        }

        displayLines = [firstLine, `${secondLine}…`];
      }

      displayLines = displayLines.map((line) => this.truncateText(ctx, line, maxWidth));

      const lineHeight = 20;
      const startY = 30;
      displayLines.forEach((line, i) => {
        ctx.fillText(line, 10, startY + i * lineHeight);
      });

      texture = new THREE.CanvasTexture(canvas);
      this.labelTextureCache.set(name, texture);
    }

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.6, 0.15, 1);
    sprite.userData.isLabel = true;
    return sprite;
  }

  private disposeArtistLabelSprite(sprite: THREE.Sprite) {
    const material = sprite.material as THREE.SpriteMaterial;
    // Cached texture can be shared between multiple sprites by name.
    material.dispose();
    this.scene.remove(sprite);
  }

  private createCloud(color: THREE.Color, position: THREE.Vector3, users: SceneArtist[]) {
    const group = new THREE.Group();

    const roster = users;
    const n = Math.max(1, roster.length);
    /** >=1; grows with √n so more labels → more spacing (legacy box ≈4 artists @ factor 1). */
    const clusterSize = Math.sqrt(Math.max(4, n) / 4);
    const innerRadiusMax = CLOUD_INNER_RADIUS_FACTOR * clusterSize;
    const spreadZ = 0.85 * clusterSize;
    const diskRadius = innerRadiusMax * CLOUD_ARTIST_DISK_FR;
    const spreadZHalf = spreadZ * CLOUD_ARTIST_Z_FR * 0.5;

    const labelPositions = sampleCloudLabelPositionsWithMinSep(
      roster.length,
      diskRadius,
      spreadZHalf,
      clusterSize
    );

    const geometry = new THREE.PlaneGeometry(3, 3);

    for (let i = 0; i < 5; i++) {
      const material = this.createMaterial(color, i * 5);
      const layer = new THREE.Mesh(geometry, material);

      layer.scale.setScalar(clusterSize);
      layer.position.z = -i * 0.5 * clusterSize;
      layer.position.x = (Math.random() - 0.5) * 0.3 * clusterSize;
      layer.position.y = (Math.random() - 0.5) * 0.3 * clusterSize;
      if (this.isHeroPreview) {
        layer.userData.isHeroCloud = true;
      }

      group.add(layer);
    }

    // 🔥 Группы: случайно в цилиндре внутри облака + минимальный 3D зазор между метками
    roster.forEach((user, i) => {
      const geo = new THREE.SphereGeometry(0.07, 16, 16);

      const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9,
      });

      const mesh = new THREE.Mesh(geo, mat);

      const pos = labelPositions[i]!;
      mesh.position.copy(pos);
      const z = pos.z;
      const zNorm = spreadZ > 1e-6 ? z / (spreadZ * CLOUD_ARTIST_Z_FR) : 0;
      const scale = 0.05 + (1 - (zNorm + 1) / 2) * 0.1;
      mesh.scale.setScalar(scale);

      mesh.userData = user;
      mesh.userData.label = null;
      if (!user.publicSlug.startsWith('__preview__')) {
        this.clickableNodes.push(mesh);
      }

      group.add(mesh);
    });

    group.position.copy(position);

    return group;
  }

  private onClick = (event: MouseEvent) => {
    if (this.activeCard && event.target instanceof Node && this.activeCard.contains(event.target)) {
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.clickableNodes, true);

    for (let i = 0; i < intersects.length; i++) {
      const obj = intersects[i].object;

      if (obj.userData?.name) {
        this.showCard(obj);
        return;
      }
    }

    if (this.activeCard) {
      this.dismissCard();
    }
  };

  private dismissCard() {
    this.activeCard?.remove();
    this.activeCard = null;
    this.cardAnchorObject = null;
  }

  /** Viewport Y (px): max bottom edge of the card (above mini-player or viewport). */
  private getViewportBottomLimitY(): number {
    const margin = 16;
    const gapAboveMiniPlayer = 12;
    const mini = document.querySelector('.mini-player');
    if (mini) {
      return mini.getBoundingClientRect().top - gapAboveMiniPlayer;
    }
    const vv = window.visualViewport;
    const h = vv?.height ?? window.innerHeight;
    return h - margin;
  }

  private isMobile(): boolean {
    return window.innerWidth < 768;
  }

  private centerCard(card: HTMLElement) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = card.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const left = (vw - w) / 2;
    const top = (vh - h) / 2;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  /** Project cluster point to coordinates inside `uiLayer` (matches position:absolute). */
  private projectObjectToLayer(obj: THREE.Object3D): { x: number; y: number } {
    const worldPos = new THREE.Vector3();
    obj.getWorldPosition(worldPos);
    worldPos.project(this.camera);

    const canvas = this.renderer.domElement;
    const cRect = canvas.getBoundingClientRect();
    const layerRect = this.uiLayer.getBoundingClientRect();

    const xV = (worldPos.x * 0.5 + 0.5) * cRect.width + cRect.left;
    const yV = (-worldPos.y * 0.5 + 0.5) * cRect.height + cRect.top;

    return {
      x: xV - layerRect.left,
      y: yV - layerRect.top,
    };
  }

  /** Full layout: measure height, optional scroll, clamp so the card stays in the safe rect. */
  private layoutCard(card: HTMLElement, anchorX: number, anchorY: number) {
    const margin = 16;
    const layerRect = this.uiLayer.getBoundingClientRect();
    const bottomLimitViewport = this.getViewportBottomLimitY();
    const maxBottomLocal = bottomLimitViewport - layerRect.top;
    const minTopLocal = Math.max(0, margin - layerRect.top);
    const availableHeight = Math.max(120, maxBottomLocal - minTopLocal);

    card.style.maxHeight = '';
    card.style.minHeight = '';
    card.style.overflowY = '';

    let rect = card.getBoundingClientRect();
    let h = rect.height;
    const w = rect.width;

    if (h > availableHeight) {
      card.style.minHeight = '0';
      card.style.maxHeight = `${availableHeight}px`;
      card.style.overflowY = 'auto';
      rect = card.getBoundingClientRect();
      h = rect.height;
    }

    if (this.isMobile()) {
      this.centerCard(card);
    } else {
      this.positionCardAtAnchor(card, anchorX, anchorY, h, w);
    }
  }

  /**
   * Place card near projected point using layer + viewport bounds.
   * Pass h/w from a fresh measure; if omitted, reads from DOM (e.g. per-frame follow).
   */
  private positionCardAtAnchor(
    card: HTMLElement,
    anchorX: number,
    anchorY: number,
    h?: number,
    w?: number
  ) {
    const margin = 16;
    const layerRect = this.uiLayer.getBoundingClientRect();
    const bottomLimitViewport = this.getViewportBottomLimitY();
    const maxBottomLocal = bottomLimitViewport - layerRect.top;
    const minTopLocal = Math.max(0, margin - layerRect.top);
    const minLeftLocal = Math.max(0, margin - layerRect.left);
    const maxRightViewport = window.innerWidth - margin;

    const rect = card.getBoundingClientRect();
    const hh = h ?? rect.height;
    const ww = w ?? rect.width;

    const offsetX = 22;
    const offsetY = -90;

    let left = anchorX + offsetX;
    let top = anchorY + offsetY;

    const maxLeft = Math.min(layerRect.width - ww, maxRightViewport - layerRect.left - ww);
    left = THREE.MathUtils.clamp(left, minLeftLocal, Math.max(minLeftLocal, maxLeft));

    const maxTop = maxBottomLocal - hh;
    top = THREE.MathUtils.clamp(top, minTopLocal, Math.max(minTopLocal, maxTop));

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  private layoutCardFromObject() {
    if (!this.activeCard || !this.cardAnchorObject) return;
    const { x, y } = this.projectObjectToLayer(this.cardAnchorObject);
    this.layoutCard(this.activeCard, x, y);
  }

  /**
   * Same-origin relative URLs and absolute http(s)://localhost URLs must use the
   * current page origin so images work on phones (LAN IP) instead of resolving to device localhost.
   */
  private resolveHeaderImageUrl(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    try {
      const u = new URL(trimmed, window.location.href);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        return `${window.location.origin}${u.pathname}${u.search}${u.hash}`;
      }
      return u.href;
    } catch {
      return trimmed;
    }
  }

  /** Same profile URL shape as AudioPlayer `handleArtistProfileOpen` (`/?artist=`). */
  private buildArtistProfileHref(publicSlug: string): string {
    return `/?artist=${encodeURIComponent(publicSlug)}`;
  }

  private focusOnObject(obj: THREE.Object3D) {
    const pos = new THREE.Vector3();
    obj.getWorldPosition(pos);

    // Центрируемся по XY.
    this.targetX = pos.x;
    this.targetY = pos.y;

    // Корректируем глубину, чтобы камера мягко прилетала к объекту.
    const desiredZ = THREE.MathUtils.clamp(pos.z + 1.5, this.minCameraZ, this.maxCameraZ);
    this.targetZ = desiredZ;
  }

  private showCard(obj: THREE.Object3D) {
    this.focusOnObject(obj);
    if (this.activeCard) {
      this.dismissCard();
    }

    this.cardAnchorObject = obj;

    const data = obj.userData as Partial<SceneArtist>;
    const title = data.name ?? 'Unknown artist';
    const genreCode = data.genreCode ?? 'other';
    const langKey = document.documentElement.lang?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
    const label = data.genreLabel?.[langKey] ?? genreCode;
    const coverUrl =
      Array.isArray(data.headerImages) && data.headerImages.length > 0 ? data.headerImages[0] : '';

    const card = document.createElement('div');
    card.className = 'universe3d-card';
    card.style.visibility = 'hidden';
    card.innerHTML = `
      <button class="universe3d-card__close" type="button" aria-label="Close">×</button>
      <div class="universe3d-card__media" aria-hidden="true"></div>
      <div class="universe3d-card__body">
        <div class="universe3d-card__title"></div>
        <div class="universe3d-card__chips">
          <span class="universe3d-card__chip">${label}</span>
        </div>
      </div>
      <div class="universe3d-card__footer">
        <button class="universe3d-card__play" type="button">Play</button>
      </div>
    `;

    const titleSlot = card.querySelector('.universe3d-card__title');
    if (titleSlot) {
      const slug = typeof data.publicSlug === 'string' ? data.publicSlug.trim() : '';
      if (slug) {
        const link = document.createElement('a');
        link.className = 'universe3d-card__title';
        link.href = this.buildArtistProfileHref(slug);
        link.textContent = title;
        link.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onNavigateToArtist) {
            e.preventDefault();
            this.dismissCard();
            this.onNavigateToArtist(slug);
          } else {
            this.dismissCard();
          }
        });
        titleSlot.replaceWith(link);
      } else {
        titleSlot.textContent = title;
      }
    }

    const mediaEl = card.querySelector('.universe3d-card__media');
    if (mediaEl && coverUrl) {
      const img = document.createElement('img');
      img.className = 'universe3d-card__media-image';
      img.alt = title;
      img.loading = 'eager';
      img.decoding = 'async';
      img.src = this.resolveHeaderImageUrl(coverUrl);
      img.addEventListener('load', () => {
        if (this.activeCard !== card || !this.cardAnchorObject) return;
        this.layoutCardFromObject();
      });
      mediaEl.appendChild(img);
    }

    const closeButton = card.querySelector('.universe3d-card__close');
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dismissCard();
      });
    }

    const playButton = card.querySelector('.universe3d-card__play');
    if (playButton instanceof HTMLButtonElement) {
      playButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.onPlayArtist) return;
        const started = await this.onPlayArtist(data as SceneArtist);
        if (started) {
          this.dismissCard();
        }
      });
    }

    this.uiLayer.appendChild(card);
    this.activeCard = card;

    requestAnimationFrame(() => {
      if (this.activeCard !== card || !this.cardAnchorObject) return;
      this.layoutCardFromObject();
      card.style.visibility = '';
    });
  }

  private initControls() {
    window.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.handleTouchEnd);
    canvas.addEventListener('touchcancel', this.handleTouchCancel);
  }

  private isInteractionLocked() {
    return this.activeCard !== null;
  }

  private handleWheel = (e: WheelEvent) => {
    if (this.isInteractionLocked()) {
      e.preventDefault();
      return;
    }

    if (e.ctrlKey) {
      e.preventDefault();
    }

    e.preventDefault();

    const rect = this.renderer.domElement.getBoundingClientRect();

    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const ray = this.raycaster.ray;

    const zoomDelta = e.ctrlKey ? -e.deltaY * 0.004 : -e.deltaY * 0.002;
    const speed = 2.0;

    this.targetX += ray.direction.x * zoomDelta * speed;
    this.targetY += ray.direction.y * zoomDelta * speed;
    this.targetZ += ray.direction.z * zoomDelta * speed;

    this.targetZ = THREE.MathUtils.clamp(this.targetZ, this.minCameraZ, this.maxCameraZ);
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.isInteractionLocked()) return;
    this.isDragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private handleMouseUp = () => {
    this.isDragging = false;
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isDragging || this.isInteractionLocked()) return;

    const rawDx = e.clientX - this.lastPointerX;
    const rawDy = e.clientY - this.lastPointerY;
    const speed = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    const speedBoost = 1 + Math.min(speed * 0.01, 1.2);
    const z = THREE.MathUtils.clamp(this.camera.position.z, 0.3, 10);
    const depthFactor = THREE.MathUtils.clamp(Math.pow(z, 0.75), 0.5, 2.5);
    const dx = rawDx * 0.005 * depthFactor * speedBoost;
    const dy = rawDy * 0.005 * depthFactor * speedBoost;

    this.targetX -= dx;
    this.targetY += dy;

    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.lastPointerX = e.touches[0].clientX;
      this.lastPointerY = e.touches[0].clientY;
      this.lastMoveTime = performance.now();
      this.touchPanCommitted = false;
      this.touchHadPinch = false;
    }

    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      this.lastPinchCenterX = (t1.clientX + t2.clientX) / 2;
      this.lastPinchCenterY = (t1.clientY + t2.clientY) / 2;

      this.lastPinchDistance = 0;
      this.touchHadPinch = true;
      this.touchPanCommitted = false;
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 || e.touches.length === 2) {
      e.preventDefault();
    }

    if (this.isInteractionLocked()) {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const dxFromStart = t.clientX - this.touchStartX;
        const dyFromStart = t.clientY - this.touchStartY;
        if (Math.abs(dxFromStart) + Math.abs(dyFromStart) > TOUCH_MOVE_THRESHOLD_PX) {
          this.touchPanCommitted = true;
        }
      }
      return;
    }

    if (e.touches.length !== 2) {
      this.lastPinchDistance = 0;
      this.lastPinchCenterX = 0;
      this.lastPinchCenterY = 0;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const dxFromStart = t.clientX - this.touchStartX;
      const dyFromStart = t.clientY - this.touchStartY;

      if (
        !this.touchPanCommitted &&
        Math.abs(dxFromStart) + Math.abs(dyFromStart) > TOUCH_MOVE_THRESHOLD_PX
      ) {
        this.touchPanCommitted = true;
      }

      if (!this.touchPanCommitted) {
        this.lastPointerX = t.clientX;
        this.lastPointerY = t.clientY;
        return;
      }

      const rawDx = t.clientX - this.lastPointerX;
      const rawDy = t.clientY - this.lastPointerY;
      const speed = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
      const speedBoost = 1 + Math.min(speed * 0.01, 1.2);
      const z = THREE.MathUtils.clamp(this.camera.position.z, 0.3, 10);
      const depthFactor = THREE.MathUtils.clamp(Math.pow(z, 0.75), 0.5, 2.5);
      const dx = rawDx * 0.005 * depthFactor * speedBoost;
      const dy = rawDy * 0.005 * depthFactor * speedBoost;

      this.targetX -= dx;
      this.targetY += dy;

      this.lastPointerX = t.clientX;
      this.lastPointerY = t.clientY;
    }

    if (e.touches.length === 2) {
      this.touchHadPinch = true;
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      if (this.lastPinchDistance === 0) {
        this.lastPinchDistance = dist;
        this.lastPinchCenterX = centerX;
        this.lastPinchCenterY = centerY;
        return;
      }

      const moveX = centerX - this.lastPinchCenterX;
      const moveY = centerY - this.lastPinchCenterY;

      const panSpeed = 0.002;
      this.targetX -= moveX * panSpeed;
      this.targetY += moveY * panSpeed;

      const rect = this.renderer.domElement.getBoundingClientRect();

      this.mouse.x = ((centerX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((centerY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const ray = this.raycaster.ray;

      const delta = dist - this.lastPinchDistance;

      const speed = 0.02;

      this.targetX += ray.direction.x * delta * speed;
      this.targetY += ray.direction.y * delta * speed;
      this.targetZ += ray.direction.z * delta * speed;

      this.targetZ = THREE.MathUtils.clamp(this.targetZ, this.minCameraZ, this.maxCameraZ);

      this.lastPinchCenterX = centerX;
      this.lastPinchCenterY = centerY;
      this.lastPinchDistance = dist;
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      this.lastPinchDistance = 0;
      this.lastPinchCenterX = 0;
      this.lastPinchCenterY = 0;
    }
    if (e.touches.length === 1) {
      const tr = e.touches[0];
      this.lastPointerX = tr.clientX;
      this.lastPointerY = tr.clientY;
      this.touchStartX = tr.clientX;
      this.touchStartY = tr.clientY;
      this.touchPanCommitted = false;
    }
    const t = e.changedTouches[0];
    if (!t) {
      if (e.touches.length === 0) {
        this.resetTouchGestureState();
      }
      return;
    }

    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;
    const moved = Math.abs(dx) + Math.abs(dy);

    const allFingersUp = e.touches.length === 0;

    const isTap =
      allFingersUp &&
      !this.touchPanCommitted &&
      !this.touchHadPinch &&
      moved <= TOUCH_MOVE_THRESHOLD_PX;

    if (isTap) {
      this.performCanvasTouchTap(t.clientX, t.clientY);
    }

    if (allFingersUp) {
      this.resetTouchGestureState();
    }
  };

  private handleTouchCancel = () => {
    this.resetTouchGestureState();
  };

  private resetTouchGestureState() {
    this.touchPanCommitted = false;
    this.touchHadPinch = false;
    this.lastPinchDistance = 0;
    this.lastPinchCenterX = 0;
    this.lastPinchCenterY = 0;
  }

  /** Raycast tap on canvas (mobile); ignores if tap is on the artist card overlay. */
  private performCanvasTouchTap(clientX: number, clientY: number) {
    const topEl = document.elementFromPoint(clientX, clientY);
    if (this.activeCard && topEl && this.activeCard.contains(topEl)) {
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();

    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.clickableNodes, true);

    for (let i = 0; i < intersects.length; i++) {
      const obj = intersects[i].object;

      if (obj.userData?.name) {
        this.showCard(obj);
        return;
      }
    }

    this.dismissCard();
  }

  private noise2D(x: number, y: number) {
    return Math.sin(x * 2.1 + y * 3.7) * 0.5 + 0.5;
  }

  private fbm(x: number, y: number) {
    let value = 0;
    let amp = 0.5;

    for (let i = 0; i < 4; i++) {
      value += amp * this.noise2D(x, y);
      x *= 2;
      y *= 2;
      amp *= 0.5;
    }

    return value;
  }

  private shouldUpdateLabelVisibility(): boolean {
    const { x, y, z } = this.camera.position;
    const thresholdXY = 0.01;
    const thresholdZ = 0.01;

    const dx = Math.abs(x - this.lastLabelUpdateCameraX);
    const dy = Math.abs(y - this.lastLabelUpdateCameraY);
    const dz = Math.abs(z - this.lastLabelUpdateCameraZ);

    const hasMeaningfulChange =
      Number.isNaN(this.lastLabelUpdateCameraX) ||
      dx >= thresholdXY ||
      dy >= thresholdXY ||
      dz >= thresholdZ;

    if (!hasMeaningfulChange) {
      return false;
    }

    this.lastLabelUpdateCameraX = x;
    this.lastLabelUpdateCameraY = y;
    this.lastLabelUpdateCameraZ = z;
    return true;
  }

  private animate = () => {
    const t = this.clock.getElapsedTime();
    if (this.isHeroPreview) {
      this.heroTime += 0.01;
    }

    // обновление шейдеров облака
    this.cloudGroups.forEach((cloud) => {
      cloud.children.forEach((layer: any, i) => {
        if (layer.material?.uniforms?.u_time) {
          layer.material.uniforms.u_time.value = t + i * 5;
        }
      });
    });

    const targetPosition = this.tempVec3.set(this.targetX, this.targetY, this.targetZ);
    const dist = this.camera.position.distanceTo(targetPosition);
    const speed = THREE.MathUtils.clamp(dist * 0.1, 0.04, 0.12);
    this.camera.position.lerp(targetPosition, speed);

    const isMoving =
      Math.abs(this.targetX - this.camera.position.x) > 0.001 ||
      Math.abs(this.targetY - this.camera.position.y) > 0.001 ||
      Math.abs(this.targetZ - this.camera.position.z) > 0.001;

    if (this.shouldUpdateLabelVisibility() || isMoving) {
      // ЛОГИКА ВИДИМОСТИ (главное)
      const temp = this.tempVec3;

      this.clickableNodes.forEach((mesh) => {
        mesh.getWorldPosition(temp);
        const distance = this.camera.position.distanceTo(temp);

        const fadeStart = 4;
        const fadeEnd = 1.2;
        const createLabelDistance = 3;

        const t = THREE.MathUtils.clamp((fadeStart - distance) / (fadeStart - fadeEnd), 0, 1);

        let sprite = (mesh.userData?.label as THREE.Sprite | null) ?? null;
        const FADE_SPEED = 0.04;
        const REMOVE_THRESHOLD = 0.02;
        if (distance < createLabelDistance) {
          if (!sprite) {
            const user = mesh.userData as SceneArtist;
            sprite = this.createArtistLabelSprite(user.name);
            this.scene.add(sprite);
            mesh.userData.label = sprite;
          }
          sprite.position.set(temp.x, temp.y + 0.1, temp.z);
          const material = sprite.material as THREE.SpriteMaterial;
          material.opacity += (t - material.opacity) * FADE_SPEED;
          sprite.visible = t > 0.01;
        } else if (sprite) {
          const material = sprite.material as THREE.SpriteMaterial;
          material.opacity += (0 - material.opacity) * FADE_SPEED;
          sprite.visible = material.opacity > 0.01;

          if (material.opacity < REMOVE_THRESHOLD) {
            this.disposeArtistLabelSprite(sprite);
            mesh.userData.label = null;
            sprite = null;
          }
        }

        // масштаб точки (приятный эффект)
        const scale = 0.05 + t * 0.15;
        mesh.scale.setScalar(scale);
      });

      this.clusterLabels.forEach(({ sprite, center }) => {
        const distance = this.camera.position.distanceTo(center);
        const fadeStart = 5;
        const fadeEnd = 3;
        const t = THREE.MathUtils.clamp((fadeStart - distance) / (fadeStart - fadeEnd), 0, 1);
        const material = sprite.material as THREE.SpriteMaterial;
        material.opacity = t;
        sprite.visible = t > 0.01;

        const minScale = 2.5;
        const maxScale = 6;
        const scaleT = THREE.MathUtils.clamp((6 - distance) / 4, 0, 1);
        const scale = minScale + (maxScale - minScale) * scaleT;
        sprite.scale.set(scale, scale * 0.25, 1);
      });
    }

    if (this.isHeroPreview) {
      this.scene.traverse((obj) => {
        if (obj.userData?.isHeroCloud) {
          const baseScale = 1.8;
          const breath = 1 + Math.sin(this.heroTime) * 0.04;
          obj.scale.setScalar(baseScale * breath);
        }
      });
    }

    // рендер
    this.renderer.render(this.scene, this.camera);

    // обновление карточки
    if (this.activeCard) {
      if (this.isMobile()) {
        this.centerCard(this.activeCard);
      } else if (this.cardAnchorObject) {
        const { x, y } = this.projectObjectToLayer(this.cardAnchorObject);
        this.positionCardAtAnchor(this.activeCard, x, y);
      }
    }

    this.animationId = requestAnimationFrame(this.animate);
  };

  private onResize = () => {
    if (this.useContainerSize) {
      const w = Math.max(1, this.containerEl.clientWidth);
      const h = Math.max(1, this.containerEl.clientHeight);
      this.camera.aspect = w / h;
      this.renderer.setSize(w, h);
    } else {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    this.camera.updateProjectionMatrix();
    if (this.activeCard && this.cardAnchorObject) {
      this.layoutCardFromObject();
    }
  };

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    if (this.attachedWindowClick) {
      window.removeEventListener('click', this.onClick);
    }
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('touchstart', this.handleTouchStart);
    canvas.removeEventListener('touchmove', this.handleTouchMove);
    canvas.removeEventListener('touchend', this.handleTouchEnd);
    canvas.removeEventListener('touchcancel', this.handleTouchCancel);
    this.clickableNodes.forEach((mesh) => {
      const sprite = (mesh.userData?.label as THREE.Sprite | null) ?? null;
      if (!sprite) return;
      this.disposeArtistLabelSprite(sprite);
      mesh.userData.label = null;
    });
    this.dismissCard();
    this.uiLayer?.remove();
    this.renderer.dispose();
  }
}
