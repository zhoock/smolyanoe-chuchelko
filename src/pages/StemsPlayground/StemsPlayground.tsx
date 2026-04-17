// src/pages/StemsPlayground/StemsPlayground.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Waveform } from '@shared/ui/waveform';
import { useLang } from '@app/providers/lang';
import { getUserImageUrl, getUserAudioUrl } from '@shared/api/albums';
import { optionalMediaSrc } from '@shared/lib/media/optionalMediaUrl';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { StemEngine, StemKind } from '@audio/stemsEngine';
import { Text } from '@shared/ui/text';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { fetchAlbums } from '@entities/album/model/albumsSlice';
import { selectAlbumsDataResolved, selectAlbumsStatus } from '@entities/album/model/selectors';
import { listStorageByPrefix } from '@shared/api/storage';
import {
  buildStoragePublicObjectUrl,
  createSupabaseClient,
  STORAGE_BUCKET_NAME,
} from '@config/supabase';
import { getUserUserId } from '@config/user';
import { selectPublicArtistSlug } from '@shared/model/currentArtist';
import './style.scss';

type Song = {
  id: string;
  title: string;
  mix?: string;
  stems: Partial<Record<StemKind, string>>; // Не все стемы обязательны
  portraits?: Partial<Record<StemKind, string>>;
};

// Маппинг ключей стемов из админки в ключи StemKind
const STEM_KEY_MAP: Record<string, StemKind> = {
  drums: 'drums',
  bass: 'bass',
  guitars: 'guitar', // В админке 'guitars', в StemKind 'guitar'
  vocals: 'vocal', // В админке 'vocals', в StemKind 'vocal'
};

/** Публичный URL объекта в bucket: достаточно VITE_SUPABASE_URL (как в MixerAdmin). */
function resolveStoragePublicUrl(storagePath: string): string | null {
  const built = buildStoragePublicObjectUrl(storagePath);
  if (built) return built;
  const supabase = createSupabaseClient();
  if (supabase) {
    const { data } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(storagePath);
    return data?.publicUrl ?? null;
  }
  return null;
}

// Дефолтная обложка стема из папки Mixer (нужен ownerUserId — без сессии/fallback user URL не строим)
function getDefaultStemPortrait(stemKind: StemKind, ownerUserId: string): string | null {
  const fileNameMap: Record<StemKind, string> = {
    drums: 'drums',
    bass: 'bass',
    guitar: 'guitars',
    vocal: 'vocals',
  };
  const fileName = fileNameMap[stemKind];
  return getUserImageUrl(`Mixer/${fileName}`, 'stems', '.png', undefined, ownerUserId);
}

