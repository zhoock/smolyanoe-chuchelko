type CloudNode = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  name: string;
  artistId: string;
  genre: 'cold' | 'warm';
  alpha: number;
  targetX: number;
  targetY: number;
  delay: number;
};

export class CloudCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nodes: CloudNode[] = [];
  private animationId: number | null = null;
  private onSelect?: (artistId: string) => void;

  private hoveredNode: CloudNode | null = null;
  private mouseX = 0;
  private mouseY = 0;

  private selectedGenre: 'cold' | 'warm' | null = null;
  private scale = 1;

  private clusters = {
    cold: { x: 0, y: 0 },
    warm: { x: 0, y: 0 },
  };

  getClusterCenters() {
    return {
      cold: {
        x: this.clusters.cold.x * this.scale,
        y: this.clusters.cold.y * this.scale,
      },
      warm: {
        x: this.clusters.warm.x * this.scale,
        y: this.clusters.warm.y * this.scale,
      },
    };
  }

  constructor(container: HTMLElement, onSelect?: (artistId: string) => void) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.onSelect = onSelect;

    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '1';

    container.appendChild(this.canvas);

    this.resize();
    window.addEventListener('resize', this.resize);
    this.canvas.addEventListener('click', this.handleClick);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);

    this.initNodes();
    this.animate();
  }

  private resize = () => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    this.clusters.cold = {
      x: this.canvas.width * 0.3,
      y: this.canvas.height * 0.3,
    };

    this.clusters.warm = {
      x: this.canvas.width * 0.7,
      y: this.canvas.height * 0.6,
    };
  };

  private initNodes() {
    const artists = [
      { id: '1', name: 'FogRoom', genre: 'cold' as const },
      { id: '2', name: 'GreyWaters', genre: 'cold' as const },
      { id: '3', name: 'SunTape', genre: 'warm' as const },
      { id: '4', name: 'Soft Rain', genre: 'warm' as const },
    ];

    this.nodes = artists.map((artist) => {
      const cluster = this.clusters[artist.genre];
      const targetX = cluster.x + (Math.random() - 0.5) * 100;
      const targetY = cluster.y + (Math.random() - 0.5) * 100;

      return {
        x: targetX + (Math.random() - 0.5) * 200,
        y: targetY + (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
        radius: 6,
        name: artist.name,
        artistId: artist.id,
        genre: artist.genre,
        alpha: 0,
        targetX,
        targetY,
        delay: Math.random() * 60,
      };
    });
  }

  private handleClick = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const clickedNode = this.nodes.find((node) => {
      const dx = mouseX - node.x;
      const dy = mouseY - node.y;
      return Math.sqrt(dx * dx + dy * dy) < node.radius + 5;
    });

    if (clickedNode) {
      this.selectedGenre = clickedNode.genre;
      this.onSelect?.(clickedNode.artistId);
    } else {
      this.selectedGenre = null;
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;

    this.hoveredNode =
      this.nodes.find((node) => {
        const dx = this.mouseX - node.x;
        const dy = this.mouseY - node.y;
        return Math.sqrt(dx * dx + dy * dy) < node.radius + 10;
      }) || null;
  };

  private animate = () => {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.update();

    this.ctx.save();
    this.ctx.scale(this.scale, this.scale);

    this.drawConnections();
    this.draw();
    this.drawLabels();

    this.ctx.restore();

    this.animationId = requestAnimationFrame(this.animate);
  };

  private update() {
    const targetScale = this.selectedGenre ? 1.05 : 1;
    this.scale += (targetScale - this.scale) * 0.05;

    this.nodes.forEach((node) => {
      if (node.delay > 0) {
        node.delay--;
        return;
      }

      node.x += (node.targetX - node.x) * 0.05;
      node.y += (node.targetY - node.y) * 0.05;
      node.alpha += (1 - node.alpha) * 0.05;

      const cluster = this.clusters[node.genre];
      node.vx += (cluster.x - node.x) * 0.001;
      node.vy += (cluster.y - node.y) * 0.001;

      node.vx += (Math.random() - 0.5) * 0.002;
      node.vy += (Math.random() - 0.5) * 0.002;

      node.x += node.vx;
      node.y += node.vy;

      node.vx *= 0.98;
      node.vy *= 0.98;
    });
  }

  private drawConnections() {
    const maxDistance = 200;

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDistance) {
          const opacity = 1 - dist / maxDistance;
          const isHovered = a === this.hoveredNode || b === this.hoveredNode;

          this.ctx.beginPath();
          this.ctx.moveTo(a.x, a.y);
          this.ctx.lineTo(b.x, b.y);

          this.ctx.strokeStyle = isHovered
            ? `rgba(255, 220, 120, ${opacity})`
            : `rgba(255, 180, 80, ${opacity * 0.4})`;

          this.ctx.stroke();
        }
      }
    }
  }

  private drawLabels() {
    this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
    this.ctx.font = '20px sans-serif';

    this.ctx.fillText('COLD GRUNGE', this.clusters.cold.x - 60, this.clusters.cold.y - 120);
    this.ctx.fillText('WARM GRUNGE', this.clusters.warm.x - 60, this.clusters.warm.y - 120);
  }

  private draw() {
    this.nodes.forEach((node) => {
      const isHovered = node === this.hoveredNode;
      const isDimmed = !!this.selectedGenre && node.genre !== this.selectedGenre;

      const radius = isHovered ? node.radius * 1.8 : node.radius;

      this.ctx.beginPath();

      this.ctx.shadowBlur = isHovered ? 40 : 15;
      this.ctx.shadowColor = node.genre === 'cold' ? '#66aaff' : '#ffcc66';

      this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

      const baseColor =
        node.genre === 'cold' ? 'rgba(120, 180, 255, 0.9)' : 'rgba(255, 180, 80, 0.9)';

      this.ctx.globalAlpha = node.alpha;
      this.ctx.fillStyle = isDimmed ? 'rgba(100, 100, 100, 0.2)' : baseColor;
      this.ctx.fill();
      this.ctx.globalAlpha = 1;

      this.ctx.shadowBlur = 0;

      if (isHovered) {
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(node.name, node.x + 12, node.y + 5);
      }
    });
  }

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resize);
  }
}
