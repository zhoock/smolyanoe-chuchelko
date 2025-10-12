// src/pages/StemsPlayground/StemsPlayground.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Waveform } from '../../components/Waveform';
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

  const engineRef = useRef<StemEngine | null>(null);
  const waveWrapRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const currentSong = useMemo(() => SONGS.find((s) => s.id === selectedId), [selectedId]);

  // создать/пересоздать движок при смене трека
  useEffect(() => {
    const song = currentSong;
    if (!song) return;

    engineRef.current?.dispose();
    const engine = new StemEngine({
      drums: song.stems.drums,
      bass: song.stems.bass,
      guitar: song.stems.guitar,
      vocal: song.stems.vocal,
    });
    engineRef.current = engine;

    (async () => {
      await engine.loadAll();
      // восстановить mute-состояния
      Object.entries(muted).forEach(([k, v]) => engine.setMuted(k as StemKind, v));
      if (isPlaying) await engine.play();
    })();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // RAF: снимать время/длительность из движка
  const [time, setTime] = useState({ current: 0, duration: 0 });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const e = engineRef.current;
      if (e) setTime({ current: e.getCurrentTime(), duration: e.getDuration() });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const progress = time.duration > 0 ? time.current / time.duration : 0;

  // play/pause
  const togglePlay = async () => {
    const e = engineRef.current;
    if (!e) return;
    if (!isPlaying) {
      await e.play();
      setIsPlaying(true);
    } else {
      await e.pause();
      setIsPlaying(false);
    }
  };

  // mute
  const toggleMute = (stem: StemKind) => {
    const e = engineRef.current;
    if (!e) return;
    setMuted((m) => {
      const next = { ...m, [stem]: !m[stem] };
      e.setMuted(stem, next[stem]);
      return next;
    });
  };

  // скраббинг
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

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (ev) => {
    draggingRef.current = true;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    seekToClientX(ev.clientX);
  };
  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (ev) => {
    if (!draggingRef.current) return;
    seekToClientX(ev.clientX);
  };
  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (ev) => {
    draggingRef.current = false;
    (ev.currentTarget as HTMLElement).releasePointerCapture(ev.pointerId);
  };

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

              {/* ВОЛНА: теперь контролируемая progress={progress} */}
              <div
                ref={waveWrapRef}
                className="stems__wave-wrap item-type-a"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                <Waveform
                  src={currentSong?.stems.vocal ?? currentSong?.stems.drums}
                  progress={progress}
                  height={64}
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
