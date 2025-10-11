// src/pages/StemsPlayground/StemsPlayground.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Waveform } from '../../components/Waveform';
import { useLang } from '../../contexts/lang';
import { useAlbumsData, getImageUrl } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
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

  // refs на 4 аудиотега
  const drumsRef = useRef<HTMLAudioElement | null>(null);
  const bassRef = useRef<HTMLAudioElement | null>(null);
  const guitarRef = useRef<HTMLAudioElement | null>(null);
  const vocalRef = useRef<HTMLAudioElement | null>(null);

  // для скраббинга
  const waveWrapRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const currentSong = useMemo(() => SONGS.find((s) => s.id === selectedId), [selectedId]);

  const getEls = () =>
    [drumsRef.current, bassRef.current, guitarRef.current, vocalRef.current].filter(
      Boolean
    ) as HTMLAudioElement[];

  // текущее время/длительность с «мастера» (барабаны)
  const [time, setTime] = useState({ current: 0, duration: 0 });

  useEffect(() => {
    const master = drumsRef.current;
    if (!master) return;

    const onTime = () => {
      setTime((t) => ({
        current: master.currentTime || 0,
        duration: Number.isFinite(master.duration) ? master.duration : t.duration,
      }));
    };
    const onMeta = () => {
      setTime((t) => ({
        ...t,
        duration: Number.isFinite(master.duration) ? master.duration : t.duration,
      }));
    };

    master.addEventListener('timeupdate', onTime);
    master.addEventListener('loadedmetadata', onMeta);
    return () => {
      master.removeEventListener('timeupdate', onTime);
      master.removeEventListener('loadedmetadata', onMeta);
    };
  }, [selectedId]);

  // смена трека
  useEffect(() => {
    const els = getEls();
    els.forEach((el) => {
      el.pause();
      el.currentTime = 0;
      el.load();
    });
    if (isPlaying) {
      setTimeout(() => {
        els.forEach((el) => el.play().catch(() => {}));
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // mute
  useEffect(() => {
    if (drumsRef.current) drumsRef.current.muted = muted.drums;
    if (bassRef.current) bassRef.current.muted = muted.bass;
    if (guitarRef.current) guitarRef.current.muted = muted.guitar;
    if (vocalRef.current) vocalRef.current.muted = muted.vocal;
  }, [muted]);

  // когда стем закончился — вернуть «Воспроизвести»
  useEffect(() => {
    const handleEnded = () => {
      getEls().forEach((el) => el.pause());
      setIsPlaying(false);
    };
    const els = getEls();
    els.forEach((el) => el.addEventListener('ended', handleEnded));
    return () => els.forEach((el) => el.removeEventListener('ended', handleEnded));
  }, [selectedId]);

  // play/pause
  const togglePlay = async () => {
    const els = getEls();
    if (!isPlaying) {
      const t0 =
        Math.min(...els.map((el) => (Number.isFinite(el.currentTime) ? el.currentTime : 0))) || 0;
      els.forEach((el) => {
        try {
          if (Math.abs(el.currentTime - t0) > 0.1) el.currentTime = t0;
        } catch {
          /* ignore */
        }
      });
      await Promise.allSettled(els.map((el) => el.play()));
      setIsPlaying(true);
    } else {
      els.forEach((el) => el.pause());
      setIsPlaying(false);
    }
  };

  const toggleMute = (stem: StemKind) => setMuted((m) => ({ ...m, [stem]: !m[stem] }));

  // скраббинг
  const seekToClientX = (clientX: number) => {
    const wrap = waveWrapRef.current;
    const master = drumsRef.current;
    if (!wrap || !master || !Number.isFinite(master.duration)) return;

    const rect = wrap.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const newTime = ratio * master.duration;

    getEls().forEach((el) => {
      try {
        el.currentTime = newTime;
      } catch {
        /* ignore */
      }
    });
    setTime((t) => ({ ...t, current: newTime }));
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    draggingRef.current = true;
    wasPlayingRef.current = isPlaying;
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
    if (wasPlayingRef.current && !isPlaying) return;
  };

  const progress = time.duration > 0 ? time.current / time.duration : 0;
  const waveformSrc = currentSong?.stems.vocal ?? currentSong?.stems.drums;

  // Если лоадер ещё не отдал промисы — просто ничего не рендерим (без фолбеков)
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
          pageTitle: (t.stems as string) || '—', // заголовок страницы из titles.stems
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
                  disabled={isPlaying}
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
                <Waveform src={waveformSrc} clockEl={drumsRef.current} height={64} />
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

              {/* аудио (скрытые) */}
              <div className="visually-hidden" aria-hidden>
                <audio
                  ref={drumsRef}
                  src={currentSong?.stems.drums}
                  preload="auto"
                  crossOrigin="anonymous"
                />
                <audio
                  ref={bassRef}
                  src={currentSong?.stems.bass}
                  preload="auto"
                  crossOrigin="anonymous"
                />
                <audio
                  ref={guitarRef}
                  src={currentSong?.stems.guitar}
                  preload="auto"
                  crossOrigin="anonymous"
                />
                <audio
                  ref={vocalRef}
                  src={currentSong?.stems.vocal}
                  preload="auto"
                  crossOrigin="anonymous"
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
