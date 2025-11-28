// src/pages/StemsPlayground/StemsPlayground.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Waveform } from '@shared/ui/waveform';
import { useLang } from '@app/providers/lang';
import { getUserImageUrl, getUserAudioUrl } from '@shared/api/albums';
import { Loader } from '@shared/ui/loader';
import { ErrorI18n } from '@shared/ui/error-message';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { StemEngine, StemKind } from '@audio/stemsEngine';
import { Text } from '@shared/ui/text';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import './style.scss';

type Song = {
  id: string;
  title: string;
  mix?: string;
  stems: Record<StemKind, string>;
  portraits?: Partial<Record<StemKind, string>>;
};

const SONGS: Song[] = [
  {
    id: 'song-1',
    title: 'Последний поршневый бомбардировщик',
    mix: getUserAudioUrl('Smolyanoe-chuchelko/01-The-last-piston-bomber-1644.wav'),
    stems: {
      drums: getUserAudioUrl('EP_Mixer/01_PPB_drums.mp3'),
      bass: getUserAudioUrl('EP_Mixer/01_PPB_bass.mp3'),
      guitar: getUserAudioUrl('EP_Mixer/01_PPB_guitars.mp3'),
      vocal: getUserAudioUrl('EP_Mixer/01_PPB_vocals.mp3'),
    },
    portraits: {
      drums: getUserImageUrl('EP/EP_drummer', 'stems', '.png'),
      bass: getUserImageUrl('EP/EP_bassist', 'stems', '.png'),
      guitar: getUserImageUrl('EP/EP_guitarist', 'stems', '.png'),
      vocal: getUserImageUrl('EP/EP_vocalist', 'stems', '.png'),
    },
  },
  {
    id: 'song-2',
    title: 'Водянистая влага',
    mix: getUserAudioUrl('Smolyanoe-chuchelko/02-Watery-moisture-1644.wav'),
    stems: {
      drums: getUserAudioUrl('EP_Mixer/02_VV_drums.mp3'),
      bass: getUserAudioUrl('EP_Mixer/02_VV_bass.mp3'),
      guitar: getUserAudioUrl('EP_Mixer/02_VV_guitars.mp3'),
      vocal: getUserAudioUrl('EP_Mixer/02_VV_vocals.mp3'),
    },
    portraits: {
      drums: getUserImageUrl('EP/EP_drummer', 'stems', '.png'),
      bass: getUserImageUrl('EP/EP_bassist', 'stems', '.png'),
      guitar: getUserImageUrl('EP/EP_guitarist', 'stems', '.png'),
      vocal: getUserImageUrl('EP/EP_vocalist', 'stems', '.png'),
    },
  },
  {
    id: 'song-3',
    title: 'Рулевой мёртв',
    mix: getUserAudioUrl('Smolyanoe-chuchelko/03-Helmsman-is-dead-1644.wav'),
    stems: {
      drums: getUserAudioUrl('EP_Mixer/03_RM_drums.mp3'),
      bass: getUserAudioUrl('EP_Mixer/03_RM_bass.mp3'),
      guitar: getUserAudioUrl('EP_Mixer/03_RM_guitars.mp3'),
      vocal: getUserAudioUrl('EP_Mixer/03_RM_vocals.mp3'),
    },
    portraits: {
      drums: getUserImageUrl('EP/EP_drummer', 'stems', '.png'),
      bass: getUserImageUrl('EP/EP_bassist', 'stems', '.png'),
      guitar: getUserImageUrl('EP/EP_guitarist', 'stems', '.png'),
      vocal: getUserImageUrl('EP/EP_vocalist', 'stems', '.png'),
    },
  },
  {
    id: 'song-4',
    title: 'Бром и сталь',
    mix: getUserAudioUrl('Smolyanoe-chuchelko/04-Bromine-and-steel-1644.wav'),
    stems: {
      drums: getUserAudioUrl('EP_Mixer/04_BIS_drums.mp3'),
      bass: getUserAudioUrl('EP_Mixer/04_BIS_bass.mp3'),
      guitar: getUserAudioUrl('EP_Mixer/04_BIS_guitars.mp3'),
      vocal: getUserAudioUrl('EP_Mixer/04_BIS_vocals.mp3'),
    },
    portraits: {
      drums: getUserImageUrl('EP/EP_drummer', 'stems', '.png'),
      bass: getUserImageUrl('EP/EP_bassist', 'stems', '.png'),
      guitar: getUserImageUrl('EP/EP_guitarist', 'stems', '.png'),
      vocal: getUserImageUrl('EP/EP_vocalist', 'stems', '.png'),
    },
  },
  {
    id: 'song-5',
    title: 'Падение кита',
    mix: getUserAudioUrl('Smolyanoe-chuchelko/05-Whale-falling-1644.wav'),
    stems: {
      drums: getUserAudioUrl('EP_Mixer/05_PK_drums.mp3'),
      bass: getUserAudioUrl('EP_Mixer/05_PK_bass.mp3'),
      guitar: getUserAudioUrl('EP_Mixer/05_PK_guitars.mp3'),
      vocal: getUserAudioUrl('EP_Mixer/05_PK_vocals.mp3'),
    },
    portraits: {
      drums: getUserImageUrl('EP/EP_drummer', 'stems', '.png'),
      bass: getUserImageUrl('EP/EP_bassist', 'stems', '.png'),
      guitar: getUserImageUrl('EP/EP_guitarist', 'stems', '.png'),
      vocal: getUserImageUrl('EP/EP_vocalist', 'stems', '.png'),
    },
  },
  {
    id: 'song-6',
    title: 'Фиджийская русалка Барнума',
    mix: getUserAudioUrl('23/01-Barnums-Fijian-Mermaid-1644.wav'),
    stems: {
      drums: getUserAudioUrl('23_Mixer/01_FRB_drums.mp3'),
      bass: getUserAudioUrl('23_Mixer/01_FRB_bass.mp3'),
      guitar: getUserAudioUrl('23_Mixer/01_FRB_guitars.mp3'),
      vocal: getUserAudioUrl('23_Mixer/01_FRB_vocals.mp3'),
    },
    portraits: {
      drums: getUserImageUrl('23/23_drummer', 'stems', '.png'),
      bass: getUserImageUrl('23/23_bassist', 'stems', '.png'),
      guitar: getUserImageUrl('23/23_guitarist', 'stems', '.png'),
      vocal: getUserImageUrl('23/23_vocalist', 'stems', '.png'),
    },
  },
  {
    id: 'song-7',
    title: 'Слипер',
    mix: getUserAudioUrl('23/02-Sleeper-1644.wav'),
    stems: {
      drums: getUserAudioUrl('23_Mixer/02_SL_drums.mp3'),
      bass: getUserAudioUrl('23_Mixer/02_SL_bass.mp3'),
      guitar: getUserAudioUrl('23_Mixer/02_SL_guitars.mp3'),
      vocal: getUserAudioUrl('23_Mixer/02_SL_vocals.mp3'),
    },
    portraits: {
      drums: getUserImageUrl('23/23_drummer', 'stems', '.png'),
      bass: getUserImageUrl('23/23_bassist', 'stems', '.png'),
      guitar: getUserImageUrl('23/23_guitarist', 'stems', '.png'),
      vocal: getUserImageUrl('23/23_vocalist', 'stems', '.png'),
    },
  },
  {
    id: 'song-8',
    title: 'Швайс',
    mix: getUserAudioUrl('23/03-Schweiz-1644.wav'),
    stems: {
      drums: getUserAudioUrl('23_Mixer/03_SH_drums.mp3'),
      bass: getUserAudioUrl('23_Mixer/03_SH_bass.mp3'),
      guitar: getUserAudioUrl('23_Mixer/03_SH_guitars.mp3'),
      vocal: getUserAudioUrl('23_Mixer/03_SH_vocals.mp3'),
    },
    portraits: {
      drums: getUserImageUrl('23/23_drummer', 'stems', '.png'),
      bass: getUserImageUrl('23/23_bassist', 'stems', '.png'),
      guitar: getUserImageUrl('23/23_guitarist', 'stems', '.png'),
      vocal: getUserImageUrl('23/23_vocalist', 'stems', '.png'),
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
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  // UI словарь загружается через loader

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
  const waveformSrc = currentSong?.mix ?? currentSong?.stems.vocal ?? currentSong?.stems.drums;

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

  const selectDisabled = isPlaying || loading;

  const b = ui?.buttons ?? {};
  const pageTitle = (ui?.stems?.pageTitle as string) ?? '';
  const pageText = (ui?.stems?.text as string) || '';
  const notice = (ui?.stems?.notice as string) || '';

  const labels = {
    play: (b.playButton as string) ?? 'Play',
    pause: (b.pause as string) ?? 'Pause',
    drums: (b.drums as string) ?? 'Drums',
    bass: (b.bass as string) ?? 'Bass',
    guitar: (b.guitar as string) ?? 'Guitar',
    vocals: (b.vocals as string) ?? 'Vocals',
    pageTitle,
    pageText,
    notice,
  };

  return (
    <section className="stems-page main-background" aria-label="Блок c миксером">
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
        <Text className="item-type-a">{labels.pageText}</Text>
        <Text as="span" className="item-type-a notice" aria-label="Важная информация">
          {labels.notice}
        </Text>

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
                <option key={s.id} value={s.id} title={s.title}>
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
                className={clsx(isPlaying ? 'icon-controller-pause' : 'icon-controller-play')}
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
