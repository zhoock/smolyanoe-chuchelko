// src/pages/StemsPlayground/StemsPlayground.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Waveform } from '../../components/Waveform';
import { useLang } from '../../contexts/lang';
import { useAlbumsData, getImageUrl } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import { StemEngine, StemKind } from '../../audio/stemsEngine'; // <-- добавь этот импорт
import './style.scss';

type Song = {
  id: string;
  title: string;
  stems: Record<StemKind, string>;
  portraits?: Partial<Record<StemKind, string>>;
};

const SONGS: Song[] = [
  {
    id: 'song-1',
    title: 'Падение кита',
    stems: {
      drums: '/audio/song-1/drums.mp3',
      bass: '/audio/song-1/bass.mp3',
      guitar: '/audio/song-1/guitar.mp3',
      vocal: '/audio/song-1/vocal.mp3',
    },
    portraits: {
      drums: getImageUrl('stems/drummer', '.png'),
      bass: getImageUrl('stems/bassist', '.png'),
      guitar: getImageUrl('stems/guitarist', '.png'),
      vocal: getImageUrl('stems/vocalist', '.png'),
    },
  },
];

export default function StemsPlayground() {
  const [selectedId, setSelectedId] = useState<string>(SONGS[0]?.id ?? '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState<Record<StemKind, boolean>>({
    drums: false,
    bass: false,
    guitar: false,
    vocal: false,
  });

  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const engineRef = useRef<StemEngine | null>(null);

  const waveWrapRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const currentSong = useMemo(() => SONGS.find((s) => s.id === selectedId), [selectedId]);

  // Создание/пересоздание движка при смене трека
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // dispose предыдущего
      engineRef.current?.dispose();

      // создаём новый движок
      const stems = currentSong?.stems ?? ({} as Record<StemKind, string>);
      const engine = new StemEngine(stems);
      engineRef.current = engine;

      // предзагрузка
      await engine.loadAll();
      if (cancelled) return;

      // применим текущие mute-состояния к узлам
      (Object.keys(muted) as StemKind[]).forEach((k) => {
        engine.setMuted(k, muted[k]);
      });

      // если до смены песня играла — аккуратно продолжаем
      if (isPlaying) {
        await engine.play(0); // начинаем с 0 (или можешь хранить смещение, если нужно)
        setIsPlaying(true);
      }
    })();

    return () => {
      cancelled = true;
      // на всякий случай — не убиваем тут, т.к. выше уже dispose при создании нового
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Глобальный тикер: следим за окончанием и обновляем кнопку
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const eng = engineRef.current;
      if (eng) {
        if (eng.isPlaying && eng.currentTime + 0.02 >= eng.duration) {
          // дошли до конца — останавливаем
          eng.stop();
          setIsPlaying(false);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Переключение Play/Pause
  const togglePlay = async () => {
    const eng = engineRef.current;
    if (!eng) return;

    if (!eng.isPlaying) {
      await eng.play();
      setIsPlaying(true);
    } else {
      await eng.pause();
      setIsPlaying(false);
    }
  };

  // Mute / Unmute
  const toggleMute = (stem: StemKind) => {
    const eng = engineRef.current;
    setMuted((m) => {
      const next = { ...m, [stem]: !m[stem] };
      if (eng) eng.setMuted(stem, next[stem]);
      return next;
    });
  };

  // Скраббинг
  const seekByClientX = (clientX: number) => {
    const eng = engineRef.current;
    const wrap = waveWrapRef.current;
    if (!eng || !wrap || eng.duration <= 0) return;

    const rect = wrap.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const newTime = ratio * eng.duration;

    eng.seek(newTime);
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    draggingRef.current = true;
    wasPlayingRef.current = engineRef.current?.isPlaying ?? false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    seekByClientX(e.clientX);
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!draggingRef.current) return;
    seekByClientX(e.clientX);
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    draggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    // если играл — продолжит, если был на паузе — останется на паузе
  };

  const waveformSrc = currentSong?.stems.vocal ?? currentSong?.stems.drums;

  // ждём UI-словарь (без фолбеков — ты просил)
  if (!data) return null;

  return (
    <DataAwait value={data.templateC}>
      {(ui) => {
        const b = ui?.[0]?.buttons ?? {};
        const t = ui?.[0]?.titles ?? {};
        const labels = {
          play: b.playButton as string,
          pause: b.pause as string,
          drums: b.drums as string,
          bass: b.bass as string,
          guitar: b.guitar as string,
          vocals: b.vocals as string,
          pageTitle: (t.stems as string) || '—',
        };

        // часы для волны — от движка
        const clock = {
          currentTime: () => engineRef.current?.currentTime ?? 0,
          duration: () => engineRef.current?.duration ?? 0,
        };

        const progress =
          (engineRef.current?.duration ?? 0) > 0
            ? (engineRef.current?.currentTime ?? 0) / (engineRef.current?.duration ?? 1)
            : 0;

        return (
          <section className="stems-page main-background" aria-label="Блок c миксером">
            <div className="wrapper stems__wrapper">
              <h2 className="item-type-a">{labels.pageTitle}</h2>

              {/* выбор песни */}
              <div className="item">
                <select
                  id="song-select"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  aria-label="Выбор песни"
                  disabled={isPlaying} // во время воспроизведения — блокируем выбор
                >
                  {SONGS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* транспорт */}
              <div className="item">
                <div className="wrapper-transport-controls">
                  <button className="btn" onClick={togglePlay}>
                    {isPlaying ? labels.pause : labels.play}
                  </button>
                </div>
              </div>

              {/* ВОЛНА + hit-зона для скраббинга + маркеры */}
              <div
                ref={waveWrapRef}
                className="stems__wave-wrap item-type-a"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                <Waveform src={waveformSrc} clock={clock} height={64} />
                <div
                  className="stems__wave-progress"
                  style={{ transform: `scaleX(${progress})` }}
                />
                <div className="stems__wave-cursor" style={{ left: `${progress * 100}%` }} />
              </div>

              {/* портреты-мутизаторы */}
              <div className="stems__grid item-type-a">
                <StemCard
                  title={labels.drums}
                  img={currentSong?.portraits?.drums}
                  active={!muted.drums}
                  onClick={() => toggleMute('drums')}
                />
                <StemCard
                  title={labels.bass}
                  img={currentSong?.portraits?.bass}
                  active={!muted.bass}
                  onClick={() => toggleMute('bass')}
                />
                <StemCard
                  title={labels.guitar}
                  img={currentSong?.portraits?.guitar}
                  active={!muted.guitar}
                  onClick={() => toggleMute('guitar')}
                />
                <StemCard
                  title={labels.vocals}
                  img={currentSong?.portraits?.vocal}
                  active={!muted.vocal}
                  onClick={() => toggleMute('vocal')}
                />
              </div>
            </div>
          </section>
        );
      }}
    </DataAwait>
  );
}

function StemCard({
  title,
  img,
  active,
  onClick,
}: {
  title: string;
  img?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={clsx('stem-card', { muted: !active })}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${title}: ${active ? 'on' : 'mute'}`}
      title={`${title} — ${active ? 'звук включён' : 'звук выключен (mute)'}`}
    >
      <div
        className="stem-card__img"
        style={{ backgroundImage: img ? `url(${img})` : undefined }}
      />
      <div className="stem-card__label">
        <span className="dot" />
        {title}
      </div>
    </button>
  );
}
