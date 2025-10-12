import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Waveform } from '../../components/Waveform';
import { useLang } from '../../contexts/lang';
import { useAlbumsData, getImageUrl } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import { createStemsEngine, type StemsEngine } from '../../audio/stemsEngine';
import './style.scss';

type StemKind = 'drums' | 'bass' | 'guitar' | 'vocal';
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

  // WebAudio-движок (создаем один раз)
  const engineRef = useRef<StemsEngine | null>(null);
  if (!engineRef.current) engineRef.current = createStemsEngine();
  const engine = engineRef.current;

  const waveWrapRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const currentSong = useMemo(() => SONGS.find((s) => s.id === selectedId)!, [selectedId]);

  // Загружаем трек в движок при смене
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await engine.load(currentSong);
      if (cancelled) return;
      // применяем текущие mute-состояния
      (Object.keys(muted) as StemKind[]).forEach((k) => engine.setMuted(k, muted[k]));
      // если до этого играли — продолжаем играть с начала
      if (isPlaying) {
        await engine.play();
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Применяем mute к движку при кликах
  useEffect(() => {
    (Object.keys(muted) as StemKind[]).forEach((k) => engine.setMuted(k, muted[k]));
  }, [muted, engine]);

  // «тикаем» прогресс (перерисовка курсора/заливки)
  const [, forceTick] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      forceTick((n) => n + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const togglePlay = async () => {
    if (!isPlaying) {
      await engine.play();
      setIsPlaying(true);
    } else {
      engine.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (stem: StemKind) => setMuted((m) => ({ ...m, [stem]: !m[stem] }));

  // Скраббинг в движке
  const seekToClientX = async (clientX: number) => {
    const wrap = waveWrapRef.current;
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const newTime = ratio * (engine.duration || 0);

    await engine.seek(newTime, wasPlayingRef.current);
    setIsPlaying(wasPlayingRef.current);
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    draggingRef.current = true;
    wasPlayingRef.current = engine.isPlaying;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    seekToClientX(e.clientX);
  };
  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!draggingRef.current) return;
    seekToClientX(e.clientX);
  };
  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    draggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const progress = engine.duration > 0 ? engine.currentTime / engine.duration : 0;

  // если лоадер ещё не готов — не рендерим
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

        return (
          <section className="stems-page main-background" aria-label="Блок c миксером">
            <div className="wrapper stems__wrapper">
              <h2 className="item-type-a">{labels.pageTitle}</h2>

              <div className="item">
                <select
                  id="song-select"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  aria-label="Выбор песни"
                  disabled={isPlaying}
                >
                  {SONGS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="item">
                <div className="wrapper-transport-controls">
                  <button className="btn" onClick={togglePlay}>
                    {isPlaying ? labels.pause : labels.play}
                  </button>
                </div>
              </div>

              {/* Волна: теперь даём ей current/duration */}
              <div
                ref={waveWrapRef}
                className="stems__wave-wrap item-type-a"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                <Waveform
                  src={currentSong.stems.vocal ?? currentSong.stems.drums}
                  height={64}
                  current={engine.currentTime}
                  duration={engine.duration}
                />
                <div
                  className="stems__wave-progress"
                  style={{ transform: `scaleX(${progress})` }}
                />
                <div className="stems__wave-cursor" style={{ left: `${progress * 100}%` }} />
              </div>

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
