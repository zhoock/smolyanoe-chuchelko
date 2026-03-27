import * as THREE from 'three';

export type SceneArtist = {
  name: string;
  publicSlug: string;
  genre: string;
  mood: string;
  headerImages?: string[];
};

type ClusterConfig = {
  genre: string;
  center: THREE.Vector3;
  color: THREE.Color;
  artists: SceneArtist[];
};

export class Universe3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private cloudGroups: THREE.Group[] = [];

  private clock = new THREE.Clock();
  private animationId: number | null = null;

  private targetZ = 2;

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private clickableNodes: THREE.Object3D[] = [];
  private uiLayer!: HTMLElement;
  private activeCard: HTMLElement | null = null;
  private onPlayArtist?: (artist: SceneArtist) => boolean | Promise<boolean>;

  constructor(
    container: HTMLElement,
    artists: SceneArtist[] = [],
    options?: { onPlayArtist?: (artist: SceneArtist) => boolean | Promise<boolean> }
  ) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    const ui = document.createElement('div');
    ui.className = 'universe3d-ui-layer';
    container.appendChild(ui);
    this.uiLayer = ui;
    this.onPlayArtist = options?.onPlayArtist;

    const clusters = this.buildClusters(artists);
    this.cloudGroups = clusters.map((cluster) =>
      this.createCloud(cluster.color, cluster.center, cluster.artists)
    );
    this.cloudGroups.forEach((group) => this.scene.add(group));

    this.initControls();

    window.addEventListener('click', this.onClick);
    window.addEventListener('resize', this.onResize);

    this.animate();
  }

  private buildClusters(artists: SceneArtist[]): ClusterConfig[] {
    const grouped = new Map<string, SceneArtist[]>();

    artists.forEach((artist) => {
      const genre = (artist.genre || 'other').trim() || 'other';
      const bucket = grouped.get(genre) ?? [];
      bucket.push(artist);
      grouped.set(genre, bucket);
    });

    const genres = Array.from(grouped.keys());
    const count = genres.length || 1;
    const radius = count === 1 ? 0 : 2.2;
    const palette = [0x4d80ff, 0xff8a47, 0x53d8a2, 0xb086ff, 0xf2cd5d, 0x5ec9f5];

    return genres.map((genre, index) => {
      const angle = (index / count) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.6;

      return {
        genre,
        center: new THREE.Vector3(x, y, 0),
        color: new THREE.Color(palette[index % palette.length]),
        artists: grouped.get(genre) ?? [],
      };
    });
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

          float d = length(uv + warp);
          float shape = smoothstep(1.2, 0.2, d);
          float edgeFade = 1.0 - smoothstep(0.35, 0.75, length(vUv - 0.5));
          shape *= edgeFade;

          vec2 flow = uv * 2.0;
          flow += vec2(u_time * 0.03, u_time * 0.02);

          float n = fbm(flow);

          float density = shape * n;
          density += shape * 0.25;

          vec3 color = u_color * density;

          gl_FragColor = vec4(color, density * 0.6);
        }
      `,
    });
  }

  private createCloud(color: THREE.Color, position: THREE.Vector3, users: SceneArtist[]) {
    const group = new THREE.Group();

    const geometry = new THREE.PlaneGeometry(3, 3);

    for (let i = 0; i < 5; i++) {
      const material = this.createMaterial(color, i * 5);
      const layer = new THREE.Mesh(geometry, material);

      layer.position.z = -i * 0.5;
      layer.position.x = (Math.random() - 0.5) * 0.3;
      layer.position.y = (Math.random() - 0.5) * 0.3;

      group.add(layer);
    }

    // 🔥 ГЛУБИНА ГРУПП (аккуратно)
    users.forEach((user) => {
      const geo = new THREE.SphereGeometry(0.05, 16, 16);

      const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9,
      });

      const mesh = new THREE.Mesh(geo, mat);

      const z = (Math.random() - 0.5) * 2; // 🔥 глубина

      mesh.position.set((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, z);
      const scale = 0.05 + (1 - (z + 1) / 2) * 0.1;
      mesh.scale.setScalar(scale);

      mesh.userData = user;
      this.clickableNodes.push(mesh);

      group.add(mesh);

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;

      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText(user.name, 10, 40);

      const texture = new THREE.CanvasTexture(canvas);

      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
        })
      );
      (sprite.material as THREE.SpriteMaterial).opacity = 0.8;

      sprite.scale.set(0.6, 0.15, 1);
      sprite.position.copy(mesh.position).add(new THREE.Vector3(0, 0.1, 0));

      group.add(sprite);
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
      this.activeCard.remove();
      this.activeCard = null;
    }
  };

  private showCard(obj: THREE.Object3D) {
    if (this.activeCard) {
      this.activeCard.remove();
      this.activeCard = null;
    }

    const worldPos = new THREE.Vector3();
    obj.getWorldPosition(worldPos);
    worldPos.project(this.camera);

    const anchorX = (worldPos.x * 0.5 + 0.5) * window.innerWidth;
    const anchorY = (-worldPos.y * 0.5 + 0.5) * window.innerHeight;

    const cardWidth = 320;
    const cardHeight = 400;
    const margin = 16;

    const left = Math.min(Math.max(anchorX + 22, margin), window.innerWidth - cardWidth - margin);
    const top = Math.min(Math.max(anchorY - 90, margin), window.innerHeight - cardHeight - margin);

    const data = obj.userData as Partial<SceneArtist>;
    const title = data.name ?? 'Unknown artist';
    const genre = data.genre ?? 'other';
    const mood = data.mood ?? 'melancholic';
    const coverUrl =
      Array.isArray(data.headerImages) && data.headerImages.length > 0 ? data.headerImages[0] : '';

    const card = document.createElement('div');
    card.className = 'universe3d-card';
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.innerHTML = `
      <button class="universe3d-card__close" type="button" aria-label="Close">×</button>
      <div class="universe3d-card__media" aria-hidden="true">
        ${coverUrl ? `<img class="universe3d-card__media-image" src="${coverUrl}" alt="${title}" />` : ''}
      </div>
      <div class="universe3d-card__body">
        <div class="universe3d-card__title">${title}</div>
        <div class="universe3d-card__chips">
          <span class="universe3d-card__chip">${genre}</span>
          <span class="universe3d-card__chip">${mood}</span>
        </div>
      </div>
      <div class="universe3d-card__footer">
        <button class="universe3d-card__play" type="button">Play</button>
      </div>
    `;

    const closeButton = card.querySelector('.universe3d-card__close');
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.activeCard?.remove();
        this.activeCard = null;
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
          this.activeCard?.remove();
          this.activeCard = null;
        }
      });
    }

    this.uiLayer.appendChild(card);
    this.activeCard = card;
  }

  private initControls() {
    const isInteractionLocked = () => this.activeCard !== null;

    // zoom (мышь)
    window.addEventListener(
      'wheel',
      (e) => {
        if (isInteractionLocked()) {
          e.preventDefault();
          return;
        }
        this.targetZ += e.deltaY * 0.002;
        this.targetZ = THREE.MathUtils.clamp(this.targetZ, 0.5, 6);
      },
      { passive: false }
    );

    // drag
    let isDown = false;
    let lastX = 0;
    let lastY = 0;

    window.addEventListener('mousedown', (e) => {
      if (isInteractionLocked()) return;
      isDown = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      isDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDown || isInteractionLocked()) return;

      const dx = (e.clientX - lastX) * 0.005;
      const dy = (e.clientY - lastY) * 0.005;

      this.camera.position.x -= dx;
      this.camera.position.y += dy;

      lastX = e.clientX;
      lastY = e.clientY;
    });

    // 🔥 multitouch zoom
    let lastDist = 0;

    window.addEventListener(
      'touchmove',
      (e) => {
        if (isInteractionLocked()) {
          e.preventDefault();
          return;
        }

        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (lastDist) {
            const delta = dist - lastDist;
            this.targetZ -= delta * 0.01;
            this.targetZ = THREE.MathUtils.clamp(this.targetZ, 0.5, 6);
          }

          lastDist = dist;
        }
      },
      { passive: false }
    );

    window.addEventListener('touchend', () => {
      lastDist = 0;
    });
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

  private animate = () => {
    const t = this.clock.getElapsedTime();

    const updateCloud = (cloud: THREE.Group) => {
      cloud.children.forEach((layer: any, i) => {
        if (layer.material?.uniforms?.u_time) {
          layer.material.uniforms.u_time.value = t + i * 5;
        }
      });
    };

    this.cloudGroups.forEach((group) => updateCloud(group));

    this.camera.position.z += (this.targetZ - this.camera.position.z) * 0.05;
    const temp = new THREE.Vector3();

    this.scene.traverse((obj: any) => {
      if (obj.userData?.name) {
        const worldPos = obj.getWorldPosition(temp);

        const smoke = this.fbm(
          worldPos.x * 0.8 + this.clock.elapsedTime * 0.03,
          worldPos.y * 0.8 + this.clock.elapsedTime * 0.02
        );

        const smokeFade = THREE.MathUtils.clamp(1.0 - smoke * 1.3, 0.0, 1);

        const distance = this.camera.position.distanceTo(worldPos);
        const distFade = THREE.MathUtils.clamp(1.5 / distance, 0.5, 1);

        const proximity = THREE.MathUtils.clamp(1.5 / distance, 0, 1);
        const smokeInfluence = THREE.MathUtils.lerp(smokeFade, 1.0, proximity);
        const final = smokeInfluence * distFade;

        obj.material.opacity = distFade;
        obj.scale.setScalar(0.05 + final * 0.15);
      }

      if (obj.type === 'Sprite') {
        const worldPos = obj.getWorldPosition(temp);

        const smoke = this.fbm(
          worldPos.x * 0.8 + this.clock.elapsedTime * 0.03,
          worldPos.y * 0.8 + this.clock.elapsedTime * 0.02
        );

        const smokeFade = THREE.MathUtils.clamp(1.0 - smoke * 1.3, 0.0, 1);

        const distance = this.camera.position.distanceTo(worldPos);
        const distFade = THREE.MathUtils.clamp(1.2 / distance, 0.3, 1);

        obj.material.opacity = distFade;
      }
    });

    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.animate);
  };

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('click', this.onClick);
    this.activeCard?.remove();
    this.uiLayer?.remove();
    this.renderer.dispose();
  }
}
