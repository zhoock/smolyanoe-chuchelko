// src/audio/stemsEngine.ts
// WebAudio-движок для синхронного проигрывания стемов
// API: load(song), play(), pause(), seek(sec), setMuted(kind, on), state getters

export type StemKind = 'drums' | 'bass' | 'guitar' | 'vocal';
export type SongLike = {
  id: string;
  title: string;
  stems: Record<StemKind, string>;
};

type StemNodes = {
  gain: GainNode;
  buffer?: AudioBuffer;
  source?: AudioBufferSourceNode; // пересоздаём на каждом play/seek
};

export function createStemsEngine() {
  const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  const ctx = new AC();

  const stems: Record<StemKind, StemNodes> = {
    drums: { gain: new GainNode(ctx) },
    bass: { gain: new GainNode(ctx) },
    guitar: { gain: new GainNode(ctx) },
    vocal: { gain: new GainNode(ctx) },
  };

  // подключаем к мастер-выходу
  Object.values(stems).forEach((s) => s.gain.connect(ctx.destination));

  let duration = 0;
  let isPlaying = false;
  let startedAtCtx = 0; // ctx.currentTime, когда начался запуск
  let offsetAtStart = 0; // смещение в секундах, с которого запускаем
  let pausedAt = 0; // где остановились (секунды в треке)
  let currentSong: SongLike | null = null;

  async function decodeUrl(url: string) {
    const resp = await fetch(url, { cache: 'force-cache' });
    const arr = await resp.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  }

  function stopSources() {
    (Object.keys(stems) as StemKind[]).forEach((k) => {
      const s = stems[k];
      if (s.source) {
        try {
          s.source.stop();
        } catch (e) {
          // может быть ошибка, если источник уже остановлен
        }
        s.source.disconnect();
        s.source = undefined;
      }
    });
  }

  function scheduleAll(offset: number) {
    const when = ctx.currentTime + 0.06; // небольшой «лид-тайм» для стабильности
    (Object.keys(stems) as StemKind[]).forEach((k) => {
      const s = stems[k];
      if (!s.buffer) return;

      const src = new AudioBufferSourceNode(ctx, { buffer: s.buffer });
      src.connect(s.gain);
      // без петель; если нужно — можно добавить loop=true
      src.start(when, Math.min(offset, (s.buffer.duration || 0) - 0.001));
      s.source = src;
    });

    startedAtCtx = when;
    offsetAtStart = offset;
    isPlaying = true;
  }

  function getCurrentTimeSec(): number {
    if (!isPlaying) return pausedAt;
    // сколько прошло с момента запуска + offset, но не больше duration
    const t = offsetAtStart + (ctx.currentTime - startedAtCtx);
    return Math.max(0, Math.min(duration, t));
  }

  return {
    get context() {
      return ctx;
    },
    get isPlaying() {
      return isPlaying;
    },
    get duration() {
      return duration;
    },
    get currentTime() {
      return getCurrentTimeSec();
    },

    async load(song: SongLike) {
      currentSong = song;
      stopSources();
      isPlaying = false;
      pausedAt = 0;
      offsetAtStart = 0;

      // загружаем и декодируем все стемы параллельно
      const entries = Object.entries(song.stems) as [StemKind, string][];
      const buffers = await Promise.all(entries.map(([, url]) => decodeUrl(url)));

      entries.forEach(([k], i) => {
        stems[k].buffer = buffers[i];
      });
      // общая длительность — по длиннейшему стему
      duration = Math.max(...buffers.map((b) => b.duration)) || 0;
    },

    async play() {
      if (!currentSong) return;
      await ctx.resume(); // на iOS/Chrome активация аудио требует юзер-жеста → тут ок
      stopSources();
      scheduleAll(pausedAt);
    },

    pause() {
      if (!isPlaying) return;
      pausedAt = getCurrentTimeSec();
      stopSources();
      isPlaying = false;
    },

    async seek(seconds: number, keepPlaying: boolean) {
      const sec = Math.max(0, Math.min(duration, seconds));
      pausedAt = sec;
      stopSources();
      if (keepPlaying) {
        await ctx.resume();
        scheduleAll(sec);
      }
    },

    setMuted(kind: StemKind, muted: boolean) {
      const s = stems[kind];
      s.gain.gain.value = muted ? 0 : 1;
    },

    // На случай глобального mute/volume — можно расширить API
  };
}

export type StemsEngine = ReturnType<typeof createStemsEngine>;
