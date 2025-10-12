// src/pages/StemsPlayground/StemsPlayground.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import Waveform from '../../components/Waveform/Waveform';
import { useLang } from '../../contexts/lang';
import { useAlbumsData, getImageUrl } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import { StemEngine, StemKind } from '../../audio/stemsEngine';
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

  // Engine
  const engineRef = useRef<StemEngine | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  // Waveform interactions
  const waveWrapRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const currentSong = useMemo(() => SONGS.find((s) => s.id === selectedId), [selectedId]);

  // Создаём/перезагружаем движок при смене трека
  useEffect(() => {
    const song = currentSong;
    if (!song) return;

    setLoading(true);
    setLoadProgress(0);

    // прибираем старый
    engineRef.current?.dispose();

    const engine = new StemEngine({
      drums: song.stems.drums,
      bass: song.stems.bass,
      guitar: song.stems.guitar,
      vocal: song.stems.vocal,
    });
    engineRef.current = engine;

    (async () => {
      await engine.loadAll((p) => setLoadProgress(p));
      setLoading(false);
      if (isPlaying) engine.play();
      // применим текущие mute-состояния
      (Object.keys(muted) as StemKind[]).forEach((k) => engine.setMuted(k, muted[k]));
    })();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // RAF-цикл для прогресса
  const [time, setTime] = useState({ current: 0, duration: 0 });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const e = engineRef.current;
      if (e) {
        setTime({ current: e.getCurrentTime(), duration: e.getDuration() });
        // если дошли до конца — сбросим кнопку
        if (e.getDuration() > 0 && e.getCurrentTime() + 0.02 >= e.getDuration() && e.isPlaying) {
          setIsPlaying(false);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const progress = time.duration > 0 ? time.current / time.duration : 0;
  const waveformSrc = currentSong?.stems.vocal ?? currentSong?.stems.drums;

  // Транспорт
  const togglePlay = async () => {
    const e = engineRef.current;
    if (!e || loading) return;
    if (!isPlaying) {
      await e.play();
      setIsPlaying(true);
    } else {
      await e.pause();
      setIsPlaying(false);
    }
  };

  // Mute
  const toggleMute = (stem: StemKind) => {
    const e = engineRef.current;
    if (!e) return;
    setMuted((m) => {
      const next = { ...m, [stem]: !m[stem] };
      e.setMuted(stem, next[stem]);
      return next;
    });
  };

  // Скраббинг
  const seekToClientX = (clientX: number) => {
    const wrap = waveWrapRef.current;
    const e = engineRef.current;
    if (!wrap || !e || !Number.isFinite(e.getDuration())) return;

    const rect = wrap.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const newTime = ratio * e.getDuration();

    e.seek(newTime);
    setTime((t) => ({ ...t, current: newTime }));
  };
  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (evt) => {
    if (loading) return;
    draggingRef.current = true;
    wasPlayingRef.current = isPlaying;
    evt.currentTarget.setPointerCapture(evt.pointerId);
    seekToClientX(evt.clientX);
  };
  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (evt) => {
    if (!draggingRef.current || loading) return;
    seekToClientX(evt.clientX);
  };
  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (evt) => {
    draggingRef.current = false;
    evt.currentTarget.releasePointerCapture(evt.pointerId);
    if (wasPlayingRef.current && !isPlaying) return;
  };

  // Если лоадер ещё не отдал промисы — ничего не рендерим (страница получит словарь чуть позже)
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

              {/* выбор песни */}
              <div className="item">
                <select
                  id="song-select"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  aria-label="Выбор песни"
                  disabled={isPlaying || loading}
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
                  <button className="btn" onClick={togglePlay} disabled={loading}>
                    {isPlaying ? labels.pause : labels.play}
                  </button>
                </div>
              </div>

              {/* ВОЛНА или ЛОАДЕР */}
              <div
                ref={waveWrapRef}
                className={clsx('stems__wave-wrap', 'item-type-a', { 'is-loading': loading })}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                {loading ? (
                  <div className="stems__loader in-wave" aria-live="polite" aria-busy="true">
                    <div className="stems__loader-bar">
                      <div
                        className="stems__loader-fill"
                        style={{ transform: `scaleX(${loadProgress})` }}
                      />
                    </div>
                    {/* <small>{Math.round(loadProgress * 100)}%</small> */}
                  </div>
                ) : (
                  <>
                    <Waveform src={waveformSrc} progress={progress} height={64} />
                    <div className="stems__wave-cursor" style={{ left: `${progress * 100}%` }} />
                  </>
                )}
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