export default function StemsPlayground() {
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const publicArtistSlug = useAppSelector(selectPublicArtistSlug);
  const albums = useAppSelector(selectAlbumsDataResolved);
  const albumsStatus = useAppSelector(selectAlbumsStatus);
  const albumsLastUpdated = useAppSelector((s) => s.albums.lastUpdated);

  /** Метка момента смены артиста/языка: не строим список из кэша альбомов до свежего fetchAlbums.fulfilled. */
  const stemsSyncEpochRef = useRef(0);

  const fallbackOwnerUserId = useMemo(
    () => albums?.[0]?.userId ?? getUserUserId() ?? null,
    [albums]
  );

  const [dynamicSongs, setDynamicSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(true);

  /** Только треки из альбомов со стемами в Storage (без демо-списка в коде). */
  const SONGS = useMemo(() => {
    if (albumsStatus === 'loading' || loadingSongs) {
      return [];
    }
    return dynamicSongs;
  }, [dynamicSongs, albumsStatus, loadingSongs]);

  const [selectedId, setSelectedId] = useState<string>('');
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

  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  // Engine
  const engineRef = useRef<StemEngine | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  // Waveform interactions
  const waveWrapRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const currentSong = useMemo(() => SONGS.find((s) => s.id === selectedId), [selectedId, SONGS]);

  const defaultPortraits = useMemo(() => {
    const id = fallbackOwnerUserId;
    if (!id) {
      return { drums: null, bass: null, guitar: null, vocal: null };
    }
    return {
      drums: getDefaultStemPortrait('drums', id),
      bass: getDefaultStemPortrait('bass', id),
      guitar: getDefaultStemPortrait('guitar', id),
      vocal: getDefaultStemPortrait('vocal', id),
    };
  }, [fallbackOwnerUserId]);

  // Смена артиста/языка: сразу очищаем каталог стемов, чтобы не мигали треки другого артиста
  useEffect(() => {
    stemsSyncEpochRef.current = Date.now();
    setDynamicSongs([]);
    setSelectedId('');
    setLoadingSongs(true);
    dispatch(fetchAlbums({ force: true }));
  }, [dispatch, lang, publicArtistSlug]);

  // Обработчик события обновления обложек стемов
  useEffect(() => {
    const handleStemCoverUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        albumId: string;
        trackId: string;
        stemKey: string;
        url: string | null;
      }>;
      console.log(
        '🔄 [StemsPlayground] Получено событие обновления обложки стема:',
        customEvent.detail
      );

      // Перезагружаем альбомы с force: true для принудительной перезагрузки данных
      // Это вызовет useEffect, который перезагрузит стемы и портреты
      dispatch(fetchAlbums({ force: true }));
    };

    window.addEventListener('stem-cover-updated', handleStemCoverUpdate);

    return () => {
      window.removeEventListener('stem-cover-updated', handleStemCoverUpdate);
    };
  }, [dispatch, lang]);

  // Загружаем стемы для треков из базы (только после актуального fetch альбомов для текущего артиста)
  useEffect(() => {
    if (albumsStatus === 'loading') {
      return;
    }

    if (albumsStatus === 'failed') {
      setLoadingSongs(false);
      setDynamicSongs([]);
      return;
    }

    if (albumsStatus === 'idle') {
      return;
    }

    if (albumsStatus !== 'succeeded') {
      setLoadingSongs(false);
      return;
    }

    if (albumsLastUpdated != null && albumsLastUpdated < stemsSyncEpochRef.current) {
      return;
    }

    if (!albums || albums.length === 0) {
      setDynamicSongs([]);
      setSelectedId('');
      setLoadingSongs(false);
      return;
    }

    const syncAtLoadStart = stemsSyncEpochRef.current;

    const loadStemsForTracks = async () => {
      setLoadingSongs(true);
      const songsWithStems: Song[] = [];

      console.log('🎵 [StemsPlayground] Загрузка стемов для треков из альбомов:', {
        albumsCount: albums.length,
        albums: albums.map((a) => ({ albumId: a.albumId, tracksCount: a.tracks?.length || 0 })),
      });

      for (const album of albums) {
        if (!album.albumId || !album.tracks || album.tracks.length === 0) continue;

        for (const track of album.tracks) {
          const trackId = String(track.id);
          const albumId = album.albumId;

          const storageUserId = (album.userId && String(album.userId).trim()) || getUserUserId();

          if (!storageUserId) {
            console.warn('⚠️ [StemsPlayground] Пропуск трека: нет userId для альбома', {
              albumId,
              trackId,
            });
            continue;
          }

          // Проверяем наличие стемов в Storage
          const audioFolderPath = `users/${storageUserId}/audio/${albumId}/${trackId}`;
          console.log('🔍 [StemsPlayground] Проверка стемов для трека:', {
            albumId,
            trackId,
            trackTitle: track.title,
            audioFolderPath,
          });

          const stemsFiles = await listStorageByPrefix(audioFolderPath);

          // Если стемов нет, пропускаем трек
          if (!stemsFiles || stemsFiles.length === 0) {
            console.log('⚠️ [StemsPlayground] Стемы не найдены для трека:', {
              albumId,
              trackId,
              trackTitle: track.title,
            });
            continue;
          }

          console.log('✅ [StemsPlayground] Найдены стемы для трека:', {
            albumId,
            trackId,
            trackTitle: track.title,
            stemsCount: stemsFiles.length,
            stemsFiles,
          });

          // Формируем объект со стемами
          const stems: Partial<Record<StemKind, string>> = {};
          for (const [adminKey, stemKind] of Object.entries(STEM_KEY_MAP)) {
            // Ищем файл, который начинается с ключа стема (например, "drums-", "bass-")
            const matchingFile = stemsFiles.find((fileName) => fileName.startsWith(`${adminKey}-`));
            if (matchingFile) {
              const storagePath = `${audioFolderPath}/${matchingFile}`;
              const url = resolveStoragePublicUrl(storagePath);
              if (url) {
                stems[stemKind] = url;
              }
            }
          }

          // Если хотя бы один стем найден, добавляем песню
          if (Object.keys(stems).length > 0) {
            // Загружаем портреты стемов из админки
            const portraitsFolderPath = `users/${storageUserId}/stems/${albumId}/${trackId}`;
            const portraitFiles = await listStorageByPrefix(portraitsFolderPath);
            const portraits: Partial<Record<StemKind, string>> = {};

            // Для каждого загруженного стема пытаемся найти пользовательский портрет,
            // если нет - используем дефолтный из папки Mixer
            for (const [adminKey, stemKind] of Object.entries(STEM_KEY_MAP)) {
              // Сначала проверяем, есть ли пользовательский портрет
              let portraitUrl: string | undefined;

              if (portraitFiles && portraitFiles.length > 0) {
                // Ищем файл обложки: может быть в формате "drums.jpg" или "drums-{timestamp}.jpg"
                const matchingFile = portraitFiles.find(
                  (fileName) =>
                    fileName.startsWith(`${adminKey}-`) ||
                    fileName.startsWith(`${adminKey}.`) ||
                    fileName === adminKey
                );
                if (matchingFile) {
                  const portraitStoragePath = `users/${storageUserId}/stems/${albumId}/${trackId}/${matchingFile}`;
                  portraitUrl = resolveStoragePublicUrl(portraitStoragePath) ?? undefined;
                }
              }

              // Если нет пользовательского портрета, используем дефолтный из Mixer
              // Но только если стем загружен (иначе карточка будет disabled)
              if (!portraitUrl && stems[stemKind]) {
                portraitUrl = optionalMediaSrc(
                  getDefaultStemPortrait(stemKind, storageUserId),
                  'StemsPlayground:defaultPortrait',
                  { stemKind, albumId, trackId }
                );
              }

              if (portraitUrl) {
                portraits[stemKind] = portraitUrl;
              }
            }

            // Формируем URL для микса (полный трек)
            const mixUrl = track.src
              ? optionalMediaSrc(
                  getUserAudioUrl(track.src, true, storageUserId),
                  'StemsPlayground:dynamicMix',
                  { albumId, trackId }
                )
              : undefined;

            songsWithStems.push({
              id: `track-${albumId}-${trackId}`,
              title: track.title || `Track ${trackId}`,
              mix: mixUrl,
              stems, // Partial - не все стемы обязательны
              portraits: Object.keys(portraits).length > 0 ? portraits : undefined,
            });
          }
        }
      }

      if (syncAtLoadStart !== stemsSyncEpochRef.current) {
        return;
      }

      setDynamicSongs(songsWithStems);
      setLoadingSongs(false);

      // Если есть динамические песни, выбираем первую динамическую
      // Если нет динамических, используем первую статическую как fallback
      if (songsWithStems.length > 0) {
        setSelectedId(songsWithStems[0].id);
      } else {
        setSelectedId('');
      }
    };

    loadStemsForTracks();
  }, [albums, albumsStatus, albumsLastUpdated, publicArtistSlug]);

  // Обновляем selectedId при смене списка (не трогаем во время загрузки)
  useEffect(() => {
    if (loadingSongs || albumsStatus === 'loading') {
      return;
    }
    if (dynamicSongs.length > 0) {
      if (!dynamicSongs.find((s) => s.id === selectedId)) {
        setSelectedId(dynamicSongs[0].id);
      }
    } else {
      setSelectedId('');
    }
  }, [dynamicSongs, selectedId, loadingSongs, albumsStatus]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, []);

  // Создаём/перезагружаем движок при смене трека
  useEffect(() => {
    const song = currentSong;
    if (!song) return;

    // Фильтруем стемы: оставляем только те, у которых есть валидный URL
    const validStems: Partial<Record<StemKind, string>> = {};
    (Object.keys(song.stems) as StemKind[]).forEach((kind) => {
      const url = song.stems[kind];
      if (url && typeof url === 'string' && url.trim() !== '') {
        validStems[kind] = url;
      }
    });

    // Если нет ни одного валидного стема, не создаем движок
    if (Object.keys(validStems).length === 0) {
      console.warn('⚠️ [StemsPlayground] Нет валидных стемов для песни:', song.id, song.title);
      setLoading(false);
      return;
    }

    console.log('🎵 [StemsPlayground] Загрузка стемов для песни:', {
      songId: song.id,
      songTitle: song.title,
      stems: validStems,
    });

    setLoading(true);
    setLoadProgress(0);

    engineRef.current?.dispose();

    const engine = new StemEngine(validStems);
    engineRef.current = engine;

    (async () => {
      try {
        await engine.loadAll((p) => setLoadProgress(p));
        console.log('✅ [StemsPlayground] Стемы успешно загружены');
        setLoading(false);
        if (isPlaying) engine.play();
        (Object.keys(muted) as StemKind[]).forEach((k) => engine.setMuted(k, muted[k]));
      } catch (error) {
        console.error('❌ [StemsPlayground] Ошибка при загрузке стемов:', error);
        console.error('Стемы, которые пытались загрузить:', validStems);
        setLoading(false);
        // Можно показать ошибку пользователю
      }
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

  const selectDisabled = isPlaying || loading || albumsStatus === 'loading' || loadingSongs;

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
              value={SONGS.some((s) => s.id === selectedId) ? selectedId : ''}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="Выбор песни"
              disabled={selectDisabled}
            >
              {albumsStatus === 'loading' || loadingSongs ? (
                <option value="" disabled>
                  {lang === 'en' ? 'Loading…' : 'Загрузка…'}
                </option>
              ) : SONGS.length === 0 ? (
                <option value="" disabled>
                  {lang === 'en' ? 'No tracks with stems' : 'Нет треков со стемами'}
                </option>
              ) : (
                SONGS.map((s) => (
                  <option key={s.id} value={s.id} title={s.title}>
                    {s.title}
                  </option>
                ))
              )}
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
            img={
              currentSong?.portraits?.drums ||
              (currentSong?.stems?.drums ? (defaultPortraits.drums ?? undefined) : undefined)
            }
            active={!muted.drums}
            disabled={!currentSong?.stems?.drums}
            onClick={() => toggleMute('drums')}
          />
          <StemCard
            title={labels.bass}
            img={
              currentSong?.portraits?.bass ||
              (currentSong?.stems?.bass ? (defaultPortraits.bass ?? undefined) : undefined)
            }
            active={!muted.bass}
            disabled={!currentSong?.stems?.bass}
            onClick={() => toggleMute('bass')}
          />
          <StemCard
            title={labels.guitar}
            img={
              currentSong?.portraits?.guitar ||
              (currentSong?.stems?.guitar ? (defaultPortraits.guitar ?? undefined) : undefined)
            }
            active={!muted.guitar}
            disabled={!currentSong?.stems?.guitar}
            onClick={() => toggleMute('guitar')}
          />
          <StemCard
            title={labels.vocals}
            img={
              currentSong?.portraits?.vocal ||
              (currentSong?.stems?.vocal ? (defaultPortraits.vocal ?? undefined) : undefined)
            }
            active={!muted.vocal}
            disabled={!currentSong?.stems?.vocal}
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
  disabled = false,
  onClick,
}: {
  title: string;
  img?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={clsx('stem-card', { muted: !active, 'is-disabled': disabled })}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={
        disabled
          ? `${title}: стем не загружен`
          : `${title}: ${active ? 'звук включён' : 'звук выключен (mute)'}`
      }
      title={
        disabled
          ? `${title} — стем не загружен`
          : `${title} — ${active ? 'звук включён' : 'звук выключен (mute)'}`
      }
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
