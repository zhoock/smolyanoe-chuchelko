// src/audio/stemsEngine.ts
export type StemKind = 'drums' | 'bass' | 'guitar' | 'vocal';
type StemMap = Partial<Record<StemKind, string>>;

type Nodes = {
  buffer: AudioBuffer;
  source: AudioBufferSourceNode | null;
  gain: GainNode;
};

export class StemEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private nodes = new Map<StemKind, Nodes>();
  private startAt = 0; // момент запуска в time аудиоконтекста
  private startOffset = 0; // смещение (сек) от начала буфера
  private playing = false;

  constructor(
    private stems: StemMap,
    ctx?: AudioContext
  ) {
    this.ctx =
      ctx ??
      new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive',
      });
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.ctx.destination);
  }

  /** Разрешить аудио на iOS/мобилках (вызвать на первом клике пользователя) */
  async unlock() {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  /** Предзагрузка и декодирование всех stem’ов; progress(0..1) — опциональный колбэк */
  async loadAll(progress?: (p: number) => void) {
    const entries = Object.entries(this.stems) as [StemKind, string][];
    let done = 0;
    const total = entries.length;

    const oneDone = () => {
      done += 1;
      progress?.(Math.min(1, done / total));
    };

    await Promise.all(
      entries.map(async ([kind, url]) => {
        const resp = await fetch(url!, { cache: 'force-cache' });
        const buf = await resp.arrayBuffer();
        const audio = await this.ctx.decodeAudioData(buf);
        const gain = this.ctx.createGain();
        gain.connect(this.masterGain);
        this.nodes.set(kind, { buffer: audio, source: null, gain });
        oneDone();
      })
    );
  }

  /** Длительность (берём из первого буфера) */
  get duration(): number {
    const first = this.nodes.values().next().value as Nodes | undefined;
    return first?.buffer.duration ?? 0;
  }
  getDuration() {
    return this.duration;
  }

  /** Текущее время воспроизведения по единому таймкоду контекста */
  get currentTime(): number {
    return this.playing
      ? Math.max(0, this.ctx.currentTime - this.startAt + this.startOffset)
      : this.startOffset;
  }
  getCurrentTime() {
    return this.currentTime;
  }

  get isPlaying() {
    return this.playing;
  }

  /** Мьют/анмьют отдельного stem’а */
  setMuted(kind: StemKind, muted: boolean) {
    const n = this.nodes.get(kind);
    if (n) n.gain.gain.value = muted ? 0 : 1;
  }

  /** Запуск синхронно с общего такта */
  async play(from?: number) {
    await this.unlock();
    if (typeof from === 'number') {
      this.startOffset = Math.max(0, Math.min(from, this.duration));
    }
    this.stopInternal(false);

    const when = this.ctx.currentTime + 0.05; // небольшой lookahead
    this.startAt = when;
    const offset = this.startOffset;

    for (const n of this.nodes.values()) {
      const src = this.ctx.createBufferSource();
      src.buffer = n.buffer;
      src.connect(n.gain);
      src.start(when, offset);
      n.source = src;

      src.onended = () => {
        // если действительно дошли до конца — стопаем всё
        const nearEnd = this.currentTime + 0.02 >= this.duration;
        if (this.playing && nearEnd) this.stop();
      };
    }
    this.playing = true;
  }

  /** Пауза (идеально синхронная) */
  async pause() {
    if (!this.playing) return;
    this.startOffset = this.currentTime;
    await this.ctx.suspend();
    this.playing = false;
  }

  /** Возобновление после pause() */
  async resume() {
    if (this.playing) return;
    await this.ctx.resume();
    await this.play(this.startOffset);
  }

  /** Полный стоп (сброс в 0) */
  stop() {
    this.stopInternal(true);
  }

  private stopInternal(resetOffset: boolean) {
    for (const n of this.nodes.values()) {
      try {
        n.source?.stop();
      } catch (e) {
        console.warn('Error stopping source', e);
      }
      try {
        n.source?.disconnect();
      } catch (e) {
        console.warn('Error disconnecting source', e);
      }
      n.source = null;
    }
    if (resetOffset) this.startOffset = 0;
    this.playing = false;
  }

  /** Скраббинг/перемотка: мгновенный переход */
  async seek(timeSec: number) {
    this.startOffset = Math.max(0, Math.min(timeSec, this.duration));
    if (this.playing) {
      await this.play(this.startOffset); // пересоздаём источники и стартуем в такт
    }
  }

  /** Освобождение ресурсов */
  dispose() {
    this.stopInternal(true);
    try {
      this.masterGain.disconnect();
    } catch (e) {
      console.warn('Error disconnecting master gain', e);
    }
    try {
      this.ctx.close();
    } catch (e) {
      console.warn('Error closing audio context', e);
    }
  }
}
