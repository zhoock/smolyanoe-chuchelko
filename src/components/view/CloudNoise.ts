const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_coldCenter;
uniform vec2 u_warmCenter;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(a, b, u.x) +
         (c - a) * u.y * (1.0 - u.x) +
         (d - b) * u.x * u.y;
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

float blob(vec2 uv, vec2 center, float radius) {
  return smoothstep(radius, 0.0, distance(uv, center));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 centerCold = u_coldCenter;
  vec2 centerWarm = u_warmCenter;
  vec2 drift = vec2(
    sin(u_time * 0.1),
    cos(u_time * 0.1)
  ) * 0.01;

  centerCold += drift;
  centerWarm -= drift;

  float cloudCold = 0.0;
  cloudCold += blob(uv, centerCold + vec2(0.05, 0.02), 0.25);
  cloudCold += blob(uv, centerCold + vec2(-0.04, -0.03), 0.2);
  cloudCold += blob(uv, centerCold + vec2(0.02, -0.05), 0.18);
  cloudCold += blob(uv, centerCold + vec2(-0.03, 0.04), 0.22);
  cloudCold /= 4.0;

  float cloudWarm = 0.0;
  cloudWarm += blob(uv, centerWarm + vec2(0.06, 0.03), 0.25);
  cloudWarm += blob(uv, centerWarm + vec2(-0.05, -0.02), 0.2);
  cloudWarm += blob(uv, centerWarm + vec2(0.03, -0.06), 0.18);
  cloudWarm += blob(uv, centerWarm + vec2(-0.02, 0.05), 0.22);
  cloudWarm /= 4.0;

  vec2 flow = vec2(
    sin(u_time * 0.2),
    cos(u_time * 0.15)
  ) * 0.2;
  float noiseCold = fbm(uv * 6.0 + flow);
  float noiseWarm = fbm(uv * 6.0 + vec2(10.0) + flow);

  cloudCold *= 0.4 + noiseCold * 0.9;
  cloudWarm *= 0.4 + noiseWarm * 0.9;
  cloudCold *= smoothstep(0.2, 0.8, noiseCold);
  cloudWarm *= smoothstep(0.2, 0.8, noiseWarm);

  float coreCold = smoothstep(0.25, 0.0, distance(uv, centerCold));
  float coreWarm = smoothstep(0.25, 0.0, distance(uv, centerWarm));
  cloudCold += coreCold * 0.4;
  cloudWarm += coreWarm * 0.4;

  vec3 color = vec3(0.0);
  color += cloudCold * vec3(0.2, 0.3, 0.7);
  color += cloudWarm * vec3(0.7, 0.4, 0.2);

  float alpha = cloudCold + cloudWarm;
  gl_FragColor = vec4(color, alpha * 0.5);
}
`;

export class CloudNoise {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private positionBuffer: WebGLBuffer;
  private positionLocation: number;
  private timeLocation: WebGLUniformLocation;
  private resolutionLocation: WebGLUniformLocation;
  private coldCenterLocation: WebGLUniformLocation;
  private warmCenterLocation: WebGLUniformLocation;
  private animationId: number | null = null;
  private elapsedTime = 0;
  private lastFrameTs = 0;
  private smoothCold = { x: 0, y: 0 };
  private smoothWarm = { x: 0, y: 0 };
  private centersInitialized = false;
  private getClusterCenters?: () => {
    cold: { x: number; y: number };
    warm: { x: number; y: number };
  };

  constructor(
    container: HTMLElement,
    getClusterCenters?: () => {
      cold: { x: number; y: number };
      warm: { x: number; y: number };
    }
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '0';
    this.canvas.style.pointerEvents = 'none';
    container.appendChild(this.canvas);

    const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
    if (!gl) {
      throw new Error('WebGL is not supported');
    }
    this.gl = gl;
    this.getClusterCenters = getClusterCenters;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    this.program = this.createProgram(vertexShader, fragmentShader);

    this.positionBuffer = gl.createBuffer() as WebGLBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    this.positionLocation = gl.getAttribLocation(this.program, 'a_position');

    const timeLocation = gl.getUniformLocation(this.program, 'u_time');
    const resolutionLocation = gl.getUniformLocation(this.program, 'u_resolution');
    const coldCenterLocation = gl.getUniformLocation(this.program, 'u_coldCenter');
    const warmCenterLocation = gl.getUniformLocation(this.program, 'u_warmCenter');
    if (!timeLocation || !resolutionLocation || !coldCenterLocation || !warmCenterLocation) {
      throw new Error('Failed to get shader uniform locations');
    }
    this.timeLocation = timeLocation;
    this.resolutionLocation = resolutionLocation;
    this.coldCenterLocation = coldCenterLocation;
    this.warmCenterLocation = warmCenterLocation;

    this.resize();
    window.addEventListener('resize', this.resize);
    this.animate();
  }

  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info}`);
    }

    return shader;
  }

  private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const program = this.gl.createProgram();
    if (!program) {
      throw new Error('Failed to create program');
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(`Program link error: ${info}`);
    }

    return program;
  }

  private resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(window.innerWidth * dpr));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr));

    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  };

  private animate = (ts = performance.now()) => {
    const deltaSec = this.lastFrameTs ? (ts - this.lastFrameTs) / 1000 : 0;
    this.lastFrameTs = ts;
    this.elapsedTime += deltaSec;

    this.render();
    this.animationId = requestAnimationFrame(this.animate);
  };

  private render() {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(this.timeLocation, this.elapsedTime);
    gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
    const clusterCenters = this.getClusterCenters?.() ?? {
      cold: { x: this.canvas.clientWidth * 0.3, y: this.canvas.clientHeight * 0.3 },
      warm: { x: this.canvas.clientWidth * 0.7, y: this.canvas.clientHeight * 0.6 },
    };
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const targetCold = { x: clusterCenters.cold.x / width, y: 1 - clusterCenters.cold.y / height };
    const targetWarm = { x: clusterCenters.warm.x / width, y: 1 - clusterCenters.warm.y / height };
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    if (!this.centersInitialized) {
      this.smoothCold.x = targetCold.x;
      this.smoothCold.y = targetCold.y;
      this.smoothWarm.x = targetWarm.x;
      this.smoothWarm.y = targetWarm.y;
      this.centersInitialized = true;
    }

    this.smoothCold.x = lerp(this.smoothCold.x, targetCold.x, 0.03);
    this.smoothCold.y = lerp(this.smoothCold.y, targetCold.y, 0.03);
    this.smoothWarm.x = lerp(this.smoothWarm.x, targetWarm.x, 0.03);
    this.smoothWarm.y = lerp(this.smoothWarm.y, targetWarm.y, 0.03);

    gl.uniform2f(this.coldCenterLocation, this.smoothCold.x, this.smoothCold.y);
    gl.uniform2f(this.warmCenterLocation, this.smoothWarm.x, this.smoothWarm.y);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.resize);
    this.canvas.remove();
  }
}
