// src/pages/StemsPlayground/StemsPlayground.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import Waveform from '../../components/Waveform/Waveform';
import { useLang } from '../../contexts/lang';
import { useAlbumsData, getImageUrl } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import { Loader } from '../../components/Loader/Loader';
import ErrorI18n from '../../components/ErrorMessage/ErrorI18n';
import { StemEngine, StemKind } from '../../audio/stemsEngine';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
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
    title: 'Последний поршнеый бомбардировщик',
    stems: {
      drums: '/audio/EP_Mixer/PPB_01_drums.mp3',
      bass: '/audio/EP_Mixer/PPB_01_bass.mp3',
      guitar: '/audio/EP_Mixer/PPB_01_guitars.mp3',
      vocal: '/audio/EP_Mixer/PPB_01_vocals.mp3',
    },
    portraits: {
      drums: getImageUrl('stems/EP/EP_drummer', '.png'),
      bass: getImageUrl('stems/EP/EP_bassist', '.png'),
      guitar: getImageUrl('stems/EP/EP_guitarist', '.png'),
      vocal: getImageUrl('stems/EP/EP_vocalist', '.png'),
    },
  },
  {
    id: 'song-5',
    title: 'Падение кита',
    stems: {
      drums: '/audio/EP_Mixer/PK_05_drums.mp3',
      bass: '/audio/EP_Mixer/PK_05_bass.mp3',
      guitar: '/audio/EP_Mixer/PK_05_guitars.mp3',
      vocal: '/audio/EP_Mixer/PK_05_vocals.mp3',
    },
    portraits: {
      drums: getImageUrl('stems/EP/EP_drummer', '.png'),
      bass: getImageUrl('stems/EP/EP_bassist', '.png'),
      guitar: getImageUrl('stems/EP/EP_guitarist', '.png'),
      vocal: getImageUrl('stems/EP/EP_vocalist', '.png'),
    },
  },

  {
    id: 'song-2',
    title: 'Швайс',
    stems: {
      drums: '/audio/23_Mixer/S_03_drums.mp3',
      bass: '/audio/23_Mixer/S_03_bass.mp3',
      guitar: '/audio/23_Mixer/S_03_guitars.mp3',
      vocal: '/audio/23_Mixer/S_03_vocals.mp3',
    },
    portraits: {
      drums: getImageUrl('stems/23/23_drummer', '.png'),
      bass: getImageUrl('stems/23/23_bassist', '.png'),
      guitar: getImageUrl('stems/23/23_guitarist', '.png'),
      vocal: getImageUrl('stems/23/23_vocalist', '.png'),
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

  const { pathname } = useLocation();
  const origin =
    (typeof window !== 'undefined' && window.location.origin) || 'https://smolyanoechuchelko.ru';
  const canonical = `${origin}${pathname}`;

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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, []);

  // Создаём/перезагружаем движок при смене трека
  useEffect(() => {
    const song = currentSong;
    if (!song) return;

    setLoading(true);
    setLoadProgress(0);

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

  // Пока route-лоадер не отдал данные — общий Loader
  if (!data) {
    return (
      <section className="stems-page main-background" aria-label="Блок c миксером">
        <div className="wrapper stems__wrapper">
          <Loader />
        </div>
      </section>
    );
  }

  const selectDisabled = isPlaying || loading;

  return (
    <section className="stems-page main-background" aria-label="Блок c миксером">
      <DataAwait
        value={data.templateC}
        fallback={
          <div className="wrapper stems__wrapper">
            <Loader />
          </div>
        }
        error={
          <div className="wrapper stems__wrapper">
            <ErrorI18n code="albumsLoadFailed" />
          </div>
        }
      >
        {(ui) => {
          const b = ui?.[0]?.buttons ?? {};
          const t = ui?.[0]?.titles ?? {};
          const pageTitle = ui?.[0]?.stems?.pageTitle as string;
          const pageText = (ui?.[0]?.stems?.text as string) || '';

          const labels = {
            play: b.playButton as string,
            pause: b.pause as string,
            drums: b.drums as string,
            bass: b.bass as string,
            guitar: b.guitar as string,
            vocals: b.vocals as string,
            pageTitle,
            pageText,
          };

          return (
            <>
              <Helmet>
                <title>{labels.pageTitle}</title>
                <meta name="description" content={labels.pageText} />
                <link rel="canonical" href={canonical} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content={labels.pageTitle} />
                <meta property="og:description" content={labels.pageText} />
                <meta property="og:url" content={canonical} />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={labels.pageTitle} />
                <meta name="twitter:description" content={labels.pageText} />
              </Helmet>

              <div className="wrapper stems__wrapper">
                <h2 className="item-type-a">{labels.pageTitle}</h2>
                <p className="item-type-a">{labels.pageText}</p>

                {/* выбор песни */}
                <div className="item">
                  <div
                    className={clsx('select-control', { 'is-disabled': selectDisabled })}
                    aria-disabled={selectDisabled}
                  >
                    <select
                      id="song-select"
                      value={selectedId}
                      onChange={(e) => setSelectedId(e.target.value)}
                      aria-label="Выбор песни"
                      disabled={selectDisabled}
                    >
                      {SONGS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* транспорт */}
                <div className="item">
                  <div className="wrapper-transport-controls">
                    <button
                      className="btn"
                      onClick={togglePlay}
                      type="button"
                      disabled={loading}
                      aria-pressed={isPlaying}
                    >
                      <span
                        className={clsx(
                          isPlaying ? 'icon-controller-pause' : 'icon-controller-play'
                        )}
                      ></span>
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
            </>
          );
        }}
      </DataAwait>
    </section>
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
